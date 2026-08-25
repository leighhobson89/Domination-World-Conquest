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

| Step | Action | Fixes | Status |
|---|---|---|---|
| 1.1 | **Load `closestPathsData.json` exactly once** into a `Map<uniqueId, entry>` in `data/adjacency.js`. Replace `readClosestPointsJSON(i)` with a synchronous `getReachableFrom(uniqueId)`. | Audit §4.1 — removes ~6.8 GB of redundant parsing | ✅ |
| 1.2 | Convert `initialiseGame`'s per-territory `await` loop into a single synchronous pass over the pre-built map. Keep the "loading" progress display, driven by a counter instead of by I/O. | §4.1 | ✅ |
| 1.3 | Compact the adjacency data. It is 19 MB largely because of full float coordinate pairs. Emitting `uniqueId` + rounded closest-point pairs should land under 2 MB. Ship `tools/build-adjacency.mjs` to regenerate it. | §2.3 | ✅ |
| 1.4 | Precompute path areas to `data/pathAreas.json` via `tools/precompute-areas.mjs`; fall back to live computation if the SVG changes (checksum guard). Removes 359 × 80 `getPointAtLength` calls per load. | §4.2 | ✅ |
| 1.5 | Build `uniqueId → territory` and `uniqueId → path` index maps once at load. Replace the ~90 linear-scan lookup loops progressively. | §4.2 | ✅ |
| 1.6 | **Add a test harness hook.** Behind `?e2e=1`, expose `window.__game = { state, commands, ready }` and a `window.__seedRandom(seed)` that installs a seeded `Math.random` before any module runs. | Prerequisite for [04](./04-e2e-test-plan.md) | ✅ |
| 1.7 | Kill the three `setTimeout(…, 1000)` dynamic-import hacks by moving the shared state they reach for into `data/` (which imports nothing). `manualAdjacencyExceptions` becomes a plain exported table keyed by **territory name**, resolved to ids lazily. | §3.1 — removes a real race | ✅ |

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

| Step | Action | Status |
|---|---|---|
| 2.1 | Stand up the Playwright harness exactly as specified in [04-e2e-test-plan.md](./04-e2e-test-plan.md) §3 — config, runner, `--slow`, worker policy, fixtures. | ✅ |
| 2.2 | Write the **P0 specs** (bootstrap, country-selection, turn-loop, map-interaction). These are the ones every other test depends on. | ✅ |
| 2.3 | Write **P1 specs** (resources-economy, buy-military, upgrade-territory, transfer, attack, battle). | ✅ |
| 2.4 | Wire `npm test` → unit + e2e, and add a CI workflow that runs headless × 8 workers. | ✅ |
| 2.5 | Snapshot current numeric behaviour where it is *wrong but known* — mark those assertions `test.fixme` with a link to the audit item, so Phase 3 flips them green rather than inventing expectations. | ✅ |

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

| Order | Audit ref | Fix | Status |
|---|---|---|---|
| 3.0 | §5.1 AC | Military purchases are charged twice: `addPlayerPurchases` deducts the cost, then both `checkForMinusAndTransfer…` helpers deduct it again outside their `if (short)` branch. Move each trailing deduction inside the branch, or have the helpers transfer only. One-line class of fix, immediately felt by the player. Unblocks `buy-military/purchase.spec.js`. | ✅ |
| 3.1 | §5.1 A | Upgrade capacity bonuses: apply `+10 %` **per building purchased in this transaction** against the pre-transaction capacity, not the running total. Recompute from `buildingsBuilt` rather than mutating incrementally. | ✅ |
| 3.1a | §5.1 AA | **Do this first — it is the only defect that stops the game.** `determineResourcesAvailableForThisGoal` reassigns `refinedTurnGoals` from inside a loop indexed against its old length, throws on the last index, and the unhandled rejection kills `gameLoop()` for good. Iterate a snapshot; rebuild the goal list once, at the end. Unblocks `turn-loop/long-run.spec.js`. | ✅ |
| 3.2 | §5.1 C, B, AB | Hoist `count` out of the AI loops; guard the write-back so `"no match"` is never assigned. Replace the sentinel string with `null` and an explicit `if (!friendly \|\| !enemy) continue;`. **Also stop the write-back substituting whole elements** (`mainGameArray[i] = copy`) — assign the fields, or drop the copy entirely, so the Phase 1.5 territory index cannot be orphaned. §5.1 AB is only fully closed by Phase 4.4. | ✅ |
| 3.3 | §5.1 E | `unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalDefendingArmy)`. | ✅ |
| 3.4 | §5.1 D | `return` → `continue` in both siege-per-turn loops; push `true` on a miss. | ✅ |
| 3.5 | §5.1 F | `territoryPopulation + populationChange` in the starvation simulation. | ✅ |
| 3.6 | §5.1 G | Initialise `turnGainsArrayAi[countryName]` once per turn, outside the territory loop. | ✅ |
| 3.7 | §5.1 H | `for (const country of Object.values(turnGainsArrayAi))`. | ✅ |
| 3.8 | §5.2 I | Rename the inner loop variables (`w`, `k`). ESLint `no-shadow` prevents recurrence. | ✅ |
| 3.9 | §5.2 J | Move `changeDuringAnySiege` inside the loop, or drop it — process every besieged territory. | ✅ |
| 3.10 | §5.2 N, O | Fix the `aiTurnsDeactivatedArray[i][0]` index; **splice entries out** once reactivated in both functions. | ✅ |
| 3.11 | §5.2 L | Clear `proportionsOfAttackArray` at the top of `setupBattle`. | ✅ |
| 3.12 | §5.2 M | Remove the shadowing `let`. | ✅ |
| 3.13 | §5.1 P | Fix the `Math.max(...)` parenthesis so area contributes to gold income; re-balance if it swings the economy. | ✅ |
| 3.14 | §5.1 Q | Rename the event to `"Warehouse Fire"` in the handler (and give it a distinct effect from the oil fire). | ✅ |
| 3.15 | §5.2 K | Decide the design question: either allow cross-type skirmishes with a matchup matrix, or guarantee at least one skirmish per round so a battle always resolves. **Recommend the matchup matrix** — it makes army composition matter, which currently it barely does. | ✅ |
| 3.16 | §5.1 R | Re-enable per-turn army maintenance. Expect this to change balance significantly; tune `armyCostPerTurn` against a 20-turn playthrough. | ✅ |

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

