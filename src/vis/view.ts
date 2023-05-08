// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

import {MessageDataType,MessageData} from './data-worker';

export default abstract class View<_DataType, _LinkDataType> {
  private _default_symbol: string;
  private readonly _original_title: string;
  private _has_changes: boolean = false;

  constructor(
    protected worker: Worker,
    protected container: GoldenLayout.ComponentContainer,
    private source_name: string,
  ) {
    this._default_symbol = source_name;
    this._original_title = (<any>container)?._config.title;

    this.container?.on('modal-button-clicked' as unknown as keyof GoldenLayout.EventEmitter.EventParamsMap, () => this.openModal());
  }

  abstract setData(data: _DataType): void;
  abstract linkData(data: _LinkDataType): void;

  protected sendToDataThread<T>(type: MessageDataType, data: T) {
    const capsuled_message: MessageData<T> = {
      type,
      data,
      source: this.source_name
    };
    const data_message: MessageData<MessageData<T>> = {
      type: 'forward-to-data',
      data: capsuled_message,
      source: this.source_name
    };

    this.worker.postMessage(data_message);
  }

  protected setMessage(html: string, symbol: (string | null) = null) {
    const payload = {
      key: (symbol === null) ? this._default_symbol : symbol,
      state: true,
      html,
    };

    this.sendToDataThread('set-message', payload);
  }

  protected clearMessage(symbol: (string | null) = null) {
    this.sendToDataThread('set-message', {
      key: (symbol === null) ? this._default_symbol : symbol,
      state: true,
    });
  }

  protected setHasChanges(changes: boolean) {
    this._has_changes = changes;

    this.retitle();
  }

  protected abstract openModal();

  private _loading_state: boolean = false;
  private _loading_state_html: string = '';
  setLoadingState({state, html}: {state: boolean, html?: string}) {
    this._loading_state = state;
    if (state) this._loading_state_html = html;

    this.retitle();
  }

  private retitle(): void {
    const loading_state = this._loading_state ? `${this._loading_state_html} ` : '';
    const change_state = this._has_changes
      ? `<i class="yellow-icon fa fa-fw fa-asterisk"></i> `
      : '';

    this.container.setTitle(`${loading_state}${change_state}${this._original_title}`);
  }
};
