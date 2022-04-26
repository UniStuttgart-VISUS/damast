import * as d3 from 'd3';
import * as T from './datatypes';

import { nativeDialogSupported } from '../common/dialog';

type ContentURL = string;
type ContentFunction = (() => Promise<string>);

export function showInfoboxFromURL(title_string: string,
  content_url: ContentURL | ContentFunction,
): void {
  const openInNewWindow = () => {
    const url = (typeof content_url === 'string')
      ? `./info/${content_url}?title=${encodeURIComponent(title_string)}`
      : `./info-standalone?title=${encodeURIComponent(title_string)}`;  // ContentFunction implies it is the description window for filters
    const win = window.open(url, title_string, `popup,height=480,width=640`);

    const content = (typeof content_url === 'string') ? Promise.reject() : content_url();
    if (window.focus) win.focus();

    if (typeof content_url === 'function') {
      win.addEventListener('load', () => {
        content.then(c => {
          const elem = win.document.querySelector('.content');
          elem.innerHTML = c;
        });
      }, { once: true });
    }
  };

  // first, check if native support
  if (!nativeDialogSupported()) {
    openInNewWindow();
    return;
  }

  const dialog = d3.select('body')
    .append('dialog');

  const show = () => {
    dialog.node().showModal();
  };
  const close = () => {
    dialog.remove();
  };
  const unpin = () => {
    openInNewWindow();
    close();
  };

  //background.on('click', close);

  const modal_pane = dialog;// modal_parent.append('div')
    //.classed('modal__pane', true)
    //.style('width', width + 'px')
    //.style('top', `calc(50% - 0.5 * ${height}px)`)
    //.style('right', `calc(50% - 0.5 * ${width}px)`);

  const title = modal_pane.append('div')
    .classed('modal__title-pane', true);
  const t = title.append('h1')
    .classed('modal__title', true)
    .text(title_string);

  title.append('span')
    .classed('modal__unpin-button', true)
    .classed('no-text-select', true)
    .on('click', unpin)
    .attr('title', 'Open in new window')
    .html('&#x21d7;');

  title.append('span')
    .classed('modal__close-button', true)
    .classed('no-text-select', true)
    .on('click', close)
    .attr('title', 'Close dialog')
    .html('&times;');

  const foreground = modal_pane.append('div')
    .classed('modal__foreground', true)
    //.style('max-height', height + 'px');

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
}

