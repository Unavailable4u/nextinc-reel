import React, { useEffect, useState } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { PILLARBOX, PLATE_H, PLATE_W } from "../config/plate";
import { EXCLUSIONS, FOOTPRINTS, ZONES, footprintCorners } from "../config/placement";
import { HEIGHT, WIDTH } from "../config/timeline";
import { PLATE_MATCH, VIEW_FIT, type PlateView } from "../plate/PlateFollow";
import {
  HORIZON_RANGE,
  MEASURED_DESK,
  buildMatchJson,
  formatMatchJson,
  deskEdgesPx,
  focalPx,
  hfovDeg,
  photoToOutput,
  principalY,
  projectDesk,
  pxPerCm,
  solveFromDeskEdges,
  unprojectToDesk,
  type MatchParams,
  type PlateMatchJson,
} from "../plate/plateCamera";
import { Stage } from "../stage";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

/** The three views the check of Patch 03 asks for (a box must look planted at all of them), plus the riser view. cx, cy are photo px at the screen centre. */
const PRESETS: Record<string, PlateView | null> = {
  free: null,
  "M1.25 whole plate": VIEW_FIT,
  "M2.46 end of S01": { M: 2.46, cx: 480, cy: 520 },
  "M4.49 pile view (S02)": { M: 4.49, cx: 418, cy: 545 },
  "M3.98 riser view (S23)": { M: 3.98, cx: 971, cy: 540 },
};
const PRESET_NAMES = ["free", "M1.25 whole plate", "M2.46 end of S01", "M4.49 pile view (S02)", "M3.98 riser view (S23)"] as const;

const base = PLATE_MATCH;
const BOX = { w: FOOTPRINTS.book.w, d: FOOTPRINTS.book.d, h: 2 } as const; // the test box: a trade book lying flat
const BAR = { w: 40, d: 4, h: 1 } as const; // stands in for the keyboard

/** Sliders in the Studio's right-hand panel. */
export const devMatchSchema = z.object({
  preset: z.enum(PRESET_NAMES),
  // the view, used when preset = free
  M: z.number().min(1).max(8).step(0.01),
  cx: z.number().min(0).max(PLATE_W).step(1),
  cy: z.number().min(0).max(PLATE_H).step(1),
  // the camera
  lockToDesk: z.boolean(),
  camHeightCm: z.number().min(10).max(90).step(0.05),
  camDistCm: z.number().min(150).max(900).step(0.1),
  fovDeg: z.number().min(10).max(55).step(0.01),
  pitchDeg: z.number().min(-6).max(6).step(0.05),
  horizonY: z.number().min(HORIZON_RANGE.min).max(HORIZON_RANGE.max).step(0.1),
  principalX: z.number().min(300).max(1236).step(0.1),
  // the scale: how big the desk is in cm (a design assumption)
  deskWidthCm: z.number().min(150).max(320).step(0.5),
  deskLeftCm: z.number().min(-120).max(0).step(0.05),
  deskDepthCm: z.number().min(40).max(90).step(0.5),
  // what is drawn
  showGrid: z.boolean(),
  showZones: z.boolean(),
  showExclusions: z.boolean(),
  showBox: z.boolean(),
  showBar: z.boolean(),
  showPanel: z.boolean(),
  // the test objects
  boxX: z.number().min(-60).max(190).step(0.5),
  boxZd: z.number().min(0).max(60).step(0.5),
  boxYawDeg: z.number().min(-45).max(45).step(1),
  barX: z.number().min(-60).max(190).step(0.5),
  barZd: z.number().min(0).max(60).step(0.5),
});
export type DevMatchProps = z.infer<typeof devMatchSchema>;
export const defaultDevMatchProps: DevMatchProps = {
  preset: "M4.49 pile view (S02)",
  M: 4.49,
  cx: 418,
  cy: 545,
  lockToDesk: false,
  camHeightCm: base.camHeightCm,
  camDistCm: base.camDistCm,
  fovDeg: base.fovDeg,
  pitchDeg: base.pitchDeg,
  horizonY: base.horizonY,
  principalX: base.principalX,
  deskWidthCm: base.deskXMaxCm - base.deskXMinCm,
  deskLeftCm: base.deskXMinCm,
  deskDepthCm: base.deskDepthCm,
  showGrid: true,
  showZones: true,
  showExclusions: false,
  showBox: true,
  showBar: false,
  showPanel: true,
  boxX: ZONES.L.anchor.X,
  boxZd: ZONES.L.anchor.Zd,
  boxYawDeg: 0,
  barX: 53.8,
  barZd: 26.1,
};

