// https://stackoverflow.com/questions/29478751/cancel-a-vanilla-ecmascript-6-promise-chain

interface _Cancelable {
  cancel: (...args) => any;
};

export type CancelablePromiseType<T> = Promise<T> & _Cancelable;

export function CancelablePromise<T>(executor): CancelablePromiseType<T> {
  let _reject = null;
  const cancelablePromise = new Promise((resolve, reject) => {
    _reject = reject;
    return executor(resolve, reject);
  }) as CancelablePromiseType<T>;
  cancelablePromise.cancel = () => _reject({canceled: true});

  return cancelablePromise;
}
