import * as d3hier from 'd3-hierarchy';
import * as d3scale from 'd3-scale';
import * as d3fetch from 'd3-fetch';
import * as d3array from 'd3-array';
import * as R from 'ramda';
import { Validator } from '@cfworker/json-schema';
import { MultiPolygon, multiPoint, point as turfPoint, Feature, Point, Polygon } from '@turf/helpers';
import pointsWithinPolygon from '@turf/points-within-polygon';

import * as T from './datatypes';
import * as tld from './timeline-data';
import * as brush from './brush';
import {ConfidenceAspects,confidence_keys,confidence_aspects,tupleActive} from './confidence-filter';
import default_selection from './default-confidence-filter-selection';
import * as color from './colorscale';
import * as ReligionFilter from './religion-filter';
import * as ViewModeDefaults from './view-mode-defaults';
import * as SourceFilter from './source-data';
import * as TagFilter from './tag-filter';
import * as DefaultMapState from './default-map-zoomlevel';
import { LocationFilter, LocationMatcher, createLocationMatcher, PlaceFilter, tupleIsActive as placeTupleIsActive } from './location-filter';
import HistoryTree from './history-tree';


export async function getDataset(): Promise<Dataset> {
  const d = new Dataset();
  await d.loadData();
  return d;
}

function random_choice<T>(choices: Array<T>): T {
  const idx = Math.floor(choices.length * Math.random());
  return choices[idx === choices.length ? 0 : idx];
}

export enum ChangeScope {
  Time,
  Location,
  PlaceSet,
  Religion,
  Source,
  Certainty,
  Tags,
  ShowOnlyActive,
  DisplayMode,
  TimelineMode,
  MapMode,
  SourceViewSortMode,
  AggregatorFunction,
  DisplayedConfidenceAspect,
  Data_AdvancedReligionFilter
};

export type ChangeListener = (scope: Set<ChangeScope>) => Promise<void>;

interface ExportableFilters {
  religion: ReligionFilter.ReligionFilter;
  time: tld.TimeFilter;
  sources: SourceFilter.ExportableSourceFilter;
  confidence: ConfidenceAspects;
  tags: TagFilter.ExportableTagFilter;
  location: LocationFilter;
  places: PlaceFilter;
};

interface Metadata {
  createdBy: string | null;
  createdAt: string;
  source: 'filesystem' | 'visualization';
  evidenceCount: number;
  version: string;
};

interface _VisualizationState {
  ["show-filtered"]: boolean;
  ["display-mode"]: "religion" | "confidence";
  ["timeline-mode"]: "qualitative" | "quantitative";
  ["map-mode"]: "clustered" | "cluttered";
  ["source-sort-mode"]: "count" | "name";
  ["confidence-aspect"]: T.ConfidenceType;
  ["map-state"]: T.MapState;
};

export interface FilterJson {
  filters: ExportableFilters;
  metadata: Metadata;
};

export type VisualizationState = Partial<_VisualizationState> & FilterJson;
export type CompleteVisualizationState = _VisualizationState & FilterJson;
export type RawVisualizationState = _VisualizationState & Pick<FilterJson, 'filters'>;

export class Dataset {
  private _hierarchy: d3hier.HierarchyNode<T.OwnHierarchyNode>;
  private _hierarchy_depth: number = 0;
  private _religion_parent_by_level: Array<Map<number, number>>;

  private _place_data: Array<T.LocationData> = [];
  private _religions: Map<number, string> = new Map<number, string>();
  private _sources: Map<number, T.Source> = new Map<number, T.Source>();
  private _religion_ordering: Map<number, number> = new Map<number, number>();
  private _locations: Array<T.Place> = [];
  private _placeMap: Map<number, T.Place> = new Map<number, T.Place>();

  private _religion_filter: ReligionFilter.ReligionFilter = true;
  private _time_filter: tld.TimeFilter = null;;
  private _source_filter: SourceFilter.SourceFilter = null;
  private _confidence_filter: ConfidenceAspects = default_selection;
  private _tag_filter: TagFilter.TagFilter = true;
  private _map_filter: LocationFilter = null;
  private _map_filter_matcher: LocationMatcher = {
    tupleIsActive: () => true,
  };
  private _place_filter: PlaceFilter = null;

  private _minYear: number;
  private _maxYear: number;
  private _maxCountPerYear: number = 0;

  private _changeListeners: Array<ChangeListener> = [];

  private _location_ids_for_religion_id: Map<number, Set<number>>;
  private _religion_ids_for_location_id: Map<number, Set<number>>;
  private _source_ids_for_religion_id: Map<number, Set<number>>;
  private _source_ids_for_location_id: Map<number, Set<number>>;
  private _location_ids_for_source_id: Map<number, Set<number>>;
  private _religion_ids_for_source_id: Map<number, Set<number>>;
  private _tag_ids_for_tuple_id: Map<number, number[]>;

