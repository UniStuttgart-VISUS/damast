import * as d3 from 'd3';
import * as T from './datatypes';
import * as R from 'ramda';
import {Dataset, ChangeScope} from './dataset';
import {confidence_keys} from './confidence-aspects';
import {ColorScales} from './colorscale';
import {SourceTuple} from './timeline-data';
import * as modal from './modal';
import View from './view';
import * as ReligionFilter from './religion-filter';
import TooltipManager from './tooltip';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

export default class ReligionHierarchy extends View<any, number[] | null> {
  private div: d3.Selection<HTMLDivElement, any, any, any>;
  private svg: d3.Selection<SVGSVGElement, any, any, any>;
  private g: d3.Selection<SVGGElement, any, any, any>;
  private hierarchy_: d3.HierarchyNode<T.OwnHierarchyNode>;
  private filter: ReligionFilter.ReligionFilter = true;
  private display_mode: T.DisplayMode = T.DisplayMode.Religion;

  private counts: any = null;

  private apply_button: d3.Selection<HTMLButtonElement, any, any, any>;
  private filter_mode: d3.Selection<HTMLInputElement, any, any, any>;

  private readonly tooltipManager = new TooltipManager(200);

  constructor(worker: Worker, container: GoldenLayout.Container) {
    super(worker, container, 'religion');

    const div = container.getElement()[0];

    div.classList.add('religion-container');
    div.innerHTML = require('html-loader!./html/religion.template.html').default;
    this.div = d3.select(div);

    this.svg = this.div.select('svg#hierarchy');
    this.g = this.svg.append('g');

    container.on('open', () => {
      this.apply_button = d3.select('#hierarchy-apply');
      this.filter_mode = d3.select('#hierarchy-filter-mode');

      this.filter_mode.node().checked = false;
      this.apply_button.on('click', this.on_apply.bind(this));
      this.filter_mode.on('change', this.checkStateIsChanged.bind(this));

      d3.select('#religion-filter-revert')
        .on('click', () => this.updateContent(this.hierarchy_.data, this.filter, this.counts));
    });
  }

  linkData(data: number[] | null) {
    this.linkHierarchy(data);
  }

  setData(data: {hierarchy: d3.HierarchyNode<T.OwnHierarchyNode>, areas: any, filter: ReligionFilter.ReligionFilter, display_mode: T.DisplayMode}) {
    this.display_mode = data.display_mode;
    this.filter = data.filter;
    this.counts = data.areas;
    this.hierarchy_ = d3.hierarchy<T.OwnHierarchyNode>(data.hierarchy.data);

    this.updateContent(data.hierarchy.data, data.filter, data.areas);
  }

