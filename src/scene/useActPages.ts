import { useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { cancelRender, continueRender, delayRender } from "remotion";
import type { BookId } from "../config/books";
import { actAt } from "../config/pageSpecs";
import { pageTexture, releasePageTexture } from "../book/pageTextures";
import type { BookPages } from "../paint/pages";
import { booksAliveInAct, disposeAct, prepareAct } from "../paint/spread";

/** The painted pages of one book as three.js textures: `texture(i)` is page i of the book's list (`BOOK_PAGES`), null past the last page. */
export interface PageSet {
  id: BookId;
  texture: (index: number) => THREE.Texture | null;
}

const NONE: readonly PageSet[] = [];

/**
 * THE TEXTURE LIFECYCLE OF THE PAGES (Patch 15, guide 02: one book's pages alive at a time). The pages a frame needs are the ones of its
 * act (`BOOKS_OPEN_IN_ACT`: Mini Me's in Acts 3 to 5, MiniLocker's in Act 6): they are painted when the film first reaches the act
 * (`prepareAct`), the render is held (`delayRender`) until they are, and when the film is in an act that does not need a book any more
 * its textures are freed (`releasePageTexture`) and its canvases dropped (`disposeAct`). Frames of Acts 0 to 2 load nothing and wait for
 * nothing. The painted pages are a pure function of the data (the cache key of `paint/pages`), so a frame looks the same however the
 * render got to it. Browser only (it paints canvases); `Pile` takes the result as `pages`.
 */
export function useActPages(frame: number): readonly PageSet[] {
  const act = actAt(frame);
  const ids = booksAliveInAct(act);
  const key = ids.join(",");
  const [loaded, setLoaded] = useState<{ key: string; books: BookPages[] }>({ key: "", books: [] });
  const held = useRef<number | null>(null);
  const alive = useRef<BookPages[]>([]);

  const letGo = (): void => {
    if (held.current !== null) {
      continueRender(held.current);
      held.current = null;
    }
  };
  if (key !== "" && loaded.key !== key && held.current === null) {
    held.current = delayRender(`Painting the pages of act ${act}`, { timeoutInMilliseconds: 240000 });
  }

  useEffect(() => {
    let on = true;
    // the books of the acts before this one that this one does not need: free their textures, then drop their canvases
    for (const b of alive.current.filter((x) => !ids.includes(x.id))) b.pages.forEach((p) => releasePageTexture(p.canvas));
    alive.current = alive.current.filter((x) => ids.includes(x.id));
    disposeAct(act);
    if (key === "") {
      setLoaded((l) => (l.key === "" ? l : { key: "", books: [] }));
      letGo();
      return;
    }
    prepareAct(act).then(
      (books) => {
        if (!on) return;
        alive.current = books;
        setLoaded({ key, books });
        letGo();
      },
      (e: unknown) => cancelRender(e),
    );
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, act]);

  return useMemo(() => {
    if (loaded.key !== key || loaded.books.length === 0) return NONE;
    return loaded.books.map((b): PageSet => ({ id: b.id, texture: (i) => (b.pages[i] ? pageTexture(b.pages[i].canvas) : null) }));
  }, [loaded, key]);
}
