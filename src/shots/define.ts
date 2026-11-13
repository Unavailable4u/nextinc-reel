// BUILDING AND CHECKING SHOTS (Patch 13A). `defineShot` is what every shot file calls: it takes the shot's frame range from the SHOTS
// table of `src/config/timeline.ts` (so no shot file types a frame range) and checks what the file provides. `checkShots` checks the
// whole registry against the table and puts the keyframes of all shots in one line, the way the camera path reads them.
//
// Every check throws an Error that names the shot and the number, so the first problem is the one on screen. No React, no three.js.

import type { FC } from "react";
import { checkKeyframes, type CameraKeyframe } from "../config/camera";
import { SHOTS, type Shot as TableRow } from "../config/timeline";
import type { SfxCue, Shot } from "./types";

export interface ShotParts {
  /** keyframes on film frames, in order (default: none) */
  camera?: readonly CameraKeyframe[];
  overlay?: FC;
  /** sounds on film frames, in frame order (default: none) */
  cues?: readonly SfxCue[];
}

/** The row of the table for a shot id; throws naming the id when there is none. */
export function tableRow(id: string, table: readonly TableRow[] = SHOTS): TableRow {
  const row = table.find((r) => r.id === id);
  if (!row) throw new Error(`shots: "${id}" is not a row of the shot table (src/config/timeline.ts)`);
  return row;
}

/**
 * A shot file's export: the frame range comes from the table, the rest from `parts`. Throws if the id is not in the table or if the
 * keyframes or cues do not fit the shot (see `checkShot`).
 */
export function defineShot(id: string, parts: ShotParts = {}): Shot {
  const row = tableRow(id);
  const shot: Shot = { id, from: row.from, to: row.to, camera: parts.camera ?? [], overlay: parts.overlay, cues: parts.cues ?? [] };
  checkShot(shot, row);
  return shot;
}

/**
 * Throws unless the shot has the table's frame range, its keyframes are whole frames in strict order and lie inside it (one closing key
 * on the first frame of the next shot is allowed), and its cues are on whole frames inside it, in order, with a name.
 */
export function checkShot(shot: Shot, row: TableRow = tableRow(shot.id)): void {
  const at = `shots: ${shot.id}`;
  if (shot.id !== row.id) throw new Error(`${at} is checked against the row of ${row.id}`);
  if (shot.from !== row.from || shot.to !== row.to) {
    throw new Error(`${at} covers frames ${shot.from}-${shot.to}, the shot table says ${row.from}-${row.to}`);
  }
  const last = row.to + 1;
  shot.camera.forEach((k, i) => {
    if (!Number.isInteger(k.frame)) throw new Error(`${at}: camera keyframe ${i} is on frame ${k.frame}, not a whole frame`);
    if (k.frame < row.from || k.frame > last) {
      throw new Error(`${at}: camera keyframe ${i} is on frame ${k.frame}, outside the shot (${row.from}-${row.to}, plus a closing key on ${last})`);
    }
    if (i > 0 && k.frame <= shot.camera[i - 1].frame) {
      throw new Error(`${at}: camera keyframe ${i} (frame ${k.frame}) is not after the one before it (frame ${shot.camera[i - 1].frame})`);
    }
  });
  shot.cues.forEach((c, i) => {
    if (!Number.isInteger(c.frame)) throw new Error(`${at}: cue ${i} ("${c.name}") is on frame ${c.frame}, not a whole frame`);
    if (c.frame < row.from || c.frame > row.to) throw new Error(`${at}: cue ${i} ("${c.name}") is on frame ${c.frame}, outside the shot (${row.from}-${row.to})`);
    if (c.name.trim() === "") throw new Error(`${at}: cue ${i} (frame ${c.frame}) has no name`);
    if (i > 0 && c.frame < shot.cues[i - 1].frame) throw new Error(`${at}: cue ${i} ("${c.name}", frame ${c.frame}) is before the cue before it (frame ${shot.cues[i - 1].frame})`);
  });
}

/**
 * Throws unless `shots` is the table, shot for shot and in order (same ids, same frames), every shot passes `checkShot`, and the
 * keyframes of all the shots, joined in shot order, are in strict frame order. When there are keyframes they must also pass the camera's
 * own check (`checkKeyframes`: start at frame 0, finite numbers). Runs when `src/shots/index.ts` loads.
 */
export function checkShots(shots: readonly Shot[], table: readonly TableRow[] = SHOTS): void {
  if (shots.length !== table.length) throw new Error(`shots: ${shots.length} shot files, the shot table has ${table.length} shots`);
  shots.forEach((s, i) => {
    if (s.id !== table[i].id) throw new Error(`shots: position ${i} is "${s.id}", the shot table has "${table[i].id}" there`);
    checkShot(s, table[i]);
  });
  let prev: { frame: number; id: string } | null = null;
  for (const s of shots) {
    for (const k of s.camera) {
      if (prev && k.frame <= prev.frame) {
        throw new Error(`shots: the keyframe on frame ${k.frame} (${s.id}) is not after the keyframe on frame ${prev.frame} (${prev.id}); a boundary key belongs to one shot only`);
      }
      prev = { frame: k.frame, id: s.id };
    }
  }
  const all = shots.flatMap((s) => s.camera);
  if (all.length > 0) checkKeyframes(all);
}
