import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { CAMERA_KEYFRAMES } from "../config/camera";
import { MAGNIFICATION, magnificationBand, BAND_COLOR, minBlurPx } from "../config/plate";
import { FPS, TOTAL, shotAt } from "../config/timeline";
import { auditMotion, type AuditResult, type FindingCode } from "../camera/audit";
import { plateBlurPx } from "../camera/focus";
import { cameraAt, type CameraFrame } from "../camera/path";
import { PLATE_MATCH } from "../plate/PlateFollow";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

/** Sliders in the Studio's right-hand panel. */
export const devCameraSchema = z.object({
  from: z.number().min(0).max(TOTAL - 1).step(30),
  to: z.number().min(0).max(TOTAL - 1).step(30),
  every: z.number().min(1).max(120).step(1),
  operator: z.boolean(),
});
export type DevCameraProps = z.infer<typeof devCameraSchema>;
export const defaultDevCameraProps: DevCameraProps = { from: 0, to: 960, every: 30, operator: true };

/** the table's rows: at most this many, so the page stays one screen (the step grows to fit) */
const MAX_ROWS = 34;
const INK = "#F1EADB";
const DIM = "#8d877a";
const CODE_COLOR: Record<FindingCode, string> = { STILL: "#f0b429", FAST: "#ff4d4d", DEEP: "#ff4d4d", EDGE: "#ff4d4d", POP: "#ff4d4d", LATE: "#f0b429" };

const fmt = (v: number, d = 2): string => v.toFixed(d);

interface Row {
  cam: CameraFrame;
  blur: number;
  need: number;
}

function rowsFor(from: number, to: number, step: number, operator: boolean): Row[] {
  const out: Row[] = [];
  for (let f = from; f <= to; f += step) {
    const cam = cameraAt(f, { operator });
    out.push({ cam, blur: plateBlurPx(cam.view.M, cam.lens, PLATE_MATCH), need: minBlurPx(cam.view.M) });
  }
  return out;
}

/** A small line plot of one number against the frame. */
const Plot: React.FC<{ title: string; unit?: string; from: number; to: number; series: { name: string; color: string; v: (f: number) => number }[]; width: number; height: number }> = ({ title, unit = "", from, to, series, width, height }) => {
  const n = Math.min(400, to - from + 1);
  const frames = Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * i) / Math.max(1, n - 1)));
  const data = series.map((s) => frames.map((f) => s.v(f)));
  const all = data.flat();
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-9) {
    lo -= 0.5;
    hi += 0.5;
  }
  const padL = 62;
  const padB = 22;
  const padT = 8;
  const x = (i: number): number => padL + ((width - padL - 8) * i) / Math.max(1, n - 1);
  const y = (v: number): number => padT + (height - padT - padB) * (1 - (v - lo) / (hi - lo));
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 18, color: DIM, marginBottom: 2 }}>
        {title}
        {unit ? ` (${unit})` : ""} {series.map((s) => (
          <span key={s.name} style={{ color: s.color, marginLeft: 10 }}>
            {s.name}
          </span>
        ))}
      </div>
      <svg width={width} height={height} style={{ display: "block", background: "#121214" }}>
        <line x1={padL} y1={y(lo)} x2={width - 8} y2={y(lo)} stroke="#2a2a2e" />
        <line x1={padL} y1={y(hi)} x2={width - 8} y2={y(hi)} stroke="#2a2a2e" />
        <text x={4} y={y(hi) + 5} fill={DIM} fontSize={15} fontFamily={stacks.mono}>
          {fmt(hi, hi > 100 ? 0 : 2)}
        </text>
        <text x={4} y={y(lo) + 5} fill={DIM} fontSize={15} fontFamily={stacks.mono}>
          {fmt(lo, lo > 100 ? 0 : 2)}
        </text>
        <text x={padL} y={height - 5} fill={DIM} fontSize={15} fontFamily={stacks.mono}>
          f{from}
        </text>
        <text x={width - 70} y={height - 5} fill={DIM} fontSize={15} fontFamily={stacks.mono}>
          f{to}
        </text>
        {data.map((d, si) => (
          <polyline key={series[si].name} fill="none" stroke={series[si].color} strokeWidth={1.8} points={d.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
        ))}
      </svg>
    </div>
  );
};

const Summary: React.FC<{ result: AuditResult | null; error: string | null }> = ({ result, error }) => {
  if (error) return <div style={{ color: "#ff4d4d", fontSize: 20 }}>audit: {error}</div>;
  if (!result) return null;
  const codes = Object.keys(result.counts) as FindingCode[];
  return (
    <div style={{ fontSize: 19, lineHeight: 1.45 }}>
      <div style={{ color: DIM }}>
        audit f{result.range[0]}-f{result.range[1]} · shots {result.timeline.shots}, {result.timeline.frames} frames
      </div>
      <div>
        {codes.map((c) => (
          <span key={c} style={{ marginRight: 14, color: result.counts[c] ? CODE_COLOR[c] : "#3ecf6a" }}>
            {c} {result.counts[c]}
          </span>
        ))}
      </div>
      <div style={{ color: DIM }}>
        peak: {fmt(result.stats.peakLateralCmPerSec, 1)} cm/s · {fmt(result.stats.peakMRatePerSec, 3)} x/s · pop {fmt(result.stats.peakPopFraction * 100, 2)}% · M {fmt(result.stats.maxM, 3)}
      </div>
      {result.findings.slice(0, 5).map((f, i) => (
        <div key={i} style={{ color: CODE_COLOR[f.code], fontSize: 17 }}>
          {f.code} f{f.from}
          {f.to !== f.from ? `-${f.to}` : ""} {f.detail}
          {f.known ? " (known exception)" : ""}
        </div>
      ))}
      {result.findings.length > 5 ? <div style={{ color: DIM, fontSize: 17 }}>... and {result.findings.length - 5} more (npm run motion lists all)</div> : null}
    </div>
  );
};

