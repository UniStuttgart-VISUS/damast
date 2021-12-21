import { select, Selection } from 'd3-selection';
import { Annotation, Annotator } from 'dom-tree-annotator';
import DatabaseAnnotation from './database-annotation';
import AnnotationHelper from './annotator-helper';
import stringsEqual from './empty-string-compare';
import Cache from '../common/cache';
import addTitles from './form-add-titles';
import { confirm_dialog } from '../common/dialog';

export default abstract class AnnotationEditor {
  readonly finalization: Promise<DatabaseAnnotation>;
  protected _resolve: (a: DatabaseAnnotation) => void;
  protected _reject: (a: string) => void;
  protected section: Selection<HTMLElement, any, any, any>;

  protected readonly databaseAnnotation: DatabaseAnnotation;
  protected instanceData: any = null;
  protected annotationSpan: [number, number];

  constructor(
    protected annotator: Annotator,
    protected annotation: Annotation,
    protected readonly cache: Cache,
    protected readonly document_id: number,
    protected isNew: boolean,
    protected helper: AnnotationHelper,
    protected entity_id: number | null = null,
    protected suggestion_source: string[] | null = null,
  ) {
    this.finalization = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    this.databaseAnnotation = annotation.data;
    this.annotationSpan = this.databaseAnnotation.span;

    // get instance data, check if cache ready
    Promise.all([this.loadInstance(), this.loadCacheData()])
      .then(() => this.internalRender())
      .then(() => this.initializeValues())
      .then(() => this.onInputCheckChanges());
  }

  protected abstract get annotationType(): string;
  protected abstract loadCacheData(): Promise<void>;
  protected abstract loadInstance(): Promise<void>;
  protected abstract hasChangedFields(): boolean;
  protected initializeValues() {

  }

  protected hasChanges(): boolean {
    const comment_node: HTMLInputElement | null = this.section.select<HTMLInputElement>('input#annotation-comment').node();
    if (comment_node === null) {
      console.error('comment node null');
      console.log(comment_node, this, this.section);
      return false;
    }

    return !stringsEqual(comment_node.value, this.databaseAnnotation.comment)
      || this.hasChangedFields();
  }

  protected onInputCheckChanges() {
    const has_changes = this.hasChanges();
    const can_save = (has_changes || this.isNew) && this.section.select<HTMLFormElement>('form.editor__fields').node().checkValidity();

    this.section.select('button.button--save').attr('disabled', can_save ? null : '');

    // only allow deletion on new instances or instances without evidences
    this.section.select('button.button--delete').attr('disabled',
      (this.databaseAnnotation.evidence_ids?.length && !this.isNew) ? '' : null);
  }

