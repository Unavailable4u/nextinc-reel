import { BAR, BEAT, CUT_FRAMES, FPS, SHOTS, TOTAL, checkTimeline, clockAt, shotAt, timecode, sec, beat, bar } from "../src/config/timeline";
import { arrive, lift, signature, remap, progress } from "../src/lib/ease";
import { SPRINGS, settleTime, springAt } from "../src/lib/spring";
import { gauss, prng } from "../src/lib/prng";
import { makeNoise } from "../src/lib/noise";
import { hashObject, hashString, stableStringify } from "../src/lib/hash";
import { deg, toDeg } from "../src/lib/units";
import { eq, near, test, throws, truthy } from "./harness";

// ---------- timeline ----------
test("constants: 60 fps, beat 30, bar 120, 5400 frames = 90 s", () => {
  eq(FPS, 60);
  eq(BEAT, 30);
  eq(BAR, 120);
  eq(TOTAL, 5400);
  eq(TOTAL / FPS, 90);
  eq(sec(1.5), 90);
  eq(beat(2), 60);
  eq(bar(3), 360);
});
test("26 shots S00-S25, contiguous, whole bars, 5400 frames in total", () => {
  eq(SHOTS.length, 26);
  checkTimeline();
  eq(SHOTS.reduce((n, s) => n + (s.to - s.from + 1), 0), 5400);
  eq(CUT_FRAMES.length, 25);
  truthy(CUT_FRAMES.every((c) => c % BAR === 0), "every cut lands on a bar line");
});
test("shot boundaries copied from the storyboard (spot checks)", () => {
  eq(SHOTS[0].to, 239);
  eq(SHOTS[1].from, 240);
  eq(SHOTS[5].from, 1080);
  eq(SHOTS[11].from, 2040);
  eq(SHOTS[13].to, 2759);
  eq(SHOTS[22].from, 3960);
  eq(SHOTS[23].from, 4320);
  eq(SHOTS[25].to, 5399);
});
test("acceptance frames: readout is right at 0, 239, 240, 1080, 3960, 5399 and S14 at 2760..2879", () => {
  eq(shotAt(0).id, "S00");
  eq(shotAt(239).id, "S00");
  eq(shotAt(240).id, "S01");
  eq(shotAt(1080).id, "S05");
  eq(shotAt(2760).id, "S14");
  eq(shotAt(3960).id, "S22");
  eq(shotAt(5399).id, "S25");
  eq(shotAt(-5).id, "S00");
  eq(shotAt(99999).id, "S25");
});
test("a broken table is rejected with a clear message", () => {
  throws(() => checkTimeline([...SHOTS.slice(0, 3), { ...SHOTS[4] }]), "expected", "gap");
  throws(() => checkTimeline(SHOTS.slice(0, 25)), "TOTAL", "short");
});
test("clockAt and timecode", () => {
  const c = clockAt(2760);
  eq(c.bar, 23);
  eq(c.beat, 92);
  eq(c.frameInBeat, 0);
  eq(timecode(5400), "1:30.00");
  eq(timecode(60), "0:01.00");
});

// ---------- easing ----------
test("easings: endpoints, monotone, signature is symmetric", () => {
  for (const e of [signature, arrive, lift]) {
    near(e(0), 0, 1e-9);
    near(e(1), 1, 1e-9);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = e(i / 100);
      truthy(v >= prev - 1e-9, "monotone");
      prev = v;
    }
  }
  near(signature(0.5), 0.5, 1e-6);
  near(signature(0.25) + signature(0.75), 1, 1e-6);
  truthy(arrive(0.3) > 0.5, "arrive is front-loaded");
});
test("remap and progress clamp", () => {
  eq(progress(5, 10, 20), 0);
  eq(progress(25, 10, 20), 1);
  near(remap(15, 10, 20, 100, 200), 150, 1e-9);
  near(remap(15, 10, 20, 100, 200, signature), 150, 1e-6);
});

// ---------- springs ----------
test("springs reach the target and start at the origin", () => {
  for (const sp of Object.values(SPRINGS)) {
    near(springAt(0, sp), 0, 1e-12);
    near(springAt(settleTime(sp, 0.001) + 1, sp), 1, 0.002);
  }
});
test("underdamped springs overshoot, critical and overdamped do not", () => {
  const over = (z: number) => {
    let m = 0;
    for (let i = 0; i < 400; i++) m = Math.max(m, springAt(i / 100, { zeta: z, hz: 3 }));
    return m;
  };
  truthy(over(0.45) > 1.1, "settle spring overshoots by more than 10%");
  truthy(over(0.6) > 1.05, "cover spring overshoots");
  truthy(over(1) <= 1 + 1e-9, "critical");
  truthy(over(1.7) <= 1 + 1e-9, "overdamped");
  // overshoot of a 0.6 damped step is exp(-pi z / sqrt(1-z^2)) = 0.0948
  near(over(0.6), 1 + Math.exp((-Math.PI * 0.6) / Math.sqrt(1 - 0.36)), 0.003, "theoretical overshoot");
});
test("the three solution branches agree where they meet (continuity in zeta)", () => {
  for (const t of [0.05, 0.2, 0.5]) {
    const a = springAt(t, { zeta: 0.9999, hz: 2 });
    const b = springAt(t, { zeta: 1, hz: 2 });
    const c = springAt(t, { zeta: 1.0001, hz: 2 });
    near(a, b, 1e-3);
    near(c, b, 1e-3);
  }
});
test("initial velocity is honoured (numerical derivative at t=0)", () => {
  for (const z of [0.5, 1, 2]) {
    const v0 = 3;
    const h = 1e-6;
    const d = (springAt(h, { zeta: z, hz: 2 }, 0, 1, v0) - springAt(0, { zeta: z, hz: 2 }, 0, 1, v0)) / h;
    near(d, v0, 1e-3, `zeta ${z}`);
  }
});

// ---------- prng / noise / hash / units ----------
test("prng is deterministic, in [0,1), and different seeds differ", () => {
  const a = prng(42);
  const b = prng(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    eq(x, b());
    truthy(x >= 0 && x < 1);
  }
  truthy(prng(1)() !== prng(2)());
  const r = prng(9);
  let s = 0;
  for (let i = 0; i < 4000; i++) s += gauss(r);
  near(s / 4000, 0, 0.1, "gauss mean");
});
test("noise is deterministic, bounded and smooth", () => {
  const a = makeNoise(7);
  const b = makeNoise(7);
  let maxStep = 0;
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.01;
    eq(a.n1(x), b.n1(x));
    const v = a.n1(x);
    truthy(v >= -1 && v <= 1, "n1 range");
    truthy(Math.abs(a.n2(x, x * 0.7)) <= 1, "n2 range");
    truthy(Math.abs(a.fbm1(x)) <= 1, "fbm range");
    maxStep = Math.max(maxStep, Math.abs(a.n1(x + 0.01) - v));
  }
  truthy(maxStep < 0.1, `smooth (max step ${maxStep})`);
});
test("hash: stable under key order, sensitive to content", () => {
  eq(hashObject({ a: 1, b: [1, 2] }), hashObject({ b: [1, 2], a: 1 }));
  truthy(hashObject({ a: 1 }) !== hashObject({ a: 2 }));
  eq(hashString("abc"), "1A47E90B".toLowerCase());
  eq(stableStringify({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
});
test("units: degrees round trip", () => {
  near(toDeg(deg(37.5)), 37.5, 1e-12);
});
