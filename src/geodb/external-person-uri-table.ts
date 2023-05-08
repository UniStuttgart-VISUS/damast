import { Tabulator } from 'tabulator-tables';
import type { ColumnDefinition, Options, CellComponent, RowComponent, ColumnComponent } from 'tabulator-tables';

import Table from './table';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';
import {uri_formatter, uri_fragment_editor} from './external-uri-table';

export default class ExternalPersonUriTable extends Table {
  private person_id: number;
  private uri_namespaces: {value:number, label:string}[];
  private formatting_map: Map<number, [string, string]> = new Map<number, [string, string]>();

  protected async prepare(): Promise<void> {
    const ns = await this.cache.uri_namespaces;
    this.uri_namespaces = ns.map(({id, comment}: {id: number, comment: string}) => {
      return {value: id, label: comment};
    });
    ns.forEach(({id, uri_pattern, short_name}: {id: number, uri_pattern: string, short_name: string}) => {
      this.formatting_map.set(id, [uri_pattern, short_name]);
    });
  }

  protected id_column(): string {
    return 'id';
  }

  protected virtualColumns(): string[] {
    return ['@@externalLink'];
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
          title: 'URI Namespace',
          field: 'uri_namespace_id',
          headerSort: true,
          headerFilter: 'list',
          headerFilterParams: {
            values: this.uri_namespaces,
          },
          headerFilterFunc: '=',
          editor: 'list',
          editorParams: {
            values: this.uri_namespaces,
          },
          formatter: 'lookup',
          formatterParams: this.uri_namespaces.reduce((a, b) => { a[b.value] = b.label; return a; }, {}),
          cellEdited: this.cellEdited.bind(this),
          accessorDownload: Table.lookupAccessor,
          accessorDownloadParams: {
            values: this.uri_namespaces,
          }
        },
        {
          title: 'URI Fragment',
          field: 'uri_fragment',
          headerSort: true,
          headerFilter: 'input',
          cellEdited: this.cellEdited.bind(this),
          widthGrow: 3,
          formatter: uri_formatter,
          formatterParams: {
            formatting_map: this.formatting_map as any,
          },
          editor: uri_fragment_editor,
          editorParams: () => this.formatting_map,
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
          formatter: ExternalPersonUriTable.linkIcon,
          formatterParams: {
            formatting_map: this.formatting_map as any,
          },
          cellClick: this.onExternalLinkClick.bind(this),
          title: undefined,
          field: '@@externalLink',
          width: 30,
          hozAlign: 'center',
          headerSort: false,
          resizable: false,
          download: false,
          tooltip: 'Visit external link',
          frozen: true
        },
    ];
  }

  protected cellEdited(cell: CellComponent) {
    super.cellEdited(cell);
    cell.getRow().reformat();
  }

  loadData(person_id: number) {
    this.person_id = person_id;

    this.loadDataOrFail(
      `../rest/uri/external-person-uri-list`,
      `Could not load external person URIs`
    ).then((data: any) => {
      const d = data.filter(e => e.person_id === this.person_id);
      this.setData(d);
    }).catch(() => this.setData([]));
  }

  protected canCreateNew(): boolean {
    return true;
  }

  protected newRecord() {
    return {
      person_id: this.person_id,
      uri_namespace_id: null,
      uri_fragment: null,
      comment: null,
    };
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Delete external person URI "TODO ${cell.getRow().getData().id}"?`,
      `Do you really want to delete the external person URI with ID ${cell.getRow().getIndex()}? This action cannot be reversed.`,
      `Yes, delete ${cell.getRow().getIndex()}`,
      `../rest/uri/external-person-uri/${cell.getRow().getIndex()}`,
      `Could not delete external person URI with ID ${cell.getRow().getIndex()}`);
  }

  protected doCreate(cell: CellComponent, data: any): Promise<number> {
    return this.createData(
      `../rest/uri/external-person-uri/0`,
      data,
      'Could not create new external person URI'
    ).then(({external_person_uri_id}: {external_person_uri_id: number}) => {
        return external_person_uri_id;
      });
  }

  protected doSave(cell: CellComponent, data: any): Promise<boolean> {
    return this.saveData(
      `../rest/uri/external-person-uri/${cell.getRow().getIndex()}`,
      data,
      `Could not update external person URI ${cell.getRow().getIndex()}`
    );
  }

  protected canChangeRow(_): boolean {
    return true; // no dependents
  }

  private onExternalLinkClick(e: Event, cell: CellComponent) {
    const id = cell.getRow().getData().uri_namespace_id;
    const uri_fragment = cell.getRow().getData().uri_fragment;
    if (id === null || !this.formatting_map.has(id) || !uri_fragment) return;

    const [fmt, _] = this.formatting_map.get(id);
    const url = fmt.replace(/%s/, uri_fragment);

    window.open(url, '_blank');
  }

  private static linkIcon(cell, formatterParams) {
    const id = cell.getRow().getData().uri_namespace_id;
    const uri_fragment = cell.getRow().getData().uri_fragment;
    if (id === null || !formatterParams.formatting_map.has(id) || !uri_fragment) return '';

    return '<i class="fa fa-lg fa-external-link external-link-button"></i>';
  };

  clearTable() {
    return this.table.clearData();
  }
}

