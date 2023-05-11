import { Tabulator } from 'tabulator-tables';
import type { ColumnDefinitionSorterParams, ColumnDefinition, Options, CellComponent, RowComponent, ColumnComponent } from 'tabulator-tables';
import * as _ from 'lodash';
import * as d3 from 'd3';

import Cache from '../common/cache';
import {confirm_dialog,choice_or_cancel_dialog,accept_dialog} from '../common/dialog';
import { getConsentCookie } from '../common/cookies';

interface DependentTableData {
  name: string;
  table: Table;
};

export default abstract class Table {
  protected table: Tabulator;
  protected initialValues = new Map<number, any>();
  private newRowIndex: number = -1;
  private _on_load_ordering: string[] | null = null;
  private placeholder_element: HTMLSpanElement;

  private saveIcons = new Map<number, HTMLElement>();
  private deleteIcons = new Map<number, HTMLElement>();

  protected id_column(): string {
    return 'id';
  }

  protected ignore_column_changes(): string[] {
    return [];
  }

  private readonly _id = this.id_column();
  private readonly _ignore_column_changes = this.ignore_column_changes();

  protected abstract prepare(): Promise<void>;

  constructor(
    protected readonly dispatch: d3.Dispatch<any>,
    protected readonly cache: Cache,
    protected readonly dispatch_namespace: string,
    protected readonly section_group: d3.Selection<HTMLDivElement, any, any, any>,
    table_element_id: string,
    protected readonly dependents: DependentTableData[] = []
  ) {
    const ph = document.createElement('div');
    ph.classList.add('tabulator-placeholder');

    this.placeholder_element = document.createElement('span');
    this.placeholder_element.innerText = 'No data';

    ph.appendChild(this.placeholder_element);

    this.prepare()
      .then(() => {
        const options: Options = {
          index: this._id,
          layout: 'fitColumns',
          renderVertical: 'basic',
          addRowPos: 'top',
          selectable: 'highlight',
          movableColumns: true,

          placeholder: ph,

          persistenceID: `table-ordering-${dispatch_namespace}`,
          persistenceMode: 'local',
          persistence: {
            columns: true,
            group: false,
            filter: false,
            page: false,
            sort: false
          },
          persistenceWriterFunc: this.saveLayout.bind(this),
          persistenceReaderFunc: this.loadLayout.bind(this),

          // add subclass options
          ...(this.getTableOptions())
        };

        const select_column: ColumnDefinition = {
          title: undefined,
          field: '@@selectColumn',
          headerSort: false,
          formatter: Table.selectionFormatter,
          width: 20,
          hozAlign: 'center',
          tooltip: 'Select row',
          cssClass: 'tabulator-cell--crosshair',
          resizable: false,
          download: false,
          frozen: true
        };
        const id_column: ColumnDefinition = {
          title: 'ID',
          field: this._id,
          sorter: 'number',
          sorterParams: { thousandSeparator: ',', } as ColumnDefinitionSorterParams,
          headerFilter: true,
          formatter: Table.idFormatter,
          width: 60,
          resizable: false
        };

        const management_columns: ColumnDefinition[] = [
          {
            formatter: Table.revertIcon,
            title: undefined,
            field: '@@revertIcon',
            width: 30,
            hozAlign: 'center',
            headerSort: false,
            resizable: false,
            download: false,
            tooltip: 'Revert to database version',
            frozen: true
          },
          {
            formatter: this.deleteIcon.bind(this),
            title: undefined,
            field: '@@deleteIcon',
            width: 30,
            hozAlign: 'center',
            headerSort: false,
            resizable: false,
            download: false,
            tooltip: 'Delete from database',
            frozen: true
          },
          {
            formatter: this.saveIcon.bind(this),
            title: undefined,
            field: '@@saveIcon',
            width: 30,
            hozAlign: 'center',
            headerSort: false,
            resizable: false,
            download: false,
            tooltip: 'Save changes to database',
            frozen: true
          },
        ];

        options.columns = [
          select_column,
          id_column,
          ...(this.getMainColumns()),
          ...management_columns
        ];

        // ignore controls
        this._ignore_column_changes.push(select_column.field);
        management_columns.forEach(({field}) => this._ignore_column_changes.push(field));
        this.virtualColumns().forEach(field => this._ignore_column_changes.push(field));

        this.table = new Tabulator(table_element_id, options);
        this.onLoadReorderColumns();

        const button_group = this.section_group
          .select<HTMLDivElement>('.section__head > .controls');

        button_group.select<HTMLButtonElement>('#manage-columns').on('click', async () => await this.onManageColumns());
        button_group.select<HTMLButtonElement>('#download-current').on('click', () => this.downloadCurrentView());
        button_group.select<HTMLButtonElement>('#clear-filter').on('click', () => this.table.clearHeaderFilter());
        button_group.select<HTMLButtonElement>('#add-row').on('click', this.newRow.bind(this));
      })
        .catch(console.error);

    // events
    this.table.on('cellEdited', this.cellEdited.bind(this));
    this.table.on('cellClick', this._onCellClick.bind(this));
    this.table.on('rowSelected', this.rowSelected.bind(this));
  }

