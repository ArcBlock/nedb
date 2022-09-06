// @ts-ignore
import errio from 'errio';
import asCallback from 'standard-as-callback';

import { endsWithCallback } from './utils';

export function doRpc<T>(socket: any, options: any, method: string, args: any[]): PromiseLike<T> {
  const dataOnlyArgs = args;
  let callback;

  if (endsWithCallback(args)) {
    callback = dataOnlyArgs.pop();
  }

  const promise = new Promise<T>((resolve, reject) => {
    socket.send(options, method, dataOnlyArgs, (err: any, result: any) => {
      if (err) {
        reject(errio.parse(err));
      } else {
        resolve(result);
      }
    });
  });

  return asCallback(promise, callback);
}
