// THE COVERS, ALL FOUR BOOKS (Patch 08). One entry point per job:
//
//   coverDataFor(id)               the data of a cover (selectors and `bookText.ts`)
//   planFor(id, tokens)            the plan: pure, runs in Node, is what the tests read
//   paintCover(id, data, tokens)   the three canvases of every surface, cached by content hash
//   loadArtwork(id)                the browser's whole job: fonts, the Mini Me mark file, the plan, the canvases and the normal maps
//
// THE CACHE KEY is a hash of everything a cover depends on: the config numbers (`COVER`, `COVER_STYLE`, `COVER_ART`, the deboss
// step, with `COVER.version`), the data the cover prints, the book's colours and seeds and the text of the mark file. Change any of
// them and the cover is painted again; change nothing and it never is (guide 02, rule 8).

import { BOOKS, type BookId } from "../../config/books";
import { COVER, COVER_ART, COVER_FILES, COVER_STYLE, SURFACES, type Surface } from "../../config/covers";
import { MATERIALS } from "../../config/materials";
import { hashObject, hashString } from "../../lib/hash";
import { staticFile } from "remotion";
import { fontsReady, measureWith } from "../typography";
import { coverDataFor } from "./data";
import { paintCover as paintMiniMe } from "./miniMe";
import { planMiniMe } from "./miniMe";
import { planSpherex } from "./spherex";
import { planMiniLocker } from "./miniLocker";
import { planImmersive } from "./immersive";
import { browserCanvasMaker, normalCanvas, paintPlan, type CanvasMaker, type CoverLayers, type ImageCtx } from "./render";
import type { CoverData, CoverPlan, CoverPlanner, CoverTokens } from "./types";

export { coverDataFor } from "./data";
export type { CoverData, CoverPlan, CoverTokens } from "./types";
export { paintMiniMe };

/** The planner of each book. */
export const PLANNERS: Record<BookId, CoverPlanner> = {
  "mini-me": planMiniMe,
  "spherex-blink": planSpherex,
  minilocker: planMiniLocker,
  "next-inc-immersive": planImmersive,
};

/** The plan of one book's cover. Pure. */
export function planFor(id: BookId, tokens: CoverTokens, data: CoverData = coverDataFor(id)): CoverPlan {
  return PLANNERS[id](data, tokens);
}

/** A hash of everything the cover of this book depends on (see the top of the file). */
export function coverKey(data: CoverData, tokens: CoverTokens): string {
  return hashObject({
    version: COVER.version,
    cover: COVER,
    style: COVER_STYLE[data.id],
    art: COVER_ART[data.id],
    deboss: MATERIALS.foil.debossCm,
    data,
    colors: tokens.spec.colors,
    seeds: tokens.spec.seeds,
    mark: tokens.miniMeMarkSvg === null ? null : hashString(tokens.miniMeMarkSvg),
  });
}

/** What a book's covers come to once painted: the plan, the canvases of every surface and the normal map of each one's deboss. */
export interface Artwork {
  id: BookId;
  key: string;
  plan: CoverPlan;
  layers: Record<Surface, CoverLayers<HTMLCanvasElement>>;
  normals: Record<Surface, HTMLCanvasElement>;
}

const browserImageMaker = (width: number, height: number): { canvas: HTMLCanvasElement; ctx: ImageCtx } => {
  const { canvas, ctx } = browserCanvasMaker(width, height);
  return { canvas, ctx: ctx as ImageCtx };
};

const cache = new Map<string, Artwork>();

/** Paints a plan on canvases and makes its normal maps; the cache is by `coverKey`. `make` is for tools that bring their own canvas. */
export function paintCover(id: BookId, data: CoverData, tokens: CoverTokens, make: CanvasMaker<HTMLCanvasElement> = browserCanvasMaker): Artwork {
  const key = coverKey(data, tokens);
  const hit = cache.get(key);
  if (hit) return hit;
  const plan = planFor(id, tokens, data);
  const layers = paintPlan(plan, make);
  const normals = {} as Record<Surface, HTMLCanvasElement>;
  for (const s of SURFACES) {
    const sp = plan.surfaces[s];
    normals[s] = normalCanvas(layers[s].height.getContext("2d") as ImageCtx, sp.width, sp.height, sp.pxPerCm, browserImageMaker);
  }
  const art: Artwork = { id, key, plan, layers, normals };
  cache.set(key, art);
  return art;
}

export function clearCoverCache(): void {
  cache.clear();
  loading.clear();
}

// ---------------------------------------------------------------------------------------------------------------------------
// the browser's job
// ---------------------------------------------------------------------------------------------------------------------------

/** The traced Mini Me mark, or null when the file is missing (a dev server answers a missing file with its own page, so look for an svg). */
async function loadMarkSvg(): Promise<string | null> {
  try {
    const res = await fetch(staticFile(COVER_FILES.miniMeMark));
    if (!res.ok) return null;
    const text = await res.text();
    return /<svg\b/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

/** Tokens for a browser: the book's spec, a measure that asks a scratch canvas, and the mark file's text. */
export function browserTokens(id: BookId, miniMeMarkSvg: string | null): CoverTokens {
  const scratch = document.createElement("canvas").getContext("2d");
  if (!scratch) throw new Error("covers: this browser gave no 2D context");
  return { spec: BOOKS[id], measure: measureWith(scratch), miniMeMarkSvg };
}

const loading = new Map<BookId, Promise<Artwork>>();

/**
 * Everything one book's covers need, in the browser: waits for the site's fonts (and checks every face is really loaded, because a cover
 * painted in a fallback face must not be cached), reads the mark file for Mini Me, plans, paints. One promise per book, shared.
 */
export function loadArtwork(id: BookId): Promise<Artwork> {
  const hit = loading.get(id);
  if (hit) return hit;
  const p = (async () => {
    await fontsReady();
    const svg = id === "mini-me" ? await loadMarkSvg() : null;
    const tokens = browserTokens(id, svg);
    return paintCover(id, coverDataFor(id), tokens);
  })();
  loading.set(id, p);
  p.catch(() => loading.delete(id));
  return p;
}
