import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Freeze, cancelRender, continueRender, delayRender } from "remotion";
import { useThree } from "@react-three/fiber";
import { z } from "zod";
import { BOOK_IDS } from "../config/books";
import { PILLARBOX } from "../config/plate";
import { HEIGHT, SHOTS, WIDTH } from "../config/timeline";
import { CameraRig } from "../camera/CameraRig";
import { FILM_CAMERA_KEYFRAMES } from "../shots";
import { FilmSet, OverlayLayer } from "../ReelFilm";
import { Vignette } from "../fx/Vignette";
import { loadArtwork } from "../paint/covers";
import { loadFonts, stacks } from "../lib/fonts";
import { DEFAULT_COLUMNS, MAX_COLUMNS, MAX_OFFSET, MIN_COLUMNS, cellLabel, labelHeight, stripCells, stripLayout, type StripCell } from "./shotStrip";

void loadFonts();

/** Sliders in the Studio's right-hand panel. */
export const devShotStripSchema = z.object({
  /** how far into each shot the cell is: 0 is the first frame of every shot, and a shot shorter than this shows its last frame. Changing it draws the cells again */
  offset: z.number().int().min(0).max(MAX_OFFSET),
  /** the cells across; 26 cells in this many columns (the cells get smaller as the columns grow; fewer than 4 do not fit the page) */
  columns: z.number().int().min(MIN_COLUMNS).max(MAX_COLUMNS),
  /** a second line under each cell: the shot's name, its time, its regime and its length in bars */
  hud: z.boolean(),
  /** milliseconds each cell waits, after the film's frame is set and before it is drawn, for a machine without a GPU where the first draw is slow (500 is plenty); 0 for none */
  settleMs: z.number().int().min(0).max(60000).step(50),
});
export type DevShotStripProps = z.infer<typeof devShotStripSchema>;
export const defaultDevShotStripProps: DevShotStripProps = { offset: 0, columns: DEFAULT_COLUMNS, hud: true, settleMs: 100 };

/** The size of the picture kept for each cell, px (16:9). The page shows it at the size the layout gives, which is never above this at 1920 x 1080. */
const CAPTURE_W = 480;
const CAPTURE_H = 270;
const INK = "#F1EADB";
const DIM = "#8d877a";

/** Two animation frames and a timer: the film's frame has been applied to the scene, the lights and the books have caught up. */
async function settle(ms: number): Promise<void> {
  const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
  await frame();
  await frame();
  await new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
}

/**
 * The 3D canvas, copied small. Halves the picture until it is no more than twice the target and then draws it into the target, so a
 * 1920 x 1080 canvas (or 3840 x 2160 on a high-density screen) comes down without the jagged edges one big step gives.
 */
function copySmall(src: HTMLCanvasElement, dst: HTMLCanvasElement): void {
  let from: HTMLCanvasElement = src;
  while (from.width >= dst.width * 2 && from.height >= dst.height * 2) {
    const half = document.createElement("canvas");
    half.width = Math.max(dst.width, Math.floor(from.width / 2));
    half.height = Math.max(dst.height, Math.floor(from.height / 2));
    const g = half.getContext("2d");
    if (!g) throw new Error("DevShotStrip: this browser gave no 2D context");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(from, 0, 0, half.width, half.height);
    from = half;
  }
  const g = dst.getContext("2d");
  if (!g) throw new Error("DevShotStrip: this browser gave no 2D context");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.clearRect(0, 0, dst.width, dst.height);
  g.drawImage(from, 0, 0, dst.width, dst.height);
}

/**
 * Inside the canvas, after the frame of the cell has been put on the scene (the camera rig sets the view in a layout effect, and this
 * effect runs after it): waits a moment, draws the canvas once itself (`advance`, so it does not depend on whether Remotion or the Studio
 * is the one drawing), and hands the canvas to `onDrawn`. Runs again for every `step`.
 */
const Capture: React.FC<{ step: number; settleMs: number; onDrawn: (step: number, canvas: HTMLCanvasElement) => void }> = ({ step, settleMs, onDrawn }) => {
  const gl = useThree((s) => s.gl);
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    let alive = true;
    settle(settleMs).then(
      () => {
        if (!alive) return;
        advance(performance.now());
        onDrawn(step, gl.domElement);
      },
      (e: unknown) => cancelRender(e),
    );
    return () => {
      alive = false;
    };
  }, [step, settleMs, advance, gl, onDrawn]);
  return null;
};

const Label: React.FC<{ cell: StripCell; hud: boolean; width: number }> = ({ cell, hud, width }) => {
  const { title, detail, name } = cellLabel(cell, hud);
  const line: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div style={{ width, lineHeight: 1.3, paddingTop: 2 }}>
      <div style={{ ...line, fontSize: 17, color: INK }}>{title}</div>
      {detail ? <div style={{ ...line, fontSize: 13, color: DIM }}>{detail}</div> : null}
      {name ? <div style={{ ...line, fontSize: 13, color: DIM }}>{name}</div> : null}
    </div>
  );
};

