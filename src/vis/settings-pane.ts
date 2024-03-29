// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';
import * as d3 from 'd3';
import { confirmation_geojson_generation, settings_pane } from './html-templates';
import { confirmation_report_generation } from './html-templates';

import * as ViewModeDefaults from './view-mode-defaults';
import * as modal from './modal';
import * as T from './datatypes';
import { clearConfig, storeConfig } from './default-layout';
import { MessageData } from './data-worker';
import { getConsentCookie } from '../common/cookies';
import { showInfoboxFromURL } from './modal';
import { localStorageKeyReportCount } from '../common/questionnaire';

interface SettingsData {
  brush_only_active: boolean;
  display_mode: 'religion' | 'confidence';
  timeline_mode: T.TimelineMode;
  map_mode: T.MapMode;
  use_falsecolors: boolean;

  evidence_count: number;
  place_count: number;
}

export default class SettingsPane {
  private confidence_mode_input: d3.Selection<HTMLInputElement, any, any, any>;
  private brush_only_active_input: d3.Selection<HTMLInputElement, any, any, any>;
  private timeline_mode_input: d3.Selection<HTMLInputElement, any, any, any>;
  private map_mode_input: d3.Selection<HTMLInputElement, any, any, any>;
  private falsecolor_mode_input: d3.Selection<HTMLInputElement, any, any, any>;

  private cachedEvidenceCount: number = 0;
  private cachedPlaceCount: number = 0;

  constructor(
    private readonly data_worker: Worker,
    private readonly container: GoldenLayout.ComponentContainer,
    private readonly layout: GoldenLayout.GoldenLayout
  ) {
    this.container?.on('modal-button-clicked' as unknown as keyof GoldenLayout.EventEmitter.EventParamsMap, () => this.openModal());

    this.init();
  }

  private init() {
    const ref = this;
    const div = this.container.element as HTMLDivElement;
    div.classList.add('settings-pane');
    div.innerHTML = settings_pane;

    const d = d3.select<HTMLDivElement, any>(div);

    this.confidence_mode_input = d.select<HTMLInputElement>('div#confidence-controls input#confidence-mode')
      .each(function() {
        this.checked = (ViewModeDefaults.display_mode === T.DisplayMode.Confidence);
      })
      .on('change', function() {
        ref.data_worker.postMessage({type: 'set-display-mode', data: this.checked ? 'Confidence' : 'Religion' });
      })

    this.brush_only_active_input = d.select<HTMLInputElement>('div#only-active-controls input#check-only-active')
      .each(function() {
        this.checked = ViewModeDefaults.show_only_active;
      })
      .on('change', function() {
        ref.data_worker.postMessage({type: 'set-show-only-active', data: this.checked });
      });

    d3.select<HTMLInputElement, any>('header input#show-all-data')
      .each(function() {
        this.checked = !ViewModeDefaults.show_only_active;
      })
      .on('change', function() {
        ref.data_worker.postMessage({type: 'set-show-only-active', data: !this.checked });
      });

    this.timeline_mode_input = d.select<HTMLInputElement>('div#timeline-mode-controls input#timeline-mode')
      .each(function() {
        this.checked = ViewModeDefaults.timeline_mode === T.TimelineMode.Qualitative;
      })
      .on('change', function() {
        ref.data_worker.postMessage({type: 'set-timeline-mode', data: this.checked ? T.TimelineMode.Qualitative : T.TimelineMode.Quantitative });
      })

    this.map_mode_input = d.select<HTMLInputElement>('div#map-mode-controls input#map-mode')
      .each(function() {
        this.checked = ViewModeDefaults.map_mode === T.MapMode.Cluttered;
      })
      .on('change', function() {
        ref.data_worker.postMessage({type: 'set-map-mode', data: this.checked ? T.MapMode.Cluttered : T.MapMode.Clustered });
      })

    this.falsecolor_mode_input = d.select<HTMLInputElement>('div#falsecolor-controls input#falsecolor')
      .each(function() {
        this.checked = (ViewModeDefaults.use_falsecolors);
      })
      .on('change', function() {
        ref.data_worker.postMessage({type: 'set-falsecolors', data: this.checked });
      })

    d.select('#save-layout')
      .on('click', () => this.onClickSaveLayout())
      .attr('disabled', (getConsentCookie() === 'essential') ? null : '');
    d.select('#reset-layout').on('click', () => this.onClickResetLayout());
    d.select('#save-state').on('click', () => this.onClickSaveVisualizationState());
    d.select('#load-state').on('click', () => this.onClickLoadVisualizationState());
    d.select('#generate-report').on('click', () => this.onClickGenerateReport());
    d.select('#describe-filters').on('click', () => this.onClickDescribeFilters());
    d.select('#download-geojson-no-details').on('click', (e) => this.onClickDownloadGeoJSON(e));
    d.select('#download-geojson-details').on('click', (e) => this.onClickDownloadGeoJSON(e, true));

    d3.select('header #header__download-state').on('click', () => this.onClickSaveVisualizationState());
    d3.select('header #header__load-state').on('click', () => this.onClickLoadVisualizationState());
    d3.select('header #header__generate-report').on('click', () => this.onClickGenerateReport());
    d3.select('header #header__describe-filters').on('click', () => this.onClickDescribeFilters());
    d3.select('header #header__download-geojson').on('click', (e) => this.onClickDownloadGeoJSON(e));

    this.data_worker.addEventListener('message', async e => {
      if (e.data?.type === 'export-visualization-state') await this.onExportEvent(e.data);
      if (e.data?.type === 'import-visualization-state') await this.onImportEvent(e.data);
      if (e.data?.type === 'generate-report') await this.onGenerateReportEvent(e.data);
      if (e.data?.type === 'set-settings-data') await this.onSettingsEvent(e.data);
      if (e.data?.type === 'describe-filters') await this.onFilterDescription(e.data);
      if (e.data?.type === 'download-geojson') this.onGeoJSONData(e.data);
    });
  }