/** The match camera the sliders describe. With lockToDesk the camera is SOLVED from the horizon, the principal point and the desk's size, so the desk edges stay on the photo's. */
export function paramsFromProps(pr: DevMatchProps): MatchParams {
  if (pr.lockToDesk) return solveFromDeskEdges({ horizonY: pr.horizonY, principalX: pr.principalX, deskWidthCm: pr.deskWidthCm, deskDepthCm: pr.deskDepthCm, camXCm: base.camXCm, plateDepthCm: base.plateDepthCm });
  return {
    camXCm: base.camXCm,
    camHeightCm: pr.camHeightCm,
    camDistCm: pr.camDistCm,
    fovDeg: pr.fovDeg,
    pitchDeg: pr.pitchDeg,
    horizonY: pr.horizonY,
    principalX: pr.principalX,
    deskXMinCm: pr.deskLeftCm,
    deskXMaxCm: pr.deskLeftCm + pr.deskWidthCm,
    deskDepthCm: pr.deskDepthCm,
    plateDepthCm: base.plateDepthCm,
  };
}

const horizonChoiceOf = (y: number): string => (Math.abs(y - MEASURED_DESK.horizonFromDeskEdges) < 0.5 ? "desk-edges" : Math.abs(y - MEASURED_DESK.horizonFromRoomLines) < 0.5 ? "room-lines" : `custom (y ${y.toFixed(1)})`);

// ---------- 3D test objects (flat colours, no lights: Patch 04 adds those) ----------

const Slab: React.FC<{ X: number; Zd: number; w: number; d: number; h: number; yawDeg: number; colors: [string, string, string]; contact: boolean }> = ({ X, Zd, w, d, h, yawDeg, colors, contact }) => {
  const [top, front, side] = colors;
  const mats = React.useMemo(() => [side, side, top, "#1a1816", front, "#26231f"].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })), [top, front, side]);
  const edges = React.useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d]);
  return (
    <group position={[X, 0, -Zd]} rotation={[0, (yawDeg * Math.PI) / 180, 0]}>
      {contact ? (
        <>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
            <planeGeometry args={[w + 3.2, d + 3.2]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[w + 1.2, d + 1.2]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
          </mesh>
        </>
      ) : null}
      <mesh position={[0, h / 2, 0]} material={mats} renderOrder={3}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <lineSegments position={[0, h / 2, 0]} geometry={edges} renderOrder={4}>
        <lineBasicMaterial color="#fff3c4" toneMapped={false} />
      </lineSegments>
    </group>
  );
};

// ---------- the lab ----------

const f1 = (v: number): string => v.toFixed(1);
const f2 = (v: number): string => v.toFixed(2);
const sgn = (v: number): string => (v >= 0 ? "+" : "") + v.toFixed(2);

