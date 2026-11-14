// THE HERO MOTION AS DATA (Patch 15). What the held book does on top of the lift's reading pose while the camera shows it: the slow yaw
// orbit of the cover hero (S05) and the reading tilt of the open book (S06 on). The match camera cannot orbit or tilt (the plate is a
// flat photograph, guide 05 section 1), so the book turns in front of it instead: the guide's "+-8 degrees of orbit" is the book's yaw and
// its "tilt down 10 degrees to read" is the book's pitch going from 80 to 70 degrees (D-65).
//
// Nobody places the book by hand: `getBookPose` in `config/ledger.ts` adds `heroOffsetAt(frame)` to the pose of a book in the hand
// (`heroPoseAt`), so the offsets are the same in the film, the lab and the tests. Everything is a pure function of the frame.
//
// UNITS: frames and degrees. Each track is a list of keys; between two keys the value goes along a cosine ease (zero speed at both ends),
// so a track never jumps and never has a corner. A track is 0 before its first key and holds its last value after its last key.

import { clamp01 } from "../lib/ease";

export interface HeroKey {
  frame: number;
  deg: number;
}

/** Keys of one angle of the hero motion. Frames are in order, the first and last value are 0 so the book starts and ends on the lift's pose. */
export type HeroTrack = readonly HeroKey[];

export const HERO = {
  /**
   * The slow orbit of the cover hero (S05, guide 01): the cover turns 8 degrees one way, sweeps through to 8 degrees the other way and
   * comes back square to the camera for the opening. It starts on frame 1083 (the lift has settled: `liftTimes("mini-me", 960).settled`),
   * so the lift's overshoot and this move never overlap, goes to the left in 88 frames, sweeps 16 degrees in 178 (peak 8.5 degrees a
   * second, the same as the way in and out: a ramp covers half the sweep's angle in half its time; the middle of the sweep is frame 1260,
   * beat 3 of bar 10) and comes back in 88. Positive yaw turns the cover's right side away.
   */
  yaw: [
    { frame: 1083, deg: 0 },
    { frame: 1171, deg: -8 },
    { frame: 1349, deg: 8 },
    { frame: 1437, deg: 0 },
  ] as HeroTrack,
  /**
   * The reading tilt (S06 on, guide 05 section 4: "tilt down 10 degrees to read the open book"): the book's pitch goes from 80 to 70
   * degrees while the cover opens, stays there for the pages, and goes back to 80 over the last 120 frames before the set-down
   * (frames 2760-2880, the closing shot) so the carry of Patch 17 starts from the reading pose and nothing jumps.
   */
  pitch: [
    { frame: 1440, deg: 0 },
    { frame: 1560, deg: -10 },
    { frame: 2760, deg: -10 },
    { frame: 2880, deg: 0 },
  ] as HeroTrack,
  /** the frame the specular sweep crosses the logo: the middle of the yaw sweep, beat 3 of bar 10 (bar index 10 counted from 0, guide 01) */
  specularFrame: 1260,
} as const;

const cosEase = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));

/** The value of a track at a frame, degrees. */
export function trackAt(track: HeroTrack, frame: number): number {
  if (track.length === 0 || frame <= track[0].frame) return 0;
  const last = track[track.length - 1];
  if (frame >= last.frame) return last.deg;
  let i = 0;
  while (i + 2 < track.length && track[i + 1].frame <= frame) i++;
  const a = track[i];
  const b = track[i + 1];
  return a.deg + (b.deg - a.deg) * cosEase((frame - a.frame) / (b.frame - a.frame));
}

export interface HeroOffset {
  /** added to the held book's yaw, degrees */
  yawDeg: number;
  /** added to the held book's pitch, degrees */
  pitchDeg: number;
}

/** What the hero motion adds to the held book's pose at a frame. Zero before the cover hero and again from the set-down on. */
export const heroOffsetAt = (frame: number, hero: Pick<typeof HERO, "yaw" | "pitch"> = HERO): HeroOffset => ({ yawDeg: trackAt(hero.yaw, frame), pitchDeg: trackAt(hero.pitch, frame) });

/** Throws unless every track starts and ends on 0 and its keys are in strict frame order, on whole frames. Runs when this module loads. */
export function checkHero(hero: Pick<typeof HERO, "yaw" | "pitch"> = HERO): void {
  for (const [name, t] of Object.entries({ yaw: hero.yaw, pitch: hero.pitch })) {
    if (t.length < 2) throw new Error(`hero: the ${name} track needs at least two keys`);
    if (t[0].deg !== 0 || t[t.length - 1].deg !== 0) throw new Error(`hero: the ${name} track must start and end on 0 degrees (the lift's and the set-down's poses)`);
    t.forEach((k, i) => {
      if (!Number.isInteger(k.frame)) throw new Error(`hero: ${name} key ${i} is on frame ${k.frame}, not a whole frame`);
      if (i > 0 && k.frame <= t[i - 1].frame) throw new Error(`hero: ${name} key ${i} (frame ${k.frame}) is not after the key before it (frame ${t[i - 1].frame})`);
      if (!Number.isFinite(k.deg)) throw new Error(`hero: ${name} key ${i} is not a number`);
    });
  }
}
checkHero();