  private _onCellClick(evt: UIEvent, cell: CellComponent): void {
    switch (cell.getField()) {
      case '@@saveIcon':
        return this.onSave.bind(evt, cell);
      case '@@deleteIcon':
        return this.onDelete.bind(evt, cell);
      case '@@revertIcon':
        return this.onRevert.bind(evt, cell);
      case '@@selectColumn':
        return this.onRowClick(cell.getRow());
      default:
        return;
    }
  }

  protected virtualColumns(): string[] {
    return [];
  }

  private saveLayout(id: string, type: 'columns', data: ColumnDefinition[]): any {
    if (getConsentCookie() !== 'essential') return;

    const order = data.map(d => d.field);
    localStorage.setItem(`${id}-${type}`, JSON.stringify(order))
  }

  private loadLayout(id: string, type: 'columns'): false {
    if (getConsentCookie() !== 'essential') {
      this._on_load_ordering = null;
      return false;
    }

    const order = localStorage.getItem(`${id}-${type}`);
    this._on_load_ordering = order ? JSON.parse(order) : null;
    return false;
  }

  private onLoadReorderColumns() {
    if (this._on_load_ordering === null) return;

    try {
      if (this._on_load_ordering.length !== this.table.getColumns().length) return;

      let last_id = this._on_load_ordering[0];
      this.table.moveColumn(this._on_load_ordering[0], this.table.getColumns()[0].getField(), false);

      this._on_load_ordering.forEach(field => {
        this.table.moveColumn(field, last_id, true);
        last_id = field;
      });

    } catch (err) {
      console.error(err);
    }
  }

  protected abstract getMainColumns(): ColumnDefinition[];
  protected abstract getTableOptions(): Options;

  setData(data: any[], preferential_index?: number): Promise<any> {
    this.table.clearData();
    this.initialValues.clear();

    data.forEach(datum => {
      this.initialValues.set(datum[this._id], JSON.parse(JSON.stringify(datum)));//_.cloneDeep(datum));
    });
    return this.table.setData(data)
      .then(() => {
        if (data.length) {
          // TODO: correct? 5.3 -> 5.4 upgrade
          const activeData = this.table.getData('active');
          console.log(this.table.getRowFromPosition(0), activeData);
          console.warn('TODO: should scroll to first visible row here');
         // const rowIndex = preferential_index || this.table.getRowFromPosition(0).getIndex();
         // this.table.selectRow(rowIndex);
         // this.table.scrollToRow(rowIndex);
        }
      });
  }

  private downloadCurrentView() {
    const fname = d3.timeFormat(`damast-${this.dispatch_namespace}-%Y%m%d%H%M%S%L.csv`)(new Date());
    this.table.download('csv', fname, {bom: true}, 'active')
  }

