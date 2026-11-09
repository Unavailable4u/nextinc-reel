### PATCH 00 - Scaffold, config, core math, prompt tool

**Needs:** nothing
**Parallel-safe with:** none
**Size:** M
**Paste existing:** nothing
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/02-architecture.md` (Stack, Determinism, World units, Source layout), `docs/guide/09-render-and-delivery.md` section 1, `docs/DECISIONS.md`
**Before you start (you do this, not the assistant):** install Node 20+, git, git-lfs and ffmpeg (guide 09, section 6); run `git init` and `git lfs install` in this folder.

```
PATCH 00 - Scaffold, config, core math, prompt tool.

GOAL: a Remotion + TypeScript project that opens in the Studio, renders an empty 1920x1080, 60 fps, 5400-frame composition, with the timeline maths and the prompt-assembly tool in place.

CREATE / CHANGE:
- `package.json` with exact pinned versions (Remotion 4.x matching `minilocker-film`, React 18.3.x, three, the react-three-fiber major that supports React 18, drei, postprocessing, `@remotion/three`, sharp, TypeScript strict); scripts: `studio`, `typecheck`, plus empty-stub scripts named in the README table that print "created by Patch NN"
- `tsconfig.json` (strict), `remotion.config.ts` (OpenGL renderer `angle`, concurrency note), `.vscode/extensions.json`
- `src/index.ts`, `src/Root.tsx` registering composition `ReelFilm` (1920x1080, 60 fps, 5400 frames) that shows a dark frame with a frame/beat/bar/shot readout
- `src/config/timeline.ts`: `FPS=60`, `BEAT=30`, `BAR=120`, `TOTAL=5400`, helpers `sec()`, `beat()`, `bar()`, `f()`; the `SHOTS` table S00-S25 with `from`/`to` exactly as in `docs/guide/01-storyboard.md`; a function `shotAt(frame)`; a runtime self-check that throws if shots are not contiguous or do not sum to 5400
- `src/lib/ease.ts` (the easing set from guide 05, section 5), `spring.ts` (analytic damped-spring solutions: position at time t for given damping ratio and natural frequency, no integration loop), `prng.ts` (seeded, small, fast), `noise.ts` (seeded 1-D and 2-D value noise, smooth), `units.ts` (cm helpers, degree/radian), `hash.ts`
- `tools/make-prompt.mjs`: given a patch number, reads `docs/patches/PNN-*.md`, takes the five parts (context header, the listed existing files, the listed reference files, the attached guide sections, the patch prompt block) and writes `prompts-out/patch-NN.md`; prints which listed files are missing; Node only, Windows-safe paths; flags `--repo-site <path>` (website repo) and `--repo-film <path>` (minilocker-film)
- append the pinned versions to `docs/PATCH_NOTES.md`

RULES THAT MATTER HERE:
- No `useFrame`, no `Math.random`. The `spring` functions are closed-form.
- Frame numbers in the SHOTS table must match the storyboard exactly.
- Keep everything small and boring: this patch is the foundation.

CHECK:
- `npm install`
- `npx tsc --noEmit` (zero errors)
- `npm run studio` shows a composition 5400 frames long at 60 fps with the readout; scrub to frame 2760 and see `S14`
- `node -e` import of the timeline prints total 5400 and 26 shots
- `node tools/make-prompt.mjs 0` writes `prompts-out/patch-00.md`
```

**Acceptance (what you look at to say yes):** Studio opens; the readout is right at frames 0, 239, 240, 1080, 3960, 5399.
**Do not:** Add any 3D, any plate, any data.
