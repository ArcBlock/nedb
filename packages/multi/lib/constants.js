"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERSISTENCE_STOP_AUTO_COMPACTION = exports.PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL = exports.PERSISTENCE_COMPACT_DATAFILE = exports.EXECUTE_CURSOR_PRIVATE = exports.METHODS_DESCRIPTIONS = void 0;
exports.METHODS_DESCRIPTIONS = [
    { name: 'loadDatabase', supportsCursor: false },
    { name: 'closeDatabase', supportsCursor: false },
    { name: 'insert', supportsCursor: false },
    { name: 'find', supportsCursor: false },
    { name: 'findOne', supportsCursor: false },
    { name: 'update', supportsCursor: false },
    { name: 'remove', supportsCursor: false },
    { name: 'ensureIndex', supportsCursor: false },
    { name: 'removeIndex', supportsCursor: false },
    { name: 'count', supportsCursor: false },
    { name: 'cursor', supportsCursor: true },
];
exports.EXECUTE_CURSOR_PRIVATE = '_nedb_multi_execCursor';
exports.PERSISTENCE_COMPACT_DATAFILE = 'persistence.compactDatafile';
exports.PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL = 'persistence.setAutoCompactionInterval';
exports.PERSISTENCE_STOP_AUTO_COMPACTION = 'persistence.stopAutoCompaction';
