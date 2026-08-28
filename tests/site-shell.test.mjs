import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const buildRoot = new URL("../dist/", import.meta.url);

test("production artifact exposes the neutral shader-ready shell", async () => {
  execFileSync("npm", ["run", "build"], {
    cwd: projectRoot,
    stdio: "pipe"
  });

  const html = await readFile(new URL("index.html", buildRoot), "utf8");
  const assetNames = await readdir(new URL("assets/", buildRoot));
  const stylesheetName = assetNames.find((name) => name.endsWith(".css"));

  assert.ok(stylesheetName, "the build should emit a stylesheet asset");
  const stylesheet = await readFile(new URL(`assets/${stylesheetName}`, buildRoot), "utf8");

  assert.match(html, /<meta name="color-scheme" content="dark"\s*\/?>/);
  assert.match(html, /首页/);
  assert.match(html, /作品/);
  assert.match(html, /关于/);
  assert.match(html, /本站/);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.match(html, /<main\b[^>]*>\s*<\/main>/);
  assert.match(
    html,
    /<canvas\b(?=[^>]*\bid="shader-canvas")(?=[^>]*\baria-hidden="true")[^>]*><\/canvas>/
  );
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/i);
  assert.match(stylesheet, /radial-gradient/);
  assert.match(stylesheet, /pointer-events:none/);
  assert.doesNotMatch(stylesheet, /@keyframes|animation:/);
  await access(new URL(".nojekyll", buildRoot));
});
