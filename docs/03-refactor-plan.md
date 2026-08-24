# Refactor Plan — Domination: World Conquest

**Baseline:** commit `b7ae0af`
**Companion documents:** [01-codebase-audit.md](./01-codebase-audit.md) · [02-game-design-document.md](./02-game-design-document.md) · [04-e2e-test-plan.md](./04-e2e-test-plan.md)

---

## 0. Principles

These are the rules the whole refactor is measured against. If a step violates one of them,
the step is wrong.

1. **The game must be playable at the end of every phase.** No "big bang" rewrite. Each phase
   ends with a working build committed on its own branch.
2. **One source of truth for territory state.** The SVG becomes a *view*. Game state stops
   living in DOM attributes.
3. **Logic must be importable without a DOM.** Every rule — economy, combat, siege, AI — must
   run in Node with no browser. That is what makes it unit-testable and what makes the e2e
   suite small.
4. **Behaviour is preserved unless a defect is being fixed deliberately.** Bug fixes get their
   own commits, separate from moves and renames, so a regression can be bisected.
5. **Characterisation tests before surgery.** Before restructuring a module, land e2e coverage
   for its functional area (see [04-e2e-test-plan.md](./04-e2e-test-plan.md)). Otherwise the
   refactor has nothing to prove itself against.
6. **No new dependencies without a reason.** Plain ES modules, Vite for dev/build, Playwright
   for e2e, Vitest for unit. That is the whole intended toolchain.

---

## 1. Target architecture

```
src/
  main.js                        entry point; wires everything, owns nothing
  config/
    balance.js                   all tunable numbers (prices, modifiers, caps, thresholds)
    constants.js                 enums: Phase, UnitType, Resource, WarOutcome, MapMode
  data/
    countries.js                 (was initialData.js) 208 country records
    leaderPersonalities.js       personality archetypes
    adjacency.js                 loads + indexes closestPathsData once
    manualAdjacencyExceptions.js pure data, no timers, no imports of game state
  state/
    GameState.js                 the single store: territories, players, turn, phase, wars
    Territory.js                 territory shape + derived getters
    Player.js                    player/AI country shape
    selectors.js                 pure reads: byId, byOwner, reachableFrom, totalsFor
    mutations.js                 the only place state is written
    events.js                    tiny emitter; UI subscribes, logic never imports UI
  rules/                         PURE — no DOM, no imports from ui/
    economy/
      income.js                  gold/oil/food/consMats per turn
      population.js              growth, starvation, productive population
      capacity.js                capacities, demands, oil gating of useable units
      maintenance.js             per-turn army upkeep
    military/
      units.js                   costs, personnel worth, combined force
      probability.js             pre-battle odds
      battle.js                  skirmish resolution, round outcomes
      siege.js                   siege score, hit roll, damage, arrest
      conquest.js                ownership transfer, lockout, army retrieval
    events/
      randomEvents.js            the four disasters
    victory.js                   NEW — win/lose conditions
  ai/
    threat.js                    threat scoring
    goals.js                     goal generation, refinement, prioritisation
    actions/
      economy.js  bolster.js  attack.js  siege.js
    rng.js                       seeded per (turn, country)
    diplomacy.js                 the gold-offer exchange
  engine/
    TurnEngine.js                replaces gameLoop(); iterator, not recursion
    phases.js                    phase definitions + transitions
  ui/
    core/
      dom.js                     el(), mount(), on() helpers
      registry.js                id/selector constants — single place, shared with tests
    components/                  one file per panel; each builds + updates its own DOM
      MainMenu.js  CountrySelect.js  TopTable.js  BottomTable.js  PhaseBar.js
      MoveButton.js  BuyWindow.js  UpgradeWindow.js  TransferAttackWindow.js
      BattleUI.js  BattleResults.js  AiDialogue.js  InfoTable.js  Tooltip.js
    map/
      MapView.js                 renders GameState onto the SVG
      colouring.js               political/physical/continent modes
      camera.js                  zoom + pan
      markers.js                 siege icons, attack icons, strokes
    interactions/
      selection.js  transfer.js  attack.js  siege.js
  platform/
    audio.js  storage.js         save/load (NEW)
tests/
  unit/                          Vitest, mirrors src/rules and src/ai
  e2e/                           Playwright — see 04-e2e-test-plan.md
tools/
  precompute-areas.mjs           bake path areas to JSON
  build-adjacency.mjs            rebuild/compact closestPathsData
```

**Dependency rule, enforced by lint:**

```
data  →  (nothing)
rules →  data, config, state(types only)
ai    →  rules, data, config, state(selectors)
state →  data, config
engine→  state, rules, ai
ui    →  state(selectors), engine(commands), config
```

`rules/` and `ai/` must never import from `ui/`. That single rule kills every circular
dependency in the current codebase.

---

## 2. Phased plan

Each phase is a branch, ends green, and ends playable.

---

### Phase 0 — Make it possible to work (½ day) — ✅ **COMPLETE**

**Goal:** stop fighting the repo.

| Step | Action | Status |
|---|---|---|
| 0.1 | Add `README.md` and `CLAUDE.md` (build/run/test commands, architecture summary, house rules). | ✅ |
| 0.2 | Fix `.gitignore`: stop ignoring `package.json` / `package-lock.json`; add `node_modules/`, `build/`, `.idea/`, `test-results/`, `playwright-report/`. | ✅ |
| 0.3 | Delete `database_OBSOLETE/`, `testJest/`, `resources/SVG_coastLines - Copy.svg` and `DominationWC_0.2.5.zip`; untrack `.idea/`. | ✅ |
| 0.4 | Add `.editorconfig`, ESLint (flat config) + Prettier. Rules that matter immediately: `no-undef`, `no-unused-vars`, `no-shadow`, `no-fallthrough`, `eqeqeq`. `no-shadow` alone catches audit §5.2 I and M. | ✅ |
| 0.5 | Introduce **Vite** as dev server + bundler. `npm run dev` / `npm run build` / `npm run preview`. | ✅ |
| 0.6 | Declare the real devDependencies in `package.json`. Remove `express` from runtime deps once Vite serves. | ✅ |
| 0.7 | Rewrite git history with `git filter-repo` to drop dead large blobs from all commits, then force-push. | ✅ — authorised by the developer; see §0.7 below |

**Exit criteria:** `npm run dev` serves the game unchanged; `npm run lint` runs (failures allowed, recorded as a baseline count). — **met.**

#### What actually happened

**Deviations from the plan as written:**

- **`resources/*.psd` were kept.** The plan lumped 16 MB of layered Photoshop sources
  (`battleUiLayout.psd`, `battleSummaryLayout.psd`, `sketchupTransferAttack.psd`) in with the
  dead assets. They are design source for the battle UI, not dead code — deleting them would
  remove the only editable original. They are large enough to be worth moving out of git
  eventually, but that belongs with the 0.7 history decision, not here.
- **`app.js` was deleted** and `express` removed. It was a 20-line static file server whose
  only job Vite now does; leaving it would have left a file importing a removed dependency.
- **`orbit-controls` removed** (imported nowhere) and `depcheck` removed (a one-off analysis
  tool, not a project dependency). **`three` and `cannon-es` moved to devDependencies** —
  they are consumed only by the webpack vendor build, never imported at runtime.
- **`@babel/preset-env` added.** The three webpack vendor configs reference it but it was not
  declared and not installed, so `npm run build` had been broken for some time. The `dist/`
  bundles are committed so nothing depended on it, but the script is now honest.
