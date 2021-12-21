import * as T from './datatypes';
import * as d3 from 'd3';
import * as modal from './modal';
import TooltipManager from './tooltip';
import View from './view';
import { saveCurrentFilter, loadFilter } from './manage-place-sets';
import locationNamePrefix from '../common/ignore-name-prefixes';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

const tooltip_delay = 1000;

export default class LocationList extends View<any, any> {
  private div: d3.Selection<HTMLDivElement, any, any, any>;
  private unplaced_div: d3.Selection<HTMLDetailsElement, any, any, any>;
  private placed_div: d3.Selection<HTMLDetailsElement, any, any, any>;
  private unplaced_content: d3.Selection<HTMLDivElement, any, any, any>;
  private placed_content: d3.Selection<HTMLDivElement, any, any, any>;
  private search_bar: d3.Selection<HTMLInputElement, any, any, any>;
  private clear_button: d3.Selection<HTMLButtonElement, any, any, any>;

  private filterPlaces: Array<{ id: number, name: string }>;
  private filter: Set<number>;
  private cachedFilter: number[] | null = null;
  private allLocationIds: number[] = [];
  private shownLocationIds: number[] = [];
  private user: T.User;
  private confidenceColorscale: T.TransferableColorscheme = null;
  private locationConfidenceFilter: Set<T.Confidence> = new Set<T.Confidence>();

  private tooltip: TooltipManager = new TooltipManager();

  constructor(worker: Worker, container: GoldenLayout.Container) {
    super(worker, container, 'location-list');

    const div = container.getElement()[0];

    div.classList.add('location-list-container');
    div.innerHTML = require('html-loader!./html/location-list.template.html').default;
    this.div = d3.select(div);

    const search_div = this.div.select('div.location-list__search-bar');
    this.search_bar = search_div.select<HTMLInputElement>('input.search-bar__input')
      .each(function() { this.value = ''; });  // clear at start
    this.clear_button = search_div.select<HTMLButtonElement>('button.search-bar__clear-button')
      .on('click', () => {
        this.search_bar.node().value = '';
        this.onSearchTextChange();
      });

    this.search_bar.on('input', this.onSearchTextChange.bind(this));

    const scroll_div = this.div.select<HTMLDivElement>('div.location-list__scrollarea');

    this.unplaced_div = scroll_div.select('details.container__location-list__unplaced');
    this.unplaced_content = this.unplaced_div.select('div.location-list__content');
    this.placed_div = scroll_div.select('details.container__location-list__placed');
    this.placed_content = this.placed_div.select('div.location-list__content');

    this.div.selectAll('.location-list-swap-button')
      .on('click', _ => this.div.selectAll('.location-list').sort(_ => 1));

    this.div.select('#place-filter-revert')
      .on('click', () => {
        this.filter = this.cachedFilter === null
          ? new Set<number>(this.allLocationIds)
          : new Set<number>(this.cachedFilter);
        this.renderFilter();
      });
    this.div.select('#place-filter-none')
      .on('click', () => {
        this.filter = new Set<number>();
        this.renderFilter();
      });
    this.div.select('#place-filter-all')
      .on('click', () => {
        this.filter = new Set<number>(this.allLocationIds);
        this.renderFilter();
      });
    this.div.select('#place-filter-invert')
      .on('click', () => {
        const filt = this.allLocationIds.filter(d => !this.filter.has(d));
        this.filter = new Set<number>(filt);
        this.renderFilter();
      });

    this.div.select('#extend-place-set')
      .on('click', () => {
        this.shownLocationIds.forEach(d => this.filter.add(d));
        this.renderFilter();
      });
    this.div.select('#restrict-place-set')
      .on('click', () => {
        const ids = this.shownLocationIds.filter(d => this.filter.has(d));
        this.filter = new Set<number>(ids);
        this.renderFilter();
      });
    this.div.select('#remove-from-place-set')
      .on('click', () => {
        this.shownLocationIds.forEach(d => this.filter.delete(d));
        this.renderFilter();
      });

    this.div.select('#save-place-set')
      .on('click', async () => {
        saveCurrentFilter(this.filter, this.user)
          .then(() => {})
          .catch((e) => console.error(e));
      });
    this.div.select('#load-place-set')
      .on('click', async () => {
        loadFilter(this.user)
          .then(f => {
            this.filter = new Set<number>(f);
            this.renderFilter();
          })
          .catch((e) => console.error(e));
      });
  }

