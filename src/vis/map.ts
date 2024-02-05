import * as d3 from 'd3';
import { Control, PM, geoJSON, layerGroup, Layer, DomUtil, control, heatLayer, map as leafletMap, tileLayer, canvas } from 'leaflet';
import type { Map as LeafletMap, HeatLayer, HeatMapOptions, TileLayerOptions } from 'leaflet';
import 'leaflet.heat';
import '@geoman-io/leaflet-geoman-free';
import union from '@turf/union';
import { polygon, feature, multiPolygon, MultiPolygon, Feature, Polygon } from '@turf/helpers';
import { map } from './html-templates';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

import {Place,MapPlaceData,LocationData,OwnHierarchyNode,Coordinate,Confidences,DisplayMode,MapState} from './datatypes';
import {Dataset,ChangeScope} from './dataset';
import * as cluster from './clustering';
import * as message from './message';
import MapGlyph from './map-glyph';
import {ColorScales} from './colorscale';
import * as modal from './modal';
import View from './view';
import { zoom_level as default_zoomlevel, center as initial_map_center, radius } from './default-map-zoomlevel';
import { MapStyle, generateDefaultMapLayer, mapStyles } from '../common/map-styles';
import { MessageData } from './data-worker';
import TooltipManager from './tooltip';
import DiversityLayer from './diversity-layer';
import { map_mode } from './view-mode-defaults';
import { MapMode } from './datatypes';


export default class MapPane extends View<any, Set<number> | null> {
  private mapdiv: HTMLDivElement;
  private map: LeafletMap;
  private svg: d3.Selection<SVGSVGElement, any, any, any>;
  private g: d3.Selection<SVGGElement, any, any, any>;
  private scales: ColorScales;
  private glyphs: Array<MapGlyph> = [];
  private geoFilter: Feature<MultiPolygon | Polygon> | null = null;

  private layer: Layer;
  private layerControl: Control.Layers;
  private diversityLayer: DiversityLayer;
  private evidenceCountHeatLayer: HeatLayer;
  private evidenceCountHeatOptions: HeatMapOptions;

  private clusteringCheckbox: HTMLInputElement;
  private cachedMapMode: MapMode = map_mode;

  private map_styles: MapStyle[] = [];
  private baseLayers: Map<string, Layer> = new Map<string, Layer>();

  private readonly tooltipManager = new TooltipManager(500);
  private setupState: Promise<void>;

  private readonly onmoveend = () => this.transmitMapStateToData();

  constructor(worker: Worker, container: GoldenLayout.ComponentContainer) {
    super(worker, container, 'map');

    const div = container.element as HTMLDivElement;

    div.classList.add('map-container');
    div.innerHTML = map;
    this.mapdiv = div.querySelector('#map');

    this.setupLeaflet(this.mapdiv);

    container.on('resize', this.onresize.bind(this));
    this.worker.addEventListener('message', ({data}: {data: MessageData<any>}) => {
      if (data.type === 'set-map-state') {
        // set from outside, so no need to transmit back mapmove
        // map.setView will also fire moveend once, so ignore the first one emitted
        this.map.off('moveend', this.onmoveend);
        this.map.once('moveend', () => {
          this.map.on('moveend', this.onmoveend);
        });

        this.setMapState(data.data);
      }
    });
  }

  async setData(data: any) {
    await this.setupState;

    this.g.selectAll('*').remove();
    this.glyphs = data.glyphs.map(glyph => new MapGlyph(
      this.g,
      glyph,
      this.map,
      radius,
      this.sendToDataThread.bind(this),
      this.tooltipManager,
      data.map_mode,
    ));

    // filter from backend
    this.geoFilter = data.filter;
    if (!this.geometryEditorOpen) {
      (<any>this.map.pm.getGeomanLayers()).forEach(d => d.remove());
      if (this.geoFilter) geoJSON(this.geoFilter, { pmIgnore: false, ...this.map.pm.getGlobalOptions().pathOptions }).addTo(this.map);
      this.onEndGeometryEdit();
    }

    // update linking
    await this.linkData(this._cached_link_set);

    this.diversityLayer.setData(data.diversity);

    this.evidenceCountHeatOptions.maxZoom = this.map.getZoom();
    this.evidenceCountHeatLayer.setOptions(this.evidenceCountHeatOptions);
    this.evidenceCountHeatLayer.setLatLngs(data.distribution);

    this.cachedMapMode = data.map_mode;
    this.clusteringCheckbox.checked = (data.map_mode === MapMode.Clustered);
  }

