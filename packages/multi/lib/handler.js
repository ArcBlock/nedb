/* eslint-disable no-console */
const { DataStore } = require('@nedb/core');
const errio = require('errio');

const utils = require('./utils');
const constants = require('./constants');

const replyCallback =
  (reply) =>
  (...args) => {
    if (args[0] !== null) {
      args[0] = errio.stringify(args[0]); // eslint-disable-line no-param-reassign
    }

    reply(...args);
  };

exports.create = (map) => (options, method, dataOnlyArgs, reply) => {
  const { filename } = options;
  let db = map.get(filename);

  if (method === 'loadDatabase') {
    if (!db) {
      console.log(`Create database ${filename}`);
      db = new DataStore(options);
      map.set(filename, db);
    } else {
      console.log(`Use existed database ${filename}`);
    }
  } else if (!db) {
    reply(errio.stringify(new Error('Call loadDatabase() first.')));
    return;
  }

  if (method === constants.EXECUTE_CURSOR_PRIVATE) {
    const cursor = dataOnlyArgs[dataOnlyArgs.length - 1];
    utils.execCursor(cursor, db, replyCallback(reply));
  } else if (method === constants.PERSISTENCE_COMPACT_DATAFILE) {
    db.persistence.compactDatafile();
  } else if (method === constants.PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL) {
    db.persistence.setAutoCompactionInterval(...dataOnlyArgs);
  } else if (method === constants.PERSISTENCE_STOP_AUTO_COMPACTION) {
    db.persistence.stopAutoCompaction();
  } else if (method === 'closeDatabase') {
    // always delete db from dbMap and return success
    // db.closeDatabase is not safe
    // db.closeDatabase is not atomic
    map.delete(filename);
    replyCallback(reply)(null);

    try {
      db.closeDatabase(...dataOnlyArgs, (...args) => {
        if (args[0] === null) {
          console.log(`Close database ${filename}`);
        } else {
          console.error(`Failed to close database ${filename}`, args[0] && args[0].message);
        }
      });
    } catch (err) {
      console.error(`Failed to close database ${filename}`, err.message);
    }
  } else {
    db[method].call(db, ...dataOnlyArgs, replyCallback(reply));
  }
};
