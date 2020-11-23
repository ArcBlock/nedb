/* eslint-disable no-shadow */
/**
 * Test dependencies.
 */

const assert = require('power-assert');
const start = require('./common');

const { mongoose, random } = start;

const { Schema, Query } = mongoose;
const { ObjectId } = Schema.Types;
const MongooseBuffer = mongoose.Types.Buffer;
const DocumentObjectId = mongoose.Types.ObjectId;

describe('model: querying:', () => {
  let Comments;
  let BlogPostB;
  let collection;
  let ModSchema;
  let db;

  before(() => {
    db = start();
    Comments = new Schema();

    Comments.add({
      title: String,
      date: Date,
      body: String,
      comments: [Comments],
    });

    BlogPostB = new Schema({
      title: String,
      author: String,
      slug: String,
      date: Date,
      meta: {
        date: Date,
        visitors: Number,
      },
      published: Boolean,
      mixed: {},
      numbers: [Number],
      tags: [String],
      sigs: [Buffer],
      owners: [ObjectId],
      comments: [Comments],
      def: { type: String, default: 'kandinsky' },
    });

    mongoose.model('BlogPostB', BlogPostB);
    collection = `blogposts_${random()}`;

    ModSchema = new Schema({
      num: Number,
      str: String,
    });
    mongoose.model('Mod', ModSchema);
  });

  after((done) => {
    done();
  });

  const mongo26_or_greater = false;

  it('an empty find does not hang', (done) => {
    const BlogPostB = db.model('BlogPostB', collection);

    BlogPostB.find({}, () => {
      done();
    });
  });

  it('a query is executed when a callback is passed', (done) => {
    const BlogPostB = db.model('BlogPostB', collection);
    let count = 5;
    const q = { _id: new DocumentObjectId() }; // make sure the query is fast

    function fn() {
      if (--count) {
        return;
      }
      done();
    }

    // query
    assert.ok(BlogPostB.find(q, fn) instanceof Query);

    // query, fields (object)
    assert.ok(BlogPostB.find(q, {}, fn) instanceof Query);

    // query, fields (null)
    assert.ok(BlogPostB.find(q, null, fn) instanceof Query);

    // query, fields, options
    assert.ok(BlogPostB.find(q, {}, {}, fn) instanceof Query);

    // query, fields (''), options
    assert.ok(BlogPostB.find(q, '', {}, fn) instanceof Query);
  });

  it('query is executed where a callback for findOne', (done) => {
    const BlogPostB = db.model('BlogPostB', collection);
    let count = 5;
    const q = { _id: new DocumentObjectId() }; // make sure the query is fast

    function fn() {
      if (--count) {
        return;
      }
      done();
    }

    // query
    assert.ok(BlogPostB.findOne(q, fn) instanceof Query);

    // query, fields
    assert.ok(BlogPostB.findOne(q, {}, fn) instanceof Query);

    // query, fields (empty string)
    assert.ok(BlogPostB.findOne(q, '', fn) instanceof Query);

    // query, fields, options
    assert.ok(BlogPostB.findOne(q, {}, {}, fn) instanceof Query);

    // query, fields (null), options
    assert.ok(BlogPostB.findOne(q, null, {}, fn) instanceof Query);
  });

  it('find returns a Query', (done) => {
    const BlogPostB = db.model('BlogPostB', collection);

    // query
    assert.ok(BlogPostB.find({}) instanceof Query);

    // query, fields
    assert.ok(BlogPostB.find({}, {}) instanceof Query);

    // query, fields (empty string)
    assert.ok(BlogPostB.find({}, '') instanceof Query);

    // query, fields, options
    assert.ok(BlogPostB.find({}, {}, {}) instanceof Query);

    // query, fields (null), options
    assert.ok(BlogPostB.find({}, null, {}) instanceof Query);

    done();
  });

  it('findOne returns a Query', (done) => {
    const BlogPostB = db.model('BlogPostB', collection);

    // query
    assert.ok(BlogPostB.findOne({}) instanceof Query);

    // query, fields
    assert.ok(BlogPostB.findOne({}, {}) instanceof Query);

    // query, fields (empty string)
    assert.ok(BlogPostB.findOne({}, '') instanceof Query);

    // query, fields, options
    assert.ok(BlogPostB.findOne({}, {}, {}) instanceof Query);

    // query, fields (null), options
    assert.ok(BlogPostB.findOne({}, null, {}) instanceof Query);

    done();
  });

  describe('count', () => {
    // This will pass when run as only
    it('Query executes when you pass a callback', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      let pending = 2;

      function fn() {
        if (--pending) {
          return;
        }
        done();
      }

      assert.ok(BlogPostB.count({}, fn) instanceof Query);
      assert.ok(BlogPostB.count(fn) instanceof Query);
    });

    it('counts documents', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const title = `Wooooot ${random()}`;

      const post = new BlogPostB();
      post.set('title', title);

      post.save((err) => {
        assert.ifError(err);

        const post = new BlogPostB();
        post.set('title', title);

        post.save((err) => {
          assert.ifError(err);

          BlogPostB.count({ title }, (err, count) => {
            assert.ifError(err);

            assert.equal(typeof count, 'number');
            assert.equal(count, 2);

            done();
          });
        });
      });
    });

    it('returns a Query', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      assert.ok(BlogPostB.count({}) instanceof Query);
      done();
    });
  });

  describe.skip('distinct', () => {
    it('executes when you pass a callback', (done) => {
      const db = start();
      let Address = new Schema({ zip: String });
      Address = db.model('Address', Address, `addresses_${random()}`);

      Address.create({ zip: '10010' }, { zip: '10010' }, { zip: '99701' }, (err) => {
        assert.strictEqual(null, err);
        const query = Address.distinct('zip', {}, (err, results) => {
          assert.ifError(err);
          assert.equal(results.length, 2);
          assert.ok(results.indexOf('10010') > -1);
          assert.ok(results.indexOf('99701') > -1);
          done();
        });
        assert.ok(query instanceof Query);
      });
    });

    it('permits excluding conditions gh-1541', (done) => {
      let Address = new Schema({ zip: String });
      Address = db.model('Address', Address, `addresses_${random()}`);
      Address.create({ zip: '10010' }, { zip: '10010' }, { zip: '99701' }, (err) => {
        assert.ifError(err);
        Address.distinct('zip', (err, results) => {
          assert.ifError(err);
          assert.equal(results.length, 2);
          assert.ok(results.indexOf('10010') > -1);
          assert.ok(results.indexOf('99701') > -1);
          done();
        });
      });
    });
    it('returns a Query', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      assert.ok(BlogPostB.distinct('title', {}) instanceof Query);
      done();
    });
  });

  describe('update', () => {
    it('Query executes when you pass a callback', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      let count = 2;

      function fn() {
        if (--count) {
          return;
        }
        done();
      }

      assert.ok(BlogPostB.update({ title: random() }, {}, fn) instanceof Query);
      assert.ok(BlogPostB.update({ title: random() }, {}, {}, fn) instanceof Query);
    });

    it('can handle minimize option (gh-3381)', (done) => {
      const Model = db.model('gh3381', {
        name: String,
        mixed: Schema.Types.Mixed,
      });

      const query = Model.update({}, { mixed: {}, name: 'abc' }, { minimize: true });

      assert.ok(!query._update.$set.mixed);

      done();
    });
    it('returns a Query', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      assert.ok(BlogPostB.update({}, {}) instanceof Query);
      assert.ok(BlogPostB.update({}, {}, {}) instanceof Query);
      done();
    });
  });

  describe('findOne', () => {
    it('casts $modifiers', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const post = new BlogPostB({
        meta: {
          visitors: -10,
        },
      });

      post.save((err) => {
        assert.ifError(err);

        const query = { 'meta.visitors': { $gt: '-20', $lt: -1 } };
        BlogPostB.findOne(query, (err, found) => {
          assert.ifError(err);
          assert.ok(found);
          assert.equal(found.get('meta.visitors').valueOf(), post.get('meta.visitors').valueOf());
          found.id; // trigger caching
          assert.equal(found.get('_id').toString(), post.get('_id'));
          done();
        });
      });
    });

    // FIXME:
    it.skip('querying if an array contains one of multiple members $in a set', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      const post = new BlogPostB();

      post.tags.push('football');

      post.save((err) => {
        assert.ifError(err);

        BlogPostB.findOne({ tags: { $in: ['football', 'baseball'] } }, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc._id.toString(), post._id);

          BlogPostB.findOne({ _id: post._id, tags: /otba/i }, (err, doc) => {
            assert.ifError(err);
            assert.equal(doc._id.toString(), post._id);
            done();
          });
        });
      });
    });

    // FIXME:
    it.skip('querying if an array contains one of multiple members $in a set 2', (done) => {
      const BlogPostA = db.model('BlogPostB', collection);

      const post = new BlogPostA({ tags: ['gooberOne'] });

      post.save((err) => {
        assert.ifError(err);

        const query = { tags: { $in: ['gooberOne'] } };

        BlogPostA.findOne(query, (err, returned) => {
          cb();
          assert.ifError(err);
          assert.ok(!!~returned.tags.indexOf('gooberOne'));
          assert.equal(returned._id.toString(), post._id);
        });
      });

      post.collection.insert({ meta: { visitors: 9898, a: null } }, {}, (err, b) => {
        assert.ifError(err);

        BlogPostA.findOne({ _id: b.ops[0]._id }, (err, found) => {
          cb();
          assert.ifError(err);
          assert.equal(found.get('meta.visitors'), 9898);
        });
      });

      let pending = 2;

      function cb() {
        if (--pending) {
          return;
        }
        done();
      }
    });

    // FIXME:
    it.skip('querying via $where a string', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ title: 'Steve Jobs', author: 'Steve Jobs' }, (err, created) => {
        assert.ifError(err);

        BlogPostB.findOne({ $where: 'this.title && this.title === this.author' }, (err, found) => {
          assert.ifError(err);

          assert.equal(found._id.toString(), created._id);
          done();
        });
      });
    });

    // FIXME:
    it.skip('querying via $where a function', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ author: 'Atari', slug: 'Atari' }, (err, created) => {
        assert.ifError(err);

        BlogPostB.findOne(
          {
            $where() {
              return this.author && this.slug && this.author === this.slug;
            },
          },
          (err, found) => {
            assert.ifError(err);

            assert.equal(found._id.toString(), created._id);
            done();
          }
        );
      });
    });

    it('based on embedded doc fields (gh-242, gh-463)', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create(
        { comments: [{ title: 'i should be queryable' }], numbers: [1, 2, 33333], tags: ['yes', 'no'] },
        (err, created) => {
          assert.ifError(err);
          BlogPostB.findOne({ 'comments.title': 'i should be queryable' }, (err, found) => {
            assert.ifError(err);
            assert.equal(found._id.toString(), created._id);

            BlogPostB.findOne({ 'comments.0.title': 'i should be queryable' }, (err, found) => {
              assert.ifError(err);
              assert.equal(found._id.toString(), created._id);

              // GH-463
              BlogPostB.findOne({ 'numbers.2': 33333 }, (err, found) => {
                assert.ifError(err);
                assert.equal(found._id.toString(), created._id);

                BlogPostB.findOne({ 'tags.1': 'no' }, (err, found) => {
                  assert.ifError(err);
                  assert.equal(found._id.toString(), created._id);
                  done();
                });
              });
            });
          });
        }
      );
    });

    // FIXME: nedb matching does not support this yet
    it.skip('works with nested docs and string ids (gh-389)', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create(
        { comments: [{ title: 'i should be queryable by _id' }, { title: 'me too me too!' }] },
        (err, created) => {
          assert.ifError(err);
          const id = created.comments[1]._id.toString();
          BlogPostB.findOne({ 'comments._id': id }, (err, found) => {
            assert.ifError(err);
            assert.strictEqual(!!found, true, 'Find by nested doc id hex string fails');
            assert.equal(found._id.toString(), created._id);
            done();
          });
        }
      );
    });

    // FIXME: nedb matching does not support this yet
    it.skip('using #all with nested #elemMatch', (done) => {
      const P = db.model('BlogPostB', `${collection}_nestedElemMatch`);

      const post = new P({ title: 'nested elemMatch' });
      post.comments.push({ title: 'comment A' }, { title: 'comment B' }, { title: 'comment C' });

      const id1 = post.comments[1]._id;
      const id2 = post.comments[2]._id;

      post.save((err) => {
        assert.ifError(err);

        const query0 = { $elemMatch: { _id: id1, title: 'comment B' } };
        const query1 = { $elemMatch: { _id: id2.toString(), title: 'comment C' } };

        P.findOne({ comments: { $all: [query0, query1] } }, (err, p) => {
          assert.ifError(err);
          assert.equal(p.id, post.id);
          done();
        });
      });
    });

    it('using #or with nested #elemMatch', (done) => {
      const P = db.model('BlogPostB', collection);

      const post = new P({ title: 'nested elemMatch' });
      post.comments.push({ title: 'comment D' }, { title: 'comment E' }, { title: 'comment F' });

      const id1 = post.comments[1]._id;

      post.save((err) => {
        assert.ifError(err);

        const query0 = { comments: { $elemMatch: { title: 'comment Z' } } };
        const query1 = { comments: { $elemMatch: { _id: id1.toString(), title: 'comment E' } } };

        P.findOne({ $or: [query0, query1] }, (err, p) => {
          assert.ifError(err);
          assert.equal(p.id, post.id);
          done();
        });
      });
    });

    it.skip('regex with Array (gh-599)', (done) => {
      const B = db.model('BlogPostB', random());

      B.create({ tags: 'wooof baaaark meeeeow'.split(' ') }, (err) => {
        assert.ifError(err);
        B.findOne({ tags: /ooof$/ }, (err, doc) => {
          assert.ifError(err);
          assert.strictEqual(true, !!doc);
          assert.ok(!!~doc.tags.indexOf('meeeeow'));

          B.findOne({ tags: { $regex: 'eow$' } }, (err, doc) => {
            assert.ifError(err);
            assert.strictEqual(true, !!doc);
            assert.strictEqual(true, !!~doc.tags.indexOf('meeeeow'));
            done();
          });
        });
      });
    });

    it.skip('regex with options', (done) => {
      const B = db.model('BlogPostB', collection);

      const post = new B({ title: '$option queries' });
      post.save((err) => {
        assert.ifError(err);
        B.findOne({ title: { $regex: ' QUERIES$', $options: 'i' } }, (err, doc) => {
          assert.strictEqual(null, err, err && err.stack);
          assert.equal(doc.id, post.id);
          done();
        });
      });
    });

    it('works with $elemMatch and $in combo (gh-1100)', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const id1 = new DocumentObjectId();
      const id2 = new DocumentObjectId();

      BlogPostB.create({ owners: [id1, id2] }, (err, created) => {
        assert.ifError(err);
        BlogPostB.findOne({ owners: { $elemMatch: { $in: [id2.toString()] } } }, (err, found) => {
          assert.ifError(err);
          assert.ok(found);
          assert.equal(created.id, found.id);
          done();
        });
      });
    });

    it('based on nested fields', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const post = new BlogPostB({
        meta: {
          visitors: 5678,
        },
      });

      post.save((err, doc) => {
        assert.ifError(err);

        BlogPostB.findOne({ 'meta.visitors': 5678 }, (err, found) => {
          assert.ifError(err);
          assert.equal(found.get('meta.visitors').valueOf(), post.get('meta.visitors').valueOf());
          assert.equal(found.get('_id').toString(), post.get('_id'));
          done();
        });
      });
    });

    it('works', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const title = `Wooooot ${random()}`;

      const post = new BlogPostB();
      post.set('title', title);

      post.save((err) => {
        assert.ifError(err);

        BlogPostB.findOne({ title }, (err, doc) => {
          assert.ifError(err);
          assert.equal(title, doc.get('title'));
          assert.equal(doc.isNew, false);

          done();
        });
      });
    });
  });

  describe('findById', () => {
    it('handles undefined', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const title = `Edwald ${random()}`;

      const post = new BlogPostB();
      post.set('title', title);

      post.save((err) => {
        assert.ifError(err);

        BlogPostB.findById(undefined, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc, null);
          done();
        });
      });
    });

    it('works', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const title = `Edwald ${random()}`;

      const post = new BlogPostB();
      post.set('title', title);

      post.save((err) => {
        assert.ifError(err);

        let pending = 2;

        BlogPostB.findById(post.get('_id'), (err, doc) => {
          assert.ifError(err);
          assert.ok(doc instanceof BlogPostB);
          assert.equal(doc.get('title'), title);
          if (--pending) {
            return;
          }
          done();
        });

        BlogPostB.findById(post.get('_id').toHexString(), (err, doc) => {
          assert.ifError(err);
          assert.ok(doc instanceof BlogPostB);
          assert.equal(doc.get('title'), title);
          if (--pending) {
            return;
          }
          done();
        });
      });
    });

    it('works with partial initialization', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      let queries = 5;

      const post = new BlogPostB();

      post.title = 'hahaha';
      post.slug = 'woot';
      post.meta.visitors = 53;
      post.tags = ['humidity', 'soggy'];

      post.save((err) => {
        assert.ifError(err);

        BlogPostB.findById(post.get('_id'), (err, doc) => {
          assert.ifError(err);

          assert.equal(doc.isInit('title'), true);
          assert.equal(doc.isInit('slug'), true);
          assert.equal(doc.isInit('date'), false);
          assert.equal(doc.isInit('meta.visitors'), true);
          assert.equal(doc.meta.visitors.valueOf(), 53);
          assert.equal(doc.tags.length, 2);
          if (--queries) {
            return;
          }
          done();
        });

        BlogPostB.findById(post.get('_id'), 'title', (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.isInit('title'), true);
          assert.equal(doc.isInit('slug'), false);
          assert.equal(doc.isInit('date'), false);
          assert.equal(doc.isInit('meta.visitors'), false);
          assert.equal(doc.meta.visitors, undefined);
          assert.equal(doc.tags, undefined);
          if (--queries) {
            return;
          }
          done();
        });

        BlogPostB.findById(post.get('_id'), '-slug', (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.isInit('title'), true);
          assert.equal(doc.isInit('slug'), false);
          assert.equal(doc.isInit('date'), false);
          assert.equal(doc.isInit('meta.visitors'), true);
          assert.equal(doc.meta.visitors, 53);
          assert.equal(doc.tags.length, 2);
          if (--queries) {
            return;
          }
          done();
        });

        BlogPostB.findById(post.get('_id'), { title: 1 }, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.isInit('title'), true);
          assert.equal(doc.isInit('slug'), false);
          assert.equal(doc.isInit('date'), false);
          assert.equal(doc.isInit('meta.visitors'), false);
          assert.equal(doc.meta.visitors, undefined);
          assert.equal(doc.tags, undefined);
          if (--queries) {
            return;
          }
          done();
        });

        BlogPostB.findById(post.get('_id'), 'slug', (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.isInit('title'), false);
          assert.equal(doc.isInit('slug'), true);
          assert.equal(doc.isInit('date'), false);
          assert.equal(doc.isInit('meta.visitors'), false);
          assert.equal(doc.meta.visitors, undefined);
          assert.equal(doc.tags, undefined);
          if (--queries) {
            return;
          }
          done();
        });
      });
    });

    it('querying if an array contains at least a certain single member (gh-220)', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      const post = new BlogPostB();

      post.tags.push('cat');

      post.save((err) => {
        assert.ifError(err);

        BlogPostB.findOne({ tags: 'cat' }, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc._id.toString(), post._id);
          done();
        });
      });
    });

    it.skip('where an array where the $slice operator', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ numbers: [500, 600, 700, 800] }, (err, created) => {
        assert.ifError(err);
        BlogPostB.findById(created._id, { numbers: { $slice: 2 } }, (err, found) => {
          assert.ifError(err);
          assert.equal(found._id.toString(), created._id);
          assert.equal(found.numbers.length, 2);
          assert.equal(found.numbers[0], 500);
          assert.equal(found.numbers[1], 600);
          BlogPostB.findById(created._id, { numbers: { $slice: -2 } }, (err, found) => {
            assert.ifError(err);
            assert.equal(found._id.toString(), created._id);
            assert.equal(found.numbers.length, 2);
            assert.equal(found.numbers[0], 700);
            assert.equal(found.numbers[1], 800);
            BlogPostB.findById(created._id, { numbers: { $slice: [1, 2] } }, (err, found) => {
              assert.ifError(err);
              assert.equal(found._id.toString(), created._id);
              assert.equal(found.numbers.length, 2);
              assert.equal(found.numbers[0], 600);
              assert.equal(found.numbers[1], 700);
              done();
            });
          });
        });
      });
    });
  });

  describe('find', () => {
    it('works', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const title = `Wooooot ${random()}`;

      const post = new BlogPostB();
      post.set('title', title);

      post.save((err) => {
        assert.ifError(err);

        const post = new BlogPostB();
        post.set('title', title);

        post.save((err) => {
          assert.ifError(err);

          BlogPostB.find({ title }, (err, docs) => {
            assert.ifError(err);
            assert.equal(docs.length, 2);

            assert.equal(title, docs[0].get('title'));
            assert.equal(docs[0].isNew, false);

            assert.equal(title, docs[1].get('title'));
            assert.equal(docs[1].isNew, false);

            done();
          });
        });
      });
    });

    it('returns docs where an array that contains one specific member', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      BlogPostB.create({ numbers: [100, 101, 102] }, (err, created) => {
        assert.ifError(err);
        BlogPostB.find({ numbers: 100 }, (err, found) => {
          assert.ifError(err);
          assert.equal(found.length, 1);
          assert.equal(found[0]._id.toString(), created._id);
          done();
        });
      });
    });

    // FIXME: broken
    it.skip('works when comparing $ne with single value against an array', (done) => {
      const schema = new Schema({
        ids: [Schema.ObjectId],
        b: Schema.ObjectId,
      });

      const NE = db.model('NE_Test', schema, `nes__${random()}`);

      const id1 = new DocumentObjectId();
      const id2 = new DocumentObjectId();
      const id3 = new DocumentObjectId();
      const id4 = new DocumentObjectId();

      NE.create({ ids: [id1, id4], b: id3 }, (err) => {
        assert.ifError(err);
        NE.create({ ids: [id2, id4], b: id3 }, (err) => {
          assert.ifError(err);

          const query = NE.find({ b: id3.toString(), ids: { $ne: id1 } });
          query.exec((err, nes1) => {
            assert.ifError(err);
            assert.equal(nes1.length, 1);

            NE.find({ b: { $ne: [1] } }, (err) => {
              assert.equal(err.message, 'Cast to ObjectId failed for value "[ 1 ]" at path "b" for model "NE_Test"');

              NE.find({ b: { $ne: 4 } }, (err) => {
                assert.equal(err.message, 'Cast to ObjectId failed for value "4" at path "b" for model "NE_Test"');

                NE.find({ b: id3, ids: { $ne: id4 } }, (err, nes4) => {
                  assert.ifError(err);
                  assert.equal(nes4.length, 0);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('with partial initialization', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      let queries = 4;

      const post = new BlogPostB();

      post.title = 'hahaha';
      post.slug = 'woot';

      post.save((err) => {
        assert.ifError(err);

        BlogPostB.find({ _id: post.get('_id') }, (err, docs) => {
          assert.ifError(err);
          assert.equal(docs[0].isInit('title'), true);
          assert.equal(docs[0].isInit('slug'), true);
          assert.equal(docs[0].isInit('date'), false);
          assert.strictEqual('kandinsky', docs[0].def);
          if (--queries) {
            return;
          }
          done();
        });

        BlogPostB.find({ _id: post.get('_id') }, 'title', (err, docs) => {
          assert.ifError(err);
          assert.equal(docs[0].isInit('title'), true);
          assert.equal(docs[0].isInit('slug'), false);
          assert.equal(docs[0].isInit('date'), false);
          assert.strictEqual(undefined, docs[0].def);
          if (--queries) {
            return;
          }
          done();
        });

        BlogPostB.find({ _id: post.get('_id') }, { slug: 0, def: 0 }, (err, docs) => {
          assert.ifError(err);
          assert.equal(docs[0].isInit('title'), true);
          assert.equal(docs[0].isInit('slug'), false);
          assert.equal(docs[0].isInit('date'), false);
          assert.strictEqual(undefined, docs[0].def);
          if (--queries) {
            return;
          }
          done();
        });

        BlogPostB.find({ _id: post.get('_id') }, 'slug', (err, docs) => {
          assert.ifError(err);
          assert.equal(docs[0].isInit('title'), false);
          assert.equal(docs[0].isInit('slug'), true);
          assert.equal(docs[0].isInit('date'), false);
          assert.strictEqual(undefined, docs[0].def);
          if (--queries) {
            return;
          }
          done();
        });
      });
    });

    it('where $exists', (done) => {
      const ExistsSchema = new Schema({
        a: Number,
        b: String,
      });
      mongoose.model('Exists', ExistsSchema);
      const Exists = db.model('Exists', `exists_${random()}`);
      Exists.create({ a: 1 }, (err) => {
        assert.ifError(err);
        Exists.create({ b: 'hi' }, (err) => {
          assert.ifError(err);
          Exists.find({ b: { $exists: true } }, (err, docs) => {
            assert.ifError(err);
            assert.equal(docs.length, 1);
            done();
          });
        });
      });
    });

    it('works with $elemMatch (gh-1100)', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const id1 = new DocumentObjectId();
      const id2 = new DocumentObjectId();

      BlogPostB.create({ owners: [id1, id2] }, (err) => {
        assert.ifError(err);
        BlogPostB.find({ owners: { $elemMatch: { $in: [id2.toString()] } } }, (err, found) => {
          assert.ifError(err);
          assert.equal(found.length, 1);
          done();
        });
      });
    });

    it.skip('where $mod', (done) => {
      const Mod = db.model('Mod', `mods_${random()}`);
      Mod.create({ num: 1 }, (err, one) => {
        assert.ifError(err);
        Mod.create({ num: 2 }, (err) => {
          assert.ifError(err);
          Mod.find({ num: { $mod: [2, 1] } }, (err, found) => {
            assert.ifError(err);
            assert.equal(found.length, 1);
            assert.equal(found[0]._id.toString(), one._id);
            done();
          });
        });
      });
    });

    it.skip('where $not', (done) => {
      const Mod = db.model('Mod', `mods_${random()}`);
      Mod.create({ num: 1 }, (err) => {
        assert.ifError(err);
        Mod.create({ num: 2 }, (err, two) => {
          assert.ifError(err);
          Mod.find({ num: { $not: { $mod: [2, 1] } } }, (err, found) => {
            assert.ifError(err);
            assert.equal(found.length, 1);
            assert.equal(found[0]._id.toString(), two._id);
            done();
          });
        });
      });
    });

    it('where or()', (done) => {
      const Mod = db.model('Mod', `mods_${random()}`);

      Mod.create({ num: 1 }, { num: 2, str: 'two' }, (err, one, two) => {
        assert.ifError(err);

        let pending = 3;
        test1();
        test2();
        test3();

        function test1() {
          Mod.find({ $or: [{ num: 1 }, { num: 2 }] }, (err, found) => {
            cb();
            assert.ifError(err);
            assert.equal(found.length, 2);

            let found1 = false;
            let found2 = false;

            found.forEach((doc) => {
              if (doc.id === one.id) {
                found1 = true;
              } else if (doc.id === two.id) {
                found2 = true;
              }
            });

            assert.ok(found1);
            assert.ok(found2);
          });
        }

        function test2() {
          Mod.find({ $or: [{ str: 'two' }, { str: 'three' }] }, (err, found) => {
            cb();
            assert.ifError(err);
            assert.equal(found.length, 1);
            assert.equal(found[0]._id.toString(), two._id);
          });
        }

        function test3() {
          Mod.find({ $or: [{ num: 1 }] })
            .or([{ str: 'two' }])
            .exec((err, found) => {
              cb();
              assert.ifError(err);
              assert.equal(found.length, 2);

              let found1 = false;
              let found2 = false;

              found.forEach((doc) => {
                if (doc.id === one.id) {
                  found1 = true;
                } else if (doc.id === two.id) {
                  found2 = true;
                }
              });

              assert.ok(found1);
              assert.ok(found2);
            });
        }

        function cb() {
          if (--pending) {
            return;
          }
          done();
        }
      });
    });

    it('using $or with array of Document', (done) => {
      const Mod = db.model('Mod', `mods_${random()}`);

      Mod.create({ num: 1 }, (err, one) => {
        assert.ifError(err);
        Mod.find({ num: 1 }, (err, found) => {
          assert.ifError(err);
          Mod.find({ $or: found }, (err, found) => {
            assert.ifError(err);
            assert.equal(found.length, 1);
            assert.equal(found[0]._id.toString(), one._id);
            done();
          });
        });
      });
    });

    it('where $ne', (done) => {
      const Mod = db.model('Mod', `mods_${random()}`);
      Mod.create({ num: 1 }, (err) => {
        assert.ifError(err);
        Mod.create({ num: 2 }, (err, two) => {
          assert.ifError(err);
          Mod.create({ num: 3 }, (err, three) => {
            assert.ifError(err);
            Mod.find({ num: { $ne: 1 } }, (err, found) => {
              assert.ifError(err);

              assert.equal(found.length, 2);
              assert.equal(found[0]._id.toString(), two._id);
              assert.equal(found[1]._id.toString(), three._id);
              done();
            });
          });
        });
      });
    });

    it.skip('where $nor', (done) => {
      const Mod = db.model('Mod', `nor_${random()}`);

      Mod.create({ num: 1 }, { num: 2, str: 'two' }, (err, one, two) => {
        assert.ifError(err);

        let pending = 3;
        test1();
        test2();
        test3();

        function test1() {
          Mod.find({ $nor: [{ num: 1 }, { num: 3 }] }, (err, found) => {
            cb();
            assert.ifError(err);
            assert.equal(found.length, 1);
            assert.equal(found[0]._id.toString(), two._id);
          });
        }

        function test2() {
          Mod.find({ $nor: [{ str: 'two' }, { str: 'three' }] }, (err, found) => {
            cb();
            assert.ifError(err);
            assert.equal(found.length, 1);
            assert.equal(found[0]._id.toString(), one._id);
          });
        }

        function test3() {
          Mod.find({ $nor: [{ num: 2 }] })
            .nor([{ str: 'two' }])
            .exec((err, found) => {
              cb();
              assert.ifError(err);
              assert.equal(found.length, 1);
              assert.equal(found[0]._id.toString(), one._id);
            });
        }

        function cb() {
          if (--pending) {
            return;
          }
          done();
        }
      });
    });

    it('STRICT null matches', (done) => {
      const BlogPostB = db.model('BlogPostB', collection + random());

      const a = { title: 'A', author: null };
      const b = { title: 'B' };
      BlogPostB.create(a, b, (err, createdA) => {
        assert.ifError(err);
        BlogPostB.find({ author: { $in: [null], $exists: true } }, (err, found) => {
          assert.ifError(err);
          assert.equal(found.length, 1);
          assert.equal(found[0]._id.toString(), createdA._id);
          done();
        });
      });
    });

    // FIXME:
    it.skip('null matches null and undefined', (done) => {
      const BlogPostB = db.model('BlogPostB', collection + random());

      BlogPostB.create({ title: 'A', author: null }, { title: 'B' }, (err) => {
        assert.ifError(err);
        BlogPostB.find({ author: null }, (err, found) => {
          assert.ifError(err);
          assert.equal(found.length, 2);
          done();
        });
      });
    });

    it.skip('a document whose arrays contain at least $all string values', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      const post = new BlogPostB({ title: 'Aristocats' });

      post.tags.push('onex');
      post.tags.push('twox');
      post.tags.push('threex');

      post.save((err) => {
        assert.ifError(err);

        BlogPostB.findById(post._id, (err, post) => {
          assert.ifError(err);

          BlogPostB.find({ title: { $all: ['Aristocats'] } }, (err, docs) => {
            assert.ifError(err);
            assert.equal(docs.length, 1);

            BlogPostB.find({ title: { $all: [/^Aristocats/] } }, (err, docs) => {
              assert.ifError(err);
              assert.equal(docs.length, 1);

              BlogPostB.find({ tags: { $all: ['onex', 'twox', 'threex'] } }, (err, docs) => {
                assert.ifError(err);
                assert.equal(docs.length, 1);

                BlogPostB.find({ tags: { $all: [/^onex/i] } }, (err, docs) => {
                  assert.ifError(err);
                  assert.equal(docs.length, 1);

                  BlogPostB.findOne({ tags: { $all: /^two/ } }, (err, doc) => {
                    assert.ifError(err);
                    assert.equal(post.id, doc.id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it.skip('using #nor with nested #elemMatch', (done) => {
      const P = db.model('BlogPostB', `${collection}_norWithNestedElemMatch`);

      const p0 = { title: 'nested $nor elemMatch1', comments: [] };

      const p1 = { title: 'nested $nor elemMatch0', comments: [] };
      p1.comments.push({ title: 'comment X' }, { title: 'comment Y' }, { title: 'comment W' });

      P.create(p0, p1, (err, post0, post1) => {
        assert.ifError(err);

        const id = post1.comments[1]._id;

        const query0 = { comments: { $elemMatch: { title: 'comment Z' } } };
        const query1 = { comments: { $elemMatch: { _id: id.toString(), title: 'comment Y' } } };

        P.find({ $nor: [query0, query1] }, (err, posts) => {
          assert.ifError(err);
          assert.equal(posts.length, 1);
          assert.equal(posts[0].id, post0.id);
          done();
        });
      });
    });

    it('strings via regexp', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ title: 'Next to Normal' }, (err, created) => {
        assert.ifError(err);
        BlogPostB.findOne({ title: /^Next/ }, (err, found) => {
          assert.ifError(err);
          assert.equal(found._id.toString(), created._id);
          const reg = '^Next to Normal$';
          done();
        });
      });
    });

    it.skip('a document whose arrays contain at least $all values', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const a1 = { numbers: [-1, -2, -3, -4], meta: { visitors: 4 } };
      const a2 = { numbers: [0, -1, -2, -3, -4] };
      BlogPostB.create(a1, a2, (err, whereoutZero, whereZero) => {
        assert.ifError(err);

        BlogPostB.find({ numbers: { $all: [-1, -2, -3, -4] } }, (err, found) => {
          assert.ifError(err);
          assert.equal(found.length, 2);
          BlogPostB.find({ 'meta.visitors': { $all: [4] } }, (err, found) => {
            assert.ifError(err);
            assert.equal(found.length, 1);
            assert.equal(found[0]._id.toString(), whereoutZero._id);
            BlogPostB.find({ numbers: { $all: [0, -1] } }, (err, found) => {
              assert.ifError(err);
              assert.equal(found.length, 1);
              assert.equal(found[0]._id.toString(), whereZero._id);
              done();
            });
          });
        });
      });
    });

    it('where $size', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, (err) => {
        assert.ifError(err);
        BlogPostB.create({ numbers: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] }, (err) => {
          assert.ifError(err);
          BlogPostB.create({ numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, (err) => {
            assert.ifError(err);
            BlogPostB.find({ numbers: { $size: 10 } }, (err, found) => {
              assert.ifError(err);
              assert.equal(found.length, 2);
              BlogPostB.find({ numbers: { $size: 11 } }, (err, found) => {
                assert.ifError(err);
                assert.equal(found.length, 1);
                done();
              });
            });
          });
        });
      });
    });

    it('$gt, $lt, $lte, $gte work on strings', (done) => {
      const D = db.model('D', new Schema({ dt: String }), collection);

      D.create({ dt: '2011-03-30' }, cb);
      D.create({ dt: '2011-03-31' }, cb);
      D.create({ dt: '2011-04-01' }, cb);
      D.create({ dt: '2011-04-02' }, cb);

      let pending = 4;

      function cb(err) {
        if (err) {
        }
        assert.ifError(err);

        if (--pending) {
          return;
        }

        pending = 2;

        D.find({ dt: { $gte: '2011-03-30', $lte: '2011-04-01' } })
          .sort('dt')
          .exec((err, docs) => {
            if (!--pending) {
              done();
            }
            assert.ifError(err);
            assert.equal(docs.length, 3);
            assert.equal(docs[0].dt, '2011-03-30');
            assert.equal(docs[1].dt, '2011-03-31');
            assert.equal(docs[2].dt, '2011-04-01');
            assert.ok(!docs.some((d) => d.dt === '2011-04-02'));
          });

        D.find({ dt: { $gt: '2011-03-30', $lt: '2011-04-02' } })
          .sort('dt')
          .exec((err, docs) => {
            if (!--pending) {
              done();
            }
            assert.ifError(err);
            assert.equal(docs.length, 2);
            assert.equal(docs[0].dt, '2011-03-31');
            assert.equal(docs[1].dt, '2011-04-01');
            assert.ok(!docs.some((d) => d.dt === '2011-03-30'));
            assert.ok(!docs.some((d) => d.dt === '2011-04-02'));
          });
      }
    });

    describe('text search indexes', () => {
      it('works with text search ensure indexes ', (done) => {
        if (!mongo26_or_greater) {
          return done();
        }

        const blogPost = db.model('BlogPostB', collection);

        blogPost.collection.ensureIndex({ title: 'text' }, (error) => {
          assert.ifError(error);
          const a = new blogPost({ title: 'querying in mongoose' });
          const b = new blogPost({ title: 'text search in mongoose' });
          a.save((error) => {
            assert.ifError(error);
            b.save((error) => {
              assert.ifError(error);
              blogPost
                .find({ $text: { $search: 'text search' } }, { score: { $meta: 'textScore' } })
                .limit(2)
                .exec((error, documents) => {
                  assert.ifError(error);
                  assert.equal(documents.length, 1);
                  assert.equal(documents[0].title, 'text search in mongoose');
                  a.remove((error) => {
                    assert.ifError(error);
                    b.remove((error) => {
                      assert.ifError(error);
                      done();
                    });
                  });
                });
            });
          });
        });
      });

      it('works when text search is called by a schema (gh-3824)', (done) => {
        if (!mongo26_or_greater) {
          return done();
        }

        const exampleSchema = new Schema({
          title: String,
          name: { type: String, text: true },
          large_text: String,
        });

        const Example = db.model('gh3824', exampleSchema);

        Example.on('index', (error) => {
          assert.ifError(error);
          Example.findOne({ $text: { $search: 'text search' } }, (error) => {
            assert.ifError(error);
            done();
          });
        });
      });
    });
  });

  describe('limit', () => {
    it('works', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ title: 'first limit' }, (err, first) => {
        assert.ifError(err);
        BlogPostB.create({ title: 'second limit' }, (err, second) => {
          assert.ifError(err);
          BlogPostB.create({ title: 'third limit' }, (err) => {
            assert.ifError(err);
            BlogPostB.find({ title: /limit$/ })
              .limit(2)
              .find((err, found) => {
                assert.ifError(err);
                assert.equal(found.length, 2);
                assert.equal(found[0].id, first.id);
                assert.equal(found[1].id, second.id);
                done();
              });
          });
        });
      });
    });
  });

  describe('skip', () => {
    it('works', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ title: '1 skip' }, (err) => {
        assert.ifError(err);
        BlogPostB.create({ title: '2 skip' }, (err, second) => {
          assert.ifError(err);
          BlogPostB.create({ title: '3 skip' }, (err, third) => {
            assert.ifError(err);
            BlogPostB.find({ title: /skip$/ })
              .sort({ title: 1 })
              .skip(1)
              .limit(2)
              .find((err, found) => {
                assert.ifError(err);
                assert.equal(found.length, 2);
                assert.equal(found[0].id, second._id);
                assert.equal(found[1].id, third._id);
                done();
              });
          });
        });
      });
    });
  });

  describe('sort', () => {
    it('works', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.create({ meta: { visitors: 100 } }, (err, least) => {
        assert.ifError(err);
        BlogPostB.create({ meta: { visitors: 300 } }, (err, largest) => {
          assert.ifError(err);
          BlogPostB.create({ meta: { visitors: 200 } }, (err, middle) => {
            assert.ifError(err);
            BlogPostB.where('meta.visitors')
              .gt(99)
              .lt(301)
              .sort('-meta.visitors')
              .find((err, found) => {
                assert.ifError(err);
                assert.equal(found.length, 3);
                assert.equal(found[0].id, largest._id);
                assert.equal(found[1].id, middle._id);
                assert.equal(found[2].id, least._id);
                done();
              });
          });
        });
      });
    });
    it('handles sorting by text score', (done) => {
      if (!mongo26_or_greater) {
        return done();
      }

      const blogPost = db.model('BlogPostB', collection);

      blogPost.collection.ensureIndex({ title: 'text' }, (error) => {
        assert.ifError(error);
        const a = new blogPost({ title: 'searching in mongoose' });
        const b = new blogPost({ title: 'text search in mongoose' });
        a.save((error) => {
          assert.ifError(error);
          b.save((error) => {
            assert.ifError(error);
            blogPost
              .find({ $text: { $search: 'text search' } }, { score: { $meta: 'textScore' } })
              .sort({ score: { $meta: 'textScore' } })
              .limit(2)
              .exec((error, documents) => {
                assert.ifError(error);
                assert.equal(documents.length, 2);
                assert.equal(documents[0].title, 'text search in mongoose');
                assert.equal(documents[1].title, 'searching in mongoose');
                done();
              });
          });
        });
      });
    });
  });

  describe('nested mixed "x.y.z"', () => {
    it('works', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);

      BlogPostB.find({ 'mixed.nested.stuff': 'skynet' }, (err) => {
        assert.ifError(err);
        done();
      });
    });
  });

  it('by Date (gh-336)', (done) => {
    // GH-336
    const Test = db.model('TestDateQuery', new Schema({ date: Date }), `datetest_${random()}`);
    const now = new Date();

    Test.create({ date: now }, { date: new Date(now - 10000) }, (err) => {
      assert.ifError(err);
      Test.find({ date: now }, (err, docs) => {
        assert.ifError(err);
        assert.equal(docs.length, 1);
        done();
      });
    });
  });

  it('mixed types with $elemMatch (gh-591)', (done) => {
    const S = new Schema({ a: [{}], b: Number });
    const M = db.model('QueryingMixedArrays', S, random());

    const m = new M();
    m.a = [1, 2, { name: 'Frodo' }, 'IDK', { name: 100 }];
    m.b = 10;

    m.save((err) => {
      assert.ifError(err);

      M.find({ a: { name: 'Frodo' }, b: '10' }, (err, docs) => {
        assert.ifError(err);
        assert.equal(docs[0].a.length, 5);
        assert.equal(docs[0].b.valueOf(), 10);

        const query = {
          a: {
            $elemMatch: { name: 100 },
          },
        };

        M.find(query, (err, docs) => {
          assert.ifError(err);
          assert.equal(docs[0].a.length, 5);
          done();
        });
      });
    });
  });

  describe.skip('$all', () => {
    it('with ObjectIds (gh-690)', (done) => {
      const SSchema = new Schema({ name: String });
      const PSchema = new Schema({ sub: [SSchema] });

      const P = db.model('usingAllWithObjectIds', PSchema);
      const sub = [{ name: 'one' }, { name: 'two' }, { name: 'three' }];

      P.create({ sub }, (err, p) => {
        assert.ifError(err);

        const o0 = p.sub[0]._id;
        const o1 = p.sub[1]._id;
        const o2 = p.sub[2]._id;

        P.findOne({ 'sub._id': { $all: [o1, o2.toString()] } }, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.id, p.id);

          P.findOne({ 'sub._id': { $all: [o0, new DocumentObjectId()] } }, (err, doc) => {
            assert.ifError(err);
            assert.equal(!!doc, false);

            P.findOne({ 'sub._id': { $all: [o2] } }, (err, doc) => {
              assert.ifError(err);
              assert.equal(doc.id, p.id);
              done();
            });
          });
        });
      });
    });

    it('with Dates', function (done) {
      this.timeout(process.env.TRAVIS ? 8000 : 4500);
      const SSchema = new Schema({ d: Date });
      const PSchema = new Schema({ sub: [SSchema] });

      const P = db.model('usingAllWithDates', PSchema);
      const sub = [{ d: new Date() }, { d: new Date(Date.now() - 10000) }, { d: new Date(Date.now() - 30000) }];

      P.create({ sub }, (err, p) => {
        assert.ifError(err);

        const o0 = p.sub[0].d;
        const o1 = p.sub[1].d;
        const o2 = p.sub[2].d;

        P.findOne({ 'sub.d': { $all: [o1, o2] } }, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.id, p.id);

          P.findOne({ 'sub.d': { $all: [o0, new Date()] } }, (err, doc) => {
            assert.ifError(err);
            assert.equal(!!doc, false);

            P.findOne({ 'sub.d': { $all: [o2] } }, (err, doc) => {
              assert.ifError(err);
              assert.equal(doc.id, p.id);
              done();
            });
          });
        });
      });
    });

    it.skip('with $elemMatch (gh-3163)', (done) => {
      const schema = new Schema({ test: [String] });
      const MyModel = db.model('gh3163', schema);

      MyModel.create({ test: ['log1', 'log2'] }, (error) => {
        assert.ifError(error);
        const query = { test: { $all: [{ $elemMatch: { $regex: /log/g } }] } };
        MyModel.find(query, (error, docs) => {
          assert.ifError(error);
          assert.equal(docs.length, 1);
          done();
        });
      });
    });
  });

  describe('and', () => {
    it('works with queries gh-1188', (done) => {
      const B = db.model('BlogPostB');

      B.create({ title: 'and operator', published: false, author: 'Me' }, (err) => {
        assert.ifError(err);

        B.find({ $and: [{ title: 'and operator' }] }, (err, docs) => {
          assert.ifError(err);
          assert.equal(docs.length, 1);

          B.find({ $and: [{ title: 'and operator' }, { published: true }] }, (err, docs) => {
            assert.ifError(err);
            assert.equal(docs.length, 0);

            B.find({ $and: [{ title: 'and operator' }, { published: false }] }, (err, docs) => {
              assert.ifError(err);
              assert.equal(docs.length, 1);

              const query = B.find();
              query.and([{ title: 'and operator', published: false }, { author: 'Me' }]);
              query.exec((err, docs) => {
                assert.ifError(err);
                assert.equal(docs.length, 1);

                const query = B.find();
                query.and([{ title: 'and operator', published: false }, { author: 'You' }]);
                query.exec((err, docs) => {
                  assert.ifError(err);
                  assert.equal(docs.length, 0);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('works with nested query selectors gh-1884', (done) => {
      const B = db.model('gh1884', { a: String, b: String }, 'gh1884');

      B.remove({ $and: [{ a: 'coffee' }, { b: { $in: ['bacon', 'eggs'] } }] }, (error) => {
        assert.ifError(error);
        done();
      });
    });
  });

  it('works with different methods and query types', (done) => {
    const BufSchema = new Schema({ name: String, block: String });
    const Test = db.model('BufferTest', BufSchema, 'buffers');

    const docA = { name: 'A', block: 'über' };
    const docB = { name: 'B', block: 'buffer shtuffs are neat' };
    const docC = { name: 'C', block: 'hello world' };

    Test.create(docA, docB, docC, (err, a, b, c) => {
      assert.ifError(err);
      assert.equal(b.block.toString('utf8'), 'buffer shtuffs are neat');
      assert.equal(a.block.toString('utf8'), 'über');
      assert.equal(c.block.toString('utf8'), 'hello world');

      Test.findById(a._id, (err, a) => {
        assert.ifError(err);
        assert.equal(a.block.toString('utf8'), 'über');

        Test.findOne({ block: 'buffer shtuffs are neat' }, (err, rb) => {
          assert.ifError(err);
          assert.equal(rb.block.toString('utf8'), 'buffer shtuffs are neat');

          Test.findOne({ block: /buffer/i }, (err) => {
            Test.findOne({ block: [195, 188, 98, 101, 114] }, (err, rb) => {
              assert.ifError(err);

              Test.findOne({ block: 'aGVsbG8gd29ybGQ=' }, (err, rb) => {
                assert.ifError(err);
                assert.strictEqual(rb, null);

                Test.findOne({ block: new Buffer('aGVsbG8gd29ybGQ=', 'base64') }, (err, rb) => {
                  assert.ifError(err);
                  assert.equal(rb.block.toString('utf8'), 'hello world');

                  Test.findOne({ block: new MongooseBuffer('aGVsbG8gd29ybGQ=', 'base64') }, (err, rb) => {
                    assert.ifError(err);
                    assert.equal(rb.block.toString('utf8'), 'hello world');

                    Test.remove({}, (err) => {
                      assert.ifError(err);
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
  });

  it('with conditionals', (done) => {
    // $in $nin etc
    const BufSchema = new Schema({ name: String, block: String });
    const Test = db.model('Buffer2', BufSchema, `buffer_${random()}`);

    const docA = { name: 'A' };
    const docB = { name: 'B' };
    const docC = { name: 'C' };

    Test.create(docA, docB, docC, (err) => {
      assert.ifError(err);
      Test.find(
        {
          name: {
            $in: ['A'],
          },
        },
        (err, tests) => {
          cb();
          assert.ifError(err);
          assert.equal(tests.length, 1);
        }
      );

      Test.find({ name: { $in: ['A', 'B'] } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 2);
      });

      Test.find({ name: { $in: ['A'] } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 1);
      });

      Test.find({ name: { $nin: ['A'] } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 2);
      });

      Test.find({ name: { $ne: 'A' } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 2);
      });

      Test.find({ name: { $gt: 'A' } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 2);
      });

      Test.find({ name: { $gte: 'A' } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 3);
      });

      Test.find({ name: { $lt: 'B' } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 1);
      });

      Test.find({ name: { $lte: 'B' } }, (err, tests) => {
        cb();
        assert.ifError(err);
        assert.equal(tests.length, 2);
      });

      let pending = 9;

      function cb() {
        if (--pending) {
          return;
        }
        Test.remove({}, (err) => {
          assert.ifError(err);
          done();
        });
      }
    });
  });

  it('with previously existing null values in the db', (done) => {
    const BlogPostB = db.model('BlogPostB', collection);
    const post = new BlogPostB();

    post.collection.insert({ meta: { visitors: 9898, a: null } }, {}, (err, b) => {
      assert.ifError(err);

      BlogPostB.findOne({ _id: b._id }, (err, found) => {
        assert.ifError(err);
        assert.equal(found.get('meta.visitors').valueOf(), 9898);
        done();
      });
    });
  });

  describe('hashed indexes', () => {
    const mongo24_or_greater = false;

    it('work', (done) => {
      if (!mongo24_or_greater) {
        return done();
      }
      const schemas = [];
      schemas[0] = new Schema({ t: { type: String, index: 'hashed' } });
      schemas[1] = new Schema({ t: { type: String, index: 'hashed', sparse: true } });
      schemas[2] = new Schema({ t: { type: String, index: { type: 'hashed', sparse: true } } });

      let pending = schemas.length;

      schemas.forEach((schema, i) => {
        const H = db.model(`Hashed${i}`, schema);
        H.on('index', (err) => {
          assert.ifError(err);
          H.collection.getIndexes({ full: true }, (err, indexes) => {
            assert.ifError(err);

            const found = indexes.some((index) => index.key.t === 'hashed');
            assert.ok(found);

            H.create({ t: 'hashing' }, {}, (err, doc1, doc2) => {
              assert.ifError(err);
              assert.ok(doc1);
              assert.ok(doc2);
              complete();
            });
          });
        });
      });

      function complete() {
        if (--pending === 0) {
          done();
        }
      }
    });
  });

  describe('lean', () => {
    it('find', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const title = `Wooooot ${random()}`;

      const post = new BlogPostB();
      post.set('title', title);

      post.save((err) => {
        assert.ifError(err);
        BlogPostB.find({ title })
          .lean()
          .exec((err, docs) => {
            assert.ifError(err);
            assert.equal(docs.length, 1);
            assert.strictEqual(docs[0] instanceof mongoose.Document, false);
            BlogPostB.find({ title }, null, { lean: true }, (err, docs) => {
              assert.ifError(err);
              assert.equal(docs.length, 1);
              assert.strictEqual(docs[0] instanceof mongoose.Document, false);
              done();
            });
          });
      });
    });

    it('findOne', (done) => {
      const BlogPostB = db.model('BlogPostB', collection);
      const title = `Wooooot ${random()}`;

      const post = new BlogPostB();
      post.set('title', title);

      post.save((err) => {
        assert.ifError(err);
        BlogPostB.findOne({ title }, null, { lean: true }, (err, doc) => {
          assert.ifError(err);
          assert.ok(doc);
          assert.strictEqual(false, doc instanceof mongoose.Document);
          done();
        });
      });
    });

    it.skip('properly casts nested and/or queries (gh-676)', (done) => {
      const sch = new Schema({
        num: Number,
        subdoc: { title: String, num: Number },
      });

      const M = mongoose.model(`andor${random()}`, sch);

      const cond = {
        $and: [{ $or: [{ num: '23' }, { 'subdoc.num': '45' }] }, { $and: [{ 'subdoc.title': 233 }, { num: '345' }] }],
      };
      const q = M.find(cond);
      q._castConditions();
      assert.equal(typeof q._conditions.$and[0].$or[0].num, 'number');
      assert.equal(typeof q._conditions.$and[0].$or[1]['subdoc.num'], 'number');
      assert.equal(typeof q._conditions.$and[1].$and[0]['subdoc.title'], 'string');
      assert.equal(typeof q._conditions.$and[1].$and[1].num, 'number');
      done();
    });

    it.skip('properly casts deeply nested and/or queries (gh-676)', (done) => {
      const sch = new Schema({
        num: Number,
        subdoc: { title: String, num: Number },
      });

      const M = mongoose.model(`andor${random()}`, sch);

      const cond = {
        $and: [{ $or: [{ $and: [{ $or: [{ num: '12345' }, { 'subdoc.num': '56789' }] }] }] }],
      };
      const q = M.find(cond);
      q._castConditions();
      assert.equal(typeof q._conditions.$and[0].$or[0].$and[0].$or[0].num, 'number');
      assert.equal(typeof q._conditions.$and[0].$or[0].$and[0].$or[1]['subdoc.num'], 'number');
      done();
    });

    it.skip('casts $elemMatch (gh-2199)', (done) => {
      const schema = new Schema({ dates: [Date] });
      const Dates = db.model('Date', schema, 'dates');

      const array = ['2014-07-01T02:00:00.000Z', '2014-07-01T04:00:00.000Z'];
      Dates.create({ dates: array }, (err) => {
        assert.ifError(err);
        const elemMatch = { $gte: '2014-07-01T03:00:00.000Z' };
        Dates.findOne({}, { dates: { $elemMatch: elemMatch } }, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.dates.length, 1);
          assert.equal(doc.dates[0].getTime(), new Date('2014-07-01T04:00:00.000Z').getTime());
          done();
        });
      });
    });

    describe.skip('$eq', () => {
      const mongo26 = false;

      it('casts $eq (gh-2752)', (done) => {
        const BlogPostB = db.model('BlogPostB', collection);

        BlogPostB.findOne({ _id: { $eq: '000000000000000000000001' }, numbers: { $eq: [1, 2] } }, (err, doc) => {
          if (mongo26) {
            assert.ifError(err);
          } else {
            assert.ok(err.toString().indexOf('MongoError') !== -1);
          }

          assert.ok(!doc);
          done();
        });
      });
    });
  });
});