  protected cellEdited(cell: CellComponent) {
    if (this.hasChanges(cell.getRow())) {
      cell.getRow().getElement().setAttribute('dirty', '');
    } else {
      cell.getRow().getElement().removeAttribute('dirty');
    }
  }

  protected abstract newRecord(): any;
  protected abstract canCreateNew(): boolean;

  protected newRow() {
    if (!this.canCreateNew()) return;

    const new_object = this.newRecord();
    new_object[this._id] = this.newRowIndex;
    new_object.newRow = true;
    this.table.addRow(new_object)
      .then(row => {
        this.table.scrollToRow(row)
        row.getElement().setAttribute('new-row', '');
      });
    this.newRowIndex -= 1;
  }

  protected static nullOrStringDownloadFormatter(value, _, __, ___, ____): string {
    return value || '';
  }

  protected static lookupAccessor(value, data, type, accessorParams, column): string {
    if (value === null || value === undefined) return '';
    const obj = accessorParams.values.find(x => x.value === value);
    return obj.label;
  }

  //-------------- ICONS -----------------
  protected static revertIcon(cell, formatterParams) {
    if (cell.getRow().getData().newRow) {
      return '';
    }
    return '<i class="fa fa-lg fa-reply revert-button"></i>';
  };
  protected deleteIcon(cell, formatterParams) {
    const classList = (cell.getRow().getData().newRow)
      ? "fa fa-lg fa-ban cancel-button"
      : "fa fa-lg fa-trash delete-button";

    const i = document.createElement('i');
    i.className = classList;
    this.deleteIcons.set(cell.getRow().getIndex(), i);
    return i;
  };
  protected saveIcon(cell, formatterParams) {
    const classes = [ 'fa', 'fa-lg' ];
    if (cell.getRow().getData().newRow) {
      classes.push('fa-cloud-upload');
      classes.push('upload-button');
    } else {
      classes.push('fa-floppy-o');
      classes.push('save-button');
    }

    const i = document.createElement('i');
    classes.forEach(cls => i.classList.add(cls));

    this.saveIcons.set(cell.getRow().getIndex(), i);
    return i;
  };
  protected static idFormatter(cell, formatterParams) {
    if (cell.getRow().getData().newRow) {
      return '<i class="fa fa-lg fa-asterisk new-row-indicator"></i>';
    }
    return cell.getValue();
  };
  protected static selectionFormatter(cell, formatterParams) {
    return '<i class="fa fa-lg fa-hand-pointer-o selected-row-indicator"></i>';
  }

  private onRowStartUpload(row: RowComponent): void {
    const i = this.saveIcons.get(row.getIndex());
    i.className = 'fa fa-lg fa-pulse fa-spinner sync-in-progress';
  }
  private onRowEndUpload(row: RowComponent): void {
    const i = this.saveIcons.get(row.getIndex());
    if (!row.getData().newRow) i.className = 'fa fa-lg fa-floppy-o save-button';
    else i.className = 'fa fa-lg fa-cloud-upload upload-button';
  }
  private onRowStartDelete(row: RowComponent): void {
    const i = this.deleteIcons.get(row.getIndex());
    i.className = 'fa fa-lg fa-pulse fa-spinner delete-in-progress';
  }
  private onRowEndDelete(row: RowComponent): void {
    const i = this.deleteIcons.get(row.getIndex());
    if (row.getData().newRow) i.className = 'fa fa-lg fa-ban cancel-button';
    else i.className = 'fa fa-lg fa-trash delete-button';
  }

  protected checkColumnChange<T>(column_name: string, old_value: T, new_value: T): boolean | null {
    return null;
  }

  protected hasChanges(row: RowComponent): boolean {
    if (row.getData().newRow) return false;

    const initial = this.initialValues.get(row.getIndex());
    return _.some(row.getCells(), (cell: CellComponent) => {
      if (this._ignore_column_changes.includes(cell.getField())) return false;

      const val = cell.getValue();
      const fd = cell.getField().split('.');

      if (fd.length > 1 && initial[fd[0]] === null) return val !== null && val !== undefined;

      let init = initial;
      fd.forEach(acc => init && (init = init[acc]));

      // ignore comment changes between null and empty string
      if (/comment$/.test(fd[0]) && (val === null && init === '' || val === '' && init === null)) return false;

      // potentially check equality of old and new value in inheritor
      const changed = this.checkColumnChange(cell.getField(), init, val);
      if (changed === null) return val !== init;
      return changed;
    });
  }

