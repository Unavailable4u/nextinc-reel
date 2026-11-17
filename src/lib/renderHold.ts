import { continueRender, delayRender } from "remotion";

/**
 * Holds on the render ("wait until the pages or the covers are painted"), kept OUTSIDE React.
 *
 * A hook that took its `delayRender` while rendering and kept the handle in a `useRef` lost it whenever React threw a render away
 * before it was committed (the 3D canvas waits on Suspense first, so the first attempt of every book is thrown away): the retry got
 * a fresh ref, took a second `delayRender`, and the effect only ever let go of one of them. The other stayed held until the
 * timeout ("was called but not cleared after 238000ms") although the painting had finished in about 2 seconds. A hold is now
 * a named slot: asking for a slot that is already held does nothing, and letting go of a slot that is not held does nothing.
 */
export interface Holds {
  /** Hold the render under `key`. A no-op when `key` is already held. `timeoutInMilliseconds` is for the one `delayRender`. */
  hold: (key: string, label: string, timeoutInMilliseconds?: number) => void;
  /** Let the render go. A no-op when `key` is not held. */
  release: (key: string) => void;
  /** How many holds are open. */
  open: () => number;
}

export function createHolds(
  delay: (label: string, options?: { timeoutInMilliseconds?: number }) => number,
  resume: (handle: number) => void,
): Holds {
  const handles = new Map<string, number>();
  return {
    hold: (key, label, timeoutInMilliseconds) => {
      if (handles.has(key)) return;
      handles.set(key, timeoutInMilliseconds === undefined ? delay(label) : delay(label, { timeoutInMilliseconds }));
    },
    release: (key) => {
      const h = handles.get(key);
      if (h === undefined) return;
      handles.delete(key);
      resume(h);
    },
    open: () => handles.size,
  };
}

/** The holds of the film, on Remotion's own `delayRender` and `continueRender`. */
export const holds: Holds = createHolds(delayRender, continueRender);
