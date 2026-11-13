// THE SHOT REGISTRY (Patch 13A): the 26 shot files S00 to S25 in order, checked against the SHOTS table of `src/config/timeline.ts` when this
// module loads (a shot file that disagrees with the table about where it starts or ends stops the film, the Studio and the audit with an
// error that names it). Everything that needs "the shot at frame N" or "the camera of the whole film" asks here:
//
//   activeShot(frame)           the shot a frame belongs to (frames outside the film clamp to the first or last shot)
//   shotById("S07")             one shot, or an error naming the id
//   FILM_CAMERA_KEYFRAMES       the keyframes of all the shots joined in shot order: the camera path of the film (`cameraAt(frame, { keys })`)
//   FILM_CUES                   the cues of all the shots in frame order, for the audio patch
//
// A shot file is filled in by its own patch (14 to 20); this file does not change when it is. No React rendering and no three.js here, so
// a plain Node can import it (the motion audit does); only the overlay of a shot may bring React in, and nothing here calls it.

import { checkKeyframes, type CameraKeyframe } from "../config/camera";
import { shotAt } from "../config/timeline";
import { checkShots } from "./define";
import type { SfxCue, Shot } from "./types";
import { S00 } from "./S00";
import { S01 } from "./S01";
import { S02 } from "./S02";
import { S03 } from "./S03";
import { S04 } from "./S04";
import { S05 } from "./S05";
import { S06 } from "./S06";
import { S07 } from "./S07";
import { S08 } from "./S08";
import { S09 } from "./S09";
import { S10 } from "./S10";
import { S11 } from "./S11";
import { S12 } from "./S12";
import { S13 } from "./S13";
import { S14 } from "./S14";
import { S15 } from "./S15";
import { S16 } from "./S16";
import { S17 } from "./S17";
import { S18 } from "./S18";
import { S19 } from "./S19";
import { S20 } from "./S20";
import { S21 } from "./S21";
import { S22 } from "./S22";
import { S23 } from "./S23";
import { S24 } from "./S24";
import { S25 } from "./S25";

export type { SfxCue, Shot } from "./types";
export { checkShot, checkShots, defineShot, tableRow } from "./define";

/** Every shot, S00 to S25, in order. Position i is shot `S` + i, and is the row i of the SHOTS table. */
export const SHOT_REGISTRY: readonly Shot[] = [S00, S01, S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25];
checkShots(SHOT_REGISTRY);

const BY_ID: ReadonlyMap<string, Shot> = new Map(SHOT_REGISTRY.map((s) => [s.id, s]));

/** One shot by its id ("S07"); throws naming the id when there is no such shot. */
export function shotById(id: string): Shot {
  const hit = BY_ID.get(id);
  if (!hit) throw new Error(`shots: there is no shot "${id}" (the registry has ${SHOT_REGISTRY[0].id} to ${SHOT_REGISTRY[SHOT_REGISTRY.length - 1].id})`);
  return hit;
}

/** The shot a frame belongs to. A frame before the film is in the first shot and a frame after it is in the last, as `shotAt` says. */
export function activeShot(frame: number): Shot {
  return shotById(shotAt(frame).id);
}

/** The camera path of the whole film: the keyframes of every shot, in shot order and so in frame order. Pass it as `keys` to the camera rig and the audit. */
export const FILM_CAMERA_KEYFRAMES: readonly CameraKeyframe[] = SHOT_REGISTRY.flatMap((s) => s.camera);
checkKeyframes(FILM_CAMERA_KEYFRAMES);

/** Every shot's sound cues, in frame order (each shot's cues are in order and inside the shot, and the shots are in order). */
export const FILM_CUES: readonly SfxCue[] = SHOT_REGISTRY.flatMap((s) => s.cues);
