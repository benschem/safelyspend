// eslint.config.js
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default [
  {
    // .wrangler holds what `wrangler dev` generates while it runs, including bundled code
    ignores: ['dist/**', 'node_modules/**', '**/.wrangler/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        browser: true,
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...ts.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...prettier.rules,
      'react/react-in-jsx-scope': 'off',
      'comma-dangle': ['error', 'always-multiline'],
      'no-undef': 'off',
      // Prevent raw console usage - use debug utility instead
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      // toISOString() is UTC, so cutting the date off it gives yesterday for
      // part of each day in Australia
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name=/^(slice|split|substring)$/][callee.object.callee.property.name='toISOString']",
          message:
            'This is the UTC date. Use today() or formatISODate() from @/lib/dates for a calendar date.',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // autoFocus inside modal dialogs is the accessible pattern (focus must land inside the trap)
  {
    files: ['src/components/dialogs/**'],
    rules: {
      'jsx-a11y/no-autofocus': 'off',
    },
  },
];
