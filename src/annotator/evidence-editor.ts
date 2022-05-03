import { select, Selection } from 'd3-selection';
import { Annotation, Annotator } from 'dom-tree-annotator';
import DatabaseAnnotation from './database-annotation';
import stringsEqual from './empty-string-compare';
import Cache from '../common/cache';
import annotationType from './annotation-type';
import addTitles from './form-add-titles';
import { confirm_dialog } from '../common/dialog';
import { GET, PATCH, PUT, DELETE } from './rest';

export default class EvidenceEditor extends EventTarget {
  readonly finalization: Promise<DatabaseAnnotation>;
  protected _resolve: (a: DatabaseAnnotation) => void;
  protected _reject: (a: string) => void;
  protected section: Selection<HTMLElement, any, any, any>;
  private _confidences: { id: null | string, name: string }[];
  private _tags: { id: number, name: string }[];

  private _source_instance: any = null;
  private _taglist: number[] = [];
  private _beta_test_tag_id: number;  // the tag that marks annotated evidences during the beta test
  private _selected_tags: Set<number> = new Set<number>();

  constructor(
    protected annotator: Annotator,
    protected evidence: any,
    protected readonly cache: Cache,
    protected document_id: number,
    protected source_id: number,
    protected isNew: boolean,
  ) {
    super();

    this.finalization = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    // get instance data, check if cache ready
    const loadSourceInstance = this.getSourceInstance().then(i => this._source_instance = i);
    Promise.all([loadSourceInstance, this.loadCacheData()])
      .then(async () => await this.getTaglist())
      .then(async () => await this.internalRender());
  }

  private async getSourceInstance(): Promise<any> {
    if (this.isNew) {
      const { default_confidence } = (await this.cache.sources).find(d => d.id === this.source_id);

      return {
        evidence_id: null,
        comment: `Created via annotator on document ${this.document_id}.`,
        source_id: this.source_id,
        source_page: null,
        source_confidence: default_confidence,
      };
    } else {
      const instances: any[] = await GET(`../rest/evidence/${this.evidence.id}/source-instances`);
      if (instances.length !== 1) throw new Error(`Evidence ${this.evidence.id} has more than one source instance, but was created using the annotator.`);
      return instances[0];
    }
  }

  private async getTaglist(): Promise<void> {
    if (this.isNew) this._taglist = [ this._beta_test_tag_id ];
    else this._taglist = await GET(`../rest/evidence/${this.evidence.id}/tags`);

    this._selected_tags = new Set<number>(this._taglist);
  }

  protected async loadCacheData() {
    const conf: string[] = await this.cache.confidence;
    this._confidences = [
      { id: null, name: '' },
      ...conf.map(d => { return { id: d, name: d }; })
    ];
    const tags = await this.cache.tags;
    this._tags = tags.map(({id, tagname}) => { return { id, name: tagname } });

    const { id } = tags.find((d: { tagname: string, id: number }) => d.tagname === 'Annotator beta test');
    this._beta_test_tag_id = id;
  }

