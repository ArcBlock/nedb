/* eslint-disable @typescript-eslint/indent */
import EventEmitter from 'events';
import { CallbackWithResult, DataStoreOptions } from '@nedb/core';

/* eslint-disable no-console */
const { DataStore } = require('@nedb/core');
const errio = require('errio');

const utils = require('./utils');
const constants = require('./constants');

export const events = new EventEmitter();

const replyCallback =
  (reply: CallbackWithResult<any>) =>
  (...args: any[]) => {
    if (args[0] !== null) {
      args[0] = errio.stringify(args[0]); // eslint-disable-line no-param-reassign
    }

    // @ts-ignore
    reply(...args);
  };

export const createHandler =
  (map: Map<string, typeof DataStore>) =>
  (
    options: DataStoreOptions & { serialized: boolean },
    method: string,
    dataOnlyArgs: any[],
    reply: CallbackWithResult<any>
  ) => {
    const { filename = 'memory', serialized = false } = options;
    let db = map.get(filename);

    const decodedArgs = serialized ? dataOnlyArgs.map(utils.deserialize) : dataOnlyArgs;

    // NOTE: following code is only useful when test server recovery after crash when protected by daemon like PM2
    // @see: example/crash.js
    if (method === 'crash') {
      throw new Error('server crashed');
    }
    if (method === 'loadDatabase') {
      if (!db) {
        console.log(`Load database ${filename}`);
        db = new DataStore(options);
        map.set(filename, db);
        events.emit('loadDatabase', { dbPath: filename, options });
      } else {
        console.log(`Use loaded database ${filename}`);
      }
    } else if (!db) {
      reply(errio.stringify(new Error('Call loadDatabase() first.')));
      return;
    }

    if (method === constants.EXECUTE_CURSOR_PRIVATE) {
      const cursor = decodedArgs[decodedArgs.length - 1];
      utils.execCursor(cursor, db, replyCallback(reply));
    } else if (method === constants.PERSISTENCE_COMPACT_DATAFILE) {
      db.persistence.compactDatafile();
    } else if (method === constants.PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL) {
      db.persistence.setAutoCompactionInterval(...decodedArgs);
    } else if (method === constants.PERSISTENCE_STOP_AUTO_COMPACTION) {
      db.persistence.stopAutoCompaction();
    } else if (method === 'closeDatabase') {
      // always delete db from dbMap and return success
      // db.closeDatabase is not safe
      // db.closeDatabase is not atomic
      map.delete(filename);
      replyCallback(reply)(null);

      events.emit('closeDatabase', { dbPath: filename });

      try {
        db.closeDatabase(...decodedArgs, (...args: any[]) => {
          if (args[0] === null) {
            console.log(`Close database ${filename}`);
          } else {
            console.error(`Failed to close database ${filename}`, args[0] && args[0].message);
          }
        });
      } catch (err: any) {
        console.error(`Failed to close database ${filename}`, err.message);
      }
    } else {
      db[method].call(db, ...decodedArgs, replyCallback(reply));
    }
  };
