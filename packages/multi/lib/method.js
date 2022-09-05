"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMethod = void 0;
const rpc_1 = require("./rpc");
const cursor_1 = require("./cursor");
const utils_1 = require("./utils");
function createMethod(socket, name, supportsCursor) {
    return function method(...args) {
        if (supportsCursor && !(0, utils_1.endsWithCallback)(args)) {
            // @ts-ignore
            return new cursor_1.Cursor(socket, this.options, args);
        }
        // @ts-ignore
        return (0, rpc_1.doRpc)(socket, this.options, name, args);
    };
}
exports.createMethod = createMethod;
