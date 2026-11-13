// TYPOGRAPHY FOR PAINTED SURFACES (Patch 08). Pure helpers: text in, positions out. Nothing here draws; the painters draw what
// these return. Every function takes a `Measure` instead of a canvas, so Node can run them (the tests pass a fixed-width measure) and
// the browser passes `measureWith(ctx)`.
//
// FONTS. The site's own CMU Serif and CMU Typewriter Text (SIL OFL), loaded from `public/fonts/` by `lib/fonts.ts` with `FontFace`
// and `delayRender`. `fontsReady()` waits for them and then checks that every face really is loaded, because a cover painted in a
// fallback face and cached would be wrong on every frame; it throws and names the fix instead.
//
// SIZES. Passed around as numbers in whatever unit the caller measures in (the painters use painted px). Width is linear in size, so
// `fitSize` measures once and scales.

import { FAMILY_MONO, FAMILY_SERIF, FONT_FACES, loadFonts, stacks } from "../lib/fonts";

export { PT_CM, ptToCm } from "../config/covers";

export type FontRole = "serif" | "mono";

export interface TypeFace {
  role: FontRole;
  weight: 400 | 700;
  style: "normal" | "italic";
}

export interface FontSpec extends TypeFace {
  size: number;
}

/** The CSS `font` shorthand for a canvas context, with the site's own fallback stacks. */
export const fontString = (f: FontSpec): string => `${f.style} ${f.weight} ${f.size}px ${stacks[f.role]}`;

export type Measure = (text: string, font: FontSpec) => number;

/** A measure that asks a 2D context (`ctx.font` is set on every call). */
export function measureWith(ctx: { font: string; measureText(text: string): { width: number } }): Measure {
  return (text, font) => {
    ctx.font = fontString(font);
    return ctx.measureText(text).width;
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// tracking and small caps
// ---------------------------------------------------------------------------------------------------------------------------

export interface PlacedGlyph {
  ch: string;
  /** left edge of the glyph, from the start of the line */
  x: number;
  size: number;
}

export interface GlyphLine {
  glyphs: PlacedGlyph[];
  width: number;
}

/** One glyph at a time with `trackingEm` of extra space after each (no space after the last, so `width` is the visible width). */
export function trackedLayout(text: string, measure: Measure, font: FontSpec, trackingEm = 0): GlyphLine {
  const glyphs: PlacedGlyph[] = [];
  let x = 0;
  const chars = Array.from(text);
  chars.forEach((ch, i) => {
    glyphs.push({ ch, x, size: font.size });
    x += measure(ch, font) + (i < chars.length - 1 ? trackingEm * font.size : 0);
  });
  return { glyphs, width: x };
}

/**
 * Small capitals: capitals and digits at full size, lower case letters as capitals at `ratio` of it (a real small cap is a capital
 * drawn smaller, not a lower case letter). Tracked like `trackedLayout`.
 */
export function smallCapsLayout(text: string, measure: Measure, font: FontSpec, opts: { ratio?: number; trackingEm?: number } = {}): GlyphLine {
  const ratio = opts.ratio ?? 0.78;
  const tracking = opts.trackingEm ?? 0;
  const glyphs: PlacedGlyph[] = [];
  let x = 0;
  const chars = Array.from(text);
  chars.forEach((c, i) => {
    const lower = c !== c.toUpperCase();
    const ch = lower ? c.toUpperCase() : c;
    const f: FontSpec = lower ? { ...font, size: font.size * ratio } : font;
    glyphs.push({ ch, x, size: f.size });
    x += measure(ch, f) + (i < chars.length - 1 ? tracking * f.size : 0);
  });
  return { glyphs, width: x };
}

// ---------------------------------------------------------------------------------------------------------------------------
// words: wrapping, justifying, fitting
// ---------------------------------------------------------------------------------------------------------------------------

/** Greedy line breaking at spaces. A word wider than the line stands alone on its line (it is never cut). */
export function wrapWords(text: string, measure: Measure, font: FontSpec, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next, font) > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The same breaks as `wrapWords` in number, but with the lines of nearly equal length: the narrowest measure that still gives the
 * same number of lines. A two-line blurb then never ends on one short word.
 */
export function balancedWrap(text: string, measure: Measure, font: FontSpec, maxWidth: number): string[] {
  const lines = wrapWords(text, measure, font, maxWidth);
  if (lines.length < 2) return lines;
  const widest = Math.max(...text.split(/\s+/).filter(Boolean).map((w) => measure(w, font)));
  let lo = widest;
  let hi = maxWidth;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrapWords(text, measure, font, mid).length <= lines.length) hi = mid;
    else lo = mid;
  }
  return wrapWords(text, measure, font, hi);
}

export interface JustifiedLine {
  words: { text: string; x: number }[];
  /** the space between two words, after the extra has been added */
  gap: number;
}

/** Spreads the words of a line over exactly `width` by widening the spaces. A one-word line starts at 0 (nothing to spread). */
export function justify(line: string, measure: Measure, font: FontSpec, width: number): JustifiedLine {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { words: words.map((t) => ({ text: t, x: 0 })), gap: measure(" ", font) };
  const total = words.reduce((s, w) => s + measure(w, font), 0);
  const gap = (width - total) / (words.length - 1);
  let x = 0;
  return {
    words: words.map((t) => {
      const p = { text: t, x };
      x += measure(t, font) + gap;
      return p;
    }),
    gap,
  };
}

