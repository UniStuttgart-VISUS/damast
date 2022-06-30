import * as d3 from 'd3';
import * as T from './datatypes';
import { Dataset, ChangeScope, ChangeListener } from './dataset';
import { PathInfoStack, stackKey } from './timeline-data';
import { ColorScales } from './colorscale';
import * as modal from './modal';
import View from './view';
import TooltipManager from './tooltip';
import * as DEFAULTS from './view-mode-defaults';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

const brush_height = 50;
const marginLeft = 40;
const marginBottom = 20;

const NO_TOOLTIP_ITEM_HIGHLIGHTED = Symbol();

export default class Timeline extends View<any, any> {
  private svg: d3.Selection<SVGSVGElement, any, any, any>;

  private axes_g: d3.Selection<SVGGElement, any, any, any>;
  private total_upper_g: d3.Selection<SVGGElement, any, any, any>;
  private total_data_g: d3.Selection<SVGGElement, any, any, any>;
  private brush_g: d3.Selection<SVGGElement, any, any, any>;
  private overview_g: d3.Selection<SVGGElement, any, any, any>;

  private upper_clip_path: d3.Selection<SVGClipPathElement, any, any, any>;

  private x: d3.ScaleLinear<number, number>;
  private y: d3.ScaleLinear<number, number>;

  private x_overview: d3.ScaleLinear<number, number>;
  private y_overview: d3.ScaleLinear<number, number>;

  private selectionRange: [number, number];
  private zoomDomain: [number, number];
  private totalDomain: [number, number];
  private totalYDomain: [number, number];

  private filterBrush: d3.BrushBehavior<any>;
  private zoomBrush: d3.BrushBehavior<any>;

  private cachedPathData: PathInfoStack;
  private religionNames: Map<number, string> = new Map<number, string>();
  private cachedDisplayMode: T.DisplayMode = DEFAULTS.display_mode;
  private cachedTimelineMode: T.TimelineMode = DEFAULTS.timeline_mode;

  private readonly tooltipManager = new TooltipManager(500);
  private isBrushing: boolean = false;

  private filterBrushMoved: boolean = false;
  constructor(worker: Worker, container: GoldenLayout.Container) {
    super(worker, container, 'timeline');

    const div = container.getElement()[0];

    div.classList.add('timeline-container');
    div.innerHTML = require('html-loader!./html/timeline.template.html').default;

    this.svg = d3.select(div).select('svg');

    container.on('resize', () => { if (this.cachedPathData !== undefined) this.paint(this.cachedPathData, true); });
    container.on('open', () => { this.init(); });
  }

  private init() {
    this.total_upper_g = this.svg.append('g');
    this.axes_g = this.svg.append('g');

    this.total_data_g = this.total_upper_g.append('g')
      .classed('stacked-histogram__total-group', true);
    this.brush_g = this.total_upper_g.append('g')
      .classed('stacked-histogram__brush-group', true);

    this.overview_g = this.svg.append('g')
      .classed('stacked-histogram__overview-group', true);

    this.upper_clip_path = this.svg.append('clipPath')
      .attr('id', 'upper-clip-path') as d3.Selection<SVGClipPathElement, any, any, any>;

    this.total_upper_g.attr('clip-path', 'url(#upper-clip-path)');

    const ref = this;
    d3.select<HTMLInputElement, any>('.timeline__header input#timeline-mode')
      .each(function() { this.checked = DEFAULTS.timeline_mode === T.TimelineMode.Qualitative; })
      .on('change', function() {
        ref.sendToDataThread('set-timeline-mode', this.checked ? T.TimelineMode.Qualitative : T.TimelineMode.Quantitative);
      });
  }

  async setData(data: any) {
    this.selectionRange = data.time_filter;
    this.cachedDisplayMode = data.display_mode;
    this.cachedTimelineMode = data.timeline_mode;
    this.religionNames = data.religion_names;

    d3.select<HTMLInputElement, any>('.timeline__header input#timeline-mode')
      .each(function() { this.checked = data.timeline_mode === T.TimelineMode.Qualitative; });

    this.paint(data.stack);
  }