  private _cached_link_set: Set<number> | null = null;
  async linkData(loc_ids: Set<number> | null) {
    this._cached_link_set = loc_ids;

    if (loc_ids === null) {
      this.g.classed('map-overlay--brushed', false);
      this.glyphs.forEach(d => d.resetMapBrush());
    } else {
      this.g.classed('map-overlay--brushed', true);
      this.glyphs.forEach(d => d.link(loc_ids));

      // pan to location(s) if all one cluster
      for (const glyph of this.glyphs) {
        if (glyph.match(loc_ids)) {
          this.map.panTo(this.map.layerPointToLatLng(glyph.center));
          break;
        }
      }
    }
  }

  colorscale(scale: ColorScales) {
    this.scales = scale;
  }

  private onmove(): void {
    let pos = (d3.select('div.leaflet-map-pane').node() as any)._leaflet_pos;
    this.svg.style('transform', 'translate(' + (-pos.x) + 'px,' + (-pos.y) + 'px)');
    this.g.attr('transform', 'translate(' + (pos.x) + ',' + (pos.y) + ')');
  }

  private onresize(): void {
    const bbox = this.mapdiv.getBoundingClientRect();
    this.svg.style('width', `${bbox.width}px`)
      .style('height', `${bbox.height}px`);
    this.map.invalidateSize();
  }

  private onclick(): void {
    if (this.geometryEditorOpen) return;

    this.g.selectAll('.currently-brushed')
      .classed('currently-brushed', false);
    this.sendToDataThread('clear-brush', null);
  }

  private updateLocations(): void {
    this.onmove();
    this.g.selectAll('*').remove();
    this.worker.postMessage({type: 'set-zoom-level', data: this.map.getZoom()});
  }

  moveToLocation(coord: Coordinate | null): void {
    if (coord === null) return;
    this.map.setView(coord, this.map.getZoom());
  }

  protected openModal(): void {
    modal.showInfoboxFromURL('Map View', 'map.html');
  }

  private setMapStyle(layer_key: string): void {
    this.map_styles.forEach(({key}) => {
      this.svg.classed(`map__svg--${key}`, layer_key === key);
    });
  }

