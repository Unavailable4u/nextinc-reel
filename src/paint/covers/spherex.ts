// VOL. II, SPHEREX BLINK COMPARATOR (Patch 08, guide 04 section 3). Indigo cloth. The site's `orbits` motif as fine gold foil rings,
// off-centre and bleeding off the cover; the title in two lines, `SPHEREx` bold and `Blink Comparator` italic, in gold foil; the plain
// line `NASA Space Apps 2026` (text only, no logo); the authors.
//
// THE MOTIF is the one Patch 07 ported for the endpapers (`endpaperPattern` with the project's slug, so it is seeded and the same
// every time): one tile 26 cm wide, drawn once with the continuations over its border (nine copies, so a ring that crosses the edge
// carries on), and shifted so that the first system's centre lands where `COVER_ART` says. Foil has no alpha, so the pattern's own
// alphas are dropped and the ring width is the config's (`lineCm`), not the pattern's (that one is for a ghost on paper).

import { COVER_ART } from "../../config/covers";
import { getBook } from "../../data/select";
import { circleCmds, ellipseCmds, transformPath, type PathCmd } from "../svgPath";
import { endpaperPattern, type PatternShape } from "../patterns";
import { painterOf } from "./render";
import { planCover, fillOp, paintOf, strokeOp, type CoverArt, type Ctx, type Frame } from "./common";
import type { CoverData, CoverPlanner, CoverTokens, Op } from "./types";

const A = COVER_ART["spherex-blink"];

/** The cmds of one pattern shape in tile units, as px at `size` px per tile, offset by (`ox`, `oy`) px. Lines and rectangles never occur in `orbits`. */
function shapeCmds(s: PatternShape, size: number, ox: number, oy: number): { cmds: PathCmd[]; fill: boolean } | null {
  if (s.kind === "circle") return { cmds: circleCmds(s.cx * size + ox, s.cy * size + oy, s.r * size), fill: s.fill };
  if (s.kind === "ellipse") {
    // the unit circle through the matrix [ax ay; -k ay  k ax] (the same one `paintPattern` uses), so the points move and the stroke keeps its width
    const m = [s.ax * size, s.ay * size, -s.ay * s.k * size, s.ax * s.k * size, s.cx * size + ox, s.cy * size + oy] as const;
    return { cmds: transformPath(ellipseCmds(0, 0, 1, 1), m), fill: false };
  }
  return null;
}

export function orbitsOps(ctx: Ctx, f: Frame): Op[] {
  const book = getBook(ctx.data.id);
  const pattern = endpaperPattern({ slug: book.slug, motif: "orbits", palette: book.palette });
  const size = f.cm(A.tileCm);
  // the first system's centre is the first shape's centre; carry it to the config's share of the board
  const first = pattern.shapes[0];
  if (first.kind !== "ellipse" && first.kind !== "circle") throw new Error("spherex: the orbits pattern changed shape; its first shape must be a ring or an ellipse");
  const ox0 = f.w * A.centre.x - first.cx * size;
  const oy0 = f.h * A.centre.y - first.cy * size;
  const paint = paintOf(ctx, { layer: "foil", color: "foilPrimary" });
  const ops: Op[] = [];
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      for (const s of pattern.shapes) {
        const c = shapeCmds(s, size, ox0 + i * size, oy0 + j * size);
        if (!c) continue;
        ops.push(c.fill ? fillOp(c.cmds, paint) : strokeOp(c.cmds, paint, f.cm(A.lineCm), { cap: "round" }));
      }
    }
  }
  return ops;
}

export const spherexArt: CoverArt = {
  front: orbitsOps,
  title: { mode: "top", at: A.titleTop, breakAtStyleChange: true },
  line: { italic: false, smallCaps: false },
  emblem: null,
  back: { line: false, summary: true, backLine: true },
};

export const planSpherex: CoverPlanner = (data: CoverData, tokens: CoverTokens) => planCover(data, tokens, spherexArt);
export const paintCover = painterOf(planSpherex);
