import { select } from 'd3-selection';
import type { Selection } from 'd3-selection';
import { hierarchy } from 'd3-hierarchy';
import type { HierarchyNode } from 'd3-hierarchy';
import { scaleBand, scaleLinear } from 'd3-scale';
import { range } from 'd3-array';
import View from './view';
import type { JsonHistoryTree } from './history-tree';
import { nativeDialogSupported, HTMLDialogElement as HTMLDialogElementShim } from '../common/dialog';
import TooltipManager from './tooltip';
import type { TreeButtonData } from './history-control-tree-buttons';
import { buttonOptions } from './history-control-tree-buttons';

export interface Data {
  canBack: boolean;
  canForward: boolean;
  tree: any;
  currentStateUuid: string;
};

interface IndentedTreeProps {
  indent: number;
  row: number;
};

type IndentedHierarchyNode = HierarchyNode<JsonHistoryTree> & Partial<IndentedTreeProps>;

export class HistoryControls extends View<Data, never> {
  private readonly backButton: Selection<HTMLButtonElement, any, any, any>;
  private readonly forwardButton: Selection<HTMLButtonElement, any, any, any>;
  private readonly showGraphButton: Selection<HTMLButtonElement, any, any, any>;
  private dialog: Selection<HTMLDialogElement, any, any, any> = select<HTMLDialogElement, any>('.dummy');

  private cachedHistoryTree: JsonHistoryTree | undefined;
  private cachedCurrentStateUuid: string = '';

  private readonly tooltipManager = new TooltipManager(500);

  constructor(
    worker: Worker,
    container: any
  ) {
    super(worker, container, 'history');

    const span = select<HTMLSpanElement, any>('header span#vis-history-buttons');
    this.backButton = span.select<HTMLButtonElement>('button#vis-history-back')
      .attr('disabled', '')
      .on('click', () => {
        this.worker.postMessage({ type: 'history-back', data: null });
        this.backButton.attr('disabled', '');
        this.forwardButton.attr('disabled', '');
      });
    this.forwardButton = span.select<HTMLButtonElement>('button#vis-history-forward')
      .attr('disabled', '')
      .on('click', () => {
        this.worker.postMessage({ type: 'history-forward', data: null });
        this.backButton.attr('disabled', '');
        this.forwardButton.attr('disabled', '');
      });
    this.showGraphButton = span.select<HTMLButtonElement>('button#vis-history-show-graph')
      .attr('disabled', nativeDialogSupported() ? null : '')
      .each(function() {
        const s = select(this);
        const supported = nativeDialogSupported();

        if (!supported) {
          const title = s.attr('title');
          s.attr('title', `${title} (not supported by your browser)`)
            .attr('disabled', '');
        }
      })
      .on('click', () => this.openDialog());
  }

  async linkData(_: never) {}
  protected openModal() {}

  async setData(data: Data) {
    console.log('HistoryControls::setData', data);

    const { canBack, canForward, tree } = data;
    this.cachedHistoryTree = tree;
    this.cachedCurrentStateUuid = data.currentStateUuid;

    this.backButton.attr('disabled', canBack ? null : '');
    this.forwardButton.attr('disabled', canForward ? null : '');
    this.updateDialog();
  }

  private openDialog() {
    this.dialog = select('body')
      .selectAll<HTMLDialogElement, any>('dialog')
      .data([null])
      .join('dialog')
        .classed('infobox', true)
        .attr('data-dialog-role', 'history tree')
        .on('click', e => {
          if (e.target === this.dialog.node()) this.closeDialog();
        });
    this.tooltipManager.parentNode = this.dialog.node();
    this.updateDialog();
    (this.dialog.node() as unknown as HTMLDialogElementShim).showModal();
  }

  private closeDialog() {
    this.dialog.remove();
  }

