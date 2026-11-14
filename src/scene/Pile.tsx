import React from "react";
import { BOOKS, BOOK_IDS, type BookId } from "../config/books";
import { getBookState, type BookLocation, type BookMotionState } from "../config/ledger";
import { ContactDecal } from "../plate/ShadowCatcher";
import { Book } from "../book/Book";
import { OpenPages, isOpen } from "./OpenPages";
import type { PageSet } from "./useActPages";

/** The places a book can be and still belong to the left half of the desk: the pile, the hand over it, and the spots beside it. */
const LEFT: readonly BookLocation[] = ["pile", "hand", "beside"];

/** The books the ledger puts on the left of the desk at a frame, with their state; `skip` leaves out the ones a shot draws itself (with pages). */
export function leftBooksAt(frame: number, skip: readonly BookId[] = []): { id: BookId; state: BookMotionState }[] {
  const out: { id: BookId; state: BookMotionState }[] = [];
  for (const id of BOOK_IDS) {
    if (skip.includes(id)) continue;
    const state = getBookState(id, frame);
    if (state && LEFT.includes(state.location)) out.push({ id, state });
  }
  return out;
}

/** True when a closed book lies on the desk (not lifted, not tilted), so that it gets the baked contact patch. */
export const restsOnDesk = (state: BookMotionState): boolean => state.pose.position[1] < 0.4 && Math.abs(state.pose.pitchDeg ?? 0) < 1;

/**
 * THE PILE (Patch 12): MiniMe on top, MiniLocker, SPHEREx at the bottom, askew by the offsets of `PILE` in `config/books.ts`, the spines to
 * the camera, and the books beside it. It draws every book the ledger puts on the left of the desk at `frame`, wherever the rigs have it
 * (in the pile, in the hand, set down beside it), so the lift and the set-down happen on its books. Each book that lies on the desk gets
 * the baked contact patch (guide 03 section 2); a book on top of another does not, its contact is the one below it. The top book of the
 * pile wears the dust film (guide 03 section 6). World space; children of <Stage>.
 *
 * A book that is open (its cover angle above 0.02) is drawn with its pages when `pages` has them (`useActPages`, Patch 15: the page faces and
 * the sheets in the air, `OpenPages`); without them it is drawn as before, the boards and the bare block. A shot that wants to draw a book
 * itself passes it in `skip`.
 */
export const Pile: React.FC<{ frame: number; covers?: boolean; shadows?: boolean; decals?: boolean; skip?: readonly BookId[]; pages?: readonly PageSet[] }> = ({ frame, covers = true, shadows = true, decals = true, skip = [], pages = [] }) => {
  const books = leftBooksAt(frame, skip);
  // the top book of the pile: the highest of those that are still in it
  const inPile = books.filter((b) => b.state.location === "pile");
  const top = inPile.length ? inPile.reduce((a, b) => (b.state.pose.position[1] > a.state.pose.position[1] ? b : a)).id : null;
  return (
    <>
      {decals
        ? books
            .filter((b) => restsOnDesk(b.state))
            .map(({ id, state }) => <ContactDecal key={`decal-${id}`} X={state.pose.position[0]} Zd={-state.pose.position[2]} w={BOOKS[id].trimW} d={BOOKS[id].trimH} yawDeg={state.pose.yawDeg ?? 0} />)
        : null}
      {books.map(({ id, state }) => (
        <Book key={id} id={id} covers={covers} pose={state.pose} coverAngle={state.coverAngle} turned={state.turned} ribbonSwing={state.ribbonSwing} dust={id === top ? 1 : 0} castShadow={shadows} receiveShadow={shadows}>
          {isOpen(state) && pages.find((p) => p.id === id) ? <OpenPages id={id} frame={frame} state={state} pages={pages.find((p) => p.id === id) as PageSet} shadows={shadows} /> : null}
        </Book>
      ))}
    </>
  );
};
