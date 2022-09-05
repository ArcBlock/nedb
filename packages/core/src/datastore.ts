/* eslint-disable @typescript-eslint/lines-between-class-members */
/* eslint-disable import/first */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-continue */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable prefer-rest-params */
/* eslint-disable prefer-destructuring */
/* eslint-disable consistent-return */
/* eslint-disable indent */
/* eslint-disable no-param-reassign */
/* eslint-disable default-case */
/* eslint-disable no-underscore-dangle */

import EventEmitter from 'events';
import asCallback from 'standard-as-callback';

/* eslint-disable func-names */
const util = require('util');
const AsyncWaterfall = require('async/waterfall');
const AsyncEachSeries = require('async/eachSeries');

// eslint-disable-next-line global-require
const debug = require('debug')(`${require('../package.json').name}:datastore`);

const customUtils = require('./customUtils');
const model = require('./model');
const Executor = require('./executor');
const Index = require('./indexes');
const HashIndex = require('./hashIndex');
const Persistence = require('./persistence');

import { Cursor } from './cursor';

import {
  DatastoreOptions,
  CallbackOptionalError,
  CallbackWithResult,
  IndexOptions,
  FilterQuery,
  ProjectionQuery,
  UpdateOptions,
  UpdateQuery,
  UpdateResult,
  RemoveOptions,
  NativeError,
  Row,
} from './types';

/**
 * Create a new collection
 * @param {String} options.filename Optional, datastore will be in-memory only if not provided
 * @param {Boolean} options.timestampData Optional, defaults to false. If set to true, createdAt and updatedAt will be created and populated automatically (if not specified by user)
 * @param {Boolean} options.inMemoryOnly Optional, defaults to false
 * @param {String} options.nodeWebkitAppName Optional, specify the name of your NW app if you want options.filename to be relative to the directory where
 *                                            Node Webkit stores application data such as cookies and local storage (the best place to store data in my opinion)
 * @param {Boolean} options.autoload Optional, defaults to false
 * @param {Function} options.onload Optional, if autoload is used this will be called after the load database with the error object as parameter. If you don't pass it the error will be thrown
 * @param {Function} options.afterSerialization/options.beforeDeserialization Optional, serialization hooks
 * @param {Number} options.corruptAlertThreshold Optional, threshold after which an alert is thrown if too much data is corrupt
 * @param {Function} options.compareStrings Optional, string comparison function that overrides default for sorting
 *
 * Event Emitter - Events
 * * compaction.done - Fired whenever a compaction operation was finished
 */
export class Datastore<T> extends EventEmitter {
  private inMemoryOnly: boolean;
  private autoload: boolean;
  private timestampData: boolean;
  private filename: string;

  private compareStrings: any;
  private indexes: { [key: string]: typeof Index | typeof HashIndex };
  private ttlIndexes: { [key: string]: number };

  private persistence: typeof Persistence;
  private executor: typeof Executor;

  constructor(options: DatastoreOptions = {}) {
    super();

    let filename;

    // Retrocompatibility with v0.6 and before
    if (typeof options === 'string') {
      filename = options;
      this.inMemoryOnly = false; // Default
    } else {
      filename = options.filename;
      this.inMemoryOnly = options.inMemoryOnly || false;
      this.autoload = options.autoload || false;
      this.timestampData = options.timestampData || false;
    }

    // Determine whether in memory or persistent
    if (!filename || typeof filename !== 'string' || filename.length === 0) {
      this.filename = null;
      this.inMemoryOnly = true;
    } else {
      this.filename = filename;
    }

    // String comparison function
    this.compareStrings = options.compareStrings;

    // Persistence handling
    this.persistence = new Persistence({
      db: this,
      nodeWebkitAppName: options.nodeWebkitAppName,
      afterSerialization: options.afterSerialization,
      beforeDeserialization: options.beforeDeserialization,
      corruptAlertThreshold: options.corruptAlertThreshold,
    });

    // This new executor is ready if we don't use persistence
    // If we do, it will only be ready once loadDatabase is called
    this.executor = new Executor();
    if (this.inMemoryOnly) {
      this.executor.ready = true;
    }

    // Indexed by field name, dot notation can be used
    // _id is always indexed and since _ids are generated randomly the underlying
    // binary is always well-balanced
    this.indexes = {};
    this.indexes._id = new HashIndex({ fieldName: '_id', unique: true });
    this.ttlIndexes = {};

    // Queue a load of the database right away and call the onload handler
    // By default (no onload handler), if there is an error there, no operation will be possible so warn the user by throwing an exception
    if (this.autoload) {
      this.loadDatabase(
        options.onload ||
          ((err) => {
            if (err) {
              throw err;
            }
          })
      );
    }
  }

