import Tabulator from 'tabulator-tables';
import * as _ from 'lodash';
import * as d3 from 'd3';

import Table from './table';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';


export const uri_formatter = function(cell, formatterParams, onRendered) {
  const v = cell.getValue();
  if (v === null || v === undefined) return '';

  const uri_namespace_id = cell.getRow().getData().uri_namespace_id;
  const formatting_map = formatterParams.formatting_map as Map<number, [string, string]>;

  if (uri_namespace_id === null || !formatting_map.has(uri_namespace_id)) {
    return `?? ${v} ??`;
  }

  const [long_fmt, short_fmt] = formatting_map.get(uri_namespace_id);
  const long_str = long_fmt.replace(/%s/, `<span class="uri-fragment">${v}</span>`);
  const short_str = short_fmt.replace(/%s/, `<span class="uri-fragment">${v}</span>`);

  return `<span class="uri-representation">${long_str} <span class="short-uri">${short_str}</span></span>`;
};

export const uri_fragment_editor = function(cell, onRendered, success, cancel, editorParams) {
  const v = cell.getValue() || '';

  const uri_namespace_id = cell.getRow().getData().uri_namespace_id;
  const formatting_map = editorParams as Map<number, [string, string]>;

  let pre = '', post = '', pre2 = '', post2 = '';
  if (uri_namespace_id !== null && formatting_map.has(uri_namespace_id)) {
    const [long_fmt, short_fmt] = formatting_map.get(uri_namespace_id);
    const split = long_fmt.split(/%s/);
    pre = split[0];
    post = split[1];

    const split2 = short_fmt.split(/%s/);
    pre2 = split2[0];
    post2 = split2[1];
  }

  const editor = document.createElement('span');
  editor.style.padding = '3px';
  editor.style.width = '100%';
  editor.style.boxSizing = 'border-box';
  editor.classList.add('uri-representation');

  const pre_span = document.createElement('span');
  pre_span.innerText = pre;
  editor.appendChild(pre_span);

  const textfield = document.createElement('input');
  textfield.type = 'text';
  textfield.size = 20;
  textfield.value = v;
  textfield.classList.add('uri-fragment');
  editor.appendChild(textfield);

  const post_span = document.createElement('span');
  post_span.innerText = post;
  editor.appendChild(post_span);

  // short fragment
  const end = document.createElement('span');
  end.classList.add('short-uri');
  end.appendChild(document.createTextNode(pre2));
  const end_uri = document.createElement('span');
  end_uri.classList.add('uri-fragment');
  end_uri.innerText = v;
  end.appendChild(end_uri);
  end.appendChild(document.createTextNode(post2));
  editor.appendChild(end);

  const onInputChange = function() {
    end_uri.innerText = textfield.value;
  };

  onRendered(function() {
    textfield.focus();
  });

  function successFunc(){
    success(textfield.value);
  }

  textfield.addEventListener('change', successFunc);
  textfield.addEventListener('blur', cancel);
  textfield.addEventListener('input', onInputChange);

  return editor;
}


export class ExternalPlaceUriTable extends Table {
  private place_id: number;

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
          title: 'URI Namespace',
          field: 'uri_namespace_id',
          headerSort: true,
          headerFilter: 'select',
          headerFilterParams: {
            values: this.uri_namespaces,
          },
          headerFilterFunc: '=',
          editor: 'select',
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
          // TODO: formatter
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
          formatter: ExternalPlaceUriTable.linkIcon,
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

  protected cellEdited(cell: Tabulator.CellComponent) {
    super.cellEdited(cell);
    cell.getRow().reformat();
  }

  loadData(place_id: number) {
    this.place_id = place_id;

    if (!place_id) return this.clearTable();

    this.loadDataOrFail(
      `../rest/place/${place_id}/external-uri-list`,
      `Could not load external URIs for place ${place_id}`
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
      place_id: this.place_id,
      uri_namespace_id: null,
      uri_fragment: null,
      comment: null,
    };
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Delete external place URI "TODO ${cell.getRow().getData().id}"?`,
      `Do you really want to delete the external place URI with ID ${cell.getRow().getIndex()}? This action cannot be reversed.`,
      `Yes, delete ${cell.getRow().getIndex()}`,
      `../rest/uri/external-place-uri/${cell.getRow().getIndex()}`,
      `Could not delete external place with ID ${cell.getRow().getIndex()}`);
  }

  protected doCreate(cell: Tabulator.CellComponent, data: any): Promise<number> {
    return this.createData(
      `../rest/uri/external-place-uri/0`,
      data,
      'Could not create new external place URI'
    ).then(({external_place_uri_id}: {external_place_uri_id: number}) => {
        return external_place_uri_id;
      });
  }

  protected doSave(cell: Tabulator.CellComponent, data: any): Promise<boolean> {
    return this.saveData(
      `../rest/uri/external-place-uri/${cell.getRow().getIndex()}`,
      data,
      `Could not update external place URI ${cell.getRow().getIndex()}`
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

  private onExternalLinkClick(e: Event, cell: Tabulator.CellComponent) {
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
}

