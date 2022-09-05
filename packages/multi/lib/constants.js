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