  /**
   * Load the database from the datafile, and trigger the execution of buffered commands if any
   */
  public loadDatabase(): PromiseLike<void>;
  public loadDatabase(cb: CallbackOptionalError): void;
  public loadDatabase() {
    return this._promiseAsCallback<void>(
      this.persistence,
      this.persistence.loadDatabase,
      Array.prototype.slice.call(arguments),
      true
    );
  }

  /**
   * Close the database and its underlying datafile.
   */
  public closeDatabase(): PromiseLike<void>;
  public closeDatabase(cb: CallbackOptionalError): void;
  public closeDatabase() {
    // Push the closeDatabase command onto the queue and pass the close flag to stop any further execution on the db.
    return this._promiseAsCallback<void>(
      this.persistence,
      this.persistence.closeDatabase,
      Array.prototype.slice.call(arguments),
      true,
      true
    );
  }

  /**
   * Get an array of all the data in the database
   */
  public getAllData(): T[] {
    return this.indexes._id.getAll();
  }

  public forEach(cb: any) {
    return this.indexes._id.forEach(cb);
  }

  /**
   * Reset all currently defined indexes
   */
  public resetIndexes(newData: any) {
    for (const i in this.indexes) {
      this.indexes[i].reset(newData);
    }
  }

  /**
   * Ensure an index is kept for this field. Same parameters as lib/indexes
   * For now this function is synchronous, we need to test how much time it takes
   * We use an async API for consistency with the rest of the code
   * @param {String} options.fieldName
   * @param {Boolean} options.unique
   * @param {Boolean} options.sparse
   * @param {Number} options.expireAfterSeconds - Optional, if set this index becomes a TTL index (only works on Date fields, not arrays of Date)
   * @param {Function} cb Optional callback, signature: err
   * FIXME: promise support
   */
  public ensureIndex(options: IndexOptions, cb?: CallbackOptionalError) {
    let err;
    const callback = cb || function () {};

    if (!options.fieldName) {
      err = new Error('Cannot create an index without a fieldName');
      // @ts-ignore
      err.missingFieldName = true;
      return callback(err);
    }
    if (this.indexes[options.fieldName]) {
      return callback(null);
    }

    this.indexes[options.fieldName] = options.hash ? new HashIndex(options) : new Index(options);
    if (options.expireAfterSeconds !== undefined) {
      this.ttlIndexes[options.fieldName] = options.expireAfterSeconds;
    } // With this implementation index creation is not necessary to ensure TTL but we stick with MongoDB's API here

    try {
      this.indexes[options.fieldName].insertMultipleDocs(this.getAllData());
    } catch (e: any) {
      delete this.indexes[options.fieldName];
      return callback(e);
    }

    // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
    this.persistence.persistNewState([{ $$indexCreated: options }], (err: any) => {
      if (err) {
        return callback(err);
      }
      return callback(null);
    });
  }

  /**
   * Remove an index
   * @param {String} fieldName
   * @param {Function} cb Optional callback, signature: err
   * FIXME: promise support
   */
  public removeIndex(fieldName: string, cb?: CallbackOptionalError) {
    const callback = cb || function () {};

    delete this.indexes[fieldName];

    this.persistence.persistNewState([{ $$indexRemoved: fieldName }], (err: any) => {
      if (err) {
        return callback(err);
      }
      return callback(null);
    });
  }

  /**
   * Add one or several document(s) to all indexes
   */
  private addToIndexes(doc: T) {
    let i;
    let failingIndex;
    let error;
    const keys = Object.keys(this.indexes);
    for (i = 0; i < keys.length; i++) {
      try {
        this.indexes[keys[i]].insert(doc);
      } catch (e) {
        failingIndex = i;
        error = e;
        break;
      }
    }

    // If an error happened, we need to rollback the insert on all other indexes
    if (error) {
      for (i = 0; i < failingIndex; i++) {
        this.indexes[keys[i]].remove(doc);
      }

      throw error;
    }
  }