  private _source_ids_for_tag_id: Map<number, Set<number>>;
  private _location_ids_for_tag_id: Map<number, Set<number>>;
  private _religion_ids_for_tag_id: Map<number, Set<number>>;

  private _tuple_ids_for_source_id: Map<number, Set<number>>;
  private _tuple_ids_for_location_id: Map<number, Set<number>>;
  private _tuple_ids_for_religion_id: Map<number, Set<number>>;
  private _tuple_ids_for_tag_id: Map<number, Set<number>>;

  private _ultimate_parent: Map<number, number>;          // Top-level religion for each religion

  private _symbol_lookup: Map<number, string>;

  private _brush: brush.Brush;

  private _displayed_confidence_aspect: T.ConfidenceAspect = T.ConfidenceAspect.Religion;

  private _religion_colorscale: d3scale.ScaleOrdinal<number, string>;
  private _confidence_colorscale: d3scale.ScaleOrdinal<T.Confidence, string>;

  // event stuff
  private _queued_events: Set<ChangeScope> = new Set<ChangeScope>();
  private _is_paused: boolean = false;

  private _brush_only_active: boolean = ViewModeDefaults.show_only_active;
  private _display_mode: T.DisplayMode = ViewModeDefaults.display_mode;
  private _timeline_mode: T.TimelineMode = ViewModeDefaults.timeline_mode;
  private _map_mode: T.MapMode = ViewModeDefaults.map_mode;
  private _source_sort_mode: T.SourceViewSortMode = ViewModeDefaults.source_sort_mode;

  private _existing_religions: Set<number> = new Set<number>();

  private _tags: T.Tag[];
  private _visualization_state_validator: Validator;

  private _map_state: T.MapState = {
    zoom: DefaultMapState.zoom_level,
    center: {
      lat: DefaultMapState.center[0],
      lng: DefaultMapState.center[1],
    },
    base_layer: 'light',
    overlay_layers: [ 'markerLayer' ],
  };
  private _user: T.User = { user: null, readdb: false, writedb: false, geodb: false, visitor: true }
  private _server_version: string;

  readonly historyTree: HistoryTree<RawVisualizationState>;

  constructor() {
    this._symbol_lookup = new Map<number, string>();
    this._symbol_lookup.set(15, '#star');
    this._symbol_lookup.set(8, '#moon');
    this._symbol_lookup.set(1, '#cross');
    this._symbol_lookup.set(19, '#zoroastrian');
    this._symbol_lookup.set(24, '#buddhist');
    this._symbol_lookup.set(25, '#manichaeism');
    this._symbol_lookup.set(97, '#others');

    this._brush = new brush.Brush(this);
    this.historyTree = new HistoryTree<RawVisualizationState>(this.getRawVisualizationState());
  }

  async loadData(): Promise<void> {
    const [_, __, places, ___, ____] = await Promise.all([
      this.loadHierarchyData(),
      this.loadSourcesData(),
      this.loadPlacesData(),
      this.loadTagsData(),
      this.loadSchemaData(),
      this.loadUserData(),
    ]);
    const data = await this.loadReligionData(places);

    await this.parseData(data);
    this.updatePlacesActive();
    this.updateBrushingLinkingLookupTables();
    await this.purgeUnusedLocations();
  }

  get is_advanced_filter_active(): boolean {
    return (this._religion_filter !== true && !ReligionFilter.isSimpleReligionFilter(this._religion_filter));
  }

  private async loadSchemaData() {
    const schema = await d3fetch.json<any>('schemas/visualization-state.json');

    this._visualization_state_validator = new Validator(schema, '7', false);

    await Promise.all(['confidence', 'confidence-range', 'visualization-filter', 'metadata', 'location-filter'].map(async key => {
      const schema = await d3fetch.json<any>(`schemas/${key}.json`);
      this._visualization_state_validator.addSchema(schema);
    }));
  }

  private async loadTagsData() {
    const [tags,tag_sets] = await Promise.all([
      d3fetch.json<any[]>('../rest/tag-list'),
      d3fetch.json<any[]>('../rest/tag-sets'),
    ]);

    this._tags = tags.map(tag => {
      const evicence_ids = new Set<number>(tag_sets.filter(d => d.tag_id === tag.id)[0].evidence_ids);

      return {
        id: tag.id,
        name: tag.tagname,
        comment: tag.comment,
        evicence_ids,
      };
    });
  }

  private loadPlacesData(): Promise<any> {
    const is_coord = /\d+(\.\d+)?,\s*\d+(\.\d+)?/;
    const ref = this;
    const url = '../rest/place-list';

    return d3fetch.json(url)
      .catch(console.error)
      .then(function(data: Array<any>) {
        return data;
      })
      .then(function(data: Array<any>) {
        ref._locations = data;
        data.forEach(d => ref._placeMap.set(d.id, d));
        return data;
      });
  }

