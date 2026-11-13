// Assembles the five parts of a patch prompt into one paste-ready file.
//
//   node tools/make-prompt.mjs 7
//   node tools/make-prompt.mjs 13a                (a part of a split patch: P13A-*.md; guide 14, section 5)
//   node tools/make-prompt.mjs 1 --repo-site ../nextinc
//   node tools/make-prompt.mjs 8 --repo-site ../nextinc --repo-film ../minilocker-film
//   node tools/make-prompt.mjs --all          (checks that all 27 patch files, and the parts of the split ones, can be assembled; writes nothing)
//
// The five parts (guide 14): (1) docs/guide/context-header.md, (2) the files the patch lists under "Paste existing",
// (3) the files under "Paste reference" (read from the other repos), (4) the guide sections under "Attach from guide",
// (5) the patch prompt block. Output: prompts-out/patch-NN.md. Pure Node 20+, Windows-safe paths, no dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const repoSite = flag("--repo-site") || process.env.SITE_REPO || "";
const repoFilm = flag("--repo-film") || process.env.FILM_REPO || "";
const all = args.includes("--all");
const num = args.find((a) => /^\d+[a-z]?$/i.test(a));

if (!all && num === undefined) {
  console.error("Usage: node tools/make-prompt.mjs <patch 0-26, or a part such as 13a> [--repo-site <path to nextinc>] [--repo-film <path to minilocker-film>]\n       node tools/make-prompt.mjs --all");
  process.exit(1);
}

const posix = (p) => p.split(path.sep).join("/");
const readText = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/\s+$/, "");
const fence = (txt) => (txt.includes("```") ? "````" : "```");
const LANG = { ".ts": "ts", ".tsx": "tsx", ".mjs": "js", ".js": "js", ".json": "json", ".md": "md", ".css": "css", ".html": "html", ".svg": "svg" };
const lang = (p) => LANG[path.extname(p)] || "";

/** "7" -> { nn: "07", part: "" }; "13a" -> { nn: "13", part: "A" } */
function patchId(n) {
  const m = String(n).match(/^(\d+)([a-z]?)$/i);
  if (!m) throw new Error(`Not a patch number: ${n}`);
  return { nn: m[1].padStart(2, "0"), part: m[2].toUpperCase() };
}

function findPatchFile(n) {
  const { nn, part } = patchId(n);
  const dir = path.join(ROOT, "docs", "patches");
  const hit = fs.readdirSync(dir).find((f) => new RegExp(`^P${nn}${part}-.*\\.md$`).test(f));
  if (!hit) throw new Error(`No patch file docs/patches/P${nn}${part}-*.md`);
  return path.join(dir, hit);
}