| Step | Action | Status |
|---|---|---|
| 4.1 | Create `state/GameState.js` holding `territories` (a `Map`), `players`, `turn`, `phase`, `wars`, `sieges`. Seed it from the existing construction path — **do not rewrite the construction logic yet**. | ✅ |
| 4.2 | Add `state/selectors.js` (pure reads) and `state/mutations.js` (the only writer). Add a dev-mode `Object.freeze` / proxy trap that throws on direct writes from outside `mutations.js`. | ✅ |
| 4.3 | Add `state/events.js` — a 30-line emitter. `mutations.js` emits `territoryChanged`, `turnChanged`, `phaseChanged`, `warChanged`. | ✅ |
| 4.4 | **Invert the SVG relationship.** Migrate, attribute by attribute, from "the path is the truth" to "the path renders the truth": `owner`, `data-name`, `underSiege`, `deactivated`, `greyedOut`, `attackableTerritory`. Keep writing the attributes during migration (tests still assert on them), but read only from state. | ✅ |
| 4.5 | Delete `normalizeSiegeState()` — it becomes structurally impossible for the siege lists and the map to disagree. | ✅ |
| 4.6 | Collapse `turnPhase` / `currentTurnPhase` into `GameState.phase` with a `Phase` enum. | ✅ |
| 4.7 | Make siege/war objects hold a **territory id**, not a territory copy. Delete every manual sync-back (`setMainArrayToArmyRemaining` and friends). | ✅ |
| 4.8 | Remove every `export let` of game state; export functions instead. | ✅ |

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

### Phase 5 — Extract pure rules (4–5 days) — ✅ **COMPLETE**

**Goal:** every rule runs in Node.

| Step | Action | Status |
|---|---|---|
| 5.1 | Move all tunable numbers into `config/balance.js`. Every magic number in the audit §5.4 list gets a name. | ✅ |
| 5.2 | Extract `rules/economy/*` from `resourceCalculations.js` as pure functions: `(territory, context) → deltas`. No DOM, no writes — callers apply the deltas via `mutations.js`. | ✅ |
| 5.3 | Extract `rules/military/*` from `battle.js`. `resolveRound(attackers, defenders, ctx) → { attackers, defenders, outcome }` — pure, deterministic given an injected RNG. | ✅ |
| 5.4 | Extract `rules/military/siege.js`: `tickSiege(siege, ctx, rng) → SiegeTickResult`. | ✅ |
| 5.5 | Split `ai/` out of `aiCalculations.js` along the existing seams (threat → goals → actions), injecting the seeded RNG rather than reaching for a module global. | ✅ |
| 5.6 | Write **unit tests** (Vitest) for every extracted rule. This is where the numeric coverage lives; e2e stays behavioural. Target: every function in `rules/` has a test. | ✅ |
| 5.7 | Replace `gameLoop()`'s infinite recursion with `engine/TurnEngine.js` — an explicit state machine with `start()`, `advancePhase()`, `stop()`, `reset()`. This is what makes "New Game" and "Restart" possible. | ✅ |
| 5.8 | **Close the phase.** Take cosmetic randomness off the game RNG stream so ?seed= genuinely repeats (audit 5.3 Y), retire the last reachable test.fixme, and clear the defects that closing the RNG made visible. Added after the fact: 5.1-5.7 met the phase exit criteria but left its fixme list unfinished. | ✅ |

**Exit criteria:** `rules/` and `ai/` import nothing from `ui/`; unit suite covers economy, battle, siege, AI scoring; e2e still green. ✅

---

### Phase 5 — what actually landed

**Every rule runs in Node.** The thirteen modules under `src/rules/`, `src/ai/` and
`src/engine/` import from `config/` and `state/selectors.js` and from nothing else. Each one
was also imported into a bare Node process to check it, because "no `ui/` in the import list"
and "actually loads without a DOM" are not the same claim.

**5.4 — `rules/military/siege.js`.** `tickSiege(siege, rng)` reads a siege and returns what
happened; it writes nothing. The caller turns that into a patch with `siegeDamageDeltas()`
and applies it through `mutations.js`. Every probability in a siege turn is a band on ONE
number — the siege score minus the territory's forts and mountains — and naming that
(`scoreDifferenceFor()`) is most of what made the module legible.

