import React, { useMemo } from "react";
import * as THREE from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { staticFile } from "remotion";
import { PLATE_FILE, PLATE_H, PLATE_W } from "../config/plate";
import { isBlurDrawn } from "../camera/focus";
import { plateTransform, type PlateMatch, type PlateTransform, type PlateView, PLATE_MATCH } from "./PlateFollow";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// A disc gather over the photo, in linear light: 64 taps on a fixed spiral (Vogel), so the same radius always gives the same pixels.
// uRadiusUv is the blur radius in photo uv (output px / M / photo px). The result is written the way the basic material writes it.
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uRadiusUv;
varying vec2 vUv;
void main() {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    float r = sqrt((float(i) + 0.5) / 64.0);
    float a = float(i) * 2.39996323;
    acc += texture2D(uMap, vUv + vec2(cos(a), sin(a)) * r * uRadiusUv).rgb;
  }
  gl_FragColor = vec4(acc / 64.0, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * The photograph as a flat card inside the 3D scene, exactly as supplied: an UNLIT material, toneMapped = false, sRGB, mipmaps
 * and anisotropy on. No filter, no tone curve, no colour change (plate rule). Must be inside <ThreeCanvas>, which holds the
 * render until the texture has loaded. Its position is in camera space, so it goes inside <CameraSpace> (see stage.tsx).
 *
 * `blurPx` is the defocus radius in OUTPUT px at 1080p (src/camera/focus.ts: plateBlurPx). Below `NEUTRAL_BLUR_PX` the card is the
 * plain basic material, byte for byte what Patch 02 drew, which is what `npm run plate:verify` checks. Above it the card is drawn
 * through a disc gather in the card's own material, in the scene (never a CSS filter).
 *
 * The card does not write or test depth and is drawn first: it is the backdrop, so a book standing deeper than the card (Zd > 32.5)
 * is never hidden by it, and the depth-of-field pass sees the plate as "far".
 */
export const Plate: React.FC<{ view: PlateView; match?: PlateMatch; transform?: PlateTransform; blurPx?: number }> = ({ view, match = PLATE_MATCH, transform, blurPx = 0 }) => {
  const tex = useLoader(THREE.TextureLoader, staticFile(PLATE_FILE));
  const gl = useThree((s) => s.gl);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
  }, [tex, gl]);
  const t = transform ?? plateTransform(view, match);
  const blurred = isBlurDrawn(blurPx);
  const uniforms = useMemo(() => ({ uMap: { value: tex }, uRadiusUv: { value: new THREE.Vector2() } }), [tex]);
  // output px -> photo px (divide by M) -> photo uv (divide by the photo's size)
  uniforms.uRadiusUv.value.set(blurPx / view.M / PLATE_W, blurPx / view.M / PLATE_H);
  return (
    <mesh position={t.position} name="plate" renderOrder={-1000}>
      <planeGeometry args={[t.width, t.height]} />
      {blurred ? (
        <shaderMaterial uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG} toneMapped={false} depthWrite={false} depthTest={false} />
      ) : (
        <meshBasicMaterial map={tex} toneMapped={false} depthWrite={false} depthTest={false} />
      )}
    </mesh>
  );
};
