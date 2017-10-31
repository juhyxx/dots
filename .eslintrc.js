module.exports = {
  root: true,
  "parser": "babel-eslint",
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  extends: 'eslint:recommended',
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  globals: {
    $: true,
    Ember: true,
    moment: true,
    _gopay: true,
    braintree: true,
    amplitude: true
  },
  rules: {
    "no-control-regex": 0,
    "no-useless-escape": 0
  }
};
