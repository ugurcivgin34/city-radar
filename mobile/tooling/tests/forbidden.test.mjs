// AC-8, AC-9, AC-11 (spec 0003): tooling/forbidden.mjs must report each forbidden map SDK and
// provider host, stay silent for clean input, and fail the CLI (exit 1) on a violation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FORBIDDEN_PACKAGES,
  checkMobile,
  findForbiddenPackages,
  findProviderHosts,
} from '../forbidden.mjs';

const toolingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.resolve(toolingDir, '..');

describe('FD-7: forbidden map SDKs', () => {
  for (const name of FORBIDDEN_PACKAGES) {
    test(`reports ${name} in dependencies`, () => {
      assert.equal(findForbiddenPackages({ dependencies: { [name]: '1.0.0' } }, null).length, 1);
    });
  }

  test('reports devDependencies and nested lockfile entries', () => {
    assert.equal(
      findForbiddenPackages({ devDependencies: { '@rnmapbox/maps': '1.0.0' } }, null).length,
      1,
    );
    const lock = { packages: { 'node_modules/some-lib/node_modules/react-native-maps': {} } };
    assert.equal(findForbiddenPackages({}, lock).length, 1);
  });

  test('allows MapLibre and unrelated packages', () => {
    const pkg = { dependencies: { '@maplibre/maplibre-react-native': '1.0.0', expo: '57.0.26' } };
    const lock = { packages: { 'node_modules/@maplibre/maplibre-react-native': {} } };
    assert.deepEqual(findForbiddenPackages(pkg, lock), []);
  });
});

describe('FD-6: provider hosts (defense-in-depth scan)', () => {
  test('reports a provider host with its file and line', () => {
    const hits = findProviderHosts([
      { path: 'src/a.ts', content: "const ok = 1;\nconst u = 'https://uym.ibb.gov.tr/x';" },
    ]);
    assert.deepEqual(hits, [{ path: 'src/a.ts', line: 2, host: 'ibb.gov.tr' }]);
  });

  test('allows the word İSPARK and look-alike hosts', () => {
    const files = [{ path: 'src/a.ts', content: "const l = 'İSPARK'; const o = 'notibb.gov.tr';" }];
    assert.deepEqual(findProviderHosts(files), []);
  });
});

describe('the real mobile project', () => {
  test('has no FD-6/FD-7 violations', () => {
    assert.deepEqual(checkMobile(mobileRoot), { packages: [], hosts: [] });
  });
});

describe('CLI', () => {
  const run = (root) =>
    spawnSync(process.execPath, [path.join(toolingDir, 'forbidden.mjs'), root], {
      encoding: 'utf8',
    });

  test('exits 1 on a violation and 0 on a clean project', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'forbidden-'));
    try {
      mkdirSync(path.join(dir, 'src'));
      writeFileSync(path.join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: {} }));
      assert.equal(run(dir).status, 0);

      writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ dependencies: { 'react-native-maps': '1.0.0' } }),
      );
      const result = run(dir);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /FD-7: forbidden map SDK "react-native-maps"/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('scans .env.example for provider hosts', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'forbidden-'));
    try {
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: {} }));
      writeFileSync(
        path.join(dir, '.env.example'),
        'EXPO_PUBLIC_API_BASE_URL=http://localhost:5000\n',
      );
      assert.equal(run(dir).status, 0);

      writeFileSync(
        path.join(dir, '.env.example'),
        'EXPO_PUBLIC_API_BASE_URL=https://api.ibb.gov.tr\n',
      );
      const result = run(dir);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /FD-6: provider host "ibb\.gov\.tr" in \.env\.example:1/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
