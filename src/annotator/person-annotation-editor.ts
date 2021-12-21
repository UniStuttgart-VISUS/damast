import { select, Selection } from 'd3-selection';
import { GET, PATCH, PUT, DELETE } from './rest';
import stringsEqual from './empty-string-compare';
import AnnotationEditor from './annotation-editor';
import addTitles from './form-add-titles';
import { confirm_dialog } from '../common/dialog';

export default class PersonAnnotationEditor extends AnnotationEditor {
  private _persons: { id: number, name: string }[];
  private _confidences: { id: null | string, name: string }[];

  protected async loadCacheData() {
    const persons = await this.cache.persons;
    this._persons = [
      { id: null, name: '' },
      ...persons.map(({id, name, time_range}) => {
        const n = (time_range === '') ? name : `${name} (${time_range})`;
        return { id, name: n };
      }),
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
        person_id: null,
        annotation_id: null,
        confidence: null,
        comment: null,
      };
    }
    else this.instanceData = await GET(`../rest/person-instance/${this.databaseAnnotation.person_instance_id}`);
  }

  protected initializeValues() {
    if (this.entity_id !== null) {
      select<HTMLSelectElement, any>('#person').node().value = `${this.entity_id}`;
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

    const person_id_selector = form.select<HTMLSelectElement>('#person').node();
    const person_id_ = person_id_selector.options[person_id_selector.options.selectedIndex].value;
    const person_id = person_id_ === '' ? null : parseInt(person_id_);
    if (person_id !== this.instanceData.person_id) instanceData.person_id = person_id;

    const confidence_selector = form.select<HTMLSelectElement>('#confidence').node();
    const confidence_ = confidence_selector.options[confidence_selector.options.selectedIndex].value;
    const confidence = confidence_ === '' ? null : confidence_;
    if (confidence !== this.instanceData.confidence) instanceData.confidence = confidence;

    const instanceComment = form.select<HTMLInputElement>('#person-instance-comment').node().value;
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
      .attr('for', 'person')
      .text('Person:');
    const s = dom_area.append('select')
      .attr('name', 'person')
      .attr('required', '')
      .attr('id', 'person');
    s.selectAll('.dummy')
      .data(this._persons)
      .enter()
      .append('option')
      .attr('value', d => d.id === null ? '' : d.id)
      .attr('hidden', d => d.id === null ? '' : null)
      .attr('selected', d => d.id === ref.instanceData.person_id ? '' : null)
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
      .attr('for', 'person-instance-comment')
      .text('Person instance comment:');
    dom_area.append('input')
      .attr('type', 'text')
      .attr('name', 'person-instance-comment')
      .attr('id', 'person-instance-comment')
      .attr('value', ref.instanceData.comment);

    addTitles(dom_area as Selection<HTMLFormElement, any, any, any>, [
      ['person', 'Person this person instance refers to.'],
      ['confidence', 'Confidence that this is the correct person to refer to.'],
      ['person-instance-comment', 'Comment'],
    ]);
  }

  protected async onSave(): Promise<void> {
    const { annotationData, instanceData } = this.collectChangedData();

    if (instanceData.person_id === null) return Promise.reject('Must select a person');

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

      // create a person instance
      instanceData.annotation_id = annotation_id;
      const { person_instance_id } = await PUT(`../rest/person-instance/0`, instanceData);

      instanceData.person_instance_id = person_instance_id;
      Object.assign(this.instanceData, instanceData);

      this.databaseAnnotation.person_instance_id = person_instance_id;
      this._resolve(this.databaseAnnotation);
      this.discard();

    } else {
      const patch_annotation = (Object.entries(annotationData).length)
        ? PATCH(`../rest/annotation/${this.databaseAnnotation.id}`, annotationData)
        : Promise.resolve();

      const patch_instance = (Object.entries(instanceData).length)
        ? PATCH(`../rest/person-instance/${this.instanceData.id}`, instanceData)
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
        await DELETE(`../rest/person-instance/${this.instanceData.id}`);

        const remaining_annotations = this.annotator.annotations.filter(d => d !== this.annotation);
        this.annotator.annotations = remaining_annotations;

        this._reject('deleted annotation');
        this.discard();
      }).catch(() => {});
    }
  }

  protected get annotationType(): string { return 'Person'; }
};