  private loadReligionData(placesData: any): Promise<any> {
    let relMap = this._religions;
    const url = '../rest/evidence-list';

    return d3fetch.json(url)
      .catch(err => console.error('Error loading evidence list: ', err))
      .then(function(data: Array<T.RawEvidenceListTuple>) {
        return data.map(function(datum: T.RawEvidenceListTuple) {
          // find place for tuple
          const places = placesData.filter(d => d.id == datum.place_id);
          if (places.length === 0) {
            console.error(`No place with place_id ${datum.place_id} in data (evidence tuple ${datum.tuple_id}).`);
            return;
          }
          const place = places[0];

          // "repair" time range (TODO: don't do this)
          const time_start = datum.time_span.start;
          const time_end = datum.time_span.end;
          const time_span = (time_end === null || time_start === null)
            ? null
            : { start: time_start, end: time_end };

          const time_confidence = datum.time_confidence || null;
          const source_confidences = datum.source_confidences || [null];
          const interpretation_confidence = datum.interpretation_confidence || null;
          const location_confidence = datum.location_confidence || null;
          const place_attribution_confidence = datum.place_attribution_confidence || null;
          const religion_confidence = datum.religion_confidence || null;

          // create return value
          return {
            tuple_id: datum.tuple_id,
            place_id: datum.place_id,
            religion_id: datum.religion_id,
            source_ids: datum.source_ids,
            time_span,
            active: true,

            time_confidence,
            source_confidences,
            interpretation_confidence,
            location_confidence,
            place_attribution_confidence,
            religion_confidence
          };
        }, this);
    })
    .then(function(data) {
      return data;
    });
  }

  private async loadUserData() {
    const req = await fetch('../whoami');
    this._server_version = req.headers.get('X-Software-Version') || 'unknown';
    this._user = await req.json();
  }

  private loadSourcesData(): Promise<void> {
    const ref = this;
    return d3fetch.json('../rest/sources-list')
      .catch(err => console.error('Error loading source data: ', err))
      .then(function(data: T.Source[]) {
        data.forEach(d => ref._sources.set(d.id, d));
      });
  }

  transferableColorscheme(): T.TransferableColorscheme {
    if (this.display_mode === T.DisplayMode.Religion) {
      const colorscheme = {};
      this._religion_colorscale.domain().forEach(k => colorscheme[k] = this._religion_colorscale(k));
      return colorscheme;
    } else {
      return this.transferableConfidenceColorscheme();
    }
  }

  transferableConfidenceColorscheme(): T.TransferableColorscheme {
    const colorscheme = {};
    this._confidence_colorscale.domain().forEach(k => colorscheme[`${k}`] = this._confidence_colorscale(k));

    return colorscheme;
  }

  /* CHANGE EVENTS */

  private notifyListeners(scopeSet: Set<ChangeScope>): void {
    Promise.all(this._changeListeners.map(d => d(scopeSet)));
  }

  onDatasetChange(callback: ChangeListener): void {
    this._changeListeners.push(callback);
  }

  suspendEvents() {
    this._is_paused = true;
  }

  resumeEvents(resumeSource: 'resume' | 'load-state' | 'set-state' = 'resume') {
    this._is_paused = false;

    const cs = this._queued_events;
    this._queued_events = new Set<ChangeScope>();

    if (cs.size) {
      this.updatePlacesActive();
      this.updateBrushingLinkingLookupTables();
    }

    if (this._queuedStateChangeDescriptions.length) {
      const newState = this.getRawVisualizationState();
      const description = this._queuedStateChangeDescriptions.join('; ');
      this._queuedStateChangeDescriptions = [];
      if (resumeSource === 'resume') {
        this.historyTree.pushState(newState, description);
      } else if (resumeSource === 'load-state') {
        this.historyTree.pushStateToRoot(newState, 'loaded state');
      }
    }

    if (cs.size) {
      this.notifyListeners(cs);
    }
  }

  private _queuedStateChangeDescriptions: string[] = [];
  private enqueueStateChange(
    changeDescription: string,
    changeScope: ChangeScope,
  ): void {
    if (this._is_paused) {
      this._queuedStateChangeDescriptions.push(changeDescription);
      this._queued_events.add(changeScope);
    } else {
      this.updatePlacesActive();
      this.updateBrushingLinkingLookupTables();

      const newState = this.getRawVisualizationState();
      this.historyTree.pushState(newState, changeDescription);

      this.notifyListeners(new Set([changeScope]));
    }
  }

  /* HISTORY STUFF */
  async historyBack() {
    if (!this.historyTree.canBack()) {
      console.error('cannot go back in history');
      return;
    }

    this.historyTree.back();
    await this.applyCurrentHistoryState();
  }

  async historyForward() {
    if (!this.historyTree.canForward()) {
      console.error('cannot go forward in history');
      return;
    }

    this.historyTree.forward();
    await this.applyCurrentHistoryState();
  }

  private async applyCurrentHistoryState() {
    const state: CompleteVisualizationState = {
      ...this.historyTree.getCurrentState(),
      metadata: {
        version: this._server_version,
        createdBy: this._user.user,
        createdAt: new Date().toISOString(),
        source: 'visualization',
        evidenceCount: 0,
      },
    };

    await this.setState(state);
  }


