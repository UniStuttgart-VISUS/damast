import { json } from 'd3-fetch';
import { stratify } from 'd3-hierarchy';

const loadables: [ keyof Cache, string, string | null ][] = [
  ['confidence', '../rest/confidence-values', null],
  ['religions', '../rest/religion-list', null ],
  ['place_types', '../rest/place-type-list', 'type' ],
  ['sources', '../rest/sources-list', 'short' ],
  ['languages', '../rest/languages-list', 'name' ],
  ['tags', '../rest/tag-list', 'tagname' ],
  ['persons', '../rest/person-list', 'name' ],
  ['uri_namespaces', '../rest/uri/uri-namespace-list', 'comment' ],
  ['places', '../rest/places', 'name' ],
  ['annotator_evidences', '../rest/annotator-evidence-list', null],
  ['person_types', '../rest/person-type-list', 'type'],
];

export default class Cache {
  public readonly confidence: Promise<any>;
  public readonly religions: Promise<any>;
  public readonly place_types: Promise<any>;
  public readonly sources: Promise<any>;
  public readonly languages: Promise<any>;
  public readonly tags: Promise<any>;
  public readonly persons: Promise<any>;
  public readonly uri_namespaces: Promise<any>;
  public readonly places: Promise<{id: number, name: string}[]>;
  public readonly annotator_evidences: Promise<Map<number, number>>;
  public readonly person_types: Promise<{id: number, type: string}[]>;

  private _ready: Promise<void>;

  constructor(
    loaded_fields: (keyof Cache)[] = [
      'confidence',
      'religions',
      'place_types',
      'sources',
      'languages',
      'tags',
      'persons',
      'uri_namespaces',
      'annotator_evidences',
      'person_types',
    ],
  ) {
    // only load those fields specified
    const promises: Promise<any>[] = loadables.map(async ([field, url, key]) => {
      if (loaded_fields.includes(field)) {
        // assigning to this[field] does not work with readonly, even though it should be once and in constructor
        Object.assign(this, {
          [field]: json(url)
            .then((vals: any[]) => (key === null)
                          ? (
                            (field === 'religions') ? this.sortedReligions(vals)
                            : (field === 'annotator_evidences') ? new Map<number, number>(vals)
                            : vals)
                          : vals.sort((a, b) => a[key].localeCompare(b[key])))
            .catch(console.error)
        });
      } else {
        Object.assign(this, {[field]: Promise.resolve(`Field ${field} was not requested for caching.`)});
      }

      return this[field];
    });

    this._ready = Promise.all(promises)
      .then(_ => {});
  }

  get ready(): Promise<void> {
    return this._ready;
  }

  private sortedReligions(
    religions: { id: number, parent_id: number, name: string }[]
  ): { id: number, parent_id: number, name: string }[] {
    const rels: { id: number, parent_id: number | '', name: string }[] = [
      {id: 0, name: 'root', parent_id: ''},
      ...religions.map(d => {
        if (d.parent_id === null) d.parent_id = 0;
        return d;
      })
    ];

    // build hierarchy
    const root = stratify<{id: number, parent_id: number | '', name: string}>()
      .id(d => `${d.id}`)
      .parentId(d => `${d.parent_id}`)
      (rels);
    root.sort((a,b) => a.data.name.localeCompare(b.data.name));

    // list all descendants in pre-order traversal
    const ret: { id: number, parent_id: number, name: string }[] = [];
    root.eachBefore(node => {
      if (typeof node.data.parent_id === 'number') ret.push(node.data as { id: number, parent_id: number, name: string });
    });
    return ret;
  }
};
