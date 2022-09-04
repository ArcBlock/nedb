export class NativeError extends Error {}
export type CallbackError = NativeError | null;
export type CallbackWithResult<T = any> = (error: CallbackError, result?: T) => void;
export type CallbackWithError = (error: CallbackError) => void;
export type CallbackOptionalError = (error?: CallbackError) => void;

export type DatastoreOptions = {
  filename?: string = '';
  inMemoryOnly?: boolean = false;
  autoload?: boolean = false;
  timestampData?: boolean = false;

  onload?: CallbackOptionalError;

  // FIXME: hooks
  beforeDeserialization?: any;
  afterSerialization?: any;
  compareStrings?: any;
  corruptAlertThreshold?: any;

  // deprecated
  nodeWebkitAppName?: string = '';
};

export type IndexOptions = {
  fieldName: string;
  unique?: boolean;
  sparse?: boolean;
  hash?: boolean;
  expireAfterSeconds?: number;
};

export type UpdateOptions = {
  multi?: boolean = false;
  upsert?: boolean = false;
  returnUpdatedDocs?: boolean = false;
};

export type RemoveOptions = {
  multi?: boolean = false;
};

export type UpdateResult<T> = [number, T[], boolean];

export type ApplyBasicQueryCasting<T> = T | T[] | (T extends (infer U)[] ? U : any) | any;
export type Condition<T> = ApplyBasicQueryCasting<T> | QuerySelector<ApplyBasicQueryCasting<T>>;

export type FilterQuery<T> = { [P in keyof T]?: Condition<T[P]> } & RootQuerySelector<T>;
export type AnyArray<T> = T[];

export type ProjectionFields<T> = { [Key in keyof T]?: any } & Record<string, any>;

export type QuerySelector<T> = {
  $lt?: T;
  $lte?: T;
  $gt?: T;
  $gte?: T;
  $in?: [T] extends AnyArray<any> ? Unpacked<T>[] : T[];
  $nin?: [T] extends AnyArray<any> ? Unpacked<T>[] : T[];
  $ne?: T;

  $exists?: boolean;

  $regex?: T extends string ? RegExp | string : never;

  $size?: T extends AnyArray<any> ? number : never;
  $elemMatch?: T extends AnyArray<any> ? object : never;
};

export type RootQuerySelector<T> = {
  $and?: Array<FilterQuery<T>>;
  $or?: Array<FilterQuery<T>>;
  $not?: Array<FilterQuery<T>>;
  $where?: Function;

  // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
  // this will mark all unrecognized properties as any (including nested queries)
  [key: string]: any;
};
