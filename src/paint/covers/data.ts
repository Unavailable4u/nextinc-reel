// THE DATA OF A COVER (Patch 08). Everything a cover prints that states a fact comes through here: the selectors of
// `src/data/select.ts` (titles of the data, summaries, names, the volume numeral) and the editorial choices of `src/config/bookText.ts`
// (how the title is set, the spine text, the lines). A missing value throws and names its path (the selectors do).

import { BOOK_TEXT } from "../../config/bookText";
import type { BookId } from "../../config/books";
import { getAuthors, getBook, getQrTargets, MissingDataError } from "../../data/select";
import type { CoverData } from "./types";

export function coverDataFor(id: BookId): CoverData {
  const text = BOOK_TEXT[id];
  if (!text) throw new MissingDataError(`bookText.${id}`);
  const book = getBook(id);
  return {
    id,
    title: text.title.map((p) => ({ ...p })),
    spine: text.spine,
    volumeNumeral: book.volumeNumeral,
    coverLine: text.coverLine,
    backLine: text.backLine,
    summary: book.summary,
    authors: getAuthors().map((a) => a.name),
    qr: getQrTargets(id)[0].url,
  };
}
