import * as d3array from 'd3-array';
import * as d3shape from 'd3-shape';
import * as T from './datatypes';
import {confidence_keys} from './uncertainty-hierarchy'

interface YearRange {
  start: number;
  end: number;
};

export type TimeFilter = [number, number] | null;
export function tupleIsActive(tuple: {time_span: YearRange}, filter: TimeFilter) {
  if (filter === null) return true;
  if (tuple.time_span === null) return false;

  return tuple.time_span.start <= filter[0] && tuple.time_span.end >= filter[1]
    || tuple.time_span.start >= filter[0] && tuple.time_span.start <= filter[1]
    || tuple.time_span.end >= filter[0] && tuple.time_span.end <= filter[1]
    || tuple.time_span.start <= filter[1] && tuple.time_span.end === null
    || tuple.time_span.end >= filter[0] && tuple.time_span.start === null;
}

interface Geolocation {
  lat: number;
  lng: number;
};

interface SourceTuple_ {
  id: number;
  geoloc: Geolocation | null;
  place_id: number;
  religion_id: number;
  source_id: number;
  source_ids: number[];
  year_range: YearRange;
};
export type SourceTuple = SourceTuple_ & T.Confidences;

export interface PathInfoStack {
  span_x: [number, number];
  span_y: [number, number];
  xs: number[];
  ys: {id: number, active: boolean}[];   // XXX religion_id is negative for inactive
  paths: d3shape.Series<number, number>[];
  overview: number[];
  span_y_overview: [number, number];
};

export type SourceTupleRangePredicate = (_: SourceTuple) => YearRange | null;
export type GeolocationPredicate = (_: Geolocation) => boolean;
export type ReligionPredicate = (_: number) => boolean;
export type Predicate = (_: SourceTuple) => boolean;

export function untimed_from_tuples(tuples: T.LocationData[],
  only_active: boolean,
  confidence_aspect: T.ConfidenceAspect,
  display_mode: T.DisplayMode,
  main_religions: {},
  religion_order: {},
  colors: {},
): Array<any> {
  // group by main religions
  const per_main_religion = new Map<number, Map<number, any>>();
  const aspect_key = confidence_keys.get(confidence_aspect);
  const id = display_mode === T.DisplayMode.Religion
    ? d => d.religion_id
    : d => d[aspect_key];

  tuples.forEach(tuple => {
    if (!tuple.active && only_active) return;

    const id_: number | number[] = id(tuple);
    const main = main_religions[tuple.religion_id];

    if (!per_main_religion.has(main)) {
      per_main_religion.set(main, new Map<number, any>());
    }
    const branch = per_main_religion.get(main);

    const add = (id__: number, branch, active, d) => {
      if (!branch.has(id__)) {
        branch.set(id__, {
          active: {
            count: 0,
            location_ids: new Set<number>(),
            religion_ids: new Set<number>(),
            source_ids: new Set<number>(),
            tuple_ids: new Set<number>(),
          },
          inactive: {
            count: 0,
            location_ids: new Set<number>(),
            religion_ids: new Set<number>(),
            source_ids: new Set<number>(),
            tuple_ids: new Set<number>(),
          }
        });
      }

      const obj = branch.get(id__)[active? 'active' : 'inactive'];
      obj.count++;
      obj.location_ids.add(d.place_id);
      obj.religion_ids.add(d.religion_id);
      obj.tuple_ids.add(d.tuple_id);
      d.source_ids?.forEach(id => obj.source_ids.add(id));
    };

    if (display_mode === T.DisplayMode.Religion
      || aspect_key !== 'source_confidences') {
      add(<number>id_, branch, tuple.active, tuple);
    } else {
      // source confidence is an array
      (<(number | null)[]><unknown>id_)?.forEach(id__ => add(id__, branch, tuple.active, tuple));
    }
  });

  // obj arr
  const out_tuples = [];
  per_main_religion.forEach((per_id, main_religion_id) => {
    const for_main = [];
    per_id.forEach((pair, id) => {
      for_main.push({ id,
        active: true,
        count: pair.active.count,
        location_ids: pair.active.location_ids,
        religion_ids: pair.active.religion_ids,
        source_ids: pair.active.source_ids,
        tuple_ids: pair.active.tuple_ids,
        parent_religion: main_religion_id,
        color: colors[id],
      });
      for_main.push({ id,
        active: false,
        count: pair.inactive.count,
        location_ids: pair.inactive.location_ids,
        religion_ids: pair.inactive.religion_ids,
        source_ids: pair.inactive.source_ids,
        tuple_ids: pair.inactive.tuple_ids,
        parent_religion: main_religion_id,
        color: colors[id],
      });
    });

    // sort for_main
    if (display_mode === T.DisplayMode.Religion) {
      for_main.sort((a, b) => {
        const ord_a = religion_order[a.id];
        const ord_b = religion_order[b.id];

        return ord_a - ord_b || a.active - b.active;
      });
    } else {
      for_main.sort((a, b) => {
        return a.id - b.id || a.active - b.active;
      });
    }

    let offset = 0;
    for_main.forEach(d => {
      d.offset = offset;
      offset += d.count;
      out_tuples.push(d);
    });
  });

  return out_tuples;
}