  private async updateInstanceInfo(): Promise<void> {
    const placeSpan = this.section.select<HTMLSpanElement>('span#place-info');
    const religionSpan = this.section.select<HTMLSpanElement>('span#religion-info');
    const personSpan = this.section.select<HTMLSpanElement>('span#person-info');
    const timeSpan = this.section.select<HTMLSpanElement>('span#time-info');

    const values = this.getValues();

    const placeData = new Promise<void>(async (resolve, reject) => {
      if (values.place_instance_id === null) {
        placeSpan.classed('instance-info--missing', true);
        placeSpan.html(`<i class="fa fa-fw fa--pad-right fa-exclamation-triangle"></i>Evidence must have a place instance!`);
        resolve();
        return;
      }

      placeSpan.classed('instance-info--missing', false)
        .html(`<i class="fa fa-fw fa--pad-right fa-pulse fa-spinner"></i>Loading...`);

      const { place_id, confidence } = await GET(`../rest/place-instance/${values.place_instance_id}`);
      const places = await this.cache.places;
      const { name } = places.find(d => d.id === place_id);

      placeSpan.html(`${values.place_instance_id} <i class="fa fa-arrow-right"></i> ${name} (${place_id}; ${confidence || '<em>no confidence value</em>'})`);
    });

    const religionData = new Promise<void>(async (resolve, reject) => {
      if (values.religion_instance_id === null) {
        religionSpan.classed('instance-info--missing', true);
        religionSpan.html(`<i class="fa fa-fw fa--pad-right fa-exclamation-triangle"></i>Evidence must have a religion instance!`);
        resolve();
        return;
      }

      religionSpan.classed('instance-info--missing', false)
        .html(`<i class="fa fa-fw fa--pad-right fa-pulse fa-spinner"></i>Loading...`);

      const { religion_id, confidence } = await GET(`../rest/religion-instance/${values.religion_instance_id}`);
      const religions = await this.cache.religions;
      const { name } = religions.find(d => d.id === religion_id);

      religionSpan.html(`${values.religion_instance_id} <i class="fa fa-arrow-right"></i> ${name} (${religion_id}; ${confidence || '<em>no confidence value</em>'})`);
    });

    const personData = new Promise<void>(async (resolve, reject) => {
      if (values.person_instance_id === null) {
        personSpan.html(`<em>no instance</em>`);
        resolve();
        return;
      }

      personSpan.html(`<i class="fa fa-fw fa--pad-right fa-pulse fa-spinner"></i>Loading...`);

      const { person_id, confidence } = await GET(`../rest/person-instance/${values.person_instance_id}`);
      const persons = await this.cache.persons;
      const { name } = persons.find(d => d.id === person_id);

      personSpan.html(`${values.person_instance_id} <i class="fa fa-arrow-right"></i> ${name} (${person_id}; ${confidence || '<em>no confidence value</em>'})`);
    });

    const timeData = new Promise<void>(async (resolve, reject) => {
      if (values.time_group_id === null) {
        timeSpan.html(`<em>no time group</em>`);
        resolve();
        return;
      }

      timeSpan.html(`<i class="fa fa-fw fa--pad-right fa-pulse fa-spinner"></i>Loading...`);

      const { time_spans } = await GET(`../rest/time-group/${values.time_group_id}`);
      let inner = '';
      if (time_spans.length === 0) inner = '<em>no time instances</em>';
      else {
        time_spans.sort((a,b) => a.start - b.start || a.end - b.end);
        inner = time_spans.map(({start, end, confidence}) => {
          const a = (start === null) ? '?' : start.toString();
          const b = (end === null) ? '?' : end.toString();
          const c = (confidence === null) ? '' : ` <em>(${confidence})</em>`;
          return `${a}&ndash;${b}${c}`;
        }).join('; ');
      }

      timeSpan.html(`${values.time_group_id} <i class="fa fa-arrow-right"></i> ${inner}`);
    });

    await Promise.all([ placeData, religionData, personData, timeData ]);
  }

  protected hasChanges(): boolean {
    const values = this.getValues();
    const source_confidence = values.source_confidence;
    delete values['source_confidence'];
    const source_confidence_changed = source_confidence !== this._source_instance.source_confidence;

    const keys = Array.from(Object.keys(values));
    const evidence_changed = keys.some(key => values[key] !== this.evidence[key]);

    const tags_changed = !((this._taglist.length === this._selected_tags.size)
      && this._taglist.every(tag_id => this._selected_tags.has(tag_id)));

    return source_confidence_changed || evidence_changed || tags_changed;
  }

  protected onInputCheckChanges() {
    const has_changes = this.hasChanges();
    const { place_instance_id, religion_instance_id } = this.getValues();
    const can_save = (has_changes || this.isNew) && this.section.select<HTMLFormElement>('form.editor__fields').node().checkValidity() && place_instance_id !== null && religion_instance_id !== null;

    this.section.select('button.button--save').attr('disabled', can_save ? null : '');
    this.dispatchEvent(new CustomEvent('change'));
  }

