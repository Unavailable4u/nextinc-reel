// THE DATA OF A PAGE (Patch 09). Everything a page prints that states a fact comes through here: the selectors of `src/data/select.ts`
// (titles, years, statuses, summaries, abstracts, tags, links, film titles and durations, names, the affiliation) and the editorial
// choices of `src/config/bookText.ts` (how the title is set, the screenshots and their captions, the back lines). A missing value
// throws and names its path (the selectors do). No lorem ipsum: the "texture" text of a page is the abstract, brief, approach and
// outcome of the data, cut at sentence boundaries (guide 04 section 6).

import { BOOK_TEXT, type ScreenshotSpec } from "../../config/bookText";
import type { BookId } from "../../config/books";
import { pagesOf } from "../../config/pageSpecs";
import type { TitlePart } from "../../config/bookText";
import { getAbstractText, getAuthors, getBook, getColophon, getCompany, getFilmsFor, getQrTargets, MissingDataError, siteMedia, splitSentences } from "../../data/select";
import type { Colophon, QrTarget } from "../../data/types";

export interface ImageRef {
  /** a file under public/ */
  file: string;
  /** at most 8 words (guide 07) */
  caption: string;
}

export interface FilmData {
  title: string;
  /** "1:03" */
  duration: string;
  /** the picture in the frame: the film's own poster, or the stand-in of `bookText.ts` (`filmFrame`) */
  frame: string;
}

export interface PageData {
  id: BookId;
  /** the title as set on the book (D-08: Mini Me is "MiniMe") */
  title: TitlePart[];
  volumeNumeral: string;
  /** the data's one-line summary */
  summary: string;
  /** names only, in the site's order */
  authors: string[];
  company: { name: string; address: string; affiliation: string };
  year: number;
  colophon: Colophon;
  /** the abstract cut at a sentence, about 55 words */
  abstractFirst: string;
  /** what follows it, then `brief`, `approach` and `outcome`: one paragraph each, for a continuation page */
  continuation: string[];
  /** the "texture" paragraphs: like `continuation`, but never empty (it falls back to the whole abstract) */
  texture: string[];
  /** P-FIG, or null when the book has no figure page */
  figure: ImageRef | null;
  /** the screenshots of `bookText.ts` in reading order */
  shots: ImageRef[];
  film: FilmData | null;
  /** QR 1 and QR 2 (`getQrTargets`) */
  qr: QrTarget[];
  /** the short column of the links spread: the address of the case study, else the site's */
  web: string;
  coverLine?: string;
  backLine?: string;
  pattern: { slug: string; motif: string; palette: string };
}

const ref = (s: ScreenshotSpec): ImageRef => ({ file: s.file, caption: s.caption });

/** The figure of a book: the `figure` of `bookText.ts`, else the first screenshot no gallery page uses. Null when the book has no P-FIG. */
export function figureFor(id: BookId): ImageRef | null {
  const text = BOOK_TEXT[id];
  if (!text) throw new MissingDataError(`bookText.${id}`);
  if (!pagesOf(id).some((p) => p.type === "P-FIG")) return null;
  if (text.figure) return ref(text.figure);
  const used = new Set(pagesOf(id).flatMap((p) => (p.type === "P-GAL" ? [...(p.shots ?? [])] : [])));
  const free = text.screenshots.find((_, i) => !used.has(i));
  if (!free) throw new MissingDataError(`bookText.${id}.figure (the book has a figure page and no screenshot left over for it)`);
  return ref(free);
}

export function pageDataFor(id: BookId): PageData {
  const text = BOOK_TEXT[id];
  if (!text) throw new MissingDataError(`bookText.${id}`);
  const book = getBook(id);
  const company = getCompany();
  const films = getFilmsFor(id);
  const qr = getQrTargets(id);

  const first = getAbstractText(id);
  const sentences = splitSentences(book.abstract);
  const rest = sentences.slice(splitSentences(first).length).join(" ");
  const continuation = [rest, book.brief ?? "", book.approach ?? "", book.outcome ?? ""].filter((p) => p.trim() !== "");

  let film: FilmData | null = null;
  if (films.length > 0) {
    const f = films[0];
    film = { title: f.title, duration: f.duration, frame: text.filmFrame ?? siteMedia(f.poster) };
  }

  return {
    id,
    title: text.title.map((p) => ({ ...p })),
    volumeNumeral: book.volumeNumeral,
    summary: book.summary,
    authors: getAuthors().map((a) => a.name),
    company: { name: company.name, address: company.address, affiliation: company.affiliation },
    year: book.year,
    colophon: getColophon(id),
    abstractFirst: first,
    continuation,
    texture: continuation.length > 0 ? continuation : [book.abstract],
    figure: figureFor(id),
    shots: text.screenshots.map(ref),
    film,
    qr,
    web: qr.find((t) => t.kind === "case-study")?.display ?? company.address,
    coverLine: text.coverLine,
    backLine: text.backLine,
    pattern: { slug: book.slug, motif: book.motif, palette: book.palette },
  };
}

/** Every picture file a book's pages draw (the loader waits for all of them). */
export function imageFilesOf(data: PageData): string[] {
  const files = new Set<string>();
  if (data.figure) files.add(data.figure.file);
  for (const s of data.shots) files.add(s.file);
  if (data.film) files.add(data.film.frame);
  return [...files];
}
