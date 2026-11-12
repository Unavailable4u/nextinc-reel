import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BAR, BEAT, FPS, TOTAL, clockAt, shotAt, timecode } from "./config/timeline";
import { PILLARBOX } from "./config/plate";
import type { PlateView } from "./plate/PlateFollow";
import { Stage } from "./stage";
import { CameraRig } from "./camera/CameraRig";
import { loadFonts, stacks } from "./lib/fonts";

void loadFonts();

export type ReelFilmProps = {
  /** the frame / beat / bar / shot readout (top-left). On while working, off for real renders and for `plate:verify`. */
  hud: boolean;
  /** the feather that joins the photo to the pillarbox (0 px for the 16:9 plate, so this switch changes nothing at the opening view). Off = the bare photo (used by `plate:verify`). */
  feather: boolean;
  /** an explicit view of the photo (no camera rig, no lens); when absent the camera rig drives the view, the roll and the lens from the keyframes */
  view?: PlateView;
};

export const defaultReelFilmProps: ReelFilmProps = { hud: true, feather: true };

const Readout: React.FC = () => {
  const frame = useCurrentFrame();
  const shot = shotAt(frame);
  const c = clockAt(frame);
  const text: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };
  return (
    <div style={{ position: "absolute", left: 36, top: 30, ...text, fontSize: 24, lineHeight: 1.4 }}>
      <div>
        {shot.id} · {shot.name}
      </div>
      <div style={{ fontSize: 20, opacity: 0.8 }}>
        f{String(frame).padStart(4, "0")}/{TOTAL} · {timecode(frame)} · bar {c.bar + 1} beat {c.beatInBar + 1} · {shot.regime} · {FPS} fps · beat {BEAT} f · bar {BAR} f
      </div>
    </div>
  );
};

/**
 * THE FILM. Patches 00-04: the photograph, the readout. Patch 05: the camera rig drives the view, the roll and the lens from the
 * keyframes of `src/config/camera.ts` plus the operator model (S00-S03 for now; the camera holds its last state after frame 960).
 * Shots are added from Patch 13 on; this file is then the only place that concatenates them.
 */
export const ReelFilm: React.FC<ReelFilmProps> = ({ hud, feather, view }) => {
  const bar = feather ? PILLARBOX.feather : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {view ? <Stage view={view} feather={bar} /> : <CameraRig feather={bar} />}
      {hud ? <Readout /> : null}
    </AbsoluteFill>
  );
};
