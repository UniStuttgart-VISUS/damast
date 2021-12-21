import { select, selectAll } from 'd3-selection';
import { transition } from 'd3-transition';
import { scaleLinear } from 'd3-scale';
import { Annotator, Annotation } from 'dom-tree-annotator';

import { GET, DELETE } from './rest';
import * as Constants from './constants';
import createLinks from './create-links';
import AnnotationEditor from './annotation-editor';
import PersonAnnotationEditor from './person-annotation-editor';
import PlaceAnnotationEditor from './place-annotation-editor';
import ReligionAnnotationEditor from './religion-annotation-editor';
import TimegroupAnnotationEditor from './timegroup-annotation-editor';
import createPopup from './popup-menu';
import Cache from '../common/cache';
import annotationType from './annotation-type';
import EvidenceEditor from './evidence-editor';
import { accept_dialog } from '../common/dialog';
import removeHash from '../common/remove-hash-from-uri';
import Scrollbar from './annotation-area-scrollbar';
import isAnnotationSuggestion from './is-annotation-suggestion';
import DatabaseAnnotation from './database-annotation';

interface Editor {
  cancelAndClose(): Promise<void>;
};

export default class AnnotationHelper {
  private annotator: Annotator;
  private resizeObserver: ResizeObserver;
  private readonly documentElement: HTMLElement;
  private readonly linksSvg: SVGSVGElement;
  private scrollbar: Scrollbar;

  private evidence: any[] = [];
  private evidenceEditor: EvidenceEditor | null = null;
  private document_metadata: any = null;

  private readonly cache: Cache;
  private editor?: Editor;

  constructor(
    readonly scrollParent: HTMLElement,
    readonly document_id: number,
  ) {
    this.cache = new Cache(['places', 'confidence', 'persons', 'religions', 'sources', 'tags']);

    this.scrollParent.innerHTML = `<div class="document"></div><svg class="links"></svg>`;

    this.documentElement = this.scrollParent.querySelector(':scope div');
    this.linksSvg = this.scrollParent.querySelector(':scope svg');
    this.resizeObserver = new ResizeObserver(this.onResize.bind(this));
    this.resizeObserver.observe(this.scrollParent);

    this.scrollParent.parentElement.addEventListener('scroll', () => this.drawSvg());

    select<HTMLButtonElement, any>('main .annotation-area button.button-add-evidence')
      .on('click', async () => await this.onClickNewEvidence());
  }

  async initialLoad() {
    const load_document = await fetch(`../rest/document/${this.document_id}`);
    if (!load_document.ok) throw new Error(`${load_document.status} ${load_document.statusText}`);
    const document = await load_document.text();

    const load_document_metadata = GET(`../rest/document/${this.document_id}/metadata`);
    const load_evidence = GET(`../rest/document/${this.document_id}/evidence-list`);
    const load_annotations = GET(`../rest/document/${this.document_id}/annotation-list`);
    const load_annotation_suggestions = GET(`../rest/document/${this.document_id}/annotation-suggestion-list`);

    const [
      document_metadata,
      evidence,
      annotations,
      annotation_suggestions,
      _
    ]: [any, any, any, any, void] = await Promise.all([
      load_document_metadata, load_evidence, load_annotations, load_annotation_suggestions, this.cache.ready
    ]);

    this.document_metadata = document_metadata;
    this.documentElement.innerHTML = document;

    const ann = annotations.map((d: any) => {
      const classList: string[] = [`annotation--${annotationType(d)}`];

      return new Annotation(d.span[0], d.span[1], d, classList);
    });

    const annSug = annotation_suggestions.map((d: any) => {
      const classList: string[] = [`annotation-suggestion`];

      return new Annotation(d.span[0], d.span[1], d, classList, true);  // use class in overlaps as well
    });

    this.evidence = evidence;

    this.annotator = new Annotator(this.documentElement, this.annotationCreationHook.bind(this));
    this.annotator.annotations = [...ann, ...annSug];

    this.scrollbar = new Scrollbar(
      this.scrollParent.parentElement,
      this.documentElement,
      window.document.querySelector('canvas.minimap'),
      this,
      this.annotator
    );

    this.annotator.addEventListener('click', this.onClickAnnotationSpan.bind(this));
    this.annotator.addEventListener('change', async () => {
      this.drawSvg();
      await this.updateDocumentInfo();
    });
    select<HTMLButtonElement, any>('main .annotation-area button.button-add-evidence')
      .attr('disabled', null);

    await this.updateDocumentInfo()

    // if document linked, open in editor
    const evidence_id = parseInt(window.location.hash.slice(1));
    const evidence_ = this.evidence.find(d => d.id === evidence_id);
    let promise = Promise.resolve();
    if (evidence_ !== undefined) {
      // find first annotation span in evidence and scroll to it
      const spans_in_evidence = this.annotator.annotations.filter(d =>
           d.data.religion_instance_id === evidence_.religion_instance_id
        || d.data.person_instance_id === evidence_.person_instance_id
        || d.data.place_instance_id === evidence_.place_instance_id
        || d.data.time_group_id === evidence_.time_group_id);
      const elems = [];
      spans_in_evidence.forEach(e => e.ranges.forEach(r => elems.push(...r.elements)));
      elems.sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
      if (elems.length > 0) elems[0].scrollIntoView();

      promise = this.onClickEvidenceLink({ evidence: evidence_ });
    }

    removeHash();
    await promise;
  }

