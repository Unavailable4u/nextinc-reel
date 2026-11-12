// THE PROCEDURAL TEXTURES (Patch 07).   npm run textures
//
// Writes the seven pictures of `src/config/materials.ts` (`TEXTURES`) to public/textures/ and a manifest next to them
// (public/textures/manifest.json) that holds the SHA-256 of every picture's PIXELS (not of the PNG file: its bytes depend on the
// encoder). The pictures come from `src/paint/textures.ts`, which is pure and seeded, so the same code always gives the same pixels
// on every machine; `tests/textures.test.ts` makes them again in memory and compares with the manifest.
//
//   npm run textures                  write the pictures and the manifest
//   npm run textures -- --check       change nothing; exit 1 if the manifest does not match what the code makes now
//   npm run textures -- --only=dust   write one picture (the manifest keeps the others' lines)
// Bump TEXTURE_GENERATOR_VERSION in config/materials.ts when a change to the pictures is meant.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";
import { ROOT, OUT, ensureDir, fail, parseArgs } from "./lib/env.mjs";

const args = parseArgs(process.argv.slice(2), ["check", "only", "help"]);
if (args.help) {
  console.log("npm run textures [-- --check] [-- --only=<name>]");
  process.exit(0);
}

// esbuild reads the TypeScript, as the other scripts do
const tmp = ensureDir(path.join(OUT, ".tests"));
const outfile = path.join(tmp, "textures-bundle.mjs");
await build({ entryPoints: [path.join(ROOT, "src/paint/textures.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent" });
const { generateTexture } = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
const cfgFile = path.join(tmp, "materials-config-bundle.mjs");
await build({ entryPoints: [path.join(ROOT, "src/config/materials.ts")], bundle: true, platform: "node", format: "esm", outfile: cfgFile, logLevel: "silent" });
const { TEXTURES, TEXTURE_NAMES, TEXTURE_MANIFEST_FILE, TEXTURE_GENERATOR_VERSION, TEXTURE_BUDGET_BYTES, gpuBytes } = await import(pathToFileURL(cfgFile).href + `?t=${Date.now()}`);

const only = args.only && args.only !== true ? String(args.only) : null;
if (only && !TEXTURE_NAMES.includes(only)) fail(`--only=${only} is not a texture`, `Known: ${TEXTURE_NAMES.join(", ")}`);
const names = only ? [only] : TEXTURE_NAMES;

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const manifestPath = path.join(ROOT, "public", TEXTURE_MANIFEST_FILE);
const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;

const textures = { ...(old && old.generator === TEXTURE_GENERATOR_VERSION ? old.textures : {}) };
let mismatch = 0;
for (const name of names) {
  const spec = TEXTURES[name];
  const raw = generateTexture(name);
  if (raw.width !== spec.width || raw.height !== spec.height || raw.channels !== spec.channels) fail(`${name}: the generator made ${raw.width}x${raw.height}x${raw.channels}, the config says ${spec.width}x${spec.height}x${spec.channels}`);
  const entry = { file: spec.file, width: spec.width, height: spec.height, channels: spec.channels, colorSpace: spec.colorSpace, seed: spec.seed, sha256: sha(raw.data) };
  if (args.check) {
    const have = old?.textures?.[name];
    if (!have || have.sha256 !== entry.sha256) {
      mismatch++;
      console.log(`  MISMATCH  ${name}  manifest ${have ? have.sha256.slice(0, 12) : "(none)"}  code ${entry.sha256.slice(0, 12)}`);
    } else console.log(`  ok        ${name}  ${entry.sha256.slice(0, 12)}`);
    continue;
  }
  const dest = path.join(ROOT, "public", spec.file);
  ensureDir(path.dirname(dest));
  // greyscale for one channel, RGB for three; no colour profile and no gamma chunk, so the browser reads the bytes as they are
  const img = sharp(Buffer.from(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength), { raw: { width: raw.width, height: raw.height, channels: raw.channels } });
  await (raw.channels === 1 ? img.toColourspace("b-w") : img).png({ compressionLevel: 9 }).toFile(dest);
  textures[name] = entry;
  console.log(`  wrote     ${spec.file}  ${spec.width}x${spec.height}x${spec.channels}  ${fs.statSync(dest).size} bytes  ${entry.sha256.slice(0, 12)}`);
}

if (args.check) {
  if (mismatch) fail(`${mismatch} texture(s) differ from public/${TEXTURE_MANIFEST_FILE}`, "Run `npm run textures` and commit the new pictures and manifest, or undo the change to the generator.");
  console.log("Textures match the manifest.");
  process.exit(0);
}

const total = TEXTURE_NAMES.reduce((a, n) => a + gpuBytes(TEXTURES[n]), 0);
if (total > TEXTURE_BUDGET_BYTES) fail(`the textures need ${total} bytes on the GPU, over the budget of ${TEXTURE_BUDGET_BYTES}`, "Make a picture smaller in config/materials.ts (TEXTURES).");
const ordered = {};
for (const n of TEXTURE_NAMES) if (textures[n]) ordered[n] = textures[n];
const manifest = { generator: TEXTURE_GENERATOR_VERSION, gpuBytes: total, budgetBytes: TEXTURE_BUDGET_BYTES, textures: ordered };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote public/${TEXTURE_MANIFEST_FILE} (${Object.keys(ordered).length} textures, ${(total / 1048576).toFixed(2)} MB on the GPU of ${(TEXTURE_BUDGET_BYTES / 1048576).toFixed(0)} MB).`);