- **`"type": "module"` set**, so the three webpack configs were renamed to `.cjs`.
- **Vite output goes to `build/`, not `dist/`** — `dist/` already holds the committed UMD
  bundles and Vite empties its `outDir` on every build. `vite.config.mjs` copies `resources/`
  and `dist/` into `build/` verbatim, because ~100 asset paths are hand-written runtime
  strings that no bundler rewrites.

**Verification.** Both the dev server and the production build were smoke-tested in Chromium:
359 territory paths and 205 coastline paths present, menu rendered, the `New Game` button
reaching enabled state (so the full territory-model construction pipeline completes),
`CANNON` / `THREE` / `BufferGeometryUtils` all set, CSS applied, **zero console errors and
zero failed requests** on both.

**Lint baseline recorded: 226 errors, 405 warnings.**

| Rule | Count | |
|---|---:|---|
| `prefer-const` | 375 | warn |
| `no-shadow` | 78 | error — includes audit §5.2 I and M |
| `no-undef` | 69 | error — includes audit §5.1 H and the new §5.1 S |
| `no-useless-assignment` | 32 | error |
| `no-unused-vars` | 29 | warn |
| `no-case-declarations` | 29 | error |
| `no-prototype-builtins` | 18 | error |
| `no-empty` | 1 | warn |

