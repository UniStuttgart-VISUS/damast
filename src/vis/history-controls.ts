import { select } from 'd3-selection';
import type { Selection } from 'd3-selection';
import { hierarchy } from 'd3-hierarchy';
import type { HierarchyNode } from 'd3-hierarchy';
import { scaleBand, scaleLinear } from 'd3-scale';
import { range } from 'd3-array';
import View from './view';
import type { JsonHistoryTree } from './history-tree';
import { nativeDialogSupported, HTMLDialogElement as HTMLDialogElementShim } from '../common/dialog';

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
      .on('click', () => {
        console.log('show graph');
        this.openDialog();
      });
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
        .on('click', e => {
          if (e.target === this.dialog.node()) this.closeDialog();
        });
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

    // TODO: actual stuff
    const hier: IndentedHierarchyNode = hierarchy<JsonHistoryTree>(this.cachedHistoryTree);
    const hierarchyHeight = layoutTree(hier);
    const hierarchyDepth = hier.height + 1;
    const nodeHeight = 50;
    const nodePadding = 20;
    const nodeRadius = nodeHeight/2;
    const svgWidth = 600;
    const svgHeight = hierarchyHeight * nodeHeight + (hierarchyHeight - 1) * nodePadding;
    const nodeWidth = (svgWidth - (hierarchyDepth - 1) * nodePadding) / hierarchyDepth;

    const svg = foreground.selectAll('svg')
      .data([null])
      .join('svg')
        .attr('width', svgWidth + 4)
        .attr('height', svgHeight + 4)
        .attr('viewBox', `-2 -2 ${svgWidth + 4} ${svgHeight + 4}`)
        .style('margin', '1em');

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
      if (source.row === target.row) return `M${x0} ${y0}H${x1}`;

      const x05 = (x0 + x1) / 2;
      const x2 = x05 - 5;
      const x3 = x05 + 5;
      const y2 = y0 + 5;
      const y3 = y1 - 5;

      return `M${x0} ${y0}H${x2}A5 5 0 0 1 ${x05} ${y2}V${y3}A5 5 90 0 0 ${x3} ${y1}H${x1}`;
    });

    svg.selectAll('path')
      .data(linkData)
      .join('path')
        .attr('stroke', 'hotpink')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('d', d => d);

    svg.selectAll<SVGRectElement, typeof nodeData[0]>('circle')
      .data(nodeData)
      .join('circle')
        .attr('cx', d => d.x0 + nodeRadius)
        .attr('cy', d => d.y0 + nodeRadius)
        .attr('r', nodeRadius)
        .attr('stroke', 'hotpink')
        .attr('stroke-width', 2)
        .attr('fill', d => d.isCurrent ? 'hotpink' : 'none');
  }
};

function layoutTree(node: IndentedHierarchyNode, indent: number = 0, row: number = 0): number {
  node.indent = indent;
  node.row = row;

  if (!node.children?.length) return 1;

  let curHeight = 0;
  node.children.forEach((child, index) => {
    curHeight += layoutTree(child, indent + 1, row + curHeight);
  });

  return curHeight;
}
