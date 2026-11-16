// PATCH 17: the shots S14-S15 (close and set down): the ledger's close and set-down times, the soft landing, the contact patch that tightens
// as the book comes down, the pile after the set-down, the glide of the camera back to the pile (against the audit) and the cues. The
// pictures (stills every 20 frames of S15) are looked at by a person (see the notes of Patch 17).
import { BEAT, SHOTS } from "../src/config/timeline";
import { HERO_STATES, VIEW_SET, limitFor } from "../src/config/camera";
import { BOOK_SCRIPT, coverEventsOf, getBookLocation, getBookPose, stacksAt } from "../src/config/ledger";
import { LIGHTS, contactLook } from "../src/config/lights";
import { MOTION } from "../src/config/bookMotion";
import { auditMotion } from "../src/camera/audit";
import { authoredAt } from "../src/camera/path";
import { closeFrames, coverAngleAt } from "../src/book/rig/cover";
import { setDownTimes } from "../src/book/rig/setDown";
import { dustSources } from "../src/scene/dustField";
import { decalHeightCm } from "../src/scene/Pile";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, shotById } from "../src/shots";
import { eq, near, test, truthy } from "./harness";

const S = BOOK_SCRIPT["mini-me"]!;
const T = setDownTimes("mini-me", S.setDown.start, S.setDown.speed);

test("patch 17: S14 and S15 are on the table's frames and own their keys, S15's last key (3000) is where S16 starts from", () => {
  eq(`${SHOTS[14].from}-${SHOTS[14].to}`, "2760-2879");
  eq(`${SHOTS[15].from}-${SHOTS[15].to}`, "2880-2999");
  eq(JSON.stringify(shotById("S14").camera.map((k) => k.frame)), JSON.stringify([2820]));
  eq(JSON.stringify(shotById("S15").camera.map((k) => k.frame)), JSON.stringify([2910, 3000]));
  truthy(FILM_CAMERA_KEYFRAMES.some((k) => k.frame === 3000), "S15's closing key on 3000 is in the film's camera (Patch 18 adds S16-S21 after it)");
  for (const k of [...shotById("S14").camera, ...shotById("S15").camera]) {
    eq(k.frame % BEAT, 0, `key ${k.frame} is on a beat`);
    eq(k.rollDeg, 0);
    eq(k.tiltDeg, 0);
  }
});

test("patch 17: the camera comes back to the pile view (M 4.63, focus 40, f/2.8) on frame 3000, from the links view on 2760, and M only falls", () => {
  near(authoredAt(2760).state.M, HERO_STATES.links.M, 1e-9);
  near(authoredAt(3000).state.M, 4.63, 1e-9, "the table's M for the end of S15");
  near(authoredAt(3000).state.M, VIEW_SET.M, 1e-9);
  near(authoredAt(3000).state.focusCm, 40, 1e-9);
  near(authoredAt(2820).state.focusCm, 38, 1e-9, "the table's focus for S14");
  for (let f = 2760; f <= 3000; f++) near(authoredAt(f).state.aperture, 2.8, 1e-9, `aperture at ${f}`);
  let prev = authoredAt(2760).state.M;
  for (let f = 2761; f <= 3000; f++) {
    const m = authoredAt(f).state.M;
    truthy(m <= prev + 1e-9, `M never grows (${f}: ${m} after ${prev})`);
    prev = m;
  }
});

test("patch 17: the audit is clean for frames 2760-2999, with no exception and the limits of R3 held, and the whole film is clean but for the opening hold", () => {
  const r = auditMotion({ from: 2760, to: 2999, exceptions: [] });
  eq(r.findings.length, 0, JSON.stringify(r.findings));
  const all = auditMotion();
  eq(all.range.join("-"), "0-4799", "the film's camera now runs to the end of S23 (Patch 19)");
  eq(all.unexplained, 0, JSON.stringify(all.findings.filter((f) => !f.known)));
  eq(all.counts.STILL, 1, "only the documented opening hold");
  const lim = limitFor("R3");
  truthy(r.stats.peakLateralCmPerSec <= lim.lateralCmPerSec, `sideways ${r.stats.peakLateralCmPerSec} cm/s`);
  truthy(r.stats.peakMRatePerSec <= 1.5, `M rate ${r.stats.peakMRatePerSec}`);
  truthy(r.stats.peakPopFraction < 0.02, "the plate comes back without a pop");
});

test("patch 17: the board closes from 2820, lands on 2870 and has settled before the carry starts on 2880", () => {
  const ev = coverEventsOf("mini-me");
  const close = ev.find((e) => e.kind === "close")!;
  eq(close.start, 2820);
  const n = closeFrames(close.opts);
  eq(close.start + n, 2870, "50 frames: the speed of 1.4 and the book's 560 g");
  near(coverAngleAt(2819, ev), coverAngleAt(2760, ev), 1e-12, "the cover is open until the board starts to swing");
  near(coverAngleAt(2870, ev), 0, 1e-12, "it lands on 2870");
  for (let f = 2871; f <= 2880; f++) truthy(Math.abs(coverAngleAt(f, ev)) < 0.01, `rebound at ${f}`);
  truthy(Math.abs(coverAngleAt(2880, ev)) < 0.001, "and it is at rest by the carry");
  eq(stacksAt(2880, S.turns).left, 0, "the pages are all the way back at the front");
});

