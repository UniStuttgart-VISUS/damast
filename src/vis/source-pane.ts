import * as d3 from 'd3';
import * as R from 'ramda';
import {Dataset,ChangeScope} from './dataset';
import {confidence_aspects} from './confidence-aspects';
import * as T from './datatypes';
import {ColorScales} from './colorscale';
import * as modal from './modal';
import {SourceTuple} from './timeline-data';
import View from './view';
import {SourceWithPayload,CountStackDatum} from './source-data';
import TooltipManager from './tooltip';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';


export default class SourcePane extends View<any, any> {
  private _applied_selected: Set<number>;
  private div: d3.Selection<HTMLDivElement, any, any, any>;
  private sort_mode_checkbox: HTMLInputElement;
  private readonly tooltipManager = new TooltipManager();

  private display_mode: T.DisplayMode = T.DisplayMode.Religion;
  private sort_mode: T.SourceViewSortMode = T.SourceViewSortMode.ByCountDescending;
  private religion_names: Map<number, string>;

  constructor(
    worker: Worker,
    container: GoldenLayout.Container
  ) {
    super(worker, container, 'source-list');

    const div = container.getElement()[0];

    div.classList.add('source-container');
    div.innerHTML = require('html-loader!./html/sources.template.html').default;
    this.div = d3.select(div);

    this.sort_mode_checkbox = this.div.select<HTMLInputElement>('#source-sort-mode').node();
    this.sort_mode_checkbox.checked = this.sort_mode === T.SourceViewSortMode.ByCountDescending;
  }

  protected openModal() {
    const info = modal.create_modal(
      400, 300,
      'Sources',
      'source.html'
    );
  }

  async linkData(data: any) {
    const sel = this.div.select('div#sources')
      .classed('source__body--linked', data !== null)
      .selectAll<HTMLDivElement, SourceWithPayload>('.source');
    if (data === null) {
      sel.classed('source--linked', false);
    }
    else sel.classed('source--linked', d => data.has(d.id));
  }

  async setData(data: any) {
    const ref = this;
    const {source_data, max_per_source} = data;
    this.display_mode = data.display_mode;
    this.religion_names = data.religion_names;
    this.sort_mode = data.sort_mode;

    this.sort_mode_checkbox.checked = this.sort_mode === T.SourceViewSortMode.ByCountDescending;

    this._applied_selected = new Set<number>(source_data.filter(d => d.active).map(d => d.id));
    this.initButtons();
    this.createElements(source_data);
    this.checkActive();

    const scale = d3.scaleLinear()
      .domain([0, max_per_source]);

    const sel = this.div.select('div#sources')
      .selectAll<HTMLDivElement, SourceWithPayload>('.source')
      .data(source_data as SourceWithPayload[], d => `${d.id}`);
    sel.enter()
      .each(d => console.error('Illegal enter():', d));
    sel.exit()
      .each(d => console.error('Illegal exit():', d));

    // Count of sources
    sel.selectAll('.source__count')
      .each(function(d: SourceWithPayload) {
        const active = d.data.filter(d => d.active).length;

        const svg = d3.select(this)
          .select('svg');
        svg.selectAll('*').remove();
        svg.attr('viewBox', '0 0 1 1')
          .attr('preserveAspectRatio', 'none');
        svg.append('rect')
          .attr('height', 1)
          .attr('width', scale(active))
          .attr('fill', 'var(--clr-fg)');
        svg.append('rect')
          .classed('inactive', true)
          .attr('height', 1)
          .attr('x', scale(active))
          .attr('width', scale(d.data.length - active))
          .attr('fill', 'var(--clr-fg)');
      });

    // evidence svg: by religion/active confidence
    sel.selectAll('.source__evidence')
      .each(function(d: SourceWithPayload) {
        const svg = d3.select(this)
          .select('svg');
        svg.selectAll('*').remove();
        svg.attr('viewBox', '0 0 1 1')
          .attr('preserveAspectRatio', 'none');

        svg.selectAll('.dummy')
          .data(d.stack)
          .enter()
          .append('rect')
          .attr('height', 1)
          .attr('x', d => d.x)
          .attr('width', d => d.w)
          .attr('fill', d => d.color)
          .classed('inactive', d => !d.active);
      });

    // sort sources by count
    //sel.sort((a, b) => b.data.length - a.data.length);
  }

  private initButtons(): void {
    d3.select('#sources-filter-apply').on('click', () => this.onApply());
    d3.select('#sources-filter-none').on('click', () => this.checkNone());
    d3.select('#sources-filter-invert').on('click', () => this.invertAll());
    d3.select('#sources-filter-all').on('click', () => this.checkAll());
  }

