// @ts-nocheck
/* eslint-disable no-restricted-syntax */
/* eslint-disable func-names */
/* eslint-disable consistent-return */
/**
 * Handle every persistence-related task
 * The interface DataStore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 */

const path = require('path');
const AsyncWaterfall = require('async/waterfall');
const { LineTransform } = require('node-line-reader');
const fs = require('fs');

const storage = require('./storage');
const model = require('./model');
const Index = require('./indexes');
const customUtils = require('./customUtils');

/**
 * Create a new Persistence object for database options.db
 * @param {DataStore} options.db
 * @param {Boolean} options.nodeWebkitAppName Optional, specify the name of your NW app if you want options.filename to be relative to the directory where
 *                                            Node Webkit stores application data such as cookies and local storage (the best place to store data in my opinion)
 */
function Persistence(options) {
  let i;
  let j;
  let randomString;

  this.db = options.db;
  this.inMemoryOnly = this.db.inMemoryOnly;
  this.filename = this.db.filename;
  this.corruptAlertThreshold = options.corruptAlertThreshold !== undefined ? options.corruptAlertThreshold : 0.1;
  this.writtenCount = 0;
  this.writtenBytes = 0;

  if (!this.inMemoryOnly && this.filename && this.filename.charAt(this.filename.length - 1) === '~') {
    throw new Error("The datafile name can't end with a ~, which is reserved for crash safe backup files");
  }

  // After serialization and before deserialization hooks with some basic sanity checks
  if (options.afterSerialization && !options.beforeDeserialization) {
    throw new Error(
      'Serialization hook defined but deserialization hook undefined, cautiously refusing to start NeDB to prevent dataloss'
    );
  }
  if (!options.afterSerialization && options.beforeDeserialization) {
    throw new Error(
      'Serialization hook undefined but deserialization hook defined, cautiously refusing to start NeDB to prevent dataloss'
    );
  }
  this.afterSerialization =
    options.afterSerialization ||
    function (s) {
      return model.serialize(s);
    };
  this.beforeDeserialization =
    options.beforeDeserialization ||
    function (s) {
      return model.deserialize(s);
    };
  for (i = 1; i < 30; i++) {
    for (j = 0; j < 10; j += 1) {
      randomString = `_${customUtils.uid(i)}`;
      if (this.beforeDeserialization(this.afterSerialization(randomString)) !== randomString) {
        throw new Error(
          'beforeDeserialization is not the reverse of afterSerialization, cautiously refusing to start NeDB to prevent dataloss'
        );
      }
    }
  }
}

/**
 * Check if a directory exists and create it on the fly if it is not the case
 * cb is optional, signature: err
 */
Persistence.ensureDirectoryExists = function (dir, cb) {
  cb = cb || function () {};
  storage.mkdirp(dir).then(cb);
};

/**
 * Persist cached database
 * This serves as a compaction function since the cache always contains only the number of documents in the collection
 * while the data file is append-only so it may grow larger
 * @param {Function} cb Optional callback, signature: err
 */
Persistence.prototype.persistCachedDatabase = function (reopen, cb) {
  if (typeof reopen === 'function') {
    cb = reopen;
    reopen = true;
  }
  cb = cb || function () {};

  if (this.inMemoryOnly) return cb(null);

  const tempFile = `${this.filename}~`;
  const stream = fs.createWriteStream(tempFile);

  let fd = null;
  // eslint-disable-next-line no-return-assign
  stream.on('open', (_fd) => (fd = _fd));

  this.db.forEach((doc) => stream.write(`${this.afterSerialization(doc)}\n`));
  for (const fieldName in this.db.indexes) {
    if (fieldName === '_id') continue; // The special _id index is managed by datastore.js, the others need to be persisted
    const index = this.db.indexes[fieldName];
    stream.write(
      `${this.afterSerialization({
        $$indexCreated: { fieldName, unique: index.unique, sparse: index.sparse },
      })}\n`
    );
  }

  stream.end(() => {
    const after_sync = () => {
      storage.crashSafeRename(tempFile, this.filename, (err) => {
        if (err) {
          return cb(err);
        }

        const complete = (err) => {
          if (err) return cb(err);

          this.db.emit('compaction.done');

          return cb(null);
        };

        if (reopen) {
          this._open(complete);
        } else if (this.fd) {
          fs.close(this.fd, () => {
            complete();
          });
        }
      });
    };

    if (fd) {
      fs.fsync(fd, after_sync);
    } else {
      after_sync();
    }
  });
};

