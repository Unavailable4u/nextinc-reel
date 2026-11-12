// THE BOOK'S MATERIALS (Patch 07). Plain functions: tokens (and the loaded textures, when there are any) in, a three.js material out.
// No React, no loading, no randomness (a book's own variation comes from its seeds), so Node can build and test every one.
// Values are guide 03 section 3 and live in `config/materials.ts`.
//
//   clothMaterial(tokens)   woven bookcloth: rough, with sheen, a weave normal map seen only close up
//   foilMaterial(tokens)    stamped foil: metal, reflects the plate probe, so it flares when the angle is right
//   paperMaterial()         the sheets and the endpapers: warm white, rough, a faint grain
//   edgeMaterial()          the page block's fore-edge, head and tail: fine lines of sheets, yellowing at the corners
//   stainedEdge(color)      the same, dyed (Mini Me's rose-red top edge)
//
// WITHOUT TEXTURES every function still returns a correct material (the scalar values, no maps): the tests use that, and so does
// `<Book textured={false}>`, the plain look for comparing a benchmark.
//
// LIGHT: nothing here lights itself. Foil and cloth take the scene's lights and its `environment` (the plate probe,
// `light/ProbeEnvironment`); a book without `<ProbeEnvironment />` in the scene shows foil as dark metal.

import * as THREE from "three";
import type { BookSpec } from "../config/books";
import { CLOTH_VARIANTS, MATERIALS, type TextureName, type TextureSpec } from "../config/materials";
import { desaturateHex, mixHex } from "../lib/color";
import { prng } from "../lib/prng";

/** The loaded pictures, by name. Any may be missing (then the map is simply not used). */
export type TextureSet = Partial<Record<TextureName, THREE.Texture>>;

/** The default paper: (0.93, 0.91, 0.87), guide 03 section 3. */
export const PAPER_COLOR = "#EDE8DE";

/**
 * Sets a loaded picture up the way its `TextureSpec` says: colour space, wrapping, and a repeat of one over the size its tile covers
 * (the geometry's UVs are in cm, see `surfaceUV.ts`), mip maps and 16x anisotropy (the renderer clamps it to what the GPU has). Idempotent.
 */
export function configureTexture(tex: THREE.Texture, spec: TextureSpec): THREE.Texture {
  tex.colorSpace = spec.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (spec.tiles) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / spec.coverCm[0], 1 / spec.coverCm[1]);
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
  }
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------------------------------------------------------

export interface ClothTokens {
  /** the cloth's colour as the book defines it (it is desaturated a little here, guide 03 section 9) */
  color: string;
  /** multiplies the weave's normal scale (default 1) */
  weave?: number;
  /** 0 to 1 (default 0.4; guide 03 asks for 0.3 to 0.5) */
  sheen?: number;
}

export interface FoilTokens {
  /** the foil's colour: its reflectance, since foil is metal */
  color: string;
  /** a normal map for the deboss; Patch 08 makes one from each foil mask (guide 03: a 0.2 mm step) */
  normalMap?: THREE.Texture | null;
}

/** A book's cloth tokens: its colour from `colors.cloth` and its variant (MiniLocker's stronger weave) from `CLOTH_VARIANTS`. */
export const clothTokens = (spec: BookSpec): ClothTokens => ({ color: spec.colors.cloth, ...CLOTH_VARIANTS[spec.id] });

/** A book's foil tokens: the mark's colour (`primary`) or the title's (`secondary`). */
export const foilTokens = (spec: BookSpec, which: "primary" | "secondary" = "primary"): FoilTokens => ({ color: spec.colors.foil[which] });

// ---------------------------------------------------------------------------------------------------------------------------
// the five materials of the brief
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Bookcloth. Roughness 0.85, no metal, a sheen in the cloth's own colour (towards white) that catches the lamp at grazing angles,
 * a faint tone map, a weave normal map and a weave roughness map. The colour is taken 12 percent towards its grey first.
 */
