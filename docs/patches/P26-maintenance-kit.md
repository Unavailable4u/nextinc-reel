### PATCH 26 - Maintenance kit and README truth pass

**Needs:** 25
**Parallel-safe with:** none
**Size:** S
**Paste existing:** `docs/PATCH_NOTES.md`, `README.md`, `docs/ops/RUNBOOK.md`, `package.json`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/11-maintenance.md`, `docs/guide/12-troubleshooting.md`

```
PATCH 26 - Maintenance kit and README truth pass.

GOAL: make the maintenance guide match reality: real command names, working health check, accurate shot-to-files map, release tag.

CREATE / CHANGE:
- `scripts/health.mjs` and `npm run health` (the quarterly checks in guide 11 section 7: clean install check hint, snapshot parse, QR target reachability by HEAD request, plate checksum, team size warning at 4 names)
- update `docs/ops/RUNBOOK.md` and the README command table to the commands that exist
- verify the shot-to-files map by changing one file and re-rendering one shot
- `CHANGELOG.md` entry for v1.0.0; `git tag reel-v1.0.0` instructions

RULES THAT MATTER HERE:
- Only list commands that exist.

CHECK:
- `npm run health` runs and prints a report
- A fresh clone passes steps 1-4 of the RUNBOOK set-up
```

**Acceptance (what you look at to say yes):** Someone who has never seen the project can update a screenshot and re-publish by following the runbook.
**Do not:** New features.
