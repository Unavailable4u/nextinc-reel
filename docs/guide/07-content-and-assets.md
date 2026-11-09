# 07 - Content, truth and assets

## 1. The truth rule (same spirit as the earlier film's "evidence rule")

Everything on screen that **states a fact** is read from `src/data/site-snapshot.json`, a copy of your website's data made by `npm run sync` (Patch 01). That covers: project titles, years, statuses, summaries, abstracts, briefs, outcomes, tags, links, QR targets, film titles and durations, author names, the company name, tagline and address, and the affiliation line.

- If a value is missing, the selector **throws an error naming the missing path** (for example `projects.minilocker.films[0].duration`), so the film never shows a guess.
- Typography, layout and decorative marks are not facts and live in code.
- The snapshot records, for each file it read, the **git commit hash of the website repo** and a date, so any render can be traced to the site version it was made from.
- If a project changes on the site: `npm run sync`, look at the diff of `site-snapshot.json`, re-render the shots that show that book (guide 11).

## 2. Where each fact comes from

| Fact | Website file | Field |
|---|---|---|
| Book title | `assets/data/projects.js` | `title` (the cover may use a brand spelling; `content/books.md`) |
| Year, status, category | `projects.js` | `year`, `status`, `category` |
| Subtitle line | `projects.js` | `summary` |
| Abstract page | `projects.js` | `abstract` (cut at a sentence, about 55 words) |
| Brief / approach / outcome | `projects.js` | `brief`, `approach`, `outcome` (only if present) |
| Tags | `projects.js` | `tags` (first four) |
| Links and QR targets | `projects.js` and `films.js` | `links.live`, `links.repo`, film `provider` + `src` |
| Case-study page URL | `site.js` + project slug | `url` + `/project.html?p=<slug>` |
| Film title, duration, poster | `films.js` | `title`, `duration`, `poster` |
| Author names | `team.js` | `name` (site order) |
| Company, tagline, address | `site.js` | `name`, `tagline`, `url` |
| Affiliation line | `team.js` | `affiliation` |
| Palette / motif for endpapers | `projects.js` | `palette`, `motif` |

## 3. QR targets (the rule: only links that already exist)

| Book | QR 1 | QR 2 |
|---|---|---|
| Mini Me | case study page `https://www.wearenext.tech/project.html?p=mini-me` | film `https://youtu.be/4fNrtf8CX_o` (the Chat tab film, 1:03) |
| SPHEREx | live `https://spherex-blink-web.vercel.app/` | repo `https://github.com/Unavailable4u/spherex-blink` |
| MiniLocker | repo `https://github.com/shaikh-dotcom/MiniLocker` | film `https://youtu.be/q5bYqguilGs` (Blast Radius Zero, 2:50) |
| Immersive | live `https://next-in-c.onrender.com/` | repo `https://github.com/shaikh-dotcom/Next-In-C` |

The table is a **snapshot of the data at the time of writing**; the film builds its own from the files, so it never goes stale. MiniLocker has no live URL in the data, so it gets no "Visit" QR.

## 4. Open conflict: `minime.app`

Your Mini Me cover art (`assets/img/projects/mini-me/cover.webp`) shows a "Try MiniMe" button and `minime.app`. But the website repo's `docs/projects/BRIEFS.md` says Mini Me has **no links: no repo, no domain, no product URL; do not invent one**, and `projects.js` has no `links` for it. The film follows the data. **Therefore the Mini Me book shows no `minime.app` anywhere and no "Try" button**, and its QR codes point only to the case study and the film. If `minime.app` is now real and public, update `projects.js` first (the film follows). Record the answer in `docs/DECISIONS.md` as D-17.

## 5. Do not publish (copied from your briefs, applies to every page)

Never put on a page, label or caption: financial strategy, pricing tiers, token caps, cost targets, hiring or funding plans, the team to-do page, the master timeline, server-management stages, API inventories, technical roadmaps, FBEBC research documents, keys, tokens, environment variables, credentials. Never present a feature the data marks as Planned or Partially wired as shipped. Never name a competitor. No words like "revolutionary", "cutting-edge", "world-class".

## 6. Readability rules for a video

| Rule | Number |
|---|---|
| Any string the viewer must read | at most **8 words**, on screen at least **2 s** (120 frames), camera not rolling |
| Reading speed | at most 3 words per second for sentences |
| Minimum legible size at 1080p | caption x-height at least 14 px (that is about 14 pt on a 6 x 9 in page at the planned zoom) |
| Body text on a page | is **texture**: real sentences from the data, not meant to be read in full |
| Contrast | text at least 7:1 against its paper after lighting (check on a rendered still) |
| QR hold | at least 90 frames, flat, square-on, no blur, at least 3.4 cm on paper |
| Language | plain verbs, the site's voice |

