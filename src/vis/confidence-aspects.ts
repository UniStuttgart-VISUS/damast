import * as d3 from 'd3';
import * as T from './datatypes';

export const confidence_keys = new Map<T.ConfidenceAspect, string>();
confidence_keys.set(T.ConfidenceAspect.Time, 'time_confidence');
confidence_keys.set(T.ConfidenceAspect.Religion, 'religion_confidence');
confidence_keys.set(T.ConfidenceAspect.Location, 'location_confidence');
confidence_keys.set(T.ConfidenceAspect.PlaceAttribution, 'place_attribution_confidence');
confidence_keys.set(T.ConfidenceAspect.Source, 'source_confidences');
confidence_keys.set(T.ConfidenceAspect.Interpretation, 'interpretation_confidence');

export const confidence_aspects = new Map<string, T.ConfidenceAspect>();
confidence_keys.forEach((v, k) => confidence_aspects.set(v, k));
