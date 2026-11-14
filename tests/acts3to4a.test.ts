// PATCH 15: the shots S05-S09 (cover hero, open, first pages). What a number can check: the camera of the hero and the reading view against
// the audit and the frame, the hero motion (orbit, tilt, continuity), which page is on which face at every frame, the must-read strings'
// time on screen, the cues, and the pages' texture lifecycle. The pictures are looked at in the stills (see the notes of Patch 15).
import * as THREE from "three";
import fs from "node:fs";
import path from "node:path";
import { BEAT, HEIGHT, SHOTS, WIDTH } from "../src/config/timeline";
import { HERO_STATES, VIEW_HERO, VIEW_LIFT, VIEW_OPEN, VIEW_READ, limitFor, stateOf } from "../src/config/camera";
import { HERO, checkHero, heroOffsetAt, trackAt } from "../src/config/heroMotion";
import { BOOKS } from "../src/config/books";
import { BOOK_SCRIPT, faceIndices, getBookLocation, getBookPose, getBookState, stacksAt } from "../src/config/ledger";
import { BOOKS_OPEN_IN_ACT, actAt } from "../src/config/pageSpecs";
import { PAGE } from "../src/config/pages";
import { auditMotion } from "../src/camera/audit";
import { authoredAt, cameraAt } from "../src/camera/path";
import { PLATE_MATCH, photoToScreen } from "../src/plate/PlateFollow";
import { projectDesk } from "../src/plate/plateCamera";
import { poseEuler } from "../src/book/geometry";
import { withHero } from "../src/book/rig/hold";
import { liftTimes } from "../src/book/rig/lift";
import { turnFrames, turnProgress } from "../src/book/rig/turn";
import { quatOfPose } from "../src/book/rig/pose";
import { booksAliveInAct } from "../src/paint/spread";
import { bookPageBytes } from "../src/paint/pages";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, shotById } from "../src/shots";
import { eq, near, test, throws, truthy } from "./harness";

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const ids = ["S05", "S06", "S07", "S08", "S09"] as const;

/** The projected box of the book (closed, or with the cover open) in output px at a frame, through the film's camera without the operator. */
function screenBox(frame: number): { x0: number; x1: number; y0: number; y1: number } {
  const s = BOOKS["mini-me"];
  const st = getBookState("mini-me", frame)!;
  const W = s.trimW;
  const H = s.trimH;
  const T = s.spine + 2 * s.board;
  const th = st.coverAngle * Math.PI;
  const xp = -W / 2;
  const ym = T / 2;
  const pts: THREE.Vector3[] = [];
  for (const x of [-W / 2, W / 2])
    for (const z of [-H / 2, H / 2]) {
      pts.push(new THREE.Vector3(x, 0, z));
      for (const y of [T - s.board, T]) pts.push(new THREE.Vector3(xp + (x - xp) * Math.cos(th) - (y - ym) * Math.sin(th), ym + (x - xp) * Math.sin(th) + (y - ym) * Math.cos(th), z));
    }
  const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(st.pose));
  const view = cameraAt(frame, { operator: false }).view;
  const out = pts.map((p) => {
    const q = p.clone().applyMatrix4(m);
    const pl = projectDesk(PLATE_MATCH, q.x + st.pose.position[0], q.y + st.pose.position[1], -(q.z + st.pose.position[2]));
    return photoToScreen(view, pl.x, pl.y);
  });
  return { x0: Math.min(...out.map((c) => c.x)), x1: Math.max(...out.map((c) => c.x)), y0: Math.min(...out.map((c) => c.y)), y1: Math.max(...out.map((c) => c.y)) };
}

// ---------- the camera ----------

test("patch 15: the camera keys of S05-S09 are where the notes say, on beats, in R3, and each belongs to one shot", () => {
  const frames = Object.fromEntries(ids.map((id) => [id, shotById(id).camera.map((k) => k.frame)]));
  eq(JSON.stringify(frames), JSON.stringify({ S05: [1140, 1380], S06: [1440], S07: [1560], S08: [], S09: [1920] }));
  for (const id of ids) for (const k of shotById(id).camera) {
    eq(k.frame % BEAT, 0, `${id} key ${k.frame} is on a beat`);
    eq(k.regime, "R3", `${id} key ${k.frame}`);
  }
  eq(FILM_CAMERA_KEYFRAMES[FILM_CAMERA_KEYFRAMES.length - 1].frame, 1920, "the film's camera ends on the first frame of S10");
});

