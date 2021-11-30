module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 12,
    ecmaFeatures: {
      jsx: true,
    },
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'linebreak-style': 'off',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
      },
    ],
    'no-empty': [
      'error',
      {
        allowEmptyCatch: true,
      },
    ],
    'no-useless-escape': 'warn',
    'no-case-declarations': 'warn',
    'prefer-const': 'error',
  },
}
