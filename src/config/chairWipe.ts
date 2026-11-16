// THE CHAIR WIPE (Patch 19), as data and pure functions. The set is swapped on frames 4140-4199 (the ledger's row, D-48) and the chair is what hides it: a
// mass of dark, soft leather that passes close to the lens and covers the whole frame, so no frame shows the pile leave, the riser arrive or the other three
// books appear. The plate's own chair is only 132 photo px wide (x 740-872), so at the magnifications of S22 (2.46 to 4.6) it cannot fill a 1920 px frame; the
// mass is drawn over the picture by `src/fx/ChairWipe.tsx`, and every number it needs is here so that a test can prove, for every column of the frame, that it is covered.
//
// THE MASS. A band, as tall as the frame, with soft edges (the leather is close to the lens, so it is out of focus: the edge is `feather` px either side of its
// line). It travels right to left, the way a near object does when the camera trucks right. Its left edge is at x_L(t) = x_c - g(u), u = (t - centre) / half,
// g(u) = a u + b u^3: slow in the middle (the leather drifts past while it fills the frame) and fast at the ends (the swing of the chair as it comes and goes). x_R = x_L + W.
// `a` is the speed at the middle; `b` and W follow from the two times that matter, the frames the band is in place and the frames it starts to leave.
//
// THE COVER. Every pixel of the frame has alpha 1 from `coverFrom` to `coverTo`: the swap's two frames (4140 and 4200) each have 6 frames of margin. The wipe begins on
// `enter` (the first frame its soft edge touches the frame's right side) and is gone on `exit`.
//
// No React and no imports, so a plain Node (the tests) can read it. Frame numbers are the beats of the table (4050 = beat 135, 4170 = beat 139, 4290 = beat 143).

export const CHAIR_WIPE = {
  /** the first frame the wipe touches the picture, and the last frame it is on it (beats 135 and 143) */
  enter: 4050,
  exit: 4290,
  /** the middle of the wipe (beat 139): the camera rests here (`VIEW_TURN`) */
  centre: 4170,
  /** every column of the frame is fully covered from here to here, inclusive; the ledger's swap is 4140-4199 and the three books arrive on 4200 */
  coverFrom: 4134,
  coverTo: 4206,
  /** half the width of the soft edge, px (the whole edge is 660 px wide) */
  feather: 330,
  /** the band's speed at its middle, px per frame */
  centreSpeed: 5,
  /** the output frame this is drawn in */
  width: 1920,
  height: 1080,
  /** the leather: the body, the brown of the chair's bolsters at the soft edges, and how much the sheen lifts the body */
  body: "#14100d",
  rim: "#4a2619",
  sheen: 0.05,
  /** the seams of the chair back, as fractions of the band's width, and how wide and how dark they are */
  seams: [0.08, 0.17, 0.29, 0.41, 0.53, 0.66, 0.77, 0.9] as readonly number[],
  seamWidth: 18,
  seamOpacity: 0.55,
} as const;

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const H = (CHAIR_WIPE.centre - CHAIR_WIPE.enter);
const U_COVER = (CHAIR_WIPE.centre - CHAIR_WIPE.coverFrom) / H;
const TRAVEL = CHAIR_WIPE.width + 2 * CHAIR_WIPE.feather;
const A = CHAIR_WIPE.centreSpeed * H;
/** g(1) - g(U_COVER) = the width of the frame plus both soft edges: what the band moves while it enters */
const B = (TRAVEL - A * (1 - U_COVER)) / (1 - U_COVER ** 3);
const g = (u: number): number => A * u + B * u ** 3;
const X_C = -CHAIR_WIPE.feather - g(U_COVER);
/** the band's width, px */
export const WIPE_BAND_WIDTH = TRAVEL + 2 * g(U_COVER);

/** The band's two edge lines (px, frame coordinates) at a frame; null when the wipe is not on the picture. */
export function chairBandAt(frame: number): { xL: number; xR: number } | null {
  if (frame < CHAIR_WIPE.enter || frame > CHAIR_WIPE.exit) return null;
  const u = (frame - CHAIR_WIPE.centre) / H;
  const xL = X_C - g(u);
  return { xL, xR: xL + WIPE_BAND_WIDTH };
}

/** How much of the picture is replaced by the leather at column x (px) of a frame, 0 to 1. A pure function of the frame. */
export function chairAlpha(frame: number, x: number): number {
  const b = chairBandAt(frame);
  if (!b) return 0;
  const F = CHAIR_WIPE.feather;
  const lead = smooth((x - (b.xL - F)) / (2 * F));
  const trail = 1 - smooth((x - (b.xR - F)) / (2 * F));
  return lead * trail;
}

/** The least alpha over the columns of the frame: 1 means no pixel of the picture shows. Columns are sampled every `step` px, the ends included. */
export function chairCover(frame: number, step = 4): number {
  let min = 1;
  for (let x = 0; x <= CHAIR_WIPE.width; x += step) min = Math.min(min, chairAlpha(frame, x));
  return Math.min(min, chairAlpha(frame, CHAIR_WIPE.width));
}

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

/** The colour of the leather at column x: the brown of the bolster where the edge is thin, the black-brown body where it is thick, and a slow sheen along the band. */
export function chairColour(frame: number, x: number): [number, number, number] {
  const b = chairBandAt(frame);
  const a = chairAlpha(frame, x);
  const body = hex(CHAIR_WIPE.body);
  const rim = hex(CHAIR_WIPE.rim);
  const local = b ? x - b.xL : 0;
  const sheen = 1 + CHAIR_WIPE.sheen * Math.cos((2 * Math.PI * local) / 1700);
  const k = smooth(a);
  return [0, 1, 2].map((i) => Math.round(Math.min(255, (rim[i] + (body[i] - rim[i]) * k) * sheen))) as [number, number, number];
}

/** The seams of the chair back: where each is on screen (centre, px) and how much of it shows (the alpha of the band there times the seam's own opacity). */
export function chairSeams(frame: number): { x: number; opacity: number }[] {
  const b = chairBandAt(frame);
  if (!b) return [];
  return CHAIR_WIPE.seams
    .map((f) => {
      const x = b.xL + f * WIPE_BAND_WIDTH;
      return { x, opacity: chairAlpha(frame, x) * CHAIR_WIPE.seamOpacity };
    })
    .filter((s) => s.x > -CHAIR_WIPE.seamWidth && s.x < CHAIR_WIPE.width + CHAIR_WIPE.seamWidth && s.opacity > 0.001);
}
