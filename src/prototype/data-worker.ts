export type MessageDataType =
    'pass-message-port'
  | 'set-show-only-active'
  | 'set-display-mode'
  | 'set-timeline-mode'
  | 'set-map-mode'
  | 'set-confidence-aspect'
  | 'load-data'
  | 'set-data'
  | 'set-religion-port'
  | 'set-untimed-port'
  | 'set-confidence-port'
  | 'set-map-port'
  | 'set-location-list-port'
  | 'set-source-list-port'
  | 'set-timeline-port'
  | 'set-tags-port'
  | 'set-message-port'
  | 'set-zoom-level'
  | 'forward-to-data'
  | 'set-filter' | 'clear-filter'
  | 'set-brush' | 'clear-brush'
  | 'set-message'
  | 'notify-is-loading'
  | 'export-visualization-state'
  | 'import-visualization-state'
  | 'set-settings-data'
  | 'set-map-state'
  | 'set-map-filter'
  | 'generate-report'
  | 'describe-filters'
  ;

export interface MessageData<T> {
  type: MessageDataType;
  target?: string;
  source?: string;
  data: T;
};

export abstract class DataWorker<T> {
  private _port: MessagePort;

  constructor(
    private _context: Worker,
    private _view_target?: string
  ) {
    this._context.addEventListener('message', async event => this.messageHandler(event));
  }

  private async messageHandler(event: MessageEvent) {
    if (event.data.type === 'pass-message-port') {
      this._port = event.data.data;
      this._port.onmessage = async (evt: MessageEvent) => {
        await this._handleDataEvent(evt.data);
      };
    } else if (event.data.type === 'forward-to-data') {
      await this.sendToDataThread(event.data.data);
    } else {
      await this.handleMainEvent(event.data);
    }
  }

  private async _handleDataEvent(evt: MessageData<T>) {
    if (evt.type === 'set-brush') {
      await this.handleSetBrush(evt);
    } else if (evt.type === 'clear-brush') {
      await this.handleClearBrush(evt);
    } else if (evt.type === 'notify-is-loading') {
      await this.sendToMainThread(evt);
    } else {
      await this.handleDataEvent(evt);
    }
  }

  protected async handleSetBrush(evt: MessageData<T>) {
    await this.sendToMainThread(evt);
  }

  protected async handleClearBrush(evt: MessageData<T>) {
    await this.sendToMainThread(evt);
  }

  protected abstract handleMainEvent(data: MessageData<T>): Promise<any>;
  protected abstract handleDataEvent(data: MessageData<T>): Promise<any>;

  protected async sendToMainThread(data: MessageData<T>) {
    this._context.postMessage(data);
  }

  protected async sendToDataThread(data: MessageData<T>) {
    this._port.postMessage(data);
  }

  protected async setMessage(key: string, html: string) {
    if (this._view_target !== undefined) this._context.postMessage({type: 'notify-is-loading', target: this._view_target, data: {html, state: true}});
    this._port.postMessage({type: 'set-message', data: {key, html, state: true}});
  }
  protected async clearMessage(key: string) {
    if (this._view_target !== undefined) this._context.postMessage({type: 'notify-is-loading', target: this._view_target, data: {state: false}});
    this._port.postMessage({type: 'set-message', data: {key, state: false}});
  }
};
