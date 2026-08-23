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

### Phase 1 — Unblock loading and testing (1–2 days) 🔴 **highest value**

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

**Exit criteria:** cold start < 3 s; no `setTimeout`-gated imports remain; `window.__game` available under `?e2e=1`.

---

### Phase 2 — Land the safety net (2–3 days)

**Goal:** characterisation coverage before anything is moved.

| Step | Action |
|---|---|
| 2.1 | Stand up the Playwright harness exactly as specified in [04-e2e-test-plan.md](./04-e2e-test-plan.md) §3 — config, runner, `--slow`, worker policy, fixtures. |
| 2.2 | Write the **P0 specs** (bootstrap, country-selection, turn-loop, map-interaction). These are the ones every other test depends on. |
| 2.3 | Write **P1 specs** (resources-economy, buy-military, upgrade-territory, transfer, attack, battle). |
| 2.4 | Wire `npm test` → unit + e2e, and add a CI workflow that runs headless × 8 workers. |
| 2.5 | Snapshot current numeric behaviour where it is *wrong but known* — mark those assertions `test.fixme` with a link to the audit item, so Phase 3 flips them green rather than inventing expectations. |

**Exit criteria:** P0 + P1 green (or explicitly `fixme`) on a clean checkout, repeatably, in under 5 minutes.

---

### Phase 3 — Fix the critical defects (2–3 days)

**Goal:** make the game *play correctly* before making the code pretty. Each fix is its own
commit with a test that fails before and passes after.

Order matters — these are sequenced by blast radius.

| Order | Audit ref | Fix |
|---|---|---|
| 3.1 | §5.1 A | Upgrade capacity bonuses: apply `+10 %` **per building purchased in this transaction** against the pre-transaction capacity, not the running total. Recompute from `buildingsBuilt` rather than mutating incrementally. |
| 3.2 | §5.1 C, B | Hoist `count` out of the AI loops; guard the write-back so `"no match"` is never assigned. Replace the sentinel string with `null` and an explicit `if (!friendly \|\| !enemy) continue;`. |
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

---

### Phase 4 — Extract the state layer (3–4 days)

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
| 4 | Single state layer | 3–4 d | `mainGameArray` gone |
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

1. **Phase 1.1** — single-load adjacency map. One function, order-of-magnitude payoff, no
   behavioural risk.
2. **Phase 1.6** — the `?e2e=1` test hook and seeded RNG. Everything in
   [04-e2e-test-plan.md](./04-e2e-test-plan.md) depends on it.
3. **Phase 2.1–2.2** — harness plus the four P0 specs, so Phase 3's fixes have something to
   prove themselves against.
