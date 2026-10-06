import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const buildRoot = new URL("../dist/", import.meta.url);

test("production artifact exposes the world homepage and independent reading page", async () => {
  execFileSync("npm", ["run", "build"], {
    cwd: projectRoot,
    stdio: "pipe"
  });

  const html = await readFile(new URL("index.html", buildRoot), "utf8");
  const reading = await readFile(new URL("platform.html", buildRoot), "utf8");
  const stylesheets = [];
  for (const document of [html, reading]) {
    const styles = [...document.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)];
    assert.ok(styles.length, "each entry must reference its own emitted stylesheet");
    const contents = [];
    for (const [, href] of styles) {
      assert.match(href, /^\/assets\/[^/]+\.css$/);
      contents.push(await readFile(new URL(href.slice(1), buildRoot), "utf8"));
    }
    stylesheets.push(contents.join('\n'));
    for (const [, src] of document.matchAll(/<script\b[^>]*src="([^"]+)"/g)) {
      assert.match(src, /^\/assets\/[^/]+\.js$/);
      await access(new URL(src.slice(1), buildRoot));
    }
  }
  const [stylesheet] = stylesheets;

  assert.match(html, /<meta name="color-scheme" content="dark"\s*\/?>/);
  assert.match(html, /首页/);
  assert.match(html, /作品/);
  assert.match(html, /关于/);
  assert.match(html, /本站/);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.match(html, /正在构建世界/);
  assert.match(
    html,
    /<canvas\b(?=[^>]*\bid="shader-canvas")(?=[^>]*\baria-hidden="true")[^>]*><\/canvas>/
  );
  assert.match(html, /<script\b[^>]*type="module"/i);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/i);
  assert.match(stylesheet, /radial-gradient/);
  assert.match(stylesheet, /pointer-events:none/);
  assert.match(stylesheet, /@keyframes/);
  assert.match(reading, /智能语音平台：对话沟通引擎的架构升级/);
  assert.match(reading, /<article\b/);
  assert.match(reading, /href="\/#work"/);
  assert.match(reading, /href="\/#career"/);
  assert.doesNotMatch(reading, /<script\b|<canvas\b|<iframe\b/i);
  await access(new URL(".nojekyll", buildRoot));
});