  private async annotationCreationHook(ctx: any, resolve: (d: any) => void, reject: (d: string) => void) {
    if (this.evidenceEditor !== null) {
      // currently constructing or editing evidence, do not create an evidence
      reject('Evidence editor open');
      return;
    }

    try {
      const width = 600;
      const clientHeight = window.innerHeight;
      const clientWidth = window.innerWidth;
      const { clientX, clientY } = window.event as MouseEvent || { clientX: 700, clientY: 500 };
      const x = Math.min(clientWidth - width/2, Math.max(width/2, clientX));
      const above = clientY > clientHeight/2;
      const y = above ? clientY - 15 : clientY + 15;
      const [ editor_type, class_ ] = await createPopup<[new (annotator: Annotator, annotation: Annotation, cache: Cache, document_id: number, isNew: boolean, helper: AnnotationHelper) => AnnotationEditor, string]>({x, y}, width, above,
        `<i class="fa fa--pad-right fa-question"></i>Select Annotation Type`,
        [
          {
            key: [ PlaceAnnotationEditor, 'annotation--place' ],
            description: `<i class="fa fa-lg fa-fw fa--pad-right fa-home"></i>Place`
          },
          {
            key: [ PersonAnnotationEditor, 'annotation--person' ],
            description: `<i class="fa fa-lg fa-fw fa--pad-right fa-user"></i>Person`
          },
          {
            key: [ ReligionAnnotationEditor, 'annotation--religion' ],
            description: `<i class="fa fa-lg fa-fw fa--pad-right fa-venus fa-flip-vertical"></i>Religion`
          },
          {
            key: [ TimegroupAnnotationEditor, 'annotation--timegroup' ],
            description: `<i class="fa fa-lg fa-fw fa--pad-right fa-calendar"></i>Time group`
          },
        ],
        `<p>
      You are about to create an annotation for the following text:
    </p>

    <blockquote>${ctx.content}</blockquote>

    <p>
      Please select which type of annotation this is.
    </p>`);


      const annotation = new Annotation(ctx.start, ctx.end, {
        id: null, place_instance_id: null, document_id: this.document_id, evidence_ids: null, comment: null, person_instance_id: null, religion_instance_id: null, time_group_id: null, span: [ctx.start, ctx.end]
      }, []);

      await this.editor?.cancelAndClose();
      const creator = new editor_type(this.annotator, annotation, this.cache, this.document_id, true, this);
      this.editor = creator;

      const data = await creator.finalization;

      resolve({data, classList: [ class_ ] });
    } catch (err) {
      reject(err);
    } finally {
      this.editor = null;
      this.scrollbar.draw();
    }
  }

