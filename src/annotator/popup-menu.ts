import { select, Selection } from 'd3-selection';

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
    // create popup
    const bg = select(document.body).append('div')
      .classed('modal', true);
    const remove = () => bg.remove();

    bg.on('click', () => { remove(); reject(); });

    const frame = bg.append('div')
      .classed('modal__frame', true)
      .style('--position-x', `${position.x}px`)
      .style('--position-y', `${position.y}px`)
      .style('--width', `${width}px`)
      .style('--offset-y', above ? `-100%` : `0`)
      .on('click', evt => evt.stopPropagation());

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

