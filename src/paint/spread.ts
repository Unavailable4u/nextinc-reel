// THE SPREAD COMPOSER (Patch 09). `paintSpread(bookId, leftIndex)` gives the two painted pages that face each other when the book is open
// at `leftIndex` (an even index; the back of the book has only a left page). The pages are painted once per book and kept in the cache of
// `src/paint/pages/index.ts`; `prepareAct` and `disposeAct` keep ONE book's pages alive at once (guide 02: 512 MB), by act:
//
//   Mini Me's pages are alive in Acts 3 to 5 (S06 to S14), MiniLocker's in Act 6 (S18 to S20); SPHEREx and Immersive stay closed all film.
//
// Nothing here bends or animates a page (Patch 10 does that): it hands out flat canvases.

import { BOOK_IDS, type BookId } from "../config/books";
import { PAGE } from "../config/pages";
import { BOOKS_OPEN_IN_ACT } from "../config/pageSpecs";
import { bookPageBytes, loadBookPages, releaseBook, spreadOf, type BookPages, type PaintedPage } from "./pages";

export interface PaintedSpread {
  id: BookId;
  leftIndex: number;
  left: PaintedPage | null;
  right: PaintedPage | null;
}

/** The two pages that face each other at `leftIndex`, painting the book's pages first if they are not yet. Throws for an odd or a missing index. */
export async function paintSpread(id: BookId, leftIndex: number): Promise<PaintedSpread> {
  const book = await loadBookPages(id);
  return { id, leftIndex, ...spreadOf(book, leftIndex) };
}

/** The same, for a book whose pages are already loaded. */
export const spreadOfBook = (book: BookPages, leftIndex: number): PaintedSpread => ({ id: book.id, leftIndex, ...spreadOf(book, leftIndex) });

/** The books whose pages must be alive in `act` (guide 02: only one at a time). */
export const booksAliveInAct = (act: number): readonly BookId[] => BOOKS_OPEN_IN_ACT[act] ?? [];

/** Paints the pages the act needs. Throws when they would not fit the budget together. */
export async function prepareAct(act: number): Promise<BookPages[]> {
  const ids = booksAliveInAct(act);
  const bytes = ids.reduce((s, id) => s + bookPageBytes(id), 0);
  if (bytes > PAGE.textureBudgetBytes) throw new Error(`spread: the pages alive in act ${act} take ${Math.round(bytes / 1048576)} MB, over the ${Math.round(PAGE.textureBudgetBytes / 1048576)} MB budget`);
  return Promise.all(ids.map((id) => loadBookPages(id)));
}

/** Drops the pages of every book that `act` does not need (the act before it is over). Returns the books it dropped. */
export function disposeAct(act: number): BookId[] {
  const keep = new Set(booksAliveInAct(act));
  const dropped = BOOK_IDS.filter((id) => !keep.has(id));
  for (const id of dropped) releaseBook(id);
  return dropped;
}
