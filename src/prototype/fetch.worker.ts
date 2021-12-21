import { json } from 'd3-fetch';
import { DataWorker, MessageData } from './data-worker';
import { Dataset, getDataset, ChangeScope, FilterJson } from './dataset';
import { DisplayMode } from './datatypes';
import * as Message from './message';
import { confidence_aspects } from './confidence-filter';

class FetchWorker extends DataWorker<any> {
  private religionPort: MessagePort;
  private messagePort: MessagePort;
  private untimedPort: MessagePort;
  private confidencePort: MessagePort;
  private sourceListPort: MessagePort;
  private locationListPort: MessagePort;
  private timelinePort: MessagePort;
  private mapPort: MessagePort;
  private tagsPort: MessagePort;

  private data: Dataset;

  async handleDataEvent(e) {
    if (e.data.type === 'set-message') {
      this.sendMessage(e.data.data);
    } else {
      console.log(e);
    }
  }
  async handleMainEvent(data: MessageData<any>) {
    if (data.type === 'load-data') {
      await this.reloadData(data);
      this.data.resumeEvents();
      await this.handleDatasetChange(null);
    } else if (data.type === 'set-religion-port') {
      this.religionPort = data.data;
      this.religionPort.onmessage = async (evt) => await this.handleReligionMessage(evt.data);
    } else if (data.type === 'set-location-list-port') {
      this.locationListPort = data.data;
      this.locationListPort.onmessage = async (evt) => await this.handleLocationListMessage(evt.data);
    } else if (data.type === 'set-source-list-port') {
      this.sourceListPort = data.data;
      this.sourceListPort.onmessage = async (evt) => await this.handleSourceListMessage(evt.data);
    } else if (data.type === 'set-confidence-port') {
      this.confidencePort = data.data;
      this.confidencePort.onmessage = async (evt) => await this.handleConfidenceMessage(evt.data);
    } else if (data.type === 'set-map-port') {
      this.mapPort = data.data;
      this.mapPort.onmessage = async (evt) => await this.handleMapMessage(evt.data);
    } else if (data.type === 'set-timeline-port') {
      this.timelinePort = data.data;
      this.timelinePort.onmessage = async (evt) => await this.handleTimelineMessage(evt.data);
    } else if (data.type === 'set-untimed-port') {
      this.untimedPort = data.data;
      this.untimedPort.onmessage = async (evt) => await this.handleUntimedMessage(evt.data);
    } else if (data.type === 'set-tags-port') {
      this.tagsPort = data.data;
      this.tagsPort.onmessage = async (evt) => await this.handleTagsMessage(evt.data);
    } else if (data.type === 'set-message-port') {
      this.messagePort = data.data;
      //this.messagePort.onmessage = async (evt) => await this.handleReligionMessage(evt.data);
    } else if (data.type === 'set-show-only-active') {
      this.data.suspendEvents();

      this.data.brush_only_active = data.data;

      this.data.resumeEvents();
    } else if (data.type === 'set-display-mode') {
      this.data.suspendEvents();

      if (data.data === 'Religion') this.data.display_mode = DisplayMode.Religion;
      else if (data.data === 'Confidence') this.data.display_mode = DisplayMode.Confidence;
      else throw data.data;

      this.data.resumeEvents();
    } else if (data.type === 'set-timeline-mode') {
      this.data.suspendEvents();

      this.data.timeline_mode = data.data

      this.data.resumeEvents();
    } else if (data.type === 'set-map-mode') {
      this.data.suspendEvents();

      this.data.map_mode = data.data

      this.data.resumeEvents();
    } else if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else if (data.type === 'export-visualization-state') {
      const filters = this.data.getState();
      this.sendToMainThread({ type: 'export-visualization-state', data: filters });
    } else if (data.type === 'import-visualization-state') {
      const filters = data.data;
      const result = await this.data.setState(filters);
      this.mapPort?.postMessage({type: 'set-map-state', data: this.data.getMapState()});
      this.sendToMainThread({ type: 'import-visualization-state', data: result });
    } else if (data.type === 'generate-report' || data.type === 'describe-filters') {
      const { filters, metadata } = this.data.getState();
      this.sendToMainThread({ type: data.type, data: { filters, metadata } });
    } else {
      throw data.type;
    }
  }

