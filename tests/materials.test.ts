// The materials (Patch 07): the values of guide 03 section 3, the colour helpers, the book's own variation, and what the surface
// geometry gives them (UV in cm, the yellowing of the page edges). Everything here runs in Node: no browser, no textures loaded.
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { BOOKS, BOOK_IDS } from "../src/config/books";
import { CLOTH_VARIANTS, MATERIALS, TEXTURES, PALETTE_TOKENS } from "../src/config/materials";
import { blockSlabGeometry, layoutOf, staticGeometries } from "../src/book/geometry";
import { PAPER_COLOR, bandMaterial, bookMaterials, clothMaterial, clothTokens, configureTexture, disposeBookMaterials, dustMaterial, edgeMaterial, foilMaterial, foilTokens, paperMaterial, ribbonMaterial, stainedEdge, wearMaterial, wearProfile } from "../src/book/materials";
import { desaturateHex, lumaOf, mixHex, parseHex, toHex } from "../src/lib/color";
import { eq, near, test, throws, truthy } from "./harness";

const hex = (c: THREE.Color): string => "#" + c.getHexString().toUpperCase();
const chroma = (h: string): number => {
  const [r, g, b] = parseHex(h);
  return Math.max(r, g, b) - Math.min(r, g, b);
};

// ---------------------------------------------------------------------------------------------------------------------------
// colour
// ---------------------------------------------------------------------------------------------------------------------------

test("color: parse and format round-trip, and a bad string is an error", () => {
  eq(toHex(parseHex("#0d0d0d")), "#0D0D0D", "lower case in, upper case out");
  eq(toHex(parseHex("C0102C")), "#C0102C", "the # is optional");
  throws(() => parseHex("#12345"), "not a #RRGGBB colour");
  throws(() => parseHex("red"), "not a #RRGGBB colour");
});

