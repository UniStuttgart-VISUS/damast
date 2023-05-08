import * as d3 from 'd3';
import {Dataset,ChangeScope} from './dataset';
import {ColorScales} from './colorscale';
import * as T from './datatypes';
import * as modal from './modal';
import View from './view';
import TooltipManager from './tooltip';
import { untimed } from './html-templates';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

export default class Untimed extends View<any, any> {
  private _svg: d3.Selection<SVGSVGElement, any, any, any>;
  private tooltipManager = new TooltipManager();

  private _scale: ColorScales;

  constructor(worker: Worker, container: GoldenLayout.ComponentContainer) {
    super(worker, container, 'untimed');

    const div = container.element as HTMLDivElement;

    div.classList.add('untimed-container');
    div.innerHTML = untimed;

    this._svg = d3.select(div).select('svg');
    container.on('resize', () => this.repaint());
  }

  private _cached_data: Array<any> = null;
  private _cached_main_religions: number[] = null;
  private _cached_main_religion_icons: {} = null;
  private _cached_display_mode: T.DisplayMode = T.DisplayMode.Religion;
  private _cached_religion_names: Map<number, string> = new Map<number, string>();
  async setData(d: any) {
    this._cached_data = d.data;
    this._cached_main_religions = d.main_religions;
    this._cached_main_religion_icons = d.main_religion_icons;
    this._cached_display_mode = d.display_mode;
    this._cached_religion_names = d.religion_names;

    this.paint(d.data, d.main_religions, d.main_religion_icons, d.display_mode);
  }

  async linkData(d: any) {
    throw d;
  }

  private repaint() {
    if (this._cached_data === null) return;

    this.paint(this._cached_data,
      this._cached_main_religions,
      this._cached_main_religion_icons,
      this._cached_display_mode);
  }

  private paint(
    untimed_data: Array<any>,
    main_religions: number[],
    main_religion_icons: {},
    display_mode: T.DisplayMode,
  ) {
    const marginBottom = 40;
    const marginLeft = 30;

    const bbox = this._svg.node().getBoundingClientRect();
    const svg_height = bbox.height;
    const svg_width = bbox.width;

    const width = main_religions.length;

    const max_height = untimed_data.reduce((a,b) => Math.max(a, b.count + b.offset), 0);
    const yscale = d3.scaleLinear()
      .domain([0, Math.max(1, max_height)])
      .range([svg_height - marginBottom, 20]);

    const xscale = d3.scaleBand<number>()
      .domain(main_religions)
      .range([marginLeft, svg_width - 20]);

    const ref = this;
    let s = this._svg.selectAll('.untimed__rect')
      .data(untimed_data) as d3.Selection<SVGRectElement, any, any, any>;
    s.enter()
      .append('rect')
      .classed('untimed__rect', true)
      .merge(s)
      .attr('x', d => xscale(d.parent_religion))
      .attr('width', xscale.bandwidth())
      .attr('height', d => yscale(d.offset) - yscale(d.offset + d.count))
      .attr('y', d => yscale(d.count + d.offset))
      .attr('fill', d => d.color)
      .classed('untimed__rect--muted', d => !d.active)
      .on('mouseenter', (e, d) => {
        this.tooltipManager.create(t => {
          t.root.append('strong').text(`${this._cached_religion_names.get(d.id)}:`);
          t.root.append('span').text(` ${d.count}`);
        });
        this.tooltipManager.move(e.clientX, e.clientY)
      })
      .on('mousemove', e => this.tooltipManager.move(e.clientX, e.clientY))
      .on('mouseleave', () => this.tooltipManager.cancel())
      .on('click', function() {
        ref.on_brush(d3.select(this));
      });
    s.exit().remove();

    this._svg.selectAll('.axis').remove();
    const axisX = d3.axisBottom<number>(xscale);
    this._svg.append('g')
      .classed('axis', true)
      .classed('axis--x', true)
      .attr('transform', 'translate(0, ' + yscale(0) + ')')
      .call(axisX);

    // remove tick labels
    this._svg.select('.axis--x')
      .selectAll('.tick')
      .selectAll('text')
      .remove();

    const axes_height = yscale.range()[0] - yscale.range()[1];
    const elem_count = yscale.domain()[1];
    const max_ticks = Math.min(elem_count, Math.floor(axes_height / 15));  // min 15px between ticks

    const axisY = d3.axisLeft<number>(yscale)
      .ticks(Math.max(2, max_ticks))
      .tickFormat(function(d: number) {
        if (d % 1 === 0) return `${d}`;
        return '';
      });
    this._svg.append('g')
      .classed('axis', true)
      .classed('axis--y', true)
      .attr('transform', 'translate(' + marginLeft + ', 0)')
      .call(axisY);

    let sel = this._svg.select('.axis--x')
      .append('g')
      .classed('axis--x__labels', true)
      .selectAll('.axis--x__label')
      .data(xscale.domain()) as d3.Selection<SVGUseElement, any, any, any>;
    sel.enter()
      .append('use')
      .classed('axis--x__label', true)
      .merge(sel)
      .style('--clr-icon', 'var(--clr-fg)')
      .attr('href', d => main_religion_icons[d] || '#undefined')
      .attr('transform', d => 'translate('
        + (xscale(d) + xscale.bandwidth()/2) + ',' + marginBottom/2 + ')'
        + 'scale(0.2)');
    sel.exit().remove();
  }

  private on_brush(sel: d3.Selection<SVGRectElement, any, any, any>): void {
    this.sendToDataThread('set-brush', sel.datum());
  }

  protected openModal(): void {
    modal.showInfoboxFromURL('Untimed Data', 'untimed-data.html');
  }
};