  protected async internalRender(): Promise<void> {
    const sidebar = select<HTMLElement, any>('.sidebar');
    sidebar.selectAll('*').remove();

    const section = sidebar.append('div')
      .classed('editor', true)
      .classed('editor--evidence', true);
    this.section = section;

    section.append('h1')
      .text(this.isNew ? `Create Evidence` : `Edit Evidence`);

    if (!this.isNew) {
      section.append('a')
        .classed('goto-geodb', true)
        .attr('href', `../GeoDB-Editor/view-evidence/${this.evidence.id}`)
        .attr('target', '_blank')
        .html(`<i class="fa fa--pad-right fa-external-link"></i> View this evidence in the GeoDB-Editor`);
    }

    const edit_section = section.append('form')
      .classed('editor__fields', true);

    edit_section.append('label')
      .attr('for', 'comment')
      .text('Comment:');
    edit_section.append('input')
      .attr('type', 'text')
      .attr('name', 'comment')
      .attr('id', 'comment')
      .attr('value', this.evidence.comment);

    edit_section.append('label')
      .attr('for', 'interpretation_confidence')
      .text('Confidence of Interpretation:');
    const s2 = edit_section.append('select')
      .attr('name', 'interpretation_confidence')
      .attr('id', 'interpretation_confidence');
    s2.selectAll('.dummy')
      .data(this._confidences)
      .enter()
      .append('option')
      .attr('value', d => d.id === null ? '' : d.id)
      .attr('hidden', d => d.id === null ? '' : null)
      .attr('selected', d => d.id === this.evidence.interpretation_confidence ? '' : null)
      .html(d => d.name);

    edit_section.append('label')
      .attr('for', 'source_confidence')
      .text('Source confidence:');
    const s3 = edit_section.append('select')
      .attr('name', 'source_confidence')
      .attr('id', 'source_confidence');
    s3.selectAll('.dummy')
      .data(this._confidences)
      .enter()
      .append('option')
      .attr('value', d => d.id === null ? '' : d.id)
      .attr('hidden', d => d.id === null ? '' : null)
      .attr('selected', d => d.id === this._source_instance.source_confidence ? '' : null)
      .html(d => d.name);

    edit_section.append('label')
      .attr('for', 'visible')
      .text('Visible:');
    edit_section.append('input')
      .attr('type', 'checkbox')
      .attr('name', 'visible')
      .attr('id', 'visible')
      .attr('checked', this.evidence.visible ? '' : null);

    edit_section.append('label')
      .attr('for', 'place_instance_id')
      .text('Place instance:');
    edit_section.append('span')
      .classed('instance-info', true)
      .attr('for', 'place_instance_id')
      .attr('id', 'place-info');
    edit_section.append('label')
      .attr('for', 'religion_instance_id')
      .text('Religion instance:');
    edit_section.append('span')
      .attr('for', 'religion_instance_id')
      .classed('instance-info', true)
      .attr('id', 'religion-info');
    edit_section.append('label')
      .attr('for', 'person_instance_id')
      .text('Person instance:');
    edit_section.append('span')
      .attr('for', 'person_instance_id')
      .classed('instance-info', true)
      .attr('id', 'person-info');
    edit_section.append('label')
      .attr('for', 'time_group_id')
      .text('Time group:');
    edit_section.append('span')
      .attr('for', 'time_group_id')
      .classed('instance-info', true)
      .attr('id', 'time-info');

    edit_section.append('input')
      .attr('type', 'hidden')
      .attr('name', 'id')
      .attr('value', this.evidence.id);

    edit_section.append('input')
      .attr('type', 'hidden')
      .attr('required', '')
      .attr('name', 'place_instance_id')
      .attr('value', this.evidence.place_instance_id);
    edit_section.append('input')
      .attr('type', 'hidden')
      .attr('name', 'person_instance_id')
      .attr('value', this.evidence.person_instance_id);
    edit_section.append('input')
      .attr('type', 'hidden')
      .attr('required', '')
      .attr('name', 'religion_instance_id')
      .attr('value', this.evidence.religion_instance_id);
    edit_section.append('input')
      .attr('type', 'hidden')
      .attr('name', 'time_group_id')
      .attr('value', this.evidence.time_group_id);

    // tags
    edit_section.append('label')
      .attr('for', 'tag_list')
      .text('Tags:');
    const s4 = edit_section.append('div')
      .attr('name', 'tag_list')
      .attr('id', 'tag_list')
      .classed('tags', true);
    this.renderTaglist();

    const closeButton = section.append('button')
      .classed('button', true)
      .classed('button--close', true)
      .attr('title', 'Close editor')
      .html('<i class="fa fa-times"></i>')
      .on('click', async () => await this.onClose())
      .attr('title', 'Close evidence editor');

    const reset = edit_section.append('input')
      .attr('type', 'reset')
      .classed('button', true)
      .classed('button--reset', true)
      .classed('button--medium', true)
      .classed('button--accent', true)
      .attr('value', 'Reset')
      .attr('title', 'Reset to state from database');

    const submit = edit_section.append('input')
      .attr('type', 'submit')
      .classed('hidden', true)
      .attr('disabled', '');

    const buttons = section.append('div')
      .classed('editor__buttons', true);

    const delete_ = buttons.append('button')
      .classed('button', true)
      .classed('button--delete', true)
      .classed('button--medium', true)
      .html(this.isNew ? `<i class="fa fa--pad-right fa-fw fa-times" ></i>Cancel creation` : `<i class="fa fa--pad-right fa-fw fa-trash" ></i>Delete`)
      .on('click', async () => await this.onDelete())
      .attr('title', this.isNew ? 'Cancel evidence creation' : 'Delete evidence from database');

    const save = buttons.append('button')
      .classed('button', true)
      .classed('button--save', true)
      .classed('button--medium', true)
      .classed('button--green', true)
      .html(this.isNew ? `<i class="fa fa--pad-right fa-fw fa-upload" ></i>Create` : `<i class="fa fa--pad-right fa-fw fa-save" ></i>Save`)
      .on('click', async () => await this.onSave())
      .attr('title', this.isNew ? 'Commit new evidence to database' : 'Save changes to evidence');

    // add titles
    addTitles(edit_section, [
      ['comment', 'Evidence comment'],
      ['interpretation_confidence', 'Specifies how confident you are in the veracity of the created evidence tuple.'],
      ['visible', 'Determines whether this evidence will show up in the visualization.'],
      ['place_instance_id', 'Reference to the place instance of this evidence.'],
      ['religion_instance_id', 'Reference to the religion instance of this evidence.'],
      ['person_instance_id', 'Reference to the person instance of this evidence.'],
      ['time_group_id', 'Reference to the time group of this evidence.'],
    ]);

    // RAF because ResetEvent is triggered before reset can do its thing => DOM contents do not match yet
    edit_section.on('reset', async (event) => {
      await this.onReset(event);
      requestAnimationFrame(() => this.onInputCheckChanges())
    });
    edit_section.on('input', async (event) => {
      await this.onInput(event);
      this.onInputCheckChanges();
    });

    this.onInputCheckChanges();
    requestAnimationFrame(async () => this.updateInstanceInfo());
  }

