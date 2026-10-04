// Bug report: Dependabot PR #10–#14 / spec 0003 AC-2 — Expo-managed packages must stay at the
// versions Expo SDK 57 expects, and any drift must be visible in scripts/check.
// Reproduction (bug-fix workflow, REPRODUCE): Dependabot opened patch PRs for packages that Expo
// pins (react, react-dom, react-test-renderer, react-native-reanimated, react-native-worklets) and
// CI stayed green for #11 (reanimated 4.5.1→4.5.5) and #14 (worklets 0.10.1→0.10.4).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.resolve(toolingDir, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const packageJson = readJson(path.join(mobileRoot, 'package.json'));
const lockJson = readJson(path.join(mobileRoot, 'package-lock.json'));
const bundledNativeModules = readJson(
  path.join(mobileRoot, 'node_modules', 'expo', 'bundledNativeModules.json'),
);

const directDependencies = Object.keys({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
}).sort();

// SDK-coupled packages that bundledNativeModules.json does not list, written out on purpose so the
// set cannot shrink silently: expo itself, its log-box, and the renderer jest-expo pairs with react.
const SDK_COUPLED_EXTRAS = ['expo', '@expo/log-box', 'react-test-renderer'];

const MANAGED = [
  ...new Set([
    ...directDependencies.filter((name) => Object.hasOwn(bundledNativeModules, name)),
    ...SDK_COUPLED_EXTRAS,
  ]),
].sort();
const NON_MANAGED = directDependencies.filter((name) => !MANAGED.includes(name));

// --- Minimal, tolerant reader for the npm block's `ignore:` list of .github/dependabot.yml. ---
// No YAML dependency on purpose: only the shapes Dependabot documents for `ignore` are needed
// (scalar dependency-name, update-types as a flow list or a block list).

const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2');
const indentOf = (line) => line.length - line.trimStart().length;
const stripComment = (line) => line.replace(/\s+#.*$/, '').replace(/^\s*#.*$/, '');

function parseFlowList(value) {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  return inner
    .split(',')
    .map(unquote)
    .filter((item) => item !== '');
}

function readNpmIgnoreEntries(yamlText) {
  const lines = yamlText.split(/\r?\n/).map(stripComment);

  // Locate the `- package-ecosystem: npm` update block.
  const start = lines.findIndex((line) =>
    /^\s*-\s+package-ecosystem:\s*['"]?npm['"]?\s*$/.test(line),
  );
  if (start === -1) return null;
  const blockIndent = indentOf(lines[start]);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() !== '' && indentOf(lines[i]) <= blockIndent) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start + 1, end);

  const ignoreAt = block.findIndex((line) => /^\s*ignore:\s*$/.test(line));
  if (ignoreAt === -1) return [];
  const ignoreIndent = indentOf(block[ignoreAt]);

  const entries = [];
  let current = null;
  let listKey = null;
  for (let i = ignoreAt + 1; i < block.length; i += 1) {
    const line = block[i];
    if (line.trim() === '') continue;
    const indent = indentOf(line);
    if (indent <= ignoreIndent) break;
    let content = line.trim();
    if (/^-\s+\S/.test(content) && (current === null || indent <= current.indent)) {
      current = { indent, fields: {} };
      entries.push(current);
      listKey = null;
      content = content.replace(/^-\s+/, '');
    } else if (/^-\s+/.test(content) && listKey !== null) {
      current.fields[listKey].push(unquote(content.replace(/^-\s+/, '')));
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(content);
    if (!match || current === null) continue;
    const [, key, value] = match;
    if (value === '') {
      current.fields[key] = [];
      listKey = key;
    } else {
      current.fields[key] = value.trim().startsWith('[') ? parseFlowList(value) : unquote(value);
      listKey = null;
    }
  }
  return entries.map(({ fields }) => ({
    dependencyName: fields['dependency-name'],
    hasUpdateTypes: Object.hasOwn(fields, 'update-types'),
    updateTypes: fields['update-types'],
  }));
}

const dependabotText = readFileSync(path.join(repoRoot, '.github', 'dependabot.yml'), 'utf8');
const ignoreEntries = readNpmIgnoreEntries(dependabotText);

describe('A) Dependabot npm policy for Expo-managed packages (root cause 1)', () => {
  test('the reader finds the npm (/mobile) block and its ignore list', () => {
    assert.ok(ignoreEntries, 'no `package-ecosystem: npm` block in .github/dependabot.yml');
    assert.ok(ignoreEntries.length > 0, 'npm block has no ignore entries');
    for (const entry of ignoreEntries) {
      assert.equal(typeof entry.dependencyName, 'string', 'ignore entry without dependency-name');
    }
  });

  test('the managed set covers the packages from PR #10–#14', () => {
    for (const name of [
      'react',
      'react-dom',
      'react-test-renderer',
      'react-native-reanimated',
      'react-native-worklets',
    ]) {
      assert.ok(MANAGED.includes(name), `${name} is not in the managed set`);
    }
  });

  for (const name of MANAGED) {
    test(`${name}: exact ignore entry with no update-types (patch ignored too)`, () => {
      const exact = ignoreEntries.filter((entry) => entry.dependencyName === name);
      assert.equal(
        exact.length,
        1,
        `expected exactly one ignore entry with dependency-name "${name}", found ${exact.length}`,
      );
      assert.equal(
        exact[0].hasUpdateTypes,
        false,
        `"${name}" is ignored only for ${JSON.stringify(exact[0].updateTypes)}; ` +
          'patch updates still open PRs (Dependabot #10–#14) — all updates must be ignored',
      );
    });
  }

  test('no ignore entry uses a wildcard dependency-name', () => {
    const wildcards = ignoreEntries
      .map((entry) => entry.dependencyName)
      .filter((name) => name.includes('*'));
    assert.deepEqual(wildcards, [], `wildcard ignore entries: ${wildcards.join(', ')}`);
  });

  for (const name of NON_MANAGED) {
    test(`${name}: not managed by Expo, so never blanket-ignored`, () => {
      for (const entry of ignoreEntries.filter((e) => e.dependencyName === name)) {
        assert.equal(entry.hasUpdateTypes, true, `"${name}" is ignored for every update type`);
      }
    });
  }
});

// --- B) SDK alignment check (root cause 2). The test defines the interface:
// mobile/tooling/expo-sdk.mjs exports findSdkMismatches({ packageJson, lockJson,
// bundledNativeModules }) → [{ name, expected, installed, where }], and its CLI
// `node tooling/expo-sdk.mjs [mobileRoot]` exits 1 on any mismatch, 0 otherwise.
// Imported dynamically so group A still runs and reports while the module does not exist; the
// computed specifier keeps import/no-unresolved quiet until the Developer adds the module.
const scriptPath = path.join(toolingDir, 'expo-sdk.mjs');
const loadModule = () => import(pathToFileURL(scriptPath).href);

const lockOf = (packages) => ({
  name: 'fixture',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name: 'fixture', dependencies: {} },
    ...Object.fromEntries(Object.entries(packages).map(([key, version]) => [key, { version }])),
  },
});