  private openModal() {
    modal.showInfoboxFromURL('Settings Pane', 'settings-pane.html');
  }

  private onClickResetLayout() {
    clearConfig();
    window.location.reload();
  }

  private async onClickSaveLayout() {
    storeConfig(this.layout);
    await SettingsPane.showSuccess('button#save-layout', `<i class="fa fa-check fa--pad-right"></i> Layout saved`);
  }

  private async onClickSaveVisualizationState() {
    this.data_worker.postMessage({type: 'export-visualization-state', data: null});
  }

  private async onClickGenerateReport() {
    const extraSentence = (this.cachedEvidenceCount >= 100)
      ? 'This is a lot of data.' : '';

    const doCreateReport = await new Promise<boolean>(async (resolve, _reject) => {
      const descriptionPromise = Promise.resolve('');
      const { content, close } = showInfoboxFromURL(
        'Are you sure?',
        async () => descriptionPromise,
        false,
        () => resolve(false),
      );
      const sel = await content;

      sel.innerHTML = confirmation_report_generation;
      sel.querySelector(':scope #evidence-count').innerHTML = this.cachedEvidenceCount.toString();
      sel.querySelector(':scope #place-count').innerHTML = this.cachedPlaceCount.toString();
      sel.querySelector(':scope #extra-sentence').innerHTML = extraSentence;

      sel.querySelector(':scope button#nevermind-no-report')
        .addEventListener('click', () => {
          resolve(false);
        });

      sel.querySelector(':scope button#yes-report')
        .addEventListener('click', () => {
          resolve(true);
        });
    });

    if (doCreateReport) {
      if (getConsentCookie() !== null) {
        const prevReportsDone = parseInt(localStorage.getItem(localStorageKeyReportCount) ?? '0');
        localStorage.setItem(localStorageKeyReportCount, (prevReportsDone + 1).toString());
      }

      this.data_worker.postMessage({type: 'generate-report', data: null});
    }
  }

