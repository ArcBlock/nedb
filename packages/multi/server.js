/* eslint-disable no-console */
const axon = require('axon');

const { createHandler, events } = require('./lib/handler');
const { createBackup } = require('./lib/backup');

const port = Number(process.env.NEDB_MULTI_PORT) || Number(process.argv[2]);

const map = new Map();
const dataDir = process.env.ABT_NODE_DATA_DIR ? process.env.ABT_NODE_DATA_DIR : '';
const handler = createHandler(map);

const backup = createBackup(dataDir);
events.on('loadDatabase', ({ dbPath, options }) => backup.load(dbPath, options));
events.on('closeDatabase', ({ dbPath }) => backup.close(dbPath));

const server = axon.socket('rep');
server.set('identity', 'nedb-multi-server');

server.on('error', (err) => {
  console.warn('NEDB proxy server error', new Date().toISOString());
  console.error(err);
});

server.on('bind', () => {
  console.info(`NEDB proxy server listen on port ${port}`);

  // restore databases
  const data = backup.recover();
  Object.keys(data).forEach((dbPath) => {
    const options = data[dbPath];
    handler(options, 'loadDatabase', [], (err) => {
      if (err) {
        console.error(`Failed to recover database: ${options.filename}`, err);
      } else {
        console.info(`Recover database: ${options.filename}`);
      }
    });
  });
});

server.on('message', handler);

server.bind(port);
