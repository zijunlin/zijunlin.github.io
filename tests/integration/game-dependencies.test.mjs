import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const gameRoot = new URL('../../src/features/work-games/', import.meta.url);

async function runtimeFiles(directory = gameRoot) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) files.push(...await runtimeFiles(url));
    else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) files.push(url);
  }
  return files;
}

test('game runtime owns no homepage imports or homepage DOM vocabulary', async () => {
  for (const file of await runtimeFiles()) {
    const name = file.href.slice(gameRoot.href.length);
    const source = await readFile(file, 'utf8');
    const imports = /(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g;
    for (const [, dependency] of source.matchAll(imports)) {
      if (!dependency.startsWith('.')) continue;
      assert.ok(new URL(dependency, file).href.startsWith(gameRoot.href),
        `${name} imports outside the game directory: ${dependency}`);
    }
    assert.doesNotMatch(source, /scene-heading|orb-halo|orb-art|celestial-gate|header-height|location\.hash/, name);
  }
});