export function timed_from_tuples(tuples: T.LocationData[],
  only_active: boolean,
  confidence_aspect: T.ConfidenceAspect,
  display_mode: T.DisplayMode,
  timeline_mode: T.TimelineMode,
  main_religions: {},
  religion_order: {},
  colors: {},
  total_year_range: YearRange,
): any {
  const raw_data = tuples.filter(d => d.time_span !== null);
  raw_data.sort((a, b) => a.time_span.start - b.time_span.start);

  const data = count_by_year(raw_data, only_active, confidence_aspect, display_mode, total_year_range, religion_order);
  const key_data = [];
  const ys = [];

  if (display_mode === T.DisplayMode.Religion) {
    Array.from(Object.keys(religion_order)).forEach((k) => {
      ys.push({id:k, active:true, color: colors[k]});
      ys.push({id:k, active:false, color: colors[k]});
    });

    ys.sort((a, b) => {
      const ord_a = religion_order[parseInt(a.id)];
      const ord_b = religion_order[parseInt(b.id)];

      return ord_a - ord_b || (+b.active - +a.active);  // active first, then inactive
    });

    // populate key_data from sorted ys
    ys.forEach(({id, active}) => key_data.push(`${id}${active?'a':'i'}`));
  } else {
    [ 'certain', 'probable', 'contested', 'uncertain', 'false', null ].forEach(d => {
      key_data.push(d + 'a');
      key_data.push(d + 'i');
      const color = colors[d];

      ys.push({id:d, active:true, color});
      ys.push({id:d, active:false, color});
    });
  }

  const s = d3shape.stack<any, number, string>()
    .keys(key_data)
    .order(d3shape.stackOrderNone)
    .offset(d3shape.stackOffsetNone);
  const stack = s(data);
  const overview: number[] = stack[stack.length - 1].map(([_,d]) => d);

  // code to make qualitative. maybe, if this gets too slow, it would be worth
  // externalizing this functionality, but for now, it is fast enough
  let maximum = d3array.max(overview);
  if (timeline_mode === T.TimelineMode.Qualitative) {
    const keys = ((display_mode === T.DisplayMode.Religion)
      ? Array.from(Object.keys(religion_order))
          .sort((a,b) => religion_order[parseInt(a)] - religion_order[parseInt(b)])
      : T.confidence_values.map(d => d))  // make copy
      .reverse();  // top-down

    let i = 1;
    keys.forEach(k => {
      const sa = stack.find(d => d.key === `${k}a`);
      const sb = stack.find(d => d.key === `${k}i`);
      let has_data = false;

      sa.forEach(x => {
        if (x[0] === x[1]) x[0] = x[1] = i;
        else {
          x[0] = i;
          x[1] = i+1;
          has_data = true;
        }
      });
      sb.forEach(x => {
        if (x[0] === x[1]) x[0] = x[1] = i;
        else {
          x[0] = i-1;
          x[1] = i;
          has_data = true;
        }
      });

      if (has_data) i += 3;
    });

    maximum = i - 1;
  }
  const span_x: [number, number] = [total_year_range.start, total_year_range.end];
  const span_y: [number, number] = [0, maximum];
  const xs = d3array.range(total_year_range.start, total_year_range.end + 1, 1);

  return {
    span_x, span_y, xs, ys,
    paths: stack,
    overview,
    span_y_overview: [0, d3array.max(overview)],
  };
}


function count_by_year(arr: T.LocationData[],
  only_active: boolean,
  confidence_aspect: T.ConfidenceAspect,
  display_mode: T.DisplayMode,
  total_range: YearRange,
  religion_order: {}
): Array<any> {
  let idx = 0;
  let active = [];

  const index: Array<Array<number>> = [];

  const aspect_key = confidence_keys.get(confidence_aspect);
  const conf = d => d[aspect_key];

  for (let year = total_range.start;
    year <= total_range.end;
    ++year) {
    // drop where end < year
    active = active.filter(x => x.time_span.end >= year);

    // push where start <= year
    while (idx < arr.length && arr[idx].time_span.start <= year) {
      active.push(arr[idx++]);
    }

    // do actual counting
    const year_counts: any = {};

    if (display_mode === T.DisplayMode.Religion) {
      Array.from(Object.keys(religion_order)).forEach(id => {
        year_counts[id+'a'] = 0;
        year_counts[id+'i'] = 0;
      });

      active.forEach(d => {
        const key = d.religion_id + (d.active?'a':'i');
        year_counts[key] = year_counts[key] + 1;
      });
    } else {
      [ 'certain', 'probable', 'contested', 'uncertain', 'false', null ].forEach(id => {
        year_counts[id + 'a'] = 0;
        year_counts[id + 'i'] = 0;
      });

      active.forEach(d => {
        if (d.active) {
          if (aspect_key === 'source_confidences') {
            conf(d).forEach(c => {
              const key = c + 'a';
              year_counts[key] = year_counts[key] + 1;
            });
          } else {
            const key = conf(d) + 'a';
            year_counts[key] = year_counts[key] + 1;
          }
        } else {
          if (aspect_key === 'source_confidences') {
            conf(d).forEach(c => {
              const key = c + 'i';
              year_counts[key] = year_counts[key] + 1;
            });
          } else {
            const key = conf(d) + 'i';
            year_counts[key] = year_counts[key] + 1;
          }
        }
      });
    }

    index.push(year_counts);
  }

  return index;
}

