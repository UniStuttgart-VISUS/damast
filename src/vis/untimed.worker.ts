import * as d3 from 'd3';
import * as T from './datatypes';
import {DataWorker,MessageData} from './data-worker';
import {confidence_keys} from './uncertainty-hierarchy';
import {untimed_from_tuples} from './timeline-data';

class UntimedWorker extends DataWorker<any> {
  async handleMainEvent(data: MessageData<any>) {
    // nothing
    throw data.type;
  }

  async handleDataEvent(data: MessageData<any>) {
    this.setMessage('untimed-worker-create-areas', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

    const a = untimed_from_tuples(
      data.data.data,
      data.data.brush_only_active,
      data.data.active_aspect,
      data.data.display_mode,
      data.data.parent_religions,
      data.data.religion_order,
      data.data.colors,
    );

    await this.sendToMainThread({
      type: 'set-data',
      target: 'untimed',
      data: {
        data: a,
        brush_only_active: data.data.brush_only_active,
        active_aspect: data.data.active_aspect,
        display_mode: data.data.display_mode,
        main_religions: data.data.main_religions,
        main_religion_icons: data.data.main_religion_icons,
        religion_names: data.data.religion_names,
      }
    });

    this.clearMessage('untimed-worker-create-areas');
  }
};


const ctx: Worker = self as any;
const w = new UntimedWorker(ctx, 'untimed');
