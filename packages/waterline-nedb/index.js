/* eslint-disable consistent-return */
/* eslint-disable no-param-reassign */
/* eslint-disable no-shadow */
/* eslint-disable no-console */
const path = require('path');
const _ = require('lodash');
const async = require('async');
const flaverr = require('flaverr');
const fs = require('fs-extra');

const DataStore = require('./lib/store');
const normalizeWhere = require('./lib/where');

module.exports = (function WaterlineNEDB() {
  // Private var to track of all the datastores that use this adapter.  In order for your adapter
  // to support advanced features like transactions and native queries, you'll need
  // to expose this var publicly as well.  See the `registerDatastore` method for more info.
  //
  const datastores = {};

  // The main adapter object.
  const adapter = {
    // The identity of this adapter, to be referenced by datastore configurations in a Sails app.
    identity: 'waterline-nedb',

    // Waterline Adapter API Version
    adapterApiVersion: 1,

    // Default configuration for connections
    defaults: {
      schema: false,
      dir: '.tmp/localDiskDb',
    },

    // This allows outside access to the datastores, for use in advanced ORM methods like `.runTransaction()`.
    datastores,

    /**
     * Register a new datastore with this adapter.  This often involves creating a new connection
     * to the underlying database layer (e.g. MySQL, mongo, or a local file).
     *
     * Waterline calls this method once for every datastore that is configured to use this adapter.
     * This method is optional but strongly recommended.
     *
     * @param  {Object}   datastoreConfig  Dictionary of configuration options for this datastore (e.g. host, port, etc.)
     * @param  {Object}   models           Dictionary of model schemas using this datastore.
     * @param  {Function}     cb               Callback after successfully registering the datastore.
     */
    registerDatastore: function registerDatastore(datastoreConfig, models, cb) {
      let omen; // « used below for better stack traces

      // Get the unique identity for this datastore.
      const { identity } = datastoreConfig;
      if (!identity) {
        return cb(new Error('Invalid datastore config. A datastore should contain a unique identity property.'));
      }

      // Validate that the datastore isn't already initialized
      if (datastores[identity]) {
        throw new Error(`Datastore \`${identity}\` is already registered.`);
      }

      // Create a new datastore dictionary.
      const datastore = {
        config: datastoreConfig,
        // We'll add each model's nedb instance to this dictionary.
        dbs: {},
        // We'll keep track of any auto-increment sequences in this dictionary, indexed by table name.
        sequences: {},
        // We'll keep track of the primary keys of each model in this datastore in this dictionary,
        // indexed by table name.
        primaryKeyCols: {},
        // We'll keep track of every `ref` column in each model in this datastore in this dictionary,
        // indexed by table name.
        refCols: {},
      };

      // Add the datastore to the `datastores` dictionary.
      datastores[identity] = datastore;

      omen = new Error();
      (function determineDiskOrMemory(proceed) {
        if (datastoreConfig.inMemoryOnly === true) {
          return proceed();
        }
        // Ensure that the given folder exists
        fs.ensureDir(datastoreConfig.dir, (err) => {
          if (err) {
            return proceed(
              flaverr(
                {
                  message: `Could not load waterline-nedb adapter (could not ensure existence of directory for storing local data).  ${err.message}`,
                  raw: err,
                },
                omen
              )
            );
          }
          return proceed();
        });
      })((err) => {
        if (err) {
          return cb(flaverr({ message: err.message, raw: err }, omen));
        }

        // Create a new NeDB instance for each model (an NeDB instance is like one MongoDB collection),
        // and load the instance from disk.  The `loadDatabase` NeDB method is asynchronous, hence the async.each.
        async.each(
          _.keys(models),
          (modelIdentity, next) => {
            // Get the model definition.
            const modelDef = models[modelIdentity];

            const primaryKeyAttr = modelDef.definition[modelDef.primaryKey];

            // Ensure that the model's primary key has either `autoIncrement`, `required`, or `type: string` with no default
            // (in the latter scenario, mongo-like object ids will be used)
            if (
              (!primaryKeyAttr.autoMigrations || primaryKeyAttr.autoMigrations.autoIncrement !== true) &&
              primaryKeyAttr.required !== true &&
              (primaryKeyAttr.type !== 'string' || primaryKeyAttr.required)
            ) {
              return next(
                new Error(
                  `In model \`${modelIdentity}\`, primary key \`${modelDef.primaryKey}\` must have either \`autoIncrement\` set (for SQL-like ids), \`required: true\` for explicitly-set PKs (rare), or \`type: 'string'\` and optional (for mongo-like object IDs).`
                )
              );
            }

            // Get the model's primary key column.
            const primaryKeyCol = modelDef.definition[modelDef.primaryKey].columnName;

            // Store the primary key column in the datastore's primary key columns hash.
            datastore.primaryKeyCols[modelDef.tableName] = primaryKeyCol;

            // Declare a var to hold the table's sequence name (if any).
            let sequenceName = null;

            // Create the nedb instance and save it to the `modelDbs` hash
            let nedbConfig;
            if (datastoreConfig.inMemoryOnly) {
              nedbConfig = { inMemoryOnly: true };
            } else {
              nedbConfig = { filename: path.resolve(datastoreConfig.dir, `${modelDef.tableName}.db`) };
            }
            const db = new DataStore(nedbConfig);

            datastore.dbs[modelDef.tableName] = db;

            try {
              // Add any unique indexes and initialize any sequences.
              _.each(modelDef.definition, function (wlsAttrDef, attributeName) {
                // If the attribute has `unique` set on it, or it's the primary key, add a unique index.
                if (
                  (wlsAttrDef.autoMigrations && wlsAttrDef.autoMigrations.unique) ||
                  attributeName === modelDef.primaryKey
                ) {
                  if (
                    wlsAttrDef.autoMigrations &&
                    wlsAttrDef.autoMigrations.unique &&
                    !wlsAttrDef.required &&
                    !wlsAttrDef.foreignKey &&
                    attributeName !== modelDef.primaryKey
                  ) {
                    throw new Error(
                      `\nIn attribute \`${attributeName}\` of model \`${modelIdentity}\`:\n` +
                        'When using waterline-nedb, any attribute with `unique: true` must also have `required: true`\n'
                    );
                  }
                  db.ensureIndex({
                    fieldName: wlsAttrDef.columnName,
                    unique: true,
                  });
                }
                // Otherwise, remove any index that may have been added previously.
                else {
                  db.removeIndex(wlsAttrDef.columnName);
                }

                // If the attribute has `autoIncrement` on it, and it's the primary key,
                // initialize a sequence for it.
                if (
                  wlsAttrDef.autoMigrations &&
                  wlsAttrDef.autoMigrations.autoIncrement &&
                  attributeName === modelDef.primaryKey
                ) {
                  sequenceName = `${modelDef.tableName}_${wlsAttrDef.columnName}_seq`;
                  datastore.sequences[sequenceName] = 0;
                }

                datastore.refCols[modelDef.tableName] = datastore.refCols[modelDef.tableName] || [];
                // If the attribute is a ref, save it to the `refCols` dictionary.
                if (wlsAttrDef.type === 'ref') {
                  datastore.refCols[modelDef.tableName].push(wlsAttrDef.columnName);
                }
              }); // </ _.each() >
            } catch (err) {
              return next(err);
            }

            // Load the database from disk.  NeDB will replay any add/remove index calls before loading the data,
            // so making `loadDatabase` the last step ensures that we can safely migrate data without violating
            // key constraints that have been removed.
            omen = new Error();
            db.loadDatabase((err) => {
              if (err) {
                return next(
                  flaverr(
                    {
                      message: `waterline-nedb cannot load neDB database due to an unexpected error.  (This may be due to a recent configuration change in this app that made the old locally-stored data invalid.  To troubleshoot, try deleting .tmp/).  Technical details: ${err.message}`,
                      raw: err,
                    },
                    omen
                  )
                );
              }

              // If there's a sequence for this table, then load the records in reverse PK order
              // to get the last sequence value.
              if (sequenceName) {
                const sortObj = {};
                sortObj[primaryKeyCol] = -1;
                // Find the record with the highest PK value.
                omen = new Error();
                db.cursor()
                  .query({})
                  .sort(sortObj)
                  .limit(1)
                  .exec((err, records) => {
                    if (err) {
                      return next(flaverr({ message: err.message, raw: err }, omen));
                    }
                    // No records yet?  Leave the sequence at zero.
                    if (records.length === 0) {
                      return next(err);
                    }
                    // Otherwise set the sequence to the PK value.
                    datastore.sequences[sequenceName] = records[0][primaryKeyCol];
                    return next();
                  });
                return;
              }

              return next();
            });
          },
          cb
        ); // </ async.each() >
      }); // </ self-calling function>
    },

    /**
     * Fired when a datastore is unregistered, typically when the server
     * is killed. Useful for tearing-down remaining open connections,
     * etc.
     *
     * @param  {String} identity  (optional) The datastore to teardown.  If not provided, all datastores will be torn down.
     * @param  {Function} cb     Callback
     */
    teardown(identity, cb) {
      let datastoreIdentities = [];

      // If no specific identity was sent, teardown all the datastores
      if (!identity || identity === null) {
        datastoreIdentities = datastoreIdentities.concat(_.keys(datastores));
      } else {
        datastoreIdentities.push(identity);
      }

      // Teardown each datastore
      _.each(datastoreIdentities, function teardownDatastore(datastoreIdentity) {
        // Remove the datastore entry.
        delete datastores[datastoreIdentity];
      });

      return cb();
    },

    // Methods related to manipulating data stored in the database.

    /**
     * Add a new row to the table
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     cb            Callback
     */
    create: function create(datastoreName, query, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // Get the nedb for the table in question.
      const db = datastore.dbs[query.using];

      // If there is a sequence for this table, and the column name referenced in the table
      // does not have a value set, set it to the next value of the sequence.  Otherwise,
      // delete `_id` so a mongo-style object id will be used.
      const primaryKeyCol = datastore.primaryKeyCols[query.using];
      const sequenceName = `${query.using}_${primaryKeyCol}_seq`;
      if (!query.newRecord[primaryKeyCol]) {
        if (datastore.sequences[sequenceName] !== undefined) {
          query.newRecord[primaryKeyCol] = ++datastore.sequences[sequenceName];
        } else {
          delete query.newRecord[primaryKeyCol];
        }
      }
      // newRecord[primaryKeyCol] === 0

      // If the primary key col for this table isn't `_id`, set `_id` to the primary key value.
      if (primaryKeyCol !== '_id') {
        query.newRecord._id = query.newRecord[primaryKeyCol];
      }

      // Insert the documents into the db.
      db.insert(query.newRecord, (err, newRecord) => {
        if (err) {
          if (err.errorType === 'uniqueViolated') {
            err.footprint = {
              identity: 'notUnique',
            };
            // If we can infer which attribute this refers to, add a `keys` array to the error.
            // First, see if only one value in the new record matches the value that triggered the uniqueness violation.
            if (
              _.filter(_.values(query.newRecord), (val) => {
                return val === err.key;
              }).length === 1
            ) {
              // If so, find the key (i.e. column name) that this value was assigned to, add set that in the `keys` array.
              err.footprint.keys = [
                _.findKey(query.newRecord, (val) => {
                  return val === err.key;
                }),
              ];
            } else {
              err.footprint.keys = [];
            }
          }
          return cb(err);
        }
        if (query.meta && query.meta.fetch) {
          // If the primary key col for this table isn't `_id`, exclude `_id` from the returned records.
          if (primaryKeyCol !== '_id') {
            delete newRecord._id;
          }
          return cb(undefined, newRecord);
        }
        return cb();
      });
    },

    /**
     * Add multiple new rows to the table
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     cb            Callback
     */
    createEach: function createEach(datastoreName, query, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // Get the nedb for the table in question.
      const db = datastore.dbs[query.using];

      // Get the primary key column for thie table.
      const primaryKeyCol = datastore.primaryKeyCols[query.using];

      // Get the possible sequence name for this table.
      const sequenceName = `${query.using}_${primaryKeyCol}_seq`;

      const newRecords = _.map(query.newRecords, (newRecord) => {
        // If there is a sequence for this table, and the column name referenced in the table
        // does not have a value set, set it to the next value of the sequence.  Otherwise,
        // delete `_id` so a mongo-style object id will be used.
        if (!newRecord[primaryKeyCol]) {
          if (datastore.sequences[sequenceName] !== undefined) {
            newRecord[primaryKeyCol] = ++datastore.sequences[sequenceName];
          } else {
            delete newRecord[primaryKeyCol];
          }
        }

        // If the primary key col for this table isn't `_id`, set `_id` to the primary key value.
        if (primaryKeyCol !== '_id') {
          newRecord._id = newRecord[primaryKeyCol];
        }

        return newRecord;
      });

      // Insert the documents into the db.
      db.insert(newRecords, (err, newRecords) => {
        if (err) {
          if (err.errorType === 'uniqueViolated') {
            err.footprint = {
              identity: 'notUnique',
              keys: [],
            };
          }
          return cb(err);
        }
        if (query.meta && query.meta.fetch) {
          // If the primary key col for this table isn't `_id`, exclude `_id` from the returned records.
          if (primaryKeyCol !== '_id') {
            newRecords = _.map(newRecords, (newRecord) => {
              delete newRecord._id;
              return newRecord;
            });
          }
          return cb(undefined, newRecords);
        }
        return cb();
      });
    },

    /**
     * Select Query Logic
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     cb            Callback
     */
    find: function find(datastoreName, query, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // Get the nedb for the table in question.
      const db = datastore.dbs[query.using];

      const primaryKeyCol = datastore.primaryKeyCols[query.using];

      // Normalize the stage-3 query criteria into NeDB (really, MongoDB) criteria.
      const where = normalizeWhere(query.criteria.where, query.meta);

      // Transform the stage-3 query sort array into an NeDB sort dictionary.
      const sort = _.reduce(
        query.criteria.sort,
        (memo, sortObj) => {
          const key = _.first(_.keys(sortObj));
          memo[key] = sortObj[key].toLowerCase() === 'asc' ? 1 : -1;
          return memo;
        },
        {}
      );

      // Transform the stage-3 query select array into an NeDB projection dictionary.
      const projection = _.reduce(
        query.criteria.select,
        (memo, colName) => {
          memo[colName] = 1;
          return memo;
        },
        {}
      );

      // If the primary key col for this table isn't `_id`, exclude it from the returned records.
      if (primaryKeyCol !== '_id') {
        projection._id = 0;
      }

      // Create the initial adapter query.
      const findQuery = db.cursor().query(where).sort(sort).projection(projection);

      // Add in limit if necessary.
      if (query.criteria.limit) {
        findQuery.limit(query.criteria.limit);
      }

      // Add in skip if necessary.
      if (query.criteria.skip) {
        findQuery.skip(query.criteria.skip);
      }

      // Find the documents in the db.
      findQuery.exec((err, records) => {
        if (err) {
          return cb(err);
        }
        // Does this model contain any attributes with type `ref`?
        if (datastore.refCols[query.using].length > 0) {
          // If so, loop through the records and transform refs to Buffers where possible.
          _.each(records, (record) => {
            _.each(datastore.refCols[query.using], (colName) => {
              // If this looks like NeDB's idea of a serialized Buffer, turn it into a real buffer.
              if (record[colName] && record[colName].type === 'Buffer' && _.isArray(record[colName].data)) {
                record[colName] = Buffer.from(record[colName].data);
              }
            });
          });
        }
        // If the primary key column is `_id`, and we had a projection with just `_id`, transform the records
        // to only contain that column.  This is a workaround for an issue in NeDB where doing a projection
        // with just _id returns all the columns.
        if (primaryKeyCol === '_id' && _.keys(projection).length === 1 && projection._id === 1) {
          records = _.map(records, (record) => {
            return _.pick(record, '_id');
          });
        }
        return cb(undefined, records);
      });
    },

    /**
     * Update one or more models in the table
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     cb            Callback
     */
    update: function update(datastoreName, query, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // Get the nedb for the table in question.
      const db = datastore.dbs[query.using];

      // Get the primary key column for thie table.
      const primaryKeyCol = datastore.primaryKeyCols[query.using];

      // Normalize the stage-3 query criteria into NeDB (really, MongoDB) criteria.
      const where = normalizeWhere(query.criteria.where, query.meta);

      // If the user is attempting to change the primary key, do a drop/add instead.
      if (query.valuesToSet[primaryKeyCol]) {
        // Don't allow updating _id, since nedb doesn't support it.
        if (primaryKeyCol === '_id') {
          return cb(
            new Error('Cannot change primary key using waterline-nedb adapter when the primary key column is `_id`.')
          );
        }
        // Find the record in question.
        adapter.find(datastoreName, _.cloneDeep(query), (err, records) => {
          if (err) {
            return cb(err);
          }
          // Shortcut for when there is no matching record.
          if (records.length === 0) {
            return cb(undefined, query.meta && query.meta.fetch ? [] : undefined);
          }
          // If more than one record matches, throw an error since you can't update multiple records to have the same PK value.
          if (records.length > 1) {
            return cb(
              new Error('Cannot use `.update()` to change the primary key when the query matches multiple records.')
            );
          }
          // Get the single returned record.
          const record = records[0];
          // Destroy the record.
          adapter.destroy(datastoreName, _.cloneDeep(query), (err) => {
            if (err) {
              return cb(err);
            }
            // Remove the _id field; `.create()` will set it for us.
            delete record._id;
            // Update the record values with those that were sent in with the original `update` query.
            _.extend(record, query.valuesToSet);
            // Create a new record with the updated values.
            adapter.create(
              datastoreName,
              { using: query.using, newRecord: record, meta: query.meta },
              (err, record) => {
                if (err) {
                  return cb(err);
                }
                return cb(undefined, record ? [record] : undefined);
              }
            );
          });
        });
        return;
      }

      // If the primary key col for this table isn't `_id`, set `_id` to the primary key value.
      if (primaryKeyCol !== '_id' && query.valuesToSet[primaryKeyCol]) {
        query.valuesToSet._id = query.valuesToSet[primaryKeyCol];
      }

      // Update the documents in the db.
      db.update(
        where,
        { $set: query.valuesToSet },
        { multi: true, returnUpdatedDocs: true },
        (err, [_, updatedRecords]) => {
          if (err) {
            if (err.errorType === 'uniqueViolated') {
              err.footprint = {
                identity: 'notUnique',
              };
              // If we can infer which attribute this refers to, add a `keys` array to the error.
              // First, see if only one value in the updated data matches the value that triggered the uniqueness violation.
              if (
                _.filter(_.values(query.valuesToSet), (val) => {
                  return val === err.key;
                }).length === 1
              ) {
                // If so, find the key (i.e. column name) that this value was assigned to, add set that in the `keys` array.
                err.footprint.keys = [
                  _.findKey(query.valuesToSet, (val) => {
                    return val === err.key;
                  }),
                ];
              } else {
                err.footprint.keys = [];
              }
            }
            return cb(err);
          } // -•
          if (query.meta && query.meta.fetch) {
            // If the primary key col for this table isn't `_id`, exclude `_id` from the returned records.
            if (primaryKeyCol !== '_id') {
              updatedRecords = _.map(updatedRecords, (updatedRecord) => {
                delete updatedRecord._id;
                return updatedRecord;
              });
            }

            return cb(undefined, updatedRecords);
          }
          return cb(null, updatedRecords);
        }
      );
    },

    /**
     * Delete one or more records in a table
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     cb            Callback
     */
    destroy: function destroy(datastoreName, query, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // Get the nedb for the table in question.
      const db = datastore.dbs[query.using];

      // If `fetch` is true, find the records BEFORE we remove them so that we can
      // send them back to the caller.
      (function maybeFetchRecords(done) {
        if (query.meta && query.meta.fetch) {
          adapter.find(datastoreName, _.cloneDeep(query), function (err, records) {
            if (err) {
              return cb(err);
            }
            return done(records);
          });
        } else {
          return done();
        }
      })(function afterMaybeFetchingRecords(records) {
        // ~∞%°
        // Now, destroy the records.

        // Normalize the stage-3 query criteria into NeDB (really, MongoDB) criteria.
        const where = normalizeWhere(query.criteria.where, query.meta);

        // Remove the documents from the db.
        db.remove(where, { multi: true }, (err /* , numAffected */) => {
          if (err) {
            return cb(err);
          }

          // If `fetch` was true, `records` will hold the records we just destroyed.
          // (otherwise, it will be `undefined`)
          return cb(undefined, records);
        });
      }); // </ self-invoking function w/ callback >
    },

    /**
     * Find out the average of the query.
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     done            Callback
     */
    avg: function avg(datastoreName, query, done) {
      adapter.find(datastoreName, query, (err, records) => {
        if (err) {
          return done(err);
        }

        if (records.length === 0) {
          // see https://github.com/balderdashy/waterline/commit/cea8b5945acddac91bc4ab89a545dad8c25a6ba3
          return done(undefined, 0);
        }
        const total = _.reduce(
          records,
          (memo, row) => {
            return memo + row[query.numericAttrName];
          },
          0
        );
        const arithmeticMean = total / records.length;
        return done(undefined, arithmeticMean);
      });
    },

    /**
     * Find out the sum of the query.
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     done            Callback
     */
    sum: function sum(datastoreName, query, done) {
      adapter.find(datastoreName, query, (err, records) => {
        if (err) {
          return done(err);
        }

        if (records.length === 0) {
          // see https://github.com/balderdashy/waterline/commit/cea8b5945acddac91bc4ab89a545dad8c25a6ba3
          return done(undefined, 0);
        }
        const total = _.reduce(
          records,
          (memo, row) => {
            return memo + row[query.numericAttrName];
          },
          0
        );
        return done(undefined, total);
      });
    },

    /**
     * Return the number of matching records.
     * @param  {String}       datastoreName The name of the datastore to perform the query on.
     * @param  {Object}   query         The stage-3 query to perform.
     * @param  {Function}     cb            Callback
     */
    count: function count(datastoreName, query, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // Get the nedb for the table in question.
      const db = datastore.dbs[query.using];

      // Normalize the stage-3 query criteria into NeDB (really, MongoDB) criteria.
      const where = normalizeWhere(query.criteria.where, query.meta);

      // Count the documents into the db.
      db.count(where, cb);
    },

    /**
     * Build a new table in the database.
     *
     * (This is used to allow Sails to do auto-migrations)
     *
     * @param  {String}       datastoreName The name of the datastore containing the table to create.
     * @param  {String}       tableName     The name of the table to create.
     * @param  {Object}   definition    The table definition.
     * @param  {Function}     cb            Callback
     */
    define: function define(datastoreName, tableName, definition, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      let db;

      // If memory only, create a new in-memory nedb for the collection.
      if (datastore.config.inMemoryOnly === true) {
        db = new DataStore({ inMemoryOnly: true });
      } else {
        db = new DataStore({ filename: path.resolve(datastore.config.dir, `${tableName}.db`) });
      }

      datastore.dbs[tableName] = db;

      // Re-create any unique indexes.
      _.each(definition, (val, columnName) => {
        // If the attribute has `unique` set on it, or it's the primary key, add a unique index.
        if (val.unique || val.primaryKey) {
          db.ensureIndex({
            fieldName: columnName,
            unique: true,
          });
        }
      });

      return db.loadDatabase(cb);
    },

    /**
     * Remove a table from the database.
     *
     * @param  {String}       datastoreName The name of the datastore containing the table to create.
     * @param  {String}       tableName     The name of the table to create.
     * @param  {undefined}    relations     Currently unused
     * @param  {Function}     cb            Callback
     */
    drop: function drop(datastoreName, tableName, relations, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // If memory only, just remove the reference to the nedb for the collection.
      if (datastore.config.inMemoryOnly === true) {
        delete datastore.dbs[tableName];
        return cb();
      }

      // Delete the datastore file.
      const filename = path.resolve(datastore.config.dir, `${tableName}.db`);
      fs.remove(filename, (err) => {
        if (err) {
          return cb(err);
        }
        delete datastore.dbs[tableName];
        return cb();
      });
    },

    setSequence: function setSequence(datastoreName, sequenceName, sequenceValue, cb) {
      // Get a reference to the datastore.
      const datastore = datastores[datastoreName];
      if (!datastore) {
        return cb(
          new Error(
            `Unrecognized datastore: \`${datastoreName}\`,  It doesn't seem to have been registered with this adapter (waterline-nedb).`
          )
        );
      }

      // Set the sequence.
      datastore.sequences[sequenceName] = sequenceValue;

      return cb();
    },
  };

  if (process.env.DEBUG_QUERY) {
    _.each(adapter, (val, key) => {
      if (_.isFunction(val) && val.toString().match(/^function\s\w+?\(datastoreName, query/)) {
        adapter[key] = function (_null, query) {
          console.info(key.toUpperCase(), 'QUERY:');
          console.dir(query, { depth: null });
          console.info('--------\n');
          // eslint-disable-next-line prefer-rest-params
          val.apply(adapter, arguments);
        };
      }
    });
  }

  // Expose adapter definition
  return adapter;
})();
