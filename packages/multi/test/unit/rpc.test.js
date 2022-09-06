const test = require('tape'); // eslint-disable-line import/no-extraneous-dependencies
const errio = require('errio');

const { doRpc } = require('../../lib/rpc');

test('without callback', (t) => {
  const args = [{}];
  const socket = {
    send(filename, method, dataOnlyArgs) {
      t.deepEqual(dataOnlyArgs, args);
      t.end();
    },
  };

  doRpc(socket, 'file', 'method', args);
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
      send(filename, method, dataOnlyArgs, callback) {
        st.deepEqual(dataOnlyArgs, args.slice(0, 1));
        callback(null, socketReplyArg1);
      },
    };

    doRpc(socket, 'file', 'method', args);
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
      send(filename, method, dataOnlyArgs, callback) {
        st.deepEqual(dataOnlyArgs, args.slice(0, 1));
        callback(errio.stringify(new Error(errorMessage)));
      },
    };

    doRpc(socket, 'file', 'method', args);
  });
});
