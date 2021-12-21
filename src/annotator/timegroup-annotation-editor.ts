import { select, Selection } from 'd3-selection';
import { GET, PATCH, PUT, DELETE } from './rest';
import stringsEqual from './empty-string-compare';
import AnnotationEditor from './annotation-editor';
import addTitles from './form-add-titles';
import { confirm_dialog } from '../common/dialog';

export default class TimegroupAnnotationEditor extends AnnotationEditor {
  private _confidences: { id: null | string, name: string }[];

  private _time_instances: { comment: string | null, confidence: string | null, start: number | null, end: number | null, id: number }[] = [];

  protected async loadCacheData() {
    const conf: string[] = await this.cache.confidence;
    this._confidences = [
      { id: null, name: '' },
      ...conf.map(d => { return { id: d, name: d }; })
    ];
  }

  protected async loadInstance() {
    if (this.isNew) {
      this.instanceData = {
        id: null,
        annotation_id: null,
      };
    } else {
      const { annotation_id, time_group_id, time_spans } = await GET(`../rest/time-group/${this.databaseAnnotation.time_group_id}`);

      this.instanceData = { id: time_group_id, annotation_id };
      this._time_instances = time_spans;
    }
  }

  private collectTimeInstanceData() {
    const instance_data = [];
    select<HTMLElement, any>('.sidebar form.editor__fields')
      .select('div.time-instances')
      .selectAll<HTMLDivElement, any>('.time-instance')
      .each(function() {
        const ti = select<HTMLDivElement, any>(this);

        const id = parseInt(ti.select<HTMLInputElement>('[id^="id-"]').node().value);

        const confidence_selector = ti.select<HTMLSelectElement>('[id^="confidence-"]').node();
        const confidence_ = confidence_selector.options[confidence_selector.options.selectedIndex].value;
        const confidence = confidence_ === '' ? null : confidence_;

        const comment = ti.select<HTMLInputElement>('[id^="time-instance-comment-"]').node().value;

        const start = ti.select<HTMLInputElement>('[id^="start-"]').node().valueAsNumber;
        const end = ti.select<HTMLInputElement>('[id^="end-"]').node().valueAsNumber;

        instance_data.push({id, confidence, comment, start, end});
      });

    return instance_data;
  }

  protected collectChangedData() {
    const form = select<HTMLElement, any>('.sidebar form.editor__fields');

    // collect values that have changed
    const annotationComment = form.select<HTMLInputElement>('#annotation-comment').node().value;
    const annotationData: any = {};
   //
    if (!stringsEqual(this.databaseAnnotation.comment, annotationComment)) annotationData.comment = annotationComment;

    if (this.databaseAnnotation.span[0] !== this.annotationSpan[0] || this.databaseAnnotation.span[1] !== this.annotationSpan[1]) {
      annotationData.span = `[${this.annotationSpan[0]}, ${this.annotationSpan[1]}]`;
    }

    const instance_data = this.collectTimeInstanceData();

    const newInstances = [];
    const patchInstances = [];
    const deleteInstances = this._time_instances.filter(d => !instance_data.some(i => i.id === d.id));

    instance_data.forEach(i => {
      if (i.id === null || isNaN(i.id)) {
        newInstances.push(i);
        return;
      }

      const old = this._time_instances.find(d => d.id === i.id);
      const data: any = {};
      if (old.confidence !== i.confidence) data.confidence = i.confidence;
      if (!stringsEqual(old.comment, i.comment)) data.comment = i.comment;
      if (old.start !== i.start || old.end !== i.end) {
        // always change both
        data.start = i.start;
        data.end = i.end;
      }

      if (Object.keys(data).length > 0) {
        data.id = i.id;
        patchInstances.push(data);
      }
    });

   return { annotationData, newInstances, patchInstances, deleteInstances };
  }

  protected hasChangedFields(): boolean {
    const { annotationData, newInstances, patchInstances, deleteInstances } = this.collectChangedData();
    return [ Object.keys(annotationData), newInstances, patchInstances, deleteInstances ].some(d => d.length > 0);
  }

