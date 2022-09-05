/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/lines-between-class-members */
import { doRpc } from './rpc';
import {
  PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL,
  PERSISTENCE_STOP_AUTO_COMPACTION,
  PERSISTENCE_COMPACT_DATAFILE,
} from './constants';

export class PersistenceProxy {
  socket: any;
  options: any;

  constructor(socket: any, options: any) {
    this.socket = socket;
    this.options = options;
  }

  setAutoCompactionInterval(interval: number) {
    return doRpc(this.socket, this.options, PERSISTENCE_SET_AUTO_COMPACTION_INTERVAL, [interval]);
  }

  stopAutoCompaction() {
    return doRpc(this.socket, this.options, PERSISTENCE_STOP_AUTO_COMPACTION, []);
  }

  compactDatafile() {
    return doRpc(this.socket, this.options, PERSISTENCE_COMPACT_DATAFILE, []);
  }
}
