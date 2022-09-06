export class NativeError extends Error {}
export type CallbackError = NativeError | null;
export type CallbackWithResult<T = any> = (error: CallbackError, result?: T) => void;
export type CallbackWithError = (error: CallbackError) => void;
export type CallbackOptionalError = (error?: CallbackError) => void;

export type DataStoreOptions = {
  filename?: string;
  inMemoryOnly?: boolean;
  autoload?: boolean;
  timestampData?: boolean;

  onload?: CallbackOptionalError;

  // FIXME: hooks
  beforeDeserialization?: any;
  afterSerialization?: any;
  compareStrings?: any;
  corruptAlertThreshold?: any;

  // deprecated
  nodeWebkitAppName?: string;
};

export type IndexOptions = {
  fieldName: string;
  unique?: boolean;
  sparse?: boolean;
  hash?: boolean;
  expireAfterSeconds?: number;
};

export type AnyObject = {
  [key: string]: any;
};

export type Row<T> = {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
} & T;

// shared
export type LiteralUnion<LiteralType, BaseType> = LiteralType | (BaseType & Record<never, never>);
export type ApplyBasicQueryCasting<T> = T | T[] | (T extends (infer U)[] ? U : any) | any;
export type Condition<T> = ApplyBasicQueryCasting<T> | QuerySelector<ApplyBasicQueryCasting<T>>;

// update documents
export type UpdateOptions = {
  multi?: boolean;
  upsert?: boolean;
  returnUpdatedDocs?: boolean;
};
export type UpdateResult<T> = [number, T[], boolean];
export type UpdateQuery<T> = {
  // https://www.npmjs.com/package/@nedb/core
  $set?: { [P in keyof T]?: any };
  $unset?: { [P in keyof T]?: true };
  $inc?: { [P in keyof T]?: number };
  $push?: { [P in keyof T]?: any };
  $pop?: { [P in keyof T]?: SortFlag };
  [key: string]: any;
};

// find documents
export type SortFlag = LiteralUnion<1 | -1, number>;
export type SortQuery<T> = { [P in keyof T]?: SortFlag };
export type ProjectionFlag = LiteralUnion<1 | 0, number>;
export type ProjectionQuery<T> = { [P in keyof T]?: ProjectionFlag } & Record<string, ProjectionFlag>;

// remove documents
export type RemoveOptions = {
  multi?: boolean;
};

export type FilterQuery<T> = { [P in keyof T]?: Condition<T[P]> } & RootQuerySelector<T>;
export type QuerySelector<T> = {
  $lt?: T;
  $lte?: T;
  $gt?: T;
  $gte?: T;
  $in?: T[];
  $nin?: T[];
  $ne?: T;

  $exists?: boolean;

  $regex?: T extends string ? RegExp | string : never;

  $size?: T extends any[] ? number : never;
  $elemMatch?: T extends any[] ? object : never;
};
export type RootQuerySelector<T> = {
  $and?: Array<FilterQuery<T>>;
  $or?: Array<FilterQuery<T>>;
  $not?: Array<FilterQuery<T>>;
  $where?: Function;

  // cursor ops
  // $limit?: number;
  // $skip?: number;
  // $sort?: SortQuery<T>;
  // $projection?: ProjectionQuery<T>;

  // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
  // this will mark all unrecognized properties as any (including nested queries)
  [key: string]: any;
};
