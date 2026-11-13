import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { z } from "zod";
import { BOOKS, BOOK_IDS, SPINE_TO_CAMERA_YAW_DEG, type BookPose } from "../config/books";
import { TEXTURES, TEXTURE_NAMES, gpuBytes, MATERIALS } from "../config/materials";
import { ZONES } from "../config/placement";
import { HEIGHT, WIDTH } from "../config/timeline";
import { getBook } from "../data/select";
import { Book } from "../book/Book";
import { bookBounds, layoutOf, poseEuler } from "../book/geometry";
import { clothTokens, foilMaterial, foilTokens } from "../book/materials";
import { LightRig } from "../light/Rig";
import { ProbeEnvironment } from "../light/ProbeEnvironment";
import { endpaperPattern, paintPattern } from "../paint/patterns";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

/** The three lightings of the brief: the lamp alone (a point: foil flares at one angle), the amber strips alone (rim and kicker: long soft reflections), everything. */
const LIGHTINGS = {
  "lamp only": { key: true, rim: false, kicker: false, fill: false },
  "strips only": { key: false, rim: true, kicker: true, fill: false },
  all: { key: true, rim: true, kicker: true, fill: true },
} as const;
const LIGHTING_NAMES = ["lamp only", "strips only", "all"] as const;
const LOOKS = ["whole book", "foil", "corner", "fore-edge", "head edge"] as const;

/** Sliders in the Studio's right-hand panel. */
export const devMaterialsSchema = z.object({
  id: z.enum(BOOK_IDS),
  lighting: z.enum(LIGHTING_NAMES),
  /** what the camera looks at */
  look: z.enum(LOOKS),
  /** the camera's distance from it, cm: the weave shows only below about 10 */
  distanceCm: z.number().min(4).max(140).step(1),
  azDeg: z.number().min(-180).max(180).step(1),
  elDeg: z.number().min(3).max(88).step(1),
  /** a turn of the book about its own vertical axis from the spine-to-camera pose, degrees: 5 degrees must be enough to make the foil flare */
  yawDeg: z.number().min(-15).max(15).step(0.1),
  /**
   * lifts the cover towards the camera, as a held book is in S05 (degrees about the book's own long axis; 0 is lying flat). A flat
   * book cannot flare under a yaw: turning it about the vertical axis leaves its normal, and so the mirror direction, where it was.
   */
  rollDeg: z.number().min(-10).max(80).step(1),
  probe: z.boolean(),
  textured: z.boolean(),
  wear: z.number().min(0).max(1).step(0.05),
  dust: z.number().min(0).max(1).step(0.05),
  /** the endpaper patterns of the four books, along the foot */
  patterns: z.boolean(),
  panel: z.boolean(),
});
export type DevMaterialsProps = z.infer<typeof devMaterialsSchema>;
export const defaultDevMaterialsProps: DevMaterialsProps = {
  id: "mini-me",
  lighting: "all",
  look: "whole book",
  distanceCm: 70,
  azDeg: 0,
  elDeg: 42,
  yawDeg: 0,
  rollDeg: 0,
  probe: true,
  textured: true,
  wear: 1,
  dust: 0,
  patterns: true,
  panel: true,
};

type V3 = [number, number, number];

/** The height that puts the lowest corner of a posed box on the desk (y = 0). */
function liftToFloor(box: THREE.Box3, pose: BookPose): number {
  const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(pose));
  let low = Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) low = Math.min(low, new THREE.Vector3(x, y, z).applyMatrix4(m).y);
  return -low;
}

const Orbit: React.FC<{ target: V3; distance: number; azDeg: number; elDeg: number }> = ({ target, distance, azDeg, elDeg }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const az = (azDeg * Math.PI) / 180;
    const el = (elDeg * Math.PI) / 180;
    camera.position.set(target[0] + distance * Math.sin(az) * Math.cos(el), target[1] + distance * Math.sin(el), target[2] + distance * Math.cos(az) * Math.cos(el));
    camera.lookAt(target[0], target[1], target[2]);
    camera.near = 0.5;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    invalidate();
  });
  return null;
};

/**
 * Plain foil shapes on the front board (no text, no logos: those are Patch 08): a ring, a dot, two rules in the mark's colour and the
 * title's, and a block. Metal, so each one shows the environment and flares only when its mirror direction meets the lamp or a strip.
 * It lives in the front board's anchor frame (+Z out, +X right, +Y up the face).
 */
const FoilTest: React.FC<{ id: (typeof BOOK_IDS)[number] }> = ({ id }) => {
  const spec = BOOKS[id];
  const primary = useMemo(() => foilMaterial(foilTokens(spec, "primary")), [spec]);
  const secondary = useMemo(() => foilMaterial(foilTokens(spec, "secondary")), [spec]);
  useEffect(
    () => () => {
      primary.dispose();
      secondary.dispose();
    },
    [primary, secondary],
  );
  const z = MATERIALS.decalLiftCm * 4;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 6, 0]} material={primary}>
        <ringGeometry args={[1.0, 1.3, 64]} />
      </mesh>
      <mesh position={[0, 6, 0]} material={primary}>
        <circleGeometry args={[0.36, 32]} />
      </mesh>
      <mesh position={[0, 1.5, 0]} material={primary}>
        <planeGeometry args={[8, 0.12]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={secondary}>
        <planeGeometry args={[5.5, 0.12]} />
      </mesh>
      <mesh position={[0, -4, 0]} material={secondary}>
        <planeGeometry args={[5, 1.4]} />
      </mesh>
    </group>
  );
};

