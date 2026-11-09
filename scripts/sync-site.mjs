// Reads the website's data and writes src/data/site-snapshot.json: the ONLY source of facts for the film (truth rule).
//
//   npm run sync                          write the snapshot (website repo: SITE_REPO, default ../nextinc, or --site=PATH)
//   npm run sync -- --check               exit 1 if the committed snapshot no longer matches the website (use before rendering)
//   npm run sync -- --copy-media          also copy the images/fonts the books need and record their hashes
//   npm run sync -- --check --copy-media  also verify that the copied media still match the website
//
// The data files are plain browser scripts (`window.NEXT = ...`). They are run in a Node `vm` sandbox that has a stub `window`
// and nothing else: no require, no process, no network, no file access.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { ROOT, fail, parseArgs } from "./lib/env.mjs";

const args = parseArgs(process.argv.slice(2), ["site", "check", "copy-media", "help"]);
if (args.help) {
  console.log("npm run sync [-- --site=PATH --check --copy-media]");
  process.exit(0);
}

const SNAPSHOT = path.join(ROOT, "src/data/site-snapshot.json");
const siteRepo = path.resolve(ROOT, String(args.site && args.site !== true ? args.site : process.env.SITE_REPO || "../nextinc"));
if (!fs.existsSync(path.join(siteRepo, "assets/data"))) {
  fail(`Website repo not found at ${siteRepo} (looked for assets/data).`, "Clone it next to this repo, or set SITE_REPO=<path>, or pass --site=<path>.");
}

const DATA_FILES = ["site", "projects", "films", "team"];
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const readNormalised = (p) => Buffer.from(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"), "utf8");

// ---- evaluate the data files ----
const sandbox = {};
sandbox.window = sandbox; // the files do `window.NEXT = window.NEXT || {}` and then refer to a bare `NEXT`
vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
const fileHashes = {};
for (const name of DATA_FILES) {
  const file = path.join(siteRepo, "assets/data", `${name}.js`);
  if (!fs.existsSync(file)) fail(`Missing ${file}`);
  const buf = readNormalised(file);
  fileHashes[`assets/data/${name}.js`] = sha(buf);
  try {
    vm.runInContext(buf.toString("utf8"), sandbox, { filename: `${name}.js`, timeout: 5000 });
  } catch (e) {
    fail(`Could not evaluate assets/data/${name}.js: ${e.message}`, "The sync tool only supports plain data files (no imports, no browser APIs).");
  }
}
const NEXT = sandbox.NEXT;
if (!NEXT || typeof NEXT !== "object") fail("The data files did not define NEXT.");
for (const key of ["site", "projects", "films", "team", "affiliation"]) {
  if (NEXT[key] === undefined) fail(`NEXT.${key} is missing in the website data.`, "The film needs site, projects, films, team and affiliation.");
}
// JSON round trip drops functions silently, so refuse them first
(function noFunctions(v, p) {
  if (typeof v === "function") fail(`The data contains a function at ${p}; the film only reads plain data.`);
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) noFunctions(x, `${p}.${k}`);
})(NEXT, "NEXT");
const data = JSON.parse(JSON.stringify({ site: NEXT.site, projects: NEXT.projects, films: NEXT.films, team: NEXT.team, affiliation: NEXT.affiliation }));

