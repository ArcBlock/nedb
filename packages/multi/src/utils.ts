// @ts-ignore
import serializeJs from 'serialize-javascript';
import { CallbackWithResult } from '@nedb/core';
import crypto from 'crypto';

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

export function serialize(data: any): string {
  return serializeJs(data, { ignoreFunction: true });
}

export const md5 = (str: string): string => crypto.createHash('md5').update(str).digest('hex');