  private loadHierarchyData(): Promise<void> {
    let ref = this;
    return d3fetch.json('../rest/religions')
      .catch(console.error)
      .then(function(d: any) {
        const traverse = function(node, level) {
          node.level = level;
          node.children.forEach(child => traverse(child, level + 1));
        };
        d.forEach(e => traverse(e, 1));

        return {
          abbreviation: 'All',
          id: 0,
          name: 'All',
          children: d,
          level: 0,
          color: 'white'
        };
      })
      .then(function(h: T.OwnHierarchyNode) {
        ref._hierarchy = d3hier.hierarchy(h);

        let idx = 0;
        const traverse = function(node: T.OwnHierarchyNode) {
          ref._religion_ordering.set(node.id, idx++);
          ref._religions.set(node.id, node.name);
          node.children.forEach(traverse);
        };
        traverse(ref._hierarchy.data);

        ref.preprocessHierarchy();

        const x = color.createColorscales(h);
        ref._religion_colorscale = x.religion;
        ref._confidence_colorscale = x.confidence;

        return;
      });
  }

  private preprocessHierarchy(): void {
    const desc = this._hierarchy.descendants();

    this._hierarchy_depth = d3array.max(desc.map(d => d.depth));
    this._religion_parent_by_level = d3array.range(0, this._hierarchy_depth + 1)
      .map(depth => {
        const lookup = new Map<number, number>();

        const groups_of_level = desc.filter(d => d.depth === depth);
        desc.forEach(node => {
          const parents = groups_of_level.filter(d => d.descendants().some(e => e.data.id === node.data.id));
          const parent = (parents.length)
            ? parents[0]
            : node;
          lookup.set(node.data.id, parent.data.id);
        });

        return lookup;
      });
  }

  private createUltimateParentMap() {
    this._ultimate_parent = new Map<number, number>();
    const hierarchy = this.hierarchy();
    hierarchy.children.forEach(function(child: d3hier.HierarchyNode<T.OwnHierarchyNode>) {
      const parentId = child.data.id;
      child.each(d => this._ultimate_parent.set(d.data.id, parentId));
    }, this);
  }

  private parseData(data: Array<any>): Promise<void> {
    this._place_data = data;

    this._minYear = d3array.min(this._place_data.map(d => d.time_span?.start)) || 0;
    this._maxYear = d3array.max(this._place_data.map(d => d.time_span?.end)) || 0;

    // count data per hierarchy node
    const visit = node => node.data.data_count = 0;
    this._hierarchy.each(visit);
    const append_datum = (religion_id: number, node: d3hier.HierarchyNode<T.OwnHierarchyNode>) => {
      if (religion_id === node.data.id) {
        node.data.data_count += 1;
      }
    };
    this._place_data.forEach(datum => this._hierarchy.each(h => append_datum(datum.religion_id, h)));

    this._existing_religions = new Set<number>();
    this._place_data.forEach(d => this._existing_religions.add(d.religion_id));

    this.createUltimateParentMap();

    return Promise.resolve();
  }

