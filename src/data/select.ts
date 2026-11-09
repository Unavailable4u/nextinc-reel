// THE ONLY PLACE FACTS ENTER THE FILM (truth rule). Typed selectors over src/data/site-snapshot.json.
//   - A missing REQUIRED value throws Error("missing data: projects.minilocker.films[0].duration") naming its path.
//   - No fallbacks, no defaults. Fields the website's data genuinely omits for a project (brief, approach, outcome, links,
//     gallery) are optional in the types and the caller must handle their absence explicitly.
//   - Never invents a link: QR targets are only the links that exist (guide 07, section 3). Mini Me has no product URL (D-17).
//
// `makeSelectors(snapshot)` builds the selectors for any snapshot (the tests feed it broken copies); the named exports are bound
// to the committed snapshot.

import snapshotJson from "./site-snapshot.json";
import { BOOK_TEXT } from "../config/bookText";
import type { Author, Book, Colophon, Company, Film, FilmEntry, GalleryItem, Project, QrKind, QrTarget, RiserLabel, Snapshot } from "./types";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export class MissingDataError extends Error {
  constructor(public readonly path: string) {
    super(`missing data: ${path}`);
    this.name = "MissingDataError";
  }
}


function str(v: unknown, path: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new MissingDataError(path);
  return v;
}
function num(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new MissingDataError(path);
  return v;
}
function arr<T>(v: unknown, path: string): T[] {
  if (!Array.isArray(v) || v.length === 0) throw new MissingDataError(path);
  return v as T[];
}
const optStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);

// ---------- text helpers (pure) ----------

const ABBREVIATIONS = ["Inc", "Ltd", "Co", "Dr", "Mr", "Mrs", "Ms", "St", "vs", "etc", "No", "Fig", "e.g", "i.e"];

/** Splits text into sentences without breaking after abbreviations such as "Inc." or "e.g.". */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const t = text.trim();
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c !== "." && c !== "!" && c !== "?") continue;
    let j = i + 1;
    while (j < t.length && /["'\u201d\u2019)\]]/.test(t[j])) j++;
    if (j < t.length && !/\s/.test(t[j])) continue; // "3.5", "v1.2", "example.com"
    let k = j;
    while (k < t.length && /\s/.test(t[k])) k++;
    if (k >= t.length) {
      out.push(t.slice(start).trim());
      start = t.length;
      break;
    }
    const word = t.slice(start, i).split(/\s+/).pop() ?? "";
    if (c === "." && ABBREVIATIONS.includes(word) && /[A-Z0-9]/.test(t[k] ?? "")) continue;
    out.push(t.slice(start, j).trim());
    start = k;
    i = k - 1;
  }
  if (start < t.length) out.push(t.slice(start).trim());
  return out.filter((s) => s.length > 0);
}

const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length;

/**
 * The longest run of WHOLE sentences from the start of `text` that stays within `maxWords`. Never cuts inside a sentence.
 * If even the first sentence is longer than `maxWords` it is returned whole (a clipped sentence would be worse than a long one).
 */
export function cutAtSentence(text: string, maxWords: number): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  let out = sentences[0];
  for (let i = 1; i < sentences.length; i++) {
    const next = `${out} ${sentences[i]}`;
    if (wordCount(next) > maxWords) break;
    out = next;
  }
  return out;
}

/** The last sentence of a text (used for a stated limit, e.g. the credential-broker caveat). */
export function lastSentence(text: string): string {
  const s = splitSentences(text);
  return s.length ? s[s.length - 1] : "";
}

