// tooling/expo-sdk.mjs messages and input validation (bug-fix 0011 review L-1, L-2).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { describeMismatch, findSdkMismatches } from '../expo-sdk.mjs';

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'expo-sdk.mjs');

const lockOf = (packages) => ({
  lockfileVersion: 3,
  packages: Object.fromEntries(Object.entries(packages).map(([k, version]) => [k, { version }])),
});

describe('describeMismatch (L-1)', () => {
  test('a react-test-renderer pairing error names react, not the Expo SDK', () => {
    // PR #10 shape: react drifted to 19.2.8, the renderer stayed at the SDK's 19.2.3.
    const mismatches = findSdkMismatches({
      lockJson: lockOf({
        'node_modules/react': '19.2.8',
        'node_modules/react-test-renderer': '19.2.3',
      }),
      bundledNativeModules: { react: '19.2.3' },
    });
    const messages = mismatches.map(describeMismatch);
    const renderer = messages.find((m) => m.includes('react-test-renderer'));
    assert.match(renderer, /must equal the installed react \(19\.2\.8\)/);
    assert.doesNotMatch(renderer, /Expo SDK expects 19\.2\.8/);
    const react = messages.find((m) => m.startsWith('EXPO SDK MISMATCH: react installed'));
    assert.match(react, /Expo SDK expects 19\.2\.3/);
  });

  test('when only the renderer drifted (PR #12 shape) nothing points at react', () => {
    const mismatches = findSdkMismatches({
      lockJson: lockOf({
        'node_modules/react': '19.2.3',
        'node_modules/react-test-renderer': '19.2.8',
      }),
      bundledNativeModules: { react: '19.2.3' },
    });
    assert.equal(mismatches.length, 1, JSON.stringify(mismatches));
    const message = describeMismatch(mismatches[0]);
    assert.match(
      message,
      /react-test-renderer installed 19\.2\.8, must equal the installed react \(19\.2\.3\)/,
    );
    assert.doesNotMatch(message, /align react/);
  });
});

describe('input validation fails closed (L-2)', () => {
  test('a lockfile without a packages map is rejected, not passed', () => {
    const lockV1 = { lockfileVersion: 1, dependencies: { react: { version: '19.2.8' } } };
    assert.throws(
      () => findSdkMismatches({ lockJson: lockV1, bundledNativeModules: { react: '19.2.3' } }),
      /no `packages` map/,
    );
  });

  test('CLI: exit 2 for a lockfile without a packages map', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'expo-sdk-cli-'));
    try {
      mkdirSync(path.join(tmp, 'node_modules', 'expo'), { recursive: true });
      writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ dependencies: {} }));
      writeFileSync(
        path.join(tmp, 'node_modules', 'expo', 'bundledNativeModules.json'),
        JSON.stringify({ react: '19.2.3' }),
      );
      const run = () => spawnSync(process.execPath, [scriptPath, tmp], { encoding: 'utf8' });

      writeFileSync(
        path.join(tmp, 'package-lock.json'),
        JSON.stringify({ lockfileVersion: 1, dependencies: { react: { version: '19.2.8' } } }),
      );
      const v1 = run();
      assert.equal(v1.status, 2, v1.stderr);
      assert.match(v1.stderr, /cannot read input: .*no `packages` map/);

      writeFileSync(
        path.join(tmp, 'package-lock.json'),
        JSON.stringify(lockOf({ 'node_modules/expo': '57.0.26', 'node_modules/react': '19.2.3' })),
      );
      assert.equal(run().status, 0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