  private onRevert(evt, cell) {
    if (!this.hasChanges(cell.getRow())) return;

    confirm_dialog(`Revert data?`,
      `Do you really want to discard your edits on this row?`,
      {
        title: '<i class="fa fa-close fa--pad-right"></i>No'
      }, {
        title: '<i class="fa fa-reply fa--pad-right"></i>Yes',
        classes: ['button--delete']
      })
      .then(() => {
        cell.getRow().getElement().removeAttribute('dirty');
        this.table.updateData([_.cloneDeep(this.initialValues.get(cell.getRow().getIndex()))]);
          const data = _.cloneDeep(cell.getRow().getData());
        this.dispatch.call(`${this.dispatch_namespace}-updated`, null, data);
      })
      .catch(() => {});
  };

  protected abstract doDelete(cell): Promise<boolean>;

  private onDelete(evt, cell) {
    if (cell.getRow().getData().newRow) {
      // only remove row
      this.table.deleteRow(cell.getRow());
      return;
    }

    const id = cell.getRow().getIndex();
    this.onRowStartDelete(cell.getRow());
    this.doDelete(cell)
      .then(success => {
        this.onRowEndDelete(cell.getRow());
        if (success) {
          cell.getRow().delete();
          this.initialValues.delete(id);
          this.dispatch.call(`${this.dispatch_namespace}-deleted`, null, id);
        }
      })
      .catch(_ => {this.onRowEndDelete(cell.getRow());});
  };

  protected abstract doCreate(cell: CellComponent, data: any): Promise<number>;
  protected abstract doSave(cell: CellComponent, data: any): Promise<boolean>;

  abstract clearTable();

  protected getChanges(cell: CellComponent): any {
    const initial = this.initialValues.get(cell.getRow().getIndex());
    return cell.getRow()
        .getCells()
        .map(d => [d.getField(), d.getValue()])
        .filter(([k, _]) => !this._ignore_column_changes.includes(k))
        .filter(([k, v]) => v !== initial[k])
        // ignore comment changes between null and empty string
        .filter(([k, v]) => {
          if (/comment$/.test(k)) {
            const init = initial[k];
            if (v === null && init === '' || v === '' && init === null) return false;
          }
          return true;
        })
        .reduce((o, kv) => (o[kv[0]] = kv[1], o), {});
  }

  private onSave(evt, cell): Promise<void> {
    if (cell.getRow().getData().newRow) {
      const new_data = _.cloneDeep(cell.getRow().getData());
      delete new_data[this._id];
      delete new_data.newRow;

      this.onRowStartUpload(cell.getRow());
      return this.doCreate(cell, new_data)
        .then(id => {
          this.onRowEndUpload(cell.getRow());
          new_data[this._id] = id;
          delete cell.getRow().getData().newRow;
          return cell.getRow().update(new_data);
        })
        .then(() => {
          this.dispatch.call(`${this.dispatch_namespace}-added`, null, _.cloneDeep(cell.getRow().getData()));

          this.initialValues.set(cell.getRow().getIndex(), _.cloneDeep(cell.getRow().getData()));
          cell.getRow().getElement().removeAttribute('new-row');
          cell.getRow().reformat();
          this.table.deselectRow();
          cell.getRow().select();
        })
        .catch(err => {
          this.onRowEndUpload(cell.getRow());
          console.error(err);
        });
    }

    if (!this.hasChanges(cell.getRow())) return Promise.resolve();

    // collect changes
    const changes = this.getChanges(cell);

    this.onRowStartUpload(cell.getRow());
    this.doSave(cell, changes)
      .then(success => {
        this.onRowEndUpload(cell.getRow());

        if (success) {
          cell.getRow().getElement().removeAttribute('dirty');
          const data = _.cloneDeep(cell.getRow().getData());
          this.initialValues.set(cell.getRow().getIndex(), data);
          this.dispatch.call(`${this.dispatch_namespace}-updated`, null, data);
          this.table.updateRow(cell.getRow(), data);  // in case some columns implicitly changed, like when removing person instances
        }
      })
      .catch(err => {
        this.onRowEndUpload(cell.getRow());
        console.error(err);
      });
  };

