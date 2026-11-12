import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { BOOKS, type BookId, type BookPose, type BookSpec } from "../config/books";
import { MATERIALS } from "../config/materials";
import { ANCHOR_NAMES, anchorFrames, bandGeometries, bowAmplitude, layoutOf, poseEuler, splitOf, staticGeometries, type AnchorName } from "./geometry";
import { bookMaterials, disposeBookMaterials, wearProfile } from "./materials";
import { PageBlock } from "./PageBlock";
import { Ribbon } from "./Ribbon";
import { useBookTextures } from "./useBookTextures";

export type BookProps = {
  id: BookId;
  /** 0 closed to 1 fully open (flat). A spring may overshoot a little past 1. */
  coverAngle?: number;
  /** how many sheets have been turned to the left (0 to pages / 2). It sets the heights of the two halves of the page block. */
  turned?: number;
  /** where the book stands: position (cm) and yaw, pitch, roll in degrees, applied in the order Y, X, Z */
  pose?: BookPose;
  /** the ribbon tail's sideways swing (-1 to 1) and droop (0 to 1); a rig's secondary motion drives them */
  ribbonSwing?: number;
  ribbonSag?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** false: the plain look, scalar material values and no pictures (to compare a benchmark, or to see the colour alone). Default true. */
  textured?: boolean;
  /** strength of the corner wear on the front board, 0 to 1 (default 1); a book's own seeded factor scales it again. Needs `textured`. */
  wear?: number;
  /** strength of the dust film on the front board's outer face, 0 to 1 (default 0: only the top book of a pile wears it). Needs `textured`. */
  dust?: number;
  /**
   * Content for the texture slots, one per named anchor. Each is rendered inside that anchor's frame: local +Z is the outward normal,
   * +X reads left to right and +Y is up on the face as a reader holds it, so a plane mesh facing +Z lies on the surface with no rotation.
   * Patch 08 puts the cover painters in `frontBoard`, `backBoard` and `spine`; Patch 10 the sheets in `blockTop`.
   */
  slots?: Partial<Record<AnchorName, React.ReactNode>>;
  /** anything else, in the book's own frame */
  children?: React.ReactNode;
};

/** What a rig gets through `ref`: the named frames as live three.js objects (`getWorldPosition` etc.) and the book's numbers. */
export type BookHandle = {
  spec: BookSpec;
  anchors: Record<AnchorName, THREE.Object3D | null>;
};

const ANCHOR_OBJECT_NAME: Record<AnchorName, string> = {
  spine: "anchor-spine",
  frontBoard: "anchor-front-board",
  backBoard: "anchor-back-board",
  blockTop: "anchor-block-top",
  ribbon: "anchor-ribbon",
};

/**
 * A parametric hardcover (guide 04 section 1): two bevelled boards, a rounded spine with a hinge groove, a page block with a bow and an
 * uneven fore-edge, head and tail bands, a ribbon. Its surfaces are the materials of `materials.ts` (cloth, paper, edges, bands, ribbon,
 * and the wear and dust decals), built once per book from `spec.colors`. Pure props in, geometry out: nothing here reads a frame.
 *
 * Units are centimetres. The book's own frame has X from the spine to the fore-edge, Y up from the underside of the back board and Z from
 * head to tail; `pose` places that frame in the world. A closed Mini Me is 15.2 x 22.9 x 3.0 cm.
 */
