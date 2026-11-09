import { MissingDataError, cutAtSentence, lastSentence, makeSelectors, siteMedia, splitSentences } from "../src/data/select";
import type { Snapshot } from "../src/data/types";
import { eq, test, throws, truthy } from "./harness";

// A small synthetic snapshot, so these tests do not depend on the website's current content.
const base = (): Snapshot => ({
  meta: { tool: "test", siteRepo: "x", commit: "abc", dirty: false, syncedAt: "2026-01-01T00:00:00Z", files: {}, media: {} },
  site: { name: "Acme Lab", url: "https://www.acme.test/", tagline: "We make things." },
  affiliation: "Acme Lab - Somewhere",
  team: [{ name: "Ann One" }, { name: "Bo Two" }],
  films: [
    { id: "alpha-film", title: "Alpha - The Film", duration: "1:03", project: "alpha", provider: "youtube", src: "VID123", poster: "assets/img/films/alpha.webp" },
    { id: "beta-film", title: "Beta - The Film", duration: "2:50", project: "beta", provider: "youtube", src: "VID456", poster: "assets/img/projects/beta/cover.webp" },
  ],
  projects: [
    { slug: "alpha", title: "Alpha", year: 2026, category: "ai", status: "coming-soon", summary: "S1.", abstract: "A one. A two. A three.", tags: ["a", "b", "c", "d", "e"], cover: "assets/img/projects/alpha/cover.webp", palette: "ink", motif: "nodes" },
    { slug: "beta", title: "Beta", year: 2026, category: "ai", status: "completed", summary: "S2.", abstract: "B one.", outcome: "Works. Mostly caveat applies.", tags: ["x"], cover: "assets/img/projects/beta/cover.webp", palette: "forest", motif: "rings", links: { repo: "https://example.test/beta" } },
    { slug: "gamma", title: "Gamma", year: 2025, category: "web", status: "prototype", summary: "S3.", abstract: "G one.", tags: ["y"], cover: "assets/img/projects/gamma/cover.webp", palette: "crimson", motif: "globe", links: { live: "https://gamma.test/", repo: "https://example.test/gamma" } },
  ],
});
const S = (mutate?: (s: Snapshot) => void) => {
  const s = base();
  mutate?.(s);
  return makeSelectors(s);
};

test("books come in site order with volumes 1-3 and roman numerals", () => {
  const b = S().getBooks();
  eq(b.map((x) => x.slug).join(","), "alpha,beta,gamma");
  eq(b.map((x) => x.volume).join(","), "1,2,3");
  eq(b.map((x) => x.volumeNumeral).join(","), "I,II,III");
  eq(b[0].statusText, "coming soon");
});
test("company: address is the host without www and trailing slash", () => {
  const c = S().getCompany();
  eq(c.address, "acme.test");
  eq(c.url, "https://www.acme.test");
  eq(c.tagline, "We make things.");
});
test("authors are names only, in team order", () => {
  eq(JSON.stringify(S().getAuthors()), '[{"name":"Ann One"},{"name":"Bo Two"}]');
});
test("a missing required field throws an error that names its path", () => {
  throws(() => S((s) => delete (s.projects[1] as Partial<Record<string, unknown>>).title).getBooks(), "missing data: projects.beta.title");
  throws(() => S((s) => (s.projects[0].tags = [])).getBook("alpha"), "missing data: projects.alpha.tags");
  throws(() => S((s) => (s.site.tagline = "")).getCompany(), "missing data: site.tagline");
  throws(() => S((s) => delete (s.films[1] as Partial<Record<string, unknown>>).duration).getFilmsFor("beta"), "missing data: projects.beta.films[0].duration");
  throws(() => S().getBook("nope"), "missing data: projects.nope");
  throws(() => S((s) => ((s as unknown as Record<string, unknown>).affiliation = undefined)).getCompany(), "missing data: affiliation");
});
test("the error is a MissingDataError carrying the path", () => {
  try {
    S((s) => (s.team[1].name = "")).getAuthors();
    throw new Error("expected a throw");
  } catch (e) {
    truthy(e instanceof MissingDataError, "type");
    eq((e as MissingDataError).path, "team[1].name");
  }
});
test("optional fields stay absent: nothing is invented", () => {
  const a = S().getBook("alpha");
  eq(a.brief, undefined);
  eq(a.outcome, undefined);
  eq(a.gallery.length, 0);
  eq(a.links.live, undefined);
  eq(a.links.repo, undefined);
});
test("QR targets: case study + film when there are no links; repo + film; live + repo", () => {
  const q = (slug: string) =>
    S()
      .getQrTargets(slug)
      .map((t) => `${t.kind}:${t.url}`);
  eq(q("alpha").join(" | "), "case-study:https://www.acme.test/project.html?p=alpha | film:https://youtu.be/VID123");
  eq(q("beta").join(" | "), "repo:https://example.test/beta | film:https://youtu.be/VID456");
  eq(q("gamma").join(" | "), "live:https://gamma.test/ | repo:https://example.test/gamma");
});
test("QR printed address has no scheme and no trailing slash", () => {
  eq(S().getQrTargets("gamma")[0].display, "gamma.test");
});
test("an unknown film provider is refused, never guessed", () => {
  throws(() => S((s) => (s.films[0].provider = "vimeo")).getFilmsFor("alpha"), "unsupported film provider");
});
test("films are matched to their project; projects without films get an empty list", () => {
  eq(S().getFilmsFor("alpha").length, 1);
  eq(S().getFilmsFor("gamma").length, 0);
  eq(S().getFilmsFor("beta")[0].duration, "2:50");
});
test("colophon: first four tags; the stated limit only where bookText asks (alpha does not; unknown slugs do not)", () => {
  const c = S().getColophon("alpha");
  eq(c.tags.join(","), "a,b,c,d");
  eq(c.limit, undefined);
});
test("riser label carries the data's words", () => {
  const l = S().getRiserLabel("beta");
  eq(`${l.volumeNumeral} ${l.title} ${l.year} ${l.statusText}`, "II Beta 2026 completed");
});
test("splitSentences does not break after Inc., e.g. or decimals", () => {
  eq(splitSentences("Next Inc. Immersive is a build. It uses v1.2 and e.g. Three.js. Done!").length, 3);
  eq(splitSentences("Hello world").length, 1);
  eq(splitSentences('He said "Stop." Then left.').join("|"), 'He said "Stop."|Then left.');
});
test("cutAtSentence keeps whole sentences within the word budget", () => {
  const t = "One two three. Four five six seven. Eight nine ten eleven twelve.";
  eq(cutAtSentence(t, 3), "One two three.");
  eq(cutAtSentence(t, 7), "One two three. Four five six seven.");
  eq(cutAtSentence(t, 100), t);
  eq(cutAtSentence("A very long single sentence that exceeds the limit by a lot.", 3), "A very long single sentence that exceeds the limit by a lot.");
  eq(cutAtSentence("", 10), "");
});
test("lastSentence", () => {
  eq(lastSentence("First. Second one here."), "Second one here.");
});
test("siteMedia maps website paths to public/ paths and refuses others", () => {
  eq(siteMedia("assets/img/projects/x/cover.webp"), "site/img/projects/x/cover.webp");
  throws(() => siteMedia("scripts/x.json"), "not under assets/");
});
