import * as d3shape from 'd3-shape';
import * as d3array from 'd3-array';

import {DataWorker,MessageData} from './data-worker';
import {zoom_level as _zoom_level, radius} from './default-map-zoomlevel';
import * as T from './datatypes';
import {Cluster} from './clustering';
import * as glyph from './map-data';
import { LocationFilter } from './location-filter';

const clustering = import('wasm-clustering');

const deg2rad = Math.PI / 180;

class MapWorker extends DataWorker<any> {
  private zoom_level: number = _zoom_level;

  private places: T.MapPlaceData[];
  private place_map: Map<number, T.Place>;
  private religion_parent_by_level: Array<Map<number, number>>;
  private religion_order: {};
  private color_scale: {};
  private parent_religions: {};
  private main_religion_icons: {};
  private display_mode: T.DisplayMode;
  private active_aspect_key: string;
  private religion_names: Map<number, string>;
  private filter: LocationFilter = null;
  private map_mode: T.MapMode;

  private wasm_clustering: any = null;

  async handleMainEvent(data: MessageData<any>) {
    if (data.type === 'set-zoom-level') {
      this.zoom_level = data.data;
      await this.calculateAndSend();
    } else {
      throw data;
    }
  }

  async handleDataEvent(data: MessageData<any>) {
    if (this.wasm_clustering === null) this.wasm_clustering = await clustering;

    if (data.type === 'set-data') {
      this.places = data.data.place_data;
      this.place_map = data.data.place_map;
      this.religion_parent_by_level = data.data.parents_per_level;
      this.religion_order = data.data.religion_order;
      this.color_scale = data.data.colors;
      this.parent_religions = data.data.parent_religions;
      this.main_religion_icons = data.data.main_religion_icons;
      this.display_mode = data.data.display_mode;
      this.active_aspect_key = data.data.active_aspect_key;
      this.religion_names = data.data.religion_names;
      this.filter = data.data.filter;
      this.map_mode = data.data.map_mode;

      await this.calculateAndSend();
    } else if (data.type === 'set-map-state') {
      this.sendToMainThread({type: 'set-map-state', data: data.data, target: 'map'});
    } else {
      throw data;
    }
  }

  private doClustering(active: CollectedPlace[]): Cluster<CollectedPlace>[] {
    const poss: Array<number> = [];
    active.forEach(d => { poss.push(d.geoloc.lat); poss.push(d.geoloc.lng); });
    const f32 = Float32Array.from(poss);
    const res: number[] = Array.from(this.wasm_clustering.cluster(f32, 4*radius, this.zoom_level));

    // recreate clusters
    const clusters: Cluster<CollectedPlace>[] = [];
    while (res.length > 0) {
      const cluster_length = res[0];
      const x = res[1];
      const y = res[2];

      res.splice(0, 3);
      const members = res.splice(0, cluster_length).map(d => active[d]);

      clusters.push({members, x, y, count: cluster_length, per_religion: new Map()});
    }

    return clusters;
  }

  private convertToSingularClusters(active: CollectedPlace[]): Cluster<CollectedPlace>[] {
    const scale = 256 / (2 * Math.PI) * Math.pow(2, this.zoom_level);
    return active.map(d => {
      const { x,y } = project(d.geoloc, this.zoom_level);

      return {
        members: [d],
        x, y,
        count: 1,
        per_religion: new Map(),
      };
    });
  }

