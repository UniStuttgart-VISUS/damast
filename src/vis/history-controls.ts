import { select } from 'd3-selection';
import type { Selection } from 'd3-selection';
import { hierarchy } from 'd3-hierarchy';
import type { HierarchyNode } from 'd3-hierarchy';
import { scaleBand } from 'd3-scale';
import { range } from 'd3-array';
import View from './view';
import type { JsonHistoryTree } from './history-tree';
import { nativeDialogSupported, HTMLDialogElement as HTMLDialogElementShim } from '../common/dialog';

export interface Data {
  canBack: boolean;
  canForward: boolean;
  tree: any;
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
    const svgWidth = 600;
    const svgHeight = hierarchyHeight * nodeHeight;

    const svg = foreground.selectAll('svg')
      .data([null])
      .join('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight)
        .style('margin', '1em');

    const scaleX = scaleBand<number>()
      .paddingOuter(0)
      .paddingInner(0.2)
      .domain(range(hierarchyDepth))
      .range([0, svgWidth]);
    const scaleY = scaleBand<number>()
      .paddingOuter(0)
      .paddingInner(0.2)
      .domain(range(hierarchyHeight))
      .range([0, svgHeight]);

    const nodeWidth = 0;
    svg.selectAll<SVGRectElement, IndentedHierarchyNode>('rect')
      .data(hier.descendants(), d => d.data.uuid)
      .join('rect')
        .attr('x', d => scaleX(d.indent ?? 0))
        .attr('y', d => scaleY(d.row ?? 0))
        .attr('width', scaleX.bandwidth())
        .attr('height', scaleY.bandwidth())
        .attr('fill', 'hotpink')
        .selectAll('title')
        .data(d => [d])
        .join('title')
        .text(d => d.data.uuid);
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
