const { createDataStore } = require('..');

const DataStore = createDataStore(+process.env.NEDB_MULTI_PORT);

const db = new DataStore({ filename: 'legacy.db', serialized: false });
const maxInsertsCount = 3;

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

db.loadDatabase(() => {
  const start = Date.now();
  function next(insertsCount) {
    if (insertsCount === maxInsertsCount) {
      db.find({ pid: process.pid }, (err, docs) => {
        console.log(err, docs);
        console.log(Date.now() - start, 'ms');
        process.exit(0);
      });
    }

    const doc = { pid: process.pid, uid: uuid() };
    db.insert(doc, (err) => {
      if (err) {
        console.log('Insert error:', err);
      } else {
        console.log('Insert success:', doc);
        next(insertsCount + 1);
      }
    });
  }

  next(0);
});
