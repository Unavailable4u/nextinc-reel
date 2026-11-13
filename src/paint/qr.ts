// QR CODES (Patch 09). A code is made once, at build time, by a small library (`qrcode-generator`, no network, no web service:
// guide 02), and drawn as VECTOR SQUARES: every dark module is a rectangle of one path, so nothing is a picture that can be resampled
// badly and the same target always gives the same shapes.
//
// THE RULES (guide 04 section 4, "QR code rules"): modules dark `#16120E` on a LIGHT quiet zone at least 4 modules wide; error
// correction level M; nothing in the middle; the code itself printed at least 3.4 cm square; flat; no blur. `qr:check` decodes the
// drawn code from a rendered still and compares it with the target the selectors give (`getQrTargets`).
//
// WHAT IS PURE: everything here. `qrMatrix(text)` is a pure function of the text (the library is deterministic); `qrCmds` and `qrBox`
// are arithmetic. The cover painter (Patch 08) and the page painters (Patch 09) both use them.

import qrcode from "qrcode-generator";
import type { PathCmd } from "./svgPath";

/** Error correction level M (guide 04). */
export const QR_LEVEL = "M" as const;
/** The quiet zone: at least this many modules of light paper on every side of the code. */
export const QR_QUIET_MODULES = 4;
/** The code (the modules, without the quiet zone) is never printed smaller than this (guide 04, guide 07 section 6). */
export const QR_MIN_CODE_CM = 3.4;
/** Dark modules, as the guide says. */
export const QR_DARK = "#16120E";
/** The quiet zone's paper: lighter than any page, so a code scans from a lit page and from the dark cloth of a cover. */
export const QR_LIGHT = "#F8F4EA";

export interface QrMatrix {
  text: string;
  /** the QR version the library chose (1 to 40) */
  version: number;
  /** modules per side */
  size: number;
  /** row-major, 1 = dark */
  cells: Uint8Array;
}

const cache = new Map<string, QrMatrix>();

/** The module matrix of `text`, level M, the smallest version that holds it. Only plain ASCII (a web address) is accepted. */
export function qrMatrix(text: string): QrMatrix {
  const hit = cache.get(text);
  if (hit) return hit;
  if (text.length === 0) throw new Error("qr: nothing to encode");
  if (!/^[\x20-\x7e]+$/.test(text)) throw new Error(`qr: "${text}" is not plain ASCII (a web address is)`);
  const q = qrcode(0, QR_LEVEL);
  q.addData(text, "Byte");
  q.make();
  const size = q.getModuleCount();
  const cells = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells[r * size + c] = q.isDark(r, c) ? 1 : 0;
  const m: QrMatrix = { text, version: (size - 17) / 4, size, cells };
  cache.set(text, m);
  return m;
}

export const isDark = (m: QrMatrix, row: number, col: number): boolean => m.cells[row * m.size + col] === 1;

export interface QrRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface QrBox {
  /** the side of one module, in whatever unit `codeSide` was given in */
  module: number;
  /** the modules' area (a square) */
  code: QrRect;
  /** the light square: the code plus the quiet zone on every side */
  quiet: QrRect;
}

/**
 * Where a code goes. `codeSide` is the side of the modules' area; the quiet zone is `QR_QUIET_MODULES` modules on every side and the
 * whole box is centred on (`cx`, `cy`). The module size is NOT snapped to whole pixels: the squares share edges inside one path, so
 * their coverage adds up to a solid and no hairline shows between two dark modules.
 */
export function qrBox(m: QrMatrix, cx: number, cy: number, codeSide: number, quietModules: number = QR_QUIET_MODULES): QrBox {
  const module = codeSide / m.size;
  const total = codeSide + 2 * quietModules * module;
  return {
    module,
    code: { x: cx - codeSide / 2, y: cy - codeSide / 2, w: codeSide, h: codeSide },
    quiet: { x: cx - total / 2, y: cy - total / 2, w: total, h: total },
  };
}

/**
 * The dark modules as path commands, one rectangle per horizontal run of dark modules (a run is one rectangle, so a code is a few
 * hundred subpaths, not a thousand). The origin of the code's top-left corner is (`x`, `y`), a module is `module` wide.
 */
export function qrCmds(m: QrMatrix, x: number, y: number, module: number): PathCmd[] {
  const out: PathCmd[] = [];
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (!isDark(m, r, c)) {
        c++;
        continue;
      }
      let end = c;
      while (end < m.size && isDark(m, r, end)) end++;
      const x0 = x + c * module;
      const x1 = x + end * module;
      const y0 = y + r * module;
      const y1 = y + (r + 1) * module;
      out.push({ t: "M", x: x0, y: y0 }, { t: "L", x: x1, y: y0 }, { t: "L", x: x1, y: y1 }, { t: "L", x: x0, y: y1 }, { t: "Z" });
      c = end;
    }
  }
  return out;
}

/** The side of the modules' area for a code that must be at least `QR_MIN_CODE_CM` on paper, given the paper's pixels per cm. */
export const minCodePx = (pxPerCm: number): number => QR_MIN_CODE_CM * pxPerCm;