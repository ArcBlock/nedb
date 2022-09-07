# @nedb/multi

`Nedb` (https://github.com/louischatriot/nedb) does not support concurrent access from multiple processes. One module which tries to solve this problem is `nedb-party` (https://github.com/allain/nedb-party). However, it does not support methods that return cursors. It also relies on each process starting a http server on the same port and whichever manages to start listening becomes the master and the others connect to it. This however does not work if you're using the `cluster` module (or `PM2`) as in that case the port is shared between the child processes and they are all able to become masters. I submitted a patch request, which was accepted, that instead used directory-based locking. This was enough to make it work but managing locks can be tricky.

I decided to try a similar, but lock-free approach, using the `axon` framework (https://github.com/tj/axon). There's still only one master process that the others connect to, but there are no locks. Also, both callback, promise and cursor-based methods are supported. The `setAutoCompactionInterval`, `stopAutoCompaction` and `compactDatafile` methods of the `DataStore#persistence` object are also supported, except for the `compaction.done` event fired after calling `compactDatafile`.

> This is a fork maintained by [ArcBlock](https://www.arcblock.io) of the original version by Vladimir. Which added promise and typescript support.

## Installation

`npm install --save @nedb/multi`

## Usage

You need to start the process which actually accesses the database separately. It's located in `<your-project-dir>/node_modules/@nedb/multi/server.js`. I suggest you use a process manager such as `PM2` to do this.

You can pass the port number on which the server will listen by giving it as the first argument of the child process or by setting the env variable `NEDB_MULTI_PORT`.

In your other processes create the datastore by passing the port you set in the previous step. All options fields which can be serialized to JSON, are supported, except for `autoload`.

### Javascript

```javascript
const { createDataStore } = require('@nedb/multi');

const DataStore = createDataStore(+process.env.NEDB_MULTI_PORT);

const db = new DataStore({ filename: 'test.db' });

// This is required
db.loadDatabase(async (err) => {
  // CRUD
  const newDoc = await db.insert({
    appId: '1',
    appName: 'test',
  });
  console.log(newDoc);

  const newDoc2 = await db.insert({
    appId: '2',
    appName: 'test2',
  });
  console.log(newDoc2);

  const docs = await db.find();
  console.log(docs);

  // promise style
  const oldDoc = await db.findOne({ appId: '2' });
  console.log(oldDoc);

  const [rowsAffected, updatedDocs, isUpsert] = await db.update(
    { appId: '2' },
    { $set: { appName: 'updated' } },
    { returnUpdatedDocs: true, upsert: true, multi: true }
  );
  console.log({ rowsAffected, updatedDocs, isUpsert });

  // cursor styled
  const result = await db.cursor().query({ appId: '1' }).limit(1).exec();
  console.log(result);
});
```

_Note: It does not matter if you start the server before or after creating the datastore._

### Typescript

Example:

```typescript
import { createDataStore } from '@nedb/multi';

const DataStore = createDataStore(+process.env.NEDB_MULTI_PORT);

type Market = {
  appId: string;
  appName: string;
  appPk?: string;
  appLink?: string;
  viewCount?: number;
};

const db = new DataStore<Market>({ timestampData: true });

(async () => {
  await db.loadDatabase();

  const newDoc = await db.insert({
    appId: '1',
    appName: 'test',
  });
  console.log(newDoc);

  const newDoc2 = await db.insert({
    appId: '2',
    appName: 'test2',
  });
  console.log(newDoc2);

  const docs = await db.find();
  console.log(docs);

  // promise style
  const oldDoc = await db.findOne({ appId: '2' });
  console.log(oldDoc);

  const [rowsAffected, updatedDocs, isUpsert] = await db.update(
    { appId: '2' },
    { $set: { appName: 'updated' } },
    { returnUpdatedDocs: true, upsert: true, multi: true }
  );
  console.log({ rowsAffected, updatedDocs, isUpsert });

  // cursor styled
  const result = await db.cursor().query({ appId: '1' }).limit(1).exec();
  console.log(result);

  db.find({ appId: '1' }, (err, docs) => {
    console.log(docs?.map((x) => x._id));
  });

  db.count({ appId: '1' }).then((x) => console.log(x));

  const rowsRemoved = await db.remove({ appId: '1' });
  console.log(rowsRemoved);

  process.exit(0);
})();
```

## Example

In `/example` folder you can find a project which uses `@nedb/multi` with `PM2`. It will create an `example.db` file that contains the inserts from two processes.

Run it with: `npm install`, then `npm start`

### Test

To run the tests execute: `npm test`.

## Credits

- https://github.com/vangelov/nedb-multi
