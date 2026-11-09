// Prints the four books with their QR targets, films and labels, and runs the truth checks.   npm run select:test
//   - the order and QR targets are compared with the table in docs/guide/07-content-and-assets.md (a snapshot of the data when the
//     guide was written): a difference is a WARNING, because the data is allowed to move on;
//   - `minime.app` must appear NOWHERE in anything the selectors return or in the snapshot (HARD FAIL, D-17);
//   - every factual-looking line in src/config/bookText.ts is looked up in the data; lines that are editorial only are listed;
//   - captions are at most 8 words.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { ROOT, ensureDir } from "./lib/env.mjs";

const tmp = ensureDir(path.join(ROOT, "out", ".tests"));
const outfile = path.join(tmp, "select-bundle.mjs");
await build({ entryPoints: [path.join(ROOT, "src/data/select.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent", loader: { ".json": "json" } });
const S = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
const { BOOK_TEXT } = await (async () => {
  const f = path.join(tmp, "booktext-bundle.mjs");
  await build({ entryPoints: [path.join(ROOT, "src/config/bookText.ts")], bundle: true, platform: "node", format: "esm", outfile: f, logLevel: "silent" });
  return import(pathToFileURL(f).href + `?t=${Date.now()}`);
})();
const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/site-snapshot.json"), "utf8"));

let hardFail = 0;
const warn = [];

const co = S.getCompany();
console.log(`Company   ${co.name} · ${co.address} · "${co.tagline}"`);
console.log(`          ${co.affiliation}`);
console.log(`Authors   ${S.getAuthors().map((a) => a.name).join(" · ")}`);
console.log(`Snapshot  website commit ${S.SNAPSHOT_META.commit.slice(0, 8)}${S.SNAPSHOT_META.dirty ? " (uncommitted data changes)" : ""}, synced ${S.SNAPSHOT_META.syncedAt}\n`);

const outputs = [];
for (const b of S.getBooks()) {
  const qr = S.getQrTargets(b.slug);
  const films = S.getFilmsFor(b.slug);
  const col = S.getColophon(b.slug);
  const lab = S.getRiserLabel(b.slug);
  outputs.push(b, qr, films, col, lab, S.getAbstractText(b.slug));
  console.log(`Vol. ${b.volumeNumeral}  ${b.title}  (${b.slug})  ${b.year} · ${b.statusText} · ${b.category}`);
  console.log(`   riser label : ${lab.volumeNumeral}  ${lab.title}  ${lab.year} - ${lab.statusText}`);
  for (const [i, q] of qr.entries()) console.log(`   QR ${i + 1} ${q.kind.padEnd(10)} ${q.url}   (printed: ${q.display})`);
  for (const f of films) console.log(`   film        : ${f.title}  ${f.duration}  ${f.url}  poster ${f.poster}`);
  if (films.length === 0) console.log("   film        : none in the data (no film page in this book)");
  console.log(`   abstract    : ${S.getAbstractText(b.slug).split(/\s+/).length} words, ${S.getAbstractText(b.slug).slice(0, 90)}...`);
  console.log(`   colophon    : ${col.status} · ${col.year} · ${col.category} · ${col.tags.join(", ")}${col.limit ? `\n                 limit: ${col.limit}` : ""}`);
  console.log(`   optional    : brief ${b.brief ? "yes" : "no"} · approach ${b.approach ? "yes" : "no"} · outcome ${b.outcome ? "yes" : "no"} · gallery ${b.gallery.length}\n`);
}

// 1. order and QR table of guide 07
const expectOrder = ["mini-me", "spherex-blink", "minilocker", "next-inc-immersive"];
const gotOrder = S.getBooks().map((b) => b.slug);
if (JSON.stringify(gotOrder) !== JSON.stringify(expectOrder)) warn.push(`order differs from the guide: ${gotOrder.join(", ")}`);
const expectQr = {
  "mini-me": ["https://www.wearenext.tech/project.html?p=mini-me", "https://youtu.be/4fNrtf8CX_o"],
  "spherex-blink": ["https://spherex-blink-web.vercel.app/", "https://github.com/Unavailable4u/spherex-blink"],
  minilocker: ["https://github.com/shaikh-dotcom/MiniLocker", "https://youtu.be/q5bYqguilGs"],
  "next-inc-immersive": ["https://next-in-c.onrender.com/", "https://github.com/shaikh-dotcom/Next-In-C"],
};
for (const [slug, urls] of Object.entries(expectQr)) {
  const got = S.getQrTargets(slug).map((q) => q.url);
  if (JSON.stringify(got) !== JSON.stringify(urls)) warn.push(`QR targets of ${slug} differ from guide 07's table: ${got.join(" | ")}`);
}
console.log(warn.length === 0 ? "OK   order and QR targets match the table in guide 07." : "");

// 2. minime.app nowhere
const haystack = JSON.stringify(outputs) + JSON.stringify(snapshot);
if (/minime\.app/i.test(haystack)) {
  hardFail++;
  console.log("FAIL minime.app appears in the snapshot or in a selector result (D-17).");
} else console.log("OK   minime.app appears nowhere in the snapshot or in any selector result.");

// 3. editorial lines vs data
const dataText = JSON.stringify(snapshot).toLowerCase();
const editorial = [];
for (const t of Object.values(BOOK_TEXT)) {
  for (const [field, line] of [["coverLine", t.coverLine], ["backLine", t.backLine]]) {
    if (!line) continue;
    if (!dataText.includes(line.toLowerCase().replace(/\.$/, ""))) editorial.push(`${t.slug}.${field}: "${line}"`);
  }
  for (const s of t.screenshots) {
    const words = s.caption.trim().split(/\s+/).length;
    if (words > 8) {
      hardFail++;
      console.log(`FAIL caption has ${words} words (max 8): ${t.slug}: "${s.caption}"`);
    }
  }
}
console.log(editorial.length ? `NOTE editorial lines in src/config/bookText.ts that are not found in the data (approved in content/books.md, check they are still true):\n     - ${editorial.join("\n     - ")}` : "OK   every factual-looking line in bookText.ts is found in the data.");
for (const w of warn) console.log(`WARN ${w}`);
console.log(hardFail ? `\nSELECT TEST: FAILED (${hardFail})` : "\nSELECT TEST: PASSED");
process.exit(hardFail ? 1 : 0);
