// VOL. I, MINI ME (Patch 08, guide 04 section 3). Near-black cloth. The traced Mini Me mark at the top in rose-red foil, the title
// `MiniMe` in off-white foil at 40 percent of the height, the tag line in italic print, the authors at the foot. On the spine: the
// mark at the head, the title top to bottom, the crimson x at the foot.
//
// The mark is `public/brand/mini-me-mark.svg`, vectorised by hand from the 512 px logo (a foil mask needs clean edges). It comes in
// through `tokens.miniMeMarkSvg`; when it is missing the plan carries a note and leaves the mark off (see `tracedMarkOps`).

import { COVER_ART } from "../../config/covers";
import { painterOf } from "./render";
import { planCover, paintOf, tracedMarkOps, type CoverArt } from "./common";
import type { CoverData, CoverPlanner, CoverTokens } from "./types";

const A = COVER_ART["mini-me"];

export const miniMeArt: CoverArt = {
  front: (ctx, f) => tracedMarkOps(ctx, f.w / 2, f.cm(A.markTopCm), f.cm(A.markWidthCm), paintOf(ctx, { layer: "foil", color: "foilPrimary" }), "top"),
  title: { mode: "centre", at: A.titleCentre, breakAtStyleChange: false },
  line: { italic: true, smallCaps: false },
  emblem: (ctx, cx, cy, size) => tracedMarkOps(ctx, cx, cy, size, paintOf(ctx, { layer: "foil", color: "foilPrimary" }), "centre"),
  back: { line: true, summary: true, backLine: false },
};

export const planMiniMe: CoverPlanner = (data: CoverData, tokens: CoverTokens) => planCover(data, tokens, miniMeArt);
export const paintCover = painterOf(planMiniMe);
