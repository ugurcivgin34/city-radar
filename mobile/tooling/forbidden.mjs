// FD-7: forbidden map SDK dependencies (docs/architecture.md; changing this needs an ADR).
// FD-6 defense-in-depth: provider hosts in any mobile source file, including file types ESLint
// does not parse. Run as `node tooling/forbidden.mjs [mobileRoot]`; exit 1 on any violation.
// Proven to fire by tooling/tests/forbidden.test.mjs (spec 0003, AC-11).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import providerHosts from './provider-hosts.js';

// react-native-maps / Mapbox / Google native map SDKs. MapLibre is allowed (docs/architecture.md).
export const FORBIDDEN_PACKAGES = [
  'react-native-maps',
  '@rnmapbox/maps',
  '@react-native-mapbox-gl/maps',
  'react-native-mapbox-gl',
  'react-native-google-maps',
  'expo-maps',
  'mapbox-gl',
];

const SOURCE_DIRS = ['app', 'src'];
const SOURCE_FILES = ['app.json'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);
const hostPattern = new RegExp(providerHosts.PROVIDER_HOST_SOURCE, 'i');

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

/** Forbidden packages declared in package.json or present anywhere in the lockfile tree. */
export function findForbiddenPackages(packageJson, lockJson) {
  const hits = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const name of Object.keys(packageJson?.[field] ?? {})) {
      if (FORBIDDEN_PACKAGES.includes(name)) hits.push({ name, where: `package.json ${field}` });
    }
  }
  for (const key of Object.keys(lockJson?.packages ?? {})) {
    const marker = key.lastIndexOf('node_modules/');
    if (marker === -1) continue;
    const name = key.slice(marker + 'node_modules/'.length);
    if (FORBIDDEN_PACKAGES.includes(name)) hits.push({ name, where: `package-lock.json ${key}` });
  }
  return hits;
}

/** Provider hosts found in the given source files ({ path, content }). */
export function findProviderHosts(files) {
  const hits = [];
  for (const file of files) {
    file.content.split(/\r?\n/).forEach((line, index) => {
      const match = hostPattern.exec(line);
      if (match) hits.push({ path: file.path, line: index + 1, host: match[2] });
    });
  }
  return hits;
}

function collectSourceFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
    }
  };
  for (const dir of SOURCE_DIRS) {
    if (existsSync(path.join(root, dir))) walk(path.join(root, dir));
  }
  for (const file of SOURCE_FILES) {
    if (existsSync(path.join(root, file))) files.push(path.join(root, file));
  }
  return files.map((full) => ({
    path: path.relative(root, full).split(path.sep).join('/'),
    content: readFileSync(full, 'utf8'),
  }));
}

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);

export function checkMobile(root) {
  const packageJson = readJson(path.join(root, 'package.json'));
  if (!packageJson) throw new Error(`no package.json in ${root}`);
  const lockJson = readJson(path.join(root, 'package-lock.json'));
  return {
    packages: findForbiddenPackages(packageJson, lockJson),
    hosts: findProviderHosts(collectSourceFiles(root)),
  };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = path.resolve(
    process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  );
  const { packages, hosts } = checkMobile(root);
  for (const hit of packages) console.error(`FD-7: forbidden map SDK "${hit.name}" (${hit.where})`);
  for (const hit of hosts)
    console.error(`FD-6: provider host "${hit.host}" in ${hit.path}:${hit.line}`);
  if (packages.length || hosts.length) {
    console.error('forbidden: FAILED');
    process.exit(1);
  }
  console.log('forbidden: no FD-6/FD-7 violations');
}
