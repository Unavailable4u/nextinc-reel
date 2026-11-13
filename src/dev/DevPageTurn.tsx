import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { z } from "zod";
import { BOOKS, BOOK_IDS, sheetCount, type BookId, type BookPose } from "../config/books";
import { SHEET } from "../config/sheets";
import { HEIGHT, WIDTH } from "../config/timeline";
import { Book } from "../book/Book";
import { bookBounds } from "../book/geometry";
import { PageFaces, Sheet } from "../book/Sheet";
import { checkerTexture, pageTexture } from "../book/pageTextures";
import { riffleFrames, riffleSheets, riffleTurned } from "../book/rig/riffle";
import { turnFrames, turnState, turnedDuring } from "../book/rig/turn";
import { SINGLE, lengthReadout, sheetBlob, sheetLayout, sheetPivot, sheetVariation, shapeOf, type SheetPlacement } from "../book/sheetShape";
import { loadFonts, stacks } from "../lib/fonts";
import { loadBookPages, type BookPages } from "../paint/pages";

void loadFonts();

/** Sliders in the Studio's right-hand panel. */
export const devPageTurnSchema = z.object({
  /** single: one sheet, from frame 0; riffle: `count` sheets, the first from frame 0 (S10) */
  mode: z.enum(["single", "riffle"]),
  id: z.enum(BOOK_IDS),
  /** THE SCRUBBER: the frame of the turn. A single turn is 54 frames (36 if quick), then the landing's flutter; a riffle is about 126 frames, then the flutter */
  frame: z.number().int().min(0).max(240),
  quick: z.boolean(),
  /** how many sheets of the book are already turned when the turn begins (the sheet that turns is the next one) */
  turned: z.number().int().min(0).max(126),
  /** the cover's angle, 1 is lying open flat */
  coverAngle: z.number().min(0.5).max(1.05).step(0.005),
  /** a checker (the front's gutter is orange, the back's is blue, the head is red) or the real painted pages of Patch 09 */
  texture: z.enum(["checker", "page"]),
  /** the riffle's number of sheets, 10 to 14 */
  count: z.number().int().min(SHEET.riffle.min).max(SHEET.riffle.max),
  /** key: a warm lamp from the front, behind: a lamp on the far side of a vertical sheet (it should glow), both */
  lamp: z.enum(["key", "behind", "both"]),
  orbitAzDeg: z.number().min(-180).max(180).step(1),
  orbitElDeg: z.number().min(3).max(88).step(1),
  zoom: z.number().min(0.3).max(4).step(0.05),
  /** the mesh drawn over the sheets */
  mesh: z.boolean(),
  /** the hinge line (where the gutter of a sheet is at this frame) */
  hinge: z.boolean(),
  /** the soft shadow that follows each sheet */
  decal: z.boolean(),
  /** the page printed on each stack's face under the sheets */
  faces: z.boolean(),
  /** draw the CPU twin's vertices instead of the shader's own: they must look the same */
  cpu: z.boolean(),
  panel: z.boolean(),
});
export type DevPageTurnProps = z.infer<typeof devPageTurnSchema>;
export const defaultDevPageTurnProps: DevPageTurnProps = {
  mode: "single",
  id: "mini-me",
  frame: 20,
  quick: false,
  turned: 10,
  coverAngle: 1,
  texture: "checker",
  count: SHEET.riffle.count,
  lamp: "key",
  orbitAzDeg: -25,
  orbitElDeg: 24,
  zoom: 1.1,
  mesh: false,
  hinge: true,
  decal: true,
  faces: true,
  cpu: false,
  panel: true,
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

/** The painted pages of a book, when `enabled`; the render waits until they are ready. Nothing is loaded (and nothing waited for) otherwise. */
function useBookPages(id: BookId, enabled: boolean): BookPages | null {
  const [book, setBook] = useState<BookPages | null>(null);
  const handle = useRef<number | null>(null);
  if (enabled && handle.current === null && book === null) handle.current = delayRender(`Painting the pages of ${id}`);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadBookPages(id).then(
      (b) => {
        if (alive) setBook(b);
        if (handle.current !== null) {
          continueRender(handle.current);
          handle.current = null;
        }
      },
      (e: unknown) => cancelRender(e),
    );
    return () => {
      alive = false;
    };
  }, [id, enabled]);
  return enabled ? book : null;
}

