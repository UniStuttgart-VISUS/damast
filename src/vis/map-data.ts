import * as T from './datatypes';
import {rollup,groups} from 'd3-array';

// one religion circle: SVGGElement innerHTML
export type ReligionCircle = string;

export interface MapGlyph {
  circles: ReligionCircle[];
  center: T.Point;

  // for small markers
  geolocs: T.Coordinate[];

  // for mouse-over area
  radius: number;

  place_ids: Set<number>;
  religion_ids: Set<number>;
  tuple_ids: Set<number>;
  source_ids: Set<number>;

  tooltip: string;
};


export interface ArcData {
  count: number;
  fill: string;
  active: boolean;
};


export function create_arc_data_religion(member_data: T.MapPlaceData[],
  color_scale: {},
  ordering: {}
): ArcData[] {
  const data_grouped = groups<T.MapPlaceData, number, boolean>(member_data,
    d => d.religion_id,
    d => d.active
  );
  data_grouped.forEach(d => d.sort((a,b) => +a[0] - +b[0]));
  data_grouped.sort((a,b) => ordering[a[0]] - ordering[b[0]]);

  const data: ArcData[] = [];

  data_grouped.forEach(([religion_id, values]) => {
    values.forEach(([active, values]) => {
      data.push({
        active,
        count: values.length,
        fill: color_scale[religion_id],
      });
    });
  });

  return data.filter(d => d.count);
}

export function create_arc_data_confidence(member_data: Array<T.MapPlaceData>,
  color_scale: {},
  confidence_aspect_key: string
): Array<ArcData> {
  // either one or two arcs
  const active = member_data.filter(d => d.active);
  const inactive = member_data.filter(d => !d.active);

  // get confidence levels for active and inactive
  const aspect_key = confidence_aspect_key;
  const active_confidence = aspect_key === 'source_confidences'
    ? active.map(d => d.source_confidences).reduce((a,b) => a.concat(b), [])
    : active.map(d => d[aspect_key]);
  const inactive_confidence = aspect_key === 'source_confidences'
    ? inactive.map(d => d.source_confidences).reduce((a,b) => a.concat(b), [])
    : inactive.map(d => d[aspect_key]);

  const active_total = Array.from(rollup(active_confidence, v => v.length, d => d))
    .map(([key, value]) => {
      const confidence = key === 'null' ? null : <T.Confidence>key;
      return {
        active: true,
        count: value,
        confidence,
        fill: color_scale[confidence]
      };
    });
  const inactive_total = Array.from(rollup(inactive_confidence, v => v.length, d => d))
    .map(([key, value]) => {
      const confidence = key === 'null' ? null : <T.Confidence>key;
      return {
        active: false,
        count: value,
        confidence,
        fill: color_scale[confidence]
      };
    });

  const total = active_total.concat(inactive_total)
  .sort((a, b) => {
    const idx_a = T.confidence_values.indexOf(a.confidence);
    const idx_b = T.confidence_values.indexOf(b.confidence);

    if (idx_a !== idx_b) return idx_a - idx_b;
    return +a.active - +b.active;
  })
  .filter(d => d.count);
  return total;
}