  private async reloadData(data: MessageData<string | undefined>) {
    const html = '<i class="fa fa-download fa-fw"></i>';
    this.sendMessage({key: 'data-fetch', html, state: true});

    this.mapPort?.postMessage({type: 'notify-is-loading', target: 'map', data: {html, state: true}});
    this.religionPort?.postMessage({type: 'notify-is-loading', target: 'religion', data: {html, state: true}});
    this.untimedPort?.postMessage({type: 'notify-is-loading', target: 'untimed', data: {html, state: true}});
    this.confidencePort?.postMessage({type: 'notify-is-loading', target: 'confidence', data: {html, state: true}});
    this.sourceListPort?.postMessage({type: 'notify-is-loading', target: 'source-list', data: {html, state: true}});
    this.locationListPort?.postMessage({type: 'notify-is-loading', target: 'location-list', data: {html, state: true}});
    this.timelinePort?.postMessage({type: 'notify-is-loading', target: 'timeline', data: {html, state: true}});
    this.tagsPort?.postMessage({type: 'notify-is-loading', target: 'tags', data: {html, state: true}});

    // get the filter from the report UUID, if present
    const filterJson: Promise<FilterJson | null> = data.data
      ? json<FilterJson>(`../reporting/${data.data}/filter`).catch(() => null)
      : Promise.resolve(null);

    const [ _dataset, _filter ] = await Promise.all([ getDataset(), filterJson ]);
    this.data = _dataset;

    // apply the filter from the report UUID, if present
    if (_filter !== null) await this.data.setState(_filter);

    // suspend now (setState resumes), then set listeners for change events
    this.data.suspendEvents();

    this.data.onDatasetChange(this.handleDatasetChange.bind(this));

    this.data.brush.linkHierarchy = async (religion_ids: number[] | null) => {
      let message: MessageData<number[] | null>;
      if (religion_ids === null) message = { type: 'clear-brush', data: null };
      else message = { type: 'set-brush', data: religion_ids };
      message.target = 'religion';
      this.religionPort?.postMessage(message);
    };

    this.data.brush.linkUntimed = async (tuple_ids: Set<number> | null) => {
      this.sendMessage({key: 'data-link-untimed', html: '<i class="fa fa-spinner fa-pulse fa-fw"></i>', state: true});
      const active = (tuple_ids === null)
        ? (this.data.brush_only_active ? this.data.activePlaces() : this.data.placeData())
        : (this.data.brush_only_active ? this.data.activePlaces() : this.data.placeData()).filter(d => tuple_ids.has(d.tuple_id));

      const religion_order = {};
      this.data.religionOrdering().forEach((v, k) => religion_order[k] = v);

      await this.sendUntimedData(active, religion_order);

      this.sendMessage({key: 'data-link-untimed', state: false});
    };

    this.data.brush.linkLocationList = async (location_ids: Set<number> | null) => {
      let message: MessageData<Set<number> | null>;
      if (location_ids === null) message = { type: 'clear-brush', data: null };
      else message = { type: 'set-brush', data: location_ids };
      message.target = 'location-list';
      this.locationListPort?.postMessage(message);
    };

    this.data.brush.linkSources = async (source_ids: Set<number> | null) => {
      let message: MessageData<Set<number> | null>;
      if (source_ids === null) message = { type: 'clear-brush', data: null };
      else message = { type: 'set-brush', data: source_ids };
      message.target = 'source-list';
      this.sourceListPort?.postMessage(message);
    };

    this.data.brush.linkTimeline = async (tuple_ids: Set<number> | null) => {
      this.sendMessage({key: 'data-link-timeline', html: '<i class="fa fa-spinner fa-pulse fa-fw"></i>', state: true});
      const active = (tuple_ids === null)
        ? (this.data.brush_only_active ? this.data.activePlaces() : this.data.placeData())
        : (this.data.brush_only_active ? this.data.activePlaces() : this.data.placeData()).filter(d => tuple_ids.has(d.tuple_id));

      const religion_order = {};
      this.data.religionOrdering().forEach((v, k) => religion_order[k] = v);

      await this.sendTimelineData(active, religion_order);
      this.sendMessage({key: 'data-link-timeline', state: false});
    };

    this.data.brush.linkMap = async (location_ids: Set<number> | null) => {
      let message: MessageData<Set<number> | null>;
      if (location_ids === null) message = { type: 'clear-brush', data: null };
      else message = { type: 'set-brush', data: location_ids };
      message.target = 'map';
      this.mapPort?.postMessage(message);
    };

    this.data.brush.linkTags = async (evidence_ids: Set<number> | null) => {
      let message: MessageData<Set<number> | null>;
      if (evidence_ids === null) message = { type: 'clear-brush', data: null };
      else message = { type: 'set-brush', data: evidence_ids };
      message.target = 'tags';
      this.tagsPort?.postMessage(message);
    };

    this.sendMessage({key: 'data-fetch', state: false});
  }