/**
 * The camera path as numbers (Patch 05): for a range of frames, the magnification, the window centre, the focus and the defocus the
 * plate gets, one row every `every` frames (the step grows if the range is long), with plots and the audit's verdict for the range.
 * `operator` off shows the authored path alone. Nothing here draws the film; open ReelFilm in the Studio for that.
 */
export const DevCamera: React.FC<DevCameraProps> = ({ from, to, every, operator }) => {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  const span = Math.max(1, b - a);
  const step = Math.max(every, Math.ceil(span / (MAX_ROWS - 1)));
  const rows = rowsFor(a, b, step, operator);
  let result: AuditResult | null = null;
  let error: string | null = null;
  try {
    result = auditMotion({ from: a, to: Math.max(b, a + 1) });
  } catch (e) {
    error = (e as Error).message;
  }
  const lastKey = CAMERA_KEYFRAMES[CAMERA_KEYFRAMES.length - 1].frame;
  const th: React.CSSProperties = { textAlign: "right", color: DIM, fontWeight: 400, padding: "2px 8px", borderBottom: "1px solid #2a2a2e" };
  const td: React.CSSProperties = { textAlign: "right", padding: "1px 8px" };
  return (
    <AbsoluteFill style={{ background: "#0b0b0c", color: INK, fontFamily: stacks.mono, padding: "26px 34px", fontSize: 19 }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>
        The camera, f{a}-f{b} · {(a / FPS).toFixed(2)}-{(b / FPS).toFixed(2)} s · {operator ? "authored + operator" : "authored only"}
      </div>
      <div style={{ color: DIM, fontSize: 17, marginBottom: 12 }}>
        one row every {step} frames{step !== every ? ` (asked for ${every}; the table holds ${MAX_ROWS} rows)` : ""} · keyframes end at f{lastKey}, the camera holds after that · sharp up to M {MAGNIFICATION.sharpUpTo}
      </div>
      <div style={{ display: "flex", gap: 30 }}>
        <table style={{ borderCollapse: "collapse", flex: "0 0 auto" }}>
          <thead>
            <tr>
              <th style={th}>frame</th>
              <th style={{ ...th, textAlign: "left" }}>shot</th>
              <th style={{ ...th, textAlign: "left" }}>reg</th>
              <th style={th}>M</th>
              <th style={th}>cx</th>
              <th style={th}>cy</th>
              <th style={th}>clamp</th>
              <th style={th}>focus cm</th>
              <th style={th}>f/</th>
              <th style={th}>blur px</th>
              <th style={th}>needs</th>
              <th style={th}>up cm</th>
              <th style={th}>fwd cm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cam, blur, need }) => (
              <tr key={cam.frame}>
                <td style={td}>{cam.frame}</td>
                <td style={{ ...td, textAlign: "left" }}>{shotAt(cam.frame).id}</td>
                <td style={{ ...td, textAlign: "left" }}>{cam.regime}</td>
                <td style={{ ...td, color: BAND_COLOR[magnificationBand(cam.view.M)] }}>{fmt(cam.view.M, 3)}</td>
                <td style={td}>{fmt(cam.view.cx, 1)}</td>
                <td style={td}>{fmt(cam.view.cy, 1)}</td>
                <td style={{ ...td, color: cam.clamped ? "#f0b429" : DIM }}>{cam.clamped ? "yes" : "-"}</td>
                <td style={td}>{fmt(cam.lens.focusCm, 0)}</td>
                <td style={td}>{fmt(cam.lens.fNumber, 1)}</td>
                <td style={td}>{fmt(blur, 1)}</td>
                <td style={{ ...td, color: blur + 1e-6 < need ? "#ff4d4d" : DIM }}>{fmt(need, 1)}</td>
                <td style={td}>{fmt(cam.operator.upCm, 2)}</td>
                <td style={td}>{fmt(cam.operator.forwardCm, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <Plot title="magnification M" from={a} to={b} width={560} height={150} series={[{ name: "M", color: "#3ecf6a", v: (f) => cameraAt(f, { operator }).view.M }]} />
          <Plot title="window centre" unit="photo px" from={a} to={b} width={560} height={150} series={[{ name: "cx", color: "#7fb6ff", v: (f) => cameraAt(f, { operator }).view.cx }, { name: "cy", color: "#f0b429", v: (f) => cameraAt(f, { operator }).view.cy }]} />
          <Plot title="focus" unit="cm from the camera" from={a} to={b} width={560} height={150} series={[{ name: "focus", color: "#e58cff", v: (f) => cameraAt(f, { operator }).lens.focusCm }]} />
          <Summary result={result} error={error} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
