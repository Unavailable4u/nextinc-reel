import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DUST } from "../config/dust";
import { dustAt, type DustSource } from "./dustField";

/** A soft disc: white at the middle, falling smoothly to nothing at the edge. Deterministic. */
function discTexture(): THREE.CanvasTexture {
  const n = 64;
  const cv = document.createElement("canvas");
  cv.width = n;
  cv.height = n;
  const g = cv.getContext("2d");
  if (!g) throw new Error("Dust: no 2D canvas context");
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2;
      const t = Math.min(1, Math.max(0, 1 - r));
      const a = t * t * (3 - 2 * t);
      const i = (y * n + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
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

/**
 * THE DUST (Patch 12): the motes in the lamp's cone at `frame`, drawn as soft discs added to the picture (guide 03 section 5). Where each
 * mote is and how bright it is comes from `dustAt` (a pure function of the frame; see `config/dust.ts`); this only draws it. The discs face
 * the camera (the match camera never turns), do not write depth and are lit by nothing: their brightness IS the light they catch.
 * `sources` are the things that stir the dust (default: the film's own, `dustSources()`); `level` scales the whole field (default
 * `DUST.level`). World space; children of <Stage>.
 */
export const Dust: React.FC<{ frame: number; sources?: readonly DustSource[]; level?: number }> = ({ frame, sources, level = DUST.level }) => {
  const motes = useMemo(() => dustAt(frame, sources), [frame, sources]);
  const disc = useMemo(discTexture, []);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: disc, color: new THREE.Color(DUST.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [disc],
  );
  useEffect(
    () => () => {
      disc.dispose();
      geo.dispose();
      mat.dispose();
    },
    [disc, geo, mat],
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    mesh.count = motes.length;
    motes.forEach((m, i) => {
      dummy.position.set(m.X, m.Y, -m.Zd);
      dummy.scale.setScalar(m.sizeCm);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const b = m.brightness * level;
      c.setRGB(b, b, b);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [motes, level]);
  return <instancedMesh ref={ref} args={[geo, mat, DUST.count]} frustumCulled={false} renderOrder={5} />;
};