  private renderTaglist() {
    const parent = this.section.select<HTMLDivElement>('.tags');
    parent.selectAll('*').remove();

    const active = parent.append('div')
      .classed('tags__active', true);
    parent.append('hr');
    const inactive = parent.append('div')
      .classed('tags__inactive', true);

    const selected: {id: number, name: string}[] = [];
    const not_selected: {id: number, name: string}[] = [];
    this._tags.forEach(d => {
      if (this._selected_tags.has(d.id)) selected.push(d);
      else not_selected.push(d);
    });

    active.selectAll<HTMLButtonElement, { id: number, name: string }>('button')
      .data(selected)
      .enter()
      .append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .classed('button--green', true)
      .classed('button--forbidden', d => d.id === this._beta_test_tag_id)
      .attr('disabled', d => d.id === this._beta_test_tag_id ? '' : null)
      .html(d => `<i class="fa fa--pad-right fa-tag"></i>${d.name}`)
      .on('click', (_, d) => {
        this._selected_tags.delete(d.id);
        this.onInputCheckChanges();
        this.renderTaglist();
      });

    inactive.selectAll<HTMLButtonElement, { id: number, name: string }>('button')
      .data(not_selected)
      .enter()
      .append('button')
      .classed('button', true)
      .classed('button--medium', true)
      .classed('button--forbidden', d => d.id === this._beta_test_tag_id)
      .attr('disabled', d => d.id === this._beta_test_tag_id ? '' : null)
      .html(d => `<i class="fa fa--pad-right fa-plus"></i>${d.name}`)
      .on('click', (_, d) => {
        this._selected_tags.add(d.id);
        this.onInputCheckChanges();
        this.renderTaglist();
      });
  }

