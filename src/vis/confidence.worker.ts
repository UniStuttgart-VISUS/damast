import {DataWorker,MessageData} from './data-worker';
import {createConfidenceData} from './confidence-filter';

class ConfidenceWorker extends DataWorker<any> {
  async handleMainEvent(data: MessageData<any>) {
    // nothing
    throw data.type;
  }

  async handleDataEvent(data: MessageData<any>) {
    this.setMessage('confidence-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

    const d = createConfidenceData(
      data.data.data,
      data.data.confidence_filter,
      data.data.confidence_aspect,
      data.data.colors
    );

    await this.sendToMainThread({
      type: 'set-data',
      target: 'confidence',
      data: {
        ...d,
        mode: data.data.mode,
      },
    });

    this.clearMessage('confidence-worker');
  }
};


const ctx: Worker = self as any;
const w = new ConfidenceWorker(ctx, 'confidence');
