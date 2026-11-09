# 00 - Read first

## What was studied before this guide was written

**`minilocker-film`** (your earlier film). A Remotion 4 + React 18 + TypeScript project, 1920x1080 at 30 fps, built in numbered patches (00-26). Its working habits are worth keeping, and this repo keeps them:

- one **context header** pasted at the top of every assistant session;
- one **patch file per session**, each with "needs / paste existing / attach / prompt / check";
- a **handoff log** (`docs/PATCH_NOTES.md`) appended by every patch, so any assistant can pick up where the last stopped;
- **determinism** (every pixel is a pure function of the frame number), **editable config files** (copy, timeline, camera), and **audits** (`npm run motion`, stills, contact sheets);
- an **evidence rule**: every fact on screen is read from a data file, never typed;
- a **motion rules** file that grew out of a real review (no still shots, camera moves have length, no `backdrop-filter`).

What is different here: that film was a 2D interface seen through a virtual camera. This one is a **real 3D scene** (books, paper, light) placed on top of **one photograph**. That changes the stack (Three.js inside Remotion), the camera rules, and adds a realism bible.

**`nextinc`** (your website). Static HTML/CSS/JS, no build step. What matters for the film:

- The home page already has an empty, hidden **Fig. 1** for a company reel, filled automatically when `assets/data/films.js` contains a film with id `next-inc-reel` and a poster (1600x900 WebP, at most 100 KB, saved as `assets/img/films/next-inc-reel.webp`). The ledger entry `ledger/S10-home-reel-previews-slideshow.md` has the paste-ready entry. It suggests a duration of `1:30`, which is exactly what this film targets.
- The four projects, in site order: **Mini Me**, **SPHEREx Blink Comparator**, **MiniLocker**, **Next Inc. Immersive** (`assets/data/projects.js`). The team, in site order: **Arib Labib**, **Shuaib Islam**, **Shaikh Muhammad** (`assets/data/team.js`). Films, with YouTube ids, in `assets/data/films.js`.
- The site's look is a research paper: CMU Serif, paper `#F5F0E6`, ink `#16120E`, one crimson `#C0102C`, "Abstract.", "Fig. 1.", "Algorithm 1". The books in this film use that voice.
- The site has **honesty rules** (the website repo's `docs/projects/BRIEFS.md`): no invented numbers, no "Planned" features shown as shipped, no invented product URLs, and a "Do not publish" list taken from the Mini Me book repo. They apply to the film too. See guide 07.
- The site repo's `AGENTS.md` forbids tool/model names and attribution trailers in commits and docs. This repo copies that rule (`AGENTS.md`).

## Decisions already made (change any in `docs/DECISIONS.md`)

| # | Decision | Default |
|---|---|---|
| D-01 | Technology | Remotion + React Three Fiber (Three.js) |
| D-02 | Frame rate | **60 fps** master (`fps = 60`) |
| D-03 | Frame and length | 1920x1080, 16:9, **90.000 s = 5400 frames** |
| D-04 | The photo in a 16:9 frame | Open with the full photo, pillarboxed into its own dark edges, then push in |
| D-05 | Plate resolution | Original used as is for the first 4 s; defocus rule beyond (see guide 02) |
| D-06 | Hands | None. The pick-up is implied by the camera operator model |
| D-07 | "The desk on the right" | The **right end of the same desk**, with a small two-tier riser holding all four books |
| D-08 | Book titles | `MiniMe` (brand spelling) on the cover; the data says `Mini Me` |
| D-09 | Second book | MiniLocker (it has real screenshots and a film) |
| D-10 | Ending | The room dims, the Next Inc. wordmark draws in, tagline, fade |
| D-11 | Hosting | YouTube (unlisted), poster hosted on the site |
| D-12 | Tempo | 120 BPM: 1 beat = 30 frames, 1 bar = 120 frames |

## Five things that will surprise you

1. **Your photo is small: 736 x 672 pixels.** A 1080p frame is 1920 px wide, so the photo is magnified at least 1.6x even in the opening shot, and 5x or more when the camera "goes to the table". The plan turns this into a strength: as the camera approaches the books, the photo behind them goes out of focus (it is physically behind the subject, so it should). The rules are in guide 02 ("Magnification budget") and guide 03 ("Depth of field"). If you can get a bigger version of the same image from where it came from, use it (D-05).
2. **The photo is a flat picture, not a 3D scene.** The camera can push in, pull back and slide sideways, but it cannot walk around the desk or look down at it. The shots are designed around that (guide 05, "Four camera regimes"). The books are real 3D and can be viewed from any angle; the room cannot.
3. **The visible desk top is a thin strip.** Books can only sit where the strip is free: left of the chair (between the lamp and the keyboard) and at the right end (in front of the speaker). Both zones are measured in `docs/reference/desk-plate-analysis.md`. The chair covers the middle, which is useful: it becomes a natural wipe when the camera travels right (guide 01, shot S22).
4. **Realism comes from many small things, not one big one.** Contact shadows, a believable lamp, paper that is slightly translucent, a cover that has a little weight, a camera that breathes. The realism bible lists them, and the QA patch scores them on a rubric. Two **gates** (G1 after the stills, G2 after the first motion test) tell you early if the real-time approach is good enough, and `docs/guide/15-plan-b-blender.md` is the fallback.
5. **Every fact in the books is real data.** Names, years, statuses, summaries, links and QR targets are read from your website's data files by a sync script. When a project changes on the site, you run one command and the books change. That is also how you keep the film honest.

## What you must supply (everything else is built)

| Item | Needed by | Spec |
|---|---|---|
| Real Mini Me app screenshots (3-6) | Patch 09 | `public/screens/mini-me/NN-name.png`, 1920x1080 or larger, only features marked Available |
| Next Inc. Immersive screenshots (2-3) | Patch 09 | `public/screens/next-inc-immersive/` |
| MiniLocker screenshots | Patch 09 | Reuse `minilocker-film/public/deck/*.png` (five 1920x1080 images exist) |
| SPHEREx screenshots | Patch 09 | Two figures already in the site repo; add one app screenshot |
| Confirmation of the `minime.app` question | Patch 08 | See guide 07, "Open conflict" |
| Foley recordings (optional) | Patch 21 | Guide 08, a phone is enough |
| Better plate (optional) | Patch 02 | Same image, larger |

## How this guide is organised

Guides explain and decide. Patches (`docs/patches/`) are the prompts you give your assistant. The first never changes the second silently: if a guide changes, `docs/PATCH_NOTES.md` records which patches are affected.
