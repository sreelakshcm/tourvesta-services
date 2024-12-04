import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: 'req|res|next|val|err' },
      ],
      'no-undef': 'error',
      quotes: ['error', 'single'],
      'spaced-comment': 'off',
      'no-console': 'warn',
      'consistent-return': 'off',
      'func-names': 'off',
      'object-shorthand': 'off',
      'no-process-exit': 'off',
      'no-param-reassign': 'off',
      'no-return-await': 'off',
      'no-underscore-dangle': 'off',
      'class-methods-use-this': 'off',
      'prefer-destructuring': ['error', { object: true, array: false }],
    },
  },
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  pluginJs.configs.recommended,
];
