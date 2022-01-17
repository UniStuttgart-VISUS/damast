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
  private hierarchy_: d3.HierarchyPointNode<T.OwnHierarchyNode>;
  private filter: ReligionFilter.ReligionFilter = true;
  private display_mode: T.DisplayMode = T.DisplayMode.Religion;

  //private dataset: Dataset;
  private counts: any = null;

  private checkbox_block: CheckboxBlock;
  private checkbox_space_right: number = 0;

  private checkboxes_last_saved_state: Array<Array<number>> = [];
  private filter_mode_last_saved_state: boolean = false;

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
      this.filter_mode.on('change', this.on_check.bind(this));
    });

    container.on('resize', () => {
      this.repaint();
      this.redo_checkboxes(this.filter);
    });
  }

  linkData(data: number[] | null) {
    this.linkHierarchy(data);
  }

  setData(data: {hierarchy: d3.HierarchyNode<T.OwnHierarchyNode>, areas: any, filter: ReligionFilter.ReligionFilter, display_mode: T.DisplayMode}) {
    this.display_mode = data.display_mode;
    this.filter = data.filter;
    this.data(data.hierarchy.data, data.filter);
    this.update(data.areas);

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
    const numCols = filter === true || filter.type === 'simple'
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
      .style('--node-height', d => d.depth - 1)
      .style('--node-index', (_, i) => i + 1)
      .attr('preserveAspectRatio', 'none')
      .attr('viewBox', '0 0 1 1')
      .attr('height', '1.2em')
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
        ref.on_brush(ref, d, d3.select(this));
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
        .attr('checked', ([d, col]) => (filter === true
            ? true
            : filter.type === 'simple'
              ? col === 0 ? filter.filter.includes(d.data.id) : false
              : filter.filter[col].includes(d.data.id)
          ) ? '' : null
        );
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
        .html('<i class="fa fa-fw fa-lg fa-plus"></i>');
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
        .html('<i class="fa fa-fw fa-lg fa-trash"></i>');
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
        });
    allButtons.exit().remove();
  }

  data(d: T.OwnHierarchyNode, filter: ReligionFilter.ReligionFilter): void {
    const {padding_left_right, padding_top, padding_bottom, w, h} = this.spacing();
    const hierarchy : d3.HierarchyNode<T.OwnHierarchyNode> = d3.hierarchy(d);
    const cluster = d3.cluster<T.OwnHierarchyNode>().size([h, w]);
    this.hierarchy_ = cluster(hierarchy);

    const step = (w-90)/3;
    this.hierarchy_.each(d => {
      d.y = step * d.data.level;

      d.x += padding_top;
      d.y += padding_left_right;
    });

    this.repaint();
    this.redo_checkboxes(filter);

    this.checkboxes_last_saved_state = this.checkbox_block.data;
    this.check_active();
  }

  // TODO: clean up checkbox sizing, maybe move to CSS+HTML as much as possible, like with confidence and sources
  private redo_checkboxes(filter: ReligionFilter.ReligionFilter) {
    // create checkbox rows
    const y_spacings = (this.g.selectAll('.hierarchy-node') as d3.Selection<SVGGElement, {node: d3.HierarchyNode<T.OwnHierarchyNode>, y: number, height: number}, any, any>)
      .data()
      .map(d => {
        return {
          y: d.y,
          height: d.height,
          religion_id: d.node.data.id
        };
      });

    this.g.selectAll('.checkbox-block').remove();
    if (y_spacings.length === 0) return;

    const checkboxes = this.g.append('g').classed('checkbox-block', true);
    this.checkbox_block = new CheckboxBlock(y_spacings, checkboxes, this.shift.bind(this), this.check_active.bind(this));

    // box
    if (filter === true) {
      // do nothing
    } else if (ReligionFilter.isSimpleReligionFilter(filter)) {
      this.checkbox_block.clear();
      filter.filter.forEach(id => this.checkbox_block.setAt(0, id, true));

      this.checkbox_block.rerender();
    } else {
      this.checkbox_block.trim_to_first();
      this.checkbox_block.clear();
      filter.filter.slice(1).forEach(() => this.checkbox_block.addColumn());
      filter.filter.forEach((alt, i) => alt.forEach(id => this.checkbox_block.setAt(i, id, true)));

      this.checkbox_block.rerender();
    }
  }

  private enable_apply_button(enable: boolean): void {
    this.apply_button.node().disabled = !enable;
    this.setHasChanges(enable);
  }

  private check_active(): void {
    if (!this.checkbox_block) return;

    const cmp_inner = (a1: Array<number>, a2: Array<number>) => {
      if (a1.length !== a2.length) return false;
      return R.all(([a,b]) => a===b, R.zip(a1, a2));
    };
    const cmp_outer = (a1: Array<Array<number>>, a2: Array<Array<number>>) => {
      if (a1.length !== a2.length) return false;
      return R.all(([a,b]) => cmp_inner(a, b), R.zip(a1, a2));
    };

    const state = this.checkbox_block.data;
    const button_enabled = 
      this.filter_mode.node().checked !== this.filter_mode_last_saved_state
      || !cmp_outer(state, this.checkboxes_last_saved_state);
    this.enable_apply_button(button_enabled);

    const simple_mode = !this.filter_mode.node().checked;
    this.g.classed('hierarchy--simple-mode', simple_mode);
  }

  private on_apply(): void {
    const state = this.checkbox_block.data;
    this.checkboxes_last_saved_state = state;
    const filter_mode_changed = this.filter_mode_last_saved_state !== this.filter_mode.node().checked;
    this.filter_mode_last_saved_state = this.filter_mode.node().checked;
    this.enable_apply_button(false);

    const simple = this.filter_mode.node().checked === false;
    let filter;
    if (simple) {
      filter = {
        simple: true,
        religion_ids: this.checkbox_block.data[0]
      };
    } else {
      filter = {
        simple: false,
        religion_ids: this.checkbox_block.data
      };
    }

    this.sendToDataThread('set-filter', filter);
  }

  private on_check(): void {
    const simple = this.filter_mode.node().checked === false;
    if (simple) this.checkbox_block.trim_to_first();
    else this.checkbox_block.clear();

    this.checkboxes_last_saved_state = [];

    this.check_active();
  }

  hierarchy(): d3.HierarchyNode<T.OwnHierarchyNode> {
    return this.hierarchy_;
  }

  paint() {
    this.repaint();
  }

  private shift(right_neighbor_width: number): number {
    this.checkbox_space_right = right_neighbor_width;
    this.repaint();
    const {w, padding_left_right, text_space_left} = this.spacing();
    return w + 2*padding_left_right + text_space_left;
  }

  private update(counts: {}) {
    const ref = this;
    this.counts = counts;

    (this.g.selectAll('.hierarchy-node') as d3.Selection<SVGGElement, {node: d3.HierarchyNode<T.OwnHierarchyNode>, width: number, height: number}, any, any>)
      .each(function({node, width, height}) {
        const data = counts[node.data.id];
    
        const scale = d3.scaleLinear<number, number>()
          .range([0, width]);
    
        const sel = d3.select(this)
          .select('.hierarchy-node__rects')
          .selectAll('.hierarchy-node__area')
          .data(data) as d3.Selection<SVGRectElement, any, any, any>;
        sel.enter()
          .append('rect')
          .classed('hierarchy-node__area', true)
          .merge(sel)
          .classed('hierarchy-node__area--active', d => d.type === 0)
          .classed('hierarchy-node__area--no-data', d => d.type === 1)
          .classed('hierarchy-node__area--inactive', d => d.type === 2)
          .attr('x', d => scale(d.offset))
          .attr('y', 0)
          .attr('width', d => scale(d.amount))
          .attr('height', height)
          .attr('fill', d => d.type === 1 ? null : d.color);
        sel.exit().remove();
      });
  }

  private linkHierarchy(religion_ids: number[] | null): void {
    if (religion_ids === null) {
      this.g.select('.indented-tree').classed('indented-tree--brushed', false);
      this.g.selectAll('.hierarchy-node')
        .classed('hierarchy-node--brushed', false);
    } else {
      this.g.select('.indented-tree').classed('indented-tree--brushed', true);

      (this.g
        .selectAll('.hierarchy-node') as d3.Selection<SVGGElement, {node: {data: {id: number}}}, any, any>)
        .classed('hierarchy-node--brushed', d => religion_ids.includes(d.node.data.id));
    }
  }

  protected openModal(): void {
    modal.create_modal(
      400, 300,
      'Hierarchy of Religious Denominations',
      'religion-hierarchy.html'
    );
  }

  private spacing(): any {
    const padding_left_right = 10;
    const padding_top = 50;
    const padding_bottom = 10;
    const text_space_left = 30;
    const checkbox_space_right = this.checkbox_space_right;

    const bbox = this.svg.node().getBoundingClientRect();

    const w = Math.floor(bbox.width) - 2*padding_left_right - text_space_left - checkbox_space_right;
    const h = Math.floor(bbox.height) - padding_bottom - padding_top;

    return { padding_left_right, padding_top, padding_bottom, text_space_left, w, h };
  }

  private repaint() {
    if (this.hierarchy_ === undefined) return;

    const {padding_left_right, padding_top, padding_bottom, text_space_left, w, h } = this.spacing();

    let num_elems_hierarchy = 0;
    const incr = (_: any) => {
      num_elems_hierarchy++;
    };
    this.hierarchy_.children.forEach(child => child.descendants().forEach(incr));

    const y_scale = d3.scaleBand<number>()
      .domain(d3.range(1, num_elems_hierarchy+1))
      .rangeRound([padding_top, padding_top + h])
      .paddingInner(0.2);

    const x_scale = d3.scaleBand<number>()
      .domain(d3.range(1, d3.max(this.hierarchy_.descendants().map(d => d.depth)) + 1))
      .range([padding_left_right + text_space_left, padding_left_right + text_space_left + w]);

    let i = 1;
    const nodes = [];
    const add_node = (child: d3.HierarchyNode<T.OwnHierarchyNode>) => {
      nodes.push({
        node: child,
        vertical_index: i,
        x: x_scale(child.depth),
        y: y_scale(i),
        width: x_scale.bandwidth(),
        height: y_scale.bandwidth()
      });
      ++i;
      child.children && child.children.forEach(add_node);
    };

    this.hierarchy_.children.forEach(add_node);

    const ref = this;
    this.g.select('g.indented-tree').remove();
    const sel = this.g.append('g')
      .classed('indented-tree', true)
      .selectAll('rect')
      .data(nodes);
    const sel_enter = sel.enter()
      .append('g')
      .classed('hierarchy-node', true)
      .each(function(d: any) {
        const g = d3.select(this) as d3.Selection<SVGGElement, {
            node: d3.HierarchyNode<T.OwnHierarchyNode>,
            x: number,
            y: number,
            height: number,
            width: number
          }, any, any>;
        g.append('rect')
          .classed('hierarchy-node__background', true)
          .attr('x', d => d.x)
          .attr('y', d => d.y)
          .attr('width', d => d.width)
          .attr('height', y_scale.step());
        const rect_group = g.append('g')
          .classed('hierarchy-node__rects', true)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);
        rect_group
          .append('rect')
          .classed('hierarchy-node__area', true)
          .attr('width', d => d.width)
          .attr('height', d => d.height);
        g.append('text')
          .text(d.node.data.abbreviation)
          .attr('x', d => d.x - 5)
          .attr('y', d => d.y + 0.5 * d.height)
          .attr('dy', '0.3em')
          .attr('font-size', 'x-small')
          .attr('text-anchor', 'end');

        // append icon if top of hierarchy
        if (d.node.depth === 1) {
          // TODO
          const symbol_id = '#undefined'; //ref.dataset.symbol_lookup.get(d.node.data.id);
          const x = d.x - 15;
          const y = d.y + d.height + 5;
          d3.select(this)
            .style('--clr-icon', 'white')
            .append('use')
            .attr('href', symbol_id || '#undefined')
            .attr('transform', `translate(${x}, ${y}) scale(0.15)`);
        }
      })
      .on('click', function(_, d) {
        ref.on_brush(ref, d, d3.select(this));
      })
      .on('mouseenter', (e, d) => {
        this.tooltipManager.create(t => {
          t.move({ x: e.clientX, y: e.clientY });
          t.root.append('h1')
            .text(d.node.data.name);

          const c: { type: number, count: number, value: any }[] = this.counts[d.node.data.id];
          const total = c.reduce((a: number, d) => a + d.count, 0);
          const active = c.filter(d => d.type === 0).reduce((a: number, d) => a + d.count, 0);
          if (this.display_mode === T.DisplayMode.Religion) {
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
        this.tooltipManager.cancel();
      })
      .on('mousemove', e => this.tooltipManager.move(e.clientX, e.clientY));
    if (this.counts !== null) this.update(this.counts);
  }

  private on_brush(
    ref: ReligionHierarchy,
    datum: {node: d3.HierarchyNode<T.OwnHierarchyNode>},
    sel: d3.Selection<SVGGElement, {node: d3.HierarchyNode<T.OwnHierarchyNode>}, any, any>
  ): void {
    const is_brushed = sel.classed('hierarchy-node--brushed');

    if (is_brushed) {
      this.sendToDataThread('clear-brush', null);
    } else {
      this.sendToDataThread('set-brush', [datum.node.data.id]);
    }
  }
};



interface ReligionSpacing {
  y: number;
  height: number;
  religion_id: number;
};

class CheckboxBlock {
  private _checkbox_columns: Array<CheckboxColumn> = [];
  private _spacings: Array<ReligionSpacing> = [];
  private _single_width: number = 10;
  private _gap: number = 2;

  private _x_offset: number = 0;

  private _parent: d3.Selection<SVGGElement, any, any, any>;

  private _neighbor_width_callback: (own_width: number) => number;
  private _check_active_callback: () => void;

  constructor(spacings: Array<ReligionSpacing>,
    parent: d3.Selection<SVGGElement, any, any, any>,
    cb: (own_width: number) => number,
    check_active_cb: () => void
  ) {
    this._spacings = spacings;
    this._parent = parent;
    this._neighbor_width_callback = cb;
    this._check_active_callback = check_active_cb;

    const height = this._spacings[0].height;
    const width = height;
    const gap = this._spacings[1].y - (this._spacings[0].height + this._spacings[0].y);
    this._single_width = width;
    this._gap = gap;

    this.init();
  }

  get data(): Array<Array<number>> {
    return this._checkbox_columns.map(d => d.data);
  }

  private shift(): void {
    this._x_offset = this._neighbor_width_callback(this.width);
    this.rearrange_columns();
  }

  private init(): void {
    this.addColumn(0, true);
  }

  rerender() {
    this._parent.selectAll<SVGGElement, Checkbox>('.checkbox')
      .each(function() {
        Checkbox.render(d3.select(this));
      });
  }

  addColumn(idx: number = 0, initial=false): void {
    const cc = new CheckboxColumn(
      this._spacings,
      0,
      this._single_width,
      this._parent.append('g').classed('checkbox-column', true),
      this.remove.bind(this),
      this.add.bind(this),
      this._check_active_callback,
      initial
    );
    this._checkbox_columns.splice(idx, 0, cc);
    this.shift();
    this._check_active_callback();
  }

  private rearrange_columns(): void {
    const total_width = this.width;
    this._checkbox_columns.forEach((column, idx) => {
      column.setX(this._x_offset + (idx+1) * this._gap + idx * this._single_width, this._single_width);
    });
  }

  trim_to_first(): void {
    while (this.canRemoveLastColumn()) this._checkbox_columns.pop().remove();
    //this._checkbox_columns.forEach(c => c.set_all());
    this.shift();
    this._check_active_callback();
  }

  clear(): void {
    this._checkbox_columns[0].clear();
  }

  removeLastColumn(): void {
    if (this._checkbox_columns.length < 2) return;
    this._checkbox_columns.pop().remove();
    this.shift();
    this._check_active_callback();
  }

  private remove(c: CheckboxColumn): void {
    if (this._checkbox_columns.length < 2) return;
    c.remove();
    const idx = this._checkbox_columns.indexOf(c);
    this._checkbox_columns.splice(idx, 1);
    this.shift();
    this._check_active_callback();
  }

  private add(c: CheckboxColumn): void {
    const idx = this._checkbox_columns.indexOf(c);
    this.addColumn(idx+1);
    this._check_active_callback();
  }

  canRemoveLastColumn(): boolean {
    return this._checkbox_columns.length > 1;
  }

  get width(): number {
    return (this._gap + this._single_width) * this._checkbox_columns.length + this._gap;
  }

  set x_offset(yoff: number) {
    this._x_offset = yoff;
    this.rearrange_columns();
  }

  setAt(column, row, value) {
    this._checkbox_columns[column].setAt(row, value);
  }
};

class CheckboxColumn {
  private _spacings: Array<ReligionSpacing> = [];
  private _column_position: number;
  private _column_width: number;

  private _checkboxes: Array<Checkbox> = [];

  private _selection: d3.Selection<SVGGElement, Checkbox, any, any>;

  constructor(spacings, x, w, selection, rm_fn, add_fn, action_cb, initial=false) {
    this._spacings = spacings;
    this._selection = selection;
    this._column_position = x;
    this._column_width = w;

    this.init(rm_fn, add_fn, action_cb, initial);
  }

  private init(rm_fn, add_fn, action_cb, initial) {
    this._checkboxes = this._spacings.map(d => new Checkbox(
      this._column_position,
      d.y,
      this._column_width,
      d.height,
      initial,
      true,
      d.religion_id
    ));

    let sel = (this._selection.selectAll('.checkbox') as d3.Selection<SVGGElement, Checkbox, any, any>)
      .data(this._checkboxes);
    sel.enter()
      .append('g')
      .classed('checkbox', true)
      .merge(sel)
      .each(function() {
        Checkbox.render(d3.select(this));
      })
      .on('click', function(_, d) {
        d.toggle();
        Checkbox.render(d3.select(this));
        action_cb();
      });
    sel.exit().remove();

    const del = this._selection.append('g')
      .classed('checkbox-column__remove-button', true)
      .classed('checkbox-column__button', true)
      .on('click', () => {
        rm_fn(this);
      })
      .attr('transform', `translate(${this._column_position + 0.5 * this._column_width}, 25)`);
    del.append('use')
      .attr('href', '#undefined')
      .attr('transform', 'scale(0.15)');
    del.append('rect')
      .attr('x', -this._column_width/2)
      .attr('y', -this._column_width/2)
      .attr('width', this._column_width)
      .attr('height', this._column_width)
      .attr('opacity', 0);

    const add = this._selection.append('g')
      .classed('checkbox-column__add-button', true)
      .classed('checkbox-column__button', true)
      .on('click', () => {
        add_fn(this);
      })
      .attr('transform', `translate(${this._column_position + 0.5 * this._column_width}, 10)`);
    add.append('use')
      .attr('href', '#undefined')
      .attr('transform', 'scale(0.12) rotate(45)');
    add.append('rect')
      .attr('x', -this._column_width/2)
      .attr('y', -this._column_width/2)
      .attr('width', this._column_width)
      .attr('height', this._column_width)
      .attr('opacity', 0);

    const inv = this._selection.append('g')
      .classed('checkbox-column__invert-button', true)
      .classed('checkbox-column__button', true)
      .on('click', () => {
        this.invert(action_cb);
      })
      .attr('transform', `translate(${this._column_position + 0.5 * this._column_width}, 40)`);
    inv.append('text')
      .text('!')
      .attr('dy', '6px')
      .attr('text-anchor', 'middle')
      .attr('stroke', 'var(--clr-yellow)')
      .attr('fill', 'var(--clr-yellow)');
    inv.append('rect')
      .attr('x', -this._column_width/2)
      .attr('y', -this._column_width/2)
      .attr('width', this._column_width)
      .attr('height', this._column_width)
      .attr('opacity', 0);
  }

  remove(): void {
    this._selection.remove();
  }

  invert(cb): void {
    this._checkboxes.forEach(d => d.toggle());
    this._selection.selectAll('.checkbox')
      .each(function(d: Checkbox) {
        Checkbox.render(d3.select(this) as d3.Selection<SVGGElement, any, any, any>);
      });
    cb();
  }

  clear(): void {
    this._checkboxes.forEach(d => d.clear());
    this._selection.selectAll('.checkbox')
      .each(function(d: Checkbox) {
        Checkbox.render(d3.select(this) as d3.Selection<SVGGElement, any, any, any>);
      });
  }

  set_all(): void {
    this._checkboxes.forEach(d => d.set_active());
    this._selection.selectAll('.checkbox')
      .each(function(d: Checkbox) {
        Checkbox.render(d3.select(this) as d3.Selection<SVGGElement, any, any, any>);
      });
  }

  setAt(row, value): void {
    let idx = -1;
    this._spacings.forEach((spc, i) => {
      if (spc.religion_id === row) idx = i;
    });

    if (value) this._checkboxes[idx].set_active();
    else this._checkboxes[idx].clear();
  }

  get data(): Array<number> {
    return (this._selection.selectAll('.checkbox') as d3.Selection<SVGGElement, Checkbox, any, any>)
      .data()
      .filter(d => d.checked)
      .map(d => d.religion_id);
  }

  setX(x: number, width: number): void {
    this._column_position = x;
    this._column_width = width;

    this._selection.selectAll('.checkbox')
      .each(function(d: Checkbox) {
        d.x = x;
        d.w = width;
        Checkbox.render(d3.select(this) as d3.Selection<SVGGElement, any, any, any>);
      });

    this._selection.select('.checkbox-column__button')
      .select('rect')
      .attr('x', -this._column_width/2)
      .attr('y', -this._column_width/2)
      .attr('width', this._column_width)
      .attr('height', this._column_width);
    this._selection.select('.checkbox-column__invert-button')
      .attr('transform', `translate(${this._column_position + 0.5 * this._column_width}, 40)`);
    this._selection.select('.checkbox-column__remove-button')
      .attr('transform', `translate(${this._column_position + 0.5 * this._column_width}, 25)`);
    this._selection.select('.checkbox-column__add-button')
      .attr('transform', `translate(${this._column_position + 0.5 * this._column_width}, 10)`);
  }
};

class Checkbox {
  private _x: number;
  private _y: number;
  private _w: number;
  private _h: number;

  private _checked: boolean;
  private _enabled: boolean;

  private _religion_id: number;

  constructor(x: number, y: number, w: number, h: number, checked: boolean, enabled: boolean, religion_id: number) {
    this._x = x;
    this._y = y;
    this._w = w;
    this._h = h;
    this._checked = checked;
    this._enabled = enabled;
    this._religion_id = religion_id;
  }

  static render(elem: d3.Selection<SVGGElement, Checkbox, any, any>): void {
    const data = elem.datum();
    elem.selectAll('*').remove();
    elem.classed('checkbox', true)
      .classed('checkbox--disabled', d => !d.enabled);
    elem.append('rect')
      .classed('checkbox__rectangle', true)
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('width', d => d.w)
      .attr('height', d => d.h);
    if (data.checked) {
      const cross: [number, number][][] = [
        [[data.x, data.y], [data.x+data.w, data.y+data.h]],
        [[data.x, data.y+data.h], [data.x+data.w, data.y]]
      ];
      const path = d3.line()
        .x(d => d[0])
        .y(d => d[1]);
      elem.selectAll<SVGPathElement, [number, number][]>('.dummy')
        .data(cross)
        .enter()
        .append('path')
        .classed('checkbox__cross', true)
        .attr('d', path);
    }
  }

  toggle(): void {
    this._checked = !this._checked;
  }

  clear(): void {
    this._checked = false;
  }

  set_active(): void {
    this._checked = true;
  }

  disable(): void {
    this._enabled = false;
  }

  enable(): void {
    this._enabled = true;
  }

  get religion_id(): number {
    return this._religion_id;
  }

  get x(): number {
    return this._x;
  }
  set x(x: number) {
    this._x = x;
  }

  get y(): number {
    return this._y;
  }
  set y(y: number) {
    this._y = y;
  }

  get w(): number {
    return this._w;
  }
  set w(w: number) {
    this._w = w;
  }

  get h(): number {
    return this._h;
  }
  set h(h: number) {
    this._h = h;
  }

  get checked(): boolean {
    return this._checked;
  }
  set checked(checked: boolean) {
    this._checked = checked;
  }

  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(enabled: boolean) {
    this._enabled = enabled;
  }
};
