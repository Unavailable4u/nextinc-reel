// DRAWING A PAGE PLAN (Patch 09). `paintPage` takes the operations of one page and draws them on one canvas: the paper, then the ops in
// order (grain, endpaper pattern, text, shapes, pictures). It touches a canvas only through the small `PageRenderCtx`, so a test can pass a
// recorder, and nothing here is random except the grain, which is seeded: the same plan draws the same pixels.

import { prng } from "../../lib/prng";
import { paintPattern, type Ctx2D } from "../patterns";
import { drawPath } from "../svgPath";
import { fontString } from "../typography";
import type { CanvasMaker, RenderCtx } from "../covers/render";
import type { PageGrain, PageImage, PagePattern, PagePlan, PageShape, PageText, Turn } from "./types";

/** The part of a 2D context the page painter uses: the cover painter's, plus pictures, `arc`, `rect` and `transform` (the pattern). */
export type PageRenderCtx = RenderCtx & Pick<CanvasRenderingContext2D, "drawImage" | "scale" | "arc" | "rect" | "transform">;
export type PageCanvasMaker<C> = (width: number, height: number) => { canvas: C; ctx: PageRenderCtx };
/** A picture by its file (the loader has them all before the page is painted), or null when it is missing. */
export type ImageLookup = (file: string) => CanvasImageSource | null;

const turnAbout = (ctx: PageRenderCtx, t: Turn): void => {
  ctx.translate(t.cx, t.cy);
  ctx.rotate(t.rad);
  ctx.translate(-t.cx, -t.cy);
};

function drawText(ctx: PageRenderCtx, op: PageText): void {
  ctx.save();
  ctx.globalAlpha = op.alpha;
  if (op.turn) turnAbout(ctx, op.turn);
  ctx.translate(op.x, op.y);
  if (op.mirror) ctx.scale(-1, 1);
  ctx.fillStyle = op.fill;
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
  ctx.restore();
}

function drawShape(ctx: PageRenderCtx, op: PageShape): void {
  ctx.save();
  ctx.globalAlpha = op.alpha;
  ctx.beginPath();
  drawPath(ctx, op.cmds);
  if (op.mode === "fill") {
    ctx.fillStyle = op.fill;
    ctx.fill();
  } else {
    const s = op.stroke ?? { width: 1 };
    ctx.strokeStyle = op.fill;
    ctx.lineWidth = s.width;
    ctx.lineCap = s.cap ?? "butt";
    ctx.lineJoin = "round";
    ctx.setLineDash(s.dash ? [...s.dash] : []);
    ctx.stroke();
  }
  ctx.restore();
}

function drawImage(ctx: PageRenderCtx, op: PageImage, images: ImageLookup): void {
  const img = images(op.file);
  if (!img) return;
  ctx.save();
  if (op.turn) turnAbout(ctx, op.turn);
  ctx.beginPath();
  ctx.rect(op.dest.x, op.dest.y, op.dest.w, op.dest.h);
  ctx.clip();
  ctx.drawImage(img, op.src.x, op.src.y, op.src.w, op.src.h, op.dest.x, op.dest.y, op.dest.w, op.dest.h);
  ctx.restore();
}

/** Repeats `tile` over `rect`, the last tiles clipped to it. */
function repeat(ctx: PageRenderCtx, tile: CanvasImageSource, tilePx: number, rect: { x: number; y: number; w: number; h: number }): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  for (let y = rect.y; y < rect.y + rect.h; y += tilePx) for (let x = rect.x; x < rect.x + rect.w; x += tilePx) ctx.drawImage(tile, x, y, tilePx, tilePx);
  ctx.restore();
}

function drawPattern<C>(ctx: PageRenderCtx, op: PagePattern, make: PageCanvasMaker<C>): void {
  const tile = make(op.tilePx, op.tilePx);
  paintPattern(tile.ctx as unknown as Ctx2D, op.spec, op.tilePx);
  repeat(ctx, tile.canvas as unknown as CanvasImageSource, op.tilePx, op.rect);
}

/** Paper grain: one tile of seeded speckles (a fraction of the pixels, dark or light, each at a low alpha), repeated over the rect. */
function drawGrain<C>(ctx: PageRenderCtx, op: PageGrain, make: PageCanvasMaker<C>): void {
  const tile = make(op.tilePx, op.tilePx);
  const r = prng(op.seed);
  const n = Math.round(op.tilePx * op.tilePx * 0.18);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * op.tilePx);
    const y = Math.floor(r() * op.tilePx);
    const dark = r() < 0.55;
    tile.ctx.globalAlpha = op.amount * (0.35 + 0.65 * r());
    tile.ctx.fillStyle = dark ? "#2A241C" : "#FFFFFF";
    tile.ctx.fillRect(x, y, 1, 1);
  }
  tile.ctx.globalAlpha = 1;
  repeat(ctx, tile.canvas as unknown as CanvasImageSource, op.tilePx, op.rect);
}

/** Draws a page plan on a new canvas of the plan's size. Pictures come from `images`; a missing one is left out (the plan's notes say so). */
export function paintPage<C>(plan: PagePlan, make: PageCanvasMaker<C>, images: ImageLookup): C {
  const { canvas, ctx } = make(plan.width, plan.height);
  ctx.fillStyle = plan.paper;
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, plan.width, plan.height);
  for (const op of plan.ops) {
    switch (op.kind) {
      case "grain":
        drawGrain(ctx, op, make);
        break;
      case "pattern":
        drawPattern(ctx, op, make);
        break;
      case "text":
        drawText(ctx, op);
        break;
      case "shape":
        drawShape(ctx, op);
        break;
      case "image":
        drawImage(ctx, op, images);
        break;
    }
  }
  return canvas;
}

/** The ordinary maker in a browser: a `<canvas>` element. */
export const browserPageMaker: PageCanvasMaker<HTMLCanvasElement> = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("pages: this browser gave no 2D context");
  return { canvas, ctx };
};

/** Re-exported so callers that only want the type do not reach into the cover painter. */
export type { CanvasMaker };
