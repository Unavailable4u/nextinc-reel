// WHAT A SHOT FILE PROVIDES (Patch 13A). One file per shot, S00 to S25, in `src/shots/`. A shot file gives the film four things and
// nothing else (guide 02, "Architecture rules"): its camera keyframes, its poses or references to rig functions, an overlay and its
// sound cues. `src/ReelFilm.tsx` puts the shots together and does not change when a shot is filled in or replaced.
//
// Not to be confused with `Shot` in `src/config/timeline.ts`: that one is a ROW OF THE TABLE (id, name, from, to, regime) and is the
// only place frame numbers are typed. This one is what a shot FILE provides, and `defineShot` (./define.ts) copies its frame range from
// that row, so a shot can never disagree with the storyboard about where it starts or ends.
//
// No three.js and no remotion here: a plain Node can read the registry (the motion audit does).

import type { FC } from "react";
import type { CameraKeyframe } from "../config/camera";

/**
 * One sound a shot asks for: the film frame it starts on and its name. The audio patch (21) reads the cues of every shot and writes the
 * cue sheet (`src/config/sfx.ts`) from them; until then they are a list for later wiring and nothing plays.
 */
export interface SfxCue {
  /** film frame (not a frame inside the shot) */
  frame: number;
  name: string;
}

export interface Shot {
  /** "S00" to "S25", a row of the SHOTS table */
  id: string;
  /** first frame of the shot (inclusive), copied from the table */
  from: number;
  /** last frame of the shot (inclusive), copied from the table */
  to: number;
  /**
   * The camera keyframes of this shot, in order, on film frames (`src/config/camera.ts` says what a keyframe is). They lie inside the
   * shot, plus at most one closing key on the first frame of the next shot (the state the next move starts from). An empty list means
   * the shot adds no keyframe: the camera then holds what the shots before it set up.
   */
  camera: readonly CameraKeyframe[];
  /** the 2D layer of this shot (the labels of S23, the wordmark of S24), drawn above the scene while the shot is active; none for most shots */
  overlay?: FC;
  /** the sounds of this shot, in frame order, each on a film frame inside the shot */
  cues: readonly SfxCue[];
}
