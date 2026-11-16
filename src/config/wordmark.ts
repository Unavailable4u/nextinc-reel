// THE END CARD (Patch 20), S24-S25, frames 4800-5399, as data and pure functions. Guide 01, Act 8: the room dims (`config/dim.ts`), the Next Inc. wordmark draws in (the crimson italic x is
// stroked on, then the letters rise into place), then the tagline and the address; S25 holds for 1.5 s and fades to black in 0.5 s. A pure function of the frame, no React, so the tests measure
// what `src/fx/Wordmark.tsx` and `src/fx/FadeOut.tsx` draw.
//
// THE WORDS are the data's, never typed here (rule 6): the name, the tagline and the address come from `getCompany()`. The wordmark is the name with its x taken out: the letters before it, the
// x, the letters after it ("Ne", x, "t Inc." for the site's name), so a change of the name in the site's data changes the wordmark and nothing else has to be touched.
//
// THE X is the site's own path, `public/site/brand/glyph-x.json` (copied by `npm run sync -- --copy-media`): it is used as it is and never redrawn. It is an OUTLINE of CMU Serif Bold Italic's x, in
// font units (1000 to the em, y up, the origin on the baseline), so it is placed with one translation and one scale, and it is "stroked on" by drawing its contour (`pathLength` 1, the dash
// offset runs from 1 to 0) and then filling it, the stroke going as the fill comes in.
//
// THE LETTERS are CMU Serif Bold (the site's face), each placed by its advance width, which `ADVANCE_BOLD` holds for every printable ASCII character: the numbers are the `hmtx` advances of
// `public/fonts/cmu-serif-700-roman.woff2` (for the x, the italic file's 560). They are measured, not guessed, and nothing in the film has to measure text in a browser. The font has no
// kerning between any pair of this name's letters (HarfBuzz gives the same advances with kerning on and off); a name with a kerned pair is a small error here, not a wrong letter.
//
// Every frame number is on a beat. The audio cue sheet (guide 08) has the lamp's swell on 4800 and the wordmark's tone on 4860, which is where the x starts.

import glyphX from "../../public/site/brand/glyph-x.json";
import { getCompany } from "../data/select";
import { arrive, signature } from "../lib/ease";
import { WIDTH } from "./timeline";

export const WORDMARK = {
  /** the x is stroked on: from this frame, over this many (beat 162, 2 s) */
  stroke: { from: 4860, frames: 60 },
  /** the crimson fills the x and the stroke goes (beat 164) */
  fill: { from: 4920, frames: 30 },
  /** the letters rise into place, left to right, `gap` frames apart (beat 165), each taking `frames` */
  letters: { from: 4950, gap: 4, frames: 30 },
  /** the tagline (beat 168, the start of bar 42) and the address (beat 170) fade in and rise `riseEm` of their own size */
  tagline: { from: 5040, frames: 45 },
  address: { from: 5100, frames: 45 },
  /** the soft dark behind the whole card fades in with the stroke: its alpha at the middle of the card */
  scrim: { from: 4860, frames: 60, alpha: 0.55 },
  /** type, px at 1920 x 1080: the wordmark's em, the tagline's and the address's */
  sizePx: 168,
  taglinePx: 36,
  addressPx: 26,
  /** the card is centred on this column; the baselines are these rows (the books' bottom edge is at about y 570-650, so the card stands below them, on the desk's front) */
  centreX: WIDTH / 2,
  baselineY: 820,
  taglineY: 904,
  addressY: 962,
  /** how far a letter, the tagline and the address start below their place, in em of their own size */
  riseEm: 0.16,
  /** the stroke's width in px (it is drawn in glyph units, so it scales with the x) */
  strokePx: 3.4,
  /** extra room after the x, in em: the italic x's top right (603 units on a 560 advance) overhangs the next letter's side bearing, so the t would touch it */
  afterXEm: 0.045,
  /**
   * The colours. The letters are the paper white of the books' foil (`#F5F0E6`). The x is the site's crimson as the site draws it on a dark ground (`#FF4660`, the dark scheme of
   * `assets/img/icons/icon.svg`): the light-ground crimson of the covers (`#C0102C`) is under 3 : 1 against this room once it is dim, which a test holds.
   */
  paper: "#F5F0E6",
  x: "#FF4660",
  tagline_ink: "#E9E2D4",
  address_ink: "#B9AF9B",
  /** the warm black of the scrim (the vignette's) */
  scrimRgb: "10,6,5",
} as const;