/** The largest size at which `text` is no wider than `maxWidth`, at most `maxSize`. `fits` is false when even `minSize` is too wide. */
export function fitSize(text: string, measure: Measure, face: TypeFace, maxWidth: number, maxSize: number, minSize: number): { size: number; fits: boolean } {
  const w = measure(text, { ...face, size: maxSize });
  if (w <= maxWidth) return { size: maxSize, fits: true };
  const size = (maxSize * maxWidth) / w;
  return size >= minSize ? { size, fits: true } : { size: minSize, fits: false };
}

// ---------------------------------------------------------------------------------------------------------------------------
// titles
// ---------------------------------------------------------------------------------------------------------------------------

export type TitleStyle = "plain" | "italic" | "crimson";

export interface TitlePartIn {
  text: string;
  style: TitleStyle;
}

/** The faces of a title's styles: bold roman for the plain and crimson parts, the roman italic for the italic ones (guide 04: Bold + Italic). */
export const TITLE_FACE: Record<TitleStyle, TypeFace> = {
  plain: { role: "serif", weight: 700, style: "normal" },
  crimson: { role: "serif", weight: 700, style: "normal" },
  italic: { role: "serif", weight: 400, style: "italic" },
};

export interface TitleRun {
  text: string;
  style: TitleStyle;
  size: number;
  /** from the left edge of its line */
  x: number;
  width: number;
}

export interface TitleLine {
  runs: TitleRun[];
  width: number;
  size: number;
  /** distance from the top of the block to this line's baseline */
  baseline: number;
}

export interface TitleLayout {
  lines: TitleLine[];
  width: number;
  /** from the top of the first line's em box to the baseline of the last */
  height: number;
}

export interface TitleOptions {
  /** the size of the first line */
  size: number;
  /** the size of the following lines when the title breaks (default: 0.58 of `size`) */
  secondSize?: number;
  maxWidth: number;
  /** put each part on its own line (SPHEREx, Immersive); default false: one line */
  breakAtStyleChange?: boolean;
  /** line height in em of the larger size (default 1.12) */
  lineHeight?: number;
}

/**
 * Lays a title out. One line by default; with `breakAtStyleChange` every part has its own line (the first at `size`, the others at
 * `secondSize`). A line wider than `maxWidth` is scaled down to fit, so a long title in the data can never run off the cover.
 */
export function layoutTitle(parts: readonly TitlePartIn[], measure: Measure, opts: TitleOptions): TitleLayout {
  if (parts.length === 0) throw new Error("layoutTitle: a title needs at least one part");
  const lh = opts.lineHeight ?? 1.12;
  const second = opts.secondSize ?? opts.size * 0.58;
  const groups: { parts: TitlePartIn[]; size: number }[] = opts.breakAtStyleChange
    ? parts.map((p, i) => ({ parts: [{ ...p, text: p.text.trim() }], size: i === 0 ? opts.size : second }))
    : [{ parts: parts.map((p, i) => ({ ...p, text: i === 0 ? p.text.replace(/^\s+/, "") : i === parts.length - 1 ? p.text.replace(/\s+$/, "") : p.text })), size: opts.size }];

  const lines: TitleLine[] = [];
  let top = 0;
  let height = 0;
  for (const g of groups) {
    const widthAt = (size: number): number => g.parts.reduce((s, p) => s + measure(p.text, { ...TITLE_FACE[p.style], size }), 0);
    const w0 = widthAt(g.size);
    const size = w0 > opts.maxWidth ? (g.size * opts.maxWidth) / w0 : g.size;
    const runs: TitleRun[] = [];
    let x = 0;
    for (const p of g.parts) {
      const width = measure(p.text, { ...TITLE_FACE[p.style], size });
      runs.push({ text: p.text, style: p.style, size, x, width });
      x += width;
    }
    // the baseline sits 0.8 em below the top of the line's em box (the ascent of the face is about that)
    const baseline = top + size * 0.8;
    lines.push({ runs, width: x, size, baseline });
    height = baseline;
    top += size * lh;
  }
  return { lines, width: Math.max(...lines.map((l) => l.width)), height };
}

// ---------------------------------------------------------------------------------------------------------------------------
// fonts
// ---------------------------------------------------------------------------------------------------------------------------

const unquote = (s: string): string => s.replace(/^["']|["']$/g, "");

/**
 * Starts (once) and awaits the site's fonts, then checks that every declared face is loaded. Resolves when the painters may draw;
 * throws, naming the fix, when a face is missing: a cover painted in a fallback face must not be cached.
 */
export async function fontsReady(): Promise<void> {
  if (typeof document === "undefined") return;
  await loadFonts();
  await document.fonts.ready;
  const loaded = new Set<string>();
  document.fonts.forEach((f) => {
    if (f.status === "loaded") loaded.add(`${unquote(f.family)}|${f.style}|${f.weight}`);
  });
  const missing = FONT_FACES.filter((f) => !loaded.has(`${f.family}|${f.style}|${f.weight}`));
  if (missing.length > 0) {
    throw new Error(`typography: fonts not loaded (${missing.map((m) => `${m.family} ${m.style} ${m.weight}`).join(", ")}). Run \`npm run sync -- --copy-media\` so public/fonts/ has the .woff2 files`);
  }
}

export { FAMILY_MONO, FAMILY_SERIF };
