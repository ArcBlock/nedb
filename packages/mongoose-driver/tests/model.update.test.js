/* eslint-disable no-underscore-dangle */
/* eslint-disable no-shadow */
/**
 * Test dependencies.
 */

const assert = require('power-assert');
const start = require('./common');

const { mongoose, random } = start;

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const DocumentObjectId = mongoose.Types.ObjectId;

describe('model: update:', () => {
  let post;
  const title = `Tobi ${random()}`;
  const author = `Brian ${random()}`;
  const newTitle = `Woot ${random()}`;
  let id0;
  let id1;
  let Comments;
  let BlogPost;
  let collection;
  let strictSchema;
  let db;

  before(() => {
    Comments = new Schema({});

    Comments.add({
      title: String,
      date: Date,
      body: String,
      comments: [Comments],
    });

    BlogPost = new Schema(
      {
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
        owners: [ObjectId],
        comments: [Comments],
      },
      { strict: false }
    );

    BlogPost.virtual('titleWithAuthor')
      .get(function () {
        return `${this.get('title')} by ${this.get('author')}`;
      })
      .set(function (val) {
        const split = val.split(' by ');
        this.set('title', split[0]);
        this.set('author', split[1]);
      });

    BlogPost.method('cool', function () {
      return this;
    });

    BlogPost.static('woot', function () {
      return this;
    });

    mongoose.model('BlogPostForUpdates', BlogPost);

    collection = `blogposts_${random()}`;

    strictSchema = new Schema({ name: String, x: { nested: String } });
    strictSchema.virtual('foo').get(() => 'i am a virtual FOO!');
    mongoose.model('UpdateStrictSchema', strictSchema);
  });

  before((done) => {
    db = start();
    const BlogPost = db.model('BlogPostForUpdates', collection);

    id0 = new DocumentObjectId();
    id1 = new DocumentObjectId();

    post = new BlogPost();
    post.set('title', title);
    post.author = author;
    post.meta.visitors = 0;
    post.date = new Date();
    post.published = true;
    post.mixed = { x: 'ex' };
    post.numbers = [4, 5, 6, 7];
    post.owners = [id0, id1];
    post.comments = [{ body: 'been there' }, { body: 'done that' }];

    post.save((err) => {
      assert.ifError(err);
      done();
    });
  });

  after((done) => {
    db.close(done);
  });

  it('works', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    BlogPost.findById(post._id, (err, cf) => {
      assert.ifError(err);
      assert.equal(cf.title, title);
      assert.equal(cf.author, author);
      assert.equal(cf.meta.visitors.valueOf(), 0);
      assert.equal(cf.date.toString(), post.date.toString());
      assert.equal(cf.published, true);
      assert.equal(cf.mixed.x, 'ex');
      assert.deepEqual(cf.numbers.toObject(), [4, 5, 6, 7]);
      assert.equal(cf.owners.length, 2);
      assert.equal(cf.owners[0].toString(), id0.toString());
      assert.equal(cf.owners[1].toString(), id1.toString());
      assert.equal(cf.comments.length, 2);
      assert.equal(cf.comments[0].body, 'been there');
      assert.equal(cf.comments[1].body, 'done that');
      assert.ok(cf.comments[0]._id);
      assert.ok(cf.comments[1]._id);
      assert.ok(cf.comments[0]._id instanceof DocumentObjectId);
      assert.ok(cf.comments[1]._id instanceof DocumentObjectId);

      const update = {
        title: newTitle, // becomes $set
        $inc: { 'meta.visitors': 2 },
        $set: { date: new Date() },
        published: false, // becomes $set
        mixed: { x: 'ECKS', y: 'why' }, // $set
        // FIXME: $pullAll is not supported
        // $pullAll: { numbers: [4, 6] },
        $pull: { owners: id0 },
        'comments.1.body': 8, // $set
      };

      BlogPost.update({ title }, update, (err) => {
        assert.ifError(err);

        BlogPost.findById(post._id, (err, up) => {
          assert.ifError(err);
          assert.equal(up.title, newTitle);
          assert.equal(up.author, author);
          assert.equal(up.meta.visitors.valueOf(), 2);
          assert.equal(up.date.toString(), update.$set.date.toString());
          assert.equal(up.published, false);
          assert.equal(up.mixed.x, 'ECKS');
          assert.equal(up.mixed.y, 'why');
          // assert.deepEqual(up.numbers.toObject(), [4, 5, 6, 7]);
          assert.equal(up.owners.length, 1);
          assert.equal(up.owners[0].toString(), id1.toString());
          assert.equal(up.comments[0].body, 'been there');
          assert.equal(up.comments[1].body, 8);
          assert.ok(up.comments[0]._id);
          assert.ok(up.comments[1]._id);
          assert.ok(up.comments[0]._id instanceof DocumentObjectId);
          assert.ok(up.comments[1]._id instanceof DocumentObjectId);

          const update2 = {
            'comments.body': 'fail',
          };

          BlogPost.update({ _id: post._id }, update2, (err) => {
            BlogPost.findById(post, (err) => {
              assert.ifError(err);

              const update3 = {
                $pull: 'fail',
              };

              BlogPost.update({ _id: post._id }, update3, (err) => {
                assert.ok(err);

                assert.ok(
                  /Invalid atomic update value for \$pull\. Expected an object, received string/.test(err.message)
                );

                const update4 = {
                  $inc: { idontexist: 1 },
                };

                // should not overwrite doc when no valid paths are submitted
                BlogPost.update({ _id: post._id }, update4, (err) => {
                  assert.ifError(err);

                  BlogPost.findById(post._id, (err, up) => {
                    assert.ifError(err);

                    assert.equal(up.title, newTitle);
                    assert.equal(up.author, author);
                    assert.equal(up.meta.visitors.valueOf(), 2);
                    assert.equal(up.date.toString(), update.$set.date.toString());
                    assert.equal(up.published, false);
                    assert.equal(up.mixed.x, 'ECKS');
                    assert.equal(up.mixed.y, 'why');
                    // assert.deepEqual(up.numbers.toObject(), [5, 7]);
                    assert.equal(up.owners.length, 1);
                    assert.equal(up.owners[0].toString(), id1.toString());
                    assert.equal(up.comments[0].body, 'fail');
                    assert.equal(up.comments[1].body, 'fail');
                    // non-schema data was still stored in mongodb
                    assert.strictEqual(1, up._doc.idontexist);

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

  it('casts doc arrays', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const update = {
      comments: [{ body: 'worked great' }],
      $set: { 'numbers.1': 100 },
      $inc: { idontexist: 1 },
    };

    BlogPost.update({ _id: post._id }, update, (err) => {
      assert.ifError(err);

      // get the underlying doc
      BlogPost.collection.findOne({ _id: post._id }, (err, doc) => {
        assert.ifError(err);

        const up = new BlogPost();
        up.init(doc);

        assert.equal(!!up.errors, false);
        assert.equal(up.comments.length, 1);
        assert.equal(up.comments[0].body, 'worked great');
        assert.strictEqual(true, !!doc.comments[0]._id);
        assert.equal(up.meta.visitors.valueOf(), 2);
        assert.equal(up.mixed.x, 'ECKS');
        assert.deepEqual(up.numbers.toObject(), [4, 100, 6, 7]);
        assert.strictEqual(up.numbers[1].valueOf(), 100);

        assert.equal(doc.idontexist, 2);
        assert.equal(doc.numbers[1], 100);

        done();
      });
    });
  });

  // FIXME: $pullAll is not supported
  it.skip('handles $pushAll array of docs', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const update = {
      $pushAll: { comments: [{ body: 'i am number 2' }, { body: 'i am number 3' }] },
    };

    BlogPost.update({ _id: post._id }, update, (err) => {
      assert.ifError(err);
      BlogPost.findById(post, (err, ret) => {
        assert.ifError(err);
        assert.equal(ret.comments.length, 3);
        assert.equal(ret.comments[1].body, 'i am number 2');
        assert.strictEqual(true, !!ret.comments[1]._id);
        assert.ok(ret.comments[1]._id instanceof DocumentObjectId);
        assert.equal(ret.comments[2].body, 'i am number 3');
        assert.strictEqual(true, !!ret.comments[2]._id);
        assert.ok(ret.comments[2]._id instanceof DocumentObjectId);
        done();
      });
    });
  });

  it('handles $pull of object literal array of docs (gh-542)', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    // FIXME: if previous test passed, remove the first update
    let update = { $push: { comments: { $each: [{ body: 'i am number 2' }, { body: 'i am number 3' }] } } };
    BlogPost.update({ _id: post._id }, update, () => {
      update = { $pull: { comments: { body: 'i am number 2' } } };
      BlogPost.update({ _id: post._id }, update, (err) => {
        assert.ifError(err);
        BlogPost.findById(post, (err, ret) => {
          assert.ifError(err);
          assert.equal(ret.comments.length, 2);
          assert.equal(ret.comments[0].body, 'worked great');
          assert.ok(ret.comments[0]._id instanceof DocumentObjectId);
          assert.equal(ret.comments[1].body, 'i am number 3');
          assert.ok(ret.comments[1]._id instanceof DocumentObjectId);
          done();
        });
      });
    });
  });

  it('makes copy of conditions and update options', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const conditions = { _id: post._id.toString() };
    const update = { $set: { some_attrib: post._id.toString() } };
    BlogPost.update(conditions, update, (err) => {
      assert.ifError(err);
      assert.equal(typeof conditions._id, 'string');
      done();
    });
  });

  // FIXME: this kind of casting is not supported
  it.skip('handles weird casting (gh-479)', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    function a() {}

    a.prototype.toString = function () {
      return 'MongoDB++';
    };
    const crazy = new a();

    const update = {
      $addToSet: { 'comments.$.comments': { body: 'The Ring Of Power' } },
      $set: { 'comments.$.title': crazy },
    };

    BlogPost.update({ _id: post._id, 'comments.body': 'worked great' }, update, (err) => {
      assert.ifError(err);
      BlogPost.findById(post, (err, ret) => {
        assert.ifError(err);
        assert.equal(ret.comments.length, 2);
        assert.equal(ret.comments[0].body, 'worked great');
        assert.equal(ret.comments[0].title, 'MongoDB++');
        assert.strictEqual(true, !!ret.comments[0].comments);
        assert.equal(ret.comments[0].comments.length, 1);
        assert.strictEqual(ret.comments[0].comments[0].body, 'The Ring Of Power');
        assert.ok(ret.comments[0]._id instanceof DocumentObjectId);
        assert.ok(ret.comments[0].comments[0]._id instanceof DocumentObjectId);
        assert.equal(ret.comments[1].body, 'i am number 3');
        assert.strictEqual(undefined, ret.comments[1].title);
        assert.ok(ret.comments[1]._id instanceof DocumentObjectId);
        done();
      });
    });
  });

  let last;
  it('handles date casting (gh-479)', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const update = {
      $inc: { 'comments.$.newprop': '1' },
      $set: { date: new Date().getTime() }, // check for single val casting
    };

    BlogPost.update({ _id: post._id, 'comments.body': 'worked great' }, update, (err) => {
      assert.ifError(err);
      BlogPost.findById(post, (err, ret) => {
        assert.ifError(err);

        assert.equal(ret._doc.comments[0]._doc.newprop, 1);
        assert.equal(ret._doc.comments[1]._doc.newprop, 1);
        assert.ok(ret.date instanceof Date);
        assert.equal(ret.date.toString(), new Date(update.$set.date).toString());

        last = ret;
        done();
      });
    });
  });

  it('handles $addToSet (gh-545)', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const owner = last.owners[0];

    const update = {
      $addToSet: { owners: owner },
    };

    BlogPost.update({ _id: post._id }, update, (err) => {
      assert.ifError(err);
      BlogPost.findById(post, (err, ret) => {
        assert.ifError(err);
        assert.equal(ret.owners.length, 1);
        assert.equal(ret.owners[0].toString(), owner.toString());

        last = ret;
        done();
      });
    });
  });

  it('handles $addToSet with $each (gh-545)', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const owner = last.owners[0];
    const newowner = new DocumentObjectId();

    const update = {
      $addToSet: { owners: { $each: [owner, newowner] } },
    };

    BlogPost.update({ _id: post._id }, update, (err) => {
      assert.ifError(err);
      BlogPost.findById(post, (err, ret) => {
        assert.ifError(err);
        assert.equal(ret.owners.length, 2);
        assert.equal(ret.owners[0].toString(), owner.toString());
        assert.equal(ret.owners[1].toString(), newowner.toString());

        last = newowner;
        done();
      });
    });
  });

  it('handles $pop and $unset (gh-574)', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const update = {
      $pop: { owners: -1 },
      $unset: { title: 1 },
    };

    BlogPost.update({ _id: post._id }, update, (err) => {
      assert.ifError(err);
      BlogPost.findById(post, (err, ret) => {
        assert.ifError(err);
        assert.equal(ret.owners.length, 1);
        assert.equal(ret.owners[0].toString(), last.toString());
        assert.strictEqual(undefined, ret.title);
        done();
      });
    });
  });

  it('works with nested positional notation', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    const update = {
      $set: {
        'comments.0.comments.0.date': '11/5/2011',
        'comments.1.body': 9000,
      },
    };

    BlogPost.update({ _id: post._id }, update, (err) => {
      assert.ifError(err);
      BlogPost.findById(post, (err, ret) => {
        assert.ifError(err);
        assert.equal(ret.comments.length, 2, 2);
        assert.equal(ret.comments[0].body, 'worked great');
        assert.equal(ret.comments[1].body, '9000');
        assert.equal(ret.comments[0].comments[0].date.toString(), new Date('11/5/2011').toString());
        assert.equal(ret.comments[1].comments.length, 0);
        done();
      });
    });
  });

  it('handles $pull with obj literal (gh-542)', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    BlogPost.findById(post, (err, doc) => {
      assert.ifError(err);

      const update = {
        $pull: { comments: { _id: doc.comments[0].id } },
      };

      BlogPost.update({ _id: post._id }, update, (err) => {
        assert.ifError(err);
        BlogPost.findById(post, (err, ret) => {
          assert.ifError(err);
          assert.equal(ret.comments.length, 1);
          assert.equal(ret.comments[0].body, '9000');
          done();
        });
      });
    });
  });

  it('handles $pull of obj literal and nested $in', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    BlogPost.findById(post, (err, last) => {
      assert.ifError(err);
      const update = {
        $pull: { comments: { body: { $in: [last.comments[0].body] } } },
      };

      BlogPost.update({ _id: post._id }, update, (err) => {
        assert.ifError(err);
        BlogPost.findById(post, (err, ret) => {
          assert.ifError(err);
          assert.equal(ret.comments.length, 0);

          last = ret;
          done();
        });
      });
    });
  });

  // FIXME: $pullAll is not supported
  it.skip('handles $pull and nested $nin', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);

    BlogPost.findById(post, (err, last) => {
      assert.ifError(err);

      last.comments.push({ body: 'hi' }, { body: 'there' });
      last.save((err) => {
        assert.ifError(err);
        BlogPost.findById(post, (err, ret) => {
          assert.ifError(err);
          assert.equal(ret.comments.length, 2);

          const update = {
            $pull: { comments: { body: { $nin: ['there'] } } },
          };

          BlogPost.update({ _id: ret._id }, update, (err) => {
            assert.ifError(err);
            BlogPost.findById(post, (err, ret) => {
              assert.ifError(err);
              assert.equal(ret.comments.length, 1);
              done();
            });
          });
        });
      });
    });
  });

  it('updates numbers atomically', (done) => {
    const BlogPost = db.model('BlogPostForUpdates', collection);
    let totalDocs = 4;

    const post = new BlogPost();
    post.set('meta.visitors', 5);

    function complete() {
      BlogPost.findOne({ _id: post.get('_id') }, (err, doc) => {
        assert.ifError(err);
        assert.equal(doc.get('meta.visitors'), 9);
        done();
      });
    }

    post.save((err) => {
      assert.ifError(err);
      function callback(err) {
        assert.ifError(err);
        --totalDocs || complete();
      }
      for (let i = 0; i < 4; ++i) {
        BlogPost.update({ _id: post._id }, { $inc: { 'meta.visitors': 1 } }, callback);
      }
    });
  });

  describe('honors strict schemas', () => {
    it('(gh-699)', (done) => {
      const S = db.model('UpdateStrictSchema');

      let doc = S.find()._castUpdate({ ignore: true });
      assert.equal(doc, false);
      doc = S.find()._castUpdate({ $unset: { x: 1 } });
      assert.equal(Object.keys(doc.$unset).length, 1);
      done();
    });

    it('works', (done) => {
      const S = db.model('UpdateStrictSchema');
      const s = new S({ name: 'orange crush' });

      s.save((err) => {
        assert.ifError(err);

        S.update({ _id: s._id }, { ignore: true }, (err, affected) => {
          assert.ifError(err);
          // assert.equal(affected.n, 0);

          S.findById(s._id, (err, doc) => {
            assert.ifError(err);
            assert.ok(!doc.ignore);
            assert.ok(!doc._doc.ignore);

            S.update({ _id: s._id }, { name: 'Drukqs', foo: 'fooey' }, (err, affected) => {
              assert.ifError(err);
              // assert.equal(affected.n, 1);

              S.findById(s._id, (err, doc) => {
                assert.ifError(err);
                assert.ok(!doc._doc.foo);
                done();
              });
            });
          });
        });
      });
    });
  });

  // FIXME: compatibility
  it.skip('passes number of affected docs', (done) => {
    const B = db.model('BlogPostForUpdates', `wwwwowowo${random()}`);

    B.create({ title: 'one' }, { title: 'two' }, { title: 'three' }, (err) => {
      assert.ifError(err);
      B.update({}, { title: 'newtitle' }, { multi: true, returnUpdatedDocs: true }, (err, affected) => {
        assert.ifError(err);
        assert.equal(affected.length, 3);
        done();
      });
    });
  });

  it('updates a number to null (gh-640)', (done) => {
    const B = db.model('BlogPostForUpdates', `wwwwowowo${random()}`);
    const b = new B({ meta: { visitors: null } });
    b.save((err) => {
      assert.ifError(err);
      B.findById(b, (err, b) => {
        assert.ifError(err);
        assert.strictEqual(b.meta.visitors, null);

        B.update({ _id: b._id }, { meta: { visitors: null } }, (err) => {
          assert.strictEqual(null, err);
          done();
        });
      });
    });
  });

  it('handles $pull from Mixed arrays (gh-735)', (done) => {
    const schema = new Schema({ comments: [] });
    const M = db.model('gh-735', schema, `gh-735_${random()}`);
    M.create({ comments: [{ name: 'node 0.8' }] }, (err, doc) => {
      assert.ifError(err);
      M.update({ _id: doc._id }, { $pull: { comments: { name: 'node 0.8' } } }, (err, affected) => {
        assert.ifError(err);

        M.findById(doc._id, (err, doc) => {
          assert.equal(doc.comments.length, 0);
          done();
        });
      });
    });
  });

  it('handles $push with $ positionals (gh-1057)', (done) => {
    const taskSchema = new Schema({
      name: String,
    });

    const componentSchema = new Schema({
      name: String,
      tasks: [taskSchema],
    });

    const projectSchema = new Schema({
      name: String,
      components: [componentSchema],
    });

    const Project = db.model('1057-project', projectSchema, `1057-${random()}`);

    Project.create({ name: 'my project' }, (err, project) => {
      assert.ifError(err);
      const pid = project.id;
      const comp = project.components.create({ name: 'component' });
      Project.update({ _id: pid }, { $push: { components: comp } }, (err) => {
        assert.ifError(err);
        const task = comp.tasks.create({ name: 'my task' });
        Project.update({ _id: pid, 'components._id': comp._id }, { $push: { 'components.$.tasks': task } }, (err) => {
          assert.ifError(err);
          Project.findById(pid, (err, proj) => {
            assert.ifError(err);

            assert.ok(proj);
            assert.equal(proj.components.length, 1);
            assert.equal(proj.components[0].name, 'component');
            assert.equal(comp.id, proj.components[0].id);
            assert.equal(proj.components[0].tasks.length, 1);
            assert.equal(proj.components[0].tasks[0].name, 'my task');
            assert.equal(task.id, proj.components[0].tasks[0].id);
            done();
          });
        });
      });
    });
  });

  it('handles nested paths starting with numbers (gh-1062)', (done) => {
    const schema = new Schema({ counts: Schema.Types.Mixed });
    const M = db.model('gh-1062', schema, `1062-${random()}`);
    M.create({ counts: {} }, (err, m) => {
      assert.ifError(err);
      M.update({}, { $inc: { 'counts.1': 1, 'counts.1a': 10 } }, (err) => {
        assert.ifError(err);
        M.findById(m, (err, doc) => {
          assert.ifError(err);
          assert.equal(doc.counts['1'], 1);
          assert.equal(doc.counts['1a'], 10);
          done();
        });
      });
    });
  });

  // FIXME:
  it.skip('handles positional operators with referenced docs (gh-1572)', (done) => {
    const so = new Schema({ title: String, obj: [String] });
    const Some = db.model(`Some${random()}`, so);

    Some.create({ obj: ['a', 'b', 'c'] }, (err, s) => {
      assert.ifError(err);

      Some.update({ _id: s._id, obj: 'b' }, { $set: { 'obj.$': 2 } }, (err) => {
        assert.ifError(err);

        Some.findById(s._id, (err, ss) => {
          assert.ifError(err);

          assert.strictEqual(ss.obj[1], '2');
          done();
        });
      });
    });
  });

  it('use .where for update condition (gh-2170)', (done) => {
    const so = new Schema({ num: Number });
    const Some = db.model(`gh-2170${random()}`, so);

    Some.create([{ num: 1 }, { num: 1 }], (err, docs) => {
      assert.ifError(err);
      assert.equal(docs.length, 2);
      const doc0 = docs[0];
      const doc1 = docs[1];
      const sId0 = doc0._id;
      const sId1 = doc1._id;
      Some.where({ _id: sId0 }).update({}, { $set: { num: '99' } }, { multi: true }, (err) => {
        assert.ifError(err);
        Some.findById(sId0, (err, doc0_1) => {
          assert.ifError(err);
          assert.equal(doc0_1.num, 99);
          Some.findById(sId1, (err, doc1_1) => {
            assert.ifError(err);
            assert.equal(doc1_1.num, 1);
            done();
          });
        });
      });
    });
  });

  describe('{overwrite: true}', () => {
    it('overwrite works', (done) => {
      const schema = new Schema({ mixed: {} });
      const M = db.model(`updatesmixed-${random()}`, schema);

      M.create({ mixed: 'something' }, (err, created) => {
        assert.ifError(err);

        M.update({ _id: created._id }, { mixed: {} }, { overwrite: true }, (err) => {
          assert.ifError(err);
          M.findById(created._id, (err, doc) => {
            assert.ifError(err);
            assert.equal(created.id, doc.id);
            assert.equal(typeof doc.mixed, 'object');
            assert.equal(Object.keys(doc.mixed).length, 0);
            done();
          });
        });
      });
    });

    it('overwrites all properties', (done) => {
      const sch = new Schema({ title: String, subdoc: { name: String, num: Number } });

      const M = db.model(`updateover${random()}`, sch);

      M.create({ subdoc: { name: 'that', num: 1 } }, (err, doc) => {
        assert.ifError(err);

        M.update({ _id: doc.id }, { title: 'something!' }, { overwrite: true }, (err) => {
          assert.ifError(err);
          M.findById(doc.id, (err, doc) => {
            assert.ifError(err);
            assert.equal(doc.title, 'something!');
            assert.equal(doc.subdoc.name, undefined);
            assert.equal(doc.subdoc.num, undefined);
            done();
          });
        });
      });
    });

    it('allows users to blow it up', (done) => {
      const sch = new Schema({ title: String, subdoc: { name: String, num: Number } });

      const M = db.model(`updateover${random()}`, sch);

      M.create({ subdoc: { name: 'that', num: 1, title: 'hello' } }, (err, doc) => {
        assert.ifError(err);

        M.update({ _id: doc.id }, {}, { overwrite: true }, (err) => {
          assert.ifError(err);
          M.findById(doc.id, (err, doc) => {
            assert.ifError(err);
            assert.equal(doc.title, undefined);
            assert.equal(doc.subdoc.name, undefined);
            assert.equal(doc.subdoc.num, undefined);
            done();
          });
        });
      });
    });
  });

  it('casts empty arrays', (done) => {
    const so = new Schema({ arr: [] });
    const Some = db.model(`1838-${random()}`, so);

    Some.create({ arr: ['a'] }, (err, s) => {
      if (err) {
        return done(err);
      }

      Some.update({ _id: s._id }, { arr: [] }, (err) => {
        if (err) {
          return done(err);
        }
        Some.findById(s._id, (err, doc) => {
          if (err) {
            return done(err);
          }
          assert.ok(Array.isArray(doc.arr));
          assert.strictEqual(0, doc.arr.length);
          done();
        });
      });
    });
  });

  describe('defaults and validators (gh-860)', () => {
    it('applies defaults on upsert', (done) => {
      const s = new Schema({ topping: { type: String, default: 'bacon' }, base: String });
      const Breakfast = db.model('gh-860-0', s);
      const updateOptions = { upsert: true, setDefaultsOnInsert: true };
      Breakfast.update({}, { base: 'eggs' }, updateOptions, (error) => {
        assert.ifError(error);
        Breakfast.findOne({})
          .lean()
          .exec((error, breakfast) => {
            assert.ifError(error);
            assert.equal(breakfast.base, 'eggs');
            assert.equal(breakfast.topping, 'bacon');
            done();
          });
      });
    });

    it.skip('avoids nested paths if setting parent path (gh-4911)', (done) => {
      const EmbeddedSchema = mongoose.Schema({
        embeddedField: String,
      });

      const ParentSchema = mongoose.Schema({
        embedded: EmbeddedSchema,
      });

      const Parent = db.model('gh4911', ParentSchema);

      const newDoc = {
        _id: new mongoose.Types.ObjectId(),
        embedded: null,
      };

      const opts = { upsert: true, setDefaultsOnInsert: true };

      Parent.findOneAndUpdate({ _id: newDoc._id }, newDoc, opts)
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('doesnt set default on upsert if query sets it', (done) => {
      const s = new Schema({ topping: { type: String, default: 'bacon' }, base: String });
      const Breakfast = db.model('gh-860-1', s);

      const updateOptions = { upsert: true, setDefaultsOnInsert: true };
      Breakfast.update({ topping: 'sausage' }, { base: 'eggs' }, updateOptions, (error) => {
        assert.ifError(error);
        Breakfast.findOne({}, (error, breakfast) => {
          assert.ifError(error);
          assert.equal(breakfast.base, 'eggs');
          assert.equal(breakfast.topping, 'sausage');
          done();
        });
      });
    });

    it('properly sets default on upsert if query wont set it', (done) => {
      const s = new Schema({ topping: { type: String, default: 'bacon' }, base: String });
      const Breakfast = db.model('gh-860-2', s);

      const updateOptions = { upsert: true, setDefaultsOnInsert: true };
      Breakfast.update({ topping: { $ne: 'sausage' } }, { base: 'eggs' }, updateOptions, (error) => {
        assert.ifError(error);
        Breakfast.findOne({}, (error, breakfast) => {
          assert.ifError(error);
          assert.equal(breakfast.base, 'eggs');
          assert.equal(breakfast.topping, 'bacon');
          done();
        });
      });
    });

    it('handles defaults on document arrays (gh-4456)', (done) => {
      const schema = new Schema({
        arr: {
          type: [new Schema({ name: String }, { _id: false })],
          default: [{ name: 'Val' }],
        },
      });

      const M = db.model('gh4456', schema);

      const opts = { upsert: true, setDefaultsOnInsert: true };
      M.update({}, {}, opts, (error) => {
        assert.ifError(error);
        M.findOne({}, (error, doc) => {
          assert.ifError(error);
          assert.deepEqual(doc.toObject().arr, [{ name: 'Val' }]);
          done();
        });
      });
    });

    it('runs validators if theyre set', (done) => {
      const s = new Schema({
        topping: {
          type: String,
          validate() {
            return false;
          },
        },
        base: {
          type: String,
          validate() {
            return true;
          },
        },
      });
      const Breakfast = db.model('gh-860-3', s);

      const updateOptions = { upsert: true, setDefaultsOnInsert: true, runValidators: true };
      Breakfast.update({}, { topping: 'bacon', base: 'eggs' }, updateOptions, (error) => {
        assert.ok(!!error);
        assert.equal(Object.keys(error.errors).length, 1);
        assert.equal(Object.keys(error.errors)[0], 'topping');
        assert.equal(error.errors.topping.message, 'Validator failed for path `topping` with value `bacon`');

        Breakfast.findOne({}, (error, breakfast) => {
          assert.ifError(error);
          assert.ok(!breakfast);
          done();
        });
      });
    });

    it('validators handle $unset and $setOnInsert', (done) => {
      const s = new Schema({
        steak: { type: String, required: true },
        eggs: {
          type: String,
          validate() {
            assert.ok(this instanceof require('..').Query);
            return false;
          },
        },
      });
      const Breakfast = db.model('gh-860-4', s);

      const updateOptions = { runValidators: true, context: 'query' };
      Breakfast.update({}, { $unset: { steak: '' }, $setOnInsert: { eggs: 'softboiled' } }, updateOptions, (error) => {
        assert.ok(!!error);
        assert.equal(Object.keys(error.errors).length, 2);
        assert.ok(Object.keys(error.errors).indexOf('eggs') !== -1);
        assert.ok(Object.keys(error.errors).indexOf('steak') !== -1);
        assert.equal(error.errors.eggs.message, 'Validator failed for path `eggs` with value `softboiled`');
        assert.equal(error.errors.steak.message, 'Path `steak` is required.');
        done();
      });
    });

    it('min/max, enum, and regex built-in validators work', (done) => {
      const s = new Schema({
        steak: { type: String, enum: ['ribeye', 'sirloin'] },
        eggs: { type: Number, min: 4, max: 6 },
        bacon: { type: String, match: /strips/ },
      });
      const Breakfast = db.model('gh-860-5', s);

      const updateOptions = { runValidators: true };
      Breakfast.update({}, { $set: { steak: 'ribeye', eggs: 3, bacon: '3 strips' } }, updateOptions, (error) => {
        assert.ok(!!error);
        assert.equal(Object.keys(error.errors).length, 1);
        assert.equal(Object.keys(error.errors)[0], 'eggs');
        assert.equal(error.errors.eggs.message, 'Path `eggs` (3) is less than minimum allowed value (4).');

        Breakfast.update({}, { $set: { steak: 'tofu', eggs: 5, bacon: '3 strips' } }, updateOptions, (error) => {
          assert.ok(!!error);
          assert.equal(Object.keys(error.errors).length, 1);
          assert.equal(Object.keys(error.errors)[0], 'steak');
          assert.equal(error.errors.steak, '`tofu` is not a valid enum value for path `steak`.');

          Breakfast.update({}, { $set: { steak: 'sirloin', eggs: 6, bacon: 'none' } }, updateOptions, (error) => {
            assert.ok(!!error);
            assert.equal(Object.keys(error.errors).length, 1);
            assert.equal(Object.keys(error.errors)[0], 'bacon');
            assert.equal(error.errors.bacon.message, 'Path `bacon` is invalid (none).');

            done();
          });
        });
      });
    });

    it('multiple validation errors', (done) => {
      const s = new Schema({
        steak: { type: String, enum: ['ribeye', 'sirloin'] },
        eggs: { type: Number, min: 4, max: 6 },
        bacon: { type: String, match: /strips/ },
      });
      const Breakfast = db.model('gh-860-6', s);

      const updateOptions = { runValidators: true };
      Breakfast.update({}, { $set: { steak: 'tofu', eggs: 2, bacon: '3 strips' } }, updateOptions, (error) => {
        assert.ok(!!error);
        assert.equal(Object.keys(error.errors).length, 2);
        assert.ok(Object.keys(error.errors).indexOf('steak') !== -1);
        assert.ok(Object.keys(error.errors).indexOf('eggs') !== -1);
        done();
      });
    });

    it('validators ignore $inc', (done) => {
      const s = new Schema({
        steak: { type: String, required: true },
        eggs: { type: Number, min: 4 },
      });
      const Breakfast = db.model('gh-860-7', s);

      const updateOptions = { runValidators: true };
      Breakfast.update({}, { $inc: { eggs: 1 } }, updateOptions, (error) => {
        assert.ifError(error);
        done();
      });
    });

    it('validators handle positional operator (gh-3167)', (done) => {
      const s = new Schema({
        toppings: [{ name: { type: String, enum: ['bacon', 'cheese'] } }],
      });
      const Breakfast = db.model('gh-860-8', s);

      const updateOptions = { runValidators: true };
      Breakfast.update({ 'toppings.name': 'bacon' }, { 'toppings.$.name': 'tofu' }, updateOptions, (error) => {
        assert.ok(error);
        assert.ok(error.errors['toppings.0.name']);
        done();
      });
    });

    it('required and single nested (gh-4479)', (done) => {
      const FileSchema = new Schema({
        name: {
          type: String,
          required: true,
        },
      });

      const CompanySchema = new Schema({
        file: FileSchema,
      });

      const Company = db.model('gh4479', CompanySchema);
      const update = { file: { name: '' } };
      const options = { runValidators: true };
      Company.update({}, update, options, (error) => {
        assert.ok(error);
        assert.equal(error.errors['file.name'].message, 'Path `name` is required.');
        done();
      });
    });
  });

  it('works with $set and overwrite (gh-2515)', (done) => {
    const schema = new Schema({ breakfast: String });
    const M = db.model('gh-2515', schema);

    M.create({ breakfast: 'bacon' }, (error, doc) => {
      assert.ifError(error);
      M.update({ _id: doc._id }, { $set: { breakfast: 'eggs' } }, { overwrite: true }, (error) => {
        assert.ifError(error);
        M.findOne({ _id: doc._id }, (error, doc) => {
          assert.ifError(error);
          assert.equal(doc.breakfast, 'eggs');
          done();
        });
      });
    });
  });

  it('successfully casts set with nested mixed objects (gh-2796)', (done) => {
    const schema = new Schema({ breakfast: {} });
    const M = db.model('gh-2796', schema);

    M.create({}, (error, doc) => {
      assert.ifError(error);
      M.update({ _id: doc._id }, { breakfast: { eggs: 2, bacon: 3 } }, (error, result) => {
        assert.ifError(error);
        M.findOne({ _id: doc._id }, (error, doc) => {
          assert.ifError(error);
          assert.equal(doc.breakfast.eggs, 2);
          done();
        });
      });
    });
  });

  it('handles empty update with promises (gh-2796)', (done) => {
    const schema = new Schema({ eggs: Number });
    const M = db.model('gh-2797', schema);

    M.create({}, (error, doc) => {
      assert.ifError(error);
      M.update({ _id: doc._id }, { notInSchema: 1 })
        .exec()
        .then((data) => {
          done();
        })
        .catch((error) => done(error));
    });
  });

  describe('middleware', () => {
    it('can specify pre and post hooks', (done) => {
      let numPres = 0;
      let numPosts = 0;
      const band = new Schema({ members: [String] });
      band.pre('update', (next) => {
        ++numPres;
        next();
      });
      band.post('update', () => {
        ++numPosts;
      });
      const Band = db.model('gh-964', band);

      const gnr = new Band({ members: ['Axl', 'Slash', 'Izzy', 'Duff', 'Adler'] });
      gnr.save((error) => {
        assert.ifError(error);
        assert.equal(numPres, 0);
        assert.equal(numPosts, 0);
        Band.update({ _id: gnr._id }, { $pull: { members: 'Adler' } }, (error) => {
          assert.ifError(error);
          assert.equal(numPres, 1);
          assert.equal(numPosts, 1);
          Band.findOne({ _id: gnr._id }, (error, doc) => {
            assert.ifError(error);
            assert.deepEqual(['Axl', 'Slash', 'Izzy', 'Duff'], doc.toObject().members);
            done();
          });
        });
      });
    });

    it('runs before validators (gh-2706)', (done) => {
      const bandSchema = new Schema({
        lead: { type: String, enum: ['Axl Rose'] },
      });
      bandSchema.pre('update', function () {
        this.options.runValidators = true;
      });
      const Band = db.model('gh2706', bandSchema, 'gh2706');

      Band.update({}, { $set: { lead: 'Not Axl' } }, (err) => {
        assert.ok(err);
        done();
      });
    });

    describe('objects and arrays', () => {
      it('embedded objects (gh-2706)', (done) => {
        const bandSchema = new Schema({
          singer: {
            firstName: { type: String, enum: ['Axl'] },
            lastName: { type: String, enum: ['Rose'] },
          },
        });
        bandSchema.pre('update', function () {
          this.options.runValidators = true;
        });
        const Band = db.model('gh2706', bandSchema, 'gh2706');

        Band.update({}, { $set: { singer: { firstName: 'Not', lastName: 'Axl' } } }, (err) => {
          assert.ok(err);
          done();
        });
      });

      it.skip('handles document array validation (gh-2733)', (done) => {
        const member = new Schema({
          name: String,
          role: { type: String, required: true, enum: ['singer', 'guitar', 'drums', 'bass'] },
        });
        const band = new Schema({ members: [member], name: String });
        const Band = db.model('band', band, 'bands');
        const members = [
          { name: 'Axl Rose', role: 'singer' },
          { name: 'Slash', role: 'guitar' },
          { name: 'Christopher Walken', role: 'cowbell' },
        ];

        Band.findOneAndUpdate({ name: "Guns N' Roses" }, { $set: { members } }, { runValidators: true }, (err) => {
          assert.ok(err);
          done();
        });
      });

      it.skip('validators on arrays (gh-3724)', (done) => {
        const schema = new Schema({
          arr: [String],
        });

        schema.path('arr').validate(() => false);

        const M = db.model('gh3724', schema);
        const options = { runValidators: true };
        M.findOneAndUpdate({}, { arr: ['test'] }, options, (error) => {
          assert.ok(error);
          assert.ok(/ValidationError/.test(error.toString()));
          done();
        });
      });
    });
  });

  it('works with overwrite but no $set (gh-2568)', (done) => {
    const chapterSchema = {
      name: String,
    };
    const bookSchema = {
      chapters: [chapterSchema],
      title: String,
      author: String,
      id: Number,
    };
    const Book = db.model('gh2568', bookSchema);

    const jsonObject = {
      chapters: [{ name: 'Ursus' }, { name: 'The Comprachicos' }],
      name: 'The Man Who Laughs',
      author: 'Victor Hugo',
      id: 0,
    };

    Book.update({}, jsonObject, { upsert: true, overwrite: true }, (error) => {
      assert.ifError(error);
      Book.findOne({ id: 0 }, (error, book) => {
        assert.ifError(error);
        assert.equal(book.chapters.length, 2);
        assert.ok(book.chapters[0]._id);
        assert.ok(book.chapters[1]._id);
        done();
      });
    });
  });

  it('works with undefined date (gh-2833)', (done) => {
    const dateSchema = {
      d: Date,
    };
    const D = db.model('gh2833', dateSchema);

    assert.doesNotThrow(() => {
      D.update({}, { d: undefined }, () => {
        done();
      });
    });
  });

  it('does not add virtuals to update (gh-2046)', (done) => {
    const childSchema = new Schema({ foo: String }, { toObject: { getters: true } });
    const parentSchema = new Schema({ children: [childSchema] });

    childSchema.virtual('bar').get(() => 'bar');

    const Parent = db.model('gh2046', parentSchema, 'gh2046');

    const update = Parent.update({}, { $push: { children: { foo: 'foo' } } }, { upsert: true });
    assert.equal(update._update.$push.children.bar, undefined);

    update.exec((error) => {
      assert.ifError(error);
      Parent.findOne({}, (error, doc) => {
        assert.ifError(error);
        assert.equal(doc.children.length, 1);
        assert.ok(!doc.children[0].bar);
        done();
      });
    });
  });

  it('doesnt modify original argument doc (gh-3008)', (done) => {
    const FooSchema = new mongoose.Schema({
      key: Number,
      value: String,
    });
    const Model = db.model('gh3008', FooSchema);

    const update = { $set: { values: 2, value: 2 } };
    Model.update({ key: 1 }, update, () => {
      assert.equal(update.$set.values, 2);
      done();
    });
  });

  describe('bug fixes', () => {
    it.skip('can $rename (gh-1845)', (done) => {
      const schema = new Schema({ foo: Date, bar: Date });
      const Model = db.model('gh1845', schema, 'gh1845');

      const update = { $rename: { foo: 'bar' } };
      Model.create({ foo: Date.now() }, (error) => {
        assert.ifError(error);
        Model.update({}, update, { multi: true }, (error, res) => {
          assert.ifError(error);
          assert.ok(res.ok);
          assert.equal(res.nModified, 1);
          done();
        });
      });
    });

    it.skip('allows objects with positional operator (gh-3185)', (done) => {
      const schema = new Schema({ children: [{ _id: Number }] });
      const MyModel = db.model('gh3185', schema, 'gh3185');

      MyModel.create({ children: [{ _id: 1 }] }, (error, doc) => {
        assert.ifError(error);
        MyModel.findOneAndUpdate(
          { _id: doc._id, 'children._id': 1 },
          { $set: { 'children.$': { _id: 2 } } },
          { new: true },
          (error, doc) => {
            assert.ifError(error);
            assert.equal(doc.children[0]._id, 2);
            done();
          }
        );
      });
    });

    it('mixed type casting (gh-3305)', (done) => {
      const Schema = mongoose.Schema({}, { strict: false });
      const Model = db.model('gh3305', Schema);

      Model.create({}, (error, m) => {
        assert.ifError(error);
        Model.update({ _id: m._id }, { $push: { myArr: { key: 'Value' } } }).exec((error, res) => {
          assert.ifError(error);
          done();
        });
      });
    });

    it.skip('replaceOne', (done) => {
      const schema = mongoose.Schema(
        { name: String, age: Number },
        {
          versionKey: false,
        }
      );
      const Model = db.model('gh3998_r1', schema);

      Model.create({ name: 'abc', age: 1 }, (error, m) => {
        assert.ifError(error);
        Model.replaceOne({ name: 'abc' }, { name: 'test' }).exec((err) => {
          assert.ifError(err);
          Model.findById(m._id).exec((error, doc) => {
            assert.ifError(error);
            assert.deepEqual(doc.toObject({ virtuals: false }), {
              _id: m._id,
              name: 'test',
            });
            done();
          });
        });
      });
    });

    it.skip('mixed nested type casting (gh-3337)', (done) => {
      const Schema = mongoose.Schema({ attributes: {} }, { strict: true });
      const Model = db.model('gh3337', Schema);

      Model.create({}, (error, m) => {
        assert.ifError(error);
        const update = { $push: { 'attributes.scores.bar': { a: 1 } } };
        Model.update({ _id: m._id }, update).exec((error, res) => {
          assert.ifError(error);
          Model.findById(m._id, (error, doc) => {
            assert.ifError(error);
            assert.equal(doc.attributes.scores.bar.length, 1);
            done();
          });
        });
      });
    });

    it('with single nested (gh-3820)', (done) => {
      const child = new mongoose.Schema({
        item2: {
          item3: String,
          item4: String,
        },
      });

      const parentSchema = new mongoose.Schema({
        name: String,
        item1: child,
      });

      const Parent = db.model('Parent', parentSchema);

      Parent.create({ name: 'test' }, (error, doc) => {
        assert.ifError(error);
        const update = { 'item1.item2': { item3: 'test1', item4: 'test2' } };
        doc.update(update, (error) => {
          assert.ifError(error);
          Parent.findOne({ _id: doc._id }, (error, doc) => {
            assert.ifError(error);
            assert.equal(doc.item1.item2.item3, 'test1');
            assert.equal(doc.item1.item2.item4, 'test2');
            done();
          });
        });
      });
    });

    it('with single nested and transform (gh-4621)', (done) => {
      const SubdocSchema = new Schema(
        {
          name: String,
        },
        {
          toObject: {
            transform(doc, ret) {
              ret.id = ret._id.toString();
              delete ret._id;
            },
          },
        }
      );

      const CollectionSchema = new Schema({
        field2: SubdocSchema,
      });

      const Collection = db.model('gh4621', CollectionSchema);

      Collection.create({}, (error, doc) => {
        assert.ifError(error);
        const update = { field2: { name: 'test' } };
        Collection.update({ _id: doc._id }, update, (err) => {
          assert.ifError(err);
          Collection.collection.findOne({ _id: doc._id }, (err, doc) => {
            assert.ifError(err);
            assert.ok(doc.field2._id);
            assert.ok(!doc.field2.id);
            done();
          });
        });
      });
    });

    it('works with buffers (gh-3496)', (done) => {
      const Schema = mongoose.Schema({ myBufferField: Buffer });
      const Model = db.model('gh3496', Schema);

      Model.update({}, { myBufferField: new Buffer(1) }, (error) => {
        assert.ifError(error);
        done();
      });
    });

    it('dontThrowCastError option (gh-3512)', (done) => {
      const Schema = mongoose.Schema({ name: String });
      const Model = db.model('gh3412', Schema);

      const badQuery = { _id: 'foo' };
      const update = { name: 'test' };
      const options = { dontThrowCastError: true };
      Model.update(badQuery, update, options).then(null, (error) => {
        assert.ok(error);
        done();
      });
    });

    it('.update(doc) (gh-3221)', (done) => {
      const Schema = mongoose.Schema({ name: String });
      const Model = db.model('gh3221', Schema);

      let query = Model.update({ name: 'Val' });
      assert.equal(query.getUpdate().$set.name, 'Val');

      query = Model.find().update({ name: 'Val' });
      assert.equal(query.getUpdate().$set.name, 'Val');

      done();
    });

    it.skip('nested schemas with strict false (gh-3883)', (done) => {
      const OrderSchema = new mongoose.Schema({}, { strict: false, _id: false });

      const SeasonSchema = new mongoose.Schema(
        {
          regions: [OrderSchema],
        },
        { useNestedStrict: true }
      );

      const Season = db.model('gh3883', SeasonSchema);
      const obj = { regions: [{ r: 'test', action: { order: 'hold' } }] };
      Season.create(obj, (error) => {
        assert.ifError(error);
        const query = { 'regions.r': 'test' };
        const update = { $set: { 'regions.$.action': { order: 'move' } } };
        const opts = { new: true };
        Season.findOneAndUpdate(query, update, opts, (error, doc) => {
          assert.ifError(error);
          assert.equal(doc.toObject().regions[0].action.order, 'move');
          done();
        });
      });
    });

    it('middleware update with exec (gh-3549)', (done) => {
      const Schema = mongoose.Schema({ name: String });

      Schema.pre('update', function (next) {
        this.update({ name: 'Val' });
        next();
      });

      const Model = db.model('gh3549', Schema);

      Model.create({}, (error, doc) => {
        assert.ifError(error);
        Model.update({ _id: doc._id }, { name: 'test' }).exec((error) => {
          assert.ifError(error);
          Model.findOne({ _id: doc._id }, (error, doc) => {
            assert.ifError(error);
            assert.equal(doc.name, 'Val');
            done();
          });
        });
      });
    });

    it('casting $push with overwrite (gh-3564)', (done) => {
      const schema = mongoose.Schema({
        topicId: Number,
        name: String,
        followers: [Number],
      });

      const doc = {
        topicId: 100,
        name: 'name',
        followers: [500],
      };

      const M = db.model('gh-3564', schema);

      M.create(doc, (err) => {
        assert.ifError(err);

        const update = { $push: { followers: 200 } };
        const opts = { overwrite: true, new: true, safe: true, upsert: false, multi: false };

        M.update({ topicId: doc.topicId }, update, opts, (err) => {
          assert.ifError(err);
          M.findOne({ topicId: doc.topicId }, (error, doc) => {
            assert.ifError(error);
            assert.equal(doc.name, 'name');
            assert.deepEqual(doc.followers.toObject(), [500, 200]);
            done();
          });
        });
      });
    });

    it('$push with buffer doesnt throw error (gh-3890)', (done) => {
      const InfoSchema = new Schema({
        prop: { type: Buffer },
      });

      const ModelASchema = new Schema({
        infoList: { type: [InfoSchema] },
      });

      const ModelA = db.model('gh3890', ModelASchema);

      const propValue = new Buffer('aa267824dc1796f265ab47870e279780', 'base64');

      const update = {
        $push: {
          info_list: { prop: propValue },
        },
      };

      ModelA.update({}, update, (error) => {
        assert.ifError(error);
        done();
      });
    });

    it('$set with buffer (gh-3961)', (done) => {
      const schema = {
        name: Buffer,
      };

      const Model = db.model('gh3961', schema);

      const value = new Buffer('aa267824dc1796f265ab47870e279780', 'base64');
      const instance = new Model({ name: null });

      instance.save((error) => {
        assert.ifError(error);
        const query = { _id: instance._id };
        const update = { $set: { name: value } };
        const ok = function () {
          done();
        };
        Model.update(query, update).then(ok, done);
      });
    });

    it.skip('versioning with setDefaultsOnInsert (gh-2593)', (done) => {
      const schema = new Schema({
        num: Number,
        arr: [{ num: Number }],
      });

      const Model = db.model('gh2593', schema);
      const update = { $inc: { num: 1 }, $push: { arr: { num: 5 } } };
      const options = {
        upsert: true,
        setDefaultsOnInsert: true,
        new: true,
        runValidators: true,
      };
      Model.update({}, update, options, (error) => {
        assert.ifError(error);
        done();
      });
    });

    it.skip('updates with timestamps with $set (gh-4989)', (done) => {
      const TagSchema = new Schema(
        {
          name: String,
          tags: [
            {
              enum: ['test1', 'test2'],
              type: String,
            },
          ],
        },
        { timestamps: true }
      );

      const Tag = db.model('gh4989', TagSchema);
      let tagId;

      Tag.remove({})
        .then(() => Tag.create({ name: 'test' }))
        .then(() => Tag.findOne())
        .then((tag) => {
          tagId = tag._id;
          return Tag.update(
            { _id: tagId },
            {
              $set: {
                tags: ['test1'],
              },
            }
          );
        })
        .then(() => Tag.findById(tagId))
        .then((res) => {
          assert.deepEqual(res.tags.toObject(), ['test1']);
          done();
        })
        .catch(done);
    });

    it.skip('lets $currentDate go through with updatedAt (gh-5222)', (done) => {
      const testSchema = new Schema(
        {
          name: String,
        },
        { timestamps: true }
      );

      const Test = db.model('gh5222', testSchema);

      Test.create({ name: 'test' }, (error) => {
        assert.ifError(error);
        const u = { $currentDate: { updatedAt: true }, name: 'test2' };
        Test.update({}, u, (error) => {
          assert.ifError(error);
          done();
        });
      });
    });

    it('update validators on single nested (gh-4332)', (done) => {
      const AreaSchema = new Schema({
        a: String,
      });

      const CompanySchema = new Schema({
        area: {
          type: AreaSchema,
          validate: {
            validator() {
              return false;
            },
            message: 'Not valid Area',
          },
        },
      });

      const Company = mongoose.model('Company', CompanySchema);

      const update = {
        area: {
          a: 'Helo',
        },
      };

      const opts = {
        runValidators: true,
      };

      Company.update({}, update, opts, (error) => {
        assert.ok(error);
        assert.equal(error.errors.area.message, 'Not valid Area');
        done();
      });
    });

    it.skip('updates child schema timestamps with $push (gh-4049)', (done) => {
      const opts = {
        timestamps: true,
        toObject: {
          virtuals: true,
        },
        toJSON: {
          virtuals: true,
        },
      };

      const childSchema = new mongoose.Schema(
        {
          senderId: { type: String },
        },
        opts
      );

      const parentSchema = new mongoose.Schema(
        {
          children: [childSchema],
        },
        opts
      );

      const Parent = db.model('gh4049', parentSchema);

      const b2 = new Parent();
      b2.save((err, doc) => {
        const query = { _id: doc._id };
        const update = { $push: { children: { senderId: '234' } } };
        const opts = { new: true };
        Parent.findOneAndUpdate(query, update, opts).exec((error, res) => {
          assert.ifError(error);
          assert.equal(res.children.length, 1);
          assert.equal(res.children[0].senderId, '234');
          assert.ok(res.children[0].createdAt);
          assert.ok(res.children[0].updatedAt);
          done();
        });
      });
    });

    it.skip('updates child schema timestamps with $set (gh-4049)', (done) => {
      const opts = {
        timestamps: true,
        toObject: {
          virtuals: true,
        },
        toJSON: {
          virtuals: true,
        },
      };

      const childSchema = new mongoose.Schema(
        {
          senderId: { type: String },
        },
        opts
      );

      const parentSchema = new mongoose.Schema(
        {
          children: [childSchema],
          child: childSchema,
        },
        opts
      );

      const Parent = db.model('gh4049_0', parentSchema);

      const b2 = new Parent();
      b2.save((err, doc) => {
        const query = { _id: doc._id };
        const update = {
          $set: {
            children: [{ senderId: '234' }],
            child: { senderId: '567' },
          },
        };
        const opts = { new: true };
        Parent.findOneAndUpdate(query, update, opts).exec((error, res) => {
          assert.ifError(error);
          assert.equal(res.children.length, 1);
          assert.equal(res.children[0].senderId, '234');
          assert.ok(res.children[0].createdAt);
          assert.ok(res.children[0].updatedAt);

          assert.ok(res.child.createdAt);
          assert.ok(res.child.updatedAt);
          done();
        });
      });
    });

    it('handles positional operator with timestamps (gh-4418)', (done) => {
      const schema = new Schema(
        {
          thing: [
            {
              thing2: { type: String },
              test: String,
            },
          ],
        },
        { timestamps: true }
      );

      const Model = db.model('gh4418', schema);
      const query = { 'thing.thing2': 'test' };
      const update = { $set: { 'thing.$.test': 'test' } };
      Model.update(query, update, (error) => {
        assert.ifError(error);
        done();
      });
    });

    it.skip('push with timestamps (gh-4514)', (done) => {
      const sampleSchema = new mongoose.Schema(
        {
          sampleArray: [
            {
              values: [String],
            },
          ],
        },
        { timestamps: true }
      );

      const sampleModel = db.model('gh4514', sampleSchema);
      const newRecord = new sampleModel({
        sampleArray: [{ values: ['record1'] }],
      });

      newRecord.save((err) => {
        assert.ifError(err);
        sampleModel.update(
          { 'sampleArray.values': 'record1' },
          {
            $push: { 'sampleArray.$.values': 'another record' },
          },
          { runValidators: true },
          (err) => {
            assert.ifError(err);
            done();
          }
        );
      });
    });

    it.skip('addToSet (gh-4953)', (done) => {
      const childSchema = new mongoose.Schema({
        name: {
          type: String,
          required: true,
        },
        lastName: {
          type: String,
          required: true,
        },
      });

      const parentSchema = new mongoose.Schema({
        children: [childSchema],
      });

      const Model = db.model('gh4953', parentSchema);

      const update = {
        $addToSet: { children: { name: 'Test' } },
      };
      const opts = { new: true, runValidators: true };
      Model.findOneAndUpdate({}, update, opts, (error) => {
        assert.ok(error);
        assert.ok(error.errors.children);
        done();
      });
    });

    it.skip('overwrite with timestamps (gh-4054)', (done) => {
      const testSchema = new Schema(
        {
          user: String,
          something: Number,
        },
        { timestamps: true }
      );

      const TestModel = db.model('gh4054', testSchema);
      const options = { overwrite: true, upsert: true };
      const update = {
        user: 'John',
        something: 1,
      };

      TestModel.update({ user: 'test' }, update, options, (error) => {
        assert.ifError(error);
        TestModel.findOne({}, (error, doc) => {
          assert.ifError(error);
          assert.ok(doc.createdAt);
          assert.ok(doc.updatedAt);
          done();
        });
      });
    });

    it.skip('update with buffer and exec (gh-4609)', (done) => {
      const arrSchema = new Schema({
        ip: mongoose.SchemaTypes.Buffer,
      });
      const schema = new Schema({
        arr: [arrSchema],
      });

      const M = db.model('gh4609', schema);

      const m = new M({ arr: [{ ip: new Buffer(1) }] });
      m.save((error, m) => {
        assert.ifError(error);
        m.update({ $push: { arr: { ip: new Buffer(1) } } }).exec((error) => {
          assert.ifError(error);
          done();
        });
      });
    });

    it('single nested with runValidators (gh-4420)', (done) => {
      const FileSchema = new Schema({
        name: String,
      });

      const CompanySchema = new Schema({
        name: String,
        file: FileSchema,
      });

      const Company = db.model('Company', CompanySchema);

      Company.create({ name: 'Booster Fuels' }, (error) => {
        assert.ifError(error);
        const update = { file: { name: 'new-name' } };
        const options = { runValidators: true };
        Company.update({}, update, options, (error) => {
          assert.ifError(error);
          done();
        });
      });
    });

    it.skip('single nested under doc array with runValidators (gh-4960)', (done) => {
      const ProductSchema = new Schema({
        name: String,
      });

      const UserSchema = new Schema({
        sell: [
          {
            product: { type: ProductSchema, required: true },
          },
        ],
      });

      const User = db.model('gh4960', UserSchema);

      User.create({})
        .then((user) =>
          User.update(
            {
              _id: user._id,
            },
            {
              sell: [
                {
                  product: {
                    name: 'Product 1',
                  },
                },
              ],
            },
            {
              runValidators: true,
            }
          )
        )
        // Should not throw
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('single nested schema with geo (gh-4465)', (done) => {
      const addressSchema = new Schema(
        {
          geo: { type: [Number], index: '2dsphere' },
        },
        { _id: false }
      );
      const containerSchema = new Schema({ address: addressSchema });
      const Container = db.model('gh4465', containerSchema);

      Container.update({}, { address: { geo: [-120.24, 39.21] } }).exec((error) => {
        assert.ifError(error);
        done();
      });
    });

    it.skip('runs validation on Mixed properties of embedded arrays during updates (gh-4441)', (done) => {
      const A = new Schema({ str: {} });
      let validateCalls = 0;
      A.path('str').validate((val, next) => {
        ++validateCalls;
        next();
      });

      let B = new Schema({ a: [A] });

      B = db.model('b', B);

      B.findOneAndUpdate(
        { foo: 'bar' },
        { $set: { a: [{ str: { somekey: 'someval' } }] } },
        { runValidators: true },
        (err) => {
          assert.ifError(err);
          assert.equal(validateCalls, 1);
          done();
        }
      );
    });

    it('updating single nested doc property casts correctly (gh-4655)', (done) => {
      const FileSchema = new Schema({});

      const ProfileSchema = new Schema({
        images: [FileSchema],
        rules: {
          hours: {
            begin: Date,
            end: Date,
          },
        },
      });

      const UserSchema = new Schema({
        email: { type: String },
        profiles: [ProfileSchema],
      });

      const User = db.model('gh4655', UserSchema);

      User.create({ profiles: [] }, (error, user) => {
        assert.ifError(error);
        User.update({ _id: user._id }, { $set: { 'profiles.0.rules': {} } }).exec((error) => {
          assert.ifError(error);
          User.findOne({ _id: user._id })
            .lean()
            .exec((error, doc) => {
              assert.ifError(error);
              assert.deepEqual(doc.profiles[0], { rules: {} });
              done();
            });
        });
      });
    });

    it.skip('with overwrite and upsert (gh-4749) (gh-5631)', (done) => {
      const schema = new Schema({
        name: String,
        meta: { age: { type: Number } },
      });
      const User = db.model('gh4749', schema);

      const filter = { name: 'Bar' };
      const update = { name: 'Bar', meta: { age: 33 } };
      const options = { overwrite: true, upsert: true };
      const q2 = User.update(filter, update, options);
      assert.deepEqual(q2.getUpdate(), {
        __v: 0,
        meta: { age: 33 },
        name: 'Bar',
      });

      const q3 = User.findOneAndUpdate(filter, update, options);
      assert.deepEqual(q3.getUpdate(), {
        __v: 0,
        meta: { age: 33 },
        name: 'Bar',
      });

      done();
    });

    it.skip('findOneAndUpdate with nested arrays (gh-5032)', (done) => {
      const schema = Schema({
        name: String,
        inputs: [[String]], // Array of Arrays of Strings
      });

      const Activity = db.model('Test', schema);

      const q = { name: 'Host Discovery' };
      const u = { inputs: [['ipRange']] };
      const o = { upsert: true };
      Activity.findOneAndUpdate(q, u, o).exec((error) => {
        assert.ifError(error);
        done();
      });
    });

    // FIXME: updateOne
    it.skip('findOneAndUpdate with timestamps (gh-5045)', (done) => {
      const schema = new Schema(
        {
          username: String,
          isDeleted: Boolean,
        },
        { timestamps: true }
      );
      const User = db.model('gh5045', schema);

      User.findOneAndUpdate(
        { username: 'test', isDeleted: false },
        { createdAt: '2017-03-06T14:08:59+00:00' },
        { new: true, setDefaultsOnInsert: true, upsert: true },
        (error) => {
          assert.ifError(error);
          User.updateOne({ username: 'test' }, { createdAt: new Date() }).exec((error) => {
            assert.ifError(error);
            done();
          });
        }
      );
    });

    it.skip('doesnt double-call setters when updating an array (gh-5041)', (done) => {
      let called = 0;
      const UserSchema = new Schema({
        name: String,
        foos: [
          {
            _id: false,
            foo: {
              type: Number,
              get(val) {
                return val.toString();
              },
              set(val) {
                ++called;
                return val;
              },
            },
          },
        ],
      });

      const User = db.model('gh5041', UserSchema);

      User.findOneAndUpdate({}, { foos: [{ foo: '13.57' }] }, (error) => {
        assert.ifError(error);
        assert.equal(called, 1);
        done();
      });
    });

    it.skip('overwrite doc with update validators (gh-3556)', (done) => {
      const testSchema = new Schema({
        name: {
          type: String,
          required: true,
        },
        otherName: String,
      });
      const Test = db.model('gh3556', testSchema);

      const opts = { overwrite: true, runValidators: true };
      Test.update({}, { otherName: 'test' }, opts, (error) => {
        assert.ok(error);
        assert.ok(error.errors.name);
        Test.update({}, { $set: { otherName: 'test' } }, opts, (error) => {
          assert.ifError(error);
          done();
        });
      });
    });

    it.skip('does not fail if passing whole doc (gh-5088)', (done) => {
      const schema = new Schema(
        {
          username: String,
          x: String,
        },
        { timestamps: true }
      );
      const User = db.model('gh5088', schema);

      User.create({ username: 'test' })
        .then((user) => {
          user.x = 'test2';
          return User.findOneAndUpdate({ _id: user._id }, user, { new: true });
        })
        .then((user) => {
          assert.equal(user.x, 'test2');
          done();
        })
        .catch(done);
    });

    it.skip('does not fail if passing whole doc (gh-5111)', (done) => {
      const schema = new Schema(
        {
          fieldOne: String,
        },
        { strict: true }
      );
      const Test = db.model('gh5111', schema);

      Test.create({ fieldOne: 'Test' })
        .then(() => {
          const data = { fieldOne: 'Test2', fieldTwo: 'Test3' };
          const opts = {
            upsert: true,
            runValidators: false,
            strict: false,
          };
          return Test.update({}, data, opts);
        })
        .then(() => Test.findOne())
        .then((doc) => {
          assert.equal(doc.fieldOne, 'Test2');
          assert.equal(doc.get('fieldTwo'), 'Test3');
          done();
        })
        .catch(done);
    });

    // FIXME: $pullAll not supported
    it.skip('$pullAll with null (gh-5164)', (done) => {
      const schema = new Schema(
        {
          name: String,
          arr: [{ name: String }],
        },
        { strict: true }
      );
      const Test = db.model('gh5164', schema);

      const doc = new Test({ name: 'Test', arr: [null, { name: 'abc' }] });

      doc
        .save()
        .then((doc) =>
          Test.update(
            { _id: doc._id },
            {
              $pullAll: { arr: [null] },
            }
          )
        )
        .then(() => Test.findById(doc))
        .then((doc) => {
          assert.equal(doc.arr.length, 1);
          assert.equal(doc.arr[0].name, 'abc');
          done();
        })
        .catch(done);
    });

    it.skip('$set array (gh-5403)', (done) => {
      const Schema = new mongoose.Schema({
        colors: [{ type: String }],
      });

      const Model = db.model('gh5403', Schema);

      Model.create({ colors: ['green'] })
        .then(() => Model.update({}, { $set: { colors: 'red' } }))
        .then(() => Model.collection.findOne())
        .then((doc) => {
          assert.deepEqual(doc.colors, ['red']);
          done();
        })
        .catch(done);
    });

    it.skip('defaults with overwrite and no update validators (gh-5384)', (done) => {
      const testSchema = new mongoose.Schema({
        name: String,
        something: { type: Number, default: 2 },
      });

      const TestModel = db.model('gh5384', testSchema);
      const options = {
        overwrite: true,
        upsert: true,
        setDefaultsOnInsert: true,
      };

      const update = { name: 'test' };
      TestModel.update({ name: 'a' }, update, options, (error) => {
        assert.ifError(error);
        TestModel.findOne({}, (error, doc) => {
          assert.ifError(error);
          assert.equal(doc.something, 2);
          done();
        });
      });
    });

    it.skip('update validators with nested required (gh-5269)', (done) => {
      const childSchema = new mongoose.Schema(
        {
          d1: {
            type: String,
            required: true,
          },
          d2: {
            type: String,
          },
        },
        { _id: false }
      );

      const parentSchema = new mongoose.Schema({
        d: childSchema,
      });

      const Parent = db.model('gh5269', parentSchema);

      Parent.update({}, { d: { d2: 'test' } }, { runValidators: true }, (error) => {
        assert.ok(error);
        assert.ok(error.errors.d);
        assert.ok(error.errors.d.message.indexOf('Path `d1` is required') !== -1, error.errors.d.message);
        done();
      });
    });

    it.skip('with setOptions overwrite (gh-5413)', (done) => {
      const schema = new mongoose.Schema(
        {
          _id: String,
          data: String,
        },
        { timestamps: true }
      );

      const Model = db.model('gh5413', schema);

      Model.where({ _id: 'test' })
        .setOptions({ overwrite: true, upsert: true })
        .update({ data: 'test2' })
        .exec()
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('$push with updateValidators and top-level doc (gh-5430)', (done) => {
      const notificationSchema = new mongoose.Schema({
        message: String,
      });

      const Notification = db.model('gh5430_0', notificationSchema);

      const userSchema = new mongoose.Schema({
        notifications: [notificationSchema],
      });

      const User = db.model('gh5430', userSchema);

      User.update(
        {},
        {
          $push: {
            notifications: {
              $each: [new Notification({ message: 'test' })],
            },
          },
        },
        { multi: true, runValidators: true }
      ).exec((error) => {
        assert.ifError(error);
        done();
      });
    });

    it.skip('$pull with updateValidators (gh-5555)', (done) => {
      const notificationSchema = new mongoose.Schema({
        message: {
          type: String,
          maxlength: 12,
        },
      });

      const userSchema = new mongoose.Schema({
        notifications: [notificationSchema],
      });

      const User = db.model('gh5555', userSchema);

      const opts = { multi: true, runValidators: true };
      const update = {
        $pull: {
          notifications: {
            message: 'This message is wayyyyyyyyyy too long',
          },
        },
      };
      User.create({ notifications: [{ message: 'test' }] }, (error, doc) => {
        assert.ifError(error);

        User.update({}, update, opts).exec((error) => {
          assert.ok(error);
          assert.ok(error.errors['notifications.message']);

          update.$pull.notifications.message = 'test';
          User.update({ _id: doc._id }, update, opts).exec((error) => {
            assert.ifError(error);
            User.findById(doc._id, (error, doc) => {
              assert.ifError(error);
              assert.equal(doc.notifications.length, 0);
              done();
            });
          });
        });
      });
    });

    // FIXME: updateOne
    it.skip('$pull with updateValidators and $in (gh-5744)', (done) => {
      const exampleSchema = mongoose.Schema({
        subdocuments: [
          {
            name: String,
          },
        ],
      });
      const ExampleModel = db.model('gh5744', exampleSchema);
      const exampleDocument = {
        subdocuments: [{ name: 'First' }, { name: 'Second' }],
      };

      ExampleModel.create(exampleDocument, (error, doc) => {
        assert.ifError(error);
        ExampleModel.updateOne(
          { _id: doc._id },
          {
            $pull: {
              subdocuments: {
                _id: { $in: [doc.subdocuments[0]._id] },
              },
            },
          },
          { runValidators: true },
          (error) => {
            assert.ifError(error);
            ExampleModel.findOne({ _id: doc._id }, (error, doc) => {
              assert.ifError(error);
              assert.equal(doc.subdocuments.length, 1);
              done();
            });
          }
        );
      });
    });

    it.skip('update with Decimal type (gh-5361)', (done) => {
      function test() {
        const schema = new mongoose.Schema({
          name: String,
          pricing: [
            {
              _id: false,
              program: String,
              money: mongoose.Schema.Types.Decimal,
            },
          ],
        });

        const Person = db.model('gh5361', schema);

        const data = {
          name: 'Jack',
          pricing: [
            { program: 'A', money: mongoose.Types.Decimal128.fromString('1.2') },
            { program: 'B', money: mongoose.Types.Decimal128.fromString('3.4') },
          ],
        };

        Person.create(data)
          .then(() => {
            const newData = {
              name: 'Jack',
              pricing: [
                { program: 'A', money: mongoose.Types.Decimal128.fromString('5.6') },
                { program: 'B', money: mongoose.Types.Decimal128.fromString('7.8') },
              ],
            };
            return Person.update({ name: 'Jack' }, newData);
          })
          .then(() => {
            done();
          }, done);
      }
    });

    it.skip('strict false in query (gh-5453)', (done) => {
      const schema = new mongoose.Schema(
        {
          date: { type: Date, required: true },
        },
        { strict: true }
      );

      const Model = db.model('gh5453', schema);
      const q = { $isolated: true };
      const u = { $set: { smth: 1 } };
      const o = { strict: false, upsert: true };
      Model.update(q, u, o)
        .then(() => {
          done();
        })
        .catch(done);
    });

    it.skip('returns error if passing array as conditions (gh-3677)', (done) => {
      const schema = new mongoose.Schema({
        name: String,
      });

      const Model = db.model('gh3677', schema);
      Model.updateMany(['foo'], { name: 'bar' }, (error) => {
        assert.ok(error);
        assert.equal(error.name, 'ObjectParameterError');
        const expected = 'Parameter "filter" to updateMany() must be an object';
        assert.ok(error.message.indexOf(expected) !== -1, error.message);
        done();
      });
    });

    it.skip('upsert: 1 (gh-5839)', (done) => {
      const schema = new mongoose.Schema({
        name: String,
      });

      const Model = db.model('gh5839', schema);

      const opts = { upsert: 1 };
      Model.update({ name: 'Test' }, { name: 'Test2' }, opts, (error) => {
        assert.ifError(error);
        Model.findOne({}, (error, doc) => {
          assert.ifError(error);
          assert.equal(doc.name, 'Test2');
          done();
        });
      });
    });

    it.skip('update with nested id (gh-5640)', (done) => {
      const testSchema = new mongoose.Schema(
        {
          _id: {
            a: String,
            b: String,
          },
          foo: String,
        },
        {
          strict: true,
        }
      );

      const Test = db.model('gh5640', testSchema);

      const doc = {
        _id: {
          a: 'a',
          b: 'b',
        },
        foo: 'bar',
      };

      Test.create(doc, (error, doc) => {
        assert.ifError(error);
        doc.foo = 'baz';
        Test.update({ _id: doc._id }, doc, { upsert: true }, (error) => {
          assert.ifError(error);
          Test.findOne({ _id: doc._id }, (error, doc) => {
            assert.ifError(error);
            assert.equal(doc.foo, 'baz');
            done();
          });
        });
      });
    });

    // FIXME: updateOne, updateMany
    it.skip('cast error in update conditions (gh-5477)', (done) => {
      const schema = new mongoose.Schema(
        {
          name: String,
        },
        { strict: true }
      );

      const Model = db.model('gh5477', schema);
      const q = { notAField: true };
      const u = { $set: { name: 'Test' } };
      const o = { upsert: true };

      let outstanding = 3;

      Model.update(q, u, o, (error) => {
        assert.ok(error);
        assert.ok(error.message.indexOf('notAField') !== -1, error.message);
        assert.ok(error.message.indexOf('upsert') !== -1, error.message);
        --outstanding || done();
      });

      Model.updateOne(q, u, o, (error) => {
        assert.ok(error);
        assert.ok(error.message.indexOf('notAField') !== -1, error.message);
        assert.ok(error.message.indexOf('upsert') !== -1, error.message);
        --outstanding || done();
      });

      Model.updateMany(q, u, o, (error) => {
        assert.ok(error);
        assert.ok(error.message.indexOf('notAField') !== -1, error.message);
        assert.ok(error.message.indexOf('upsert') !== -1, error.message);
        --outstanding || done();
      });
    });

    it('single embedded schema under document array (gh-4519)', (done) => {
      const PermissionSchema = new mongoose.Schema({
        read: { type: Boolean, required: true },
        write: Boolean,
      });
      const UserSchema = new mongoose.Schema({
        permission: {
          type: PermissionSchema,
        },
      });
      const GroupSchema = new mongoose.Schema({
        users: [UserSchema],
      });

      const Group = db.model('Group', GroupSchema);
      const update = {
        users: [
          {
            permission: {},
          },
        ],
      };
      const opts = {
        runValidators: true,
      };

      Group.update({}, update, opts, (error) => {
        assert.ok(error);
        assert.ok(error.errors['users.0.permission']);
        done();
      });
    });
  });
});