ESLint immediately confirmed audit §5.1 H (`for (country of turnGainsArrayAi)` at
[battle.js:522](../battle.js#L522)) and surfaced one defect the manual audit had missed, now
logged as **audit §5.1 S** — ~60 bare `tooltip` / `uiTable` references in `ui.js` that resolve
only through named window access.

Prettier is configured but every legacy root source is in `.prettierignore` on purpose:
reformatting 18,000 lines in one commit would rewrite every line's blame immediately before a
refactor that depends on blame and bisect. Files come off that list as they move into `src/`.

#### §0.7 — the history rewrite

Executed with `git filter-repo` 2.47.0 and force-pushed to
`origin/master`. **Every commit SHA changed.** `master` went `1231c46` → `184ccbc`.

**The plan's premise was wrong, and measuring corrected it.** The plan said to drop "the 65 MB
zip and the 19 MB JSON blob". Measuring the pack showed:

- The real cost was **eighteen release ZIP snapshots** committed across the project's life
  (`DominationWC0.0.2.zip` through `DominationWC_0.2.5.zip`) — roughly **267 MB of the
  300 MB pack**.
- `resources/closestPathsData.json` was **not** a significant contributor. The 19 MB figure is
  its *uncompressed* size; it packs to 6.4 MB + 2.4 MB across two versions. It is also **live
  at HEAD** — purging it would have broken the game immediately. It was deliberately kept.
  If its history is worth removing, that is a cheap second rewrite *after* Phase 1.3 replaces
  it with the compacted version.

**What was purged** (20 paths, confirmed against a `--dry-run` path diff before executing):

| Paths | Reason |
|---|---|
| 18 × `DominationWC*.zip` | Release build artefacts, none at HEAD |
| `resources/testMap3.svg` (5.8 MB) | Superseded by `svgMaster.svg`, not at HEAD |
| `resources/Blue_Marble_2002.png` (2.8 MB) | Not at HEAD |

**Result: 300.25 MB → 83.55 MB pack (−72%).** A fresh clone from GitHub is 85 MB.

**Six commits were pruned** because their entire content was a purged path and they became
empty: five touched only `resources/testMap3.svg` (`Africa/SAmericaAdded`,
`WorldMapCompleted`, `moreCountriesAddedToSGVMAP`, `svg`, `dfdfd`) and one added only a zip
(`fix to stroke and fill if ending turn while attack pattern is there`). Each was verified
against the backup to contain nothing else. **No code change was lost** — that was checked
explicitly, because a first pass using substring matching appeared to implicate a real commit
and turned out to be a false alarm.

**Verification performed, in order:**

1. `git bundle create --all` → a 194 MB bundle of the complete pre-rewrite history,
   `git bundle verify`'d as "records a complete history" (589 commits, all refs).
2. `stash@{0}` ("On master: temp", touching `index.html`, `style.css`, `ui.js`) exported to a
   patch — the rewrite invalidates stash SHAs.
3. `--dry-run` first; the filtered vs original path sets diffed to confirm exactly 20
   removals and no live file among them.
4. **HEAD tree hash before and after: `f51418db…` — bit-for-bit identical.** The working tree
   content provably did not change.
5. `git fsck` clean; `npm run build`, `format:check`, `test` and the lint baseline unchanged.
6. Browser smoke test (359 paths, 205 coastline paths, menu rendered, `New Game` enabled, all
   UMD globals set, **zero console errors**) — before the push, after the push, and again from
   a **fresh clone of the pushed remote**.

The backup lives in `../_backup-OnlineRiskGame-<timestamp>/` with a `RESTORE.md`. It is the
only copy of the purged blobs now that the remote has been rewritten — **do not delete it
casually**.

**Two things surfaced that were not part of this step:**

- **A fresh clone fails its checkout on Windows unless the destination path is short.**
  `resources/vecteezy_flat-world-map-isolated-on-white-background-vector-illustration_2065080/`
  produces paths up to 123 characters, which breaches `MAX_PATH` when cloned into an already
  deep directory. Pre-existing, unrelated to the rewrite. Fix with
  `git config --system core.longpaths true`, or rename that folder. It is 3rd-party stock-art
  source (`.eps`, `.ai`, a licence PDF) and is **referenced nowhere in the code**.
- **`resources/*.psd` and the vecteezy folder are ~20 MB of design source** still in history
  and at HEAD. They are legitimate assets, not junk, so they were left alone. If the repo
  needs to be smaller still, they are the next candidates — but that is an asset-management
  decision (Git LFS, or an out-of-repo design folder), not a code one.

---

### Phase 1 — Unblock loading and testing (1–2 days) — ✅ **COMPLETE**

**Goal:** cold start in under 3 seconds, and make the game automatable.

| Step | Action | Fixes |
|---|---|---|
| 1.1 | **Load `closestPathsData.json` exactly once** into a `Map<uniqueId, entry>` in `data/adjacency.js`. Replace `readClosestPointsJSON(i)` with a synchronous `getReachableFrom(uniqueId)`. | Audit §4.1 — removes ~6.8 GB of redundant parsing |
| 1.2 | Convert `initialiseGame`'s per-territory `await` loop into a single synchronous pass over the pre-built map. Keep the "loading" progress display, driven by a counter instead of by I/O. | §4.1 |
| 1.3 | Compact the adjacency data. It is 19 MB largely because of full float coordinate pairs. Emitting `uniqueId` + rounded closest-point pairs should land under 2 MB. Ship `tools/build-adjacency.mjs` to regenerate it. | §2.3 |
| 1.4 | Precompute path areas to `data/pathAreas.json` via `tools/precompute-areas.mjs`; fall back to live computation if the SVG changes (checksum guard). Removes 359 × 80 `getPointAtLength` calls per load. | §4.2 |
| 1.5 | Build `uniqueId → territory` and `uniqueId → path` index maps once at load. Replace the ~90 linear-scan lookup loops progressively. | §4.2 |
| 1.6 | **Add a test harness hook.** Behind `?e2e=1`, expose `window.__game = { state, commands, ready }` and a `window.__seedRandom(seed)` that installs a seeded `Math.random` before any module runs. | Prerequisite for [04](./04-e2e-test-plan.md) |
| 1.7 | Kill the three `setTimeout(…, 1000)` dynamic-import hacks by moving the shared state they reach for into `data/` (which imports nothing). `manualAdjacencyExceptions` becomes a plain exported table keyed by **territory name**, resolved to ids lazily. | §3.1 — removes a real race |

**Exit criteria:** cold start < 3 s; no `setTimeout`-gated imports remain; `window.__game` available under `?e2e=1`. — **all met.**

#### What actually happened

Worked test-first: a failing test for each change, then the change.

**Measured result**

| | Before | After |
|---|---:|---:|
| Page load → **New Game** clickable | 1341 ms | **599 ms** |
| **New Game** → turn 1 playable | minutes | **~200–550 ms** |
| Adjacency data fetched | 359 × 19 MB (~6.8 GB parsed) | 1 × 77 KB |
| Territory-area sweep | twice per load (~460 ms) | **zero** — precomputed |
| `setTimeout`-gated imports | 3 | 0 |

`resources/adjacency.json` is 77 KB (99.6 % smaller than the 19 MB source, far past the
"under 2 MB" the plan guessed). `resources/pathAreas.json` is 30 KB.

**Corrections to the plan as written**

- **1.2's "keep the loading progress display" was dropped.** The display existed because the
  loop was slow; the whole pass now takes single-digit milliseconds. The per-territory
  colouring that the loop did as a *side effect* was kept as an explicit second pass —
  removing it silently would have left the map blank, which is what the
  `colours the map rather than leaving it white` spec now guards.
- **1.3 assumed the bloat was float coordinates that needed rounding.** It is not: **no
  consumer reads the coordinates or the distance at all** — every call site touches only
  element `[0]`, the territory name. The compact file therefore carries names only.
- **1.4 mattered less than the poller next to it.** Precomputing areas saved ~230 ms per
  load, but `calculatePathAreasWhenPageLoaded()` was called from two places and each call
  opened its own `setInterval(..., 800)`, so **up to 1.6 s was spent purely idling** and the
  ~230 ms sweep ran twice. Memoising it and replacing the poll with a real readiness promise
  was the larger win. Both are done.
- **1.5's index maps are in place and every `mainGameArray.find(t => t.uniqueId === …)` call
  site now goes through them**, including the one nested inside a loop over all 359 paths
  (~129,000 comparisons per turn). The remaining linear scans use other shapes and come out
  progressively, as the plan intends.

**Defects found and fixed while doing it**

| Defect | Detail |
|---|---|
| Readiness fired before the map existed | `pageLoaded = true` is set at **DOMContentLoaded**, but `paths` is only populated later by `svgMapLoaded()` on **window load**. The 800 ms poll had been accidentally covering the gap. Removing the poll exposed it: `calculatePathAreas()` ran against an empty `paths`, `mainGameArray` came out short, and every later territory lookup returned `undefined`. `whenPageLoaded()` now waits for **both** halves. |
| Guard written one line too late | `addUpAllTerritoryResourcesForCountryAndWriteToTopTable` did `const dataName = territoryData.dataName;` *immediately before* its own `if (territoryData)` check, so a path with no territory threw instead of being skipped. Now a guard clause. |
| Duplicate key in the exceptions table | `"New Caledonia 1"` appeared twice in a `new Map([...])`. The second entry silently overwrote the first, losing its King Island and Fraser Island links. Merged. |
| Temporal dead zone | The memoisation state was declared below the module-level bootstrap block that calls it, so the first call threw `Cannot access 'pathAreasPromise' before initialization`. Hoisted. |

**A correction I made and the tests caught**

`tests/uniqueIdLookup.json` says `"Grand Bahama"` and `"Andros Island"`, but `svgMaster.svg`
says `"Grand Bahama (Bahamas)"` and `"Andros Island (Bahamas)"` — those two entries have
drifted, and they are the only two of 359 that disagree. Building the compact adjacency
against the lookup file quietly failed to strip self for exactly those territories, and made
the (correct) manual adjacency rules for them look like typos. I "fixed" the non-typo, the
new e2e specs failed, and the real fault was found. Both tools now read names from the SVG,
which is what the running game reads, and `tests/uniqueIdLookup.json` has been regenerated
from it. The unit suite asserts that every name in both data files exists in the SVG.

**Known gap deliberately left open**

Seeding `Math.random` globally **cannot** make this game deterministic:
`addSparklesRegularly()` in `ui.js` re-arms a timer every 0–100 ms and burns three
`Math.random()` calls per tick on the same global stream the economy and combat draw from, so
two runs with the same seed diverge. `the same seed produces the same world` is marked
`test.fixme` with that explanation. The fix belongs with **Phase 5**, which introduces an
injected RNG for game logic and leaves cosmetics on the global `Math.random`.
**Until that lands, no test may assert an exact combat or economy outcome across runs.**

**Harness note (see [04-e2e-test-plan.md](./04-e2e-test-plan.md) §3.5)**

The brief asked for up to 8 headless workers. Measured here, **8 is not stable for this
suite**: the run drops from 27/28 to 15/28, with pages failing to finish building the
territory model before assertions run. 4 and 6 are clean; the default is **4**, overridable
with `DWC_WORKERS=8`. Wall-clock budget assertions are skipped unless the run is
single-worker (`npm run test:e2e:perf`), because under four parallel browsers the same page
takes ~2000 ms instead of ~550 ms — contention, not regression.

**Tests added:** 69 unit (Vitest), 30 e2e (Playwright) across `bootstrap` and `adjacency`.
28 pass, 1 skipped by design (single-worker perf), 1 `fixme` (RNG determinism).

---

### Phase 2 — Land the safety net (2–3 days) — ✅ **COMPLETE**

**Goal:** characterisation coverage before anything is moved.

| Step | Action |
|---|---|
| 2.1 | Stand up the Playwright harness exactly as specified in [04-e2e-test-plan.md](./04-e2e-test-plan.md) §3 — config, runner, `--slow`, worker policy, fixtures. |
| 2.2 | Write the **P0 specs** (bootstrap, country-selection, turn-loop, map-interaction). These are the ones every other test depends on. |
| 2.3 | Write **P1 specs** (resources-economy, buy-military, upgrade-territory, transfer, attack, battle). |
| 2.4 | Wire `npm test` → unit + e2e, and add a CI workflow that runs headless × 8 workers. |
| 2.5 | Snapshot current numeric behaviour where it is *wrong but known* — mark those assertions `test.fixme` with a link to the audit item, so Phase 3 flips them green rather than inventing expectations. |

**Exit criteria:** P0 + P1 green (or explicitly `fixme`) on a clean checkout, repeatably, in under 5 minutes. — **met.**

#### What actually happened

**Delivered**

- **2.1** The harness landed in Phase 1 and was completed here: `tests/support/selectors.js`
  (the whole selector inventory in one file, so a Phase 6 rename is a one-file change),
  `tests/support/territories.js` (name ⇄ uniqueId, derived from the SVG), eleven page objects
  under `tests/support/pages/`, and `GameDriver` moved out of `fixtures.js` into
  `tests/support/game.js` and extended with `endBuyPhase` / `endTurn` / `playTurns` /
  `openBuy` / `openUpgrade` / `firstEnemyReachableFrom`.
- **2.2 / 2.3** Eleven functional areas, each with a `README.md` stating what it covers and
  what is deliberately out of scope: `bootstrap`, `country-selection`, `turn-loop`,
  `map-interaction`, `adjacency`, `resources-economy`, `buy-military`, `upgrade-territory`,
  `transfer`, `attack`, `battle`.
- **2.4** `npm test` runs unit then e2e; `.github/workflows/tests.yml` runs the same two
  commands, checks the generated data files are current before either, uploads
  `test-reports/runs/` and pastes the run summary into the job page.
- **2.5** Every known-wrong behaviour is `test.fixme` with its audit item named in the spec,
  and — where it is worth stating out loud — a companion spec that characterises what the
  game does *today* so the suite is not silent about it. Those companions are written to
  **fail when the defect is fixed**, which is the signal to delete them and un-`fixme` the
  real one.

**Six defects the suite found, none of which were in the audit**

Writing the specs was worth more than running them. Full write-ups are in
[01-codebase-audit.md](./01-codebase-audit.md); in order of severity:

| Ref | Defect | Found by |
|---|---|---|
| §5.1 **AA** | The AI turn throws on a shortened goal list and the unhandled rejection **stops `gameLoop()` permanently** — the game freezes on `AI MOVING...` from the second or third turn | `turn-loop/long-run.spec.js` |
| §5.1 **AB** | `doAiActions` **substitutes whole elements** into `mainGameArray`, orphaning the Phase 1.5 territory index; the top table then sums territories the game has already replaced | the per-turn income specs |
| §5.1 **AC** | **Every military purchase is charged twice** — the cost is deducted, then both `checkForMinusAndTransfer…` helpers deduct it again outside the `if (short)` branch they exist for | `buy-military/purchase.spec.js` |
| §5.2 **Z** | The country-selection **strength gate can never fire**: strengths are normalised into 0–10000 and the threshold is 40000, so no country is ever greyed out | `country-selection/greyed-out.spec.js` |
| — | **INVADE! never debits the source territory**; the battle runs on copies and the source is only reconciled when the war resolves | `attack/attack-window.spec.js` |
| — | The **attack marker survives a cancel** by either route, the marker half of the §5.3 map-state desync | `attack/attack-window.spec.js` |

§5.1 AA is the reason **3.1a** was inserted at the top of Phase 3: until the loop survives,
nothing multi-turn can be tested at all.

**Corrections to the plan as written**

- **§5.1 AA makes multi-turn coverage impossible today.** The crash lands as early as the
  second AI phase and the seed does not determine it (the sparkle timer, §5.3 Y). Rather than
  ship specs that flake, **every spec needing more than one full turn is `test.fixme`** with
  the audit reference — including the ten-turn `long-run` spec the e2e plan calls "the single
  highest-value spec in the suite". Single-turn coverage is green and does still guard the
  loop. Phase 3.1a unblocks the rest, and the `fixme`s are the checklist.
- **The `?e2e=1` accessor now scans `mainGameArray` directly instead of using the O(1)
  index.** Because of §5.1 AB the index reports a territory frozen at the moment the AI last
  touched it, which is worse than useless in a characterisation suite. 359 comparisons in a
  test-only accessor cost nothing. This is the only change to shipped code in Phase 2, and it
  changes no game behaviour.
- **Two numbers in [04-e2e-test-plan.md](./04-e2e-test-plan.md) are wrong** and the specs
  follow the code instead: `devIndex` is 0.326–0.962 (§5.1's "0.4–0.95"), and upgrade cost is
  **quadratic** in the running total, so a high-`devIndex` territory pays *more*, not less
  (§5.7). Both are settled properly at Phase 5.1 when the numbers move into
  `config/balance.js`.
- **Six plan specs were deferred, not skipped**, and each folder's README says why. They all
  need the **scenario loader** (e2e plan §3.7, a Phase 4 deliverable) because their setup is
  not reachable by clicking: `starvation`, `resource-borrowing`, `deactivated-source`,
  `siege-offer`, and the battle terminal conditions (`attacker-wins`, `defender-wins`,
  `rout`, `massive-assault`, `fight-again`, `results-screen`). Hoping the live map produces a
  rout is a seed lottery, not a test.
- **Panning is out of scope** in `map-interaction`: Playwright's synthetic mouse does not
  reproduce the browser's drag threshold reliably enough for the assertion to mean anything.
  Revisit when `ui/map/camera.js` exists (6.7) and the pan offset can be read from state.

**Three things the harness had to learn about this UI**

Recorded here because each one will bite again during Phase 6:

- **`xButton` is a duplicated id** — the info panel's close button and the upgrade window's
  both carry it, so a bare `#xButton` is a strict-mode violation the moment both exist. The
  selectors file scopes both.
- **`#tooltip` follows the pointer with no `pointer-events: none`**, so the tooltip raised by
  hovering one row sits on top of the next row's plus button and eats the click. The buy and
  upgrade page objects park the pointer before every stepper interaction.
- **The transfer table's click handler is on the row's NAME column**, not on the row, and the
  attack mode of the same renderer has no row selection at all.

**Tests:** 82 unit (Vitest, ~0.6 s) and **215 e2e** in 36 spec files across 11 areas —
**190 passing, 0 failing, 24 `test.fixme`**, plus the one wall-clock budget spec that skips
outside a single-worker run. Full headless suite at four workers: **2 m 30 s**, or ~6½
minutes including a cold `npm run build`. Both are inside the 5-minute exit criterion for the
suite itself.

---

### Phase 3 — Fix the critical defects (2–3 days) — ✅ **COMPLETE**

**Goal:** make the game *play correctly* before making the code pretty. Each fix is its own
commit with a test that fails before and passes after.

Order matters — these are sequenced by blast radius.

| Order | Audit ref | Fix |
|---|---|---|
| 3.0 | §5.1 AC | Military purchases are charged twice: `addPlayerPurchases` deducts the cost, then both `checkForMinusAndTransfer…` helpers deduct it again outside their `if (short)` branch. Move each trailing deduction inside the branch, or have the helpers transfer only. One-line class of fix, immediately felt by the player. Unblocks `buy-military/purchase.spec.js`. |
| 3.1 | §5.1 A | Upgrade capacity bonuses: apply `+10 %` **per building purchased in this transaction** against the pre-transaction capacity, not the running total. Recompute from `buildingsBuilt` rather than mutating incrementally. |
| 3.1a | §5.1 AA | **Do this first — it is the only defect that stops the game.** `determineResourcesAvailableForThisGoal` reassigns `refinedTurnGoals` from inside a loop indexed against its old length, throws on the last index, and the unhandled rejection kills `gameLoop()` for good. Iterate a snapshot; rebuild the goal list once, at the end. Unblocks `turn-loop/long-run.spec.js`. |
| 3.2 | §5.1 C, B, AB | Hoist `count` out of the AI loops; guard the write-back so `"no match"` is never assigned. Replace the sentinel string with `null` and an explicit `if (!friendly \|\| !enemy) continue;`. **Also stop the write-back substituting whole elements** (`mainGameArray[i] = copy`) — assign the fields, or drop the copy entirely, so the Phase 1.5 territory index cannot be orphaned. §5.1 AB is only fully closed by Phase 4.4. |
| 3.3 | §5.1 E | `unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalDefendingArmy)`. |
| 3.4 | §5.1 D | `return` → `continue` in both siege-per-turn loops; push `true` on a miss. |
| 3.5 | §5.1 F | `territoryPopulation + populationChange` in the starvation simulation. |
| 3.6 | §5.1 G | Initialise `turnGainsArrayAi[countryName]` once per turn, outside the territory loop. |
| 3.7 | §5.1 H | `for (const country of Object.values(turnGainsArrayAi))`. |
| 3.8 | §5.2 I | Rename the inner loop variables (`w`, `k`). ESLint `no-shadow` prevents recurrence. |
| 3.9 | §5.2 J | Move `changeDuringAnySiege` inside the loop, or drop it — process every besieged territory. |
| 3.10 | §5.2 N, O | Fix the `aiTurnsDeactivatedArray[i][0]` index; **splice entries out** once reactivated in both functions. |
| 3.11 | §5.2 L | Clear `proportionsOfAttackArray` at the top of `setupBattle`. |
| 3.12 | §5.2 M | Remove the shadowing `let`. |
| 3.13 | §5.1 P | Fix the `Math.max(...)` parenthesis so area contributes to gold income; re-balance if it swings the economy. |
| 3.14 | §5.1 Q | Rename the event to `"Warehouse Fire"` in the handler (and give it a distinct effect from the oil fire). |
| 3.15 | §5.2 K | Decide the design question: either allow cross-type skirmishes with a matchup matrix, or guarantee at least one skirmish per round so a battle always resolves. **Recommend the matchup matrix** — it makes army composition matter, which currently it barely does. |
| 3.16 | §5.1 R | Re-enable per-turn army maintenance. Expect this to change balance significantly; tune `armyCostPerTurn` against a 20-turn playthrough. |

**Exit criteria:** every `fixme` from 2.5 flipped green; a 20-turn scripted playthrough completes with no console errors and no `NaN` in any territory.

#### What actually happened

Every critical and every high-severity defect in the register is closed, plus five more that
only became **reachable** once the others were fixed. The live status of everything is now in
[05-known-issues.md](./05-known-issues.md), which this section should be read alongside.

**Order mattered more than the plan expected.** 3.1a first, as written — but fixing it did not
make the game survive ten turns, it made the game survive long enough to reach the *next*
crash. Five rounds of that:

| Fixed | What the ten-turn run hit next |
|---|---|
| **AA** — the goal list mutated mid-loop | **AF** — two arrays of different lengths indexed by the same counter |
| **AF** | **AG** — an AI country with no threats in range, and a turn list that rebuilds itself mid-iteration |
| **AG** | **AH** — the shared battle-results screen assuming a battle the *player* started |
| **AH** | **AI** — `querySelector("#siegeImage_Andros_Island_(Bahamas)")`, which is not valid CSS |
| **AI** | **AJ** — starvation driving population and army below zero, and `Math.log10` of a negative turning gold into `NaN` |
| **AJ** | *(ten turns clean; then twenty)* |

**None of AF–AJ was in the audit, and none could have been.** **AA** killed the AI turn before
it got that far, and **B**/**C** meant conquests rarely wrote back to the right slot. Fixing
those let the AI actually take and lose territory — and let sieges, famine and AI attacks on
the player happen at all. Every one of the five was found by the same spec, the ten-turn
`long-run`, which is the clearest possible argument for it existing. All five are written up in
[01-codebase-audit.md](./01-codebase-audit.md).

**AJ is the one to remember.** §5.1 F was a one-character fix — `-` to `+` — and it turned a
branch that had never executed into one that executes routinely, exposing three further faults
behind it. Every defect downstream of a dormant code path is invisible until that path wakes up.

Four of them — **AA**, **C**, **AF**, **AG** — are also the same species: **loop state and loop
subject disagreeing**. Add that to the list of things to look for in every later phase; it is
the most common defect shape in this codebase.

**Three fixes were design decisions, not restorations of intent.** Each was measured before
being chosen, and the reasoning is in [05-known-issues.md](./05-known-issues.md) §4:

- **3.15 (K)** — the cross-type matchup matrix, as the plan recommended. Same-type
  effectiveness is 1, so a conventional battle fights exactly as it always did, and
  `totalSkirmishes` becomes the number of pairings the two armies can make. It is zero only
  when one side is empty, which is a *resolved* battle rather than a stalled one.
- **3.16 (R)** — maintenance re-enabled and re-tuned. The plan predicted a significant balance
  change and it was right: at the original rates Germany owed 396 gold a turn against ~50 of
  income, China 1,384 — every major power bankrupt inside forty turns with no way to respond.
  At a tenth of those rates, holding an army is sustainable and *growing* one is what has to be
  paid for. Territory gold is floored at zero, because nothing in this game models debt.
- **Z** — the country-selection gate is now a **rank**, not a magnitude. Re-scaling `40000`
  would only have moved the guess; measured, the strengths run China 10000, United States 9545,
  India 7965, Indonesia 5697, Russia 4438, then Italy 3504 and a long tail. Five is where the
  superpowers stop.

**Corrections to the plan as written**

- **3.9 (J) needed more than dropping the latch.** `changeDuringAnySiege` was a crude guard
  around a real problem: the siege branch sits inside `for (const path of paths)` and, unlike
  the income branch beside it, never checked *which* path it was looking at. Removing the latch
  alone would have run it 359 times per besieged territory per turn. The branch is now scoped
  by the same path check as its neighbour, which is what makes "every besieged territory, once
  a turn" actually true.
- **3.0 (AC) came out as a deletion, not a move.** The plan offered "move each trailing
  deduction inside the branch, or have the helpers transfer only". Neither was needed: the
  helpers were already correct — borrow if short, then charge — and the *caller* was the one
  charging a second time. Removing the caller's two deductions restores the original design.
- **3.2 (AB) is closed in practice, not structurally.** `Object.assign` into the live element
  preserves identity so the Phase 1.5 index cannot be orphaned, but the underlying problem —
  that the AI works on copies at all — is Phase 4.4's.
- **§5.1 F, §5.1 D, §5.1 E and §5.2 K read correctly in the code but their assertions still
  wait on the scenario loader** (e2e plan §3.7, a Phase 4 deliverable). A rout, a famine, or two
  concurrent sieges are not reachable by clicking, and hoping the live map produces one is a
  seed lottery. The `fixme`s in `battle/known-broken.spec.js` name the loader, not the defect.

**Fallout in the test suite, all of it expected**

- **Three characterisation specs were deleted** — the ones written in Phase 2.5 to fail when
  the defect was fixed. That is exactly what they did: `today: charges double the quoted gold`,
  `today: a fort purchase inflates the food capacity`, and `today: nothing is greyed out`.
  **Ten** `fixme`s were flipped green behind them, and seven more across `turn-loop/` that were
  blocked on AA -- 24 down to 7.
- **Seven spec files changed their fixture country.** They used Alaska — and therefore the
  United States — as "the multi-territory country the player owns", and the United States is
  now above `COUNTRY_GREYOUT_RANK`. They use **Hokkaido (Japan)** instead, which is a better
  fixture anyway: it reaches four other Japanese territories and two enemy ones.
- **The driver had to learn to dismiss a battle results screen.** Since the AI now conquers, it
  also attacks the *player*, so a turn can end with the results screen sitting on top of the
  phase button — and it can land a beat AFTER the turn counter moves, so clearing once is not
  enough. `GameDriver.dismissBlockingPanels()` clears it and `withBlockersCleared()` retries the
  phase click, which costs nothing when the path is clear. The battle UI proper is deliberately
  not dismissed — a spec that finds one open should drive it.
- **`window.__game.countryStrengths()` was added** so a spec can name the selection gate rather
  than hard-coding which countries sit above it. It is the only change to shipped code that
  exists for the tests, and it reads state that was already computed.
- **The pageerror listener now records `error.stack`.** Diagnosing AA took two extra full runs
  purely because the message arrived without a location. The frames are minified, but they carry
  byte offsets that `build/assets/*.js.map` resolves back to a file and line.
- **Two specs were de-flaked.** `bootstrap/page-load`'s "New Game disabled until the model is
  built" was racing a ~600 ms startup from outside the page and passed only when the machine
  happened to be slow; it now samples the button state from inside the page, every 5 ms, from
  before any page script runs. The two multi-turn `start-of-turn-ui` specs were budgeted for one
  turn and now play several, so they get their own timeout. Neither was a Phase 3 regression, but
  a flaky safety net undermines every phase after this one.

**Lint moved in the right direction on its own:** 226 errors / 405 warnings → **214 / 394**,
entirely from the fixes (`no-undef` on the implicit `country` global, `no-shadow` on the
loop variables). No rule was fixed in passing — house rule 6 holds.

**Verification**

| | Result |
|---|---|
| Unit (Vitest) | **82 passing**, unchanged |
| E2E (Playwright, 4 workers headless) | **204 passing, 0 failing, 8 skipped** — 7 `test.fixme` and the single-worker perf spec — in **5–9 min** depending on how much of the world the AI conquers |
| `test.fixme` before Phase 3 | 24 |
| `test.fixme` after | **7** — two on **AD**/**AE** (Phase 4.7 / 6.7), four in `battle/known-broken` waiting on the scenario loader, one on **Y** (Phase 5) |
| 20-turn scripted playthrough | **completes**, zero page errors, zero console errors, **no non-finite number in any of the 359 territories** |
| Lint | 226 errors / 405 warnings → **214 / 394** |

The 20-turn run is the plan's stated exit criterion and it is met. The ten-turn version of it
now lives in the suite as `turn-loop/long-run.spec.js`, un-`fixme`d.

**Left for later, deliberately**

- **AD** (INVADE! does not debit the source) — Phase 4.7. There is no single source to debit
  until war objects hold a territory id instead of a copy.
- **AE** (the attack marker survives a cancel) — Phase 6.7, which removes the class of bug.
- **Unpaid upkeep has no consequence.** With maintenance live, a broke territory keeps its army
  for free. Desertion is a design decision and belongs in Phase 7.
- **`updateArrayOfLeadersAndCountries()` still rebuilds mid-turn**, so the AI's view of who owns
  what can be stale by up to one conquest. Phase 3 stopped that *crashing*; one source of truth
  (Phase 4) is what stops it being stale.

**Two design problems Phase 3 made visible** — see
[05-known-issues.md](./05-known-issues.md) §6. Neither is a defect to patch, and both are
Phase 7 work, but they are what a player will feel first:

- **The AI besieges far more than it can finish.** Over 14 turns, concurrent AI sieges went
  17 → 67. Sieges end only on an arrest or a conquest, and 206 independent countries each
  evaluating every reachable enemy launch them far faster than they resolve. This is exactly
  what **7.7** (consolidate the countries into 8–16 powers) and **7.8** (long-term goals) are
  for.
- **A besieged territory earns nothing and can stay besieged indefinitely.** The player was
  besieged on turn 3 of that run and still besieged on turn 14, gold frozen throughout. The
  suspension is not a considered rule: the gold, oil and construction-material lines in the
  siege branch are commented out under *"uncomment other features if decided to involve them in
  sieges"*. It is a placeholder nobody had reached, because §5.1 D and §5.2 J meant at most one
  siege was processed per turn.

---

### Phase 4 — Extract the state layer (3–4 days) — ✅ **COMPLETE**

**Goal:** one source of truth. This is the change everything else depends on.

| Step | Action |
|---|---|
| 4.1 | Create `state/GameState.js` holding `territories` (a `Map`), `players`, `turn`, `phase`, `wars`, `sieges`. Seed it from the existing construction path — **do not rewrite the construction logic yet**. |
| 4.2 | Add `state/selectors.js` (pure reads) and `state/mutations.js` (the only writer). Add a dev-mode `Object.freeze` / proxy trap that throws on direct writes from outside `mutations.js`. |
| 4.3 | Add `state/events.js` — a 30-line emitter. `mutations.js` emits `territoryChanged`, `turnChanged`, `phaseChanged`, `warChanged`. |
| 4.4 | **Invert the SVG relationship.** Migrate, attribute by attribute, from "the path is the truth" to "the path renders the truth": `owner`, `data-name`, `underSiege`, `deactivated`, `greyedOut`, `attackableTerritory`. Keep writing the attributes during migration (tests still assert on them), but read only from state. |
| 4.5 | Delete `normalizeSiegeState()` — it becomes structurally impossible for the siege lists and the map to disagree. |
| 4.6 | Collapse `turnPhase` / `currentTurnPhase` into `GameState.phase` with a `Phase` enum. |
| 4.7 | Make siege/war objects hold a **territory id**, not a territory copy. Delete every manual sync-back (`setMainArrayToArmyRemaining` and friends). |
| 4.8 | Remove every `export let` of game state; export functions instead. |

**Exit criteria:** `mainGameArray` no longer exists; no game state is read from a DOM attribute; e2e suite still green.

#### What Phase 4 actually did

**The store**

| File | What it holds |
|---|---|
| `src/state/GameState.js` | the store: `territories` (a `Map` plus a `defenseBonus`-ordered view), `players`, `turn`, `phase`, `wars`, `sieges`, and the selection sets. Imports nothing. |
| `src/state/selectors.js` | every read. No DOM, no writes, loads in Node. |
| `src/state/mutations.js` | every write. Opens the guard window, changes the store, emits. |
| `src/state/events.js` | the emitter: `territoryChanged`, `turnChanged`, `phaseChanged`, `warChanged`, `siegeChanged`, `selectionChanged`. |
| `src/state/phases.js` | the `Phase` enum and its transitions. |
| `src/state/sieges.js` | `referenceDefendingTerritory()` — a siege stores an id and resolves the territory live. |
| `src/state/pathState.js` | ask the store about the territory a path draws, for the UI code that still holds path elements. |
| `src/ui/mapAttributeSync.js` | the only writer of the six rendered attributes, driven by events. |
| `src/ui/siegeOverlay.js` | the siege markers, likewise. |
| `src/platform/scenarios.js` | the scenario loader (e2e plan 3.7), a Phase 4 deliverable because it needs a single state layer to write through. |

**`mainGameArray` is gone.** All 372 references now go through `allTerritories()`,
`getTerritory()` or `getTerritoryByName()`. It was an `export let` that any of seven files
could reassign; the construction path builds a local array and hands it to
`seedTerritories()`, which is the one place the store is filled.

**The SVG relationship is inverted.** `owner`, `data-name`, `deactivated`, `underSiege`,
`greyedOut` and `attackableTerritory` are still written — the e2e suite asserts on them —
but only by `mapAttributeSync.js`, and nothing reads them back. `tests/e2e/bootstrap/state-layer.spec.js`
compares the map against the model directly and fails if they ever disagree.

**`normalizeSiegeState()` is deleted.** `underSiege` is derived from the siege lists, so
there is nothing to reconcile. The orphan check it also did — a siege naming a territory
the map does not have — survives as `pruneSiegesForMissingTerritories()`, called once at
game start rather than every turn.

**Three phase counters became one.** `currentTurnPhase` in `gameTurnsLoop.js`, `turnPhase`
in `ui.js` (which ran one step ahead of it) and the bare `0`/`1`/`2` comparisons scattered
through both are now `GameState.phase` and the `Phase` enum. `modifyCurrentTurnPhase()` is
gone.

**Sieges hold a territory id.** `referenceDefendingTerritory()` gives a siege a
`defendingTerritoryId` and a live `defendingTerritory` getter, so the sixty-odd
`siege.defendingTerritory.something` readers are unchanged but now read and write the real
territory. Every manual sync-back went with it: `setMainArrayToArmyRemaining()` (now
`applySiegeSurvivorsToTerritory()`, one write instead of four) and the four buildings
copy-back loops in `battle.js`.

**`export let` game state is gone** for everything that is world state: `mainGameArray`,
`currentTurn`, `currentTurnPhase`, `playerCountry`, `playerColour`, `flag`,
`playerSiegeWarsList`, `aiSiegeWarsList`, `historicWars`, `historicAiWars` and the four war-id
counters. Six more that were never actually reassigned became `const`.

**The write guard** (`?stateGuard=1`) proxies every territory and records writes that
bypass `mutations.js`; `?stateGuard=strict` throws. It is **off by default and diagnostic,
not a wall** — Phase 5 is what converts the economy and combat rules into pure functions
that return deltas, and until then a great many callers legitimately still hold a territory
and assign to it. `window.__game.stateGuardViolations()` reports what it caught.

**Defects closed on the way**

| Ref | Defect |
|---|---|
| **AD** | **INVADE! never debited the source territory.** The battle ran on copies, so a garrison could be committed to two attacks in one turn and a failed attack cost nothing. Now debited at INVADE!; the army returns through `retrievalArray` on a no-penalty retreat, which had to be made unconditional for the round trip to balance. `attack/attack-window.spec.js` is un-`fixme`d. |
| — | `transferArmyOutOfTerritoryOnStartingInvasion()` computed `armyForCurrentTerritory -= (sum of what remains)`, subtracting the garrison a second time. It is the sum of the units, so it is an assignment. Only reachable now that the debit actually runs. |
| — | `deactivateTerritoryAi()` was called with a **territory** by the AI and with an **SVG path** by `handleWarEndingsAndOptions()`. A path has no `uniqueId` property, so every AI conquest of a player territory pushed `[undefined, n, 0]` and deactivated nothing. |
| — | `setCountryNameOnPath()` wrote `territory.owner` into `data-name`, the *current owner* attribute. Correct only because an AI country name happens to be both. Deleted. |
| — | `setMainArrayToArmyRemaining()` read the siege to write back from `getSiegeObjectFromPath(lastClickedPath)` — a different siege from the one passed in. |
| — | The AI siege log printed `undefined's attacking troops`: `attackingTerritory` is a name string, not an object. |
| **AL** | **A siege arrest set a territory's army to `NaN`, permanently.** A misplaced bracket: `defendingArmyRemaining[1 + Math.floor(...)]` where the three sibling lines read `defendingArmyRemaining[n] + Math.floor(...)`. Any arrest against an attacker with two or more assault units assigned `undefined`. Found on turn 10 of the ten-turn `long-run`, once **AK** stopped it failing on turn 2. |
| **AK** | **A siege set `foodCapacity` to `NaN`, permanently.** `collateralDamage` was left `undefined` when the destroy roll succeeded and the score difference was under 50. The `NaN` had always been computed; it landed on the siege's copy of the territory and the copy-back carried only the building counts, so the world never saw it. Removing the copy made a long-standing bug fail on turn 2 of the ten-turn `long-run`. |

**What the guard reports today**, which is Phase 5's inventory. Six turns as Germany under
`?e2e=1&stateGuard=1`: **21,285** direct writes, zero page errors, zero console errors. By
field, largest first:

| Field | Writes | Owner |
|---|---:|---|
| `goldForCurrentTerritory`, `oilForCurrentTerritory`, `foodForCurrentTerritory`, `consMatsForCurrentTerritory`, `territoryPopulation`, `productiveTerritoryPop`, `foodConsumption`, `oilDemand` | the bulk | 5.2 — `rules/economy/*` returns deltas |
| `fortsBuilt`, `defenseBonus` | 424 each | 5.1/5.2 |
| `countryColor`, `leader` | 359 each | 5.5 — set once, by `cpuPlayerGenerationAndLoading` |
| `useableAssault`, `useableAir`, `useableNaval` | 250 each | 5.2 — oil gating |
| `assaultForCurrentTerritory`, `navalForCurrentTerritory`, `airForCurrentTerritory`, `infantryForCurrentTerritory` | 106–165 each | 5.3 — `resolveRound()` |
| `farmsBuilt`, `forestsBuilt`, `oilWellsBuilt`, `foodCapacity` | 66–81 each | 5.2 |

The guard goes to strict once 5.2 and 5.3 are done, and that is the real end of "state lives
in three places at once".

**The scenario loader** (e2e plan 3.7) shipped with the phase, because it is only safe once
there is one place to write state. Scenarios in `tests/support/scenarios/*.json` are applied
through `mutations.js`, so a scenario cannot produce a world the game could not have produced.
It un-`fixme`d three of the four `battle/known-broken` specs: the naval-only defender (5.2 K),
two concurrent sieges (5.1 D), and the INVADE!-debit / retreat-return round trip (5.1 AD). The
fourth — the rout threshold (5.1 E) — needs the injected RNG from 5.3, because a rout is a
random outcome even given a hopeless defender.

**The one regression the phase introduced**, fixed before it closed and worth carrying into
Phase 6. `colorCountriesRandomly()` runs during bootstrap — after `svgMapLoaded()` populates
`paths`, before `seedTerritories()` fills the store — and converting its `data-name` read to a
store read returned `null` for all 359 paths. They grouped into one country and the map came
out a single flat colour, with every `countryColor` wrong thereafter. `state/pathState.js`
reads the attribute while `territoriesReady()` is false and the store afterwards; the boundary
is readiness, not "the lookup returned null", so a missing territory after seeding still
surfaces. **Any Phase 6 component that reads territory state during bootstrap has the same
constraint.** The suite had 225 specs and none of them noticed the map go flat, because they
all assert on state and text — `bootstrap/state-layer.spec.js` now asserts the colouring too.

**Left for Phase 5, deliberately**

- **`battle.js` still has ~25 `export let`s** of per-battle scratch (`currentRound`,
  `attackingArmyRemaining`, `combinedForceAttack`, …). These are not world state; they are the
  working set of a battle, and 5.3 removes them by making `resolveRound()` pure. Converting
  them to accessors now would be churn with no structural gain.
- **The resource caches** (`capacityArray`, `demandArray`, `turnGains*`, `countryStrengthsArray`)
  belong to 5.2, which turns the economy into `(territory, context) → deltas`.
- **The write guard stays in warn mode** until those two are done. Every direct write it
  reports is a Phase 5 to-do.

---

### Phase 5 — Extract pure rules (4–5 days)

**Goal:** every rule runs in Node.

| Step | Action |
|---|---|
| 5.1 | Move all tunable numbers into `config/balance.js`. Every magic number in the audit §5.4 list gets a name. |
| 5.2 | Extract `rules/economy/*` from `resourceCalculations.js` as pure functions: `(territory, context) → deltas`. No DOM, no writes — callers apply the deltas via `mutations.js`. |
| 5.3 | Extract `rules/military/*` from `battle.js`. `resolveRound(attackers, defenders, ctx) → { attackers, defenders, outcome }` — pure, deterministic given an injected RNG. |
| 5.4 | Extract `rules/military/siege.js`: `tickSiege(siege, ctx, rng) → SiegeTickResult`. |
| 5.5 | Split `ai/` out of `aiCalculations.js` along the existing seams (threat → goals → actions), injecting the seeded RNG rather than reaching for a module global. |
| 5.6 | Write **unit tests** (Vitest) for every extracted rule. This is where the numeric coverage lives; e2e stays behavioural. Target: every function in `rules/` has a test. |
| 5.7 | Replace `gameLoop()`'s infinite recursion with `engine/TurnEngine.js` — an explicit state machine with `start()`, `advancePhase()`, `stop()`, `reset()`. This is what makes "New Game" and "Restart" possible. |

**Exit criteria:** `rules/` and `ai/` import nothing from `ui/`; unit suite covers economy, battle, siege, AI scoring; e2e still green.

---

### Phase 6 — Decompose the UI (5–7 days)

**Goal:** kill the 2,300-line `DOMContentLoaded` block.

| Step | Action |
|---|---|
| 6.1 | Create `ui/core/registry.js` — every element id and selector as a named constant, **imported by both the app and the e2e page objects**. Selector drift then becomes a compile error rather than a flaky test. |
| 6.2 | Add `ui/core/dom.js`: `el(tag, props, children)`, `mount()`, `on()`. Replaces the `createElement` + 15 property assignments pattern (294 occurrences). |
| 6.3 | Extract components one at a time from the `DOMContentLoaded` block, easiest first: `Tooltip` → `TopTable` → `BottomTable` → `PhaseBar` → `MainMenu` → `CountrySelect` → `MoveButton` → `AiDialogue` → `BattleResults` → `BattleUI` → `InfoTable` → `BuyWindow` → `UpgradeWindow` → `TransferAttackWindow`. Each becomes `create()` + `update(state)` + `destroy()`, subscribing to `state/events.js`. |
| 6.4 | Break up `drawUITable` (920 lines / 4 modes) into `InfoTable` + one renderer per tab, sharing a column-definition table instead of a repeated 16-case `switch`. |
| 6.5 | Break up `drawAndHandleTransferAttackTable` (710 lines / 2 modes) into `TransferTable` and `AttackTable` over a shared `ArmyAllocationRow`. |
| 6.6 | Break up `handleMovePhaseTransferAttackButton` into a declarative state machine: `deriveMoveButtonState(state, selection) → { label, variant, enabled, action }`. The nested click handler and the `setTimeout(…, 200)` debounce both disappear. |
| 6.7 | Extract `ui/map/*`: `MapView` (render state → SVG), `colouring`, `camera` (zoom/pan), `markers`. Delete the `currentMapColorAndStrokeArray` save/restore machinery — colour becomes a pure function of state. |
| 6.8 | Move inline JS styling into `style.css` (or split CSS per component). Replace numeric ids (`battleUIRow4Col2A`…`H`) with semantic ones and `data-testid` attributes. |

**Exit criteria:** `ui.js` no longer exists; no file over 400 lines; the map renders purely from state.

---

### Phase 7 — Close the game-design gaps (3–5 days)

**Goal:** make it a finishable game. Ordered by player-felt impact
(cross-reference [02-game-design-document.md](./02-game-design-document.md) §11).

| Step | Feature | Notes |
|---|---|---|
| 7.1 | **Win / lose conditions** (`rules/victory.js`) | Check after each turn: total conquest, player elimination, and a configurable objective (N territories / a continent / turn limit). Add a victory/defeat screen. |
| 7.2 | **New game / restart** | Now trivial given `TurnEngine.reset()`. |
| 7.3 | **Save / load** (`platform/storage.js`) | `GameState` is now a plain serialisable object. Autosave each turn to `localStorage`, plus export/import JSON. |
| 7.4 | **AI activity feed** | The single biggest "feel" gap. Surface AI conquests, sieges and declarations in a turn-summary panel instead of `console.log`. |
| 7.5 | **Continent control bonuses** | Continents already exist as data; give holding one a real reward. |
| 7.6 | **Help / tutorial** | Wire the inert Help button. Oil demand, useable units and sieges all need in-game explanation. |
| 7.7 | **Consolidate AI powers** | Reduce 206 independent AI countries to 8–16 *powers* owning multiple countries (GDD §12.1). Makes the AI turn fast, the world legible, and diplomacy possible. |
| 7.8 | **Long-term AI goals** | The TODOs in `gameTurnsLoop.js`, now implementable against `ai/goals.js`. |
| 7.9 | **Re-enable or remove the 3D dice** | Decide. If keeping, wire it into `BattleUI` behind a setting; if not, delete `dices.js` and the three `dist/` bundles and drop `three` + `cannon-es`. |

---

## 3. Effort summary

| Phase | Focus | Estimate | Gate |
|---|---|---:|---|
| 0 | Tooling & hygiene | 0.5 d | `npm run dev` works |
| 1 | Load performance & test hooks | 1–2 d | Cold start < 3 s |
| 2 | E2E safety net | 2–3 d | P0+P1 green |
| 3 | Critical defect fixes | 2–3 d | 20-turn playthrough clean |
| 4 | Single state layer | 3–4 d | ✅ `mainGameArray` gone |
| 5 | Pure rules + engine | 4–5 d | `rules/` runs in Node |
| 6 | UI decomposition | 5–7 d | No file > 400 lines |
| 7 | Design gaps | 3–5 d | Game is finishable |

**Total: roughly 4–6 focused weeks.** Phases 0–3 (≈1.5 weeks) deliver most of the *felt*
improvement — the game becomes fast, correct and testable. Phases 4–6 are what make it
extensible. Phase 7 is where it becomes a game rather than a simulation.

---

## 4. Risks and how they are handled

| Risk | Mitigation |
|---|---|
| Fixing §5.1 A (compounding capacities) and §5.1 R (maintenance) will change the economy dramatically | Do them in Phase 3 with a scripted 20-turn playthrough as the yardstick; expect and budget for a balance pass. |
| The e2e suite ossifies broken behaviour | Phase 2 step 2.5: known-wrong expectations are marked `fixme` with an audit link, never asserted as correct. |
| Phase 4 (state extraction) is the highest-risk step | Migrate attribute by attribute, keep writing SVG attributes throughout, and lean on the Phase 2 suite. Do not combine with Phase 6. |
| The git history rewrite (0.7) breaks other clones | Optional and clearly flagged. If in doubt, skip it — a 300 MB pack is annoying, not blocking. |
| Scope creep from GDD §11 into earlier phases | Feature work is fenced into Phase 7. The only exception is victory conditions, because without them a full playthrough cannot be tested. |

---

## 5. Immediate next three actions

1. **Phase 5.1** — move the tunable numbers into `config/balance.js`. No behavioural risk, and
   every later rule extraction wants them named.
2. **Phase 5.2** — `rules/economy/*` as `(territory, context) → deltas`, applied through
   `mutations.js`. This is what lets the write guard go from warn to strict.
3. **Phase 5.3–5.4** — `rules/military/*` with an injected RNG, which is also what finally
   makes a combat outcome assertable in a test (see the seeding gotcha in `CLAUDE.md`).
