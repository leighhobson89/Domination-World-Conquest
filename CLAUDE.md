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
npm run lint           # ESLint (baseline: 188 errors, 332 warnings)
npm run format         # Prettier (legacy root sources are ignored on purpose)
npm run test:unit      # Vitest, 294 tests, ~1s
npm run test:e2e       # Playwright, 275 tests, 4 workers headless, ~8-14 min
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
- **Every element id and selector lives in `src/ui/core/registry.js`** (Phase 6.1), and both
  the app and the e2e page objects import it — `tests/support/selectors.js` is a derived view
  of it and holds no literal selector. Never hand-write an id or a `#selector`: add it there.
  Element construction goes through `src/ui/core/dom.js` — `el()`, `mount()`, `on()` — whose
  `on()` returns its own remover, which is what lets a component undo itself in `destroy()`.
- **The UI is components now** (Phase 6.3): fourteen files under `src/ui/components/`, each
  `create()` + `destroy()` and, where it follows store state, `update()`. The
  `DOMContentLoaded` block in `ui.js` is the list of `create()` calls plus the handlers that
  belong to the turn loop. `PhaseBar` is the one that subscribes to `state/events.js` today
  (`PHASE_CHANGED` drives its title and button label, so `setPhase()` is the only call a
  phase transition makes); the others carry a note saying what has to become state first.
  `BuyWindow` and `UpgradeWindow` are two specs over one `ResourceWindow` builder.
- **The bare-identifier gotcha is closed.** `tooltip` and `uiTable` used to resolve to
  `window.tooltip` / `window.uiTable` because elements with those ids existed. `tooltip` is
  now an imported handle from `src/ui/components/Tooltip.js` (which creates the element —
  it is no longer in index.html), and `uiTable` is reached through the registry. Do not
  reintroduce the pattern; ESLint flagged every one of those sites as `no-undef`.
- **The module graph is still circular**, but the three `setTimeout(..., 1000)` races that
  used to paper over it are gone (Phase 1.7). Static imports work because the symbols involved
  are hoisted function declarations. Do not add more module coupling, and never reintroduce a
  timer to "wait for" an import.
- **Every game rule runs in Node** (Phase 5). `src/rules/`, `src/ai/` and `src/engine/`
  import from `src/config/` and `src/state/selectors.js` and from nothing else — no DOM, no
  `ui.js`. That is the property the unit suite depends on, so before adding an import to any
  of them, check it does not drag the UI in. Two dependencies are INJECTED for exactly this
  reason: the AI's seeded rng, and `calculateProbabilityPreBattle` (which lives in `battle.js`,
  which imports `ui.js`). Rules take an `rng` parameter rather than calling `Math.random`.
- **Territory state lives in `src/state/GameState.js` and nowhere else** (Phase 4). Read it
  through `state/selectors.js`, write it through `state/mutations.js`, and subscribe to
  `state/events.js`. `mainGameArray` is gone: the replacement for "all territories" is
  `allTerritories()`, and for a lookup `getTerritory(uniqueId)` / `getTerritoryByName(name)`.
- **The SVG path attributes are output, not state.** `owner`, `data-name`, `deactivated`,
  `underSiege`, `greyedOut` and `attackableTerritory` are written **only** by
  `src/ui/mapAttributeSync.js`, from store events. Never write one directly and never read one
  back — `src/state/pathState.js` answers the same question from the store when you only have
  a path element. `uniqueid`, `territory-name`, `isCoastal` and `mountainDefenseFactor` are
  identity and geometry; reading those is fine.
- **There is a bootstrap window in which the SVG *is* the truth** — between `svgMapLoaded()`
  (window `load`, which populates `paths`) and `seedTerritories()` (the end of the initial-data
  Promise). The store has no territories in it, and the attributes are what the model is about
  to be built from. `pathState.js` handles this: it reads the attribute while
  `territoriesReady()` is false and the store afterwards. **Anything new that reads territory
  state during bootstrap has to do the same.** Getting it wrong is not subtle and is not caught
  by most of the suite: `colorCountriesRandomly()` groups paths by `data-name`, and answering it
  from the empty store put the entire 359-territory map into one flat colour, with every
  `countryColor` wrong for the rest of the game. `bootstrap/state-layer.spec.js` guards it now.
- **`underSiege` is derived, not stored.** A territory is under siege exactly when a siege
  names it, so `addSiege()` / `removeSiege()` is the whole operation. This is why
  `normalizeSiegeState()` no longer exists.
