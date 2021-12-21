import * as d3 from 'd3';
import * as T from './datatypes';

export enum Anchor {
  NorthWest,
  NorthEast,
  SouthWest,
  SouthEast
};

export interface Modal {
  title: d3.Selection<HTMLHeadingElement, any, any, any>;
  content: d3.Selection<HTMLDivElement, any, any, any>;
};

const title_height = '1rem';

export function create_modal(width: number, height: number,
  title_string: string,
  content_url: string | null,
  can_unpin: boolean = true,
): Modal {
  const modal_parent = d3.select('body')
    .append('div')
    .classed('modal', true)
    .classed('modal--vis', true)
    .classed('modal--hidden', true);
  const background = modal_parent.append('div')
    .classed('modal__background', true);

  const show = () => {
    modal_parent.classed('modal--hidden', false);
  };
  const close = () => {
    modal_parent.classed('modal--hidden', true);
    modal_parent.remove();
  };
  const unpin = () => {
    const url = './info/' + content_url + '?title=' + encodeURIComponent(title_string);
    const win = window.open(url, title_string, `height=${height},width=${width}`);
    if (window.focus) win.focus();

    close();
  };

  background.on('click', close);

  const modal_pane = modal_parent.append('div')
    .classed('modal__pane', true)
    .style('width', width + 'px')
    .style('top', `calc(50% - 0.5 * ${height}px)`)
    .style('right', `calc(50% - 0.5 * ${width}px)`);

  const title = modal_pane.append('div')
    .classed('modal__title-pane', true);
  const t = title.append('h1')
    .classed('modal__title', true)
    .text(title_string);

  if (can_unpin) {
    title.append('span')
      .classed('modal__unpin-button', true)
      .classed('no-text-select', true)
      .on('click', unpin)
      .attr('title', 'Open in new window')
      .html('&#x21d7;');
  }

  title.append('span')
    .classed('modal__close-button', true)
    .classed('no-text-select', true)
    .on('click', close)
    .attr('title', 'Close dialog')
    .html('&times;');

  const foreground = modal_pane.append('div')
    .classed('modal__foreground', true)
    .style('max-height', height + 'px');

  if (content_url !== null) {
    // set content
    d3.text('./snippet/' + content_url)
      .catch(err => {
        console.error('Could not fetch content text from ' + content_url + ':', err);
      })
      .then(function(text: string) {
        foreground.html(text);
      });
  }

  show();
  return {
    title: t,
    content: foreground
  };
}

