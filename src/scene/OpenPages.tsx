import React from "react";
import type { BookId } from "../config/books";
import { faceIndices, scriptOf, type BookMotionState } from "../config/ledger";
import { PageFaces, Sheet } from "../book/Sheet";
import { SINGLE } from "../book/sheetShape";
import type { PageSet } from "./useActPages";

/**
 * THE PAGES OF AN OPEN BOOK IN THE FILM (Patch 15), the children of its <Book>: the pages printed on the two stacks' faces (the endpaper on
 * the left board before any sheet is turned, then the back of the last sheet turned on the left and the next page on the right) and one
 * <Sheet> for every sheet in the air or still fluttering, each with its two pages. Which page is where is the ledger's (`faceIndices`, the
 * same numbers `DevBookMotion` uses: the front of leaf k is page 2k + 1 and its back is 2k + 2). Nothing here reads a frame number but
 * the one it is given.
 */
export const OpenPages: React.FC<{ id: BookId; frame: number; state: BookMotionState; pages: PageSet; shadows?: boolean }> = ({ id, frame, state, pages, shadows = true }) => {
  const turns = scriptOf(id)?.turns ?? [];
  const at = faceIndices(frame, turns);
  return (
    <>
      <PageFaces id={id} coverAngle={state.coverAngle} turned={state.turned} right={pages.texture(at.right)} left={pages.texture(at.left)} receiveShadow={shadows} />
      {state.airSheets.map((s) => (
        <Sheet
          key={`${s.index}-${s.baseTurned}`}
          id={id}
          coverAngle={state.coverAngle}
          turned={state.turned}
          baseTurned={s.baseTurned}
          progress={s.progress}
          landSec={s.landSec}
          place={SINGLE}
          index={s.index}
          front={pages.texture(2 * s.index + 1)}
          back={pages.texture(2 * s.index + 2)}
          castShadow={shadows}
          receiveShadow={shadows}
        />
      ))}
    </>
  );
};

/** True when a book is open far enough that its pages are seen (the cover is off the page block). */
export const isOpen = (state: BookMotionState): boolean => state.coverAngle > 0.02;
