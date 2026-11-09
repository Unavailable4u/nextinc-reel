# Rules for any assistant or contributor working in this repository

These follow the conventions of the Next Inc. website repository, so both repos behave the same way.

1. Do not add `Co-authored-by`, `Assisted-by`, `Generated-by` or similar trailers to commit messages. Do not add "Generated with ..." lines anywhere.
2. Do not mention tool or model names in code comments, docs, patch notes or commit messages. For an `owner:` field use the maintainer's name or "reel team".
3. Do not set or change the git author or committer identity. Commits are made by the repository owner.
4. Keep commit messages short and plain, in the maintainer's voice (for example `patch 07: cloth and foil materials`).
5. The original plate, `public/plates/original/desk-plate.jpg`, is read-only. Never edit, re-save, re-compress or overwrite it. `npm run plate:verify` (created in Patch 02) compares it with the checksum in `docs/reference/.plate.sha256`.
6. Everything on screen that states a fact (a name, title, year, status, number, link, QR target, caption) comes from `src/data/site-snapshot.json`, which is produced from the website repository by `npm run sync` (Patch 01). Never type such a value into a component.
7. Rendering must be deterministic: every pixel at frame N is a pure function of N. See `docs/guide/02-architecture.md`, section "Determinism".
8. One patch at a time. Do not build outside the current patch's scope. Append to `docs/PATCH_NOTES.md` at the end of every patch.