  protected async saveAllModifiedRows(): Promise<void> {
    const unsaved_rows = this.table.getRows()
      .map(d => d.getCells()[0])
      .filter(cell => cell.getRow().getData().newRow
          || this.hasChanges(cell.getRow()));

    if (unsaved_rows.length === 0) return Promise.resolve();
    return Promise.all(
      unsaved_rows.map(cell => this.onSave(null, cell))
    ).then(_ => {});
  }

  protected onRowClick(row) {
    const switch_row = () => {
      this.table.deselectRow();
      this.table.selectRow(row);
    };

    // check if any conflicts
    const conflicts = [];
    this.dependents.forEach(dep => {
      if (dep.table.hasUnsavedChanges()) conflicts.push(dep);
    });

    if (conflicts.length) {
      choice_or_cancel_dialog<boolean>(
        'Unsaved changes',
        `There are unsaved changes in <b>${conflicts.map(d => d.name).join(', ')}.</b>
        Selecting a new row will discard those changes.`,
        {
          title: `<i class="fa fa-times fa--pad-right"></i>Cancel`
        },
        [
          {
            value: false,
            title: '<i class="fa fa-reply fa--pad-right"></i>Switch and discard',
            classes: ['button--delete']
          },
          {
            value: true,
            title: '<i class="fa fa-floppy-o fa--pad-right"></i>Save and switch',
            classes: ['button--confirm']
          }
        ]
      )
        .then((cascade: boolean) => {
          if (cascade) {
            Promise.all(conflicts.map(d => d.table.saveAllModifiedRows()))
              .then(switch_row)
              .catch(console.error);
          }
          else switch_row();
        })
        .catch(() => {});
    } else {
      switch_row();
    }
  }

  private rowSelected(row) {
    this.dispatch.call(`${this.dispatch_namespace}-selected`, null, row.getData());
  }

  hasUnsavedChanges(): boolean {
    return _.some(
      this.table.getRows(),
      this.hasChanges.bind(this));
  }

  protected loadDataOrFail(
    json_url: string,
    error_title: string
  ): Promise<any> {
    this.showLoadingIndicator();
    return d3.json(json_url)
      .catch(err => {
        this.hideLoadingIndicator();
        return accept_dialog(error_title, err,
          {
            title: '<i class="fa fa-close fa--pad-right"></i>OK'
          })
          .then(() => Promise.reject());
      })
      .then(arg => {
        this.hideLoadingIndicator();
        return arg;
      });
  }

  protected deleteData(
    confirm_title: string,
    confirm_body: string,
    confirm_yes_text: string,
    fetch_url: string,
    failure_title: string,
    delete_options: any = {}
  ): Promise<boolean> {
    return confirm_dialog(
      confirm_title,
      `<i class="fa fa-5x fa-pull-left fa-exclamation-triangle | danger"></i>${confirm_body}<span class="clear"></span>`,
      {},
      {
        title: `<i class="fa fa-trash fa--pad-right"></i>${confirm_yes_text}`,
        classes: [ 'button--delete' ]
      },
      'delete'
    )
      .catch(() => Promise.reject(false))
      .then(() => {
        return fetch(fetch_url, {
          method: 'DELETE',
          ...delete_options
        })
          .then(success => {
            if (success.ok) {
              return true
            } else {
              return success.text().then(text => {
                return accept_dialog(failure_title,
                  `<b>${success.status} ${success.statusText}</b><br>
                  <pre>${text}</pre>`,
                  {
                    title: '<i class="fa fa-close fa--pad-right"></i>OK'
                  })
                  .then(() => false);
              });
            }
          })
          .catch(err => {
            return accept_dialog(failure_title,
              err,
              {
                title: '<i class="fa fa-close fa--pad-right"></i>OK'
              })
              .then(() => false);
          });
      });
  }