/** The whole strip. Mounted again (a new `key`) whenever `offset` changes, so the cells are drawn from the first one. */
const Strip: React.FC<DevShotStripProps> = ({ offset, columns, hud, settleMs }) => {
  const cells = useMemo(() => stripCells(offset), [offset]);
  const layout = useMemo(() => stripLayout({ columns, count: cells.length, labelH: labelHeight(hud) }), [columns, cells.length, hud]);
  const [warm, setWarm] = useState(false);
  /** the cell the canvas is showing now; `cells.length` when every cell has been drawn */
  const [step, setStep] = useState(0);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const hold = useRef<number | null>(null);
  if (hold.current === null) hold.current = delayRender("Drawing the shot strip", { timeoutInMilliseconds: 240000 });
  const release = useCallback((): void => {
    if (hold.current !== null) {
      continueRender(hold.current);
      hold.current = null;
    }
  }, []);

  // the painted covers of all four books, once, before the first cell: the books are the same ones in every cell, and they are shared
  // with the set (`loadArtwork` keeps one promise per book), so after this a cell only waits for the set to catch up
  useEffect(() => {
    let alive = true;
    Promise.all(BOOK_IDS.map((id) => loadArtwork(id))).then(
      () => {
        if (alive) setWarm(true);
      },
      (e: unknown) => cancelRender(e),
    );
    return () => {
      alive = false;
    };
  }, []);

  // the render waits until every cell is drawn, and never longer than that: the hold is let go when the last cell is in, and if the
  // strip goes away first (another offset, another composition)
  const done = step >= cells.length;
  useEffect(() => {
    if (done) release();
  }, [done, release]);
  useEffect(() => release, [release]);

  const onDrawn = useCallback((i: number, canvas: HTMLCanvasElement): void => {
    const dst = canvases.current[i];
    if (!dst) throw new Error(`DevShotStrip: cell ${i} has no canvas to draw into`);
    copySmall(canvas, dst);
    setStep(i + 1);
  }, []);

  const frame = cells[Math.min(step, cells.length - 1)].frame;
  const scale = layout.cellW / WIDTH;
  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: INK, textShadow: "0 1px 5px #000, 0 0 2px #000" };

  return (
    <AbsoluteFill style={{ background: "#0b0b0c", ...mono }}>
      {/* the one canvas: the film's own camera rig and set at the frame of the cell being drawn. Kept on the page, clipped to a pixel, until every cell is done */}
      {warm && !done ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
          <CameraRig frame={frame} keys={FILM_CAMERA_KEYFRAMES} feather={PILLARBOX.feather}>
            <FilmSet frame={frame} />
            <Capture step={step} settleMs={settleMs} onDrawn={onDrawn} />
          </CameraRig>
        </div>
      ) : null}

      <div style={{ position: "absolute", left: 36, top: 22, lineHeight: 1.35 }}>
        <div style={{ fontSize: 30 }}>
          SHOT STRIP · {SHOTS.length} shots · {offset === 0 ? "the first frame of each" : `${offset} frames into each (a shorter shot shows its last frame)`}
        </div>
        <div style={{ fontSize: 17, color: DIM }}>{done ? "every cell drawn" : warm ? `drawing cell ${step + 1} of ${cells.length}` : "painting the covers"} · the film's own camera, set, overlay and vignette; no grain at this size</div>
      </div>

      {cells.map((c, i) => {
        const at = layout.cells[i];
        const drawn = step > i;
        return (
          <div key={c.id} style={{ position: "absolute", left: at.left, top: at.top, width: layout.cellW }}>
            <div style={{ position: "relative", width: layout.cellW, height: layout.cellH, background: "#151517", overflow: "hidden", outline: "1px solid #2a2a2e" }}>
              <canvas
                ref={(el) => {
                  canvases.current[i] = el;
                }}
                width={CAPTURE_W}
                height={CAPTURE_H}
                style={{ position: "absolute", left: 0, top: 0, width: layout.cellW, height: layout.cellH, display: "block" }}
              />
              {drawn ? (
                // the film's 2D layers at the cell's frame, drawn at full size and scaled down with the cell
                <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }}>
                  <Freeze frame={c.frame}>
                    <OverlayLayer frame={c.frame} />
                    <Vignette />
                  </Freeze>
                </div>
              ) : null}
            </div>
            <Label cell={c} hud={hud} width={layout.cellW} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * THE SHOT STRIP (Patch 13D). One labelled cell per shot, S00 to S25, each the film at that shot's first frame (or `offset` frames into
 * it), laid out in `columns` columns. Each cell is the film as `ReelFilm` draws it: the same camera rig on the same keyframes, the same
 * set (`FilmSet`: lights, shadow catcher, pile, riser, dust), the shot's own overlay and the vignette. Not the grain, which is invisible
 * at this size and would be 26 more full-size canvases.
 *
 * ONE WEBGL CANVAS. Twenty-six canvases at once is more than a browser keeps (it drops the oldest contexts) and more than the books'
 * painted covers can share, so the strip has one canvas, hidden, that is set to the frame of cell 0, drawn, copied small into cell 0's
 * picture, set to the frame of cell 1, and so on. A cell is a pure function of its frame: nothing from an earlier cell stays in it. It is
 * not made from stills of the film (`npm run stills`) because those would be out of date the moment a shot patch changes a shot.
 * A render waits (`delayRender`) until all 26 cells are drawn.
 */
export const DevShotStrip: React.FC<DevShotStripProps> = (p) => <Strip key={p.offset} {...p} />;
