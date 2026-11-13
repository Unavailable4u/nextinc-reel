import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import { z } from "zod";
import { BOOKS, BOOK_IDS, sheetCount, type BookId, type BookPose } from "../config/books";
import { BOOK_SCRIPT, besidePose, coverEventsOf, getBookLocation, getBookState, movesAt, type BookMotionState, type TurnEvent } from "../config/ledger";
import { SHOTS, TOTAL, shotAt } from "../config/timeline";
import { ZONES } from "../config/placement";
import { Stage } from "../stage";
import { PLATE_MATCH, clampView, type PlateView } from "../plate/PlateFollow";
import { defaultLens, matchFocalMm, objectsNeedDefocus, type Lens } from "../camera/focus";
import { ObjectDefocus } from "../camera/ObjectDefocus";
import { LightRig } from "../light/Rig";
import { ProbeEnvironment } from "../light/ProbeEnvironment";
import { ContactDecal, ShadowCatcher } from "../plate/ShadowCatcher";
import { Book } from "../book/Book";
import { PageFaces, Sheet } from "../book/Sheet";
import { checkerTexture, pageTexture } from "../book/pageTextures";
import { turnFrames, turnProgress } from "../book/rig/turn";
import { coverDegrees } from "../book/rig/cover";
import { footprintOf } from "../book/rig/pose";
import { SINGLE } from "../book/sheetShape";
import { loadFonts, stacks } from "../lib/fonts";
import { loadBookPages, type BookPages } from "../paint/pages";

void loadFonts();

/** The two books that have a script so far (guide 01, Acts 2 to 6); the others are drawn where the ledger puts them. */
const SCRIPTED = ["mini-me", "minilocker"] as const;

/** The views of the lab: the camera's window of the plate (guide 05). The camera shots of Patches 14 and 15 will choose their own. */
const VIEWS = {
  "pile (S02)": { M: 4.49, cx: 418, cy: 545 },
  "hero (S05)": { M: 6.51, cx: 418, cy: 545 },
  "wide (S01)": { M: 2.46, cx: 480, cy: 520 },
  "set-down (S15)": { M: 3.4, cx: 480, cy: 540 },
} as const satisfies Record<string, PlateView>;
const VIEW_NAMES = ["pile (S02)", "hero (S05)", "wide (S01)", "set-down (S15)", "custom"] as const;

/** Sliders in the Studio's right-hand panel. */
export const devBookMotionSchema = z.object({
  /** the book the panel follows and whose pages are painted */
  id: z.enum(SCRIPTED),
  /** THE SCRUBBER: the film's frame. Mini Me lifts at 960 and is set down at 2880; MiniLocker lifts at 3000 and is set down at 3840 */
  frame: z.number().int().min(0).max(TOTAL - 1),
  /** the film's own camera window of the plate, or `custom` for the M, cx and cy below */
  view: z.enum(VIEW_NAMES),
  M: z.number().min(1.25).max(8).step(0.01),
  cx: z.number().min(0).max(1536).step(1),
  cy: z.number().min(0).max(864).step(1),
  /** a checker (the front's gutter is orange, the back's is blue) or the painted pages of Patch 09, on the followed book */
  texture: z.enum(["checker", "page"]),
  /** -1: the sheets turned and the cover angle come from the script. 0 or more: hold that many sheets turned (for the spreads of Gate G1) */
  turnedOverride: z.number().int().min(-1).max(126),
  /** the cover angle in degrees when `turnedOverride` is on (165 is the held book's) */
  coverOverrideDeg: z.number().min(0).max(185).step(1),
  /** milliseconds a still or render waits before the capture, for a machine without a GPU where the first draw is slow (10000 is plenty); 0 for none */
  settleMs: z.number().int().min(0).max(60000).step(500),
  /** the painted covers of Patch 08 (slower to start: they wait for the fonts); off for the plain boards */
  covers: z.boolean(),
  /** the desk lamp's soft shadow (the books also have their baked contact patches); off for a quick look or a machine without a GPU */
  shadows: z.boolean(),
  /** the depth-of-field pass on the books (the plate is always defocused by the lens) */
  defocus: z.boolean(),
  /** the lens's f-number: the books are in focus at f/8 and soften below it */
  fNumber: z.number().min(1.4).max(11).step(0.1),
  panel: z.boolean(),
});
export type DevBookMotionProps = z.infer<typeof devBookMotionSchema>;
export const defaultDevBookMotionProps: DevBookMotionProps = {
  id: "mini-me",
  frame: 1007,
  view: "hero (S05)",
  M: 6.51,
  cx: 418,
  cy: 545,
  texture: "checker",
  turnedOverride: -1,
  coverOverrideDeg: 165,
  settleMs: 0,
  covers: false,
  shadows: true,
  defocus: true,
  fNumber: 4,
  panel: true,
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

/** The sheets turned to the left, and whether a sheet is in the air, at a frame, from a script's turns (`TurnEvent`s of the ledger). */
function stacksAt(frame: number, turns: readonly TurnEvent[]): { left: number; airborne: boolean } {
  let left = 0;
  let airborne = false;
  for (const e of turns) {
    const len = turnFrames(e.quick ?? false);
    const P = turnProgress(frame, e.start, len);
    if (e.dir === -1) {
      if (frame >= e.start) left -= 1;
      if (frame >= e.start && P < 1) airborne = true;
    } else {
      if (P >= 1) left += 1;
      if (frame >= e.start && P < 1) airborne = true;
    }
  }
  return { left, airborne };
}

const fmt = (v: number, d = 2): string => v.toFixed(d);

/** The overlap, in cm, of the footprints of two closed books lying on the desk (0 if they do not touch): a check on the places beside the pile. */
function overlapCm(a: { id: BookId; pose: BookPose }, b: { id: BookId; pose: BookPose }): number {
  const box = (x: { id: BookId; pose: BookPose }) => {
    const f = footprintOf(x.id, x.pose);
    const xs = f.map((c) => c.X);
    const zs = f.map((c) => c.Zd);
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  };
  const p = box(a);
  const q = box(b);
  const ox = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0);
  const oz = Math.min(p.z1, q.z1) - Math.max(p.z0, q.z0);
  return ox > 0 && oz > 0 ? Math.min(ox, oz) : 0;
}

