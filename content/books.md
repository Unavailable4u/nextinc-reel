# Editorial table for the four books

This file holds **your wording and ordering choices**. It is **not** a source of facts: names, years, statuses, summaries, links and QR targets come from `src/data/site-snapshot.json` (guide 07). Where a field says `from data`, do not type it here.

Edit this file, then re-render the shots that show the book (`docs/ops/RUNBOOK.md`). Items marked **(approve)** are drafts for you to accept or rewrite. Captions are at most 8 words, and each must say what the viewer is looking at.

## Authors (all books)
`from data` (`team.js`, site order, names only).

---

## Vol. I - Mini Me

| Field | Value |
|---|---|
| displayTitle | `MiniMe` (D-08) |
| spine text | `MiniMe` (top to bottom), logo at the head, crimson x at the foot |
| cover cloth / foil | near-black `#0D0D0D`; rose-red foil `#FF2351`; off-white title foil `#E9E2D4` |
| tag line on cover | `Describe a task. Get a team.` (already public on your cover art) |
| edge | rose-red stained top edge |
| pages used | P-END, P-HALF, P-BLANK, P-TITLE, P-ABST, P-FIG, P-GAL x2, P-FILM, P-COLO, P-LINK, P-BACK |
| figure image (P-FIG) | **you decide:** a real app screenshot (recommended). Do not use `cover.webp` as is (it shows `minime.app`, D-17) |
| screenshots (order) | `public/screens/mini-me/01-*.png` ... **you supply 3-6**, only Available features |
| captions | **(approve)** to be written when the screenshots exist; one per image |
| film page | from data: the film with `project: "mini-me"` (`mini-me-chat-film`, 1:03, poster `films/mini-me-chat-film.webp`) |
| QR 1 / QR 2 | case study / film (from data) |
| colophon facts | status, year, category, tags: from data; limit sentence: none |
| label on riser | from data: title, year, status |

## Vol. II - SPHEREx Blink Comparator

| Field | Value |
|---|---|
| displayTitle | `SPHEREx` + italic `Blink Comparator` |
| cover cloth / foil | indigo `#24307A`; gold foil `#E8B04A`; `orbits` motif as fine foil rings |
| extra line | `NASA Space Apps 2026` as plain text only (true per the data); no logo |
| pages used | P-END, P-HALF, P-TITLE, P-ABST, P-FIG, P-GAL, P-LINK, P-BACK (no P-FILM: no film in the data) |
| figure / gallery images | the two figures in `assets/img/projects/spherex-blink/` with the captions already in the data (shortened to 8 words **(approve)**) |
| QR 1 / QR 2 | live / repo (from data) |
| back cover line | keep "Nothing in it claims a detection." only if the data still says so |
| role in the film | pile (bottom), then the riser |

## Vol. III - MiniLocker (second book)

| Field | Value |
|---|---|
| displayTitle | `Mini` ink + `Locker` crimson |
| cover cloth | parchment linen `#DABD9B` to `#CEAF8B`, strong weave |
| art | five blue foil arcs (Blast Radius dial geometry), small Mark on the title page and spine head |
| line | `Blast Radius Zero` italic small caps |
| pages used (short sequence) | P-COLO (left) + P-TITLE (right), then P-GAL x2, then P-FILM + P-LINK on one spread, P-BACK |
| screenshots (order) | 1 `attacklab_complete` 2 `session` 3 `fix_repo_complete` 4 `attacklab_running_state` (crop all: guide 07) |
| captions **(approve)** | 1 `Attack Lab: all runnable attacks contained` 2 `Sessions: every run keeps a ledger` 3 `A finished task and its Blast Radius dial` 4 `An attack running in a real sandbox` |
| film page | from data: `minilocker-film` ("Blast Radius Zero", 2:50) |
| QR 1 / QR 2 | repo / film (from data); no live URL, so no "Visit" |
| colophon limit sentence | from data `outcome` (the credential-broker caveat) |

## Vol. IV - Next Inc. Immersive

| Field | Value |
|---|---|
| displayTitle | `Next Inc.` + italic `Immersive` |
| cover cloth | crimson darkened 35%, blind-stamped dot globe |
| line | `A showcase build` |
| pages used | P-END, P-HALF, P-TITLE, P-ABST, P-FIG, P-GAL, P-LINK, P-BACK (no P-FILM) |
| images | `cover.webp` (1600 x 1000) as the figure; **you supply 2-3 stills** of the hero, globe, founders section |
| captions | **(approve)** after the stills exist |
| back cover | "A showcase build of our website. Not our production site." (from data wording) |
| QR 1 / QR 2 | live / repo (from data) |

---

## Riser labels (S23)

Order: Vol. I Mini Me, Vol. II SPHEREx, Vol. III MiniLocker, Vol. IV Immersive. Text from data: `title`, `year`, `status`. Volume numerals are a design choice (D-19).

## Wordmark (S24)

`Next Inc.` with the crimson italic x; tagline and address from `site.js`.
