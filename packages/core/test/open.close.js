const should = require('chai').should();
const { assert } = require('chai');
const [AsyncWaterfall, AsyncApply] = [require('async/waterfall'), require('async/apply')];
const { DataStore } = require('../lib/datastore');

const closeDb = 'workspace/close.db';

describe('Database', () => {
  it('Can open and close cleanly', (done) => {
    const db = new DataStore({ filename: closeDb, autoload: true }, () => {});
    db.filename.should.equal(closeDb);

    db.inMemoryOnly.should.equal(false);

    db.insert({ somedata: 'ok' }, (err) => {
      assert.isNull(err);

      db.closeDatabase((err) => {
        db.insert({ somedata: 'ok' }, (err) => {
          err.message.should.equal('Attempting operation on closed database.');
        });

        try {
          db.insert({ somedata: 'ok' });
        } catch (e) {
          e.message.should.equal('Attempting operation on closed database.');
        }
        done();
      });
    });
  });

  it('Can reopen a closed database', (done) => {
    const db = new DataStore({ filename: closeDb, autoload: true }, () => {});
    db.find({}, (err, docs) => {
      assert.isNull(err, 'There were no errors');
      assert.isNotNull(docs, 'A result was returned');
      assert.isAbove(docs.length, 0, 'Some results exist');
      assert.isDefined(docs[0].somedata, 'somedata has been defined');
      docs[0].somedata.should.equal('ok');
      db.closeDatabase((err) => {
        done();
      });
    });
  });

  it('Can open multiple databases, and then close them again', (done) => {
    const multiOne = new DataStore({ filename: 'workspace/multiOne.db', autoload: true }, () => {});
    const multiTwo = new DataStore({ filename: 'workspace/multiTwo.db', autoload: true }, () => {});
    const multiThree = new DataStore({ filename: 'workspace/multiThree.db', autoload: true }, () => {});
    const multiFour = new DataStore({ filename: 'workspace/multiFour.db', autoload: true }, () => {});
    const multiFive = new DataStore({ filename: 'workspace/multiFive.db', autoload: true }, () => {});
    const multiSix = new DataStore({ filename: 'workspace/multiSix.db', autoload: true }, () => {});
    const multiSeven = new DataStore({ filename: 'workspace/multiSeven.db', autoload: true }, () => {});
    const multiEight = new DataStore({ filename: 'workspace/multiEight.db', autoload: true }, () => {});
    const multiNine = new DataStore({ filename: 'workspace/multiNine.db', autoload: true }, () => {});
    const multiTen = new DataStore({ filename: 'workspace/multiTen.db', autoload: true }, () => {});

    multiOne.closeDatabase((err) => {});
    multiTwo.closeDatabase((err) => {});
    multiThree.closeDatabase((err) => {});
    multiFour.closeDatabase((err) => {});
    multiFive.closeDatabase((err) => {});
    multiSix.closeDatabase((err) => {});
    multiSeven.closeDatabase((err) => {});
    multiEight.closeDatabase((err) => {});
    multiNine.closeDatabase((err) => {});
    multiTen.closeDatabase((err) => {
      done();
    });
  });
});
