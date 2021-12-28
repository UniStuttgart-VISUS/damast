import * as d3 from 'd3';
import * as T from './datatypes';
import {DataWorker,MessageData} from './data-worker';
import {confidence_keys} from './uncertainty-hierarchy';
import * as ReligionFilter from './religion-filter';

class MessageWorker extends DataWorker<any> {
  async handleMainEvent(data: MessageData<any>) {
    // nothing
    throw data.type;
  }

  async handleDataEvent(data: MessageData<any>) {
    // do nothing with data
    await this.sendToMainThread({
      type: 'set-data',
      target: 'message',
      data: data.data
    });
  }
};


const ctx: Worker = self as any;
const w = new MessageWorker(ctx, 'message');