  private setupLeaflet(div_: HTMLDivElement): void {
    const mapOptions = {
      worldCopyJump: true,
      maxBoundsViscosity: 0.7,
      zoomSnap: 0.25,
    };
    this.map = leafletMap(div_, mapOptions).setView(initial_map_center, default_zoomlevel);

    /* LAYERS */
    this.layerControl = control.layers();
    this.layerControl.addTo(this.map);

    // marker layer
    const container = DomUtil.create('div', 'markers');
    this.layer = new Layer();
    this.layer.onAdd = function(map) {
      var pane = map.getPane('marker') || map.createPane('marker');
      pane.appendChild(container);
      return this;
    };
    this.layer.onRemove = function(map) {
      DomUtil.remove(container);
      return this;
    };
    this.layer.addTo(this.map);
    this.layerControl.addOverlay(this.layer, '<b>Markers:</b> Aggregated markers for location clusters');

    // clustering control pane
    const clusteringControl = new Control({position: 'topright'});
    const ref = this;
    clusteringControl.onAdd = function(_) {
      const div = DomUtil.create('div', 'leaflet-control-clustering');
      div.innerHTML = `
        <input type="checkbox" id="map-control-clustering">
        <label for="map-control-clustering">Cluster</label>
      `;
      div.setAttribute('title', 'Cluster locations in the map into glyphs. This is the default. See the info texts of the map view and the settings pane for more details.');

      div.addEventListener('click', e => e.stopPropagation());
      const input = div.querySelector<HTMLInputElement>(':scope input');
      input.checked = ref.cachedMapMode === MapMode.Clustered;
      input.addEventListener('change', () => {
        ref.sendToDataThread('set-map-mode', input.checked ? MapMode.Clustered : MapMode.Cluttered);
      });
      ref.clusteringCheckbox = input;

      return div;
    };
    clusteringControl.addTo(this.map);


    /* SVG OVERLAY */
    this.svg = d3.select(container).append('svg');
    this.svg.style('--clr-icon', 'black');

    const div = d3.select(div_);
    this.svg.style('width', div.style('width'))
      .style('height', div.style('height'))
      .classed('map__svg--dark', true);
    this.g = this.svg.append('g')
      .classed('leaflet-zoom-hide', true)
      .classed('map-overlay', true);


    const mapbox_layers = new Set<string>();
    const mapbox_attribution = new Control({position: 'bottomleft'});
    mapbox_attribution.onAdd = function(_) {
      const div = DomUtil.create('div', 'attribution');
      div.innerHTML = `<a href="http://mapbox.com/about/maps" class='mapbox-wordmark' target="_blank">Mapbox</a>`;
      return div;
    };

    const fun = this.updateLocations.bind(this);
    this.map.on('zoomend', fun);
    this.map.on('viewreset', fun);
    this.map.on('resize', this.onmove.bind(this));
    this.map.on('resize', this.onresize.bind(this));
    this.map.on('move', this.onmove.bind(this));
    this.map.on('click', this.onclick.bind(this));
    this.map.on('moveend', this.onmoveend);
    this.map.on('baselayerchange', (x: {layer}) => {
      this.setMapStyle(x.layer.options.id)

      if (mapbox_layers.has((<any>x).name)) {
        mapbox_attribution.addTo(this.map);
      } else {
        mapbox_attribution.remove();
      }

      this.transmitMapStateToData();
    });

    this.map.on('overlayadd', () => this.transmitMapStateToData());
    this.map.on('overlayremove', () => this.transmitMapStateToData());

    const gradient = {};
    d3.range(20).forEach(d => gradient[d/19] = d3.interpolateTurbo(d/19));

    // heatmap
    this.evidenceCountHeatOptions = {
      radius: 0.8*radius,
      max: 1,
      maxZoom: this.map.getZoom(),
      blur: 15,
      gradient,
      minOpacity: 0.2,
    };

    this.diversityLayer = new DiversityLayer();
    this.layerControl.addOverlay(this.diversityLayer.markerLayer, '<b>Diversity Markers:</b> Places, colored by religious diversity');
    this.layerControl.addOverlay(this.diversityLayer.densityLayer, '<b>Diversity Distribution:</b> Density map of distinct religious denominations per place');

    this.evidenceCountHeatLayer = heatLayer([], this.evidenceCountHeatOptions);
    this.layerControl.addOverlay(this.evidenceCountHeatLayer, '<b>Distribution:</b> Heatmap of count of evidence');

    // load map styles
    const stylePromise = mapStyles();
    const defaultLayerPromise = generateDefaultMapLayer();

    this.setupState = Promise.all([stylePromise, defaultLayerPromise]).then(([ms, defaultMapLayer]) => {
      // TODO: make this conditional again, with configurable relief map availability
      if (defaultMapLayer !== null) {
        this.layerControl.addBaseLayer(defaultMapLayer, 'Relief and water');
        this.baseLayers.set('srtm', defaultMapLayer);
        defaultMapLayer.addTo(this.map);
      }
      // other layers
      this.map_styles = ms;
      this.map_styles.forEach((style) => {
        if (style.is_mapbox) mapbox_layers.add(style.name);

        const layer = tileLayer(style.url, (style.options || {}) as TileLayerOptions);
        this.layerControl.addBaseLayer(layer, style.name);
        this.baseLayers.set(style.key, layer);
      });

      const preferredLayer = this.map_styles.find(d => d.default_) ?? this.map_styles[0];
      if (defaultMapLayer === null) {
        this.baseLayers.get(preferredLayer.key)?.addTo(this.map);
      }
    });

    // Geoman
    const o = this.map.pm.getGlobalOptions();
    const l = layerGroup().addTo(this.map);
    o.layerGroup = l;
    o.templineStyle = {
      color: 'steelblue',
      weight: 2,
    };
    o.hintlineStyle = {
      color: 'steelblue',
      dashArray: [5,5],
      weight: 2,
    };
    o.pathOptions = {
      color: 'black',
      fillColor: 'black',
      fillOpacity: 0.1,
      weight: 0.5
    };

    this.map.pm.setGlobalOptions(o);

    this.map.pm.Toolbar.createCustomControl({
      name: 'clearFilter',
      block: 'custom',
      title: 'Clear filter',
      className: 'leaflet-pm-icon-clear-geometry',
      onClick: () => {
        (<any>this.map.pm.getGeomanLayers()).forEach(d => d.remove());
      },
      toggle: false,
    });
    this.map.pm.Toolbar.createCustomControl({
      name: 'revertFilter',
      block: 'custom',
      title: 'Revert filter',
      className: 'leaflet-pm-icon-revert-geometry',
      onClick: () => {
        (<any>this.map.pm.getGeomanLayers()).forEach(d => d.remove());
        if (this.geoFilter) geoJSON(this.geoFilter, { pmIgnore: false, ...this.map.pm.getGlobalOptions().pathOptions }).addTo(this.map);

        this.onEndGeometryEdit();
      },
      toggle: false,
    });
    this.map.pm.Toolbar.createCustomControl({
      name: 'applyFilter',
      block: 'custom',
      title: 'Apply filter',
      className: 'leaflet-pm-icon-save-geometry',
      onClick: () => {
        this.geoFilter = this.toGeoJSON();
        (<any>this.map.pm.getGeomanLayers()).forEach(d => d.remove());
        if (this.geoFilter) geoJSON(this.geoFilter, { pmIgnore: false, ...this.map.pm.getGlobalOptions().pathOptions }).addTo(this.map);

        this.sendToDataThread('set-map-filter', this.geoFilter);
        this.transmitMapStateToData();
        this.onEndGeometryEdit();
      },
      toggle: false,
    });
    this.map.pm.Toolbar.createCustomControl({
      name: 'editFilter',
      block: 'custom',
      title: 'Edit geographical filter',
      className: 'leaflet-pm-icon-edit-geometry',
      onClick: () => this.onStartGeometryEdit(),
      toggle: false,
    });

    if (this.geoFilter) geoJSON(this.geoFilter, { pmIgnore: false }).addTo(this.map);

    this.onEndGeometryEdit();
  }