  private updateDialog() {
    if (this.dialog.node() === null) return;

    // title stuff
    const title = this.dialog
      .selectAll('.modal__title-pane')
      .data([null])
      .join('div')
        .classed('modal__title-pane', true);

    title.selectAll('.modal__title')
      .data([null])
      .join('h1')
        .classed('modal__title', true)
        .text('History Graph');

    title.selectAll('.modal__close-button')
      .data([null])
      .join('span')
        .classed('modal__close-button', true)
        .classed('no-text-select', true)
        .on('click', () => this.closeDialog())
        .attr('title', 'Close dialog')
        .html('&times;');

    const foreground = this.dialog
      .selectAll('.modal__foreground')
      .data([null])
      .join('div')
        .classed('modal__foreground', true);

    // controls
    const controls = foreground.selectAll<HTMLDivElement, any>('.history-tree-controls')
      .data([null])
      .join('div')
        .classed('history-tree-controls', true)
      .selectAll<HTMLButtonElement, TreeButtonData>('button')
      .data(buttonOptions)
      .join('button')
        .classed('button', true)
        .classed('button--svgicon', true)
        .html(d => `${d[1]} ${d[0]}`)
        .attr('title', d => d[2])
        .on('click', (_, d) => d[3]((tp, data) => console.log(tp, data)));


    // actual stuff
    const hier: IndentedHierarchyNode = hierarchy<JsonHistoryTree>(this.cachedHistoryTree);
    const hierarchyHeight = layoutTree(hier);
    const hierarchyDepth = hier.height + 1;
    const nodeHeight = 24;
    const nodePadding = 20;
    const nodeRadius = nodeHeight/2;
    const nodeLabelWidth = 100;
    const nodeWidth = nodeHeight + nodeLabelWidth;
    const svgWidth = nodeWidth * hierarchyDepth + nodePadding * (hierarchyDepth - 1);
    const svgHeight = hierarchyHeight * nodeHeight + (hierarchyHeight - 1) * nodePadding;

    const svg = foreground.selectAll('svg#history-tree')
      .data([null])
      .join('svg')
        .attr('id', 'history-tree')
        .attr('width', svgWidth + 4)
        .attr('height', svgHeight + 4)
        .attr('viewBox', `-2 -2 ${svgWidth + 4} ${svgHeight + 4}`);

    const scaleX = scaleLinear()
      .domain([0, hierarchyDepth])
      .range([0, svgWidth]);
    const scaleY = scaleLinear()
      .domain([0, hierarchyHeight])
      .range([0, svgHeight]);

    // collect nodes
    const nodeData = hier.descendants().map(d => {
      const x0 = scaleX(d.indent ?? 0);
      const width = nodeWidth;
      const x1 = x0 + nodeWidth;
      const y0 = scaleY(d.row ?? 0);
      const height = nodeHeight;
      const y1 = y0 + height;
      const uuid = d.data.uuid;
      const isCurrent = uuid === this.cachedCurrentStateUuid;
      const data = d.data;

      return {
        x0, x1,
        y0, y1,
        width, height,
        isCurrent,
        uuid,
        data,
      };
    });
    const nodeLut = new Map<string, typeof nodeData[0]>();
    nodeData.forEach(d => nodeLut.set(d.uuid, d));

    // collect links
    const linkData = hier.links().map(({ source, target }) => {
      const src = nodeLut.get(source.data.uuid);
      const tgt = nodeLut.get(target.data.uuid);
      const x0 = src.x0 + 2 * nodeRadius;
      const y0 = src.y0 + nodeRadius;
      const x1 = tgt.x0;
      const y1 = tgt.y0 + nodeRadius;
      if ((<IndentedHierarchyNode>source).row === (<IndentedHierarchyNode>target).row)
        return `M${x0} ${y0}H${x1}`;

      const threeSegmentConnector = true;
      const roundedRadius = 10;

      if (threeSegmentConnector) {
        const x05 = (x0 + x1) / 2;
        const x2 = x05 - roundedRadius;
        const x3 = x05 + roundedRadius;
        const y2 = y0 + roundedRadius;
        const y3 = y1 - roundedRadius;

        return `M${x0} ${y0}H${x2}A${roundedRadius} ${roundedRadius} 0 0 1 ${x05} ${y2}V${y3}A${roundedRadius} ${roundedRadius} 90 0 0 ${x3} ${y1}H${x1}`;
      } else {
        const x2 = src.x0 + nodeRadius;
        const x3 = x2 + roundedRadius;
        const y2 = src.y0 + 2*nodeRadius;
        const y3 = y1 - roundedRadius;

        return `M${x2} ${y2}V${y3}A${roundedRadius} ${roundedRadius} 90 0 0 ${x3} ${y1}H${x1}`;
      }
    });

    svg.selectAll('path')
      .data(linkData)
      .join('path')
        .style('stroke', 'var(--clr-accent)')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('d', d => d);

    const graphNodes = svg.selectAll<SVGGElement, typeof nodeData[0]>('g.tree-node')
      .data(nodeData)
      .join('g')
        .classed('tree-node', true)
        .attr('transform', d => `translate(${d.x0}, ${d.y0})`)
        .style('cursor', d => d.isCurrent ? null : 'pointer')
        .on('mouseenter', this.onMouseEnter.bind(this))
        .on('mousemove', this.onMouseMove.bind(this))
        .on('mouseleave', this.onMouseLeave.bind(this))
        .on('click', (_evt, d) => {
          if (d.isCurrent) return;
          this.worker.postMessage({ type: 'history-go-to-state', data: d.uuid });
        });

    // circles
    graphNodes.selectAll<SVGCircleElement, typeof nodeData[0]>('circle')
      .data(d => [d])
      .join('circle')
        .attr('cx', nodeRadius)
        .attr('cy', nodeRadius)
        .attr('r', nodeRadius)
        .style('stroke', 'var(--clr-accent)')
        .attr('stroke-width', 2)
        .style('fill', d => d.isCurrent ? 'var(--clr-accent)' : 'none');

    // labels
    graphNodes.selectAll<SVGForeignObjectElement, typeof nodeData[0]>('foreignObject')
      .data(d => [d])
      .join('foreignObject')
        .attr('x', 2 * nodeRadius + 5)
        .attr('y', 0 + -1)
        .attr('width', nodeLabelWidth - 5)
        .attr('height', 12)
      .selectAll('span')
      .data(d => [d])
      .join('xhtml:span')
        .classed('node-label', true)
        .style('width', `${nodeLabelWidth - 5}px`)
        .text(d => ageString(d.data.created));

    // interaction area
    graphNodes.selectAll<SVGRectElement, typeof nodeData[0]>('rect')
      .data(d => [d])
      .join('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 2 * nodeRadius + nodeLabelWidth)
        .attr('height', 2 * nodeRadius)
        .attr('opacity', 0);
  }

  private onMouseEnter(evt: MouseEvent, d: { data: JsonHistoryTree, isCurrent: boolean }) {
    this.tooltipManager.create(f => {
      f.root.html(`<h1>${d.data.description}</h1>
        <p>${new Date(d.data.created).toLocaleString()}</p>
        ${ d.isCurrent ? '' : '<p>Click to restore state.</p>' }`);
    });

    const { top, left } = this.dialog?.node()?.getBoundingClientRect() ?? { top: 0, left: 0 };

    this.tooltipManager.move(evt.clientX - left, evt.clientY - top);
  }

  private onMouseMove(evt: MouseEvent) {
    const { top, left } = this.dialog?.node()?.getBoundingClientRect() ?? { top: 0, left: 0 };

    this.tooltipManager.move(evt.clientX - left, evt.clientY - top);
  }

  private onMouseLeave() {
    this.tooltipManager.cancel();
  }
};

function layoutTree(node: IndentedHierarchyNode, indent: number = 0, row: number = 0): number {
  node.indent = indent;
  node.row = row;

  if (!node.children?.length) return 1;

  let curHeight = 0;
  node.children.forEach((child) => {
    curHeight += layoutTree(child, indent + 1, row + curHeight);
  });

  return curHeight;
}

const _ageFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
function ageString(created: string): string {
  const d = new Date(created);
  const now = new Date();

  const diffSeconds = (d.getTime() - now.getTime()) / 1000;
  const absDiffSeconds = Math.abs(diffSeconds);

  const [factor, unit]: [number, Intl.RelativeTimeFormatUnit] = (absDiffSeconds < 60)
    ? [1, 'second']
    : (absDiffSeconds < 3600)
      ? [60, 'minute']
      : (absDiffSeconds < 86400)
        ? [3600, 'hour']
        : [86400, 'day'];
  return _ageFormatter.format(Math.floor(diffSeconds / factor), unit);
}
