const { DataStore } = require('@nedb/core');
const { createDataStore } = require('@nedb/multi');

const selectDataStore = () => {
  if (process.env.NODE_ENV === 'test' || !process.env.NEDB_MULTI_PORT) {
    return DataStore;
  }

  return createDataStore(Number(process.env.NEDB_MULTI_PORT));
};

module.exports = selectDataStore();