/** The hinge: a line along the book's z through the point where the gutter of the sheet is at this frame. */
const Hinge: React.FC<{ x: number; y: number; z0: number; z1: number; color: string }> = ({ x, y, z0, z1, color }) => {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y, z1)]), [x, y, z0, z1]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo} renderOrder={11}>
      <lineBasicMaterial color={color} depthTest={false} />
    </lineSegments>
  );
};

const fmt = (v: number, d = 2): string => v.toFixed(d);
const pct = (f: number): string => `${f >= 1 ? "+" : ""}${((f - 1) * 100).toFixed(3)}%`;

/**
 * THE PAGE-TURN LAB (Patch 10). An open book with one sheet (or a riffle of 10 to 14) turning over its spine, a scrubber (`frame`) to stop
 * anywhere in the turn, and toggles for the mesh, the hinge, the shadow that follows each sheet and the CPU twin of the shader. The panel
 * prints the LENGTH READ-OUT of guide 06 section 6: the longest and shortest row of the sheet (gutter to outer edge) and the worst stretch of
 * the columns (head to tail) at p = 0, 0.25, 0.5, 0.75 and 1, as a percentage of the paper's size; green is within 0.5%.
 * Tune `src/config/sheets.ts` by looking here. Take a strip of stills by rendering frames 0, 4, 8 ... 44 (see the notes of Patch 10).
 */
