/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable prefer-rest-params */
/* eslint-disable prefer-destructuring */
/* eslint-disable consistent-return */
/* eslint-disable indent */
/* eslint-disable no-param-reassign */
/* eslint-disable default-case */
/* eslint-disable no-underscore-dangle */
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
const Cursor = require('./cursor');
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
function Datastore(options) {
  let filename;

  // Retrocompatibility with v0.6 and before
  if (typeof options === 'string') {
    filename = options;
    this.inMemoryOnly = false; // Default
  } else {
    options = options || {};
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

util.inherits(Datastore, require('events').EventEmitter);

/**
 * Load the database from the datafile, and trigger the execution of buffered commands if any
 */
Datastore.prototype.loadDatabase = function () {
  this.executor.push({ this: this.persistence, fn: this.persistence.loadDatabase, arguments }, true);
};

/**
 * Close the database and its underlying datafile.
 */
Datastore.prototype.closeDatabase = function () {
  // Push the closeDatabase command onto the queue and pass the close flag to stop any further execution on the db.
  this.executor.push({ this: this.persistence, fn: this.persistence.closeDatabase, arguments }, true, true);
};

/**
 * Get an array of all the data in the database
 */
Datastore.prototype.getAllData = function () {
  return this.indexes._id.getAll();
};

Datastore.prototype.forEach = function (cb) {
  return this.indexes._id.forEach(cb);
};

/**
 * Reset all currently defined indexes
 */
Datastore.prototype.resetIndexes = function (newData) {
  for (const i in this.indexes) {
    this.indexes[i].reset(newData);
  }
};

/**
 * Ensure an index is kept for this field. Same parameters as lib/indexes
 * For now this function is synchronous, we need to test how much time it takes
 * We use an async API for consistency with the rest of the code
 * @param {String} options.fieldName
 * @param {Boolean} options.unique
 * @param {Boolean} options.sparse
 * @param {Number} options.expireAfterSeconds - Optional, if set this index becomes a TTL index (only works on Date fields, not arrays of Date)
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.ensureIndex = function (options, cb) {
  // Add compatibility with Mongoose which calls ensureIndex with 3 arguments.
  if (arguments.length === 3) {
    const args = Array.prototype.slice.call(arguments, 0);
    cb = args[2];
    options = args[1];
    const indexFields = args[0];
    for (const i in indexFields) options.fieldName = i;
  }

  let err;
  const callback = cb || function () {};

  options = options || {};

  if (!options.fieldName) {
    err = new Error('Cannot create an index without a fieldName');
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
  } catch (e) {
    delete this.indexes[options.fieldName];
    return callback(e);
  }

  // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
  this.persistence.persistNewState([{ $$indexCreated: options }], (err) => {
    if (err) {
      return callback(err);
    }
    return callback(null);
  });
};

/**
 * Remove an index
 * @param {String} fieldName
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.removeIndex = function (fieldName, cb) {
  const callback = cb || function () {};

  delete this.indexes[fieldName];

  this.persistence.persistNewState([{ $$indexRemoved: fieldName }], (err) => {
    if (err) {
      return callback(err);
    }
    return callback(null);
  });
};

/**
 * Add one or several document(s) to all indexes
 */
Datastore.prototype.addToIndexes = function (doc) {
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
};

/**
 * Remove one or several document(s) from all indexes
 */
Datastore.prototype.removeFromIndexes = function (doc) {
  const self = this;

  Object.keys(this.indexes).forEach((i) => {
    self.indexes[i].remove(doc);
  });
};

/**
 * Update one or several documents in all indexes
 * To update multiple documents, oldDoc must be an array of { oldDoc, newDoc } pairs
 * If one update violates a constraint, all changes are rolled back
 */
Datastore.prototype.updateIndexes = function (oldDoc, newDoc) {
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
};

Datastore.prototype.getIndex = function (query) {
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
};

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
Datastore.prototype.getCandidates = function (query, dontExpireStaleDocs, callback) {
  if (typeof dontExpireStaleDocs === 'function') {
    callback = dontExpireStaleDocs;
    dontExpireStaleDocs = false;
  }

  if (query.$and) {
    const newQuery = {};
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
  } catch (ex) {
    return callback(ex);
  }

  if (dontExpireStaleDocs) return callback(null, docs);

  const expiredDocsIds = [];
  const validDocs = [];

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
    (_id, cb) => {
      this._remove({ _id }, {}, (err) => {
        if (err) {
          return callback(err);
        }
        return cb();
      });
    },
    (err) => callback(null, validDocs)
  );
};

/**
 * Insert a new document
 * @param {Function} cb Optional callback, signature: err, insertedDoc
 *
 * @api private Use Datastore.insert which has the same signature
 */
Datastore.prototype._insert = function (newDoc, cb) {
  const callback = cb || function () {};
  let preparedDoc;

  try {
    preparedDoc = this.prepareDocumentForInsertion(newDoc);
    this._insertInCache(preparedDoc);
  } catch (e) {
    return callback(e);
  }

  this.persistence.persistNewState(util.isArray(preparedDoc) ? preparedDoc : [preparedDoc], (err) => {
    if (err) {
      return callback(err);
    }
    return callback(null, model.deepCopy(preparedDoc));
  });
};

/**
 * Create a new _id that's not already in use
 */
Datastore.prototype.createNewId = function () {
  let tentativeId;
  const idIndex = this.indexes._id;
  do {
    tentativeId = customUtils.uid(16);
  } while (idIndex.getMatchingSingle(tentativeId).length);

  return tentativeId;
};

/**
 * Prepare a document (or array of documents) to be inserted in a database
 * Meaning adds _id and timestamps if necessary on a copy of newDoc to avoid any side effect on user input
 * @api private
 */
Datastore.prototype.prepareDocumentForInsertion = function (newDoc) {
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
};

/**
 * If newDoc is an array of documents, this will insert all documents in the cache
 * @api private
 */
Datastore.prototype._insertInCache = function (preparedDoc) {
  if (util.isArray(preparedDoc)) {
    this._insertMultipleDocsInCache(preparedDoc);
  } else {
    this.addToIndexes(preparedDoc);
  }
};

/**
 * If one insertion fails (e.g. because of a unique constraint), roll back all previous
 * inserts and throws the error
 * @api private
 */
Datastore.prototype._insertMultipleDocsInCache = function (preparedDocs) {
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
};

Datastore.prototype.insert = function (doc, safe, cb) {
  debug('insert', arguments);
  customUtils.convertObjectIdToString(doc);
  const args = customUtils.isMongoose() ? [doc, cb || safe] : [doc, safe];
  this.executor.push({ this: this, fn: this._insert, arguments: args });
};

/**
 * Count all documents matching the query
 * @param {Object} query MongoDB-style query
 */
Datastore.prototype.count = function (query, callback, __mongooseCallback) {
  debug('count', arguments);

  // mongoose maybe call this method with 3 parameters
  if (arguments.length === 3) {
    callback = __mongooseCallback;
  }

  if (typeof query === 'function') {
    callback = query;
    query = {};
  }

  const cursor = new Cursor(this, query, (err, docs, cb) => {
    if (err) {
      return cb(err);
    }

    return cb(null, docs.length);
  });

  if (typeof callback === 'function') {
    cursor.exec(callback);
  } else {
    return cursor;
  }
};

/**
 * Find all documents matching the query
 * If no callback is passed, we return the cursor so that user can limit, skip and finally exec
 * @param {Object} query MongoDB-style query
 * @param {Object} projection MongoDB-style projection
 */
Datastore.prototype.find = function (query, projection, callback) {
  debug('find', arguments);
  switch (arguments.length) {
    case 1:
      projection = {};
      // callback is undefined, will return a cursor
      break;
    case 2:
      if (typeof projection === 'function') {
        callback = projection;
        projection = {};
      } // If not assume projection is an object and callback undefined
      break;
  }

  const cursor = new Cursor(this, query, function (err, docs, cb) {
    const res = [];
    let i;

    if (err) {
      return cb(err);
    }

    for (i = 0; i < docs.length; i++) {
      res.push(model.deepCopy(docs[i]));
    }

    if (customUtils.isMongoose() && typeof callback === 'function') {
      this.res = res;
      return cb(null, this);
    }

    return cb(null, res);
  });

  customUtils.adaptToMongoose(cursor, projection);

  if (typeof callback === 'function') {
    cursor.exec(callback);
  } else {
    return cursor;
  }
};

/**
 * Find one document matching the query
 * @param {Object} query MongoDB-style query
 * @param {Object} projection MongoDB-style projection
 */
Datastore.prototype.findOne = function (query, projection, callback) {
  debug('findOne', arguments);
  switch (arguments.length) {
    case 1:
      projection = {};
      // callback is undefined, will return a cursor
      break;
    case 2:
      if (typeof projection === 'function') {
        callback = projection;
        projection = {};
      } // If not assume projection is an object and callback undefined
      break;
  }

  const cursor = new Cursor(this, query, (err, docs, cb) => {
    if (err) {
      return cb(err);
    }

    if (docs.length === 1) {
      return cb(null, model.deepCopy(docs[0]));
    }

    return cb(null, null);
  });

  customUtils.adaptToMongoose(cursor, projection);
  cursor.limit(1);

  if (typeof callback === 'function') {
    cursor.exec(callback);
  } else {
    return cursor;
  }
};

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
 *
 * @api private Use Datastore.update which has the same signature
 */
Datastore.prototype._update = function (query, updateQuery, options, cb) {
  customUtils.convertObjectIdToString(query);
  customUtils.convertObjectIdToString(updateQuery);

  debug('_update', { query, updateQuery, options });

  let callback;
  const self = this;
  let numReplaced = 0;
  let multi;
  let upsert;

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  if (!options) options = {};

  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;
  upsert = options.upsert !== undefined ? options.upsert : false;

  AsyncWaterfall([
    function (cb) {
      // If upsert option is set, check whether we need to insert the doc
      if (!upsert) {
        delete updateQuery.$setOnInsert;
        return cb();
      }

      // Need to use an internal function not tied to the executor to avoid deadlock
      const upsertQuery = Object.assign({}, query);
      const cursor = new Cursor(self, upsertQuery);
      cursor.limit(1)._exec((err, docs) => {
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
            const mergedUpsertQuery = Object.assign(upsertQuery, updateQuery.$setOnInsert || {});
            if (updateQuery.$setOnInsert) {
              delete updateQuery.$setOnInsert;
            }

            toBeInserted = model.modify(model.deepCopyStrictKeys(mergedUpsertQuery), updateQuery);
          } catch (err) {
            return callback(err);
          }
        }

        return self._insert(toBeInserted, (err, newDoc) => {
          if (err) {
            return callback(err);
          }
          return callback(null, 1, newDoc, true);
        });
      });
    },
    function () {
      // Perform the update
      let modifiedDoc;
      const modifications = [];
      let updatedDocs = [];
      let createdAt;

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
        } catch (err) {
          return callback(err);
        }

        // Change the docs in memory
        try {
          self.updateIndexes(modifications);
        } catch (err) {
          return callback(err);
        }

        // Update the datafile
        self.persistence.persistNewState(updatedDocs, (err) => {
          if (err) {
            return callback(err);
          }
          if (!options.returnUpdatedDocs) {
            return callback(null, numReplaced);
          }
          for (let i = 0; i < updatedDocs.length; i++) {
            updatedDocs[i] = model.deepCopy(updatedDocs[i]);
          }
          if (!multi) {
            updatedDocs = updatedDocs[0];
          }
          return callback(null, numReplaced, updatedDocs);
        });
      });
    },
  ]);
};

Datastore.prototype.update = function () {
  debug('update', arguments);
  this.executor.push({ this: this, fn: this._update, arguments });
};

/**
 * Remove all docs matching the query
 * For now very naive implementation (similar to update)
 * @param {Object} query
 * @param {Object} options Optional options
 *                 options.multi If true, can update multiple documents (defaults to false)
 * @param {Function} cb Optional callback, signature: err, numRemoved
 *
 * @api private Use Datastore.remove which has the same signature
 */
Datastore.prototype._remove = function (query, options, cb) {
  debug('_remove', arguments);
  let callback;
  const self = this;
  let numRemoved = 0;
  const removedDocs = [];
  let multi;

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;

  this.getCandidates(query, true, (err, candidates) => {
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
    } catch (err) {
      return callback(err);
    }

    self.persistence.persistNewState(removedDocs, (err) => {
      if (err) {
        return callback(err);
      }
      return callback(null, numRemoved);
    });
  });
};

Datastore.prototype.remove = function () {
  debug('remove', arguments);
  this.executor.push({ this: this, fn: this._remove, arguments });
};

module.exports = Datastore;
