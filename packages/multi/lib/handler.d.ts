import { CallbackWithResult, DataStoreOptions } from '@nedb/core';
declare const DataStore: any;
export declare const createHandler: (map: Map<string, typeof DataStore>) => (options: DataStoreOptions, method: string, dataOnlyArgs: any[], reply: CallbackWithResult<any>) => void;
export {};
