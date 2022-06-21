import * as d3 from 'd3';
import * as T from './datatypes';

import { nativeDialogSupported } from '../common/dialog';

type ContentURL = string;
type ContentFunction = (() => Promise<string>);

declare interface _HTMLDialogElement {
  showModal?(): void;
};

interface ModalReturn {
  close: () => void;
  content: Promise<HTMLElement>;
}

export function showInfoboxFromURL(title_string: string,
  content_url: ContentURL | ContentFunction,
  hasUnpin: boolean = true,
  onClose: () => void = () => {},
): ModalReturn {
  const openInNewWindow = () => {
    const url = (typeof content_url === 'string')
      ? `./info/${content_url}?title=${encodeURIComponent(title_string)}`
      : `./info-standalone?title=${encodeURIComponent(title_string)}`;  // ContentFunction implies it is the description window for filters
    const win = window.open(url, title_string, `popup,height=480,width=640`);
    win.onbeforeunload = onClose;

    const content = (typeof content_url === 'string') ? Promise.resolve() : content_url();
    if (window.focus) win.focus();

    if (typeof content_url === 'function') {
      const c = new Promise<HTMLElement>(resolve => {
        win.addEventListener('load', () => {
          content.then(c => {
            const elem = win.document.querySelector('.content');
            elem.innerHTML = c;
            resolve(elem as HTMLElement);
          });
        }, { once: true });
      });

      return { content: c, close: () => win.close() };
    } else {
      return { content: Promise.resolve(win.document.body), close: () => win.close() };
    }
  };

  // first, check if native support
  if (!nativeDialogSupported() || false) {
    return openInNewWindow();
  }

  const dialog: d3.Selection<HTMLDialogElement & _HTMLDialogElement, any, any, any> = d3.select('body')
    .append('dialog')
    .classed('infobox', true);

  dialog.on('click', e => {
    if (e.target === dialog.node()) close();
  });

  const show = () => {
    dialog.node().showModal?.();
  };
  const close = () => {
    onClose();
    dialog.remove();
  };
  const unpin = () => {
    openInNewWindow().content.then(() => close());
  };

  const title = dialog.append('div')
    .classed('modal__title-pane', true);
  title.append('h1')
    .classed('modal__title', true)
    .text(title_string);
  if (hasUnpin) {
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

  const foreground = dialog.append('div')
    .classed('modal__foreground', true)
    .html(`<i class="fa fa-3x fa-fw fa-pulse fa-spinner"></i>`);

  const contentFn: Promise<string> = (typeof content_url === 'function')
    ? (content_url as ContentFunction)()
    : d3.text(`./snippet/${content_url}`)
        .catch(err => console.error('Could not fetch content text from ' + content_url + ':', err))
        .then((v: string | void): string => { if (v) return v; return '[no content]'; });

  contentFn.then((text: string) => foreground.html(text));
  show();

  return { content: contentFn.then(() => foreground.node()), close };
}

