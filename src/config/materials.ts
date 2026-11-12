// THE MATERIALS AS DATA (Patch 07). Every number about how a surface looks lives here; `src/book/materials.ts` only reads it.
// The starting values are guide 03 section 3 (the table of materials) and section 6 (imperfection); tune them by looking in `DevMaterials`.
//
// Colour comes from the books (`config/books.ts`, `colors`): there is no second set of colours here, only how a colour is treated
// (a desaturation, a sheen tint). The one exception is `PALETTE_TOKENS`, the site's four palette names, which only the endpaper
// patterns use.
//
// UNITS: centimetres, as everywhere. A texture's UVs are in centimetres on the surface and its `repeat` is one over what a tile
// covers, so a weave has the same size on a board, a spine and a hinge strip.

import type { BookId } from "./books";

// ---------------------------------------------------------------------------------------------------------------------------
// the surfaces
// ---------------------------------------------------------------------------------------------------------------------------

export const MATERIALS = {
  /** Bookcloth: matte, woven, with a sheen that catches the lamp at grazing angles (guide 03: roughness 0.85, sheen 0.3 to 0.5). */
  cloth: {
    roughness: 0.85,
    metalness: 0,
    sheenRoughness: 0.55,
    /** the sheen's colour is the cloth's own, this far towards white */
    sheenWhiten: 0.5,
    /** strength of the weave normal map at weave 1 (a book's token multiplies it) */
    normalScale: 0.7,
    /** guide 03 section 9: print is slightly dull in warm light, so take 12 percent of the saturation off the cover colour */
    desaturate: 0.12,
    /** threads per cm of cover (guide 03); the weave tile is `TEXTURES["cloth-normal"].coverCm` and holds `threadsPerTile` of them */
    threadsPerCm: 40,
  },
  /** Foil stamping: metal. It reflects the plate probe, so it flares when the angle is right (guide 03: metalness 1, roughness 0.25 to 0.35). */
  foil: {
    metalness: 1,
    roughness: 0.3,
    /** the step of the deboss, cm (guide 03: 0.2 mm). Used by Patch 08 when it makes the foil's normal map */
    debossCm: 0.02,
  },
  /** Paper (the sheets and the pasted-down endpapers): white-ish, rough, a faint grain (guide 03: roughness 0.9). */
  paper: { roughness: 0.9, metalness: 0 },
  /** The page block's edges (fore-edge, head, tail): fine horizontal lines and a little yellowing near the corners. */
  edge: {
    roughness: 0.92,
    metalness: 0,
    /** the yellowing: a vertex-colour tint (linear) that fades out over `reachCm` from a corner of an edge face */
    tint: [1.0, 0.93, 0.78] as readonly [number, number, number],
    tintAmount: 0.8,
    reachCm: 0.5,
    /** the dye of a stained edge: how far the paper colour goes towards the dye (the lines of the sheets still show through) */
    stainMix: 0.9,
    stainRoughness: 0.8,
  },
  /** The ribbon marker (guide 03: cloth, roughness 0.8). A satin ribbon has more sheen than the cloth. */
  ribbon: { roughness: 0.8, sheen: 0.6, sheenRoughness: 0.5 },
  /** The head and tail bands. */
  band: { roughness: 0.8, sheen: 0.3, sheenRoughness: 0.6 },
  /** Corner wear: a lighter, rougher patch on the cloth at the corners and along the edges (a decal on the front board). */
  wear: {
    /** the wear colour: the cloth colour this far towards a pale rubbed-fibre colour */
    towards: "#D9CDB9",
    mix: 0.55,
    roughness: 0.95,
    /** the largest alpha. A book's own factor (0.6 to 1, from its seed) scales it, so no two books wear the same */
    opacity: 0.55,
  },
  /** The faint film of dust on the top book's top surface (guide 03 section 6). */
  dust: { color: "#CFC2AB", roughness: 1, opacity: 0.3 },
  /** How far above the board a decal floats, cm. The depth buffer's step at 100 cm is about 0.0006, so this is a few steps; the offset also uses polygonOffset */
  decalLiftCm: 0.004,
  /** a decal stays this far in from the board's outline (the bevel and the rounded corner) */
  decalInsetCm: 0.15,
} as const;

/** How one book's cloth differs from the others (guide 04: MiniLocker is a linen with a stronger weave and visible fibres). */
export interface ClothVariant {
  /** multiplies the weave's normal scale */
  weave: number;
  /** 0 to 1; guide 03 asks for 0.3 to 0.5 */
  sheen: number;
}

export const CLOTH_VARIANTS: Record<BookId, ClothVariant> = {
  // near-black: the sheen is what shows the weave at grazing angles
  "mini-me": { weave: 1, sheen: 0.35 },
  "spherex-blink": { weave: 1, sheen: 0.4 },
  minilocker: { weave: 1.7, sheen: 0.3 },
  "next-inc-immersive": { weave: 1, sheen: 0.45 },
};

