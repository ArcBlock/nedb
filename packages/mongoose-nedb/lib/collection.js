/* eslint-disable no-underscore-dangle */
/* eslint-disable no-continue */
/* eslint-disable prefer-spread */
/* eslint-disable consistent-return */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-rest-params */
/* eslint-disable guard-for-in */
/* eslint-disable func-names */
/* eslint-disable import/no-dynamic-require */
const bson = require('bson');
const path = require('path');
const MongooseCollection = require('mongoose/lib/collection');
const DataStore = require('@abtnode/nedb');

// eslint-disable-next-line global-require
const debug = require('debug')(`${require('../package.json').name}:collection`);

// Override the function to generate new _id MongoDB suitable random string
DataStore.prototype.createNewId = function () {
  return new bson.ObjectID().toString();
};

/**
 * A [node-mongodb-native](https://github.com/mongodb/node-mongodb-native) collection implementation.
 *
 * All methods methods from the [node-mongodb-native](https://github.com/mongodb/node-mongodb-native) driver are copied and wrapped in queue management.
 *
 * @inherits Collection
 * @api private
 */

function NeDBCollection() {
  this.collection = null;
  MongooseCollection.apply(this, arguments);
}

/*!
 * Inherit from abstract Collection.
 */

NeDBCollection.prototype.__proto__ = MongooseCollection.prototype;

/**
 * Called when the connection opens.
 *
 * @api private
 */

NeDBCollection.prototype.onOpen = function () {
  const self = this;

  const options = Object.assign(
    { filename: path.join(self.conn.options.dbPath, `${self.name}.db`) },
    self.conn.options.nedbOptions
  );

  debug('open collection', { arguments, options });

  const collection = new DataStore(options);

  collection.loadDatabase((err) => {
    if (err) {
      self.conn.emit('error', err);
    } else {
      self.collection = collection;
      MongooseCollection.prototype.onOpen.call(self);
    }
  });
};

/**
 * Called when the connection closes
 *
 * @api private
 */

NeDBCollection.prototype.onClose = function () {
  MongooseCollection.prototype.onClose.call(this);
};

// NeDBCollection.prototype.findAndModify = function (query, sort, update, options, cb) {
//   console.trace('NeDBCollection.prototype.findAndModify', arguments);
//   console.log(cb.toString());
//   // FIXME: sort is not used
//   this.find(query, {}, (err, cursor) => {
//     if (err) {
//       return cb(err);
//     }

//     const docs = cursor.res;
//     const updates = JSON.parse(JSON.stringify(update));
//     const wrappedCb = (e, numAffected, affectedDocuments) => {
//       console.log('NeDBCollection.prototype.findAndModify.done', { numAffected, affectedDocuments });
//       if (e) {
//         return cb(e);
//       }

//       return cb(null, affectedDocuments);
//     };

//     if (docs.length) {
//       this.update(
//         { _id: { $in: docs.map((x) => x._id) } },
//         updates,
//         { ...options, returnUpdatedDocs: true },
//         wrappedCb
//       );
//     } else {
//       this.update({}, updates, { ...options, returnUpdatedDocs: true }, wrappedCb);
//     }
//   });
// };

/*!
 * Copy the collection methods and make them subject to queues
 */

function iter(method) {
  NeDBCollection.prototype[method] = function () {
    // console.log(`mongoose.nedb.${method}`, arguments);

    if (this.buffer) {
      this.addQueue(method, arguments);
      return;
    }

    const { collection } = this;
    const args = arguments;

    return collection[method].apply(collection, args);
  };
}

for (const prop in DataStore.prototype) {
  try {
    if (typeof DataStore.prototype[prop] !== 'function') {
      continue;
    }
  } catch (e) {
    continue;
  }

  iter(prop);
}

/**
 * Retrieves information about this collections indexes.
 *
 * @param {Function} callback
 * @method getIndexes
 * @api public
 */

NeDBCollection.prototype.getIndexes = NeDBCollection.prototype.indexInformation;

/*!
 * Module exports.
 */

module.exports = NeDBCollection;