test("patch 15: S04's key is the state S05 starts from, and the views are the ones in config/camera.ts", () => {
  const s4 = shotById("S04").camera[0];
  eq(JSON.stringify(stateOf(s4)), JSON.stringify(HERO_STATES.lift));
  eq(s4.ease, "signatureIn", "S05's glide starts from rest and runs on into a straight line");
  near(authoredAt(1440).state.M, VIEW_HERO.M, 1e-9);
  near(authoredAt(1440).state.panY, VIEW_HERO.panY, 1e-9);
  near(authoredAt(1560).state.M, VIEW_OPEN.M, 1e-9);
  near(authoredAt(1920).state.M, VIEW_READ.M, 1e-9);
  near(authoredAt(1080).state.M, VIEW_LIFT.M, 1e-9);
  truthy(VIEW_HERO.M / VIEW_LIFT.M - 1 > 0.035 && VIEW_HERO.M / VIEW_LIFT.M - 1 < 0.05, "S05 pushes in about 4 percent (guide 05 section 4)");
});

test("patch 15: the lens is the guide's: focus 30 at f/2 for the hero, focus 32 at f/2.8 from the open view on", () => {
  near(authoredAt(1440).state.focusCm, 30, 1e-9);
  near(authoredAt(1440).state.aperture, 2, 1e-9);
  near(authoredAt(1560).state.focusCm, 32, 1e-9);
  near(authoredAt(1560).state.aperture, 2.8, 1e-9);
  near(authoredAt(1919).state.focusCm, 32, 0.05);
});

test("patch 15: no roll anywhere in S05-S09, and the tilt of the guide's table is the book's pitch (the camera does not tilt)", () => {
  for (let f = 1080; f < 1920; f += 10) {
    const a = authoredAt(f).state;
    eq(a.rollDeg, 0, `roll at ${f}`);
    eq(a.tiltDeg, 0, `tilt at ${f}`);
  }
  near(heroOffsetAt(1560).pitchDeg, -10, 1e-9, "10 degrees of reading tilt on frame 1560");
  near(getBookPose("mini-me", 1700)!.pitchDeg ?? 0, 70, 0.8, "the book is read at a pitch of 70 degrees (80 less the tilt, with the sway)");
});

test("patch 15: the audit is clean for frames 1080-1919, nothing is still over 60 frames, and the limits of R3 hold", () => {
  const r = auditMotion({ from: 1080, to: 1919, exceptions: [] });
  eq(r.findings.length, 0, JSON.stringify(r.findings));
  const all = auditMotion();
  eq(all.unexplained, 0, JSON.stringify(all.findings.filter((f) => !f.known)));
  eq(all.counts.STILL, 1, "only the documented opening hold");
  const lim = limitFor("R3");
  truthy(r.stats.peakLateralCmPerSec <= lim.lateralCmPerSec, `sideways ${r.stats.peakLateralCmPerSec} cm/s`);
  truthy(r.stats.peakMRatePerSec <= 1.5, `M rate ${r.stats.peakMRatePerSec}`);
  truthy(r.stats.maxM <= lim.maxM, `M ${r.stats.maxM}`);
  truthy(r.stats.peakPopFraction < 0.02, "no pop");
});

test("patch 15: the cover hero has the whole book in the frame from frame 1140 on and in the middle of it from 1380 to the opening", () => {
  for (const f of [1140, 1200, 1260, 1320, 1380, 1439]) {
    const b = screenBox(f);
    truthy(b.y0 > 5 && b.y1 < HEIGHT - 20, `frame ${f}: the book (${Math.round(b.y0)} to ${Math.round(b.y1)} px) is inside the frame's height`);
  }
  for (const f of [1380, 1439]) {
    const b = screenBox(f);
    truthy(Math.abs((b.x0 + b.x1) / 2 - WIDTH / 2) < 90, `frame ${f}: the book is within 90 px of the middle sideways`);
    truthy(Math.abs((b.y0 + b.y1) / 2 - HEIGHT / 2) < 90, `frame ${f}: the book is within 90 px of the middle`);
  }
  // before the patch the held book was cut off at the top of the frame (frame 1080, M 6.0)
  truthy(screenBox(1080).y0 < 10, "at the start of S05 the book still touches the top of the frame");
  truthy(screenBox(1260).y0 > screenBox(1080).y0 + 100, "and by the sweep it has been brought down into it");
});