// ---- website git facts ----
function git(...a) {
  try {
    return execFileSync("git", ["-C", siteRepo, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
const commit = git("rev-parse", "HEAD") ?? "unknown (the website folder is not a git repository)";
const shortCommit = commit.startsWith("unknown") ? "no git" : commit.slice(0, 8);
const dirty = (git("status", "--porcelain", "--", "assets/data") ?? "").length > 0;

// ---- media the books need ----
// Mini Me's cover art AND its film poster are NOT copied: both show "Try MiniMe" and a product address (minime.app) that the
// site's own briefs say does not exist (guide 07 section 4, D-17). Found while building Patch 01: the guide names only the cover.
// Patch 09 makes the film thumbnail from the laptop/app part of the poster (a crop that excludes the left text column).
const DO_NOT_COPY = new Map([
  ["assets/img/projects/mini-me/cover.webp", "shows minime.app (D-17); the Mini Me book uses a real app screenshot instead"],
  ["assets/img/films/mini-me-chat-film.webp", "shows minime.app (D-17); Patch 09 crops the laptop part from the website copy for the film spread"],
]);
function mediaList() {
  const wanted = new Map(); // website-relative path -> destination relative to public/
  const add = (rel, dest) => rel && wanted.set(rel.replace(/\\/g, "/"), dest);
  const toSite = (rel) => `site/${rel.replace(/^assets\//, "")}`;
  for (const p of data.projects) {
    add(p.cover, toSite(p.cover));
    for (const g of p.gallery || []) add(g.src, toSite(g.src));
  }
  for (const f of data.films) add(f.poster, toSite(f.poster));
  add("assets/img/brand/mini-me-logo.png", "site/img/brand/mini-me-logo.png");
  add("assets/img/icons/icon.svg", "site/img/icons/icon.svg");
  add("scripts/brand/glyph-x.json", "site/brand/glyph-x.json");
  const fontDir = path.join(siteRepo, "assets/fonts");
  if (fs.existsSync(fontDir)) for (const f of fs.readdirSync(fontDir).sort()) if (/\.(woff2|txt)$/i.test(f)) add(`assets/fonts/${f}`, `fonts/${f}`);
  return wanted;
}
const media = {};
const skipped = [];
const mediaPlan = [];
// Media is only resolved when asked for, so a data-only sync or check never needs the image files.
for (const [rel, dest] of args["copy-media"] ? mediaList() : []) {
  if (DO_NOT_COPY.has(rel)) {
    skipped.push(`${rel}: ${DO_NOT_COPY.get(rel)}`);
    continue;
  }
  const src = path.join(siteRepo, rel);
  if (!fs.existsSync(src)) {
    fail(`Media file listed by the data is missing in the website repo: ${rel}`, "Fix the data or the repo; the film never substitutes a file.");
  }
  media[rel] = sha(fs.readFileSync(src));
  mediaPlan.push({ rel, src, dest });
}

// ---- --check ----
const prev = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) : null;
if (args.check) {
  if (!prev) fail("There is no committed snapshot yet.", "Run: npm run sync");
  const diffs = [];
  for (const k of ["site", "films", "team", "affiliation"]) if (JSON.stringify(prev[k]) !== JSON.stringify(data[k])) diffs.push(`${k} changed`);
  const slugs = new Set([...prev.projects.map((p) => p.slug), ...data.projects.map((p) => p.slug)]);
  for (const s of slugs) {
    const a = prev.projects.find((p) => p.slug === s);
    const b = data.projects.find((p) => p.slug === s);
    if (!a) diffs.push(`project "${s}" is new on the website`);
    else if (!b) diffs.push(`project "${s}" was removed from the website`);
    else if (JSON.stringify(a) !== JSON.stringify(b)) {
      const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      diffs.push(`project "${s}" changed: ${fields.join(", ")}`);
    }
  }
  if (JSON.stringify(prev.projects.map((p) => p.slug)) !== JSON.stringify(data.projects.map((p) => p.slug)) && diffs.length === 0) diffs.push("project order changed (it sets the volume numbers)");
  if (args["copy-media"]) {
    for (const [rel, h] of Object.entries(media)) if ((prev.meta.media || {})[rel] !== h) diffs.push(`media changed or not recorded: ${rel}`);
  }
  if (diffs.length) {
    console.error(`\nThe snapshot is OUT OF DATE against ${path.basename(siteRepo)} (${shortCommit}${dirty ? ", uncommitted data changes" : ""}):`);
    for (const d of diffs) console.error("  - " + d);
    console.error("\nRun `npm run sync`, read the git diff of src/data/site-snapshot.json, then re-render the shots that show the changed book (docs/ops/RUNBOOK.md).");
    process.exit(1);
  }
  console.log(`Snapshot matches the website (${path.basename(siteRepo)} ${shortCommit}${dirty ? ", with uncommitted data changes" : ""}). ${data.projects.length} projects, ${data.films.length} films, ${data.team.length} people.`);
  process.exit(0);
}

// ---- write ----
let outMedia = prev?.meta?.media || {};
if (args["copy-media"]) {
  outMedia = {};
  for (const m of mediaPlan) {
    const to = path.join(ROOT, "public", m.dest);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(m.src, to);
    outMedia[m.rel] = media[m.rel];
  }
  console.log(`Copied ${mediaPlan.length} media files into public/ (images under public/site/, fonts under public/fonts/).`);
  for (const s of skipped) console.log(`  not copied: ${s}`);
}
const snapshot = {
  meta: { tool: "scripts/sync-site.mjs", siteRepo: path.basename(siteRepo), commit, dirty, syncedAt: new Date().toISOString(), files: fileHashes, media: outMedia },
  ...data,
};
fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log(`Wrote src/data/site-snapshot.json: ${data.projects.length} projects, ${data.films.length} films, ${data.team.length} people. Website commit ${shortCommit}${dirty ? " (UNCOMMITTED data changes: the commit does not fully describe this snapshot)" : ""}.`);
if (Object.keys(outMedia).length === 0) console.log("Tip: run `npm run sync -- --copy-media` to copy the covers, posters, logo and fonts.");
