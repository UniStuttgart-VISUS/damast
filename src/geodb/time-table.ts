import Tabulator from 'tabulator-tables';
import * as _ from 'lodash';
import * as d3 from 'd3';

import Table from './table';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';
import confidence_dropdown_values from './confidence-dropdown-values';

export default class TimeTable extends Table {
  private evidence_id: number;
  private time_group_id: number;
  private place_id: number;

  private confidence_values: string[];
  private confidence_values_with_null: {value: string|null, label: string}[];

  protected async prepare(): Promise<void> {
    this.confidence_values = await this.cache.confidence;
    this.confidence_values_with_null = await confidence_dropdown_values(this.cache);

    const events = ['updated', 'added', 'deleted']
      .map(d => `${this.dispatch_namespace}-${d}.source-notify-parent`)
      .join(' ');
    this.dispatch.on(events, () => {
      this.dispatch.call(`evidence-child-changed`, null, this.evidence_id);
    });
  }

  protected id_column(): string {
    return 'id';
  }

  protected getTableOptions(): Tabulator.Options {
    return {
      initialSort: [
        {column:'start', dir:'asc'},
        {column:'end', dir:'asc'},
      ],
      height: '300px'
    };
  }

  protected getMainColumns(): Tabulator.ColumnDefinition[] {
    return [
        {
          title: 'Start',
          field: 'start',
          headerSort: true,
          sorter: 'number',
          headerFilter: 'number',
          editor: 'number',
          editorParams: {
            min: -2000,
            max: 3000,
            step: 1
          },
          validator: [ { type: TimeTable.validateStart } ],
          accessorDownload: Table.nullOrStringDownloadFormatter,
          cellEdited: this.cellEdited.bind(this)
        },
        {
          title: 'End',
          field: 'end',
          headerSort: true,
          sorter: 'number',
          headerFilter: 'number',
          editor: 'number',
          editorParams: {
            min: -2000,
            max: 3000,
            step: 1
          },
          validator: [ { type: TimeTable.validateEnd } ],
          accessorDownload: Table.nullOrStringDownloadFormatter,
          cellEdited: this.cellEdited.bind(this)
        },
        {
          title: 'Comment',
          field: 'comment',
          editor: 'textarea',
          formatter: 'textarea',
          widthGrow: 3,
          headerSort: false,
          headerFilter: 'input',
          accessorDownload: Table.nullOrStringDownloadFormatter,
          cellEdited: this.cellEdited.bind(this)
        },
        {
          title: 'Confidence',
          field: 'confidence',
          headerSort: true,
          headerFilter: 'select',
          headerFilterParams: {
            values: this.confidence_values
          },
          editor: 'select',
          editorParams: {
            values: this.confidence_values_with_null
          },
          accessorDownload: Table.nullOrStringDownloadFormatter,
          cellEdited: this.cellEdited.bind(this)
        }
    ];
  }

  private static validateStart(
    cell: Tabulator.CellComponent,
    value: number,
    _
  ): boolean {
    const end = cell.getRow().getData().end;
    return value <= end || end === null || value === null;
  }

  private static validateEnd(
    cell: Tabulator.CellComponent,
    value: number,
    _
  ): boolean {
    const start = cell.getRow().getData().start;
    return value >= start || start === null || value === null;
  }

  loadData(evidence_id: number, time_group_id: number, place_id: number) {
    this.evidence_id = evidence_id;
    this.time_group_id = time_group_id;
    this.place_id = place_id;

    if (!evidence_id || !time_group_id || !this.place_id) return this.clearTable();

    this.loadDataOrFail(
      `../rest/time-group/${time_group_id}`,
      `Could not load time span data for evidence ${evidence_id}`
    ).then((data: any) => {
      this.setData(data.time_spans);
    }).catch(() => this.setData([]));
  }

  clearTable() {
    this.evidence_id = null;
    this.time_group_id = null;
    this.place_id = null;
    this.updateTitleDetail('');
    return this.table.clearData();
  }

  protected canCreateNew(): boolean {
    return !!this.evidence_id && !!this.time_group_id;
  }

  protected newRecord() {
    return {
      start: null,
      end: null,
      comment: null,
      confidence: null
    };
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Delete time span ${cell.getRow().getIndex()}?`,
      `Do you really want to delete the time span with ID ${cell.getRow().getIndex()}? This action cannot be reversed.`,
      `Yes, delete ${cell.getRow().getIndex()}`,
      `../rest/time-group/${this.time_group_id}/time-instance/${cell.getRow().getIndex()}`,
      `Could not delete time span ${cell.getRow().getIndex()}`);
  }

  protected doCreate(cell: Tabulator.CellComponent, data: any): Promise<number> {
    return this.createData(
      `../rest/time-group/${this.time_group_id}/time-instance/0`,
      data,
      'Could not create new time instance'
    ).then(({time_instance_id}: {time_instance_id: number}) => {
        return time_instance_id;
      });
  }

  protected doSave(cell: Tabulator.CellComponent, data: any): Promise<boolean> {
    // always send entire data
    const d = cell.getRow().getData();
    if ('start' in data && !('end' in data)) data.end = d.end;
    if ('end' in data && !('start' in data)) data.start = d.start;

    return this.saveData(
      `../rest/time-group/${this.time_group_id}/time-instance/${cell.getRow().getIndex()}`,
      data,
      `Could not update time span ${cell.getRow().getIndex()}`
    );
  }

  protected canChangeRow(_): boolean {
    return true; // no dependents
  }

  onEvidenceSelected(evidence): void {
    if (evidence.id !== null) this.updateTitleDetail(`for evidence ${evidence.id}, <em>${evidence.place_name}</em> (${evidence.place_id})`);
  }

  onEvidenceDeleted(evidence_id: number): void {
    if (evidence_id === this.evidence_id) {
      this.clearTable();
    }
  }

  onPlaceDeleted(id: number): void {
    if (this.place_id === id) {
      this.clearTable();
    }
  }
}