  async setData(data: any) {
    const ref = this;
    const { placed, unplaced, allPlaces } = data;
    const { filter, filterPlaces } = data;
    const { fromDataset, user } = data;
    const { confidenceColorscale, locationConfidenceFilter } = data;
    this.shownLocationIds = [...placed, ...unplaced].map(d => d.id);
    this.user = user;
    this.allLocationIds = allPlaces.map(d => d.id);
    if (fromDataset) {
      if (filter === null) this.filter = new Set<number>(this.allLocationIds);
      else this.filter = new Set<number>(filter);
    }
    this.cachedFilter = filter;
    this.filterPlaces = filterPlaces;
    this.confidenceColorscale = confidenceColorscale;
    this.locationConfidenceFilter = new Set<T.Confidence>(locationConfidenceFilter);

    this.unplaced_div.select('.location-list__title')
      .html(`Unplaced <em>(${unplaced.length})</em>`);

    this.placed_div.select('.location-list__title')
      .html(`Placed <em>(${placed.length})</em>`);

    this.renderFilter();

    const make_children = function(d) {
      const urlData = encodeURIComponent(btoa(JSON.stringify({ place_id: d.id })));
      d3.select(this)
        .append('span')
        .classed('name', true);
      d3.select(this)
        .append('span')
        .classed('filler', true);
      d3.select(this)
        .append('span')
        .classed('confidence-color', true);
      d3.select(this)
        .append('a')
        .attr('href', `../GeoDB-Editor/places#${urlData}`)
        .attr('target', '_blank')
        .html('<i class="fa fa-fw fa-lg fa-external-link"></i>');
    };

    const update_name = function(d: {category: string, name: string, id: number, location_confidence: T.Confidence}) {
      const urlData = encodeURIComponent(btoa(JSON.stringify({ place_id: d.id })));
      const p = d3.select(this);
      p.classed('location-list__location-name--brushed', d.category === 'brushed')
        .classed('location-list__location-name--searched', d.category === 'searched')
        .classed('location-list__location-name--searched-alternative', d.category === 'alternative')
        .classed('location-list__location-name--deselected', !ref.locationConfidenceFilter.has(d.location_confidence));

      const m = locationNamePrefix.exec(d.name);
      const [ prefix, name ] = m
        ? [ m[0], d.name.slice(m[0].length) ]
        : [ '', d.name ];
      p.select('span.name')
        .html(`<span class="prefix">${prefix}</span>${name}`);
      p.select('span.confidence-color')
        .style('--confidence-color', ref.confidenceColorscale[`${d.location_confidence}`]);
      p.select('a')
        .attr('href', `../GeoDB-Editor/places#${urlData}`);
    };

    let s = this.unplaced_content.selectAll('.location-list__location-name')
      .data(unplaced) as d3.Selection<HTMLParagraphElement, any, any, any>;
    s.enter()
      .append('p')
      .classed('location-list__location-name', true)
      .each(make_children)
      .merge(s)
      .each(update_name);
    s.exit().remove();

    s = this.placed_content.selectAll('.location-list__location-name')
      .data(placed) as d3.Selection<HTMLParagraphElement, any, any, any>;
    s.enter()
      .append('p')
      .classed('location-list__location-name', true)
      .each(make_children)
      .merge(s)
      .each(update_name);
    s.exit().remove();

    (this.div.selectAll('.location-list__location-name') as d3.Selection<HTMLParagraphElement, any, any, any>)
      .on('mouseenter', function(_, d) {
        ref.start_tooltip_timer(d, this);
      })
      .on('mouseleave wheel', (_, d) => {
        this.stop_tooltip();
      })
      .on('click', function(_, d) {
        const sel = d3.select(this);
        ref.on_brush(sel, d);
      });

    // check if there are brushed
    const first_brushed = this.div.select<HTMLParagraphElement>('.location-list__location-name--brushed').node();
    if (first_brushed) {
      const scrolltop = Math.max(0, first_brushed.offsetTop - 50);  // 50px padding
      this.div
        .select<HTMLDivElement>('div.location-list__scrollarea')
        .node()
        .scrollTop = scrolltop;
    }
  }

  async linkData(data: any) {
    throw data;
  }

  private renderFilter() {
    const ref = this;
    const filter = this.filter;
    const cached = new Set<number>(this.cachedFilter === null ? this.allLocationIds : this.cachedFilter);
    const needApply = ( this.cachedFilter === null && this.allLocationIds.some(d => !this.filter.has(d)) )
      || ( this.cachedFilter !== null && (
        this.cachedFilter.some(d => !this.filter.has(d))
        || Array.from(this.filter).some(d => !this.cachedFilter.includes(d))
      ));
    this.div.select('button#apply-place-set')
      .attr('disabled', needApply ? null : '')
      .on('click', () => this.onApplyFilter());

    this.div.select('.location-list__filter h2')
      .html(`Place Filter <em>(${this.filter.size} / ${this.allLocationIds.length})</em>`);

    const sel = this.div.select('.filter__content')
      .selectAll<HTMLDivElement, { id: number, name: string }>('.location')
      .data(this.filterPlaces);

    sel.enter()
      .append('div')
      .classed('location', true)
      .html(d => `<span class="check"></span>
          <span class="location__name">${d.name}</span>
          <button class="button button--white remove"><i class="fa fa-minus"></i></button>
          <button class="button button--white add"><i class="fa fa-plus"></i></button>`)
      .merge(sel)
      .each(function(d) {
        const check = d3.select(this).select('.check');
        check.html('');
        if (filter.has(d.id)) check.html(`<i class="fa fa-fw fa-check"></i>`);
        else if (cached.has(d.id)) check.html(`<i class="fa fa-fw fa-times"></i>`);
        check.attr('data-filtered', filter.has(d.id) ? '' : null)
          .attr('data-cached', cached.has(d.id) ? '' : null);

        d3.select(this).select('.location__name').text(d.name);
        d3.select(this).select('button.remove')
          .attr('disabled', filter.has(d.id) ? null : '')
          .on('click', () => { filter.delete(d.id); ref.renderFilter(); });
        d3.select(this).select('button.add')
          .attr('disabled', filter.has(d.id) ? '' : null)
          .on('click', () => { filter.add(d.id); ref.renderFilter(); });
      });

    sel.exit().remove();

  }

