import * as d3 from 'd3';
import * as L from 'leaflet';
import * as T from './datatypes';
import * as glyph from './map-data';
import {MessageDataType} from './data-worker';
import TooltipManager from './tooltip';

export default class MapGlyph {
  private _total_group: d3.Selection<SVGGElement, any, any, any>;
  private _places_group: d3.Selection<SVGGElement, any, any, any>;
  private _blobs_group: d3.Selection<SVGGElement, any, any, any>;

  private _center: L.Point;

  constructor(
    private _parent_layer: d3.Selection<SVGGElement, any, any, any>,
    private _data: glyph.MapGlyph,
    private map: L.Map,
    private _radius: number,
    private _brush_callback: (type: MessageDataType, data: any) => void,
    private readonly tooltipManager: TooltipManager,
    private map_mode: T.MapMode,
  ) {
    const center_pos = L.CRS.EPSG3857.pointToLatLng(L.point(this._data.center.x, this._data.center.y), map.getZoom());
    this._center = this.map.latLngToLayerPoint(center_pos);

    this._total_group = this._parent_layer.append('g')
      .classed('cluster', true)
      .attr('transform', 'translate(' + (this._center.x) + ',' + (this._center.y) + ')');

    this._blobs_group = this._total_group.append('g')
      .classed('cluster__scaled-items', true)
      .classed('cluster__religion-indicator-items', true);
    this._places_group = this._total_group.append('g')
      .classed('cluster__locations', true);

    // add content that was created in WebWorker
    this._blobs_group.html(this._data.circles.join(' '))

    if (this.map_mode === T.MapMode.Clustered) {
      this._total_group.append('circle')
        .attr('r', 2*this._radius)
        .classed('cluster__mouseover-hidden', true)
        .on('mouseenter', this.mouseenter.bind(this))
        .on('mouseleave', this.mouseleave.bind(this))
        .on('click', e => this.brush(e));

      this.create_location_indicators(this.map);
    } else {
      this._total_group
        .on('mouseenter', this.mouseenter.bind(this))
        .on('mouseleave', this.mouseleave.bind(this))
        .on('click', e => this.brush(e));
    }
  }

  private brush(e: Event): void {
    e.stopPropagation();
    const prev_brushed = this._total_group.classed('cluster--brushed');

    if (prev_brushed) {
      this._brush_callback('clear-brush', null);
    } else {
      this._brush_callback('set-brush', {
          religion_ids: this._data.religion_ids,
          source_ids: this._data.source_ids,
          place_ids: this._data.place_ids,
          tuple_ids: this._data.tuple_ids,
        });
    }
  }

  private mouseenter(): void {
    const { x, y } = this.map.latLngToContainerPoint(this.map.layerPointToLatLng(this._center));
    const { top, left } = this.map.getContainer().getBoundingClientRect();
    this.tooltipManager.move(x + left, y + top);
    this.tooltipManager.create(t => {
      t.root.node().innerHTML = this._data.tooltip;
    });
  }

  private mouseleave(): void {
    this.tooltipManager.cancel();
  }

  private create_location_indicators(map: L.Map): void {
    this._data.geolocs.forEach(d => {
      const xy = map.latLngToLayerPoint(d);
      const x = xy.x - this._center.x;
      const y = xy.y - this._center.y;

      this._places_group.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 2)
        .classed('cluster__location-indicator', true);
    });
  }

  resetMapBrush(): void {
    this._total_group.classed('cluster--brushed', false)
  }

  link(location_ids: Set<number>): void {
    this._total_group.classed('cluster--brushed', Array.from(this._data.place_ids).some(d => location_ids.has(d)));
  }

  get center(): L.Point {
    return this._center;
  }

  // glyph contains full set of locations with id
  match(location_ids: Set<number>): boolean {
    return Array.from(location_ids).every(loc_id => this._data.place_ids.has(loc_id));
  }
};

