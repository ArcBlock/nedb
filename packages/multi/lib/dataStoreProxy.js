"use strict";
/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/lines-between-class-members */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDataStore = void 0;
const method_1 = require("./method");
const constants_1 = require("./constants");
const persistenceProxy_1 = require("./persistenceProxy");
function createDataStore(socket) {
    class DataStore {
        constructor(options) {
            this.options = options;
            this.persistence = new persistenceProxy_1.PersistenceProxy(socket, options);
        }
    }
    for (const { name, supportsCursor } of constants_1.METHODS_DESCRIPTIONS) {
        // @ts-ignore
        DataStore.prototype[name] = (0, method_1.createMethod)(socket, name, supportsCursor);
    }
    return DataStore;
}
exports.createDataStore = createDataStore;
