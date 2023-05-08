import { Tabulator } from 'tabulator-tables';
import type { ColumnDefinition, Options, CellComponent, RowComponent, ColumnComponent } from 'tabulator-tables';

import Table from './table';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';

export default class PersonTable extends Table {
  private person_types: {value: number, label: string}[];

  protected async prepare(): Promise<void> {
    this.person_types = (await this.cache.person_types).map(({id, type}) => { return { value: id, label: type }; });
  }

  protected id_column(): string {
    return 'id';
  }

  protected virtualColumns(): string[] {
    return [];
  }

  protected getTableOptions(): Options {
    return {
      initialSort: [
        {column:'id', dir:'asc'},
        {column:'name', dir:'asc'},
      ],
      height: '300px'
    };
  }

  protected getMainColumns(): ColumnDefinition[] {
    return [
        {
          title: 'Name',
          field: 'name',
          headerSort: true,
          editor: 'input',
        },
        {
          title: 'Time range',
          field: 'time_range',
          headerSort: true,
          editor: 'input',
        },
        {
          title: 'Comment',
          field: 'comment',
          headerSort: true,
          headerFilter: 'input',
          editor: 'input',
          cellEdited: this.cellEdited.bind(this),
          widthGrow: 2,
        },
        {
          title: 'Person type',
          field: 'person_type',
          headerSort: true,
          headerFilter: 'select',
          headerFilterParams: {
            values: this.person_types,
          },
          headerFilterFunc: '=',
          editor: 'select',
          editorParams: {
            values: this.person_types,
          },
          formatter: 'lookup',
          formatterParams: this.person_types.reduce((a, b) => { a[b.value] = b.label; return a; }, {}),
          cellEdited: this.cellEdited.bind(this),
          accessorDownload: Table.lookupAccessor,
          accessorDownloadParams: {
            values: this.person_types,
          }
        },
    ];
  }

  protected cellEdited(cell: CellComponent) {
    super.cellEdited(cell);
    cell.getRow().reformat();
  }

  loadData() {
    this.loadDataOrFail(
      `../rest/person-list`,
      `Could not load persons`
    ).then((data: any) => {
      this.setData(data);
    }).catch(() => this.setData([]));
  }

  protected canCreateNew(): boolean {
    return true;
  }

  protected newRecord() {
    return {
      name: null,
      time_range: '',
      comment: null,
      person_type: null,
    };
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Delete person "${cell.getRow().getData().name}"?`,
      `Do you really want to delete the person with ID ${cell.getRow().getIndex()}? This action cannot be reversed.`,
      `Yes, delete ${cell.getRow().getIndex()}`,
      `../rest/person/${cell.getRow().getIndex()}`,
      `Could not delete person with ID ${cell.getRow().getIndex()}`);
  }

  protected doCreate(cell: CellComponent, data: any): Promise<number> {
    return this.createData(
      `../rest/person/0`,
      data,
      'Could not create new person'
    ).then(({person_id}: {person_id: number}) => {
        return person_id;
      });
  }

  protected doSave(cell: CellComponent, data: any): Promise<boolean> {
    return this.saveData(
      `../rest/person/${cell.getRow().getIndex()}`,
      data,
      `Could not update person ${cell.getRow().getIndex()}`
    );
  }

  protected canChangeRow(_): boolean {
    return true; // no dependents
  }

  clearTable() {
    return this.table.clearData();
  }
}

