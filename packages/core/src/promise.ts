import { Datastore } from './datastore';
import { IndexOptions, FilterQuery, ProjectionFields, AnyArray, UpdateOptions, RemoveOptions } from './types';

const Cursor = require('./cursor');

export class PromisedDatastore<T> extends Datastore<T> {
  count(query: FilterQuery<T>): PromiseLike<number> {
    return new Promise((resolve, reject) => {
      super.count(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  countWithCursor(query: FilterQuery<T>): typeof Cursor {
    return super.count(query);
  }

  find(query: FilterQuery<T>, projection?: ProjectionFields<T>): PromiseLike<AnyArray<T>> {
    return new Promise((resolve, reject) => {
      super.find(query, projection, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  findWithCursor(query: FilterQuery<T>, projection?: ProjectionFields<T>): typeof Cursor {
    return super.find(query, projection);
  }

  findOne(query: FilterQuery<T>, projection?: ProjectionFields<T>): PromiseLike<T> {
    return new Promise((resolve, reject) => {
      super.findOne(query, projection, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  findOneWithCursor(query: FilterQuery<T>, projection?: ProjectionFields<T>): typeof Cursor {
    return super.findOne(query, projection);
  }

  insert(doc: T | T[]): PromiseLike<T> {
    return new Promise((resolve, reject) => {
      super.insert(doc, (err, ...rest) => {
        if (err) {
          reject(err);
        } else {
          resolve(...rest);
        }
      });
    });
  }

  remove(query: FilterQuery<T>, options?: RemoveOptions): PromiseLike<number> {
    return new Promise((resolve, reject) => {
      super.remove(query, options, (err, ...rest) => {
        if (err) {
          reject(err);
        } else {
          resolve(...rest);
        }
      });
    });
  }

  update(query: FilterQuery<T>, updateQuery: T, options?: UpdateOptions): PromiseLike<any> {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      super.update(query, updateQuery, options, (err, rowsAffected, updatedDocs) => {
        if (err) {
          reject(err);
        } else {
          updatedDocs ? resolve([rowsAffected, updatedDocs]) : resolve(rowsAffected);
        }
      });
    });
  }

  ensureIndex(options: IndexOptions): PromiseLike<void> {
    return new Promise((resolve, reject) => {
      super.ensureIndex(options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  removeIndex(fieldName: string): PromiseLike<void> {
    return new Promise((resolve, reject) => {
      super.removeIndex(fieldName, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  getCandidates(query: FilterQuery<T>, dontExpireStaleDocs?: boolean): PromiseLike<any> {
    return new Promise((resolve, reject) => {
      super.getCandidates(query, dontExpireStaleDocs, (err, ...rest) => {
        if (err) {
          reject(err);
        } else {
          resolve(...rest);
        }
      });
    });
  }

  loadDatabase(): PromiseLike<void> {
    return new Promise((resolve, reject) => {
      super.loadDatabase((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  closeDatabase(): PromiseLike<void> {
    return new Promise((resolve, reject) => {
      super.closeDatabase((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