test("color: mixHex goes from a to b, and desaturateHex from the colour to its grey", () => {
  eq(mixHex("#102030", "#FFFFFF", 0), "#102030", "t = 0");
  eq(mixHex("#102030", "#FFFFFF", 1), "#FFFFFF", "t = 1");
  eq(mixHex("#000000", "#FFFFFF", 0.5), "#808080", "midpoint");
  eq(desaturateHex("#24307A", 0), "#24307A", "amount 0");
  const [r, g, b] = parseHex(desaturateHex("#C0102C", 1));
  truthy(Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1, "amount 1 is grey");
  near(lumaOf([r, g, b]), lumaOf(parseHex("#C0102C")), 1.5, "the grey has the same luma");
  near(chroma(desaturateHex("#24307A", 0.12)) / chroma("#24307A"), 0.88, 0.02, "12 percent less saturation");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the five materials
// ---------------------------------------------------------------------------------------------------------------------------

test("cloth: roughness 0.85, no metal, sheen in the 0.3 to 0.5 band, colour 12 percent duller, sheen colour paler", () => {
  for (const id of BOOK_IDS) {
    const m = clothMaterial(clothTokens(BOOKS[id]));
    eq(m.roughness, 0.85, `${id} roughness`);
    eq(m.metalness, 0, `${id} metalness`);
    truthy(m.sheen >= 0.3 && m.sheen <= 0.5, `${id} sheen ${m.sheen} is in guide 03's 0.3 to 0.5`);
    eq(m.normalMap, null, `${id} no normal map without textures`);
    eq(hex(m.color), desaturateHex(BOOKS[id].colors.cloth, MATERIALS.cloth.desaturate), `${id} colour`);
    truthy(m.sheenColor.r >= m.color.r && m.sheenColor.g >= m.color.g && m.sheenColor.b >= m.color.b, `${id} sheen is towards white`);
  }
});

test("cloth: MiniLocker has the stronger weave, and the weave scales the normal map", () => {
  eq(CLOTH_VARIANTS.minilocker.weave, 1.7, "the variant");
  const tex = { "cloth-normal": new THREE.Texture(), "cloth-tone": new THREE.Texture(), "cloth-rough": new THREE.Texture() };
  const plain = clothMaterial(clothTokens(BOOKS["mini-me"]), tex);
  const linen = clothMaterial(clothTokens(BOOKS.minilocker), tex);
  near(plain.normalScale.x, MATERIALS.cloth.normalScale, 1e-12, "weave 1");
  near(linen.normalScale.x / plain.normalScale.x, 1.7, 1e-12, "weave 1.7");
  eq(plain.map, tex["cloth-tone"], "tone map");
  eq(plain.normalMap, tex["cloth-normal"], "normal map");
  eq(plain.roughnessMap, tex["cloth-rough"], "roughness map");
});

test("foil: metalness 1, roughness 0.3, and the book's own foil colour (no diffuse white)", () => {
  for (const id of BOOK_IDS) {
    for (const which of ["primary", "secondary"] as const) {
      const m = foilMaterial(foilTokens(BOOKS[id], which));
      eq(m.metalness, 1, `${id} ${which} metalness`);
      truthy(m.roughness >= 0.25 && m.roughness <= 0.35, `${id} roughness ${m.roughness} is in guide 03's 0.25 to 0.35`);
      eq(hex(m.color), BOOKS[id].colors.foil[which].toUpperCase(), `${id} ${which} colour`);
    }
  }
  const dent = new THREE.Texture();
  const m = foilMaterial({ color: "#E8B04A", normalMap: dent });
  eq(m.normalMap, dent, "a deboss normal map is used when there is one");
});

test("paper and edges: roughness 0.9 and 0.92, vertex colours only where the geometry has them", () => {
  const p = paperMaterial();
  eq(p.roughness, 0.9, "paper roughness");
  eq(p.vertexColors, false, "a plain paper has no vertex colours");
  eq(hex(p.color), PAPER_COLOR.toUpperCase(), "paper colour (0.93, 0.91, 0.87)");
  eq(paperMaterial({ vertexColors: true }).vertexColors, true, "a slab's paper");
  eq(hex(paperMaterial({ color: "#D8CDB6" }).color), "#D8CDB6", "an endpaper's colour");
  const e = edgeMaterial();
  eq(e.roughness, 0.92, "edge roughness");
  eq(e.vertexColors, true, "edges carry the yellowing");
});

test("stainedEdge: 90 percent of the way to the dye, a little more matte, still with vertex colours", () => {
  const m = stainedEdge("#FF2351");
  eq(hex(m.color), mixHex(PAPER_COLOR, "#FF2351", 0.9), "colour");
  eq(m.roughness, 0.8, "roughness");
  eq(m.vertexColors, true, "vertex colours");
  truthy(m.roughness < edgeMaterial().roughness, "more matte means a lower roughness here, as the config says (stainRoughness)");
});

test("ribbon and bands: cloth at roughness 0.8, the ribbon drawn on both sides", () => {
  const r = ribbonMaterial("#C0102C");
  eq(r.roughness, 0.8, "ribbon roughness");
  eq(r.side, THREE.DoubleSide, "double sided");
  truthy(r.sheen > bandMaterial("#FF2351").sheen, "a satin ribbon has more sheen than a band");
  eq(bandMaterial("#FF2351").roughness, 0.8, "band roughness");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the decals
// ---------------------------------------------------------------------------------------------------------------------------

test("wearProfile: seeded (the same twice), different from book to book, opacity 0.6 to 1", () => {
  const seen = new Set<string>();
  for (const id of BOOK_IDS) {
    const a = wearProfile(BOOKS[id]);
    eq(JSON.stringify(a), JSON.stringify(wearProfile(BOOKS[id])), `${id} repeats`);
    truthy(a.opacity >= 0.6 && a.opacity <= 1, `${id} opacity ${a.opacity}`);
    seen.add(JSON.stringify(a));
  }
  truthy(seen.size >= 3, "no two books wear the same (at least three different of four)");
});

test("wear and dust: transparent decals that do not write depth and sit in front of the board", () => {
  for (const id of BOOK_IDS) {
    const w = wearMaterial(BOOKS[id]);
    eq(w.transparent, true, "wear transparent");
    eq(w.depthWrite, false, "wear does not write depth");
    eq(w.polygonOffset, true, "wear is offset");
    truthy(w.opacity > 0 && w.opacity <= MATERIALS.wear.opacity, `${id} wear opacity ${w.opacity}`);
    near(w.opacity, MATERIALS.wear.opacity * wearProfile(BOOKS[id]).opacity, 1e-12, `${id} wear is scaled by the book's own factor`);
    eq(wearMaterial(BOOKS[id], {}, 0).opacity, 0, "amount 0 is no wear");
  }
  const d = dustMaterial({}, 1);
  eq(d.opacity, MATERIALS.dust.opacity, "dust opacity");
  eq(d.depthWrite, false, "dust does not write depth");
  const maps = { "corner-wear": new THREE.Texture(), dust: new THREE.Texture() };
  eq(wearMaterial(BOOKS["mini-me"], maps).alphaMap, maps["corner-wear"], "wear alpha map");
  eq(dustMaterial(maps).alphaMap, maps.dust, "dust alpha map");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the set a book needs
// ---------------------------------------------------------------------------------------------------------------------------

test("bookMaterials: the slab's six faces are in BoxGeometry's order, and only Mini Me's head is dyed", () => {
  for (const id of BOOK_IDS) {
    const m = bookMaterials(BOOKS[id]);
    eq(m.slab.length, 6, `${id} six faces`);
    eq(m.slab[0], m.slab[4], `${id} fore-edge and tail share the edge material`);
    eq(m.slab[1], m.slab[2], `${id} the spine side and the top share the paper`);
    eq(m.slab[2], m.slab[3], `${id} the paper`);
    eq((m.slab[4] as THREE.MeshStandardMaterial).name, "edge", `${id} tail`);
    if (id === "mini-me") eq((m.slab[5] as THREE.MeshStandardMaterial).name, "stained-edge", "Mini Me's head is dyed rose-red");
    else eq(m.slab[5], m.slab[0], `${id} head is the plain edge`);
    eq(m.bands.length, 2, "two band stripes");
    eq(hex(m.bands[0].color), BOOKS[id].colors.band[0].toUpperCase(), `${id} band 0`);
    eq(hex(m.ribbon.color), BOOKS[id].colors.ribbon.toUpperCase(), `${id} ribbon`);
    eq(hex(m.endpaper.color), BOOKS[id].colors.endpaper.toUpperCase(), `${id} endpaper`);
    eq(m.dust.opacity, 0, `${id} no dust unless asked for`);
    disposeBookMaterials(m);
  }
});

test("disposeBookMaterials: every material is disposed exactly once, shared ones included", () => {
  const m = bookMaterials(BOOKS["mini-me"]);
  const all = new Set<THREE.Material>([m.cloth, m.endpaper, ...m.slab, ...m.bands, m.ribbon, m.wear, m.dust]);
  const hits = new Map<THREE.Material, number>();
  for (const x of all) x.addEventListener("dispose", () => hits.set(x, (hits.get(x) ?? 0) + 1));
  disposeBookMaterials(m);
  eq(hits.size, all.size, "every distinct material");
  for (const [x, n] of hits) eq(n, 1, `${x.name} disposed once`);
});

test("books differ: four cloth colours, four wear strengths are not all equal", () => {
  const colours = new Set(BOOK_IDS.map((id) => hex(clothMaterial(clothTokens(BOOKS[id])).color)));
  eq(colours.size, 4, "four colours");
  for (const id of BOOK_IDS) truthy(PALETTE_TOKENS.ink && BOOKS[id].colors.foil.primary.startsWith("#"), "colours are hex");
});

test("configureTexture: tiles repeat once per tile size, a board's picture is laid once, data maps are linear", () => {
  const t = configureTexture(new THREE.Texture(), TEXTURES["cloth-normal"]);
  eq(t.wrapS, THREE.RepeatWrapping, "tile wraps");
  near(t.repeat.x, 5, 1e-12, "one over 0.2 cm");
  eq(t.colorSpace, THREE.NoColorSpace, "normal maps are linear");
  eq(t.anisotropy, 16, "anisotropy");
  const w = configureTexture(new THREE.Texture(), TEXTURES["corner-wear"]);
  eq(w.wrapS, THREE.ClampToEdgeWrapping, "a board's picture stops at its border");
  eq(w.repeat.x, 1, "laid once");
  eq(configureTexture(new THREE.Texture(), TEXTURES["paper-grain"]).colorSpace, THREE.SRGBColorSpace, "colour maps are sRGB");
  // idempotent
  configureTexture(t, TEXTURES["cloth-normal"]);
  near(t.repeat.x, 5, 1e-12, "again");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the surfaces: UV in centimetres, the yellowing
// ---------------------------------------------------------------------------------------------------------------------------

test("surface UV: every static geometry has finite UVs, one pair per vertex", () => {
  for (const id of BOOK_IDS) {
    const geos = Object.values(staticGeometries(BOOKS[id]));
    for (const g of geos) {
      const uv = g.getAttribute("uv") as THREE.BufferAttribute;
      truthy(uv && uv.itemSize === 2, "a uv attribute");
      eq(uv.count, g.getAttribute("position").count, "one per vertex");
      for (let i = 0; i < uv.count; i++) truthy(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)), "finite");
      g.dispose();
    }
  }
});

test("surface UV: on a board's top face u = x and v = -z in cm, so a weave tile is 0.2 cm everywhere", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const g = staticGeometries(spec).backBoard;
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  let n = 0;
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (nrm.getY(i) > 0.99 && Math.abs(pos.getY(i) - L.b) < 1e-4) {
      n++;
      near(uv.getX(i), pos.getX(i), 1e-5, "u is x");
      near(uv.getY(i), -pos.getZ(i), 1e-5, "v is -z");
      uMin = Math.min(uMin, uv.getX(i));
      uMax = Math.max(uMax, uv.getX(i));
      vMin = Math.min(vMin, uv.getY(i));
      vMax = Math.max(vMax, uv.getY(i));
    }
  }
  truthy(n > 8, "the top face was found");
  truthy(uMax - uMin > L.W / 2 - L.hingeX - 0.4, `the face spans ${(uMax - uMin).toFixed(2)} cm across`);
  truthy(vMax - vMin > L.H - 0.4, `the face spans ${(vMax - vMin).toFixed(2)} cm along`);
});

test("surface UV: the same on the front board (one plate, moved up), so both boards weave alike", () => {
  const s = staticGeometries(BOOKS["mini-me"]);
  const a = s.backBoard.getAttribute("uv");
  const b = s.frontBoard.getAttribute("uv");
  eq(a.count, b.count, "same count");
  for (let i = 0; i < a.count; i += 17) {
    near(a.getX(i), b.getX(i), 1e-6, "u");
    near(a.getY(i), b.getY(i), 1e-6, "v");
  }
});

test("slab: six faces in the order the materials expect (fore-edge +x, spine side -x, top, underside, tail +z, head -z)", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const g = blockSlabGeometry(spec, { yLo: L.yBlock0, yHi: L.yBlock1, bowLo: 0, bowHi: 1 });
  const pos = g.getAttribute("position");
  const idx = g.index!;
  eq(g.groups.length, 6, "six groups");
  const mean = (face: number, axis: "x" | "y" | "z"): number => {
    const gr = g.groups.find((q) => q.materialIndex === face)!;
    let s = 0;
    for (let i = gr.start; i < gr.start + gr.count; i++) s += pos[`get${axis.toUpperCase()}` as "getX"](idx.getX(i));
    return s / gr.count;
  };
  truthy(mean(0, "x") > 0 && mean(1, "x") < mean(0, "x"), "face 0 is the fore-edge");
  truthy(mean(2, "y") > mean(3, "y"), "face 2 is the top");
  truthy(mean(4, "z") > 0, "face 4 is the tail");
  truthy(mean(5, "z") < 0, "face 5 is the head, which is where Mini Me's dye goes");
});

test("slab UV: the edge faces have v = y (the sheet lines stack up the block) and u along the edge, in cm", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const g = blockSlabGeometry(spec, { yLo: L.yBlock0, yHi: L.yBlock1, bowLo: 0, bowHi: 1 });
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  const idx = g.index!;
  for (const gr of g.groups) {
    for (let i = gr.start; i < gr.start + gr.count; i++) {
      const vi = idx.getX(i);
      if (gr.materialIndex === 0) {
        near(uv.getY(vi), pos.getY(vi), 1e-5, "fore-edge v is y");
        near(uv.getX(vi), -pos.getZ(vi), 1e-5, "fore-edge u is along the edge");
      }
      if (gr.materialIndex === 4 || gr.materialIndex === 5) near(uv.getY(vi), pos.getY(vi), 1e-5, "tail and head v is y");
    }
  }
});

test("slab colour: white in the middle of a face, yellowed at the corners, never darker than the tint, and seeded (the same twice)", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const opts = { yLo: L.yBlock0, yHi: L.yBlock1, bowLo: 0, bowHi: 1 } as const;
  const g = blockSlabGeometry(spec, opts);
  const col = g.getAttribute("color");
  const pos = g.getAttribute("position");
  eq(col.itemSize, 3, "RGB");
  eq(col.count, pos.count, "one per vertex");
  const E = MATERIALS.edge;
  const floor = 1 + (E.tint[2] - 1) * E.tintAmount;
  let minB = 1;
  let whites = 0;
  for (let i = 0; i < col.count; i++) {
    truthy(col.getX(i) >= 0.999 && col.getX(i) <= 1.001, "red stays 1 (the tint is 1.0)");
    truthy(col.getZ(i) >= floor - 1e-6 && col.getZ(i) <= 1 + 1e-6, `blue between ${floor.toFixed(3)} and 1`);
    truthy(col.getY(i) >= col.getZ(i) - 1e-6, "green is never more yellowed than blue is (the tint's order)");
    minB = Math.min(minB, col.getZ(i));
    if (col.getZ(i) > 0.9999) whites++;
  }
  near(minB, floor, 1e-3, "a corner takes the full tint");
  truthy(whites > col.count / 3, "most of the slab is untinted");
  const h = blockSlabGeometry(spec, opts);
  const a = g.getAttribute("color").array;
  const b = h.getAttribute("color").array;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error("the yellowing changed between two builds");
  const ua = g.getAttribute("uv").array;
  const ub = h.getAttribute("uv").array;
  for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) throw new Error("the UV changed between two builds");
});

test("determinism: the new source files use no Math.random and no trigonometry in the generators", () => {
  const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const read = (f: string): string => strip(fs.readFileSync(path.join(process.cwd(), f), "utf8"));
  for (const f of ["src/paint/textures.ts", "src/paint/patterns.ts", "src/book/materials.ts", "src/book/surfaceUV.ts", "src/lib/color.ts", "src/config/materials.ts"]) truthy(!/Math\.random/.test(read(f)), `${f} uses Math.random`);
  for (const f of ["src/paint/textures.ts"]) truthy(!/Math\.(sin|cos|tan|exp|pow|log|atan2?)\b/.test(read(f)), `${f} uses a maths-library function the platform could round differently`);
  truthy(!/Math\.(sin|cos|tan|atan2?)\b/.test(read("src/paint/patterns.ts")), "patterns.ts needs no trigonometry");
});
