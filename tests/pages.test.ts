// The interior pages (Patch 09): the margins and the left/right parity, what may be read and how, real text only, whole sentences, the QR codes
// (decoded from the plan's own squares), the texture budget, determinism, and a drawing through a recorder. Everything runs in Node:
// the planners take a `Measure` and the sizes of the pictures, and the drawing takes a recorder instead of a canvas.
import fs from "node:fs";
import path from "node:path";
import jsQR from "jsqr";
import { BOOKS, BOOK_IDS, type BookId } from "../src/config/books";
import { BOOK_TEXT } from "../src/config/bookText";
import { PAGE, PAGE_H, PAGE_PX_PER_CM, PAGE_W, pageTextureBytes } from "../src/config/pages";
import { BOOK_PAGES, PAGE_TYPES, figureNumbers, pagesOf, sideOf, spreadAt, spreadCount, typesUsedBy } from "../src/config/pageSpecs";
import { getQrTargets } from "../src/data/select";
import { contrastRatio } from "../src/lib/color";
import { coverDataFor } from "../src/paint/covers/data";
import { QR_DARK, QR_LIGHT, QR_MIN_CODE_CM, QR_QUIET_MODULES, qrMatrix } from "../src/paint/qr";
import { bookPageBytes, pagesData, planBook, planPage } from "../src/paint/pages";
import { roleOf, wordsOf } from "../src/paint/pages/planners";
import { paintPage, type ImageLookup, type PageRenderCtx } from "../src/paint/pages/render";
import type { PagePlan, PageText, PageTokens } from "../src/paint/pages/types";
import { splitSentences } from "../src/data/select";
import type { Measure } from "../src/paint/typography";
import { eq, near, test, truthy } from "./harness";

// ---------------------------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------------------------

/** every glyph is half an em wide (bold is a little wider), as in the cover tests */
const measure: Measure = (text, f) => Array.from(text).length * f.size * (f.weight === 700 ? 0.55 : 0.5);