  private updateContent(
    d: T.OwnHierarchyNode,
    filter: ReligionFilter.ReligionFilter,
    counts: any
  ): void {
    const ref = this;
    const h = d3.hierarchy(d);
    const religions = [];
    h.eachBefore(d => d.data.id !== 0 ? religions.push(d) : {});
    const religionIndices = new Map<number, number>();
    religions.forEach((d, i) => religionIndices.set(d.data.id, i))

    const depth = h.height;
    const numCols = (filter === true || filter.type === 'simple')
      ? 1
      : filter.filter.length;

    const parent = this.div.select('div.hierarchy');
    parent.style('--hierarchy-depth', depth)
      .style('--num-rows', religions.length)
      .style('--num-columns', numCols);

    // SVG elements (indented tree)
    const svgs = parent.selectAll<SVGSVGElement, d3.HierarchyNode<T.OwnHierarchyNode>>('svg')
      .data(religions);
    svgs.enter()
      .append('svg')
      .merge(svgs)
      .classed('hierarchy-node', true)
      .style('--node-height', d => d.depth - 1)
      .style('--node-index', (_, i) => i + 1)
      .attr('preserveAspectRatio', 'none')
      .attr('viewBox', '0 0 1 1')
      .attr('height', '1em')
      .each(function(d) {
        const rects = d3.select(this)
          .selectAll<SVGRectElement, any>('rect.hierarchy-node__area')
          .data(counts[d.data.id] as any[]);
        rects.enter()
            .append('rect')
            .classed('hierarchy-node__area', true)
          .merge(rects)
            .classed('hierarchy-node__area--active', d => d.type === 0)
            .classed('hierarchy-node__area--no-data', d => d.type === 1)
            .classed('hierarchy-node__area--inactive', d => d.type === 2)
            .attr('x', d => d.offset)
            .attr('y', 0)
            .attr('width', d => d.amount)
            .attr('height', 1)
            .attr('fill', d => d.type === 1 ? null : d.color);
        rects.exit().remove();
      })
      .on('click', function(_, d) {
        ref.onBrush(ref, d, d3.select(this));
      })
      .on('mouseenter', (e, d) => {
        ref.tooltipManager.create(t => {
          t.move({ x: e.clientX, y: e.clientY });
          t.root.append('h1')
            .text(d.data.name);

          const c: { type: number, count: number, value: any }[] = ref.counts[d.data.id];
          const total = c.reduce((a: number, d) => a + d.count, 0);
          const active = c.filter(d => d.type === 0).reduce((a: number, d) => a + d.count, 0);
          if (ref.display_mode === T.DisplayMode.Religion) {
            t.root.append('p')
              .text(`${active} / ${total} evidences`);

          } else {
            // add table
            const tb = t.root.append('table');
            const row = tb.append('tr');
            row.append('td').html(`<strong>Total:</strong>`);
            row.append('td').html(`<strong>${active} / ${total} evidences</strong>`);

            T.confidence_values.forEach(d => {
              const vals = c.filter(e => e.value === d);
              if (vals.length === 0) return;

              const total = vals.reduce((a: number, d) => a + d.count, 0);
              const active = vals.filter(d => d.type === 0).reduce((a: number, d) => a + d.count, 0);

              const row = tb.append('tr');
              row.append('td').html(d === null ? `<em>no value:</em>` : `${d}:`);
              row.append('td').text(`${active} / ${total} evidences`);
            });
          }
        });
      })
      .on('mouseleave', (e, d) => {
        ref.tooltipManager.cancel();
      })
      .on('mousemove', e => ref.tooltipManager.move(e.clientX, e.clientY));
    svgs.exit().remove();

    // indented tree labels
    const labels = parent.selectAll<HTMLSpanElement, d3.HierarchyNode<T.OwnHierarchyNode>>('span.religion-label')
      .data(religions);
    labels.enter()
        .append('span')
        .classed('religion-label', true)
      .merge(labels)
        .style('--node-height', d => d.depth - 1)
        .style('--node-index', (_, i) => i + 1)
        .text(d => d.data.abbreviation);
    labels.exit().remove();

    // normal checkboxes
    const checkdata: [d3.HierarchyNode<T.OwnHierarchyNode>, number][] = d3.cross(religions, d3.range(numCols));
    const checks = parent.selectAll<HTMLInputElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('input.cell-check')
      .data(checkdata);
    checks.enter()
        .append('input')
        .attr('type', 'checkbox')
        .classed('cell-check', true)
      .merge(checks)
        .style('--col-number', d => d[1])
        .style('--node-index', d => religionIndices.get(d[0].data.id) + 1)
        .each(function([d, col]) {
          this.checked = filter === true
            ? true
            : filter.type === 'simple'
              ? col === 0 ? filter.filter.includes(d.data.id) : false
              : filter.filter[col].includes(d.data.id);
        })
        .on('input', () => this.checkStateIsChanged());
    checks.exit().remove();

    // subtree checkboxes
    const subtree: [d3.HierarchyNode<T.OwnHierarchyNode>, number][] = d3.cross(
      religions.filter(d => d.children?.length),
      d3.range(numCols));
    const subtreeControls = parent.selectAll<HTMLButtonElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('button.subtree-toggle')
      .data(subtree);
    subtreeControls.enter()
        .append('button')
        .classed('button', true)
        .classed('button--small', true)
        .classed('subtree-toggle', true)
      .merge(subtreeControls)
        .style('--col-number', d => d[1])
        .style('--node-index', d => religionIndices.get(d[0].data.id) + 1)
        .html('<i class="fa fa-fw fa-lg fa-adjust"></i>')
        .attr('title', 'Toggle subtree')
        .on('click', (e, d) => {
          const relids = d[0].descendants().map(d => d.data.id);
          const nodes = parent.selectAll<HTMLInputElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('input.cell-check')
            .filter(d_ => d[1] === d_[1] && relids.includes(d_[0].data.id));

          // if more than half checked, uncheck
          const moreChecked = (nodes.filter(function() { return this.checked }).nodes().length) >= nodes.nodes().length/2;
          nodes.each(function() { this.checked = !moreChecked; });  // do in node to override manual check changes
          this.checkStateIsChanged();
        });
    subtreeControls.exit().remove();

    // add buttons
    const addButtons = parent.selectAll<HTMLButtonElement, number>('button.add-button')
      .data(d3.range(numCols));
    addButtons.enter()
        .append('button')
        .classed('button', true)
        .classed('button--small', true)
        .classed('header-button', true)
        .classed('add-button', true)
      .merge(addButtons)
        .style('--col-number', d => d)
        .attr('title', 'Add column after this')
        .html('<i class="fa fa-fw fa-lg fa-plus"></i>')
        .attr('disabled', this.isSimple() ? '' : null)
        .on('click', (e, column) => {
          if (this.isSimple()) {
            console.error('Should not be able to add column, in simple filter mode.');
            return;
          }

          const filter = this.getState() as (ReligionFilter.SimpleReligionFilter | ReligionFilter.ComplexReligionFilter);
          filter.filter.splice(column, 0, []);
          this.updateContent(this.hierarchy_.data, filter, this.counts);
        });
    addButtons.exit().remove();

    // remove buttons
    const removeButtons = parent.selectAll<HTMLButtonElement, number>('button.remove-button')
      .data(d3.range(numCols));
    removeButtons.enter()
        .append('button')
        .classed('button', true)
        .classed('button--small', true)
        .classed('header-button', true)
        .classed('remove-button', true)
      .merge(removeButtons)
        .style('--col-number', d => d)
        .attr('title', 'Remove this column')
        .html('<i class="fa fa-fw fa-lg fa-trash"></i>')
        .attr('disabled', numCols < 2 ? '' : null)
        .on('click', (e, column) => {
          if (numCols < 2) {
            console.error('Should not be able to remove column, last column.');
            return;
          }

          const filter = this.getState() as (ReligionFilter.SimpleReligionFilter | ReligionFilter.ComplexReligionFilter);
          filter.filter.splice(column, 1);
          this.updateContent(this.hierarchy_.data, filter, this.counts);
        });
    removeButtons.exit().remove();

    // clear buttons
    const noneButtons = parent.selectAll<HTMLButtonElement, number>('button.none-button')
      .data(d3.range(numCols));
    noneButtons.enter()
        .append('button')
        .classed('button', true)
        .classed('button--small', true)
        .classed('header-button', true)
        .classed('none-button', true)
      .merge(noneButtons)
        .style('--col-number', d => d)
        .attr('title', 'Uncheck all boxes in this column')
        .html('<i class="fa fa-fw fa-lg fa-circle-o"></i>')
        .on('click', (e, d) => {
          parent.selectAll<HTMLInputElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('input.cell-check')
            .filter(d_ => d === d_[1])
            .each(function() { this.checked = false; });  // deselect all
          this.checkStateIsChanged();
        });
    noneButtons.exit().remove();

    // invert buttons
    const invertButtons = parent.selectAll<HTMLButtonElement, number>('button.invert-button')
      .data(d3.range(numCols));
    invertButtons.enter()
        .append('button')
        .classed('button', true)
        .classed('button--small', true)
        .classed('header-button', true)
        .classed('invert-button', true)
      .merge(invertButtons)
        .style('--col-number', d => d)
        .attr('title', 'Invert all boxes in this column')
        .html('<i class="fa fa-fw fa-lg fa-rotate-90 fa-exchange"></i>')
        .on('click', (e, d) => {
          parent.selectAll<HTMLInputElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('input.cell-check')
            .filter(d_ => d === d_[1])
            .each(function() { this.checked = !this.checked; });  // invert all
          this.checkStateIsChanged();
        });
    invertButtons.exit().remove();

    // all buttons
    const allButtons = parent.selectAll<HTMLButtonElement, number>('button.all-button')
      .data(d3.range(numCols));
    allButtons.enter()
        .append('button')
        .classed('button', true)
        .classed('button--small', true)
        .classed('header-button', true)
        .classed('all-button', true)
      .merge(allButtons)
        .style('--col-number', d => d)
        .attr('title', 'Check all boxes in this column')
        .html('<i class="fa fa-fw fa-lg fa-dot-circle-o"></i>')
        .on('click', (e, d) => {
          parent.selectAll<HTMLInputElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('input.cell-check')
            .filter(d_ => d === d_[1])
            .each(function() { this.checked = true; });  // select all
          this.checkStateIsChanged();
        });
    allButtons.exit().remove();

    // at end, check
    this.checkStateIsChanged();
  }

