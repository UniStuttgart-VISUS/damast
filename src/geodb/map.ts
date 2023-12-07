import { map, Control, DomUtil, tileLayer, control, featureGroup, icon, marker as leafletMarker, geoJSON, canvas, layerGroup } from 'leaflet';
import type { FeatureGroup, Map, LatLngLiteral } from 'leaflet';
import * as d3 from 'd3';
import * as _ from 'lodash';

import { mapStyles, MapStyle } from '../common/map-styles';

export default class MapPane {
  private readonly map: Map;

  private _selected_place_id: number | null = null;
  private _matching_place_ids: Set<number> = new Set<number>();
  private _place_data: any[] = [];

  private selected_marker_layer: FeatureGroup;
  private other_marker_layer: FeatureGroup;
  private map_styles: MapStyle[];
  private loadState: Promise<void>;

  constructor(
    private readonly dispatch: d3.Dispatch<any>,
    map_section: d3.Selection<HTMLDivElement, any, any, any>
  ) {
    const div = map_section.append('div')
      .style('height', '400px')
      .style('width', '600px');
    this.map = map(div.node(), {
      center: [0,0],
      zoom: 3
    });

    const mapbox_layers = new Set<string>();
    const mapbox_attribution = new Control({position: 'bottomleft'});
    mapbox_attribution.onAdd = function(_) {
      const div = DomUtil.create('div', 'attribution');
      div.innerHTML = `<a href="http://mapbox.com/about/maps" class='mapbox-wordmark' target="_blank">Mapbox</a>`;
      return div;
    };

    this.map.on('baselayerchange', (x) => {
      if (mapbox_layers.has((<any>x).name)) {
        mapbox_attribution.addTo(this.map);
      } else {
        mapbox_attribution.remove();
      }
    });

    // load map styles
    const stylePromise = mapStyles();
    const geoJSONPromise = d3.json<GeoJSON.FeatureCollection & { crs: any }>('../vis/water-features.geo.json')

    this.loadState = Promise.all([stylePromise, geoJSONPromise]).then(([ms, geojson]) => {
      this.map_styles = ms;

      const layers = {};

      // SRTM Hillshading + Natural Earth water features
      const tileServerUrl = 'http://localhost:8001/tiles/{z}/{x}/{y}.png';
      const renderer = canvas();

      const lowLevelOfDetailTileLayer = tileLayer(tileServerUrl, {
        minNativeZoom: 2,
        maxNativeZoom: 8,
        pane: 'tilePane',
      });
      const highLevelOfDetailTileLayer = tileLayer(tileServerUrl, {
        minZoom: 9,
        minNativeZoom: 9,
        maxNativeZoom: 12,
        pane: 'tilePane',
      });

      const { type, crs, features } = geojson;

      const areas = {
        type, crs,
        features: features.filter(v => v.geometry.type === 'Polygon' || v.geometry.type === 'MultiPolygon'),
      };
      const lines = {
        type, crs,
        features: features.filter(v => v.geometry.type === 'LineString' || v.geometry.type === 'MultiLineString'),
      };

      const lineLayer = geoJSON(lines, {
        style: {
          stroke: true,
          fill: false,
          color: '#758591',
          weight: 2,
          renderer,
        },
        pane: 'tilePane',
      });
      const areaLayer = geoJSON(areas, {
        style: {
          stroke: false,
          fill: true,
          fillColor: '#758591',
          fillOpacity: 1,
          renderer,
        },
        pane: 'tilePane',
      });

      const srtmGroup = layerGroup([
        lowLevelOfDetailTileLayer,
        highLevelOfDetailTileLayer,
        lineLayer,
        areaLayer,
      ], {
        attribution: 'Made with Natural Earth. Map tiles &copy; <a href="" target="_blank">2023 Max Franke</a>',
      });

      layers['Hill shades and water'] = srtmGroup;
      srtmGroup.addTo(this.map);

      this.map_styles.forEach(layer => {
        if (layer.is_mapbox) mapbox_layers.add(layer.name);
        layers[layer.name] = tileLayer(layer.url, layer.options || {});
      });
      control.layers(layers).addTo(this.map);
    });

    this.selected_marker_layer = featureGroup().addTo(this.map);
    this.other_marker_layer = featureGroup().addTo(this.map);

    this.dispatch.on('places-loaded', this.onTableLoaded.bind(this));
    this.dispatch.on('places-filtered', this.onPlacesFiltered.bind(this));
    this.dispatch.on('place-selected', this.onPlaceSelected.bind(this));
    this.dispatch.on('place-updated', this.onRowChange.bind(this));
    this.dispatch.on('place-added', this.onRowAdd.bind(this));
    this.dispatch.on('place-deleted', this.onRowRemove.bind(this));
  }