  private async onClickAnnotationSpan(evt: CustomEvent<Annotation[]>): Promise<void> {
    // check if more than one annotation
    let annotation: Annotation;

    if (evt.detail.length === 1) annotation = evt.detail[0];
    else {
      try {
        const { top, bottom, left, right } = evt.detail[0].ranges[0].elements[0].getBoundingClientRect();
        const width = 600;
        const _x = (left + right) / 2;
        const clientHeight = window.innerHeight;
        const clientWidth = window.innerWidth;
        const x = Math.min(clientWidth - width/2, Math.max(width/2, _x));
        const above = top > clientHeight/2;
        const y = above ? top - 15 : bottom + 15;

        annotation = await createPopup({x, y}, width, above,
          `<i class="fa fa--pad-right fa-question"></i>Select Annotation`,
          evt.detail.map(d => {
            const content = d.ranges.map(e => e.elements.map(f => f.innerText).join('')).join('');

            if (isAnnotationSuggestion(d)) {
              const description = `Annotation suggestion (${d.data.type}): <i class="accent">${content}</i>`;
              return { key: d, description };
            } else {
              const annotation_type = annotationType(d.data);
              const description = `Annotation ${d.data.id} (${annotation_type}): <i class="accent">${content}</i>`;
              return { key: d, description };
            }
          }),
          `<p>
      There are multiple overlapping annotations where you clicked.
      Please select which one you want to open.
      </p>`);
      } catch (_err) {
        console.log('Cancelled annotation selection');
        return;
      }
    }

    const isSuggestion = isAnnotationSuggestion(annotation);
    const suggestionId = isSuggestion ? annotation.data.id : null;

    if (this.evidenceEditor !== null && !isSuggestion) {
      await this.evidenceEditor.toggleAnnotationMembership(annotation);
      return;
    }

    // switch by editor
    const tp = isSuggestion
      ? annotation.data.type
      : annotationType(annotation.data);
    if (tp === 'unknown') return accept_dialog(`Unhandled annotation type`,
            `<p>The annotation is not connected to any place instance, religion instance, person instance, or time group. Probably, this was due to a transmission error during creation. The annotation cannot be edited and should be deleted manually from the database.</p>`, {});
    const editor_type = (() => {
      switch (tp) {
        case 'place':
          return PlaceAnnotationEditor;
        case 'person':
          return PersonAnnotationEditor;
        case 'religion':
          return ReligionAnnotationEditor;
        case 'timegroup':
          return TimegroupAnnotationEditor;
        default:
          throw new Error(`Unknown annotation type '${tp}' for annotation with data: ${JSON.stringify(annotation.data)}`);
      }})();

    try {
      const entity_id = isSuggestion ? annotation.data.entity_id : null;
      const suggestion_source = isSuggestion ? annotation.data.source : null;

      await this.editor?.cancelAndClose();
      const editor = new editor_type(evt.target as Annotator, annotation, this.cache, this.document_id, isSuggestion, this, entity_id, suggestion_source);
      this.editor = editor;
      this.markAnnotationAsEditing(annotation);

      const data = await editor.finalization.catch(_err => {}) as (DatabaseAnnotation & { type: string });

      if (isSuggestion) {
        const annData = {
          comment: data.comment || null,
          document_id: data.document_id,
          evidence_ids: [],
          id: data.id,
          person_instance_id: data.person_instance_id || null,
          place_instance_id: data.place_instance_id || null,
          religion_instance_id: data.religion_instance_id || null,
          time_group_id: data.time_group_id || null,
          span: data.span
        };

        const a = new Annotation(data.span[0], data.span[1], annData, [`annotation--${data.type}`]);
        const idx = this.annotator.annotations.indexOf(annotation);
        this.annotator.annotations[idx] = a;

        await DELETE(`../rest/annotation-suggestion/${suggestionId}`);
      }
    } catch (err) {
      this.markAnnotationAsEditing();
      console.log('Cancelled creation/edit');
    } finally {
      this.markAnnotationAsEditing();
      const a = this.annotator.annotations;
      this.annotator.annotations = a;
      this.editor = null;
      this.scrollbar.draw();
    }
  }

