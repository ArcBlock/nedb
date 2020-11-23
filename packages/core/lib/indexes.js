/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
/* eslint-disable func-names */
const BinarySearchTree = require('@nedb/binary-search-tree').AVLTree;
const util = require('util');
const model = require('./model');
/**
 * Two indexed pointers are equal iif they point to the same place
 */
function checkValueEquality(a, b) {
  return a === b;
}

/**
 * Type-aware projection
 */
function projectForUnique(elt) {
  if (elt === null) {
    return '$n';
  }
  if (typeof elt === 'string') {
    return `$s${elt}`;
  }
  if (typeof elt === 'boolean') {
    return `$b${elt}`;
  }
  if (typeof elt === 'number') {
    return elt;
  }
  if (util.isArray(elt)) {
    return `$d${elt.getTime()}`;
  }

  return elt; // Arrays and objects, will check for pointer equality
}

/**
 * Create a new index
 * All methods on an index guarantee that either the whole operation was successful and the index changed
 * or the operation was unsuccessful and an error is thrown while the index is unchanged
 * @param {String} options.fieldName On which field should the index apply (can use dot notation to index on sub fields)
 * @param {Boolean} options.unique Optional, enforce a unique constraint (default: false)
 * @param {Boolean} options.sparse Optional, allow a sparse index (we can have documents for which fieldName is undefined) (default: false)
 */
function Index(options) {
  this.fieldName = options.fieldName;
  this.unique = options.unique || false;
  this.sparse = options.sparse || false;

  this.treeOptions = {
    unique: this.unique,
    vkUnique: true,
    compareKeys: model.compareThings,
    checkValueEquality,
  };
  this._extractKey = model.getDotFn(this.fieldName);
  this.keyFn = this.unique === 'strict' ? projectForUnique : (r) => r;
  this.reset(); // No data in the beginning
}

/**
 * Reset an index
 * @param {Document or Array of documents} newData Optional, data to initialize the index with
 *                                                 If an error is thrown during insertion, the index is not modified
 */
Index.prototype.reset = function (newData) {
  this.tree = new BinarySearchTree(this.treeOptions);

  if (newData) {
    if (Array.isArray(newData)) {
      this.insertMultipleDocs(newData);
    } else this.insert(newData);
  }
};

/**
 * Insert a new document in the index
 * If an array is passed, we insert all its elements (if one insertion fails the index is not modified)
 * O(log(n))
 */
Index.prototype.insert = function (doc) {
  const key = this._extractKey(doc);

  // We don't index documents that don't contain the field if the index is sparse
  if (key === undefined && this.sparse) {
    return;
  }

  if (!Array.isArray(key)) {
    this.tree.insert(this.keyFn(key), doc);
    return;
  }

  // If an insert fails due to a unique constraint, roll back all inserts before it
  let failingI;
  let error;

  for (let i = 0; i < key.length; i++) {
    try {
      this.tree.insert(this.keyFn(key[i]), doc);
    } catch (e) {
      error = e;
      failingI = i;
      break;
    }
  }

  if (error) {
    for (let i = 0; i < failingI; i++) {
      this.tree.delete(this.keyFn(key[i]), doc);
    }

    throw error;
  }
};

/**
 * Insert an array of documents in the index
 * If a constraint is violated, the changes should be rolled back and an error thrown
 *
 * @API private
 */
Index.prototype.insertMultipleDocs = function (docs) {
  let i;
  let error;
  let failingI;

  for (i = 0; i < docs.length; i++) {
    try {
      this.insert(docs[i]);
    } catch (e) {
      error = e;
      failingI = i;
      break;
    }
  }

  if (error) {
    for (i = 0; i < failingI; i++) {
      this.remove(docs[i]);
    }

    throw error;
  }
};

/**
 * Remove a document from the index
 * If an array is passed, we remove all its elements
 * The remove operation is safe with regards to the 'unique' constraint
 * O(log(n))
 */
