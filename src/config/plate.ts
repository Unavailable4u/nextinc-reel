// THE PLATE: the owner's desk photograph. It is never edited, redrawn, re-saved or relit (`npm run plate:verify`).
// All pixel values here are in PHOTO pixels of the original 1536 x 864 file (origin top-left).

import regionsJson from "./plateRegions.json";
import { HEIGHT, WIDTH } from "./timeline";

/** path under public/ (read-only; originals live in plates/original, anything made from it in plates/derived) */
export const PLATE_FILE = "plates/original/desk-plate.png";
export const PLATE_W = 1536;
export const PLATE_H = 864;

/** SHA-256 of the original file; the same value as docs/reference/.plate.sha256 (checked by `npm run plate:verify`). */
export const PLATE_SHA256 = "3aa7af92d957fc90427f096aa6f2e7fb2ac1a3192cff17d2b1a3496381044af0";

/**
 * Photo pixels the camera must keep between the edge of its window and the edge of the photo when the photo is larger than the
 * frame (guide 05, "What the flat photo allows"). There is nothing beyond the photo, so the camera never goes there.
 */
export const EDGE_MARGIN = 40;

/**
 * The black pillarbox that frames the photo when it does not fill the 16:9 frame (guide 02, "Pillarbox"). The plate is 1536 x 864,
 * exactly 16:9, so at the opening view it fills the frame: no bars and no feather. The component stays for any view below M_FIT_*.
 */
export const PILLARBOX = {
  /** the bars */
  color: "#000000",
  /** the photo's outer strip that fades into the bar, in photo px */
  feather: 0,
} as const;

/** Regions the strict pixel test compares (lamp and LED strips); see plateRegions.json. */
export const INTEGRITY_REGIONS = regionsJson.regions as Record<string, { x0: number; y0: number; x1: number; y1: number; what: string }>;

// ---------- magnification ----------
// M = (on-screen width of the photo in px) / 1536.

/** the whole photo exactly fills the frame HEIGHT: the opening shot */
export const M_FIT_HEIGHT = HEIGHT / PLATE_H;
/** the photo exactly fills the frame WIDTH: no bars from here on (the same value as M_FIT_HEIGHT, the plate being 16:9) */
export const M_FIT_WIDTH = WIDTH / PLATE_W;

export type MagBand = "sharp" | "defocus" | "bokeh";

/** The magnification budget of guide 02, as data. Blur radii are in output px at 1080p and are STARTING values (tuned in Patch 04). */
export const MAGNIFICATION = {
  /** up to here the photo may be in focus */
  sharpUpTo: 2.6,
  /** between sharpUpTo and this the photo needs defocus; above it, heavy bokeh only */
  defocusUpTo: 5,
  /** minimum blur radius at sharpUpTo (start of the defocus band) */
  minBlurAtDefocus: 6,
  /** minimum blur radius at defocusUpTo and everywhere above */
  minBlurAtBokeh: 25,
} as const;

/**
 * Factor between the superseded 736 x 672 photo and this plate for the same desk framing: the desk front edge was 629 px wide there
 * and is 869.7 px here. Old M x DESK_M_RATIO = new M (the opening view is the exception: it is 1.25 now).
 */
export const DESK_M_RATIO = 629 / 869.7;

/** M for a photo that is `onScreenWidth` px wide on screen. */
export const plateMagnification = (onScreenWidth: number): number => onScreenWidth / PLATE_W;

export function magnificationBand(M: number): MagBand {
  if (M <= MAGNIFICATION.sharpUpTo + 1e-9) return "sharp";
  if (M <= MAGNIFICATION.defocusUpTo + 1e-9) return "defocus";
  return "bokeh";
}

/** The smallest blur radius (output px) the budget allows at magnification M. Zero while the photo may be sharp. */
export function minBlurPx(M: number): number {
  const m = MAGNIFICATION;
  if (M <= m.sharpUpTo) return 0;
  if (M >= m.defocusUpTo) return m.minBlurAtBokeh;
  const t = (M - m.sharpUpTo) / (m.defocusUpTo - m.sharpUpTo);
  return m.minBlurAtDefocus + (m.minBlurAtBokeh - m.minBlurAtDefocus) * t;
}

/** Colours of the budget bands in the dev tools: green, amber, red (until defocus exists, Patch 04). */
export const BAND_COLOR: Record<MagBand, string> = { sharp: "#3ecf6a", defocus: "#f0b429", bokeh: "#ff4d4d" };
