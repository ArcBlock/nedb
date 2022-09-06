const { createDataStore } = require('../../lib/index');

const DataStore = createDataStore(Number(process.env.NEDB_MULTI_PORT));

const db = new DataStore({ filename: 'test.data' });
db.persistence.setAutoCompactionInterval(500);

db.loadDatabase((err) => {
  if (err) {
    console.error(err);
  }

  function next(count) {
    if (count < Number(process.env.NEDB_MULTI_ITERATIONS)) {
      db.insert({ pid: process.pid }, (err, doc) => {
        db.persistence.compactDatafile();
        next(count + 1);
      });
    } else {
      db.persistence.stopAutoCompaction();
      process.exit(0);
    }
  }

  next(0);
});
