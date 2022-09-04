/* eslint-disable jest/no-disabled-tests */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const chai = require('chai');
const fs = require('fs');

chai.should();

const _ = require('underscore');

const { PromisedDatastore: Datastore } = require('../lib/promise');

const testDb = 'workspace/promise.db';

describe('Promisify Database', () => {
  let db;

  beforeEach(async () => {
    // create db
    db = new Datastore({ filename: testDb });
    db.filename.should.equal(testDb);
    db.inMemoryOnly.should.equal(false);

    // clean db
    try {
      fs.existsSync(testDb);
      fs.unlinkSync(testDb);
    } catch {
      // eslint-disable-next-line no-console
      console.log('err');
    }

    // make sure db is empty
    await db.loadDatabase();
    db.getAllData().length.should.equal(0);
  });

  it('Can find data', async () => {
    const docs = await db.find();
    docs.length.should.equal(0);
  });

  it('Can insert data', async () => {
    await db.insert({ somedata: 'ok' });
    await db.insert({ somedata: 'another' });
    await db.insert({ somedata: 'again' });

    const docs = await db.find();
    docs.length.should.equal(3);
    _.pluck(docs, 'somedata').should.contain('ok');
    _.pluck(docs, 'somedata').should.contain('another');
    _.pluck(docs, 'somedata').should.contain('again');
  });

  it('Can update data', async () => {
    const { _id } = await db.insert({ somedata: 'ok' });
    const count = await db.update({ _id }, { somedata: 'updated' });

    const data = await db.findOne({ _id });
    data.somedata.should.equal('updated');
    count.should.equal(1);

    const [count1, doc] = await db.update({ _id }, { somedata: 'updated-1' }, { returnUpdatedDocs: true });
    count1.should.equal(1);
    doc.somedata.should.equal('updated-1');
  });

  it.skip('Can find skip & limit data', async () => {
    const rawList = Array.from(Array(10).keys());
    for (const i of rawList) {
      await db.insert({ somedata: i });
    }

    const data = await db.find().skip(2).limit(1);
    data[0].somedata.should.equal(2);
  });

  it.skip('Can find sort data', async () => {
    const rawList = Array.from(Array(3).keys());
    for (const i of rawList) {
      await db.insert({ somedata: i });
    }

    const data = await db.find().sort({ somedata: -1 });
    data[0].somedata.should.equal(2);
    data[2].somedata.should.equal(0);
  });

  it.skip('Can find projection data', async () => {
    const rawList = Array.from(Array(3).keys());
    for (const i of rawList) {
      await db.insert({ somedata: i, index: i + 1 });
    }

    const data = await db.find().projection({ somedata: 1, _id: 0 });
    data.should.deep.equal(rawList.map((item) => ({ somedata: item })));
  });

  it('Can count data', async () => {
    const rawList = Array.from(Array(3).keys());
    for (const i of rawList) {
      await db.insert({ somedata: i });
    }

    const data = await db.count();
    data.should.equal(rawList.length);
  });

  it('Can use with callback', (done) => {
    const rawList = Array.from(Array(3).keys());
    db.insert(
      rawList.map((i) => ({ somedata: i })),
      () => {
        db.count({}, (err, data) => {
          data.should.equal(rawList.length);
          done();
        });
      }
    );
  });
});