/** The end of the film: S25 holds from 5280 and fades to black over the last 0.5 s (frames 5370 to 5399, the last frame fully black). */
export const END = { fadeFrom: 5370, fadeTo: 5399 } as const;

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const prog = (frame: number, from: number, frames: number): number => Math.min(1, Math.max(0, (frame - from) / frames));

// ---------------------------------------------------------------------------------------------------------------------------
// the type
// ---------------------------------------------------------------------------------------------------------------------------

/** Advance widths of CMU Serif Bold (roman), in 1000ths of an em, for the characters 32 (space) to 126 (~) in order. From `hmtx` of `public/fonts/cmu-serif-700-roman.woff2`. */
export const ADVANCE_BOLD: readonly number[] = [
  383, 350, 575, 958, 575, 958, 894, 319, 447, 447, 575, 894, 319, 383, 319, 575, 575, 575, 575, 575, 575, 575, 575, 575, 575, 575, 319, 319, 894, 894, 894, 543, 894, 869, 818, 830, 881, 755, 723, 904, 900, 436, 594, 901, 691, 1091, 900,
  863, 786, 863, 862, 638, 800, 884, 869, 1188, 869, 869, 702, 319, 575, 319, 703, 894, 575, 559, 638, 511, 638, 527, 351, 575, 638, 319, 351, 606, 319, 958, 638, 575, 638, 606, 473, 453, 447, 638, 606, 830, 606, 606, 511, 575, 319,
  575, 703,
];
/** The advance of the italic x in CMU Serif Bold Italic (`public/fonts/cmu-serif-700-italic.woff2`), the slot the site's x takes. */
export const X_ADVANCE = 560;

/** The advance of one character, in 1000ths of an em; throws naming the character when it is outside printable ASCII (the table is for the site's Latin name). */
export function advanceOf(ch: string): number {
  const code = ch.length === 1 ? ch.charCodeAt(0) : -1;
  const a = code >= 32 && code <= 126 ? ADVANCE_BOLD[code - 32] : undefined;
  if (a === undefined) throw new Error(`wordmark: no advance width for "${ch}" (ADVANCE_BOLD covers the printable ASCII characters 32 to 126)`);
  return a;
}

/** The glyph: the path (font units, y up), its bounds [x0, y0, x1, y1] and the em it is drawn in. */
export const GLYPH = { d: (glyphX as { d: string }).d, bounds: (glyphX as { bounds: number[] }).bounds, unitsPerEm: (glyphX as { unitsPerEm: number }).unitsPerEm } as const;

/** The name split at its x: what is before it and what is after it. Throws when the name has no x (the wordmark is built round it). */
export function wordmarkParts(name: string = getCompany().name): { before: string; after: string } {
  const i = name.toLowerCase().indexOf("x");
  if (i < 0) throw new Error(`wordmark: the company name "${name}" has no x to stroke on (the wordmark is the name round the site's x)`);
  return { before: name.slice(0, i), after: name.slice(i + 1) };
}

export interface PlacedLetter {
  ch: string;
  /** its index in the name (the x has one too, so the letters after it start later) */
  index: number;
  /** the pen position (the left of its advance box) and the baseline, px in the frame */
  x: number;
  /** the frame it starts to rise on */
  startFrame: number;
}

export interface WordmarkLayout {
  letters: PlacedLetter[];
  /** where the x's origin is (the left of its advance box, on the baseline), px, and the scale that turns its font units into px */
  xOrigin: number;
  scale: number;
  /** the left and right ends of the whole wordmark, px, and its width */
  left: number;
  right: number;
  width: number;
}

