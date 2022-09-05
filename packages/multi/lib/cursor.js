"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cursor = void 0;
const rpc_1 = require("./rpc");
const constants_1 = require("./constants");
class Cursor {
    constructor(socket, options, findArgs) {
        this._findArgs = findArgs;
        this.options = options;
        this.socket = socket;
    }
    sort(sort) {
        this._sort = sort;
        return this;
    }
    skip(skip) {
        this._skip = skip;
        return this;
    }
    limit(limit) {
        this._limit = limit;
        return this;
    }
    projection(projection) {
        this._projection = projection;
        return this;
    }
    toJSON() {
        return {
            skip: this._skip,
            sort: this._sort,
            limit: this._limit,
            projection: this._projection,
            findArgs: this._findArgs,
        };
    }
    exec(callback) {
        return (0, rpc_1.doRpc)(this.socket, this.options, constants_1.EXECUTE_CURSOR_PRIVATE, [this, callback]);
    }
}
exports.Cursor = Cursor;
