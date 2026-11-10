import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BAR, BEAT, FPS, TOTAL, clockAt, shotAt, timecode } from "./config/timeline";
import { PILLARBOX } from "./config/plate";
import { VIEW_FIT, type PlateView } from "./plate/PlateFollow";
import { Stage } from "./stage";
import { loadFonts, stacks } from "./lib/fonts";

void loadFonts();

export type ReelFilmProps = {
  /** the frame / beat / bar / shot readout (top-left). On while working, off for real renders and for `plate:verify`. */
  hud: boolean;
  /** the feather that joins the photo to the pillarbox (0 px for the 16:9 plate, so this switch changes nothing at the opening view). Off = the bare photo (used by `plate:verify`). */
  feather: boolean;
  /** an explicit view of the photo; when absent the film uses the opening view (the whole photo, filling the frame) */
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
 * THE FILM (patches 00-02: the photograph, plus the readout). Shots are added from Patch 13 on; this file is then
 * the only place that concatenates them.
 */
export const ReelFilm: React.FC<ReelFilmProps> = ({ hud, feather, view }) => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage view={view ?? VIEW_FIT} feather={feather ? PILLARBOX.feather : 0} />
      {hud ? <Readout /> : null}
    </AbsoluteFill>
  );
};