  async linkData(data: any) {
    console.log('link-data', data);
  }

  private zoomTo(xRange: [number, number] | null) {
    if (!xRange) {
      this.zoomDomain = null;
      this.paint(this.cachedPathData, true);
    } else {
      this.zoomToDomain(xRange.map(this.x_overview.invert) as [number, number]);
    }
  }

  private zoomToDomain(xDomain: [number, number]) {
    this.zoomDomain = xDomain;
    this.paint(this.cachedPathData, true);
  }

  private createOverview(data: PathInfoStack, w: number, h: number) {
    const h0 = h - brush_height;
    const xrange = this.x.range();
    const yrange = [ h0 + brush_height - marginBottom, h0 ];

    this.x_overview = d3.scaleLinear()
      .domain(data.span_x)
      .range(xrange);
    this.y_overview = d3.scaleLinear()
      .domain(data.span_y_overview)
      .range(yrange);

    const area = d3.area<number>()
      .curve(d3.curveStep)
      .x((_, i) => this.x_overview(data.xs[i]))
      .y0(_ => this.y_overview(0))
      .y1(d => this.y_overview(d));

    let s = this.overview_g.selectAll('path')
      .data([ data.overview ]) as d3.Selection<SVGPathElement, any, any, any>;
    s.enter()
      .append('path')
      .merge(s)
      .attr('d', area)
      .attr('fill', 'var(--clr-accent)');
    s.exit().remove();

    this.timeFilterIndicator([0,0]);

    // axes
    this.axes_g.select('#x-axis-overview').remove();
    this.axes_g.select('#y-axis-overview').remove();

    let xAxis = d3.axisBottom(this.x_overview);
    this.axes_g.append('g')
      .attr('id', 'x-axis-overview')
      .classed('x-axis', true)
      .classed('axis', true)
      .attr('transform', 'translate(0,' + yrange[0] + ')')
      .call(xAxis);

    let yAxis = d3.axisLeft(this.y_overview)
      .tickValues(data.span_y_overview)
      .tickFormat(d3.format('.0f'));
    this.axes_g.append('g')
      .attr('id', 'y-axis-overview')
      .classed('y-axis', true)
      .classed('axis', true)
      .attr('transform', 'translate(' + marginLeft + ', 0)')
      .call(yAxis);

    this.overview_g.selectAll('.brush').remove();
    this.zoomBrush = d3.brushX()
      .extent([[xrange[0], yrange[1]], [xrange[1], yrange[0]]]);
    let brush_g = this.overview_g.append('g')
      .classed('brush', true)
      .call(this.zoomBrush)
      .call(this.zoomBrush.move, undefined);

    if (this.zoomDomain) this.zoomBrush.move(brush_g,
      [this.x_overview(this.zoomDomain[0]),this.x_overview(this.zoomDomain[1])]);

    this.zoomBrush.on('brush', () => null);
    this.zoomBrush.on('end', (e) => this.zoomTo(e.selection));

    this.svg.on('mouseenter', this.onMouseEnter.bind(this));
    this.svg.on('mousemove', this.onMouseMove.bind(this));
    this.svg.on('mouseleave', this.onMouseLeave.bind(this));
  }

  private timeFilterIndicator(data: [number, number]): void {
    // if the entire time span is filtered (=no filter), do not show the indicator
    const noFilter = JSON.stringify(this.totalDomain) === JSON.stringify(data);
    const h0 = this._cached_bbox.height - brush_height;

    let r = this.overview_g.selectAll('rect.overview-filter-indicator')
      .data([data]) as d3.Selection<SVGRectElement, any, any, any>;
    r.enter()
      .append('rect')
      .classed('overview-filter-indicator', true)
      .merge(r)
      .attr('x', d => this.x_overview(d[0]))
      .attr('y', h0 + brush_height - marginBottom + 1)
      .attr('height', 5)
      .attr('width', d => this.x_overview(d[1]) - this.x_overview(d[0]))
      .attr('fill', 'white')
      .attr('opacity', noFilter ? 0 : 0.6);
  }

