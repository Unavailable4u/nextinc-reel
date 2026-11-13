import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { BOOKS, type BookId } from "../config/books";
import { MATERIALS } from "../config/materials";
import { SHEET, type SheetVariation } from "../config/sheets";
import { blockBackX, bowAmplitude, layoutOf, splitOf } from "./geometry";
import { blobAlphaBytes, pageFaceGeometry, sheetGridGeometry, writeSheetMesh } from "./sheetGeometry";
import { whiteTexture } from "./pageTextures";
import { pageFaceMaterial, makeSheetUniforms, sheetDepthMaterial, sheetDistanceMaterial, sheetMaterial, sheetWireMaterial } from "./sheetShader";
import { SINGLE, sheetBlob, sheetLayout, sheetMesh, sheetVariation, shapeOf, type SheetPlacement } from "./sheetShape";
import { applySheetUniforms, sheetUniformValues } from "./sheetUniforms";

export type SheetProps = {
  id: BookId;
  /** the numbers given to the <Book> this sheet turns in: the cover's angle (0 to 1) and the sheets turned (it sets where the two stacks meet) */
  coverAngle: number;
  turned: number;
  /** the `turned` the sheet's turn started from; it fixes the leaf's width (default `turned`) */
  baseTurned?: number;
  /** the turn's eased progress, 0 to 1 (`turnProgress`), and the seconds since it reached 1 (`landSeconds`) */
  progress: number;
  landSec?: number;
  /** where the sheet stands in its group (`riffleSheets` gives it); a single turn is alone */
  place?: SheetPlacement;
  /** the sheet's number in the book: it seeds the sheet's own small differences (`sheetVariation`) */
  index?: number;
  /** replaces the seeded variation (`NO_VARIATION` to see the config's numbers exactly) */
  variation?: SheetVariation;
  /** the right page (the front of the leaf, as it is painted) and the left page (its back); a white sheet when missing */
  front?: THREE.Texture | null;
  back?: THREE.Texture | null;
  /** draw the CPU twin's vertices instead of the shader's own (`DevPageTurn` compares them) */
  cpu?: boolean;
  /** the mesh as a cyan wire over the sheet */
  wire?: boolean;
  /** the soft shadow on the stack under the sheet */
  blob?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

let blobTex: THREE.DataTexture | null = null;
/** The blob's soft ellipse as a texture whose green channel is the alpha (what `alphaMap` reads). Made once. */
function blobTexture(): THREE.Texture {
  if (!blobTex) {
    const size = 64;
    const a = blobAlphaBytes(size);
    const rgba = new Uint8Array(size * size * 4);
    for (let i = 0; i < a.length; i++) rgba.set([a[i], a[i], a[i], 255], i * 4);
    blobTex = new THREE.DataTexture(rgba, size, size, THREE.RGBAFormat);
    blobTex.colorSpace = THREE.NoColorSpace;
    blobTex.magFilter = THREE.LinearFilter;
    blobTex.minFilter = THREE.LinearFilter;
    blobTex.generateMipmaps = false;
    blobTex.needsUpdate = true;
  }
  return blobTex;
}

/**
 * One loose sheet of paper turning over the spine (guide 06). Put it inside the <Book> it belongs to (it is drawn in the book's frame, like
 * the book's own children). Its shape is a pure function of `progress` and `landSec` (`sheetShape.ts`), evaluated by the vertex shader of
 * `sheetShader.ts` on a grid of 24 x 36 segments with two layers 0.012 cm apart; nothing here reads a frame. The paper never stretches,
 * the outer edge arrives late, a corner lifts, and after landing the free edge rebounds. It glows when the lamp is behind it.
 *
 * A turn of the whole book is: the Book with `coverAngle` 1 and a `turned`, plus one <Sheet> per sheet in the air.
 */
export const Sheet: React.FC<SheetProps> = ({ id, coverAngle, turned, baseTurned, progress, landSec = 0, place = SINGLE, index = 0, variation, front, back, cpu = false, wire = false, blob = true, castShadow = true, receiveShadow = true }) => {
  const spec = BOOKS[id];
  const invalidate = useThree((s) => s.invalidate);
  const layout = useMemo(() => sheetLayout(spec, { coverAngle, turned }, baseTurned ?? turned), [spec, coverAngle, turned, baseTurned]);
  const shape = useMemo(() => shapeOf(layout, variation ?? sheetVariation(spec, index)), [layout, variation, spec, index]);

  const uniforms = useMemo(() => makeSheetUniforms(), []);
  const geo = useMemo(() => sheetGridGeometry(), []);
  const color = useMemo(() => sheetMaterial(uniforms, spec.colors.paper, MATERIALS.paper.roughness), [uniforms, spec]);
  const depth = useMemo(() => sheetDepthMaterial(uniforms), [uniforms]);
  const distance = useMemo(() => sheetDistanceMaterial(uniforms), [uniforms]);
  const wireMat = useMemo(() => sheetWireMaterial(uniforms), [uniforms]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(
    () => () => {
      color.dispose();
      depth.dispose();
      distance.dispose();
      wireMat.dispose();
    },
    [color, depth, distance, wireMat],
  );

  // the state goes into the uniforms on every render (a pure function of the props), then the frame is asked for
  const values = sheetUniformValues(progress, landSec, layout, shape, place);
  useLayoutEffect(() => {
    applySheetUniforms(uniforms, values, layout.W, cpu);
    uniforms.uMapF.value = front ?? whiteTexture();
    uniforms.uMapB.value = back ?? whiteTexture();
    if (cpu) writeSheetMesh(geo, sheetMesh(progress, landSec, layout, shape, place));
    invalidate();
  });

  const shadow = blob ? sheetBlob(progress, landSec, layout, shape, place) : null;
  const B = SHEET.blob;
  const zMid = layout.zHead + layout.H / 2;
  let blobNode: React.ReactNode = null;
  if (shadow && shadow.opacity > 0.002 && shadow.x1 - shadow.x0 > 0.01) {
    const along = shadow.x1 - shadow.x0;
    const across = layout.H + 2 * B.spreadPerCm * shadow.height;
    const mid = (shadow.x0 + shadow.x1) / 2;
    const right = shadow.side === "right";
    // on the right-hand face the plane lies flat in the book's frame; on the left-hand face it lies in the frame turned by the cover
    const origin: [number, number, number] = right ? [layout.pivotR[0], layout.pivotR[1] + B.liftCm, 0] : [layout.pivotL[0] + layout.upL[0] * B.liftCm, layout.pivotL[1] + layout.upL[1] * B.liftCm, 0];
    blobNode = (
      <group position={origin} rotation={[0, 0, right ? 0 : layout.restAngle]}>
        <mesh position={[mid, 0, zMid]} rotation={[right ? -Math.PI / 2 : Math.PI / 2, 0, 0]} scale={[along, across, 1]} renderOrder={2}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={B.color} alphaMap={blobTexture()} transparent opacity={shadow.opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      </group>
    );
  }

  return (
    <group name="sheet">
      <mesh geometry={geo} material={color} customDepthMaterial={depth} customDistanceMaterial={distance} castShadow={castShadow} receiveShadow={receiveShadow} frustumCulled={false} />
      {wire ? <mesh geometry={geo} material={wireMat} frustumCulled={false} renderOrder={10} /> : null}
      {blobNode}
    </group>
  );
};

export type PageFacesProps = {
  id: BookId;
  coverAngle: number;
  turned: number;
  /** the page on the right-hand stack's face (the next page to be turned over) and the page on the left-hand stack's face; paper when missing */
  right?: THREE.Texture | null;
  left?: THREE.Texture | null;
  receiveShadow?: boolean;
};

/**
 * The pages printed on the two stacks' faces (guide 06 section 3): when a sheet lifts, what is under it is the next page, not a hole. A plane
 * a hair above each slab's bowed face. The right-hand one is in the book's frame; the left-hand one rides on the cover. Put it inside the
 * <Book>, next to the sheets, with the same `coverAngle` and `turned`.
 */
export const PageFaces: React.FC<PageFacesProps> = ({ id, coverAngle, turned, right, left, receiveShadow = true }) => {
  const spec = BOOKS[id];
  const L = useMemo(() => layoutOf(spec), [spec]);
  const split = splitOf(spec, turned);
  const bowAmp = bowAmplitude(split);
  const leafW = L.xFore - blockBackX(L, split.yMid);
  const hasRight = split.rightThickness > 1e-4;
  const hasLeft = split.leftThickness > 1e-4;
  const rough = MATERIALS.paper.roughness;

  const rightGeo = useMemo(() => pageFaceGeometry(spec, { y: split.yMid, bowAmp, at: "top" }), [spec, split.yMid, bowAmp]);
  const leftGeo = useMemo(() => pageFaceGeometry(spec, { y: split.yMid, bowAmp, at: "bottom" }), [spec, split.yMid, bowAmp]);
  const rightMat = useMemo(() => pageFaceMaterial(right ?? whiteTexture(), spec.colors.paper, rough, "top", leafW), [right, spec, rough, leafW]);
  const leftMat = useMemo(() => pageFaceMaterial(left ?? whiteTexture(), spec.colors.paper, rough, "bottom", leafW), [left, spec, rough, leafW]);
  useEffect(() => () => rightGeo.dispose(), [rightGeo]);
  useEffect(() => () => leftGeo.dispose(), [leftGeo]);
  useEffect(() => () => rightMat.dispose(), [rightMat]);
  useEffect(() => () => leftMat.dispose(), [leftMat]);

  return (
    <group name="page-faces">
      {hasRight ? <mesh geometry={rightGeo} material={rightMat} receiveShadow={receiveShadow} /> : null}
      {hasLeft ? (
        <group position={[L.xp, L.ym, 0]} rotation={[0, 0, coverAngle * Math.PI]}>
          <group position={[-L.xp, -L.ym, 0]}>
            <mesh geometry={leftGeo} material={leftMat} receiveShadow={receiveShadow} />
          </group>
        </group>
      ) : null}
    </group>
  );
};