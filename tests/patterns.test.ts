// The endpaper patterns (Patch 07): seeded from the slug, one per motif, tileable, and drawn the same way every time.
import { PALETTE_TOKENS } from "../src/config/materials";
import { getBook } from "../src/data/select";
import { BOOK_IDS } from "../src/config/books";
import { hashObject } from "../src/lib/hash";
import { ENDPAPER_GROUND, MOTIFS, endpaperPattern, isMotif, paintPattern, wave, type Ctx2D, type PatternShape, type PatternSpec } from "../src/paint/patterns";
import { eq, near, test, throws, truthy } from "./harness";

const spec = (slug: string, motif: string, palette = "indigo"): PatternSpec => endpaperPattern({ slug, motif, palette });

test("patterns: the same slug, motif and palette always give the same shapes", () => {
  for (const m of MOTIFS) eq(hashObject(spec("mini-me", m)), hashObject(spec("mini-me", m)), m);
});

test("patterns: two books that share a motif still differ (the slug seeds it), and so do two motifs", () => {
  for (const m of MOTIFS) truthy(hashObject(spec("a", m).shapes) !== hashObject(spec("b", m).shapes), `${m}: slugs a and b give the same shapes`);
  truthy(hashObject(spec("a", "rings").shapes) !== hashObject(spec("a", "waves").shapes), "rings and waves differ");
});

test("patterns: every motif makes shapes, with finite numbers and alphas in 0 to 1, near the tile", () => {
  for (const m of MOTIFS) {
    const s = spec("check", m);
    truthy(s.shapes.length >= 8, `${m} makes shapes`);
    const nums = (sh: PatternShape): number[] => {
      switch (sh.kind) {
        case "circle":
          return [sh.cx, sh.cy, sh.r, sh.width];
        case "ellipse":
          return [sh.cx, sh.cy, sh.ax, sh.ay, sh.k, sh.width];
        case "line":
          return [sh.x1, sh.y1, sh.x2, sh.y2, sh.width];
        case "poly":
          return [...sh.points.flat(), sh.width];
        case "rect":
          return [sh.x, sh.y, sh.w, sh.h, sh.width];
      }
    };
    for (const sh of s.shapes) {
      truthy(sh.alpha > 0 && sh.alpha <= 1, `${m} alpha ${sh.alpha}`);
      for (const v of nums(sh)) truthy(Number.isFinite(v) && v > -1 && v < 2, `${m} has a number out of range: ${v}`);
    }
  }
});

test("patterns: the palette token gives the ink, and the ground is the endpaper colour by default", () => {
  for (const t of Object.keys(PALETTE_TOKENS)) eq(spec("x", "bars", t).ink, PALETTE_TOKENS[t], t);
  eq(spec("x", "bars").ground, ENDPAPER_GROUND, "ground");
  eq(endpaperPattern({ slug: "x", motif: "bars", palette: "ink", ground: "#FFFFFF" }).ground, "#FFFFFF", "an explicit ground");
});

test("patterns: an unknown motif or palette is an error, not a blank page", () => {
  throws(() => spec("x", "spirals"), "unknown motif");
  throws(() => spec("x", "rings", "teal"), "unknown palette token");
  eq(isMotif("nodes"), true, "nodes is a motif");
  eq(isMotif("Nodes"), false, "names are case sensitive");
});

test("patterns: the four books' own motifs and palettes (from the data) are all supported", () => {
  for (const id of BOOK_IDS) {
    const b = getBook(id);
    const s = endpaperPattern({ slug: b.slug, motif: b.motif, palette: b.palette });
    truthy(s.shapes.length > 0, `${id} ${b.motif} ${b.palette}`);
  }
});

test("wave: smooth, periodic with period 1, in [-1, 1], zero mean", () => {
  let sum = 0;
  for (let i = 0; i < 1000; i++) {
    const p = i / 1000;
    const w = wave(p);
    truthy(w >= -1 - 1e-12 && w <= 1 + 1e-12, "range");
    near(w, wave(p + 3), 1e-9, "period");
    sum += w;
  }
  near(sum / 1000, 0, 0.01, "mean");
  near(wave(0), -1, 1e-12, "trough");
  near(wave(0.5), 1, 1e-12, "crest");
});

test("waves: every line meets itself at the tile border (whole cycles per tile)", () => {
  const s = spec("w", "waves");
  for (const sh of s.shapes) {
    if (sh.kind !== "poly") continue;
    const a = sh.points[0];
    const b = sh.points[sh.points.length - 1];
    near(a[1], b[1], 1e-9, "the line ends at the height it starts");
    near(a[0], 0, 1e-12, "starts at the left edge");
    near(b[0], 1, 1e-12, "ends at the right edge");
  }
});

test("nodes: a graph edge that crosses the border continues on the other side (no edge longer than the reach)", () => {
  const s = spec("n", "nodes");
  for (const sh of s.shapes) if (sh.kind === "line") truthy(Math.hypot(sh.x2 - sh.x1, sh.y2 - sh.y1) < 0.35, "an edge is short");
});

/** a canvas context that only counts */
function recorder(): { ctx: Ctx2D; calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const count = (k: string) => (): void => {
    calls[k] = (calls[k] ?? 0) + 1;
  };
  const target: Record<string, unknown> = { fillStyle: "", strokeStyle: "", lineWidth: 0, globalAlpha: 1, lineCap: "butt", lineJoin: "miter" };
  const ctx = new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : count(k)),
    set: (t, k: string, v) => ((t[k] = v), true),
  }) as unknown as Ctx2D;
  return { ctx, calls };
}

test("paintPattern: the ground once, every shape nine times (the border has no seam), save and restore balanced", () => {
  for (const m of MOTIFS) {
    const s = spec("paint", m);
    const { ctx, calls } = recorder();
    paintPattern(ctx, s, 64);
    eq(calls.fillRect, 1, `${m} ground`);
    eq((calls.fill ?? 0) + (calls.stroke ?? 0), 9 * s.shapes.length, `${m} draws each shape nine times`);
    eq(calls.save, calls.restore, `${m} save and restore balance`);
  }
});
