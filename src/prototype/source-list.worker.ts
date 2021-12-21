import * as T from './datatypes';
import * as d3array from 'd3-array';
import * as d3scale from 'd3-scale';
import {DataWorker,MessageData} from './data-worker';
import {CancelablePromise,CancelablePromiseType} from './cancelable-promise';
import {SourceWithPayload,CountStackDatum,SourceFilter} from './source-data';


class SourceListWorker extends DataWorker<any> {
  private data: T.LocationData[];
  private confidence_aspect_key: string;
  private display_mode: T.DisplayMode;
  private sources: SourceWithPayload[];
  private religion_order: {};
  private colors: {};
  private source_filter: SourceFilter;
  private religion_names: Map<number, string>;

  async handleMainEvent(data: MessageData<any>) {
    throw data;
  }

  async handleDataEvent(data: MessageData<any>) {
    this.setMessage('source-list-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

    if (data.type === 'set-data') {
      this.data = data.data.evidence;
      this.confidence_aspect_key = data.data.confidence_aspect_key;
      this.display_mode = data.data.display_mode;
      this.sources = data.data.sources;
      this.religion_order = data.data.religion_order;
      this.colors = data.data.colors;
      this.source_filter = data.data.source_filter;
      this.religion_names = data.data.religion_names;


      const per_source = new Map<number, T.LocationData[]>(
        this.sources.map(d => <[number, T.LocationData[]]>[d.id, this.data.filter(e => e.source_ids?.includes(d.id))])
      );

      let max_per_source: number = 0;

      const source_data: SourceWithPayload[] = this.sources
        .map((d: SourceWithPayload) => {
          d.data = per_source.get(d.id);
          d.stack = this.sourceStackData(d.data);
          d.active = this.source_filter === null || this.source_filter.has(d.id);

          max_per_source = Math.max(max_per_source, d.data.length);

          return d;
        });

      source_data.sort((a,b) => b.data.length - a.data.length);

      await this.sendToMainThread({
        type: 'set-data',
        target: 'source-list',
        data: {
          source_data,
          max_per_source,
          display_mode: this.display_mode,
          religion_names: this.religion_names,
        }
      });
    } else {
      throw data;
    }

    this.clearMessage('source-list-worker');
  }

  private sourceStackData(data: T.LocationData[]): CountStackDatum[] {
    const display_mode = this.display_mode;
    const total_data: CountStackDatum[] = [];

    const simple_data = [];
    data.forEach(datum => {
      if (display_mode === T.DisplayMode.Religion) {
        simple_data.push({
          data_id: datum.religion_id,
          active: datum.active
        });
      } else {
        if (this.confidence_aspect_key !== 'source_confidences') {
          simple_data.push({
            data_id: datum[this.confidence_aspect_key],
            active: datum.active
          });
        } else datum[this.confidence_aspect_key].forEach(did => {
          simple_data.push({
            data_id: did,
            active: datum.active
          });
        });
      }
    });


    const nest = d3array.rollups(simple_data, v => v.length, d => d.data_id, d => d.active);

    if (display_mode === T.DisplayMode.Religion) {
      nest.sort((a, b) => this.religion_order[a[0]] - this.religion_order[b[0]]);
    } else {
      nest.sort((a, b) => {
          const ka = (a[0] === 'null') ? null : <T.Confidence>a[0];
          const kb = (b[0] === 'null') ? null : <T.Confidence>b[0];
          const idx_a = T.confidence_values.indexOf(ka);
          const idx_b = T.confidence_values.indexOf(kb);
          return idx_a - idx_b;
        });
    }

    nest.forEach(([_,v]) => v.sort((a,b) => +b[0] - +a[0]));

    let intermediate_data = [];

    nest.forEach(([key, values]) => {
      const data_id = (display_mode === T.DisplayMode.Religion)
                  ? key
                  : (key === 'null') ? null : <T.Confidence>key;
      values.forEach(([active, value]) => {
        intermediate_data.push({data_id, active, count: value});
      });
    });

    //if (this.brush_only_active) intermediate_data = intermediate_data.filter(d => d.active);

    const size = d3array.sum(intermediate_data, d => d.count);
    const scale = d3scale.scaleLinear().domain([0, size]);
    let sum = 0;

    intermediate_data.forEach(d => {
      const color = this.colors[d.data_id === null ? 'null' : d.data_id];
      const x0 = scale(sum);
      sum += d.count;
      const x1 = scale(sum);

      total_data.push({
        data_id: d.data_id,
        active: d.active,
        x: x0,
        w: x1 - x0,
        color,
        count: d.count,
      });
    });

    return total_data;
  }
};


const ctx: Worker = self as any;
const w = new SourceListWorker(ctx, 'source-list');
