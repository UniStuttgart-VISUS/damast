export interface Religion {
  id: number;
  name: string;
  hierarchy: Array<string>;
};

export interface TransferableColorscheme {
  [key: number]: string;
  [key: string]: string;
};

export interface TemporalReligionAggregation {
  year: number;
  religionCount: Map<number, number>;
};

export interface OwnHierarchyNode {
  name: string;
  abbreviation: string;
  level: number;
  children: Array<OwnHierarchyNode>;
  id: number;
  data_count: number;
  parent_id: number;
  color: string;
};

export interface Coordinate {
  lat: number;
  lng: number;
};

export interface TimeSpan {
  start: number | null;
  end: number | null;
};


export interface Place {
  id: number;
  location_confidence: null;
  name: string;
  geoloc: Coordinate | null;
};

// REST call to /rest/evicence-list returns array of these
interface RawEvidenceListTuple_ {
  tuple_id: number;
  religion_id: number;
  place_id: number;
  source_ids: number[];
  time_span: TimeSpan;
};
export type RawEvidenceListTuple = RawEvidenceListTuple_ & Confidences;

interface LocationData_ {
  tuple_id: number;
  place_id: number;
  religion_id: number;
  source_ids: number[];
  time_span: TimeSpan;
  active: boolean;
};
export type LocationData = LocationData_ & Confidences;

interface MapPlaceData_ {
  tuple_id: number;
  place_id: number;
  religion_id: number;
  source_ids: number[];
  active: boolean;
  geoloc: Coordinate;
  time_span: TimeSpan;
};
export type MapPlaceData = MapPlaceData_ & Confidences;

export const confidence_values = [ 'certain', 'probable', 'contested', 'uncertain', 'false', null ];
export type Confidence = 'certain' | 'probable' | 'contested' | 'uncertain' | 'false' | null;

export type ConfidenceType = 'time_confidence'
  | 'location_confidence'
  | 'place_attribution_confidence'
  | 'source_confidences'
  | 'interpretation_confidence'
  | 'religion_confidence';

type ConfidenceList = Confidence[];

export type ConfidenceSelection = {
  [key in ConfidenceType]: ConfidenceList;
};

export type ConfidenceRange = Confidence[] | null;
export interface Confidences {
  time_confidence: Confidence;
  location_confidence: Confidence;
  place_attribution_confidence: Confidence;
  source_confidences: Confidence[];
  interpretation_confidence: Confidence;
  religion_confidence: Confidence;
};

export enum DisplayMode {
  Religion,
  Confidence
};

export enum TimelineMode {
  Quantitative,
  Qualitative
};

export enum MapMode {
  Clustered,
  Cluttered,
};

export interface Point {
  x: number;
  y: number;
};

export enum ConfidenceAspect {
  Time,
  Religion,
  Location,
  PlaceAttribution,
  Source,
  Interpretation
};

export interface Source {
  id: number;
  short: string;
  name: string;
};

export interface Tag {
  id: number;
  name: string;
  comment: string | null;
  evicence_ids: Set<number>;
}

export type TagData = Tag & {
  active_count: number;
  inactive_count: number;
};

export interface MapState {
  zoom: number;
  center: Coordinate;
  base_layer: 'light' | 'dare';
  overlay_layers: ('markerLayer' | 'diversityMarkerLayer' | 'diversityDensityLayer' | 'evidenceCountHeatLayer')[];
};

export interface User {
  user: string | null;
  readdb: boolean;
  writedb: boolean;
  geodb: boolean;
  visitor: boolean;
};