const pkgOf = (dependencies, devDependencies = {}) => ({
  name: 'fixture',
  private: true,
  dependencies,
  devDependencies,
});

describe('B) Expo SDK alignment check (tooling/expo-sdk.mjs)', () => {
  test('#11: reanimated 4.5.5 installed while SDK 57 pins 4.5.1 → one mismatch', async () => {
    const { findSdkMismatches } = await loadModule();
    const mismatches = findSdkMismatches({
      packageJson: pkgOf({ 'react-native-reanimated': '4.5.5' }),
      lockJson: lockOf({ 'node_modules/react-native-reanimated': '4.5.5' }),
      bundledNativeModules: { 'react-native-reanimated': '4.5.1' },
    });
    assert.equal(mismatches.length, 1, JSON.stringify(mismatches));
    assert.equal(mismatches[0].name, 'react-native-reanimated');
    assert.equal(mismatches[0].expected, '4.5.1');
    assert.equal(mismatches[0].installed, '4.5.5');
  });

  test('tilde range: ~4.26.0 accepts 4.26.2 and rejects 4.27.0', async () => {
    const { findSdkMismatches } = await loadModule();
    const check = (installed) =>
      findSdkMismatches({
        packageJson: pkgOf({ 'react-native-screens': '~4.26.0' }),
        lockJson: lockOf({ 'node_modules/react-native-screens': installed }),
        bundledNativeModules: { 'react-native-screens': '~4.26.0' },
      });
    assert.deepEqual(check('4.26.2'), []);
    const drift = check('4.27.0');
    assert.equal(drift.length, 1, JSON.stringify(drift));
    assert.equal(drift[0].name, 'react-native-screens');
    assert.equal(drift[0].installed, '4.27.0');
  });

  test('nested (transitive) lockfile copies are checked too (spec 0003 F-1)', async () => {
    const { findSdkMismatches } = await loadModule();
    const nestedKey = 'node_modules/expo-router/node_modules/react-native-screens';
    const mismatches = findSdkMismatches({
      packageJson: pkgOf({ 'expo-router': '~57.0.24', 'react-native-screens': '~4.26.0' }),
      lockJson: lockOf({
        'node_modules/expo-router': '57.0.24',
        'node_modules/react-native-screens': '4.26.2',
        [nestedKey]: '4.24.0',
      }),
      bundledNativeModules: { 'expo-router': '~57.0.24', 'react-native-screens': '~4.26.0' },
    });
    assert.equal(mismatches.length, 1, JSON.stringify(mismatches));
    assert.equal(mismatches[0].name, 'react-native-screens');
    assert.equal(mismatches[0].installed, '4.24.0');
    assert.ok(
      String(mismatches[0].where).includes(nestedKey),
      `where should point at ${nestedKey}, got ${mismatches[0].where}`,
    );
  });

  test('#10/#12: react-test-renderer must equal the installed react version', async () => {
    const { findSdkMismatches } = await loadModule();
    const mismatches = findSdkMismatches({
      packageJson: pkgOf({ react: '19.2.3' }, { 'react-test-renderer': '19.2.8' }),
      lockJson: lockOf({
        'node_modules/react': '19.2.3',
        'node_modules/react-test-renderer': '19.2.8',
      }),
      bundledNativeModules: { react: '19.2.3' },
    });
    assert.equal(mismatches.length, 1, JSON.stringify(mismatches));
    assert.equal(mismatches[0].name, 'react-test-renderer');
    assert.equal(mismatches[0].expected, '19.2.3');
    assert.equal(mismatches[0].installed, '19.2.8');
  });

  test('an unsupported range format for an installed package fails closed', async () => {
    const { findSdkMismatches } = await loadModule();
    const mismatches = findSdkMismatches({
      packageJson: pkgOf({ 'react-native-worklets': '0.10.4' }),
      lockJson: lockOf({ 'node_modules/react-native-worklets': '0.10.4' }),
      bundledNativeModules: { 'react-native-worklets': 'next' },
    });
    assert.equal(mismatches.length, 1, JSON.stringify(mismatches));
    assert.equal(mismatches[0].name, 'react-native-worklets');
  });

  test('the real mobile project today has no mismatches', async () => {
    const { findSdkMismatches } = await loadModule();
    assert.deepEqual(findSdkMismatches({ packageJson, lockJson, bundledNativeModules }), []);
  });

  test('CLI: exit 1 naming the package on drift (#11), exit 0 when clean', async () => {
    await loadModule();
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'expo-sdk-drift-'));
    try {
      const writeFixture = (installed) => {
        writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify(pkgOf({ 'react-native-reanimated': installed })),
        );
        writeFileSync(
          path.join(tmp, 'package-lock.json'),
          JSON.stringify(lockOf({ 'node_modules/react-native-reanimated': installed })),
        );
        mkdirSync(path.join(tmp, 'node_modules', 'expo'), { recursive: true });
        writeFileSync(
          path.join(tmp, 'node_modules', 'expo', 'bundledNativeModules.json'),
          JSON.stringify({ 'react-native-reanimated': '4.5.1' }),
        );
      };
      const run = () =>
        spawnSync(process.execPath, [scriptPath, tmp], { cwd: mobileRoot, encoding: 'utf8' });

      writeFixture('4.5.5');
      const drift = run();
      assert.equal(drift.status, 1, `stdout: ${drift.stdout}\nstderr: ${drift.stderr}`);
      assert.match(drift.stderr, /react-native-reanimated/);

      writeFixture('4.5.1');
      const clean = run();
      assert.equal(clean.status, 0, `stdout: ${clean.stdout}\nstderr: ${clean.stderr}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('scripts/check runs the alignment check (drift visible in scripts/check, AC-2)', () => {
    const steps = readFileSync(path.join(repoRoot, 'scripts', 'check.conf'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
    const scripts = packageJson.scripts ?? {};
    const wired = steps.some(
      (step) =>
        step.includes('expo-sdk.mjs') ||
        Object.entries(scripts).some(
          ([name, command]) =>
            command.includes('expo-sdk.mjs') &&
            new RegExp(`npm run ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(step),
        ),
    );
    assert.ok(wired, 'no scripts/check.conf step runs tooling/expo-sdk.mjs');
  });
});