  private updateBrushingLinkingLookupTables(): void {
    console.time('rebuilding brushing and linking lookup tables');

    this._location_ids_for_religion_id = new Map<number, Set<number>>();
    this._religion_ids_for_location_id = new Map<number, Set<number>>();
    this._source_ids_for_religion_id = new Map<number, Set<number>>();
    this._source_ids_for_location_id = new Map<number, Set<number>>();
    this._location_ids_for_source_id = new Map<number, Set<number>>();
    this._religion_ids_for_source_id = new Map<number, Set<number>>();
    this._source_ids_for_tag_id = new Map<number, Set<number>>();
    this._location_ids_for_tag_id = new Map<number, Set<number>>();
    this._religion_ids_for_tag_id = new Map<number, Set<number>>();
    this._tag_ids_for_tuple_id = new Map<number, number[]>();

    this._tuple_ids_for_source_id = new Map<number, Set<number>>();
    this._tuple_ids_for_location_id = new Map<number, Set<number>>();
    this._tuple_ids_for_religion_id = new Map<number, Set<number>>();
    this._tuple_ids_for_tag_id = new Map<number, Set<number>>();

    this._tags.forEach(tag => {
      tag.evicence_ids.forEach(eid => {
        if (this._tag_ids_for_tuple_id.has(eid)) this._tag_ids_for_tuple_id.get(eid).push(tag.id);
        else this._tag_ids_for_tuple_id.set(eid, [tag.id]);
      });
      this._tuple_ids_for_tag_id.set(tag.id, new Set<number>(tag.evicence_ids));
    });

    const activePlaces = this.brush_only_active
      ? this.activePlaces()
      : this.placeData();

    activePlaces.forEach((datum: T.LocationData) => {
      if (!this._location_ids_for_religion_id.has(datum.religion_id)) {
        this._location_ids_for_religion_id.set(datum.religion_id, new Set<number>([datum.place_id]));
      } else {
        this._location_ids_for_religion_id.get(datum.religion_id).add(datum.place_id);
      }

      if (!this._religion_ids_for_location_id.has(datum.place_id)) {
        this._religion_ids_for_location_id.set(datum.place_id, new Set<number>([datum.religion_id]));
      } else {
        this._religion_ids_for_location_id.get(datum.place_id).add(datum.religion_id);
      }

      if (!this._source_ids_for_religion_id.has(datum.religion_id)) {
        this._source_ids_for_religion_id.set(datum.religion_id, new Set<number>(datum.source_ids || []));
      } else {
        datum.source_ids?.forEach(sid => this._source_ids_for_religion_id.get(datum.religion_id).add(sid));
      }

      if (!this._source_ids_for_location_id.has(datum.place_id)) {
        this._source_ids_for_location_id.set(datum.place_id, new Set<number>(datum.source_ids || []));
      } else {
        datum.source_ids?.forEach(sid => this._source_ids_for_location_id.get(datum.place_id).add(sid));
      }

      if (!this._tuple_ids_for_location_id.has(datum.place_id)) {
        this._tuple_ids_for_location_id.set(datum.place_id, new Set<number>([datum.tuple_id]));
      } else {
        this._tuple_ids_for_location_id.get(datum.place_id).add(datum.tuple_id);
      }

      if (!this._tuple_ids_for_religion_id.has(datum.religion_id)) {
        this._tuple_ids_for_religion_id.set(datum.religion_id, new Set<number>([datum.tuple_id]));
      } else {
        this._tuple_ids_for_religion_id.get(datum.religion_id).add(datum.tuple_id);
      }

      const tags = this._tag_ids_for_tuple_id.get(datum.tuple_id) || [];
      tags.forEach(tag_id => {
        if (!this._religion_ids_for_tag_id.has(tag_id)) {
          this._religion_ids_for_tag_id.set(tag_id, new Set<number>([datum.religion_id]));
        } else {
          this._religion_ids_for_tag_id.get(tag_id).add(datum.religion_id);
        }

        if (!this._location_ids_for_tag_id.has(tag_id)) {
          this._location_ids_for_tag_id.set(tag_id, new Set<number>([datum.place_id]));
        } else {
          this._location_ids_for_tag_id.get(tag_id).add(datum.place_id);
        }

        if (!this._source_ids_for_tag_id.has(tag_id)) {
          this._source_ids_for_tag_id.set(tag_id, new Set<number>(datum.source_ids || []));
        } else {
          const _set = this._source_ids_for_tag_id.get(tag_id);
          datum.source_ids && datum.source_ids.forEach(sid => _set.add(sid));
        }
      });

      datum.source_ids?.forEach(source_id => {
        if (!this._religion_ids_for_source_id.has(source_id))
          this._religion_ids_for_source_id.set(source_id, new Set<number>([datum.religion_id]));
        else
          this._religion_ids_for_source_id.get(source_id).add(datum.religion_id);

        if (!this._location_ids_for_source_id.has(source_id))
          this._location_ids_for_source_id.set(source_id, new Set<number>([datum.place_id]));
        else
          this._location_ids_for_source_id.get(source_id).add(datum.place_id);

        if (!this._tuple_ids_for_source_id.has(source_id))
          this._tuple_ids_for_source_id.set(source_id, new Set<number>([datum.tuple_id]));
        else
          this._tuple_ids_for_source_id.get(source_id).add(datum.tuple_id);
      });
    });

    console.timeEnd('rebuilding brushing and linking lookup tables');
  }

  private purgeUnusedLocations(): void {
    this._locations = this._locations.filter(d => {
      const val = this._religion_ids_for_location_id.get(d.id);
      return (val !== undefined && val.size > 0);
    });
  }

  hierarchy(): d3hier.HierarchyNode<T.OwnHierarchyNode> {
    return this._hierarchy;
  }

  get hierarchy_depth(): number {
    return this._hierarchy_depth;
  }

  get religion_parent_by_level(): Array<Map<number, number>> {
    return this._religion_parent_by_level;
  }

  placeData(): Array<T.LocationData> {
    return this._place_data;
  }

  activePlaces(): Array<T.LocationData> {
    return this.placeData().filter(d => d.active);
  }

  locations(): Array<any> {
    return this._locations;
  }

  active_location_ids(): Set<number> {
    return new Set<number>(this.placeData()
      .filter(d => d.active)
      .map(d => d.place_id));
  }

  religions(): Map<number, string> {
    return this._religions;
  }

  religionOrdering(): Map<number, number> {
    return this._religion_ordering;
  }

  minYear(): number { return this._minYear; }
  maxYear(): number { return this._maxYear; }
  maxPerYear(): number { return this._maxCountPerYear; }