  protected createData(
    create_url: string,
    put_body: Object,
    error_message: string,
    fetch_options: any = {}
  ): Promise<any> {
    return fetch(create_url, {
      method: 'PUT',
      body: JSON.stringify(put_body),
      headers: {
        'Content-Type': 'application/json; encoding=utf-8',
        'Accept': 'text/plain,application/json'
      },
      ...fetch_options
    })
      .then(response => {
        if (!response.ok) return response.text().then(text => Promise.reject(text));
        return response.json();
      })
      .catch(err => {
        return accept_dialog(error_message, err, {})
          .then(() => Promise.reject(err));
      })
  }

  protected saveData(
    patch_url: string,
    patch_body: Object,
    error_message: string,
    fetch_options: any = {}
  ): Promise<boolean> {
    return fetch(patch_url, {
      method: 'PATCH',
      body: JSON.stringify(patch_body),
      headers: {
        'Content-Type': 'application/json; encoding=utf-8',
        'Accept': 'text/plain,application/json'
      },
      ...fetch_options
    })
      .then(success => {
        if (success.ok) {
          return true;
        } else {
          return success.text().then(text => {
            return accept_dialog(error_message,
              `<b>${success.status} ${success.statusText}</b><br>
                  <pre>${text}</pre>`,
              {
                title: '<i class="fa fa-close fa--pad-right"></i>OK'
              })
              .then(() => false);
          });
        }
      })
    .catch(err => {
      return accept_dialog(error_message,
        err,
        {
          title: '<i class="fa fa-close fa--pad-right"></i>OK'
        })
        .then(() => false);
    });
  }

  protected updateTitleDetail(detail: string | null): void {
    detail = detail || '';

    this.section_group
      .select<HTMLSpanElement>('.section__head > h3 > #section__head-detail')
      .html(detail);
  }

  private showLoadingIndicator(): void {
    this.placeholder_element.innerHTML = '<i class="fa fa-lg fa-spinner fa-pulse fa-fw"></i> Loading';
  }

  private hideLoadingIndicator(): void {
    this.placeholder_element.innerHTML = 'No data';
  }

  private async onManageColumns(): Promise<void> {
    // add managing controls
    const modal = d3.select('body')
      .append('div')
      .classed('modal', true)
      .classed('modal__background', true)
      .on('click', () => modal.remove());

    const body = modal.append('div')
      .classed('modal__body', true)
      .on('click', e => e.stopPropagation());
    body.append('h4')
      .text(`Manage columns for table ${this.dispatch_namespace}`);

    // control columns (select, delete, etc.) cannot be toggled. those start with "@@"
    const columns = this.table.getColumns()
      .filter(d => !/^@@.*/.test(d.getField()));

    const t = this.table;
    body.append('div')
      .selectAll('.dummy')
      .data(columns)
      .enter()
      .append('div')
      .classed('column-visibility-option', true)
      .each(function(d: ColumnComponent) {
        d3.select(this)
          .append('input')
          .attr('id', d.getField())
          .attr('name', d.getField())
          .attr('type', 'checkbox')
          .attr('checked', d.isVisible() ? '' : null)
          .on('input', function() {
            this.checked ? d.show() : d.hide();
            t.redraw();
          });
        d3.select(this)
          .append('label')
          .attr('for', d.getField())
          .text(d.getDefinition().title);
      });

    body.append('div')
      .classed('modal__footer', true)
      .append('button')
      .classed('button', true)
      .classed('button--right', true)
      .html(`<i class="fa fa-exit"></i> Close`)
      .on('click', () => modal.remove());
  }
}
