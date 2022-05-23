import type { MessageDataType } from './data-worker';

type CallbackFn<T> = (type: MessageDataType, data: T) => void;
export type TreeButtonData = [string, string, string, (cb: CallbackFn<null>) => void];

export const buttonOptions: TreeButtonData[] = [
    [
      'Clear',
      `<svg viewBox="0 0 2 1">
         <circle cx="1" cy="0.5" r="0.2" stroke-width="0.1" stroke="currentColor" fill="currentColor" />
       </svg>`,
      'Clear entire history and go to initial state',
      (cb) => cb('history-reset', null),
    ],
    [
      'Prune',
      `<svg viewBox="0 0 2 1">
         <circle cx="0.3" cy="0.5" r="0.2" stroke-width="0.1" fill="none" stroke="currentColor" />
         <circle cx="1" cy="0.5" r="0.2" stroke-width="0.1" fill="none" stroke="currentColor" />
         <circle cx="1.7" cy="0.5" r="0.2" stroke-width="0.1" stroke="currentColor" fill="currentColor" />
         <path stroke-width="0.1" fill="none" stroke="currentColor" d="M0.5 0.5H0.8M1.2 0.5H1.5" />
       </svg>`,
      'Prune other branches from history tree',
      (cb) => cb('history-prune', null),
    ],
    [
      'Prune and condense',
      `<svg viewBox="0 0 2 1">
         <circle cx="0.5" cy="0.5" r="0.2" stroke-width="0.1" fill="none" stroke="currentColor" />
         <circle cx="1.5" cy="0.5" r="0.2" stroke-width="0.1" stroke="currentColor" fill="currentColor" />
         <path stroke-width="0.1" fill="none" stroke="currentColor" d="M0.7 0.5H1.3" />
       </svg>`,
      'Prune other branches from history tree, and condense the current history branch to one state change',
      (cb) => cb('history-prune-condense', null),
    ],
];
