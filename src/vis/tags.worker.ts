import * as d3array from 'd3-array';

import {DataWorker,MessageData} from './data-worker';
import * as T from './datatypes';
import {TagFilter} from './tag-filter';


class TagsWorker extends DataWorker<any> {
  private data: T.LocationData[];
  private tags: T.Tag[];
  private tag_filter: TagFilter;

  async handleMainEvent(data: MessageData<any>) {
    throw data;
  }

  async handleDataEvent(data: MessageData<any>) {
    if (data.type === 'set-data') {
      this.data = data.data.evidence;
      this.tags = data.data.tags;
      this.tag_filter = data.data.tag_filter;

      await this.calculateAndSend();
    } else {
      throw data;
    }
  }

  private async calculateAndSend() {
    this.setMessage('tags-worker.calculateAndSend', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

    const active_evidence_ids = new Set<number>(this.data.filter(d => d.active).map(d => d.tuple_id));

    const data = this.tags.map(d => {
      const active_count = Array.from(d.evicence_ids)
        .filter(e => active_evidence_ids.has(e))
        .length;
      const inactive_count = d.evicence_ids.size - active_count;
      return {
        ...d,
        active_count,
        inactive_count
      };
    }).sort((a,b) => (b.active_count - a.active_count) || (b.inactive_count - a.inactive_count));

    const maximum = d3array.max(data, datum => datum.evicence_ids.size);

    await this.sendToMainThread({
      type: 'set-data',
      target: 'tags',
      data: {
        tags: data,
        maximum,
        tag_filter: this.tag_filter,
      }
    });

    this.clearMessage('tags-worker.calculateAndSend');
  }
};

const ctx: Worker = self as any;
const w = new TagsWorker(ctx, 'tags');


