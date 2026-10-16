import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { lstat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const patterns = {
  credential: String.raw`-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|sk-(proj-)?[A-Za-z0-9_-]{24,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{30,})`,
  email: String.raw`[\w.+-]{1,64}@[\w.-]{1,253}\.[A-Za-z]{2,24}`,
  personalPath: String.raw`/Users/[^/\s"']+|/home/[^/\s"']+`,
  credentialAssignment: String.raw`(?i)(api[_-]?key|access[_-]?token|client[_-]?secret|password|passwd)\s*[=:]\s*["'][^"'\r\n]{8,}["']`,
};
const exclusions = ['!**/node_modules/**', '!**/.git/**', '!.scratch/privacy-audit/**'];
const fileArgs = ['--hidden', '--no-ignore', ...exclusions.flatMap(value => ['-g', value])];
const limit = 2 * 1024 * 1024;
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { maxBuffer: 128 * 1024 * 1024 });
const classify = path => path.startsWith('dist/') ? 'published-build' : /^(src|public)\//.test(path) || path === 'index.html' ? 'site-source' : /^(\.scratch|docs|test-results|playwright-report)\//.test(path) ? 'local-evidence' : 'repository-file';

export async function scanPrivacy(root, { history = false } = {}) {
  const names = execFileSync('rg', ['--files', '-0', ...fileArgs, '.'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0').filter(Boolean);
  const skippedLarge = [];
  for (const name of names) if ((await lstat(join(root, name))).size > limit) skippedLarge.push(name);
  const findings = [];
  for (const [kind, pattern] of Object.entries(patterns)) {
    const child = spawn('rg', ['--json', '--max-filesize', String(limit), '--max-count', '20', ...fileArgs, '-e', pattern, '.'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', data => { stderr += data; });
    const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    for await (const line of createInterface({ input: child.stdout })) {
      const event = JSON.parse(line);
      if (event.type !== 'match') continue;
      const path = event.data.path.text?.replace(/^\.\//, '');
      if (path) findings.push({ kind, path, line: event.data.line_number, scope: classify(path) });
    }
    const code = await closed;
    if (![0, 1].includes(code)) throw new Error(`rg scan failed (${code}): ${stderr}`);
  }
  const result = { filesListed: names.length, maxFileBytes: limit, maxMatchingLinesPerFilePerCategory: 20,
    excluded: ['third-party dependencies', '.git raw files', 'binary content (no OCR/archive extraction)', '.scratch/privacy-audit'],
    skippedLarge, findings };
  if (history) {
    const objects = git(root, 'rev-list', '--objects', '--all').toString().trim().split('\n').filter(Boolean);
    // One batch, with a bounded output buffer; fail explicitly if history outgrows it.
    const data = execFileSync('git', ['-C', root, 'cat-file', '--batch'], { input: objects.map(line => line.split(' ')[0]).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024 });
    const checks = Object.entries(patterns).filter(([kind]) => kind !== 'credentialAssignment').map(([kind, pattern]) => [kind, new RegExp(pattern)]);
    const hits = []; let at = 0, blobs = 0;
    for (const object of objects) {
      const end = data.indexOf(10, at), header = data.subarray(at, end).toString().split(' '), size = Number(header[2]);
      if (!Number.isFinite(size)) throw new Error('Cannot read history object');
      at = end + 1; const content = data.subarray(at, at + size); at += size + 1;
      if (header[1] !== 'blob') continue;
      blobs++;
      if (size > limit || content.includes(0)) continue;
      for (const [kind, regex] of checks) if (regex.test(content.toString())) hits.push({ kind, object: header[0], path: object.slice(object.indexOf(' ') + 1) });
    }
    result.history = { blobs, findings: hits, note: 'Reachable refs only; binary and oversized blobs excluded; commit identities are a separate inventory.',
      identityCount: new Set(git(root, 'log', '--all', '--format=%an <%ae>%n%cn <%ce>').toString().trim().split('\n')).size };
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--history')) throw new Error('Usage: node scripts/privacy-scan.mjs [--history]');
    console.log(JSON.stringify(await scanPrivacy(process.cwd(), { history: process.argv.includes('--history') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
