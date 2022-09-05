export declare class PersistenceProxy {
    socket: any;
    options: any;
    constructor(socket: any, options: any);
    setAutoCompactionInterval(interval: number): PromiseLike<unknown>;
    stopAutoCompaction(): PromiseLike<unknown>;
    compactDatafile(): PromiseLike<unknown>;
}
