// THE RISER LABELS (Patch 19), S23 (frames 4320-4799): where each label is, when it arrives and what it says. A pure function of the frame, no React, so the tests
// measure what the overlay (`src/fx/Labels.tsx`) draws. Guide 01 ("Overlays", 1) and guide 04 section 7: a hairline leader (0.75 px at 1080p), a 5 px dot, the name in
// CMU Serif Italic 26 px with a mono sub-line of 18 px (`year - status`), ink on a faint paper chip (#F5F0E6 at 88 percent); one label per book in the site's order,
// from frame 4380, a soft highlight sweep over each book as its label arrives. The WORDS come from `getRiserLabel` (the data), never from here.
//
// WHERE. The dot sits on the book (a fraction of the part of its cover that shows: the lower books show all of it, the upper books the strip above them), the
// leader runs sideways to the chip, and the chip stands beside the riser, never over a book: Vol. I and III to the left, II and IV to the right, each chip anchored by the
// edge nearest the book so it grows away from it. The dot and the chip ride the camera (plate position of the dot, a fixed offset in screen px for the chip); that
// layout is `src/fx/labelLayout.ts` (it needs the camera, which needs the shot files, which need these numbers: so the numbers are here and the layout is not).

import { BOOK_IDS, type BookId } from "./books";
import { BEAT } from "./timeline";
import { getRiserLabel } from "../data/select";

export const LABELS = {
  /** the first label's frame (beat 146) and the gap to the next: guide 08's cue sheet has the ticks on 4380, 4440, 4500 and 4560, two beats apart */
  first: 4380,
  gap: 2 * BEAT,
  /** the leader, the dot, the type: the numbers of guide 01 */
  leaderPx: 0.75,
  dotPx: 5,
  titlePx: 26,
  subPx: 18,
  chip: "#F5F0E6",
  chipAlpha: 0.88,
  ink: "#16120E",
  /** chip padding (px) and the leader's length from the dot to the chip's near edge */
  padX: 14,
  padY: 9,
  leaderLen: 96,
  /** frames: the dot grows, the leader draws, the chip fades in (all from the label's own frame) */
  dotFrames: 9,
  leaderFrom: 6,
  leaderTo: 24,
  chipFrom: 18,
  chipTo: 36,
  /** the highlight sweep: frames it takes, how wide the band is (share of the book's width), its colour and the most it lifts the cover */
  sweepFrames: 54,
  sweepWidth: 0.55,
  sweepColour: "255,238,205",
  sweepAlpha: 0.2,
  /** the labels fade out over the last frames of S23, so S24's wordmark starts on a clean picture */
  fadeOutFrom: 4740,
  fadeOutTo: 4800,
  /** the frame must keep this much clear round a chip, px */
  margin: 40,
  /** an upper bound for the width of a line of text, px per character (the longest line, 33 characters, measures 427.8 px in CMU Serif Italic 26; the mono line is 0.525 em a character) */
  serifPxPerChar: 13.2,
  monoPxPerChar: 9.45,
} as const;

export type LabelSide = "left" | "right";

/** Where each book's dot is (u across, v down the part of the cover that shows) and which side its chip is on. */
export const LABEL_PLACE: Record<BookId, { side: LabelSide; u: number; v: number }> = {
  "mini-me": { side: "left", u: 0.2, v: 0.9 },
  "spherex-blink": { side: "right", u: 0.8, v: 0.9 },
  minilocker: { side: "left", u: 0.2, v: 0.5 },
  "next-inc-immersive": { side: "right", u: 0.8, v: 0.5 },
};

/** The frame a book's label arrives on: the books in the site's order (BOOK_IDS), one every `gap` frames from `first`. */
export function labelFrame(id: BookId): number {
  return LABELS.first + BOOK_IDS.indexOf(id) * LABELS.gap;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The words of a label, from the data (`getRiserLabel`): `Vol. I` and the name on the first line, `2026 - coming soon` on the second. */
export function labelText(id: BookId): { volume: string; name: string; sub: string } {
  const l = getRiserLabel(id);
  return { volume: `Vol. ${l.volumeNumeral}`, name: l.title, sub: `${l.year} - ${l.statusText}` };
}

/** An upper bound for the width of a chip, px: the longer of its two lines plus the padding. */
export function chipWidthBound(id: BookId): number {
  const t = labelText(id);
  return Math.max((t.volume.length + 2 + t.name.length) * LABELS.serifPxPerChar, t.sub.length * LABELS.monoPxPerChar) + 2 * LABELS.padX;
}

/** The height of a chip, px. */
export const CHIP_HEIGHT = Math.round(LABELS.titlePx * 1.15 + LABELS.subPx * 1.2 + 2 * LABELS.padY);