export const Book = React.forwardRef<BookHandle, BookProps>(function Book(
  { id, coverAngle = 0, turned = 0, pose = { position: [0, 0, 0] }, ribbonSwing = 0, ribbonSag = 0.25, castShadow = true, receiveShadow = true, textured = true, wear = 1, dust = 0, slots = {}, children },
  ref,
) {
  const spec = BOOKS[id];
  const L = useMemo(() => layoutOf(spec), [spec]);
  const geo = useMemo(() => staticGeometries(spec), [spec]);
  useEffect(
    () => () => {
      Object.values(geo)
        .flat()
        .forEach((g) => g.dispose());
    },
    [geo],
  );
  const split = splitOf(spec, turned);
  const bowAmp = bowAmplitude(split);
  const bands = useMemo(() => bandGeometries(spec, turned), [spec, turned]);
  useEffect(
    () => () => {
      [...(bands.right ?? []), ...(bands.left ?? [])].forEach((g) => g.dispose());
    },
    [bands],
  );
  const frames = anchorFrames(spec, { coverAngle, turned }, { swing: ribbonSwing, sag: ribbonSag });

  const anchorRefs = useRef<Record<AnchorName, THREE.Object3D | null>>({ spine: null, frontBoard: null, backBoard: null, blockTop: null, ribbon: null });
  useImperativeHandle(ref, () => ({ spec, anchors: anchorRefs.current }), [spec]);

  // the materials: built once per book, disposed with it (the textures are shared and are not)
  const tex = useBookTextures(textured);
  const mats = useMemo(() => bookMaterials(spec, tex, { wear, dust }), [spec, tex, wear, dust]);
  useEffect(() => () => disposeBookMaterials(mats), [mats]);
  const wearFlip = useMemo(() => wearProfile(spec), [spec]);

  const mesh = (key: string, g: THREE.BufferGeometry, material: THREE.Material, shadows = true): React.ReactNode => <mesh key={key} geometry={g} material={material} castShadow={castShadow && shadows} receiveShadow={receiveShadow} />;
  // four stripes per half: head 0, head 1, tail 0, tail 1; the two band colours alternate
  const bandMeshes = (side: string, gs: THREE.BufferGeometry[] | null): React.ReactNode =>
    gs ? gs.map((g, i) => mesh(`band-${side}-${i}`, g, mats.bands[i % 2], false)) : null;
  // the decals lie on the front board's outer face, in its anchor frame (+Z out, +X right, +Y up the face): a plane a few steps above
  // the cloth, inside the bevel and the rounded corners. Wear is mirrored by the book's own seeds, so no two books wear the same.
  const decalW = L.W / 2 - L.hingeX - 2 * MATERIALS.decalInsetCm;
  const decalH = L.H - 2 * MATERIALS.decalInsetCm;
  const decal = (key: string, material: THREE.Material, lift: number, flip: boolean): React.ReactNode => (
    <mesh key={key} position={[0, 0, lift]} scale={[flip && wearFlip.flipX ? -1 : 1, flip && wearFlip.flipY ? -1 : 1, 1]} material={material} renderOrder={1} receiveShadow={receiveShadow}>
      <planeGeometry args={[decalW, decalH]} />
    </mesh>
  );
  const decals: React.ReactNode = (
    <>
      {wear > 0 ? decal("wear", mats.wear, MATERIALS.decalLiftCm, true) : null}
      {dust > 0 ? decal("dust", mats.dust, 2 * MATERIALS.decalLiftCm, false) : null}
    </>
  );
  const anchor = (name: AnchorName): React.ReactNode => {
    const a = frames[name];
    return (
      <group
        key={name}
        name={ANCHOR_OBJECT_NAME[name]}
        ref={(o) => {
          anchorRefs.current[name] = o;
        }}
        position={a.position}
        quaternion={a.quaternion}
      >
        {name === "frontBoard" && textured ? decals : null}
        {slots[name]}
      </group>
    );
  };
  const base = ANCHOR_NAMES.filter((n) => !frames[n].onCover);
  const onCover = ANCHOR_NAMES.filter((n) => frames[n].onCover);

  return (
    <group name={`book-${id}`} position={pose.position as [number, number, number]} rotation={poseEuler(pose)}>
      {/* the base: the back board and everything glued to it */}
      {mesh("backBoard", geo.backBoard, mats.cloth)}
      {mesh("spineBack", geo.spineBack, mats.cloth)}
      {mesh("hingeBack", geo.hingeBack, mats.cloth, false)}
      {mesh("pastedownBack", geo.pastedownBack, mats.endpaper, false)}
      {bandMeshes("right", bands.right)}
      {split.rightThickness > 1e-4 ? <PageBlock spec={spec} yLo={L.yBlock0} yHi={split.yMid} bowLo={0} bowHi={1} bowAmp={bowAmp} material={mats.slab} castShadow={castShadow} receiveShadow={receiveShadow} /> : null}
      <Ribbon spec={spec} yTop={split.yMid} swing={ribbonSwing} sag={ribbonSag} material={mats.ribbon} castShadow={castShadow} />
      {base.map(anchor)}

      {/* the cover: swings about the hinge axis, built in the closed frame */}
      <group name="cover" position={[L.xp, L.ym, 0]} rotation={[0, 0, coverAngle * Math.PI]}>
        <group position={[-L.xp, -L.ym, 0]}>
          {mesh("frontBoard", geo.frontBoard, mats.cloth)}
          {mesh("spineFront", geo.spineFront, mats.cloth)}
          {mesh("hingeFront", geo.hingeFront, mats.cloth, false)}
          {mesh("pastedownFront", geo.pastedownFront, mats.endpaper, false)}
          {bandMeshes("left", bands.left)}
          {split.leftThickness > 1e-4 ? <PageBlock spec={spec} yLo={split.yMid} yHi={L.yBlock1} bowLo={1} bowHi={0} bowAmp={bowAmp} material={mats.slab} castShadow={castShadow} receiveShadow={receiveShadow} /> : null}
          {onCover.map(anchor)}
        </group>
      </group>
      {children}
    </group>
  );
});
