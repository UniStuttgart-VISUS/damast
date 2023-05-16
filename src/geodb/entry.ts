import { Tabulator } from 'tabulator-tables';
import type { ColumnDefinition, Options, CellComponent, RowComponent, ColumnComponent } from 'tabulator-tables';
import * as d3 from 'd3';
import PlaceTable from './place-table';
import PersonTable from './person-table';
import EvidenceTable from './evidence-table';
import TimeTable from './time-table';
import SourceTable from './source-table';
import AlternativeNameTable from './alt-name-table';
import {ExternalPlaceUriTable} from './external-uri-table';
import ExternalPersonUriTable from './external-person-uri-table';
import MapPane from './map';

import Cache from '../common/cache';
import removeHash from '../common/remove-hash-from-uri';

import {confirm_dialog,choice_or_cancel_dialog} from '../common/dialog';

const table_actions = ['selected', 'updated', 'added', 'deleted'];

if (/\/persons/.test(window.location.toString())) {
  const tables = ['person', 'external-person-uri'];

  const table_dispatch_events = d3.cross(tables, table_actions)
    .map(([a,b]) => `${a}-${b}`);
  const additional_events = [];

  const dispatch = d3.dispatch(...table_dispatch_events, ...additional_events);
  const cache = new Cache();

  const external_person_uri_table = new ExternalPersonUriTable(dispatch, cache, 'external-person-uri', d3.select<HTMLDivElement, any>('.section#external-person-uris'), '#external-person-uri-table');

  const person_table = new PersonTable(dispatch, cache, 'person', d3.select<HTMLDivElement, any>('.section#person'), '#person-table', [
    { table: external_person_uri_table, name: 'External Person URIs' },
  ]);

  // EVENTS
  dispatch.on('person-selected.load-external-uris', data => external_person_uri_table.loadData(data.id));

  Promise.all([
    cache.ready,
    person_table.tableBuilt,
    external_person_uri_table.tableBuilt,
  ]).then(() => person_table.loadData());

  window.onbeforeunload = function (e: BeforeUnloadEvent) {
    if ([
      person_table,
      external_person_uri_table,
      ].some(d => d.hasUnsavedChanges())) {
      // Cancel the event
      e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
      // Chrome requires returnValue to be set
      e.returnValue = '';
    } else {
      delete e['returnValue'];
    }
  };
} else {
  const tables = ['place', 'evidence', 'time', 'source', 'alt-name', 'external-place-uri'];

  const table_dispatch_events = d3.cross(tables, table_actions)
    .map(([a,b]) => `${a}-${b}`);

  const additional_events = ['map-selected', 'map-updated', 'places-loaded', 'places-filtered', 'evidence-child-changed'];

  const dispatch = d3.dispatch(...table_dispatch_events, ...additional_events);
  const cache = new Cache();

  const time_table = new TimeTable(dispatch, cache, 'time', d3.select<HTMLDivElement, any>('.section#time'), '#time-table');

  const source_table = new SourceTable(dispatch, cache, 'source', d3.select<HTMLDivElement, any>('.section#source'), '#source-table');

  const evidence_table = new EvidenceTable(dispatch, cache, 'evidence', d3.select<HTMLDivElement, any>('.section#evidence'), '#evidence-table',
    [
      {table: time_table, name: 'Time Spans'},
      {table: source_table, name: 'Sources'},
    ]
  );

  const alt_name_table = new AlternativeNameTable(dispatch, cache, 'alt-name', d3.select<HTMLDivElement, any>('.section#alt-names'), '#alt-name-table');

  const external_uri_table = new ExternalPlaceUriTable(dispatch, cache, 'external-place-uri', d3.select<HTMLDivElement, any>('.section#external-uris'), '#external-uri-table');

  const place_table = new PlaceTable(dispatch, cache, 'place', d3.select<HTMLDivElement, any>('.section#place'), '#place-table',
    [
      {table: time_table, name: 'Time Spans'},
      {table: source_table, name: 'Sources'},
      {table: evidence_table, name: 'Evidence Data'},
      {table: alt_name_table, name: 'Alternative Names'},
      {table: external_uri_table, name: 'External Place URIs'},
    ]
  );

  const map_pane = new MapPane(dispatch, d3.select<HTMLDivElement, any>('.map'));

  // EVENTS
  dispatch.on('place-selected.load-evidence', data => evidence_table.loadData(data.id, data.name));
  dispatch.on('place-selected.load-alt-names', data => alt_name_table.loadData(data.id));
  dispatch.on('place-selected.load-external-uris', data => external_uri_table.loadData(data.id));

  dispatch.on('evidence-selected.load-time', ({id, time_group_id, place_id}) => time_table.loadData(id, time_group_id, place_id));
  dispatch.on('evidence-selected.load-source', ({id, place_id}) => source_table.loadData(id, place_id));

  dispatch.on('place-selected.evidence-title-change place-updated.evidence-title-change',
    place => {
      evidence_table.onPlaceSelected(place);
      alt_name_table.onPlaceSelected(place);
      external_uri_table.onPlaceSelected(place);
    });
  dispatch.on('evidence-selected.timespan-source-title-change',
    evidence => {
      source_table.onEvidenceSelected(evidence);
      time_table.onEvidenceSelected(evidence);
    });
  dispatch.on('evidence-deleted.timespan-source-update',
    evidence_id => {
      source_table.onEvidenceDeleted(evidence_id);
      time_table.onEvidenceDeleted(evidence_id);
    });
  dispatch.on('place-deleted.altname-evidence-timespan-source-update',
    place_id => {
      alt_name_table.onPlaceDeleted(place_id);
      evidence_table.onPlaceDeleted(place_id);
      source_table.onPlaceDeleted(place_id);
      time_table.onPlaceDeleted(place_id);
    });

  dispatch.on('map-updated', place_table.onMapChanged.bind(place_table));
  dispatch.on('map-selected', place_table.onMapSelected.bind(place_table));
  dispatch.on('evidence-child-changed.update-evidence', evidence_table.onChildDataChanged.bind(evidence_table));


  const loadEvidence = async (place_id: number, evidence_id: number) => {
    await cache.ready;
    await Promise.all([
      place_table.loadData(place_id).then(async () => await evidence_table.select(evidence_id)),
    ]);

    document.querySelector('div#evidence').scrollIntoView();
  }

  // if place_id URL arg, set that place as chosen
  const fragment = window.location.hash;

  try {
    const obj = fragment ? JSON.parse(atob(decodeURIComponent(fragment.slice(1)))) : {};

    const place_id = obj.place_id || null;
    const evidence_id = obj.evidence_id || null;

    removeHash();

    if (place_id !== null && evidence_id !== null) {
      loadEvidence(place_id, evidence_id);
    } else {
      cache.ready.then(_ => {
        place_table.loadData(place_id);
      });
    }
  } catch (err) {
    console.error(err);
  }

  window.onbeforeunload = function (e: BeforeUnloadEvent) {
    if ([
      place_table,
      alt_name_table,
      evidence_table,
      source_table,
      time_table,
      external_uri_table,
      //external_person_uri_table
      ].some(d => d.hasUnsavedChanges())) {
      // Cancel the event
      e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
      // Chrome requires returnValue to be set
      e.returnValue = '';
    } else {
      delete e['returnValue'];
    }
  };
}
