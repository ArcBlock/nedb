/* eslint-disable unicorn/filename-case */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/lines-between-class-members */

import {
  CallbackOptionalError,
  CallbackWithResult,
  DataStoreOptions,
  FilterQuery,
  IndexOptions,
  ProjectionQuery,
  RemoveOptions,
  Row,
  AnyObject,
  UpdateOptions,
  UpdateQuery,
  UpdateResult,
} from '@nedb/core';

import { doRpc } from './rpc';
import { Cursor } from './cursor';
import { PersistenceProxy } from './persistenceProxy';

export function createDataStore(socket: any) {
  class DataStore<T = AnyObject> {
    readonly options: DataStoreOptions;
    readonly persistence: any;

    constructor(options: any) {
      this.options = options;
      this.persistence = new PersistenceProxy(socket, options);
    }

    public loadDatabase(): PromiseLike<void>;
    public loadDatabase(cb: CallbackOptionalError): void;
    public loadDatabase() {
      return doRpc<void>(socket, this.options, 'loadDatabase', Array.prototype.slice.call(arguments));
    }

    public closeDatabase(): PromiseLike<void>;
    public closeDatabase(cb: CallbackOptionalError): void;
    public closeDatabase() {
      return doRpc<void>(socket, this.options, 'closeDatabase', Array.prototype.slice.call(arguments));
    }

    public ensureIndex(options: IndexOptions, cb?: CallbackOptionalError) {
      return doRpc<void>(socket, this.options, 'ensureIndex', Array.prototype.slice.call(arguments));
    }

    public removeIndex(fieldName: string, cb?: CallbackOptionalError) {
      return doRpc<void>(socket, this.options, 'removeIndex', Array.prototype.slice.call(arguments));
    }

    public insert(doc: T): PromiseLike<Row<T>>;
    public insert(doc: T[]): PromiseLike<Row<T>[]>;
    public insert(doc: T, cb: CallbackWithResult<Row<T>>): void;
    public insert(doc: T[], cb: CallbackWithResult<Row<T>[]>): void;
    public insert(): any {
      return doRpc<void>(socket, this.options, 'insert', Array.prototype.slice.call(arguments));
    }

    public cursor(query?: FilterQuery<T>): Cursor<T> {
      return new Cursor<T>(socket, this.options, Array.prototype.slice.call(arguments));
    }

    public count(query?: FilterQuery<T>): PromiseLike<number>;
    public count(query: FilterQuery<T>, callback: CallbackWithResult<number>): void;
    public count(callback: CallbackWithResult<number>): void;
    public count(): any {
      return doRpc<void>(socket, this.options, 'count', Array.prototype.slice.call(arguments));
    }

    public find(query?: FilterQuery<T>): PromiseLike<Row<T>[]>;
    public find(query: FilterQuery<T>, projection: ProjectionQuery<T>): PromiseLike<Row<T>[]>;
    public find(callback: CallbackWithResult<Row<T>[]>): void;
    public find(query: FilterQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;
    public find(query: FilterQuery<T>, projection: ProjectionQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;
    public find(): any {
      return doRpc<void>(socket, this.options, 'find', Array.prototype.slice.call(arguments));
    }

    public findOne(query?: FilterQuery<T>): PromiseLike<Row<T>>;
    public findOne(query: FilterQuery<T>, projection?: ProjectionQuery<T>): PromiseLike<Row<T>>;
    public findOne(query: FilterQuery<T>, callback?: CallbackWithResult<Row<T>>): void;
    public findOne(query: FilterQuery<T>, projection: ProjectionQuery<T>, callback: CallbackWithResult<Row<T>>): void;
    public findOne(): any {
      return doRpc<void>(socket, this.options, 'findOne', Array.prototype.slice.call(arguments));
    }

    public update(query: FilterQuery<T>, updateQuery: UpdateQuery<T>): PromiseLike<UpdateResult<T>>;
    public update(query: FilterQuery<T>, updateQuery: UpdateQuery<T>, cb: CallbackWithResult<any>): void;
    public update(
      query: FilterQuery<T>,
      updateQuery: UpdateQuery<T>,
      options: UpdateOptions
    ): PromiseLike<UpdateResult<T>>;
    public update(
      query: FilterQuery<T>,
      updateQuery: UpdateQuery<T>,
      options: UpdateOptions,
      cb: CallbackWithResult<any>
    ): void;
    public update(): any {
      return doRpc<void>(socket, this.options, 'update', Array.prototype.slice.call(arguments));
    }

    public remove(query: FilterQuery<T>): PromiseLike<number>;
    public remove(query: FilterQuery<T>, options: RemoveOptions): PromiseLike<number>;
    public remove(query: FilterQuery<T>, cb: CallbackWithResult<number>): void;
    public remove(query: FilterQuery<T>, options: RemoveOptions, cb: CallbackWithResult<number>): void;
    public remove(): any {
      return doRpc<void>(socket, this.options, 'remove', Array.prototype.slice.call(arguments));
    }
  }

  return DataStore;
}
