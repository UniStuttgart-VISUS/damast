import {Selection, select} from 'd3-selection';

export interface Point {
  x: number;
  y: number;
};

type TooltipCallback = (t: Tooltip) => void;

export default class TooltipManager {
  private tooltip: Tooltip | null = null;
  private timeout_id: ReturnType<typeof setTimeout> | undefined = undefined;
  private x: number = 0;
  private y: number = 0;
  private tooltipCallback: TooltipCallback = _ => {};

  parentNode: HTMLElement = document.body;

  constructor(
    readonly delay: number = 1000,
  ) {

  }

  create(creationCallback: TooltipCallback) {
    this.cancel();
    this.tooltipCallback = creationCallback;

    this.timeout_id = setTimeout(() => {
      this.tooltip = new Tooltip(this.parentNode);
      this.tooltip.move({ x: this.x, y: this.y });

      this.tooltip.show();
      this.tooltipCallback(this.tooltip);
    }, this.delay);
  }

  update(cb: TooltipCallback) {
    this.tooltipCallback = cb;
    if (this.tooltip !== null) cb(this.tooltip);
  }

  cancel() {
    if (this.timeout_id !== undefined) clearTimeout(this.timeout_id);
    this.tooltip?.clear();
    this.tooltip = null;
  }

  move(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.tooltip?.move({ x, y });
  }

  show() {
    this.tooltip?.show();
  }

  hide() {
    this.tooltip?.hide();
  }
};

class Tooltip {
  private _root: Selection<HTMLDivElement, any, any, any>;
  private padding: number = 25;

  private _oldpos: Point = {x: -1000, y: -1000};
  private readonly _threshold = Math.pow(5, 2); // 5px

  constructor(private parentNode: HTMLElement) {
    this._root = select<HTMLElement, any>(this.parentNode)
      .append('div')
      .classed('tooltip', true)
      .attr('data-state', 'hidden');
  }

  get root(): Selection<HTMLDivElement, any, any, any> {
    return this._root;
  }

  move(p: Point) {
    // hysteresis
    const dist_sq = Math.pow(p.x - this._oldpos.x, 2) + Math.pow(p.y - this._oldpos.y, 2);
    if (dist_sq < this._threshold) return;
    this._oldpos = p;

    const w = this.parentNode.clientWidth;
    const h = this.parentNode.clientHeight;

    const pos: any = {};

    if (p.x > w/2) {
      // to left of cursor
      pos.right = w - p.x + this.padding;
      pos.left = null;
    } else {
      // to right of cursor
      pos.right = null;
      pos.left = p.x + this.padding;
    }

    if (p.y > h/2) {
      // over cursor
      pos.bottom = h - p.y + this.padding;
      pos.top = null;
    } else {
      // to right of cursor
      pos.top = p.y + this.padding;
      pos.bottom = null;
    }

    for (let k in pos) {
      const v = (pos[k] !== null) ? `${pos[k]}px` : null;
      this._root.style(k, v);
    }
  }

  clear() {
    this._root.remove();
  }

  show() {
    this._root.attr('data-state', null);
  }

  hide() {
    this._root.attr('data-state', 'hidden');
  }
};


