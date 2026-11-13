// THE DUST AS DATA (Patch 12). Every number of the motes that drift in the desk lamp's light (guide 03 section 5: "dust motes drift in the
// lamp cone and swirl when the book lifts (a small seeded force field, no physics engine)"; guide 01, S00: "a few dust motes drift in the
// lamp light"). `src/scene/dustField.ts` turns these into positions and brightness at a frame, `src/scene/Dust.tsx` draws them.
//
// How it works. The motes live in a box of desk coordinates around the pile. Each has a seeded start, a slow velocity and a slow wander;
// its place at a frame is that start plus velocity times time plus the wander, wrapped round the box, so the box stays evenly filled at
// every frame of the film and the motes never run out. A mote only shows where the lamp lights it: the lamp is a cone from the bulb to the
// pile, and the brightness falls to nothing at the cone's edge, near the bulb, beyond its length and near the faces of the box (which is
// where a wrapped mote reappears, so the wrap is never seen). When a book moves, a seeded force field pushes the motes near it: an
// outward and upward puff with a swirl that rises over about half a second and dies away over a few seconds. The field is a function of the
// frame only (no state is carried from frame to frame), so any frame can be rendered alone.
//
// Units: cm, desk coordinates (X to the right, Y up from the desk, Zd from the front edge towards the wall).

export const DUST = {
  /** the seed of every random number of the field */
  seed: 6601,
  /** how many motes are drawn. About a quarter of them are inside the cone at any frame. */
  count: 520,
  /** the volume the motes live in; a mote that leaves a face comes back through the opposite one */
  box: { x0: -60, x1: 45, y0: 0.5, y1: 44, zd0: -12, zd1: 64 },
  /** the lamp's cone: from the bulb towards `aim` (the middle of the pile), full brightness inside `halfAngleDeg - softDeg` */
  cone: {
    aim: { X: 0, Y: 6, Zd: 14 },
    halfAngleDeg: 31,
    softDeg: 11,
    /** nothing nearer the bulb than this (the globe's own glare is the plate's) */
    nearCm: 9,
    /** nothing beyond this, with a fade over the last `fadeCm` */
    lengthCm: 100,
    fadeCm: 18,
  },
  /** the slow motion of a mote: speed in cm per second (each between the two), a gentle fall, and the wander (amplitude, period in seconds) */
  drift: { speedCmPerSec: [0.12, 0.55] as readonly [number, number], fallCmPerSec: 0.05, wanderCm: 1.4, wanderSec: 9 },
  /** a mote's size (the diameter of its soft disc), cm: it is a speck, about two pixels at the pile's view */
  sizeCm: [0.07, 0.17] as readonly [number, number],
  /** a mote's own brightness, 0 to 1, between the two; and how much it twinkles, as a fraction, slowly (never a strobe) */
  brightness: [0.35, 1] as readonly [number, number],
  twinkle: { amount: 0.22, periodSec: 3.2 },
  /** how the brightness falls with the distance from the bulb: 1 at `refCm`, with the square law, kept between the two limits */
  falloff: { refCm: 60, min: 0.35, max: 1.8 },
  /** the film's colour of the light on the motes (the key lamp's colour) and the overall level (linear, added to the picture) */
  color: "#F0CEA0",
  level: 0.55,
  /** the soft fade at the faces of the box, cm */
  boxFadeCm: 4,
  /** the force field: `radiusCm` the reach of a puff, `peakCm` how far the nearest mote is pushed at the most, `riseSec` when it peaks, `fallSec` how long it takes to die away */
  disturb: { radiusCm: 15, peakCm: 6, riseSec: 0.6, fallSec: 1.6, swirl: 0.7, up: 0.55 },
  /** the three kinds of event that stir the dust, and how strongly (a multiple of `peakCm`): the lift, the cover's close and the set-down's touch */
  events: { lift: 1, close: 0.35, setDown: 0.6 },
} as const;