  private _cached_bbox: DOMRect = null;
  private paint(d2: any, repaint=false) {
    this.cachedPathData = d2;

    let bbox = this.svg.node().getBoundingClientRect();
    if (this._cached_bbox !== null && bbox.width === 0 && bbox.height === 0) bbox = this._cached_bbox;
    this._cached_bbox = bbox;

    const w = Math.floor(bbox.width);
    const h = Math.floor(bbox.height) - brush_height;

    this.upper_clip_path.selectAll("*").remove();

    this.totalDomain = d2.span_x;

    this.x = d3.scaleLinear()
      .clamp(false)
      .domain(this.zoomDomain ? this.zoomDomain : d2.span_x)
      .range([marginLeft, w-20]);
    this.totalYDomain = d2.span_y;
    this.y = d3.scaleLinear()
      .domain(d2.span_y)
      .range([h-marginBottom, 5]);

    this.upper_clip_path.append('rect')
      .attr('x', this.x.range()[0])
      .attr('width', this.x.range()[1] - this.x.range()[0])
      .attr('y', this.y.range()[1])
      .attr('height', this.y.range()[0] - this.y.range()[1] + 1);

    const area = d3.area()
      .curve(d3.curveStep)
      .x((_, i) => this.x(d2.xs[i]))
      .y0(d => this.y(d[0]))
      .y1(d => this.y(d[1]));

    // do not use d3 update flow, recreate
    this.total_data_g.selectAll('path.stacked-histogram__path').remove();
    d2.paths.forEach((pathdata, i) => {
      this.total_data_g.append('path')
        .classed('stacked-histogram__path', true)
        .classed('stacked-histogram__path--muted', !d2.ys[i].active)
        .attr('d', area(pathdata))
        .attr('fill', d2.ys[i].color);
    });

    // axes
    this.axes_g.select('#x-axis-total').remove();
    this.axes_g.select('#y-axis-total').remove();

    let xAxis = d3.axisBottom(this.x);
    this.axes_g.append('g')
      .attr('id', 'x-axis-total')
      .classed('x-axis', true)
      .classed('axis', true)
      .attr('transform', 'translate(0,' + (h - marginBottom) + ')')
      .call(xAxis);

    this.updateYAxis(this.totalYDomain);

    this.brush_g.selectAll('g.brush').remove();
    this.filterBrush = d3.brushX()
      .extent([[marginLeft, 5], [w-20, h-marginBottom]]);
    this.brush_g.append("g")
      .attr('class', 'brush')
      .call(this.filterBrush)
      .call(this.filterBrush.move, this.selectionRange === this.x.domain() ? undefined : this.selectionRange ? this.selectionRange.map(this.x) : undefined);

    this.filterBrush.on('start', () => {
      this.isBrushing = true;
      this.tooltipManager.cancel();
    });

    this.filterBrush.on('brush', (e) => {
      this.selectionRange = e.selection
        ? e.selection.map(this.x.invert.bind(this.x))
        : this.x.domain();
      this.brushMoved();
    });
    this.filterBrush.on('end', (e) => {
      this.brushed(e);
      this.isBrushing = false;
    });

    this.brush_g.on('wheel', (event) => {
      const scroll = Math.sign(event.deltaY);
      this.zoom(scroll);
    });

    this.createOverview(d2, bbox.width, bbox.height);
    this.brushMoved();  // after createOverview so the indicator does not get removed again
  }