/** Where every letter and the x stand, centred on `WORDMARK.centreX`. A pure function of the name and the numbers above. Spaces take room and draw nothing. */
export function wordmarkLayout(name: string = getCompany().name): WordmarkLayout {
  const { before, after } = wordmarkParts(name);
  const em = WORDMARK.sizePx;
  const px = (units: number): number => (units * em) / 1000;
  const total = [...before, ...after].reduce((s, ch) => s + px(advanceOf(ch)), 0) + px(X_ADVANCE) + WORDMARK.afterXEm * em;
  const left = WORDMARK.centreX - total / 2;
  const letters: PlacedLetter[] = [];
  let pen = left;
  const place = (ch: string, index: number): void => {
    if (ch !== " ") letters.push({ ch, index, x: pen, startFrame: WORDMARK.letters.from + index * WORDMARK.letters.gap });
    pen += px(advanceOf(ch));
  };
  [...before].forEach((ch, i) => place(ch, i));
  const xOrigin = pen;
  pen += px(X_ADVANCE) + WORDMARK.afterXEm * em;
  [...after].forEach((ch, i) => place(ch, before.length + 1 + i));
  return { letters, xOrigin, scale: em / GLYPH.unitsPerEm, left, right: left + total, width: total };
}

/** The x's ink box on screen, px: the glyph's bounds placed by the layout (y down). Used to keep the card clear of the books and to measure the contrast under the x. */
export function xInkBox(layout: WordmarkLayout = wordmarkLayout()): { x0: number; y0: number; x1: number; y1: number } {
  const [bx0, by0, bx1, by1] = GLYPH.bounds;
  return {
    x0: layout.xOrigin + bx0 * layout.scale,
    x1: layout.xOrigin + bx1 * layout.scale,
    y0: WORDMARK.baselineY - by1 * layout.scale,
    y1: WORDMARK.baselineY - by0 * layout.scale,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the frame
// ---------------------------------------------------------------------------------------------------------------------------

export interface WordmarkFrame {
  /** the soft dark behind the card: 0 to `WORDMARK.scrim.alpha` */
  scrimAlpha: number;
  /** how much of the x's contour is drawn, 0 to 1, and how much of it is filled, 0 to 1; the stroke's opacity is what the fill has not covered yet */
  draw: number;
  fill: number;
  strokeOpacity: number;
  /** per letter (in the layout's order): 0 to 1 how far it has risen; its opacity is the same number */
  letters: number[];
  tagline: number;
  address: number;
}

/** The whole end card at a frame. Everything is 0 before 4860 and is 1 from 5145 on (the last thing, the address, is in place), until the fade of S25. */
export function wordmarkAt(frame: number, layout: WordmarkLayout = wordmarkLayout()): WordmarkFrame {
  const W = WORDMARK;
  const fill = smooth(prog(frame, W.fill.from, W.fill.frames));
  return {
    scrimAlpha: W.scrim.alpha * smooth(prog(frame, W.scrim.from, W.scrim.frames)),
    draw: signature(prog(frame, W.stroke.from, W.stroke.frames)),
    fill,
    strokeOpacity: 1 - fill,
    letters: layout.letters.map((l) => arrive(prog(frame, l.startFrame, W.letters.frames))),
    tagline: arrive(prog(frame, W.tagline.from, W.tagline.frames)),
    address: arrive(prog(frame, W.address.from, W.address.frames)),
  };
}

/** The frame the card is complete on: the address has arrived. */
export const CARD_COMPLETE = WORDMARK.address.from + WORDMARK.address.frames;

/** The alpha of the black that ends the film: 0 until `END.fadeFrom`, 1 on `END.fadeTo` (the last frame, 5399) and after it. */
export function fadeAlpha(frame: number): number {
  return smooth((frame - END.fadeFrom) / (END.fadeTo - END.fadeFrom));
}

/** The words of the card, from the data: the tagline and the address as the site states them. */
export function cardText(): { tagline: string; address: string } {
  const c = getCompany();
  return { tagline: c.tagline, address: c.address };
}
