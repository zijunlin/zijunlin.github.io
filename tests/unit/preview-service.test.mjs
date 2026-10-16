import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { trackService, serviceStatus } from '../../scripts/preview-service.mjs';

test('service stop authenticates the owning checkout and terminates only its child', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'preview-service-'));
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  const closed = once(child, 'close');
  let finish;
  t.after(async () => { child.kill(); await closed; if (finish) await finish(); await rm(directory, { recursive: true, force: true }); });
  finish = await trackService(child, { root: directory, directory, log: 'test.log', port: 4178, session: 'test' });
  assert.equal((await serviceStatus(directory, directory)).state, 'running');
  await assert.rejects(serviceStatus(tmpdir(), directory, { stop: true }), /another checkout/);
  const file = join(directory, 'service.json'), original = await readFile(file, 'utf8');
  await writeFile(file, JSON.stringify({ ...JSON.parse(original), token: 'wrong' }));
  await assert.rejects(serviceStatus(directory, directory, { stop: true }), /authenticated/);
  assert.equal(child.exitCode, null);
  await writeFile(file, original);
  assert.equal((await serviceStatus(directory, directory, { stop: true })).state, 'stopping');
  await closed; await finish(); finish = undefined;
  assert.equal((await serviceStatus(directory, directory)).state, 'stopped');
});