  private brushMoved(): void {
    const selection = this.selectionRange || this.totalDomain;
    const range = this.x.range();
    const yrange = this.y.range().sort((a,b) => a-b);
    let brush_g_inner = this.brush_g.select('.brush');

    const d = [
      [ range[0], this.x(selection[0]) - range[0] ],
      [ this.x(selection[1]), range[1] - this.x(selection[1]) ]
    ];
    let s = brush_g_inner.selectAll('rect.brush__outside')
      .data(d) as d3.Selection<SVGRectElement, [number, number], any, any>;
    s.enter()
      .append('rect')
      .classed('brush__outside', true)
      .merge(s)
      .attr('x', d => d[0])
      .attr('y', yrange[0])
      .attr('width', d => d[1])
      .attr('height', yrange[1] - yrange[0]);
    s.exit().remove();

    if (this.x_overview) this.timeFilterIndicator(selection as [number, number]);
  }

  private brushed(event: d3.D3BrushEvent<any>): void {
    if (this.filterBrushMoved) {
      this.filterBrushMoved = false;
      return;
    }

    let s = <[number, number]>event.selection || this.totalDomain.map(this.x);
    const min = Math.round(this.x.invert(s[0]));
    const max = Math.round(this.x.invert(s[1]));
    this.selectionRange = (min === this.totalDomain[0] && max === this.totalDomain[1]) ? null : [min,max];
    this.brushMoved();

    this.sendToDataThread('set-filter', this.selectionRange);

    if (true) {
      this.filterBrushMoved = true;
      this.brush_g.select('.brush').call(this.filterBrush.move,
        this.selectionRange === null ? null : this.selectionRange.map(this.x));
    }
  }

  private zoom(direction: number): void {
    if (!this.zoomDomain) return;
    const factor = (direction === 1) ? 1.25 : 0.8;

    const middle = d3.sum(this.zoomDomain) / 2;
    const span = this.zoomDomain[1] - this.zoomDomain[0];
    const start = Math.max(this.totalDomain[0], middle - factor * span / 2);
    const end = Math.min(this.totalDomain[1], middle + factor * span / 2);

    const range = (start === this.totalDomain[0] && end === this.totalDomain[1])
      ? undefined
      : [start, end].map(this.x_overview);

    // short-circuit if old === new
    if (this.zoomDomain[0] === start && this.zoomDomain[1] === end) return;

    this.overview_g.select('.brush').call(this.zoomBrush.move, range);
    this.zoomToDomain([start, end]);
  }

  private updateYAxis(domain: [number, number]) {
    this.y.domain(domain);
    this.axes_g.select('#y-axis-total').remove();

    const axes_height = this.y.range()[0] - this.y.range()[1];
    const elem_count = this.y.domain()[1];
    const max_ticks = Math.min(elem_count, Math.floor(axes_height / 15));  // min 15px between ticks

    const yAxis = d3
      .axisLeft(this.y)
      .ticks(Math.max(2, max_ticks))
      .tickFormat(function(d: number) {
        if (d % 1 === 0) return `${d}`;
        return '';
      });
    if (this.cachedTimelineMode === T.TimelineMode.Qualitative) yAxis.tickValues([]);

    this.axes_g.append('g')
      .attr('id', 'y-axis-total')
      .classed('y-axis', true)
      .classed('axis', true)
      .attr('transform', 'translate(' + marginLeft + ', 0)')
      .call(yAxis);
  }

  protected openModal(): void {
    modal.showInfoboxFromURL('Timeline', 'timeline.html');
  }

  private onMouseEnter(evt: MouseEvent) {
    if (this.isBrushing) return;

    this.tooltipManager.create(f => this.updateTooltipContent(evt, f.root));
    this.tooltipManager.move(evt.clientX, evt.clientY);
  }

  private onMouseMove(evt: MouseEvent) {
    if (this.isBrushing) return;

    this.tooltipManager.move(evt.clientX, evt.clientY);
    this.tooltipManager.update(f => this.updateTooltipContent(evt, f.root));
  }

  private onMouseLeave() {
    if (!this.isBrushing) this.tooltipManager.cancel();
  }