`calculatePlayerInitiatedSiegePerTurn()` and `calculateAiInitiatedSiegePerTurn()` were two
copies of the same fifty lines, differing only in which list they walked and what they logged.
They are one `runSiegeTurnFor(side)`. `changeDefendingTerritoryStatsBasedOnSiege()`'s four
near-identical if/else blocks are a loop over `SIEGE_TARGETS`. And the four hand-written lines
that built an arrested garrison — one of which indexed a four-element array by half the
attacker's assault count and set the territory's army to `NaN` for the rest of the game
(defect AL) — are `arrestGarrisonFor()`, which computes the total from its own four counts so
the total cannot disagree with its parts.

The RNG draw order and draw COUNT are preserved exactly: collateral roll first, then the
destroy roll, then the destruction rolls. That is what the stream has always seen.

**5.5 — `src/ai/{rng,threat,goals}.js`.** The seeded per-country stream, the threat scoring,
and the goal pipeline. `goals.js` takes its two impure dependencies as ARGUMENTS rather than
importing them — the seeded rng, and `calculateProbabilityPreBattle` (which lives in
`battle.js` and caches modifiers for a mid-battle recalculation, a side effect a planner has
no business knowing about). That injection is the whole reason the module could leave: without
it, `goals.js` imports `battle.js`, which imports `ui.js`.

`PROBABILITY_THRESHOLD_FOR_SIEGE` moved from `ui.js` to `config/balance.js` for the same
reason. It is a balance number that happened to be declared in the UI, and it was the other
thing tying the planner to the DOM.

**What did NOT move, and why.** `doAiActions()` and the action executors stay in
`aiCalculations.js`. They open dialogue boxes, repaint the map and add siege images — they are
inseparable from the UI until Phase 6 decomposes it, and moving them under `src/ai/` would
have dragged `ui.js` into the very folder the phase exists to keep clean. The plan's
`ai/actions/*` and `ai/diplomacy.js` are a **Phase 6** deliverable, once there is a component
to talk to instead of a `getElementById`.

**5.6 — 288 unit tests, up from 168.** Every function in `rules/` has one. The numeric
coverage lives here and e2e stays behavioural, which is the split the plan asked for. Several
tests are named for the defect they pin (`audit 5.2 AJ`, `audit 5.1 E`, `audit 5.2 Q`,
`defect AL`), and three assert behaviour that is known to be WRONG — the exact-match famine
wiping out a fleet (**AN**), the round of threshold lag (**AP**), the inverted area bonus
(**AR**) — so that correcting them in the Phase 7 balance pass is a deliberate act with a
failing test, not a silent drift.

**5.7 — `engine/TurnEngine.js`.** `gameLoop()` ran the start-of-turn block and then chained
three promises, the last of which called itself. Three things were wrong with that:

- **Nothing could stop it.** Nothing held a reference to the loop. A new game meant a reload.
- **There was no `catch` anywhere in the chain.** A throw inside the AI turn escaped as an
  unhandled rejection and the loop simply never continued — the phase button stuck on
  `AI MOVING...` and the game was over, permanently, with nothing surfaced to the player.
  Phase 3 fixed five crashes that all presented exactly this way.
- **"Wait for the player" was three near-identical private functions**, each wrapping a
  `#popup-confirm` listener in a Promise.

The engine is a sequencer and knows nothing about this game: `beginTurn`, then each step in
order, then `endTurn`, and round again until told to stop. Gated steps wait on a gate that
`advancePhase()` opens — one persistent listener now, not three transient ones. A step that
throws is reported through `onError` and the turn continues without it: one lost turn instead
of a dead game.

**That change paid for itself on its first run.** The very first `turn-loop` run against the
engine surfaced known-issue **AM** — `getHistoricWarObject()` returning the *string*
`"Error - Siege not found..."` and `removeSiegeImageFromPath()` dereferencing it. It had been
logged as "observed once and not reproducible on re-run", because under the old loop it did
not report anything: it just froze the game. It is fixed, and the lookup turned out never to
have been needed — the only thing taken from the siege was the besieged territory's name, and
the function is handed that territory's path.

**Also closed on the way.** `handleRandomEventLikelihood()` and `selectRandomEvent()` in
`gameTurnsLoop.js` were duplicates of the Phase 5.2 `rules/events/randomEvents.js`, which had
only ever had its damage half wired up — so the sample size and the four event NAMES existed
in two places, and the names are precisely what audit 5.2 Q was. And the initial-data builder
was the fourth place the defence-bonus formula was written out, with the brackets in a
different position (**AQ**); it calls `defenseBonusFor()` now.

**Left for later, deliberately**

- **The write guard stays in warn mode.** 5.2 and 5.3 made the economy and combat rules pure,
  but the AI's action executors and `ui.js` still hold territories and assign to them. Each
  report is a Phase 6 to-do now rather than a Phase 5 one.
- **`battle.js` still has its ~25 `export let`s** of per-battle scratch. `resolveRound()` is
  pure, but the legacy caller still stages its arguments through those module-level variables.
  They go with the battle UI in Phase 6.
