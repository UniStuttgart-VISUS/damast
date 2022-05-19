import { select } from 'd3-selection';
import type { Selection } from 'd3-selection';
import View from './view';
import type { JsonHistoryTree } from './history-tree';

export interface Data {
  canBack: boolean;
  canForward: boolean;
  tree: any;
};

export class HistoryControls extends View<Data, any> {
  private readonly backButton: Selection<HTMLButtonElement, any, any, any>;
  private readonly forwardButton: Selection<HTMLButtonElement, any, any, any>;
  private readonly showGraphButton: Selection<HTMLButtonElement, any, any, any>;

  private cachedHistoryTree: JsonHistoryTree | undefined;

  constructor(
    worker: Worker,
    container, any
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
      .on('click', () => {
        console.log('show graph');
      });
  }

  async linkData(_data: any) {}
  protected openModal() {}

  async setData(data: Data) {
    console.log('HistoryControls::setData', data);

    const { canBack, canForward, tree } = data;
    this.cachedHistoryTree = tree;

    this.backButton.attr('disabled', canBack ? null : '');
    this.forwardButton.attr('disabled', canForward ? null : '');
    //if (data.state) this.messages.set(data.key, data.html);
    //else if (this.messages.has(data.key)) this.messages.delete(data.key);
    //
    //this.update();
  }
};