/**
 * THE BOOK MOTION LAB (Patch 11). The scripted books of the ledger (`getBookState`) on the desk, under the film's own lights and plate,
 * at the frame you scrub to: the pile, the lift (press, rise, overshoot and settle), the hold with its hand-held sway, the cover opening
 * and closing, the page turns in the air, the carry and the set-down. The panel names the move under way and prints the numbers the
 * rigs produce; `turnedOverride` holds any spread open for the stills of Gate G1. Tune `src/config/bookMotion.ts` by looking here.
 *
 * Mini Me: lift 960, open 1440, turns 1560 and 1680, close 2808, set down 2880. MiniLocker: lift 3000, open 3360, close 3828, set down 3840.
 */
export const DevBookMotion: React.FC<DevBookMotionProps> = (p) => {
  // a render hold for a machine without a GPU: the first draw of several books (their shaders compile) can take seconds, and a still taken
  // before it is black. Held from the first render, outside the canvas' own Suspense; 0 (the default) holds nothing.
  useEffect(() => {
    if (!(p.settleMs > 0)) return;
    const h = delayRender("Letting the books be drawn");
    const t = setTimeout(() => continueRender(h), p.settleMs);
    return () => {
      clearTimeout(t);
      continueRender(h);
    };
  }, [p.settleMs, p.frame]);
  const spec = BOOKS[p.id];
  const script = BOOK_SCRIPT[p.id];
  const view = useMemo<PlateView>(() => clampView(p.view === "custom" ? { M: p.M, cx: p.cx, cy: p.cy } : VIEWS[p.view]).view, [p.view, p.M, p.cx, p.cy]);
  const lens = useMemo<Lens>(() => ({ ...defaultLens(PLATE_MATCH), focalMm: matchFocalMm(PLATE_MATCH), fNumber: p.fNumber }), [p.fNumber]);

  const held = p.turnedOverride >= 0;
  const turns = script?.turns ?? [];
  const pages = useBookPages(p.id, p.texture === "page");
  const checker = useMemo(() => ({ front: checkerTexture("front"), back: checkerTexture("back") }), []);
  useEffect(() => () => [checker.front, checker.back].forEach((t) => t.dispose()), [checker]);
  const pageOf = (index: number): THREE.Texture | null => {
    const pg = pages?.pages[index];
    return pg ? pageTexture(pg.canvas) : null;
  };
  /** the front of leaf k is the odd page 2k + 1, its back is 2k + 2 */
  const frontOf = (k: number): THREE.Texture | null => (p.texture === "checker" ? checker.front : pageOf(2 * k + 1));
  const backOf = (k: number): THREE.Texture | null => (p.texture === "checker" ? checker.back : pageOf(2 * k + 2));

  const states = BOOK_IDS.map((id) => ({ id, state: getBookState(id, p.frame) })).filter((x): x is { id: BookId; state: BookMotionState } => x.state !== null);
  const followed = states.find((x) => x.id === p.id)?.state ?? null;
  if (p.texture === "page" && !pages) return null;

  const shot = shotAt(p.frame);
  const moves = movesAt(p.id, p.frame);
  const resting = states.filter((x) => (x.state.location === "pile" || x.state.location === "beside") && x.state.pose.position[1] < 0.4 && Math.abs(x.state.pose.pitchDeg ?? 0) < 1);
  const beside = states.filter((x) => x.state.location === "beside" && x.state.pose.position[1] < 0.4);
  const overlaps: string[] = [];
  for (let i = 0; i < beside.length; i++) for (let j = i + 1; j < beside.length; j++) {
    const o = overlapCm(
      { id: beside[i].id, pose: besidePose(beside[i].id) },
      { id: beside[j].id, pose: besidePose(beside[j].id) },
    );
    if (o > 0) overlaps.push(`${beside[i].id} and ${beside[j].id} overlap by ${fmt(o, 1)} cm`);
  }

  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };
  const objNeed = p.defocus && objectsNeedDefocus(lens, view.M, PLATE_MATCH.camDistCm - 25, PLATE_MATCH.camDistCm + 60);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage view={view} lens={lens}>
        <LightRig frame={p.frame} shadows={p.shadows} />
        <ProbeEnvironment />
        <ShadowCatcher />
        {resting.map(({ id, state }) => (
          <ContactDecal key={`decal-${id}`} X={state.pose.position[0]} Zd={-state.pose.position[2]} w={BOOKS[id].trimW} d={BOOKS[id].trimH} yawDeg={state.pose.yawDeg ?? 0} />
        ))}
        {states.map(({ id, state }) => {
          const isFollowed = id === p.id;
          const turned = isFollowed && held ? Math.min(p.turnedOverride, sheetCount(BOOKS[id])) : state.turned;
          const coverAngle = isFollowed && held ? p.coverOverrideDeg / 180 : state.coverAngle;
          const open = coverAngle > 0.02;
          const st = isFollowed && !held ? stacksAt(p.frame, turns) : { left: Math.round(turned), airborne: false };
          const air = isFollowed && !held ? state.airSheets : [];
          return (
            <Book key={id} id={id} covers={p.covers} pose={state.pose} coverAngle={coverAngle} turned={turned} ribbonSwing={state.ribbonSwing}>
              {isFollowed && open ? <PageFaces id={id} coverAngle={coverAngle} turned={turned} right={frontOf(st.left + (st.airborne ? 1 : 0))} left={st.left > 0 ? backOf(st.left - 1) : null} /> : null}
              {air.map((s) => (
                <Sheet key={`${s.index}-${s.baseTurned}`} id={id} coverAngle={coverAngle} turned={turned} baseTurned={s.baseTurned} progress={s.progress} landSec={s.landSec} place={SINGLE} index={s.index} front={frontOf(s.index)} back={backOf(s.index)} />
              ))}
            </Book>
          );
        })}
        {objNeed ? <ObjectDefocus lens={lens} M={view.M} /> : null}
      </Stage>

      {p.panel ? (
        <div style={{ position: "absolute", left: 36, top: 26, fontSize: 21, lineHeight: 1.5, ...mono }}>
          <div style={{ fontSize: 32 }}>
            BOOK MOTION · {p.id} · f{String(p.frame).padStart(4, "0")} · {shot.id} {shot.name}
          </div>
          <div>
            {moves.length ? moves.join(" + ") : "at rest or held"} · {getBookLocation(p.id, p.frame)} · weight {spec.weightG} g · view M {fmt(view.M)} · f/{fmt(p.fNumber, 1)}
          </div>
          {followed ? (
            <>
              <div style={{ fontSize: 18, opacity: 0.9 }}>
                {held ? `HELD: ${p.turnedOverride} sheets turned, cover ${p.coverOverrideDeg} deg` : `cover ${fmt(coverDegrees(followed.coverAngle), 1)} deg · sheets turned ${fmt(followed.turned, 2)} · ${followed.airSheets.length} sheet(s) in the air`} · ribbon {fmt(followed.ribbonSwing)}
              </div>
              <div style={{ fontSize: 18, opacity: 0.9 }}>
                position {followed.pose.position.map((v) => fmt(v)).join(", ")} cm · yaw {fmt(followed.pose.yawDeg ?? 0, 1)} pitch {fmt(followed.pose.pitchDeg ?? 0, 1)} roll {fmt(followed.pose.rollDeg ?? 0, 1)} deg
              </div>
            </>
          ) : (
            <div style={{ fontSize: 18, color: "#ffb347" }}>this book is not drawn at this frame (under the chair wipe's swap, or not in the scene yet)</div>
          )}
          {overlaps.length ? <div style={{ fontSize: 18, color: "#ff5a4a" }}>books beside the pile overlap: {overlaps.join("; ")}</div> : null}
          <div style={{ fontSize: 16, opacity: 0.7 }}>
            cover events {coverEventsOf(p.id).map((e) => `${e.kind} ${e.start}`).join(", ")} · shots {SHOTS.length} · pile anchor X {ZONES.L.anchor.X}, Zd {ZONES.L.anchor.Zd}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