- **`TurnEngine.reset()` has no `onReset` wired to it.** The engine can restart; what it
  cannot yet do is put the world back, because there is nothing to put it back to until
  save/load lands. That is Phase 7.2, and the hook is there waiting for it.

---

### Phase 5.8 — what actually landed

**Phase 5 met its own exit criteria at 5.7 and still left work on the floor.** `rules/` and
`ai/` ran in Node, the engine replaced the recursive loop, and the unit suite covered the
extracted rules — but the suite still carried `test.fixme`s that Phase 5 was supposed to close,
and the register still named a Phase 5 owner against audit §5.3 **Y**. 5.8 is that list, plus
what finishing it exposed.

**Y — cosmetic randomness has its own stream.** `src/platform/cosmeticRng.js` is a
self-contained mulberry32 seeded from the clock. The sparkle timer and the battle's dice sound
draw from it and never from `Math.random`. It is worth being precise about what was wrong: the
sparkles were not *too random*, they were drawing from the same stream as combat, the economy
and the AI, from a timer that re-armed every 0–100 ms — so how many cosmetic draws fell between
two game draws depended on wall-clock timing, and two runs of the same seed diverged.

**What that unlocked, immediately.** `bootstrap/e2e-hook.spec.js`'s "the same seed produces the
same world" is green. So is the AI determinism spec — the one the e2e plan calls "the guard
that makes every other AI test possible" — and `battle/rout.spec.js` asserts an exact rout
outcome, twice over. **The rule that no spec may assert an exact combat or economy outcome is
lifted.**

**The last reachable `fixme` is retired.** `battle/known-broken.spec.js` held a rout standing
in as `expect(true).toBe(false)`. It is `battle/rout.spec.js` now, and it asserts the
arithmetic: the territory changes hands and the conqueror's garrison is its own survivors plus
half the defenders still standing. Reaching the rout band took a piece of design rather than a
seed — attrition cannot get there, because an attacker big enough to win takes the defender
from ~13 % of its starting force to zero in one step, straight past the 5 % band. A defender
made mostly of *naval* units gets there by composition instead: a ship is worth 20,000
personnel and a rifleman one, so sinking the fleet collapses the combined force while the
infantry are still on the field. **One `test.fixme` remains in the suite, correctly deferred:
audit §5.2 AE, owned by Phase 6.7.**

**Five defects found by writing those specs.** None was reachable before, because each needed
either a repeatable run or a scenario:

| Where | What |
|---|---|
| [ui.js](../ui.js) advance button | **Every fresh battle debited its source territories twice.** Phase 4.7 moved the debit to INVADE! and added the call without removing the original one in the `Begin War!` branch. Committing a whole garrison left the source holding a **negative** army, which then fed population, food consumption and defence for the rest of the game. A battle resumed from a siege skipped the second debit, which is why no siege spec ever saw it. |
| [battle.js](../battle.js) `handleEndSiegeDueArrest()` | **An empty battle-results screen at the start of almost every turn.** `setUpResultsOfWarExternal(true)` ran for *every* arrest, including the AI-versus-AI sieges the player has nothing to do with, and only the player branch ever filled the screen in. The AI arrests something nearly every turn, so the player was handed a results screen holding column headers and nothing else — on top of the phase button, in place of the start-of-turn panel. |
| [gameTurnsLoop.js](../gameTurnsLoop.js) `beginTurn()` | **The start-of-turn info panel never opened.** It was gated on `continueSiege === true` as well as on the player's preference — suppressed on any turn where a siege ended in an arrest. Once sieges actually ticked (§5.1 D, §5.2 J) that was nearly every turn, so the preference silently never took effect at all. The gate says what it means now, because the collision it was avoiding is gone. |
| [src/ui/siegeOverlay.js](../src/ui/siegeOverlay.js), [ui.js](../ui.js), [aiCalculations.js](../aiCalculations.js) | **Two siege markers per siege, and they swallowed the click underneath.** Phase 4.5 moved marker rendering to `siegeOverlay.js` on the `siegeChanged` event and left the imperative `addImageToPath(…, "siege.png", 1)` behind — so a siege produced two `<image>` elements with the **same id**, only one of which was ever removed. Neither carried `pointer-events: none`, so a hit test at the centre of a besieged territory returned the marker: the player could not click their own besieged territory, which is the only route to `VIEW SIEGE`. |
| [ui.js](../ui.js) info-panel tabs | **The active-tab mark never moved.** `active` was added to the Summary button once, at game start, and removed from the other three only by the X button. `.tab-button.active` is what the stylesheet highlights, so Summary looked permanently selected however many times the player switched. |

**Two more, reported from play while the phase was open**, and both the same shape — a fact
read from presentation rather than from state:

- **The country-selection lock was enforced by a fill colour.** The confirm button was gated on
  `country.getAttribute("fill") === GREY_OUT_COLOR`, sitting *outside* the `pathIsGreyedOut()`
  guard that opens `selectCountry()`. The colour picker repaints, so the lock came off in three
  clicks and the player could start as the United States — measured, not theorised. The gate
  reads the store now, the picker refuses to repaint a locked country, and the five keep their
  own hue muted toward grey rather than being painted flat grey, which is what made them look
  unrendered rather than unavailable.