  private cachedYear: number = NaN;
  private cachedHighlightedId: string | typeof NO_TOOLTIP_ITEM_HIGHLIGHTED = NO_TOOLTIP_ITEM_HIGHLIGHTED;
  private cachedContent: string = '';
  private updateTooltipContent(evt: MouseEvent, tooltipRoot: d3.Selection<HTMLElement, any, any, any>) {
    // get SVG x position
    const { left, top } = this.svg.node().getBoundingClientRect();
    const { clientX, clientY } = evt;
    const x = clientX - left;
    const y = clientY - top;

    if (x < this.x.range()[0] || x > this.x.range()[1]) {
      this.tooltipManager.hide();
      return;
    } else {
      this.tooltipManager.show();
    }

    const isInOverview = y >= this.y_overview.range()[1] - 2;
    const year = Math.round(
      isInOverview
        ? this.x_overview.invert(x)
        : this.x.invert(x)
    );

    // index in path data
    const idx = year - this.cachedPathData.span_x[0];

    // find Y position in stack
    const posY = this.y.invert(y);
    // find ID closest to Y position in stack
    const closestCandidates = [];
    this.cachedPathData.ys.forEach((y, i) => {
      const [y0, y1] = this.cachedPathData.paths[i][idx];

      const distance = (posY >= y0 && posY < y1)
        ? 0
        : Math.min(Math.abs(y0 - posY), Math.abs(y1 - posY));

      closestCandidates.push({ id: y.id, distance, empty: y0 === y1 });
    });
    const closestCandidate = closestCandidates.sort((a, b) => a.distance - b.distance)[0];
    const highlightedId = (closestCandidate.empty || closestCandidate.distance > 5)
      ? NO_TOOLTIP_ITEM_HIGHLIGHTED
      : closestCandidate.id;

    if (year === this.cachedYear && highlightedId === this.cachedHighlightedId) {
      tooltipRoot.html(this.cachedContent);
      return;
    }

    tooltipRoot.selectAll('*').remove();
    tooltipRoot.append('h1').text(`Year ${year}`);

    // reverse-engineer d3-stack results
    const items = new Map<string, { id: string | null, active: number, total: number }>();
    this.cachedPathData.ys.forEach((y, i) => {
      const poss = this.cachedPathData.paths[i][idx];
      const count = poss.data[stackKey(y.id, y.active)];

      let item;
      if (items.has(`${y.id}`)) item = items.get(`${y.id}`);
      else {
        item = { id: y.id, active: 0, total: 0 };
        items.set(`${y.id}`, item);
      }

      if (y.active) item.active = count;
      item.total += count;
    });

    const vals = Array.from(items.values())
      .filter(d => d.total > 0);

    if (this.cachedDisplayMode === T.DisplayMode.Religion) {
      vals.sort((a,b) => b.active - a.active || b.total - a.total);
    } else {
      vals.sort((a, b) => T.confidence_values.indexOf(a.id as T.Confidence) - T.confidence_values.indexOf(b.id as T.Confidence));
    }
    const total = d3.sum(vals.map(d => d.total));
    const totalActive = d3.sum(vals.map(d => d.active));

    tooltipRoot.append('p')
      .html(`<strong>${total}</strong> pieces of evidence (<strong>${totalActive}</strong> visible)${vals.length > 0 ? ':': ''}`);

    if (vals.length > 0) {
      const tx = tooltipRoot.append('table').classed('timeline-table', true);
      const h = tx.append('thead').append('tr');
      h.append('th').text(this.cachedDisplayMode === T.DisplayMode.Religion ? 'Religion' : 'Confidence');
      h.append('th').text('Active');
      h.append('th').text('Total');
      const t = tx.append('tbody');

      vals.forEach(d => {
        const description = (this.cachedDisplayMode === T.DisplayMode.Religion)
          ? this.religionNames.get(parseInt(d.id))
          : (d.id === null) ? `<em>no value</em>` : d.id;

        const r = t.append('tr')
          .classed('highlighted-row', d.id === highlightedId);
        r.append('td')
          .html(description);
        r.append('td')
          .text(d.active);
        r.append('td')
          .text(d.total);
        });
    }

    this.cachedContent = tooltipRoot.html();
    this.cachedYear = year;
    this.cachedHighlightedId = highlightedId;
  }
};