test("patch 17: the book touches the desk on frame 2940 (beat 98), is at rest on 2952 and stays", () => {
  eq(T.contact, 2940);
  eq(T.contact % BEAT, 0);
  eq(T.contact - S.setDown.start, 60, "a carry of 60 frames");
  truthy(T.rest - T.contact >= MOTION.settleFrames.min && T.rest - T.contact <= 12, `settled ${T.rest - T.contact} frames after the touch`);
  const y = (f: number) => getBookPose("mini-me", f)!.position[1];
  near(y(T.contact), 0, 1e-9, "on the desk at the touch");
  near(y(T.rest + 200), 0, 1e-9);
  eq(JSON.stringify(getBookPose("mini-me", T.rest)), JSON.stringify(getBookPose("mini-me", T.rest + 300)), "no motion after it has settled");
});

test("patch 17: the touch is soft: the book never goes through the desk, never falls faster than 8 cm/s at the touch, rebounds under 0.3 mm", () => {
  const y = (f: number) => getBookPose("mini-me", f)!.position[1];
  const fps = 60;
  const speed = (y(T.contact - 1) - y(T.contact)) * fps;
  truthy(speed > 0 && speed <= 8, `speed at the touch ${speed.toFixed(2)} cm/s`);
  let low = 0;
  let high = 0;
  for (let f = T.start; f <= T.rest + 60; f++) low = Math.min(low, y(f));
  for (let f = T.contact + 1; f <= T.rest; f++) high = Math.max(high, y(f));
  truthy(low > -0.05, `never through the desk (${low})`);
  truthy(high <= MOTION.setDown.reboundCm + 1e-3, `rebound ${high} cm`);
  // the descent slows down to the touch: the speed falls every frame over the last 10 frames before it
  for (let f = T.contact - 9; f <= T.contact; f++) truthy(y(f - 2) - y(f - 1) >= y(f - 1) - y(f) - 1e-9, `slower at ${f}`);
});

test("patch 17: the ledger puts MiniMe beside the pile from the carry on, and MiniLocker is the top book of the pile", () => {
  eq(getBookLocation("mini-me", 2879), "hand");
  eq(getBookLocation("mini-me", 2999), "beside");
  eq(getBookLocation("mini-me", 3300), "beside");
});

test("patch 17: the contact patch is absent high up, tightens and darkens as the book lowers, and is the resting patch at the touch", () => {
  const C = LIGHTS.contact;
  eq(contactLook(0).opacity, 1);
  eq(contactLook(0).spread, 1);
  eq(contactLook(C.liftCm).opacity, 0);
  eq(contactLook(C.liftCm + 5).opacity, 0);
  near(contactLook(C.liftCm).spread, C.liftSpread, 1e-12);
  eq(contactLook(-1).opacity, 1, "a negative height is the resting patch");
  let prev = contactLook(C.liftCm);
  for (let h = C.liftCm - 0.25; h >= 0; h -= 0.25) {
    const l = contactLook(h);
    truthy(l.opacity >= prev.opacity && l.spread <= prev.spread, `monotone at ${h} cm`);
    prev = l;
  }
  // along the real descent: no frame changes the patch by more than a fifth of its darkness
  let last = -1;
  for (let f = T.start; f <= T.rest; f++) {
    const st = { location: getBookLocation("mini-me", f), pose: getBookPose("mini-me", f)! } as Parameters<typeof decalHeightCm>[0];
    const h = decalHeightCm(st);
    const o = h === null ? 0 : contactLook(h).opacity;
    if (last >= 0) truthy(Math.abs(o - last) <= 0.2, `the patch does not pop on ${f}: ${last.toFixed(3)} to ${o.toFixed(3)}`);
    last = o;
  }
  eq(last, 1, "the patch is the full resting patch when the book has settled");
});

test("patch 17: the cues: cover-close on 2820 and riffle on 2760 are on the shots' frames, book-set is two frames before the touch", () => {
  const by = (id: string) => shotById(id).cues.map((c) => `${c.frame}:${c.name}`).join(",");
  eq(by("S14"), "2760:riffle,2820:cover-close");
  eq(by("S15"), "2938:book-set", "the sound of the set-down starts 2 frames before the contact on 2940");
  eq(T.contact - 2938, 2);
  const names = FILM_CUES.filter((c) => c.frame >= 2760 && c.frame < 3000).map((c) => c.name);
  eq(names.join(","), "riffle,cover-close,book-set");
});

test("patch 17: the dust is stirred by the close (on its landing) and by the touch", () => {
  const src = dustSources().filter((s) => s.frame >= 2760 && s.frame < 3000);
  eq(src.map((s) => s.frame).join(","), "2870,2940");
});