  private addTimeInstanceToForm(parent: Selection<HTMLDivElement, any, any, any>, instance, index: number) {
    const d = parent.append('div')
      .classed('time-instance', true);

    d.append('input')
      .attr('type', 'hidden')
      .attr('id', `id-${index}`)
      .attr('value', instance.id);

    d.append('label')
      .attr('for', `time-instance-comment-${index}`)
      .text('Comment:');
    d.append('input')
      .attr('type', 'text')
      .attr('name', `time-instance-comment-${index}`)
      .attr('id', `time-instance-comment-${index}`)
      .attr('value', instance.comment);

    d.append('label')
      .attr('for', `confidence-${index}`)
      .text('Confidence:');
    const s2 = d.append('select')
      .attr('name', `confidence-${index}`)
      .attr('id', `confidence-${index}`);
    s2.selectAll('.dummy')
      .data(this._confidences)
      .enter()
      .append('option')
      .attr('value', d => d.id === null ? '' : d.id)
      .attr('hidden', d => d.id === null ? '' : null)
      .attr('selected', d => d.id === instance.confidence ? '' : null)
      .html(d => d.name);

    d.append('label')
      .attr('for', `start-${index}`)
      .text('Start:');
    d.append('input')
      .attr('type', 'number')
      .attr('required', '')
      .attr('name', `start-${index}`)
      .attr('id', `start-${index}`)
      .attr('value', instance.start);

    d.append('label')
      .attr('for', `end-${index}`)
      .text('End:');
    d.append('input')
      .attr('type', 'number')
      .attr('required', '')
      .attr('name', `end-${index}`)
      .attr('id', `end-${index}`)
      .attr('value', instance.end);

    d.append('button')
      .classed('button', true)
      .classed('button--red', true)
      .classed('button-delete-instance', true)
      .attr('type', 'button')
      .html(`<i class="fa fa-fw fa--pad-right fa-trash"></i>Delete instance`)
      .attr('title', 'Remove this time instance. Will not be applied to database until entire time group is saved.')
      .on('click', () => {
        d.remove();
        this.onInputCheckChanges();
      });

    addTitles(d, [
      [`time-instance-comment-${index}`, 'Comment'],
      [`confidence-${index}`, 'Confidence that this is the correct time span.'],
      [`start-${index}`, 'First year of time span'],
      [`end-${index}`, 'Last year of time span'],
    ]);
  }

  private _instance_index = 0;
  protected render(dom_area: d3.Selection<HTMLElement, any, any, any>): void {
    dom_area.append('h2')
      .classed('indented', true)
      .text('Time Instances');

    const time_instances = dom_area.append('div')
      .classed('indented', true)
      .classed('time-instances', true);

    this._time_instances.forEach(instance => this.addTimeInstanceToForm(time_instances, instance, this._instance_index++));

    dom_area.append('button')
      .classed('button', true)
      .classed('button--large', true)
      .classed('button-add-instance', true)
      .classed('indented', true)
      .attr('type', 'button')
      .html(`<i class="fa fa-fw fa--pad-right fa-plus"></i>New time instance`)
      .attr('title', 'Add a new time span to the group. Time spans will only be created in the database when saving the time group.')
      .on('click', () => {
        this.addTimeInstanceToForm(time_instances, { id: null, start: null, end: null, confidence: null, comment: null }, this._instance_index++);
        this.onInputCheckChanges();
      });

    this.onTimeSpanChanges();
  }

  private async createTimeInstance(instance_data: any, time_group_id: number): Promise<number> {
    const { confidence, comment, start, end } = instance_data;
    const { time_instance_id } = await PUT(`../rest/time-group/${time_group_id}/time-instance/0`, { confidence, comment, start, end });
    return time_instance_id;
  }

