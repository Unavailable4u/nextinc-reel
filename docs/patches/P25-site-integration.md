### PATCH 25 - Put the film on the website

**Needs:** 24
**Parallel-safe with:** none
**Size:** S
**Paste existing:** `docs/PATCH_NOTES.md`
**Paste reference (read-only, from other repos):** `nextinc/assets/data/films.js`, `nextinc/index.html` (Fig. 1 figure), `nextinc/assets/js/pages/home.js`, `nextinc/ledger/S10-home-reel-previews-slideshow.md`, `nextinc/AGENTS.md`
**Attach from guide:** `docs/guide/10-site-integration.md` (all), `docs/checklists/pre-publish.md`
**Before you start (you do this, not the assistant):** upload the master to YouTube as Unlisted and copy the 11-character id.

```
PATCH 25 - Put the film on the website.

GOAL: the website shows the film as Fig. 1 after the hero, passing the site's own checks.

CREATE / CHANGE:
- the exact edit to `films.js` (full file) with the `next-inc-reel` entry
- optionally the static Fig. 1 figure in `index.html` and the matching removal in `home.js` (full files) per the site ledger
- a ledger entry `ledger/S12-company-reel.md` in the site's style (owner: site team)

RULES THAT MATTER HERE:
- Follow the website repo's `AGENTS.md`: no tool or model names or attribution anywhere there.
- Do not raise any media budget.

CHECK:
- In the site repo: `npm run check` and `npm run prelaunch` pass
- Local `npm run serve`: Fig. 1 appears, plays in the lightbox, no YouTube request before play
- Check on a phone
```

**Acceptance (what you look at to say yes):** The reel is live right after the hero, on desktop and phone.
**Do not:** Change other site pages.