/**
 * The site's palette tokens, as the endpaper patterns need them. `projects.js` names a palette by its token (`ink`, `indigo`,
 * `forest`, `crimson`); the website's `art.js` holds the hex values, which this repository does not have. `indigo` and `crimson` are
 * the values guide 04 quotes, `ink` is the Mini Me cloth. `forest` is a guess. Patch 08 samples the real ones (guide 04 section 3).
 */
export const PALETTE_TOKENS: Readonly<Record<string, string>> = {
  ink: "#0D0D0D",
  indigo: "#24307A",
  forest: "#1F4A37",
  crimson: "#C0102C",
};

// ---------------------------------------------------------------------------------------------------------------------------
// the textures
// ---------------------------------------------------------------------------------------------------------------------------

export type TextureName = "cloth-normal" | "cloth-rough" | "cloth-tone" | "paper-grain" | "edge-lines" | "corner-wear" | "dust";

export interface TextureSpec {
  /** relative to public/ */
  file: string;
  width: number;
  height: number;
  /** 1 (grey) or 3 (RGB) */
  channels: 1 | 3;
  /** the size in cm of the surface one copy of the picture covers, [u, v] */
  coverCm: readonly [number, number];
  /** true: the picture repeats (a tile); false: it is laid once over a board and stops at its border */
  tiles: boolean;
  /** colour maps are sRGB, data maps (normal, roughness, alpha) are linear (guide 02) */
  colorSpace: "srgb" | "linear";
  /** every random value in the picture comes from this seed */
  seed: number;
  /** what it is for, for the manifest and the notes */
  role: string;
}

/**
 * The seven pictures `npm run textures` makes, and the budget they are under (guide 02: texture memory is 1.5 GB for the whole
 * film; these seven together stay under `TEXTURE_BUDGET_BYTES` as RGBA8 on the GPU, mip maps included).
 */
export const TEXTURES: Record<TextureName, TextureSpec> = {
  "cloth-normal": { file: "textures/cloth-normal.png", width: 256, height: 256, channels: 3, coverCm: [0.2, 0.2], tiles: true, colorSpace: "linear", seed: 7101, role: "plain-weave normal map, 8 threads each way (40 per cm)" },
  "cloth-rough": { file: "textures/cloth-rough.png", width: 256, height: 256, channels: 1, coverCm: [0.2, 0.2], tiles: true, colorSpace: "linear", seed: 7102, role: "roughness multiplier of the weave (0.9 to 1.0 of the material's value)" },
  "cloth-tone": { file: "textures/cloth-tone.png", width: 256, height: 256, channels: 1, coverCm: [1.6, 1.6], tiles: true, colorSpace: "srgb", seed: 7103, role: "faint colour variation: thread by thread and in larger patches" },
  "paper-grain": { file: "textures/paper-grain.png", width: 256, height: 256, channels: 1, coverCm: [2, 2], tiles: true, colorSpace: "srgb", seed: 7104, role: "paper fibres and mottling" },
  "edge-lines": { file: "textures/edge-lines.png", width: 64, height: 256, channels: 1, coverCm: [1, 0.5], tiles: true, colorSpace: "srgb", seed: 7105, role: "the edges of the sheets: 20 fine lines per tile, 40 per cm" },
  "corner-wear": { file: "textures/corner-wear.png", width: 256, height: 384, channels: 1, coverCm: [14.6, 22.7], tiles: false, colorSpace: "linear", seed: 7106, role: "alpha of the corner and edge wear on a board" },
  dust: { file: "textures/dust.png", width: 512, height: 768, channels: 1, coverCm: [14.6, 22.7], tiles: false, colorSpace: "linear", seed: 7107, role: "alpha of a faint dust film with a few specks" },
};

export const TEXTURE_NAMES = Object.keys(TEXTURES) as TextureName[];

/** All seven as RGBA8 with a full mip chain (x 4/3) must stay under this. Measured: about 3.9 MB. */
export const TEXTURE_BUDGET_BYTES = 8 * 1024 * 1024;

/** The manifest written next to the pictures: the SHA-256 of every picture's pixels (not of the PNG file, whose bytes depend on the encoder). */
export const TEXTURE_MANIFEST_FILE = "textures/manifest.json";
/** Bump when the generator's output is meant to change; the manifest carries it. */
export const TEXTURE_GENERATOR_VERSION = 1;

/** the bytes the GPU holds for a texture: RGBA8 and a full mip chain */
export const gpuBytes = (s: TextureSpec): number => Math.round(s.width * s.height * 4 * (4 / 3));