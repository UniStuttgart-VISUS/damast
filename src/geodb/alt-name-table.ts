import Tabulator from 'tabulator-tables';
import * as _ from 'lodash';
import * as d3 from 'd3';

import Table from './table';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';

export default class AlternativeNameTable extends Table {
  private place_id: number;

  private languages: {value:number, label:string}[];

  protected async prepare(): Promise<void> {
    const l = await this.cache.languages;
    this.languages = l.map(({id, name}: {id:number, name: string}) => {
      return {value: id, label: name};
    });
  }

  protected id_column(): string {
    return 'id';
  }

  protected getTableOptions(): Tabulator.Options {
    return {
      initialSort: [
        {column:'id', dir:'asc'},
        {column:'name', dir:'asc'},
      ],
      height: '300px'
    };
  }

  protected getMainColumns(): Tabulator.ColumnDefinition[] {
    return [
        {
          title: 'Name',
          field: 'name',
          headerSort: true,
          headerFilter: 'input',
          editor: 'input',
          cellEdited: this.cellEdited.bind(this)
        },
        {
          title: 'Transcription',
          field: 'transcription',
          headerSort: true,
          headerFilter: 'input',
          editor: 'input',
          cellEdited: this.cellEdited.bind(this)
        },
        {
          title: 'Simplified',
          field: 'simplified',
          headerSort: true,
          headerFilter: 'input',
          editor: 'input',
          cellEdited: this.cellEdited.bind(this)
        },
        {
          title: 'Language',
          field: 'language_id',
          headerSort: true,
          headerFilter: 'select',
          headerFilterParams: {
            values: this.languages
          },
          headerFilterFunc: '=',
          editor: 'select',
          editorParams: {
            values: this.languages
          },
          formatter: 'lookup',
          formatterParams: this.languages.reduce((a, b) => { a[b.value] = b.label; return a; }, {"null": ""}),
          cellEdited: this.cellEdited.bind(this),
          accessorDownload: Table.lookupAccessor,
          accessorDownloadParams: {
            values: this.languages
          }
        },
        {
          title: 'Comment',
          field: 'comment',
          headerSort: true,
          headerFilter: 'input',
          editor: 'input',
          cellEdited: this.cellEdited.bind(this)
        },
        {
          title: 'Main form',
          field: 'main_form',
          editor: 'tickCross',
          formatter: 'tickCross',
          vertAlign: 'top',
          hozAlign: 'center',
          headerSort: false,
          headerFilter: true,
          cellEdited: this.cellEdited.bind(this),
          width: 40
        }
    ];
  }

  loadData(place_id: number) {
    this.place_id = place_id;

    if (!place_id) return this.clearTable();

    this.loadDataOrFail(
      `../rest/place/${place_id}/alternative-name/all`,
      `Could not load alternative names for place ${place_id}`
    ).then((data: any) => {
      this.setData(data);
    }).catch(() => this.setData([]));
  }

  clearTable() {
    this.place_id = null;
    this.updateTitleDetail('');
    return this.table.clearData();
  }

  protected canCreateNew(): boolean {
    return !!this.place_id;
  }

  protected newRecord() {
    return {
      language_id: null,
      name: null,
      main_form: true
    };
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Delete alternative name "${cell.getRow().getData().name}"?`,
      `Do you really want to delete the alternative name with ID ${cell.getRow().getIndex()}? This action cannot be reversed.`,
      `Yes, delete ${cell.getRow().getIndex()}`,
      `../rest/place/${this.place_id}/alternative-name/${cell.getRow().getIndex()}`,
      `Could not delete alternative name with ID ${cell.getRow().getIndex()}`);
  }

  protected doCreate(cell: Tabulator.CellComponent, data: any): Promise<number> {
    return this.createData(
      `../rest/place/${this.place_id}/alternative-name/0`,
      data,
      'Could not create new alternative name'
    ).then(({name_var_id}: {name_var_id: number}) => {
        return name_var_id;
      });
  }

  protected doSave(cell: Tabulator.CellComponent, data: any): Promise<boolean> {
    return this.saveData(
      `../rest/place/${this.place_id}/alternative-name/${cell.getRow().getIndex()}`,
      data,
      `Could not update alternative name ${cell.getRow().getIndex()}`
    );
  }

  protected canChangeRow(_): boolean {
    return true; // no dependents
  }

  onPlaceSelected({name, id}: {name: string, id: number}): void {
    this.updateTitleDetail(`for <em>${name}</em> (${id})`);
  }

  onPlaceDeleted(id: number): void {
    if (this.place_id === id) {
      this.clearTable();
    }
  }
}

