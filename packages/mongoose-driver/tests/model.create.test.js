/**
 * Test dependencies.
 */

const assert = require('power-assert');
const start = require('./common');

const { mongoose, random } = start;

const { Schema, PromiseProvider } = mongoose;
const DocumentObjectId = mongoose.Types.ObjectId;

/**
 * Setup
 */

const schema = new Schema({
  title: { type: String, required: true },
});

describe('model', () => {
  describe('create()', () => {
    let db;
    let B;

    before(() => {
      db = start();
      B = db.model('model-create', schema, `model-create-${random()}`);
    });

    after((done) => {
      db.close(done);
    });

    it('accepts an array and returns an array', (done) => {
      B.create([{ title: 'hi' }, { title: 'bye' }], (err, posts) => {
        assert.ifError(err);

        assert.ok(posts instanceof Array);
        assert.equal(posts.length, 2);
        const post1 = posts[0];
        const post2 = posts[1];
        assert.ok(post1.get('_id') instanceof DocumentObjectId);
        assert.equal(post1.title, 'hi');

        assert.ok(post2.get('_id') instanceof DocumentObjectId);
        assert.equal(post2.title, 'bye');

        done();
      });
    });

    it('fires callback when passed 0 docs', (done) => {
      B.create((err, a) => {
        assert.ifError(err);
        assert.ok(!a);
        done();
      });
    });

    it('fires callback when empty array passed', (done) => {
      B.create([], (err, a) => {
        assert.ifError(err);
        assert.ok(!a);
        done();
      });
    });

    it('should not cause unhandled reject promise', (done) => {
      mongoose.Promise = global.Promise;
      mongoose.Promise = require('bluebird');

      B.create({ title: 'reject promise' }, (err, b) => {
        assert.ifError(err);

        let perr = null;
        const p = B.create({ _id: b._id }, (err) => {
          assert(err);
          setTimeout(() => {
            PromiseProvider.reset();
            // perr should be null
            done(perr);
          }, 100);
        });

        p.catch((err) => {
          // should not go here
          perr = err;
        });
      });
    });

    it('returns a promise', (done) => {
      var p = B.create({ title: 'returns promise' }, () => {
        assert.ok(p instanceof mongoose.Promise);
        done();
      });
    });

    it('creates in parallel', (done) => {
      const db = start();
      let countPre = 0;
      let countPost = 0;

      const SchemaWithPreSaveHook = new Schema({
        preference: String,
      });

      let startTime;
      let endTime;
      SchemaWithPreSaveHook.pre('save', true, (next, done) => {
        setTimeout(() => {
          countPre++;
          if (countPre === 1) startTime = Date.now();
          else if (countPre === 4) endTime = Date.now();
          next();
          done();
        }, 100);
      });
      SchemaWithPreSaveHook.post('save', () => {
        countPost++;
      });
      const MWPSH = db.model('mwpsh', SchemaWithPreSaveHook);
      MWPSH.create(
        [{ preference: 'xx' }, { preference: 'yy' }, { preference: '1' }, { preference: '2' }],
        (err, docs) => {
          assert.ifError(err);

          assert.ok(docs instanceof Array);
          assert.equal(docs.length, 4);
          const doc1 = docs[0];
          const doc2 = docs[1];
          const doc3 = docs[2];
          const doc4 = docs[3];
          assert.ok(doc1);
          assert.ok(doc2);
          assert.ok(doc3);
          assert.ok(doc4);
          assert.equal(countPre, 4);
          assert.equal(countPost, 4);
          assert.ok(endTime - startTime < 4 * 100); // serial: >= 4 * 100 parallel: < 4 * 100
          db.close(done);
        }
      );
    });

    describe('callback is optional', () => {
      it('with one doc', (done) => {
        const p = B.create({ title: 'optional callback' });
        p.then((doc) => {
          assert.equal(doc.title, 'optional callback');
          done();
        }, done).end();
      });

      it('with more than one doc', (done) => {
        const p = B.create({ title: 'optional callback 2' }, { title: 'orient expressions' });
        p.then((doc1, doc2) => {
          assert.equal(doc1.title, 'optional callback 2');
          assert.equal(doc2.title, 'orient expressions');
          done();
        }, done).end();
      });

      it('with array of docs', (done) => {
        const p = B.create([{ title: 'optional callback3' }, { title: '3' }]);
        p.then((docs) => {
          assert.ok(docs instanceof Array);
          assert.equal(docs.length, 2);
          const doc1 = docs[0];
          const doc2 = docs[1];
          assert.equal(doc1.title, 'optional callback3');
          assert.equal(doc2.title, '3');
          done();
        }, done).end();
      });

      it('and should reject promise on error', (done) => {
        const p = B.create({ title: 'optional callback 4' });
        p.then((doc) => {
          const p2 = B.create({ _id: doc._id });
          p2.then(
            () => {
              assert(false);
            },
            (err) => {
              assert(err);
              done();
            }
          ).end();
        }, done).end();
      });

      // FIXME: broken
      it.skip('if callback is falsy, will ignore it (gh-5061)', (done) => {
        B.create({ title: 'test' }, null)
          .then((doc) => {
            assert.equal(doc.title, 'test');
            done();
          })
          .catch(done);
      });
    });
  });
});
