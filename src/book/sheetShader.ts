// THE SHEET'S SHADERS (Patch 10). The reason for a VERTEX SHADER and not a skinned mesh (guide 06 section 2 asks for one of the two,
// and the notes of Patch 10 say why):
//
//   * the bend is a function of both u and v (the finger's corner lifts one corner only), so every ROW of the sheet is its own
//     polyline. A skeleton of 12 bones along x gives every row the same bend; corner lift would need a second set of bones;
//   * a skinned mesh blends its bones, which shortens the paper at every joint (the "candy wrapper" of linear skinning), so the
//     length would be right only on average; the shader integrates unit segments, so a row is exactly W long;
//   * the function is closed-form and has no state, so the same GLSL runs in the depth passes (the lamp's shadow map) and the frame
//     N picture is a pure function of N. Three.js skins its shadow materials too, but only a skeleton: here the shadow is the same code.
//
// `sheetAngle` and `sheetMesh` in `sheetShape.ts` are the CPU twin of this file. `uCpu` makes the shader draw positions and normals
// it is given (the CPU mesh) instead of evaluating them, so `DevPageTurn` can compare the two.
//
// LIGHT THROUGH THE PAPER (guide 06 section 4). The material is `MeshStandardMaterial`; two things are added to its fragment shader:
//   1. the page's own texture, the OTHER side's ink at `translucency.ghost` (8 percent), and the printed-in gutter shading;
//   2. for every point and directional light that is on the FAR side of the face being drawn (dot(normal, L) < 0), the light that
//      passes through the paper: warm, carrying both sides' ink, scaled by `translucency.strength`. A vertical sheet between the lamp
//      and the camera glows; a sheet lit from the front gets nothing from this term.

import * as THREE from "three";
import { SHEET } from "../config/sheets";

type Uniform<T> = { value: T };

/** The uniforms shared by the sheet's three materials (colour, depth for spot and directional shadows, distance for point-light shadows). */
export interface SheetUniforms {
  /** P, landSec, restAngle, restBlend */
  uState: Uniform<THREE.Vector4>;
  /** curl, curlPow, wPow, lag */
  uShape1: Uniform<THREE.Vector4>;
  /** cornerLift, cornerRadiusCm, cornerWindow, cornerU */
  uShape2: Uniform<THREE.Vector4>;
  /** cornerV, flutter, flutterTau, flutterHz */
  uShape3: Uniform<THREE.Vector4>;
  /** W, H, zHead, bowAmp */
  uSize: Uniform<THREE.Vector4>;
  /** the gutter point, with the sheet's offset from the stack's face already added (`sheetPivot`) */
  uPivot: Uniform<THREE.Vector2>;
  uHalfDepth: Uniform<number>;
  /** 1: use the position and normal attributes as they are (the CPU mesh) */
  uCpu: Uniform<number>;
  uMapF: Uniform<THREE.Texture | null>;
  uMapB: Uniform<THREE.Texture | null>;
  /** strength, inkThrough, ghost, 0 */
  uTrans: Uniform<THREE.Vector4>;
  uTransTint: Uniform<THREE.Color>;
  /** darken, leaf width cm, gutter width cm */
  uGutter: Uniform<THREE.Vector3>;
}

export function makeSheetUniforms(): SheetUniforms {
  const T = SHEET.translucency;
  return {
    uState: { value: new THREE.Vector4(0, 0, 0, 1) },
    uShape1: { value: new THREE.Vector4() },
    uShape2: { value: new THREE.Vector4() },
    uShape3: { value: new THREE.Vector4() },
    uSize: { value: new THREE.Vector4() },
    uPivot: { value: new THREE.Vector2() },
    uHalfDepth: { value: SHEET.depthCm / 2 },
    uCpu: { value: 0 },
    uMapF: { value: null },
    uMapB: { value: null },
    uTrans: { value: new THREE.Vector4(T.strength, T.inkThrough, T.ghost, 0) },
    uTransTint: { value: new THREE.Color().setRGB(T.tint[0], T.tint[1], T.tint[2], THREE.LinearSRGBColorSpace) },
    uGutter: { value: new THREE.Vector3(SHEET.gutter.darken, 1, SHEET.gutter.widthCm) },
  };
}

