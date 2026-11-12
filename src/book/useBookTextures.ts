import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { staticFile } from "remotion";
import { TEXTURES, TEXTURE_NAMES, type TextureName } from "../config/materials";
import { configureTexture, type TextureSet } from "./materials";

/**
 * The seven procedural pictures of Patch 07 (`public/textures/`, made by `npm run textures`), loaded and set up the way their
 * `TextureSpec` says. Inside <ThreeCanvas>, which holds the render until they have loaded (guide 02, rule 7). The loader caches by
 * URL, so every book shares the same seven textures. `enabled` false loads nothing and returns an empty set: the plain look.
 * If a file is missing, run `npm run textures`.
 */
export function useBookTextures(enabled = true): TextureSet {
  const names: TextureName[] = enabled ? TEXTURE_NAMES : [];
  const loaded = useLoader(
    THREE.TextureLoader,
    names.map((n) => staticFile(TEXTURES[n].file)),
  ) as THREE.Texture[];
  return useMemo(() => {
    const set: TextureSet = {};
    names.forEach((n, i) => {
      set[n] = configureTexture(loaded[i], TEXTURES[n]);
    });
    return set;
  }, [loaded, enabled]);
}
