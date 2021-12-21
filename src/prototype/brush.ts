import {Dataset,ChangeScope} from './dataset';
import * as T from './datatypes';

export type LocationIdLinkFunction = (lids: Set<number> | null) => Promise<void>;
export type ReligionIdLinkFunction = (rids: number[] | null) => Promise<void>;
export type UntimedLinkFunction = (tuple_ids: Set<number> | null) => Promise<void>;
export type TimelineLinkFunction = (tuple_ids: Set<number> | null) => Promise<void>;
export type SourceLinkFunction = (sids: Set<number> | null) => Promise<void>;
export type TagsLinkFunction = (tuple_ids: Set<number> | null) => Promise<void>;

export class Brush {
  private data: Dataset;

  /* LINK FUNCTIONS */
  private locationListLinkFunction: LocationIdLinkFunction;
  private mapLinkFunction: LocationIdLinkFunction;
  private untimedLinkFunction: UntimedLinkFunction;
  private timelineLinkFunction: TimelineLinkFunction;
  private hierarchyLinkFunction: ReligionIdLinkFunction;
  private sourceLinkFunction: SourceLinkFunction;
  private tagsLinkFunction: TagsLinkFunction;

  constructor(d: Dataset) {
    this.data = d;

    this.data.onDatasetChange(this.onDatasetChange.bind(this));

    const fn = function(_: any): Promise<void> { return new Promise((a,b) => a()); };
    this.locationListLinkFunction = fn;
    this.mapLinkFunction = fn;
    this.untimedLinkFunction = fn;
    this.timelineLinkFunction = fn;
    this.hierarchyLinkFunction = fn;
    this.sourceLinkFunction = fn;
    this.tagsLinkFunction = fn;
  }

  private onDatasetChange(_: Set<ChangeScope>): Promise<void> {
    return this.resetBrush();
  }

  set linkLocationList(fn: LocationIdLinkFunction) {
    this.locationListLinkFunction = fn;
  }

  set linkMap(fn: LocationIdLinkFunction) {
    this.mapLinkFunction = fn;
  }

  set linkUntimed(fn: UntimedLinkFunction) {
    this.untimedLinkFunction = fn;
  }

  set linkTimeline(fn: TimelineLinkFunction) {
    this.timelineLinkFunction = fn;
  }

  set linkHierarchy(fn: ReligionIdLinkFunction) {
    this.hierarchyLinkFunction = fn;
  }

  set linkSources(fn: SourceLinkFunction) {
    this.sourceLinkFunction = fn;
  }

  set linkTags(fn: TagsLinkFunction) {
    this.tagsLinkFunction = fn;
  }

  resetBrush(): Promise<void> {
    return Promise.all([
      this.locationListLinkFunction(null),
      this.mapLinkFunction(null),
      this.untimedLinkFunction(null),
      this.timelineLinkFunction(null),
      this.hierarchyLinkFunction(null),
      this.sourceLinkFunction(null),
      this.tagsLinkFunction(null)
    ]).catch(console.error)
      .then(() => {});
  }

  onMapBrush(cluster_data: { religion_ids: Set<number>, place_ids: Set<number>, source_ids: Set<number>, tuple_ids: Set<number> }): Promise<void> {
    // link location list
    const ll = this.locationListLinkFunction(cluster_data.place_ids);

    const lh = this.hierarchyLinkFunction(Array.from(cluster_data.religion_ids));

    // link map
    const lm = this.mapLinkFunction(cluster_data.place_ids);

    // link timeline
    const lt = this.timelineLinkFunction(cluster_data.tuple_ids);

    // link untimed data
    const lu = this.untimedLinkFunction(cluster_data.tuple_ids);

    // link sources
    const ls = this.sourceLinkFunction(cluster_data.source_ids);

    // link tags
    const tag_ids = new Set<number>();
    cluster_data.tuple_ids.forEach(tid => {
      this.data.tag_ids_for_tuple_id.get(tid)?.forEach(tt => tag_ids.add(tt));
    });
    const ltag = this.tagsLinkFunction(tag_ids);

    return Promise.all([ll, lh, lt, lu, lm, ls, ltag])
      .catch(console.error)
      .then(() => {});
  }

  async onHierarchyBrush(religion_ids: number[]): Promise<void> {
    const loc_ids = new Set<number>();
    const source_ids = new Set<number>();
    religion_ids.forEach(id => {
      const lids = this.data.location_ids_for_religion_id.get(id);
      const sids = this.data.source_ids_for_religion_id.get(id);
      if (sids !== undefined) sids.forEach(source_ids.add.bind(source_ids));
      if (lids !== undefined) lids.forEach(loc_ids.add.bind(loc_ids));
    });
    // link sources
    const ls = this.sourceLinkFunction(source_ids);

    // link location list
    const ll = this.locationListLinkFunction(loc_ids);

    // link map
    const lm = this.mapLinkFunction(loc_ids);

    // link hierarchy
    const lh = this.hierarchyLinkFunction(religion_ids);

    const tuple_ids = this.data.tupleIdsForReligionIds(religion_ids);
    // link timeline
    const lt = this.timelineLinkFunction(tuple_ids);
    const lu = this.untimedLinkFunction(tuple_ids);

    // link tags
    const tag_ids = new Set<number>();
    tuple_ids.forEach(tid => {
      this.data.tag_ids_for_tuple_id.get(tid)?.forEach(tt => tag_ids.add(tt));
    });
    const ltag = this.tagsLinkFunction(tag_ids);

    return await Promise.all([ll, lm, lt, lu, ls, lh, ltag])
      .catch(console.error)
      .then(() => {});
  }

