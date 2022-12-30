/* eslint-disable max-classes-per-file */
const test = require('tape');
const proxyquire = require('proxyquire');

test('calling loadDatabase', (t) => {
  const handler = proxyquire('../../lib/handler', {
    nedb: class {
      loadDatabase(callback) {
        // eslint-disable-line class-methods-use-this
        process.nextTick(() => callback(null, {}));
      }
    },
  });

  t.test('for the first time', (st) => {
    const dbsMap = new Map();
    const messagesHandler = handler.createHandler(dbsMap, false);

    messagesHandler({ filename: 'file' }, 'loadDatabase', [], () => {
      st.ok(dbsMap.get('file'));
      st.end();
    });
  });

  t.test('twice', (st) => {
    const dbsMap = new Map();
    const messagesHandler = handler.createHandler(dbsMap, false);

    messagesHandler({ filename: 'file' }, 'loadDatabase', [], () => {
      const db1 = dbsMap.get('file');
      st.ok(db1);

      messagesHandler({ filename: 'file' }, 'loadDatabase', [], () => {
        const db2 = dbsMap.get('file');
        st.equal(db1, db2);
        st.end();
      });
    });
  });
});

test('calling closeDatabase', (t) => {
  const handler = proxyquire('../../lib/handler', {
    nedb: class {
      loadDatabase(callback) {
        // eslint-disable-line class-methods-use-this
        process.nextTick(() => callback(null, {}));
      }

      closeDatabase(callback) {
        // eslint-disable-line class-methods-use-this
        process.nextTick(() => callback(null, {}));
      }
    },
  });

  t.test('should work as expected', (st) => {
    const dbsMap = new Map();
    const messagesHandler = handler.createHandler(dbsMap, false);

    messagesHandler({ filename: 'file' }, 'loadDatabase', [], () => {
      const db1 = dbsMap.get('file');
      st.ok(db1);

      messagesHandler({ filename: 'file' }, 'closeDatabase', [], () => {
        const db2 = dbsMap.get('file');
        st.notOk(db2);

        messagesHandler({ filename: 'file' }, 'loadDatabase', [], () => {
          const db3 = dbsMap.get('file');
          st.notEqual(db3, db1);
          st.end();
        });
      });
    });
  });
});

test('calling other methods', (t) => {
  t.test('when db has been loaded', (st) => {
    const result = {};
    const filename = 'file';

    const DataStore = class {
      testMethod(callback) {
        // eslint-disable-line class-methods-use-this
        process.nextTick(() => callback(null, {}));
      }
    };

    const handler = proxyquire('../../lib/handler', {
      nedb: DataStore,
    });

    const dbsMap = new Map();
    dbsMap.set(filename, new DataStore());

    const messagesHandler = handler.createHandler(dbsMap, false);

    messagesHandler({ filename }, 'testMethod', [], (err, docs) => {
      st.notOk(err);
      st.deepEqual(result, docs);
      st.end();
    });
  });

  t.test('when db has not been loaded yet', (st) => {
    const filename = 'file';

    const handler = proxyquire('../../lib/handler', {
      nedb: class {},
    });

    const dbsMap = new Map();
    const messagesHandler = handler.createHandler(dbsMap, false);

    messagesHandler({ filename }, 'testMethod', [], (err) => {
      st.ok(err);
      st.end();
    });
  });
});

test('executing a cursor', (t) => {
  const cursor = {};
  const handler = proxyquire('../../lib/handler', {
    './utils': {
      execCursor(cursorToExecute, db, callback) {
        t.deepEqual(cursorToExecute, cursor);
        process.nextTick(() => callback(null, {}));
      },
    },
  });

  const dbsMap = new Map();
  dbsMap.set('file', {});

  const messagesHandler = handler.createHandler(dbsMap, false);

  messagesHandler({ filename: 'file' }, '_nedb_multi_execCursor', [cursor], () => {
    t.end();
  });
});
