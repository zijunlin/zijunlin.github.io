import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { initialize, run, handoff, release, workspace } from './worktree-session.mjs';

const help = `Usage: npm run worktree -- <command>
  init --base <ref> [--deps-from <checkout>]  Prepare this existing worktree
  check --label <name> -- <command> [args]  Run a check and retain its evidence
  browser [-- <Playwright args>]           Run browser checks with isolated build/port
  preview                                 Build and serve in the foreground; Ctrl-C stops it
  handoff                                 Write .scratch/worktree/handoff.{json,md}
  release                                 Release only this session's reservation; retain evidence
Run from the checkout root. Create/archive managed worktrees with the existing app tools.`;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    base: { type: 'string' }, 'deps-from': { type: 'string' }, label: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  const [command, ...args] = positionals;
  if (values.help || !command) console.log(help);
  else if (command === 'init') {
    const state = await initialize(process.cwd(), { base: values.base, donor: values['deps-from'] });
    console.log(JSON.stringify({ root: state.root, base: state.baseSha, port: state.lease.port, dependencies: state.dependencies }, null, 2));
    await handoff(process.cwd());
  } else if (command === 'check' || command === 'browser' || command === 'preview') {
    const { root, directory } = await workspace();
    const vite = join(root, 'node_modules/vite/bin/vite.js');
    let result;
    if (command === 'preview') {
      result = await run(root, { label: 'preview build', kind: 'build', argv: [process.execPath, vite, 'build', '--outDir', '.scratch/worktree/dist'] });
      if (result.exitCode === 0) {
        const report = await handoff(root);
        result = await run(root, { label: 'preview server', kind: 'service', argv: [process.execPath, vite, 'preview', '--outDir', '.scratch/worktree/dist', '--host', '127.0.0.1', '--port', String(report.port), '--strictPort'] });
      }
    } else {
      result = await run(root, { label: command === 'browser' ? 'browser' : values.label,
        argv: command === 'browser' ? [process.execPath, join(root, 'node_modules/@playwright/test/cli.js'), 'test', ...args] : args });
    }
    await handoff(root);
    console.log(`Handoff: ${join(directory, 'handoff.md')}`);
    process.exitCode = result.exitCode ?? (result.signal === 'SIGINT' ? 130 : 1);
  } else if (command === 'handoff') {
    const report = await handoff(process.cwd());
    console.log(JSON.stringify({ root: report.root, head: report.head, currentChecks: report.checks.filter(check => check.reusable).map(check => check.label), handoff: join(report.root, '.scratch/worktree/handoff.md') }, null, 2));
  } else if (command === 'release') await release(process.cwd());
  else throw new Error(`Unknown command: ${command}\n${help}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
