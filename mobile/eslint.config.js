// Lint rules, including the mobile forbidden dependencies of docs/architecture.md (FD-5, FD-6,
// FD-8). FD-7 and the FD-6 defense-in-depth scan live in tooling/forbidden.mjs. The rules are
// proven to fire by tooling/tests/eslint-rules.test.mjs (spec 0003, AC-11).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

const { PROVIDER_HOST_SOURCE } = require('./tooling/provider-hosts.js');

const providerHost = `/${PROVIDER_HOST_SOURCE}/i`;

const FD5 =
  'FD-5: HTTP is only allowed inside src/api/ (the single HTTP boundary, docs/architecture.md).';
const FD6 =
  'FD-6: provider hosts must not appear in mobile source; the app talks only to the City Radar API.';
const FD8 =
  'FD-8: import the API boundary only through its public surface (src/api), never its internal files.';
const RAW_TEXT =
  'User-visible text comes from src/localization/tr.ts, not from literals in JSX (docs/conventions.md).';

// FD-6 and the raw-text rule share no-restricted-syntax, so they are always configured together.
const restrictedSyntax = [
  'error',
  { selector: `Literal[value=${providerHost}]`, message: FD6 },
  { selector: `TemplateElement[value.raw=${providerHost}]`, message: FD6 },
  { selector: 'JSXText[value=/\\S/]', message: RAW_TEXT },
];

const httpClients = [
  'axios',
  'cross-fetch',
  // Expo SDK's own fetch implementation (streaming); available without adding a dependency.
  'expo/fetch',
  'got',
  'isomorphic-fetch',
  'ky',
  'node-fetch',
  'superagent',
  'undici',
  'whatwg-fetch',
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // FD rules apply to the app's source; tooling and config files are not app source.
    files: ['app/**', 'src/**'],
    rules: {
      'no-restricted-syntax': restrictedSyntax,
      // FD-5: transport globals outside src/api.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: FD5 },
        { name: 'XMLHttpRequest', message: FD5 },
        { name: 'WebSocket', message: FD5 },
        { name: 'EventSource', message: FD5 },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'globalThis', property: 'fetch', message: FD5 },
        { object: 'globalThis', property: 'XMLHttpRequest', message: FD5 },
        { object: 'window', property: 'fetch', message: FD5 },
      ],
      'no-restricted-imports': [
        'error',
        {
          // FD-5: HTTP client libraries outside src/api.
          paths: httpClients.map((name) => ({ name, message: FD5 })),
          // FD-8: anything below an api/ directory, e.g. '../api/config' or a future
          // '../api/generated/types'; '../api' (the public surface) stays allowed.
          patterns: [{ regex: '^(\\.{1,2}/)+(.*/)?api/.+', message: FD8 }],
        },
      ],
    },
  },
  {
    // The API boundary itself: HTTP and its own internal modules are allowed here.
    files: ['src/api/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    // Tests may replace transport globals to prove that no request is made.
    files: ['**/__tests__/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
]);
