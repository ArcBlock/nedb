// @ts-ignore
import serialize from 'serialize-javascript';
import { CallbackWithResult } from '@nedb/core';

export function endsWithCallback(args?: any[]): boolean {
  return args && args.length > 0 && typeof args[args.length - 1] === 'function';
}

export function execCursor(cursor: any, db: any, callback: CallbackWithResult<any>) {
  const { query, sort, skip, limit, projection } = cursor;

  return db.cursor(query).sort(sort).skip(skip).limit(limit).projection(projection).exec(callback);
}

export function deserialize(data: string): any {
  // eslint-disable-next-line no-eval
  return eval(`(${data})`);
}

export { serialize };
