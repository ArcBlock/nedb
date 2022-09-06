/* eslint-disable no-console */
const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

if (process.env.TRAVIS) {
  console.log('skip integration test in travis');
  // @ts-ignore
  return;
}

const pids = {};
const children = [];

function runProgram(program, label) {
  const options = {
    cwd: __dirname,
    env: process.env,
  };

  return new Promise((resolve, reject) => {
    const child = childProcess.exec(`node ${program}`, options, (err, res) => {
      console.log('runProgram.done', { err, program, res });

      pids[label] = child.pid;

      if (!err) {
        return resolve(res);
      }

      return reject(err);
    });

    children.push(child);
  });
}

process.on('exit', () => {
  try {
    fs.unlinkSync(path.join(__dirname, 'test.data'));
    children.forEach((child) => child.kill('SIGKILL'));
  } catch {
    // Do nothing
  }
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection', err); // eslint-disable-line no-console
  process.exit(1);
});

Promise.all([runProgram('writer.js', 'writer1'), runProgram('writer.js', 'writer2')])
  .then(() => runProgram('reader.js', 'reader1'))
  .then((output) => {
    const expected = [];
    const iterations = Number(process.env.NEDB_MULTI_ITERATIONS);

    for (let i = 0; i < iterations; i += 1) {
      expected.push({ pid: pids.writer1 });
    }

    for (let i = 0; i < iterations; i += 1) {
      expected.push({ pid: pids.writer2 });
    }

    const actual = JSON.parse(output);
    assert.deepEqual(actual, expected);

    process.exit(0);
  });
