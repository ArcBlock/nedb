/* eslint-disable unicorn/filename-case */
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
  UpdateOptions,
  UpdateQuery,
  UpdateResult,
} from '@nedb/core';

import { createMethod } from './method';
import { METHODS_DESCRIPTIONS } from './constants';
import { PersistenceProxy } from './persistenceProxy';
import { Cursor } from './cursor';

export function createDataStore(socket: any) {
  class DataStore<T> implements DataStore<T> {
    options: DataStoreOptions;
    persistence: any;

    constructor(options: any) {
      this.options = options;
      this.persistence = new PersistenceProxy(socket, options);
    }
  }

  for (const { name, supportsCursor } of METHODS_DESCRIPTIONS) {
    // @ts-ignore
    DataStore.prototype[name] = createMethod<any>(socket, name, supportsCursor);
  }

  return DataStore;
}

export namespace createDataStore {
  export interface DataStore<T> {
    loadDatabase(): PromiseLike<void>;
    loadDatabase(cb: CallbackOptionalError): void;

    closeDatabase(): PromiseLike<void>;
    closeDatabase(cb: CallbackOptionalError): void;

    ensureIndex(options: IndexOptions, cb?: CallbackOptionalError): void;
    removeIndex(fieldName: string, cb?: CallbackOptionalError): void;

    getCandidates(query: FilterQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;
    getCandidates(query: FilterQuery<T>, dontExpireStaleDocs: boolean, callback: CallbackWithResult<Row<T>[]>): void;

    insert(doc: T): PromiseLike<Row<T>>;
    insert(doc: T[]): PromiseLike<Row<T>[]>;
    insert(doc: T, cb: CallbackWithResult<Row<T>>): void;
    insert(doc: T[], cb: CallbackWithResult<Row<T>[]>): void;

    cursor(query?: FilterQuery<T>): Cursor<T>;

    count(query?: FilterQuery<T>): PromiseLike<number>;
    count(query: FilterQuery<T>, callback: CallbackWithResult<number>): void;
    count(callback: CallbackWithResult<number>): void;

    find(query?: FilterQuery<T>): PromiseLike<Row<T>[]>;
    find(query: FilterQuery<T>, projection: ProjectionQuery<T>): PromiseLike<Row<T>[]>;
    find(callback: CallbackWithResult<Row<T>[]>): void;
    find(query: FilterQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;
    find(query: FilterQuery<T>, projection: ProjectionQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;

    findOne(query?: FilterQuery<T>): PromiseLike<Row<T>>;
    findOne(query: FilterQuery<T>, projection?: ProjectionQuery<T>): PromiseLike<Row<T>>;
    findOne(query: FilterQuery<T>, callback?: CallbackWithResult<Row<T>>): void;
    findOne(query: FilterQuery<T>, projection: ProjectionQuery<T>, callback: CallbackWithResult<Row<T>>): void;

    update(query: FilterQuery<T>, updateQuery: UpdateQuery<T>): PromiseLike<UpdateResult<T>>;
    update(query: FilterQuery<T>, updateQuery: UpdateQuery<T>, cb: CallbackWithResult<any>): void;
    update(query: FilterQuery<T>, updateQuery: UpdateQuery<T>, options: UpdateOptions): PromiseLike<UpdateResult<T>>;
    update(
      query: FilterQuery<T>,
      updateQuery: UpdateQuery<T>,
      options: UpdateOptions,
      cb: CallbackWithResult<any>
    ): void;

    remove(query: FilterQuery<T>): PromiseLike<number>;
    remove(query: FilterQuery<T>, options: RemoveOptions): PromiseLike<number>;
    remove(query: FilterQuery<T>, cb: CallbackWithResult<number>): void;
    remove(query: FilterQuery<T>, options: RemoveOptions, cb: CallbackWithResult<number>): void;
  }
}
