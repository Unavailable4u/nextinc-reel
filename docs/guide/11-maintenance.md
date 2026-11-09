# 11 - Maintenance

A film made of code can be kept alive. This guide says how. The step-by-step version is `docs/ops/RUNBOOK.md`.

## 1. Mental model

```
website data (projects.js, films.js, team.js, site.js)
        |  npm run sync
        v
src/data/site-snapshot.json  ----->  books (covers, pages, labels, QR)  ----->  shots  ----->  render  ----->  YouTube + site
        ^                                         ^
 content/books.md (your wording choices)     public/screens (your screenshots)
```

You change inputs, never pixels.

## 2. Routine tasks

| Task | What to do | Re-render |
|---|---|---|
| A project's text changed on the site | `npm run sync`, review the diff of `site-snapshot.json`, `npm run audit` | shots that show that book |
| A new screenshot or a better one | replace the file in `public/screens/<book>/`, keep the filename or update `content/books.md` | the gallery shot of that book |
| A new film for a project | it appears in `films.js`; sync; the P-FILM page picks it up | the film shot of that book |
| A project's status changed (for example Mini Me goes live) | change it **on the website first**, sync; the label and colophon follow | S23 and the colophon shot |
| A team member added or removed | change `team.js`, sync | every cover shot (names on covers), all four books |
| Typo on a cover | fix the source field or `content/books.md`, rebuild | that book's cover shots |
| A lighting or camera tweak | edit `config/lights.ts` or `config/camera.ts`, `npm run motion` | the affected shots |

## 3. Adding a fifth book (the checklist)

1. Add the project to the website (`projects.js`), with palette and motif.
2. Add its entry to `content/books.md` (display title, spine text, cover design tokens, captions, screenshots, QR order).
3. Add its constants to `config/books.ts` (spine thickness, weight).
4. Write its cover painter in `src/paint/covers/` (one file; follow Vol. I-IV).
5. Add its pages to `config/pageSpecs.ts`.
6. **Riser capacity:** the riser holds four. For a fifth: add a third tier or switch to two rows of three; update `getRiserSlots()` and the label layout in `fx/Labels.tsx`; update the camera for S23.
7. Update the continuity ledger (`config/ledger.ts`) and the label beats (every label is one beat later; S23 grows by 30 f; every later shot shifts and the length becomes 91 s: **change the length in one place, `timeline.ts`**).
8. Run `npm run motion`, the stills, the truth audit, and render S22-S25.

## 4. Version and release hygiene

- **Semantic version of the film** in `package.json`: `1.0.0` first release; `1.1.0` for content updates (new screenshots, a changed status); `2.0.0` for a re-edit.
- **Tag** each published render: `git tag reel-v1.0.0` and write the date, the YouTube id and the site-snapshot commit in `CHANGELOG.md`.
- **Never commit** `out/` (git-ignored). Keep masters on a backup drive: `out/reel-vX.mp4`, `out/RENDER_INFO.json`, the audio mix. A render can be re-made from a tag, but only if the website data is the same, so the snapshot (committed) is the guarantee.
- **Git LFS** for large binaries (`.gitattributes` lists them). Install LFS before adding models or audio.
- **Commit style:** short, plain, owner's voice (see `AGENTS.md`).

## 5. Dependencies

| Item | Policy |
|---|---|
| Remotion, Three.js, react-three-fiber, drei, postprocessing | pinned to exact versions; upgrade at most once a quarter, in a branch |
| Node | 20 LTS or newer; note the version in `PATCH_NOTES.md` |
| ffmpeg | any recent build; record `ffmpeg -version` in `RENDER_INFO.json` |

**Upgrade routine:** branch, bump one package, `npx tsc --noEmit`, `npm run plate:verify`, `npm run stills` (compare with the last good stills side by side), render one hero shot (S05) and S10 (the riffle), check them at 100% zoom, merge. If anything shifts (colour, bokeh, shadow), either accept it and re-render all, or revert. **Never upgrade between the last QA and the final render.**

## 6. Regression safety net

- A folder `docs/reference/golden/` with the **golden stills** of ten fixed frames (0, 600, 840, 1250, 1500, 2100, 2640, 3250, 4580, 5100). After any change, `npm run stills -- --golden` renders those frames and prints the per-frame difference (SSIM) against the golden copies. A drop below 0.97 on a frame you did not intend to change is a regression.
- The **plate integrity test** runs in every patch.
- The **truth audit** runs before every render and fails loudly if a fact on screen is not in the snapshot.

## 7. Quarterly health check (15 minutes)

1. Does `npm install` still work on a clean clone?
2. Do the website's data files still parse with `npm run sync`?
3. Are all links in the QR targets still live? (A dead QR in a published film is a real bug; if a target dies, re-render the shot that shows it.)
4. Is YouTube's video still unlisted and playing?
5. Is the plate checksum still correct?
6. Is the team still three people (the Remotion free-licence line is four)?

## 8. Archiving

When the film is retired: tag the repo, keep `out/` masters and `site-snapshot.json`, remove the `next-inc-reel` entry from `films.js` (the figure hides itself), and archive the YouTube video.
