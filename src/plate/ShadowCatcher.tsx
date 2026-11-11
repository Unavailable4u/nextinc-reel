import React, { useMemo } from "react";
import * as THREE from "three";
import { LIGHTS } from "../config/lights";
import { PLATE_MATCH, type PlateMatch } from "./PlateFollow";

/**
 * THE SHADOW CATCHER (guide 03 section 4): the desk in the plate is a photograph, so the 3D books cannot shadow it. This is a
 * plane at y = 0 over the desk that draws NOTHING except the shadows the lights cast on it, in a warm black (never pure black).
 * Children of <Stage>; world space (cm).
 */
export const ShadowCatcher: React.FC<{ match?: PlateMatch; color?: string; opacity?: number }> = ({ match = PLATE_MATCH, color = LIGHTS.catcher.color, opacity = LIGHTS.catcher.opacity }) => {
  const w = match.deskXMaxCm - match.deskXMinCm;
  const cx = (match.deskXMaxCm + match.deskXMinCm) / 2;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, -match.deskDepthCm / 2]} receiveShadow renderOrder={1}>
      <planeGeometry args={[w, match.deskDepthCm]} />
      <shadowMaterial color={color} opacity={opacity} transparent depthWrite={false} />
    </mesh>
  );
};

/** The two-layer contact patch as a texture: a rectangle of w x d cm in the middle of a (w + 2 pad) x (d + 2 pad) canvas. Deterministic. */
function contactTexture(w: number, d: number, pad: number, px: number): THREE.CanvasTexture {
  const c = LIGHTS.contact;
  const tw = Math.max(8, Math.round((w + 2 * pad) * px));
  const th = Math.max(8, Math.round((d + 2 * pad) * px));
  const cv = document.createElement("canvas");
  cv.width = tw;
  cv.height = th;
  const g = cv.getContext("2d");
  if (!g) throw new Error("ContactDecal: no 2D canvas context");
  const rgb = new THREE.Color(c.color);
  const img = g.createImageData(tw, th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      // distance in cm outside the footprint rectangle (0 inside it)
      const dx = Math.max(Math.abs((x + 0.5) / px - (w + 2 * pad) / 2) - w / 2, 0);
      const dy = Math.max(Math.abs((y + 0.5) / px - (d + 2 * pad) / 2) - d / 2, 0);
      const dist = Math.hypot(dx, dy);
      const a = 1 - (1 - c.tightOpacity * Math.exp(-dist / c.tightCm)) * (1 - c.wideOpacity * Math.exp(-dist / c.wideCm));
      const i = (y * tw + x) * 4;
      img.data[i] = Math.round(rgb.r * 255);
      img.data[i + 1] = Math.round(rgb.g * 255);
      img.data[i + 2] = Math.round(rgb.b * 255);
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** a vertical ramp: strongest at the top row (the edge next to the book), fading to nothing at the bottom */
function reflectionTexture(color: string): THREE.CanvasTexture {
  const h = 64;
  const cv = document.createElement("canvas");
  cv.width = 1;
  cv.height = h;
  const g = cv.getContext("2d");
  if (!g) throw new Error("ContactDecal: no 2D canvas context");
  const rgb = new THREE.Color(color);
  const img = g.createImageData(1, h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const a = (1 - t) * (1 - t);
    img.data[y * 4] = Math.round(rgb.r * 255);
    img.data[y * 4 + 1] = Math.round(rgb.g * 255);
    img.data[y * 4 + 2] = Math.round(rgb.b * 255);
    img.data[y * 4 + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Under a resting book (guide 03 section 4, "two layers"): the baked contact patch (a tight dark line and a wider soft shadow
 * that no shadow map can draw this tight) and the faint warm reflection along the front edge. `X`, `Zd` is the footprint's centre,
 * `w` x `d` its size in cm, `yawDeg` its turn. Children of <Stage>.
 */
export const ContactDecal: React.FC<{ X: number; Zd: number; w: number; d: number; yawDeg?: number; reflection?: boolean }> = ({ X, Zd, w, d, yawDeg = 0, reflection = true }) => {
  const pad = Math.max(LIGHTS.contact.wideCm * 3, 3);
  const patch = useMemo(() => contactTexture(w, d, pad, 24), [w, d, pad]);
  const refl = useMemo(() => reflectionTexture(LIGHTS.reflection.color), []);
  const depth = LIGHTS.reflection.depthCm;
  return (
    <group position={[X, 0, -Zd]} rotation={[0, (yawDeg * Math.PI) / 180, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} renderOrder={2}>
        <planeGeometry args={[w + 2 * pad, d + 2 * pad]} />
        <meshBasicMaterial map={patch} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {reflection ? (
        // along the front edge (towards the camera, +z), strongest next to the book
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, d / 2 + depth / 2]} renderOrder={3}>
          <planeGeometry args={[w, depth]} />
          <meshBasicMaterial map={refl} transparent opacity={LIGHTS.reflection.opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
};
