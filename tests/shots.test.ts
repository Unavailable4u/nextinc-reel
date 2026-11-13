import fs from "node:fs";
import path from "node:path";
import { BAR, SHOTS, TOTAL } from "../src/config/timeline";
import { CAMERA_KEYFRAMES, SHOT_KEYFRAMES, type CameraKeyframe } from "../src/config/camera";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, SHOT_REGISTRY, activeShot, checkShot, checkShots, defineShot, shotById, tableRow } from "../src/shots";
import type { Shot } from "../src/shots";
import { eq, test, throws, truthy } from "./harness";

const idOf = (n: number): string => `S${String(n).padStart(2, "0")}`;
/** the registry with one shot swapped for a changed copy (for the error cases) */
const swap = (id: string, change: Partial<Shot>): Shot[] => SHOT_REGISTRY.map((s) => (s.id === id ? { ...s, ...change } : s));
/** a keyframe copied from the camera's first one, on another frame */
const keyAt = (frame: number): CameraKeyframe => ({ ...CAMERA_KEYFRAMES[0], frame });

// ---------- the registry is the table ----------

test("shots: 26 shot files, S00 to S25, in order, each on the frames of the SHOTS table", () => {
  eq(SHOT_REGISTRY.length, 26);
  SHOT_REGISTRY.forEach((s, i) => {
    eq(s.id, idOf(i), `shot ${i}`);
    eq(s.from, SHOTS[i].from, `${s.id} from`);
    eq(s.to, SHOTS[i].to, `${s.id} to`);
  });
  eq(SHOT_REGISTRY[0].from, 0);
  eq(SHOT_REGISTRY[25].to, TOTAL - 1);
  checkShots(SHOT_REGISTRY);
});

test("shots: the shot boundaries equal the storyboard's master shot list (guide 01), row by row", () => {
  const text = fs.readFileSync(path.join(process.cwd(), "docs", "guide", "01-storyboard.md"), "utf8");
  // | S00 | Plate: the desk, untouched | 0-239 | 0:00.00-0:04.00 | 2 | R1 |
  const row = /^\|\s*(S\d{2})\s*\|\s*([^|]+?)\s*\|\s*(\d+)-(\d+)\s*\|[^|]*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*$/;
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.match(row))
    .filter((m): m is RegExpMatchArray => m !== null);
  eq(rows.length, 26, "rows of the master shot list");
  rows.forEach((m, i) => {
    const s = SHOT_REGISTRY[i];
    eq(m[1], s.id, `row ${i} id`);
    eq(Number(m[3]), s.from, `${s.id} first frame`);
    eq(Number(m[4]), s.to, `${s.id} last frame`);
    eq(Number(m[5]), (s.to - s.from + 1) / BAR, `${s.id} bars`);
    eq(m[2], SHOTS[i].name, `${s.id} name`);
    eq(m[6], SHOTS[i].regime, `${s.id} regime`);
  });
});

test("shots: every shot's frames add up to the film, with no gap and no overlap", () => {
  let expect = 0;
  for (const s of SHOT_REGISTRY) {
    eq(s.from, expect, `${s.id} start`);
    expect = s.to + 1;
  }
  eq(expect, TOTAL);
});

// ---------- the active shot ----------

test("shots: the active shot is right on the first and last frame of every shot and on the frame after", () => {
  SHOT_REGISTRY.forEach((s, i) => {
    eq(activeShot(s.from).id, s.id, `${s.id} first frame`);
    eq(activeShot(s.to).id, s.id, `${s.id} last frame`);
    eq(activeShot(Math.floor((s.from + s.to) / 2)).id, s.id, `${s.id} middle`);
    if (i < 25) eq(activeShot(s.to + 1).id, idOf(i + 1), `frame after ${s.id}`);
    if (i > 0) eq(activeShot(s.from - 1).id, idOf(i - 1), `frame before ${s.id}`);
  });
});

test("shots: frames outside the film are in the first or the last shot; a frame is a shot, never nothing", () => {
  eq(activeShot(-10).id, "S00");
  eq(activeShot(TOTAL + 600).id, "S25");
  eq(activeShot(239.4).id, "S00", "a fractional frame rounds like the timeline does");
  for (let f = 0; f < TOTAL; f += 37) truthy(f >= activeShot(f).from && f <= activeShot(f).to, `frame ${f} is inside its shot`);
});

test("shots: shotById finds a shot, and names the id when there is none", () => {
  eq(shotById("S13").from, 2520);
  eq(shotById("S25").to, 5399);
  throws(() => shotById("S26"), '"S26"');
  throws(() => shotById(""), "no shot");
});

// ---------- what the shot files provide ----------

test("shots: S00 to S03 provide the camera of Patch 05 and the film's camera is those keyframes, unchanged and in order", () => {
  for (const id of ["S00", "S01", "S02", "S03"] as const) eq(shotById(id).camera, SHOT_KEYFRAMES[id], `${id} camera is the authored array`);
  eq(FILM_CAMERA_KEYFRAMES.length, SHOT_REGISTRY.reduce((n, s) => n + s.camera.length, 0));
  eq(FILM_CAMERA_KEYFRAMES[0].frame, 0, "the camera starts on frame 0");
  FILM_CAMERA_KEYFRAMES.forEach((k, i) => {
    if (i > 0) truthy(k.frame > FILM_CAMERA_KEYFRAMES[i - 1].frame, `keyframe ${i} (frame ${k.frame}) is after the one before`);
  });
  // the keyframes S00-S03 provide are the ones config/camera.ts joined before the registry existed
  eq(JSON.stringify(FILM_CAMERA_KEYFRAMES.slice(0, CAMERA_KEYFRAMES.length)), JSON.stringify(CAMERA_KEYFRAMES));
});

