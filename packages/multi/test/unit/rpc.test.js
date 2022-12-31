const test = require('tape'); // eslint-disable-line import/no-extraneous-dependencies
const errio = require('errio');

const { doRpc } = require('../../lib/rpc');
const { deserialize } = require('../../lib/utils');

test('without callback', (t) => {
  const args = [{}];
  const socket = {
    send(options, method, dataOnlyArgs) {
      t.deepEqual(dataOnlyArgs, args);
      t.end();
    },
  };

  doRpc(socket, { file: 'file' }, 'method', args);
});

test('with callback', (t) => {
  t.test('with no error', (st) => {
    const socketReplyArg1 = 'arg1';

    const args = [
      {},
      (err, arg1, arg2) => {
        st.notOk(err);
        st.deepEqual(arg1, socketReplyArg1);
        st.end();
      },
    ];

    const socket = {
      send(options, method, dataOnlyArgs, callback) {
        st.deepEqual(dataOnlyArgs, args.slice(0, 1));
        callback(null, socketReplyArg1);
      },
    };

    doRpc(socket, { file: 'file' }, 'method', args);
  });

  t.test('with error', (st) => {
    const errorMessage = 'message';

    const args = [
      {},
      (err) => {
        st.true(err instanceof Error);
        st.equal(err.message, errorMessage);
        st.end();
      },
    ];
    const socket = {
      send(options, method, dataOnlyArgs, callback) {
        st.deepEqual(dataOnlyArgs, args.slice(0, 1));
        callback(errio.stringify(new Error(errorMessage)));
      },
    };

    doRpc(socket, { file: 'file' }, 'method', args);
  });
});

test('with callback: serialized', (t) => {
  t.test('with no error', (st) => {
    const socketReplyArg1 = 'arg1';

    const args = [
      { key: 'value', regexp: /value/ },
      (err, arg1, arg2) => {
        st.notOk(err);
        st.deepEqual(arg1, socketReplyArg1);
        st.end();
      },
    ];

    const socket = {
      send(options, method, dataOnlyArgs, callback) {
        st.deepEqual(dataOnlyArgs.map(deserialize), args.slice(0, 1));
        callback(null, socketReplyArg1);
      },
    };

    doRpc(socket, { file: 'file', serialized: true }, 'method', args);
  });

  t.test('with error', (st) => {
    const errorMessage = 'message';

    const args = [
      { key: 'value', regexp: /value/ },
      (err) => {
        st.true(err instanceof Error);
        st.equal(err.message, errorMessage);
        st.end();
      },
    ];
    const socket = {
      send(options, method, dataOnlyArgs, callback) {
        st.deepEqual(dataOnlyArgs.map(deserialize), args.slice(0, 1));
        callback(errio.stringify(new Error(errorMessage)));
      },
    };

    doRpc(socket, { file: 'file', serialized: true }, 'method', args);
  });
});
