// Runs every tests/*.test.ts without a test framework: esbuild bundles them, Node runs them.   npm test
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "tests");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".test.ts")) : [];
const tmp = path.join(ROOT, "out", ".tests");
fs.mkdirSync(tmp, { recursive: true });

const entry = path.join(tmp, "entry.ts");
fs.writeFileSync(
  entry,
  [`import { cases } from ${JSON.stringify(path.join(dir, "harness.ts"))};`, ...files.map((f) => `import ${JSON.stringify(path.join(dir, f))};`), "export { cases };"].join("\n"),
);
const outfile = path.join(tmp, "bundle.mjs");
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent", loader: { ".json": "json" } });
const { cases } = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);

let fail = 0;
for (const c of cases) {
  try {
    await c.fn();
    console.log(`  ok    ${c.name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${c.name}\n        ${e.message}`);
  }
}
console.log(`\n${cases.length - fail}/${cases.length} passed`);
process.exit(fail ? 1 : 0);
