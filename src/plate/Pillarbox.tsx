import React, { useMemo } from "react";
import * as THREE from "three";
import { PILLARBOX, PLATE_W } from "../config/plate";
import { type PlateTransform } from "./PlateFollow";

/** A horizontal ramp: opaque at the left edge of the texture, transparent at the right, smoothstep-shaped. Built once, deterministic. */
function makeRamp(color: string): THREE.CanvasTexture {
  const w = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = 1;
  const g = c.getContext("2d");
  if (!g) throw new Error("Pillarbox: no 2D canvas context");
  const rgb = new THREE.Color(color);
  const r = Math.round(rgb.r * 255);
  const gg = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  const img = g.createImageData(w, 1);
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    const a = 1 - t * t * (3 - 2 * t); // smoothstep, 1 -> 0
    img.data[x * 4] = r;
    img.data[x * 4 + 1] = gg;
    img.data[x * 4 + 2] = b;
    img.data[x * 4 + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The black bars either side of the photo, joined to it with a soft feather over the photo's outer `feather` px (60 by default,
 * guide 02). Everything is drawn in the same plane as the photo, on top of it (no depth test), so alignment is exact. Set
 * `feather` to 0 to see the bare photo: `npm run plate:verify` renders that case to prove the photo itself is untouched.
 */
export const Pillarbox: React.FC<{ transform: PlateTransform; feather?: number; color?: string }> = ({ transform, feather = PILLARBOX.feather, color = PILLARBOX.color }) => {
  const ramp = useMemo(() => makeRamp(color), [color]);
  const t = transform;
  const [px, py, pz] = t.position;
  const leftEdge = px - t.width / 2;
  const rightEdge = px + t.width / 2;
  const bar = t.width * 4; // far wider than any frame
  const barH = t.height * 6;
  const fw = feather * t.cmPerPx;
  const common = { transparent: true, toneMapped: false, depthTest: false, depthWrite: false } as const;
  const clampPx = Math.min(feather, PLATE_W / 2);
  return (
    <group renderOrder={10}>
      {/* solid bars outside the photo */}
      <mesh position={[leftEdge - bar / 2, py, pz]} renderOrder={10}>
        <planeGeometry args={[bar, barH]} />
        <meshBasicMaterial color={color} {...common} />
      </mesh>
      <mesh position={[rightEdge + bar / 2, py, pz]} renderOrder={10}>
        <planeGeometry args={[bar, barH]} />
        <meshBasicMaterial color={color} {...common} />
      </mesh>
      {clampPx > 0 ? (
        <>
          {/* feather over the photo's outer strip: left = ramp as drawn, right = the ramp mirrored */}
          <mesh position={[leftEdge + fw / 2, py, pz]} renderOrder={11}>
            <planeGeometry args={[fw, t.height]} />
            <meshBasicMaterial map={ramp} {...common} />
          </mesh>
          <mesh position={[rightEdge - fw / 2, py, pz]} scale={[-1, 1, 1]} renderOrder={11}>
            <planeGeometry args={[fw, t.height]} />
            <meshBasicMaterial map={ramp} {...common} side={THREE.DoubleSide} />
          </mesh>
        </>
      ) : null}
    </group>
  );
};