  protected internalRender(): void {
    const sidebar = select<HTMLElement, any>('.sidebar');
    sidebar.selectAll('*').remove();

    const section = sidebar.append('div')
      .classed('editor', true)
      .classed('editor--annotation', true);
    this.section = section;

    section.append('h1')
      .text(this.isNew ? `Create ${this.annotationType} Annotation` : `Edit ${this.annotationType} Annotation`);

    if (this.isNew && this.suggestion_source !== null) {
      const reasons = this.suggestion_source.map(s => {
        if (s === 'name') return 'known name from database';
        if (s === 'annotation') return 'existing annotation';
        return s;
      });

      section.append('span')
        .classed('subtitle', true)
        .text(`Suggestion based on ${reasons.join(', ')}.`);
    }

    const edit_section = section.append('form')
      .classed('editor__fields', true);

    edit_section.append('label')
      .attr('for', 'annotation-comment')
      .text('Annotation comment:');
    edit_section.append('input')
      .attr('type', 'text')
      .attr('name', 'annotation-comment')
      .attr('id', 'annotation-comment')
      .attr('value', this.databaseAnnotation.comment);

    if (!this.isNew) {
      let inner_text = '';
      this.annotation.ranges.forEach(r => r.elements.forEach(e => inner_text += e.innerText));
      if (inner_text.length > 1000) {
        inner_text = `${inner_text.slice(0, 900)}<span class="ellipsis"></span>${inner_text.slice(inner_text.length - 100)}`;
      }

      edit_section.append('label')
        .attr('for', 'annotation-span')
        .text('Annotation extent:');
      edit_section.append('input')
        .attr('type', 'hidden')
        .attr('name', 'annotation-span')
        .attr('id', 'annotation-span')
        .attr('value', JSON.stringify(this.annotationSpan));
      const spanEditor = edit_section.append('div')
        .classed('annotation-span-editor', true);
      spanEditor.append('span')
        .classed('text-range', true)
        .html(`${this.annotationSpan[0]}&ndash;${this.annotationSpan[1]}`);
      spanEditor.append('button')
        .attr('type', 'button')
        .classed('button', true)
        .html('<i class="fa fa-fw fa--pad-right fa-i-cursor"></i>Reselect annotation')
        .on('click', () => this.startEditAnnotationExtent());
      spanEditor.append('span')
        .classed('text-content', true)
        .html(inner_text);
    }

    this.render(edit_section);

    const closeButton = section.append('button')
      .classed('button', true)
      .classed('button--close', true)
      .attr('title', 'Close editor')
      .html('<i class="fa fa-times"></i>')
      .attr('title', 'Close editor')
      .on('click', async () => await this.onClose());

    const reset = edit_section.append('input')
      .attr('type', 'reset')
      .classed('button', true)
      .classed('button--reset', true)
      .classed('button--medium', true)
      .classed('button--accent', true)
      .attr('title', 'Reset all values to state from database.')
      .attr('value', 'Reset');

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
      .attr('title', this.isNew ? 'Cancel the creation of a new instance and annotation' : 'Delete this annotation and instance');

    const save = buttons.append('button')
      .classed('button', true)
      .classed('button--save', true)
      .classed('button--medium', true)
      .classed('button--green', true)
      .html(this.isNew ? `<i class="fa fa--pad-right fa-fw fa-upload" ></i>Create` : `<i class="fa fa--pad-right fa-fw fa-save" ></i>Save`)
      .on('click', async () => await this.onSave())
      .attr('title', this.isNew ? 'Create the new instance and annotation' : 'Save changes to this annotation and instance');

    addTitles(edit_section, [
      ['annotation-comment', 'Annotation comment. This is intended for commentary on the placement etc. of the annotation.'],
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
  }

  protected abstract render(dom_area: d3.Selection<HTMLElement, any, any, any>): void;

  protected abstract onSave(): Promise<void>;

  protected abstract onDelete(): Promise<void>;

  protected async onReset(_event) {
    this.annotationSpan = this.databaseAnnotation.span;
    this.annotation = this.annotator.updateAnnotationSpan(this.annotation, ...this.annotationSpan);
    this.internalRender();
    if (this.isEditingAnnotationSpan) this.stopEditingAnnotationSpan();
  }
  protected async onInput(_event) {}

  protected async onClose(): Promise<void> {
    if (this._reject === null) return;
    if (!this.hasChanges()) {
      this._reject('closed editor');
      this._reject = null;
      this.discard();
    } else {
      return confirm_dialog(
        `Discard changes?`,
        `You have unsaved changes. Closing the editor now will discard those changes. Are you sure?`,
        {}, { title: `<i class="fa fa-times-rectangle fa--pad-right"></i>Close and discard` }
      )
        .then(() => {
          this._reject('closed editor');
          this._reject = null;
          if (this.isEditingAnnotationSpan) this.stopEditingAnnotationSpan();
          this.discard();
        })
        .catch(() => Promise.reject('cannot close'));
    }
  }

  protected discard() {
    this.section?.remove();
  }

  async cancelAndClose(): Promise<void> {
    if (this._reject === null) return;
    if (this.isEditingAnnotationSpan) this.stopEditingAnnotationSpan();
    return this.onClose();
  }

  private isEditingAnnotationSpan: boolean = false;
  private _do_editor_reset: () => void = () => {};
  private async startEditAnnotationExtent() {
    this.isEditingAnnotationSpan = true;
    const button = select<HTMLButtonElement, any>('.editor__fields .annotation-span-editor button');
    const oldtext = button.html();
    const oldhook = this.annotator.getAnnotationCreationHook();

    this._do_editor_reset = () => {
      this.isEditingAnnotationSpan = false;
      button.html(oldtext)
        .classed('button--red', false)
        .on('click', this.startEditAnnotationExtent.bind(this));
      this.annotator.setAnnotationCreationHook(oldhook);
    }

    button.classed('button--red', true)
      .html(`<i class="fa fa-fw fa--pad-right fa-close"></i> Cancel`)
      .on('click', () => {
        this.stopEditingAnnotationSpan();
      });

    this.annotator.setAnnotationCreationHook(async (ctx, resolve, reject) => {
      this.annotationSpan = [ ctx.start, ctx.end ];
      this.annotation = this.annotator.updateAnnotationSpan(this.annotation, ctx.start, ctx.end);
      this.internalRender();
      this.stopEditingAnnotationSpan();
      reject();
    });
  }

  private stopEditingAnnotationSpan() {
    this._do_editor_reset && this._do_editor_reset();
  }
};

