import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { BAND_COLOR, M_FIT_HEIGHT, M_FIT_WIDTH, PILLARBOX, PLATE_H, PLATE_W, magnificationBand, minBlurPx } from "../config/plate";
import { HEIGHT, WIDTH } from "../config/timeline";
import { clampView, photoToScreen, plateScreenRect } from "../plate/PlateFollow";
import { Stage } from "../stage";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

/** Sliders in the Studio's right-hand panel. */
export const devPlateSchema = z.object({
  M: z.number().min(1).max(12).step(0.01),
  cx: z.number().min(0).max(PLATE_W).step(1),
  cy: z.number().min(0).max(PLATE_H).step(1),
  feather: z.boolean(),
  applyMargin: z.boolean(),
  grid: z.boolean(),
});
export type DevPlateProps = z.infer<typeof devPlateSchema>;
export const defaultDevPlateProps: DevPlateProps = { M: Number(M_FIT_HEIGHT.toFixed(3)), cx: PLATE_W / 2, cy: PLATE_H / 2, feather: true, applyMargin: false, grid: false };

/** The plate under a view you choose, with the magnification read-out and the budget colour band (green <= 2.6, amber 2.6-5, red > 5). */
export const DevPlate: React.FC<DevPlateProps> = ({ M, cx, cy, feather, applyMargin, grid }) => {
  const raw = { M, cx, cy };
  const chk = clampView(raw);
  const view = applyMargin ? chk.view : raw;
  const band = magnificationBand(view.M);
  const color = BAND_COLOR[band];
  const rect = plateScreenRect(view);
  const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000" };
  const lines: React.ReactNode[] = [];
  if (grid) {
    for (let x = 0; x <= PLATE_W; x += 50) {
      const a = photoToScreen(view, x, 0);
      const b = photoToScreen(view, x, PLATE_H);
      lines.push(<line key={`x${x}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={x % 100 === 0 ? "#41e0ff" : "#2a7f90"} strokeWidth={1} opacity={0.7} />);
      if (x % 100 === 0) lines.push(<text key={`tx${x}`} x={a.x + 4} y={Math.max(14, a.y + 14)} fill="#41e0ff" fontSize={14} fontFamily={stacks.mono}>{x}</text>);
    }
    for (let y = 0; y <= PLATE_H; y += 50) {
      const a = photoToScreen(view, 0, y);
      const b = photoToScreen(view, PLATE_W, y);
      lines.push(<line key={`y${y}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={y % 100 === 0 ? "#ff4fd8" : "#8a2f78"} strokeWidth={1} opacity={0.7} />);
      if (y % 100 === 0) lines.push(<text key={`ty${y}`} x={Math.max(4, a.x + 4)} y={a.y - 4} fill="#ff4fd8" fontSize={14} fontFamily={stacks.mono}>{y}</text>);
    }
  }
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage view={view} feather={feather ? PILLARBOX.feather : 0} />
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0 }}>
        {grid ? lines : null}
        <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} fill="none" stroke={color} strokeWidth={2} strokeDasharray="10 8" opacity={0.9} />
      </svg>
      <div style={{ position: "absolute", left: 36, top: 30, ...mono }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40 }}>
          <span style={{ display: "inline-block", width: 22, height: 22, borderRadius: 11, background: color, boxShadow: `0 0 14px ${color}` }} />
          M = {view.M.toFixed(3)} <span style={{ fontSize: 24, opacity: 0.85 }}>{band}</span>
        </div>
        <div style={{ fontSize: 20, lineHeight: 1.5, opacity: 0.9, marginTop: 8 }}>
          photo on screen {Math.round(PLATE_W * view.M)} x {Math.round(PLATE_H * view.M)} px · centre photo px ({view.cx.toFixed(0)}, {view.cy.toFixed(0)})
          <br />
          budget: min blur {minBlurPx(view.M).toFixed(1)} px at 1080p (sharp ≤ 2.6, defocus ≤ 5, bokeh above) · bars {chk.pillarbox ? "visible" : "none"}
          <br />
          fit height M = {M_FIT_HEIGHT.toFixed(3)} · fit width M = {M_FIT_WIDTH.toFixed(3)}
          {chk.clamped ? <span style={{ color: "#ffb347" }}> · the 40 px margin rule would move this view to ({chk.view.cx.toFixed(0)}, {chk.view.cy.toFixed(0)})</span> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
