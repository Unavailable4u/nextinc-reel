// THE INTERIOR PAGES AS DATA (Patch 09). Every number about how a page is laid out lives here; `src/paint/pages/*` only reads it, the
// way `src/paint/covers/*` reads `config/covers.ts`. The starting values are guide 04 section 4; tune them by looking in `DevPages`.
//
// UNITS: centimetres on the page (the layout is thought of on the paper) and points for type. A page is painted at 2048 x 3072 px,
// which is the guide's 134.7 px/cm (2048 px over 15.2 cm); one point is then 4.75 px.
//
// WHAT IS NOT HERE: titles, authors, summaries, years, links, captions, durations. Those come from `src/data/select.ts` and
// `src/config/bookText.ts`. What is here are the labels that are typography rather than facts ("Abstract.", "Fig.", "Interactive
// edition"), and the numbers.

import type { BookId } from "./books";
import { PT_CM } from "./covers";

export { PT_CM, ptToCm } from "./covers";

/** Painted size of one page, px (guide 04 section 4; guide 06 section 7: the texture is 2048 x 3072 so text does not swim on a turning sheet). */
export const PAGE_W = 2048;
export const PAGE_H = 3072;
/** The page's width on the book, cm (the trim: guide 04 section 4). */
export const PAGE_CM_W = 15.2;
/** 134.74 px/cm. The painted height, 3072 px, is 22.8 cm of the 22.9 cm trim: the 0.4 percent is spread by the texture mapping. */
export const PAGE_PX_PER_CM = PAGE_W / PAGE_CM_W;

export const PAGE = {
  /** bump when a number below is meant to change every page: the cache key carries it */
  version: 1,

  /** guide 04 section 4: inner 2.0, outer 1.6, top 1.8, bottom 2.2 cm. On a left page the inner margin is on the right. */
  margins: { inner: 2.0, outer: 1.6, top: 1.8, bottom: 2.2 },

  /** the type scale, points (guide 04 section 4; chosen for a video, bigger than a real book's) */
  type: { displayPt: 40, headingPt: 26, captionPt: 14, bodyPt: 11, monoPt: 13 },

  /** Body text: line height in em of the body size. The same for every paragraph on every page. */
  bodyLineHeight: 1.5,

  /** the paper under everything (the lit paper colour of the book is `spec.colors.paper`; this is only the ground the painters draw on) */
  grain: { amount: 0.025, tilePx: 256 },

  /** P-END: one tile of the pattern is this wide, cm (2048 px / 2 = 1024 px, two tiles across a page) */
  endpaper: { tileCm: PAGE_CM_W / 2 },

  /** P-HALF: the title only, small, centred. `at` is the share of the page height where the baseline sits. */
  half: { pt: 20, at: 0.4 },

  /** P-TITLE */
  title: {
    /** the middle of the title block, share of the page height */
    at: 0.3,
    /** a title that breaks (SPHEREx, Immersive) sets its second line at this share of the first */
    secondRatio: 0.58,
    lineHeight: 1.12,
    /** the subtitle (the data's summary), italic: the largest size that fits one line, never below `minPt`; below that it takes two balanced lines at `twoLinePt` */
    subtitle: { pt: 14, minPt: 11, twoLinePt: 12.5, gapEm: 2.6, lineHeight: 1.45 },
    /** the three authors, small caps, one under another, centred */
    authors: { at: 0.6, pt: 12.5, trackingEm: 0.14, lineHeight: 1.9 },
    /** the foot: the crimson x, `Next Inc.` and the year */
    foot: { xCm: 1.15, xAt: 0.8, namePt: 14, yearPt: 11, nameGapEm: 2.2, yearGapEm: 1.7 },
  },

  /** P-COLO: a heading, the facts as a list, the stated limit, the affiliation, and (for the links spread) a short column that says where to read on */
  colo: {
    top: 0.14,
    headingPt: 26,
    /** label column width, share of the text width */
    labelShare: 0.3,
    labelPt: 10.5,
    /** the size of a fact's value (the status is set in the typewriter face, the rest in roman) */
    valuePt: 11,
    rowGapEm: 1.1,
    ruleAlpha: 0.35,
    limitPt: 11,
    affiliationPt: 10.5,
    /** the "Read on the web" column near the foot */
    webAt: 0.72,
    webHeadingPt: 14,
  },

  /** P-ABST */
  abst: {
    /** the baseline of the lead-in, share of the page height */
    leadAt: 0.17,
    leadPt: 13,
    leadTrackingEm: 0.14,
    /** the gap between the lead-in and the paragraph, in body lines */
    leadGapLines: 1.2,
    dropCapLines: 3,
    /** the paragraph's words */
    maxWords: 55,
    /** continuation pages start at the top of the text area and fill it (whole sentences only) */
    continuationTop: 0.08,
    paragraphGapLines: 0.6,
  },

  /** A mounted print (P-FIG, P-GAL, and the film page's frame): white border, hairline, corner mounts, a slight turn (guide 04: 0.4 to 0.8 degrees) */
  print: {
    borderCm: 0.34,
    paper: "#FBF9F3",
    hairlineAlpha: 0.4,
    hairlinePx: 2.5,
    cornerCm: 0.62,
    mount: "#2B2621",
    mountAlpha: 0.9,
    rotateDeg: { min: 0.4, max: 0.8 },
    shadow: { offsetCm: 0.1, spreadCm: 0.22, steps: 5, alpha: 0.055 },
    /** the space between the print and its caption, and between two prints, cm */
    captionGapCm: 0.55,
    slotGapCm: 0.7,
    /** a print is never wider than this share of the text width (the turn needs room) */
    maxWidthShare: 0.97,
  },

  /** P-FIG: where the figure sits (top of its box, share of the page height) */
  fig: { top: 0.14 },

  /** P-GAL: the caption block under a lone screenshot is body text of this many lines at most */
  gal: { top: 0.0, blockMaxLines: 12 },

  /** P-FILM */
  film: {
    frameAspect: 16 / 9,
    /** the frame's top, share of the page height */
    top: 0.2,
    frameBorderCm: 0.28,
    playCm: 4,
    playFill: "#14110E",
    playAlpha: 0.74,
    playGlyph: "#F5F0E6",
    playRing: "#F5F0E6",
    /** the duration chip and the "video" corner label */
    durationPt: 13,
    videoPt: 8.5,
    videoTrackingEm: 0.18,
    chipFill: "#14110E",
    chipAlpha: 0.82,
    chipText: "#F5F0E6",
    /** the one-line title under the frame: the largest size that fits, between these */
    titlePt: 20,
    titleMinPt: 12,
    titleGapEm: 2.4,
    tagPt: 10.5,
    tagTrackingEm: 0.16,
    tagGapEm: 1.7,
  },

  /** P-LINK: up to two codes, one above the other, each with a label above and its address in mono below */
  link: {
    /** the side of the modules (not the quiet zone), cm. The guide's 3.4 cm is the minimum; this is "large on screen". */
    codeCm: 4.6,
    labelPt: 12,
    labelTrackingEm: 0.16,
    addressPt: 13,
    addressMinPt: 9,
    /** the first block's top, share of the page height, and the space between the two blocks, cm */
    top: 0.13,
    blockGapCm: 1.6,
    labelGapCm: 0.55,
    addressGapCm: 0.7,
  },

  /** P-BACK */
  back: {
    linePt: 14,
    summaryPt: 11.5,
    lineHeight: 1.5,
    measureShare: 0.78,
    codeCm: 3.6,
    xCm: 1.0,
    /** top of the words and the middle of the code, share of the page height */
    wordsAt: 0.2,
    codeAt: 0.55,
    xAt: 0.86,
  },

  /** Contrast of a string the viewer must read against its paper (guide 07 section 6). It is checked on the painted colours, before the lamp. */
  minContrast: 7,
  /** A string the viewer must read is at most this many words (guide 07 section 6). */
  maxReadableWords: 8,

  /** The pages of ONE book alive at once must stay under this (guide 02: 1.5 GB for the whole film, 343 MB of it covers). RGBA8 with mip maps. */
  textureBudgetBytes: 512 * 1024 * 1024,

  /** `npm run qr:check` looks at each code at this many pixels per cm of paper: about what S13 and S20 give on screen */
  qrCheckPxPerCm: 40,
} as const;