  private onTableLoaded(data: any[]): void {
    this._place_data = data;
    this._matching_place_ids = new Set<number>(data.map(d => d.id));
    this.recreateMarkers();
  }

  private onPlacesFiltered(ids: number[]): void {
    this._matching_place_ids = new Set<number>(ids);
    this.recreateMarkers();
  }

  private onPlaceSelected(datum: any): void {
    this._selected_place_id = datum.id;
    const latlng = datum.geoloc;
    if (
      latlng &&
      (typeof latlng.lat === 'number') &&
      (typeof latlng.lng === 'number')
    ) this.map.setView(latlng, 8);

    this.recreateMarkers();
  }

  private onRowChange(datum): void {
    // find in data
    this._place_data.forEach(d => {
      if (d.id === datum.id) {
        d.geoloc = datum.geoloc;
      }
    });

    this.recreateMarkers();
  }

  private onRowAdd(datum): void {
    this._place_data.push(datum);
    this.recreateMarkers();
  }

  private onRowRemove(id: number): void {
    const idx = this._place_data.findIndex(d => d.id === id);
    if (idx >= 0) {
      this._place_data.splice(idx, 1);
      this.recreateMarkers();
    }
  }

  private recreateMarkers(): void {
    this.selected_marker_layer.clearLayers();
    this.other_marker_layer.clearLayers();

    this._place_data.forEach(datum => {
      const d = datum.geoloc;
      if (!d || d.lat === null || d.lat === undefined || d.lng === null || d.lng === undefined) return;
      const {lat, lng} = d;

      if (datum.id === this._selected_place_id) {
        const marker = leafletMarker({lat, lng}, {
          zIndexOffset: 1000,
          draggable: true,
          icon: icon({
            iconUrl: 'images/marker-icon-red.png',
            iconRetinaUrl: 'images/marker-icon-2x-red.png',
            shadowUrl: 'images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        });
        marker.on('dragend', () => {
          this.dispatch.call('map-updated', null,
            this._selected_place_id,
            _.pick(marker.getLatLng(), ['lat', 'lng']));
        });
        this.selected_marker_layer.addLayer(marker);
      } else {
        const active = this._matching_place_ids.has(datum.id);
        const prefix = active ? 'blue' : 'grey';
        const marker = leafletMarker({lat, lng}, {
          opacity: active ? 0.7 : 0.5,
          zIndexOffset: active ? 500 : 0,
          icon: icon({
            iconUrl: `images/marker-icon-${prefix}.png`,
            iconRetinaUrl: `images/marker-icon-2x-${prefix}.png`,
            shadowUrl: 'images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        });
        this.other_marker_layer.addLayer(marker);
        marker.on('click', () => this.dispatch.call('map-selected', null, datum.id));
      }
    });
  }

  private latLngFromString(s: string | null): LatLngLiteral | null {
    const coord = /^\((-?\d+(\.\d+)?),(-?\d+(\.\d+)?)\)$/;

    if (s === null) return null;
    const match = coord.exec(s);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);
    return {lat,lng};
  }

  private latLngToString(l: LatLngLiteral): string {
    const f = d3.format('.6f');
    return `(${f(l.lat)},${f(l.lng)})`;
  }
};
