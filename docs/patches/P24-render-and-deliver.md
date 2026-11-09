### PATCH 24 - Render pipeline and deliverables; Gate G4

**Needs:** 23
**Parallel-safe with:** none
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `package.json`, `src/config/timeline.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/09-render-and-delivery.md` (all), `docs/checklists/pre-render.md`

```
PATCH 24 - Render pipeline and deliverables; Gate G4.

GOAL: one command that renders by shot segments, joins them, adds audio, normalises loudness, verifies, and writes the poster, loop and provenance.

CREATE / CHANGE:
- `scripts/render.mjs` (Remotion Node API; segments; concurrency flag; resume of finished segments; ffmpeg concat; audio; two-pass loudnorm; `ffprobe` verification of 1920x1080, 60 fps, 90.000 s; writes `out/reel-vX.mp4` and `out/RENDER_INFO.json` with versions, git commit and site-snapshot commit)
- `scripts/make-poster.mjs` (WebP 1600 x 900, quality search to at most 100 KB), `scripts/make-loop.mjs` (3-5 s, 640 px, at most 500 KB, mp4 + webm)
- a refusal when `plate:verify`, `sync --check` or `audit` fails

RULES THAT MATTER HERE:
- Never overwrite a finished render; versions only.

CHECK:
- Render S05 alone first; then the whole film
- Release checklist (guide 13 section 4)
```

**Acceptance (what you look at to say yes):** Gate G4: all release checks ticked; the viewing protocol done.
**Do not:** Publish.
