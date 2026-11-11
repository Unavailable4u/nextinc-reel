import React, { useLayoutEffect, useMemo } from "react";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import { HEIGHT, WIDTH } from "../config/timeline";
import { PLATE_PX_PER_MM, type Lens } from "./focus";

// The depth-of-field pass for OBJECTS (the books). The plate is blurred in its own material (Plate.tsx) and does not write depth, so
// here "no depth" means "the plate": it is left alone. For everything else the thin lens of focus.ts gives a radius per pixel
// (output px), and each pixel gathers a disc of neighbours on a fixed spiral, taking only the neighbours whose own blur disc
// reaches it, so a sharp book does not bleed into a blurred one behind it. Radii are capped at MAX_RADIUS.
//
// Only mounted when a shot needs it (`objectsNeedDefocus`); otherwise nothing in the frame goes through a framebuffer, which keeps
// the opening view identical to the bare photo.
const MAX_RADIUS = 32;

const FRAG = /* glsl */ `
uniform float uFocusCm;
uniform float uFocalMm;
uniform float uFNumber;
uniform float uPxPerMm;
uniform vec2 uPx;

float cocPx(float distCm) {
  float S = uFocusCm * 10.0;
  float D = distCm * 10.0;
  float c = (uFocalMm * uFocalMm) / (uFNumber * (S - uFocalMm)) * abs(D - S) / D;
  return min(0.5 * c * uPxPerMm, ${MAX_RADIUS.toFixed(1)});
}
float radiusAt(vec2 uv) {
  float d = readDepth(uv);
  if (d >= 0.99999) return 0.0;
  return cocPx(-getViewZ(d));
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float r0 = depth >= 0.99999 ? 0.0 : cocPx(-getViewZ(depth));
  if (r0 < 0.5) {
    outputColor = inputColor;
    return;
  }
  vec3 acc = inputColor.rgb;
  float wsum = 1.0;
  for (int i = 0; i < 96; i++) {
    float r = sqrt((float(i) + 0.5) / 96.0) * r0;
    float a = float(i) * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec2 suv = uv + off * uPx;
    float rs = radiusAt(suv);
    // the neighbour contributes only if its own disc reaches this pixel
    float reach = smoothstep(r - 0.5, r + 0.5, rs + 0.5);
    float w = reach / max(rs * rs, 1.0);
    acc += texture2D(inputBuffer, suv).rgb * w;
    wsum += w;
  }
  outputColor = vec4(acc / wsum, inputColor.a);
}`;

export class ObjectDefocusEffect extends Effect {
  constructor() {
    super("ObjectDefocusEffect", FRAG, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uFocusCm", new THREE.Uniform(500)],
        ["uFocalMm", new THREE.Uniform(44)],
        ["uFNumber", new THREE.Uniform(2.8)],
        ["uPxPerMm", new THREE.Uniform(PLATE_PX_PER_MM)],
        ["uPx", new THREE.Uniform(new THREE.Vector2(1 / WIDTH, 1 / HEIGHT))],
      ]),
    });
  }
  setLens(lens: Lens, M: number): void {
    (this.uniforms.get("uFocusCm") as THREE.Uniform).value = lens.focusCm;
    (this.uniforms.get("uFocalMm") as THREE.Uniform).value = lens.focalMm;
    (this.uniforms.get("uFNumber") as THREE.Uniform).value = lens.fNumber;
    // the sensor is fixed and a zoom is a window of it, so the blur on screen is the sensor's blur times M
    (this.uniforms.get("uPxPerMm") as THREE.Uniform).value = PLATE_PX_PER_MM * M;
  }
}

/** Child of <Stage>. Mount it only when `objectsNeedDefocus(lens, M, near, far)` is true. */
export const ObjectDefocus: React.FC<{ lens: Lens; M: number }> = ({ lens, M }) => {
  const effect = useMemo(() => new ObjectDefocusEffect(), []);
  useLayoutEffect(() => {
    effect.setLens(lens, M);
  }, [effect, lens.focusCm, lens.focalMm, lens.fNumber, M]);
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <primitive object={effect} dispose={null} />
    </EffectComposer>
  );
};
