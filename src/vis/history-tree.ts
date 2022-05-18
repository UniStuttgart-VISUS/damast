

const emptyState = new Symbol('empty interaction state');

type VisualizationState = any;  // XXX move from dataset.ts later
interface HistoryTreeEntry {
  uuid: string;
  parent: HistoryTreeEntry | typeof emptyState;
  children: HistoryTreeEntry[];

  created: Date;
  description: string;
  comment?: string;

  state: VisualizationState;
};

// XXX replace by library
_idx = 1;
function uuid(): string {
  return `${_idx++}`;
}

export default class HistoryTree extends EventTarget {
  readonly private root: HistoryTreeEntry;
  private current: HistoryTreeEntry;
  private byUuid: Map<string, HistoryTreeEntry>;
  private backStack: HistoryTreeEntry[] = [];

  constructor(
    initialState: VisualizationState,
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

    this.byUuid = new Map<string, HistoryTreeEntry>();
    this.byUuid.set(this.root.uuid, this.root);

    // for debugging
    this.addEventListener('change', () => this.debugPrint());
    this.debugPrint();
  }

  private notifyChanged(): void {
    this.dispatchEvent(new CustomEvent('change', { detail: this.current.state }));
  }

  /**
   * Add a new state, which will be a child of the current state.
   */
  pushState(
    state: VisualizationState,
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
    this.notifyChanged();
  }

  /**
   * Go back to the previous state.
   */
  back(): void {
    if (this.isRootState()) throw new Error('already at the root state');

    this.backStack.push(this.current);
    this.current = this.current.parent;
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
    function handle(node: HistoryTreeEntry) {
      console.log(node.uuid, node.description, node === this.current ? '[current]' : '');
      console.group();
      node.children?.forEach(handle);
      console.groupEnd();
    }

    handle(this.root);
  }
}