const COLS = SHEET.mesh.cols;

/** Declarations every vertex shader of the sheet needs (colour pass and depth passes). */
const VERT_DECL = /* glsl */ `
uniform vec4 uState;
uniform vec4 uShape1;
uniform vec4 uShape2;
uniform vec4 uShape3;
uniform vec4 uSize;
uniform vec2 uPivot;
uniform float uHalfDepth;
uniform float uCpu;
attribute vec3 aGrid;
const int SHEET_COLS = ${COLS};
const float SH_PI = 3.14159265358979;

float shSmooth(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

// the twin of sheetAngle() in sheetShape.ts, line for line
float shAngle(float u, float v) {
  float P = uState.x;
  float w = u > 0.0 ? pow(u, uShape1.z) : 0.0;
  float q = clamp((P - uShape1.w * w) / (1.0 - uShape1.w), 0.0, 1.0);
  float a = uState.z * q;
  float sP = max(sin(SH_PI * P), 0.0);
  a -= uShape1.x * (sP > 0.0 ? pow(sP, uShape1.y) : 0.0) * w;
  float d = length(vec2((uShape2.w - u) * uSize.x, (uShape3.x - v) * uSize.y));
  a += uShape2.x * shSmooth(1.0 - d / uShape2.y) * sin(SH_PI * clamp(P / uShape2.z, 0.0, 1.0));
  if (P >= 0.9999) {
    float t = max(uState.y, 0.0);
    a -= uShape3.y * exp(-t / uShape3.z) * 0.5 * (1.0 - cos(2.0 * SH_PI * uShape3.w * t)) * w;
  }
  return clamp(a, 0.0, uState.z);
}

// the twin of sheetMesh() for one vertex: a polyline of unit segments from the gutter, then the layer and the bow where the point lies on a stack
void shEval(out vec3 pos, out vec2 nrm) {
  float u = aGrid.x;
  float v = aGrid.y;
  float side = aGrid.z > 0.5 ? -1.0 : 1.0;
  int col = int(floor(u * float(SHEET_COLS) + 0.5));
  float ds = uSize.x / float(SHEET_COLS);
  vec2 d = vec2(0.0);
  for (int j = 0; j < SHEET_COLS; j++) {
    if (j >= col) break;
    float th = shAngle((float(j) + 0.5) / float(SHEET_COLS), v);
    d += vec2(cos(th), sin(th)) * ds;
  }
  float th0 = shAngle(u, v);
  vec2 n = vec2(-sin(th0), cos(th0));
  float rw = max(1.0 - shSmooth(th0 / uState.w), shSmooth((th0 - (uState.z - uState.w)) / uState.w));
  float bow = uSize.w * sin(SH_PI * u) * sin(SH_PI * v) * rw;
  vec2 p = uPivot + d - n * bow + n * (side * uHalfDepth);
  pos = vec3(p, uSize.z + v * uSize.y);
  nrm = n * side;
}
`;

/** What the colour pass's vertex shader needs to hand to the fragment shader. */
const VERT_VARYINGS = /* glsl */ `
varying vec2 vSheetUvF;
varying vec2 vSheetUvB;
varying float vSheetLayer;
varying float vSheetU;
`;

const BEGIN_NORMAL = /* glsl */ `
vec3 shPos;
vec2 shNrm;
if (uCpu > 0.5) {
  shPos = position;
  shNrm = normal.xy;
} else {
  shEval(shPos, shNrm);
}
vec3 objectNormal = vec3(shNrm, 0.0);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
vSheetUvF = vec2(aGrid.x, 1.0 - aGrid.y);
vSheetUvB = vec2(1.0 - aGrid.x, 1.0 - aGrid.y);
vSheetLayer = aGrid.z;
vSheetU = aGrid.x;
`;

const BEGIN_VERTEX = /* glsl */ `
vec3 transformed = shPos;
`;

/** The depth passes do not need normals: they only move the vertex. */
const DEPTH_BEGIN_VERTEX = /* glsl */ `
vec3 shPos;
vec2 shNrm;
if (uCpu > 0.5) {
  shPos = position;
} else {
  shEval(shPos, shNrm);
}
vec3 transformed = shPos;
`;