/**
 * Queue a rewrite of the datafile
 */
Persistence.prototype.compactDatafile = function (cb) {
  cb = cb || function () {};
  this.db.executor.push({ this: this, fn: this.persistCachedDatabase, arguments: [cb] });
};

/**
 * Set automatic compaction every interval ms
 * @param {Number} interval in milliseconds, with an enforced minimum of 5 seconds
 */
Persistence.prototype.setAutoCompactionInterval = function (
  interval,
  minimumWritten = 0,
  minimumBytes = Number.MAX_SAFE_INTEGER
) {
  this.stopAutoCompaction();

  const realInterval = Math.max(interval || 0, 5000);

  let currentCompactionTimer;
  const doCompaction = () => {
    currentCompactionTimer = this.autocompactionIntervalId;
    if (this.writtenCount >= minimumWritten || this.writtenBytes > minimumBytes) {
      this.compactDatafile(() => {
        // eslint-disable-next-line no-multi-assign
        this.writtenCount = this.writtenBytes = 0;
        if (currentCompactionTimer == this.autocompactionIntervalId)
          this.autocompactionIntervalId = setTimeout(doCompaction, realInterval);
      });
    }
  };

  this.autocompactionIntervalId = setTimeout(doCompaction, realInterval);
};

/**
 * Stop autocompaction (do nothing if autocompaction was not running)
 */
Persistence.prototype.stopAutoCompaction = function () {
  if (this.autocompactionIntervalId) {
    clearTimeout(this.autocompactionIntervalId);
    this.autocompactionIntervalId = null;
  }
};

/**
 * Persist new state for the given newDocs (can be insertion, update or removal)
 * Use an append-only format
 * @param {Array} newDocs Can be empty if no doc was updated/removed
 * @param {Function} cb Optional, signature: err
 */
Persistence.prototype.persistNewState = function (newDocs, cb) {
  cb = cb || function () {};

  // In-memory only datastore
  if (this.inMemoryOnly) return cb(null);

  let toPersist = '';
  const cachedLen = newDocs.length;
  for (let x = 0; x < cachedLen; x++) {
    const writing = `${this.afterSerialization(newDocs[x])}\n`;
    toPersist += writing;
    this.writtenCount++;
    this.writtenBytes += writing.length;
  }
  if (toPersist.length === 0) return cb(null);

  storage.appendFile(this.fd || this.filename, toPersist, 'utf8', (err) => {
    if (err) return cb(err);
    if (!this.fd) return cb();

    fs.fsync(this.fd, (err) => cb(err));
  });
};

Persistence.prototype.readFileAndParse = function (cb) {
  const self = this;
  let count = 0;
  const tdata = [];
  const dataById = {};
  const indexes = {};
  let corruptItems = 0;
  let reader;

  try {
    const readStream = fs.createReadStream(this.filename, { fd: this.fd, start: 0, autoClose: false });
    reader = new LineTransform();
    readStream.pipe(reader);
  } catch (e) {
    return cb(null, { data: tdata, indexes });
  }

  reader.on('end', () => {
    // A bit lenient on corruption
    if (count > 0 && corruptItems / count > self.corruptAlertThreshold) {
      return cb(
        new Error(
          `More than ${Math.floor(
            100 * self.corruptAlertThreshold
          )}% of the data file is corrupt, the wrong beforeDeserialization hook may be used. Cautiously refusing to start NeDB to prevent dataloss`
        )
      );
    }

    // eslint-disable-next-line guard-for-in
    for (const k in dataById) {
      tdata.push(dataById[k]);
    }

    cb(null, { data: tdata, indexes });
  });
  reader.on('error', (err) => cb(err));
  reader.on('data', (line) => {
    try {
      const doc = self.beforeDeserialization(line);
      if (doc._id) {
        if (doc.$$deleted === true) {
          delete dataById[doc._id];
        } else {
          dataById[doc._id] = doc;
        }
      } else if (doc.$$indexCreated && doc.$$indexCreated.fieldName != undefined) {
        indexes[doc.$$indexCreated.fieldName] = doc.$$indexCreated;
      } else if (typeof doc.$$indexRemoved === 'string') {
        delete indexes[doc.$$indexRemoved];
      }
    } catch (e) {
      corruptItems += 1;
    }

    count++;
  });
};

