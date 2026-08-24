# CLAUDE.md

Guidance for working in this repository.

## What this is

A browser-based single-player turn-based world-conquest strategy game. Plain ES modules, no
framework, Vite for dev/build. **There is no server-side game logic and no multiplayer**,
despite the repository being named `OnlineRiskGame`.

## Read first

Before any non-trivial change, read the relevant document in [docs/](./docs/):

- [docs/01-codebase-audit.md](./docs/01-codebase-audit.md) — architecture and the catalogued
  defects with file/line references. **Check here before "fixing" something odd** — it is
  probably already logged, with the reason.
- [docs/02-game-design-document.md](./docs/02-game-design-document.md) — what each mechanic
  does, and what is implemented vs. missing.
- [docs/03-refactor-plan.md](./docs/03-refactor-plan.md) — the phased plan. Work follows it.
- [docs/04-e2e-test-plan.md](./docs/04-e2e-test-plan.md) — functional areas and the test
  harness.
- [docs/05-known-issues.md](./docs/05-known-issues.md) — the live defect register:
  every issue found so far, its status, where it is in the code **today**, and the phase that
  closes it. This is the one that stays current; the audit is the analysis behind it.

## Commands

```bash
npm run dev            # Vite dev server, port 3000
npm run build          # production build -> build/
npm run preview        # serve build/ on port 4173
npm run lint           # ESLint (baseline: 214 errors, 394 warnings)
npm run format         # Prettier (legacy root sources are ignored on purpose)
npm run test:unit      # Vitest, 82 tests, ~1s
npm run test:e2e       # Playwright, 212 tests, 4 workers headless, ~5-9 min
npm run test:e2e:categories   # list the functional areas and their spec counts
npm run test:e2e:category -- turn-loop   # one area
npm run test:e2e:slow  # one visible browser, 500ms between actions
npm run build:data     # regenerate resources/adjacency.json + pathAreas.json
```

## House rules

1. **Follow the refactor plan's phase order.** Each phase must end with the game playable.
   No big-bang rewrites.
2. **Leigh handles all git commits and pushes.** Do the work, leave it in the working tree,
   and say what would go in the commit. Staging to help review is fine; committing is not.
3. **Keep bug fixes separate from moves and renames** when describing a change set, so a
   regression stays bisectable.
4. **Work test-first.** Write the failing test, watch it fail, then fix. Known-broken
   behaviour is `test.fixme` with a comment explaining why and what unblocks it — never
   deleted, and never asserted as correct.
5. **Do not run `prettier --write` over the legacy root sources.** They are in
   `.prettierignore` deliberately; reformatting 18,000 lines destroys blame right when it is
   needed most. Files come off that list as they move into `src/`.
6. **Do not "fix" a lint warning in passing.** The baseline is recorded. Fix them as part of
   the phase that owns that file.
7. **Verify in a browser, not just by reading.** This codebase has behaviour that only shows
   up at runtime (see the implicit-global gotcha below). `npm run dev` and click through.

## Gotchas specific to this codebase

- **History was rewritten on 2026-08-23** (refactor Phase 0.7). Every SHA before `184ccbc`
  changed. Any clone or branch taken before that date has an unrelated history and cannot be
  merged — re-clone instead. The pre-rewrite history is preserved in
  `../_backup-OnlineRiskGame-<timestamp>/pre-rewrite-all-refs.bundle`.
- **Cloning on Windows needs `core.longpaths`.** `resources/vecteezy_flat-world-map-…_2065080/`
  produces 123-character paths, which breaches `MAX_PATH` when cloned into a deep directory —
  the clone succeeds but the checkout fails. `git config --system core.longpaths true`, or
  clone somewhere shallow.

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
- **The module graph is still circular**, but the three `setTimeout(..., 1000)` races that
  used to paper over it are gone (Phase 1.7). Static imports work because the symbols involved
  are hoisted function declarations. Do not add more module coupling, and never reintroduce a
  timer to "wait for" an import.