  private markAnnotationAsEditing(ann?: Annotation) {
    // if ann is undefined, remove class from all spans

    const spans: Set<HTMLElement> = new Set<HTMLElement>();
    ann?.ranges.forEach(range => range.elements.forEach(elem => spans.add(elem)));

    const sel = select<HTMLElement, any>(this.documentElement)
      .selectAll<HTMLElement, any>('.annotation');
    if (ann) sel.classed('annotation--creation', function() { return spans.has(this); });
    else sel.classed('annotation--creation', false);
  }

  private onResize([entry]: [ResizeObserverEntry]) {
    const { width, height } = entry.contentRect;

    this.linksSvg.setAttribute('width', width.toString());
    this.linksSvg.setAttribute('height', height.toString());

    this.drawSvg();
  }

  private drawSvg() {
    if (this.annotator === undefined) return;

    const svg = select<SVGSVGElement, any>(this.linksSvg);
    const instance_keys = ['person_instance_id', 'place_instance_id', 'religion_instance_id', 'time_group_id'];
    const annotations = this.annotator.annotations;

    const evidences = [...this.evidence];
    let special_annotations = [];
    let special_index = -1;
    if (this.evidenceEditor !== null) {
      const e = this.evidenceEditor.getEvidence();
      e.live = true;
      evidences.unshift(e);
      special_index = 0;

      // also class instances
      special_annotations = this.annotator.annotations.filter(d => {
        return (d.data.place_instance_id !== null && d.data.place_instance_id === e.place_instance_id)
          || (d.data.person_instance_id !== null && d.data.person_instance_id === e.person_instance_id)
          || (d.data.religion_instance_id !== null && d.data.religion_instance_id === e.religion_instance_id)
          || (d.data.time_group_id !== null && d.data.time_group_id === e.time_group_id);
      });
    }

    const special_spans = [];
    special_annotations.forEach(d => d.ranges.forEach(r => r.elements.forEach(e => special_spans.push(e))));
    selectAll('.annotation')
      .classed('annotation--creation', function() { return special_spans.includes(this); });

    const data = evidences.map(evidence => {
      const nodes: HTMLElement[] = [];
      instance_keys.forEach(i => {
        if (evidence[i] === null) return;
        const instance = annotations.find(d => d.data[i] === evidence[i]);
        if (!instance) console.error(evidence);
        nodes.push(instance.ranges[0].elements[0]);  // first <span>
      });

      const points: [number, number][] = nodes.map((d: HTMLElement) => {
        const height = d.getClientRects()[0].height;

        const x = d.offsetLeft;
        const y = d.offsetTop + height;

        return [x,y];
      });

      return { evidence, points };
    });

    const scrollTop = this.linksSvg.parentElement.parentElement.scrollTop;
    const scrollBottom = this.linksSvg.parentElement.parentElement.clientHeight + scrollTop;
    const swimlane_padding = 5;
    const links = createLinks(data, scrollTop, scrollBottom, swimlane_padding, Constants.swimlane_width - swimlane_padding, -1, special_index);

    const sel = svg.selectAll<SVGGElement, {evidence: any, points: [number, number][], path: string}>('g')
      .data(links, d => d.evidence.id);
    const t = transition('svg-link-animation');

    sel.enter()
      .append('g')
      .classed('annotation-link', true)
      .each(function(d) {
        select(this)
          .append('path')
          .attr('d', d.path);
        select(this)
          .append('circle')
          .classed('annotation-link__handle', true)
          .attr('r', 4)
          .attr('cx', d.label_anchor.x)
          .attr('cy', d.label_anchor.y);
        select(this)
          .append('title')
          .text(`Evidence ${d.evidence.id}`);
      })
      .on('click', async (_, d) => await this.onClickEvidenceLink(d))
      .merge(sel)
      .classed('annotation-link--creation', d => !!d.evidence.live)
      .each(function(d) {
        select(this)
          .select('path')
          .transition(t)
          .attr('d', d.path);
        select(this)
          .select('circle')
          .transition(t)
          .attr('cx', d.label_anchor.x)
          .attr('cy', d.label_anchor.y);
        select(this)
          .select('title')
          .text(`Evidence ${d.evidence.id}`);
      });
    sel.exit().remove();
  }

