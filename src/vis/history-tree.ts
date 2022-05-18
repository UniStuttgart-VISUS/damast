import EventTarget, { defineEventAttribute } from 'event-target-shim-es5';
import { v4 as uuid } from 'uuid';

const emptyState = Symbol('empty interaction state');

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

export default class HistoryTree extends EventTarget {
  private readonly root: HistoryTreeEntry;
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

  // this is so that ES5 build works with EventTarget shim
  declare addEventListener: typeof Element.prototype.addEventListener;
  declare dispatchEvent: typeof Element.prototype.dispatchEvent;

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
    this.current = this.current.parent as HistoryTreeEntry;
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
    const ref = this;
    let lines = [];
    function handle(node: HistoryTreeEntry, indent) {
      lines.push(`${new Array(indent).fill(' ').join('')}${node.uuid} ${node.description} ${node === ref.current ? '[current]' : ''}`);
      node.children?.forEach(c => handle(c, indent+2));
    }

    handle(this.root, 0);

    console.log(lines.join('\n'));
  }
}

defineEventAttribute(HistoryTree.prototype, 'change');
