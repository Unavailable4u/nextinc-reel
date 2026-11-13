// The cover painter (Patch 08): SVG paths, typography, the exact marks, the plans of the four covers, the drawing and the normal map,
// the curved spine. Everything runs in Node: the planners take a `Measure`, and the drawing takes a recorder instead of a canvas.
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { BOOKS, BOOK_IDS, type BookId } from "../src/config/books";
import { BOOK_TEXT } from "../src/config/bookText";
import { COVER, COVER_ART, COVER_FILES, COVER_STYLE, CRIMSON, SURFACES, ptToCm } from "../src/config/covers";
import { getAuthors, getBook } from "../src/data/select";
import { contrastRatio } from "../src/lib/color";
import { layoutOf } from "../src/book/geometry";
import { spineHalfAngle, spineHalfGeometry } from "../src/book/coverMaterials";
import { CX, CY, MARK, MARK_VIEWBOX, RADII, arcPath, dialArcs, markShapes } from "../src/paint/covers/brand";
import { X_ASPECT, publisherXOps, makeCtx, surfaceCm } from "../src/paint/covers/common";
import { coverDataFor } from "../src/paint/covers/data";
import { globeDots } from "../src/paint/covers/immersive";
import { PLANNERS, coverKey } from "../src/paint/covers/index";
import { coverTextureBytes, debossPx, heightGrey, normalFromHeight, paintSurface, type CanvasMaker, type RenderCtx } from "../src/paint/covers/render";
import type { CoverPlan, CoverTokens, Op, SurfacePlan, TextOp } from "../src/paint/covers/types";
import { arcToCubics, drawPath, fitToWidth, parsePath, parseSvgPaths, parseTransform, pathBounds, pathToString, transformPath, type PathCmd } from "../src/paint/svgPath";
import { balancedWrap, fitSize, justify, layoutTitle, smallCapsLayout, trackedLayout, wrapWords, type FontSpec, type Measure } from "../src/paint/typography";
import { eq, near, test, throws, truthy } from "./harness";

// ---------------------------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------------------------

/** every glyph is half an em wide (bold is a little wider), so text widths are simple and the same everywhere */
const measure: Measure = (text, f) => Array.from(text).length * f.size * (f.weight === 700 ? 0.55 : 0.5);
const font = (size: number): FontSpec => ({ role: "serif", weight: 400, style: "normal", size });

const MARK_SVG = '<svg viewBox="0 0 512 512"><g transform="translate(10 20)"><path d="M100 400 L100 120 L256 300 L412 120 L412 400 Z"/></g></svg>';

function tokens(id: BookId, svg: string | null = id === "mini-me" ? MARK_SVG : null): CoverTokens {
  return { spec: BOOKS[id], measure, miniMeMarkSvg: svg };
}
const plan = (id: BookId, svg?: string | null): CoverPlan => PLANNERS[id](coverDataFor(id), tokens(id, svg));
const texts = (sp: SurfacePlan): TextOp[] => sp.ops.filter((o): o is TextOp => o.kind === "text");
const textWidth = (o: TextOp): number => (o.glyphs && o.glyphs.length ? o.glyphs[o.glyphs.length - 1].x + measure(o.glyphs[o.glyphs.length - 1].ch, { ...o.face, size: o.glyphs[o.glyphs.length - 1].size }) : measure(o.text, { ...o.face, size: o.size }));
const allText = (p: CoverPlan): string[] => SURFACES.flatMap((s) => texts(p.surfaces[s]).map((o) => o.text));

// ---------------------------------------------------------------------------------------------------------------------------
// svg paths
// ---------------------------------------------------------------------------------------------------------------------------

test("svgPath: relative commands, H, V and implicit repeats become absolute M, L, C and Z", () => {
  const p = parsePath("m10 10 h5 v5 l-5 0 z M0 0 20 0 20 20");
  eq(pathToString(p), "M10 10L15 10L15 15L10 15ZM0 0L20 0L20 20");
});

test("svgPath: Q, S and T become cubics that pass through the same end points", () => {
  const q = parsePath("M0 0 Q10 10 20 0");
  eq(q.length, 2);
  const c = q[1] as Extract<PathCmd, { t: "C" }>;
  near(c.x1, 20 / 3, 1e-9);
  near(c.y1, 20 / 3, 1e-9);
  const s = parsePath("M0 0 C0 10 10 10 10 0 S20 -10 20 0");
  const c2 = s[2] as Extract<PathCmd, { t: "C" }>;
  near(c2.x1, 10, 1e-9); // the reflection of (10, 10) about (10, 0) is (10, -10)... on the x axis: 2 x 10 - 10
  near(c2.y1, -10, 1e-9);
});