- **A territory could be painted `fill="undefined"`, which renders black.** Clicking a playable
  country and then a locked one un-picked the first through `setColorOnMap(territory)` with no
  second argument — the *in-game* form, which paints `territory.countryColor`, a field not
  populated until `pushColorsToMainArray()` runs on confirm. `setColorOnMap()` now refuses to
  paint a non-colour rather than corrupting the map. Separately, the colour picker's markup
  value (`#000000`) and the store's default player colour (white) were two facts that
  disagreed, so any `change` event on the untouched input adopted black.

**Housekeeping the phase owed.** The shipped `//DEBUG` block is gone: two calls to a 40-line
`logGoldStats()` that sorted, averaged and took the mode of every AI country's spending, twice,
on every AI turn, to print two lines nobody reads — together with the two module-level arrays
that fed it, both getters, and `setDebugArraysToZero()`.

**What 5.8 deliberately did NOT do.** The bootstrap-ordering item in the register
([05](./05-known-issues.md) §2) named Phase 5.7 as its owner: CPU leaders and the AI's starting
forts are created *after* `initialiseGame()` resolves, which is after the engine has already run
turn 1, so turn 1 plans and earns over a world with no leaders and no forts. Moving that setup
inside `initialiseGame()` was implemented and **measured**: the ten-turn `long-run` went from
**6/6 green to 0/6**, with the player's country eliminated every time. Giving the AI a
fully-formed first turn is a balance change, not a tidy-up. It was reverted, the measurement is
recorded at the site so nobody repeats it blind, and the item is re-sequenced to the Phase 7
balance pass alongside the AI's unbounded sieges.

**Suite size.** 275 e2e tests in 49 files (from 227 in 41) and 294 unit tests (from 288). Five
functional areas the e2e plan had listed but never had — `siege/`, `ai-turn/`,
`conquest-lifecycle/`, `info-panels/`, `random-events/` — now exist, which completes **P2**.

---

### Phase 6 — Decompose the UI (5–7 days)

**Goal:** kill the 2,300-line `DOMContentLoaded` block.

| Step | Action |
|---|---|
| 6.1 | ✅ `src/ui/core/registry.js` — 186 element ids, the classes used as selectors, the indexed id families as builders, and the territory path selectors, all as named constants. Imported by the app (every `getElementById`, `setAttribute("id", …)` and `#id` selector across the eight root modules now goes through it) and by `tests/support/selectors.js`, which holds no literal selector any more. |
| 6.2 | ✅ `src/ui/core/dom.js` — `el()`, `svgEl()`, `mount()`, `clear()`, `on()` and `listenerGroup()`. `on()` returns its own remover, which is what makes a component's `destroy()` possible. |
| 6.3 | ✅ All fourteen extracted to `src/ui/components/`, in that order, plus a shared `ResourceWindow` behind `BuyWindow` and `UpgradeWindow`. The `DOMContentLoaded` block went from 2,332 lines to 704, and `ui.js` from 6,446 to 4,763. `PhaseBar` is the one that genuinely subscribes to `state/events.js` (`PHASE_CHANGED`); the rest carry a note saying what has to become state before they can. |
| 6.4 | ✅ Broke up `drawUITable` (920 lines / 4 modes) into `src/ui/infoTable/`: `columns.js` (what each tab shows, as data), `tableDom.js` (header row, data row, spacer) and `renderInfoTable.js` (four small functions and a dispatcher). The sixteen-case `switch`es and the ~30 `if (summaryTerritoryArmySiegesTable === n)` tests are gone. `resourceCalculations.js` 4,846 → 4,057 lines. |
| 6.5 | ✅ Broke up `drawAndHandleTransferAttackTable` (710 lines / 2 modes) into `src/ui/transferAttack/`: `TransferTable.js`, `AttackTable.js`, a shared `ArmyAllocationRow.js`, and `multiples.js` for the step multiplier. `transferAndAttack.js` 1,131 → 473 lines. |
| 6.6 | ✅ `deriveMoveButtonState(selection) → { visible, label, variant, enabled, mode, target }` — pure, no DOM, twelve unit tests. The re-attached click handler is now installed once from bootstrap, and `eventHandlerExecuted` plus all four `setTimeout(…, 200)` calls are gone. |
| 6.7 | ✅ `src/ui/map/`: `MapView.js` (render state → SVG), `colouring.js`, `camera.js` (zoom/pan), `markers.js`. The `currentMapColorAndStrokeArray` save/restore machinery is deleted across five files — colour is a pure function of state. Closes audit §5.2 **AE**. |
| 6.8 | ◐ Semantic ids done: `xButton` → `xButtonInfoPanel` / `xButtonUpgrade`, and `battleUIRow4Col2A…H` → `battleStats{ProdPop,Food,Defense,Mountain}{Icon,Value}`. No `data-testid` — see below. The inline-styling sweep is **not** done. |

**Exit criteria (restated).** As originally written they were `ui.js` no longer exists; no file
over 400 lines; the map renders purely from state. The third is met; the first two are not, and
the second was never achievable as phrased — `src/ui/core/registry.js` (415) and
`src/config/balance.js` (426) are declarative tables of ids and tunable numbers, where a line
count measures nothing. The criterion the remaining work is held to is therefore:

> No **behavioural** module over 400 lines. Declarative data tables — `registry.js`,
> `balance.js`, `infoTable/columns.js`, `manualAdjacencyExceptions.js` — are exempt, because
> splitting a list in half to satisfy a threshold makes it harder to read, not easier.