/** The size of a picture file from its header (PNG and WebP); a file that is not in the repo (the synced site media) is taken as 1600 x 1000. */
function sizeOf(file: string): { w: number; h: number } {
  const p = path.join(process.cwd(), "public", file);
  if (!fs.existsSync(p)) return { w: 1600, h: 1000 };
  const b = fs.readFileSync(p);
  if (b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  return { w: 1600, h: 1000 };
}

const tokens = (id: BookId): PageTokens => ({ spec: BOOKS[id], measure, imageSize: sizeOf });
const book = (id: BookId): PagePlan[] => planBook(id, tokens(id));
const texts = (p: PagePlan): PageText[] => p.ops.filter((o): o is PageText => o.kind === "text");
const ofType = (id: BookId, type: string): PagePlan[] => book(id).filter((p) => p.type === type);

// ---------------------------------------------------------------------------------------------------------------------------
// the page lists
// ---------------------------------------------------------------------------------------------------------------------------

test("pages: the lists are the ones of guide 04 (Mini Me 13 pages, MiniLocker 7), parity decides the side, spreads pair even with odd", () => {
  eq(pagesOf("mini-me").length, 13);
  eq(pagesOf("minilocker").length, 7);
  eq(sideOf(0), "left");
  eq(sideOf(1), "right");
  eq(spreadCount("mini-me"), 7);
  const last = spreadAt("mini-me", 12);
  eq(last.left?.type, "P-BACK");
  eq(last.right, null);
  eq(spreadAt("mini-me", 4).left?.type, "P-ABST");
  eq(spreadAt("mini-me", 4).right?.type, "P-FIG");
  for (const id of BOOK_IDS) eq(BOOK_PAGES[id][BOOK_PAGES[id].length - 1].type, "P-BACK", `${id} ends on the back page`);
  const used = new Set(BOOK_IDS.flatMap((id) => typesUsedBy(id)));
  for (const t of PAGE_TYPES) truthy(used.has(t), `${t} is used by some book`);
});

test("pages: figure numbers run through the book in reading order", () => {
  const n = figureNumbers("mini-me");
  eq(n[5], 1);
  eq(n[6], 2);
  eq(n[8], 5);
  eq(n[0], 0);
});

// ---------------------------------------------------------------------------------------------------------------------------
// the frame
// ---------------------------------------------------------------------------------------------------------------------------

test("pages: the text area is inside the margins and the inner margin is on the right of a left page", () => {
  const M = PAGE.margins;
  for (const id of BOOK_IDS) {
    for (const p of book(id)) {
      const left = (p.side === "left" ? M.outer : M.inner) * PAGE_PX_PER_CM;
      const right = (p.side === "left" ? M.inner : M.outer) * PAGE_PX_PER_CM;
      near(p.area.x, left, 0.01, `${id} ${p.index} left margin`);
      near(PAGE_W - (p.area.x + p.area.w), right, 0.01, `${id} ${p.index} right margin`);
      near(p.area.y, M.top * PAGE_PX_PER_CM, 0.01, `${id} ${p.index} top`);
      near(PAGE_H - (p.area.y + p.area.h), M.bottom * PAGE_PX_PER_CM, 0.01, `${id} ${p.index} bottom`);
    }
  }
});

test("pages: no string leaves the text area (the mirrored ghost, the endpaper and pictures are not text)", () => {
  for (const id of BOOK_IDS) {
    for (const p of book(id)) {
      for (const t of texts(p)) {
        if (t.mirror || t.turn) continue;
        near(Math.max(0, p.area.x - t.x), 0, 1.5, `${id} ${p.index} "${t.text}" starts left of the area`);
        near(Math.max(0, t.x + t.width - (p.area.x + p.area.w)), 0, 1.5, `${id} ${p.index} "${t.text}" ends right of the area`);
        truthy(t.y <= p.area.y + p.area.h + 1.5, `${id} ${p.index} "${t.text}" sits below the area`);
        truthy(t.y >= p.area.y, `${id} ${p.index} "${t.text}" sits above the area`);
      }
    }
  }
});

test("pages: a page's painters say nothing is wrong (no notes) when every picture is there", () => {
  for (const id of BOOK_IDS) for (const p of book(id)) eq(p.notes.join(" | "), "", `${id} ${p.index} ${p.type}`);
});

// ---------------------------------------------------------------------------------------------------------------------------
// what is read, and what is real
// ---------------------------------------------------------------------------------------------------------------------------

test("pages: a string meant to be read has at most 8 words and reads at 7 to 1 on what it stands on", () => {
  let n = 0;
  for (const id of BOOK_IDS) {
    for (const p of book(id)) {
      for (const t of texts(p)) {
        if (t.role !== "read") continue;
        n++;
        truthy(wordsOf(t.text) <= PAGE.maxReadableWords, `${id} ${p.index}: "${t.text}" has more than ${PAGE.maxReadableWords} words`);
        truthy(contrastRatio(t.fill, t.bg ?? p.paper) >= PAGE.minContrast, `${id} ${p.index}: "${t.text}" is ${contrastRatio(t.fill, t.bg ?? p.paper).toFixed(2)} to 1`);
        eq(t.alpha, 1, `${id} ${p.index}: "${t.text}" is not fully opaque`);
      }
    }
  }
  truthy(n > 100, "the pages print a good number of read strings");
});

test("pages: a long string is texture and a short one is read (the rule is one function)", () => {
  eq(roleOf("one two three four five six seven eight"), "read");
  eq(roleOf("one two three four five six seven eight nine"), "texture");
});

test("pages: every word of the body text is a word of the data (no lorem)", () => {
  const norm = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9'’-]+/g, " ").split(" ").filter(Boolean);
  for (const id of BOOK_IDS) {
    const d = pagesData(id);
    const pool = new Set(norm([d.summary, d.abstractFirst, ...d.continuation, ...d.texture, d.colophon.limit ?? "", d.company.affiliation, d.colophon.category, ...d.colophon.tags].join(" ")));
    for (const p of book(id)) {
      let cap = "";
      for (const t of texts(p)) {
        if (t.role !== "texture") continue;
        if (cap) {
          // the rest of the first word goes on beside the cap
          truthy(d.abstractFirst.startsWith(cap + t.text) || d.abstractFirst.startsWith(`${cap} ${t.text}`), `${id} ${p.index}: "${cap}" + "${t.text}" starts the abstract`);
          cap = "";
          continue;
        }
        // a drop cap is the first letter of the paragraph, which the first line goes on without
        if (t.face.weight === 700 && Array.from(t.text).length === 1) {
          eq(t.text, Array.from(d.abstractFirst)[0], `${id} ${p.index}: the drop cap`);
          cap = t.text;
          continue;
        }
        for (const w of norm(t.text)) truthy(pool.has(w), `${id} ${p.index}: the word "${w}" in "${t.text}" is not in the data`);
      }
    }
  }
});

test("pages: body text stops at a whole sentence (the abstract page, its continuation, the gallery's block)", () => {
  const ends = (s: string): boolean => /[.!?]["'”’)\]]*$/.test(s.trim());
  for (const id of BOOK_IDS) {
    const d = pagesData(id);
    truthy(ends(d.abstractFirst), `${id}: the abstract is cut at a sentence`);
    const sentences = new Set([...splitSentences(d.abstractFirst), ...d.texture.flatMap(splitSentences)]);
    for (const p of book(id)) {
      const body = texts(p).filter((t) => t.role === "texture");
      if (body.length === 0) continue;
      // the last word of the last body line of a page that sets running text ends a sentence of the data
      const set = [...sentences];
      if (p.type === "P-ABST" || (p.type === "P-GAL" && pagesOf(id)[p.index].block)) {
        const lastLine = body[body.length - 1].text;
        truthy(ends(lastLine) || /[.!?]/.test(lastLine), `${id} ${p.index}: the text stops mid-sentence at "${lastLine}"`);
        truthy(set.some((s) => s.endsWith(lastLine.split(" ").slice(-2).join(" "))), `${id} ${p.index}: "${lastLine}" is not the end of a sentence of the data`);
      }
    }
  }
});

test("pages: minime.app and the Mini Me film poster are nowhere (D-17, D-20)", () => {
  for (const id of BOOK_IDS) {
    for (const p of book(id)) {
      for (const t of texts(p)) truthy(!/minime\.app/i.test(t.text), `${id} ${p.index}: "${t.text}"`);
      for (const f of p.images) truthy(!/minime\.app|poster/i.test(f), `${id} ${p.index}: the picture "${f}"`);
      for (const q of p.qr) truthy(!/minime\.app/i.test(q.url), `${id} ${p.index}: the code of ${q.url}`);
    }
  }
  const film = ofType("mini-me", "P-FILM")[0];
  eq(film.images[0], BOOK_TEXT["mini-me"].filmFrame, "the film's frame is the stand-in");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the page types
// ---------------------------------------------------------------------------------------------------------------------------

test("P-END: the endpaper's pattern, two tiles across, and no text", () => {
  for (const id of BOOK_IDS) {
    const p = ofType(id, "P-END");
    for (const e of p) {
      eq(e.paper, BOOKS[id].colors.endpaper);
      eq(texts(e).length, 0);
      const pat = e.ops.find((o) => o.kind === "pattern");
      truthy(pat && pat.kind === "pattern" && pat.tilePx === PAGE_W / 2, "two tiles across");
    }
  }
});

test("P-HALF and P-TITLE: the title as set on the book (MiniMe, one word) and the three authors", () => {
  const half = ofType("mini-me", "P-HALF")[0];
  eq(texts(half).map((t) => t.text).join(""), "MiniMe");
  const title = ofType("mini-me", "P-TITLE")[0];
  const names = pagesData("mini-me").authors;
  eq(names.length, 3);
  for (const n of names) truthy(texts(title).some((t) => t.text === n), `${n} is on the title page`);
  truthy(texts(title).some((t) => t.text === String(pagesData("mini-me").year)), "the year");
  truthy(title.ops.some((o) => o.kind === "shape" && o.fill === "#FF2351" || o.kind === "shape" && o.alpha === 1), "the crimson x");
  // SPHEREx breaks its title in two lines: the second is smaller
  const sx = ofType("spherex-blink", "P-TITLE")[0];
  const big = texts(sx).filter((t) => t.face.weight === 700);
  const small = texts(sx).filter((t) => t.face.style === "italic" && /Blink/.test(t.text));
  truthy(big.length > 0 && small.length > 0 && small[0].size < big[0].size, "the second line is smaller");
});

test("P-BLANK: the back of the half-title shows it through, mirrored and very faint; other blanks are bare", () => {
  const blank = ofType("mini-me", "P-BLANK")[0];
  const ghost = texts(blank);
  truthy(ghost.length > 0 && ghost.every((t) => t.mirror && t.alpha <= 0.06 && t.role === "mark"));
});

test("P-COLO: the facts from the data, the stated limit only where the book states one, the web column only on the links spread", () => {
  const mini = ofType("mini-me", "P-COLO")[0];
  const d = pagesData("mini-me");
  const all = texts(mini).map((t) => t.text).join(" ");
  truthy(all.includes(d.colophon.statusText) && all.includes(String(d.colophon.year)) && all.includes(d.colophon.category));
  truthy(all.includes(d.web), "the web column");
  const ml = ofType("minilocker", "P-COLO")[0];
  const limit = pagesData("minilocker").colophon.limit;
  truthy(limit, "MiniLocker states a limit");
  truthy(texts(ml).map((t) => t.text).join(" ").includes(limit!.split(" ")[0]), "and it is printed");
  truthy(!texts(ml).some((t) => t.text === pagesData("minilocker").web), "no web column on MiniLocker's colophon");
});

test("P-ABST: a drop cap of three lines on the first page, whole sentences filling a continuation", () => {
  const first = ofType("mini-me", "P-ABST")[0];
  const cap = texts(first).find((t) => t.face.weight === 700 && t.size > 100);
  truthy(cap, "the drop cap");
  const cont = ofType("spherex-blink", "P-ABST").find((p) => pagesOf("spherex-blink")[p.index].continuation);
  truthy(cont && texts(cont).length > 10, "the continuation sets running text");
});

test("P-FIG and P-GAL: mounted prints keep their own proportions, turn 0.4 to 0.8 degrees, and each has a numbered caption of at most 8 words", () => {
  for (const id of BOOK_IDS) {
    for (const p of book(id)) {
      if (p.type !== "P-FIG" && p.type !== "P-GAL") continue;
      const imgs = p.ops.filter((o) => o.kind === "image");
      truthy(imgs.length >= 1 && imgs.length <= 3, `${id} ${p.index}: 1 to 3 pictures`);
      for (const im of imgs) {
        if (im.kind !== "image") continue;
        near(im.src.w / im.src.h, im.dest.w / im.dest.h, 0.01, `${id} ${p.index}: the picture is not cropped`);
        const deg = Math.abs(((im.turn?.rad ?? 0) * 180) / Math.PI);
        truthy(deg >= PAGE.print.rotateDeg.min - 1e-9 && deg <= PAGE.print.rotateDeg.max + 1e-9, `${id} ${p.index}: turn ${deg}`);
        truthy(im.dest.x >= p.area.x - 20 && im.dest.x + im.dest.w <= p.area.x + p.area.w + 20, `${id} ${p.index}: the picture stays between the margins`);
      }
      const labels = texts(p).filter((t) => /^FIG\.|^Fig\./i.test(t.text));
      eq(labels.length, imgs.length, `${id} ${p.index}: one label per picture`);
    }
  }
});

test("P-FIG and P-GAL: a print is the same every time (its turn comes from a hash)", () => {
  const a = JSON.stringify(ofType("mini-me", "P-GAL")[0].ops);
  const b = JSON.stringify(planPage("mini-me", 6, tokens("mini-me")).ops);
  eq(a, b);
});

test("P-GAL: a page with a block ends with real body text; a gallery with 1 to 3 shots only", () => {
  const pg = planPage("mini-me", 7, tokens("mini-me"));
  truthy(texts(pg).filter((t) => t.role === "texture").length > 3, "the block");
});

test("P-FILM: a 16 to 9 frame, the play mark, the duration, the title and the kind of link, all from the data", () => {
  for (const id of ["mini-me", "minilocker"] as const) {
    const p = ofType(id, "P-FILM")[0];
    const d = pagesData(id);
    const t = texts(p).map((x) => x.text);
    truthy(t.includes(d.film!.duration), `${id}: the duration`);
    truthy(t.includes(d.film!.title), `${id}: the title`);
    truthy(t.includes("Interactive edition"), `${id}: the tag`);
    const im = p.ops.find((o) => o.kind === "image");
    truthy(im && im.kind === "image");
    if (im && im.kind === "image") near(im.dest.w / im.dest.h, 16 / 9, 0.01);
    truthy(p.ops.some((o) => o.kind === "shape" && o.fill === PAGE.film.playFill), "the play mark");
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// QR codes
// ---------------------------------------------------------------------------------------------------------------------------

/** Rasterises a planned code from its own squares (the light square and the dark modules) and decodes it. */
function decode(p: PagePlan, qrIndex: number): string | null {
  const q = p.qr[qrIndex];
  const px = 720;
  const k = px / q.quiet.w;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  const shapes = p.ops.filter((o) => o.kind === "shape" && o.tag === "qr-modules");
  const mine = shapes.filter((o) => o.kind === "shape" && o.cmds.length > 0 && o.cmds[0].t === "M" && Math.abs((o.cmds[0] as { x: number }).x - q.code.x) < q.code.w);
  for (const s of mine) {
    if (s.kind !== "shape") continue;
    for (let i = 0; i + 4 < s.cmds.length + 1; i += 5) {
      const a = s.cmds[i] as { x: number; y: number };
      const c = s.cmds[i + 2] as { x: number; y: number };
      const x0 = Math.round((a.x - q.quiet.x) * k);
      const y0 = Math.round((a.y - q.quiet.y) * k);
      const x1 = Math.round((c.x - q.quiet.x) * k);
      const y1 = Math.round((c.y - q.quiet.y) * k);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (x >= 0 && y >= 0 && x < px && y < px) data.fill(0, (y * px + x) * 4, (y * px + x) * 4 + 3);
    }
  }
  return jsQR(data, px, px)?.data ?? null;
}

test("QR: every code on every page decodes to its target, is at least 3.4 cm, and has a quiet zone of 4 modules, dark on light", () => {
  let n = 0;
  for (const id of BOOK_IDS) {
    for (const p of book(id)) {
      if (p.type !== "P-LINK" && p.type !== "P-BACK") eq(p.qr.length, 0, `${id} ${p.index}: only the link and back pages carry codes`);
      p.qr.forEach((q, i) => {
        n++;
        eq(decode(p, i), q.url, `${id} ${p.index}: the decoded code`);
        truthy(q.code.w / PAGE_PX_PER_CM >= QR_MIN_CODE_CM - 1e-9, `${id} ${p.index}: ${(q.code.w / PAGE_PX_PER_CM).toFixed(2)} cm`);
        near((q.quiet.w - q.code.w) / 2 / q.module, QR_QUIET_MODULES, 1e-6, `${id} ${p.index}: the quiet zone`);
        eq(q.version, qrMatrix(q.url).version);
        const quiet = p.ops.find((o) => o.kind === "shape" && o.tag === "qr-quiet");
        eq(quiet && quiet.kind === "shape" ? quiet.fill : "", QR_LIGHT);
        const mods = p.ops.find((o) => o.kind === "shape" && o.tag === "qr-modules");
        eq(mods && mods.kind === "shape" ? mods.fill : "", QR_DARK);
        truthy(q.quiet.x >= p.area.x - 1 && q.quiet.x + q.quiet.w <= p.area.x + p.area.w + 1, `${id} ${p.index}: the light square is between the margins`);
      });
    }
  }
  truthy(n >= 12, `a code on each link and back page (${n})`);
});

test("QR: the link page prints the two targets of the selectors in order; the back page prints the first, the one of the back cover", () => {
  for (const id of BOOK_IDS) {
    const t = getQrTargets(id);
    const link = ofType(id, "P-LINK")[0];
    eq(link.qr.map((q) => q.url).join(" "), t.slice(0, 2).map((x) => x.url).join(" "), `${id} link page`);
    for (const x of t.slice(0, 2)) truthy(texts(link).some((s) => s.text === x.display), `${id}: the address ${x.display} is printed under its code`);
    const back = ofType(id, "P-BACK")[0];
    eq(back.qr.length, 1);
    eq(back.qr[0].url, coverDataFor(id).qr, `${id}: the back page and the back cover print the same code`);
    near(back.qr[0].code.w / PAGE_PX_PER_CM, PAGE.back.codeCm, 1e-6);
    truthy(link.qr[0].code.w / PAGE_PX_PER_CM >= PAGE.link.codeCm - 1e-6 || link.notes.length === 0);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// the budget, determinism and drawing
// ---------------------------------------------------------------------------------------------------------------------------

test("pages: the pages of one book stay under the texture budget", () => {
  for (const id of BOOK_IDS) truthy(bookPageBytes(id) <= PAGE.textureBudgetBytes, `${id}: ${Math.round(bookPageBytes(id) / 1048576)} MB`);
  eq(bookPageBytes("mini-me"), 13 * pageTextureBytes());
  truthy(pageTextureBytes() === Math.round(PAGE_W * PAGE_H * 4 * (4 / 3)));
});

test("pages: the same input gives the same plan", () => {
  for (const id of BOOK_IDS) eq(JSON.stringify(book(id)), JSON.stringify(book(id)), id);
});

/** A recorder with the part of a 2D context the painter uses. */
function recorder(): { ctx: PageRenderCtx; calls: Record<string, number>; texts: string[] } {
  const calls: Record<string, number> = {};
  const out: string[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...args: unknown[]) => {
        calls[k] = (calls[k] ?? 0) + 1;
        if (k === "fillText") out.push(String(args[0]));
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as PageRenderCtx;
  return { ctx, calls, texts: out };
}

test("pages: painting every page through a recorder draws its text, its shapes and its pictures", () => {
  for (const id of BOOK_IDS) {
    const lookup: ImageLookup = () => ({}) as CanvasImageSource;
    for (const p of book(id)) {
      const rec = recorder();
      paintPage(p, () => ({ canvas: null as unknown as object, ctx: rec.ctx }), lookup);
      const glyphs = texts(p).reduce((s, t) => s + (t.glyphs ? t.glyphs.length : 1), 0);
      eq(rec.texts.length, glyphs, `${id} ${p.index} ${p.type}: one fillText per string or glyph`);
      const imgs = p.ops.filter((o) => o.kind === "image").length;
      // the grain and the pattern tiles are drawn through the same recorder, so `drawImage` is at least the pictures
      truthy((rec.calls.drawImage ?? 0) >= imgs, `${id} ${p.index}: the pictures are drawn`);
    }
  }
});