test("svgPath: an arc is cubics on the circle, ends exactly at its end point, and flags may be glued", () => {
  const cs = arcToCubics(0, -1, 1, 1, 0, true, true, -1, 0);
  eq(cs.length, 3, "270 degrees is three quarter turns");
  const last = cs[cs.length - 1] as Extract<PathCmd, { t: "C" }>;
  eq(last.x, -1);
  eq(last.y, 0);
  for (const c of cs) {
    const k = c as Extract<PathCmd, { t: "C" }>;
    near(Math.hypot(k.x, k.y), 1, 1e-9, "end point on the circle");
  }
  const glued = parsePath("M0 0 a1 1 0 00.5.5");
  truthy(glued.length >= 2);
  throws(() => parsePath("M0 0 a1 1 0 20 1 1"), "arc flag");
});

test("svgPath: exact bounds use the curve's extrema, not its control points", () => {
  const b = pathBounds(parsePath("M0 0 C0 10 10 10 10 0"));
  near(b.y0, 0, 1e-12);
  near(b.y1, 7.5, 1e-9, "the top of this cubic is 3/4 of the control height");
  const full = pathBounds(arcToCubics(1, 0, 1, 1, 0, true, true, -1, 0).length ? [{ t: "M", x: 1, y: 0 }, ...arcToCubics(1, 0, 1, 1, 0, false, true, -1, 0)] : []);
  near(full.y1, 1, 1e-6, "the half circle reaches its radius");
});

test("svgPath: the transforms of an SVG file nest in order and fitToWidth centres the bounds", () => {
  const parsed = parseSvgPaths(MARK_SVG);
  eq(parsed.viewBox?.join(","), "0,0,512,512");
  const b = pathBounds(parsed.cmds);
  near(b.x0, 110, 1e-9);
  near(b.y0, 140, 1e-9);
  const m = fitToWidth(b, 100, 50, 60);
  const fitted = pathBounds(transformPath(parsed.cmds, m));
  near(fitted.x1 - fitted.x0, 100, 1e-9);
  near((fitted.x0 + fitted.x1) / 2, 50, 1e-9);
  near((fitted.y0 + fitted.y1) / 2, 60, 1e-9);
  const t = parseTransform("translate(10 0) scale(2)");
  near(t[0], 2, 1e-12);
  near(t[4], 10, 1e-12);
  throws(() => parseTransform("skewX(3)"), "not supported");
  throws(() => parseSvgPaths("<svg></svg>"), "Trace the mark");
});

test("svgPath: drawPath hands every command to the context in order", () => {
  const log: string[] = [];
  const ctx = { moveTo: () => log.push("M"), lineTo: () => log.push("L"), bezierCurveTo: () => log.push("C"), closePath: () => log.push("Z") };
  drawPath(ctx, parsePath("M0 0 L1 1 C1 2 3 4 5 6 Z"));
  eq(log.join(""), "MLCZ");
});

// ---------------------------------------------------------------------------------------------------------------------------
// typography
// ---------------------------------------------------------------------------------------------------------------------------

test("typography: tracking adds space between glyphs but not after the last; small caps shrink only lower case", () => {
  const t = trackedLayout("abc", measure, font(10), 0.1);
  near(t.width, 3 * 5 + 2 * 1, 1e-9);
  const sc = smallCapsLayout("Ab", measure, font(10), { ratio: 0.8 });
  eq(sc.glyphs[0].size, 10);
  eq(sc.glyphs[1].size, 8);
  eq(sc.glyphs[1].ch, "B");
});

test("typography: wrapping never cuts a word, balancing keeps the line count and evens the lines", () => {
  const f = font(10);
  eq(wrapWords("aaaa bbbb cccc", measure, f, 50).join("|"), "aaaa bbbb|cccc");
  eq(wrapWords("longerthanthemeasure x", measure, f, 20).join("|"), "longerthanthemeasure|x");
  const text = "one two three four five six seven eight nine";
  const plain = wrapWords(text, measure, f, 150);
  const bal = balancedWrap(text, measure, f, 150);
  eq(bal.length, plain.length);
  const spread = (ls: string[]): number => Math.max(...ls.map((l) => measure(l, f))) - Math.min(...ls.map((l) => measure(l, f)));
  truthy(spread(bal) <= spread(plain), "balanced lines are no more uneven");
});

test("typography: justify spreads the words over the width; fitSize scales to fit and says when it cannot", () => {
  const j = justify("aa bb cc", measure, font(10), 50);
  near(j.words[2].x + measure("cc", font(10)), 50, 1e-9);
  const fit = fitSize("abcdefghij", measure, { role: "serif", weight: 400, style: "normal" }, 25, 10, 2);
  near(fit.size, 5, 1e-9);
  eq(fit.fits, true);
  eq(fitSize("abcdefghij", measure, { role: "serif", weight: 400, style: "normal" }, 25, 10, 8).fits, false);
});