test("patch 15: the open book stays inside the frame, with its spread near the middle, through S07-S09", () => {
  for (const f of [1560, 1680, 1800, 1919]) {
    const b = screenBox(f);
    truthy(b.x0 > 60 && b.x1 < WIDTH - 60, `frame ${f}: the spread (${Math.round(b.x0)} to ${Math.round(b.x1)} px) is inside the frame's width`);
    truthy(b.y0 > 60 && b.y1 < HEIGHT - 60, `frame ${f}: the spread is inside the frame's height`);
    truthy(Math.abs((b.x0 + b.x1) / 2 - WIDTH / 2) < 160, `frame ${f}: the spread's middle is within 160 px of the frame's`);
  }
});

// ---------- the hero motion ----------

test("patch 15: the orbit is within +-8 degrees, starts and ends at 0, is smooth, and its middle is frame 1260 (beat 3 of bar 10)", () => {
  checkHero();
  eq(HERO.specularFrame, 1260);
  eq(HERO.specularFrame % BEAT, 0);
  eq(Math.floor(HERO.specularFrame / 120), 10, "bar index 10 counted from 0");
  eq((HERO.specularFrame % 120) / BEAT, 2, "the third beat of the bar");
  near(heroOffsetAt(1083).yawDeg, 0, 1e-12);
  near(heroOffsetAt(1437).yawDeg, 0, 1e-12);
  near(heroOffsetAt(1260).yawDeg, 0, 1e-9, "the sweep crosses the middle on 1260");
  let worst = 0;
  let step = 0;
  for (let f = 1000; f <= 1500; f++) {
    const y = heroOffsetAt(f).yawDeg;
    worst = Math.max(worst, Math.abs(y));
    step = Math.max(step, Math.abs(y - heroOffsetAt(f - 1).yawDeg));
  }
  truthy(worst <= 8 + 1e-9, `largest yaw ${worst}`);
  near(worst, 8, 1e-6, "it does reach 8");
  truthy(step < 0.15, `largest yaw step ${step} degrees a frame (under 9 degrees a second)`);
  truthy(heroOffsetAt(1261).yawDeg > heroOffsetAt(1259).yawDeg, "it crosses 1260 moving the same way as the sweep, at its fastest");
});

test("patch 15: the orbit starts after the lift has settled, and the hero motion is zero outside S05-S14", () => {
  truthy(HERO.yaw[0].frame >= liftTimes("mini-me", 960).settled, "the lift's overshoot is over before the orbit starts");
  for (const f of [0, 960, 1083, 2880, 2999, 3500, 5399]) {
    const o = heroOffsetAt(f);
    eq(o.yawDeg, 0, `yaw at ${f}`);
    if (f !== 1083 || true) eq(o.pitchDeg, 0, `pitch at ${f}`);
  }
  eq(trackAt(HERO.pitch, 2000), -10, "held at 10 degrees through the reading");
});

test("patch 15: a bad track is refused by name", () => {
  throws(() => checkHero({ yaw: [{ frame: 10, deg: 1 }, { frame: 20, deg: 0 }], pitch: HERO.pitch }), "must start and end on 0");
  throws(() => checkHero({ yaw: HERO.yaw, pitch: [{ frame: 5, deg: 0 }, { frame: 5, deg: 0 }] }), "not after the key before it");
});

test("patch 15: the book turns about its own middle: a yaw offset leaves the middle of the closed book where it was", () => {
  const spec = BOOKS["mini-me"];
  const middle = new THREE.Vector3(0, (spec.spine + 2 * spec.board) / 2, 0);
  const base = getBookPose("mini-me", 1000)!;
  for (const [yaw, pitch] of [[8, 0], [-8, 0], [0, -10], [5, -7]] as const) {
    const turned = withHero(base, "mini-me", { yawDeg: yaw, pitchDeg: pitch });
    const a = middle.clone().applyQuaternion(quatOfPose(base)).add(new THREE.Vector3(...base.position));
    const b = middle.clone().applyQuaternion(quatOfPose(turned)).add(new THREE.Vector3(...turned.position));
    near(a.distanceTo(b), 0, 1e-9, `yaw ${yaw} pitch ${pitch}`);
    near((turned.yawDeg ?? 0) - (base.yawDeg ?? 0), yaw, 1e-12);
    near((turned.pitchDeg ?? 0) - (base.pitchDeg ?? 0), pitch, 1e-12);
  }
  eq(withHero(base, "mini-me", { yawDeg: 0, pitchDeg: 0 }), base, "no offset, the same pose");
});

