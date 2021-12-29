import * as d3 from 'd3';
import * as R from 'ramda';
import * as T from './datatypes';

export class UncertaintyHierarchy {
  // religion
  private _religion_confidence : T.ConfidenceRange = null;
  // place
  private _location_confidence : T.ConfidenceRange = null;
  private _place_attribution_confidence : T.ConfidenceRange = null;
  // time
  private _time_confidence : T.ConfidenceRange = null;
  // information
  private _source_confidences : T.ConfidenceRange = null;
  private _interpretation_confidence : T.ConfidenceRange = null;


  get religion_confidence(): T.ConfidenceRange {
    return this._religion_confidence;
  }
  set religion_confidence(v: T.ConfidenceRange) {
    this._religion_confidence = v;
  }

  get location_confidence(): T.ConfidenceRange {
    return this._location_confidence;
  }
  set location_confidence(v: T.ConfidenceRange) {
    this._location_confidence = v;
  }

  get place_attribution_confidence(): T.ConfidenceRange {
    return this._place_attribution_confidence;
  }
  set place_attribution_confidence(v: T.ConfidenceRange) {
    this._place_attribution_confidence = v;
  }


  get time_confidence(): T.ConfidenceRange {
    return this._time_confidence;
  }
  set time_confidence(v: T.ConfidenceRange) {
    this._time_confidence = v;
  }

  get source_confidences(): T.ConfidenceRange {
    return this._source_confidences;
  }
  set source_confidences(v: T.ConfidenceRange) {
    this._source_confidences = v;
  }

  get interpretation_confidence(): T.ConfidenceRange {
    return this._interpretation_confidence;
  }
  set interpretation_confidence(v: T.ConfidenceRange) {
    this._interpretation_confidence = v;
  }

  private contained(v: T.Confidence | T.Confidence[], r: T.ConfidenceRange): boolean {
    if (Array.isArray(v)) {
      return (r === null) || R.any(d => r.includes(d), v);
    } else {
      return (r === null) || r.includes(v);
    }
  }

  active(c: T.Confidences): boolean {
    return this.contained(c.time_confidence, this._time_confidence)
      && this.contained(c.religion_confidence, this._religion_confidence)
      && this.contained(c.location_confidence, this._location_confidence)
      && this.contained(c.place_attribution_confidence, this._place_attribution_confidence)
      && this.contained(c.source_confidences, this._source_confidences)
      && this.contained(c.interpretation_confidence, this._interpretation_confidence);
  }
}

export const confidence_keys = new Map<T.ConfidenceAspect, string>();
confidence_keys.set(T.ConfidenceAspect.Time, 'time_confidence');
confidence_keys.set(T.ConfidenceAspect.Religion, 'religion_confidence');
confidence_keys.set(T.ConfidenceAspect.Location, 'location_confidence');
confidence_keys.set(T.ConfidenceAspect.PlaceAttribution, 'place_attribution_confidence');
confidence_keys.set(T.ConfidenceAspect.Source, 'source_confidences');
confidence_keys.set(T.ConfidenceAspect.Interpretation, 'interpretation_confidence');

export const confidence_aspects = new Map<string, T.ConfidenceAspect>();
confidence_keys.forEach((v, k) => confidence_aspects.set(v, k));