export const DevMatch: React.FC<DevMatchProps> = (pr) => {
  const p = paramsFromProps(pr);
  const view: PlateView = PRESETS[pr.preset] ?? { M: pr.M, cx: pr.cx, cy: pr.cy };
  const to = (x: number, y: number) => photoToOutput(view, x, y);
  const proj = (X: number, Y: number, Zd: number) => {
    const q = projectDesk(p, X, Y, Zd);
    return to(q.x, q.y);
  };
  const pts = (list: { x: number; y: number }[]): string => list.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ");
  const e = deskEdgesPx(p);
  const m = MEASURED_DESK;
  const f = focalPx(p);
  const json: PlateMatchJson = buildMatchJson(p, { status: "chosen", horizonChoice: horizonChoiceOf(p.horizonY) });
  const jsonText = formatMatchJson(json);
  const lock = solveFromDeskEdges({ horizonY: p.horizonY, principalX: p.principalX, deskWidthCm: p.deskXMaxCm - p.deskXMinCm, deskDepthCm: p.deskDepthCm, camXCm: p.camXCm });

  const [msg, setMsg] = useState("");
  useEffect(() => {
    (window as unknown as { __plateMatchJson?: string }).__plateMatchJson = jsonText;
  }, [jsonText]);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setMsg("copied");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = jsonText;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setMsg("copied");
      } catch {
        setMsg("select the text and copy it");
      }
      ta.remove();
    }
  };

  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };
  const svg: React.ReactNode[] = [];

  // the desk top as a translucent quad, and the grid every 10 cm
  const quad = [proj(p.deskXMinCm, 0, 0), proj(p.deskXMaxCm, 0, 0), proj(p.deskXMaxCm, 0, p.deskDepthCm), proj(p.deskXMinCm, 0, p.deskDepthCm)];
  svg.push(<polygon key="desk" points={pts(quad)} fill="#41e0ff" opacity={pr.showGrid ? 0.14 : 0.07} />);
  if (pr.showGrid) {
    for (let X = Math.ceil(p.deskXMinCm / 10) * 10; X <= p.deskXMaxCm; X += 10) {
      const a = proj(X, 0, 0);
      const b = proj(X, 0, p.deskDepthCm);
      svg.push(<line key={`gx${X}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={X === 0 ? "#b6ff5a" : "#41e0ff"} strokeWidth={X === 0 ? 2 : 1} opacity={X === 0 ? 0.95 : 0.55} />);
      if (X % 50 === 0) svg.push(<text key={`tx${X}`} x={a.x + 3} y={a.y + 17} fill="#41e0ff" fontSize={15} fontFamily={stacks.mono}>{X}</text>);
    }
    for (let Zd = 0; Zd <= p.deskDepthCm + 1e-9; Zd += 10) {
      const a = proj(p.deskXMinCm, 0, Zd);
      const b = proj(p.deskXMaxCm, 0, Zd);
      svg.push(<line key={`gz${Zd}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#41e0ff" strokeWidth={1} opacity={0.55} />);
      if (Zd > 0 && Zd % 20 === 0) svg.push(<text key={`tz${Zd}`} x={a.x + 4} y={a.y - 3} fill="#41e0ff" fontSize={15} fontFamily={stacks.mono}>Zd {Zd}</text>);
    }
  }
  // front edge and back edge
  const fl = to(e.front.xLeft, e.front.y);
  const fr = to(e.front.xRight, e.front.y);
  const bl = to(e.back.xLeft, e.back.y);
  const br = to(e.back.xRight, e.back.y);
  svg.push(<line key="front" x1={fl.x} y1={fl.y} x2={fr.x} y2={fr.y} stroke="#ffd23f" strokeWidth={3} />);
  svg.push(<line key="back" x1={bl.x} y1={bl.y} x2={br.x} y2={br.y} stroke="#ff4fd8" strokeWidth={3} />);
  // where the corners were measured on the plate (rings): the lines must pass through them
  const measured = [
    { k: "mfl", x: m.front.xLeft, y: m.front.y },
    { k: "mfr", x: m.front.xRight, y: m.front.y },
    { k: "mbl", x: m.back.xLeft, y: m.back.y },
    { k: "mbr", x: m.back.xRight, y: m.back.y },
  ];
  for (const c of measured) {
    const q = to(c.x, c.y);
    svg.push(<circle key={c.k} cx={q.x} cy={q.y} r={9} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.9} />);
  }
  // horizon lines: the chosen one, and the two candidates of D-25
  const hy = to(0, p.horizonY).y;
  svg.push(<line key="hz" x1={0} y1={hy} x2={WIDTH} y2={hy} stroke="#ffffff" strokeWidth={2} strokeDasharray="14 8" opacity={0.9} />);
  svg.push(<text key="hzt" x={WIDTH - 12} y={hy - 8} textAnchor="end" fill="#ffffff" fontSize={20} fontFamily={stacks.mono}>horizon y {f1(p.horizonY)}</text>);
  for (const [k, y, col, label] of [["hd", m.horizonFromDeskEdges, "#ff9f43", "desk edges 396"], ["hr", m.horizonFromRoomLines, "#b388ff", "room lines 464"]] as const) {
    const sy = to(0, y).y;
    svg.push(<line key={k} x1={0} y1={sy} x2={WIDTH} y2={sy} stroke={col} strokeWidth={1.5} strokeDasharray="3 7" opacity={0.85} />);
    svg.push(<text key={`${k}t`} x={12} y={sy - 6} fill={col} fontSize={18} fontFamily={stacks.mono}>{label}</text>);
  }
  // placement zones and anchors
  if (pr.showZones) {
    for (const id of ["L", "R"] as const) {
      const z = ZONES[id];
      const poly = [proj(z.x0, 0, z.zd0), proj(z.x1, 0, z.zd0), proj(z.x1, 0, z.zd1), proj(z.x0, 0, z.zd1)];
      svg.push(<polygon key={`z${id}`} points={pts(poly)} fill="#3ecf6a" fillOpacity={0.16} stroke="#3ecf6a" strokeWidth={2} />);
      const fp = id === "L" ? FOOTPRINTS.book : FOOTPRINTS.riser;
      const foot = footprintCorners(z.anchor.X, z.anchor.Zd, fp.w, fp.d).map((c) => proj(c.X, 0, c.Zd));
      svg.push(<polygon key={`f${id}`} points={pts(foot)} fill="none" stroke="#e8ffe8" strokeWidth={1.5} strokeDasharray="6 4" />);
      const a = proj(z.anchor.X, 0, z.anchor.Zd);
      svg.push(<circle key={`a${id}`} cx={a.x} cy={a.y} r={5} fill="#ffffff" />);
      svg.push(<text key={`zt${id}`} x={poly[3].x} y={poly[3].y - 8} fill="#aef5c1" fontSize={20} fontFamily={stacks.mono}>zone {id} · {z.name}</text>);
    }
  }
  if (pr.showExclusions) {
    for (const ex of EXCLUSIONS) {
      const a = to(ex.photoBox.x0, ex.photoBox.y0);
      const b = to(ex.photoBox.x1, ex.photoBox.y1);
      svg.push(<rect key={`e${ex.id}`} x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} fill="#ff4d4d" fillOpacity={0.12} stroke="#ff4d4d" strokeWidth={2} />);
      svg.push(<text key={`et${ex.id}`} x={a.x + 4} y={a.y + 20} fill="#ff9a9a" fontSize={18} fontFamily={stacks.mono}>{ex.id}</text>);
      if (ex.desk) {
        const d = ex.desk;
        const poly = [proj(d.x0, 0, d.zd0), proj(d.x1, 0, d.zd0), proj(d.x1, 0, d.zd1), proj(d.x0, 0, d.zd1)];
        svg.push(<polygon key={`ed${ex.id}`} points={pts(poly)} fill="none" stroke="#ff4d4d" strokeWidth={1.5} strokeDasharray="5 4" />);
      }
    }
  }

  // read-out numbers
  const kbL = unprojectToDesk(p, 553, 558);
  const kbR = unprojectToDesk(p, 670, 558);
  const kbW = kbL && kbR ? kbR.X - kbL.X : NaN;
  const row = (name: string, y: number, my: number, xl: number, mxl: number, xr: number, mxr: number): string =>
    `${name}: y ${f2(y)} (${sgn(y - my)}) · left x ${f2(xl)} (${sgn(xl - mxl)}) · right x ${f2(xr)} (${sgn(xr - mxr)})`;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage view={view} feather={PILLARBOX.feather} match={p}>
        {pr.showBar ? <Slab X={pr.barX} Zd={pr.barZd} w={BAR.w} d={BAR.d} h={BAR.h} yawDeg={0} colors={["#ff9be6", "#d155b0", "#a33d88"]} contact /> : null}
        {pr.showBox ? <Slab X={pr.boxX} Zd={pr.boxZd} w={BOX.w} d={BOX.d} h={BOX.h} yawDeg={pr.boxYawDeg} colors={["#7fe3ec", "#3fa5b0", "#2d7d86"]} contact /> : null}
      </Stage>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0 }}>
        {svg}
      </svg>
      <div style={{ position: "absolute", left: 30, top: 24, width: 1020, ...mono, fontSize: 18, lineHeight: 1.45 }}>
        <div style={{ fontSize: 30 }}>
          MATCH LAB · M {view.M.toFixed(2)} · centre ({view.cx.toFixed(0)}, {view.cy.toFixed(0)}) · {pr.preset}
        </div>
        <div>
          camera: height {f2(p.camHeightCm)} cm · distance {f1(p.camDistCm)} cm · fov {f2(p.fovDeg)}° (h {f1(hfovDeg(p))}°) · pitch {f2(p.pitchDeg)}° · f {f1(f)} px
          <br />
          horizon y {f1(p.horizonY)} · principal ({f1(p.principalX)}, {f1(principalY(p))}) · {pr.lockToDesk ? "LOCKED: the camera is solved from the desk edges" : "free sliders"}
        </div>
        <div style={{ marginTop: 6 }}>
          DESK EDGES in photo px (difference from the measured corners; rings on screen):
          <br />
          {row("front", e.front.y, m.front.y, e.front.xLeft, m.front.xLeft, e.front.xRight, m.front.xRight)}
          <br />
          {row("back ", e.back.y, m.back.y, e.back.xLeft, m.back.xLeft, e.back.xRight, m.back.xRight)}
        </div>
        <div style={{ marginTop: 6 }}>
          scale {f2(pxPerCm(p, 0))} px per cm at the front edge · desk {f1(p.deskXMaxCm - p.deskXMinCm)} x {f1(p.deskDepthCm)} cm · keyboard on the plate = {f1(kbW)} cm (the bar is 40)
          <br />
          to keep the desk match at this horizon: height {f2(lock.camHeightCm)} · distance {f1(lock.camDistCm)} · fov {f2(lock.fovDeg)}° (tick lockToDesk)
        </div>
      </div>
      {pr.showPanel ? (
        <div style={{ position: "absolute", right: 24, top: 24, width: 800, maxHeight: HEIGHT - 48, overflow: "hidden", background: "rgba(8,8,10,0.82)", border: "1px solid #3a3a40", borderRadius: 6, padding: 14, ...mono }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 18, marginBottom: 8 }}>
            <button onClick={copy} style={{ fontFamily: stacks.mono, fontSize: 18, padding: "6px 16px", background: "#2c2c32", color: "#F1EADB", border: "1px solid #6b6b74", borderRadius: 4, cursor: "pointer" }}>
              Copy JSON
            </button>
            <span>paste it into src/config/plateMatch.json {msg ? `· ${msg}` : ""}</span>
          </div>
          <pre style={{ margin: 0, fontSize: 14, lineHeight: 1.28, whiteSpace: "pre-wrap", wordBreak: "break-word", userSelect: "text", textShadow: "none" }}>{jsonText}</pre>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
