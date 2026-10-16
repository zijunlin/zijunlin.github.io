import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { snapshot, workspace } from './worktree-session.mjs';

export async function captureReview(cwd, base) {
  if (!base) throw new Error('Usage: node scripts/review-snapshot.mjs <base>');
  const { root, directory } = await workspace(cwd);
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { maxBuffer: 64 * 1024 * 1024 });
  if (git('ls-files', '-u').length) throw new Error('Resolve merge conflicts before capturing a review');
  const pinned = git('rev-parse', '--verify', `${base}^{commit}`).toString().trim();
  const mergeBase = git('merge-base', pinned, 'HEAD').toString().trim();
  const before = await snapshot(root);
  // Diff the final working files against the merge base, including staged edits.
  const parts = [git('diff', '--binary', mergeBase, '--')];
  for (const file of git('ls-files', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean)) {
    const diff = spawnSync('git', ['diff', '--no-index', '--binary', '--', '/dev/null', file], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    if (diff.error || ![0, 1].includes(diff.status)) throw new Error(`Cannot capture ${file}: ${diff.error || diff.stderr}`);
    parts.push(diff.stdout);
  }
  const after = await snapshot(root);
  if (before.fingerprint !== after.fingerprint) throw new Error('Files changed during capture; retry');
  const patch = Buffer.concat(parts);
  if (!patch.length) throw new Error('No reviewable changes from the merge base');
  const output = join(directory, 'reviews', before.fingerprint);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'changes.patch'), patch);
  const report = { base: pinned, mergeBase, ...before, commits: git('log', '--oneline', `${mergeBase}..HEAD`).toString() };
  await writeFile(join(output, 'snapshot.json'), JSON.stringify(report, null, 2) + '\n');
  return { output, fingerprint: before.fingerprint };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await captureReview(process.cwd(), process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