  protected async onSave(): Promise<void> {
    // get changes
    const values = this.getValues();

    if (values.place_instance_id === null || values.religion_instance_id === null)
      return Promise.reject('Evidence must contain place instance and person instance!');

    const source_confidence = values.source_confidence;
    delete values['source_confidence'];

    const delta: any = {};
    Object.entries(values).forEach(([key, value]) => {
      if (
        (value !== this.evidence[key])
        // get `visible` field, as it would not be part of the delta
        || (this.isNew && key === 'visible')
      ) delta[key] = value;
    });

    const source_instance_delta: any = {};
    if (this._source_instance.source_confidence !== source_confidence) {
      source_instance_delta.source_confidence = source_confidence;
    }

    if (this.isNew) {
      // create evidence
      const { evidence_id } = await PUT(`../rest/evidence/0`, delta);

      values.id = evidence_id;

      // create source instance
      const si: any = { ...this._source_instance };
      Object.assign(si, source_instance_delta);
      si.evidence_id = evidence_id;

      const si_fetch = PUT(`../rest/source-instance/0`, si);

      // create tags
      const tag_fetch = await this.saveTags(evidence_id);
      await Promise.all([si_fetch, tag_fetch]);

      this.updateAnnotationMembership(evidence_id);

      this.discard();
      this.dispatchEvent(new CustomEvent('save', { detail: values }));
    } else {
      if (Object.keys(delta).length > 0) {
        await PATCH(`../rest/evidence/${values.id}`, delta);
      }

      if (Object.keys(source_instance_delta).length > 0) {
        await PATCH(`../rest/source-instance/${this._source_instance.id}`, source_instance_delta);
      }

      await this.saveTags(values.id);

      this.updateAnnotationMembership(values.id);

      this.discard();
      this.dispatchEvent(new CustomEvent('save', { detail: values }));
    }
  }

  private async saveTags(evidence_id: number): Promise<void> {
    this._selected_tags.add(this._beta_test_tag_id);
    if (this._selected_tags.size === this._taglist.length && this._taglist.every(d => this._selected_tags.has(d))) return;

    await PUT(`../rest/evidence/${evidence_id}/tags`, Array.from(this._selected_tags), false);
  }

  protected async onDelete(): Promise<void> {
    if (this.isNew) {
      this.discard();
      this.dispatchEvent(new CustomEvent('cancel'));
    } else {
      return confirm_dialog(
        `Really delete evidence?`,
        `Do you really want to delete this evidence? This cannot be reversed.`,
        {}, { classes: [ 'button--delete' ], title: `<i class="fa fa-trash fa--pad-right"></i>Delete` },
        `delete`
      ).then(async () => {
        await DELETE(`../rest/evidence/${this.evidence.id}`);

        this.discard();
        this.dispatchEvent(new CustomEvent('delete'));
      }).catch(() => {});
    }
  }

  protected async onReset(event: Event) {
    this.dispatchEvent(new CustomEvent('change'));
    event.preventDefault();
    event.stopPropagation();
    this._selected_tags = new Set<number>(this._taglist);
    await this.internalRender();
  }

