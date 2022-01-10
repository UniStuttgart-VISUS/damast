import * as d3array from 'd3-array';
import * as d3hier from 'd3-hierarchy';
import * as T from './datatypes';
import {DataWorker,MessageData} from './data-worker';
import {confidence_keys} from './confidence-aspects';
import * as ReligionFilter from './religion-filter';

class ReligionWorker extends DataWorker<any> {
  private hierarchy: d3hier.HierarchyNode<T.OwnHierarchyNode>;
  private data: any[];
  private hierarchy_depth: number;
  private religion_parent_by_level: Map<number, number>[];
  private active_aspect: T.ConfidenceAspect;
  private display_mode: T.DisplayMode;
  private brush_only_active: boolean;
  private colorscale: T.TransferableColorscheme;
  private religion_filter: ReligionFilter.ReligionFilter;
  private existing_religions: Set<number> = new Set<number>();

  async handleMainEvent(data: MessageData<any>) {
    // nothing
    throw data.type;
  }

  async handleDataEvent(data: MessageData<any>) {
    this.hierarchy = d3hier.hierarchy(data.data.hierarchy.data);
    this.data = data.data.data;
    this.active_aspect = data.data.active_aspect;
    this.display_mode = data.data.display_mode;
    this.brush_only_active = data.data.brush_only_active;
    this.colorscale = data.data.colors;
    this.religion_filter = data.data.religion_filter;
    this.existing_religions = data.data.existing_religions;

    this.setMessage('religion-worker-create-areas', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');
    const per_religion = this.createAreas();
    const areas = {};
    per_religion.forEach((v, k) => areas[k] = v);

    // do nothing with data
    await this.sendToMainThread({
      type: 'set-data',
      target: 'religion',
      data: {
        hierarchy: this.hierarchy,
        areas: areas,
        filter: this.religion_filter,
        display_mode: this.display_mode,
      }
    });

    this.clearMessage('religion-worker-create-areas');
  }

  private createAreas() {
    const per_religion = new Map<number, Array<any>>();
    const data = this.data;

    const active = data.filter(d => d.active);
    const inactive = data.filter(d => !d.active);
    
    this.hierarchy.each(node => {
      const fields = [];
      const aspect_key = confidence_keys.get(this.active_aspect);
    
      const active_for_this = active.filter(d => d.religion_id === node.data.id);
      const inactive_for_this = inactive.filter(d => d.religion_id === node.data.id);
    
      if (active_for_this.length === 0 && inactive_for_this.length === 0) {
        if (this.display_mode === T.DisplayMode.Religion) {
          fields.push({
            value: node.data.id,
            amount: 1,
            count: 0,
            offset: 0,
            type: this.existing_religions.has(node.data.id) ? 2 : 1,
            color: this.existing_religions.has(node.data.id) ? this.colorscale[node.data.id] : 'grey',
          });
        } else {
          const valid_religion_ids = new Set<number>(node.descendants().map(d => d.data.id));
    
          fields.push({
            value: null,
            amount: 1,
            offset: 0,
            count: 0,
            type: 1,
            color: 'grey'
          });
        }
      } else {
        const active_scale = this.brush_only_active
          ? active_for_this.length > 0 ? 1 : 0
          : active_for_this.length / (active_for_this.length + inactive_for_this.length);
        if (this.display_mode === T.DisplayMode.Religion) {
          fields.push({
            value: node.data.id,
            amount: isNaN(active_scale) ? 0 : active_scale,
            count: active_for_this.length,
            offset: 0,
            type: 0,
            color: this.colorscale[node.data.id],
          });
          fields.push({
            value: node.data.id,
            amount: isNaN(active_scale) ? 1 : 1-active_scale,
            offset: isNaN(active_scale) ? 0 : active_scale,
            count: inactive_for_this.length,
            type: 2,
            color: this.colorscale[node.data.id],
          });
        } else {
          const active_confidence = aspect_key === 'source_confidences'
            ? active_for_this.map(d => d.source_confidences).reduce((a,b) => a.concat(b), [])
            : active_for_this.map(d => d[aspect_key]);
          const inactive_confidence = aspect_key === 'source_confidences'
            ? inactive_for_this.map(d => d.source_confidences).reduce((a,b) => a.concat(b), [])
            : inactive_for_this.map(d => d[aspect_key]);
    
          const active_total = Array.from(d3array.rollup(active_confidence, v => v.length, d => d))
            .map(([key, value]) => {
              const confidence = key === 'null' ? null : <T.Confidence>key;
              return {
                type: 0,
                amount: value,
                value: confidence,
                color: this.colorscale[<string>key],
              };
            });
          const inactive_total = Array.from(d3array.rollup(inactive_confidence, v => v.length, d => d))
            .map(([key, value]) => {
              const confidence = key === 'null' ? null : <T.Confidence>key;
              return {
                type: 2,
                amount: value,
                value: confidence,
                color: this.colorscale[<string>key],
              };
            });
    
          const total: any[] = active_total.concat(inactive_total)
            .sort((a, b) => {
              const idx_a = T.confidence_values.indexOf(a.value);
              const idx_b = T.confidence_values.indexOf(b.value);
    
              if (idx_a !== idx_b) return idx_a - idx_b;
              return a.type - b.type;
            })
            .filter(d => d.amount);
    
          const sum = d3array.sum(total, d => d.amount);
    
          let offset = 0;
          total.forEach(d => {
            d.offset = offset / sum;
            offset += d.amount;
            d.count = d.amount;
            d.amount /= sum;
            fields.push(d);
          });
        }
      }
    
      per_religion.set(node.data.id, fields);
    });
    
    return per_religion;
  }
};


const ctx: Worker = self as any;
const w = new ReligionWorker(ctx, 'religion');
