import { Tabulator } from 'tabulator-tables';
import type { ColumnDefinition, Options, CellComponent, RowComponent, ColumnComponent, FormatterParams, EmptyCallback, EditorParams } from 'tabulator-tables';
import * as _ from 'lodash';
import * as d3 from 'd3';

import Table from './table';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';
import confidence_dropdown_values from './confidence-dropdown-values';

export default class EvidenceTable extends Table {
  private place_id: number;
  private place_name: string;

  private confidence_values: string[];
  private confidence_values_with_null: {value: string|null, label: string}[];
  private religions: {value:number, label:string}[];
  private tags: {value:number, label:string}[];
  private tag_comments: Map<number, string>;
  private persons: {value: number, label: string}[];
  private annotator_evidences: Map<number, number>;

  protected ignore_column_changes(): string[] {
    return ['sources', 'time_spans'];
  }

  protected getTableOptions(): Options {
    return {
      initialSort: [
        {column:'id', dir:'asc'}
      ],
      height: '300px'
    };
  }

  protected virtualColumns(): string[] {
    return ['@@annotatorLink'];
  }

  private religionSort(valA: number, valB: number, _ra, _rb, _c, _dir, _params): number {
    const indexA = this.religions.findIndex(d => d.value === valA);
    const indexB = this.religions.findIndex(d => d.value === valB);
    return indexA - indexB;
  }

  protected async prepare(): Promise<void> {
    this.confidence_values = await this.cache.confidence;
    this.confidence_values_with_null = await confidence_dropdown_values(this.cache);
    this.religions = await this.cache.religions.then(rel => {
      return rel.map(({id, name}) => {
        return {value: id, label: name};
      });
    });

    await this.cache.tags.then(tags => {
      this.tags = tags.map(({id,tagname}) => {
        return {value:id,label:tagname};
      });

      this.tag_comments = new Map<number, string>(tags.map(({id,comment}) => [id,comment]));
    });

    this.persons = await this.cache.persons.then(per => per.map(({id, name, time_range}) => {
      const label = (time_range === '') ? name : `${name} (${time_range})`;
      return { value: id, label };
    }));
    this.persons.unshift({ label: '<i>no value</i>', value: null });

    this.annotator_evidences = await this.cache.annotator_evidences;

    // events
    this.table.on('cellClick', (evt, cell) => {
      if (cell.getField() === '@@annotatorLink') this.onAnnotatorLinkClick(evt, cell);
    });
  }

