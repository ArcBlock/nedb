const DataStore = require('./datastore');

const chainFnList = ['find', 'findOne', 'count', 'sort', 'skip', 'limit', 'projection'];
const resultFnList = [
  'insert',
  'remove',
  'update',
  // extra action
  'ensureIndex',
  'removeIndex',
  // 'getCandidates',
  // 'loadDatabase',
  // 'closeDatabase',
];

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
        if (chainFnList.includes(prop)) {
          // 这些方法返回的是 cursor 对象，可以进行链式调用
          return function wrap(...args) {
            const rawFn = propFn.bind(this)(...args);
            return proxyFn(rawFn);
          };
        }

        if (resultFnList.includes(prop)) {
          // 这些方法执行完返回的是 undefined，必须通过回调函数获得结果
          return function wrap(...args) {
            return new Promise((resolve, reject) => {
              propFn.bind(this)(...args, (err, data) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(data);
              });
            });
          };
        }
      }

      return propFn;
    },
  });
}

const PromiseDataStore = new Proxy(DataStore, {
  get(target, prop) {
    const raw = target[prop];
    return proxyFn(raw);
  },
});

module.exports = PromiseDataStore;
