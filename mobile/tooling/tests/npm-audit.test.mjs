// AC-15 (spec 0003), ADR 0009: scripts/npm-audit.mjs separates clean, vulnerable and
// infrastructure-failure outcomes and honours only exact, unexpired exceptions.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { evaluateAudit } from '../../../scripts/npm-audit.mjs';

const advisory = (name, severity, ghsa) => ({
  [name]: {
    severity,
    via: [
      {
        source: 1,
        name,
        severity,
        title: `${name} issue`,
        url: `https://github.com/advisories/${ghsa}`,
      },
    ],
  },
});

const report = (...entries) =>
  JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: Object.assign({}, ...entries),
    metadata: { vulnerabilities: { high: entries.length, critical: 0, total: entries.length } },
  });

const exceptions = {
  exceptions: [{ id: 'GHSA-aaaa', package: 'braces', expires: '2026-12-31' }],
};

describe('evaluateAudit', () => {
  test('clean report → 0', () => {
    assert.equal(evaluateAudit(report(), exceptions, '2026-10-03').code, 0);
  });

  test('moderate only → 0', () => {
    assert.equal(
      evaluateAudit(report(advisory('uuid', 'moderate', 'GHSA-m')), exceptions, '2026-10-03').code,
      0,
    );
  });

  test('high or critical outside the exceptions → 3', () => {
    for (const severity of ['high', 'critical']) {
      const result = evaluateAudit(
        report(advisory('lodash', severity, 'GHSA-zzzz')),
        exceptions,
        '2026-10-03',
      );
      assert.equal(result.code, 3);
      assert.equal(result.blocking[0].id, 'GHSA-zzzz');
    }
  });

  test('an exact, unexpired exception → 0 and is reported as excepted', () => {
    const result = evaluateAudit(
      report(advisory('braces', 'high', 'GHSA-aaaa')),
      exceptions,
      '2026-10-03',
    );
    assert.equal(result.code, 0);
    assert.equal(result.excepted.length, 1);
  });

  test('an exception does not cover another advisory of the same package', () => {
    const result = evaluateAudit(
      report(advisory('braces', 'high', 'GHSA-bbbb')),
      exceptions,
      '2026-10-03',
    );
    assert.equal(result.code, 3);
  });

  test('an expired exception → 3', () => {
    const result = evaluateAudit(
      report(advisory('braces', 'high', 'GHSA-aaaa')),
      exceptions,
      '2027-01-01',
    );
    assert.equal(result.code, 3);
    assert.equal(result.expired.length, 1);
  });

  test('a malformed exception never widens the exception → 3', () => {
    const highBraces = report(advisory('braces', 'high', 'GHSA-aaaa'));
    for (const bad of [
      { id: 'GHSA-aaaa', package: 'braces' },
      { id: 'GHSA-aaaa', package: 'braces', expires: '31.12.2026' },
      { id: 'GHSA-aaaa', package: 'braces', expires: '2026-02-30' },
      { id: '', package: 'braces', expires: '2026-12-31' },
      { id: 'GHSA-aaaa', package: '', expires: '2026-12-31' },
    ]) {
      const result = evaluateAudit(highBraces, { exceptions: [bad] }, '2026-10-03');
      assert.equal(result.code, 3, JSON.stringify(bad));
      assert.equal(result.excepted.length, 0, JSON.stringify(bad));
      assert.equal(result.invalid.length, 1, JSON.stringify(bad));
    }
    assert.equal(evaluateAudit(report(), {}, '2026-10-03').code, 3);
  });

  test('an exception that is no longer reported is listed as unused', () => {
    assert.equal(evaluateAudit(report(), exceptions, '2026-10-03').unused.length, 1);
  });

  test('npm error, invalid JSON or missing report → 2 (infrastructure)', () => {
    const error = JSON.stringify({ error: { code: 'ENOTFOUND', summary: 'request failed' } });
    assert.equal(evaluateAudit(error, exceptions, '2026-10-03').code, 2);
    assert.equal(evaluateAudit('not json', exceptions, '2026-10-03').code, 2);
    assert.equal(evaluateAudit('{}', exceptions, '2026-10-03').code, 2);
  });

  test('a registry failure reports its cause (npm puts it in a top-level message)', () => {
    // Shape produced by `npm audit --json` when the registry is unreachable.
    const output = JSON.stringify({
      message:
        'request to http://127.0.0.1:9/-/npm/v1/security/audits/quick failed, reason: connect ECONNREFUSED 127.0.0.1:9',
      error: { summary: '', detail: '' },
    });
    const result = evaluateAudit(output, exceptions, '2026-10-03');
    assert.equal(result.code, 2);
    assert.match(result.reason, /ECONNREFUSED 127\.0\.0\.1:9/);
  });
});
