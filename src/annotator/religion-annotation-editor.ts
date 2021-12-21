import { select, Selection } from 'd3-selection';
import { GET, PATCH, PUT, DELETE } from './rest';
import stringsEqual from './empty-string-compare';
import AnnotationEditor from './annotation-editor';
import addTitles from './form-add-titles';
import { confirm_dialog } from '../common/dialog';

export default class ReligionAnnotationEditor extends AnnotationEditor {
  private _religions: { id: number, name: string }[];
  private _confidences: { id: null | string, name: string }[];

  protected async loadCacheData() {
    const religions = await this.cache.religions;
    this._religions = [
      { id: null, name: '' },
      ...religions
    ];

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
        religion_id: null,
        annotation_id: null,
        confidence: null,
        comment: null,
      };
    }
    else this.instanceData = await GET(`../rest/religion-instance/${this.databaseAnnotation.religion_instance_id}`);
  }

  protected initializeValues() {
    if (this.entity_id !== null) {
      select<HTMLSelectElement, any>('#religion').node().value = `${this.entity_id}`;
    }
  }

  protected collectChangedData() {
    const form = select<HTMLElement, any>('.sidebar form.editor__fields');

    // collect values that have changed
    const annotationComment = form.select<HTMLInputElement>('#annotation-comment').node().value;
    const annotationData: any = {};

    if (!stringsEqual(this.databaseAnnotation.comment, annotationComment)) annotationData.comment = annotationComment;

    if (this.databaseAnnotation.span[0] !== this.annotationSpan[0] || this.databaseAnnotation.span[1] !== this.annotationSpan[1]) {
      annotationData.span = `[${this.annotationSpan[0]}, ${this.annotationSpan[1]}]`;
    }

    const instanceData: any = {};

    const religion_id_selector = form.select<HTMLSelectElement>('#religion').node();
    const religion_id_ = religion_id_selector.options[religion_id_selector.options.selectedIndex].value;
    const religion_id = religion_id_ === '' ? null : parseInt(religion_id_);
    if (religion_id !== this.instanceData.religion_id) instanceData.religion_id = religion_id;

    const confidence_selector = form.select<HTMLSelectElement>('#confidence').node();
    const confidence_ = confidence_selector.options[confidence_selector.options.selectedIndex].value;
    const confidence = confidence_ === '' ? null : confidence_;
    if (confidence !== this.instanceData.confidence) instanceData.confidence = confidence;

    const instanceComment = form.select<HTMLInputElement>('#religion-instance-comment').node().value;
    if (!stringsEqual(instanceComment, this.instanceData.comment)) instanceData.comment = instanceComment;

    return { annotationData, instanceData };
  }

  protected hasChangedFields(): boolean {
    const { annotationData, instanceData } = this.collectChangedData();
    return Object.keys({ ...annotationData, ...instanceData }).length > 0;
  }

  protected render(dom_area: d3.Selection<HTMLElement, any, any, any>): void {
    const ref = this;

    dom_area.append('label')
      .attr('for', 'religion')
      .text('Religion:');
    const s = dom_area.append('select')
      .attr('name', 'religion')
      .attr('required', '')
      .attr('id', 'religion');
    s.selectAll('.dummy')
      .data(this._religions)
      .enter()
      .append('option')
      .attr('value', d => d.id === null ? '' : d.id)
      .attr('hidden', d => d.id === null ? '' : null)
      .attr('selected', d => d.id === ref.instanceData.religion_id ? '' : null)
      .html(d => d.name);

    dom_area.append('label')
      .attr('for', 'confidence')
      .text('Confidence:');
    const s2 = dom_area.append('select')
      .attr('name', 'confidence')
      .attr('id', 'confidence');
    s2.selectAll('.dummy')
      .data(this._confidences)
      .enter()
      .append('option')
      .attr('value', d => d.id === null ? '' : d.id)
      .attr('hidden', d => d.id === null ? '' : null)
      .attr('selected', d => d.id === ref.instanceData.confidence ? '' : null)
      .html(d => d.name);

    dom_area.append('label')
      .attr('for', 'religion-instance-comment')
      .text('Religion instance comment:');
    dom_area.append('input')
      .attr('type', 'text')
      .attr('name', 'religion-instance-comment')
      .attr('id', 'religion-instance-comment')
      .attr('value', ref.instanceData.comment);

    addTitles(dom_area as Selection<HTMLFormElement, any, any, any>, [
      ['religion', 'Religion this religion instance refers to.'],
      ['confidence', 'Confidence that this is the correct religion to refer to.'],
      ['religion-instance-comment', 'Comment'],
    ]);
  }

  protected async onSave(): Promise<void> {
    const { annotationData, instanceData } = this.collectChangedData();

    if (instanceData.religion_id === null) return Promise.reject('Must select a religion');

    if (this.isNew) {
      // creaVte an annotation
      const annotation_data: any = {
        document_id: this.document_id,
        comment: annotationData.comment || null,
        span: JSON.stringify(this.databaseAnnotation.span),  // int4range with inclusive bounds
      };
      const { annotation_id } = await PUT(`../rest/annotation/0`, annotation_data);

      annotation_data.id = annotation_id;
      annotation_data.span = this.databaseAnnotation.span;

      Object.assign(this.databaseAnnotation, annotation_data);

      // create a religion instance
      instanceData.annotation_id = annotation_id;
      const { religion_instance_id } = await PUT(`../rest/religion-instance/0`, instanceData);

      instanceData.religion_instance_id = religion_instance_id;
      Object.assign(this.instanceData, instanceData);

      this.databaseAnnotation.religion_instance_id = religion_instance_id;
      this._resolve(this.databaseAnnotation);
      this.discard();

    } else {
      const patch_annotation = (Object.entries(annotationData).length)
        ? PATCH(`../rest/annotation/${this.databaseAnnotation.id}`, annotationData)
        : Promise.resolve();

      const patch_instance = (Object.entries(instanceData).length)
        ? PATCH(`../rest/religion-instance/${this.instanceData.id}`, instanceData)
        : Promise.resolve();

      await Promise.all<string | void>([patch_annotation, patch_instance]);

      if (annotationData.comment !== undefined) this.databaseAnnotation.comment = annotationData.comment;
      if (annotationData.span !== undefined) this.databaseAnnotation.span = this.annotationSpan;

      Object.assign(this.instanceData, instanceData);
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
        await DELETE(`../rest/religion-instance/${this.instanceData.id}`);

        const remaining_annotations = this.annotator.annotations.filter(d => d !== this.annotation);
        this.annotator.annotations = remaining_annotations;

        this._reject('deleted annotation');
        this.discard();
      }).catch(() => {});
    }
  }

  protected get annotationType(): string { return 'Religion'; }
};
