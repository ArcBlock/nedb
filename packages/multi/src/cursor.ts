/* eslint-disable @typescript-eslint/lines-between-class-members */
import { SortQuery, ProjectionQuery, CallbackWithResult, FilterQuery } from '@nedb/core';
import { doRpc } from './rpc';
import { EXECUTE_CURSOR_PRIVATE } from './constants';

export class Cursor<T> {
  private _skip: number;
  private _limit: number;
  private _query: FilterQuery<T>;
  private _sort: SortQuery<T>;
  private _projection: ProjectionQuery<T>;

  private options: any;
  private socket: any;

  constructor(socket: any, options: any, args: any[]) {
    this.options = options;
    this.socket = socket;
    this._query = args[0] || {};
  }

  public query(query: FilterQuery<T>): Cursor<T> {
    this._query = query;
    return this;
  }

  public sort(sort: SortQuery<T>): Cursor<T> {
    this._sort = sort;
    return this;
  }

  public skip(skip: number) {
    this._skip = skip;
    return this;
  }

  public limit(limit: number) {
    this._limit = limit;
    return this;
  }

  public projection(projection: ProjectionQuery<T>) {
    this._projection = projection;
    return this;
  }

  public toJSON(): { [key: string]: any } {
    return {
      query: this._query,
      skip: this._skip,
      sort: this._sort,
      limit: this._limit,
      projection: this._projection,
    };
  }

  public exec(callback?: CallbackWithResult<T[]>) {
    return doRpc<T[]>(this.socket, this.options, EXECUTE_CURSOR_PRIVATE, [this, callback]);
  }
}
