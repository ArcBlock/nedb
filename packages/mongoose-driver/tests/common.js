/* eslint-disable no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable prefer-rest-params */
/* eslint-disable func-names */
require('@nedb/mongoose-driver').install();

Error.stackTraceLimit = 10;

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const assert = require('power-assert'); // eslint-disable-line import/no-extraneous-dependencies

mongoose.set('debug', true);
mongoose.Promise = Promise;

const { Collection } = mongoose;

let opened = 0;
let closed = 0;

if (process.env.D === '1') {
  mongoose.set('debug', true);
}

const dbPath = path.join(os.tmpdir(), 'mongoose-nedb');

/**
 * Override Collection#onOpen to keep track of connections
 */

const oldOnOpen = Collection.prototype.onOpen;

Collection.prototype.onOpen = function () {
  opened++;
  return oldOnOpen.apply(this, arguments);
};

/**
 * Override Collection#onClose to keep track of disconnections
 */

const oldOnClose = Collection.prototype.onClose;

Collection.prototype.onClose = function () {
  closed++;
  return oldOnClose.apply(this, arguments);
};

/**
 * Create a connection to the test database.
 * You can set the environmental variable MONGOOSE_TEST_URI to override this.
 *
 * @api private
 */

module.exports = function (options = {}) {
  let uri;

  if (options.uri) {
    uri = options.uri;
    delete options.uri;
  } else {
    uri = module.exports.uri;
  }

  const noErrorListener = !!options.noErrorListener;
  delete options.noErrorListener;

  const conn = mongoose.createConnection(uri, Object.assign({ dbPath }, options));

  if (noErrorListener) {
    return conn;
  }

  conn.on('error', (err) => {
    assert.ok(err);
  });

  return conn;
};

module.exports.dbPath = dbPath;
module.exports.uri = process.env.MONGOOSE_TEST_URI || 'mongodb://localhost/mongoose_test';

module.exports.mongoose = mongoose;
module.exports.random = () => Math.random().toString().substr(3);

before(function (done) {
  try {
    fs.mkdirSync(dbPath, { recursive: true });
  } catch (err) {}
  this.timeout(10 * 1000);
  done();
});

after(function (done) {
  this.timeout(15000);
  // eslint-disable-next-line no-console
  console.log(dbPath);
  setTimeout(() => {
    try {
      fs.removeSync(dbPath);
    } catch (err) {
      // Do nothing
    }
    done();
  }, 10);
});
