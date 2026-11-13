// THE PAGES OF EACH BOOK (Patch 09; guide 04 sections 4 and 5, `content/books.md`). A book's pages are one list, in reading order,
// and the parity of the index says the side: index 0, 2, 4 ... is a LEFT page (the pasted-down endpaper is index 0), 1, 3, 5 ... is a
// RIGHT page. A spread is therefore `(leftIndex, leftIndex + 1)` with an even `leftIndex`, and a page turn goes from one spread to the
// next one, two indices on. The leaf whose front is index 1 has index 2 on its back (so P-BLANK is the back of P-HALF).
//
// MINI ME (the hero, guide 04 section 5):
//   S06 (0, 1) P-END | P-HALF      S07 (2, 3) P-BLANK | P-TITLE    S08 (4, 5) P-ABST | P-FIG
//   S10-S11 (6, 7) P-GAL | P-GAL   S12 (8, 9) P-GAL | P-FILM       S13 (10, 11) P-COLO | P-LINK       S14 (12) P-BACK
// MINILOCKER (the shorter sequence): (0, 1) P-COLO | P-TITLE, (2, 3) P-GAL | P-GAL, (4, 5) P-FILM | P-LINK, (6) P-BACK.
// SPHEREx and IMMERSIVE stand closed on the riser and are never opened in the film; their lists exist so every page type can be
// looked at in `DevPages` and so a later cut could open them.
//
// NOTHING HERE IS A FACT. The page list says which kinds of page, and which of the book's screenshots (`BOOK_TEXT[id].screenshots`)
// go on which gallery page. What is printed comes from the data.

import type { BookId } from "./books";
import { shotAt } from "./timeline";