export function clothMaterial(tokens: ClothTokens, tex: TextureSet = {}): THREE.MeshPhysicalMaterial {
  const C = MATERIALS.cloth;
  const color = desaturateHex(tokens.color, C.desaturate);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: C.roughness,
    metalness: C.metalness,
    sheen: tokens.sheen ?? 0.4,
    sheenRoughness: C.sheenRoughness,
    sheenColor: new THREE.Color(mixHex(color, "#FFFFFF", C.sheenWhiten)),
  });
  m.name = "cloth";
  if (tex["cloth-tone"]) m.map = tex["cloth-tone"];
  if (tex["cloth-normal"]) {
    m.normalMap = tex["cloth-normal"];
    const s = C.normalScale * (tokens.weave ?? 1);
    m.normalScale = new THREE.Vector2(s, s);
  }
  if (tex["cloth-rough"]) m.roughnessMap = tex["cloth-rough"];
  return m;
}

/**
 * Foil stamping: metalness 1 and roughness 0.3. It has no diffuse colour at all: what it shows is the environment (the plate probe)
 * tinted by `color`, so a flat foil colour never appears; it flares only when its mirror direction meets the lamp or a strip.
 */
export function foilMaterial(tokens: FoilTokens): THREE.MeshStandardMaterial {
  const F = MATERIALS.foil;
  const m = new THREE.MeshStandardMaterial({ color: tokens.color, metalness: F.metalness, roughness: F.roughness });
  m.name = "foil";
  if (tokens.normalMap) {
    m.normalMap = tokens.normalMap;
    m.normalScale = new THREE.Vector2(1, 1);
  }
  return m;
}

export interface PaperOptions {
  /** default `PAPER_COLOR` */
  color?: string;
  /** true for a page-block slab (its geometry carries the yellowing as a colour attribute); false for any other mesh (a missing colour attribute reads as black) */
  vertexColors?: boolean;
}

/** Paper: roughness 0.9, a faint grain. `paperMaterial({ color })` is the endpaper's colour for a pastedown. */
export function paperMaterial(opts: PaperOptions = {}, tex: TextureSet = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: opts.color ?? PAPER_COLOR, roughness: MATERIALS.paper.roughness, metalness: MATERIALS.paper.metalness, vertexColors: opts.vertexColors ?? false });
  m.name = "paper";
  if (tex["paper-grain"]) m.map = tex["paper-grain"];
  return m;
}

/** The page block's edges: paper with the fine lines of the sheets, yellowed near the corners by the slab's vertex colours. */
export function edgeMaterial(opts: { color?: string } = {}, tex: TextureSet = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: opts.color ?? PAPER_COLOR, roughness: MATERIALS.edge.roughness, metalness: MATERIALS.edge.metalness, vertexColors: true });
  m.name = "edge";
  if (tex["edge-lines"]) m.map = tex["edge-lines"];
  return m;
}

/** A dyed edge: the paper colour taken 90 percent of the way to the dye, a little more matte; the lines of the sheets still show. */
export function stainedEdge(color: string, tex: TextureSet = {}): THREE.MeshStandardMaterial {
  const E = MATERIALS.edge;
  const m = new THREE.MeshStandardMaterial({ color: mixHex(PAPER_COLOR, color, E.stainMix), roughness: E.stainRoughness, metalness: 0, vertexColors: true });
  m.name = "stained-edge";
  if (tex["edge-lines"]) m.map = tex["edge-lines"];
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------------
// ribbon, bands, decals
// ---------------------------------------------------------------------------------------------------------------------------

/** The ribbon marker: a satin cloth, roughness 0.8, drawn on both sides. */
export function ribbonMaterial(color: string): THREE.MeshPhysicalMaterial {
  const R = MATERIALS.ribbon;
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: R.roughness, metalness: 0, sheen: R.sheen, sheenRoughness: R.sheenRoughness, sheenColor: new THREE.Color(mixHex(color, "#FFFFFF", 0.5)), side: THREE.DoubleSide });
  m.name = "ribbon";
  return m;
}

/** One stripe of the head or tail band: cloth, roughness 0.8, a little sheen. */
export function bandMaterial(color: string): THREE.MeshPhysicalMaterial {
  const B = MATERIALS.band;
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: B.roughness, metalness: 0, sheen: B.sheen, sheenRoughness: B.sheenRoughness, sheenColor: new THREE.Color(mixHex(color, "#FFFFFF", 0.5)) });
  m.name = "band";
  return m;
}

