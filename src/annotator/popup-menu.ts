import { select, Selection } from 'd3-selection';

import { nativeDialogSupported, HTMLDialogElement as HtDialog } from '../common/dialog';

interface PopupOption<T> {
  key: T;
  description: string;
};

export default async function createPopup<T>(
  position: { x: number, y: number },
  width: number,
  above: boolean,
  title: string,
  options: PopupOption<T>[],
  description?: string
): Promise<T> {
  // TODO: (future, low prio) add dragging for title bar

  return new Promise<T>((resolve, reject) => {
    let frame: d3.Selection<HTMLElement, any, any, any>;
    let remove: () => void;

    // create popup
    if (nativeDialogSupported()) {
      frame = select(document.body)
        .append('dialog')
        .classed('annotator-popup', true);
      (frame.node() as unknown as HtDialog).showModal();
      remove = () => frame.remove();
      frame.on('click', e => {
        if (e.target === frame.node()) {
          remove();
          reject();
        }
      });
    } else {
      const bg = select(document.body).append('div')
        .classed('modal', true);
      remove = () => bg.remove();

      bg.on('click', () => { remove(); reject(); });
      frame = bg.append('div')
    };

    frame.classed('modal__frame', true)
      .style('--position-x', `${position.x}px`)
      .style('--position-y', `${position.y}px`)
      .style('--width', `${width}px`)
      .style('--offset-y', above ? `-100%` : `0`);

    const titlebar = frame.append('div')
      .classed('modal__titlebar', true);
    titlebar.append('span')
      .classed('modal__title', true)
      .html(title);
    titlebar.append('button')
      .classed('modal__close-button', true)
      .classed('button', true)
      .classed('button--red', true)
      .classed('button--small', true)
      .html(`<i class="fa fa-fw fa-times"></i>`)
      .on('click', () => { remove(); reject(); });

    if (description !== undefined) {
      frame.append('div')
        .classed('modal__description', true)
        .html(description);
    }

    const buttons = frame.append('div')
      .classed('modal__options', true);

    buttons.selectAll<HTMLButtonElement, PopupOption<T>>('.dummy')
      .data(options)
      .enter()
      .append('button')
      .classed('modal__option', true)
      .classed('button', true)
      .classed('button--medium', true)
      .html(d => d.description)
      .on('click', (_event, d) => {
        resolve(d.key);
        remove();
      });
  });
}