  /**
   * Remove one or several document(s) from all indexes
   */
  private removeFromIndexes(doc: T) {
    const self = this;

    Object.keys(this.indexes).forEach((i) => {
      self.indexes[i].remove(doc);
    });
  }

  /**
   * Update one or several documents in all indexes
   * To update multiple documents, oldDoc must be an array of { oldDoc, newDoc } pairs
   * If one update violates a constraint, all changes are rolled back
   */
  private updateIndexes(oldDoc: any, newDoc?: any) {
    let i;
    let failingIndex;
    let error;
    const keys = Object.keys(this.indexes);
    const multiple = Array.isArray(oldDoc);
    for (i = 0; i < keys.length; i++) {
      const idx = this.indexes[keys[i]];
      try {
        if (multiple) {
          idx.updateMultipleDocs(oldDoc);
        } else {
          idx.update(oldDoc, newDoc);
        }
      } catch (e) {
        failingIndex = i;
        error = e;
        break;
      }
    }

    // If an error happened, we need to rollback the update on all other indexes
    if (error) {
      for (i = 0; i < failingIndex; i++) {
        this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
      }

      throw error;
    }
  }

  private getIndex(query: FilterQuery<T>) {
    for (const k in query) {
      const q = query[k];
      if (typeof q === 'string' || typeof q === 'number' || typeof q === 'boolean' || q instanceof Date || q === null) {
        const idx = this.indexes[k];
        if (idx) {
          delete query[k];
          return idx.getMatching(q);
        }
      }
    }
    for (const k in query) {
      const q = query[k];
      if (!q) continue;
      if (q.hasOwnProperty('$in')) {
        const idx = this.indexes[k];
        if (idx) {
          delete query[k];
          return idx.getMatching(q.$in);
        }
      }
    }
    for (const k in query) {
      const q = query[k];
      if (!q) continue;
      if (q.hasOwnProperty('$lt') || q.hasOwnProperty('$lte') || q.hasOwnProperty('$gt') || q.hasOwnProperty('$gte')) {
        const idx = this.indexes[k];
        if (idx) {
          delete query[k];
          return idx.getBetweenBounds(q);
        }
      }
    }

    return this.indexes._id;
  }