test("patch 15: the held book's pose is continuous from the lift to the carry: no jump from frame to frame, and the set-down starts from the lift's reading pose", () => {
  let prev = getBookPose("mini-me", 960)!;
  let worstDeg = 0;
  for (let f = 961; f <= 2880; f++) {
    const p = getBookPose("mini-me", f)!;
    const d = Math.hypot(p.position[0] - prev.position[0], p.position[1] - prev.position[1], p.position[2] - prev.position[2]);
    truthy(d < 1.2, `frame ${f}: the book moved ${d} cm in one frame`);
    // the lift's own turn to face us (frames 960-1083) is Patch 14's and quick; from the settle on the book turns slowly
    if (f > 1083) worstDeg = Math.max(worstDeg, quatOfPose(p).angleTo(quatOfPose(prev)) * (180 / Math.PI));
    prev = p;
  }
  truthy(worstDeg < 0.5, `largest turn in one frame after the lift has settled ${worstDeg} degrees`);
  // on frame 2880 the hero motion is gone: the pose is the lift's reading pose with its sway, which is where the set-down starts
  const a = getBookPose("mini-me", 2879)!;
  const b = getBookPose("mini-me", 2880)!;
  near(a.pitchDeg ?? 0, 80, 0.8, "the tilt has been unwound by 2879");
  near(b.pitchDeg ?? 0, 80, 0.8, "and the carry starts from the reading pitch");
  eq(getBookLocation("mini-me", 2880), "beside");
});

// ---------- the pages ----------

test("patch 15: which page is on which face, frame by frame (the spreads of guide 04 section 5)", () => {
  const turns = BOOK_SCRIPT["mini-me"]!.turns;
  const want: [number, number, number][] = [
    [1440, 0, 1], // P-END | P-HALF, the cover is opening
    [1559, 0, 1],
    [1561, 0, 3], // the first sheet is in the air: P-TITLE is under it
    [1612, 0, 3],
    [1620, 2, 3], // P-BLANK | P-TITLE
    [1679, 2, 3],
    [1681, 2, 5], // the second sheet is in the air: P-FIG under it
    [1740, 4, 5], // P-ABST | P-FIG
    [1919, 4, 5],
  ];
  for (const [f, l, r] of want) {
    const at = faceIndices(f, turns);
    eq(`${at.left},${at.right}`, `${l},${r}`, `frame ${f}`);
  }
  eq(JSON.stringify(stacksAt(1620, turns)), JSON.stringify({ left: 1, airborne: false }));
  eq(turnFrames(false), 54);
});

test("patch 15: a spread is shown on every frame of S06-S09: each face has a page, the sheets in the air are the ones being turned", () => {
  const turns = BOOK_SCRIPT["mini-me"]!.turns;
  for (let f = 1440; f < 1920; f++) {
    const at = faceIndices(f, turns);
    truthy(at.left % 2 === 0 && at.right % 2 === 1, `frame ${f}: left pages are even, right pages are odd`);
    truthy(at.left >= 0 && at.right <= 12, `frame ${f}: pages exist`);
    const air = getBookState("mini-me", f)!.airSheets;
    truthy(air.length <= 2, `frame ${f}: at most two sheets in the air`);
    for (const s of air) truthy(s.index === 0 || s.index === 1, `frame ${f}: sheet ${s.index} is one of the first two`);
  }
  eq(getBookState("mini-me", 1500)!.airSheets.length, 0, "no sheet in the air while the cover opens");
  eq(getBookState("mini-me", 1580)!.airSheets[0].index, 0);
  eq(getBookState("mini-me", 1700)!.airSheets[0].index, 1);
});

test("patch 15: the cover opens from frame 1440 and is open (about 165 degrees) when the first sheet is turned", () => {
  eq(BOOK_SCRIPT["mini-me"]!.cover[0].start, 1440);
  eq(getBookState("mini-me", 1439)!.coverAngle, 0);
  truthy(getBookState("mini-me", 1560)!.coverAngle > 0.9, "open by the first turn");
  near(getBookState("mini-me", 1700)!.coverAngle * 180, 165, 3);
});