  protected getMainColumns(): ColumnDefinition[] {
    return [
        {
          title: 'Confidence of interpretation',
          field: 'interpretation_confidence',
          headerSort: true,
          headerFilter: 'list',
          headerFilterParams: {
            values: this.confidence_values
          },
          editor: 'list',
          editorParams: {
            values: this.confidence_values_with_null
          },
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Comment',
          field: 'evidence_comment',
          editor: 'textarea',
          formatter: 'textarea',
          widthGrow: 3,
          headerSort: false,
          headerFilter: 'input',
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Tags',
          field: 'tag_ids',
          formatter: (c, _, __) => {
            const v = c.getValue();
            if (v === null) return;

            return this.tags
              .filter(d => v.includes(d.value))
              .sort((a,b) => a.value - b.value)
              .map(d => d.label)
              .join(', ');
          },
          editor: 'list',
          editorParams: {
            values: this.tags,
            multiselect: true,
            // TODO: correct?
            itemFormatter: (label, value, item, element) => {
              const comment = this.tag_comments.get(parseInt(value));
              let s = `<b>${label}</b>`;
              if (comment) s += ` <i style="font-size: smaller;">(${comment})</i>`;
              return s;
            },
          },
          headerFilter: 'list',
          headerFilterParams: {
            values: this.tags,
          },
          headerFilterFunc: (filter: number, vals: number[]) => {
            return vals.includes(filter);
          },
          headerSort: false,
        },
        {
          title: 'Place attribution confidence',
          field: 'place_attribution_confidence',
          headerSort: true,
          headerFilter: 'list',
          headerFilterParams: {
            values: this.confidence_values
          },
          editor: 'list',
          editorParams: {
            values: this.confidence_values_with_null
          },
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Place instance comment',
          field: 'place_instance_comment',
          editor: 'textarea',
          formatter: 'textarea',
          headerSort: false,
          headerFilter: 'input',
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Religion',
          field: 'religion_id',
          headerFilter: 'list',
          headerFilterParams: {
            values: this.religions
          },
          headerFilterFunc: '=',
          editor: 'list',
          editorParams: {
            values: this.religions
          },
          formatter: 'lookup',
          formatterParams: this.religions.reduce((a, b) => { a[b.value] = b.label; return a; }, {"null": ""}),
          accessorDownload: Table.lookupAccessor,
          accessorDownloadParams: {
            values: this.religions,
          },
          headerSort: true,
          sorter: this.religionSort.bind(this),
        },
        {
          title: 'Religion confidence',
          field: 'religion_confidence',
          headerSort: true,
          headerFilter: 'list',
          headerFilterParams: {
            values: this.confidence_values
          },
          editor: 'list',
          editorParams: {
            values: this.confidence_values_with_null
          },
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Religion comment',
          field: 'religion_instance_comment',
          editor: 'textarea',
          formatter: 'textarea',
          headerSort: false,
          headerFilter: 'input',
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Person',
          field: 'person_id',
          headerFilter: 'list',
          headerFilterParams: {
            values: this.persons
          },
          headerFilterFunc: '=',
          editor: 'list',
          editorParams: {
            values: this.persons
          },
          formatter: 'lookup',
          formatterParams: this.persons.reduce((a, b) => { a[b.value] = b.label; return a; }, {"null": ""}),
          accessorDownload: Table.lookupAccessor,
          accessorDownloadParams: {
            values: this.persons,
          },
          headerSort: false,
        },
        {
          title: 'Person confidence',
          field: 'person_confidence',
          headerSort: true,
          headerFilter: 'list',
          headerFilterParams: {
            values: this.confidence_values
          },
          editor: 'list',
          editorParams: {
            values: this.confidence_values_with_null
          },
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Person comment',
          field: 'person_instance_comment',
          editor: 'textarea',
          formatter: 'textarea',
          headerSort: false,
          headerFilter: 'input',
          accessorDownload: Table.nullOrStringDownloadFormatter,
        },
        {
          title: 'Time spans',
          field: 'time_spans',
          formatter: EvidenceTable.formatTimespans,
          accessorDownload: function(value, data, type, params, column) {
            const tss = value.map(({start, end}) => {
              const starts = start===null ? '?' : `${start}`;
              if (start === end) return starts;
              const ends = end===null ? '?' : `${end}`;

              return `${starts} - ${ends}`;
            });
            return tss.join(', ');
          },
          headerSort: false,
        },
        {
          title: 'Sources',
          field: 'sources',
          formatter: function(c, _, __) { return c.getValue().length; },
          accessorDownload: function(c, _, __, ___, ____) {
            return c.map(({source_name, source_page}) => {
              return `${source_name} ${source_page}`;
            }).join('\n');
          },
          headerSort: false,
          width: 50
        },
        {
          title: 'Visible',
          field: 'visible',
          editor: 'tickCross',
          formatter: 'tickCross',
          vertAlign: 'top',
          hozAlign: 'center',
          headerSort: false,
          headerFilter: true,
          width: 40,
        },
        {
          formatter: EvidenceTable.linkIcon,
          formatterParams: {
            annotator_evidences: this.annotator_evidences as any,
          },
          title: undefined,
          field: '@@annotatorLink',
          width: 30,
          hozAlign: 'center',
          headerSort: false,
          resizable: false,
          download: false,
          tooltip: 'View evidence in annotator',
          frozen: true
        },
    ];
  }