- **Territory state lives in three places at once** — `mainGameArray`, SVG path attributes,
  and siege/war object copies. Any change to one usually needs the other two. Phase 4 fixes
  this; until then, check all three.
- **`mainGameArray` is sorted by `defenseBonus`**, not by `uniqueId`. Never index it
  positionally.
- **`dataName` is the *current* owner and changes on conquest**; `territoryName` is the stable
  identity; `originalOwner` is historical. Mixing them up is a recurring source of bugs.
- **`resources/svgMaster.svg` is the authoritative source of territory names.**
  `tests/uniqueIdLookup.json` is a convenience map and has drifted before: it says
  `"Grand Bahama"` / `"Andros Island"` where the SVG says `"Grand Bahama (Bahamas)"` /
  `"Andros Island (Bahamas)"`. Those parentheses are real, not typos. Derive names from the
  SVG in any tool or test.
- **`resources/adjacency.json` and `resources/pathAreas.json` are generated** by `tools/`.
  Edit the generator, never the JSON. `npm run build:data` regenerates both; the `:check`
  variants verify they are current.
- **Seeding `Math.random` does not make the game deterministic.** `addSparklesRegularly()` in
  `ui.js` burns three draws per timer tick on the same global stream as combat and the
  economy. Until Phase 5 splits game RNG from cosmetic RNG, **no test may assert an exact
  combat or economy outcome across runs**.
- **Bootstrap has two halves that finish out of order.** The `DOMContentLoaded` handler builds
  the UI and sets `pageLoaded`; `svgMapLoaded()` runs later on window `load` and is what
  populates `paths`. Anything needing territory geometry must await `whenPageLoaded()`, which
  waits for both.
- **The map is an `<object>`, not an `<iframe>`.** `page.frameLocator("#svg-map")` does not
  work in Playwright; use `page.frame({ name: "svg-map" })`.
- **The AI turn used to crash and freeze the game** (audit §5.1 AA) — fixed in Phase 3, along
  with the four further crashes hiding behind it (§5.1 AF–AJ). A 20-turn playthrough now
  completes clean. If the phase button ever sticks on `AI MOVING...` again, it is an unhandled
  rejection escaping the `gameLoop()` promise chain: there is no `catch` anywhere in it, so any
  throw inside the AI turn stops the game permanently rather than losing one turn.
- **Since Phase 3 the AI actually conquers — and attacks the player.** A turn can end with a
  battle results screen sitting on top of the phase button, and it can appear a beat AFTER the
  turn counter advances. `GameDriver.dismissBlockingPanels()` and `withBlockersCleared()` handle
  it in the harness; anything new that drives the turn loop has to as well.
- **A besieged territory earns no gold, oil or construction materials**, and the AI besieges far
  more than it can finish (17 → 67 concurrent sieges over 14 turns). Both are design problems
  logged for Phase 7 in [docs/05-known-issues.md](./docs/05-known-issues.md) §6 — do not "fix"
  either as a bug.
- **Territory names are not selector-safe.** Six carry real parentheses, so
  `querySelector("#siegeImage_" + name)` throws rather than returning null (audit §5.2 AI). Use
  `getElementById` for anything keyed by a territory name.
- **`xButton` is a duplicated id** — the info panel's close button and the upgrade window's
  both use it, so a bare `#xButton` selector is ambiguous the moment both exist.
- **`#tooltip` follows the pointer and has no `pointer-events: none`**, so it sits on top of
  whatever you are about to click and eats the click. It is also the only thing that clears
  `clickActionsDone`, the latch that gates the bottom table updating. The page objects park
  the pointer before interacting; production code should not have to.
- **The transfer table's row click handler is on the row's NAME column**, not on the row.
  The attack mode of the same renderer has no row selection at all.

## Conventions

- ES modules, `"type": "module"`. Node-side CommonJS files use `.cjs` (the webpack configs).
- Config files use `.mjs`.
- 4-space indent for game source, 2 for JSON/Markdown/config (`.editorconfig`,
  `.prettierrc.json`).
- Reference code as clickable links: `[ui.js:440](ui.js#L440)`.
