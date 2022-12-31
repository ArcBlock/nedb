const test = require('tape'); // eslint-disable-line import/no-extraneous-dependencies

const utils = require('../../lib/utils');

test('endsWithCallback', (t) => {
  t.test('with empty arguments', (st) => {
    st.false(utils.endsWithCallback([]));
    st.end();
  });

  t.test('with no arguments', (st) => {
    st.false(utils.endsWithCallback());
    st.end();
  });

  t.test('with no data only arguments', (st) => {
    st.false(utils.endsWithCallback(1, {}, [], 'test', null));
    st.end();
  });

  t.test('with single function argument', (st) => {
    st.true(utils.endsWithCallback([() => {}]));
    st.end();
  });

  t.test('with data and function argument', (st) => {
    st.true(utils.endsWithCallback([1, {}, [], 'test', () => {}]));
    st.end();
  });
});

test('serialize & deserialize', (t) => {
  t.test('with primary types', (st) => {
    const arg = {
      string: 'string',
      number: 1234,
      date: new Date(),
      regexp: /value/,
      fn: () => 'value',
    };

    const serialized = utils.serialize(arg);
    const deserialized = utils.deserialize(serialized);

    st.equal(arg.string, deserialized.string);
    st.equal(arg.number, deserialized.number);
    st.equal(arg.date.toString(), deserialized.date.toString());
    st.equal(arg.regexp.toString(), deserialized.regexp.toString());
    st.equal(arg.fn.toString(), deserialized.fn.toString());
    st.end();
  });
});