  onUntimedBrush(datum: {
    location_ids: Set<number>,
    religion_ids: Set<number>,
    source_ids: Set<number>,
    tuple_ids: Set<number>,
  }): Promise<void> {
    // link sources
    const ls = this.sourceLinkFunction(datum.source_ids);

    // link location list
    const ll = this.locationListLinkFunction(datum.location_ids);

    // link map
    const lm = this.mapLinkFunction(datum.location_ids);

    // link hierarchy
    const lh = this.hierarchyLinkFunction(Array.from(datum.religion_ids));

    // link untimed
    const lu = this.untimedLinkFunction(datum.tuple_ids);

    // disable timeline
    const lt = this.timelineLinkFunction(new Set<number>());

    // link tags
    const tag_ids = new Set<number>();
    datum.tuple_ids.forEach(tid => {
      this.data.tag_ids_for_tuple_id.get(tid)?.forEach(tt => tag_ids.add(tt));
    });
    const ltag = this.tagsLinkFunction(tag_ids);

    return Promise.all([ll, lm, lt, lh, lu, ls, ltag])
      .catch(console.error)
      .then(() => {});
  }

  onLocationListBrush(place_id: number): Promise<void> {
    const place_ids = new Set<number>([place_id]);

    // link location list
    const ll = this.locationListLinkFunction(place_ids);

    // link map
    const lm = this.mapLinkFunction(place_ids);

    // link hierarchy
    const rels = this.data.religion_ids_for_location_id.get(place_id) || new Set<number>();
    const lh = this.hierarchyLinkFunction(Array.from(rels));

    // link sources
    const source_ids = this.data.source_ids_for_location_id.get(place_id) || new Set<number>();
    const ls = this.sourceLinkFunction(source_ids);

    const tuple_ids = this.data.tupleIdsForLocationIds([place_id]);
    const lt = this.timelineLinkFunction(tuple_ids);
    const lu = this.untimedLinkFunction(tuple_ids);

    // link tags
    const tag_ids = new Set<number>();
    tuple_ids.forEach(tid => {
      this.data.tag_ids_for_tuple_id.get(tid)?.forEach(tt => tag_ids.add(tt));
    });
    const ltag = this.tagsLinkFunction(tag_ids);

    return Promise.all([lt, lm, lu, lh, ll, ls, ltag])
      .catch(console.error)
      .then(() => {});
  }

  onSourceBrush(source_id: number): Promise<void> {
    const place_ids = this.data.location_ids_for_source_id.get(source_id) || new Set<number>();
    const religion_ids = this.data.religion_ids_for_source_id.get(source_id);

    // link hierarchy
    const lh = this.hierarchyLinkFunction(Array.from(religion_ids));

    // link location list
    const ll = this.locationListLinkFunction(place_ids);

    // link map
    const lm = this.mapLinkFunction(place_ids);

    // link sources
    const ls = this.sourceLinkFunction(new Set<number>([source_id]));

    const tuple_ids = this.data.tupleIdsForSourceId(source_id);
    const lt = this.timelineLinkFunction(tuple_ids);
    const lu = this.untimedLinkFunction(tuple_ids);

    // link tags
    const tag_ids = new Set<number>();
    tuple_ids.forEach(tid => {
      this.data.tag_ids_for_tuple_id.get(tid)?.forEach(tt => tag_ids.add(tt));
    });
    const ltag = this.tagsLinkFunction(tag_ids);

    return Promise.all([ls,lt,lu,lh,ll,lm, ltag])
      .catch(console.error)
      .then(() => {});
  }

  onTagsBrush(tag_id: number): Promise<void> {
    // link hierarchy
    const religion_ids = this.data.religion_ids_for_tag_id.get(tag_id) || new Set<number>();
    const lh = this.hierarchyLinkFunction(Array.from(religion_ids));

    // link location list
    const place_ids = this.data.location_ids_for_tag_id.get(tag_id) || new Set<number>();
    const ll = this.locationListLinkFunction(place_ids);

    // link map
    const lm = this.mapLinkFunction(place_ids);

    // link sources
    const source_ids = this.data.source_ids_for_tag_id.get(tag_id) || new Set<number>();
    const ls = this.sourceLinkFunction(new Set<number>(source_ids));


    const tuple_ids = this.data.tuple_ids_for_tag_id.get(tag_id) || new Set<number>();
    const lt = this.timelineLinkFunction(tuple_ids);
    const lu = this.untimedLinkFunction(tuple_ids);

    // link tags
    const ltag = this.tagsLinkFunction(new Set<number>([tag_id]));

    return Promise.all([lt, lm, lu, lh, ll, ls, ltag])
      .catch(console.error)
      .then(() => {});
  }
};