  private async calculateAndSend() {
    // uninitialized
    if (this.wasm_clustering === null) return;

    this.setMessage('map-worker.calculateAndSend', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

    const active = collect_active_places(this.places, this.place_map);

    /**************** CLUSTERING ****************************/
    console.time('clustering');
    const clusters = (this.map_mode === T.MapMode.Clustered)
      ? this.doClustering(active)
      : this.convertToSingularClusters(active);
    console.timeEnd('clustering');
    /********************************************************/

    const level = (this.map_mode === T.MapMode.Clustered)
      ? trim_hierarchy(clusters, this.religion_parent_by_level)
      : this.religion_parent_by_level.length - 1;  // every religion maps to itself
    const glyphs = clusters.map(d => this.createClusterGlyph(d, level));

    const { diversity, distribution } = count_diversity_per_place(this.places, this.place_map);

    await this.sendToMainThread({
      type: 'set-data',
      target: 'map',
      data: {
        glyphs,
        diversity,
        distribution,
        filter: this.filter,
        map_mode: this.map_mode,
      }
    });

    this.clearMessage('map-worker.calculateAndSend');
  }

  private createClusterGlyph(cluster: Cluster<CollectedPlace>, level: number): glyph.MapGlyph {
    const data = data_for_cluster(cluster);
    const by_religion = group_data_by_religion(data, this.religion_parent_by_level[level], this.religion_order);

    const religion_ids = new Set<number>(data.map(d => d.religion_id));
    const source_ids = new Set<number>(data.map(d => d.source_ids).reduce((a, b) => a.concat(b), []));
    const place_ids = new Set<number>(data.map(d => d.place_id));
    const tuple_ids = new Set<number>(data.map(d => d.tuple_id));
    const geolocs = cluster.members.map(d => d.geoloc);
    const center = { x: cluster.x, y: cluster.y };

    const symbol_radius = (this.map_mode === T.MapMode.Clustered)
      ? radius * 0.8
      : 4;
    const d = calculateOffsets(by_religion.length, this.map_mode, symbol_radius);

    const arc = d3shape.arc<any, any>()
      .innerRadius(0)
      .outerRadius(symbol_radius);
    const arcx = d3shape.pie<any, any>()
      .sort(null)
      .sortValues(null)
      .value(d => d.count);

    const circles: string[] = [];
    by_religion.forEach((br,i) => {
      const main_religion_icon = this.main_religion_icons[this.parent_religions[br[0].religion_id]];

      const retval = (this.display_mode === T.DisplayMode.Religion)
        ? glyph.create_arc_data_religion(br, this.color_scale, this.religion_order)
        : glyph.create_arc_data_confidence(br, this.color_scale, this.active_aspect_key);
      const arcdata = arcx(retval);

      // initial
      let circle_glyph = `<g class="cluster__circle" transform="translate(${d[i].x}, ${d[i].y})">`;
      arcdata.forEach(d => {
        const shape = arc(d);
        circle_glyph += `<path ${d.data.active?'':'class="unselected" '}fill="${d.data.fill}" d=${shape}></path>`;
      });
      circle_glyph += `<circle class="cluster__border" r="${symbol_radius}"></circle>`;
      if (this.map_mode === T.MapMode.Clustered) circle_glyph += `<g class="cluster__icon"><use transform="scale(${symbol_radius / 100 * Math.SQRT2})" href="${main_religion_icon}"></use></g>`;
      circle_glyph += '</g>';

      circles.push(circle_glyph);
    });

    const tooltip = createTooltip(cluster, religion_ids, source_ids, place_ids, tuple_ids, geolocs, this.religion_names);

    return {
      tuple_ids, religion_ids, source_ids, place_ids,
      geolocs,
      center,
      radius,
      circles,
      tooltip
    };
  }
};

function createTooltip(
  cluster: Cluster<CollectedPlace>,
  religion_ids: Set<number>,
  source_ids: Set<number>,
  place_ids: Set<number>,
  tuple_ids: Set<number>,
  geolocs: T.Coordinate[],
  religion_names: Map<number, string>,
): string {
  if (cluster.count > 5) {
    return `<p>
      <strong>${tuple_ids.size}</strong> evidence tuples 
        (<strong>${religion_ids.size}</strong> distinct religions)
        in <strong>${cluster.count}</strong> places
      </p>`;
  } else if (cluster.count === 1) {
    const elem = cluster.members[0];
    let ret = `<h1>${elem.name}</h1>
      <p>
        ${Math.sign(elem.geoloc.lat) > 0 ? 'N' : 'S'}&thinsp;${Math.abs(elem.geoloc.lat)}°
        &emsp;
        ${Math.sign(elem.geoloc.lng) > 0 ? 'E' : 'W'}&thinsp;${Math.abs(elem.geoloc.lng)}°
      </p>`;

    if (elem.data.length < 10) {
      ret += `<ul>`

      elem.data.map((d: any): [number, number, string] => {
        const rel = religion_names.get(d.religion_id);
        const [a, b, span] = (d.time_span === null)
          ? [ Infinity, Infinity, `?` ]
          : [ d.time_span.start, d.time_span.end, `${d.time_span.start}&ndash;${d.time_span.end} (${d.time_confidence})` ];
        return [ a, b,
          `<li><em>${span}:</em> <strong>${rel}</strong> (${d.religion_confidence}) (evidence ${d.interpretation_confidence})</li>`];
      })
        .sort((a,b) => a[0] - b[0] || a[1] - b[1])
        .forEach(([_, __, s]) => ret += s);

      ret += `</ul>`;
    } else {
      const rels = new Set<number>(elem.data.map(d => d.religion_id));
      const relinfo = (rels.size <= 3)
        ? Array.from(rels).map(d => religion_names.get(d)).join(', ')
        : `${rels.size} distinct religions`;

      const numTuples = new Set<number>(elem.data.map(d => d.tuple_id)).size;
      const start = Math.min(...elem.data.filter(d => d.time_span !== null).map(d => d.time_span.start));
      const end = Math.max(...elem.data.filter(d => d.time_span !== null).map(d => d.time_span.end));

      ret += `<p>${relinfo} (${numTuples} evidence${numTuples > 1 ? 's' : ''}, ${elem.data.length} time instances) between <strong>${start === Infinity ? 'unknown' : start}</strong> and <strong>${end === Infinity ? 'unknown' : end}.</strong></p>`;
    }

    return ret;
  } else {
    let ret = `<h1>${tuple_ids.size}</strong> evidence tuples (${religion_ids.size} distinct religions) in ${cluster.count} places</h1>`;

    ret += `<ul>`
    cluster.members.forEach(elem => {
      ret += `<li><strong>${elem.name}</strong>`;

      ret += `<p>
        ${Math.sign(elem.geoloc.lat) > 0 ? 'N' : 'S'}&thinsp;${Math.abs(elem.geoloc.lat)}°
        &emsp;
        ${Math.sign(elem.geoloc.lng) > 0 ? 'E' : 'W'}&thinsp;${Math.abs(elem.geoloc.lng)}°
      </p>`;

      const rels = new Set<number>(elem.data.map(d => d.religion_id));
      const relinfo = (rels.size <= 3)
        ? Array.from(rels).map(d => religion_names.get(d)).join(', ')
        : `${rels.size} distinct religions`;

      const numTuples = new Set<number>(elem.data.map(d => d.tuple_id)).size;
      const start = Math.min(...elem.data.filter(d => d.time_span !== null).map(d => d.time_span.start));
      const end = Math.max(...elem.data.filter(d => d.time_span !== null).map(d => d.time_span.end));

      ret += `<p>${relinfo} (${numTuples} evidence${numTuples > 1 ? 's' : ''}, ${elem.data.length} time instances) between <strong>${start === Infinity ? 'unknown' : start}</strong> and <strong>${end === Infinity ? 'unknown' : start}.</strong></p></li>`;
    });

    ret += `</ul>`;
    return ret;
  }
}

type CollectedPlace = T.Place & { data: T.MapPlaceData[] };

function collect_active_places(evidence: T.MapPlaceData[], places: Map<number, T.Place>): CollectedPlace[] {
  const by_place_id: Map<number, T.MapPlaceData[]> = d3array.rollup(evidence, v => v, d => d.place_id);

  const place_data: CollectedPlace[] = [];
  by_place_id.forEach((v, place_id) => {
    const p = places.get(place_id);
    if (p.geoloc) {
      const place: CollectedPlace = {
        id: place_id,
        location_confidence: p.location_confidence,
        name: p.name,
        geoloc: p.geoloc,
        data: v,
      };
      place_data.push(place);
    }
  });

  return place_data;
}


// project into Web Mercator
function project(geoloc: {lat: number, lng: number}, zoom_level: number): {x: number, y: number} {
  const lat = Math.PI / 180 * geoloc.lat;
  const lng = Math.PI / 180 * geoloc.lng;

  const x = Math.floor(256 / (2*Math.PI) * Math.pow(2, zoom_level) * (lng + Math.PI));
  const y = Math.floor(
    256 / (2*Math.PI) * Math.pow(2, zoom_level) * (
      Math.PI - Math.log(
        Math.tan(Math.PI/4 + lat/2)
      )
    )
  );

  return {x,y};
}


// find out how many circles there would be with consistent hierarchy cutoff
function trim_hierarchy(clusters: Cluster<CollectedPlace>[], parents_per_level) {
  const data_per_cluster = clusters.map(data_for_cluster);

  let allowed_level = -1;
  const max_symbols_per_glyph = 4;

  parents_per_level.forEach((map, level) => {
    const maximum_religions_per_place = d3array.max<number>(
      data_per_cluster.map((datum: T.MapPlaceData[]) => {
        return new Set<number>(datum.map(d => map.get(d.religion_id))).size;
      })
    );

    if (maximum_religions_per_place <= max_symbols_per_glyph) allowed_level = level;
  });

  return allowed_level;
}


function data_for_cluster(cluster: Cluster<CollectedPlace>): T.MapPlaceData[] {
  const data: T.MapPlaceData[] = [];
  cluster.members.forEach(m => m.data.forEach(d => data.push(d)));

  return data;
}


function group_data_by_religion(data: T.MapPlaceData[], depth_lookup: Map<number, number>, ordering: {}) {
  const by_id = new Map<number, Array<any>>();
  data.forEach(datum => {
    const id = depth_lookup.get(datum.religion_id);
    if (by_id.has(id)) by_id.get(id).push(datum);
    else by_id.set(id, [datum]);
  });

  return Array.from(by_id.entries())
    .sort(([a,_x],[b,_y]) => ordering[a] - ordering[b])
    .map(([_,x]) => x);
}


function count_diversity_per_place(data: T.MapPlaceData[], place_map: Map<number, T.Place>) {
  const places = new Map<number, [number, number, Set<number>, number]>();

  data.forEach(datum => {
    const p = place_map.get(datum.place_id);
    if (!p.geoloc) return;

    if (places.has(datum.place_id)) {
      const px = places.get(datum.place_id);
      px[2].add(datum.religion_id);
      px[3] += 1;
    } else {
      places.set(datum.place_id, [p.geoloc.lat, p.geoloc.lng, new Set<number>([datum.religion_id]), 1]);
    }
  });

  const arr = Array.from(places.values());
  const max0 = Math.max(1, d3array.max<[number, number, Set<number>, number], number>(arr, d => d[2].size));
  const max1 = Math.max(1, d3array.max<[number, number, Set<number>, number], number>(arr, d => d[3]));
  return {
    diversity: arr.map(d => [d[0], d[1], d[2].size / max0]),
    distribution: arr.map(d => [d[0], d[1], d[3]/max1])
  };
}


const hexagon_positions: [number, number][] = [
  [ 0, 0 ],

  [ -1, 0 ],
  [ 1, 0 ],
  [ -1, 1 ],
  [ 0, 1 ],
  [ 0, -1 ],
  [ 1, -1 ],

  [ -2, 0 ],
  [ 2, 0 ],
  [ -2, 1 ],
  [ 1, 1 ],
  [ -1, -1 ],
  [ 2, -1 ],
  [ -2, 2 ],
  [ -1, 2 ],
  [ 0, 2 ],
  [ 0, -2 ],
  [ 1, -2 ],
  [ 2, -2 ],

  [ -3, 0 ],
  [ 3, 0 ],
  [ -3, 1 ],
  [ 2, 1 ],
  [ -2, -1 ],
  [ 3, -1 ],
  [ -3, 2 ],
  [ 1, 2 ],
  [ -1, -2 ],
  [ 3, -2 ],
  [ -3, 3 ],
  [ -2, 3 ],
  [ -1, 3 ],
  [ 0, 3 ],
  [ 0, -3 ],
  [ 1, -3 ],
  [ 2, -3 ],
  [ 3, -3 ],
];


function calculateOffsets(count: number, map_mode: T.MapMode, symbol_radius: number): {x: number, y: number}[] {
  if (count === 1) return [{x:0,y:0}];
  if (map_mode === T.MapMode.Clustered) {
    const delta = 2 * Math.PI / count;
    const r = symbol_radius / Math.sin(delta/2);
    return d3array.range(0, count, 1)
      .map(e => { return { x: Math.cos(e * delta) * r, y: Math.sin(e * delta) * r }; });
  }

  if (count < hexagon_positions.length) {
    return hexagon_positions.slice(0, count)
      .map(([a, b]) => {
        const x = (a + 0.5 * Math.sqrt(0.8) * b) * 2 * symbol_radius;
        const y = (Math.sqrt(0.8) * b) * 2 * symbol_radius;
        return { x, y };
      });
  }
  else return d3array.range(0, count, 1).map(d => { return { x: 2 * d * symbol_radius, y: 0 }; });
}


const ctx: Worker = self as any;
const w = new MapWorker(ctx, 'map');

