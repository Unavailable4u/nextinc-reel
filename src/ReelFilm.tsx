import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BAR, BEAT, FPS, TOTAL, clockAt, shotAt, timecode } from "./config/timeline";
import { PILLARBOX } from "./config/plate";
import type { PlateView } from "./plate/PlateFollow";
import { Stage } from "./stage";
import { CameraRig } from "./camera/CameraRig";
import { LightRig } from "./light/Rig";
import { ProbeEnvironment } from "./light/ProbeEnvironment";
import { ShadowCatcher } from "./plate/ShadowCatcher";
import { Pile } from "./scene/Pile";
import { useActPages } from "./scene/useActPages";
import { Riser, riserBooksAt } from "./scene/Riser";
import { Dust } from "./scene/Dust";
import { Grain } from "./fx/Grain";
import { Vignette } from "./fx/Vignette";
import { FILM_CAMERA_KEYFRAMES, activeShot } from "./shots";
import { loadFonts, stacks } from "./lib/fonts";

void loadFonts();

export type ReelFilmProps = {
  /** the frame / beat / bar / shot readout (top-left). On while working, off for real renders and for `plate:verify`. */
  hud: boolean;
  /** the feather that joins the photo to the pillarbox (0 px for the 16:9 plate, so this switch changes nothing at the opening view). Off = the bare photo (used by `plate:verify`). */
  feather: boolean;
  /** an explicit view of the photo (no camera rig, no lens); when absent the camera rig drives the view, the roll and the lens from the keyframes */
  view?: PlateView;
  /** the set: the lights, the shadow catcher, the pile, the riser and the dust. Off = the photograph alone (what `plate:verify` renders). Default on. */
  scene?: boolean;
  /** the film grain over the whole frame (placeholder, Patch 22 tunes it). Default on. */
  grain?: boolean;
  /** the vignette over the whole frame (placeholder, Patch 22 tunes it). Default on. */
  vignette?: boolean;
};

export const defaultReelFilmProps: ReelFilmProps = { hud: true, feather: true, scene: true, grain: true, vignette: true };

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
 * THE SET, composed the way `DevPile` composes it (Patch 12): the lights, the environment the glossy materials reflect, the shadow
 * catcher, the pile (every book the ledger puts on the left of the desk), the riser and the dust. Children of <Stage>, world space.
 * The open book's pages come from `useActPages` (the textures of the frame's act). Every part is a pure function of `frame`; where a book is comes from the ledger, never from a shot. Exported so that `DevShotStrip`
 * draws its cells with this set and not a copy of it.
 *
 * The riser is drawn from the first frame the ledger puts a book on it (the swap under the chair wipe) and not before: it is not in the
 * photograph, so a riser drawn at frame 0 would stand at the right end of the desk in the opening shot.
 */
export const FilmSet: React.FC<{ frame: number }> = ({ frame }) => {
  // the painted pages of the open book of the frame's act (Patch 15): painted on first need, the render waits for them, freed after the act
  const pages = useActPages(frame);
  return (
    <>
      <LightRig frame={frame} />
      <ProbeEnvironment />
      <ShadowCatcher />
      <Pile frame={frame} pages={pages} />
      {riserBooksAt(frame).length > 0 ? <Riser frame={frame} /> : null}
      <Dust frame={frame} />
    </>
  );
};

/**
 * THE OVERLAY LAYER: the 2D layer of the active shot (the labels of S23, the wordmark of S24), drawn above the canvas. It asks the
 * registry which shot the frame belongs to and draws that shot's overlay if it has one; it never names a shot. An overlay is a component
 * without props that calls `useCurrentFrame()` for the film frame (it is not inside a <Sequence>). Exported for `DevShotStrip`, which
 * draws it inside a <Freeze> at the frame of each cell.
 */
export const OverlayLayer: React.FC<{ frame: number }> = ({ frame }) => {
  const Overlay = activeShot(frame).overlay;
  if (!Overlay) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Overlay />
    </AbsoluteFill>
  );
};

/**
 * THE FILM. Patches 00-04: the photograph, the readout. Patch 05: the camera rig drives the view, the roll and the lens from the
 * keyframes. Patch 13B: the film plays from the shot registry (`src/shots`): the camera is the one the shot files provide
 * (`FILM_CAMERA_KEYFRAMES`), the set is in the scene, the active shot's overlay is drawn above it, and the grain and the vignette are
 * named layers with their own switches. Layer order, bottom to top: plate and scene (one canvas), overlay, grain, vignette, readout.
 * This file never names a shot, so it does not change when a shot is filled in or replaced (guide 02, "Architecture rules").
 * The camera holds its last state after its last keyframe.
 */
export const ReelFilm: React.FC<ReelFilmProps> = ({ hud, feather, view, scene = true, grain = true, vignette = true }) => {
  const frame = useCurrentFrame();
  const bar = feather ? PILLARBOX.feather : 0;
  const set = scene ? <FilmSet frame={frame} /> : null;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {view ? (
        <Stage view={view} feather={bar}>
          {set}
        </Stage>
      ) : (
        <CameraRig feather={bar} keys={FILM_CAMERA_KEYFRAMES}>
          {set}
        </CameraRig>
      )}
      <OverlayLayer frame={frame} />
      <Grain on={grain} />
      <Vignette on={vignette} />
      {hud ? <Readout /> : null}
    </AbsoluteFill>
  );
};
