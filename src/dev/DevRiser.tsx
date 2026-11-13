import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { z } from "zod";
import { RISER } from "../config/books";
import { TOTAL, shotAt } from "../config/timeline";
import { ZONES } from "../config/placement";
import { riserFootprint, riserSlots } from "../config/riser";
import { Stage } from "../stage";
import { PLATE_MATCH, clampView, type PlateView } from "../plate/PlateFollow";
import { defaultLens, matchFocalMm, objectsNeedDefocus, type Lens } from "../camera/focus";
import { ObjectDefocus } from "../camera/ObjectDefocus";
import { LightRig } from "../light/Rig";
import { ProbeEnvironment } from "../light/ProbeEnvironment";
import { ShadowCatcher } from "../plate/ShadowCatcher";
import { Riser, riserBooksAt } from "../scene/Riser";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

/** The views of the lab: the camera's window of the plate (guide 05); the stills of the patch are at M = 3.98 (S23's view). */
const VIEWS = {
  "riser (S23)": { M: 3.98, cx: 971, cy: 545 },
  "hero": { M: 6.51, cx: 971, cy: 545 },
  "right of the desk": { M: 2.9, cx: 1100, cy: 540 },
} as const satisfies Record<string, PlateView>;
const VIEW_NAMES = ["riser (S23)", "hero", "right of the desk", "custom"] as const;

/** Sliders in the Studio's right-hand panel. */
export const devRiserSchema = z.object({
  /** THE SCRUBBER: the film's frame. The riser is bare until 4140 (the swap), Immersive stands on it from 4140 and the other three from 4200 */
  frame: z.number().int().min(0).max(TOTAL - 1),
  view: z.enum(VIEW_NAMES),
  M: z.number().min(1.25).max(8).step(0.01),
  cx: z.number().min(0).max(1536).step(1),
  cy: z.number().min(0).max(864).step(1),
  /** `ledger`: the books the ledger puts on the riser at the frame; `all`: the four, whatever the frame; `none`: the bare riser */
  books: z.enum(["ledger", "all", "none"]),
  covers: z.boolean(),
  shadows: z.boolean(),
  defocus: z.boolean(),
  fNumber: z.number().min(1.4).max(11).step(0.1),
  /** milliseconds a still or render waits before the capture, for a machine without a GPU where the first draw is slow (10000 is plenty); 0 for none */
  settleMs: z.number().int().min(0).max(60000).step(500),
  panel: z.boolean(),
});
export type DevRiserProps = z.infer<typeof devRiserSchema>;
export const defaultDevRiserProps: DevRiserProps = {
  frame: 4580,
  view: "riser (S23)",
  M: 3.98,
  cx: 971,
  cy: 545,
  books: "ledger",
  covers: false,
  shadows: true,
  defocus: true,
  fNumber: 8,
  settleMs: 0,
  panel: true,
};

const fmt = (v: number, d = 2): string => v.toFixed(d);

/**
 * THE RISER LAB (Patch 12). The two-tier walnut riser with its brass lips and the four standing books under the film's own plate and
 * lights, at the frame you scrub to. The panel prints the footprint, the tiers and where each book stands. Stills: M = 3.98 at frame
 * 4580 (S23's view with the books on the riser).
 */
export const DevRiser: React.FC<DevRiserProps> = (p) => {
  useEffect(() => {
    if (!(p.settleMs > 0)) return;
    const h = delayRender("Letting the riser be drawn");
    const t = setTimeout(() => continueRender(h), p.settleMs);
    return () => {
      clearTimeout(t);
      continueRender(h);
    };
  }, [p.settleMs, p.frame]);
  const view = useMemo<PlateView>(() => clampView(p.view === "custom" ? { M: p.M, cx: p.cx, cy: p.cy } : VIEWS[p.view]).view, [p.view, p.M, p.cx, p.cy]);
  const lens = useMemo<Lens>(() => ({ ...defaultLens(PLATE_MATCH), focalMm: matchFocalMm(PLATE_MATCH), fNumber: p.fNumber }), [p.fNumber]);
  const objNeed = p.defocus && objectsNeedDefocus(lens, view.M, PLATE_MATCH.camDistCm - 25, PLATE_MATCH.camDistCm + 60);
  const shot = shotAt(p.frame);
  const fp = riserFootprint();
  const slots = riserSlots();
  const onIt = riserBooksAt(p.frame);
  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage view={view} lens={lens}>
        <LightRig frame={p.frame} shadows={p.shadows} />
        <ProbeEnvironment />
        <ShadowCatcher />
        <Riser frame={p.frame} books={p.books} covers={p.covers} shadows={p.shadows} />
        {objNeed ? <ObjectDefocus lens={lens} M={view.M} /> : null}
      </Stage>

      {p.panel ? (
        <div style={{ position: "absolute", left: 36, top: 26, fontSize: 21, lineHeight: 1.5, ...mono }}>
          <div style={{ fontSize: 32 }}>
            RISER · f{String(p.frame).padStart(4, "0")} · {shot.id} {shot.name}
          </div>
          <div>
            view M {fmt(view.M)} · f/{fmt(p.fNumber, 1)} · zone R anchor X {ZONES.R.anchor.X}, Zd {ZONES.R.anchor.Zd} · on it by the ledger: {onIt.length ? onIt.join(", ") : "nothing"}
          </div>
          <div style={{ fontSize: 17, opacity: 0.9 }}>
            footprint X {fmt(fp.x0, 1)} to {fmt(fp.x1, 1)}, Zd {fmt(fp.zd0, 1)} to {fmt(fp.zd1, 1)} · lower tier top {RISER.lowerTopCm} cm, upper {fmt(RISER.lowerTopCm + RISER.riseCm, 1)} cm, step {RISER.setBackCm} cm back · lean {RISER.leanDeg} deg
          </div>
          {slots.map((s) => (
            <div key={s.id} style={{ fontSize: 17, opacity: 0.92 }}>
              Vol. {s.volume} {s.id} · {s.tier} · position {s.pose.position.map((v) => fmt(v)).join(", ")} · yaw {fmt(s.pose.yawDeg ?? 0, 1)} pitch {fmt(s.pose.pitchDeg ?? 0, 1)}
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