const FRAG_DECL = /* glsl */ `
uniform sampler2D uMapF;
uniform sampler2D uMapB;
uniform vec4 uTrans;
uniform vec3 uTransTint;
uniform vec3 uGutter;
varying vec2 vSheetUvF;
varying vec2 vSheetUvB;
varying float vSheetLayer;
varying float vSheetU;
`;

/** Replaces <map_fragment>: the page, the other side's ink at 8 percent, the gutter. */
const MAP_FRAGMENT = /* glsl */ `
vec3 shF = texture2D(uMapF, vSheetUvF).rgb;
vec3 shB = texture2D(uMapB, vSheetUvB).rgb;
bool shIsFront = vSheetLayer < 0.5;
vec3 shOwn = shIsFront ? shF : shB;
vec3 shOther = shIsFront ? shB : shF;
diffuseColor.rgb *= shOwn * mix(vec3(1.0), shOther, uTrans.z);
float shGutterCm = vSheetU * uGutter.y;
float shGutter = 1.0 - smoothstep(0.0, uGutter.z, shGutterCm);
diffuseColor.rgb *= 1.0 - uGutter.x * shGutter * shGutter;
`;

/** After the lights: whatever reaches the far side of this face passes through the paper. */
const LIGHTS_FRAGMENT_END = /* glsl */ `
#include <lights_fragment_end>
{
  vec3 shTrans = vec3(0.0);
  #if NUM_POINT_LIGHTS > 0
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    PointLight shPl = pointLights[i];
    vec3 shLv = shPl.position - geometryPosition;
    float shDist = length(shLv);
    float shBack = max(0.0, -dot(normal, shLv / shDist));
    shTrans += shPl.color * getDistanceAttenuation(shDist, shPl.distance, shPl.decay) * shBack;
  }
  #endif
  #if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
    DirectionalLight shDl = directionalLights[i];
    shTrans += shDl.color * max(0.0, -dot(normal, shDl.direction));
  }
  #endif
  vec3 shTint = uTransTint * mix(vec3(1.0), shOwn * shOther, uTrans.y);
  reflectedLight.directDiffuse += shTrans * RECIPROCAL_PI * diffuse * shTint * uTrans.x;
}
`;

type Shader = { uniforms: Record<string, Uniform<unknown>>; vertexShader: string; fragmentShader: string };

const bindUniforms = (shader: Shader, u: SheetUniforms, names: (keyof SheetUniforms)[]): void => {
  for (const n of names) shader.uniforms[n] = u[n] as Uniform<unknown>;
};

const VERT_NAMES: (keyof SheetUniforms)[] = ["uState", "uShape1", "uShape2", "uShape3", "uSize", "uPivot", "uHalfDepth", "uCpu"];
const FRAG_NAMES: (keyof SheetUniforms)[] = ["uMapF", "uMapB", "uTrans", "uTransTint", "uGutter"];

function replaceOnce(source: string, chunk: string, by: string): string {
  if (!source.includes(chunk)) throw new Error(`sheetShader: the shader no longer contains "${chunk}"; three.js changed, so the sheet's patch needs a look`);
  return source.replace(chunk, by);
}

/**
 * The colour material of a sheet: a `MeshStandardMaterial` (paper colour, roughness 0.9) whose vertex shader bends the sheet and
 * whose fragment shader paints the page, the ghost, the gutter and the light through the paper. Front faces only: the sheet has two
 * layers (front and back, 0.012 cm apart), each facing outwards.
 */
