/* eslint-disable no-console */
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
// @ts-ignore
import omit from 'lodash.omit';

import { md5 } from './utils';

type RecoverFn = () => object;
type LoadFn = (dbPath: string, options: any) => void;
type CloseFn = (dbPath: string) => void;

type Backup = {
  recover: RecoverFn;
  load: LoadFn;
  close: CloseFn;
};

export function createBackup(dataDir: string): Backup {
  if (!dataDir) {
    return { recover: () => Promise.resolve({}), load: () => null, close: () => null };
  }

  if (fs.existsSync(dataDir) === false) {
    fs.mkdirpSync(dataDir);
  }

  const backupFile = path.join(dataDir, 'nedb-multi-backup.json');
  console.info('Using backup file', backupFile);

  const recover: RecoverFn = () => fs.readJsonSync(backupFile);
  const load: LoadFn = (dbPath: string, options: any) => fs.writeJsonSync(backupFile, { ...recover(), [md5(dbPath)]: options }); // prettier-ignore
  const close: CloseFn = (dbPath: string) => fs.writeJsonSync(backupFile, omit(recover(), [md5(dbPath)]));

  // make sure backup file exist
  if (fs.existsSync(backupFile) === false) {
    fs.writeJsonSync(backupFile, {});
  } else {
    // make sure backup file is valid json
    try {
      fs.readJsonSync(backupFile);
    } catch (err) {
      console.error('Reset backup file', err);
      fs.writeJsonSync(backupFile, {});
    }
  }

  return {
    recover,
    load,
    close,
  };
}
