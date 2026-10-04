// Range semantics of tooling/expo-sdk.mjs (bug-fix 0011): only exact, ~ and ^ are supported, ^
// follows npm's 0.x rules, and any other format returns null so the check fails closed.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { satisfies } from '../expo-sdk.mjs';

describe('satisfies', () => {
  const cases = [
    // exact
    ['1.2.3', '1.2.3', true],
    ['1.2.4', '1.2.3', false],
    ['1.0.0-rc.1', '1.0.0', false],
    // ~x.y.z: >= x.y.z < x.(y+1).0
    ['4.26.0', '~4.26.0', true],
    ['4.26.9', '~4.26.0', true],
    ['4.25.9', '~4.26.0', false],
    ['4.27.0', '~4.26.0', false],
    // ^x.y.z with x > 0: >= x.y.z < (x+1).0.0
    ['1.9.0', '^1.2.3', true],
    ['1.2.2', '^1.2.3', false],
    ['2.0.0', '^1.2.3', false],
    // ^0.y.z with y > 0: >= 0.y.z < 0.(y+1).0
    ['0.10.4', '^0.10.1', true],
    ['0.10.0', '^0.10.1', false],
    ['0.11.0', '^0.10.1', false],
    // ^0.0.z: exactly 0.0.z
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
  ];

  for (const [installed, range, expected] of cases) {
    test(`${installed} vs ${range} → ${expected}`, () => {
      assert.equal(satisfies(installed, range), expected);
    });
  }

  for (const range of ['next', '*', '>=1.0.0', '1.x', '~1.2', '1.2.3 - 1.4.0', '']) {
    test(`unsupported range ${JSON.stringify(range)} → null (fail-closed)`, () => {
      assert.equal(satisfies('1.2.3', range), null);
    });
  }
});
