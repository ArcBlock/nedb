const axon = require('axon');
const { createDataStore } = require('./lib/dataStoreProxy');

module.exports = (port) => {
  const reqSocket = axon.socket('req');
  reqSocket.connect(port);

  return createDataStore(reqSocket);
};