  private toGeoJSON(): Feature<MultiPolygon | Polygon> | null {
    const fs = (<any[]>this.map.pm.getGeomanLayers()).map(layer => {
        if (layer.pm._shape === 'Polygon') return layer.toGeoJSON();
        else if (layer.pm._shape === 'Rectangle') return layer.toGeoJSON();
        else if (layer.pm._shape === 'Circle') return PM.Utils.circleToPolygon(layer).toGeoJSON();
        else throw new Error(`Unknown Geoman layer type: ${layer.pm._shape}`);
      });
    if (fs.length === 0) return null;

    let f = fs.shift();
    while (fs.length > 0) {
      const f2 = fs.shift();
      f = union(f, f2);
    }

    return f;
  }

  private geometryEditorOpen: boolean = false;

  private onStartGeometryEdit() {
    this.mapdiv.classList.add('no-marker-interaction');
    this.geometryEditorOpen = true;

    this.map.pm.addControls(<any>{
      position: 'topleft',

      drawControls: true,
      editControls: true,
      optionsControls: true,
      customControls: true,
      oneBlock: false,

      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawText: false,
      rotateMode: false,

      revertFilter: true,
      applyFilter: true,
      clearFilter: true,
      editFilter: false,
    });
  }

  private onEndGeometryEdit() {
    this.mapdiv.classList.remove('no-marker-interaction');
    this.geometryEditorOpen = false;

    this.map.pm.addControls(<any>{
      position: 'topleft',
      drawControls: false,
      editControls: false,
      optionsControls: false,
      customControls: true,
      oneBlock: true,

      revertFilter: false,
      applyFilter: false,
      clearFilter: false,
      editFilter: true,
    });
  }

