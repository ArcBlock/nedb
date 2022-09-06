import { CallbackWithResult } from '@nedb/core';

export function endsWithCallback(args?: any[]): boolean {
  return args && args.length > 0 && typeof args[args.length - 1] === 'function';
}

export function execCursor(cursor: any, db: any, callback: CallbackWithResult<any>) {
  const { query, sort, skip, limit, projection } = cursor;

  return db.cursor(query).sort(sort).skip(skip).limit(limit).projection(projection).exec(callback);
}
