import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BOOK_IDS, RISER, type BookId } from "../config/books";
import { getBookLocation, getBookState } from "../config/ledger";
import { ZONES } from "../config/placement";
import { riserBoxes, riserFootprint, getRiserSlots, type DeskBox, type FootPatch } from "../config/riser";
import { LIGHTS } from "../config/lights";
import { GRAIN_SIZE, woodGrainPixels } from "./woodGrain";
import { ContactDecal } from "../plate/ShadowCatcher";
import { Book } from "../book/Book";

export { getRiserSlots };

function grainTexture(): THREE.CanvasTexture {
  const { w, h } = GRAIN_SIZE;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  if (!g) throw new Error("Riser: no 2D canvas context");
  const img = g.createImageData(w, h);
  img.data.set(woodGrainPixels(w, h));
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** A soft dark patch for a standing book's foot: it fades to nothing inside `padCm`, so it never hangs over the edge of a tier. Deterministic. */
function footTexture(w: number, d: number, pad: number, px: number): THREE.CanvasTexture {
  const c = LIGHTS.contact;
  const tw = Math.max(8, Math.round((w + 2 * pad) * px));
  const th = Math.max(8, Math.round((d + 2 * pad) * px));
  const cv = document.createElement("canvas");
  cv.width = tw;
  cv.height = th;
  const g = cv.getContext("2d");
  if (!g) throw new Error("Riser: no 2D canvas context");
  const rgb = new THREE.Color(c.color);
  const img = g.createImageData(tw, th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const dx = Math.max(Math.abs((x + 0.5) / px - (w + 2 * pad) / 2) - w / 2, 0);
      const dy = Math.max(Math.abs((y + 0.5) / px - (d + 2 * pad) / 2) - d / 2, 0);
      const t = Math.min(1, Math.hypot(dx, dy) / pad);
      const a = c.tightOpacity * (1 - t) * (1 - t);
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

/** The contact under a standing book: its foot on the tier. Children of <Stage>. */
export const FootDecal: React.FC<{ foot: FootPatch }> = ({ foot }) => {
  const pad = 0.8;
  const tex = useMemo(() => footTexture(foot.w, foot.d, pad, 24), [foot.w, foot.d]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[foot.X, foot.y + 0.012, -foot.Zd]} rotation={[-Math.PI / 2, 0, (foot.yawDeg * Math.PI) / 180]} renderOrder={2}>
      <planeGeometry args={[foot.w + 2 * pad, foot.d + 2 * pad]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  );
};

/** One box of the riser, in world space: desk (x, y, Zd) to world (x, y, -Zd). */
const Box: React.FC<{ box: DeskBox; radius: number; castShadow?: boolean; receiveShadow?: boolean; children: React.ReactNode }> = ({ box, radius, castShadow = true, receiveShadow = true, children }) => {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const d = box.zd1 - box.zd0;
  const geo = useMemo(() => new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2.01, h / 2.01, d / 2.01)), [w, h, d, radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, -(box.zd0 + box.zd1) / 2]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </mesh>
  );
};

/**
 * THE RISER (Patch 12, guide 04 section 7): the two walnut tiers with their brass lips, the contact patch under the whole thing, and the
 * books the ledger puts on it at `frame` (Vol. I to Vol. IV standing, leaning back, each with a patch under its foot). `books` chooses
 * which books to draw: `ledger` (default) the ones the ledger says are on the riser at the frame, `all` the four whatever the frame
 * (for a still), `none` the bare riser. World space; children of <Stage>.
 */
export const Riser: React.FC<{
  frame: number;
  anchor?: { X: number; Zd: number };
  books?: "ledger" | "all" | "none";
  covers?: boolean;
  shadows?: boolean;
}> = ({ frame, anchor = ZONES.R.anchor, books = "ledger", covers = true, shadows = true }) => {
  const boxes = useMemo(() => riserBoxes(anchor), [anchor]);
  const slots = useMemo(() => getRiserSlots(anchor), [anchor]);
  const foot = useMemo(() => riserFootprint(anchor), [anchor]);
  const grain = useMemo(grainTexture, []);
  useEffect(() => () => grain.dispose(), [grain]);
  const W = RISER.wood;
  const wood = (
    <meshPhysicalMaterial color={W.color} map={grain} roughness={W.roughness} metalness={0} clearcoat={W.clearcoat} clearcoatRoughness={W.clearcoatRoughness} />
  );
  const brass = <meshStandardMaterial color={RISER.brass.color} roughness={RISER.brass.roughness} metalness={RISER.brass.metalness} />;
  const shown = slots.filter((s) => books === "all" || (books === "ledger" && getBookLocation(s.id, frame) === "riser"));
  return (
    <>
      <ContactDecal X={(foot.x0 + foot.x1) / 2} Zd={(foot.zd0 + foot.zd1) / 2} w={foot.x1 - foot.x0} d={foot.zd1 - foot.zd0} />
      <Box box={boxes.lower} radius={W.bevelCm} castShadow={shadows} receiveShadow={shadows}>
        {wood}
      </Box>
      <Box box={boxes.upper} radius={W.bevelCm} castShadow={shadows} receiveShadow={shadows}>
        {wood}
      </Box>
      <Box box={boxes.lipLower} radius={0.05} castShadow={shadows} receiveShadow={false}>
        {brass}
      </Box>
      <Box box={boxes.lipUpper} radius={0.05} castShadow={shadows} receiveShadow={false}>
        {brass}
      </Box>
      {shown.map((s) => (
        <React.Fragment key={s.id}>
          <FootDecal foot={s.foot} />
          <Book id={s.id} covers={covers} pose={s.pose} castShadow={shadows} receiveShadow={shadows} />
        </React.Fragment>
      ))}
    </>
  );
};

/** The books on the riser at a frame, by the ledger, for a lab or a test: the same list `<Riser>` draws. */
export function riserBooksAt(frame: number): BookId[] {
  return BOOK_IDS.filter((id) => getBookLocation(id, frame) === "riser" && getBookState(id, frame) !== null);
}
