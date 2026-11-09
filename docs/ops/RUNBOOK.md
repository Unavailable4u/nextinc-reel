# Runbook

Step-by-step operations. Commands exist only after the patch that creates them (README table).

## Set up on a new machine
1. Install Node 20+, git, git-lfs, ffmpeg (Windows: `winget install Gyan.FFmpeg`, open a new terminal).
2. Clone this repo and run `git lfs install`.
3. Clone the website repo next to it; set `SITE_REPO` to its path (or accept the default `../nextinc`).
4. `npm install`, `npm run sync`, `npm run plate:verify`, `npm run studio`.

## Change content
Follow guide 11, section 2. Always: `npm run sync` -> review diff -> `npm run audit` -> re-render affected shots.

## Which shots to re-render after a change (Shot-to-files map; keep it current)
| Changed | Re-render |
|---|---|
| `config/lights.ts` | S02-S25 |
| `config/camera.ts` for a shot | that shot |
| `Book.tsx`, `PageBlock.tsx`, `Sheet.tsx`, materials | S03-S21, S23 |
| a cover painter for Vol. N | the shots showing that book's cover (Vol. I: S03-S05, S14-S15, S23; Vol. III: S03, S15-S17, S21, S23) |
| `paint/pages/*` | S06-S13 and S18-S20 |
| `fx/Labels.tsx` | S23 |
| `fx/Wordmark.tsx`, `Dim.tsx` | S24-S25 |
| plate processing, grain, vignette | everything |
| audio only | no video re-render; re-mux |

## Publishing a new version
1. Pre-render checklist. 2. `npm run render`. 3. Viewing protocol. 4. Upload a **new** unlisted video. 5. Update `films.js` id and the poster in the website repo. 6. Site checks. 7. Tag, CHANGELOG, backup. 8. Remove the old video when nothing links to it.

## If the website data shape changes
`npm run sync` fails with the file and field. Update `scripts/sync-site.mjs` and `src/data/types.ts` (one small patch), then re-run.

## If a QR target dies
Fix the target on the website or replace the link in the data; sync; re-render the shots that show it (S13, S20, and the back covers if visible); publish a new version.

## Emergency: restore a published version
Check out its tag, restore `site-snapshot.json` from that tag (it is committed), render.
