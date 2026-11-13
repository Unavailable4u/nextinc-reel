// THE PAGES, ALL FOUR BOOKS (Patch 09). One entry point per job, the same shape as `src/paint/covers/index.ts`:
//
//   pageDataFor(id)                    the data of a book's pages (selectors and `bookText.ts`)
//   planPage(id, index, tokens)        the plan of one page: pure, runs in Node, is what the tests read
//   planBook(id, tokens)               the plans of all of a book's pages
//   loadBookPages(id)                  the browser's whole job: fonts, pictures, plans, canvases; one promise per book
//   spreadOf(book, leftIndex)          the two canvases that face each other
//
// THE CACHE KEY of a page is a hash of everything it depends on: `PAGE` (with `PAGE.version`), the data, the book's paper and endpaper
// colours and the size of every picture it draws. Change none of them and the page is never painted again (guide 02, rule 8).
//
// THE BUDGET. The pages of ONE book are alive at once and must stay under `PAGE.textureBudgetBytes`; `loadBookPages` refuses a book over it.
// `releaseBook` drops a book's canvases when its act is over (`BOOKS_OPEN_IN_ACT`).

import { staticFile } from "remotion";
import { BOOKS, type BookId } from "../../config/books";
import { PAGE, pageTextureBytes } from "../../config/pages";
import { pagesOf, spreadAt } from "../../config/pageSpecs";
import { hashObject } from "../../lib/hash";
import { fontsReady, measureWith } from "../typography";
import { imageFilesOf, pageDataFor, type PageData } from "./data";
import { planPageOf } from "./planners";
import { browserPageMaker, paintPage, type ImageLookup, type PageCanvasMaker } from "./render";
import type { ImageSize, PagePlan, PageTokens } from "./types";

export { pageDataFor, imageFilesOf } from "./data";
export { planPageOf, roleOf, wordsOf } from "./planners";
export type { PageData } from "./data";
export type { PagePlan, PageTokens } from "./types";

const dataCache = new Map<BookId, PageData>();
/** The data of a book's pages, read once. */
export function pagesData(id: BookId): PageData {
  let d = dataCache.get(id);
  if (!d) {
    d = pageDataFor(id);
    dataCache.set(id, d);
  }
  return d;
}

/** The plan of page `index` of a book. Pure. */
export function planPage(id: BookId, index: number, tokens: PageTokens, data: PageData = pagesData(id)): PagePlan {
  const list = pagesOf(id);
  const spec = list[index];
  if (!spec) throw new Error(`pages: "${id}" has ${list.length} pages, there is no page ${index}`);
  return planPageOf(id, index, spec, data, tokens);
}

/** The plans of all of a book's pages, in reading order. */
export function planBook(id: BookId, tokens: PageTokens, data: PageData = pagesData(id)): PagePlan[] {
  return pagesOf(id).map((_, i) => planPage(id, i, tokens, data));
}

/** A hash of everything one page depends on (see the top of the file). `sizes` are the pictures' sizes, by file. */
export function pageKey(plan: Pick<PagePlan, "id" | "index" | "type" | "images">, data: PageData, tokens: PageTokens): string {
  const sizes: Record<string, ImageSize | null> = {};
  for (const f of plan.images) sizes[f] = tokens.imageSize(f);
  return hashObject({ version: PAGE.version, page: PAGE, id: plan.id, index: plan.index, type: plan.type, data, paper: tokens.spec.colors.paper, endpaper: tokens.spec.colors.endpaper, sizes });
}

// ---------------------------------------------------------------------------------------------------------------------------
// the browser's job
// ---------------------------------------------------------------------------------------------------------------------------

export interface PaintedPage {
  plan: PagePlan;
  key: string;
  canvas: HTMLCanvasElement;
}

export interface BookPages {
  id: BookId;
  data: PageData;
  pages: PaintedPage[];
  /** the bytes of the pages as GPU textures (RGBA8, mips) */
  bytes: number;
}

/** What a book's pages need to be on the GPU, bytes. */
export const bookPageBytes = (id: BookId): number => pagesOf(id).length * pageTextureBytes();

function loadPicture(file: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = staticFile(file);
  });
}

/** Tokens for a browser: the book's spec, a measure that asks a scratch canvas, and the sizes of the pictures loaded so far. */
export function browserPageTokens(id: BookId, pictures: ReadonlyMap<string, HTMLImageElement | null>): PageTokens {
  const scratch = document.createElement("canvas").getContext("2d");
  if (!scratch) throw new Error("pages: this browser gave no 2D context");
  const imageSize = (file: string): ImageSize | null => {
    const img = pictures.get(file);
    return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  };
  return { spec: BOOKS[id], measure: measureWith(scratch), imageSize };
}

const painted = new Map<string, PaintedPage>();
const loading = new Map<BookId, Promise<BookPages>>();

/** Plans and paints every page of a book, using the cache by `pageKey`. `make` is for tools that bring their own canvas. */
export function paintBook(id: BookId, tokens: PageTokens, pictures: ReadonlyMap<string, HTMLImageElement | null>, make: PageCanvasMaker<HTMLCanvasElement> = browserPageMaker): BookPages {
  const data = pagesData(id);
  const lookup: ImageLookup = (file) => pictures.get(file) ?? null;
  const pages = planBook(id, tokens, data).map((plan): PaintedPage => {
    const key = pageKey(plan, data, tokens);
    const hit = painted.get(key);
    if (hit) return hit;
    const page: PaintedPage = { plan, key, canvas: paintPage(plan, make, lookup) };
    painted.set(key, page);
    return page;
  });
  return { id, data, pages, bytes: bookPageBytes(id) };
}

/**
 * Everything one book's pages need, in the browser: waits for the site's fonts (a page painted in a fallback face must not be cached), loads
 * the pictures, plans and paints. One promise per book, shared. Refuses a book whose pages are over the texture budget.
 */
export function loadBookPages(id: BookId): Promise<BookPages> {
  const hit = loading.get(id);
  if (hit) return hit;
  const p = (async () => {
    const bytes = bookPageBytes(id);
    if (bytes > PAGE.textureBudgetBytes) throw new Error(`pages: the ${pagesOf(id).length} pages of "${id}" take ${Math.round(bytes / 1048576)} MB as textures, over the ${Math.round(PAGE.textureBudgetBytes / 1048576)} MB budget`);
    await fontsReady();
    const data = pagesData(id);
    const pictures = new Map<string, HTMLImageElement | null>();
    await Promise.all(imageFilesOf(data).map(async (f) => pictures.set(f, await loadPicture(f))));
    const tokens = browserPageTokens(id, pictures);
    return paintBook(id, tokens, pictures);
  })();
  loading.set(id, p);
  p.catch(() => loading.delete(id));
  return p;
}

/** Drops a book's painted pages (its act is over). */
export function releaseBook(id: BookId): void {
  loading.delete(id);
  for (const [k, v] of painted) if (v.plan.id === id) painted.delete(k);
}

export function clearPageCache(): void {
  painted.clear();
  loading.clear();
  dataCache.clear();
}

/** The pages that face each other when the book is open at `leftIndex`: either may be absent (the back of the book has only a left page). */
export function spreadOf(book: BookPages, leftIndex: number): { left: PaintedPage | null; right: PaintedPage | null } {
  const s = spreadAt(book.id, leftIndex);
  return { left: s.left ? book.pages[leftIndex] : null, right: s.right ? book.pages[leftIndex + 1] : null };
}