  private static formatTimespans(
    cell: CellComponent,
    formatterParams: FormatterParams,
    onRendered: EmptyCallback
  ): string {
    const ts = cell.getValue();

    const tss = ts.map(({start, end}) => {
      const starts = start===null ? '?' : `${start}`;
      if (start === end) return starts;
      const ends = end===null ? '?' : `${end}`;

      return `${starts}&ndash;${ends}`;
    });
    return tss.join(', ');
  }

  onPlaceSelected({name, id}: {name: string, id: number}): void {
    this.updateTitleDetail(`for <em>${name}</em> (${id})`);
  }

  clearTable() {
    this.place_id = null;
    this.place_name = null;
    this.updateTitleDetail('');
    this.table.clearData();
  }

  private ready: Promise<void> = Promise.resolve();
  loadData(place_id: number, place_name: string) {
    this.dispatch.call('evidence-selected', null, {id:null, time_group_id:null,place_id:null}); // clear children

    this.place_id = place_id;
    this.place_name = place_name;
    if (place_id === null || place_id === undefined) return this.clearTable();

    this.ready = this.loadDataOrFail(
      `../rest/place/${place_id}/evidence-ids`,
      `Could not load evidence data for place ${place_name} (${place_id})`,
    ).then((ids: number[]) => {
      const promises = ids.map(id => d3.json(`../rest/evidence/${id}`));
      return Promise.all(promises);
    }).then((data: any) => {
      this.setData(data);
    }).catch(() => this.setData([]));
  }

