import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { initialize, run, handoff, release, workspace } from '../../scripts/worktree-session.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'worktree-session-test-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe', encoding: 'utf8' }).trim();
  git('init', '-b', 'master'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
  await writeFile(join(root, '.gitignore'), '.scratch/\nnode_modules/\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'session-fixture', version: '1.0.0', private: true }));
  const lock = { name: 'session-fixture', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'session-fixture', version: '1.0.0' } } };
  await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock));
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'node_modules/.package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  await writeFile(join(root, 'app.js'), 'original\n');
  git('add', '.'); git('commit', '-m', 'fixture');
  t.after(async () => {
    const trees = git('worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')).map(line => line.slice(9));
    for (const tree of trees) await release(tree).catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  return { root, git };
}

test('initialization pins the base, preserves dirty edits and reuses its reservation', async t => {
  const { root, git } = await fixture(t);
  await writeFile(join(root, 'app.js'), 'user edit\n');
  const state = await initialize(root, { base: 'HEAD' });
  assert.equal(state.baseSha, git('rev-parse', 'HEAD'));
  assert.match(state.initial.status, /app.js/);
  assert.notEqual(state.lease.port, 4173);
  assert.equal((await initialize(root, { base: 'HEAD' })).token, state.token);
  assert.equal(await readFile(join(root, 'app.js'), 'utf8'), 'user edit\n');
  await assert.rejects(workspace(join(root, 'node_modules')), /worktree root/);
});

test('linked worktrees skip busy and reserved ports; release preserves external services and evidence', async t => {
  const { root, git } = await fixture(t);
  const occupied = createServer();
  await new Promise((accept, reject) => { occupied.once('error', error => error.code === 'EADDRINUSE' ? accept() : reject(error)); occupied.listen(4174, '127.0.0.1', accept); });
  const ownsOccupied = occupied.listening;
  t.after(() => ownsOccupied ? new Promise(accept => occupied.close(accept)) : undefined);
  const first = await initialize(root, { base: 'HEAD' });
  const linked = join(root, '.scratch', 'linked');
  git('worktree', 'add', '-b', 'codex/test', linked);
  const second = await initialize(linked, { base: 'master', donor: root });
  t.after(async () => { await release(linked).catch(() => {}); });
  assert.notEqual(first.lease.port, 4174);
  assert.notEqual(second.lease.port, first.lease.port);
  assert.ok((await lstat(join(linked, 'node_modules'))).isSymbolicLink());
  const record = await run(linked, { label: 'pass', argv: [process.execPath, '-e', 'console.log("test evidence")'] });
  await release(linked);
  assert.match(await readFile(record.log, 'utf8'), /test evidence/);
  if (ownsOccupied) assert.ok(occupied.listening);
});

test('handoff invalidates successful checks after edits, including untracked content, and records failures', async t => {
  const { root } = await fixture(t);
  await initialize(root, { base: 'HEAD' });
  await writeFile(join(root, 'new.txt'), 'one');
  await run(root, { label: 'pass', argv: [process.execPath, '-e', 'console.log("ok"); console.error("stderr")'] });
  let report = await handoff(root);
  assert.equal(report.checks[0].reusable, true);
  assert.deepEqual(report.changedSinceStart, ['new.txt']);
  await writeFile(join(root, 'new.txt'), 'two');
  report = await handoff(root);
  assert.equal(report.checks[0].reusable, false);
  const failure = await run(root, { label: 'failure', argv: [process.execPath, '-e', 'process.exit(7)'] });
  assert.equal(failure.exitCode, 7);
  report = await handoff(root);
  assert.equal(report.checks[1].status, 'failed');
  assert.equal(report.checks[1].reusable, false);
  assert.match(await readFile(report.checks[0].log, 'utf8'), /stderr/);
});

test('checks that mutate files or change installed dependencies cannot be reused', async t => {
  const { root } = await fixture(t);
  await initialize(root, { base: 'HEAD' });
  await run(root, { label: 'mutates', argv: [process.execPath, '-e', 'require("fs").writeFileSync("app.js","changed")'] });
  assert.equal((await handoff(root)).checks[0].reusable, false);
  await run(root, { label: 'pass', argv: [process.execPath, '-e', ''] });
  assert.equal((await handoff(root)).checks[1].reusable, true);
  await writeFile(join(root, 'node_modules/.package-lock.json'), '{}');
  assert.equal((await handoff(root)).checks[1].reusable, false);
  await assert.rejects(run(root, { label: 'blocked', argv: [process.execPath, '-e', ''] }), /Dependencies or Node changed/);
});

test('foreign lease and active command lock cannot be released', async t => {
  const { root } = await fixture(t);
  const state = await initialize(root, { base: 'HEAD' });
  const owner = await readFile(state.lease.path, 'utf8');
  try {
    await writeFile(state.lease.path, JSON.stringify({ token: 'foreign', root }));
    await assert.rejects(release(root), /another session/);
    assert.match(await readFile(state.lease.path, 'utf8'), /foreign/);
  } finally { await writeFile(state.lease.path, owner); }
  const path = join(root, '.scratch/worktree/command.lock');
  await writeFile(path, '{"pid":123}');
  await assert.rejects(release(root), /Another command/);
  await rm(path);
});

test('initialization rejects wrong dependency donors and nonancestor baselines', async t => {
  const { root, git } = await fixture(t), donor = await fixture(t);
  await rm(join(root, 'node_modules'), { recursive: true });
  await writeFile(join(donor.root, 'package-lock.json'), '{}');
  await assert.rejects(initialize(root, { base: 'HEAD', donor: donor.root }), /differs/);
  git('checkout', '--orphan', 'unrelated'); git('commit', '-m', 'unrelated');
  await assert.rejects(initialize(root, { base: 'master' }), /ancestor/);
});

test('launch errors retain diagnostics and unlock the worktree for the next check', async t => {
  const { root } = await fixture(t);
  await initialize(root, { base: 'HEAD' });
  const failed = await run(root, { label: 'missing command', argv: [join(root, 'does-not-exist')] });
  assert.equal(failed.status, 'failed');
  assert.match(await readFile(failed.log, 'utf8'), /ENOENT/);
  const literal = 'spaces; $(not-a-shell) "quoted"';
  const passed = await run(root, { label: 'literal argv', argv: [process.execPath, '-e', 'console.log(process.argv[1])', literal] });
  assert.equal(passed.exitCode, 0);
  assert.equal((await readFile(passed.log, 'utf8')).trim(), literal);
});
