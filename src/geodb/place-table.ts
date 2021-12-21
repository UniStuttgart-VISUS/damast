import Tabulator from 'tabulator-tables';
import * as _ from 'lodash';
import * as d3 from 'd3';
import * as L from 'leaflet';

import Table from './table';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';
import confidence_dropdown_values from './confidence-dropdown-values';

const geoloc_from_string = function(s: string) {
  const coord = /^\((-?\d+(\.\d+)?),(-?\d+(\.\d+)?)\)$/;
  const match = coord.exec(s);
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[3]);

  return { lat, lng };
};

const geoloc_formatter = function(cell, formatterParams, onRendered) {
  const v = cell.getValue();
  if (v === null || v === undefined) return '';

  const [pos,neg] = cell.getField() === 'geoloc.lng' ? ['E','W'] : ['N','S'];

  const hem = (v >= 0) ? pos : neg;

  return `${hem}&thinsp;${d3.format('.6~f')(Math.abs(v))}&deg;`;
};
const geoloc_dl_fmt = function(v, data, type, params, column) {
  if (v === null || v === undefined) return '';

  const [pos,neg] = column.getField() === 'geoloc.lng' ? ['E','W'] : ['N','S'];

  const hem = (v >= 0) ? pos : neg;

  return `${hem} ${Math.abs(v)}°`;
}

const place_name_strip_arabic_definite_article = /^a([tdrzsṣḍṭẓln]|[tds]h)-/;
const place_name_sorter = function(a, b, _, __, ___, dir, ____) {
  const val_a = (a || '').replace(place_name_strip_arabic_definite_article, '');
  const val_b = (b || '').replace(place_name_strip_arabic_definite_article, '');

  return (val_a.toLowerCase() > val_b.toLowerCase()) ? 1 : -1;
};

export default class PlaceTable extends Table {
  private confidence_values: string[];
  private confidence_values_with_null: {value: string|null, label: string}[];
  private place_types: any[];

  protected async prepare(): Promise<void> {
    this.confidence_values = await this.cache.confidence;
    this.confidence_values_with_null = await confidence_dropdown_values(this.cache);
    this.place_types = await this.cache.place_types;
  }

  protected getTableOptions(): Tabulator.Options {
    return {
      initialSort: [
        {column:'name', dir:'asc'}
      ],
      height: 'calc(400px - 4rem)',
      dataFiltered: (_, rows) => this.dispatch.call('places-filtered', null, rows.map(d => d.getData().id))
    };
  }

  protected getMainColumns(): Tabulator.ColumnDefinition[] {
    const ref = this;
    const place_type_editor_params: Tabulator.EditorParams = {
      values: this.place_types.map(d => d.id),
      listItemFormatter: function(value, _) {
        const vs = ref.place_types.filter(d => d.id === value);
        if (vs.length > 0) return vs[0].type;
        return null;
      }
    };
    const formatterParams = this.place_types.reduce((a,b) => { a[b.id] = b.type; return a; }, {});

    return [
      {
        title: 'Name',
        field: 'name',
        editor: 'input',
        headerFilter: true,
        accessorDownload: Table.nullOrStringDownloadFormatter,
        cellEdited: this.cellEdited.bind(this),
        sorter: place_name_sorter
      },
      {
        title: 'Lat',
        field: 'geoloc.lat',
        formatter: geoloc_formatter,
        accessorDownload: geoloc_dl_fmt,
        editor: 'number',
        headerSort: false,
        cellEdited: this.cellEdited.bind(this),
        cssClass: 'geoloc-cell'
      },
      {
        title: 'Long',
        field: 'geoloc.lng',
        formatter: geoloc_formatter,
        accessorDownload: geoloc_dl_fmt,
        editor: 'number',
        headerSort: false,
        cellEdited: this.cellEdited.bind(this),
        cssClass: 'geoloc-cell'
      },
      {
        title: 'Comment',
        field: 'comment',
        editor: 'textarea',
        formatter: 'textarea',
        accessorDownload: Table.nullOrStringDownloadFormatter,
        widthGrow: 3,
        headerSort: false,
        headerFilter: 'input',
        cellEdited: this.cellEdited.bind(this)
      },
      {
        title: 'Place type',
        field: 'place_type_id',
        headerSort: true,
        headerFilter: 'select',
        headerFilterParams: place_type_editor_params,
        editor: 'select',
        editorParams: place_type_editor_params,
        formatter: 'lookup',
        formatterParams,
        accessorDownload: Table.lookupAccessor,
        accessorDownloadParams: {
          values: this.place_types.map(({id, type}) => { return {value:id, label:type};} )
        },
        cellEdited: this.cellEdited.bind(this)
      },
      {
        title: 'Location confidence',
        field: 'confidence',
        headerFilter: 'select',
        headerFilterParams: {
          values: this.confidence_values
        },
        editor: 'select',
        editorParams: {
          values: this.confidence_values_with_null,
        },
        accessorDownload: Table.nullOrStringDownloadFormatter,
        cellEdited: this.cellEdited.bind(this),
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
        cellEdited: this.cellEdited.bind(this),
        width: 40
      },
    ];
  }