  private async handleReligionMessage(data: MessageData<any>) {
    if (data.type === 'set-filter') {
      this.data.suspendEvents();

      const {simple, religion_ids} = data.data;

      this.data.setReligionFilter(simple
        ? { type: 'simple', filter: religion_ids }
        : { type: 'complex', filter: religion_ids }
      );

      this.data.resumeEvents();
    } else if (data.type === 'set-brush') {
      this.data.brush.onHierarchyBrush(data.data);
    } else if (data.type === 'clear-brush') {
      this.data.brush.resetBrush();
    } else if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else {
      throw data.type;
    }
  }

  private async handleUntimedMessage(data: MessageData<any>) {
    if (data.type === 'set-brush') {
      this.data.brush.onUntimedBrush(data.data);
    } else if (data.type === 'clear-brush') {
      this.data.brush.resetBrush();
    } else if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else {
      throw data.type;
    }
  }

  private async handleTimelineMessage(data: MessageData<any>) {
    if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else if (data.type === 'set-filter') {
      this.data.suspendEvents();
      this.data.setTimeFilter(data.data);
      this.data.resumeEvents();
    } else {
      throw data.type;
    }
  }

  private async handleMapMessage(data: MessageData<any>) {
    if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else if (data.type === 'set-brush') {
      this.data.brush.onMapBrush(data.data);
    } else if (data.type === 'clear-brush') {
      this.data.brush.resetBrush();
    } else if (data.type === 'set-map-state') {
      this.data?.setMapState(data.data);
    } else if (data.type === 'set-map-filter') {
      this.data.setMapFilter(data.data);
    } else {
      throw data.type;
    }
  }

  private async handleConfidenceMessage(data: MessageData<any>) {
    if (data.type === 'set-filter') {
      this.data.suspendEvents();
      this.data.updateHierarchyFilters(data.data);
      this.data.resumeEvents();
    } else if (data.type === 'set-confidence-aspect') {
      this.data.suspendEvents();
      this.data.set_aspect(confidence_aspects.get(data.data));
      this.data.resumeEvents();
    } else if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else {
      throw data.type;
    }
  }

  private async handleLocationListMessage(data: MessageData<any>) {
    if (data.type === 'set-brush') {
      this.data.brush.onLocationListBrush(data.data);
    } else if (data.type === 'set-filter') {
      this.data.suspendEvents();
      this.data.setPlaceFilter(data.data);
      this.data.resumeEvents();
    } else if (data.type === 'clear-brush') {
      this.data.brush.resetBrush();
    } else if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else {
      throw data.type;
    }
  }

