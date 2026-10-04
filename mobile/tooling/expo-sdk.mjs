// Expo SDK alignment check (spec 0003 AC-2; bug report Dependabot PR #10–#14).
// Source of truth: Expo's own metadata, node_modules/expo/bundledNativeModules.json of the installed
// SDK — no version table is kept here. Every copy of a listed package in package-lock.json
// (nested/transitive copies too) must satisfy the range Expo expects, and react-test-renderer must
// equal the installed react version (jest-expo renders with it). Range support is limited to
// exact / ~ / ^ ; any other format is a mismatch (fail-closed).
// Run as `node tooling/expo-sdk.mjs [mobileRoot]`: exit 0 aligned, 1 mismatch, 2 unreadable input.
// Proven by tooling/tests/expo-sdk-drift.test.mjs.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const RANGE = /^([~^]?)(\d+)\.(\d+)\.(\d+)$/;

const parse = (version) => {
  const match = VERSION.exec(version ?? '');
  return match ? match.slice(1).map(Number) : null;
};

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Does `installed` satisfy `range`? Supports "x.y.z", "~x.y.z" and "^x.y.z" (with the 0.x rules of
 * ^); returns null for any other range format so the caller can fail closed.
 */
export function satisfies(installed, range) {
  const match = RANGE.exec(String(range ?? '').trim());
  if (!match) return null;
  const [, operator, ...parts] = match;
  const min = parts.map(Number);
  const version = parse(installed);
  if (!version) return false;
  if (operator === '') return compare(version, min) === 0;
  if (compare(version, min) < 0) return false;
  let max;
  if (operator === '~') max = [min[0], min[1] + 1, 0];
  else if (min[0] > 0) max = [min[0] + 1, 0, 0];
  else if (min[1] > 0) max = [0, min[1] + 1, 0];
  else max = [0, 0, min[2] + 1];
  return compare(version, max) < 0;
}

const packageName = (lockKey) => {
  const marker = lockKey.lastIndexOf('node_modules/');
  return marker === -1 ? null : lockKey.slice(marker + 'node_modules/'.length);
};

/**
 * Installed copies that do not match the SDK: [{ name, expected, installed, where }].
 * Input is { packageJson, lockJson, bundledNativeModules }; only the lockfile is inspected, because
 * it records what is actually installed (package.json ranges can hide drift).
 */
export function findSdkMismatches({ lockJson, bundledNativeModules }) {
  // Fail closed (review L-2): a lockfile without a `packages` map (lockfileVersion 1) would
  // otherwise be checked against nothing and pass.
  const map = lockJson?.packages;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('package-lock.json has no `packages` map (lockfileVersion >= 2 required)');
  }
  const packages = Object.entries(map);
  const mismatches = [];

  for (const [where, entry] of packages) {
    const name = packageName(where);
    if (!name || !Object.hasOwn(bundledNativeModules ?? {}, name)) continue;
    const expected = bundledNativeModules[name];
    const ok = satisfies(entry?.version, expected);
    if (ok !== true) {
      mismatches.push({
        name,
        expected,
        installed: entry?.version,
        where,
        rule: 'sdk',
        ...(ok === null ? { reason: 'unsupported range format (only exact, ~ and ^)' } : {}),
      });
    }
  }

  const react = lockJson?.packages?.['node_modules/react']?.version;
  for (const [where, entry] of packages) {
    if (packageName(where) !== 'react-test-renderer') continue;
    if (entry?.version !== react) {
      mismatches.push({
        name: 'react-test-renderer',
        expected: react,
        installed: entry?.version,
        where,
        rule: 'react-pair',
      });
    }
  }
  return mismatches;
}

/** One-line message that names the rule actually violated (review L-1). */
export function describeMismatch(m) {
  const head = `EXPO SDK MISMATCH: ${m.name} installed ${m.installed}`;
  const tail = ` (${m.where})${m.reason ? ` — ${m.reason}` : ''}`;
  if (m.rule === 'react-pair') {
    return `${head}, must equal the installed react (${m.expected}); align react with the SDK first${tail}`;
  }
  return `${head}, Expo SDK expects ${m.expected}${tail}`;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = path.resolve(
    process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  );
  const files = {
    packageJson: path.join(root, 'package.json'),
    lockJson: path.join(root, 'package-lock.json'),
    bundledNativeModules: path.join(root, 'node_modules', 'expo', 'bundledNativeModules.json'),
  };
  let input;
  try {
    for (const file of Object.values(files)) {
      if (!existsSync(file)) throw new Error(`missing ${file} (run npm ci first)`);
    }
    input = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readJson(file)]));
  } catch (error) {
    console.error(`expo-sdk: cannot read input: ${error.message}`);
    process.exit(2);
  }
  let mismatches;
  try {
    mismatches = findSdkMismatches(input);
  } catch (error) {
    console.error(`expo-sdk: cannot read input: ${error.message}`);
    process.exit(2);
  }
  for (const m of mismatches) {
    console.error(describeMismatch(m));
  }
  if (mismatches.length) {
    console.error('expo-sdk: FAILED — align with `npx expo install --fix` or an SDK upgrade plan');
    process.exit(1);
  }
  console.log('expo-sdk: all installed Expo-managed packages match the SDK');
}