  async loadData(initial_index?: number) {
    return await this.loadDataOrFail(
      '../rest/place/all',
      'Could not load place data'
    )
      .then(data => this.setData(data, initial_index))
      .then(() => {
        this.dispatch.call('places-loaded', null, this.table.getData());
      });
  }

  clearTable() {
    this.table.clearData();
  }

  protected canCreateNew(): boolean {
    return true;
  }

  protected newRecord() {
    return {
      place_type_id: 1,
      visible: true,
      comment: null,
      geoloc: null,
      name: null,
      confidence: null
    };
  }

  protected doDelete(cell): Promise<boolean> {
    return this.deleteData(
      `Delete place ${cell.getRow().getData().name}?`,
      `Do you really want to delete the place <em>${cell.getRow().getData().name}</em> (ID ${cell.getRow().getIndex()})? This action cannot be reversed.`,
      `Yes, delete ${cell.getRow().getData().name}`,
      `../rest/place/${cell.getRow().getIndex()}`,
      `Could not delete place ${cell.getRow().getData().name}`);
  }

  protected doCreate(cell: Tabulator.CellComponent, data: any): Promise<number> {
    if (!data.name) {
      return accept_dialog('Name must not be empty', '', {})
        .then(() => Promise.reject(cell.getRow().getIndex()));
    }

    if (data.geoloc) {
      const lngval = ((typeof data.geoloc.lng) !== 'number');
      const latval = ((typeof data.geoloc.lat) !== 'number');
      if (lngval && latval) delete data.geoloc;
      else if (lngval && !latval || !lngval && latval) {
        return accept_dialog('Both latitude and longitude must contain values', '', {})
          .then(() => Promise.reject(cell.getRow().getIndex()));
      }
    }

    return this.createData(
      `../rest/place/0`,
      data,
      'Could not create new place')
    .then(({place_id}: {place_id: number}) => {
      return place_id;
    });
  }

  protected doSave(cell: Tabulator.CellComponent, data: any): Promise<boolean> {
    if (data['geoloc.lng'] !== undefined || data['geoloc.lat'] !== undefined) {
      const lngval = ((typeof data['geoloc.lng']) !== 'number');
      const latval = ((typeof data['geoloc.lat']) !== 'number');
      if (lngval && latval) {
        delete data['geoloc.lng'];
        delete data['geoloc.lat'];
      }
      else if (lngval && !latval || !lngval && latval) {
        return accept_dialog('Both latitude and longitude must contain values', '', {})
          .then(() => Promise.reject(cell.getRow().getIndex()));
      }
      else {
        const geoloc = this.initialValues.get(cell.getRow().getIndex()).geoloc;

        if (!geoloc || data['geoloc.lng'] !== geoloc.lng || data['geoloc.lat'] !== geoloc.lat) {
          data['geoloc'] = {
            lng: data['geoloc.lng'],
            lat: data['geoloc.lat']
          };
        }

        delete data['geoloc.lng'];
        delete data['geoloc.lat'];
      }
    }

    return this.saveData(
      `../rest/place/${cell.getRow().getIndex()}`,
      data,
      `Could not update place ${cell.getRow().getData().name}`);
  }

  protected canChangeRow(_): boolean {
    return false;
  }

  onMapChanged(id: number, {lat, lng}: {lat:number, lng: number}) {
    this.table.getRow(id).getCell('geoloc.lat').setValue(lat);
    this.table.getRow(id).getCell('geoloc.lng').setValue(lng);
  }

  onMapSelected(id: number) {
    const row = this.table.getRow(id);
    this.onRowClick(row);
    this.table.scrollToRow(row);
  }
}