  private isSimple(): boolean {
    return !this.filter_mode.node().checked;
  }

  private getState(): ReligionFilter.ReligionFilter {
    const parent = this.div.select('div.hierarchy');

    if (this.isSimple()) {
      const relIds = parent.selectAll<HTMLInputElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('.cell-check')
        .filter(function() { return this.checked; })
        .data()
        .map(d => d[0].data.id);

      return {
        type: 'simple',
        filter: relIds
      };
    }

    const numCols = parseInt(parent.style('--num-columns'));
    const relIds = d3.range(numCols)
      .map(d => parent.selectAll<HTMLInputElement, [d3.HierarchyNode<T.OwnHierarchyNode>, number]>('.cell-check')
        .filter(function(e) { return e[1] === d && this.checked; })
        .data()
        .map(d => d[0].data.id));

    return {
      type: 'complex',
      filter: relIds
    };
  }

  private checkStateIsChanged(): void {
    const allRelIds = this.hierarchy_.descendants()
      .filter(d => d.data.id !== 0)
      .map(d => d.data.id);
    const filter = this.getState();
    const filterUnchanged = ReligionFilter.equal(this.filter, filter, allRelIds);
    console.log(filter, filterUnchanged);
  }

  private on_apply(): void {
//    const state = this.checkbox_block.data;
//    this.checkboxes_last_saved_state = state;
//    const filter_mode_changed = this.filter_mode_last_saved_state !== this.filter_mode.node().checked;
//    this.filter_mode_last_saved_state = this.filter_mode.node().checked;
//    this.enable_apply_button(false);
//
//    const simple = this.filter_mode.node().checked === false;
//    let filter;
//    if (simple) {
//      filter = {
//        simple: true,
//        religion_ids: this.checkbox_block.data[0]
//      };
//    } else {
//      filter = {
//        simple: false,
//        religion_ids: this.checkbox_block.data
//      };
//    }
//
//    this.sendToDataThread('set-filter', filter);
  }