  protected newRecord() {
    return {
      interpretation_confidence: null,
      evidence_comment: null,
      place_attribution_confidence: null,
      place_instance_comment: null,
      religion_id: null,
      religion_confidence: null,
      religion_instance_comment: null,
      time_spans: [],
      sources: [],
      visible: true,
      place_name: this.place_name,
      place_id: this.place_id,
      tag_ids: [],
      person_id: null,
      person_confidence: null,
      person_instance_comment: null,
    };
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Really delete evidence with ID ${cell.getRow().getIndex()}?`,
      `Do you really want to delete the evidence with ID ${cell.getRow().getIndex()} for the place <b>${this.place_id},</b> and all its dependent data? This action cannot be reversed.`,
      `Yes, delete evidence ${cell.getRow().getIndex()}`,
      `../rest/evidence/${cell.getRow().getIndex()}?cascade=1`,
      `Could not delete evidence ${cell.getRow().getIndex()}`);
  }

  protected doCreate(cell: CellComponent, data: any): Promise<number> {
    if (!data.religion_id) {
      return accept_dialog('Religion must be set.', '', {})
        .then(() => Promise.reject(cell.getRow().getIndex()));
    }

    const {evidence, place_instance, religion_instance, evidence_tag, person_instance} = this.dataPerTable(data);

    place_instance.place_id = this.place_id;

    // create instances
    const pli = this.createData('../rest/place-instance/0', place_instance, 'Could not create new place instance');
    const ri = this.createData('../rest/religion-instance/0', religion_instance, 'Could not create new religion instance');
    const tg = this.createData('../rest/time-group/0', {}, 'Could not create new time group');

    const person_instance_data_present = ['person_id', 'confidence', 'comment'].some(key => (person_instance[key] !== null && person_instance[key] !== undefined));
    const pi = (person_instance_data_present)
        ? this.createData('../rest/person-instance/0', person_instance, 'Could not create new person instance')
        : Promise.resolve({person_instance_id: null});

    return Promise.all([pli, ri, tg, pi])
      .then(arr => {
        let obj = {};
        arr.forEach(a => obj = { ...obj, ...a });
        return obj;
      })
      .then(({time_group_id, place_instance_id, religion_instance_id, person_instance_id}: {time_group_id: string, place_instance_id: string, religion_instance_id: string, person_instance_id: number | null}) => {
        evidence.time_group_id = time_group_id;
        evidence.place_instance_id = place_instance_id;
        evidence.religion_instance_id = religion_instance_id;
        evidence.person_instance_id = person_instance_id;

        cell.getRow().getData().time_group_id = time_group_id;
        cell.getRow().getData().place_instance_id = place_instance_id;
        cell.getRow().getData().religion_instance_id = religion_instance_id;
        cell.getRow().getData().person_instance_id = person_instance_id;
        cell.getRow().getData().tag_ids = evidence_tag;

        return this.createData('../rest/evidence/0', evidence, 'Could not create new evidence');
      })
      .then(async (datum: any) => {
        if (evidence_tag.length > 0) {
          // create evidence_tag entries
          await fetch(`../rest/evidence/${datum.evidence_id}/tags`, {
            method: 'PUT',
            body: JSON.stringify(evidence_tag),
            headers: {
              'Content-Type': 'application/json; encoding=utf-8',
              'Accept': 'text/plain,application/json'
            }
          }).catch(err => {
            return accept_dialog('Could not set tags.', err, {})
              .then(() => Promise.reject(err));
          });
        }
        return datum.evidence_id;
      });
  }

  protected canCreateNew(): boolean {
    return !!this.place_id;
  }

  protected checkColumnChange<T>(column_name: string, old_value: T, new_value: T): boolean | null {
    if (column_name === 'tag_ids') {
      const a = old_value as unknown as number[];
      const b = new_value as unknown as number[];
      return a.length !== b.length
        || a.some(d => !b.includes(d))
        || b.some(d => !a.includes(d));
    }

    return null;
  }

  private dataPerTable(data): any {
    const pdata = _.cloneDeep(data);

    // time_spans and sources not part of POSTable data
    delete pdata['time_spans'];
    delete pdata['sources'];

    const evidence = {};
    ['evidence_comment', 'interpretation_confidence', 'visible'].forEach(key => {
      if (pdata.hasOwnProperty(key)) evidence[key] = pdata[key];
    });
    if (pdata.hasOwnProperty('evidence_comment')) {
      evidence['comment'] = evidence['evidence_comment'];
      delete evidence['evidence_comment'];
    }

    const place_instance = {};
    const place_instance_mapping = {
      'place_attribution_confidence': 'confidence',
      'place_instance_comment': 'comment'
    };
    Object.entries(place_instance_mapping).forEach(([key, val]) => {
      if (pdata.hasOwnProperty(key)) place_instance[val] = pdata[key];
    });

    const religion_instance = {};
    const religion_instance_mapping = {
      'religion_id': 'religion_id',
      'religion_confidence': 'confidence',
      'religion_instance_comment': 'comment'
    };
    Object.entries(religion_instance_mapping).forEach(([key, val]) => {
      if (pdata.hasOwnProperty(key)) religion_instance[val] = pdata[key];
    });

    const evidence_tag = data.tag_ids;

    const person_instance = {};
    const person_instance_mapping = {
      'person_id': 'person_id',
      'person_confidence': 'confidence',
      'person_instance_comment': 'comment'
    };
    Object.entries(person_instance_mapping).forEach(([key, val]) => {
      if (pdata.hasOwnProperty(key)) person_instance[val] = pdata[key];
    });

    return {evidence, place_instance, religion_instance, evidence_tag, person_instance};
  }

  protected async doSave(cell: CellComponent, data: any): Promise<boolean> {
    const {evidence, place_instance, religion_instance, evidence_tag, person_instance} = this.dataPerTable(data);

    let pre: () => Promise<any> = () => Promise.resolve(evidence);
    const main = [];
    let post: () => Promise<boolean> = () => Promise.resolve(true);

    const ref = this;
    const piid = cell.getRow().getData().person_instance_id;
    if (piid !== null && person_instance.person_id === null) {
      evidence.person_instance_id = null;
      post = async function() {
        const response = await fetch(`../rest/person-instance/${piid}`,
          {
            method: 'DELETE',
          });

        if (response.ok) {
          // delete old data
          const d = cell.getRow().getData();
          d.person_instance_id = null;
          d.person_id = null;
          d.person_confidence = null;
          d.person_instance_comment = null;
          d.person_name = null;
          d.person_type = null;
          ref.table.redraw();

          return true;
        }

        await accept_dialog('Could not delete person instance',
          await response.text(),
          {
            title: '<i class="fa fa-close fa--pad-right"></i>OK'
          });
        return false;
      };
    } else if (piid === null && !_.isEmpty(person_instance)) {
      pre = async function() {
        // person data, but no instance yet: create person instance and set instance id
        const pi = await ref.createData('../rest/person-instance/0', person_instance, 'Could not create new person instance');
        evidence.person_instance_id = pi.person_instance_id;
        cell.getRow().getData().person_instance_id = pi.person_instance_id;

        return evidence;
      };
    } else if (piid !== null && !_.isEmpty(person_instance)) {
      main.push(async function() {
        // person data and instance: patch instance
        await PATCH(person_instance, `../rest/person-instance/${piid}`, 'person instance');
        return true;
      });
    } else {
    }

    function PATCH(payload, url, name, opts={}): Promise<boolean> {
      if (_.isEmpty(payload)) return Promise.resolve(true);

      return ref.saveData(url,
        payload,
        `Could not update ${name} for evidence ${cell.getRow().getIndex()}`,
        opts);
    };
    function PUT(payload, url, name): Promise<boolean> {
      return ref.saveData(url,
        payload,
        `Could not update ${name} for evidence ${cell.getRow().getIndex()}`,
        {
          method: 'PUT',
        });
    };

    // only PATCH tag IDs if they actually changed
    const tids_old = this.initialValues.get(cell.getRow().getIndex()).tag_ids || [];
    const tids_new = cell.getRow().getData().tag_ids || [];

    if (tids_old.length !== tids_new.length
        || tids_old.some(d => !tids_new.includes(d))
        || tids_new.some(d => !tids_old.includes(d))) {
      main.push(async () => await PUT(evidence_tag, `../rest/evidence/${cell.getRow().getIndex()}/tags`, 'tags'));
    }

    // do pre
    const evidence2 = await pre();

    // do main
    const success = await Promise.all([
      PATCH(evidence2, `../rest/evidence/${cell.getRow().getIndex()}`, 'evidence'),
      PATCH(place_instance, `../rest/place-instance/${cell.getRow().getData().place_instance_id}`, 'place instance'),
      PATCH(religion_instance, `../rest/religion-instance/${cell.getRow().getData().religion_instance_id}`, 'religion instance'),
      ...main.map(d => d()),
    ])
    .then((success: boolean[]) => _.every(success))
    .catch(err => {
      return false;
    });

    if (success) return await post();
    else return false;
  }

  protected canChangeRow(_): boolean {
    return false;
  }

  onChildDataChanged(evidence_id: number): void {
    const rows = this.table.getSelectedRows();
    if (rows.length !== 1 || rows[0].getIndex() !== evidence_id) return;

    const row = rows[0];
    if (this.hasChanges(row)) {
      console.error('Cannot reload row, unsaved changes.');
      return;
    }

    d3.json(`../rest/evidence/${evidence_id}`)
      .then(async (json: {}) => {
        const tags = await d3.json(`../rest/evidence/${evidence_id}/tags`);
        json['tag_ids'] = tags;

        this.initialValues.set(evidence_id, _.cloneDeep(json));
        this.table.updateRow(evidence_id, _.cloneDeep(json));
      })
      .catch(err => {
        console.error('Could not reload row:', err);
      });
  }

  onPlaceDeleted(id: number): void {
    if (this.place_id === id) {
      this.clearTable();
    }
  }

  async select(evidence_id: number) {
    await this.ready;
    const row = this.table.getRow(evidence_id);
    this.onRowClick(row);
    this.table.scrollToRow(row);
  }

  private onAnnotatorLinkClick(e: Event, cell: CellComponent) {
    const id = cell.getRow().getIndex();
    if (id === null || !this.annotator_evidences.has(id)) return;

    const url = `../annotator/view-evidence/${id}`;
    window.open(url, '_blank');
  }

  private static linkIcon(cell, formatterParams) {
    const id = cell.getRow().getIndex();
    if (id === null || !formatterParams.annotator_evidences.has(id)) return '';

    return '<i class="fa fa-lg fa-external-link external-link-button"></i>';
  };
}

