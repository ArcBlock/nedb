/* eslint-disable jest/no-disabled-tests */
const should = require('chai').should();
const { assert } = require('chai');

const testDb = 'workspace/test.db';
const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const [AsyncWaterfall, AsyncApply] = [require('async/waterfall'), require('async/apply')];
const { DataStore } = require('../lib/datastore');
const Persistence = require('../lib/persistence');

if (process.env.CI) {
  return;
}

// Test that even if a callback throws an exception, the next DB operations will still be executed
// We prevent Mocha from catching the exception we throw on purpose by remembering all current handlers, remove them and register them back after test ends
function testThrowInCallback(d, done) {
  const currentUncaughtExceptionHandlers = process.listeners('uncaughtException');

  process.removeAllListeners('uncaughtException');

  process.on('uncaughtException', (err) => {
    // Do nothing with the error which is only there to test we stay on track
  });

  d.find({}, (err) => {
    process.nextTick(() => {
      d.insert({ bar: 1 }, (err) => {
        process.removeAllListeners('uncaughtException');
        setImmediate(() => {
          for (let i = 0; i < currentUncaughtExceptionHandlers.length; i++) {
            process.on('uncaughtException', currentUncaughtExceptionHandlers[i]);
          }

          done();
        });
      });
    });

    throw new Error('Some error');
  });
}

// Test that if the callback is falsy, the next DB operations will still be executed
function testFalsyCallback(d, done) {
  d.insert({ a: 1 }, null);
  process.nextTick(() => {
    d.update({ a: 1 }, { a: 2 }, {}, null);
    process.nextTick(() => {
      d.update({ a: 2 }, { a: 1 }, null);
      process.nextTick(() => {
        d.remove({ a: 2 }, {}, null);
        process.nextTick(() => {
          d.remove({ a: 2 }, null);
          process.nextTick(() => {
            d.find({}, done);
          });
        });
      });
    });
  });
}

// Test that operations are executed in the right order
// We prevent Mocha from catching the exception we throw on purpose by remembering all current handlers, remove them and register them back after test ends
function testRightOrder(d, done) {
  const currentUncaughtExceptionHandlers = process.listeners('uncaughtException');

  process.removeAllListeners('uncaughtException');

  process.on('uncaughtException', (err) => {
    // Do nothing with the error which is only there to test we stay on track
  });

  d.find({}, (err, docs) => {
    docs.length.should.equal(0);

    d.insert({ a: 1 }, () => {
      d.update({ a: 1 }, { a: 2 }, {}, () => {
        d.find({}, (err, docs) => {
          docs[0].a.should.equal(2);

          process.nextTick(() => {
            d.update({ a: 2 }, { a: 3 }, {}, () => {
              d.find({}, (err, docs) => {
                docs[0].a.should.equal(3);

                process.removeAllListeners('uncaughtException');
                for (let i = 0; i < currentUncaughtExceptionHandlers.length; i++) {
                  process.on('uncaughtException', currentUncaughtExceptionHandlers[i]);
                }

                done();
              });
            });
          });

          throw new Error('Some error');
        });
      });
    });
  });
}

// Note:  The following test does not have any assertion because it
// is meant to address the deprecation warning:
// (node) warning: Recursive process.nextTick detected. This will break in the next version of node. Please use setImmediate for recursive deferral.
// see
const testEventLoopStarvation = function (d, done) {
  const times = 1001;
  let i = 0;
  while (i < times) {
    i++;
    d.find({ bogus: 'search' }, (err, docs) => {});
  }
  done();
};

// Test that operations are executed in the right order even with no callback
function testExecutorWorksWithoutCallback(d, done) {
  d.insert({ a: 1 });
  d.insert({ a: 2 }, false);
  d.find({}, (err, docs) => {
    docs.length.should.equal(2);
    done();
  });
}

describe('Executor', () => {
  describe('With persistent database', () => {
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

    it('A falsy callback doesnt prevent execution of next operations', (done) => {
      testFalsyCallback(d, done);
    });

    it('Operations are executed in the right order', (done) => {
      testRightOrder(d, done);
    });

    it('Does not starve event loop and raise warning when more than 1000 callbacks are in queue', (done) => {
      testEventLoopStarvation(d, done);
    }).timeout(20000);

    it('Works in the right order even with no supplied callback', (done) => {
      testExecutorWorksWithoutCallback(d, done);
    });

    it('A throw in a callback doesnt prevent execution of next operations', (done) => {
      testThrowInCallback(d, done);
    });
  }); // ==== End of 'With persistent database' ====

  describe.skip('With non persistent database', () => {
    let d;

    beforeEach((done) => {
      d = new DataStore({ inMemoryOnly: true });
      d.inMemoryOnly.should.equal(true);

      d.loadDatabase((err) => {
        assert.isNull(err);
        d.getAllData().length.should.equal(0);
        return done();
      });
    });

    it('A falsy callback doesnt prevent execution of next operations', (done) => {
      testFalsyCallback(d, done);
    });

    it('Operations are executed in the right order', (done) => {
      testRightOrder(d, done);
    });

    it('Works in the right order even with no supplied callback', (done) => {
      testExecutorWorksWithoutCallback(d, done);
    });

    it('A throw in a callback doesnt prevent execution of next operations', (done) => {
      testThrowInCallback(d, done);
    });
  }); // ==== End of 'With non persistent database' ====
});