  setReligionFilter(f: ReligionFilter.ReligionFilter): void {
    if (typeof f === 'object' && f.type === 'simple') {
      // if all religion IDs contained, we can simplify to true (no filter)
      if (Array.from(this._religions.keys())
        .filter(d => d !== 0)
        .every(d => (<ReligionFilter.SimpleReligionFilter>f).filter.includes(d))
      ) f = true;
    }

    this._religion_filter = f;

    this.enqueueStateChange('set religion filter', ChangeScope.Religion);
  }

  setTimeFilter(f: [number, number] | null): void {
    this._time_filter = f;

    this.enqueueStateChange('set time filter', ChangeScope.Time);
  }

  setSourceFilter(f: SourceFilter.SourceFilter): void {
    if (f !== null) {
      // if all source IDs contained, we can simplify to null (no filter)
      if (Array.from(this._sources.keys()).every(d => f.has(d))) f = null;
    }

    this._source_filter = f;

    this.enqueueStateChange('set source filter', ChangeScope.Source);
  }

  setTagsFilter(f: TagFilter.TagFilter): void {
    this._tag_filter = f;

    this.enqueueStateChange('set tag filter', ChangeScope.Tags);
  }

  setPlaceFilter(f: PlaceFilter): void {
    this._place_filter = f;

    this.enqueueStateChange('set place filter', ChangeScope.PlaceSet);
  }

  setMapFilter(f: Feature<MultiPolygon | Polygon> | null): void {
    this._map_filter = f;
    this._map_filter_matcher = createLocationMatcher(this._placeMap, f);

    this.enqueueStateChange('set map filter', ChangeScope.Location);
  }

  leastCommonAncestor(religion_id_a: number | null, religion_id_b: number): number {
    if (religion_id_a === null) return religion_id_b;

    let p1, p2;
    this._hierarchy.each(d => {
      if (d.data.id === religion_id_a) p1 = d;
      if (d.data.id === religion_id_b) p2 = d;
    });
    return p1.path(p2).reduce((acc, el) => {
      return acc.depth < el.depth ? acc : el;
    }, p1).data.id;
  }

  updateHierarchyFilters(uh: ConfidenceAspects) {
    this._confidence_filter = uh;
    this.enqueueStateChange('set confidence filter', ChangeScope.Certainty);
  }

  private tupleIsActive(p: T.LocationData): boolean {
    return tupleActive(p, this._confidence_filter)
        && ReligionFilter.tupleIsActive(this._religion_filter, p)
        && SourceFilter.tupleIsActive(p, this._source_filter)
        && tld.tupleIsActive(p, this._time_filter)
        && TagFilter.tupleIsActive(p, this._tag_filter, this._tag_ids_for_tuple_id)
        && placeTupleIsActive(p, this._place_filter)
        && this._map_filter_matcher.tupleIsActive(p);
  }

  private updatePlacesActive() {
    // if simple religion filter, just evaluate
    if (!this.is_advanced_filter_active) {
      this._place_data.forEach(p => {
        p.active = tupleActive(p, this._confidence_filter)
        && ReligionFilter.tupleIsActive(this._religion_filter, p)
        && SourceFilter.tupleIsActive(p, this._source_filter)
        && tld.tupleIsActive(p, this._time_filter)
        && TagFilter.tupleIsActive(p, this._tag_filter, this._tag_ids_for_tuple_id)
        && placeTupleIsActive(p, this._place_filter)
        && this._map_filter_matcher.tupleIsActive(p);
      });
    } else {
      // complex filter
      const complex_filter: number[][] = (this._religion_filter as ReligionFilter.ComplexReligionFilter).filter;
      const per_place = new Map<number, Set<number>>();  // religion ids per place
      const active_ids = new Set<number>();

      this._place_data.forEach(p => {
        const active = tupleActive(p, this._confidence_filter)
          && ReligionFilter.tupleIsActive(this._religion_filter, p)
          && SourceFilter.tupleIsActive(p, this._source_filter)
          && tld.tupleIsActive(p, this._time_filter)
          && TagFilter.tupleIsActive(p, this._tag_filter, this._tag_ids_for_tuple_id)
          && placeTupleIsActive(p, this._place_filter)
          && this._map_filter_matcher.tupleIsActive(p);

        if (active) {
          active_ids.add(p.tuple_id);
          if (per_place.has(p.place_id)) per_place.get(p.place_id).add(p.religion_id);
          else per_place.set(p.place_id, new Set<number>([p.religion_id]));
        }
      });

      // get place IDs that are matching advanced filter with active evidence
      const place_ids = new Set<number>();
      per_place.forEach((rids, place_id) => {
        if (complex_filter.some(religion_ids => religion_ids.every(rid => rids.has(rid)))) place_ids.add(place_id);
      });

      this._place_data.forEach(p => p.active = (active_ids.has(p.tuple_id) && place_ids.has(p.place_id)));
    }
  }

  get brush_only_active(): boolean {
    return this._brush_only_active;
  }

  set brush_only_active(b: boolean) {
    if (b !== this._brush_only_active) {
      this._brush_only_active = b;
      this.enqueueStateChange('changed show only active', ChangeScope.ShowOnlyActive);
    }
  }