/** One point in px on a page. */
export const PAGE_PT = PT_CM * PAGE_PX_PER_CM;

/** Bytes of one painted page as a GPU texture: RGBA8 and a full mip chain (a third more). */
export const pageTextureBytes = (): number => Math.round(PAGE_W * PAGE_H * 4 * (4 / 3));

/** Typography, not facts. The strings a page prints that are not in the data. */
export const PAGE_TEXT = {
  abstract: "Abstract.",
  figure: "Fig.",
  colophon: "Colophon",
  status: "Status",
  year: "Year",
  category: "Category",
  tags: "Tags",
  readOnTheWeb: "Read on the web",
  interactiveEdition: "Interactive edition",
  video: "video",
} as const;

/** Each part of a title on its own line (SPHEREx, Immersive), as on the covers (`COVER_ART`): the title is one line elsewhere. */
export const TITLE_BREAK: Record<BookId, boolean> = {
  "mini-me": false,
  "spherex-blink": true,
  minilocker: false,
  "next-inc-immersive": true,
};

/** Which of the editorial lines a back page (P-BACK) prints: the same choice as each book's back cover (`art.back` in `src/paint/covers/*`, D-42). */
export const PAGE_BACK_TEXT: Record<BookId, { line: boolean; summary: boolean; backLine: boolean }> = {
  "mini-me": { line: true, summary: true, backLine: false },
  "spherex-blink": { line: false, summary: true, backLine: true },
  minilocker: { line: false, summary: true, backLine: false },
  "next-inc-immersive": { line: false, summary: false, backLine: true },
};
