const rpc = require('./rpc');
const constants = require('./constants');

module.exports = class PersistenceProxy {
  constructor(socket, options) {
    this.socket = socket;
    this.options = options;
  }

  setAutoCompactionInterval(interval) {
    rpc(this.socket, this.options, constants.PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL, [interval]);
  }

  stopAutoCompaction() {
    rpc(this.socket, this.options, constants.PERSISTENCE_STOP_AUTO_COMPACTION);
  }

  compactDatafile() {
    rpc(this.socket, this.options, constants.PERSISTENCE_COMPACT_DATAFILE);
  }
};
