import * as d3 from 'd3-selection';
import View from './view';

export interface Data {
  key: string;
  html?: string;
  state: boolean;
};

export class Message extends View<Data, any> {
  private box: d3.Selection<HTMLSpanElement, any, any, any>;
  private messages: Map<string, string> = new Map<string, string>();

  constructor(
    worker: Worker,
    container, any
  ) {
    super(worker, container, 'message');

    this.box = d3.select('#messages');
  }

  async linkData(data: any) {}
  protected openModal() {}

  async setData(data: Data) {
    if (data.state) this.messages.set(data.key, data.html);
    else if (this.messages.has(data.key)) this.messages.delete(data.key);

    this.update();
  }

  private update() {
    const sel = this.box.selectAll<HTMLSpanElement, [Symbol, string]>('.message')
      .data(Array.from(this.messages.entries()));

    sel.enter()
      .append('span')
      .classed('message', true)
      .merge(sel)
      .html(d => d[1])
      .attr('title', d => d[0]);

    sel.exit().remove();
  }
};