  private async handleSourceListMessage(data: MessageData<any>) {
    if (data.type === 'set-brush') {
      this.data.brush.onSourceBrush(data.data);
    } else if (data.type === 'clear-brush') {
      this.data.brush.resetBrush();
    } else if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else if (data.type === 'set-filter') {
      this.data.setSourceFilter(data.data);
    } else {
      throw data.type;
    }
  }

  private async handleTagsMessage(data: MessageData<any>) {
    if (data.type === 'set-brush') {
      this.data.brush.onTagsBrush(data.data);
    } else if (data.type === 'clear-brush') {
      this.data.brush.resetBrush();
    } else if (data.type === 'set-message') {
      this.sendMessage(data.data);
    } else if (data.type === 'set-filter') {
      this.data.setTagsFilter(data.data);
    } else {
      throw data.type;
    }
  }

  private async sendReligionData(place_data) {
    this.religionPort?.postMessage({
      type: 'set-data',
      data: {
        hierarchy: this.data.hierarchy(),
        data: place_data,
        active_aspect: this.data.confidence_aspect,
        display_mode: this.data.display_mode,
        brush_only_active: this.data.brush_only_active,
        colors: this.data.transferableColorscheme(),
        religion_filter: this.data.religion_filter,
        existing_religions: this.data.existing_religions,
      }
    });
  }

  private async sendUntimedData(place_data, religion_order) {
    const parent_religions = {};
    this.data.ultimate_parent.forEach((v, k) => parent_religions[k] = v);

    const main_religions = this.data.hierarchy().children.map(d => d.data.id);
    const main_religion_icons = {};
    main_religions.forEach(r => main_religion_icons[r] = this.data.symbol_lookup.get(r));

    this.untimedPort?.postMessage({
      type: 'set-data',
      data: {
        data: place_data.filter(d => d.time_span === null),
        active_aspect: this.data.confidence_aspect,
        display_mode: this.data.display_mode,
        brush_only_active: this.data.brush_only_active,
        colors: this.data.transferableColorscheme(),
        parent_religions,
        religion_order,
        main_religions,
        main_religion_icons,
        religion_names: this.data.religions(),
      }
    });
  }

  private async sendConfidenceData() {
    this.confidencePort?.postMessage({
      type: 'set-data',
      data: {
        data: this.data.placeData(),
        confidence_filter: this.data.confidence_filter,
        confidence_aspect: this.data.confidence_aspect,
        colors: this.data.transferableConfidenceColorscheme()
      }
    });
  }

  private async sendLocationListData(placed, unplaced, allPlaces, filterChanged) {
    this.locationListPort?.postMessage({
      type: 'set-data',
      data: {
        placed,
        unplaced,
        allPlaces,
        filter: this.data.place_filter,
        user: this.data.user,
        filterChanged,
        confidenceColorscale: this.data.transferableConfidenceColorscheme(),
        locationConfidenceFilter: this.data.confidence_filter.location_confidence,
      }
    });
  }

  private async sendMapData(data, religion_order) {
    const parent_religions = {};
    this.data.ultimate_parent.forEach((v, k) => parent_religions[k] = v);

    const main_religions = this.data.hierarchy().children.map(d => d.data.id);
    const main_religion_icons = {};
    main_religions.forEach(r => main_religion_icons[r] = this.data.symbol_lookup.get(r));

    this.mapPort?.postMessage({
      type: 'set-data',
      data: {
        place_data: data,
        place_map: this.data.place_map,
        parents_per_level: this.data.religion_parent_by_level,
        religion_order,
        colors: this.data.transferableColorscheme(),
        parent_religions,
        main_religion_icons,
        active_aspect_key: this.data.confidence_aspect_key,
        display_mode: this.data.display_mode,
        religion_names: this.data.religions(),
        filter: this.data.location_filter,
        map_mode: this.data.map_mode,
      }
    });
  }

