import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { BOOKS, type BookId, type BookPose, type BookSpec } from "../config/books";
import { ANCHOR_NAMES, anchorFrames, bandGeometries, bowAmplitude, layoutOf, poseEuler, splitOf, staticGeometries, type AnchorName } from "./geometry";
import { PageBlock } from "./PageBlock";
import { Ribbon } from "./Ribbon";

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
 * uneven fore-edge, head and tail bands, a ribbon. Flat colours only. Pure props in, geometry out: nothing here reads a frame.
 *
 * Units are centimetres. The book's own frame has X from the spine to the fore-edge, Y up from the underside of the back board and Z from
 * head to tail; `pose` places that frame in the world. A closed Mini Me is 15.2 x 22.9 x 3.0 cm.
 */
export const Book = React.forwardRef<BookHandle, BookProps>(function Book(
  { id, coverAngle = 0, turned = 0, pose = { position: [0, 0, 0] }, ribbonSwing = 0, ribbonSag = 0.25, castShadow = true, receiveShadow = true, slots = {}, children },
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

  const c = spec.colors;
  const cloth = <meshStandardMaterial color={c.cloth} roughness={0.85} metalness={0} />;
  const paperEdge = <meshStandardMaterial color={c.endpaper} roughness={0.9} metalness={0} />;
  const mesh = (key: string, g: THREE.BufferGeometry, material: React.ReactNode, shadows = true): React.ReactNode => (
    <mesh key={key} geometry={g} castShadow={castShadow && shadows} receiveShadow={receiveShadow}>
      {material}
    </mesh>
  );
  // four stripes per half: head 0, head 1, tail 0, tail 1; the two band colours alternate
  const bandMeshes = (side: string, gs: THREE.BufferGeometry[] | null): React.ReactNode =>
    gs ? gs.map((g, i) => mesh(`band-${side}-${i}`, g, <meshStandardMaterial color={c.band[i % 2]} roughness={0.8} metalness={0} />, false)) : null;
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
        {slots[name]}
      </group>
    );
  };
  const base = ANCHOR_NAMES.filter((n) => !frames[n].onCover);
  const onCover = ANCHOR_NAMES.filter((n) => frames[n].onCover);

  return (
    <group name={`book-${id}`} position={pose.position as [number, number, number]} rotation={poseEuler(pose)}>
      {/* the base: the back board and everything glued to it */}
      {mesh("backBoard", geo.backBoard, cloth)}
      {mesh("spineBack", geo.spineBack, cloth)}
      {mesh("hingeBack", geo.hingeBack, cloth, false)}
      {mesh("pastedownBack", geo.pastedownBack, paperEdge, false)}
      {bandMeshes("right", bands.right)}
      {split.rightThickness > 1e-4 ? <PageBlock spec={spec} yLo={L.yBlock0} yHi={split.yMid} bowLo={0} bowHi={1} bowAmp={bowAmp} castShadow={castShadow} receiveShadow={receiveShadow} /> : null}
      <Ribbon spec={spec} yTop={split.yMid} swing={ribbonSwing} sag={ribbonSag} castShadow={castShadow} />
      {base.map(anchor)}

      {/* the cover: swings about the hinge axis, built in the closed frame */}
      <group name="cover" position={[L.xp, L.ym, 0]} rotation={[0, 0, coverAngle * Math.PI]}>
        <group position={[-L.xp, -L.ym, 0]}>
          {mesh("frontBoard", geo.frontBoard, cloth)}
          {mesh("spineFront", geo.spineFront, cloth)}
          {mesh("hingeFront", geo.hingeFront, cloth, false)}
          {mesh("pastedownFront", geo.pastedownFront, paperEdge, false)}
          {bandMeshes("left", bands.left)}
          {split.leftThickness > 1e-4 ? <PageBlock spec={spec} yLo={split.yMid} yHi={L.yBlock1} bowLo={1} bowHi={0} bowAmp={bowAmp} castShadow={castShadow} receiveShadow={receiveShadow} /> : null}
          {onCover.map(anchor)}
        </group>
      </group>
      {children}
    </group>
  );
});
