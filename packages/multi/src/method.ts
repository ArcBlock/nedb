import { doRpc } from './rpc';
import { Cursor } from './cursor';
import { endsWithCallback } from './utils';

export function createMethod<T>(socket: any, name: string, supportsCursor: boolean) {
  return function method(...args: any[]): any {
    if (supportsCursor && !endsWithCallback(args)) {
      // @ts-ignore
      return new Cursor<T>(socket, this.options, args);
    }

    // @ts-ignore
    return doRpc<T>(socket, this.options, name, args);
  };
}
