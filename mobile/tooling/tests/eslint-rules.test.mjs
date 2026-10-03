// AC-7, AC-8, AC-10, AC-11 (spec 0003): the real eslint.config.js must report each forbidden
// pattern and must stay silent for its allowed counterpart, so the FD checks cannot pass vacuously.
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslint = new ESLint({ cwd: mobileRoot });

async function messagesFor(code, file) {
  const [result] = await eslint.lintText(code, { filePath: path.join(mobileRoot, file) });
  return result.messages;
}

async function hits(code, file, prefix) {
  const messages = await messagesFor(code, file);
  assert.equal(
    messages.filter((m) => m.fatal).length,
    0,
    `parse error: ${JSON.stringify(messages)}`,
  );
  // Some rules prepend their own text to the custom message ("Unexpected use of 'fetch'. FD-5: …").
  return messages.filter((m) => m.message.includes(prefix));
}

describe('FD-5: HTTP only inside src/api', () => {
  const cases = [
    "export const load = () => fetch('https://example.com');",
    "export const load = () => globalThis.fetch('https://example.com');",
    "export const load = () => global.fetch('https://example.com');",
    "export const load = () => self.fetch('https://example.com');",
    'export const open = () => new XMLHttpRequest();',
    'export const open = () => new window.XMLHttpRequest();',
    "export const open = () => new global.WebSocket('wss://example.com');",
    "import axios from 'axios';\nexport const load = () => axios.get('/x');",
    "import { fetch } from 'expo/fetch';\nexport const load = () => fetch('https://example.com');",
  ];

  for (const code of cases) {
    test(`reports outside src/api: ${code.split('\n')[0]}`, async () => {
      assert.ok((await hits(code, 'src/screens/Example.tsx', 'FD-5')).length > 0);
    });

    test(`allows inside src/api: ${code.split('\n')[0]}`, async () => {
      assert.equal((await hits(code, 'src/api/client.ts', 'FD-5')).length, 0);
    });
  }
});

describe('FD-6: no provider hosts in mobile source', () => {
  for (const code of [
    "export const url = 'https://data.ibb.gov.tr/dataset';",
    'export const url = `https://ispark.istanbul/api/${1}`;',
  ]) {
    test(`reports ${code}`, async () => {
      assert.ok((await hits(code, 'src/screens/Example.ts', 'FD-6')).length > 0);
      // The API boundary is not an exception: the app talks only to the City Radar API.
      assert.ok((await hits(code, 'src/api/client.ts', 'FD-6')).length > 0);
    });
  }

  test('allows the word İSPARK and look-alike hosts', async () => {
    const code = "export const label = 'İSPARK';\nexport const other = 'https://notibb.gov.tr';";
    assert.equal((await hits(code, 'src/screens/Example.ts', 'FD-6')).length, 0);
  });
});

describe('FD-8: API boundary only through its public surface', () => {
  test('reports internal api imports outside src/api', async () => {
    for (const specifier of ['../api/config', '../../api/generated/types']) {
      const code = `import { x } from '${specifier}';\nexport const y = x;`;
      assert.ok((await hits(code, 'src/screens/Example.ts', 'FD-8')).length > 0, specifier);
    }
  });

  test('reports dynamic imports of internal api files outside src/api', async () => {
    const code = "export const load = () => import('../api/config');";
    assert.ok((await hits(code, 'src/screens/Example.ts', 'FD-8')).length > 0);
  });

  test('allows the public surface and internal imports inside src/api', async () => {
    for (const specifier of ['../api', '../api/index']) {
      const code = `import { getApiBaseUrl } from '${specifier}';\nexport const y = getApiBaseUrl;`;
      assert.equal((await hits(code, 'src/screens/Example.ts', 'FD-8')).length, 0, specifier);
    }
    const dynamic = "export const load = () => import('../api');";
    assert.equal((await hits(dynamic, 'src/screens/Example.ts', 'FD-8')).length, 0);
    const inside = "import { parseApiBaseUrl } from './config';\nexport const y = parseApiBaseUrl;";
    assert.equal((await hits(inside, 'src/api/other.ts', 'FD-8')).length, 0);
  });
});

describe('raw user-visible text', () => {
  const header = "import { Text } from 'react-native';\n";

  test('reports literal text in JSX', async () => {
    const code = `${header}export const A = () => <Text>Merhaba</Text>;`;
    assert.ok((await hits(code, 'src/screens/Example.tsx', 'User-visible text')).length > 0);
  });

  test('allows text from tr.ts', async () => {
    const code = `${header}import { tr } from '../localization/tr';\nexport const A = () => <Text>{tr.start.title}</Text>;`;
    assert.equal((await hits(code, 'src/screens/Example.tsx', 'User-visible text')).length, 0);
  });
});
