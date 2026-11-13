import React, { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { z } from "zod";
import { BOOKS, BOOK_IDS, PILE, closedThickness, pilePoses, sheetCount, type BookPose } from "../config/books";
import { ZONES } from "../config/placement";
import { HEIGHT, WIDTH } from "../config/timeline";
import { Book } from "../book/Book";
import { bookBounds, poseEuler } from "../book/geometry";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

/** Sliders in the Studio's right-hand panel. */
export const devBookSchema = z.object({
  view: z.enum(["single", "pile"]),
  id: z.enum(BOOK_IDS),
  /** 0 closed to 1 fully open */
  coverAngle: z.number().min(0).max(1.05).step(0.005),
  /** sheets turned to the left (0 to 128) */
  turned: z.number().min(0).max(128).step(1),
  /** the book's own rotation, degrees, applied in the order Y, X, Z (single view) */
  yawDeg: z.number().min(-180).max(180).step(1),
  pitchDeg: z.number().min(-90).max(90).step(1),
  rollDeg: z.number().min(-180).max(180).step(1),
  /** the camera's orbit about the book */
  orbitAzDeg: z.number().min(-180).max(180).step(1),
  orbitElDeg: z.number().min(3).max(88).step(1),
  zoom: z.number().min(0.3).max(3).step(0.05),
  ribbonSwing: z.number().min(-1).max(1).step(0.05),
  bounds: z.boolean(),
  grid: z.boolean(),
  lamp: z.boolean(),
});
export type DevBookProps = z.infer<typeof devBookSchema>;
export const defaultDevBookProps: DevBookProps = {
  view: "single",
  id: "mini-me",
  coverAngle: 0,
  turned: 0,
  yawDeg: 20,
  pitchDeg: 0,
  rollDeg: 0,
  orbitAzDeg: -25,
  orbitElDeg: 38,
  zoom: 1,
  ribbonSwing: 0,
  bounds: true,
  grid: true,
  lamp: true,
};

type V3 = [number, number, number];

/** Puts the camera on a sphere around a target. A layout effect on every render: a pure function of the props. */
const Orbit: React.FC<{ target: V3; distance: number; azDeg: number; elDeg: number }> = ({ target, distance, azDeg, elDeg }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const az = (azDeg * Math.PI) / 180;
    const el = (elDeg * Math.PI) / 180;
    camera.position.set(target[0] + distance * Math.sin(az) * Math.cos(el), target[1] + distance * Math.sin(el), target[2] + distance * Math.cos(az) * Math.cos(el));
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    invalidate();
  });
  return null;
};

/** The edges of a box, in cm, drawn over the book (it turns with the book). */
const BoundsBox: React.FC<{ box: THREE.Box3; color?: string }> = ({ box, color = "#41e0ff" }) => {
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), [size.x, size.y, size.z]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <lineSegments geometry={edges} position={[centre.x, centre.y, centre.z]}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
};

/** The book's rotated bounds, to rest it on the floor whatever the pitch and roll. */
function liftToFloor(box: THREE.Box3, pose: BookPose): number {
  const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(pose));
  return -box.clone().applyMatrix4(m).min.y;
}

const fmt = (v: number): string => v.toFixed(2);

/**
 * The book alone on a plain floor, under three plain lights, with the camera on an orbit you set: yaw, pitch and roll of the book,
 * cover angle, turned sheets. A cyan box shows the bounding box in cm; the panel prints its size. The "pile" view stands the three
 * books of the opening pile with the askew offsets of `config/books.ts`, spines to the camera, at the pile anchor of the desk.
 * The materials and the painted covers of Patches 07 and 08 are on the book; the lights are plain ones, not the film's rig (`DevCovers` and `DevMaterials` use that).
 */
