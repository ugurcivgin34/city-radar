// City Radar npm audit evaluation (docs/security.md, spec 0003 AC-15, ADR 0009).
// `npm audit` exits non-zero both for vulnerabilities and for registry/advisory failures, so its
// JSON output is parsed here. Fail-closed, three outcomes:
//   0 — no high/critical advisory outside the recorded exceptions
//   3 — high/critical advisories found, an exception has expired, or an exception is malformed
//   2 — the audit could not complete or its output is unreadable (infrastructure failure)
// Usage: node scripts/npm-audit.mjs <npm-audit.json> <audit-exceptions.json>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);

const advisoryId = (url) => (typeof url === 'string' ? url.split('/').pop() : undefined);

/**
 * @param {string} auditText raw `npm audit --json` output
 * @param {{ exceptions?: Array<{ id: string, package: string, expires: string }> }} exceptionsDoc
 * @param {string} today ISO date (YYYY-MM-DD)
 */
export function evaluateAudit(auditText, exceptionsDoc, today) {
  let audit;
  try {
    audit = JSON.parse(auditText);
  } catch {
    return { code: 2, reason: 'npm audit output is not valid JSON' };
  }
  if (audit?.error) {
    // Registry failures may leave error.code/summary empty and put the cause in a top-level message.
    const parts = [audit.error.code, audit.error.summary, audit.error.detail, audit.message];
    const cause = parts.filter((p) => typeof p === 'string' && p.trim() !== '').join(' — ');
    return { code: 2, reason: `npm audit error: ${cause || 'no details reported'}` };
  }
  if (!audit?.metadata?.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    return { code: 2, reason: 'npm audit output has no vulnerability report' };
  }

  // Root advisories are the objects in `via`; string entries only point to other packages.
  const advisories = new Map();
  for (const entry of Object.values(audit.vulnerabilities)) {
    for (const via of entry.via ?? []) {
      if (typeof via !== 'object' || !via) continue;
      const id = advisoryId(via.url) ?? String(via.source);
      advisories.set(id, {
        id,
        package: via.name,
        severity: via.severity,
        title: via.title,
      });
    }
  }

  // A malformed exception must never widen the exception (fail-closed): without a valid id,
  // package and real YYYY-MM-DD expiry date it is reported as invalid and fails the check.
  const entries = Array.isArray(exceptionsDoc?.exceptions) ? exceptionsDoc.exceptions : null;
  if (!entries) {
    return {
      code: 3,
      blocking: [],
      expired: [],
      excepted: [],
      unused: [],
      invalid: [{ reason: 'exceptions must be an array' }],
    };
  }
  const invalid = entries
    .filter((e) => !isNonEmpty(e?.id) || !isNonEmpty(e?.package) || !isIsoDate(e?.expires))
    .map((e) => ({
      ...e,
      reason: 'needs a non-empty id and package and an expires date (YYYY-MM-DD)',
    }));
  const exceptions = entries.filter(
    (e) =>
      !invalid.some((i) => i.id === e?.id && i.package === e?.package && i.expires === e?.expires),
  );
  const blocking = [];
  const excepted = [];
  const expired = [];
  for (const advisory of advisories.values()) {
    if (!BLOCKING.has(advisory.severity)) continue;
    const exception = exceptions.find(
      (e) => e.id === advisory.id && e.package === advisory.package,
    );
    if (!exception) blocking.push(advisory);
    else if (exception.expires < today) expired.push({ ...advisory, expires: exception.expires });
    else excepted.push({ ...advisory, expires: exception.expires });
  }
  const unused = exceptions.filter((e) => !advisories.has(e.id));

  const code = blocking.length || expired.length || invalid.length ? 3 : 0;
  return { code, blocking, expired, excepted, unused, invalid };
}

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const [auditFile, exceptionsFile] = process.argv.slice(2);
  let result;
  try {
    const exceptionsDoc = JSON.parse(readFileSync(exceptionsFile, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    result = evaluateAudit(readFileSync(auditFile, 'utf8'), exceptionsDoc, today);
  } catch (error) {
    result = { code: 2, reason: `cannot read audit input: ${error.message}` };
  }
  if (result.code === 2) {
    console.error(`npm-audit: ${result.reason}`);
  } else {
    for (const a of result.excepted)
      console.log(
        `EXCEPTED (ADR 0009, until ${a.expires}): ${a.severity} ${a.package} ${a.id} — ${a.title}`,
      );
    for (const e of result.unused)
      console.log(`NOTE: exception ${e.id} (${e.package}) is no longer reported; remove it.`);
    for (const a of result.expired)
      console.error(
        `EXPIRED EXCEPTION (${a.expires}): ${a.severity} ${a.package} ${a.id} — ${a.title}`,
      );
    for (const a of result.blocking)
      console.error(`VULNERABLE: ${a.severity} ${a.package} ${a.id} — ${a.title}`);
    for (const e of result.invalid)
      console.error(
        `INVALID EXCEPTION ${JSON.stringify({ id: e.id, package: e.package, expires: e.expires })}: ${e.reason}`,
      );
    if (result.code === 0) console.log('npm-audit: no blocking high/critical advisories');
  }
  process.exit(result.code);
}
