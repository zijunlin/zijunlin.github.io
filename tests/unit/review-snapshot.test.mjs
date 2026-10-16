import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureReview } from '../../scripts/review-snapshot.mjs';

test('review captures committed, staged, working and untracked files without changing the index', async t => {
  const root = await mkdtemp(join(tmpdir(), 'review-snapshot-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  await writeFile(join(root, '.gitignore'), '.scratch/\n');
  await writeFile(join(root, 'tracked.js'), 'original\n');
  git('add', '.'); git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  await assert.rejects(captureReview(root, base), /No reviewable/);
  await writeFile(join(root, 'committed.js'), 'committed\n'); git('add', '.'); git('commit', '-m', 'change');
  await writeFile(join(root, 'tracked.js'), 'staged\n'); git('add', 'tracked.js');
  await writeFile(join(root, 'tracked.js'), 'working\n');
  await writeFile(join(root, 'new file.js'), 'new\n');
  const index = git('diff', '--cached');
  const result = await captureReview(root, base);
  const patch = await readFile(join(result.output, 'changes.patch'), 'utf8');
  for (const expected of ['committed.js', '+working', 'new file.js']) assert.ok(patch.includes(expected));
  assert.equal(git('diff', '--cached'), index);
  assert.equal((await captureReview(root, base)).fingerprint, result.fingerprint);
});
