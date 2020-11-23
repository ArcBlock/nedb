# mongoose-nedb

A Mongoose driver for NeDB, most APIs are compatible.

## Limitations

- Operators
  - `$pushAll`, already removed in latest mongoose and mongodb
  - `$isolated`
- Indexes
  - `2dsphere`
- API
  - `update`: can not return `affected` just as mongodb does, https://github.com/louischatriot/nedb#updating-documents
  - `findOneAndUpdate`
  - `findAndRemove`
  - `findAndModify`

## Installation

```shell
npm install @abtnode/mongoose-nedb @abtnode/nedb mongoose@4.13.21 --save
```

## Usage

### 1. Setup

```javascript
require('@abtnode/mongoose-nedb').install();

const os = require('os');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

mongoose.set('debug', true);
mongoose.Promise = Promise;

const dbPath = path.join(os.tmpdir(), 'nedb');
fs.mkdirSync(dbPath, { recursive: true });

const ensureConnection = () => {
  return new Promise((resolve, reject) => {
    // This is needed
    mongoose.connect('mongodb://localhost/test', { dbPath });
    const db = mongoose.connection;
    db.on('error', (err) => {
      console.error.bind(console, 'connection error:');
      reject(err);
    });
    db.once('open', async () => {
      console.log('connected', dbPath);
      resolve(db);
    });
  });
};
```

### 2. Schema and Models

```javascript
const Kitten = mongoose.model(
  'Kitten',
  new mongoose.Schema(
    {
      name: String,
    },
    { collection: 'kitties' }
  )
);
```

### 3. Query Documents

```javascript
const ensureCallbackQuery = () =>
  new Promise((resolve, reject) => {
    Kitten.find({}, (err, items) => {
      if (err) {
        console.error('items find callback error', err);
        reject(err);
        return;
      }
      console.log(
        'find callback',
        items.map((x) => x.toJSON())
      );
      resolve(items);
    });
  });

const ensureComposeQuery = () =>
  new Promise((resolve, reject) => {
    const query = Kitten.find({});
    query.skip(2).limit(2).sort({ name: -1 });
    query.exec((err, items) => {
      if (err) {
        console.error('items find exec error', err);
        reject(err);
        return;
      }
      console.log(
        'find exec',
        items.map((x) => x.toJSON())
      );
      resolve(items);
    });
  });

const ensurePromiseQuery = () =>
  new Promise((resolve, reject) => {
    Kitten.find({})
      .then((items) => {
        console.log(
          'find promise',
          items.map((x) => x.toJSON())
        );
        resolve(items);
      })
      .catch((err) => {
        console.error('items find promise error', err);
        reject(err);
      });
  });

const ensurePromiseQueryOne = () =>
  new Promise((resolve, reject) => {
    Kitten.findOne({ _id: '5f81a4b1d877087c9e237f32' })
      .then((item) => {
        console.log('findOne promise', item.toJSON());
        resolve(item);
      })
      .catch((err) => {
        console.error('findOne promise error', err);
        reject(err);
      });
  });

const ensureCollectionAPI = (db) =>
  new Promise((resolve, reject) => {
    const collection = db.collection('kitties');
    collection.insert({ name: 'hello' }, (err, result) => {
      console.log('item inserted', err, result);
      if (err) {
        reject(err);
        return;
      }

      collection.find({}, (e, results) => {
        console.log('items find', e, results);
        if (e) {
          reject(e);
          return;
        }
        resolve();
      });
    });
  });
```

### 4. Update Documents

```javascript
const ensureCallbackCreate = () =>
  new Promise((resolve, reject) => {
    const kitten = new Kitten();

    kitten.on('error', (err) => {
      console.error('create callback error', err);
      reject(err);
    });

    kitten.name = 'hello world';
    kitten.save((err, result) => {
      if (err) {
        console.error('create callback error', err);
        reject(err);
        return;
      }

      console.log('create callback success', { err, result: result.toJSON() });
      resolve(result);
    });
  });

const ensureCallbackUpdate = (doc) =>
  new Promise((resolve, reject) => {
    Kitten.update({ _id: doc._id }, { name: `${doc.name} ${Math.random()}` }, (err, result) => {
      if (err) {
        console.error('update callback error', err);
        reject(err);
        return;
      }

      console.log('update callback success', { err, result });
      resolve(result);
    });
  });
```

### 5. Put things together

```javascript
ensureConnection().then(async (db) => {
  try {
    const doc = await ensureCallbackCreate();
    await ensureCallbackUpdate(doc);
    await ensureCallbackQuery();
    await ensureComposeQuery();
    await ensurePromiseQuery();
    await ensurePromiseQueryOne();
    await ensureCollectionAPI(db);
  } catch (err) {
    console.error(err);
  }
});
```
