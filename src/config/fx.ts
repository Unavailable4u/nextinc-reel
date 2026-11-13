// THE GLOBAL LAYERS, AS DATA (Patch 13B). Grain and vignette are drawn over the whole frame, above the scene and the overlays of the
// shots. These are PLACEHOLDER values: faint on purpose, and tuned by eye in Patch 22 (finishing). Nothing here is a fact about the
// film's content, so it is free to change; no frame numbers, no imports, so a plain Node can read it (the tests do).

export const GRAIN = {
  /** the seed of the film's grain (src/lib/prng.ts); with the frame number it fixes every grain pixel of every frame */
  seed: 0x6e78726c,
  /** the grain is drawn from a tile of this many pixels (square), repeated over the frame at 1:1; a new tile and a new offset on every frame */
  tilePx: 256,
  /** the strongest a single grain pixel gets: the share of black or white it adds to the picture (0.04 is 4 percent, about 10 of 255 levels) */
  amount: 0.04,
} as const;

export const VIGNETTE = {
  /** the picture is untouched inside this fraction of the way from the centre to the corner (0 to 1) */
  innerRadius: 0.55,
  /** the darkening at the corners: the share of the picture replaced by the vignette colour (0.30 is 30 percent) */
  strength: 0.3,
  /** a warm black, never pure black (guide 03, shadows) */
  color: "#0a0605",
  /** the fall-off is a smooth curve through this many steps, so it has no visible rings */
  steps: 8,
} as const;