test("shots: every keyframe lies inside its shot, or on the first frame of the next shot as its closing key", () => {
  for (const s of SHOT_REGISTRY) for (const k of s.camera) truthy(k.frame >= s.from && k.frame <= s.to + 1, `${s.id} key on frame ${k.frame}`);
  eq(shotById("S03").camera[shotById("S03").camera.length - 1].frame, 960, "S03's closing key is the first frame of S04");
});

test("shots: a shot without keyframes, overlay or cues is allowed (a stub); the cues of the film are in frame order", () => {
  const stub = defineShot("S10");
  eq(stub.camera.length, 0);
  eq(stub.cues.length, 0);
  eq(stub.overlay, undefined);
  for (let i = 1; i < FILM_CUES.length; i++) truthy(FILM_CUES[i].frame >= FILM_CUES[i - 1].frame, `cue ${i} is in order`);
});

test("shots: defineShot takes the range from the table and keeps what the file provides", () => {
  const cues = [{ frame: 1260, name: "foil-sweep" }];
  const s = defineShot("S05", { camera: [keyAt(1080), keyAt(1260)], cues });
  eq(s.from, 1080);
  eq(s.to, 1439);
  eq(s.camera.length, 2);
  eq(s.cues, cues);
  eq(tableRow("S05").from, 1080);
});

// ---------- the errors name the shot ----------

test("shots: a shot that is not in the table is refused, by name", () => {
  throws(() => defineShot("S26"), '"S26" is not a row');
  throws(() => defineShot("S5"), '"S5" is not a row');
  throws(() => tableRow("X00"), "shot table");
});

test("shots: a shot that disagrees with the table about its frames is refused, with both ranges", () => {
  throws(() => checkShots(swap("S05", { from: 1081 })), "S05 covers frames 1081-1439, the shot table says 1080-1439");
  throws(() => checkShots(swap("S05", { to: 1440 })), "S05 covers frames 1080-1440, the shot table says 1080-1439");
  throws(() => checkShot({ ...SHOT_REGISTRY[7], id: "S08" }, SHOTS[7]), "checked against the row of S07");
});

test("shots: a missing, extra or misplaced shot file is refused", () => {
  throws(() => checkShots(SHOT_REGISTRY.slice(0, 25)), "25 shot files, the shot table has 26");
  throws(() => checkShots([...SHOT_REGISTRY, SHOT_REGISTRY[0]]), "27 shot files");
  const swapped = [...SHOT_REGISTRY];
  [swapped[3], swapped[4]] = [swapped[4], swapped[3]];
  throws(() => checkShots(swapped), 'position 3 is "S04", the shot table has "S03"');
});

test("shots: a keyframe outside its shot, off a whole frame or out of order is refused", () => {
  throws(() => checkShots(swap("S05", { camera: [keyAt(960)] })), "S05: camera keyframe 0 is on frame 960, outside the shot (1080-1439, plus a closing key on 1440)");
  throws(() => checkShots(swap("S05", { camera: [keyAt(1441)] })), "outside the shot");
  eq(checkShots(swap("S05", { camera: [keyAt(1440)] })), undefined, "a closing key on the first frame of the next shot is allowed");
  throws(() => checkShots(swap("S05", { camera: [keyAt(1080.5)] })), "not a whole frame");
  throws(() => checkShots(swap("S05", { camera: [keyAt(1200), keyAt(1140)] })), "S05: camera keyframe 1 (frame 1140) is not after the one before it (frame 1200)");
  throws(() => checkShots(swap("S05", { camera: [keyAt(1200), keyAt(1200)] })), "is not after the one before it");
});

test("shots: two shots may not both own the key on a boundary frame", () => {
  // S03's closing key is on frame 960; a key of S04 on frame 960 would be a second key on the same frame
  throws(() => checkShots(swap("S04", { camera: [keyAt(960)] })), "the keyframe on frame 960 (S04) is not after the keyframe on frame 960 (S03)");
  eq(checkShots(swap("S04", { camera: [keyAt(990)] })), undefined, "a key after the boundary is fine");
});

test("shots: the film's camera must start on frame 0", () => {
  throws(() => checkShots(SHOT_REGISTRY.map((s) => (s.id === "S00" ? { ...s, camera: s.camera.slice(1) } : s))), "the first keyframe must be at frame 0");
});

test("shots: a cue outside its shot, off a whole frame, without a name or out of order is refused", () => {
  throws(() => checkShot({ ...SHOT_REGISTRY[5], cues: [{ frame: 1079, name: "thud" }] }), 'S05: cue 0 ("thud") is on frame 1079, outside the shot (1080-1439)');
  throws(() => checkShot({ ...SHOT_REGISTRY[5], cues: [{ frame: 1440, name: "thud" }] }), "outside the shot");
  throws(() => checkShot({ ...SHOT_REGISTRY[5], cues: [{ frame: 1100.5, name: "thud" }] }), "not a whole frame");
  throws(() => checkShot({ ...SHOT_REGISTRY[5], cues: [{ frame: 1100, name: "  " }] }), "has no name");
  throws(() => checkShot({ ...SHOT_REGISTRY[5], cues: [{ frame: 1200, name: "a" }, { frame: 1100, name: "b" }] }), 'cue 1 ("b", frame 1100) is before the cue before it (frame 1200)');
  eq(checkShot({ ...SHOT_REGISTRY[5], cues: [{ frame: 1080, name: "first" }, { frame: 1439, name: "last" }] }), undefined, "the first and last frame of the shot are inside it");
});
