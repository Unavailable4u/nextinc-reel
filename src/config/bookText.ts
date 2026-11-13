// The NON-FACTUAL choices for the four books: display titles, spine text, which screenshots, captions, small editorial lines.
// Copied from content/books.md. Facts (names, years, statuses, summaries, links, QR targets) are NOT here: they come from
// src/data/site-snapshot.json through src/data/select.ts. `npm run select:test` checks that every factual-looking line below
// is also found in the data and lists the ones that are editorial only.

export interface TitlePart {
  text: string;
  /** plain = the book's main face, italic = the italic cut, crimson = the site's crimson */
  style: "plain" | "italic" | "crimson";
}

export interface ScreenshotSpec {
  /** file under public/ */
  file: string;
  /** at most 8 words, and it must say what you are looking at (guide 07) */
  caption: string;
  /** true while the wording is a draft waiting for your approval (content/books.md marks these "(approve)") */
  draft: boolean;
}

export interface BookText {
  slug: string;
  /** the title as set on the cover (D-08: Mini Me is "MiniMe" on the book) */
  title: TitlePart[];
  /** the spine, top to bottom */
  spine: string;
  /** an extra editorial line printed on the cover or back, if any */
  coverLine?: string;
  /** a back-cover line, if any */
  backLine?: string;
  /** colophon shows the last sentence of `outcome` as the stated limit */
  colophonLimit: boolean;
  /** screenshots in reading order (the files must exist before Patch 09) */
  screenshots: ScreenshotSpec[];
  /**
   * P-FIG: the picture of the figure page. When it is absent the page takes the first screenshot that no gallery page uses
   * (`figureFor` in `src/paint/pages/data.ts`), so SPHEREx needs nothing here.
   */
  figure?: ScreenshotSpec;
  /**
   * P-FILM: a file under public/ that stands in for the film's own poster. Set only when the poster must not be used: Mini Me's poster
   * shows "Try MiniMe" and `minime.app` (D-17, D-20), and `npm run sync` does not copy it.
   */
  filmFrame?: string;
}

export const BOOK_TEXT: Record<string, BookText> = {
  "mini-me": {
    slug: "mini-me",
    title: [{ text: "MiniMe", style: "plain" }],
    spine: "MiniMe",
    // public on the project's cover art; the product URL that art also shows is deliberately NOT used (D-17)
    coverLine: "Describe a task. Get a team.",
    colophonLimit: false,
    // cropped to the app content by `npm run screens` (guide 07); the figure is the Chat tab, the gallery follows the product's tabs.
    // All six captions are DRAFTS (they say only what the picture shows); check that each tab is a feature the project's guide marks Available.
    figure: { file: "screens/mini-me/01-chat.png", caption: "A task in Chat, with agents at work", draft: true },
    // the film is "The Chat tab" and its own poster is not usable (D-20): the Chat screenshot stands in for it
    filmFrame: "screens/mini-me/01-chat.png",
    screenshots: [
      { file: "screens/mini-me/02-notebooks.png", caption: "Notebooks: a mind map of one topic", draft: true },
      { file: "screens/mini-me/03-research.png", caption: "Research: sources found for a question", draft: true },
      { file: "screens/mini-me/04-plan-architecture.png", caption: "Plan: an architecture diagram of a project", draft: true },
      { file: "screens/mini-me/05-plan-blueprint.png", caption: "Plan: a rough 3D layout of the parts", draft: true },
      { file: "screens/mini-me/06-build.png", caption: "Build: a code editor beside the chat", draft: true },
    ],
  },
  "spherex-blink": {
    slug: "spherex-blink",
    title: [
      { text: "SPHEREx", style: "plain" },
      { text: " Blink Comparator", style: "italic" },
    ],
    spine: "SPHEREx Blink Comparator",
    coverLine: "NASA Space Apps 2026",
    backLine: "Nothing in it claims a detection.",
    colophonLimit: true,
    screenshots: [
      { file: "site/img/projects/spherex-blink/astraea-d3-epochs.webp", caption: "Seven epochs of Astraea's field, detector D3", draft: true },
      { file: "site/img/projects/spherex-blink/astraea-d6-epochs.webp", caption: "The same field through detector D6", draft: true },
    ],
  },
  minilocker: {
    slug: "minilocker",
    title: [
      { text: "Mini", style: "plain" },
      { text: "Locker", style: "crimson" },
    ],
    spine: "MiniLocker",
    coverLine: "Blast Radius Zero",
    colophonLimit: true,
    // reuse minilocker-film/public/deck/*.png (guide 00); crop all (guide 07)
    screenshots: [
      { file: "screens/minilocker/attacklab_complete.png", caption: "Attack Lab: all runnable attacks contained", draft: true },
      { file: "screens/minilocker/session.png", caption: "Sessions: every run keeps a ledger", draft: true },
      { file: "screens/minilocker/fix_repo_complete.png", caption: "A finished task and its Blast Radius dial", draft: true },
      { file: "screens/minilocker/attacklab_running_state.png", caption: "An attack running in a real sandbox", draft: true },
    ],
  },
  "next-inc-immersive": {
    slug: "next-inc-immersive",
    title: [
      { text: "Next Inc.", style: "plain" },
      { text: " Immersive", style: "italic" },
    ],
    spine: "Next Inc. Immersive",
    coverLine: "A showcase build",
    backLine: "A showcase build of our website. Not our production site.",
    colophonLimit: false,
    // cover.webp is the figure; the three stills are cropped by `npm run screens` (the hero, the globe, the opening text). Drafts.
    figure: { file: "site/img/projects/next-inc-immersive/cover.webp", caption: "The showcase build's hero scene", draft: true },
    screenshots: [
      { file: "screens/next-inc-immersive/01-hero.webp", caption: "The hero scene: four project cubes", draft: true },
      { file: "screens/next-inc-immersive/02-globe.webp", caption: "The globe scene of the build", draft: true },
      { file: "screens/next-inc-immersive/03-intro.webp", caption: "The opening headline and intro text", draft: true },
    ],
  },
};
