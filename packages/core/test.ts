import { Datastore, PromisedDatastore } from './src';

type Market = {
  appId: string;
  appName: string;
  appPk?: string;
  appLink?: string;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

const s = new Datastore<Market>({ timestampData: true });
const p = new PromisedDatastore<Market>({ timestampData: true });

s.insert(
  {
    appId: '1',
    appName: 'test',
  },
  (err: any, item?: Market) => {
    if (err) {
      console.error(err);
    }

    console.log(item);
  }
);

s.cursor().query({ appId: '1' }).limit(1).sort({ viewCount: 1 }).exec().then(console.log);

// s.find({ $or: [{ appId: '1' }, { appName: 'test' }] }, (err, docs) => {
//   console.log(docs?.map((x) => x.appId));
// });

// p.insert({ appId: '1-p', appName: 'test-p' }).then(console.log);

// p.count({ viewCount: { $gt: 3, $lt: '' }, appId: '1-p' }).then(console.log);

// p.insert({
//   appId: '1',
//   appName: 'test',
// }).then(console.log);