Against that, every behavioural file in `src/` passes today. The two that fail are `ui.js`
(4,290) and `resourceCalculations.js` (4,060), and Phase 6.9 below is what closes them.

#### What Phase 6 delivered

Nineteen files under `src/ui/`, and five root modules shrunk:

| File | Before | After |
|---|---:|---:|
| `ui.js` | 4,763 | 4,290 |
| `resourceCalculations.js` | 4,846 | 4,057 |
| `transferAndAttack.js` | 1,131 | 474 |

New in 6.4–6.8, every one of them under 300 lines: `src/ui/map/{MapView,camera,colouring,markers}.js`,
`src/ui/infoTable/{columns,warColumns,tableDom,renderInfoTable}.js`,
`src/ui/transferAttack/{TransferTable,AttackTable,ArmyAllocationRow,multiples}.js`,
`src/ui/moveButton/deriveMoveButtonState.js`.

**Four defects closed, all structural rather than arithmetic** — recorded in
[05-known-issues.md](./05-known-issues.md) §9:

- audit §5.2 **AE**, the attack marker surviving a cancel — the last 🔴 in the register, and
  the last `test.fixme` in the suite;
- the colour snapshot (`saveMapColorState` / `restoreMapColorState`, ~30 call sites across
  five files), replaced by `repaintMap()` deriving colour from the store;
- the move button's click handler accumulating one listener per territory selection, which
  `eventHandlerExecuted` and four `setTimeout(…, 200)` calls were suppressing;
- the duplicated `xButton` id.

**Two behaviour changes were made deliberately**, both at the developer's request or as the
only coherent reading of a defect, and both are stated where they were made:

- **Zoom is instant and cursor-anchored.** The 500 ms viewBox animation is gone, and with it
  the `isAnimating` latch that DROPPED any wheel event arriving mid-flight — a quick
  double-scroll used to move one level, not two. Zoom now converts the pointer to user
  coordinates properly (honouring `preserveAspectRatio` letterboxing, rather than the two
  hard-coded `+280` / `+150` fudge offsets) and clamps to the world bounds, so nothing outside
  the map can be brought on screen by zoom or by pan.
- **Cancelling an attack un-arms it.** The audit says the marker must go; it does not say what
  the move button should then read. It now goes away with the marker and the target
  highlight, and the player re-arms by clicking the territory again — because keeping the
  button on ATTACK would mean keeping a target the map says is not there.

**One thing the phase found and deliberately did not fix.** `generateDistinctRGBs()` is dead
decorative code that is still *called*, because its `Math.random` draws at module load are on
the game's stream: removing them moves every seeded outcome, which was measured (four
exact-outcome specs change). It is isolated in `src/ui/map/colouring.js` with the reason at the
site, and logged for Phase 7.

#### What Phase 6 did NOT deliver

Stated plainly so nobody reads the table above as "done":

- **`ui.js` still exists, at 4,290 lines**, and `resourceCalculations.js` at 4,057. What came
  out of them was the four functions the phase named. What is left in `ui.js` is the
  `DOMContentLoaded` block, the battle and siege UI, the map event handlers and the
  turn-loop glue. `resourceCalculations.js` is **not** what an earlier draft of this plan
  called it: the economy proper — income, population, capacity, maintenance — came out in
  Phase 5 and lives in `src/rules/economy/`. What remains is a caller of those rules wrapped
  in roughly 80% UI (the buy and upgrade tables, four tooltip builders, the purchase-validation
  and greying-out pass). It is correctly a Phase 6 file, not a Phase 5 leftover.
- **"No file over 400 lines" is not met**, and will not be until those two are finished. Every
  file Phase 6 *created* is under 300.
- **6.8's inline-styling sweep is not done.** `ui.js` still makes 218 `.style.` writes. The
  ones the phase touched were removed where the stylesheet already said the same thing, and
  one was deliberately left with a note explaining that moving it would lose a specificity
  fight and change the layout. A sweep of the remaining 218 is its own piece of work and
  should be measured against a screenshot comparison, not done blind.
- **No `data-testid` attributes were added.** `registry.js` already is the single name the app
  and the harness share; a parallel attribute would be a second thing to keep in step.

---

### Phase 6.9 — Finish the two files Phase 6 left (2–3 days, split either side of Phase 7)

**Goal:** close Phase 6's restated exit criteria. This is the tail Phase 6 did not budget for,
written down here as steps so it does not go unscoped a second time.

**It runs in two parts, and Phase 7.1–7.3 sits between them.** The reasoning: the
architectural goals that carried risk — the state layer, the pure rules, the engine, seeded
determinism — are all done, and the suite is green. A 4,290-line `ui.js` is ugly, not
dangerous. Meanwhile 7.1 (victory) is fenced *into* Phase 7 precisely because without it a
full playthrough cannot be tested. So 6.9 does first only the blocks Phase 7 will collide
with, and the rest waits until after 7.3 rather than holding a finishable game hostage to a
move-only refactor with no player-felt gain.

#### Where `ui.js`'s 4,290 lines are

Measured at the end of Phase 6, so a step can be picked by what it costs:

