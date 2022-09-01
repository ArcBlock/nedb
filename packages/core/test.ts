import { Datastore } from './src';

type Market = {
  appId: string;
  appName: string;
  appPk?: string;
  appLink?: string;
  viewCount?: string;
  createdAt?: string;
  updatedAt?: string;
};

const store = new Datastore<Market>({ timestampData: true });

store.insert(
  {
    appId: '1',
    appName: 'test',
  },
  (err: any, item?: Market) => {
    if (err) {
      console.error(err);
    }

    console.log({ item });
  }
);
