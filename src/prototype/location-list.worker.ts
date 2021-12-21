import {DataWorker,MessageData} from './data-worker';
import {CancelablePromise,CancelablePromiseType} from './cancelable-promise';
import { TransferableColorscheme, ConfidenceRange, User } from './datatypes';
import sort_ignore_name_prefixes from '../common/ignore-name-prefixes';

class LocationListWorker extends DataWorker<any> {
  private placed_locations: Array<any>;
  private unplaced_locations: Array<any>;
  private allPlaces: Array<{ id: number, name: string }> = [];
  private place_set: number[] | null;

  private brushed_locations: Set<number> = new Set<number>();
  private searched_locations: Set<number> = new Set<number>();
  private searched_locations_alternative: Set<number> = new Set<number>();

  private searchText: string = '';
  private user: User;

  private confidenceColorscale: TransferableColorscheme;
  private locationConfidenceFilter: ConfidenceRange;

  private cancelable_altname_search: CancelablePromiseType<number[]> = null;

  async handleMainEvent(data: MessageData<any>) {
    if (data.type === 'set-brush') {
      this.setMessage('location-list-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

      this.cancelable_altname_search?.cancel();

      const searchText = data.data;
      this.searchText = searchText;
      const ignore_case = searchText == searchText.toLocaleLowerCase();
      const regex = new RegExp(searchText,
        // smart case
        ignore_case ? 'i' : ''
      );

      this.searched_locations = this.location_filter(regex);

      // initially, no alt name search
      this.searched_locations_alternative = new Set<number>();

      const ref = this;
      this.cancelable_altname_search = CancelablePromise<number[]>((resolve, reject) => {
        this.setMessage('location-list-worker', '<i class="fa fa-fw fa-download"></i>');
        const url = '../rest/find-alternative-names';
        return fetch(url, {
          method: 'POST',
          mode: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({regex: searchText, ignore_case})
        })
          .then(response => {
            if (response.ok) resolve(response.json());
            else reject(response.statusText);
          });
      });
      this.cancelable_altname_search.then(json => {
          this.searched_locations_alternative = new Set<number>(json);
          return ref.sortAndSendData(false);
        })
        .then(() => {
          this.clearMessage('location-list-worker-fetch');
        })
        .catch(err => {
          if (!err.canceled) console.error(err);
        });

      this.clearMessage('location-list-worker');
      this.sortAndSendData(false);

    } else if (data.type === 'clear-brush') {
      this.setMessage('location-list-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');
      this.clearMessage('location-list-worker-fetch');
      this.searchText = '';

      this.cancelable_altname_search?.cancel();

      this.searched_locations = new Set<number>();
      this.searched_locations_alternative = new Set<number>();

      this.sortAndSendData(false);

      this.clearMessage('location-list-worker');
    } else {
      throw data;
    }
  }

  async handleDataEvent(data: MessageData<any>) {
    this.setMessage('location-list-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');

    if (data.type === 'set-data') {
      this.placed_locations = data.data.placed;
      this.unplaced_locations = data.data.unplaced;
      this.place_set = data.data.filter;
      this.allPlaces = data.data.allPlaces;
      this.user = data.data.user;
      this.confidenceColorscale = data.data.confidenceColorscale;
      this.locationConfidenceFilter = data.data.locationConfidenceFilter;

      await this.sortAndSendData(data.data.filterChanged);
    } else {
      throw data;
    }

    this.clearMessage('location-list-worker');
  }

  protected async handleSetBrush(data: MessageData<any>) {
    this.setMessage('location-list-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');
    this.brushed_locations = data.data;
    await this.sortAndSendData(false);
    this.clearMessage('location-list-worker');
  }

  protected async handleClearBrush(data: MessageData<any>) {
    this.setMessage('location-list-worker', '<i class="fa fa-fw fa-spinner fa-pulse"></i>');
    this.brushed_locations = new Set<number>();
    await this.sortAndSendData(false);
    this.clearMessage('location-list-worker');
  }

  private async sortAndSendData(fromDataset: boolean) {
    this.placed_locations.sort((a, b) => this.sortByName(a, b, this.brushed_locations, this.searched_locations, this.searched_locations_alternative));
    this.unplaced_locations.sort((a, b) => this.sortByName(a, b, this.brushed_locations, this.searched_locations, this.searched_locations_alternative));

    this.placed_locations.forEach(this.supplementStyles.bind(this));
    this.unplaced_locations.forEach(this.supplementStyles.bind(this));

    const filterPlaces = (this.searchText === ''
      ? this.allPlaces
      : [...this.placed_locations, ...this.unplaced_locations].filter(({ category }) => category !== null)
    )
      .map(({ id, name }) => { return { id, name }; })
      .sort((a, b) => {
        const a_ = a.name.replace(sort_ignore_name_prefixes, '');
        const b_ = b.name.replace(sort_ignore_name_prefixes, '');

        return a_.localeCompare(b_);
      });

    await this.sendToMainThread({
      type: 'set-data',
      target: 'location-list',
      data: {
        placed: this.placed_locations,
        unplaced: this.unplaced_locations,
        allPlaces: this.allPlaces,
        filter: this.place_set,
        filterPlaces,
        fromDataset,
        user: this.user,
        confidenceColorscale: this.confidenceColorscale,
        locationConfidenceFilter: this.locationConfidenceFilter,
      },
    });
  }

  private supplementStyles(loc) {
    if (this.brushed_locations.has(loc.id)) loc.category = 'brushed';
    else if (this.searched_locations.has(loc.id)) loc.category = 'searched';
    else if (this.searched_locations_alternative.has(loc.id)) loc.category = 'alternative';
    else loc.category = null;
  }

  private location_filter(regex: RegExp): Set<number> {
    const s = new Set<number>(this.placed_locations.filter(d => regex.test(d.name)).map(d => d.id));
    this.unplaced_locations.filter(d => regex.test(d.name)).forEach(d => s.add(d.id));

    return s;
  }

  private sortByName(a: any,
    b: any,
    brushed?: Set<number>,
    search_results?: Set<number>,
    search_results_alternative?: Set<number>) {
    {
      const a__ = brushed.has(a.id);
      const b__ = brushed.has(b.id);

      if (a__ && !b__) return -1;
      if (b__ && !a__) return 1;
    }

    {
      const a__ = search_results.has(a.id);
      const b__ = search_results.has(b.id);

      if (a__ && !b__) return -1;
      if (b__ && !a__) return 1;
    }

    {
      const a___ = search_results_alternative.has(a.id);
      const b___ = search_results_alternative.has(b.id);

      if (a___ && !b___) return -1;
      if (!a___ && b___) return 1;
    }

    const a_ = a.name.replace(sort_ignore_name_prefixes, '');
    const b_ = b.name.replace(sort_ignore_name_prefixes, '');

    return a_.localeCompare(b_);
  }
};


const ctx: Worker = self as any;
const w = new LocationListWorker(ctx, 'location-list');