| Lines | Block | Size |
|---|---|---:|
| 2803–3933, plus the battle handlers inside the `DOMContentLoaded` block | Battle & siege UI | ~1,480 |
| 722–1415 | `DOMContentLoaded` — now mostly `create()` calls plus the battle state machine | 694 |
| 1845–2345 | Hover, grey-out, move-button glue, attack target | 501 |
| 244–721 | Bootstrap and `selectCountry` | 478 |
| 2346–2802 | Transfer-window title text, and the sixteen `toggleX()` visibility functions | 457 |
| 1416–1787 | Geometry and adjacency (`findClosestPaths` and the five helpers under it) | 372 |

And `resourceCalculations.js`'s 4,060: buy/upgrade tables and their increment-decrement
handlers (803), four tooltip builders (517), purchase validation and greying-out (547),
bootstrap data seeding (447), turn-economy orchestration over `src/rules/economy/` (373),
territory strengths and starting army (458).

#### Part A — before Phase 7

| Step | Action | Why it goes first |
|---|---|---|
| 6.9.0 | Delete the `generateDistinctRGBs()` call in `src/ui/map/colouring.js` and re-baseline the four exact-outcome specs its `Math.random` draws move, **in one change**. | Standalone, small, and every phase after it pays interest on the shifted stream. Same species as audit 5.3 **Y**. |
| 6.9.1 | Extract the sixteen `toggleX()` visibility functions (`ui.js` 2612–2800) into `src/ui/visibility.js`. | A victory screen (7.1) and New Game (7.2) both drive panel visibility. Leave these in `ui.js` and Phase 7 adds a seventeenth to it. |
| 6.9.2 | Move the turn-loop glue out of the `DOMContentLoaded` block — the `#popup-confirm` handler and the battle-button state machine — into `src/ui/turnLoopBindings.js`, called from bootstrap. | 7.2's `TurnEngine.reset()` has to tear these down and re-install them. Today they are anonymous closures in a 694-line block. |

**Part A exit:** `ui.js` under ~3,100 lines; the four exact-outcome specs re-baselined; suite green.

#### Part B — after Phase 7.3

| Step | Action |
|---|---|
| 6.9.3 | Battle & siege UI (~1,480 lines) → `src/ui/battle/`. The largest single block and the highest regression risk relative to reward, which is exactly why it waits: nothing in Phase 7 touches it. |
| 6.9.4 | Geometry and adjacency (372) → `src/geometry/`. Pure functions over path elements; unit-testable the moment they move. |
| 6.9.5 | Bootstrap and `selectCountry` (478) → `src/bootstrap/`. Mind the window in which the SVG *is* the truth (see CLAUDE.md). |
| 6.9.6 | `resourceCalculations.js` → `src/ui/purchases/` (buy/upgrade tables, tooltips, validation), `src/economy/turnPass.js` (the orchestration over `src/rules/economy/`) and `src/bootstrap/seedResources.js` (initial data). |
| 6.9.7 | The inline-styling sweep: 218 `.style.` writes in `ui.js`, 55 in `resourceCalculations.js`. **Against a screenshot comparison, not blind** — Phase 6 hit one that would have lost a specificity fight and silently changed the layout. |

**Part B exit:** `ui.js` and `resourceCalculations.js` no longer exist; no behavioural module
over 400 lines.

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
| 7.10 | ✅ **Theme system and menu redesign** | Done out of order, at the developer's request. `src/ui/theme/` — a token vocabulary, a catalogue of six themes as data, and an applier that writes tokens onto the root element as CSS custom properties. A new Options panel (`src/ui/components/OptionsPanel.js`) holds the picker; the main menu was rebuilt around it. See below. |

#### Phase 7.10 — what landed

Asked for mid-phase and taken then rather than deferred, because it touches the same two files
Phase 6.9 is about to move and doing it twice would be worse than doing it early.

**The mechanism.** A theme is a map of CSS custom properties. `src/ui/theme/tokens.js` fixes the
vocabulary, `themes.js` is the catalogue, and `theme.js` writes the chosen theme's tokens onto
the root element inline. The stylesheet never learns a theme's name — it reads
`var(--surface-panel)` and friends — so adding a theme is one entry in `themes.js` and no CSS.

**Six themes:** Command (the default, a modernised form of the existing steel blue), Parchment,
Midnight, Crimson, Arctic and Terminal. They differ in more than hue: `--radius`,
`--border-width`, `--font-display`, `--display-tracking` and `--display-transform` are tokens
too, which is what stops six themes reading as one dated design recoloured six times.

**Two invariants, both enforced by `tests/unit/ui-theme.spec.js`:**

- the default theme carries NO tokens of its own, so the `:root` block in `style.css` is the
  single definition of the default look rather than one of two that can drift;
- every other theme defines every token, because inheriting half a palette is how a light theme
  ends up with white text on a cream panel — a failure that looks like nothing in particular
  until someone selects it.

**The stylesheet.** Six colour literals accounted for about 90 of the colour declarations in
`style.css`; all of them, and all 24 hard-coded `border-radius` values, are now tokens. That is
what makes a theme reach the whole UI and not only the menu. No specification changed: every one
of those literals was a background or a border, none is read back by JS, and no spec asserts a
computed colour (the suite asserts `display`, `opacity` and `pointer-events`).

