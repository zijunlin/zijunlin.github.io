import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const textAssets = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"]
};

const entries = {};
for (const [route, [file, type]] of Object.entries(textAssets)) {
  entries[route] = { body: await readFile(resolve(root, file), "utf8"), type };
}
const socialCard = (await readFile(resolve(root, "og.png"))).toString("base64");

const worker = `
const textAssets = ${JSON.stringify(entries)};
const socialCard = ${JSON.stringify(socialCard)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const headers = { "Cache-Control": pathname === "/" ? "no-cache" : "public, max-age=86400" };
    if (pathname === "/og.png") {
      return new Response(decodeBase64(socialCard), { headers: { ...headers, "Content-Type": "image/png" } });
    }
    const asset = textAssets[pathname];
    if (asset) return new Response(asset.body, { headers: { ...headers, "Content-Type": asset.type } });
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
};
`;

await mkdir(resolve(root, "dist/server"), { recursive: true });
await writeFile(resolve(root, "dist/server/index.js"), worker);
console.log("Built static WebGL portfolio for deployment.");