export function sheetMaterial(u: SheetUniforms, paperColor: string, roughness: number, wireframe = false): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: paperColor, roughness, metalness: 0, wireframe });
  m.name = "sheet";
  m.polygonOffset = true;
  m.polygonOffsetFactor = SHEET.polygon.factor;
  m.polygonOffsetUnits = SHEET.polygon.units;
  m.onBeforeCompile = (shader: Shader) => {
    bindUniforms(shader, u, [...VERT_NAMES, ...FRAG_NAMES]);
    let v = shader.vertexShader;
    v = replaceOnce(v, "#include <common>", `#include <common>\n${VERT_DECL}${VERT_VARYINGS}`);
    v = replaceOnce(v, "#include <beginnormal_vertex>", BEGIN_NORMAL);
    v = replaceOnce(v, "#include <begin_vertex>", BEGIN_VERTEX);
    shader.vertexShader = v;
    let f = shader.fragmentShader;
    f = replaceOnce(f, "#include <common>", `#include <common>\n${FRAG_DECL}`);
    f = replaceOnce(f, "#include <map_fragment>", MAP_FRAGMENT);
    f = replaceOnce(f, "#include <lights_fragment_end>", LIGHTS_FRAGMENT_END);
    shader.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `sheet-v1-${COLS}`;
  return m;
}

/** The same bend for the shadow map of a directional or spot light (three.js uses it as `customDepthMaterial`). */
export function sheetDepthMaterial(u: SheetUniforms): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader: Shader) => {
    bindUniforms(shader, u, VERT_NAMES);
    shader.vertexShader = replaceOnce(shader.vertexShader, "#include <common>", `#include <common>\n${VERT_DECL}`);
    shader.vertexShader = replaceOnce(shader.vertexShader, "#include <begin_vertex>", DEPTH_BEGIN_VERTEX);
  };
  m.customProgramCacheKey = () => `sheet-depth-v1-${COLS}`;
  return m;
}

/** The same bend for the shadow map of a point light (the film's lamp is one): `customDistanceMaterial`. */
export function sheetDistanceMaterial(u: SheetUniforms): THREE.MeshDistanceMaterial {
  const m = new THREE.MeshDistanceMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (shader: Shader) => {
    bindUniforms(shader, u, VERT_NAMES);
    shader.vertexShader = replaceOnce(shader.vertexShader, "#include <common>", `#include <common>\n${VERT_DECL}`);
    shader.vertexShader = replaceOnce(shader.vertexShader, "#include <begin_vertex>", DEPTH_BEGIN_VERTEX);
  };
  m.customProgramCacheKey = () => `sheet-distance-v1-${COLS}`;
  return m;
}

/** The material of the page printed on a stack's face: paper with the page's texture and the same printed-in gutter shading as the sheets. */
export function pageFaceMaterial(map: THREE.Texture, paperColor: string, roughness: number, at: "top" | "bottom", leafWidthCm: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: paperColor, roughness, metalness: 0, map });
  m.name = "page-face";
  m.polygonOffset = true;
  m.polygonOffsetFactor = SHEET.polygon.factor;
  m.polygonOffsetUnits = SHEET.polygon.units;
  const uPf = { value: new THREE.Vector4(SHEET.gutter.darken, leafWidthCm, SHEET.gutter.widthCm, at === "bottom" ? 1 : 0) };
  m.onBeforeCompile = (shader: Shader) => {
    shader.uniforms.uPf = uPf;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, "#include <common>", "#include <common>\nuniform vec4 uPf;");
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "#include <map_fragment>",
      `#include <map_fragment>
{
  float pfCm = (uPf.w > 0.5 ? 1.0 - vMapUv.x : vMapUv.x) * uPf.y;
  float pfG = 1.0 - smoothstep(0.0, uPf.z, pfCm);
  diffuseColor.rgb *= 1.0 - uPf.x * pfG * pfG;
}`,
    );
  };
  m.customProgramCacheKey = () => "page-face-v1";
  return m;
}

/** A flat-colour wire material that follows the sheet's bend (the "mesh" toggle of `DevPageTurn`). */
export function sheetWireMaterial(u: SheetUniforms, color = "#41e0ff"): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, wireframe: true, depthTest: false, transparent: true });
  m.onBeforeCompile = (shader: Shader) => {
    bindUniforms(shader, u, VERT_NAMES);
    shader.vertexShader = replaceOnce(shader.vertexShader, "#include <common>", `#include <common>\n${VERT_DECL}`);
    shader.vertexShader = replaceOnce(shader.vertexShader, "#include <begin_vertex>", DEPTH_BEGIN_VERTEX);
  };
  m.customProgramCacheKey = () => `sheet-wire-v1-${COLS}`;
  return m;
}