- **A siege holds a territory id, not a copy.** `siege.defendingTerritory` is a live getter
  onto the real territory (`src/state/sieges.js`), so writing through it writes the world.
  Do not reintroduce a copy, and do not add a sync-back.
- **`allTerritories()` is ordered by `defenseBonus`**, not by `uniqueId`. Never index it
  positionally, and treat it as read-only.
- **There is a write guard.** Load the page with `?stateGuard=1` to log every territory write
  that bypasses `mutations.js`, or `?stateGuard=strict` to throw on one;
  `window.__game.stateGuardViolations()` reports what it caught. It is off by default and
  will report plenty until Phase 5 makes the rules pure — each report is a Phase 5 to-do,
  not a regression.
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
- **Seeding `Math.random` DOES make the game deterministic** — since Phase 5.8, and it did not
  before. `addSparklesRegularly()` burned three draws per timer tick on the same global stream
  as combat and the economy, so two runs of the same seed diverged (audit 5.3 Y). Cosmetic
  randomness now lives in `src/platform/cosmeticRng.js`, a self-contained mulberry32 that never
  touches `Math.random`. **Nothing decorative may draw from `Math.random`** — a new sparkle, a
  sound choice, an animation delay all go through `cosmeticRandom()`, or the whole suite's
  exact-outcome assertions start flaking. Cosmetics are deliberately not reproducible; seeding
  them from the harness would put the timer straight back on the game's stream.
- **Bootstrap has two halves that finish out of order.** The `DOMContentLoaded` handler builds
  the UI and sets `pageLoaded`; `svgMapLoaded()` runs later on window `load` and is what
  populates `paths`. Anything needing territory geometry must await `whenPageLoaded()`, which
  waits for both.
- **Playwright reuses a preview server it did not build.** `playwright.config.js` sets
  `reuseExistingServer: !process.env.CI`, and its `webServer.command` is
  `npm run build && npm run preview`. So the FIRST e2e run of a session builds and serves
  `build/`, and every run after it reuses that server — against the build as it was at the
  first run. Edit a source file, re-run a spec, and you are testing the old code with no
  warning. It shows up as a spec that passes when it should fail, or fails when the fix is
  already in. Kill whatever is listening on 4173 (`netstat -ano | grep :4173`, and check
  both the IPv4 and the IPv6 listener) before trusting an e2e result taken after an edit.
  `npm run dev` is unaffected — Vite serves from source.
- **The map is an `<object>`, not an `<iframe>`.** `page.frameLocator("#svg-map")` does not
  work in Playwright; use `page.frame({ name: "svg-map" })`.
- **One phase counter, and it is an enum.** `Phase` in `src/state/phases.js`, read with
  `currentPhase()` and written with `setPhase()`. The old `currentTurnPhase` / `turnPhase`
  pair and `modifyCurrentTurnPhase()` are gone. Same for the turn: `currentTurn()` /
  `advanceTurn()`.
- **The AI turn used to crash and freeze the game** (audit §5.1 AA) — fixed in Phase 3, along
  with the four further crashes hiding behind it (§5.1 AF–AJ). A 20-turn playthrough now
  completes clean.
- **The turn loop is `src/engine/TurnEngine.js`** (Phase 5.7), not a recursive `gameLoop()`.
  It is a sequencer that knows nothing about this game: `beginTurn`, each step in order,
  `endTurn`, repeat. `gameTurnsLoop.js` supplies the hooks. Three consequences worth knowing:
  **a step that throws no longer kills the game** — it is reported through `onError` and the
  turn continues without it, so a crash now shows up as a `console.error` (and therefore a
  failing e2e spec) instead of the phase button silently sticking on `AI MOVING...`; **there
  is exactly one `#popup-confirm` listener**, installed once, calling `engine.advancePhase()`,
  rather than three transient ones added and removed per phase; and **`stop()` / `reset()`
  exist**, which is what makes New Game possible in Phase 7. Do not reintroduce a phase that
  waits by attaching its own listener — add a step with `waitsForPlayer`.
