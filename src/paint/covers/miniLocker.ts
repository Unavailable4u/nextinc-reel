// VOL. III, MINILOCKER (Patch 08, guide 04 section 3). Parchment linen. The five concentric arcs of the Blast Radius dial in blue
// foil, with the exact geometry of the app's dial (`brand.ts`); the title `Mini` in ink and `Locker` in crimson, printed; the line
// `Blast Radius Zero` in italic small caps; the authors. On the spine the small Mark (exact, `brand.ts`), the title, the crimson x.
//
// The dial and the Mark are never redrawn: `dialArcs` and `markShapes` carry the source's numbers and the tests compare them.

import { COVER, COVER_ART } from "../../config/covers";
import { dialArcs, markShapes } from "./brand";
import { painterOf } from "./render";
import { planCover, paintOf, fillOp, strokeOp, type CoverArt } from "./common";
import type { CoverData, CoverPlanner, CoverTokens, Op } from "./types";

const A = COVER_ART.minilocker;

export const miniLockerArt: CoverArt = {
  front: (ctx, f) => {
    const paint = paintOf(ctx, { layer: "foil", color: "foilPrimary" });
    return dialArcs(f.w * A.centre.x, f.h * A.centre.y, f.cm(A.dialCm)).map((a) => strokeOp(a.cmds, paint, a.width, { cap: "round" }));
  },
  title: { mode: "centre", at: A.titleCentre, breakAtStyleChange: false },
  line: { italic: true, smallCaps: true },
  // the Mark is printed (it has translucent rings, which foil cannot be): the book's ink, with the crimson centre. The head of the
  // spine reserves `emblemCm`; the Mark is `markCm` of it, centred.
  emblem: (_ctx, cx, cy, size) => markOps(cx, cy, size * (A.markCm / COVER.spine.emblemCm)),
  back: { line: false, summary: true, backLine: false },
};

/** The Mark as print operations, `size` px across. */
export function markOps(cx: number, cy: number, size: number): Op[] {
  return markShapes(cx, cy, size).map((s) => {
    const paint = { layer: "ink" as const, fill: s.color, alpha: s.opacity, depth: 0 };
    return s.mode === "fill" ? fillOp(s.cmds, paint) : strokeOp(s.cmds, paint, s.width, { dash: s.dash });
  });
}

export const planMiniLocker: CoverPlanner = (data: CoverData, tokens: CoverTokens) => planCover(data, tokens, miniLockerArt);
export const paintCover = painterOf(planMiniLocker);