  private _resolver: (v: string) => void;
  private async onClickDescribeFilters() {
    const descriptionPromise = new Promise<string>(r => this._resolver = r);
    modal.showInfoboxFromURL('Currently Active Filters', () => descriptionPromise);

    this.data_worker.postMessage({type: 'describe-filters', data: null});
  }

  private async onFilterDescription(eventData: MessageData<any>) {
    const response = await d3.text(`../reporting/describe-filters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData.data)
    });
    this._resolver?.(response);
  }

  private async onExportEvent(eventData: MessageData<any>) {
    // update metadata source to "filesystem"
    eventData.data.metadata.source = 'filesystem';

    const blob = new Blob([JSON.stringify(eventData.data)], {type: 'application/damast-state+json'});
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.download = `damast-muslims-${d3.timeFormat('%Y%m%dT%H%M%S')(new Date())}.state.json`;
    a.style.display = 'none';
    a.href = url;

    document.body.appendChild(a);
    a.click();
    await SettingsPane.showSuccess('button#save-state', `<i class="fa fa-check fa--pad-right"></i> Saved state`);

    window.URL.revokeObjectURL(url);
    a.remove();
  }

  private async onGenerateReportEvent(eventData: MessageData<any>) {
    const file = new File([JSON.stringify(eventData.data)], 'filter_file', { type: 'application/json' });
    const container = new DataTransfer();
    container.items.add(file);

    const form = document.createElement('form');
    document.body.append(form);
    form.style.display = 'none';
    form.method = 'POST';
    form.action = '../reporting/';
    form.target = '_blank';
    form.enctype = 'multipart/form-data';

    const f = document.createElement('input');
    f.type = 'file';
    f.name = 'filter_file';
    form.appendChild(f);
    f.files = container.files;

    const b = document.createElement('button');
    b.type = 'submit';
    form.appendChild(b);

    b.click();
    document.body.removeChild(form);
    form.remove();
  }

  private async onClickDownloadGeoJSON(e: MouseEvent, details: boolean = false) {
    if (this.cachedPlaceCount >= 100) {
      const doCreateGeoJSON = await new Promise<boolean>(async (resolve, _reject) => {
        const descriptionPromise = Promise.resolve('');
        const { content, close } = showInfoboxFromURL(
          'Are you sure?',
          async () => descriptionPromise,
          false,
          () => resolve(false),
        );
        const sel = await content;

        sel.innerHTML = confirmation_geojson_generation;
        sel.querySelector(':scope #place-count').innerHTML = this.cachedPlaceCount.toString();

        sel.querySelector(':scope button#nevermind-no-geojson')
          .addEventListener('click', () => {
            resolve(false);
          });

        sel.querySelector(':scope button#yes-geojson')
          .addEventListener('click', () => {
            resolve(true);
          });
      });

      if (!doCreateGeoJSON) return;
    }

    // set buttons to waiting
    const d = d3.select<HTMLElement, any>(this.container.element as HTMLDivElement);
    const buttons = [
      d.select<HTMLButtonElement>('#download-geojson-no-details'),
      d.select<HTMLButtonElement>('#download-geojson-details'),
      d3.select('header #header__download-geojson') as d3.Selection<HTMLButtonElement, any, any, any>,
    ];

    buttons.forEach(b => {
      b.attr('disabled', '');
    });

    document.body.style.cursor = 'wait';

    this.data_worker.postMessage({type: 'download-geojson', data: details});
  }

  private onGeoJSONData(eventData: MessageData<any>) {
    const blob = new Blob([JSON.stringify(eventData.data)], {type: 'application/geo+json'});
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.download = `damast-${d3.timeFormat('%Y%m%dT%H%M%S')(new Date())}.geojson`;
    a.style.display = 'none';
    a.href = url;

    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
    a.remove();

    // set buttons to active
    const d = d3.select<HTMLElement, any>(this.container.element as HTMLDivElement);
    const buttons = [
      d.select<HTMLButtonElement>('#download-geojson-no-details'),
      d.select<HTMLButtonElement>('#download-geojson-details'),
      d3.select('header #header__download-geojson') as d3.Selection<HTMLButtonElement, any, any, any>,
    ];

    buttons.forEach(b => {
      b.attr('disabled', null);
    });
    document.body.style.cursor = null;
  }

  private async onClickLoadVisualizationState() {
    const ref = this;
    const fsel: HTMLInputElement = document.querySelector('input#load-file');
    const handle = async function() {
      const file_selector: HTMLInputElement = this;
      const file = file_selector.files[0];

      const state = JSON.parse(await file.text());
      ref.data_worker.postMessage({type: 'import-visualization-state', data: state});

      fsel.removeEventListener('change', handle);
    }
    fsel.addEventListener('change', handle);

    fsel.click();
  }

  private async onImportEvent(eventData: MessageData<{success: boolean, error_message: any}>) {
    if (eventData.data.success) {
      document.querySelectorAll('section#persist .error-message').forEach(d => d.remove());
      await SettingsPane.showSuccess('button#load-state', `<i class="fa fa-check fa--pad-right"></i> Loaded state`);
    } else {
      document.querySelectorAll('section#persist .error-message').forEach(d => d.remove());
      const section = document.querySelector('section#persist');
      const elem = document.createElement('div');
      elem.classList.add('error-message');
      elem.innerHTML = `Could not load state! Reason:
      <pre><code>${JSON.stringify(eventData.data.error_message, null, 2)}</code></pre>`;
      section.appendChild(elem);
      elem.scrollIntoView();

      await SettingsPane.showSuccess('button#load-state', `<i class="fa fa-exclamation-triangle fa--pad-right"></i> Error loading state`, '#820404');
    }
  }

  private static async showSuccess(query: string, innerHTML: string, color: string = '#3b7524') {
    const button: HTMLButtonElement = document.querySelector(query);

    button.disabled = true;
    button.style.setProperty('--clr-primary', 'white');
    button.style.setProperty('--clr-secondary', color);
    button.style.filter = 'initial';  // do not desaturate because of disabled

    const oldText = button.innerHTML;
    button.innerHTML = innerHTML;

    await new Promise<void>(r => {setTimeout(() => {
      button.disabled = false;
      button.style.setProperty('--clr-primary', null);
      button.style.setProperty('--clr-secondary', null);
      button.style.filter = null;

      button.innerHTML = oldText;
      r();
    }, 1500);});
  }

  private async onSettingsEvent(eventData: MessageData<SettingsData>) {
    const c1 = this.brush_only_active_input.on('change');
    this.brush_only_active_input.on('change', null);
    const c2 = this.confidence_mode_input.on('change');
    this.confidence_mode_input.on('change', null);
    const c3 = this.timeline_mode_input.on('change');
    this.timeline_mode_input.on('change', null);
    const c4 = this.map_mode_input.on('change');
    this.map_mode_input.on('change', null);
    const c5 = this.falsecolor_mode_input.on('change');
    this.falsecolor_mode_input.on('change', null);

    this.brush_only_active_input.node().checked = eventData.data.brush_only_active;
    this.confidence_mode_input.node().checked = (eventData.data.display_mode === 'confidence');
    this.timeline_mode_input.node().checked = (eventData.data.timeline_mode === T.TimelineMode.Qualitative);
    this.map_mode_input.node().checked = (eventData.data.map_mode === T.MapMode.Cluttered);
    this.falsecolor_mode_input.node().checked = (eventData.data.use_falsecolors);

    d3.select<HTMLInputElement, any>('header input#show-all-data')
      .each(function() {
        this.checked = !eventData.data.brush_only_active;
      });

    this.brush_only_active_input.on('change', c1);
    this.confidence_mode_input.on('change', c2);
    this.timeline_mode_input.on('change', c3);
    this.map_mode_input.on('change', c4);
    this.falsecolor_mode_input.on('change', c5);

    this.cachedEvidenceCount = eventData.data.evidence_count;
    this.cachedPlaceCount = eventData.data.place_count;
  }
};