export const PAGE_TYPES = ["P-END", "P-HALF", "P-BLANK", "P-TITLE", "P-COLO", "P-ABST", "P-FIG", "P-GAL", "P-FILM", "P-LINK", "P-BACK"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export type PageSide = "left" | "right";

export interface PageSpec {
  type: PageType;
  /** P-GAL: which of the book's screenshots (indices into `BOOK_TEXT[id].screenshots`) stand on this page, 1 to 3 */
  shots?: readonly number[];
  /** P-GAL: under the last caption, a block of real body text from the data (the caption block of guide 04 section 5) */
  block?: boolean;
  /** P-ABST: not the abstract but what follows it (the rest of the abstract, then `brief`, `approach`, `outcome`), whole sentences only */
  continuation?: boolean;
  /** P-COLO: add the short "Read on the web" column (the left page of the links spread, S13) */
  web?: boolean;
}

const END: PageSpec = { type: "P-END" };
const HALF: PageSpec = { type: "P-HALF" };
const BLANK: PageSpec = { type: "P-BLANK" };
const TITLE: PageSpec = { type: "P-TITLE" };
const ABST: PageSpec = { type: "P-ABST" };
const FIG: PageSpec = { type: "P-FIG" };
const FILM: PageSpec = { type: "P-FILM" };
const LINK: PageSpec = { type: "P-LINK" };
const BACK: PageSpec = { type: "P-BACK" };

export const BOOK_PAGES: Record<BookId, readonly PageSpec[]> = {
  "mini-me": [END, HALF, BLANK, TITLE, ABST, FIG, { type: "P-GAL", shots: [0, 1] }, { type: "P-GAL", shots: [2], block: true }, { type: "P-GAL", shots: [3, 4] }, FILM, { type: "P-COLO", web: true }, LINK, BACK],
  minilocker: [{ type: "P-COLO" }, TITLE, { type: "P-GAL", shots: [0, 1] }, { type: "P-GAL", shots: [2, 3] }, FILM, LINK, BACK],
  "spherex-blink": [END, HALF, BLANK, TITLE, ABST, FIG, { type: "P-GAL", shots: [1] }, { type: "P-ABST", continuation: true }, { type: "P-COLO" }, LINK, BACK],
  "next-inc-immersive": [END, HALF, BLANK, TITLE, ABST, FIG, { type: "P-GAL", shots: [0, 1] }, { type: "P-GAL", shots: [2], block: true }, { type: "P-COLO" }, LINK, BACK],
};

/** The side of a page by its index: even is left. */
export const sideOf = (index: number): PageSide => (index % 2 === 0 ? "left" : "right");

export function pagesOf(id: BookId): readonly PageSpec[] {
  const list = BOOK_PAGES[id];
  if (!list) throw new Error(`pageSpecs: no pages for "${id}"`);
  return list;
}

/** The page at `index`, or null past either end of the book (a spread at the back has only a left page). */
export function pageAt(id: BookId, index: number): PageSpec | null {
  const list = pagesOf(id);
  return Number.isInteger(index) && index >= 0 && index < list.length ? list[index] : null;
}

export interface SpreadSpec {
  leftIndex: number;
  left: PageSpec | null;
  right: PageSpec | null;
}

/** The two pages that face each other when the book is open at `leftIndex` (even). Throws for an odd index or one past the book. */
export function spreadAt(id: BookId, leftIndex: number): SpreadSpec {
  if (!Number.isInteger(leftIndex) || leftIndex % 2 !== 0) throw new Error(`pageSpecs: a spread starts on a left page (an even index), not ${leftIndex}`);
  const left = pageAt(id, leftIndex);
  const right = pageAt(id, leftIndex + 1);
  if (!left && !right) throw new Error(`pageSpecs: "${id}" has ${pagesOf(id).length} pages, there is no spread at ${leftIndex}`);
  return { leftIndex, left, right };
}

/** How many spreads a book has (counting the last, single-page one). */
export const spreadCount = (id: BookId): number => Math.ceil(pagesOf(id).length / 2);

/**
 * The number of the first figure on each page (0 where a page has none). P-FIG is one figure; a P-GAL has one per screenshot it names.
 * Numbers run through the whole book in reading order, so the figure on S08 is Fig. 1 and the gallery goes on from there.
 */
export function figureNumbers(id: BookId): number[] {
  let next = 1;
  return pagesOf(id).map((p) => {
    const n = p.type === "P-FIG" ? 1 : p.type === "P-GAL" ? (p.shots ?? []).length : 0;
    const first = n > 0 ? next : 0;
    next += n;
    return first;
  });
}

/** The page types a book uses (the ones `DevPages` shows for it). */
export const typesUsedBy = (id: BookId): PageType[] => PAGE_TYPES.filter((t) => pagesOf(id).some((p) => p.type === t));

// ---------------------------------------------------------------------------------------------------------------------------
// acts: when a book's pages must exist (guide 01 "Act by act"; the texture budget is one book's pages at a time)
// ---------------------------------------------------------------------------------------------------------------------------

/** The acts of guide 01 as inclusive shot ranges: Act 0 S00, Act 1 S01-S03, Act 2 S04-S05, Act 3 S06-S09, Act 4 S10-S13, Act 5 S14-S15, Act 6 S16-S21, Act 7 S22-S23, Act 8 S24-S25. */
export const ACTS: readonly { act: number; firstShot: number; lastShot: number }[] = [
  { act: 0, firstShot: 0, lastShot: 0 },
  { act: 1, firstShot: 1, lastShot: 3 },
  { act: 2, firstShot: 4, lastShot: 5 },
  { act: 3, firstShot: 6, lastShot: 9 },
  { act: 4, firstShot: 10, lastShot: 13 },
  { act: 5, firstShot: 14, lastShot: 15 },
  { act: 6, firstShot: 16, lastShot: 21 },
  { act: 7, firstShot: 22, lastShot: 23 },
  { act: 8, firstShot: 24, lastShot: 25 },
];

/** The act a shot id (`"S12"`) belongs to. */
export function actOfShot(shotId: string): number {
  const n = Number(/^S(\d+)$/.exec(shotId)?.[1]);
  const hit = ACTS.find((a) => n >= a.firstShot && n <= a.lastShot);
  if (!hit) throw new Error(`pageSpecs: "${shotId}" is not a shot of the film`);
  return hit.act;
}

/** The act a frame belongs to. */
export const actAt = (frame: number): number => actOfShot(shotAt(frame).id);

/**
 * The books whose PAGES are seen in an act: Mini Me's open in Acts 3 to 5 (S06 to S14), MiniLocker's in Act 6 (S18 to S20). The
 * others are closed all film (SPHEREx and Immersive stand on the riser with their covers to the camera), so their pages are never painted.
 */
export const BOOKS_OPEN_IN_ACT: Readonly<Record<number, readonly BookId[]>> = {
  3: ["mini-me"],
  4: ["mini-me"],
  5: ["mini-me"],
  6: ["minilocker"],
};

export const booksOpenInAct = (act: number): readonly BookId[] => BOOKS_OPEN_IN_ACT[act] ?? [];