/** What differs from book to book in the wear on its cover (guide 03 section 6): which way the picture faces and how strong it is. Seeded by the book. */
export function wearProfile(spec: BookSpec): { flipX: boolean; flipY: boolean; opacity: number } {
  const r = prng(spec.seeds.block + 77);
  const flipX = r() < 0.5;
  const flipY = r() < 0.5;
  return { flipX, flipY, opacity: 0.6 + 0.4 * r() };
}

const decal = (m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial => {
  m.transparent = true;
  m.depthWrite = false;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -1;
  return m;
};

/**
 * Corner wear: a lighter, rougher patch (the cloth towards pale fibre) through the wear alpha map. `amount` 0 to 1 scales it (default 1);
 * the book's own seeded factor scales it again.
 */
export function wearMaterial(spec: BookSpec, tex: TextureSet = {}, amount = 1): THREE.MeshStandardMaterial {
  const W = MATERIALS.wear;
  const m = decal(new THREE.MeshStandardMaterial({ color: mixHex(desaturateHex(spec.colors.cloth, MATERIALS.cloth.desaturate), W.towards, W.mix), roughness: W.roughness, metalness: 0, opacity: W.opacity * wearProfile(spec).opacity * amount }));
  m.name = "wear";
  if (tex["corner-wear"]) m.alphaMap = tex["corner-wear"];
  return m;
}

/** The dust film for the top book's top surface. `amount` 0 to 1 scales its opacity. */
export function dustMaterial(tex: TextureSet = {}, amount = 1): THREE.MeshStandardMaterial {
  const D = MATERIALS.dust;
  const m = decal(new THREE.MeshStandardMaterial({ color: D.color, roughness: D.roughness, metalness: 0, opacity: D.opacity * amount }));
  m.name = "dust";
  if (tex.dust) m.alphaMap = tex.dust;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------------
// everything a book needs
// ---------------------------------------------------------------------------------------------------------------------------

export interface BookMaterials {
  cloth: THREE.MeshPhysicalMaterial;
  /** the pasted-down endpapers (a flat paper in the book's endpaper colour; Patch 09 paints the real endpaper page over them) */
  endpaper: THREE.MeshStandardMaterial;
  /** for a page-block slab (a BoxGeometry), in the order of its groups: +x fore-edge, -x spine side, +y, -y, +z tail, -z head */
  slab: THREE.Material[];
  /** the two stripes of the bands */
  bands: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial];
  ribbon: THREE.MeshPhysicalMaterial;
  wear: THREE.MeshStandardMaterial;
  dust: THREE.MeshStandardMaterial;
}

/**
 * All of one book's materials. `wear` and `dust` are the decals' strengths, 0 to 1. Build once per book (a `useMemo`) and call
 * `disposeBookMaterials` when it goes; the textures are shared and are never disposed here.
 */
export function bookMaterials(spec: BookSpec, tex: TextureSet = {}, opts: { wear?: number; dust?: number } = {}): BookMaterials {
  const edge = edgeMaterial({}, tex);
  const head = spec.colors.headStain ? stainedEdge(spec.colors.headStain, tex) : edge;
  const slabPaper = paperMaterial({ vertexColors: true }, tex);
  return {
    cloth: clothMaterial(clothTokens(spec), tex),
    endpaper: paperMaterial({ color: spec.colors.endpaper }, tex),
    slab: [edge, slabPaper, slabPaper, slabPaper, edge, head],
    bands: [bandMaterial(spec.colors.band[0]), bandMaterial(spec.colors.band[1])],
    ribbon: ribbonMaterial(spec.colors.ribbon),
    wear: wearMaterial(spec, tex, opts.wear ?? 1),
    dust: dustMaterial(tex, opts.dust ?? 0),
  };
}

/** Disposes every material of a set once (the slab shares some between faces). */
export function disposeBookMaterials(m: BookMaterials): void {
  const all = new Set<THREE.Material>([m.cloth, m.endpaper, ...m.slab, ...m.bands, m.ribbon, m.wear, m.dust]);
  all.forEach((x) => x.dispose());
}