import { Tabulator } from 'tabulator-tables';
import type { ColumnDefinition, Options, CellComponent, RowComponent, ColumnComponent } from 'tabulator-tables';
import * as _ from 'lodash';
import * as d3 from 'd3';

import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';
import Table from './table';
import confidence_dropdown_values from './confidence-dropdown-values';

export default class SourceTable extends Table {
  private evidence_id: number;
  private place_id: number;

  private confidence_values: string[];
  private confidence_values_with_null: {value: string|null, label: string}[];
  private sources: {value:number,label:string}[];
  private source_confidence = new Map<number, string>();

  protected async prepare(): Promise<void> {
    this.confidence_values = await this.cache.confidence;
    this.confidence_values_with_null = await confidence_dropdown_values(this.cache);
    this.sources = await this.cache.sources
      .then(xs => xs.map(({id,name,short}) => {
        return {
          value: id,
          label: (name === short) ? name : `${short} = ${name}`
        };
      }));
    this.cache.sources
      .then(xs => xs.forEach(({id,default_confidence}) => {
        this.source_confidence.set(id, default_confidence);
      }));

    const events = ['updated', 'added', 'deleted']
      .map(d => `${this.dispatch_namespace}-${d}.source-notify-parent`)
      .join(' ');
    this.dispatch.on(events, () => {
      this.dispatch.call(`evidence-child-changed`, null, this.evidence_id);
    });
  }

  protected getTableOptions(): Options {
    return {
      initialSort: [
        {column:'source_id', dir:'asc'}
      ],
      height: '300px'
    };
  }

  protected getMainColumns(): ColumnDefinition[] {
    return [
        {
          title: 'Source',
          field: 'source_id',
          headerSort: true,
          headerFilter: 'select',
          headerFilterParams: {
            values: this.sources
          },
          headerFilterFunc: '=',
          editor: 'select',
          editorParams: {
            values: this.sources
          },
          widthGrow: 3,
          formatter: 'lookup',
          formatterParams: this.sources.reduce((a, b) => { a[b.value] = b.label; return a; }, {"null": ""}),
          accessorDownload: Table.lookupAccessor,
          accessorDownloadParams: {
            values: this.sources
          },
          sorter: 'number',
          cellEdited: this.onSourceFieldChanged.bind(this)
        },
        {
          title: 'Page',
          field: 'source_page',
          editor: 'textarea',
          formatter: 'textarea',
          widthGrow: 1,
          headerSort: true,
          headerFilter: 'input',
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
          title: 'Source confidence',
          field: 'source_confidence',
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

  private onSourceFieldChanged(cell: CellComponent): void {
    if (cell.getRow().getData().newRow) {
      const val = cell.getValue();
      const conf = this.source_confidence.get(val);

      cell.getRow().getCell('source_confidence').setValue(conf);
    }

    this.cellEdited(cell);
  }

  protected canCreateNew(): boolean {
    return !!this.evidence_id;
  }

  protected newRecord() {
    return {
      evidence_id: this.evidence_id,
      source_id: null,
      source_page: null,
      comment: null,
      source_confidence: null
    };
  }

  clearTable() {
    this.evidence_id = null;
    this.place_id = null;
    this.updateTitleDetail('');
    return this.table.clearData();
  }

  loadData(evidence_id: number, place_id: number) {
    this.evidence_id = evidence_id;
    this.place_id = place_id;
    if (!evidence_id || !place_id) return this.clearTable();

    this.loadDataOrFail(
      `../rest/evidence/${evidence_id}/source-instances`,
      `Could not load source instances for evidence ${evidence_id}`
    )
      .then((data: any) => {
        this.setData(data);
      })
      .catch(() => this.setData([]));
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Really delete source instance ${cell.getRow().getIndex()}?`,
      `Do you really want to delete the source instance with ID ${cell.getRow().getIndex()}? This action cannot be reversed.`,
      `Yes, delete ${cell.getRow().getIndex()}`,
      `../rest/source-instance/${cell.getRow().getIndex()}`,
      `Could not delete source instance ${cell.getRow().getIndex()}`
    );
  }

  protected doCreate(cell: CellComponent, data: any): Promise<number> {
    return this.createData(
      `../rest/source-instance/0`,
      data,
      `Could not create source instance`
    ).then(({source_instance_id}: {source_instance_id: number}) => {
      return source_instance_id;
    });
  }

  protected doSave(cell: CellComponent, data: any): Promise<boolean> {
    return this.saveData(
      `../rest/source-instance/${cell.getRow().getIndex()}`,
      data,
      `Could not update source instance ${cell.getRow().getIndex()}`
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
      this.updateTitleDetail('');
    }
  }

  onPlaceDeleted(id: number): void {
    if (this.place_id === id) {
      this.clearTable();
    }
  }
};
