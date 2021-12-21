// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';
import DataLoader from 'worker-loader?filename=[name].js!./fetch.worker';
import View from './view';

declare type Class<T = any> = new (...args: any[]) => T;

export function createView<T extends View<any, any>>(
  worker_class: Class<Worker>,
  view_class: Class<T>,
  namespace_: string,
  loader: DataLoader,
  receivers: Map<string, View<any, any>>,
  listener: ((event: MessageEvent) => void),
  layout?: GoldenLayout
): void {
  const worker = new worker_class();
  const channel = new MessageChannel();
  loader.postMessage({
    type: `set-${namespace_}-port`,
    data: channel.port1
  }, [channel.port1]);
  worker.postMessage({
    type: 'pass-message-port',
    data: channel.port2
  }, [channel.port2]);
  worker.addEventListener('message', listener);

  if (layout) {
    layout.registerComponent(namespace_, (container, _) => {
      const view = new view_class(worker, container);

      receivers.set(namespace_, view);
    });
  } else {
    const view = new view_class(worker);

    receivers.set(namespace_, view);
  }
}