  private onApplyFilter() {
    this.div.select('button#apply-place-set').attr('disabled', '');

    const isAll = this.allLocationIds.every(d => this.filter.has(d));
    this.sendToDataThread('set-filter', isAll ? null : Array.from(this.filter));
  }

  private on_brush(
    sel: d3.Selection<HTMLParagraphElement, any, any, any>,
    datum: {id: number}
  ): void {
    const is_brushed = sel.classed('location-list__location-name--brushed');

    if (is_brushed) {
      this.sendToDataThread('clear-brush', null);
    } else {
      this.sendToDataThread('set-brush', datum.id);
    }
  }

  private onSearchTextChange() {
    const searchText = this.search_bar.node().value;
    const empty = searchText.length === 0;
    this.clear_button.classed('search-bar__clear-button--hidden', empty);

    if (empty) {
      this.worker.postMessage({type: 'clear-brush', data: null});
    } else {
      this.worker.postMessage({type: 'set-brush', data: searchText});
    }
  }

  protected openModal() {
    const info = modal.create_modal(
      400, 300,
      'Location List',
      'location-list.html'
    );
  }

  private start_tooltip_timer(datum: any, context: any) {
    const text_bbox = d3.select(context)
      .node()
      .getBoundingClientRect();
    const right = Math.round(text_bbox.left) + 10;
    const top = Math.round(text_bbox.top);

    this.tooltip.create(tooltip => {
      tooltip.move({ x: right, y: top });
      const t = tooltip.root;
      t.append('h1')
        .text(datum.name);
      const dl = t.append('dl');

      // place type
      dl.append('dt').text('Place Type');
      dl.append('dd').text(datum.place_type);

      // geographical location
      if (datum.geoloc !== null) {
        dl.append('dt').text('Geographical Location');
        const lat = datum.geoloc.lat;
        const lng = datum.geoloc.lng;
        const east = lng > 0 ? 'E' : 'W';
        const north = lat > 0 ? 'N' : 'S';

        const lat_deg = Math.floor(Math.abs(lat));
        const lat_min = toFixed(60 * (Math.abs(lat) - Math.floor(Math.abs(lat))), 5);
        const lng_deg = Math.floor(Math.abs(lng));
        const lng_min = toFixed(60 * (Math.abs(lng) - Math.floor(Math.abs(lng))), 5);

        const dd = dl.append('dd');
        dd.append('span').html(`${north}&nbsp;${lat_deg}&hairsp;°&nbsp;${lat_min}&hairsp;'`);
        dd.append('br');
        dd.append('span').html(`${east}&nbsp;${lng_deg}&hairsp;°&nbsp;${lng_min}&hairsp;'`);
      }

      // confidence
      dl.append('dt').text('Location Confidence');
      dl.append('dd').html(datum.location_confidence || `<em>no value</em>`);

      const ref = this;
      // do request
      d3.json(`../rest/place/${datum.id}/details`)
        .then(function(data: {comment: string | null, alternative_names: Array<number>, external_uris: string[]}) {
          // comment
          if (data.comment) {
            dl.append('dt').text('Comment');
            dl.append('dd').text(data.comment);
          }

          // alternative names
          if (data.alternative_names.length !== 0) {
            dl.append('dt').text('Alternative Names');
            const table = dl.append('dd').append('table');
            table
              .selectAll('tr')
              .data(data.alternative_names)
              .enter()
              .append('tr')
              .each(function(d: any) {
                const row = d3.select(this);
                row.append('td').text(d.name);
                row.append('td').text(d.language).classed('alternative-name__language', true);
              });
          }

          // URIs
          if (data.external_uris.length !== 0) {
            dl.append('dt').text('External URIs');
            const table = dl.append('dd').append('table');
            table
              .selectAll('tr')
              .data(data.external_uris)
              .enter()
              .append('tr')
              .each(function(d: any) {
                const row = d3.select(this);
                row.append('td').text(d).classed('short-uri', true);
              });
          }
        })
        .catch(console.error);
    });
  }

  private stop_tooltip(): void {
    this.tooltip.cancel();
  }
};

function toFixed(value, precision) {
  var power = Math.pow(10, precision || 0);
  return String(Math.round(value * power) / power);
}
