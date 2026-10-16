import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const gameRoot = new URL('../../src/features/work-games/', import.meta.url);
const sceneRoot = new URL('../../src/features/scene/', import.meta.url);

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
      const resolved = new URL(dependency, file).href;
      assert.ok(resolved.startsWith(gameRoot.href) || resolved.startsWith(sceneRoot.href),
        `${name} imports outside the game directory: ${dependency}`);
    }
    assert.doesNotMatch(source, /scene-heading|orb-halo|\borb-art\b|celestial-gate|header-height|location\.hash/, name);
  }
});

// Keep the shipped scene contract free of the retired DOM artwork renderer.
test('shared scene ships no retired SVG animation stylesheet or clone adapter', async () => {
  const files = [
    '../../src/features/world/world.css',
    '../../src/features/world/world-view.js',
    '../../src/app/home-game-adapter.js',
  ];
  for (const path of files) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.orb-(?:art|halo|disc|pulse|particles|inflow|infall|circulating|satellite)\b|@keyframes orb-|cloneNode|createElementNS/, path);
  }
});

// The production graph must render combat directly in the shared context.
test('production graphics has no Canvas2D combat source or canvas upload adapter', async () => {
  const files = await runtimeFiles(new URL('../../src/', import.meta.url));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /getContext\(\s*['"]2d['"]|OffscreenCanvas|game-effects|game-visuals|battle-composite|battle-view/, file.pathname);
  }
});
