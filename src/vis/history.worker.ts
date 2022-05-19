import { DataWorker, MessageData } from './data-worker';

class HistoryWorker extends DataWorker<any> {
  async handleMainEvent(data: MessageData<any>) {
    await this.sendToDataThread(data);
  }

  async handleDataEvent(data: MessageData<any>) {
    await this.sendToMainThread({
      type: 'set-data',
      target: 'history',
      data: data.data
    });
  }
};


const ctx: Worker = self as any;
const w = new HistoryWorker(ctx, 'history');