  protected async onInput(_event: Event) {}

  private getValues() {
    if (!this.section) return this.evidence;

    const form = this.section.select<HTMLFormElement>('form.editor__fields').node();
    const d: any = {};
    Array.from(form.elements).forEach((e: HTMLInputElement) => {
      if (e.type === 'checkbox') d[e.name] = e.checked;
      else d[e.name] = e.value
    });

    const id = d.id === "" ? null : parseInt(d.id);
    const visible = d.visible;
    const place_instance_id = d.place_instance_id === '' ? null : parseInt(d.place_instance_id);
    const person_instance_id = d.person_instance_id === '' ? null : parseInt(d.person_instance_id);
    const religion_instance_id = d.religion_instance_id === '' ? null : parseInt(d.religion_instance_id);
    const time_group_id = d.time_group_id === '' ? null : parseInt(d.time_group_id);
    const comment = d.comment === '' ? null : d.comment;
    const interpretation_confidence = d.interpretation_confidence === '' ? null : d.interpretation_confidence;
    const source_confidence = d.source_confidence === '' ? null : d.source_confidence;

    return { id, visible, place_instance_id, person_instance_id,
      religion_instance_id, time_group_id, comment, interpretation_confidence,
      source_confidence
    };
  }

  protected async onClose(): Promise<void> {
    if (!this.hasChanges()) {
      this.dispatchEvent(new CustomEvent('cancel'));
      this.discard();
    } else {
      return confirm_dialog(
        `Discard changes?`,
        `You have unsaved changes. Closing the editor now will discard those changes. Are you sure?`,
        {}, { title: `<i class="fa fa-times-rectangle fa--pad-right"></i>Close and discard` }
      )
        .then(() => {
          this.dispatchEvent(new CustomEvent('cancel'));
          this.discard();
        })
        .catch(() => Promise.reject('cannot close'));
    }
  }

  protected discard() {
    this.section?.remove();
  }

  async cancelAndClose(): Promise<void> {
    return this.onClose();
  }

  async toggleAnnotationMembership(ann: Annotation): Promise<void> {
    const at = annotationType(ann.data);
    let fieldname: string;
    switch (at) {
      case 'place':     fieldname = 'place_instance_id'; break;
      case 'person':    fieldname = 'person_instance_id'; break;
      case 'religion':  fieldname = 'religion_instance_id'; break;
      case 'timegroup': fieldname = 'time_group_id'; break;
      default: throw new Error(`Unknown annotation type: ${at}`);
    }

    const input = this.section.select<HTMLFormElement>('form.editor__fields')
      .select<HTMLInputElement>(`input[name="${fieldname}"]`)
      .node();

    const values = this.getValues();

    if (values[fieldname] === ann.data[fieldname]) input.value = null;
    else input.value = ann.data[fieldname];

    this.onInputCheckChanges();
    this.dispatchEvent(new CustomEvent<boolean>('change', { detail: true }));
    await this.updateInstanceInfo();
  }

  getEvidence(): any {
    return this.getValues();
  }

  private updateAnnotationMembership(evidence_id: number): void {
    const annotations = this.annotator.annotations;
    const values = this.getValues();

    annotations.forEach(ann => {
      const isMember = (
        (values.time_group_id !== null && values.time_group_id === ann.data.time_group_id)
        || (values.place_instance_id !== null && values.place_instance_id === ann.data.place_instance_id)
        || (values.person_instance_id !== null && values.person_instance_id === ann.data.person_instance_id)
        || (values.religion_instance_id !== null && values.religion_instance_id === ann.data.religion_instance_id)
      );
      if (isMember) {
        if (ann.data.evidence_ids === null) ann.data.evidence_ids = [ evidence_id ];
        else if (!ann.data.evidence_ids.includes(evidence_id)) ann.data.evidence_ids.push(evidence_id);
      } else {
        if (ann.data.evidence_ids?.includes(evidence_id)) ann.data.evidence_ids = ann.data.evidence_ids.filter(d => d !== evidence_id);
      }
    });
  }
};