/**
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Persistence.prototype.treatRawData = function (rawData) {
  const data = rawData.split('\n');
  const dataById = {};
  const tdata = [];
  const indexes = {};
  let corruptItems = -1; // Last line of every data file is usually blank so not really corrupt
  for (let i = 0; i < data.length; i++) {
    try {
      const doc = this.beforeDeserialization(data[i]);
      if (doc._id) {
        if (doc.$$deleted === true) {
          delete dataById[doc._id];
        } else {
          dataById[doc._id] = doc;
        }
      } else if (doc.$$indexCreated && doc.$$indexCreated.fieldName != undefined) {
        indexes[doc.$$indexCreated.fieldName] = doc.$$indexCreated;
      } else if (typeof doc.$$indexRemoved === 'string') {
        delete indexes[doc.$$indexRemoved];
      }
    } catch (e) {
      corruptItems++;
    }
  }

  // A bit lenient on corruption
  if (data.length > 0 && corruptItems / data.length > this.corruptAlertThreshold) {
    throw new Error(
      `More than ${Math.floor(
        100 * this.corruptAlertThreshold
      )}% of the data file is corrupt, the wrong beforeDeserialization hook may be used. Cautiously refusing to start NeDB to prevent dataloss`
    );
  }

  // eslint-disable-next-line guard-for-in
  for (const k in dataById) {
    tdata.push(dataById[k]);
  }

  return { data: tdata, indexes };
};

Persistence.prototype._open = function (callback) {
  AsyncWaterfall(
    [
      (cb) => {
        if (this.fd) {
          fs.close(this.fd, () => {
            this.fd = null;
            cb();
          });
        } else {
          cb();
        }
      },
      (cb) => {
        fs.open(this.filename, 'a+', (err, fd) => {
          if (err) {
            return cb(err);
          }
          this.fd = fd;
          return cb();
        });
      },
    ],
    callback
  );
};

/**
 * Load the database
 * 1) Create all indexes
 * 2) Insert all data
 * 3) Compact the database
 * This means pulling data out of the data file or creating it if it doesn't exist
 * Also, all data is persisted right away, which has the effect of compacting the database file
 * This operation is very quick at startup for a big collection (60ms for ~10k docs)
 * @param {Function} cb Optional callback, signature: err
 */
Persistence.prototype.loadDatabase = function (cb) {
  const callback = cb || function () {};

  this.db.resetIndexes();

  // In-memory only datastore
  if (this.inMemoryOnly) {
    return callback(null);
  }

  AsyncWaterfall(
    [
      (cb) => {
        Persistence.ensureDirectoryExists(path.dirname(this.filename), (err) => {
          this._open((err) => {
            if (err) {
              return cb(err);
            }
            storage.ensureDatafileIntegrity(this.fd, (err) => {
              this.readFileAndParse((err, treatedData) => {
                if (err) {
                  return cb(err);
                }

                // Recreate all indexes in the datafile
                // eslint-disable-next-line guard-for-in
                for (const key in treatedData.indexes) {
                  this.db.indexes[key] = new Index(treatedData.indexes[key]);
                }

                // Fill cached database (i.e. all indexes) with data
                try {
                  this.db.resetIndexes(treatedData.data);
                } catch (e) {
                  this.db.resetIndexes(); // Rollback any index which didn't fail
                  return cb(e);
                }

                this.db.persistence.persistCachedDatabase(cb);
              });
            });
          });
        });
      },
    ],
    (err) => {
      if (err) {
        return callback(err);
      }

      this.db.executor.processBuffer();
      return callback(null);
    }
  );
};

/**
 *
 */
Persistence.prototype.closeDatabase = function (cb) {
  cb = cb || function () {};

  if (this.inMemoryOnly) return cb(null);

  this.persistCachedDatabase(false, cb);
};

// Interface
module.exports = Persistence;
