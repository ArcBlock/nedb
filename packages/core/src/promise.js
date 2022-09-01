"use strict";
const DataStore = require('./datastore');
const cursorFnList = Object.freeze(['find', 'findOne', 'count', 'sort', 'skip', 'limit', 'projection']);
const resultFnList = Object.freeze([
    'insert',
    'remove',
    'update',
    // extra action
    'ensureIndex',
    'removeIndex',
    'getCandidates',
    'loadDatabase',
    'closeDatabase',
]);
function proxyFn(raw) {
    if (raw === undefined) {
        return undefined;
    }
    return new Proxy(raw, {
        // target 是目标对象
        // prop 是目标对象调用的方法
        get(target, prop) {
            // 模拟 promise 的 then
            if (prop === 'then') {
                return (resolve, reject) => {
                    target.exec((err, data) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(data);
                    });
                };
            }
            // 模拟 promise 的 catch
            if (prop === 'catch') {
                return (reject) => {
                    target.exec((err) => {
                        if (err) {
                            reject(err);
                        }
                    });
                };
            }
            const propFn = target[prop];
            if (typeof propFn === 'function') {
                if (cursorFnList.includes(prop)) {
                    // 这些方法返回的是 cursor 对象，可以进行链式调用
                    return function wrap(...args) {
                        const rawFn = propFn.bind(this)(...args);
                        return proxyFn(rawFn);
                    };
                }
                if (resultFnList.includes(prop)) {
                    // 这些方法执行完返回的是 undefined，必须通过回调函数获得结果
                    return function wrap(...args) {
                        // 如果有传入回调函数，则通过回调函数返回结果
                        if (typeof args[args.length - 1] === 'function') {
                            return propFn.bind(this)(...args);
                        }
                        return new Promise((resolve, reject) => {
                            propFn.bind(this)(...args, (err, ...resultArgs) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                if (resultArgs.length === 0) {
                                    resolve();
                                    return;
                                }
                                if (resultArgs.length === 1) {
                                    resolve(resultArgs[0]);
                                    return;
                                }
                                resolve(resultArgs);
                            });
                        });
                    };
                }
            }
            return propFn;
        },
    });
}
const PromisedDataStore = new Proxy(DataStore, {
    get(target, prop) {
        const raw = target[prop];
        if (prop === 'CURSOR_FN_LIST')
            return cursorFnList;
        if (prop === 'RESULT_FN_LIST')
            return resultFnList;
        return proxyFn(raw);
    },
});
module.exports = PromisedDataStore;
