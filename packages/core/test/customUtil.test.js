/* eslint-disable unicorn/filename-case */
const customUtils = require('../lib/customUtils');

describe('customUtils', () => {
  describe('uid', () => {
    it('Generates a string of the expected length', () => {
      customUtils.uid(3).length.should.equal(3);
      customUtils.uid(16).length.should.equal(16);
      customUtils.uid(42).length.should.equal(42);
      customUtils.uid(1000).length.should.equal(1000);
    });

    // Very small probability of conflict
    it('Generated uids should not be the same', () => {
      customUtils.uid(56).should.not.equal(customUtils.uid(56));
    });
  });
});