test("typography: a title is one line, or one per part, and a line that is too wide shrinks to the measure", () => {
  const parts = [
    { text: "SPHEREx", style: "plain" as const },
    { text: " Blink Comparator", style: "italic" as const },
  ];
  const one = layoutTitle(parts, measure, { size: 40, maxWidth: 1000 });
  eq(one.lines.length, 1);
  eq(one.lines[0].runs[1].text, " Blink Comparator");
  const two = layoutTitle(parts, measure, { size: 40, maxWidth: 1000, breakAtStyleChange: true });
  eq(two.lines.length, 2);
  near(two.lines[1].size, 40 * 0.58, 1e-9);
  eq(two.lines[1].runs[0].text, "Blink Comparator", "the space that carried the break is trimmed");
  const tight = layoutTitle(parts, measure, { size: 40, maxWidth: 100, breakAtStyleChange: true });
  for (const l of tight.lines) truthy(l.width <= 100 + 1e-9, "no line runs past the measure");
  throws(() => layoutTitle([], measure, { size: 10, maxWidth: 10 }), "at least one part");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the marks that are used exactly
// ---------------------------------------------------------------------------------------------------------------------------

test("brand: the dial's numbers are the app's (RadiusDial.tsx) and its arcs are 270 degrees from 12 o'clock to 9", () => {
  eq(CX, 120);
  eq(CY, 120);
  eq(RADII.join(","), "104,88,72,56,40");
  eq(arcPath(104), "M 120 16 A 104 104 0 1 1 16 120");
  const arcs = dialArcs(500, 600, 208);
  eq(arcs.length, 5);
  eq(arcs[0].width, 8, "scale 1: the stroke is the app's 8");
  arcs.forEach((a, i) => {
    const first = a.cmds[0] as Extract<PathCmd, { t: "M" }>;
    const last = a.cmds[a.cmds.length - 1] as Extract<PathCmd, { t: "C" }>;
    near(first.x, 500, 1e-9);
    near(first.y, 600 - RADII[i], 1e-9, "starts at 12 o'clock");
    near(last.x, 500 - RADII[i], 1e-9);
    near(last.y, 600, 1e-9, "ends at 9 o'clock");
    eq(a.cmds.length, 4, "a move and three quarter-turn cubics");
    for (const c of a.cmds.slice(1) as Extract<PathCmd, { t: "C" }>[]) near(Math.hypot(c.x - 500, c.y - 600), RADII[i], 1e-9, "every end point is on the circle");
  });
  const b = dialArcs(0, 0, 11.6 * 100)[0];
  near(b.r, 580, 1e-9, "the outer arc is the configured diameter across");
});

test("brand: the Mark is the five circles of appendix A, element by element", () => {
  eq(MARK_VIEWBOX, 32);
  eq(MARK.length, 5);
  const want: [number, number | null, number][] = [
    [14.8, 1, 0.5],
    [10.4, 1.2, 0.78],
    [6, 1.7, 1],
    [4.4, null, 0.2],
    [2.2, null, 1],
  ];
  want.forEach(([r, stroke, opacity], i) => {
    eq(MARK[i].r, r);
    eq(MARK[i].stroke, stroke);
    eq(MARK[i].opacity, opacity);
  });
  eq(MARK[0].dash?.join(","), "1.2,2.4");
  const s = markShapes(100, 200, 64);
  const outer = pathBounds(s[0].cmds);
  near(outer.x1 - outer.x0, 2 * 14.8 * 2, 1e-9, "scale 2: the outer ring is 59.2 wide");
  near((outer.x0 + outer.x1) / 2, 100, 1e-9);
  eq(s[0].dash?.join(","), "2.4,4.8");
  eq(s[3].color, CRIMSON);
  eq(s[3].mode, "fill");
});

test("the x: the glyph is the site's, its aspect is the bounds' and it takes the right colour on every cloth (D-39)", () => {
  const file = path.resolve(process.cwd(), "public", COVER_FILES.glyphX);
  truthy(fs.existsSync(file), "public/site/brand/glyph-x.json is there");
  const j = JSON.parse(fs.readFileSync(file, "utf8")) as { bounds: number[] };
  near((j.bounds[3] - j.bounds[1]) / (j.bounds[2] - j.bounds[0]), X_ASPECT, 1e-9);
  const ctx = makeCtx(coverDataFor("mini-me"), tokens("mini-me"));
  const x = publisherXOps(ctx, 50, 60, 100)[0];
  const b = pathBounds(x.cmds);
  near(b.x1 - b.x0, 100, 1e-6);
  near((b.y1 - b.y0) / (b.x1 - b.x0), X_ASPECT, 2e-3);
  near((b.x0 + b.x1) / 2, 50, 1e-6);
  const fills: Record<BookId, string> = {} as Record<BookId, string>;
  for (const id of BOOK_IDS) fills[id] = publisherXOps(makeCtx(coverDataFor(id), tokens(id)), 0, 0, 10)[0].fill;
  eq(fills["mini-me"], CRIMSON);
  eq(fills.minilocker, CRIMSON);
  eq(fills["spherex-blink"], BOOKS["spherex-blink"].colors.foil.secondary, "crimson on indigo is under the contrast limit");
  eq(fills["next-inc-immersive"], BOOKS["next-inc-immersive"].colors.foil.secondary, "crimson on the darkened crimson is too");
  for (const id of BOOK_IDS) {
    const ok = contrastRatio(CRIMSON, BOOKS[id].colors.cloth) >= COVER.xMinContrast;
    eq(fills[id] === CRIMSON, ok, id);
  }
  near(contrastRatio("#000000", "#FFFFFF"), 21, 1e-9);
});


// ---------------------------------------------------------------------------------------------------------------------------
// the plans
// ---------------------------------------------------------------------------------------------------------------------------

test("covers: every surface has the size its pixels per cm and the book's geometry say, and the board and its spine agree", () => {
  for (const id of BOOK_IDS) {
    const p = plan(id);
    const L = layoutOf(BOOKS[id]);
    for (const s of SURFACES) {
      const sp = p.surfaces[s];
      const cm = surfaceCm(BOOKS[id], s);
      eq(sp.width, Math.round(cm.w * COVER.pxPerCm[s]), `${id} ${s} width`);
      eq(sp.height, Math.round(cm.h * COVER.pxPerCm[s]), `${id} ${s} height`);
      truthy(sp.safe.x > 0 && sp.safe.x + sp.safe.w < sp.width && sp.safe.y + sp.safe.h < sp.height, `${id} ${s} safe area is inside`);
    }
    near(p.surfaces.front.widthCm, L.W / 2 - L.hingeX, 1e-9);
    near(p.surfaces.front.heightCm, 22.9, 1e-9);
    truthy(p.surfaces.spine.widthCm > L.T && p.surfaces.spine.widthCm < L.T * 1.1, "the arc is a little longer than the chord");
  }
});

test("covers: three books are complete, and Mini Me says in a note that its mark file is missing (it never redraws it)", () => {
  for (const id of ["spherex-blink", "minilocker", "next-inc-immersive"] as const) eq(plan(id).notes.length, 0, `${id}: ${plan(id).notes.join("; ")}`);
  eq(plan("mini-me").notes.length, 0);
  const missing = plan("mini-me", null);
  eq(missing.notes.length, 1, "one note, however many places want the mark");
  truthy(missing.notes[0].includes("mini-me-mark.svg"), "the note names the file");
  const withMark = plan("mini-me").surfaces.front.ops.filter((o) => o.kind === "shape" && o.layer === "foil");
  const without = missing.surfaces.front.ops.filter((o) => o.kind === "shape" && o.layer === "foil");
  eq(withMark.length - without.length, 1);
});

test("covers: Mini Me's mark is 3.4 cm wide, 3.2 cm from the top, centred, and in the book's primary foil", () => {
  const front = plan("mini-me").surfaces.front;
  const mark = front.ops.find((o) => o.kind === "shape" && o.layer === "foil")!;
  if (mark.kind !== "shape") throw new Error("a shape");
  const b = pathBounds(mark.cmds);
  near(b.x1 - b.x0, COVER_ART["mini-me"].markWidthCm * COVER.pxPerCm.front, 1e-6);
  near(b.y0, COVER_ART["mini-me"].markTopCm * COVER.pxPerCm.front, 1e-6);
  near((b.x0 + b.x1) / 2, front.width / 2, 1e-6);
  eq(mark.fill, BOOKS["mini-me"].colors.foil.primary);
});

test("covers: titles, lines, summaries and names come from the data and the editorial config, and nothing forbidden is printed", () => {
  for (const id of BOOK_IDS) {
    const p = plan(id);
    const all = allText(p).join(" ").toLowerCase();
    const flat = all.replace(/\s+/g, "");
    const text = BOOK_TEXT[id];
    for (const part of text.title) truthy(texts(p.surfaces.front).some((o) => o.text === part.text.trim()), `${id}: title part "${part.text}" on the front`);
    eq(texts(p.surfaces.spine).some((o) => o.text === text.spine), true, `${id}: the spine text`);
    for (const a of getAuthors()) truthy(flat.includes(a.name.toLowerCase().replace(/\s+/g, "")), `${id}: author ${a.name}`);
    if (text.coverLine) truthy(texts(p.surfaces.front).some((o) => o.text.toLowerCase() === text.coverLine!.toLowerCase()), `${id}: the cover line`);
    truthy(!all.includes("minime.app") && !/\btry\b/.test(all) && !all.includes("nasa logo"), `${id}: nothing forbidden`);
  }
  const backWords = texts(plan("next-inc-immersive").surfaces.back).map((o) => o.text).join(" ");
  eq(backWords, BOOK_TEXT["next-inc-immersive"].backLine!);
  eq(texts(plan("spherex-blink").surfaces.back).map((o) => o.text).join(" "), `${getBook("spherex-blink").summary} ${BOOK_TEXT["spherex-blink"].backLine!}`);
});

test("covers: changing a title in the data changes the cover, and its key (proved once; nothing is saved)", () => {
  const data = coverDataFor("mini-me");
  const changed = { ...data, title: [{ text: "MiniMe 2", style: "plain" as const }] };
  const a = PLANNERS["mini-me"](data, tokens("mini-me"));
  const b = PLANNERS["mini-me"](changed, tokens("mini-me"));
  truthy(texts(b.surfaces.front).some((o) => o.text === "MiniMe 2"));
  truthy(!texts(a.surfaces.front).some((o) => o.text === "MiniMe 2"));
  truthy(coverKey(data, tokens("mini-me")) !== coverKey(changed, tokens("mini-me")), "the cache key moves");
});

test("covers: the cache key is stable, and moves with the mark file, the colours and a config number", () => {
  const d = coverDataFor("minilocker");
  const k = coverKey(d, tokens("minilocker"));
  eq(coverKey(coverDataFor("minilocker"), tokens("minilocker")), k);
  const m = coverKey(coverDataFor("mini-me"), tokens("mini-me"));
  truthy(m !== coverKey(coverDataFor("mini-me"), tokens("mini-me", MARK_SVG + " ")), "a changed mark file");
  const recoloured = { ...tokens("minilocker"), spec: { ...BOOKS.minilocker, colors: { ...BOOKS.minilocker.colors, cloth: "#D4B693" } } };
  truthy(coverKey(d, recoloured) !== k, "a changed cloth colour");
  eq(new Set(BOOK_IDS.map((id) => coverKey(coverDataFor(id), tokens(id)))).size, 4, "four books, four keys");
});

test("covers: the guide's placements hold (title at 40 and 66 percent, tops at 60 and 62, the line under the title, authors at the foot)", () => {
  const pt = (n: number, ppc: number): number => n * ptToCm(1) * ppc;
  const ppc = COVER.pxPerCm.front;
  for (const id of BOOK_IDS) {
    const f = plan(id).surfaces.front;
    const title = texts(f).filter((o) => o.face.weight === 700);
    truthy(title.length >= 1, `${id}: a bold title`);
    near(title[0].size, pt(COVER.front.titlePt, ppc), 1e-6, `${id}: 40 pt`);
    const authors = texts(f).filter((o) => o.glyphs && getAuthors().some((a) => o.text === a.name.toUpperCase()));
    eq(authors.length, 3, `${id}: three names, one line`);
    eq(new Set(authors.map((o) => o.y)).size, 1, `${id}: on one baseline`);
    near(authors[0].y, f.height - COVER.front.authors.baselineFromBottomCm * ppc, 1e-6);
    const line = texts(f).find((o) => BOOK_TEXT[id].coverLine && o.text.toLowerCase() === BOOK_TEXT[id].coverLine!.toLowerCase())!;
    truthy(line.y > title[title.length - 1].y, `${id}: the line is under the title`);
  }
  const mm = plan("mini-me").surfaces.front;
  const t = texts(mm).find((o) => o.text === "MiniMe")!;
  const mid = t.y - (0.68 * t.size) / 2;
  near(mid, mm.height * 0.4, 0.03 * t.size, "the middle of the capitals is at 40 percent");
  const sx = plan("spherex-blink").surfaces.front;
  const s1 = texts(sx).find((o) => o.text === "SPHEREx")!;
  near(s1.y - 0.68 * s1.size, sx.height * 0.6, 1e-6, "the top of the capitals is at 60 percent");
  const im = plan("next-inc-immersive").surfaces.front;
  const i1 = texts(im).find((o) => o.text === "Next Inc.")!;
  near(i1.y - 0.68 * i1.size, im.height * 0.62, 1e-6);
});

test("covers: nothing that must be read leaves the safe area", () => {
  for (const id of BOOK_IDS) {
    const p = plan(id);
    for (const s of SURFACES) {
      const sp = p.surfaces[s];
      for (const o of texts(sp)) {
        const w = textWidth(o);
        if (o.rotation === 0) {
          truthy(o.x >= sp.safe.x - 1e-6 && o.x + w <= sp.safe.x + sp.safe.w + 1e-6, `${id} ${s} "${o.text}" across`);
          truthy(o.y <= sp.safe.y + sp.safe.h + 1e-6 && o.y >= sp.safe.y, `${id} ${s} "${o.text}" down`);
        } else {
          truthy(o.y >= sp.safe.y - 1e-6 && o.y + w <= sp.safe.y + sp.safe.h + 1e-6, `${id} ${s} "${o.text}" along the spine`);
          truthy(o.x >= sp.safe.x && o.x + 0.68 * o.size <= sp.safe.x + sp.safe.w + 1e-6, `${id} ${s} "${o.text}" across the spine`);
        }
      }
    }
  }
});

test("covers: the spine reads top to bottom (a quarter turn), its zones do not overlap, and the head carries the mark of the books that have one", () => {
  for (const id of BOOK_IDS) {
    const sp = plan(id).surfaces.spine;
    for (const o of texts(sp)) near(o.rotation, Math.PI / 2, 1e-12, `${id} "${o.text}"`);
    const title = texts(sp).find((o) => o.text === BOOK_TEXT[id].spine)!;
    const numeral = texts(sp).find((o) => o.text.startsWith("Vol."))!;
    truthy(title.y + textWidth(title) <= numeral.y + 1e-6, `${id}: the title ends above the numeral`);
    eq(numeral.text, `Vol. ${getBook(id).volumeNumeral}`);
    const emblem = sp.ops.filter((o) => o.kind === "shape" && o.cmds.length > 0 && pathBounds(o.cmds).y1 < title.y);
    eq(emblem.length > 0, id === "mini-me" || id === "minilocker", `${id}: emblem at the head`);
    if (emblem.length > 0) truthy(Math.max(...emblem.map((o) => (o.kind === "shape" ? pathBounds(o.cmds).y1 : 0))) < title.y, `${id}: the emblem is above the title`);
  }
});

test("covers: the back keeps a 4.4 cm square free for the QR, 3.9 cm above the bottom, centred, clear of the words and the x", () => {
  for (const id of BOOK_IDS) {
    const sp = plan(id).surfaces.back;
    const q = sp.qrSlot!;
    near(q.w, COVER.back.qrSlotCm * sp.pxPerCm, 1e-6);
    near(q.h, q.w, 1e-9);
    near(sp.height - (q.y + q.h), COVER.back.qrFromBottomCm * sp.pxPerCm, 1e-6);
    near(q.x + q.w / 2, sp.width / 2, 1e-6);
    for (const o of texts(sp)) truthy(o.y < q.y, `${id}: "${o.text}" is above the slot`);
    for (const o of sp.ops) if (o.kind === "shape") truthy(pathBounds(o.cmds).y0 > q.y + q.h, `${id}: the x is under the slot`);
    eq(plan(id).surfaces.front.qrSlot, undefined);
  }
});

test("covers: SPHEREx's rings and Immersive's globe are foil and blind, the dial is five foil strokes, and each stays on its layer", () => {
  const sx = plan("spherex-blink").surfaces.front.ops.filter((o) => o.kind === "shape");
  truthy(sx.length > 50 && sx.every((o) => o.layer === "foil"), "orbits: foil only");
  const ml = plan("minilocker").surfaces.front.ops.filter((o) => o.kind === "shape");
  eq(ml.length, 5);
  truthy(ml.every((o) => o.layer === "foil" && o.kind === "shape" && o.mode === "stroke" && o.fill === BOOKS.minilocker.colors.foil.primary));
  const im = plan("next-inc-immersive").surfaces.front.ops.filter((o) => o.kind === "shape");
  truthy(im.length > 300 && im.every((o) => o.layer === "blind" && o.depth === COVER.depth.blind && o.alpha === COVER_ART["next-inc-immersive"].blindAlpha));
  for (const id of BOOK_IDS) for (const s of SURFACES) for (const o of plan(id).surfaces[s].ops) if (o.layer === "foil") eq(o.alpha, 1, "foil is never translucent");
});

test("covers: the spine's Mark is printed (translucent rings), the book's ink and crimson, 1.6 cm", () => {
  const sp = plan("minilocker").surfaces.spine;
  const rings = sp.ops.filter((o) => o.kind === "shape" && o.layer === "ink");
  eq(rings.length, 5);
  const outer = pathBounds((rings[0] as Extract<Op, { kind: "shape" }>).cmds);
  near(outer.x1 - outer.x0, (COVER_ART.minilocker.markCm * COVER.pxPerCm.spine * 29.6) / 32, 1e-6);
  eq(rings[0].alpha, 0.5);
  eq(COVER_STYLE.minilocker.title.crimson.layer, "ink");
});

test("covers: the globe is the same every time, lies on a disc, and its dots are bigger the nearer they are", () => {
  const a = globeDots(480, 6401, 23.5, 35);
  const b = globeDots(480, 6401, 23.5, 35);
  eq(JSON.stringify(a), JSON.stringify(b));
  truthy(a.length > 400 && a.length < 560, `about 480 dots, got ${a.length}`);
  for (const d of a) {
    truthy(Math.hypot(d.x, d.y) <= 1 + 1e-9 && d.depth > 0 && d.depth <= 1);
    near(Math.hypot(d.x, d.y, d.depth), 1, 1e-9, "on the unit sphere");
  }
  truthy(JSON.stringify(globeDots(480, 6402, 23.5, 35)) !== JSON.stringify(a), "another seed, another globe");
});

// ---------------------------------------------------------------------------------------------------------------------------
// drawing and the normal map
// ---------------------------------------------------------------------------------------------------------------------------

interface Rec {
  log: string[];
  ctx: RenderCtx;
}
function recorder(): Rec {
  const log: string[] = [];
  const base: Record<string, unknown> = {};
  const call = (n: string) => (...a: unknown[]): void => void log.push(`${n}${a.length ? `(${a.map((v) => (typeof v === "number" ? Math.round(v) : String(v))).join(",")})` : ""}`);
  for (const n of ["save", "restore", "clip", "beginPath", "fill", "stroke", "fillText", "translate", "rotate", "fillRect", "clearRect", "moveTo", "lineTo", "bezierCurveTo", "closePath", "setLineDash"]) base[n] = call(n);
  const ctx = new Proxy(base, {
    set(t, k, v) {
      t[k as string] = v;
      if (k === "fillStyle" || k === "globalAlpha") log.push(`${String(k)}=${String(v)}`);
      return true;
    },
  }) as unknown as RenderCtx;
  return { log, ctx };
}

test("render: ink draws on the colour canvas only, foil on the foil and height canvases, a blind stamp on colour and height; all are clipped", () => {
  const made: Rec[] = [];
  const make: CanvasMaker<number> = () => {
    const r = recorder();
    made.push(r);
    return { canvas: made.length - 1, ctx: r.ctx };
  };
  const base = { depth: 0, alpha: 1 };
  const ink: Op = { kind: "shape", cmds: parsePath("M0 0L10 0L10 10Z"), mode: "fill", layer: "ink", fill: "#112233", ...base, alpha: 0.5 };
  const foil: Op = { kind: "shape", cmds: parsePath("M0 0L10 0L10 10Z"), mode: "fill", layer: "foil", fill: "#aabbcc", alpha: 1, depth: 1 };
  const blind: Op = { kind: "shape", cmds: parsePath("M0 0L10 0L10 10Z"), mode: "fill", layer: "blind", fill: "#2A0710", alpha: 0.6, depth: 0.8 };
  const sp: SurfacePlan = { surface: "front", width: 200, height: 300, pxPerCm: 100, widthCm: 2, heightCm: 3, safe: { x: 0, y: 0, w: 1, h: 1 }, ops: [ink, foil, blind] };
  const out = paintSurface(sp, make);
  eq(JSON.stringify(out), JSON.stringify({ color: 0, foil: 1, height: 2 }));
  const [color, foilR, height] = made;
  for (const r of made) truthy(r.log.includes("clip"), "clipped to the inside of the bevel");
  truthy(color.log.includes("fillStyle=#112233") && color.log.includes("globalAlpha=0.5"), "ink on colour, translucent");
  truthy(color.log.includes("fillStyle=#2A0710"), "the blind stamp darkens the colour canvas");
  truthy(foilR.log.includes("fillStyle=#aabbcc") && !foilR.log.includes("fillStyle=#112233") && !foilR.log.includes("fillStyle=#2A0710"), "foil only on foil");
  truthy(height.log.includes(`fillStyle=${heightGrey(1)}`) && height.log.includes(`fillStyle=${heightGrey(0)}`), "the height canvas starts flat and the foil sinks fully");
  truthy(!height.log.includes("fillStyle=#112233"), "ink does not deboss");
  eq(heightGrey(0), "#ffffff");
  eq(heightGrey(1), "#000000");
  eq(heightGrey(0.8), "#333333");
});

test("render: the clip is a rounded rectangle 0.1 cm inside the outline", () => {
  const r = recorder();
  paintSurface(
    { surface: "back", width: 100, height: 100, pxPerCm: 70, widthCm: 1, heightCm: 1, safe: { x: 0, y: 0, w: 1, h: 1 }, ops: [] },
    () => ({ canvas: 0, ctx: r.ctx }),
  );
  const first = r.log.find((l) => l.startsWith("moveTo"));
  eq(first, `moveTo(${Math.round(COVER.clipInsetCm * 70 + COVER.clipRadiusCm * 70)},${Math.round(COVER.clipInsetCm * 70)})`);
});

test("normal map: flat is (128, 128, 255); a sunken square leans its walls the right way; the depth step is 0.2 mm", () => {
  const w = 24;
  const h = 24;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const flat = normalFromHeight(rgba, w, h, 2);
  eq(flat[0], 128);
  eq(flat[1], 128);
  eq(flat[2], 255);
  // a stamp: a square pit, black (the deepest)
  for (let y = 6; y < 18; y++) for (let x = 6; x < 18; x++) for (let c = 0; c < 3; c++) rgba[(y * w + x) * 4 + c] = 0;
  const n = normalFromHeight(rgba, w, h, 2);
  const at = (x: number, y: number): number[] => [n[(y * w + x) * 4], n[(y * w + x) * 4 + 1], n[(y * w + x) * 4 + 2]];
  // a surface that descends to the right has a normal that leans right: the left wall of a pit leans right (towards its middle)
  truthy(at(5, 12)[0] > 128, "the left wall leans right");
  truthy(at(18, 12)[0] < 128, "the right wall leans left");
  // the picture's rows run down while the map's +y runs up: the top wall descends downwards, so its normal leans down
  truthy(at(12, 5)[1] < 128, "the wall at the top of the pit leans down");
  truthy(at(12, 18)[1] > 128, "the wall at the bottom leans up");
  eq(at(12, 12)[2], 255, "the floor of the pit is flat again");
  eq(at(1, 1)[2], 255, "and so is the cloth around it");
  near(debossPx(100), 2, 1e-9);
  for (let i = 0; i < n.length; i += 4) eq(n[i + 3], 255);
});

test("memory: the four books' cover textures stay under the budget", () => {
  let total = 0;
  for (const id of BOOK_IDS) {
    const b = coverTextureBytes(plan(id));
    truthy(b > 60 * 1048576 && b < 120 * 1048576, `${id}: ${Math.round(b / 1048576)} MB`);
    total += b;
  }
  truthy(total < COVER.textureBudgetBytes, `${Math.round(total / 1048576)} MB for four`);
});

// ---------------------------------------------------------------------------------------------------------------------------
// the curved spine
// ---------------------------------------------------------------------------------------------------------------------------

test("spine geometry: two halves meet at the apex, follow the cloth's arc, and lay the texture by arc length", () => {
  for (const id of BOOK_IDS) {
    const spec = BOOKS[id];
    const L = layoutOf(spec);
    const back = spineHalfGeometry(spec, "back", 0);
    const front = spineHalfGeometry(spec, "front", 0);
    const pb = back.getAttribute("position") as THREE.BufferAttribute;
    const pf = front.getAttribute("position") as THREE.BufferAttribute;
    const ub = back.getAttribute("uv") as THREE.BufferAttribute;
    const uf = front.getAttribute("uv") as THREE.BufferAttribute;
    const box = new THREE.Box3().setFromBufferAttribute(pb).union(new THREE.Box3().setFromBufferAttribute(pf));
    near(box.min.x, -L.T / 2, 1e-5, `${id}: the arc ends at the back board's face`);
    near(box.max.x, L.T / 2, 1e-5, `${id}: and at the front board's`);
    near(box.min.y, -L.H / 2, 1e-5);
    near(box.max.y, L.H / 2, 1e-5);
    near(box.min.z, -L.sagitta, 1e-5, `${id}: the ends sit a sagitta behind the apex`);
    near(box.max.z, 0, 1e-5);
    // the halves share the apex column, and their u ranges are 0 to 0.5 and 0.5 to 1
    near(pb.getX(pb.count - 1), 0, 1e-6);
    near(pf.getX(0), 0, 1e-6);
    near(ub.getX(0), 0, 1e-6);
    near(ub.getX(ub.count - 1), 0.5, 1e-6);
    near(uf.getX(0), 0.5, 1e-6);
    near(uf.getX(uf.count - 1), 1, 1e-6);
    // every point is on the cylinder of radius R about the axis R behind the apex
    for (let i = 0; i < pf.count; i++) near(Math.hypot(pf.getX(i), pf.getZ(i) + 3), 3, 1e-5);
    near(2 * 3 * spineHalfAngle(spec), surfaceCm(spec, "spine").w, 1e-9, "the arc length is the painted width");
    // the normals point out and the triangles face out
    const nf = front.getAttribute("normal") as THREE.BufferAttribute;
    for (let i = 0; i < nf.count; i++) truthy(nf.getZ(i) > 0);
    const idx = front.index!;
    const a = new THREE.Vector3().fromBufferAttribute(pf, idx.getX(0));
    const b = new THREE.Vector3().fromBufferAttribute(pf, idx.getX(1));
    const c = new THREE.Vector3().fromBufferAttribute(pf, idx.getX(2));
    truthy(new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).z > 0, "counter-clockwise seen from outside");
    back.dispose();
    front.dispose();
  }
});

test("spine geometry: a lift moves the sheet outward by exactly that much at the apex", () => {
  const g = spineHalfGeometry(BOOKS["mini-me"], "front", 0.003);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  near(p.getZ(0), 0.003, 1e-7);
  g.dispose();
});