  private async sendTimelineData(data, religion_order) {
    this.timelinePort?.postMessage({
      type: 'set-data',
      data: {
        data: data,
        active_aspect: this.data.confidence_aspect,
        display_mode: this.data.display_mode,
        timeline_mode: this.data.timeline_mode,
        brush_only_active: this.data.brush_only_active,
        colors: this.data.transferableColorscheme(),
        religion_order,
        total_year_range: {start: this.data.minYear(), end: this.data.maxYear()},
        time_filter: this.data.time_filter,
        religion_names: this.data.religions(),
      }
    });
  }

  private async sendSourceListData(data, religion_order) {
    this.sourceListPort?.postMessage({
      type: 'set-data',
      data: {
        evidence: data,
        sources: Array.from(this.data.sources.values()),
        confidence_aspect_key: this.data.confidence_aspect_key,
        display_mode: this.data.display_mode,
        colors: this.data.transferableColorscheme(),
        religion_order,
        source_filter: this.data.source_filter,
        religion_names: this.data.religions(),
      }
    });
  }

  private async sendTagsData(data) {
    this.tagsPort?.postMessage({
      type: 'set-data',
      data: {
        evidence: data,
        tags: this.data.tags,
        tag_filter: this.data.tag_filter
      }
    });
  }

  private async sendMessage(msg: Message.Data) {
    this.messagePort?.postMessage({
      type: 'set-data',
      data: msg
    });
  }

  private async sendSettingsData() {
    this.sendToMainThread({ type: 'set-settings-data', data: {
      brush_only_active: this.data.brush_only_active,
      display_mode: (this.data.display_mode === DisplayMode.Religion) ? 'religion' : 'confidence',
      timeline_mode: this.data.timeline_mode,
      map_mode: this.data.map_mode,
    }});
  }

  protected async handleDatasetChange(cs: Set<ChangeScope>) {
    this.sendMessage({key: 'data-fetch.handleDatasetChange', html: '<i class="fa fa-spinner fa-pulse fa-fw"></i>', state: true});
    const active = this.data.brush_only_active
      ? this.data.activePlaces()
      : this.data.placeData();

    let placed = [];
    let unplaced = [];

    const allPlaces = Array.from(this.data.place_map.entries())
      .map(([id, {name}]) => { return { id, name }; });

    const active_ids = this.data.active_location_ids();
    this.data.locations().forEach(loc => {
      if (!this.data.brush_only_active || active_ids.has(loc.id)) {
        if (loc.geoloc) placed.push(loc);
        else unplaced.push(loc);
      }
    });

    const religion_order = {};
    this.data.religionOrdering().forEach((v, k) => religion_order[k] = v);

    if (cs && cs.size === 1 && cs.has(ChangeScope.TimelineMode)) {
      // if only TimelineMode changed, there is no reason to rebuild all views
      await Promise.all([
        this.sendTimelineData(active, religion_order),
        this.sendSettingsData(),
      ]);
    } else if (cs && cs.size === 1 && cs.has(ChangeScope.MapMode)) {
      // if only MapMode changed, there is no reason to rebuild all views
      await Promise.all([
        this.sendMapData(active, religion_order),
        this.sendSettingsData(),
      ]);
    } else {
      await Promise.all([
        this.sendReligionData(active),
        this.sendUntimedData(active, religion_order),
        this.sendConfidenceData(),
        this.sendLocationListData(placed, unplaced, allPlaces, cs === null || cs.has(ChangeScope.PlaceSet)),
        this.sendSourceListData(active, religion_order),
        this.sendTimelineData(active, religion_order),
        this.sendMapData(active, religion_order),
        this.sendTagsData(active),
        this.sendSettingsData(),
      ]);
    }

    this.sendMessage({key: 'data-fetch.handleDatasetChange', state: false});
  }
};

const ctx: Worker = self as any;
const w = new FetchWorker(ctx);
