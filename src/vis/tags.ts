import * as d3 from 'd3';
import {Dataset,ChangeScope} from './dataset';
import {confidence_aspects} from './confidence-aspects';
import * as T from './datatypes';
import {ColorScales} from './colorscale';
import * as modal from './modal';
import {SourceTuple} from './timeline-data';
import View from './view';
import {SourceWithPayload,CountStackDatum} from './source-data';
import TooltipManager from './tooltip';
import { tags } from './html-templates';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';
import { TagFilter } from './tag-filter';


export default class TagsPane extends View<any, any> {
  private div: d3.Selection<HTMLDivElement, any, any, any>;
  private body: d3.Selection<HTMLDivElement, any, any, any>;

  private sort_mode_checkbox: HTMLInputElement;
  private sort_mode: T.SourceViewSortMode = T.SourceViewSortMode.ByCountDescending;

  private _tag_filter: TagFilter;
  private _tags: Array<T.TagData> = [];
  private readonly tooltipManager = new TooltipManager();

  constructor(
    worker: Worker,
    container: GoldenLayout.ComponentContainer,
  ) {
    super(worker, container, 'tags');

    const div = container.element as HTMLDivElement;

    div.classList.add('tags-container');
    div.innerHTML = tags;
    this.div = d3.select(div);
    this.body = this.div.select('.tags__body');

    this.sort_mode_checkbox = this.div.select<HTMLInputElement>('#tags-sort-mode').node();
    this.sort_mode_checkbox.checked = this.sort_mode === T.SourceViewSortMode.ByCountDescending;
    this.sort_mode_checkbox.addEventListener('input', (evt) => {
      this.sort_mode = this.sort_mode_checkbox.checked
        ? T.SourceViewSortMode.ByCountDescending
        : T.SourceViewSortMode.ByShortNameAscending;
      this.resort();
    });
  }

  async linkData(data: any) {
    const sel = this.body
      .classed('tags__body--linked', data !== null)
      .selectAll<HTMLDivElement, T.TagData>('.tag');
    if (data === null) {
      sel.classed('tag--linked', false);
    }
    else sel.classed('tag--linked', d => data.has(d.id));
  }

  private resort() {
    const comparator = this.sort_mode === T.SourceViewSortMode.ByCountDescending
      ? (a: T.TagData, b: T.TagData) => (b.active_count - a.active_count) || (b.active_count + b.inactive_count - a.active_count - a.inactive_count)
      : (a: T.TagData, b: T.TagData) => a.name.localeCompare(b.name);
    this.body.selectAll<HTMLDivElement, T.TagData>('.tag')
      .sort(comparator)
  }

  async setData(data: {tags: T.TagData[], maximum: number, tag_filter: TagFilter}) {
    const {tags, maximum, tag_filter} = data;
    this._tag_filter = tag_filter;
    this._tags = tags;

    this.initButtons();
    this.createElements(tags);
    this.checkActive();
    this.resort();

    const scale = d3.scaleLinear()
      .domain([0, maximum]);

    const sel = this.body
      .selectAll<HTMLDivElement, T.TagData>('.tag')
      .data(tags, d => `${d.id}`);
    sel.enter()
      .each(d => console.error('Illegal enter():', d));
    sel.exit()
      .each(d => console.error('Illegal exit():', d));

    const fmt = d3.format(',d');
    sel.selectAll<HTMLSpanElement, T.TagData>('.tag__count')
      .text(d => fmt(d.active_count));

    // Count of evidences
    sel.selectAll('.tag__bar')
      .each(function(d: T.TagData) {
        const active = d.active_count;
        const inactive = d.inactive_count;

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
          .attr('width', scale(inactive))
          .attr('fill', 'var(--clr-fg)');
      });
  }

  protected openModal() {
    modal.showInfoboxFromURL('Evidence Tags', 'tags.html');
  }