  unload() {
    this.resizeObserver?.disconnect();
    this.scrollbar.unload();
  }

  private async updateDocumentInfo() {
    const num_annotations = this.annotator.annotations.filter(d => !isAnnotationSuggestion(d)).length;
    const num_evidences = this.evidence.length;

    const { id, source_id, document_version } = this.document_metadata;
    const { short } = (await this.cache.sources).find(d => d.id === source_id);

    const text = `${short} (${source_id}; v${document_version} (${id})): ${num_annotations} annotations, ${num_evidences} evidences.`;
    select('main section.annotation-area .document-info').html(text);
  }

  private async onClickEvidenceLink(ev): Promise<void> {
    const button = select<HTMLButtonElement, any>('main .annotation-area button.button-add-evidence');
    button.attr('disabled', '');

    const { evidence } = ev;
    const evidence_clone = JSON.parse(JSON.stringify(evidence));

    await this.evidenceEditor?.cancelAndClose();
    await this.editor?.cancelAndClose();
    this.editor = null;

    // take out evidence from evidences
    this.evidence = this.evidence.filter(d => d !== evidence);
    this.evidenceEditor = new EvidenceEditor(this.annotator, evidence, this.cache, this.document_metadata.id, this.document_metadata.source_id, false);

    this.evidenceEditor.addEventListener('change', () => this.drawSvg());
    this.evidenceEditor.addEventListener('cancel', async () => {
      this.evidence.push(evidence_clone);
      button.attr('disabled', null);
      this.evidenceEditor = null;
      this.drawSvg();
      await this.updateDocumentInfo();
    });
    this.evidenceEditor.addEventListener('save', async (event: CustomEvent) => {
      const evidence = event.detail;
      this.evidence.push(evidence);

      button.attr('disabled', null);
      this.evidenceEditor = null;
      this.drawSvg();
      await this.updateDocumentInfo();
    });
    this.evidenceEditor.addEventListener('delete', async () => {
      button.attr('disabled', null);
      this.evidenceEditor = null;
      this.drawSvg();
      await this.updateDocumentInfo();
    });
  }

  private async onClickNewEvidence(): Promise<void> {
    await this.editor?.cancelAndClose();
    this.editor = null;

    const dummy_evidence = {
      id: null,
      place_instance_id: null,
      person_instance_id: null,
      time_group_id: null,
      religion_instance_id: null,
      visible: true,
      comment: null,
    };

    const button = select<HTMLButtonElement, any>('main .annotation-area button.button-add-evidence');
    button.attr('disabled', '');

    this.evidenceEditor = new EvidenceEditor(this.annotator, dummy_evidence, this.cache, this.document_metadata.id, this.document_metadata.source_id, true);

    this.evidenceEditor.addEventListener('change', (evt: CustomEvent<boolean | undefined>) => {
      // change event can also mean evidence metadata changed. in that case, redrawing is not necessary
      if (evt.detail) this.drawSvg();
    });
    this.evidenceEditor.addEventListener('cancel', async () => {
      button.attr('disabled', null);
      this.evidenceEditor = null;
      this.drawSvg();
      await this.updateDocumentInfo();
    });
    this.evidenceEditor.addEventListener('save', async (event: CustomEvent) => {
      this.evidence.push(event.detail);

      button.attr('disabled', null);
      this.evidenceEditor = null;
      this.drawSvg();
      await this.updateDocumentInfo();
    });
  }
};