  /**
   * Return the list of candidates for a given query
   * Crude implementation for now, we return the candidates given by the first usable index if any
   * We try the following query types, in this order: basic match, $in match, comparison match
   * One way to make it better would be to enable the use of multiple indexes if the first usable index
   * returns too much data. I may do it in the future.
   *
   * Returned candidates will be scanned to find and remove all expired documents
   *
   * @param {Query} query
   * @param {Boolean} dontExpireStaleDocs Optional, defaults to false, if true don't remove stale docs. Useful for the remove function which shouldn't be impacted by expirations
   * @param {Function} callback Signature err, candidates
   */
  public getCandidates(query: FilterQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;
  public getCandidates(
    query: FilterQuery<T>,
    dontExpireStaleDocs: boolean,
    callback: CallbackWithResult<Row<T>[]>
  ): void;
  public getCandidates(query: any, dontExpireStaleDocs: any, callback?: any): any {
    if (typeof dontExpireStaleDocs === 'function') {
      callback = dontExpireStaleDocs;
      dontExpireStaleDocs = false;
    }

    if (query.$and) {
      const newQuery: any = {};
      const queryParts = query.$and;
      for (const part of queryParts) {
        const key = Object.keys(part)[0];
        newQuery[key] = part[key];
      }
      query = newQuery;
    }

    // For a basic match
    let docs;
    try {
      docs = this.getIndex(query);
    } catch (err: any) {
      return callback(err);
    }

    if (dontExpireStaleDocs) return callback(null, docs);

    const expiredDocsIds = [];
    const validDocs: any = [];

    for (const doc of docs) {
      let valid = true;
      for (const i in this.ttlIndexes) {
        let d = doc[i];
        // 使用 @nedb/multi 后，Date 类型会被序列化为字符串
        if (typeof d === 'string' || typeof d === 'number') {
          d = new Date(d);
          if (d.toString() === 'Invalid Date') {
            d = doc[i];
          }
        }

        if (d !== undefined && d instanceof Date && Date.now() > d.getTime() + this.ttlIndexes[i] * 1000) {
          valid = false;
        }
      }
      if (valid) {
        validDocs.push(doc);
      } else {
        expiredDocsIds.push(doc._id);
      }
    }

    AsyncEachSeries(
      expiredDocsIds,
      (_id: string, cb: any) => {
        this._remove({ _id }, {}, (err) => {
          if (err) {
            return callback(err);
          }
          return cb();
        });
      },
      () => callback(null, validDocs)
    );
  }

  /**
   * Insert a new document
   * @param {Function} cb Optional callback, signature: err, insertedDoc
   */
  private _insert(newDoc: T, cb?: CallbackWithResult<T>): void;
  private _insert(newDoc: T[], cb?: CallbackWithResult<T>): void;
  private _insert(newDoc: any, cb?: any): void {
    const callback = cb || function () {};
    let preparedDoc: any;

    try {
      preparedDoc = this.prepareDocumentForInsertion(newDoc);
      this._insertInCache(preparedDoc);
    } catch (e: any) {
      return callback(e);
    }

    this.persistence.persistNewState(util.isArray(preparedDoc) ? preparedDoc : [preparedDoc], (err: any) => {
      if (err) {
        return callback(err);
      }
      return callback(null, model.deepCopy(preparedDoc));
    });
  }

  /**
   * Create a new _id that's not already in use
   */
  public createNewId(): string {
    let tentativeId;
    const idIndex = this.indexes._id;
    do {
      tentativeId = customUtils.uid(16);
    } while (idIndex.getMatchingSingle(tentativeId).length);

    return tentativeId;
  }

  /**
   * Prepare a document (or array of documents) to be inserted in a database
   * Meaning adds _id and timestamps if necessary on a copy of newDoc to avoid any side effect on user input
   */
  public prepareDocumentForInsertion(newDoc: T): Row<T>;
  public prepareDocumentForInsertion(newDoc: T[]): Row<T>[];
  public prepareDocumentForInsertion(newDoc: any): any {
    let preparedDoc;

    if (Array.isArray(newDoc)) {
      preparedDoc = [];
      for (const doc of newDoc) {
        preparedDoc.push(this.prepareDocumentForInsertion(doc));
      }
    } else {
      preparedDoc = model.deepCopy(newDoc);
      if (preparedDoc._id === undefined) preparedDoc._id = this.createNewId();
      if (this.timestampData) {
        const now = new Date();
        if (preparedDoc.createdAt === undefined) preparedDoc.createdAt = now;
        if (preparedDoc.updatedAt === undefined) preparedDoc.updatedAt = now;
      }
      model.checkObject(preparedDoc);
    }

    return preparedDoc;
  }

  /**
   * If newDoc is an array of documents, this will insert all documents in the cache
   */
  private _insertInCache(preparedDoc: any) {
    if (util.isArray(preparedDoc)) {
      this._insertMultipleDocsInCache(preparedDoc);
    } else {
      this.addToIndexes(preparedDoc);
    }
  }

  /**
   * If one insertion fails (e.g. because of a unique constraint), roll back all previous
   * inserts and throws the error
   */
  private _insertMultipleDocsInCache(preparedDocs: T[]) {
    let i;
    let failingI;
    let error;

    for (i = 0; i < preparedDocs.length; i++) {
      try {
        this.addToIndexes(preparedDocs[i]);
      } catch (e) {
        error = e;
        failingI = i;
        break;
      }
    }

    if (error) {
      for (i = 0; i < failingI; i++) {
        this.removeFromIndexes(preparedDocs[i]);
      }

      throw error;
    }
  }

  public insert(doc: T): PromiseLike<T>;
  public insert(doc: T[]): PromiseLike<T[]>;
  public insert(doc: T, cb: CallbackWithResult<Row<T>>): void;
  public insert(doc: T[], cb: CallbackWithResult<Row<T>>): void;
  public insert(doc: any, cb?: any): any {
    debug('insert', arguments);
    return this._promiseAsCallback<T>(this, this._insert, Array.prototype.slice.call(arguments));
  }

  /**
   * Return a cursor and support a chained api style
   */
  public cursor(query?: FilterQuery<T>): Cursor<T> {
    const cursor = new Cursor<T>(this, query || {}, (err: any, docs: T[], cb: CallbackWithResult<any>): void => {
      if (err) {
        return cb(err);
      }

      return cb(null, docs);
    });

    return cursor;
  }

  /**
   * Count all documents matching the query
   * @param {Object} query MongoDB-style query
   */
  public count(): PromiseLike<number>;
  public count(query: FilterQuery<T>): PromiseLike<number>;
  public count(query: FilterQuery<T>, callback: CallbackWithResult<number>): void;
  public count(callback: CallbackWithResult<number>): void;
  public count(query?: any, callback?: any) {
    debug('count', arguments);

    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    const args = Array.prototype.slice.call(arguments);
    const userCb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    const cursor = new Cursor<T>(this, query, (err: any, docs: T[], cb: CallbackWithResult<number>): void => {
      if (err) {
        return cb(err);
      }

      return cb(null, docs.length);
    });

    return this._cursorAsCallback<T, number>(cursor, Array.prototype.slice.call(arguments));
  }

  /**
   * Find all documents matching the query
   * If no callback is passed, we return the cursor so that user can limit, skip and finally exec
   * @param {Object} query MongoDB-style query
   * @param {Object} projection MongoDB-style projection
   */
  public find(): PromiseLike<Row<T>[]>;
  public find(query: FilterQuery<T>): PromiseLike<Row<T>[]>;
  public find(query: FilterQuery<T>, projection: ProjectionQuery<T>): PromiseLike<Row<T>[]>;
  public find(callback: CallbackWithResult<Row<T>[]>): void;
  public find(query: FilterQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;
  public find(query: FilterQuery<T>, projection: ProjectionQuery<T>, callback: CallbackWithResult<Row<T>[]>): void;
  public find(query?: any, projection?: any, callback?: any): any {
    debug('find', arguments);
    switch (arguments.length) {
      case 0:
        query = {};
        projection = {};
        break;
      case 1:
        projection = {};
        break;
      case 2:
        if (typeof projection === 'function') {
          // @ts-ignore
          callback = projection;
          projection = {};
        } // If not assume projection is an object and callback undefined
        break;
    }

    const cursor = new Cursor<T>(this, query, (err: any, docs: T[], cb: CallbackWithResult<Row<T>[]>) => {
      const res = [];
      let i;

      if (err) {
        return cb(err);
      }

      for (i = 0; i < docs.length; i++) {
        res.push(model.deepCopy(docs[i]));
      }

      return cb(null, res);
    });

    cursor.projection(projection as ProjectionQuery<T>);

    return this._cursorAsCallback<T, Row<T>[]>(cursor, Array.prototype.slice.call(arguments));
  }

  /**
   * Find one document matching the query
   * @param {Object} query MongoDB-style query
   * @param {Object} projection MongoDB-style projection
   */
  public findOne(query: FilterQuery<T>): PromiseLike<Row<T>>;
  public findOne(query: FilterQuery<T>, projection?: ProjectionQuery<T>): PromiseLike<Row<T>>;
  public findOne(query: FilterQuery<T>, callback?: CallbackWithResult<Row<T>>): void;
  public findOne(query: FilterQuery<T>, projection: ProjectionQuery<T>, callback: CallbackWithResult<Row<T>>): void;
  public findOne(query: FilterQuery<T>, projection?: any, callback?: any): any {
    debug('findOne', arguments);
    switch (arguments.length) {
      case 1:
        projection = {};
        // callback is undefined, will return a cursor
        break;
      case 2:
        if (typeof projection === 'function') {
          // @ts-ignore
          callback = projection;
          projection = {};
        } // If not assume projection is an object and callback undefined
        break;
    }

    const cursor = new Cursor<T>(this, query, (err: any, docs: T[], cb: CallbackWithResult<T>) => {
      if (err) {
        return cb(err);
      }

      if (docs.length === 1) {
        return cb(null, model.deepCopy(docs[0]));
      }

      return cb(null, null);
    });

    cursor.projection(projection as ProjectionQuery<T>);
    cursor.limit(1);

    return this._cursorAsCallback<T, T>(cursor, Array.prototype.slice.call(arguments));
  }

  /**
   * Update all docs matching query
   * @param {Object} query
   * @param {Object} updateQuery
   * @param {Object} options Optional options
   *                 options.multi If true, can update multiple documents (defaults to false)
   *                 options.upsert If true, document is inserted if the query doesn't match anything
   *                 options.returnUpdatedDocs Defaults to false, if true return as third argument the array of updated matched documents (even if no change actually took place)
   * @param {Function} cb Optional callback, signature: (err, numAffected, affectedDocuments, upsert)
   *                      If update was an upsert, upsert flag is set to true
   *                      affectedDocuments can be one of the following:
   *                        * For an upsert, the upserted document
   *                        * For an update with returnUpdatedDocs option false, null
   *                        * For an update with returnUpdatedDocs true and multi false, the updated document
   *                        * For an update with returnUpdatedDocs true and multi true, the array of updated documents
   *
   * WARNING: The API was changed between v1.7.4 and v1.8, for consistency and readability reasons. Prior and including to v1.7.4,
   *          the callback signature was (err, numAffected, updated) where updated was the updated document in case of an upsert
   *          or the array of updated documents for an update if the returnUpdatedDocs option was true. That meant that the type of
   *          affectedDocuments in a non multi update depended on whether there was an upsert or not, leaving only two ways for the
   *          user to check whether an upsert had occured: checking the type of affectedDocuments or running another find query on
   *          the whole dataset to check its size. Both options being ugly, the breaking change was necessary.
   */
  private _update(
    query: FilterQuery<T>,
    updateQuery: UpdateQuery<T>,
    options?: UpdateOptions | CallbackWithResult<any>,
    cb?: CallbackWithResult<any>
  ): void {
    debug('_update', { query, updateQuery, options });

    const self = this;
    let numReplaced = 0;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    if (!options) options = {};

    const callback = cb || function () {};
    const multi: boolean = options.multi !== undefined ? options.multi : false;
    const upsert: boolean = options.upsert !== undefined ? options.upsert : false;

    AsyncWaterfall([
      function (cb: any) {
        // If upsert option is set, check whether we need to insert the doc
        if (!upsert) {
          // @ts-ignore
          delete updateQuery.$setOnInsert;
          return cb();
        }

        // Need to use an internal function not tied to the executor to avoid deadlock
        const upsertQuery = Object.assign({}, query);
        const cursor = new Cursor<T>(self, upsertQuery);
        // @ts-ignore
        cursor.limit(1)._exec((err: any, docs: any) => {
          if (err) {
            return callback(err);
          }
          if (docs.length === 1) {
            return cb();
          }
          let toBeInserted;

          try {
            model.checkObject(updateQuery);
            // updateQuery is a simple object with no modifier, use it as the document to insert
            toBeInserted = updateQuery;
          } catch (e) {
            // updateQuery contains modifiers, use the find query as the base,
            // strip it from all operators and update it according to updateQuery
            try {
              // @ts-ignore
              const mergedUpsertQuery = Object.assign(upsertQuery, updateQuery.$setOnInsert || {});
              // @ts-ignore
              if (updateQuery.$setOnInsert) {
                // @ts-ignore
                delete updateQuery.$setOnInsert;
              }

              toBeInserted = model.modify(model.deepCopyStrictKeys(mergedUpsertQuery), updateQuery);
            } catch (err: any) {
              return callback(err);
            }
          }

          return self._insert(toBeInserted, (err, newDoc) => {
            if (err) {
              return callback(err);
            }
            // @ts-ignore
            return callback(null, 1, newDoc, true);
          });
        });
      },
      function () {
        // Perform the update
        let modifiedDoc;
        const modifications: any = [];
        let updatedDocs: any = [];
        let createdAt: string;

        self.getCandidates(query, (err, candidates) => {
          if (err) {
            return callback(err);
          }

          // Preparing update (if an error is thrown here neither the datafile nor
          // the in-memory indexes are affected)
          try {
            const match = model.prepare(query);
            for (const doc of candidates) {
              if (!match(doc) || !(multi || numReplaced === 0)) continue;
              numReplaced += 1;
              if (self.timestampData) {
                createdAt = doc.createdAt;
              }
              modifiedDoc = model.modify(doc, updateQuery);
              if (self.timestampData) {
                modifiedDoc.createdAt = createdAt;
                modifiedDoc.updatedAt = new Date();
              }
              modifications.push({ oldDoc: doc, newDoc: modifiedDoc });
              updatedDocs.push(modifiedDoc);
            }
          } catch (err: any) {
            return callback(err);
          }

          // Change the docs in memory
          try {
            self.updateIndexes(modifications);
          } catch (err: any) {
            return callback(err);
          }

          // Update the datafile
          self.persistence.persistNewState(updatedDocs, (err: any) => {
            if (err) {
              return callback(err);
            }
            // @ts-ignore
            if (!options.returnUpdatedDocs) {
              return callback(null, numReplaced);
            }
            for (let i = 0; i < updatedDocs.length; i++) {
              updatedDocs[i] = model.deepCopy(updatedDocs[i]);
            }
            if (!multi) {
              updatedDocs = updatedDocs[0];
            }
            // @ts-ignore
            return callback(null, numReplaced, updatedDocs);
          });
        });
      },
    ]);
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
  public update() {
    debug('update', arguments);
    return this._promiseAsCallback<UpdateResult<T>>(this, this._update, Array.prototype.slice.call(arguments));
  }

  /**
   * Remove all docs matching the query
   * For now very naive implementation (similar to update)
   * @param {Object} query
   * @param {Object} options Optional options
   *                 options.multi If true, can remove multiple documents (defaults to false)
   * @param {Function} cb Optional callback, signature: err, numRemoved
   */
  private _remove(
    query: FilterQuery<T>,
    options?: RemoveOptions | CallbackWithResult<number>,
    cb?: CallbackWithResult<number>
  ) {
    debug('_remove', arguments);
    const self = this;
    let numRemoved: number = 0;
    const removedDocs: any = [];

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    if (!options) options = {};
    const callback = cb || function () {};
    const multi = options.multi !== undefined ? options.multi : false;

    this.getCandidates(query, true, (err: any, candidates) => {
      if (err) {
        return callback(err);
      }

      try {
        const match = model.prepare(query);
        for (const doc of candidates) {
          if (!match(doc) || !(multi || numRemoved === 0)) continue;
          numRemoved += 1;
          removedDocs.push({ $$deleted: true, _id: doc._id });
          self.removeFromIndexes(doc);
        }
      } catch (err: any) {
        return callback(err);
      }

      self.persistence.persistNewState(removedDocs, (err: any) => {
        if (err) {
          return callback(err);
        }
        return callback(null, numRemoved);
      });
    });
  }

  public remove(query: FilterQuery<T>): PromiseLike<number>;
  public remove(query: FilterQuery<T>, options: RemoveOptions): PromiseLike<number>;
  public remove(query: FilterQuery<T>, cb: CallbackWithResult<number>): void;
  public remove(query: FilterQuery<T>, options: RemoveOptions, cb: CallbackWithResult<number>): void;
  public remove() {
    debug('remove', arguments);
    return this._promiseAsCallback<number>(this, this._remove, Array.prototype.slice.call(arguments));
  }

  /**
   * Supports both promise and callback functions for a public API
   *
   * @private
   * @template T
   * @param {object} context
   * @param {Function} fn
   * @param {any[]} args
   * @return {*}  {PromiseLike<T>}
   * @memberof Datastore
   */
  private _promiseAsCallback<T>(
    context: any,
    fn: Function,
    args: any[],
    forceQueuing?: boolean,
    close?: boolean
  ): PromiseLike<T> {
    const userCb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    const promise = new Promise<T>((resolve, reject) => {
      const internalCb = (err: NativeError, ...rest: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rest.length > 1 ? rest : rest[0]);
        }
      };
      if (userCb) {
        args[args.length - 1] = internalCb;
      } else {
        args.push(internalCb);
      }

      this.executor.push({ this: context, fn, arguments: args }, forceQueuing, close);
    });

    return asCallback(promise, userCb);
  }

  private _cursorAsCallback<TRow, TResult>(cursor: Cursor<TRow>, args: any[]) {
    const userCb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    const promise = new Promise<TResult>((resolve, reject) => {
      cursor.exec((err: NativeError, docs: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs);
        }
      });
    });

    return asCallback(promise, userCb);
  }
}