- **`window.__game` has grown, and each accessor exists because a spec could not be written
  without it.** Beyond the readers: `greyedOutCountries()` (the selection lock as state, not as
  a fill), `siegeAt(name)` (one live siege — `sieges()` only says *which* territories are
  besieged), `battle()` (the two armies unrounded; the battle UI's cells are formatted `"1.9k"`),
  `randomEventProbability()` and `forceRandomEvent(name)` (an event is a band on the mean of
  five draws, so no seed reaches a chosen one on a chosen turn), and `applyScenario()`.
- **A scenario must patch `armyForCurrentTerritory` as well as the four unit counts.** It is a
  stored total, not a derived one. Patch the units alone and the probability calculation reads
  one number while the bottom table reads another — the scenario looks applied and the battle
  behaves as though it were not.
- **A `console.error` fails every e2e spec.** `tests/support/fixtures.js` collects them
  alongside `pageerror`. That is deliberate and it is how known-issue AM was finally caught,
  so do not silence the engine's `onError` to make a run go green — find what threw.
- **Scenarios beat clicking** for anything the UI cannot reach — a rout, an all-naval
  defender, two concurrent sieges. `await game.loadScenario("two-sieges")` in a spec;
  the JSON lives in `tests/support/scenarios/` and is applied through `state/mutations.js`.
  See [docs/04-e2e-test-plan.md](./docs/04-e2e-test-plan.md) §3.7.
- **Since Phase 3 the AI actually conquers — and attacks the player.** A turn can end with a
  battle results screen sitting on top of the phase button, and it can appear a beat AFTER the
  turn counter advances. `GameDriver.dismissBlockingPanels()` and `withBlockersCleared()` handle
  it in the harness; anything new that drives the turn loop has to as well.
- **A besieged territory earns no gold, oil or construction materials**, and the AI besieges far
  more than it can finish (17 → 67 concurrent sieges over 14 turns). Both are design problems
  logged for Phase 7 in [docs/05-known-issues.md](./docs/05-known-issues.md) §6 — do not "fix"
  either as a bug.
- **Do not move the CPU-leader and starting-fort setup earlier in bootstrap.** It looks wrong —
  `initialiseGame()` starts turn 1 before either exists, which is why `newTurnResources()` skips
  the income pass on turn 1 — and moving it inside `initialiseGame()` was tried and **measured**
  in Phase 5.8: the ten-turn `long-run` went from 6/6 green to 0/6, the player eliminated every
  time. Giving the AI a fully-formed first turn is a balance change, and it belongs to the Phase
  7 balance pass. The measurement is recorded at the site in `gameTurnsLoop.js`.
- **The five strongest countries are LOCKED on the selection screen and that is deliberate**
  (`COUNTRY_GREYOUT_RANK`, audit 5.2 Z). They are painted in their own colour muted toward grey,
  not flat grey, because flat grey read as "failed to render". The lock is enforced from the
  store — never from a fill colour, which is how it used to be bypassable in three clicks.
- **A marker is decoration and must never intercept a click.** Siege overlays and the attack
  image carry `pointer-events: none`. Without it the marker sits over the middle of the
  territory it marks and swallows the click, and clicking a besieged territory is the only route
  to VIEW SIEGE. `#tooltip` was the same class of bug and is fixed (Phase 6.3).
- **Siege markers are rendered from state**, by `src/ui/siegeOverlay.js` on the `siegeChanged`
  event. Do not also draw one imperatively where a siege is created — that produced two
  `<image>` elements sharing one id, of which only one was ever removed.
- **INVADE! debits the source territory immediately** (Phase 4.7, audit §5.1 AD), and a
  no-penalty retreat returns the army through `retrievalArray` a turn later. The two halves
  balance; changing one without the other creates or destroys army.
- **Territory names are not selector-safe.** Six carry real parentheses, so
  `querySelector("#siegeImage_" + name)` throws rather than returning null (audit §5.2 AI). Use
  `getElementById` for anything keyed by a territory name.
- **`xButton` is a duplicated id** — the info panel's close button and the upgrade window's
  both use it, so a bare `#xButton` selector is ambiguous the moment both exist. Recorded as
  such in `registry.js`; Phase 6.8 gives them separate semantic ids.
- **`#tooltip` follows the pointer and now carries `pointer-events: none`** (Phase 6.3). It
  used to sit on top of whatever you were about to click and eat the click. It is still the
  only thing that clears `clickActionsDone`, the latch that gates the bottom table updating,
  so the page objects still park the pointer — that is belt-and-braces now rather than a
  workaround. Push content into it with `tooltip.setContent()` / `show()` / `clear()`, never
  by reaching for the element.
- **The transfer table's row click handler is on the row's NAME column**, not on the row.
  The attack mode of the same renderer has no row selection at all.

## Conventions

- ES modules, `"type": "module"`. Node-side CommonJS files use `.cjs` (the webpack configs).
- Config files use `.mjs`.
- 4-space indent for game source, 2 for JSON/Markdown/config (`.editorconfig`,
  `.prettierrc.json`).
- Reference code as clickable links: `[ui.js:440](ui.js#L440)`.
