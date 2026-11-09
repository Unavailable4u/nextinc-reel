// Loads the site's own fonts (CMU Serif, CMU Typewriter Text; SIL OFL) once, and holds the render until they are ready, so no frame
// is ever drawn in a fallback face. The .woff2 files are copied from the website repo by `npm run sync -- --copy-media` into
// public/fonts/. Call loadFonts() once at module load of a composition file; it is safe to call twice.
import { continueRender, delayRender, staticFile } from "remotion";

export const FAMILY_SERIF = "CMU Serif";
export const FAMILY_MONO = "CMU Typewriter Text";

interface Face {
  family: string;
  file: string;
  weight: string;
  style: "normal" | "italic";
}

export const FONT_FACES: readonly Face[] = [
  { family: FAMILY_SERIF, file: "fonts/cmu-serif-500-roman.woff2", weight: "400 600", style: "normal" },
  { family: FAMILY_SERIF, file: "fonts/cmu-serif-500-italic.woff2", weight: "400 600", style: "italic" },
  { family: FAMILY_SERIF, file: "fonts/cmu-serif-700-roman.woff2", weight: "700 900", style: "normal" },
  { family: FAMILY_SERIF, file: "fonts/cmu-serif-700-italic.woff2", weight: "700 900", style: "italic" },
  { family: FAMILY_MONO, file: "fonts/cmu-typewriter-text-500-roman.woff2", weight: "400 700", style: "normal" },
  { family: FAMILY_MONO, file: "fonts/cmu-typewriter-text-500-italic.woff2", weight: "400 700", style: "italic" },
];

/** CSS font stacks (the site's own, from assets/css/site.css) */
export const stacks = {
  serif: `"${FAMILY_SERIF}", "Latin Modern Roman", "Computer Modern", "Times New Roman", Georgia, serif`,
  mono: `"${FAMILY_MONO}", "Latin Modern Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`,
} as const;

let started: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  if (started) return started;
  if (typeof document === "undefined") return Promise.resolve();
  const handle = delayRender("Loading CMU fonts");
  started = Promise.all(
    FONT_FACES.map(async (face) => {
      const ff = new FontFace(face.family, `url(${staticFile(face.file)}) format("woff2")`, { weight: face.weight, style: face.style });
      await ff.load();
      document.fonts.add(ff);
    }),
  )
    .then(() => continueRender(handle))
    .catch((err: unknown) => {
      // Missing font files must not hang a render; the stack falls back to the next face and the console says why.
      console.warn("Fonts not loaded (run `npm run sync -- --copy-media`):", err);
      continueRender(handle);
    });
  return started;
}