/** pulls the value of a bold header line, e.g. "**Paste existing:** ..." (the label may carry a parenthesis) */
function headerLine(text, label) {
  const m = text.match(new RegExp(`^\\*\\*${label}[^*]*\\*\\*\\s*(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

function patchParts(file) {
  const text = readText(file);
  const title = (text.match(/^### (.+)$/m) || [, path.basename(file)])[1];
  const block = text.match(/```\n([\s\S]*?)\n```/);
  if (!block) throw new Error(`${path.basename(file)}: no prompt block found`);
  return {
    title,
    needs: headerLine(text, "Needs"),
    existing: headerLine(text, "Paste existing"),
    reference: headerLine(text, "Paste reference"),
    attach: headerLine(text, "Attach from guide"),
    prompt: block[1],
    acceptance: (text.match(/^\*\*Acceptance[^*]*\*\*\s*(.*)$/m) || [, ""])[1],
    doNot: (text.match(/^\*\*Do not:?\*\*\s*(.*)$/m) || [, ""])[1],
    before: (text.match(/^\*\*Before you start[^*]*\*\*\s*(.*)$/m) || [, ""])[1],
  };
}

const isPathLike = (t) => t.includes("/") || /\.[A-Za-z0-9]{1,5}$/.test(t);

/** the backticked tokens of a header value, each with the free text that follows it (its "hint") */
function tokensWithHints(value) {
  if (!value || /^nothing\b/i.test(value)) return [];
  const out = [];
  const re = /`([^`]+)`/g;
  let m;
  const hits = [];
  while ((m = re.exec(value))) hits.push({ token: m[1], start: m.index, end: re.lastIndex });
  hits.forEach((h, i) => {
    const next = hits[i + 1] ? hits[i + 1].start : value.length;
    out.push({ token: h.token, hint: value.slice(h.end, next).trim() });
  });
  return out;
}

function expandGlob(rel) {
  if (!rel.includes("*")) return [rel];
  const dir = path.join(ROOT, path.dirname(rel));
  if (!fs.existsSync(dir)) return [];
  const re = new RegExp("^" + path.basename(rel).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return fs
    .readdirSync(dir)
    .filter((f) => re.test(f))
    .sort()
    .map((f) => posix(path.join(path.dirname(rel), f)));
}

// ---------- guide section extraction ----------
function headings(lines) {
  const out = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(#{1,4})\s+(.*)$/);
    if (m) out.push({ i, level: m[1].length, text: m[2].trim() });
  });
  return out;
}
function sectionRange(lines, hs, idx) {
  const h = hs[idx];
  let end = lines.length;
  for (let k = idx + 1; k < hs.length; k++) if (hs[k].level <= h.level) { end = hs[k].i; break; }
  return [h.i, end];
}
function parseNumbers(str) {
  const nums = [];
  for (const part of str.split(/,|\band\b/)) {
    const r = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (r) for (let n = +r[1]; n <= +r[2]; n++) nums.push(n);
    else if (/^\d+$/.test(part.trim())) nums.push(+part.trim());
  }
  return nums;
}
/** returns { text, notes } for a guide file given the hint written after it in the patch file */
function extractSections(rel, hint) {
  const full = path.join(ROOT, rel);
  const raw = readText(full);
  const notes = [];
  const cleanHint = (hint || "").replace(/^[\s,;.]+|[\s,;.]+$/g, "");
  const wantAll = !cleanHint || /\(all\)/i.test(hint) || /^\(the acts for these shots\)$/i.test(cleanHint);
  if (wantAll) return { text: raw, notes };
  const lines = raw.split("\n");
  const hs = headings(lines);
  const picked = new Set();
  const pickIdx = (idx) => { const [a, b] = sectionRange(lines, hs, idx); for (let i = a; i < b; i++) picked.add(i); };
  let matched = 0;

  // "section 4", "sections 3, 6, 7", "sections 4-6", "sections 2 and 6"
  const sec = hint.match(/sections?\s+([\d,\s\-and]+)/i);
  if (sec) {
    for (const n of parseNumbers(sec[1])) {
      const idx = hs.findIndex((h) => new RegExp(`^${n}\\s*[.:\\-]`).test(h.text) || new RegExp(`^(Section\\s+)?${n}\\b`).test(h.text));
      if (idx >= 0) { pickIdx(idx); matched++; } else notes.push(`section ${n} not found in ${rel}`);
    }
  }
  // "Act 2-5", "Act 8"
  const act = hint.match(/\bActs?\s+([\d\-,\s]+)/i);
  if (act) {
    for (const n of parseNumbers(act[1])) {
      const idx = hs.findIndex((h) => new RegExp(`^Act ${n}\\b`).test(h.text));
      if (idx >= 0) { pickIdx(idx); matched++; } else notes.push(`Act ${n} not found in ${rel}`);
    }
  }
  // "(Stack, Determinism, World units)" or a bare phrase such as "Continuity ledger", "QR rules"
  const paren = [...hint.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const names = paren.flatMap((p) => p.split(",")).map((s) => s.trim()).filter((s) => s && !/^rows\b/i.test(s) && !/^the acts\b/i.test(s) && !/^all$/i.test(s));
  const bare = hint.replace(/\([^)]*\)/g, " ").replace(/sections?\s+[\d,\s\-and]+/gi, " ").replace(/\bActs?\s+[\d\-,\s]+/gi, " ").trim();
  if (bare && !/^[\s,;.]*$/.test(bare)) names.push(bare.replace(/^[,;.\s]+|[,;.\s]+$/g, ""));
  for (const name of names) {
    const lower = name.toLowerCase();
    const idx = hs.findIndex((h) => h.text.toLowerCase().includes(lower));
    if (idx >= 0) { pickIdx(idx); matched++; continue; }
    // a bold run-in title inside a section ("**Architecture rules** ...")
    const li = lines.findIndex((l) => l.toLowerCase().includes(`**${lower}`));
    if (li >= 0) { for (let i = li; i < Math.min(lines.length, li + 14); i++) picked.add(i); matched++; continue; }
    // a paragraph whose words all appear in the phrase ("QR rules" -> the "QR code rules" paragraph)
    const words = lower.split(/\s+/).filter((w) => w.length >= 2);
    const wi = lines.findIndex((l) => words.length > 0 && words.every((w) => l.toLowerCase().includes(w)) && !/^#/.test(l));
    if (wi >= 0) {
      let e = wi;
      while (e < lines.length && lines[e].trim() !== "") e++;
      for (let i = wi; i < e; i++) picked.add(i);
      matched++;
      continue;
    }
    notes.push(`"${name}" not found in ${rel}`);
  }
  if (matched === 0) {
    notes.push(`no section of ${rel} matched "${hint}"; the whole file is included`);
    return { text: raw, notes };
  }
  const first = lines.find((l) => /^#\s/.test(l));
  const out = [];
  if (first) out.push(first, "");
  let last = -2;
  [...picked].sort((a, b) => a - b).forEach((i) => { if (last >= 0 && i !== last + 1) out.push("", "[...]", ""); out.push(lines[i]); last = i; });
  return { text: out.join("\n"), notes };
}

// ---------- reference path resolution ----------
function resolveReference(token, state) {
  let t = token.replace(/\\/g, "/");
  let repo = state.repo;
  let rel;
  if (t.startsWith("nextinc/")) { repo = "site"; rel = t.slice("nextinc/".length); }
  else if (t.startsWith("minilocker-film/")) { repo = "film"; rel = t.slice("minilocker-film/".length); }
  else if (!t.includes("/") && state.dir) rel = posix(path.join(state.dir, t));
  else rel = t;
  state.repo = repo;
  state.dir = path.posix.dirname(rel);
  const base = repo === "film" ? repoFilm : repoSite;
  return { repo, rel, base, full: base ? path.join(base, rel) : "" };
}

function assemble(n, { write }) {
  const file = findPatchFile(n);
  const p = patchParts(file);
  const id = patchId(n);
  const nn = id.nn + id.part;
  const notes = [];
  const out = [];

  out.push(readText(path.join(ROOT, "docs/guide/context-header.md")));

  // 2. existing files
  const existing = tokensWithHints(p.existing).filter((t) => isPathLike(t.token)).flatMap((t) => expandGlob(t.token.replace(/\\/g, "/")));
  if (existing.length) {
    out.push("\n\n=== EXISTING FILES FROM MY nextinc-reel REPO (current content) ===");
    for (const rel of existing) {
      const full = path.join(ROOT, rel);
      if (!fs.existsSync(full)) { notes.push(`MISSING existing file: ${rel} (an earlier patch should have created it)`); continue; }
      const body = readText(full);
      const fc = fence(body);
      out.push(`\n--- FILE: ${rel} ---\n${fc}${lang(rel)}\n${body}\n${fc}`);
    }
  }

  // 3. reference files
  const refs = tokensWithHints(p.reference).filter((t) => isPathLike(t.token));
  if (refs.length) {
    out.push("\n\n=== REFERENCE FILES FROM MY OTHER REPOS (read-only: use them, do not invent) ===");
    const state = { repo: "site", dir: "" };
    for (const r of refs) {
      const x = resolveReference(r.token, state);
      const label = `${x.repo === "film" ? "minilocker-film" : "nextinc"}/${x.rel}`;
      if (!x.base) { notes.push(`Reference not included (no --repo-${x.repo} path): ${label}`); continue; }
      if (!fs.existsSync(x.full)) { notes.push(`MISSING reference file: ${label}`); continue; }
      if (/\.(png|jpe?g|webp|gif|ico|woff2?|mp4|webm|wav)$/i.test(x.rel)) {
        out.push(`\n--- REFERENCE FILE (binary, not pasted as text): ${label} ---\nAttach this file to the chat yourself: ${x.full}`);
        notes.push(`Binary reference: attach by hand -> ${x.full}`);
        continue;
      }
      const body = readText(x.full);
      const fc = fence(body);
      out.push(`\n--- REFERENCE FILE: ${label}${r.hint ? `  (${r.hint.replace(/^[\s(]+|[\s)]+$/g, "")})` : ""} ---\n${fc}${lang(x.rel)}\n${body}\n${fc}`);
    }
  }

  // 4. guide sections
  const att = tokensWithHints(p.attach).filter((t) => isPathLike(t.token));
  if (att.length) {
    out.push("\n\n=== GUIDE SECTIONS ===");
    for (const a of att) {
      const rel = a.token.replace(/\\/g, "/");
      const full = path.join(ROOT, rel);
      if (!fs.existsSync(full)) { notes.push(`MISSING guide file: ${rel}`); continue; }
      const { text, notes: n2 } = extractSections(rel, a.hint);
      notes.push(...n2);
      out.push(`\n--- GUIDE: ${rel}${a.hint ? `  [${a.hint.replace(/^[\s,;]+|[\s,;]+$/g, "")}]` : ""} ---\n${text}`);
    }
  }

  // 5. the prompt
  out.push("\n\n=== THE PATCH PROMPT ===\n");
  out.push(p.prompt);
  if (p.doNot) out.push(`\nOut of scope for this patch: ${p.doNot}`);

  const text = out.join("\n") + "\n";
  let where = "";
  if (write) {
    const dir = path.join(ROOT, "prompts-out");
    fs.mkdirSync(dir, { recursive: true });
    where = path.join(dir, `patch-${nn}.md`);
    fs.writeFileSync(where, text, "utf8");
  }
  return { p, text, notes, where, nn, existing: existing.length, refs: refs.length, att: att.length };
}

if (all) {
  let bad = 0;
  // the 27 patches, then the parts of the split ones (P13A-*.md and so on), in order
  const parts = fs
    .readdirSync(path.join(ROOT, "docs", "patches"))
    .map((f) => f.match(/^P(\d{2})([A-Z])-.*\.md$/))
    .filter(Boolean)
    .map((m) => `${Number(m[1])}${m[2]}`);
  const ids = [...Array.from({ length: 27 }, (_, n) => String(n)), ...parts];
  for (const n of ids) {
    const label = patchId(n);
    try {
      const r = assemble(n, { write: false });
      const miss = r.notes.filter((x) => /not found|no section/.test(x));
      console.log(`P${r.nn.padEnd(3)} ${String(Math.round(r.text.length / 4)).padStart(6)} tok  existing ${r.existing}  reference ${r.refs}  guide ${r.att}${miss.length ? "   ! " + miss.join("; ") : ""}`);
      if (miss.length) bad++;
    } catch (e) {
      bad++;
      console.log(`P${(label.nn + label.part).padEnd(3)} ERROR ${e.message}`);
    }
  }
  console.log(bad ? `\n${bad} patch file(s) have section hints the tool could not resolve (listed above).` : `\nAll 27 patch files${parts.length ? ` and ${parts.length} split parts` : ""} assemble; every guide section resolved.`);
  process.exit(0);
}

const r = assemble(num, { write: true });
console.log(`\n${r.p.title}`);
console.log(`Needs: ${r.p.needs}`);
if (r.p.before) console.log(`Before you start (you do this): ${r.p.before}`);
console.log(`Wrote ${path.relative(process.cwd(), r.where)}  (${r.text.length.toLocaleString("en-US")} characters, about ${Math.round(r.text.length / 4).toLocaleString("en-US")} tokens)`);
console.log("Open it, select all, paste into a NEW assistant session.");
if (r.notes.length) {
  console.log("\nHeads-up:");
  for (const x of r.notes) console.log("  - " + x);
}
if (r.p.acceptance) console.log(`\nYou say yes when: ${r.p.acceptance}`);
console.log("\nAfter the assistant answers: save each file at the path it gives, run its CHECK commands, commit \"patch NN: title\".\n");
