// Shared helpers for the Node scripts: paths, argument parsing, the Remotion bundle, browser/GL options. Node 20+, Windows-safe.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const OUT = path.join(ROOT, "out");
export const ENTRY = path.join(ROOT, "src", "index.ts");

/** `--name=value` and `--flag`. An unknown flag is a usage error (exit 2) so a typo never silently does nothing. */
export function parseArgs(argv, known) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith("--")) {
      console.error(`Unexpected argument: ${a}`);
      process.exit(2);
    }
    const eq = a.indexOf("=");
    const k = eq < 0 ? a.slice(2) : a.slice(2, eq);
    const v = eq < 0 ? true : a.slice(eq + 1);
    if (!known.includes(k)) {
      console.error(`Unknown flag --${k}. Known: ${known.map((x) => "--" + x).join(" ")}`);
      process.exit(2);
    }
    out[k] = v;
  }
  return out;
}

export function fail(msg, fix) {
  console.error(`\nERROR: ${msg}`);
  if (fix) console.error(`Fix: ${fix}`);
  process.exit(1);
}

export const ensureDir = (p) => (fs.mkdirSync(p, { recursive: true }), p);

/**
 * Browser options. Remotion downloads its own Chrome on first use; set REMOTION_BROWSER_EXECUTABLE to use another.
 * WebGL: "angle" uses your GPU (the setting Remotion documents for Three.js). With no usable GPU set REMOTION_GL=swangle
 * (software, many times slower).
 */
export function browserOptions() {
  return {
    browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || undefined,
    chromiumOptions: { gl: process.env.REMOTION_GL || "angle" },
  };
}

/** Bundles the project once and returns the serve URL. */
export async function makeBundle() {
  const { bundle } = await import("@remotion/bundler");
  let last = -1;
  const url = await bundle({
    entryPoint: ENTRY,
    publicDir: path.join(ROOT, "public"),
    onProgress: (p) => {
      const q = Math.floor(p / 10);
      if (q !== last) {
        last = q;
        process.stdout.write(`\r  bundling ${p}%   `);
      }
    },
  });
  process.stdout.write("\r  bundling done    \n");
  return url;
}

/** Renders one still of a composition to a PNG file. */
export async function renderPng({ serveUrl, id, frame, output, inputProps = {}, scale = 1 }) {
  const { selectComposition, renderStill } = await import("@remotion/renderer");
  const opts = browserOptions();
  const composition = await selectComposition({ serveUrl, id, inputProps, ...opts });
  await renderStill({ serveUrl, composition, frame, output, inputProps, scale, imageFormat: "png", timeoutInMilliseconds: 240000, ...opts });
  return composition;
}
