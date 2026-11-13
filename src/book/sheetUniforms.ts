// THE SHEET'S STATE AS UNIFORMS (Patch 10). `sheetShader.ts` declares what the GLSL reads (`uState`, `uShape1` ...); this file says which number
// goes where. The values are plain arrays built by a pure function, so the tests can run a JavaScript copy of the GLSL on them and compare
// it with `sheetMesh` (there is no GPU in Node); `applySheetUniforms` then copies them into the real uniforms.

import { SHEET } from "../config/sheets";
import { sheetPivot, SINGLE, type SheetLayout, type SheetPlacement, type SheetShape } from "./sheetShape";
import type { SheetUniforms } from "./sheetShader";

export interface SheetUniformValues {
  /** P, landSec, restAngle, restBlend */
  state: [number, number, number, number];
  /** curl, curlPow, wPow, lag */
  shape1: [number, number, number, number];
  /** cornerLift, cornerRadiusCm, cornerWindow, cornerU */
  shape2: [number, number, number, number];
  /** cornerV, flutter, flutterTau, flutterHz */
  shape3: [number, number, number, number];
  /** W, H, zHead, bowAmp */
  size: [number, number, number, number];
  /** the gutter point with the sheet's offset from the stack's face (`sheetPivot`) */
  pivot: [number, number];
}

export function sheetUniformValues(P: number, landSec: number, layout: SheetLayout, s: SheetShape, place: SheetPlacement = SINGLE): SheetUniformValues {
  const pivot = sheetPivot(P, layout, s, place);
  return {
    state: [P, landSec, s.restAngle, s.restBlend],
    shape1: [s.curl, s.curlPow, s.wPow, s.lag],
    shape2: [s.cornerLift, s.cornerRadiusCm, s.cornerWindow, s.cornerU],
    shape3: [s.cornerV, s.flutter, s.flutterTau, s.flutterHz],
    size: [layout.W, layout.H, layout.zHead, layout.bowAmp],
    pivot,
  };
}

/** Copies the values into a sheet's uniforms. `cpu` makes the shader draw the positions and normals of the grid as they are (the CPU twin's). */
export function applySheetUniforms(u: SheetUniforms, v: SheetUniformValues, leafWidthCm: number, cpu: boolean): void {
  u.uState.value.set(...v.state);
  u.uShape1.value.set(...v.shape1);
  u.uShape2.value.set(...v.shape2);
  u.uShape3.value.set(...v.shape3);
  u.uSize.value.set(...v.size);
  u.uPivot.value.set(...v.pivot);
  u.uGutter.value.set(SHEET.gutter.darken, leafWidthCm, SHEET.gutter.widthCm);
  u.uCpu.value = cpu ? 1 : 0;
}
