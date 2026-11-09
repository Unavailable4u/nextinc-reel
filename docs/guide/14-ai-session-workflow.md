# 14 - Working patch by patch with an assistant

This is the workflow of `minilocker-film`, adapted. You paste, the assistant writes full files, you run the check, you log it.

## 1. For every patch, give the assistant these five things, in this order

1. **The context header**: `docs/guide/context-header.md` (the same text every time).
2. **Existing files** the patch lists under "Paste existing". Always `docs/PATCH_NOTES.md` (empty at Patch 00).
3. **Reference files** from your other repos that the patch lists under "Paste reference" (read-only).
4. **Guide sections** the patch lists under "Attach", copied from `docs/guide/`.
5. **The patch prompt** (the code block in the patch file).

Each patch file lists these. Until Patch 00 creates `tools/make-prompt.mjs`, assemble them by hand; afterwards `node tools/make-prompt.mjs <patch number>` writes `prompts-out/patch-NN.md` with all five parts, as in your earlier repo.

## 2. Apply and check

- The assistant answers with **full files** under path headers (never diffs). Save each at the stated path; same path replaces the old file.
- Run the patch's **Check** commands. If a check fails, paste the error into the same session and ask for the corrected **full file**.
- **Send pictures.** For visual patches render stills (or a Studio screenshot) and attach them to your next message with a sentence like "contact is wrong on the left book; shadow too even". A picture is worth a page of description.
- Append to `docs/PATCH_NOTES.md` (the assistant does this as part of every patch; check it is there). Commit: `patch NN: short title`.

## 3. When a session runs out

Open a new session, paste the context header, say "Patch NN, your previous answer was cut off after file `<path>`. Resend only the files from `<path>` onward, complete.", then paste the same patch prompt. Switching assistants is safe because `PATCH_NOTES.md` records exports, props and decisions.

## 4. Order matters

Use `docs/patches/INDEX.md`. Patches marked parallel-safe can be done in any order relative to each other. Do not skip a gate.

## 5. Keep each session small

One patch, one subject. If a patch grows, split it and note the split in `PATCH_NOTES.md` (the earlier film split patch 21 into 21a and 21b the same way).

## 6. Rules the assistant must obey (also in the context header)

Determinism, the truth rule, the plate rule, no tool names in commits or docs, no work outside the patch, no placeholders (no TODO, no "..."), full files only.
