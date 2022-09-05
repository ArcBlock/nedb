import { SortQuery, ProjectionQuery, CallbackWithResult } from '@nedb/core';
export declare class Cursor<T> {
    private _findArgs;
    private _skip;
    private _limit;
    private _sort;
    private _projection;
    private options;
    private socket;
    constructor(socket: any, options: any, findArgs: any[]);
    sort(sort: SortQuery<T>): Cursor<T>;
    skip(skip: number): this;
    limit(limit: number): this;
    projection(projection: ProjectionQuery<T>): this;
    toJSON(): {
        [key: string]: any;
    };
    exec(callback?: CallbackWithResult<T[]>): PromiseLike<T[]>;
}
