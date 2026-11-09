// Shapes of the website's four data files (nextinc/assets/data/{site,projects,films,team}.js) as the film reads them.
// Optional fields are exactly the ones the site's own data leaves out for some projects (for example Mini Me has no `links`,
// `brief`, `approach`, `outcome` or `gallery`). Required fields are read through selectors that throw when they are missing.

export interface SiteInfo {
  name: string;
  /** with scheme, no trailing slash, for example https://www.wearenext.tech */
  url: string;
  email?: string;
  tagline: string;
  blurb?: string;
  [key: string]: unknown;
}

export interface GalleryItem {
  /** repo-relative path in the website repo, e.g. assets/img/projects/spherex-blink/astraea-d3-epochs.webp */
  src: string;
  alt?: string;
  caption?: string;
}

export interface ProjectLinks {
  live?: string;
  repo?: string;
}

export interface Project {
  slug: string;
  title: string;
  year: number;
  category: string;
  /** "coming-soon" | "completed" | "prototype" | ... (the data's own words) */
  status: string;
  featured?: boolean;
  summary: string;
  abstract: string;
  role?: string;
  brief?: string;
  approach?: string;
  outcome?: string;
  tags: string[];
  cover: string;
  gallery?: GalleryItem[];
  palette: string;
  motif: string;
  links?: ProjectLinks;
  [key: string]: unknown;
}

export interface FilmEntry {
  id: string;
  title: string;
  sub?: string;
  duration: string;
  year?: number;
  kind?: string;
  /** slug of the project this film belongs to; absent for the company reel */
  project?: string;
  provider: string;
  /** provider id, for YouTube the video id */
  src: string;
  poster: string;
  palette?: string;
  motif?: string;
  [key: string]: unknown;
}

export interface TeamMember {
  name: string;
  role?: string;
  photo?: string;
  webp?: string;
  w?: number;
  h?: number;
  [key: string]: unknown;
}

export interface SnapshotMeta {
  /** which tool wrote this file */
  tool: string;
  /** folder name of the website repo (never a full path) */
  siteRepo: string;
  /** `git rev-parse HEAD` of the website repo at sync time */
  commit: string;
  /** true if assets/data had uncommitted changes at sync time (then `commit` does not fully describe the data) */
  dirty: boolean;
  /** ISO date of the sync (informational; never used for rendering) */
  syncedAt: string;
  /** SHA-256 of each data file (line endings normalised to LF) */
  files: Record<string, string>;
  /** SHA-256 of each copied media file, keyed by its website-repo path (filled by --copy-media) */
  media: Record<string, string>;
}

export interface Snapshot {
  meta: SnapshotMeta;
  site: SiteInfo;
  projects: Project[];
  films: FilmEntry[];
  team: TeamMember[];
  affiliation: string;
}

// ---------- what the selectors return ----------

export interface Author {
  /** names only (D-14) */
  name: string;
}

export interface Company {
  name: string;
  url: string;
  /** host without "www.", for example wearenext.tech */
  address: string;
  tagline: string;
  affiliation: string;
}

export interface Book {
  slug: string;
  /** 1-4 in the site's order */
  volume: number;
  /** "I", "II", ... (D-19) */
  volumeNumeral: string;
  /** the data's title, e.g. "Mini Me". The cover may use a brand spelling: src/config/bookText.ts (D-08) */
  title: string;
  year: number;
  category: string;
  status: string;
  /** the status in the data's words with hyphens as spaces: "coming soon" */
  statusText: string;
  summary: string;
  abstract: string;
  brief?: string;
  approach?: string;
  outcome?: string;
  tags: string[];
  palette: string;
  motif: string;
  /** website-repo path of the cover image (do not draw Mini Me's: see D-17) */
  cover: string;
  gallery: GalleryItem[];
  links: ProjectLinks;
}

export type QrKind = "live" | "repo" | "film" | "case-study";

export interface QrTarget {
  kind: QrKind;
  /** the exact URL encoded in the QR */
  url: string;
  /** the same address as printed under the code (no scheme, no trailing slash) */
  display: string;
  /** a typographic label, not a fact: "Live", "Repository", "Film", "Case study" */
  label: string;
}

export interface Film {
  id: string;
  title: string;
  subtitle?: string;
  duration: string;
  year?: number;
  kind?: string;
  provider: string;
  /** a link people can open (YouTube: https://youtu.be/<id>) */
  url: string;
  /** website-repo path of the poster */
  poster: string;
}

export interface Colophon {
  status: string;
  statusText: string;
  year: number;
  category: string;
  /** the first four tags */
  tags: string[];
  /** the last sentence of `outcome`, only when the book's text config asks for it (a stated limit) */
  limit?: string;
}

export interface RiserLabel {
  volumeNumeral: string;
  /** the data's title */
  title: string;
  year: number;
  statusText: string;
}
