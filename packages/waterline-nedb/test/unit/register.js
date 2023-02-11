/**
 * Test dependencies
 */
const Adapter = require('../..');

describe('registerCollection', () => {
  it('should not hang or encounter any errors', (done) => {
    Adapter.registerCollection(
      {
        identity: 'foo',
      },
      done
    );
  });
});