  protected async onSave(): Promise<void> {
    const { annotationData, newInstances, deleteInstances, patchInstances } = this.collectChangedData();

    if (this.isNew) {
      // create an annotation
      const annotation_data: any = {
        document_id: this.document_id,
        comment: annotationData.comment || null,
        span: JSON.stringify(this.databaseAnnotation.span),  // int4range with inclusive bounds
      };
      const { annotation_id } = await PUT(`../rest/annotation/0`, annotation_data);

      annotation_data.id = annotation_id;
      annotation_data.span = this.databaseAnnotation.span;
      Object.assign(this.databaseAnnotation, annotation_data);

      // create a time group
      const timeGroupData = { annotation_id };
      const { time_group_id } = await PUT(`../rest/time-group/0`, timeGroupData);

      this.instanceData.id = time_group_id;
      this.databaseAnnotation.time_group_id = time_group_id;

      // create all time instances
      if (deleteInstances.length > 0 || patchInstances.length > 0) console.error('Too many deletes and patches for a new instance:', { annotation_data, newInstances, deleteInstances, patchInstances });

      await Promise.all(newInstances.map(async d => {
        const time_instance_id = await this.createTimeInstance(d, time_group_id);
        d.id = time_instance_id;
      }));

      this._resolve(this.databaseAnnotation);
      this.discard();

    } else {
      const created_instances = [];

      const patch_annotation = (Object.entries(annotationData).length)
        ? PATCH(`../rest/annotation/${this.databaseAnnotation.id}`, annotationData)
        : Promise.resolve();

      const deletes = deleteInstances.map(d =>
        DELETE(`../rest/time-group/${this.databaseAnnotation.time_group_id}/time-instance/${d.id}`));
      const creates = newInstances.map(async d => {
        const data: any = {
          confidence: d.confidence !== undefined ? d.confidence : null,
          comment: d.comment !== undefined ? d.comment : null,
          start: d.start !== undefined ? d.start : null,
          end: d.end !== undefined ? d.end : null,
        };
        const new_id = await this.createTimeInstance(data, this.databaseAnnotation.time_group_id);
        data.id = new_id;

        created_instances.push(data);
      });
      const patches = patchInstances.map(d => {
        const { confidence, comment, start, end } = d;
        return PATCH(`../rest/time-group/${this.databaseAnnotation.time_group_id}/time-instance/${d.id}`, { confidence, comment, start, end });
      });

      await Promise.all<any>([patch_annotation, ...deletes, ...patches, ...creates]);

      // get all data (not only changed)
      const instances = this.collectTimeInstanceData()
        // but not newly created
        .filter(d => d.id !== null && !isNaN(d.id));

      this._time_instances = [ ...instances, ...created_instances ];
      if (annotationData.comment !== undefined) this.databaseAnnotation.comment = annotationData.comment;
      if (annotationData.span !== undefined) this.databaseAnnotation.span = this.annotationSpan;

      this.internalRender();
    }
  }

  protected async onDelete(): Promise<void> {
    if (this.isNew) {
      this._reject('cancelled creation');
      this.discard();
    } else {
      return confirm_dialog(
        `Really delete annotation?`,
        `Do you really want to delete this annotation? This cannot be reversed.`,
        {}, { classes: [ 'button--delete' ], title: `<i class="fa fa-trash fa--pad-right"></i>Delete` },
        `delete`
      ).then(async () => {
        // instance first, will delete annotation as well
        await DELETE(`../rest/time-group/${this.instanceData.id}`);

        const remaining_annotations = this.annotator.annotations.filter(d => d !== this.annotation);
        this.annotator.annotations = remaining_annotations;

        this._reject('deleted annotation');
        this.discard();
      }).catch(() => {});
    }
  }

  private onTimeSpanChanges() {
    // set "min" and "max" for all start and end fields to promote validation
    const parent = select<HTMLElement, any>('.sidebar form.editor__fields')
      .select('div.time-instances')
      .selectAll('div.time-instance');

    parent.each(function() {
      const start = select(this).select<HTMLInputElement>('[id^="start-"]');
      const end = select(this).select<HTMLInputElement>('[id^="end-"]');

      const start_value = start.node().valueAsNumber;
      const end_value = end.node().valueAsNumber;

      start.attr("max", isNaN(end_value) ? null : end_value);
      end.attr("min", isNaN(start_value) ? null : start_value);
    });
  }

  protected get annotationType(): string { return 'Time Group'; }

  protected async onReset(event) {
    event.preventDefault();
    event.stopPropagation();
    super.onReset(event);
  }

  protected async onInput(_event) {
    this.onTimeSpanChanges();
  }
};

