// DRAWING A COVER PLAN (Patch 08). `paintSurface` takes the operations of one surface and draws them on three canvases:
//
//   color    what is printed or darkened on the cloth (RGBA; transparent where the cloth shows through)
//   foil     the foil stamping: its colour where it is, transparent elsewhere (the alpha IS the foil mask)
//   height   the deboss, greyscale: white is the flat cloth, black the deepest stamp (`255 x (1 - depth)`)
//
// then `normalFromHeight` turns the height canvas into the normal map the foil and the print take (guide 03: a 0.2 mm step).
// It touches a canvas only through the small `RenderCtx`, so a test can pass a recorder, and `normalFromHeight` is arithmetic on bytes.
// Nothing here is random and nothing reads a frame: the same plan draws the same pixels.

import { COVER, SURFACES, type Surface } from "../../config/covers";
import { MATERIALS } from "../../config/materials";
import { drawPath, roundRectCmds } from "../svgPath";
import { fontString } from "../typography";
import type { CoverData, CoverPlan, CoverPlanner, CoverTokens, Op, SurfacePlan } from "./types";

/** The part of a 2D context the painter uses. */
export type RenderCtx = Pick<
  CanvasRenderingContext2D,
  "save" | "restore" | "clip" | "beginPath" | "fill" | "stroke" | "fillText" | "translate" | "rotate" | "fillRect" | "clearRect" | "moveTo" | "lineTo" | "bezierCurveTo" | "closePath" | "setLineDash" | "font" | "fillStyle" | "strokeStyle" | "lineWidth" | "lineCap" | "lineJoin" | "globalAlpha" | "textBaseline" | "textAlign"
>;

/** What a canvas maker returns: the canvas itself (whatever kind the caller wants) and its 2D context. */
export interface Painted<C> {
  canvas: C;
  ctx: RenderCtx;
}
export type CanvasMaker<C> = (width: number, height: number) => Painted<C>;

export interface CoverLayers<C> {
  color: C;
  foil: C;
  height: C;
}

/** The ordinary maker in a browser: a `<canvas>` element. */
export const browserCanvasMaker: CanvasMaker<HTMLCanvasElement> = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("covers: this browser gave no 2D context");
  return { canvas, ctx };
};

const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
/** The grey of a stamp of `depth` (0 to 1) on the height canvas: white is flat. */
export const heightGrey = (depth: number): string => {
  const g = hex2(255 * (1 - Math.max(0, Math.min(1, depth))));
  return `#${g}${g}${g}`;
};

