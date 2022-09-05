import { Datastore } from './src';

type Market = {
  appId: string;
  appName: string;
  appPk?: string;
  appLink?: string;
  viewCount?: number;
};

const s = new Datastore<Market>({ timestampData: true });

(async () => {
  const newDoc = await s.insert({
    appId: '1',
    appName: 'test',
  });
  console.log(newDoc);

  const docs = await s.find();
  console.log(docs);

  const oldDoc = await s.findOne();
  console.log(oldDoc);

  const result = await s.cursor().query({ appId: '1' }).limit(1).exec();
  console.log(result);

  s.find({ appId: '1' }, (err, docs) => {
    console.log(docs?.map((x) => x._id));
  });

  s.count({ appId: '1' }).then((x) => console.log(x));
})();

// s.cursor().query({ appId: '1' }).limit(1).sort({ viewCount: 1 }).exec().then(console.log);

// s.find({ $or: [{ appId: '1' }, { appName: 'test' }] }, (err, docs) => {
//   console.log(docs?.map((x) => x.appId));
// });
