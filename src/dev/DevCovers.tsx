import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { z } from "zod";
import { BOOKS, BOOK_IDS, SPINE_TO_CAMERA_YAW_DEG, type BookId, type BookPose } from "../config/books";
import { COVER, type Surface } from "../config/covers";
import { ZONES } from "../config/placement";
import { HEIGHT, WIDTH } from "../config/timeline";
import { Book } from "../book/Book";
import { useArtwork } from "../book/CoverSlots";
import { bookBounds, layoutOf, poseEuler } from "../book/geometry";
import { LightRig } from "../light/Rig";
import { ProbeEnvironment } from "../light/ProbeEnvironment";
import { loadFonts, stacks } from "../lib/fonts";
import type { Artwork } from "../paint/covers";
import { coverTextureBytes } from "../paint/covers/render";

void loadFonts();

const VIEWS = ["flat", "fronts", "spines", "backs", "book"] as const;
const FACES = ["front", "spine", "back"] as const;

/** Sliders in the Studio's right-hand panel. */
export const devCoversSchema = z.object({
  /** flat: one book's back, spine and front side by side; fronts, spines, backs: all four books; book: one cover on its lit Book */
  view: z.enum(VIEWS),
  id: z.enum(BOOK_IDS),
  /** the safe areas, the QR slot and the clip inset drawn over the flat covers */
  overlay: z.boolean(),
  /** the book view: which face the camera looks at */
  face: z.enum(FACES),
  distanceCm: z.number().min(10).max(140).step(1),
  azDeg: z.number().min(-90).max(90).step(1),
  elDeg: z.number().min(3).max(88).step(1),
  /** a turn of the book about its vertical axis, degrees */
  yawDeg: z.number().min(-60).max(60).step(0.5),
  /** the cover lifted towards the camera, as a held book is in S05 (0 is lying flat) */
  rollDeg: z.number().min(0).max(80).step(1),
  coverAngle: z.number().min(0).max(1.05).step(0.005),
  probe: z.boolean(),
  panel: z.boolean(),
});
export type DevCoversProps = z.infer<typeof devCoversSchema>;
export const defaultDevCoversProps: DevCoversProps = {
  view: "flat",
  id: "mini-me",
  overlay: true,
  face: "front",
  distanceCm: 70,
  azDeg: 0,
  elDeg: 60,
  yawDeg: 0,
  rollDeg: 0,
  coverAngle: 0,
  probe: true,
  panel: true,
};

const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };

/**
 * One painted surface, flat: the cloth colour, then the printed layer, then the foil layer (its own colours; no light, so no flare).
 * With the overlay: the safe area (cyan), the clip inset (magenta) and the QR slot of Patch 09 (yellow, dashed).
 */
const FlatSurface: React.FC<{ art: Artwork; surface: Surface; pxPerCm: number; overlay: boolean }> = ({ art, surface, pxPerCm, overlay }) => {
  const sp = art.plan.surfaces[surface];
  const w = Math.round(sp.widthCm * pxPerCm);
  const h = Math.round(sp.heightCm * pxPerCm);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    const k = w / sp.width;
    g.clearRect(0, 0, w, h);
    g.fillStyle = BOOKS[art.id].colors.cloth;
    g.fillRect(0, 0, w, h);
    g.drawImage(art.layers[surface].color, 0, 0, w, h);
    g.drawImage(art.layers[surface].foil, 0, 0, w, h);
    if (!overlay) return;
    g.lineWidth = 1.5;
    g.strokeStyle = "#35e0ff";
    g.strokeRect(sp.safe.x * k, sp.safe.y * k, sp.safe.w * k, sp.safe.h * k);
    const inset = COVER.clipInsetCm * pxPerCm;
    g.strokeStyle = "#ff3df0";
    g.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset);
    if (sp.qrSlot) {
      g.strokeStyle = "#ffe14a";
      g.setLineDash([8, 6]);
      g.strokeRect(sp.qrSlot.x * k, sp.qrSlot.y * k, sp.qrSlot.w * k, sp.qrSlot.h * k);
      g.setLineDash([]);
    }
    // the middle line of the board
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w / 2, h);
    g.stroke();
  }, [art, surface, w, h, pxPerCm, overlay, sp]);
  return <canvas ref={ref} width={w} height={h} style={{ display: "block", outline: "1px solid #000" }} />;
};

const Notes: React.FC<{ art: Artwork }> = ({ art }) => (
  <>
    {art.plan.notes.map((n, i) => (
      <div key={i} style={{ color: "#ff8a7a", fontSize: 17 }}>
        note: {n}
      </div>
    ))}
  </>
);