  private initButtons(): void {
    d3.select('#tags-filter-apply').on('click', () => this.onApply());
    d3.select('#tags-filter-none').on('click', () => this.checkNone());
    d3.select('#tags-filter-invert').on('click', () => this.invertAll());
    d3.select('#tags-filter-all').on('click', () => this.checkAll());
  }

  private collectSelected(): Set<number> {
    return new Set<number>(
      this.body
        .selectAll<HTMLDivElement, any>('.tag')
        .selectAll<HTMLDivElement, any>('.tag__checkbox')
        .selectAll<HTMLInputElement, any>('input')
        .filter(function() { return this.checked; })
        .data()
        .map(d => d.id)
    );
  }

  private checkActive(): void {
    const selected = this.collectSelected();
    let unchanged = true;

    if (selected.size === this._tags.length && this._tag_filter === true) unchanged = true;
    else if (selected.size === 1 && typeof this._tag_filter === 'number' && !selected.has(this._tag_filter)) unchanged = false;
    else if (selected.size !== 1 && (typeof this._tag_filter === 'number' || typeof this._tag_filter === 'boolean')) unchanged = false;
    else if (typeof this._tag_filter === 'object') {
      unchanged = Array.from(this._tag_filter).every(d => selected.has(d))
        && Array.from(selected).every(d => (this._tag_filter as Set<number>).has(d));
    }

    d3.select('#tags-filter-apply')
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
    this.body
      .selectAll<HTMLDivElement, any>('.tag')
      .selectAll<HTMLDivElement, any>('.tag__checkbox')
      .selectAll<HTMLInputElement, any>('input')
      .each(function() {
        fn(this);
      });

    this.checkActive();
  }

  private onAllClick(event: Event, datum: T.Tag, elem: HTMLDivElement): void {
    // checkboxes_last_saved_state
    if ((event.target as HTMLElement).classList.contains('cell-check')) return;

    if (elem.classList.contains('tag--linked')) this.sendToDataThread('clear-brush', null);
    else this.sendToDataThread('set-brush', datum.id);
  }

  private onApply(): void {
    const selected = this.collectSelected();

    let filter: TagFilter;
    if (selected.size === 1) filter = Array.from(selected)[0];
    else if (selected.size === this._tags.length) filter = true;
    else filter = selected;

    this._tag_filter = filter;

    this.sendToDataThread('set-filter', filter);

    this.checkActive();
  }

  private createElements(tags: T.TagData[]): void {
    const ref = this;
    const sel = this.body;
    sel.selectAll('*').remove();
    sel.selectAll<HTMLDivElement, any>('.tag')
      .data(tags, d => `${d.id}`)
      .enter()
      .append('div')
      .classed('tag', true)
      .on('click', function(e, d) { ref.onAllClick(e, d, this); })
      .on('mouseenter', (e, d) => {
        this.tooltipManager.create(t => {
          t.move({ x: e.clientX, y: e.clientY });
          t.root.append('h1')
            .text(d.name);
          if (d.comment) t.root.append('p').text(d.comment);
          t.root.append('p')
            .text(`${d.active_count} / ${d.active_count + d.inactive_count} pieces of evidence`);
        });
      })
      .on('mousemove', e => this.tooltipManager.move(e.clientX, e.clientY))
      .on('mouseleave', () => this.tooltipManager.cancel())
      .each(function(d) {
        const s = d3.select(this);
        s.append('div')
          .classed('tag__checkbox', true)
          .append('input')
          .attr('type', 'checkbox')
          .each(function() {
            if (ref._tag_filter === true) this.checked = true;
            else this.checked = ((typeof ref._tag_filter === 'number' && ref._tag_filter === d.id)
              || (typeof ref._tag_filter === 'object' && ref._tag_filter.has(d.id)));
          })  // TODO
          .classed('cell-check', true)
          .on('change', ref.checkActive.bind(ref));

        s.append('span')
          .classed('tag__name', true)
          .text(d.name);

        s.append('span')
          .classed('tag__count', true);

        s.append('div')
          .classed('tag__bar', true)
          .append('svg');
      });
  }
};

