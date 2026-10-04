// tooling/expo-sdk.mjs messages and input validation (bug-fix 0011 review L-1, L-2).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { describeMismatch, findSdkMismatches } from '../expo-sdk.mjs';

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
});
