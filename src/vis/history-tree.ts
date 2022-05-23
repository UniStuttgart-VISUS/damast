import EventTarget, { defineEventAttribute } from 'event-target-shim-es5';
import { v4 as uuid } from 'uuid';

import type { FilterJson, VisualizationState, CompleteVisualizationState } from './dataset';

const emptyState = Symbol('empty interaction state');

interface HistoryTreeEntry<T> {
  uuid: string;
  parent: HistoryTreeEntry<T> | typeof emptyState;
  children: HistoryTreeEntry<T>[];

  created: Date;
  description: string;
  comment?: string;

  state: T;
};

export interface JsonHistoryTree {
  uuid: string;
  children: JsonHistoryTree[];
  created: string;  // JSON cannot contain dates
  description: string;

  state: CompleteVisualizationState;
};

export default class HistoryTree<T extends CompleteVisualizationState> extends EventTarget {
  private readonly root: HistoryTreeEntry<T>;
  private current: HistoryTreeEntry<T>;
  private byUuid: Map<string, HistoryTreeEntry<T>>;
  private backStack: HistoryTreeEntry<T>[] = [];

  constructor(
    initialState: T,
  ) {
    super();

    this.root = {
      uuid: uuid(),
      parent: emptyState,
      children: [],
      created: new Date(),
      description: "Initial state",
      state: initialState,
    };
    this.current = this.root;

    this.byUuid = new Map<string, HistoryTreeEntry<T>>();
    this.byUuid.set(this.root.uuid, this.root);
  }

  private notifyChanged(): void {
    this.dispatchEvent(new CustomEvent('change', { detail: { state: this.current.state, uuid: this.current.uuid } }));
  }

  // this is so that ES5 build works with EventTarget shim
  declare addEventListener: typeof Element.prototype.addEventListener;
  declare dispatchEvent: typeof Element.prototype.dispatchEvent;

  /**
   * Add a new state, which will be a child of the current state.
   */
  pushState(
    state: T,
    description: string,
    comment?: string
  ): void {
    const newEntry = {
      uuid: uuid(),
      parent: this.current,
      children: [],
      created: new Date(),
      description,
      comment,
      state,
    };

    this.byUuid.set(newEntry.uuid, newEntry);
    this.current.children.push(newEntry);
    this.current = newEntry;
    this.backStack.splice(0, this.backStack.length);
    this.notifyChanged();
  }

  /**
   * Go back to the previous state.
   */
  back(): void {
    if (this.isRootState()) throw new Error('already at the root state');

    this.backStack.push(this.current);
    this.current = this.current.parent as HistoryTreeEntry<T>;

    this.notifyChanged();
  }

  /**
   * Revert the last back, if applicable.
   */
  forward(): void {
    if (!this.canForward()) throw new Error('no back action to reverse');

    this.current = this.backStack.pop();
    this.notifyChanged();
  }

  isRootState(): boolean {
    return this.current === this.root;
  }

  canBack(): boolean {
    return !this.isRootState();
  }

  canForward(): boolean {
    return this.backStack.length > 0;
  }

  fireChange() {
    this.notifyChanged();
  }

  /**
   * Jump to the state with the UUID directly.
   */
  goToEntry(uuid: string): void {
    if (!this.byUuid.has(uuid)) throw new Error(`entry with UUID ${uuid} does not exist`);
    if (this.current.uuid === uuid) return;

    this.backStack.splice(0, this.backStack.length);
    this.current = this.byUuid.get(uuid);
    this.notifyChanged();
  }

  private debugPrint(): void {
    const ref = this;
    let lines = [];
    function handle(node: HistoryTreeEntry<T>, indent) {
      lines.push(`${new Array(indent).fill(' ').join('')}${node.uuid} ${node.description} ${node === ref.current ? '[current]' : ''}`);
      node.children?.forEach(c => handle(c, indent+2));
    }

    handle(this.root, 0);

    console.log(lines.join('\n'));
  }

  /**
   * Add a new entry at the root level.
   */
  pushStateToRoot(
    state: T,
    description: string,
    comment?: string
  ): void {
    this.current = this.root;
    this.pushState(state, description, comment);
  }

  private rebuildUuidLookup() {
    this.byUuid = new Map<string, HistoryTreeEntry<T>>();
    const visitor = (node: HistoryTreeEntry<T>) => {
      this.byUuid.set(node.uuid, node);
      node.children.forEach(visitor);
    };
    visitor(this.root);
  }

  /**
   * Reset the history (back to root state).
   */
  reset() {
    this.current = this.root;
    this.root.children = [];

    this.rebuildUuidLookup();
    this.backStack.splice(0, this.backStack.length);
    this.notifyChanged();
  }

  /**
   * Remove all states not in the path from root to the current state.
   */
  prune() {
    // backtrack
    const keep = new Set<string>();
    const visitor = (node: HistoryTreeEntry<T>) => {
      keep.add(node.uuid);
      if (node.parent !== emptyState) visitor(node.parent);
    };
    visitor(this.current);

    const visitor2 = (node: HistoryTreeEntry<T>) => {
      node.children = node.children.filter(d => keep.has(d.uuid));
      node.children.forEach(visitor2);
    };
    visitor2(this.root);

    this.rebuildUuidLookup();
    this.backStack.splice(0, this.backStack.length);
    this.notifyChanged();
  }

  /**
   * Remove all states not in the path from root to the current state, and make
   * the current child a direct child of the root state.
   */
  pruneCondense() {
    if (this.current === this.root) return this.reset();

    this.root.children = [this.current];
    this.current.parent = this.root;
    this.current.children = [];
    this.current.description = 'multiple condensed changes';

    this.rebuildUuidLookup();
    this.backStack.splice(0, this.backStack.length);
    this.notifyChanged();
  }

  getCurrentState(): T {
    return this.current.state;
  }

  getJson(): JsonHistoryTree {
    const transform = function(node: HistoryTreeEntry<T>): JsonHistoryTree {
      const children = node.children.map(transform);
      const created = node.created.toISOString();
      const state = JSON.parse(JSON.stringify(node.state));

      return { uuid: node.uuid, description: node.description, created, children, state };
    };

    return transform(this.root);
  }
}

defineEventAttribute(HistoryTree.prototype, 'change');