/** One endpaper pattern drawn on a canvas (a layout effect: the Still waits for it). */
const PatternSwatch: React.FC<{ slug: string; size: number }> = ({ slug, size }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const book = getBook(slug);
  useLayoutEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    paintPattern(g, endpaperPattern({ slug, motif: book.motif, palette: book.palette }), size);
  }, [slug, size, book.motif, book.palette]);
  return (
    <div style={{ width: size }}>
      <canvas ref={ref} width={size} height={size} style={{ display: "block", border: "1px solid #000" }} />
      <div style={{ fontSize: 15, marginTop: 4 }}>
        {slug} · {book.motif} · {book.palette}
      </div>
    </div>
  );
};

/**
 * THE MATERIALS LAB (Patch 07): one book on a dark desk under the film's own rig (`LightRig`) and the plate probe. Switch the
 * lighting (lamp only, strips only, all), turn the book a few degrees about its vertical axis with `yawDeg` and watch the foil
 * shapes flare; bring the camera in under 10 cm and the weave appears; look at the fore-edge and the head edge for the sheet lines
 * and the yellowing; switch `textured` off for the plain look and `probe` off to see foil as dark metal. Use it to tune
 * `src/config/materials.ts` by looking.
 */
export const DevMaterials: React.FC<DevMaterialsProps> = (p) => {
  const spec = BOOKS[p.id];
  const L = layoutOf(spec);
  const anchor = ZONES.L.anchor;
  const poseBase: BookPose = { position: [0, 0, 0], yawDeg: SPINE_TO_CAMERA_YAW_DEG + p.yawDeg, rollDeg: p.rollDeg };
  const pose: BookPose = { ...poseBase, position: [anchor.X, liftToFloor(bookBounds(spec, { coverAngle: 0, turned: 0 }), poseBase), -anchor.Zd] };
  // the camera's target, a point of the book in its own frame carried to the world by the book's pose
  const local: Record<(typeof LOOKS)[number], V3> = {
    "whole book": [0, L.T / 2, 0],
    foil: [0, L.T, -1.5],
    corner: [L.W / 2 - 0.8, L.T, L.H / 2 - 0.8],
    "fore-edge": [L.xFore, L.T / 2, 0],
    "head edge": [0, L.T / 2, L.zHead],
  };
  const q = new THREE.Vector3(...local[p.look]).applyEuler(poseEuler(pose));
  const target: V3 = [q.x + anchor.X, q.y + pose.position[1], q.z - anchor.Zd];
  const lights = LIGHTINGS[p.lighting];
  const total = TEXTURE_NAMES.reduce((a, n) => a + gpuBytes(TEXTURES[n]), 0);
  const cloth = clothTokens(spec);
  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };

  return (
    <AbsoluteFill style={{ background: "#0c0907" }}>
      <ThreeCanvas
        width={WIDTH}
        height={HEIGHT}
        flat
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ fov: 30, near: 0.5, far: 3000, position: [0, 60, 100] }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
          scene.background = new THREE.Color("#0c0907");
        }}
      >
        <Orbit target={target} distance={p.distanceCm} azDeg={p.azDeg} elDeg={p.elDeg} />
        <LightRig on={lights} />
        {p.probe ? <ProbeEnvironment /> : null}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[anchor.X, 0, -anchor.Zd]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#2b1b13" roughness={0.6} metalness={0} />
        </mesh>
        <Book id={p.id} pose={pose} textured={p.textured} wear={p.wear} dust={p.dust} covers={false} slots={{ frontBoard: <FoilTest id={p.id} /> }} />
      </ThreeCanvas>

      {p.panel ? (
        <div style={{ position: "absolute", left: 36, top: 30, fontSize: 20, lineHeight: 1.5, ...mono }}>
          <div style={{ fontSize: 32 }}>
            MATERIALS · {spec.id} · {p.lighting}
          </div>
          <div>
            looking at the {p.look} from {p.distanceCm} cm · book turned {p.yawDeg.toFixed(1)} deg, cover lifted {p.rollDeg} deg · probe {p.probe ? "on" : "off (foil is dark metal)"} · textures {p.textured ? "on" : "off"}
          </div>
          <div style={{ fontSize: 17, opacity: 0.85 }}>
            cloth roughness {MATERIALS.cloth.roughness}, sheen {(cloth.sheen ?? 0.4).toFixed(2)}, weave x{(cloth.weave ?? 1).toFixed(1)} · foil metalness {MATERIALS.foil.metalness}, roughness {MATERIALS.foil.roughness} · paper roughness{" "}
            {MATERIALS.paper.roughness}
          </div>
          <div style={{ fontSize: 17, opacity: 0.85 }}>
            wear {p.wear.toFixed(2)} · dust {p.dust.toFixed(2)} · textures {(total / 1048576).toFixed(2)} MB on the GPU
          </div>
        </div>
      ) : null}

      {p.patterns ? (
        <div style={{ position: "absolute", left: 36, bottom: 30, display: "flex", gap: 18, ...mono }}>
          {BOOK_IDS.map((id) => (
            <PatternSwatch key={id} slug={id} size={150} />
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
