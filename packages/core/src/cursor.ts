/* eslint-disable no-continue */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/lines-between-class-members */

import asCallback from 'standard-as-callback';

import { CallbackWithResult, FilterQuery, ProjectionQuery, SortQuery, Row } from './types';

// eslint-disable-next-line global-require
const debug = require('debug')(`${require('../package.json').name}:cursor`);

/**
 * Manage access to data, be it to find, update or remove it
 */
const model = require('./model');

export class Cursor<T> {
  private db: any;
  private execFn: Function;

  private _query: FilterQuery<T>;
  private _sort: SortQuery<T>;
  private _projection: ProjectionQuery<T>;
  private _limit: number;
  private _skip: number;

  /**
   * Create a new cursor for this collection
   * @param {DataStore} db - The datastore this cursor is bound to
   * @param {Query} query - The query this cursor will operate on
   * @param {Function} execFn - Handler to be executed after cursor has found the results and before the callback passed to find/findOne/update/remove
   */
  constructor(db: any, query: FilterQuery<T>, execFn?: Function) {
    this.db = db;
    this._query = query || {};
    if (execFn) {
      this.execFn = execFn;
    }
  }

  /**
   * Set a query to filter results
   */
  public query(query: FilterQuery<T>): Cursor<T> {
    this._query = query;
    return this;
  }

  /**
   * Set a limit to the number of results
   */
  public limit(limit: number): Cursor<T> {
    this._limit = limit;
    return this;
  }

  /**
   * Skip a the number of results
   */
  public skip(skip: number): Cursor<T> {
    this._skip = skip;
    return this;
  }

  /**
   * Sort results of the query
   * @param {SortQuery} sortQuery - SortQuery is { field: order }, field can use the dot-notation, order is 1 for ascending and -1 for descending
   */
  public sort(sortQuery: SortQuery<T>): Cursor<T> {
    this._sort = sortQuery;
    return this;
  }

  /**
   * Add the use of a projection
   * @param {Object} projection - MongoDB-style projection. {} means take all fields. Then it's { key1: 1, key2: 1 } to take only key1 and key2
   *                              { key1: 0, key2: 0 } to omit only key1 and key2. Except _id, you can't mix takes and omits
   */
  public projection(projection: ProjectionQuery<T>): Cursor<T> {
    this._projection = projection;
    return this;
  }

  /**
   * Apply the projection
   */
  private _project(candidates: Row<T>[]): Row<T>[] {
    const res: Row<T>[] = [];
    const self = this;
    let keepId: any;
    let action: any;
    let keys: any;

    if (this._projection === undefined || Object.keys(this._projection).length === 0) {
      return candidates;
    }

    // eslint-disable-next-line prefer-const
    keepId = this._projection._id !== 0;
    delete this._projection._id;

    // Check for consistency
    // eslint-disable-next-line prefer-const
    keys = Object.keys(this._projection);
    keys.forEach((k: string) => {
      if (action !== undefined && self._projection[k] !== action) {
        // eslint-disable-next-line quotes
        throw new Error(`Can't both keep and omit field ${k} except for _id`);
      }
      action = self._projection[k];
    });

    // Do the actual projection
    candidates.forEach((candidate) => {
      let toPush: any;
      if (action === 1) {
        // pick-type projection
        toPush = { $set: {} };
        keys.forEach((k: string) => {
          toPush.$set[k] = model.getDotValue(candidate, k);
          if (toPush.$set[k] === undefined) {
            delete toPush.$set[k];
          }
        });
        toPush = model.modify({}, toPush);
      } else {
        // omit-type projection
        toPush = { $unset: {} };
        keys.forEach((k: string) => {
          toPush.$unset[k] = true;
        });
        toPush = model.modify(candidate, toPush);
      }
      if (keepId) {
        // @ts-ignore
        toPush._id = candidate._id;
      } else {
        delete toPush._id;
      }
      res.push(toPush);
    });

    return res;
  }

  /**
   * Get all matching elements
   * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
   * This is an internal function, use exec which uses the executor
   *
   * @param {Function} callback - Signature: err, results
   */
  private _exec(_callback: CallbackWithResult<Row<T>[]>) {
    let res: Row<T>[] = [];
    let added = 0;
    let skipped = 0;

    const callback = (err: any, r?: any) => {
      if (this.execFn) {
        return this.execFn(err, r, _callback);
      }
      return _callback(err, r);
    };

    const query = Object.assign({}, this._query);
    debug('exec.params', {
      query,
      skip: this._skip,
      limit: this._limit,
      sort: this._sort,
      projection: this._projection,
    });

    this.db.getCandidates(query, (err: any, candidates: T[]) => {
      if (err) {
        return callback(err);
      }

      try {
        const match = model.prepare(query);
        for (const doc of candidates) {
          if (!match(doc)) continue;
          // If a sort is defined, wait for the results to be sorted before applying limit and skip
          if (!this._sort) {
            if (this._skip && this._skip > skipped) {
              skipped++;
            } else {
              res.push(doc);
              added++;
              if (this._limit && this._limit <= added) break;
            }
          } else {
            res.push(doc);
          }
        }
      } catch (e) {
        return callback(e);
      }

      // Apply all sorts
      if (this._sort) {
        const keys = Object.keys(this._sort);

        // Sorting
        const criteria: any[] = [];
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          // @ts-ignore
          criteria.push({ key, direction: this._sort[key] });
        }

        res.sort((a, b) => {
          let criterion;
          let compare;
          for (let i = 0; i < criteria.length; i++) {
            criterion = criteria[i];
            compare =
              criterion.direction *
              model.compareThings(
                model.getDotValue(a, criterion.key),
                model.getDotValue(b, criterion.key),
                this.db.compareStrings
              );
            if (compare !== 0) {
              return compare;
            }
          }
          return 0;
        });

        // Applying limit and skip
        const limit = this._limit || res.length;
        const skip = this._skip || 0;

        res = res.slice(skip, skip + limit);
      }

      // Apply projection
      try {
        res = this._project(res);
        debug('exec.result', res);
        return callback(null, res);
      } catch (e) {
        return callback(e);
      }
    });
  }

  public exec(cb?: CallbackWithResult<Row<T>[]>): PromiseLike<Row<T>[]> {
    return this._promiseAsCallback<Row<T>[]>(this, this._exec, Array.prototype.slice.call(arguments));
  }

  private _promiseAsCallback<T>(context: any, fn: Function, args: any[]): PromiseLike<T> {
    const userCb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    const promise = new Promise<T>((resolve, reject) => {
      const internalCb = (err: any, docs: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs);
        }
      };
      if (userCb || (typeof args[args.length - 1] !== 'undefined' && !args[args.length - 1])) {
        args[args.length - 1] = internalCb;
      } else {
        args.push(internalCb);
      }

      this.db.executor.push({ this: context, fn, arguments: args });
    });

    return asCallback(promise, userCb);
  }
}
