/* eslint-disable no-console */
const axon = require('axon');

const handler = require('./lib/handler');

process
  .on('uncaughtException', (error) => {
    console.error(`uncaughtException: ${error.message}`);
  })
  .on('unhandledRejection', (reason) => {
    // @ts-ignore
    console.error(`unhandledRejection: ${reason.message}`);
  });

const map = new Map();
const port = Number(process.env.NEDB_MULTI_PORT) || Number(process.argv[2]);
const repSocket = axon.socket('rep');
const messagesHandler = handler.create(map);

console.info(`NEDB proxy server listen on port ${port}`);

repSocket.bind(port);
repSocket.on('message', messagesHandler);