  get display_mode(): T.DisplayMode {
    return this._display_mode;
  }

  set display_mode(d: T.DisplayMode) {
    if (d !== this._display_mode) {
      this._display_mode = d;
      this.enqueueStateChange('set display mode', ChangeScope.DisplayMode);
    }
  }

  get timeline_mode(): T.TimelineMode {
    return this._timeline_mode;
  }

  set timeline_mode(d: T.TimelineMode) {
    if (d !== this._timeline_mode) {
      this._timeline_mode = d;
      this.enqueueStateChange('set timeline mode', ChangeScope.TimelineMode);
    }
  }

  get map_mode(): T.MapMode {
    return this._map_mode;
  }

  set map_mode(d: T.MapMode) {
    if (d !== this._map_mode) {
      this._map_mode = d;
      this.enqueueStateChange('set map mode', ChangeScope.MapMode);
    }
  }

  get source_sort_mode(): T.SourceViewSortMode {
    return this._source_sort_mode;
  }

  set source_sort_mode(d: T.SourceViewSortMode) {
    if (d !== this._source_sort_mode) {
      this._source_sort_mode = d;
      this.enqueueStateChange('set source view sort mode', ChangeScope.SourceViewSortMode);
    }
  }

  get ultimate_parent(): Map<number, number> {
    return this._ultimate_parent;
  }

  get symbol_lookup(): Map<number, string> {
    return this._symbol_lookup;
  }

  get brush(): brush.Brush {
    return this._brush;
  }

  get location_ids_for_religion_id(): Map<number, Set<number>> {
    return this._location_ids_for_religion_id;
  }

  get religion_ids_for_location_id(): Map<number, Set<number>> {
    return this._religion_ids_for_location_id;
  }

  get source_ids_for_religion_id(): Map<number, Set<number>> {
    return this._source_ids_for_religion_id;
  }

  get source_ids_for_location_id(): Map<number, Set<number>> {
    return this._source_ids_for_location_id;
  }

  get religion_ids_for_source_id(): Map<number, Set<number>> {
    return this._religion_ids_for_source_id;
  }

  get location_ids_for_source_id(): Map<number, Set<number>> {
    return this._location_ids_for_source_id;
  }

  get tuple_ids_for_tag_id(): Map<number, Set<number>> {
    return this._tuple_ids_for_tag_id;
  }

  get source_ids_for_tag_id(): Map<number, Set<number>> {
    return this._source_ids_for_tag_id;
  }

  get location_ids_for_tag_id(): Map<number, Set<number>> {
    return this._location_ids_for_tag_id;
  }

  get religion_ids_for_tag_id(): Map<number, Set<number>> {
    return this._religion_ids_for_tag_id;
  }

  get tag_ids_for_tuple_id(): Map<number, number[]> {
    return this._tag_ids_for_tuple_id;
  }

  get raw_place_data(): Array<T.LocationData> {
    return this._place_data;
  }

  get confidence_aspect(): T.ConfidenceAspect {
    return this._displayed_confidence_aspect;
  }

  get confidence_aspect_key(): string {
    return confidence_keys.get(this._displayed_confidence_aspect);
  }

  get place_map(): Map<number, T.Place> {
    return this._placeMap;
  }

  get sources(): Map<number, T.Source> {
    return this._sources;
  }

  set_aspect(aspect: T.ConfidenceAspect): void {
    this._displayed_confidence_aspect = aspect;
    this.enqueueStateChange('set displayed confidence aspect', ChangeScope.DisplayedConfidenceAspect);
  }

  get religion_filter(): ReligionFilter.ReligionFilter {
    return this._religion_filter;
  }

  get confidence_filter(): ConfidenceAspects {
    return this._confidence_filter;
  }

  get source_filter(): SourceFilter.SourceFilter {
    return this._source_filter;
  }

  get time_filter(): tld.TimeFilter {
    return this._time_filter;
  }

  get place_filter(): PlaceFilter {
    return this._place_filter;
  }

  tupleIdsForSourceId(source_id: number): Set<number> {
    if (this._tuple_ids_for_source_id.has(source_id))
      return this._tuple_ids_for_source_id.get(source_id);
    return new Set<number>();
  }

  tupleIdsForReligionIds(religion_ids: number[]): Set<number> {
    const tups = new Set<number>()
    religion_ids.forEach(relid => {
      if (this._tuple_ids_for_religion_id.has(relid))
        this._tuple_ids_for_religion_id.get(relid).forEach(d => tups.add(d));
    });
    return tups;
  }

  tupleIdsForLocationIds(location_ids: number[]): Set<number> {
    const tups = new Set<number>()
    location_ids.forEach(location_id => {
      if (this._tuple_ids_for_location_id.has(location_id))
        this._tuple_ids_for_location_id.get(location_id).forEach(d => tups.add(d));
    });
    return tups;
  }

  get existing_religions(): Set<number> {
    return this._existing_religions;
  }

