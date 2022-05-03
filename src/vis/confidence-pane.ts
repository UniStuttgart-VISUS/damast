import * as d3 from 'd3';
import * as R from 'ramda';
import {Dataset,ChangeScope} from './dataset';
import * as T from './datatypes';
import {createColorscales,ColorScales} from './colorscale';
import * as modal from './modal';
import default_selection from './default-confidence-filter-selection';
import * as CF from './confidence-filter';
import View from './view';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

export default class ConfidencePane extends View<any, any> {
  private _div: d3.Selection<HTMLDivElement, any, any, any>;

  private _cached_filters: CF.ConfidenceAspects = null;

  private _columns: {value:string}[];

  constructor(worker: Worker, container: GoldenLayout.Container) {
    super(worker, container, 'confidence');

    const div = container.getElement()[0];

    div.classList.add('confidence-container');
    div.innerHTML = require('html-loader!./html/confidence.template.html').default;
    this._div = d3.select(div).select('#confidence');

    const hdr = d3.select(div).select('.confidence__header');
    hdr.select<HTMLButtonElement>('#confidence-filter-none')
      .on('click', () => {
        this._div.selectAll<HTMLInputElement, any>('input.cell-check')
          .each(function() { this.checked = false; });
        this.onchange();
      });
    hdr.select<HTMLButtonElement>('#confidence-filter-invert')
      .on('click', () => {
        this._div.selectAll<HTMLInputElement, any>('input.cell-check')
          .each(function() { this.checked = !this.checked; });
        this.onchange();
      });
    hdr.select<HTMLButtonElement>('#confidence-filter-all')
      .on('click', () => {
        this._div.selectAll<HTMLInputElement, any>('input.cell-check')
          .each(function() { this.checked = true; });
        this.onchange();
      });
    hdr.select<HTMLButtonElement>('#confidence-filter-default')
      .on('click', () => {
        this._div.selectAll<HTMLInputElement, any>('input.cell-check')
          .each(function(d) {
            // if default selection has this checkbox, check it
            this.checked = default_selection[d[1].value].includes(d[0].value);
          });
        this.onchange();
      });
  }

  async linkData(data: any) {}

  async setData(data: any) {
    const grid = data.grid;
    const cols: {value: string | null, title: string, default_?: boolean}[]= data.cols;
    const rows: {value: string | null, title: string, color: string, dummy?: boolean}[] = data.rows;

    this._columns = cols;

    this._div.selectAll('*').remove();

    // row titles
    this._div.selectAll<HTMLSpanElement, any>('span.row-title')
      .data(rows)
      .enter()
      .append('span')
      .classed('row-title', true)
      .classed('row-title--dummy', d => !!d.dummy)
      .style('grid-column', '1 / span 1')
      .style('grid-row', (_, i) => `${i + 2} / span 1`)
      .style('--confidence-color', d => d.color)
      .text(d => d.title)
      .on('click', (_, d: any) => {
        const checkboxes = this._div.selectAll<HTMLInputElement, any>('input.cell-check')
          .filter(e => e[0].value === d.value);

        // in what state are >=50% of the checkboxes? invert that
        const majority_checked = checkboxes
          .filter(function() { return this.checked; })
          .nodes().length >= 3;

        // invert
        checkboxes.each(function() { this.checked = !majority_checked; });
        this.onchange();
      });

    // column titles and footers
    this._div.selectAll('span.column-title')
      .data(cols)
      .enter()
      .append('span')
      .classed('column-title', true)
      .style('grid-column', (_, i) => `${2*i + 2} / span 2`)
      .style('grid-row', '1 / span 1')
      .text(d => d.title)
      .on('click', (_, d: any) => {
        const checkboxes = this._div.selectAll<HTMLInputElement, any>('input.cell-check')
          .filter(e => e[1].value === d.value);

        // in what state are >=50% of the checkboxes? invert that
        const majority_checked = checkboxes
          .filter(function() { return this.checked; })
          .nodes().length >= 3;

        // invert
        checkboxes.each(function() { this.checked = !majority_checked; });
        this.onchange();
      });

    this._div.selectAll('i.column-footer')
      .data(cols)
      .enter()
      .append('i')
      .classed('column-footer', true)
      .classed('column-footer--selected', d => !!d.default_)
      .classed('fa', true)
      .classed('fa-eye', true)
      .classed('fa-lg', true)
      .style('grid-column', (_, i) => `${2*i + 2} / span 2`)
      .style('grid-row', '-2 / span 1')
      .on('click', (_, d) => {
        this.sendToDataThread('set-confidence-aspect', d.value);

        this._div.selectAll<HTMLElement, any>('i.column-footer')
          .classed('column-footer--selected', e => d.value === e.value);
      });

      rows.forEach((row, row_idx) => {
        cols.forEach((col, col_idx) => {
        this._div.append('input')
          .classed('cell-check', true)
          .attr('type', 'checkbox')
          .each(function() {
            this.checked = grid[col.value][row.value].checked;//default_selection[col.value].includes(row.value);
          })
          .style('grid-area', `${row_idx + 2} / ${2 * col_idx + 2} / span 1 / span 1`)
          .datum([row,col])
          .on('change', this.onchange.bind(this))
        this._div.append('span')
          .classed('cell-count', true)
          .style('grid-area', `${row_idx + 2} / ${2 * col_idx + 3} / span 1 / span 1`)
          .datum([row,col])
          .text(() => {
            return grid[col.value][row.value].count;
          });
      });
    });

    d3.select<HTMLButtonElement, any>('button#confidence-filter-apply')
      .on('click', () => this.apply_filters());

    this.onchange();
  }

  private read_filters(): CF.ConfidenceAspects {
    const cf = {} as CF.ConfidenceAspects;

    this._columns.forEach(d => {
      const set =  this._div.selectAll<HTMLInputElement, any>('input.cell-check')
          .filter(([_, col]) => col.value === d.value)
          .filter(function() { return this.checked; })
          .data()
          .map(([row,_]) => row.value)
      cf[d.value] = set;
    });

    return cf;
  }

  private apply_filters(): void {
    const filters = this.read_filters();

    this._cached_filters = filters;
    this.onchange();

    this.sendToDataThread('set-filter', filters);
  }

  private onchange(): void {
    const filters = this.read_filters();
    if (this._cached_filters === null) this._cached_filters = filters;

    const has_changes = !R.all(
      ([k, v]) => v.length === this._cached_filters[k].length
               && R.all(v2 => v.includes(v2), Array.from(this._cached_filters[k])),
      Array.from(Object.entries(filters))
    );

    d3.select<HTMLButtonElement, any>('button#confidence-filter-apply')
      .node()
      .disabled = !has_changes;

    this.setHasChanges(has_changes);
  }

  protected openModal(): void {
    modal.showInfoboxFromURL('Confidence View', 'confidence.html');
  }
};