Index.prototype.remove = function (doc) {
  const self = this;

  if (Array.isArray(doc)) {
    doc.forEach((d) => {
      self.remove(d);
    });
    return;
  }

  const key = this.keyFn(this._extractKey(doc));

  if (key === undefined && this.sparse) {
    return;
  }

  if (!Array.isArray(key)) {
    this.tree.delete(key, doc);
    return;
  }

  // if key contains duplicates may attempt deletion multiple times
  // But BST tree can handle this
  for (const _key of key) {
    this.tree.delete(_key, doc);
  }
};

/**
 * Update a document in the index
 * If a constraint is violated, changes are rolled back and an error thrown
 * Naive implementation, still in O(log(n))
 */
Index.prototype.update = function (oldDoc, newDoc) {
  this.remove(oldDoc);

  try {
    this.insert(newDoc);
  } catch (e) {
    this.insert(oldDoc);
    throw e;
  }
};

/**
 * Update multiple documents in the index
 * If a constraint is violated, the changes need to be rolled back
 * and an error thrown
 * @param {Array of oldDoc, newDoc pairs} pairs
 *
 * @API private
 */
Index.prototype.updateMultipleDocs = function (pairs) {
  let i;
  let failingI;
  let error;

  for (i = 0; i < pairs.length; i++) {
    this.remove(pairs[i].oldDoc);
  }

  for (i = 0; i < pairs.length; i++) {
    try {
      this.insert(pairs[i].newDoc);
    } catch (e) {
      error = e;
      failingI = i;
      break;
    }
  }

  // If an error was raised, roll back changes in the inverse order
  if (error) {
    for (i = 0; i < failingI; i++) {
      this.remove(pairs[i].newDoc);
    }

    for (i = 0; i < pairs.length; i++) {
      this.insert(pairs[i].oldDoc);
    }

    throw error;
  }
};

/**
 * Revert an update
 */
Index.prototype.revertUpdate = function (oldDoc, newDoc) {
  const revert = [];

  if (!util.isArray(oldDoc)) {
    this.update(newDoc, oldDoc);
  } else {
    oldDoc.forEach((pair) => {
      revert.push({ oldDoc: pair.newDoc, newDoc: pair.oldDoc });
    });
    this.updateMultipleDocs(revert);
  }
};

Index.prototype.getMatchingSingle = function (value) {
  return this.tree.search(this.keyFn(value));
};

/**
 * Get all documents in index whose key match value (if it is a Thing) or one of the elements of value (if it is an array of Things)
 * @param {Thing} value Value to match the key against
 * @return {Array of documents}
 */
Index.prototype.getMatching = function (value) {
  if (!Array.isArray(value)) {
    return this.getMatchingSingle(value);
  }

  const res = {};
  for (const v of value) {
    for (const doc of this.getMatchingSingle(v)) {
      res[doc._id] = doc;
    }
  }

  return Object.values(res);
};

/**
 * Get all documents in index whose key is between bounds are they are defined by query
 * Documents are sorted by key
 * @param {Query} query
 * @return {Array of documents}
 */
Index.prototype.getBetweenBounds = function (query) {
  const ret = this.tree.betweenBounds(query);
  delete query.$lt;
  delete query.$lte;
  delete query.$gt;
  delete query.$gte;
  return ret;
};

/**
 * Get all elements in the index
 * @return {Array of documents}
 */
Index.prototype.getAll = function () {
  const res = [];

  this.tree.executeOnEveryNode((node) => {
    const n = node.data;
    for (let i = 0; i < n.length; i++) res.push(n[i]);
  });

  return res;
};

/**
 * Execute callback for each element in an index
 */
Index.prototype.forEach = function (cb) {
  this.tree.executeOnEveryNode((node) => {
    const n = node.data;
    for (let i = 0; i < n.length; i++) cb(n[i]);
  });
};

// Interface
module.exports = Index;
