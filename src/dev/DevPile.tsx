import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { z } from "zod";
import { BOOKS, BOOK_IDS, PILE, type BookId } from "../config/books";
import { besidePose, getBookLocation, movesAt } from "../config/ledger";
import { DUST } from "../config/dust";
import { SHOTS, TOTAL, shotAt } from "../config/timeline";
import { ZONES } from "../config/placement";
import { Stage } from "../stage";
import { PLATE_MATCH, clampView, type PlateView } from "../plate/PlateFollow";
import { defaultLens, matchFocalMm, objectsNeedDefocus, type Lens } from "../camera/focus";
import { ObjectDefocus } from "../camera/ObjectDefocus";
import { LightRig } from "../light/Rig";
import { ProbeEnvironment } from "../light/ProbeEnvironment";
import { ShadowCatcher } from "../plate/ShadowCatcher";
import { Pile } from "../scene/Pile";
import { Dust } from "../scene/Dust";
import { dustAt, dustSources } from "../scene/dustField";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

/** The views of the lab: the camera's window of the plate (guide 05); the stills of the patch are at M = 4.49. */
const VIEWS = {
  "pile (S02)": { M: 4.49, cx: 418, cy: 545 },
  "hero (S05)": { M: 6.51, cx: 418, cy: 545 },
  "wide (S01)": { M: 2.46, cx: 480, cy: 520 },
  "left of the desk": { M: 2.9, cx: 330, cy: 540 },
} as const satisfies Record<string, PlateView>;
const VIEW_NAMES = ["pile (S02)", "hero (S05)", "wide (S01)", "left of the desk", "custom"] as const;

/** Sliders in the Studio's right-hand panel. */
export const devPileSchema = z.object({
  /** THE SCRUBBER: the film's frame. The pile is whole until 960; Mini Me lifts at 960 and is set down at 2880; MiniLocker lifts at 3000 and is set down at 3840 */
  frame: z.number().int().min(0).max(TOTAL - 1),
  view: z.enum(VIEW_NAMES),
  M: z.number().min(1.25).max(8).step(0.01),
  cx: z.number().min(0).max(1536).step(1),
  cy: z.number().min(0).max(864).step(1),
  /** the dust in the lamp's cone (it is stirred by the lifts, the closes and the set-downs) */
  dust: z.boolean(),
  /** a multiple of the film's dust level: 1 is the film's, more to see where the motes are */
  dustGain: z.number().min(0).max(6).step(0.1),
  /** the painted covers of Patch 08 (slower to start: they wait for the fonts); off for the plain boards */
  covers: z.boolean(),
  /** the desk lamp's soft shadow (the books also have their baked contact patches); off for a quick look or a machine without a GPU */
  shadows: z.boolean(),
  /** the baked contact patches under the books on the desk */
  decals: z.boolean(),
  defocus: z.boolean(),
  fNumber: z.number().min(1.4).max(11).step(0.1),
  /** milliseconds a still or render waits before the capture, for a machine without a GPU where the first draw is slow (10000 is plenty); 0 for none */
  settleMs: z.number().int().min(0).max(60000).step(500),
  panel: z.boolean(),
});
export type DevPileProps = z.infer<typeof devPileSchema>;
export const defaultDevPileProps: DevPileProps = {
  frame: 840,
  view: "pile (S02)",
  M: 4.49,
  cx: 418,
  cy: 545,
  dust: true,
  dustGain: 1,
  covers: false,
  shadows: true,
  decals: true,
  defocus: true,
  fNumber: 8,
  settleMs: 0,
  panel: true,
};

const fmt = (v: number, d = 2): string => v.toFixed(d);

/**
 * THE PILE LAB (Patch 12). The three-book pile on the desk under the film's own plate and lights, with the two spots beside it and the
 * dust in the lamp's cone, at the frame you scrub to. The panel prints where each book is by the ledger, the pile's offsets, how many
 * motes the lamp lights and which source is stirring them. Stills: M = 4.49 at frame 840 (the pile), and any frame of the lifts and
 * set-downs to see the dust move.
 */
export const DevPile: React.FC<DevPileProps> = (p) => {
  useEffect(() => {
    if (!(p.settleMs > 0)) return;
    const h = delayRender("Letting the books be drawn");
    const t = setTimeout(() => continueRender(h), p.settleMs);
    return () => {
      clearTimeout(t);
      continueRender(h);
    };
  }, [p.settleMs, p.frame]);
  const view = useMemo<PlateView>(() => clampView(p.view === "custom" ? { M: p.M, cx: p.cx, cy: p.cy } : VIEWS[p.view]).view, [p.view, p.M, p.cx, p.cy]);
  const lens = useMemo<Lens>(() => ({ ...defaultLens(PLATE_MATCH), focalMm: matchFocalMm(PLATE_MATCH), fNumber: p.fNumber }), [p.fNumber]);
  const objNeed = p.defocus && objectsNeedDefocus(lens, view.M, PLATE_MATCH.camDistCm - 25, PLATE_MATCH.camDistCm + 60);
  const sources = useMemo(() => dustSources(), []);
  const shot = shotAt(p.frame);
  const motes = p.dust ? dustAt(p.frame, sources).length : 0;
  const stirring = sources.filter((s) => p.frame > s.frame && p.frame - s.frame < 60 * (DUST.disturb.riseSec + 4 * DUST.disturb.fallSec));
  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage view={view} lens={lens}>
        <LightRig frame={p.frame} shadows={p.shadows} />
        <ProbeEnvironment />
        <ShadowCatcher />
        <Pile frame={p.frame} covers={p.covers} shadows={p.shadows} decals={p.decals} />
        {p.dust ? <Dust frame={p.frame} sources={sources} level={DUST.level * p.dustGain} /> : null}
        {objNeed ? <ObjectDefocus lens={lens} M={view.M} /> : null}
      </Stage>

      {p.panel ? (
        <div style={{ position: "absolute", left: 36, top: 26, fontSize: 21, lineHeight: 1.5, ...mono }}>
          <div style={{ fontSize: 32 }}>
            PILE · f{String(p.frame).padStart(4, "0")} · {shot.id} {shot.name}
          </div>
          <div>
            view M {fmt(view.M)} · f/{fmt(p.fNumber, 1)} · pile anchor X {ZONES.L.anchor.X}, Zd {ZONES.L.anchor.Zd} · {motes} motes lit
          </div>
          {BOOK_IDS.map((id: BookId) => {
            const slot = PILE.find((s) => s.id === id);
            const where = getBookLocation(id, p.frame);
            const moves = movesAt(id, p.frame);
            const beside = id === "mini-me" || id === "minilocker" ? besidePose(id) : null;
            return (
              <div key={id} style={{ fontSize: 17, opacity: 0.92 }}>
                {BOOKS[id].volume} {id} · {where}
                {moves.length ? ` · ${moves.join(" + ")}` : ""}
                {slot ? ` · pile yaw +${slot.yawDeg} dx ${fmt(slot.dx, 1)} dzd ${fmt(slot.dzd, 1)}` : ""}
                {beside ? ` · beside X ${fmt(beside.position[0], 1)} Zd ${fmt(-beside.position[2], 1)}` : ""}
              </div>
            );
          })}
          <div style={{ fontSize: 16, opacity: 0.75 }}>
            dust: {stirring.length ? stirring.map((s) => `${s.what} (f${s.frame})`).join(", ") : "undisturbed"} · {sources.length} sources in the film · shots {SHOTS.length}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
