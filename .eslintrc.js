module.exports = {
  root: true,
  extends: ['@arcblock/eslint-config-base'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
};