export const DevBook: React.FC<DevBookProps> = (p) => {
  const spec = BOOKS[p.id];
  const state = { coverAngle: p.coverAngle, turned: Math.min(p.turned, sheetCount(spec)) };
  const closed = bookBounds(spec, { coverAngle: 0, turned: 0 });
  const body = bookBounds(spec, state);
  const withRibbon = bookBounds(spec, state, { ribbon: true });
  const poseBase: BookPose = { position: [0, 0, 0], yawDeg: p.yawDeg, pitchDeg: p.pitchDeg, rollDeg: p.rollDeg };
  const single: BookPose = { ...poseBase, position: [0, liftToFloor(body, poseBase), 0] };
  const pile = pilePoses(ZONES.L.anchor);
  const pileHeight = PILE.reduce((h, s) => h + closedThickness(BOOKS[s.id]), 0);

  const isPile = p.view === "pile";
  const target: V3 = isPile ? [ZONES.L.anchor.X, pileHeight / 2, -ZONES.L.anchor.Zd] : [0, Math.max(2, single.position[1] + 1), 0];
  const distance = (isPile ? 62 : 72) / p.zoom;

  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000" };
  const size = (b: THREE.Box3): string => `${fmt(b.max.x - b.min.x)} x ${fmt(b.max.z - b.min.z)} x ${fmt(b.max.y - b.min.y)} cm`;

  return (
    <AbsoluteFill style={{ background: "#0c0907" }}>
      <ThreeCanvas
        width={WIDTH}
        height={HEIGHT}
        flat
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ fov: 30, near: 1, far: 3000, position: [0, 60, 100] }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
          scene.background = new THREE.Color("#0c0907");
        }}
      >
        <Orbit target={target} distance={distance} azDeg={p.orbitAzDeg} elDeg={p.orbitElDeg} />
        {/* three plain lights: a warm key from the upper left (the lamp's side), a dim amber rim from behind, a cool fill */}
        {p.lamp ? (
          <directionalLight color="#F0CEA0" intensity={1.7} position={[-45, 60, 25]} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-near={10} shadow-camera-far={200} shadow-bias={-0.0004} shadow-normalBias={0.03} />
        ) : null}
        <directionalLight color="#EBAF7B" intensity={0.7} position={[25, 30, -60]} />
        <directionalLight color="#E39A5E" intensity={0.25} position={[15, 8, 60]} />
        <hemisphereLight color="#4a4a58" groundColor="#2a1c14" intensity={0.9} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[600, 600]} />
          <meshStandardMaterial color="#2b1b13" roughness={0.6} metalness={0} />
        </mesh>
        {p.grid ? <gridHelper args={[80, 80, "#8a6a52", "#4a372b"]} position={[0, 0.01, isPile ? -ZONES.L.anchor.Zd : 0]} /> : null}

        {isPile ? (
          pile.map(({ id, pose }) => (
            <Book key={id} id={id} pose={pose} ribbonSwing={p.ribbonSwing}>
              {p.bounds ? <BoundsBox box={bookBounds(BOOKS[id], { coverAngle: 0, turned: 0 })} /> : null}
            </Book>
          ))
        ) : (
          <Book id={p.id} coverAngle={p.coverAngle} turned={state.turned} pose={single} ribbonSwing={p.ribbonSwing}>
            {p.bounds ? <BoundsBox box={body} /> : null}
          </Book>
        )}
      </ThreeCanvas>

      <div style={{ position: "absolute", left: 36, top: 30, fontSize: 22, lineHeight: 1.55, ...mono }}>
        {isPile ? (
          <>
            <div style={{ fontSize: 34 }}>pile of three, bottom to top</div>
            {pile.map(({ id, pose }, i) => (
              <div key={id}>
                {BOOKS[id].volume}. {id}: thickness {fmt(closedThickness(BOOKS[id]))} cm, base at {fmt(pose.position[1])} cm, yaw {fmt(pose.yawDeg ?? 0)} deg (offset {PILE[i].yawDeg >= 0 ? "+" : ""}
                {PILE[i].yawDeg}), shift {fmt(PILE[i].dx * 10)} mm right, {fmt(PILE[i].dzd * 10)} mm back
              </div>
            ))}
            <div>total height {fmt(pileHeight)} cm; each box is that book's closed bounding box</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 34 }}>
              Vol. {spec.volume} · {spec.id}
            </div>
            <div>
              trim {fmt(spec.trimW)} x {fmt(spec.trimH)} cm (boards), spine {fmt(spec.spine)}, board {fmt(spec.board)}, square {fmt(spec.square)}
            </div>
            <div>closed bounding box {size(closed)} (width x height x thickness)</div>
            <div>
              now (cover {fmt(p.coverAngle)}, {state.turned} of {sheetCount(spec)} sheets turned): {size(body)}
            </div>
            <div>with the ribbon tail: {size(withRibbon)}</div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
