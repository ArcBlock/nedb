const path = require('path');

module.exports = {
  root: true,
  extends: ['@arcblock/eslint-config-ts/base'],
  parserOptions: {
    project: path.resolve(__dirname, 'tsconfig.eslint.json'),
  },
  env: {
    mocha: true,
  },
  rules: {
    '@typescript-eslint/no-shadow': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/naming-convention': 'off',
    'func-names': 'off',
    'prefer-const': 'off',
    'global-require': 'off',
    'no-dupe-keys': 'off',
    'no-new': 'off',
    'no-continue': 'off',
    eqeqeq: 'off',
    'consistent-return': 'off',
    'no-param-reassign': 'off',
  },
};