function drawOp(ctx: RenderCtx, op: Op, fill: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (op.kind === "text") {
    ctx.translate(op.x, op.y);
    if (op.rotation !== 0) ctx.rotate(op.rotation);
    ctx.fillStyle = fill;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    if (op.glyphs) {
      for (const g of op.glyphs) {
        ctx.font = fontString({ ...op.face, size: g.size });
        ctx.fillText(g.ch, g.x, 0);
      }
    } else {
      ctx.font = fontString({ ...op.face, size: op.size });
      ctx.fillText(op.text, 0, 0);
    }
  } else {
    ctx.beginPath();
    drawPath(ctx, op.cmds);
    if (op.mode === "fill") {
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      const s = op.stroke ?? { width: 1 };
      ctx.strokeStyle = fill;
      ctx.lineWidth = s.width;
      ctx.lineCap = s.cap ?? "butt";
      ctx.lineJoin = "round";
      ctx.setLineDash(s.dash ? [...s.dash] : []);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Draws one surface's plan on three new canvases (see the top of the file for what each one holds). */
export function paintSurface<C>(plan: SurfacePlan, make: CanvasMaker<C>): CoverLayers<C> {
  const color = make(plan.width, plan.height);
  const foil = make(plan.width, plan.height);
  const height = make(plan.width, plan.height);
  for (const c of [color, foil]) c.ctx.clearRect(0, 0, plan.width, plan.height);
  // the height canvas starts flat (white)
  height.ctx.fillStyle = heightGrey(0);
  height.ctx.fillRect(0, 0, plan.width, plan.height);

  // nothing is drawn closer to the board's outline than the bevel: every canvas is clipped to a rounded rectangle inside it
  const inset = COVER.clipInsetCm * plan.pxPerCm;
  const clip = roundRectCmds(inset, inset, plan.width - 2 * inset, plan.height - 2 * inset, COVER.clipRadiusCm * plan.pxPerCm);
  for (const c of [color, foil, height]) {
    c.ctx.save();
    c.ctx.beginPath();
    drawPath(c.ctx, clip);
    c.ctx.clip();
  }

  for (const op of plan.ops) {
    if (op.layer === "ink") {
      drawOp(color.ctx, op, op.fill, op.alpha);
    } else if (op.layer === "foil") {
      drawOp(foil.ctx, op, op.fill, 1);
      drawOp(height.ctx, op, heightGrey(op.depth), 1);
    } else {
      drawOp(color.ctx, op, op.fill, op.alpha);
      drawOp(height.ctx, op, heightGrey(op.depth), 1);
    }
  }
  for (const c of [color, foil, height]) c.ctx.restore();
  return { color: color.canvas, foil: foil.canvas, height: height.canvas };
}

/** Draws the three surfaces of a plan. */
export function paintPlan<C>(plan: CoverPlan, make: CanvasMaker<C>): Record<Surface, CoverLayers<C>> {
  return { front: paintSurface(plan.surfaces.front, make), spine: paintSurface(plan.surfaces.spine, make), back: paintSurface(plan.surfaces.back, make) };
}

/**
 * The `paintCover(data, tokens)` of a book: its planner, then the drawing. With no canvas maker it draws on `<canvas>` elements;
 * a test or a tool passes its own.
 */
export function painterOf(planner: CoverPlanner): {
  (data: CoverData, tokens: CoverTokens): Record<Surface, CoverLayers<HTMLCanvasElement>>;
  <C>(data: CoverData, tokens: CoverTokens, make: CanvasMaker<C>): Record<Surface, CoverLayers<C>>;
} {
  function paint(data: CoverData, tokens: CoverTokens): Record<Surface, CoverLayers<HTMLCanvasElement>>;
  function paint<C>(data: CoverData, tokens: CoverTokens, make: CanvasMaker<C>): Record<Surface, CoverLayers<C>>;
  function paint(data: CoverData, tokens: CoverTokens, make?: CanvasMaker<unknown>): Record<Surface, CoverLayers<unknown>> {
    return paintPlan(planner(data, tokens), make ?? browserCanvasMaker);
  }
  return paint;
}

// ---------------------------------------------------------------------------------------------------------------------------
// the normal map
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * A normal map (OpenGL convention: +x right, +y up the picture, flat is 128, 128, 255) from a height picture in RGBA bytes whose red
 * channel is the height, 255 flat and 0 the deepest. One unit of height is `depthPx` pixels deep (the deboss step in px: 0.2 mm is
 * 2 px at 100 px/cm). The wall of a stamp is first softened by `soften` passes of a 3 x 3 box blur, so it has a slope to catch light
 * and a one-pixel edge is not a cliff. Edges of the picture repeat their last row and column.
 */
export function normalFromHeight(rgba: ArrayLike<number>, width: number, height: number, depthPx: number, soften = COVER.debossSoftenPx): Uint8ClampedArray {
  const n = width * height;
  let h = new Float32Array(n);
  for (let i = 0; i < n; i++) h[i] = rgba[i * 4] / 255;
  for (let pass = 0; pass < soften; pass++) {
    const out = new Float32Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = Math.min(height - 1, Math.max(0, y + dy));
          for (let dx = -1; dx <= 1; dx++) s += h[yy * width + Math.min(width - 1, Math.max(0, x + dx))];
        }
        out[y * width + x] = s / 9;
      }
    }
    h = out;
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < height; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(width - 1, x + 1);
      // the surface is z = depthPx x h; its normal is (-dz/dx, -dz/dv, 1) and v runs up the picture, i.e. against the rows
      const dzdx = ((h[y * width + xp] - h[y * width + xm]) / (xp - xm)) * depthPx;
      const dzdrow = ((h[yp * width + x] - h[ym * width + x]) / (yp - ym)) * depthPx;
      const nx = -dzdx;
      const ny = dzdrow;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * width + x) * 4;
      out[o] = (nx * inv * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out[o + 2] = (inv * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** The deboss step in px at a surface's resolution (`MATERIALS.foil.debossCm`, 0.2 mm). */
export const debossPx = (pxPerCm: number): number => MATERIALS.foil.debossCm * pxPerCm;

/** The part of a context the normal map needs on top of drawing. */
export type ImageCtx = RenderCtx & Pick<CanvasRenderingContext2D, "getImageData" | "putImageData" | "createImageData">;

/** Reads a height canvas and paints its normal map on a new canvas. */
export function normalCanvas<C>(heightCtx: ImageCtx, width: number, height: number, pxPerCm: number, make: (w: number, h: number) => { canvas: C; ctx: ImageCtx }): C {
  const src = heightCtx.getImageData(0, 0, width, height);
  const bytes = normalFromHeight(src.data, width, height, debossPx(pxPerCm));
  const target = make(width, height);
  const img = target.ctx.createImageData(width, height);
  img.data.set(bytes);
  target.ctx.putImageData(img, 0, 0);
  return target.canvas;
}

/** GPU memory of one book's cover textures (colour, foil and normal map of each surface, RGBA8 with a full mip chain), bytes. */
export function coverTextureBytes(plan: CoverPlan): number {
  let bytes = 0;
  for (const s of SURFACES) bytes += plan.surfaces[s].width * plan.surfaces[s].height * 4 * 3 * (4 / 3);
  return Math.round(bytes);
}