  private linkHierarchy(religion_ids: number[] | null): void {
    if (religion_ids === null) {
      const parent = this.div.select('div.hierarchy');
      parent.classed('hierarchy--linked', false);
      parent.selectAll('svg.hierarchy-node').classed('hierarchy-node--linked', false);
    } else {
      const parent = this.div.select('div.hierarchy');
      parent.classed('hierarchy--linked', true);
      parent.selectAll<SVGSVGElement, d3.HierarchyNode<T.OwnHierarchyNode>>('svg.hierarchy-node')
        .classed('hierarchy-node--linked', d => religion_ids.includes(d.data.id));
    }
  }

  protected openModal(): void {
    modal.create_modal(
      400, 300,
      'Hierarchy of Religious Denominations',
      'religion-hierarchy.html'
    );
  }

  private onBrush(
    ref: ReligionHierarchy,
    datum: d3.HierarchyNode<T.OwnHierarchyNode>,
    sel: d3.Selection<SVGGElement, {node: d3.HierarchyNode<T.OwnHierarchyNode>}, any, any>
  ): void {
    const is_brushed = sel.classed('hierarchy-node--linked');

    if (is_brushed) {
      this.sendToDataThread('clear-brush', null);
    } else {
      this.sendToDataThread('set-brush', [datum.data.id]);
    }
  }
};
