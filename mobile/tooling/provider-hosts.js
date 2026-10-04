// FD-6 (docs/architecture.md): provider hosts must never appear in mobile source.
// This is a START list of known İBB / İSPARK domains, NOT an exhaustive one: OD-1 (provider
// research ADR) has not been done yet; update this list with that ADR. Shared by eslint.config.js
// and tooling/forbidden.mjs so both checks use the same hosts.
const PROVIDER_HOSTS = ['ibb.gov.tr', 'ibb.istanbul', 'ispark.istanbul'];

const escape = (host) => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Matches a host or any of its subdomains, e.g. "ibb.gov.tr" and "data.ibb.gov.tr", but not
// "notibb.gov.tr".
const PROVIDER_HOST_SOURCE = `(^|[^a-z0-9-])(${PROVIDER_HOSTS.map(escape).join('|')})($|[^a-z0-9-])`;

module.exports = { PROVIDER_HOSTS, PROVIDER_HOST_SOURCE };