  private transmitMapStateToData() {
    const zoom = this.map.getZoom();
    const center = this.map.getCenter();
    const base_layer = (() => {
      for (const [key, layer] of Array.from(this.baseLayers.entries())) {
        if (this.map.hasLayer(layer)) return key;
      }

      return null;
    })();
    const overlay_layers = [];
    if (this.map.hasLayer(this.layer)) overlay_layers.push('markerLayer');
    if (this.map.hasLayer(this.diversityLayer.markerLayer)) overlay_layers.push('diversityMarkerLayer');
    if (this.map.hasLayer(this.diversityLayer.densityLayer)) overlay_layers.push('diversityDensityLayer');
    if (this.map.hasLayer(this.evidenceCountHeatLayer)) overlay_layers.push('evidenceCountHeatLayer');

    const state = { zoom, center, base_layer, overlay_layers };

    this.sendToDataThread('set-map-state', state);
  }

  private setMapState(state: MapState | null) {
    if (state === null) {
      console.error('Map state is null.');
      this.transmitMapStateToData();
    } else {
      this.map.setView(state.center, state.zoom);
      const layer = this.baseLayers.get(state.base_layer);
      if (layer) layer.addTo(this.map);
      else {
        const def = this.map_styles.find(d => d.default_);
        if (def) {
          console.warn(`Could not find map style "${state.base_layer}", loading default layer "${def.key}" instead.`);
          this.baseLayers.get(def.key).addTo(this.map);
        } else {
          const def = this.map_styles[0];
          console.warn(`Could not find map style "${state.base_layer}", loading first layer "${def.key}" instead.`);
          this.baseLayers.get(def.key).addTo(this.map);
        }
      }

      if (state.overlay_layers.includes('markerLayer')) {
        if (!this.map.hasLayer(this.layer)) this.layer.addTo(this.map);
      } else {
        if (this.map.hasLayer(this.layer)) this.map.removeLayer(this.layer);
      }

      if (state.overlay_layers.includes('diversityMarkerLayer')) {
        if (!this.map.hasLayer(this.diversityLayer.markerLayer)) this.diversityLayer.markerLayer.addTo(this.map);
      } else {
        if (this.map.hasLayer(this.diversityLayer.markerLayer)) this.map.removeLayer(this.diversityLayer.markerLayer);
      }

      if (state.overlay_layers.includes('diversityDensityLayer')) {
        if (!this.map.hasLayer(this.diversityLayer.densityLayer)) this.diversityLayer.densityLayer.addTo(this.map);
      } else {
        if (this.map.hasLayer(this.diversityLayer.densityLayer)) this.map.removeLayer(this.diversityLayer.densityLayer);
      }

      if (state.overlay_layers.includes('evidenceCountHeatLayer')) {
        if (!this.map.hasLayer(this.evidenceCountHeatLayer)) this.evidenceCountHeatLayer.addTo(this.map);
      } else {
        if (this.map.hasLayer(this.evidenceCountHeatLayer)) this.map.removeLayer(this.evidenceCountHeatLayer);
      }
    }
  }
};
