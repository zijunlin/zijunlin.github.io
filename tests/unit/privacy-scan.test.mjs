import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanPrivacy } from '../../scripts/privacy-scan.mjs';

test('privacy scan reports locations without exposing values and excludes dependencies and oversized files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'privacy-scan-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src')); await mkdir(join(root, 'node_modules'));
  const secret = 'ghp_' + 'a'.repeat(36);
  await writeFile(join(root, 'src/contact.js'), `const value = '${secret}';\nconst email = 'person@example.invalid';`);
  await writeFile(join(root, 'node_modules/private.txt'), secret);
  await writeFile(join(root, 'large.txt'), 'x'.repeat(2 * 1024 * 1024 + 1));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  git('add', 'src/contact.js'); git('commit', '-m', 'fixture');
  const result = await scanPrivacy(root, { history: true });
  assert.ok(result.history.findings.some(hit => hit.kind === 'credential'));
  assert.equal(result.history.identityCount, 1);
  assert.ok(result.findings.some(hit => hit.kind === 'credential' && hit.path === 'src/contact.js'));
  assert.ok(result.findings.some(hit => hit.kind === 'email' && hit.line === 2));
  assert.ok(result.findings.every(hit => !hit.path.includes('node_modules')));
  assert.ok(result.skippedLarge.some(path => path.endsWith('large.txt')));
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(result).includes('person@example.invalid'));
});
