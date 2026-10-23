import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeWorker } from '../src/index.js';
test('build hashes fallback content and rejects missing files and invalid worker scope', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'outage-build-'));
  try {
    await assert.rejects(writeWorker({ outDir, fallback: '/offline.html' }), /ENOENT/);
    await writeFile(join(outDir, 'offline.html'), '<h1>Offline</h1>');
    const output = await writeWorker({ outDir, fallback: '/offline.html' });
    const first = await readFile(output, 'utf8');
    await writeFile(join(outDir, 'offline.html'), '<h1>Unavailable</h1>');
    await writeWorker({ outDir, fallback: '/offline.html' });
    assert.notEqual(await readFile(output, 'utf8'), first);
    await assert.rejects(writeWorker({ outDir, fallback: '/offline.html', worker: '/nested/sw.js' }), /scope/);
  } finally { await rm(outDir, { recursive: true, force: true }); }
});