const Flat: React.FC<{ p: DevCoversProps }> = ({ p }) => {
  // four artworks, always in the same order (a fixed number of hooks)
  const arts: Record<BookId, Artwork | null> = {
    "mini-me": useArtwork("mini-me"),
    "spherex-blink": useArtwork("spherex-blink"),
    minilocker: useArtwork("minilocker"),
    "next-inc-immersive": useArtwork("next-inc-immersive"),
  };
  if (BOOK_IDS.some((id) => !arts[id])) return null;
  const one = arts[p.id]!;
  const tall = 22.9;
  const top = p.panel ? 150 : 40;
  const scale = (HEIGHT - top - 40) / tall;

  let body: React.ReactNode;
  if (p.view === "flat") {
    body = (
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {(["back", "spine", "front"] as const).map((s) => (
          <div key={s}>
            <FlatSurface art={one} surface={s} pxPerCm={scale} overlay={p.overlay} />
            <div style={{ fontSize: 17 }}>{s}</div>
          </div>
        ))}
      </div>
    );
  } else {
    const s: Surface = p.view === "fronts" ? "front" : p.view === "spines" ? "spine" : "back";
    const cmW = (id: BookId): number => arts[id]!.plan.surfaces[s].widthCm;
    const gap = 30;
    const room = WIDTH - 80 - gap * (BOOK_IDS.length - 1);
    const fit = Math.min(scale, room / BOOK_IDS.reduce((a, id) => a + cmW(id), 0));
    body = (
      <div style={{ display: "flex", gap, alignItems: "flex-start" }}>
        {BOOK_IDS.map((id) => (
          <div key={id}>
            <FlatSurface art={arts[id]!} surface={s} pxPerCm={fit} overlay={p.overlay} />
            <div style={{ fontSize: 17 }}>
              Vol. {BOOKS[id].volume} · {id}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const bytes = Math.round(coverTextureBytes(one.plan) / 1048576);
  return (
    <AbsoluteFill style={{ background: "#2a2622", ...mono }}>
      {p.panel ? (
        <div style={{ position: "absolute", left: 40, top: 24, fontSize: 20, lineHeight: 1.5 }}>
          <div style={{ fontSize: 32 }}>COVERS · {p.view === "flat" ? p.id : p.view}</div>
          <div style={{ fontSize: 17, opacity: 0.85 }}>
            flat, no lights: cloth colour, print, foil colour · cyan: safe area, magenta: clip inset ({COVER.clipInsetCm} cm), yellow: QR slot of Patch 09 · {p.id}: {bytes} MB of textures on the GPU (budget {Math.round(COVER.textureBudgetBytes / 1048576)} MB for the four)
          </div>
          {BOOK_IDS.map((id) => (
            <Notes key={id} art={arts[id]!} />
          ))}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 40, top }}>{body}</div>
    </AbsoluteFill>
  );
};

type V3 = [number, number, number];

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

function liftToFloor(box: THREE.Box3, pose: BookPose): number {
  const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(pose));
  let low = Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) low = Math.min(low, new THREE.Vector3(x, y, z).applyMatrix4(m).y);
  return -low;
}

/** One cover on its lit Book: the film's own light rig and the plate probe, so the foil is the foil of the film. */
const OnBook: React.FC<{ p: DevCoversProps }> = ({ p }) => {
  const spec = BOOKS[p.id];
  const L = layoutOf(spec);
  const art = useArtwork(p.id);
  const anchor = ZONES.L.anchor;
  // the back is seen with the book turned over about its long axis (face down becomes face up)
  const flipped = p.face === "back";
  const base: BookPose = { position: [0, 0, 0], yawDeg: (p.face === "spine" ? SPINE_TO_CAMERA_YAW_DEG : 0) + p.yawDeg, rollDeg: flipped ? 180 - p.rollDeg : p.rollDeg };
  const pose: BookPose = { ...base, position: [anchor.X, liftToFloor(bookBounds(spec, { coverAngle: 0, turned: 0 }), base), -anchor.Zd] };
  const local: Record<(typeof FACES)[number], V3> = { front: [0, L.T, 0], spine: [-L.W / 2, L.T / 2, 0], back: [0, 0, 0] };
  const q = new THREE.Vector3(...local[p.face]).applyEuler(poseEuler(pose));
  const target: V3 = [q.x + anchor.X, q.y + pose.position[1], q.z - anchor.Zd];
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
        <LightRig />
        {p.probe ? <ProbeEnvironment /> : null}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[anchor.X, 0, -anchor.Zd]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#2b1b13" roughness={0.6} metalness={0} />
        </mesh>
        <Book id={p.id} coverAngle={p.coverAngle} pose={pose} wear={1} dust={0} />
      </ThreeCanvas>
      {p.panel ? (
        <div style={{ position: "absolute", left: 36, top: 30, fontSize: 20, lineHeight: 1.5, ...mono }}>
          <div style={{ fontSize: 32 }}>
            COVERS · {spec.id} · {p.face}
          </div>
          <div style={{ fontSize: 17, opacity: 0.85 }}>
            the film's light rig and plate probe ({p.probe ? "on" : "off: foil is dark metal"}) · cover lifted {p.rollDeg} deg · cover angle {p.coverAngle.toFixed(2)} · the spine's front half rides the cover
          </div>
          {art ? <Notes art={art} /> : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * THE COVER LAB (Patch 08). `flat`: one book's back, spine and front as painted, side by side; `fronts`, `spines` and `backs`: all four
 * books; each with an overlay of the safe areas and the QR slot. `book`: one cover on its Book under the film's rig, from the front,
 * the spine or the back, with the cover liftable and openable. Notes the painter wrote (a missing mark file, a title that had to shrink)
 * are printed in red. Tune `src/config/covers.ts` by looking here.
 */
export const DevCovers: React.FC<DevCoversProps> = (p) => (p.view === "book" ? <OnBook p={p} /> : <Flat p={p} />);