## 7. Asset inventory per book (what exists, what you must supply)

Budgets for the film's own inputs: a screenshot at most 400 KB, a poster at most 300 KB (the site's budgets are stricter, 200 KB and 100 KB, for the website only).

### Mini Me
| Need | Status | Spec |
|---|---|---|
| Logo | exists (`nextinc/assets/img/brand/mini-me-logo.png`, 512 px raster) | Patch 08 vectorises it to `public/brand/mini-me-mark.svg` |
| Cover image for the figure | exists (`projects/mini-me/cover.webp`, 1600 x 900) | but it shows `minime.app` and the "Try" button: **do not use as a plain figure** unless you accept D-17 |
| Film poster | exists (`films/mini-me-chat-film.webp`, 1600 x 900) | use for the P-FILM page |
| App screenshots, 3-6 | **you supply** | `public/screens/mini-me/01-name.png` ... 1920 x 1080 or larger; only features the project's feature guide marks Available; no tokens or personal data visible |
| Captions | you approve | one per screenshot, at most 8 words, in `content/books.md` |

### Screenshot preparation rule (found while checking your files)

The five MiniLocker images in `minilocker-film/public/deck/` are **full-screen captures**: they show the browser tab strip (with other tab titles), the address bar with the app's domain (`minilocker.duckdns.org`), a browser assistant button, and a Windows taskbar strip with app icons down the right edge. For the books:

1. **Crop to the app content only** (the area below the address bar, above the taskbar, left of the icon strip). Keep the original untouched and save the crop as a new file.
2. Nothing personal or off-topic may be visible: no other tabs, no taskbar icons, no tokens, keys or masked key fields, no other products' names.
3. **The domain must not appear.** Your site's briefs say MiniLocker has no live URL on the site ("do not add a Visit button"), so a visible address bar contradicts the data. If that domain is now real and public, put it in `projects.js` first.
4. Check the same things on every Mini Me and Immersive screenshot you supply.
5. Save as PNG at the cropped native size (at least 1400 px wide), then Patch 09 creates its own page-sized version.

### SPHEREx Blink Comparator
| Need | Status |
|---|---|
| Two figures | exist (`astraea-d3-epochs.webp` 2700 x 1380, `astraea-d6-epochs.webp` 2700 x 692) with captions in the data |
| An app screenshot | exists as the cover (1308 x 637); a larger one is better |
| Film | none in `films.js` yet; the P-FILM page is **omitted** for this book (the book on the riser is closed anyway) |

### MiniLocker
| Need | Status |
|---|---|
| Mark and rings | the Mark: exact SVG in `minilocker-film/docs/bible/appendix-A.md`; the rings: arc geometry in `minilocker-film/src/ui/RadiusDial.tsx` |
| Screenshots | exist: `minilocker-film/public/deck/attacklab_complete.png`, `attacklab_running_state.png`, `fix_repo_complete.png`, `fix_repo_running.png`, `session.png` (all 1920 x 1080). Copy into `public/screens/minilocker/`. |
| Film poster | exists (`projects/minilocker/cover.webp` is the poster in `films.js`) |
| Captions | take them from `minilocker-film/docs/` or write 8-word captions; you approve |

### Next Inc. Immersive
| Need | Status |
|---|---|
| Cover | exists (1600 x 1000) |
| Screenshots | **you supply** 2-3 stills of the hero scene, the globe, the founders section |
| Film | none; no P-FILM page |
| Statement | "A showcase build of our website. Not our production site." (from the data) |

### Company
| Need | Status |
|---|---|
| Wordmark | `Ne<i>x</i>t Inc.`: CMU Serif Bold, the **x** in italic crimson. The x path: `nextinc/scripts/brand/glyph-x.json` |
| Fonts | `nextinc/assets/fonts/*.woff2` (CMU Serif, CMU Typewriter) |
| Icon | `nextinc/assets/img/icons/icon.svg` (the x on paper) |

## 8. The editorial table

`content/books.md` is the human-readable version of everything above, one block per book: display title, spine text, cover tokens, captions, which screenshots go where, the QR order, the colophon facts. It is **not** a data source for facts (the snapshot is); it is where **you** decide wording and order. Patch 08 and 09 read it for non-factual choices: caption wording, screenshot order, and the `displayTitle`.
