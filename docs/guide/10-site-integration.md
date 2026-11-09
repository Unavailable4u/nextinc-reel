# 10 - Putting the film on the Next Inc. website

The home page already has the slot. This is the exact procedure, taken from `nextinc/ledger/S10-home-reel-previews-slideshow.md` and the header of `assets/js/pages/films.js`. Patch 25 walks you through it.

## 1. What the site is waiting for

- `index.html` has an empty, hidden `<figure class="hero__fig" id="hero-reel" data-reel="next-inc-reel" hidden>` right after the hero. `home.js` fills and shows it **when `assets/data/films.js` contains a film with id `next-inc-reel` and a poster**. Until then nothing shows, so there is never a dead play button.
- The poster: **1600 x 900 WebP, at most 100 KB**, saved as `assets/img/films/next-inc-reel.webp`.
- The site's media gate (`scripts/check-media.mjs`) enforces: poster 100 KB, cover 120 KB, screenshot 200 KB, preview 500 KB, **film 10 MB**. A 90 s, 60 fps film is far above 10 MB, so **host it on YouTube** (D-11). Self-hosting would need that budget raised on purpose; do not do that casually.

## 2. Steps

1. **Render** the final (guide 09). Choose the poster frame (guide 01 lists candidates).
2. **Upload to YouTube**, visibility **Unlisted**. Title: `Next Inc. - what we have built so far`. Description: one plain sentence, the site address, the four project names. Copy the 11-character id from the URL (the part after `?v=` or after `youtu.be/`).
3. **Poster:** copy `out/poster.webp` to `nextinc/assets/img/films/next-inc-reel.webp` (it must be at most 100 KB).
4. **Add the film entry** to `nextinc/assets/data/films.js` (paste-ready, from the ledger; write the real duration and id):

```js
{ id: "next-inc-reel", title: "Next Inc. — what we have built so far", sub: "Our work so far", duration: "1:30", year: 2026,
  kind: "showreel", provider: "youtube", src: "<11-character YouTube id>",
  poster: "assets/img/films/next-inc-reel.webp", featured: true, palette: "crimson", motif: "waves" },
```

5. **Run the site's checks** in the site repo: `npm run check`, then `npm run prelaunch`. Both must pass (the poster must exist, inside budget, the id must be eleven characters).
6. **Test locally** (`npm run serve`): Fig. 1 appears after the hero; the film opens in the lightbox; it plays; it does not request YouTube until the visitor presses play.
7. **Optional, later:** replace the empty figure with the static figure from the ledger (and delete the "Fig. 1 - the company reel" block in `home.js`) so the layout does not shift when the figure appears (CLS 0 on desktop). The static figure's caption reads `Fig. 1. Next Inc. - what we have built so far, 1:30.`
8. **Write a ledger entry** in the site repo (`ledger/S12-company-reel.md`) in the site's own style, with `owner: site team`, listing what you changed. Follow the site's `AGENTS.md`: no tool or model names and no attribution trailers in commits or docs there either.
9. **Check mobile** (a real phone): the poster loads fast, the play button works, the lightbox plays at 60 fps, the sound is not the only carrier of information.

## 3. Text alternative

The film has no speech. Provide a short description wherever the site's data model allows (in the YouTube description at least, and in the film's `sub` field if it fits):

> A hand-held view of a dark desk. Three hardcover books lie in a pile. One is lifted and opened: pages show a project's abstract, screenshots, a film thumbnail and QR codes. A second book follows. Then four books, one per Next Inc. project (Mini Me, SPHEREx Blink Comparator, MiniLocker and Next Inc. Immersive), stand on a small riser. The Next Inc. logo appears.

## 4. Updating the film later

Upload a **new** video (a published YouTube video cannot be swapped without losing its URL), put the new id in `films.js`, replace the poster if it changed, run the checks, and delete the old unlisted video when nothing links to it. Details: `docs/ops/RUNBOOK.md`, "Publishing a new version".

## 5. The film's first frame and the site

The opening frame is your desk photograph, so the poster and the first second look alike. Keep the poster frame different from frame 0 (a cover or the riser) so the figure invites a click rather than looking like a page background.
