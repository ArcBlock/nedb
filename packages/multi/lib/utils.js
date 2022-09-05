"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCursor = exports.endsWithCallback = void 0;
function endsWithCallback(args) {
    return args && args.length > 0 && typeof args[args.length - 1] === 'function';
}
exports.endsWithCallback = endsWithCallback;
function execCursor(cursor, db, callback) {
    const { sort, skip, limit, projection, findArgs } = cursor;
    return db.cursor(findArgs[0]).sort(sort).skip(skip).limit(limit).projection(projection).exec(callback);
}
exports.execCursor = execCursor;
