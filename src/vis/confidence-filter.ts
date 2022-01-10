import * as R from 'ramda';
import * as T from './datatypes';

export const rows = [
  {
    title: 'certain',
    value: 'certain',
  },
  {
    title: 'probable',
    value: 'probable',
  },
  {
    title: 'contested',
    value: 'contested',
  },
  {
    title: 'uncertain',
    value: 'uncertain',
  },
  {
    title: 'false',
    value: 'false',
  },
  {
    title: 'no value',
    value: null,
    dummy: true
  }
];

export const columns = [
  {
    title: 'Time',
    value: 'time_confidence'
  },
  {
    title: 'Location',
    value: 'location_confidence'
  },
  {
    title: 'Place attribution',
    value: 'place_attribution_confidence'
  },
  {
    title: 'Source instance',
    value: 'source_confidences'
  },
  {
    title: 'Interpretation',
    value: 'interpretation_confidence'
  },
  {
    title: 'Religion',
    value: 'religion_confidence',
  }
];

export interface ConfidenceAspects {
  religion_confidence : T.ConfidenceRange;
  location_confidence : T.ConfidenceRange;
  place_attribution_confidence: T.ConfidenceRange;
  time_confidence: T.ConfidenceRange;
  source_confidences: T.ConfidenceRange;
  interpretation_confidence: T.ConfidenceRange;
};

function contained(v: T.Confidence | T.Confidence[], r: T.ConfidenceRange): boolean {
  if (Array.isArray(v)) {
    return (r === null) || R.any(d => r.includes(d), v);
  } else {
    return (r === null) || r.includes(v);
  }
}

export function tupleActive(c: T.Confidences, uh: ConfidenceAspects): boolean {
  return contained(c.time_confidence, uh.time_confidence)
    && contained(c.religion_confidence, uh.religion_confidence)
    && contained(c.location_confidence, uh.location_confidence)
    && contained(c.place_attribution_confidence, uh.place_attribution_confidence)
    && contained(c.source_confidences, uh.source_confidences)
    && contained(c.interpretation_confidence, uh.interpretation_confidence);
}

export const confidence_keys = new Map<T.ConfidenceAspect, T.ConfidenceType>();
confidence_keys.set(T.ConfidenceAspect.Time, 'time_confidence');
confidence_keys.set(T.ConfidenceAspect.Religion, 'religion_confidence');
confidence_keys.set(T.ConfidenceAspect.Location, 'location_confidence');
confidence_keys.set(T.ConfidenceAspect.PlaceAttribution, 'place_attribution_confidence');
confidence_keys.set(T.ConfidenceAspect.Source, 'source_confidences');
confidence_keys.set(T.ConfidenceAspect.Interpretation, 'interpretation_confidence');

export const confidence_aspects = new Map<string, T.ConfidenceAspect>();
confidence_keys.forEach((v, k) => confidence_aspects.set(v, k));


export function createConfidenceData(
  tuples: T.Confidences[],
  confidence_filter: ConfidenceAspects,
  confidence_aspect: T.ConfidenceAspect,
  colors: {}
) {
  // create rows
  const _rows = rows.map(d => {
    return {
      title: d.title,
      value: d.value,
      dummy: d.dummy,
      color: colors[d.value],
    };
  });

  // create columns
  const _cols = columns.map(d => {
    return {
      title: d.title,
      value: d.value,
      default_: d.value === confidence_keys.get(confidence_aspect),
    };
  });

  // create cells
  const grid = {};
  _cols.forEach(col => {
    const coldata = {};
    _rows.forEach(row => {
      const checked = confidence_filter[col.value].includes(row.value);
      const count: number = tuples.filter(d => contained(d[col.value], [row.value])).length;

      coldata[row.value] = {checked, count};
    });

    grid[col.value] = coldata;
  });

  return {
    rows: _rows,
    cols: _cols,
    grid
  };
}
