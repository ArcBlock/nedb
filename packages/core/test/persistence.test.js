const should = require('chai').should();
const { assert } = require('chai');

const testDb = 'workspace/test.db';
const fs = require('fs');
const path = require('path');
const os = require('os');
const _ = require('underscore');
const [AsyncWaterfall, AsyncApply] = [require('async/waterfall'), require('async/apply')];
const child_process = require('child_process');
const model = require('../lib/model');
const customUtils = require('../lib/customUtils');
const { DataStore } = require('../lib/datastore');
const Persistence = require('../lib/persistence');
const storage = require('../lib/storage');

describe('Persistence', () => {
  let d;

  beforeEach((done) => {
    d = new DataStore({ filename: testDb });
    d.filename.should.equal(testDb);
    d.inMemoryOnly.should.equal(false);

    AsyncWaterfall(
      [
        function (cb) {
          Persistence.ensureDirectoryExists(path.dirname(testDb), () => {
            fs.exists(testDb, (exists) => {
              if (exists) {
                fs.unlink(testDb, cb);
              } else {
                return cb();
              }
            });
          });
        },
        function (cb) {
          d.loadDatabase((err) => {
            assert.isNull(err);
            d.getAllData().length.should.equal(0);
            return cb();
          });
        },
      ],
      done
    );
  });

  it('Every line represents a document', () => {
    const now = new Date();
    const rawData = `${model.serialize({ _id: '1', a: 2, ages: [1, 5, 12] })}\n${model.serialize({
      _id: '2',
      hello: 'world',
    })}\n${model.serialize({ _id: '3', nested: { today: now } })}`;
    const treatedData = d.persistence.treatRawData(rawData).data;
    treatedData.sort((a, b) => a._id - b._id);
    treatedData.length.should.equal(3);
    _.isEqual(treatedData[0], { _id: '1', a: 2, ages: [1, 5, 12] }).should.equal(true);
    _.isEqual(treatedData[1], { _id: '2', hello: 'world' }).should.equal(true);
    _.isEqual(treatedData[2], { _id: '3', nested: { today: now } }).should.equal(true);
  });

  it('Badly formatted lines have no impact on the treated data', () => {
    const now = new Date();
    const rawData =
      `${model.serialize({ _id: '1', a: 2, ages: [1, 5, 12] })}\n` +
      `garbage\n${model.serialize({ _id: '3', nested: { today: now } })}`;
    const treatedData = d.persistence.treatRawData(rawData).data;
    treatedData.sort((a, b) => a._id - b._id);
    treatedData.length.should.equal(2);
    _.isEqual(treatedData[0], { _id: '1', a: 2, ages: [1, 5, 12] }).should.equal(true);
    _.isEqual(treatedData[1], { _id: '3', nested: { today: now } }).should.equal(true);
  });

  it('Well formatted lines that have no _id are not included in the data', () => {
    const now = new Date();
    const rawData = `${model.serialize({ _id: '1', a: 2, ages: [1, 5, 12] })}\n${model.serialize({
      _id: '2',
      hello: 'world',
    })}\n${model.serialize({ nested: { today: now } })}`;
    const treatedData = d.persistence.treatRawData(rawData).data;
    treatedData.sort((a, b) => a._id - b._id);
    treatedData.length.should.equal(2);
    _.isEqual(treatedData[0], { _id: '1', a: 2, ages: [1, 5, 12] }).should.equal(true);
    _.isEqual(treatedData[1], { _id: '2', hello: 'world' }).should.equal(true);
  });

  it('If two lines concern the same doc (= same _id), the last one is the good version', () => {
    const now = new Date();
    const rawData = `${model.serialize({ _id: '1', a: 2, ages: [1, 5, 12] })}\n${model.serialize({
      _id: '2',
      hello: 'world',
    })}\n${model.serialize({ _id: '1', nested: { today: now } })}`;
    const treatedData = d.persistence.treatRawData(rawData).data;
    treatedData.sort((a, b) => a._id - b._id);
    treatedData.length.should.equal(2);
    _.isEqual(treatedData[0], { _id: '1', nested: { today: now } }).should.equal(true);
    _.isEqual(treatedData[1], { _id: '2', hello: 'world' }).should.equal(true);
  });

  it('If a doc contains $$deleted: true, that means we need to remove it from the data', () => {
    const now = new Date();
    const rawData = `${model.serialize({ _id: '1', a: 2, ages: [1, 5, 12] })}\n${model.serialize({
      _id: '2',
      hello: 'world',
    })}\n${model.serialize({ _id: '1', $$deleted: true })}\n${model.serialize({ _id: '3', today: now })}`;
    const treatedData = d.persistence.treatRawData(rawData).data;
    treatedData.sort((a, b) => a._id - b._id);
    treatedData.length.should.equal(2);
    _.isEqual(treatedData[0], { _id: '2', hello: 'world' }).should.equal(true);
    _.isEqual(treatedData[1], { _id: '3', today: now }).should.equal(true);
  });

  it('If a doc contains $$deleted: true, no error is thrown if the doc wasnt in the list before', () => {
    const now = new Date();
    const rawData = `${model.serialize({ _id: '1', a: 2, ages: [1, 5, 12] })}\n${model.serialize({
      _id: '2',
      $$deleted: true,
    })}\n${model.serialize({ _id: '3', today: now })}`;
    const treatedData = d.persistence.treatRawData(rawData).data;
    treatedData.sort((a, b) => a._id - b._id);
    treatedData.length.should.equal(2);
    _.isEqual(treatedData[0], { _id: '1', a: 2, ages: [1, 5, 12] }).should.equal(true);
    _.isEqual(treatedData[1], { _id: '3', today: now }).should.equal(true);
  });

  it('If a doc contains $$indexCreated, no error is thrown during treatRawData and we can get the index options', () => {
    const now = new Date();
    const rawData = `${model.serialize({ _id: '1', a: 2, ages: [1, 5, 12] })}\n${model.serialize({
      $$indexCreated: { fieldName: 'test', unique: true },
    })}\n${model.serialize({ _id: '3', today: now })}`;
    const treatedData = d.persistence.treatRawData(rawData).data;
    const { indexes } = d.persistence.treatRawData(rawData);
    Object.keys(indexes).length.should.equal(1);
    assert.deepEqual(indexes.test, { fieldName: 'test', unique: true });

    treatedData.sort((a, b) => a._id - b._id);
    treatedData.length.should.equal(2);
    _.isEqual(treatedData[0], { _id: '1', a: 2, ages: [1, 5, 12] }).should.equal(true);
    _.isEqual(treatedData[1], { _id: '3', today: now }).should.equal(true);
  });

  it('Compact database on load', (done) => {
    d.insert({ a: 2 }, () => {
      d.insert({ a: 4 }, () => {
        d.remove({ a: 2 }, {}, () => {
          // Here, the underlying file is 3 lines long for only one document
          const data = fs.readFileSync(d.filename, 'utf8').split('\n');
          let filledCount = 0;

          data.forEach((item) => {
            if (item.length > 0) {
              filledCount += 1;
            }
          });
          filledCount.should.equal(3);

          d.loadDatabase((err) => {
            assert.isNull(err);

            // Now, the file has been compacted and is only 1 line long
            const data = fs.readFileSync(d.filename, 'utf8').split('\n');
            let filledCount = 0;

            data.forEach((item) => {
              if (item.length > 0) {
                filledCount += 1;
              }
            });
            filledCount.should.equal(1);

            done();
          });
        });
      });
    });
  });

  it('Calling loadDatabase after the data was modified doesnt change its contents', (done) => {
    d.loadDatabase(() => {
      d.insert({ a: 1 }, (err) => {
        assert.isNull(err);
        d.insert({ a: 2 }, (err) => {
          const data = d.getAllData();
          const doc1 = _.find(data, (doc) => doc.a === 1);
          const doc2 = _.find(data, (doc) => doc.a === 2);
          assert.isNull(err);
          data.length.should.equal(2);
          doc1.a.should.equal(1);
          doc2.a.should.equal(2);

          d.loadDatabase((err) => {
            const data = d.getAllData();
            const doc1 = _.find(data, (doc) => doc.a === 1);
            const doc2 = _.find(data, (doc) => doc.a === 2);
            assert.isNull(err);
            data.length.should.equal(2);
            doc1.a.should.equal(1);
            doc2.a.should.equal(2);

            done();
          });
        });
      });
    });
  });

  it('Calling loadDatabase after the datafile was removed will reset the database', (done) => {
    d.loadDatabase(() => {
      d.insert({ a: 1 }, (err) => {
        assert.isNull(err);
        d.insert({ a: 2 }, (err) => {
          const data = d.getAllData();
          const doc1 = _.find(data, (doc) => doc.a === 1);
          const doc2 = _.find(data, (doc) => doc.a === 2);
          assert.isNull(err);
          data.length.should.equal(2);
          doc1.a.should.equal(1);
          doc2.a.should.equal(2);

          fs.unlink(testDb, (err) => {
            assert.isNull(err);
            d.loadDatabase((err) => {
              assert.isNull(err);
              d.getAllData().length.should.equal(0);

              done();
            });
          });
        });
      });
    });
  });

  it('Calling loadDatabase after the datafile was modified loads the new data', (done) => {
    d.loadDatabase(() => {
      d.insert({ a: 1 }, (err) => {
        assert.isNull(err);
        d.insert({ a: 2 }, (err) => {
          const data = d.getAllData();
          const doc1 = _.find(data, (doc) => doc.a === 1);
          const doc2 = _.find(data, (doc) => doc.a === 2);
          assert.isNull(err);
          data.length.should.equal(2);
          doc1.a.should.equal(1);
          doc2.a.should.equal(2);

          fs.writeFile(testDb, '{"a":3,"_id":"aaa"}', 'utf8', (err) => {
            assert.isNull(err);
            d.loadDatabase((err) => {
              const data = d.getAllData();
              const doc1 = _.find(data, (doc) => doc.a === 1);
              const doc2 = _.find(data, (doc) => doc.a === 2);
              const doc3 = _.find(data, (doc) => doc.a === 3);
              assert.isNull(err);
              data.length.should.equal(1);
              doc3.a.should.equal(3);
              assert.isUndefined(doc1);
              assert.isUndefined(doc2);

              done();
            });
          });
        });
      });
    });
  });

  it('When treating raw data, refuse to proceed if too much data is corrupt, to avoid data loss', (done) => {
    const corruptTestFilename = 'workspace/corruptTest.db';
    const fakeData =
      '{"_id":"one","hello":"world"}\n' +
      'Some corrupt data\n' +
      '{"_id":"two","hello":"earth"}\n' +
      '{"_id":"three","hello":"you"}\n';
    let d;
    fs.writeFileSync(corruptTestFilename, fakeData, 'utf8');

    // Default corruptAlertThreshold
    d = new DataStore({ filename: corruptTestFilename });
    d.loadDatabase((err) => {
      assert.isDefined(err);
      assert.isNotNull(err);

      fs.writeFileSync(corruptTestFilename, fakeData, 'utf8');
      d = new DataStore({ filename: corruptTestFilename, corruptAlertThreshold: 1 });
      d.loadDatabase((err) => {
        assert.isNull(err);

        fs.writeFileSync(corruptTestFilename, fakeData, 'utf8');
        d = new DataStore({ filename: corruptTestFilename, corruptAlertThreshold: 0 });
        d.loadDatabase((err) => {
          assert.isDefined(err);
          assert.isNotNull(err);

          done();
        });
      });
    });
  });

  it('Can listen to compaction events', (done) => {
    d.on('compaction.done', () => {
      d.removeAllListeners('compaction.done'); // Tidy up for next tests
      done();
    });

    d.persistence.compactDatafile();
  });

  describe('Serialization hooks', () => {
    const as = function (s) {
      return `before_${model.serialize(s)}_after`;
    };
    const bd = function (s) {
      s = s.substring(7, s.length - 6);
      return model.deserialize(s);
    };

    it('Declaring only one hook will throw an exception to prevent data loss', (done) => {
      const hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, () => {
        fs.writeFileSync(hookTestFilename, 'Some content', 'utf8');

        (function () {
          new DataStore({ filename: hookTestFilename, autoload: true, afterSerialization: as });
        }.should.throw());

        // Data file left untouched
        fs.readFileSync(hookTestFilename, 'utf8').should.equal('Some content');

        (function () {
          new DataStore({ filename: hookTestFilename, autoload: true, beforeDeserialization: bd });
        }.should.throw());

        // Data file left untouched
        fs.readFileSync(hookTestFilename, 'utf8').should.equal('Some content');

        done();
      });
    });

    it('Declaring two hooks that are not reverse of one another will cause an exception to prevent data loss', (done) => {
      const hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, () => {
        fs.writeFileSync(hookTestFilename, 'Some content', 'utf8');

        (function () {
          new DataStore({
            filename: hookTestFilename,
            autoload: true,
            afterSerialization: as,
            beforeDeserialization(s) {
              return s;
            },
          });
        }.should.throw());

        // Data file left untouched
        fs.readFileSync(hookTestFilename, 'utf8').should.equal('Some content');

        done();
      });
    });

    it('A serialization hook can be used to transform data before writing new state to disk', (done) => {
      const hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, () => {
        const d = new DataStore({
          filename: hookTestFilename,
          autoload: true,
          afterSerialization: as,
          beforeDeserialization: bd,
        });
        d.insert({ hello: 'world' }, () => {
          const _data = fs.readFileSync(hookTestFilename, 'utf8');
          const data = _data.split('\n');
          const doc0 = bd(data[0]);
          data.length.should.equal(2);

          data[0].substring(0, 7).should.equal('before_');
          data[0].substring(data[0].length - 6).should.equal('_after');

          Object.keys(doc0).length.should.equal(2);
          doc0.hello.should.equal('world');

          d.insert({ p: 'Mars' }, () => {
            const _data = fs.readFileSync(hookTestFilename, 'utf8');
            const data = _data.split('\n');
            const doc0 = bd(data[0]);
            const doc1 = bd(data[1]);
            data.length.should.equal(3);

            data[0].substring(0, 7).should.equal('before_');
            data[0].substring(data[0].length - 6).should.equal('_after');
            data[1].substring(0, 7).should.equal('before_');
            data[1].substring(data[1].length - 6).should.equal('_after');

            Object.keys(doc0).length.should.equal(2);
            doc0.hello.should.equal('world');

            Object.keys(doc1).length.should.equal(2);
            doc1.p.should.equal('Mars');

            d.ensureIndex({ fieldName: 'idefix' }, () => {
              const _data = fs.readFileSync(hookTestFilename, 'utf8');
              const data = _data.split('\n');
              const doc0 = bd(data[0]);
              const doc1 = bd(data[1]);
              const idx = bd(data[2]);
              data.length.should.equal(4);

              data[0].substring(0, 7).should.equal('before_');
              data[0].substring(data[0].length - 6).should.equal('_after');
              data[1].substring(0, 7).should.equal('before_');
              data[1].substring(data[1].length - 6).should.equal('_after');

              Object.keys(doc0).length.should.equal(2);
              doc0.hello.should.equal('world');

              Object.keys(doc1).length.should.equal(2);
              doc1.p.should.equal('Mars');

              assert.deepEqual(idx, { $$indexCreated: { fieldName: 'idefix' } });

              done();
            });
          });
        });
      });
    });

    it('Use serialization hook when persisting cached database or compacting', (done) => {
      const hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, () => {
        const d = new DataStore({
          filename: hookTestFilename,
          autoload: true,
          afterSerialization: as,
          beforeDeserialization: bd,
        });
        d.insert({ hello: 'world' }, () => {
          d.update({ hello: 'world' }, { $set: { hello: 'earth' } }, {}, () => {
            d.ensureIndex({ fieldName: 'idefix' }, () => {
              const _data = fs.readFileSync(hookTestFilename, 'utf8');
              const data = _data.split('\n');
              const doc0 = bd(data[0]);
              const doc1 = bd(data[1]);
              const idx = bd(data[2]);
              let _id;

              data.length.should.equal(4);

              Object.keys(doc0).length.should.equal(2);
              doc0.hello.should.equal('world');

              Object.keys(doc1).length.should.equal(2);
              doc1.hello.should.equal('earth');

              doc0._id.should.equal(doc1._id);
              _id = doc0._id;

              assert.deepEqual(idx, { $$indexCreated: { fieldName: 'idefix' } });

              d.persistence.persistCachedDatabase(() => {
                const _data = fs.readFileSync(hookTestFilename, 'utf8');
                const data = _data.split('\n');
                const doc0 = bd(data[0]);
                const idx = bd(data[1]);
                data.length.should.equal(3);

                Object.keys(doc0).length.should.equal(2);
                doc0.hello.should.equal('earth');

                doc0._id.should.equal(_id);

                assert.deepEqual(idx, { $$indexCreated: { fieldName: 'idefix', unique: false, sparse: false } });

                done();
              });
            });
          });
        });
      });
    });

    it('Deserialization hook is correctly used when loading data', (done) => {
      const hookTestFilename = 'workspace/hookTest.db';
      storage.ensureFileDoesntExist(hookTestFilename, () => {
        const d = new DataStore({
          filename: hookTestFilename,
          autoload: true,
          afterSerialization: as,
          beforeDeserialization: bd,
        });
        d.insert({ hello: 'world' }, (err, doc) => {
          const { _id } = doc;
          d.insert({ yo: 'ya' }, () => {
            d.update({ hello: 'world' }, { $set: { hello: 'earth' } }, {}, () => {
              d.remove({ yo: 'ya' }, {}, () => {
                d.ensureIndex({ fieldName: 'idefix' }, () => {
                  const _data = fs.readFileSync(hookTestFilename, 'utf8');
                  const data = _data.split('\n');
                  data.length.should.equal(6);

                  // Everything is deserialized correctly, including deletes and indexes
                  const d = new DataStore({
                    filename: hookTestFilename,
                    afterSerialization: as,
                    beforeDeserialization: bd,
                  });
                  d.loadDatabase(() => {
                    d.find({}, function (err, docs) {
                      docs.length.should.equal(1);
                      docs[0].hello.should.equal('earth');
                      docs[0]._id.should.equal(_id);

                      Object.keys(d.indexes).length.should.equal(2);
                      Object.keys(d.indexes).indexOf('idefix').should.not.equal(-1);

                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }); // ==== End of 'Serialization hooks' ==== //

  describe('Prevent dataloss when persisting data', () => {
    it('Creating a datastore with in memory as true and a bad filename wont cause an error', () => {
      new DataStore({ filename: 'workspace/bad.db~', inMemoryOnly: true });
    });

    it('Creating a persistent datastore with a bad filename will cause an error', () => {
      (function () {
        new DataStore({ filename: 'workspace/bad.db~' });
      }.should.throw());
    });

    it('If no file exists, ensureDatafileIntegrity creates an empty datafile', (done) => {
      const p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) {
        fs.unlinkSync('workspace/it.db');
      }
      if (fs.existsSync('workspace/it.db~')) {
        fs.unlinkSync('workspace/it.db~');
      }

      fs.existsSync('workspace/it.db').should.equal(false);
      fs.existsSync('workspace/it.db~').should.equal(false);

      storage.ensureDatafileIntegrity(p.filename, (err) => {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('');

        done();
      });
    });

    it('If only datafile exists, ensureDatafileIntegrity will use it', (done) => {
      const p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) {
        fs.unlinkSync('workspace/it.db');
      }
      if (fs.existsSync('workspace/it.db~')) {
        fs.unlinkSync('workspace/it.db~');
      }

      fs.writeFileSync('workspace/it.db', 'something', 'utf8');

      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~').should.equal(false);

      storage.ensureDatafileIntegrity(p.filename, (err) => {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');

        done();
      });
    });

    it('If temp datafile exists and datafile doesnt, ensureDatafileIntegrity will use it (cannot happen except upon first use)', (done) => {
      const p = new Persistence({ db: { inMemoryOnly: false, filename: 'workspace/it.db' } });

      if (fs.existsSync('workspace/it.db')) {
        fs.unlinkSync('workspace/it.db');
      }
      if (fs.existsSync('workspace/it.db~')) {
        fs.unlinkSync('workspace/it.db~~');
      }

      fs.writeFileSync('workspace/it.db~', 'something', 'utf8');

      fs.existsSync('workspace/it.db').should.equal(false);
      fs.existsSync('workspace/it.db~').should.equal(true);

      storage.ensureDatafileIntegrity(p.filename, (err) => {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(false);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('something');

        done();
      });
    });

    // Technically it could also mean the write was successful but the rename wasn't, but there is in any case no guarantee that the data in the temp file is whole so we have to discard the whole file
    it('If both temp and current datafiles exist, ensureDatafileIntegrity will use the datafile, as it means that the write of the temp file failed', (done) => {
      const theDb = new DataStore({ filename: 'workspace/it.db' });

      if (fs.existsSync('workspace/it.db')) {
        fs.unlinkSync('workspace/it.db');
      }
      if (fs.existsSync('workspace/it.db~')) {
        fs.unlinkSync('workspace/it.db~');
      }

      fs.writeFileSync('workspace/it.db', '{"_id":"0","hello":"world"}', 'utf8');
      fs.writeFileSync('workspace/it.db~', '{"_id":"0","hello":"other"}', 'utf8');

      fs.existsSync('workspace/it.db').should.equal(true);
      fs.existsSync('workspace/it.db~').should.equal(true);

      storage.ensureDatafileIntegrity(theDb.persistence.filename, (err) => {
        assert.isNull(err);

        fs.existsSync('workspace/it.db').should.equal(true);
        fs.existsSync('workspace/it.db~').should.equal(true);

        fs.readFileSync('workspace/it.db', 'utf8').should.equal('{"_id":"0","hello":"world"}');

        theDb.loadDatabase((err) => {
          assert.isNull(err);
          theDb.find({}, (err, docs) => {
            assert.isNull(err);
            docs.length.should.equal(1);
            docs[0].hello.should.equal('world');
            fs.existsSync('workspace/it.db').should.equal(true);
            fs.existsSync('workspace/it.db~').should.equal(false);
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents of the datafile and leave a clean state', (done) => {
      d.insert({ hello: 'world' }, () => {
        d.find({}, (err, docs) => {
          docs.length.should.equal(1);

          if (fs.existsSync(testDb)) {
            fs.unlinkSync(testDb);
          }
          if (fs.existsSync(`${testDb}~`)) {
            fs.unlinkSync(`${testDb}~`);
          }
          fs.existsSync(testDb).should.equal(false);

          fs.writeFileSync(`${testDb}~`, 'something', 'utf8');
          fs.existsSync(`${testDb}~`).should.equal(true);

          d.persistence.persistCachedDatabase((err) => {
            const contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(`${testDb}~`).should.equal(false);
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw new Error('Datafile contents not as expected');
            }
            done();
          });
        });
      });
    });

    it('After a persistCachedDatabase, there should be no temp or old filename', (done) => {
      d.insert({ hello: 'world' }, () => {
        d.find({}, (err, docs) => {
          docs.length.should.equal(1);

          if (fs.existsSync(testDb)) {
            fs.unlinkSync(testDb);
          }
          if (fs.existsSync(`${testDb}~`)) {
            fs.unlinkSync(`${testDb}~`);
          }
          fs.existsSync(testDb).should.equal(false);
          fs.existsSync(`${testDb}~`).should.equal(false);

          fs.writeFileSync(`${testDb}~`, 'bloup', 'utf8');
          fs.existsSync(`${testDb}~`).should.equal(true);

          d.persistence.persistCachedDatabase((err) => {
            const contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(`${testDb}~`).should.equal(false);
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw new Error('Datafile contents not as expected');
            }
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents of the datafile and leave a clean state even if there is a temp datafile', (done) => {
      d.insert({ hello: 'world' }, () => {
        d.find({}, (err, docs) => {
          docs.length.should.equal(1);

          if (fs.existsSync(testDb)) {
            fs.unlinkSync(testDb);
          }
          fs.writeFileSync(`${testDb}~`, 'blabla', 'utf8');
          fs.existsSync(testDb).should.equal(false);
          fs.existsSync(`${testDb}~`).should.equal(true);

          d.persistence.persistCachedDatabase((err) => {
            const contents = fs.readFileSync(testDb, 'utf8');
            assert.isNull(err);
            fs.existsSync(testDb).should.equal(true);
            fs.existsSync(`${testDb}~`).should.equal(false);
            if (!contents.match(/^{"hello":"world","_id":"[0-9a-zA-Z]{16}"}\n$/)) {
              throw new Error('Datafile contents not as expected');
            }
            done();
          });
        });
      });
    });

    it('persistCachedDatabase should update the contents of the datafile and leave a clean state even if there is a temp datafile', (done) => {
      const dbFile = 'workspace/test2.db';
      let theDb;

      if (fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
      }
      if (fs.existsSync(`${dbFile}~`)) {
        fs.unlinkSync(`${dbFile}~`);
      }

      theDb = new DataStore({ filename: dbFile });

      theDb.loadDatabase((err) => {
        const contents = fs.readFileSync(dbFile, 'utf8');
        assert.isNull(err);
        fs.existsSync(dbFile).should.equal(true);
        fs.existsSync(`${dbFile}~`).should.equal(false);
        if (contents != '') {
          throw new Error('Datafile contents not as expected');
        }
        done();
      });
    });

    it('Persistence works as expected when everything goes fine', (done) => {
      const dbFile = 'workspace/test2.db';
      let theDb;
      let theDb2;
      let doc1;
      let doc2;

      AsyncWaterfall(
        [
          AsyncApply(storage.ensureFileDoesntExist, dbFile),
          AsyncApply(storage.ensureFileDoesntExist, `${dbFile}~`),
          function (cb) {
            theDb = new DataStore({ filename: dbFile });
            theDb.loadDatabase(cb);
          },
          function (cb) {
            theDb.find({}, (err, docs) => {
              assert.isNull(err);
              docs.length.should.equal(0);
              return cb();
            });
          },
          function (cb) {
            theDb.insert({ a: 'hello' }, (err, _doc1) => {
              assert.isNull(err);
              doc1 = _doc1;
              theDb.insert({ a: 'world' }, (err, _doc2) => {
                assert.isNull(err);
                doc2 = _doc2;
                return cb();
              });
            });
          },
          function (cb) {
            theDb.find({}, (err, docs) => {
              assert.isNull(err);
              docs.length.should.equal(2);
              _.find(docs, (item) => item._id === doc1._id).a.should.equal('hello');
              _.find(docs, (item) => item._id === doc2._id).a.should.equal('world');
              return cb();
            });
          },
          function (cb) {
            theDb.loadDatabase(cb);
          },
          function (cb) {
            // No change
            theDb.find({}, (err, docs) => {
              assert.isNull(err);
              docs.length.should.equal(2);
              _.find(docs, (item) => item._id === doc1._id).a.should.equal('hello');
              _.find(docs, (item) => item._id === doc2._id).a.should.equal('world');
              return cb();
            });
          },
          function (cb) {
            fs.existsSync(dbFile).should.equal(true);
            fs.existsSync(`${dbFile}~`).should.equal(false);
            return cb();
          },
          function (cb) {
            theDb2 = new DataStore({ filename: dbFile });
            theDb2.loadDatabase(cb);
          },
          function (cb) {
            // No change in second db
            theDb2.find({}, (err, docs) => {
              assert.isNull(err);
              docs.length.should.equal(2);
              _.find(docs, (item) => item._id === doc1._id).a.should.equal('hello');
              _.find(docs, (item) => item._id === doc2._id).a.should.equal('world');
              return cb();
            });
          },
          function (cb) {
            fs.existsSync(dbFile).should.equal(true);
            fs.existsSync(`${dbFile}~`).should.equal(false);
            return cb();
          },
        ],
        done
      );
    });

    // The child process will load the database with the given datafile, but the fs.writeFile function
    // is rewritten to crash the process before it finished (after 5000 bytes), to ensure data was not lost
    /*
    it('If system crashes during a loadDatabase, the former version is not lost', function (done) {
      var N = 500, toWrite = "", i, doc_i;

      // Ensuring the state is clean
      if (fs.existsSync('workspace/lac.db')) { fs.unlinkSync('workspace/lac.db'); }
      if (fs.existsSync('workspace/lac.db~')) { fs.unlinkSync('workspace/lac.db~'); }

      // Creating a db file with 150k records (a bit long to load)
      for (i = 0; i < N; i ++) {
        toWrite += model.serialize({ _id: 'anid_' + i, hello: 'world' }) + '\n';
      }
      fs.writeFileSync('workspace/lac.db', toWrite, 'utf8');

      var datafileLength = fs.readFileSync('workspace/lac.db', 'utf8').length;

      // Loading it in a separate process that we will crash before finishing the loadDatabase
      child_process.fork('test_lac/loadAndCrash.test').on('exit', function (code) {
        code.should.equal(1);   // See test_lac/loadAndCrash.test.js

        fs.existsSync('workspace/lac.db').should.equal(true);
        fs.existsSync('workspace/lac.db~').should.equal(true);
        fs.readFileSync('workspace/lac.db', 'utf8').length.should.equal(datafileLength);
        fs.readFileSync('workspace/lac.db~', 'utf8').length.should.equal(5000);

        // Reload database without a crash, check that no data was lost and fs state is clean (no temp file)
        var db = new DataStore({ filename: 'workspace/lac.db' });
        db.loadDatabase(function (err) {
          assert.isNull(err);

          fs.existsSync('workspace/lac.db').should.equal(true);
          fs.existsSync('workspace/lac.db~').should.equal(false);
          fs.readFileSync('workspace/lac.db', 'utf8').length.should.equal(datafileLength);

          db.find({}, function (err, docs) {
            docs.length.should.equal(N);
            for (i = 0; i < N; i ++) {
              doc_i = _.find(docs, function (d) { return d._id === 'anid_' + i; });
              assert.isDefined(doc_i);
              assert.deepEqual({ hello: 'world', _id: 'anid_' + i }, doc_i);
            }
            return done();
          });
        });
      });
    }); */

    // Not run on Windows as there is no clean way to set maximum file descriptors. Not an issue as the code itself is tested.
    it('Cannot cause EMFILE errors by opening too many file descriptors', function (done) {
      this.timeout(30000);
      if (process.platform === 'win32' || process.platform === 'win64' || os.release().includes('Microsoft')) {
        return done();
      }
      child_process.execFile('test_lac/openFdsLaunch.sh', (err, stdout, stderr) => {
        if (err) {
          return done(err);
        }

        // The subprocess will not output anything to stdout unless part of the test fails
        if (stdout.length !== 0) {
          return done(stdout);
        }
        return done();
      });
    });
  }); // ==== End of 'Prevent dataloss when persisting data' ====

  describe('ensureFileDoesntExist', () => {
    it('Doesnt do anything if file already doesnt exist', (done) => {
      storage.ensureFileDoesntExist('workspace/nonexisting', (err) => {
        assert.isNull(err);
        fs.existsSync('workspace/nonexisting').should.equal(false);
        done();
      });
    });

    it('Deletes file if it exists', (done) => {
      fs.writeFileSync('workspace/existing', 'hello world', 'utf8');
      fs.existsSync('workspace/existing').should.equal(true);

      storage.ensureFileDoesntExist('workspace/existing', (err) => {
        assert.isNull(err);
        fs.existsSync('workspace/existing').should.equal(false);
        done();
      });
    });
  }); // ==== End of 'ensureFileDoesntExist' ====
});