export const DevPageTurn: React.FC<DevPageTurnProps> = (p) => {
  const spec = BOOKS[p.id];
  const total = sheetCount(spec);
  const riffle = p.mode === "riffle";
  const count = riffle ? p.count : 1;
  const base = Math.min(p.turned, total - count);
  const useQuick = p.quick && !riffle;
  const length = riffle ? SHEET.riffle.turnFrames : turnFrames(useQuick);

  // the state of every sheet at this frame
  const params = { start: 0, count: p.count, first: base, baseTurned: base };
  const sheets = riffle
    ? riffleSheets(p.frame, params)
    : [{ rank: 0, count: 1, index: base, start: 0, end: length, ...turnState(p.frame, 0, length), place: SINGLE as SheetPlacement }];
  const turned = riffle ? riffleTurned(p.frame, params) : turnedDuring(base, sheets[0].P);

  const book = useBookPages(p.id, p.texture === "page");
  const checker = useMemo(() => ({ front: checkerTexture("front"), back: checkerTexture("back") }), []);
  useEffect(() => () => [checker.front, checker.back].forEach((t) => t.dispose()), [checker]);
  /** the page on a side of leaf `k`: the front of a leaf is the odd page 2k + 1, its back is 2k + 2 */
  const pageOf = (index: number): THREE.Texture | null => {
    const pg = book?.pages[index];
    return pg ? pageTexture(pg.canvas) : null;
  };
  const frontOf = (k: number): THREE.Texture | null => (p.texture === "checker" ? checker.front : pageOf(2 * k + 1));
  const backOf = (k: number): THREE.Texture | null => (p.texture === "checker" ? checker.back : pageOf(2 * k + 2));

  // the book: open (cover angle 1 is flat) and lifted to rest on the floor
  const state = { coverAngle: p.coverAngle, turned };
  const box = bookBounds(spec, state);
  const pose: BookPose = { position: [0, -box.min.y, 0], yawDeg: 0 };
  const target: V3 = [0, 2, 0];
  const distance = 62 / p.zoom;

  // the numbers of the first sheet: its read-out and where its hinge is
  const layout = sheetLayout(spec, state, base);
  const shape = shapeOf(layout, sheetVariation(spec, base));
  const first = sheets[0];
  const hinge = sheetPivot(first.P, layout, shape, first.place);
  const blob = sheetBlob(first.P, first.landSec, layout, shape, first.place);
  const readout = SHEET.readout.progress.map((P) => ({ P, ...lengthReadout(P, layout, shape, 0.05) }));
  const tol = SHEET.readout.tolerance;
  const worst = (r: (typeof readout)[number]): number => Math.max(Math.abs(r.rowMin - 1), Math.abs(r.rowMax - 1), Math.abs(r.columnMin - 1), Math.abs(r.columnMax - 1));

  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000" };
  const span = riffle ? riffleFrames(params) : null;
  const waiting = p.texture === "page" && !book;
  if (waiting) return null;

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
        {p.lamp !== "behind" ? (
          <directionalLight color="#F0CEA0" intensity={1.7} position={[-45, 60, 25]} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-near={10} shadow-camera-far={200} shadow-bias={-0.0004} shadow-normalBias={0.03} />
        ) : null}
        {p.lamp !== "key" ? <pointLight color="#FFD9A8" intensity={1.6} decay={0} position={[34, 20, 4]} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-near={2} shadow-camera-far={160} shadow-bias={-0.0004} shadow-normalBias={0.03} /> : null}
        <hemisphereLight color="#4a4a58" groundColor="#2a1c14" intensity={0.9} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[600, 600]} />
          <meshStandardMaterial color="#2b1b13" roughness={0.6} metalness={0} />
        </mesh>

        <Book id={p.id} coverAngle={p.coverAngle} turned={turned} pose={pose} ribbonSwing={0}>
          {p.faces ? <PageFaces id={p.id} coverAngle={p.coverAngle} turned={turned} right={frontOf(base + count)} left={base > 0 ? backOf(base - 1) : null} /> : null}
          {sheets.map((s) => (
            <Sheet
              key={s.rank}
              id={p.id}
              coverAngle={p.coverAngle}
              turned={turned}
              baseTurned={base}
              progress={s.P}
              landSec={s.landSec}
              place={s.place}
              index={s.index}
              front={frontOf(s.index)}
              back={backOf(s.index)}
              cpu={p.cpu}
              wire={p.mesh}
              blob={p.decal}
            />
          ))}
          {p.hinge ? <Hinge x={hinge[0]} y={hinge[1]} z0={layout.zHead - 1} z1={layout.zHead + layout.H + 1} color="#ffe14a" /> : null}
        </Book>
      </ThreeCanvas>

      {p.panel ? (
        <div style={{ position: "absolute", left: 36, top: 26, fontSize: 21, lineHeight: 1.5, ...mono }}>
          <div style={{ fontSize: 32 }}>
            PAGE TURN · {p.id} · {riffle ? `riffle of ${p.count}` : useQuick ? "quick turn" : "single turn"}
          </div>
          <div>
            frame {p.frame} · {riffle && span ? `sheets start at ${span.first} to ${fmt(span.lastStart, 0)} (${fmt(span.startsSpan, 0)} f), the last lands at ${fmt(span.last, 0)}` : `the turn is ${length} f, it lands at ${length}`} · {SHEET.turn.ease} ease
          </div>
          <div>
            sheet {first.index} (of {total}): P {fmt(first.P, 3)} · {first.landSec > 0 ? `landed ${fmt(first.landSec, 2)} s ago` : "in the air or not yet turned"} · shadow on the {blob.side} stack, {fmt(blob.height)} cm up, opacity {fmt(blob.opacity)} · stacks {fmt(turned, 2)} of {total} turned
          </div>
          <div style={{ marginTop: 6 }}>length read-out of sheet {first.index} (row = gutter to outer edge, W {fmt(layout.W, 3)} cm; column = head to tail, H {fmt(layout.H, 3)} cm; tolerance {tol * 100}%)</div>
          {readout.map((r) => (
            <div key={r.P} style={{ color: worst(r) <= tol ? "#3be07a" : "#ff3b3b" }}>
              p {fmt(r.P)}: rows {pct(r.rowMin)} to {pct(r.rowMax)} · columns {pct(r.columnMin)} to {pct(r.columnMax)}
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};