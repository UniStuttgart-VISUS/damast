import { scaleLinear } from 'd3-scale';
import { Annotator, Annotation } from 'dom-tree-annotator';

import annotationType from './annotation-type';
import * as Constants from './constants';
import AnnotatorHelper from './annotator-helper';
import isAnnotationSuggestion from './is-annotation-suggestion';

export default class Scrollbar {
  private readonly parentResizeObserver: ResizeObserver;
  private readonly childResizeObserver: ResizeObserver;

  private svgHeight: number = 1;
  private svgWidth: number = 1;
  private parentHeight: number = 0;

  private minimapContent: ImageData = null;

  constructor(
    private readonly scrollParent: HTMLElement,
    private readonly scrollChild: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly annotatorHelper: AnnotatorHelper,
    private readonly annotator: Annotator,
  ) {
    this.parentResizeObserver = new ResizeObserver(this.onParentResize.bind(this));
    this.parentResizeObserver.observe(this.scrollParent);
    this.childResizeObserver = new ResizeObserver(this.onChildResize.bind(this));
    this.childResizeObserver.observe(this.scrollChild);

    this.scrollParent.addEventListener('scroll', this.onParentScroll.bind(this));

    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('click', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', evt => this.scrollParent.scrollBy(0, Math.sign(evt.deltaY) * this.parentHeight / 2));
    document.body.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.body.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.body.addEventListener('blur', this.onMouseUp.bind(this));
    document.body.addEventListener('mouseleave', this.onMouseUp.bind(this));
  }

  private onParentResize([entry]: [ResizeObserverEntry]) {
    const { height } = entry.contentRect;
    this.parentHeight = height;
    const { top, right } = entry.target.getBoundingClientRect();

    const right2 = window.innerWidth - right;

    this.canvas.setAttribute('width', Constants.minimap_width.toString());
    this.canvas.setAttribute('height', height.toString());
    this.canvas.style.top = `${top}px`;
    this.canvas.style.right = `${right2}px`;
    this.canvas.style.height = `${height}px`;

    this.draw();
  }

  private onChildResize([entry]: [ResizeObserverEntry]) {
    this.svgHeight = entry.contentRect.height;
    this.svgWidth = entry.contentRect.width;

    this.draw();
  }

  private onParentScroll(_evt: MouseEvent) {
    this.redraw();
  }

  private setDocumentScroll(clientY: number) {
    const { top, height } = this.canvas.getBoundingClientRect();

    // calculate height of scroll indicator
    const handleHeight = Math.max(8, height * height / this.svgHeight);
    const invertedHandleHeight = this.svgHeight * handleHeight / (height * height);

    const y = scaleLinear<number>()
      .domain([top, top + height])
      .range([invertedHandleHeight / 2, this.svgHeight - invertedHandleHeight / 2])
      .clamp(true);

    const scrollToY = y(clientY) - height / 2;
    this.scrollParent.scroll(0, scrollToY);
  }

  private isScrolling: boolean = false;
  private onMouseDown(evt: MouseEvent) {
    const { y } = evt;
    this.setDocumentScroll(y);

    this.isScrolling = true;
    document.body.classList.add('scrolling');
  }

  private onMouseUp(_evt: MouseEvent) {
    if (!this.isScrolling) return;

    this.isScrolling = false;
    document.body.classList.remove('scrolling');
  }

  private onMouseMove(evt: MouseEvent) {
    if (!this.isScrolling) return;

    const { y } = evt;
    this.setDocumentScroll(y);
  }

  draw() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;

    const x = scaleLinear<number>()
      .domain([0 + Constants.swimlane_width, this.svgWidth])
      .range([0, Constants.minimap_width]);

    const y = scaleLinear<number>()
      .domain([0, this.svgHeight])
      .range([0, c.height]);

    const context = c.getContext('2d');
    context.clearRect(0, 0, c.width, c.height);

    const annotations: {
      [key: string]: [number, number, number, number][];
    } = {
      ['person']: [],
      ['place']: [],
      ['religion']: [],
      ['timegroup']: [],
      ['unknown']: [],
    };

    this.annotator.annotations
      .filter(d => !isAnnotationSuggestion(d))
      .forEach(ann => {
      const tp = annotationType(ann.data);
      ann.ranges.forEach(r => r.elements.forEach(e => {
        const x_ = x(e.offsetLeft);
        const y_ = y(e.offsetTop);
        const w_ = Math.max(2, Math.round(x(e.offsetLeft + e.offsetWidth) - x_));
        const h_ = Math.max(1, Math.round(y(e.offsetTop + e.offsetHeight) - y_));

        annotations[tp].push([Math.floor(x_), Math.floor(y_), w_, h_]);
      }));
    });

    [
      ['person', 'rgb(36, 25, 119)'],
      ['place', 'rgb(121, 54, 9)'],
      ['religion', 'rgb(121, 20, 83)'],
      ['timegroup', 'rgb(6, 79, 48)'],
      ['unknown', 'darkred'],
    ].forEach(([key, fillStyle]) => {
      context.fillStyle = fillStyle;
      context.beginPath();
      context.translate(0.5, 0.5);
      annotations[key].forEach(([x,y,w,h]) => context.rect(x, y, w, h));
      context.fill();
    });

    this.minimapContent = context.getImageData(0, 0, c.width, c.height);
    c.remove();

    this.redraw();
  }

  private redraw() {
    const context = this.canvas.getContext('2d');
    const { width, height } = this.canvas;
    this.canvas.width = width;

    // draw annotations (cached)
    context.putImageData(this.minimapContent, 0, 0);
    // draw handle and track BELOW annotation minimap content
    context.globalCompositeOperation = 'destination-over';

    const handleHeight = Math.max(8, Math.ceil(height * height / this.svgHeight));

    const handleY = scaleLinear<number>()
      .domain([0, this.svgHeight - height])
      .range([0, height - handleHeight])
      (this.scrollParent.scrollTop);

    // handle first, because of composite operation
    context.fillStyle = '#444';
    context.fillRect(0, handleY, width, handleHeight);
    context.fillStyle = '#666';
    context.fillRect(0, 0, width, height);
  }

  unload() {
    this.parentResizeObserver.disconnect();
    this.childResizeObserver.disconnect();
  }
};
