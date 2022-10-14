/* eslint-disable func-names */
/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localforage which chooses the best option depending on user browser (IndexedDB then WebSQL then localStorage)
 *
 * This version is the Node.js/Node Webkit version
 * It's essentially fs, mkdirp and crash safe write and read functions
 */

const fs = require('fs');
const mkdirp = require('mkdirp');
const [AsyncWaterfall, AsyncApply] = [require('async/waterfall'), require('async/apply')];
const path = require('path');

const storage = {};

const renameOnWindows = (oldFilename, newFilename, cb) => {
  fs.copyFile(oldFilename, newFilename, (err) => {
    if (err != null) {
      return cb(err);
    }

    fs.rm(oldFilename, cb);
  });
};

storage.exists = fs.exists;
storage.writeFile = fs.writeFile;
storage.unlink = fs.unlink;
storage.appendFile = fs.appendFile;
storage.readFile = fs.readFile;
storage.mkdirp = mkdirp;

// 在 Windows 下 fs.rename 会遇到权限问题，不过还没弄明白为什么
storage.rename = process.platform === 'win32' ? renameOnWindows : fs.rename;

/**
 * Explicit name ...
 */
storage.ensureFileDoesntExist = function (file, callback) {
  storage.exists(file, (exists) => {
    if (!exists) {
      return callback(null);
    }

    storage.unlink(file, (err) => callback(err));
  });
};

/**
 * Flush data in OS buffer to storage if corresponding option is set
 * @param {String} options.filename
 * @param {Boolean} options.isDir Optional, defaults to false
 * If options is a string, it is assumed that the flush of the file (not dir) called options was requested
 */
storage.flushToStorage = function (options, callback) {
  let filename;
  let flags;
  if (typeof options === 'string') {
    filename = options;
    flags = 'r+';
  } else {
    filename = options.filename;
    flags = options.isDir ? 'r' : 'r+';
  }

  // Windows can't fsync (FlushFileBuffers) directories. We can live with this as it cannot cause 100% dataloss
  // except in the very rare event of the first time database is loaded and a crash happens
  if (flags === 'r' && (process.platform === 'win32' || process.platform === 'win64')) {
    return callback(null);
  }

  fs.open(filename, flags, (err, fd) => {
    if (err) {
      return callback(err);
    }
    fs.fsync(fd, (errFS) => {
      fs.close(fd, (errC) => {
        if (errFS || errC) {
          const e = new Error('Failed to flush to storage');
          e.errorOnFsync = errFS;
          e.errorOnClose = errC;
          return callback(e);
        }
        return callback(null);
      });
    });
  });
};

/**
 * Fully write or rewrite the datafile, immune to crashes during the write operation (data will not be lost)
 * @param {String} filename
 * @param {String} data
 * @param {Function} cb Optional callback, signature: err
 */
storage.crashSafeWriteFile = function (filename, data, cb) {
  const callback = cb || function () {};
  const tempFilename = `${filename}~`;

  AsyncWaterfall(
    [
      AsyncApply(storage.flushToStorage, { filename: path.dirname(filename), isDir: true }),
      function (cb) {
        storage.exists(filename, (exists) => {
          if (exists) {
            storage.flushToStorage(filename, (err) => cb(err));
          } else {
            return cb();
          }
        });
      },
      function (cb) {
        storage.writeFile(tempFilename, data, (err) => cb(err));
      },
      AsyncApply(storage.flushToStorage, tempFilename),
      function (cb) {
        storage.rename(tempFilename, filename, (err) => cb(err));
      },
      AsyncApply(storage.flushToStorage, { filename: path.dirname(filename), isDir: true }),
    ],
    (err) => callback(err)
  );
};

storage.crashSafeRename = function (oldFilename, newFilename, cb) {
  const callback = cb || function () {};
  const tempFilename = oldFilename;

  AsyncWaterfall(
    [
      AsyncApply(storage.flushToStorage, { filename: path.dirname(newFilename), isDir: true }),
      AsyncApply(storage.flushToStorage, tempFilename),
      function (cb) {
        storage.rename(tempFilename, newFilename, (err) => cb(err));
      },
      AsyncApply(storage.flushToStorage, { filename: path.dirname(newFilename), isDir: true }),
    ],
    (err) => callback(err)
  );
};

/**
 * Ensure the datafile contains all the data, even if there was a crash during a full file write
 * @param {String} filename
 * @param {Function} callback signature: err
 */
storage.ensureDatafileIntegrity = function (filename, callback) {
  const tempFilename = `${filename}~`;

  storage.exists(filename, (filenameExists) => {
    // Write was successful
    if (filenameExists) {
      return callback(null);
    }

    storage.exists(tempFilename, (oldFilenameExists) => {
      // New database
      if (!oldFilenameExists) {
        return storage.writeFile(filename, '', 'utf8', (err) => {
          callback(err);
        });
      }

      // Write failed, use old version
      storage.rename(tempFilename, filename, (err) => callback(err));
    });
  });
};

// Interface
module.exports = storage;