**The menu was rebuilt** rather than recoloured. What was there was five `.menu-option` elements
at `height: 25%` — 125% in total, relying on flex to shrink them back — two of which were `<td>`
elements outside any table, with POSITIONAL class names (`.option-3`, `.option-4`, `.option-5`)
that would have forced a rename to add a sixth item. It is now semantic classes, an `<h1>` and a
`<p>`, and a `clamp()`ed title that no longer overflows its panel on a laptop screen.

**Eight new e2e specs** in a new `options/` functional area, and eight unit tests. The e2e ones
cover what a unit test cannot: that selecting a theme repaints immediately, that Done survives a
reload, and that Cancel restores what was in force when the panel opened — three paths that are
one bug away from each other, since a preview that persisted would make Cancel meaningless.

**Left undone deliberately.** The Options panel holds only the theme picker. Music is still a
main-menu button because `music.js` owns it and finds it by id; moving it into Options is a
small change that belongs with 7.6, when Help gets wired and the panel has more than one row.

---

## 3. Effort summary

| Phase | Focus | Estimate | Gate |
|---|---|---:|---|
| 0 | Tooling & hygiene | 0.5 d | ✅ `npm run dev` works |
| 1 | Load performance & test hooks | 1–2 d | ✅ Cold start < 3 s |
| 2 | E2E safety net | 2–3 d | ✅ P0+P1 green; P2 delivered in 5.8 |
| 3 | Critical defect fixes | 2–3 d | ✅ 20-turn playthrough clean |
| 4 | Single state layer | 3–4 d | ✅ `mainGameArray` gone |
| 5 | Pure rules + engine | 4–5 d | ✅ `rules/` runs in Node; seeds repeat (5.8) |
| 6 | UI decomposition | 5–7 d | ◐ 6.1–6.8 done; `ui.js` and `resourceCalculations.js` remain |
| 6.9A | Toggles + turn-loop glue + the RNG measurement | 0.5–1 d | — `ui.js` under ~3,100 lines |
| 7 | Design gaps | 3–5 d | — Game is finishable |
| 6.9B | Battle UI, geometry, bootstrap, `resourceCalculations.js`, styling sweep | 2 d | — No behavioural module over 400 lines |

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

~~Phase 6.1, 6.2 and 6.3 are complete. The order the rest of Phase 6 runs in is
6.7 → 6.4 → 6.5 → 6.6 → 6.8~~ — **all of 6.1–6.8 are done.** The order they ran in was
6.7 → 6.4 → 6.5 → 6.6 → 6.8, for the reasons given at the time: the map extraction is
independent of the `DOMContentLoaded` block and closed the last open defect in the register,
6.4–6.6 are deepenings of three components 6.3 created, and 6.8 renames ids, which is only
cheap once the registry exists.

**The order from here is 6.9 Part A → 7.1 → 7.2 / 7.3 → 6.9 Part B.** That interleave is a
deliberate departure from strict phase order, decided after Phase 6 and recorded here so it
is not mistaken for drift. The case for it: everything in the refactor that carried real risk
is finished and green, so what is left of `ui.js` is a readability problem rather than a
correctness one — whereas victory conditions are the one feature the plan fences *into* Phase
7, because without them a full playthrough cannot be tested at all. Part A takes out only the
two blocks Phase 7 would otherwise grow back.

1. **Phase 6.9 Part A** — 6.9.0 (the `generateDistinctRGBs()` measurement, its own change),
   6.9.1 (the sixteen `toggleX()` functions → `src/ui/visibility.js`) and 6.9.2 (the turn-loop
   glue out of the `DOMContentLoaded` block). Roughly 1,150 lines out of `ui.js`.
2. **Phase 7.1** — win / lose conditions (`rules/victory.js`) plus a victory/defeat screen.
3. **Phase 7.2 / 7.3** — New Game and save/load. `TurnEngine.reset()` exists and `GameState`
   is a plain serialisable object, so both are now small.

Then **Phase 6.9 Part B** (6.9.3–6.9.7) closes the exit criteria: the battle and siege UI, the
geometry helpers, bootstrap, `resourceCalculations.js`, and the styling sweep.

6.9.0 comes first within Part A and must be its own change. `generateDistinctRGBs()` is dead
code held in place only by its `Math.random` draws at module load, which sit on the game's
stream; deleting it moves four exact-outcome specs, and every later phase pays interest on it.
Re-baseline those four specs in the same change, and nothing else in it.

### What 6.1–6.3 delivered

- `src/ui/core/registry.js` (413 lines) and `src/ui/core/dom.js` (191 lines).
- Fourteen components in `src/ui/components/`, 2,400 lines in total, each `create()` +
  `destroy()` and, where it has store state to follow, `update()`.
- `ui.js` 6,446 → 4,763 lines; the `DOMContentLoaded` block 2,332 → 704, of which most of
  what is left is the phase-confirm and battle-button handlers that belong to the turn loop
  rather than to any component.
- Two long-standing problems closed along the way: `#tooltip` now carries
  `pointer-events: none` (it was the only thing in the document that sat under the pointer
  and ate the click the player was making), and the 128 bare `tooltip` identifiers that
  resolved through named window access are gone.
- One behaviour deliberately changed: `MoveButton.setVariant()` removes all five background
  classes before adding one. Two of the six call sites it replaced removed only three or
  four, so a button could carry two backgrounds at once.