const displayAddress = (url: string): string => url.replace(/^https?:\/\//, "").replace(/\/+$/, "");

/** Maps a website-repo media path (assets/img/...) to the path of its copy under public/ (see `npm run sync -- --copy-media`). */
export function siteMedia(websiteRelPath: string): string {
  if (!websiteRelPath.startsWith("assets/")) throw new Error(`siteMedia: "${websiteRelPath}" is not under assets/`);
  return `site/${websiteRelPath.slice("assets/".length)}`;
}

// ---------- the selectors ----------

export function makeSelectors(snap: Snapshot) {
  const projectRaw = (slug: string): Project => {
    const list = snap.projects;
    if (!Array.isArray(list) || list.length === 0) throw new MissingDataError("projects");
    const p = list.find((x) => x && x.slug === slug);
    if (!p) throw new MissingDataError(`projects.${slug}`);
    return p;
  };

  function getCompany(): Company {
    const url = str(snap.site?.url, "site.url");
    return {
      name: str(snap.site?.name, "site.name"),
      url: url.replace(/\/+$/, ""),
      address: displayAddress(url).replace(/^www\./, ""),
      tagline: str(snap.site?.tagline, "site.tagline"),
      affiliation: str(snap.affiliation, "affiliation"),
    };
  }

  function getAuthors(): Author[] {
    const team = arr<{ name?: unknown }>(snap.team, "team");
    return team.map((m, i) => ({ name: str(m?.name, `team[${i}].name`) }));
  }

  function toBook(p: Project, index: number): Book {
    const s = p.slug;
    const at = `projects.${s}`;
    const status = str(p.status, `${at}.status`);
    return {
      slug: s,
      volume: index + 1,
      volumeNumeral: ROMAN[index] ?? String(index + 1),
      title: str(p.title, `${at}.title`),
      year: num(p.year, `${at}.year`),
      category: str(p.category, `${at}.category`),
      status,
      statusText: status.replace(/-/g, " "),
      summary: str(p.summary, `${at}.summary`),
      abstract: str(p.abstract, `${at}.abstract`),
      brief: optStr(p.brief),
      approach: optStr(p.approach),
      outcome: optStr(p.outcome),
      tags: arr<string>(p.tags, `${at}.tags`).map((t, i) => str(t, `${at}.tags[${i}]`)),
      palette: str(p.palette, `${at}.palette`),
      motif: str(p.motif, `${at}.motif`),
      cover: str(p.cover, `${at}.cover`),
      gallery: Array.isArray(p.gallery) ? p.gallery.map((g: GalleryItem, i: number) => ({ src: str(g?.src, `${at}.gallery[${i}].src`), alt: optStr(g?.alt), caption: optStr(g?.caption) })) : [],
      links: { live: optStr(p.links?.live), repo: optStr(p.links?.repo) },
    };
  }

  /** The books in the site's order, with volume 1-4. */
  function getBooks(): Book[] {
    const list = snap.projects;
    if (!Array.isArray(list) || list.length === 0) throw new MissingDataError("projects");
    return list.map((p, i) => toBook(p, i));
  }

  function getBook(slug: string): Book {
    const list = snap.projects;
    if (!Array.isArray(list) || list.length === 0) throw new MissingDataError("projects");
    const i = list.findIndex((x) => x && x.slug === slug);
    if (i < 0) throw new MissingDataError(`projects.${slug}`);
    return toBook(list[i], i);
  }

  function filmUrl(f: FilmEntry, at: string): string {
    const provider = str(f.provider, `${at}.provider`);
    const src = str(f.src, `${at}.src`);
    if (provider === "youtube") return `https://youtu.be/${src}`;
    throw new Error(`unsupported film provider "${provider}" at ${at} (add it to select.ts on purpose; the film never guesses a link)`);
  }

  /** The films of a project (data order). The list can be empty: SPHEREx and Immersive have none. */
  function getFilmsFor(slug: string): Film[] {
    projectRaw(slug); // the project must exist
    const all = Array.isArray(snap.films) ? snap.films : [];
    const mine = all.filter((f) => f && f.project === slug);
    return mine.map((f, i) => {
      const at = `projects.${slug}.films[${i}]`;
      return {
        id: str(f.id, `${at}.id`),
        title: str(f.title, `${at}.title`),
        subtitle: optStr(f.sub),
        duration: str(f.duration, `${at}.duration`),
        year: typeof f.year === "number" ? f.year : undefined,
        kind: optStr(f.kind),
        provider: str(f.provider, `${at}.provider`),
        url: filmUrl(f, at),
        poster: str(f.poster, `${at}.poster`),
      };
    });
  }

  /**
   * QR 1 and QR 2 for a book (guide 07, section 3): only links that EXIST, never invented.
   *   QR 1 = the primary place to go: the live app, else the repository, else the case-study page.
   *   QR 2 = the next of: repository, film, case-study page.
   * This reproduces the guide's table: Mini Me (no live, no repo) = case study + film; SPHEREx and Immersive = live + repo;
   * MiniLocker (no live URL) = repo + film.
   */
  function getQrTargets(slug: string): QrTarget[] {
    const b = getBook(slug);
    const company = getCompany();
    const films = getFilmsFor(slug);
    const mk = (kind: QrKind, label: string, url: string | undefined): QrTarget | undefined => (url ? { kind, label, url, display: displayAddress(url) } : undefined);
    const live = mk("live", "Live", b.links.live);
    const repo = mk("repo", "Repository", b.links.repo);
    const film = films.length > 0 ? mk("film", "Film", films[0].url) : undefined;
    const study = mk("case-study", "Case study", `${company.url}/project.html?p=${encodeURIComponent(slug)}`);
    const first = live ?? repo ?? study;
    if (!first) throw new MissingDataError(`projects.${slug}.links`);
    const second = [repo, film, study].find((t) => t !== undefined && t !== first);
    if (!second) throw new MissingDataError(`projects.${slug}.links (need a second QR target)`);
    return [first, second];
  }

  /** The facts on the colophon page. */
  function getColophon(slug: string): Colophon {
    const b = getBook(slug);
    const text = BOOK_TEXT[slug];
    const wantsLimit = text ? text.colophonLimit : false;
    let limit: string | undefined;
    if (wantsLimit) {
      if (!b.outcome) throw new MissingDataError(`projects.${slug}.outcome (bookText.ts asks for a stated limit)`);
      limit = lastSentence(b.outcome);
    }
    return { status: b.status, statusText: b.statusText, year: b.year, category: b.category, tags: b.tags.slice(0, 4), limit };
  }

  /** The words on a riser label (S23): title, year, status, all from the data. */
  function getRiserLabel(slug: string): RiserLabel {
    const b = getBook(slug);
    return { volumeNumeral: b.volumeNumeral, title: b.title, year: b.year, statusText: b.statusText };
  }

  /** The abstract cut at a sentence, about `maxWords` (default 55, guide 07). */
  function getAbstractText(slug: string, maxWords = 55): string {
    return cutAtSentence(getBook(slug).abstract, maxWords);
  }

  return { getCompany, getAuthors, getBooks, getBook, getFilmsFor, getQrTargets, getColophon, getRiserLabel, getAbstractText };
}

const bound = makeSelectors(snapshotJson as unknown as Snapshot);
export const { getCompany, getAuthors, getBooks, getBook, getFilmsFor, getQrTargets, getColophon, getRiserLabel, getAbstractText } = bound;
export const SNAPSHOT_META = (snapshotJson as unknown as Snapshot).meta;
