"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceProxy = void 0;
/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/lines-between-class-members */
const rpc_1 = require("./rpc");
const constants_1 = require("./constants");
class PersistenceProxy {
    constructor(socket, options) {
        this.socket = socket;
        this.options = options;
    }
    setAutoCompactionInterval(interval) {
        return (0, rpc_1.doRpc)(this.socket, this.options, constants_1.PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL, [interval]);
    }
    stopAutoCompaction() {
        return (0, rpc_1.doRpc)(this.socket, this.options, constants_1.PERSISTENCE_STOP_AUTO_COMPACTION, []);
    }
    compactDatafile() {
        return (0, rpc_1.doRpc)(this.socket, this.options, constants_1.PERSISTENCE_COMPACT_DATAFILE, []);
    }
}
exports.PersistenceProxy = PersistenceProxy;
