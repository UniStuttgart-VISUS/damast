//import EventTarget, { defineEventAttribute } from 'event-target-shim-es5';
import { v4 as uuid } from 'uuid';

import type { FilterJson, VisualizationState, CompleteVisualizationState } from './dataset';

export interface JsonHistoryTree {
  uuid: string;
  children: JsonHistoryTree[];

  created: string;  // JSON cannot contain dates
  description: string;
  comment?: string;

  state: CompleteVisualizationState;
};

export default class HistoryTree extends EventTarget {
  private readonly root: JsonHistoryTree;
  private current: JsonHistoryTree;
  private byUuid: Map<string, JsonHistoryTree>;
  private backStack: JsonHistoryTree[] = [];

  // removes GC issue: store reference to parent separately
  private readonly parentMap = new WeakMap<JsonHistoryTree, JsonHistoryTree>();

  constructor(
    initialState: CompleteVisualizationState,
  ) {
    super();

    this.root = {
      uuid: uuid(),
      children: [],
      created: new Date().toISOString(),
      description: "Initial state",
      state: initialState,
    };
    this.current = this.root;

    this.byUuid = new Map<string, JsonHistoryTree>();
    this.byUuid.set(this.root.uuid, this.root);
  }

  private notifyChanged(): void {
    this.dispatchEvent(new CustomEvent('change', { detail: { state: this.current.state, uuid: this.current.uuid } }));
  }

  // this is so that ES5 build works with EventTarget shim
  declare addEventListener: typeof Element.prototype.addEventListener;
  declare dispatchEvent: typeof Element.prototype.dispatchEvent;

  private getParent(node: JsonHistoryTree): JsonHistoryTree | null {
    if (this.parentMap.has(node)) return this.parentMap.get(node);
    return null;
  }

  private newState(
    state: CompleteVisualizationState,
    description: string,
    comment?: string
  ): JsonHistoryTree {
    return {
      uuid: uuid(),
      children: [],
      created: new Date().toISOString(),
      description,
      comment,
      state,
    };
  }

  /**
   * Add a new state, which will be a child of the current state.
   */
  pushState(
    state: CompleteVisualizationState,
    description: string,
    comment?: string
  ): void {
    const newEntry = this.newState(state, description, comment);

    this.byUuid.set(newEntry.uuid, newEntry);
    this.parentMap.set(newEntry, this.current);
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
    this.current = this.getParent(this.current) as JsonHistoryTree;

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
    function handle(node: JsonHistoryTree, indent: number) {
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
    state: CompleteVisualizationState,
    description: string,
    comment?: string
  ): void {
    this.current = this.root;
    this.pushState(state, description, comment);
  }

  private rebuildUuidLookup() {
    this.byUuid = new Map<string, JsonHistoryTree>();
    const visitor = (node: JsonHistoryTree) => {
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
    const visitor = (node: JsonHistoryTree) => {
      keep.add(node.uuid);
      const parent = this.getParent(node);
      if (parent !== null) visitor(parent);
    };
    visitor(this.current);

    const visitor2 = (node: JsonHistoryTree) => {
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
    this.parentMap.set(this.current, this.root);
    this.current.children = [];
    this.current.description = 'multiple condensed changes';

    this.rebuildUuidLookup();
    this.backStack.splice(0, this.backStack.length);
    this.notifyChanged();
  }

  getCurrentState(): CompleteVisualizationState {
    return this.current.state;
  }

  getJson(): JsonHistoryTree {
    return JSON.parse(JSON.stringify(this.root));
  }
}

//defineEventAttribute(HistoryTree.prototype, 'change');
