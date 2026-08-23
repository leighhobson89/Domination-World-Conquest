# CLAUDE.md

Guidance for working in this repository.

## What this is

A browser-based single-player turn-based world-conquest strategy game. Plain ES modules, no
framework, Vite for dev/build. **There is no server-side game logic and no multiplayer**,
despite the repository being named `OnlineRiskGame`.

## Read first

Before any non-trivial change, read the relevant document in [docs/](./docs/):

- [docs/01-codebase-audit.md](./docs/01-codebase-audit.md) — architecture and 20 catalogued
  defects with file/line references. **Check here before "fixing" something odd** — it is
  probably already logged, with the reason.
- [docs/02-game-design-document.md](./docs/02-game-design-document.md) — what each mechanic
  does, and what is implemented vs. missing.
- [docs/03-refactor-plan.md](./docs/03-refactor-plan.md) — the phased plan. Work follows it.
- [docs/04-e2e-test-plan.md](./docs/04-e2e-test-plan.md) — functional areas and the test
  harness.

## Commands

```bash
npm run dev            # Vite dev server, port 3000
npm run build          # production build -> build/
npm run preview        # serve build/ on port 4173
npm run lint           # ESLint (baseline: 226 errors, 405 warnings)
npm run format         # Prettier (legacy root sources are ignored on purpose)
npm test               # Vitest -- no tests yet, lands in refactor Phase 5
```

## House rules

1. **Follow the refactor plan's phase order.** Each phase must end with the game playable and
   committed. No big-bang rewrites.
2. **Keep bug fixes separate from moves and renames.** A commit either changes behaviour or
   moves code, never both — the refactor depends on being able to bisect.
3. **Do not run `prettier --write` over the legacy root sources.** They are in
   `.prettierignore` deliberately; reformatting 18,000 lines destroys blame right when it is
   needed most. Files come off that list as they move into `src/`.
4. **Do not "fix" a lint warning in passing.** The baseline is recorded. Fix them as part of
   the phase that owns that file.
5. **Verify in a browser, not just by reading.** This codebase has behaviour that only shows
   up at runtime (see the implicit-global gotcha below). `npm run dev` and click through.

## Gotchas specific to this codebase

- **`dist/` is not the build output.** It holds committed webpack UMD bundles that
  `index.html` loads as classic scripts to set `CANNON`, `THREE` and `BufferGeometryUtils` as
  globals. Vite writes to `build/`. Never point a bundler at `dist/`.
- **Asset paths are hand-written strings.** ~100 places do
  `"resources/flags/" + country + ".png"` at runtime. No bundler rewrites those, which is why
  `vite.config.mjs` copies `resources/` into the build verbatim. Moving `resources/` means
  editing every one of those strings.
- **Some bare identifiers resolve via named window access.** `tooltip` (59 sites in `ui.js`)
  and `uiTable` are never declared in scope — they resolve to `window.tooltip` /
  `window.uiTable` because elements with those `id`s exist. It works, ESLint flags it as
  `no-undef`, and it breaks the moment the element is renamed or the code moves into a scope
  with a local of the same name.
- **Circular imports are worked around with `setTimeout(..., 1000)`** in `battle.js`,
  `transferAndAttack.js` and `manualExceptionsForInteractions.js`. That is a race, not a
  solution. Refactor Phase 1.7 removes it; until then, do not add more module coupling.
- **Territory state lives in three places at once** — `mainGameArray`, SVG path attributes,
  and siege/war object copies. Any change to one usually needs the other two. Phase 4 fixes
  this; until then, check all three.
- **`mainGameArray` is sorted by `defenseBonus`**, not by `uniqueId`. Never index it
  positionally.
- **`dataName` is the *current* owner and changes on conquest**; `territoryName` is the stable
  identity; `originalOwner` is historical. Mixing them up is a recurring source of bugs.
- **First load is slow** (a 19 MB JSON parsed once per territory). Expected until Phase 1.1.

## Conventions

- ES modules, `"type": "module"`. Node-side CommonJS files use `.cjs` (the webpack configs).
- Config files use `.mjs`.
- 4-space indent for game source, 2 for JSON/Markdown/config (`.editorconfig`,
  `.prettierrc.json`).
- Reference code as clickable links: `[ui.js:440](ui.js#L440)`.
