import * as d3 from 'd3';

type CallbackFn<T> = ((t: T) => void);
type BodyCreateFn<T> = ((body: d3.Selection<HTMLElement, any, any, any>, resolve: CallbackFn<T>, reject: CallbackFn<void>) => void);

class Dialog<T> {
  private modal: d3.Selection<HTMLElement, any, any, any>;

  constructor(
    protected readonly parent: d3.Selection<d3.BaseType, any, any, any>,
    protected readonly success_fn: CallbackFn<T>,
    protected readonly reject_fn: CallbackFn<void>,
    protected readonly body_build_fn: BodyCreateFn<T>,
    private readonly modal_data_role?: string
  ) {

  }

  build() {
    let body: d3.Selection<HTMLElement, any, any, any>;

    if (nativeDialogSupported()) {
      body = this.modal = this.parent.append('dialog')
        .classed('modal', true)
        .classed('modal__body', true);
      (this.modal.node() as unknown as HTMLDialogElement).showModal();
    } else {
      this.modal = this.parent.append('div')
        .classed('modal', true)
        .classed('modal__background', true);
      if (this.modal_data_role) this.modal.attr('data-role', this.modal_data_role);
      body = this.modal
        .append('div')
        .classed('modal__body', true);
    }

    this.modal.on('click', e => {
      if (e.target === this.modal.node()) this.reject();
    });

    this.body_build_fn(body, this.success.bind(this), this.reject.bind(this));
  }

  private teardown() {
    this.modal.remove();
  }

  protected success(t: T) {
    this.success_fn(t);
    this.teardown();
  }

  protected reject() {
    this.reject_fn(<void>undefined);
    this.teardown();
  }
};

export function create_dialog<T>(
  parent: d3.Selection<d3.BaseType, any, any, any>,
  body_build_fn: BodyCreateFn<T>,
  modal_data_role?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => new Dialog<T>(parent, resolve, reject, body_build_fn, modal_data_role).build());
}

export interface ButtonOptions {
  title?: string;
  classes?: string[];
};

export interface ValueOption<T> {
  value: T;
};

export function confirm_dialog(
  title_html: string,
  body_html: string,
  cancel_options: ButtonOptions,
  confirm_options: ButtonOptions,
  modal_data_role?: string
): Promise<void> {
  const create_fn = (sel: d3.Selection<HTMLDivElement, any, any, any>, resolve: CallbackFn<void>, reject: CallbackFn<void>) => {
    sel.append('h3')
      .classed('modal__title', true)
      .html(title_html);
    sel.append('div')
      .classed('modal__content', true)
      .html(body_html);
    const footer = sel.append('div')
      .classed('modal__footer', true);
    const cancel = footer.append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .html(cancel_options.title || '<i class="fa fa-reply fa--pad-right"></i>Cancel')
      .on('click', _ => reject(<void>undefined));
    if (cancel_options.classes) cancel_options.classes.forEach(class_ => cancel.classed(class_, true));
    else cancel.classed('button--cancel', true);

    const conf = footer.append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .html(confirm_options.title || '<i class="fa fa-check fa--pad-right"></i>Confirm')
      .on('click', _ => resolve(<void>undefined));
    if (confirm_options.classes) confirm_options.classes.forEach(class_ => conf.classed(class_, true));
    else conf.classed('button--confirm', true);
  };
  return create_dialog<void>(d3.select('body'), create_fn, modal_data_role);
}

export function choice_or_cancel_dialog<T>(
  title_html: string,
  body_html: string,
  cancel_options: ButtonOptions,
  choices_options: (ButtonOptions & ValueOption<T>)[]
): Promise<T> {
  const create_fn = (sel: d3.Selection<HTMLDivElement, any, any, any>, resolve: CallbackFn<T>, reject: CallbackFn<void>) => {
    sel.append('h3')
      .classed('modal__title', true)
      .html(title_html);
    sel.append('div')
      .classed('modal__content', true)
      .html(body_html);
    const footer = sel.append('div')
      .classed('modal__footer', true);
    const cancel = footer.append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .html(cancel_options.title || '<i class="fa fa-reply fa--pad-right"></i>Cancel')
      .on('click', _ => reject(<void>undefined));
    if (cancel_options.classes) cancel_options.classes.forEach(class_ => cancel.classed(class_, true));
    else cancel.classed('button--cancel', true);

    choices_options.forEach(opt => {
      const btn = footer.append('button')
        .classed('button', true)
        .classed('button--medium', true)
        .html(opt.title || '')
        .on('click', _ => resolve(opt.value));
      if (opt.classes) opt.classes.forEach(class_ => btn.classed(class_, true));

    });

  };
  return create_dialog<T>(d3.select('body'), create_fn);
}

export function accept_dialog(
  title_html: string,
  body_html: string,
  confirm_options: ButtonOptions
): Promise<void> {
  const create_fn = (sel: d3.Selection<HTMLDivElement, any, any, any>, resolve: CallbackFn<void>, reject: CallbackFn<void>) => {
    sel.append('h3')
      .classed('modal__title', true)
      .html(title_html);
    sel.append('div')
      .classed('modal__content', true)
      .html(body_html);
    const footer = sel.append('div')
      .classed('modal__footer', true);

    const conf = footer.append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .classed('button--right', true)
      .html(confirm_options.title || '<i class="fa fa-check fa--pad-right"></i>Accept')
      .on('click', _ => resolve(<void>undefined));
    if (confirm_options.classes) confirm_options.classes.forEach(class_ => conf.classed(class_, true));
    else conf.classed('button--confirm', true);
  };
  return create_dialog<void>(d3.select('body'), create_fn);
}

declare class HTMLDialogElement {
  open(): void;
  showModal?(): void;
};
export function nativeDialogSupported(): boolean {
  if (!('HTMLDialogElement' in window)) return false;
  return HTMLDialogElement.prototype.showModal !== undefined;
}