  private collectSelected(): Set<number> {
    return new Set<number>(
      this.div.select('div#sources')
        .selectAll<HTMLDivElement, SourceWithPayload>('.source')
        .selectAll<HTMLDivElement, SourceWithPayload>('.source__checkbox')
        .selectAll<HTMLInputElement, SourceWithPayload>('input')
        .filter(function() { return this.checked; })
        .data()
        .map(d => d.id)
    );
  }

  private checkActive(): void {
    const selected = this.collectSelected();

    const unchanged = R.all(d => selected.has(d), Array.from(this._applied_selected))
      && R.all(d => this._applied_selected.has(d), Array.from(selected));

    d3.select('#sources-filter-apply')
      .attr('disabled', unchanged ? '' : null);

    this.setHasChanges(!unchanged);
  }

  private checkNone(): void {
    this.applyLogicToAll(elem => {
      elem.checked = false;
    });
  }

  private checkAll(): void {
    this.applyLogicToAll(elem => {
      elem.checked = true;
    });
  }

  private invertAll(): void {
    this.applyLogicToAll(elem => {
      elem.checked = !elem.checked;
    });
  }

  private applyLogicToAll(fn: (elem: HTMLInputElement) => void): void {
    this.div.select('div#sources')
      .selectAll<HTMLDivElement, SourceWithPayload>('.source')
      .selectAll<HTMLDivElement, SourceWithPayload>('.source__checkbox')
      .selectAll<HTMLInputElement, SourceWithPayload>('input')
      .each(function() {
        fn(this);
      });

    this.checkActive();
  }

  private onAllClick(event: Event, datum: T.Source, elem: HTMLDivElement): void {
    // checkboxes_last_saved_state
    if ((event.target as HTMLElement).classList.contains('cell-check')) return;

    if (elem.classList.contains('source--linked')) this.sendToDataThread('clear-brush', null);
    else this.sendToDataThread('set-brush', datum.id);
  }

  private onApply(): void {
    const selected = this.collectSelected();
    this._applied_selected = selected;

    this.sendToDataThread('set-filter', selected);

    this.checkActive();
  }

  private createElements(sources: SourceWithPayload[]): void {
    const ref = this;
    const sel = this.div.select('div#sources');
    sel.selectAll('*').remove();
    sel.selectAll<HTMLDivElement, any>('.source')
      .data(sources, d => d.id)
      .enter()
      .append('div')
      .classed('source', true)
      .on('click', function(e, d) { ref.onAllClick(e, d, this); })
      .on('mouseenter', (e, d) => {
        this.tooltipManager.create(t => {
          t.root.append('h1').text(d.name);

          const active_count = d.stack.filter(e => e.active).reduce((a,b) => a + b.count, 0);

          t.root.append('p').text(`${active_count} / ${d.data.length} evidences:`);

          const ul = t.root.append('ul');
          const ids = [], _ids = new Set();
          d.stack.forEach(e => {
            if (!_ids.has(e.data_id)) {
              _ids.add(e.data_id);
              ids.push([
                e.data_id,
                d.stack.filter(f => f.data_id === e.data_id).reduce((a,b) => a + b.count, 0),
              ]);
            }
          });

          ids.sort((a,b) => b[1] - a[1]).forEach(([id, _]) => {
            const name = (this.display_mode === T.DisplayMode.Religion)
              ? `<strong>${this.religion_names.get(id as number)}:</strong>`
              : (id === null) ? `<em>no value</em>` : `<strong>${id}:</strong>`;
            const matches = d.stack.filter(e => e.data_id === id);
            const total = matches.reduce((a,b) => a + b.count, 0);
            const active = matches.filter(e => e.active).reduce((a,b) => a + b.count, 0);

            ul.append('li')
              .html(`${name} ${active} / ${total} evidences`);
          });
        });
        this.tooltipManager.move(e.clientX, e.clientY);
      })
      .on('mousemove', e => this.tooltipManager.move(e.clientX, e.clientY))
      .on('mouseleave', () => this.tooltipManager.cancel())
      .each(function(d) {
        const s = d3.select(this);
        s.append('div')
          .classed('source__checkbox', true)
          .append('input')
          .attr('type', 'checkbox')
          .each(function() { this.checked = d.active; })
          .classed('cell-check', true)
          .on('change', ref.checkActive.bind(ref));

        s.append('span')
          .classed('source__shortname', true)
          .text(d.short);

        s.append('div')
          .classed('source__evidence', true)
          .append('svg');

        s.append('div')
          .classed('source__count', true)
          .append('svg');
      });
  }
};
