// @ts-nocheck
/* eslint-disable no-new */
/* eslint-disable global-require */
/* eslint-disable no-console */
/**
 * Test runner dependencies
 */
const util = require('util');

const TestRunner = require('waterline-adapter-tests');
const Adapter = require('../..');

// Grab targeted interfaces from this adapter's `package.json` file:
let pkg = {};
let interfaces = [];
try {
  pkg = require('../../package.json');
  interfaces = pkg.sailsAdapter.implements;
} catch (e) {
  throw new Error(
    '\n' +
      'Could not read supported interfaces from "sails-adapter"."interfaces"' +
      '\n' +
      "in this adapter's `package.json` file ::" +
      `\n${util.inspect(e)}`
  );
}

console.info(`Testing \`${pkg.name}\`, a Sails adapter.`);
console.info(`Running \`waterline-adapter-tests\` against ${interfaces.length} interfaces...`);
console.info(`( ${interfaces.join(', ')} )`);
console.info('Latest draft of Waterline adapter interface spec:');
console.info('https://github.com/balderdashy/sails-docs/blob/master/adapter-specification.md');

/**
 * Integration Test Runner
 *
 * Uses the `waterline-adapter-tests` module to
 * run mocha tests against the specified interfaces
 * of the currently-implemented Waterline adapter API.
 */
new TestRunner({
  // Load the adapter module.
  adapter: Adapter,

  // Default adapter config to use.
  config: {
    schema: false,
  },

  // The set of adapter interfaces to test against.
  // (grabbed these from this adapter's package.json file above)
  interfaces,

  // Most databases implement 'semantic' and 'queryable'.
  //
  // As of Sails/Waterline v0.10, the 'associations' interface
  // is also available.  If you don't implement 'associations',
  // it will be polyfilled for you by Waterline core.  The core
  // implementation will always be used for cross-adapter / cross-connection
  // joins.
  //
  // In future versions of Sails/Waterline, 'queryable' may be also
  // be polyfilled by core.
  //
  // These polyfilled implementations can usually be further optimized at the
  // adapter level, since most databases provide optimizations for internal
  // operations.
  //
  // Full interface reference:
  // https://github.com/balderdashy/sails-docs/blob/master/adapter-specification.md
});
