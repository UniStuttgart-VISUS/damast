import {DataWorker,MessageData} from './data-worker';
import {timed_from_tuples} from './timeline-data';


class TimelineWorker extends DataWorker<any> {
  async handleMainEvent(data: MessageData<any>) {
    throw data;
  }

  async handleDataEvent(data: MessageData<any>) {
    this.setMessage('timeline-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

    const data2 = timed_from_tuples(data.data.data,
      data.data.only_active,
      data.data.active_aspect,
      data.data.display_mode,
      data.data.timeline_mode,
      data.data.main_religions,
      data.data.religion_order,
      data.data.colors,
      data.data.total_year_range,
    );

    if (data.type === 'set-data') {
      await this.sendToMainThread({
        type: 'set-data',
        target: 'timeline',
        data: {
          stack: data2,
          time_filter: data.data.time_filter,
          religion_names: data.data.religion_names,
          display_mode: data.data.display_mode,
          timeline_mode: data.data.timeline_mode,
        }
      });
    } else {
      throw data;
    }

    this.clearMessage('timeline-worker');
  }
};


const ctx: Worker = self as any;
const w = new TimelineWorker(ctx, 'timeline');