  get tags(): T.Tag[] {
    return this._tags;
  }

  get tag_filter(): TagFilter.TagFilter {
    return this._tag_filter;
  }

  get location_filter(): LocationFilter {
    return this._map_filter;
  }

  get user(): { user: string | null, readdb: boolean, writedb: boolean } {
    return this._user;
  }

  private getRawVisualizationState(): RawVisualizationState {
    return {
      ["show-filtered"]: this._brush_only_active,
      ["display-mode"]: (this._display_mode === T.DisplayMode.Religion) ? 'religion' : 'confidence',
      ["timeline-mode"]: (this._timeline_mode === T.TimelineMode.Qualitative) ? 'qualitative' : 'quantitative',
      ["map-mode"]: (this._map_mode === T.MapMode.Clustered) ? 'clustered' : 'cluttered',
      ["source-sort-mode"]: (this._source_sort_mode === T.SourceViewSortMode.ByCountDescending) ? 'count' : 'name',
      ["confidence-aspect"]: confidence_keys.get(this._displayed_confidence_aspect),
      ["map-state"]: this._map_state,
      filters: {
        religion: this._religion_filter,
        time: this._time_filter,
        sources: SourceFilter.to_exportable(this._source_filter),
        confidence: this._confidence_filter,
        tags: TagFilter.to_exportable(this._tag_filter),
        location: this._map_filter,
        places: this._place_filter,
      },
    };
  }

  getState(): CompleteVisualizationState {
    return {
      ...this.getRawVisualizationState(),
      metadata: {
        version: this._server_version,
        createdBy: this._user.user,
        createdAt: new Date().toISOString(),
        source: 'visualization',
        evidenceCount: new Set<number>(this.activePlaces().map(d => d.tuple_id)).size,
      },
    };
  }

  async setState(state: VisualizationState, isLoad: boolean = false): Promise<{ success: boolean, error_message: any }> {
    this.suspendEvents();

    const { valid, errors } = this._visualization_state_validator.validate(state);
    const retval = { success: valid, error_message: errors };

    if (valid) {
      // filters
      const filters = state.filters;

      this._religion_filter = filters.religion;
      this._time_filter = filters.time;
      this._source_filter = SourceFilter.from_exportable(filters.sources);
      this._tag_filter = TagFilter.from_exportable(filters.tags);
      this._confidence_filter = filters.confidence;
      this._place_filter = filters.places;
      this.setMapFilter(filters.location);  // needs to do calculation with places

      // others
      if ('show-filtered' in state)
        this._brush_only_active = state['show-filtered'];

      if ('display-mode' in state)
        this._display_mode = (state['display-mode'] === 'religion')
          ? T.DisplayMode.Religion
          : T.DisplayMode.Confidence;

      if ('timeline-mode' in state)
        this._timeline_mode = (state['timeline-mode'] === 'qualitative')
          ? T.TimelineMode.Qualitative
          : T.TimelineMode.Quantitative;

      if ('map-mode' in state)
        this._map_mode = (state['map-mode'] === 'clustered')
          ? T.MapMode.Clustered
          : T.MapMode.Cluttered;

      if ('source-sort-mode' in state)
        this._source_sort_mode = (state['source-sort-mode'] === 'count')
          ? T.SourceViewSortMode.ByCountDescending
          : T.SourceViewSortMode.ByShortNameAscending;

      if ('confidence-aspect' in state)
        this._displayed_confidence_aspect = confidence_aspects.get(state['confidence-aspect']);

      if ('map-state' in state)
        this._map_state = state['map-state'];

      this._queued_events = new Set([
        ChangeScope.Religion,
        ChangeScope.Time,
        ChangeScope.Source,
        ChangeScope.Tags,
        ChangeScope.Certainty,
        ChangeScope.Location,
        ChangeScope.PlaceSet,
        ChangeScope.ShowOnlyActive,
        ChangeScope.SourceViewSortMode,
        ChangeScope.DisplayMode,
        ChangeScope.MapMode,
        ChangeScope.DisplayedConfidenceAspect,
      ]);
      this._queuedStateChangeDescriptions.push('');
    }

    this._firstMapMoveAfterStateLoad = true;
    this.resumeEvents(isLoad ? 'load-state' : 'set-state');

    return retval;
  }

  // avoid adding a change event because the map sends a move event after load anyways
  private _firstMapMoveAfterStateLoad: boolean = false;
  disableFirstMapStateEvent() {
    this._firstMapMoveAfterStateLoad = true;
  }

  setMapState(map_state: T.MapState) {
    this._map_state = map_state;

    if (this._is_paused) {
      this._queuedStateChangeDescriptions.push('moved map');
    } else {
      if (this._firstMapMoveAfterStateLoad) {
        this._firstMapMoveAfterStateLoad = false;
      } else {
        this.historyTree.pushState(this.getRawVisualizationState(), 'moved map');
      }
    }
  }

  getMapState(): T.MapState {
    return this._map_state;
  }
};
