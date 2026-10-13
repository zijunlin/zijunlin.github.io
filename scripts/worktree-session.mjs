import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { finished } from 'node:stream/promises';
import { mkdir, readFile, writeFile, rename, lstat, readlink, realpath, symlink, open, unlink, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
const exists = async path => { try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function save(path, value) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await rename(temp, path);
}
export async function workspace(cwd = process.cwd()) {
  const root = await realpath(git(cwd, 'rev-parse', '--show-toplevel'));
  if (await realpath(cwd) !== root) throw new Error(`Run from the worktree root: ${root}`);
  const directory = join(root, '.scratch', 'worktree');
  return { root, directory, stateFile: join(directory, 'session.json') };
}
export async function snapshot(root) {
  const files = {};
  const names = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
  for (const name of [...new Set(names)].sort()) {
    const path = join(root, name);
    if (!await exists(path)) { files[name] = 'deleted'; continue; }
    const stat = await lstat(path);
    if (stat.isDirectory()) { files[name] = 'directory'; continue; }
    files[name] = hash(`${stat.mode}:` + (stat.isSymbolicLink() ? await readlink(path) : (await readFile(path)).toString('base64')));
  }
  const head = git(root, 'rev-parse', 'HEAD');
  const status = git(root, 'status', '--porcelain=v1', '--untracked-files=all');
  return { head, branch: git(root, 'branch', '--show-current') || '(detached)', status, files,
    fingerprint: hash(JSON.stringify({ head, status, files, staged: git(root, 'diff', '--cached', '--binary') })) };
}
async function lock(directory) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'command.lock');
  let handle;
  try { handle = await open(path, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error(`Another command owns ${path}; inspect it before removing a stale lock`); throw error; }
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return async () => { await handle.close(); await unlink(path); };
}
async function available(port) {
  return new Promise((accept, reject) => {
    const server = createServer();
    server.once('error', error => error.code === 'EADDRINUSE' ? accept(false) : reject(error));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(() => accept(true)));
  });
}
async function reserve(root, token) {
  const common = await realpath(resolve(root, git(root, 'rev-parse', '--git-common-dir')));
  const directory = join(tmpdir(), `site-worktree-ports-${hash(common).slice(0, 16)}`);
  await mkdir(directory, { recursive: true });
  for (let port = 4174; port <= 4273; port++) {
    const path = join(directory, `${port}.json`);
    let handle;
    try { handle = await open(path, 'wx'); } catch (error) { if (error.code === 'EEXIST') continue; throw error; }
    try {
      await handle.writeFile(JSON.stringify({ root, token, port }));
      if (await available(port)) return { port, path };
      await unlink(path);
    } catch (error) { await unlink(path).catch(() => {}); throw error; }
    finally { await handle.close(); }
  }
  throw new Error('No available worktree port in 4174–4273');
}
async function releaseLease(state) {
  if (!await exists(state.lease.path)) return;
  const owner = await json(state.lease.path);
  if (owner.token !== state.token || owner.root !== state.root) throw new Error('Port reservation belongs to another session');
  await unlink(state.lease.path);
}
async function verifyLease(state) {
  const owner = await json(state.lease.path).catch(() => null);
  if (owner?.token !== state.token || owner.root !== state.root) throw new Error('Port reservation missing or changed; release and initialize the session again');
}
async function dependencyIdentity(root) {
  return hash(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
    package: hash(await readFile(join(root, 'package.json'))), lock: hash(await readFile(join(root, 'package-lock.json'))),
    installed: hash(await readFile(join(root, 'node_modules', '.package-lock.json'))) }));
}
async function checkInstalled(root, log) {
  const expected = await json(join(root, 'package-lock.json'));
  const installed = await json(join(root, 'node_modules', '.package-lock.json'));
  for (const [name, actual] of Object.entries(installed.packages || {})) {
    if (!name) continue;
    const wanted = expected.packages?.[name];
    if (!wanted || ['version', 'resolved', 'integrity'].some(key => wanted[key] !== actual[key])) {
      throw new Error(`Installed dependency differs from package-lock.json: ${name}; run npm ci`);
    }
  }
  const result = await execute(root, ['npm', 'ls', '--all'], log, {}, { quiet: true });
  if (result.exitCode !== 0) throw new Error(`Dependencies are incomplete; see ${log}`);
}
async function dependencies(root, donor, log) {
  const lockHash = hash(await readFile(join(root, 'package-lock.json')));
  if (await exists(join(root, 'node_modules'))) {
    if (donor) throw new Error('node_modules already exists; omit --deps-from to preserve it');
    await checkInstalled(root, log);
    return { method: 'existing', lockHash, node: process.version, identity: await dependencyIdentity(root) };
  }
  if (donor) {
    const source = await realpath(resolve(root, donor));
    if (hash(await readFile(join(source, 'package-lock.json'))) !== lockHash ||
        hash(await readFile(join(source, 'package.json'))) !== hash(await readFile(join(root, 'package.json')))) {
      throw new Error('Dependency source package.json/package-lock.json differs from this worktree');
    }
    await checkInstalled(source, log);
    await symlink(await realpath(join(source, 'node_modules')), join(root, 'node_modules'), 'dir');
    return { method: 'shared', source, lockHash, node: process.version, identity: await dependencyIdentity(root) };
  }
  const result = await execute(root, ['npm', 'ci'], log);
  if (result.exitCode !== 0) throw new Error(`npm ci failed; see ${log}`);
  return { method: 'npm ci', lockHash, node: process.version, identity: await dependencyIdentity(root) };
}
async function execute(root, argv, log, env = {}, { quiet = false } = {}) {
  const logHandle = await open(log, 'w');
  const stream = logHandle.createWriteStream();
  const child = spawn(argv[0], argv.slice(1), { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logError;
  stream.on('error', error => { logError = String(error); child.kill('SIGTERM'); });
  const forward = signal => child.kill(signal);
  const interrupt = () => forward('SIGINT'), terminate = () => forward('SIGTERM');
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  child.stdout.on('data', data => { stream.write(data); if (!quiet) process.stdout.write(data); });
  child.stderr.on('data', data => { stream.write(data); if (!quiet) process.stderr.write(data); });
  let launchError;
  child.once('error', error => { launchError = String(error); stream.write(launchError + '\n'); });
  const result = await new Promise(accept => child.once('close', (exitCode, signal) => accept({ exitCode, signal, error: launchError })));
  stream.end();
  await finished(stream).catch(error => { logError = String(error); });
  if (logError) { result.error = logError; result.exitCode = 1; }
  process.off('SIGINT', interrupt); process.off('SIGTERM', terminate);
  return result;
}
export async function initialize(cwd, { base, donor } = {}) {
  const ctx = await workspace(cwd), unlock = await lock(ctx.directory);
  try {
    if (!base) throw new Error('init requires --base <commit-or-ref>');
    const baseSha = git(ctx.root, 'rev-parse', '--verify', `${base}^{commit}`);
    try { git(ctx.root, 'merge-base', '--is-ancestor', baseSha, 'HEAD'); }
    catch { throw new Error('Base must be an ancestor of this worktree HEAD'); }
    if (await exists(ctx.stateFile)) {
      const previous = await loadSession(ctx);
      if (previous.baseSha !== baseSha) throw new Error('Existing session has a different base; release it before reinitializing');
      if (previous.dependencies.identity !== await dependencyIdentity(ctx.root)) throw new Error('Dependencies or Node changed; prepare dependencies, release and reinitialize');
      await verifyLease(previous);
      return previous;
    }
    const state = { version: 1, token: randomUUID(), root: ctx.root, baseRef: base, baseSha, startedAt: new Date().toISOString() };
    await mkdir(join(ctx.directory, 'runs'), { recursive: true });
    await mkdir(join(ctx.directory, 'logs'), { recursive: true });
    state.initial = await snapshot(ctx.root);
    state.dependencies = await dependencies(ctx.root, donor, join(ctx.directory, 'logs', 'dependencies.log'));
    state.lease = await reserve(ctx.root, state.token);
    try { await save(ctx.stateFile, state); } catch (error) { await releaseLease(state); throw error; }
    return state;
  } finally { await unlock(); }
}
async function loadSession(ctx) {
  const state = await json(ctx.stateFile).catch(error => { throw new Error(`Initialize this worktree first (${error.message})`); });
  if (state.root !== ctx.root) throw new Error('Session belongs to a different worktree; do not copy .scratch/worktree');
  return state;
}
export async function run(cwd, { label, argv, kind = 'check' }) {
  if (!label || !argv?.length) throw new Error('A label and command are required');
  const ctx = await workspace(cwd), unlock = await lock(ctx.directory);
  try {
    const state = await loadSession(ctx);
    await verifyLease(state);
    if (state.dependencies.identity !== await dependencyIdentity(ctx.root)) throw new Error('Dependencies or Node changed; prepare dependencies, release and reinitialize');
    const id = randomUUID(), recordFile = join(ctx.directory, 'runs', `${id}.json`);
    const evidence = join(ctx.directory, 'evidence', id);
    await mkdir(evidence, { recursive: true });
    const record = { id, session: state.token, label, kind, argv, dependencies: state.dependencies.identity, startedAt: new Date().toISOString(), before: await snapshot(ctx.root), log: join(ctx.directory, 'logs', `${id}.log`), evidence, status: 'running' };
    await save(recordFile, record);
    const env = { WORKTREE_MANAGED: '1', WORKTREE_PORT: String(state.lease.port), WORKTREE_EVIDENCE_DIR: evidence,
      GAME_EVIDENCE_DIR: evidence, GAME_PERF_URL: `http://127.0.0.1:${state.lease.port}/?seed=0` };
    try { Object.assign(record, await execute(ctx.root, argv, record.log, env)); }
    catch (error) { Object.assign(record, { exitCode: 1, error: String(error) }); }
    record.after = await snapshot(ctx.root);
    record.finishedAt = new Date().toISOString();
    record.status = record.exitCode === 0 && !record.error ? 'passed' : 'failed';
    await save(recordFile, record);
    return record;
  } finally { await unlock(); }
}
export async function handoff(cwd) {
  const ctx = await workspace(cwd), state = await loadSession(ctx), current = await snapshot(ctx.root);
  const records = await Promise.all((await readdir(join(ctx.directory, 'runs'))).filter(name => name.endsWith('.json')).map(name => json(join(ctx.directory, 'runs', name))));
  const installed = await dependencyIdentity(ctx.root).catch(() => null);
  const checks = records.filter(record => record.session === state.token).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map(record => ({
    ...record, before: { head: record.before.head, fingerprint: record.before.fingerprint },
    after: record.after && { head: record.after.head, fingerprint: record.after.fingerprint },
    reusable: record.dependencies === installed && record.kind === 'check' && record.status === 'passed' && record.before.fingerprint === record.after?.fingerprint && record.after.fingerprint === current.fingerprint,
  }));
  const report = { generatedAt: new Date().toISOString(), root: ctx.root, branch: current.branch,
    base: { ref: state.baseRef, sha: state.baseSha }, head: current.head, fingerprint: current.fingerprint,
    dependencies: state.dependencies, port: state.lease.port, previewURL: `http://127.0.0.1:${state.lease.port}/`,
    dirtyAtStart: state.initial.status, dirtyNow: current.status,
    changedSinceStart: [...new Set([...Object.keys(state.initial.files), ...Object.keys(current.files)])].filter(name => state.initial.files[name] !== current.files[name]),
    diffFromBase: git(ctx.root, 'diff', '--name-status', state.baseSha), checks };
  await save(join(ctx.directory, 'handoff.json'), report);
  const lines = ['# Worktree handoff', '', `- Root: ${report.root}`, `- Branch: ${report.branch}`, `- Base: ${report.base.ref} (${report.base.sha})`,
    `- HEAD: ${report.head}`, `- Fingerprint: ${report.fingerprint}`, `- Preview port reservation: ${report.previewURL} (not a server-health assertion)`,
    `- Dependencies: ${JSON.stringify(report.dependencies)}`, '', '## Already dirty at initialization', '', '```', report.dirtyAtStart || '(clean)', '```',
    '', '## Current uncommitted changes', '', '```', report.dirtyNow || '(clean)', '```', '', '## Files changed since initialization', '',
    ...report.changedSinceStart.map(name => `- ${name}`), '', '## Diff from base', '', '```', report.diffFromBase || '(none)', '```', '', '## Commands and evidence', ''];
  for (const check of checks) lines.push(`- ${check.label}: ${check.status}; ${check.reusable ? 'CURRENT — reusable' : 'NOT reusable (failed, incomplete, service, or changed files)'}`,
    `  - Command argv: ${JSON.stringify(check.argv)}`, `  - HEAD: ${check.before.head}`, `  - Log: ${check.log}`, `  - Evidence: ${check.evidence}`);
  await writeFile(join(ctx.directory, 'handoff.md'), lines.join('\n') + '\n');
  return report;
}
export async function release(cwd) {
  const ctx = await workspace(cwd), unlock = await lock(ctx.directory);
  try {
    const state = await loadSession(ctx);
    await releaseLease(state);
    // Archive session identity while keeping all evidence; never remove a checkout or kill a PID.
    await rename(ctx.stateFile, join(ctx.directory, `session-${state.token}.json`));
    for (const extension of ['json', 'md']) {
      const file = join(ctx.directory, `handoff.${extension}`);
      if (await exists(file)) await rename(file, join(ctx.directory, `handoff-${state.token}.${extension}`));
    }
  } finally { await unlock(); }
}
