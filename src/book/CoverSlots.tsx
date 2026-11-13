import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { cancelRender, continueRender, delayRender } from "remotion";
import { BOOKS, type BookId, type BookSpec } from "../config/books";
import { SURFACES, type Surface } from "../config/covers";
import { loadArtwork, type Artwork } from "../paint/covers";
import { FOIL_LIFT_CM, PRINT_LIFT_CM, spineHalfGeometry, stampMaterial, printMaterial, surfaceTextures, type SurfaceTextures } from "./coverMaterials";
import { anchorFrames, type AnchorName } from "./geometry";

/**
 * A book's painted covers, loaded (the site's fonts, the Mini Me mark file), planned and painted once per book and shared. Holds the
 * render with `delayRender` until they are ready, so no frame is drawn without them. `enabled` false loads nothing and returns null.
 * A missing font throws through `cancelRender`: a cover painted in a fallback face must never reach a frame.
 */
export function useArtwork(id: BookId, enabled = true): Artwork | null {
  const [art, setArt] = useState<Artwork | null>(null);
  const handle = useRef<number | null>(null);
  if (enabled && handle.current === null && art === null) handle.current = delayRender(`Painting the cover of ${id}`);
  const release = (): void => {
    if (handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  };
  useEffect(() => {
    if (!enabled) {
      release();
      return;
    }
    let alive = true;
    loadArtwork(id).then(
      (a) => {
        if (alive) setArt(a);
        release();
      },
      (e: unknown) => cancelRender(e),
    );
    return () => {
      alive = false;
    };
  }, [id, enabled]);
  return enabled ? art : null;
}

interface Built {
  tex: Record<Surface, SurfaceTextures>;
  print: Record<Surface, THREE.MeshStandardMaterial>;
  foil: Record<Surface, THREE.MeshStandardMaterial>;
  spineBack: THREE.BufferGeometry;
  spineFront: THREE.BufferGeometry;
  spineBackFoil: THREE.BufferGeometry;
  spineFrontFoil: THREE.BufferGeometry;
  dispose: () => void;
}

function build(art: Artwork, spec: BookSpec): Built {
  const tex = {} as Record<Surface, SurfaceTextures>;
  const print = {} as Record<Surface, THREE.MeshStandardMaterial>;
  const foil = {} as Record<Surface, THREE.MeshStandardMaterial>;
  for (const s of SURFACES) {
    tex[s] = surfaceTextures(art, s);
    print[s] = printMaterial(tex[s]);
    foil[s] = stampMaterial(tex[s]);
  }
  const spineBack = spineHalfGeometry(spec, "back", PRINT_LIFT_CM);
  const spineFront = spineHalfGeometry(spec, "front", PRINT_LIFT_CM);
  const spineBackFoil = spineHalfGeometry(spec, "back", FOIL_LIFT_CM);
  const spineFrontFoil = spineHalfGeometry(spec, "front", FOIL_LIFT_CM);
  return {
    tex,
    print,
    foil,
    spineBack,
    spineFront,
    spineBackFoil,
    spineFrontFoil,
    dispose: () => {
      for (const s of SURFACES) {
        tex[s].color.dispose();
        tex[s].foil.dispose();
        tex[s].normal.dispose();
        print[s].dispose();
        foil[s].dispose();
      }
      [spineBack, spineFront, spineBackFoil, spineFrontFoil].forEach((g) => g.dispose());
    },
  };
}

/** The matrix from the spine anchor's frame to the front board's, both in the closed pose: the spine's front half rides the cover. */
function spineInFrontBoard(spec: BookSpec): { position: [number, number, number]; quaternion: [number, number, number, number] } {
  const frames = anchorFrames(spec, { coverAngle: 0, turned: 0 });
  const m = (a: { position: readonly number[]; quaternion: readonly number[] }): THREE.Matrix4 => new THREE.Matrix4().compose(new THREE.Vector3(...(a.position as [number, number, number])), new THREE.Quaternion(...(a.quaternion as [number, number, number, number])), new THREE.Vector3(1, 1, 1));
  const rel = m(frames.frontBoard).invert().multiply(m(frames.spine));
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  rel.decompose(p, q, new THREE.Vector3());
  return { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] };
}

/**
 * The content of the Book's texture slots for one book's covers: the front board's print and foil, the back board's, and the spine in
 * two halves (the back half on the base, the front half on the cover, so the spine follows the hinge when the book opens). Pass the
 * result to `<Book slots>` (the Book does it itself unless `covers` is false). Empty until the covers are painted.
 */
export function useCoverSlots(id: BookId, enabled = true): Partial<Record<AnchorName, React.ReactNode>> {
  const spec = BOOKS[id];
  const art = useArtwork(id, enabled);
  const built = useMemo(() => (art ? build(art, spec) : null), [art, spec]);
  useEffect(() => () => built?.dispose(), [built]);
  return useMemo(() => {
    if (!art || !built) return {};
    const sp = art.plan.surfaces;
    const board = (s: "front" | "back"): React.ReactNode => (
      <>
        <mesh position={[0, 0, PRINT_LIFT_CM]} material={built.print[s]} renderOrder={0}>
          <planeGeometry args={[sp[s].widthCm, sp[s].heightCm]} />
        </mesh>
        <mesh position={[0, 0, FOIL_LIFT_CM]} material={built.foil[s]} renderOrder={0.5}>
          <planeGeometry args={[sp[s].widthCm, sp[s].heightCm]} />
        </mesh>
      </>
    );
    const half = (key: string, print: THREE.BufferGeometry, foil: THREE.BufferGeometry): React.ReactNode => (
      <React.Fragment key={key}>
        <mesh geometry={print} material={built.print.spine} renderOrder={0} />
        <mesh geometry={foil} material={built.foil.spine} renderOrder={0.5} />
      </React.Fragment>
    );
    const ride = spineInFrontBoard(spec);
    return {
      frontBoard: (
        <>
          {board("front")}
          <group position={ride.position} quaternion={ride.quaternion}>
            {half("spine-front", built.spineFront, built.spineFrontFoil)}
          </group>
        </>
      ),
      backBoard: board("back"),
      spine: half("spine-back", built.spineBack, built.spineBackFoil),
    };
  }, [art, built, spec]);
}
