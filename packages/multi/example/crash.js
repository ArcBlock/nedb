const axon = require('axon');
const { doRpc } = require('../lib/rpc');
const { createDataStore } = require('..');

const DataStore = createDataStore(+process.env.NEDB_MULTI_PORT);
const db = new DataStore({ filename: 'example.db' });

const port = Number(process.env.NEDB_MULTI_PORT) || Number(process.argv[2]);
const client = axon.socket('req');
client.connect(port);

db.loadDatabase(() => {
  setInterval(() => {
    db.find({ uid: { $regex: /^d/ } }, (err, docs) => {
      console.log(err, docs);
    });
  }, 3000);
  setTimeout(() => {
    doRpc(client, { serialized: true }, 'crash', []);
  }, 500);
});