test("patch 15: the must-read strings stay on screen at least 120 frames: the title page from turn 1 passing vertical to turn 2 passing vertical, the abstract and caption to the end of S09", () => {
  const turns = BOOK_SCRIPT["mini-me"]!.turns;
  const vertical = (start: number): number => {
    for (let f = start; f < start + 80; f++) if (turnProgress(f, start, turnFrames(false)) >= 0.5) return f;
    throw new Error("no vertical frame");
  };
  const v1 = vertical(turns[0].start);
  const v2 = vertical(turns[1].start);
  truthy(v2 - v1 >= 120, `the title, the authors and the year are readable for ${v2 - v1} frames`);
  truthy(1919 - v2 >= 120, `Abstract. and the caption are readable for ${1919 - v2} frames of S08-S09 alone`);
  eq(shotById("S07").from, 1560);
});

// ---------- cues and shots ----------

test("patch 15: the cues of S05-S09 follow the audio cue sheet, are named, on beats, inside their shot and in frame order", () => {
  let n = 0;
  for (const id of ids) {
    const s = shotById(id);
    n += s.cues.length;
    s.cues.forEach((c, i) => {
      truthy(c.name.trim().length > 0, `${id} cue ${i}`);
      eq(c.frame % BEAT, 0, `${id} ${c.name} is on a beat`);
      truthy(c.frame >= s.from && c.frame <= s.to, `${id} ${c.name} is inside the shot`);
    });
  }
  eq(n, 3);
  eq(shotById("S06").cues[0].frame, 1440);
  eq(shotById("S06").cues[0].name, "cover-open");
  eq(shotById("S07").cues[0].frame, 1560);
  eq(shotById("S08").cues[0].frame, 1680);
  eq(shotById("S08").cues[0].name, "page-turn");
  const mine = FILM_CUES.filter((c) => c.frame >= SHOTS[5].from && c.frame <= SHOTS[9].to);
  eq(mine.length, 3);
});

// ---------- the texture lifecycle ----------

test("patch 15: Mini Me's pages are alive from frame 1440 (Act 3) and not before; one book's pages at a time, under the budget", () => {
  eq(actAt(1439), 2);
  eq(actAt(1440), 3);
  eq(booksAliveInAct(2).length, 0, "Acts 0 to 2 load nothing");
  eq(booksAliveInAct(3)[0], "mini-me");
  eq(booksAliveInAct(4)[0], "mini-me");
  eq(booksAliveInAct(5)[0], "mini-me");
  eq(booksAliveInAct(6)[0], "minilocker", "Act 6 swaps the book: Mini Me's pages are freed");
  for (const a of Object.keys(BOOKS_OPEN_IN_ACT)) eq(BOOKS_OPEN_IN_ACT[Number(a)].length, 1, `act ${a}`);
  truthy(bookPageBytes("mini-me") <= PAGE.textureBudgetBytes, "Mini Me's pages fit the budget");
});

test("patch 15: the pages hook loads by act, holds the render, frees the textures and drops the canvases; the film's set uses it", () => {
  const hook = read("src/scene/useActPages.ts");
  for (const word of ["prepareAct", "disposeAct", "delayRender", "continueRender", "cancelRender", "releasePageTexture", "booksAliveInAct", "actAt"]) truthy(hook.includes(word), `useActPages uses ${word}`);
  const film = read("src/ReelFilm.tsx");
  truthy(film.includes("useActPages(frame)") && film.includes("<Pile frame={frame} pages={pages} />"), "FilmSet gives the pile the pages of the act");
  const pile = read("src/scene/Pile.tsx");
  truthy(pile.includes("OpenPages") && pile.includes("isOpen(state)"), "the pile draws the pages of an open book");
  const faces = read("src/book/Sheet.tsx");
  truthy(faces.includes("split.leftThickness > 1e-4 || left != null"), "the endpaper is drawn on the left board when it is given");
  const lab = read("src/dev/DevBookMotion.tsx");
  truthy(lab.includes("stacksAt") && !lab.includes("function stacksAt"), "the lab uses the ledger's stacksAt, not its own copy");
});
