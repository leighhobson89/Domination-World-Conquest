# Known Issues — Domination: World Conquest

**Companion documents:** [01-codebase-audit.md](./01-codebase-audit.md) ·
[02-game-design-document.md](./02-game-design-document.md) ·
[archived/03-refactor-plan.md](./archived/03-refactor-plan.md) · [03-e2e-test-plan.md](./03-e2e-test-plan.md)

This is the **register**: every defect found so far, in one table, with its current status, the
code that is wrong today, the test that covers it, and the refactor phase that closes it.

The audit ([01](./01-codebase-audit.md)) explains *why* each defect exists and what it does to
the game — that analysis is not repeated here. This document answers three different
questions:

1. Is it still broken?
2. Where is it *now*? Line numbers in the audit are against commit `b7ae0af` and have since
   drifted; the numbers here are against the current working tree.
3. What proves it fixed?

**Issue ids are the audit's letters** (`A`–`Z`, `AA`–`AR`) and are stable. They are cited by
the e2e specs and by the refactor plan, so they must not be renumbered. `AD` and `AE` were
found by the Phase 2 suite; `AF` through `AJ` by the ten-turn run in Phase 3; `AK` and `AL` by the
same ten-turn run in Phase 4 — `AK` once removing the territory copies stopped it hiding the
symptom, and `AL` once `AK` stopped the run failing on turn 2.

**Last updated: Goals and Victory Q4 — the game can now be finished, so the register's
oldest open item is closed.** Earlier revisions: Phase 7, on the developer's report of AZ (an
AI-versus-AI siege handing the player the territory); after Phase 7.2 / 7.3 (menu access, new
game, save/load); end of Phase 6; the Phase 6.9 planning review; and 7.10 (themes).

## Currently open

**One line per issue that is still open. An issue is deleted from this list the moment
it is closed** — the detail of what it was and how it was fixed stays in the section
below that owns it, struck through. If this list is empty, nothing is outstanding.

| Id | Issue | Owner |
|---|---|---|
| — | Bootstrap ordering is timing-luck: CPU leaders and the AI's starting forts are created after `initialiseGame()` resolves, so turn 1 runs over a world with no leaders and no forts | 7.x balance |
| — | Unpaid army upkeep has no consequence; a broke territory keeps its army for free | 7.x balance |
| — | ~~AI sieges accumulate without bound (17 → 67 over 14 turns)~~ — closed by the campaign budgets; a besieged territory still earns nothing | 7.x design |
| — | The AI can eliminate a single-territory player in ten turns once it plans its first turn with full information | 7.7 / 7.x |
| — | **Attacking is too hard for the world to consolidate.** Measured after Phase 7.8 over two seeds: ~59% of every reachable (attacker, defender) pairing in the world is below the 15% win probability the game applies to everybody, before any AI decision is taken. The AI now plans, masses and presses properly, and a hundred turns still ends with 106–145 countries rather than the 16 or so a world of great powers implies — and which of the two it is depends on whether one power happened to get an early snowball. The defender's fort multiplier and the attacker's sub-1 `devIndex` are the two terms to look at, together with **AR** below. `tools/ai-sim.mjs` is the instrument | 7.x balance |
| ~~—~~ | ~~`dices.js` is fully wired but its call site is commented out~~ | **DONE in battle overhaul B.6.5.** The rules choose the faces; the physics tumbles real dice and each mesh is rotated by one of a cube's 24 symmetries to show the chosen face. Two defects fixed with it: the collision shape was a CUBOID (faces 3 and 4 came up a third as often as they should, chi-square 738) and the throw drew from `Math.random`. **And `dist/` came off the critical path at B.10.3**: the three UMD bundles (~785 KB) are injected by `src/platform/vendor/diceRuntime.js` on the FIRST dice roll of a session rather than by `index.html` on every page view. They are still committed classic scripts setting globals, because a bare-specifier import is something only a bundler can resolve |
| — | **The ending has no SCREEN.** The game decides itself correctly and emits `GAME_OVER` once — the victory and defeat screens are the only listener still missing, and they are a second subscriber rather than a change to the rule | next |
| — | The transfer table's row-selection handler is on the row's NAME column, not on the row | 7.x |
| — | Mixed tabs and spaces, inconsistent brace style, commented-out blocks in the legacy root sources | per file, as each moves into `src/` |
| — | 166 `console.log` calls in the turn and battle hot path — `aiCalculations.js` 57, `battle.js` 49, `resourceCalculations.js` 36, `gameTurnsLoop.js` 15, `ui.js` 5 | per file, as each moves into `src/` |
| — | Four names for one structure: the `mainArrayOfTerritoriesAndResources` / `mainArray` parameter names survive in `battle.js` and `transferAndAttack.js` | per file |
| — | `dataName` / `territoryName` / `originalOwner` are named correctly in the selectors but keep their old names in the model | per file |
| — | `battle.js` still exports ~25 `let`s of per-battle scratch | per file |
| — | `ui.js` is 4,290 lines and `resourceCalculations.js` 4,060; Phase 6's "no behavioural module over 400 lines" is not met | 6.9 Part A (before Phase 7), Part B (after 7.3) |
| — | Inline `.style.` writes that set a literal colour from JS do not follow the theme, so a themed page has a handful of elements still painted in the old steel blue. Phase 7.11 took `resourceCalculations.js` from 55 to 15 (13 of them colours) by making the confirm button's armed state a class and the info panel's tab selection a class; `ui.js` is still 214 writes, 60 of them colours, and `battle.js` 18 / 11 | 6.9.7 |
| — | The data tables keep `font-family: Arial, Helvetica, sans-serif` rather than `var(--font-body)`. Deliberate for now: the rows are a fixed 30px and Terminal's monospace face would reflow them. Revisit if the tables stop being fixed-height | 7.x |
| **AN** | A famine whose losses exactly equal the infantry count destroys the entire mechanised army — `remaining === 0` is not `remaining > 0` | 7 balance |
| ~~**AP**~~ | ~~Battle rout / last-push thresholds compare against each side's force as it stood at the START of the round~~ | **DONE in battle overhaul B.4** — one symmetric `BREAK_THRESHOLD`, checked AFTER the round's casualties, against each side's own starting force. The lag is gone by construction rather than by a guard |
| **AR** — **CLOSED AS A DESIGN DECISION, battle overhaul B.10.4** | `Math.min(1, MAX_AREA_THRESHOLD / area)` can never exceed 1, so the small-territory defence bonus does not exist and large territories are penalised instead. Measured, and **deliberately left as it is**: it is not a one-character fix and correcting it halves the largest empire over sixty turns. See the full entry below | — (decided) |
| — | The bootstrap colour palette (`generateDistinctRGBs()` in `src/ui/map/colouring.js`) is dead code that is still CALLED, because its `Math.random` draws are on the game's stream and removing them moves every seeded outcome | 6.9.0 — the next change |

---

## Status legend

| | Meaning |
|---|---|
| 🔴 **Open** | Still broken at HEAD |
| 🟢 **Fixed** | Fixed, with a test that fails against the old behaviour |
| 🟡 **Accepted** | Real, understood, and deliberately not being fixed yet — the phase that owns it is named |
| ⚪ **Structural** | Not a single bug but a shape problem; closed by a phase, not by a patch |

## The scoreboard

| | Critical | High | Medium | Low |
|---|---:|---:|---:|---:|
| 🟢 Fixed | 14 | 16 | 17 | 2 |
| 🔴 Open | 0 | 0 | 0 | — |
| 🟡 / ⚪ | 0 | 0 | 5 | 4 |

~~Phase 3 closed every critical and every high-severity defect in the register, plus five
(**AF** through **AJ**) that only became reachable once the others were fixed. Every one of
those five was found by the same spec: the ten-turn `long-run`.~~

~~Phase 4 closed **AD**, **AK** and **AL**, structurally closed **AB**, and closed five more
found while doing it (§4b).~~

~~Phase 5.8 closed **Y** — the one that had held back the whole suite — and seven defects that
closing it made reachable (§8).~~

**Phase 6 closed the last one: AE. There is no 🔴 left in the register, and no `test.fixme`
left in the suite.** What remains is the 🟡 / ⚪ list in §2 and the balance items in §7, all of
which are sequenced into Phase 7 — see **Currently open** at the top.

---

## 1. ~~Still open~~ — closed in Phase 6

~~One defect, structural rather than arithmetic, already sequenced.~~

| Id | Issue | Status | Now at | Fixed by | Covered by |
|---|---|---|---|---|---|
| **AE** | ~~**The attack marker survives a cancel** by either route — the window's X, or the move button's CANCEL~~ | 🟢 Fixed | [src/ui/map/markers.js](../src/ui/map/markers.js) | **6.7 — DONE** | `attack/attack-window.spec.js`, two specs — one per cancel route |

~~It is not a patch.~~ **AE** was the marker half of the map-state desync, and Phase 6.7 removed
the whole class by making the marker a function of state rather than something pushed onto the
SVG from ~30 call sites. ~~Phase 4 did the same thing to the six *attribute* halves of that
desync, which is why the attribute specs in `bootstrap/state-layer.spec.js` can now assert
map-equals-model outright.~~

**How it was closed, because the shape of the fix is the point.** The marker was an `<image>`
that six call sites removed by hand, while the fact it was drawing —
`territoryAboutToBeAttackedOrSieged` — was a plain `let` that a seventh site set to `null`
without touching the DOM. Two representations of one fact, and the cancel path only ever
updated one of them. `src/ui/map/markers.js` owns both: `setAttackTarget(path)` draws the
marker and `clearAttackTarget()` removes it, and there is no way to do one without the other.

**One behaviour was decided rather than restored.** The audit says cancelling should not leave
the marker, but not what the move button should then say. Cancelling now un-arms the attack
completely — the target is cleared, `repaintMap()` puts the target territory's fill and stroke
back, and the button goes away. The player clicks the territory again to arm a fresh attack.
The alternative, keeping the button on ATTACK, would mean keeping a target the marker says is
not there, which is the state this defect was about.

---

## 2. Accepted, and sequenced

Real, understood, deliberately not being fixed yet.

| Id | Issue | Fixed by | Notes |
|---|---|---|---|
| **S** | ~~~60 bare `tooltip` / `uiTable` identifiers resolve **only via named window access**~~ | **DONE in 6.3** | ~~`tooltip` (128 sites across `ui.js` and `resourceCalculations.js`) is now an imported handle from `src/ui/components/Tooltip.js`, which also creates the element — it is no longer a `<div>` in index.html. `uiTable` went with `InfoTable`; the remaining lookups take `ids.uiTable` from the registry~~ |
| — | ~~Map colour is snapshotted and restored from ~30 call sites, with `false` and `"true"` both truthy in one path~~ | **DONE in 6.7** | ~~The snapshot is gone. `repaintMap()` in [src/ui/map/MapView.js](../src/ui/map/MapView.js) computes every path's fill and stroke from the store, so restoring the map after a selection, a cancel or a battle is the same call as painting it — there is no clean moment to miss and no flag to pass. `saveMapColorState()`, `restoreMapColorState()`, `setCurrentMapColorAndStrokeArray()` and `currentMapColorAndStrokeArrayFromExternal()` are all deleted, across `ui.js`, `battle.js`, `aiCalculations.js`, `gameTurnsLoop.js` and `resourceCalculations.js`~~ |
| — | ~~**Every besieged or freshly-conquered territory was painted the PLAYER's colour**, whoever owned it. `endPlayerTurn()` re-asserts the fill on paths that keep their stroke decoration, and its `else` branch wrote `playerColour()` unconditionally — so an AI territory besieged by another AI took the player's colour with the player nowhere near the war. `saveMapColorState()` three lines later captured the result, so every later `restoreMapColorState()` replayed it and it never washed out: 45 mis-painted territories by turn 4, 55 by turn 8, monotonically increasing. With the picker on its default white it read as blank land; with any colour picked it read as player-held land~~ | **DONE** (found during Phase 6.3) | ~~Ask the owner: `playerColour()` only when `pathIsPlayerOwned()`, otherwise the territory's own `countryColor`. That also repairs a path an earlier turn mis-painted. Guarded by `tests/e2e/siege/besieged-colouring.spec.js`~~ |
| — | **Bootstrap ordering is timing-luck**: CPU leaders and the AI's starting forts are created *after* `initialiseGame()` resolves, which is after the engine has run turn 1 — so turn 1 plans and earns over a world with no leaders and no forts, and `newTurnResources()` skips the income pass on turn 1 to hide it | **7.x — balance pass** (was 5.7) | ~~Re-sequenced in 5.8, with a measurement. Moving the setup inside `initialiseGame()` was implemented and tried: the ten-turn `long-run` went from **6/6 green to 0/6**, the player eliminated every time.~~ A fully-formed AI first turn is a balance change, not a tidy-up. The finding is recorded at the site in `gameTurnsLoop.js` so nobody repeats it blind |
| — | ~~`eventHandlerExecuted` plus `setTimeout(…, 200)` as a click de-bounce — timing, not state~~ | **DONE in 6.6** | ~~It was suppressing a real defect, not debouncing a fast finger: the move button's click handler was re-created and re-attached on every territory selection, and `removeEventListener` could never remove the previous one because each call built a new function object. Listeners accumulated, so one click fired once per selection made since the window opened. There is one listener now, installed once from bootstrap, reading the current state — so there is nothing to de-bounce and the latch and all four timers are gone~~ |
| — | ~~Essentially **no error handling** — two `try/catch` in 19,800 lines, one of them empty~~ | **DONE in 5.7** | ~~`src/engine/TurnEngine.js` reports a thrown step through `onError` and carries on: one lost turn instead of a dead game. It is why every defect in §3 froze the *whole game* rather than one turn, and why a crash is now a failing e2e spec instead of a stuck phase button~~ |
| — | ~~**No win or lose condition.** The game cannot be finished~~ | **DONE, Goals and Victory Q1–Q4** | ~~Nothing checked whether the world had been conquered and nothing checked whether the player had been wiped off it.~~ Five goals, chosen on a forced screen before the country; every AI plays for the same one and adapts to it through `src/ai/doctrine.js`; `src/rules/victoryCheck.js` decides the ending in the turn engine's `endTurn` hook, **before** `advanceTurn`, and it latches so a decided game announces itself exactly once. Elimination runs underneath every goal. Covered by `tests/unit/rules-victory-check.spec.js` and `tests/e2e/goal-selection/game-over.spec.js`. **What is deliberately NOT done: the victory / defeat SCREEN.** The only listener today is a `console.log` (never a `console.error`, which fails every e2e spec); the screen is a second subscriber rather than a change to the rule, and it is the next piece of work |
| — | **No save or load.** A refresh destroys everything | 7.3 | |
| — | Unpaid army upkeep has **no consequence** — a broke territory keeps its army for free | 7.x | ~~New in Phase 3, with maintenance re-enabled (**R**).~~ Desertion is a design decision, not a defect fix |
| — | ~~The start-of-turn info panel is **suppressed on any turn that ends a siege by arrest**~~ | **DONE in 5.8** | ~~It was far worse than recorded: once sieges ticked properly (**D**, **J**) the AI arrested something nearly every turn, so the panel opened on NO turn at all and an empty results screen appeared in its place. See **AT** and **AU** in §8~~ |
| — | **AI sieges accumulate without bound, and a besieged territory earns nothing.** Measured over 14 turns: 17 → 67 concurrent AI sieges, and a player besieged on turn 3 was still besieged on turn 14 with its income suspended throughout | 7.7 / 7.8 | See §5 — the single most player-visible consequence of Phase 3, and a design problem rather than a defect |
| — | **The AI can eliminate a single-territory player in ten turns** once it plans its first turn with full information. Not reachable today — it is what the bootstrap-ordering item above turns on — but it is the measurement that sequences both | 7.7 / 7.x | Same root as the unbounded sieges: 206 independent actors, each evaluating every reachable enemy |
| ~~—~~ | ~~`dices.js` is fully wired but its call site is commented out~~ | **DONE in battle overhaul B.6.5.** The rules choose the faces; the physics tumbles real dice and each mesh is rotated by one of a cube's 24 symmetries to show the chosen face. Two defects fixed with it: the collision shape was a CUBOID (faces 3 and 4 came up a third as often as they should, chi-square 738) and the throw drew from `Math.random`. **And `dist/` came off the critical path at B.10.3**: the three UMD bundles (~785 KB) are injected by `src/platform/vendor/diceRuntime.js` on the FIRST dice roll of a session rather than by `index.html` on every page view. They are still committed classic scripts setting globals, because a bare-specifier import is something only a bundler can resolve | decide: wire it or delete it |
| — | ~~`xButton` is a **duplicated id**~~; ~~`#tooltip` has no `pointer-events: none` and eats the click beneath it~~; the transfer table's row handler is on the NAME column | **6.8 DONE** / **6.3 DONE** / open | ~~The tooltip is fixed: `Tooltip.create()` sets `pointer-events: none` inline and style.css records why.~~ ~~`xButton` was on two elements — the info panel's close button and the upgrade window's — so a bare `#xButton` was ambiguous the moment both existed and every call site had to scope it to a container. They are `xButtonInfoPanel` and `xButtonUpgrade` now, and `tests/support/selectors.js` addresses each directly.~~ The transfer row handler is still on the NAME column and is still worked around in `tests/support/`; it is listed under **Currently open** |

### Low — hygiene

| Issue | Fixed by |
|---|---|
| Mixed tabs and spaces, inconsistent brace style, commented-out blocks left in place | per file, as each moves into `src/` — house rule 5 |
| ~~`//DEBUG` blocks shipped in the turn loop (`logGoldStats`, `setDebugArraysToZero`)~~ | **DONE in 5.8** — ~~the two arrays, both getters, the 40-line logger and its two per-turn calls are all gone~~ |
| ~200 `console.log` calls in the turn and battle hot path | **still open, but no longer where the audit found them** — 166 remain, and Phase 6 moved the concentration rather than reducing it much: `aiCalculations.js` 57, `battle.js` 49, `resourceCalculations.js` 36, `gameTurnsLoop.js` 15, and `ui.js` down to 5. They come out with the files rather than in a sweep of their own, which now means the AI and battle modules own the bulk of it, not the UI. Phase 6 removed the two in the attack table's per-click path, which ran on every plus and minus press |
| ~~Magic numbers throughout~~ | **DONE in 5.1** — ~~`src/config/balance.js`. `COUNTRY_GREYOUT_RANK`, `UNIT_MATCHUP_EFFECTIVENESS`, `armyCostPerTurn`, `PROBABILITY_THRESHOLD_FOR_SIEGE` and the battle thresholds all live there and are imported by the specs that assert them~~ |
| Four names for one structure: `mainGameArray` / `mainArrayOfTerritoriesAndResources` / `mainArray` / `territories` — the first is gone, the parameter name survives in `battle.js` and `transferAndAttack.js` | 5.2 / 5.3, as each function becomes pure |
| `dataName` is the *current owner* and changes on conquest, `territoryName` is the stable identity, `originalOwner` is historical. Named as such in `state/selectors.js` (`countryOf` vs `getTerritoryByName`) but the fields keep their old names in the model | 5.2 |
| `battle.js` still exports ~25 `let`s of per-battle scratch (`currentRound`, `attackingArmyRemaining`, …) | 5.3 — `resolveRound()` is pure and has no module state |
| Lint baseline: **86 errors / 294 warnings at the end of Phase 6**, from 226/405 at Phase 0 and 188/332 at the start of Phase 6. The fall is a by-product of extraction, not a sweep — house rule 6 still stands | per file, as each moves into `src/` |

---

## 3. Closed in Phase 3

~~Every critical and every high-severity defect. Each fix carries the audit reference in a
comment at the site, so the code explains itself without this document.~~

### The one that stopped the game

| Id | Issue | Fix |
|---|---|---|
| **AA** | ~~`determineResourcesAvailableForThisGoal` reassigned `refinedTurnGoals` from inside a loop indexed against its old length; the last index vanished, `refinedTurnGoals[i][1]` threw, and the unhandled rejection killed `gameLoop()` for good — the phase button stuck on `AI MOVING...` until a reload~~ | ~~The Bolster goals that need no infantry are dropped **once, before the loop**, over a list that then does not change, and only goals after the cursor are eligible — removing one at or before it is what shifted the index. A `count` of zero now divides as one instead of producing `Infinity`~~ |

### Critical — corrupted game state

| Id | Issue | Fix |
|---|---|---|
| **AC** | ~~Every military purchase charged **twice**: `addPlayerPurchases` deducted the cost and then called two helpers that each deduct it again~~ | ~~The caller no longer deducts. The helpers borrow from the player's other territories if this one is short, then charge — once~~ |
| **A** | ~~Upgrade capacity bonuses **compounded**: the multiplier was the *total* buildings built, applied to the already-boosted capacity, on every purchase of any kind — a 5th farm applied +50 %, and a fort re-applied the farm, forest and oil bonuses~~ | ~~+10 % per building **bought in this transaction**, against the capacity the territory had **before** it. The three guards test what was bought, not what has ever been built~~ |
| **B** | ~~A goal whose territory was not found left the sentinel string `"no match"`, which the write-back then wrote into `mainGameArray` — every later arithmetic on that slot came out `NaN`~~ | ~~The sentinel is `null`, and a goal whose territory is not on the map is skipped~~ |
| **C** | ~~`count` was declared **inside** the loop it was meant to count across, so it reset every iteration and `count === 2` was unreachable — the second territory of a Siege or Attack goal was never found~~ | ~~The search stops when both territories are found, by checking the two results rather than a counter~~ |
| **AB** | ~~The AI **substituted** whole elements (`mainGameArray[i] = copy`), orphaning the Phase 1.5 territory index — which holds object references, so every index reader was left looking at the object that used to be in that slot~~ | ~~`Object.assign` into the live element. Identity is preserved, so the index cannot be orphaned. Structurally closed by Phase 4.4~~ |
| **D** | ~~A siege that missed its hit roll did `return`, abandoning the loop and handing `gameTurnsLoop` `undefined` — **one quiet siege cancelled every other siege's turn**~~ | ~~`continue`, pushing `true`: a miss is a quiet turn for that one siege~~ |
| **E** | ~~`unchangeableWarStartCombinedForceDefend` was computed from `totalAttackingArmy`, so all three rout and last-push thresholds compared the defender's remaining force against the **attacker's** starting force~~ | ~~Computed from `totalDefendingArmy`~~ |
| **F** | ~~Starvation sign error: `populationChange` is negative while starving, and subtracting it made the simulated population go **up**, so the "starve the army instead of the civilians" branch never fired during a famine and fired spuriously during growth~~ | ~~`+ populationChange`~~ |
| **G** | ~~Each AI country's turn gains were **re-zeroed on every territory**, so they only ever reflected the last one processed~~ | ~~The whole map is zeroed once per turn, at the top of the income pass; a country's record is created only if absent~~ |
| **H** | ~~`for (country of turnGainsArrayAi)` — an implicit global over a plain object that is not iterable. It threw every time an AI rout resolved~~ | ~~`for (const [countryName, country] of Object.entries(...))`~~ |
| **AF** | ~~`calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory` indexed two arrays of **different lengths** with the same counter. They agree only while a country has lost nothing; the moment it loses a territory, `[j][1]` threw on `undefined` and took the game loop with it~~ | ~~Matched on the territory name, which is what the two entries genuinely share~~ |
| **AG** | ~~Two faults from one assumption — that the world does not change shape during the AI turn. `calculateTurnGoals` threw on an empty threat list (an ordinary state once a country's neighbours are all its own), and `handleAITurn` iterated `arrayOfLeadersAndCountries` by a bare index while conquest **rebuilds that array in place**~~ | ~~A country with no threats plans no goals. The turn *order* is fixed at the start of the phase and each country's index into the live array is resolved fresh, so a country conquered earlier in the same turn takes no turn~~ |

~~**AF through AJ were only reachable once the others were fixed.** Before Phase 3 the AI turn threw
before it got that far, and **B**/**C** meant conquests rarely wrote back to the right slot.
Fixing them let the AI actually take and lose territory — which is what exposed these two.
All four of **AA**, **C**, **AF** and **AG** are the same species: **loop state and loop
subject disagreeing**. It is the most common defect shape in this codebase, and worth
watching for in every phase that follows.~~

### High — logic errors

| Id | Issue | Fix |
|---|---|---|
| **Z** | ~~The country-selection strength gate **could never fire**: `calculateTerritoryStrengths` min-max normalises into 0–10000 and the threshold was 40000, so no country was ever greyed out and the player could start as the United States~~ | ~~The gate is now a **rank**, not a magnitude. Re-scaling the number would only have moved the guess; the intent ("the top few countries are too strong") is a rank. See §4~~ |
| **R** | ~~Per-turn army maintenance was **commented out** — standing armies were free, which removed the principal economic brake and made permanent sieges costless~~ | ~~Re-enabled, with `armyCostPerTurn` re-tuned. See §4~~ |
| **K** | ~~Skirmishes paired **matching unit types only**, so two armies sharing no type produced `totalSkirmishes === 0` and the battle could neither progress nor resolve~~ | ~~A cross-type matchup matrix — refactor 3.15 offered two designs and recommended this one. See §4~~ |
| **P** | ~~`(Math.max(territory.area / 10000000), 1)` — `Math.max` of one argument returns it, the comma operator discards it and yields `1`, so territory **area had no effect on gold income at all**~~ | ~~`Math.max(territory.area / 10000000, 1)`, kept as a floor of 1 so a small territory earns what it used to~~ |
| **I** | ~~Two inner loops used `i`, **shadowing** the territory index, so the post-siege food-capacity reset landed on whichever territory sat at the *war's* index~~ | ~~Renamed to `w` and `k`; ESLint `no-shadow` stops it coming back~~ |
| **J** | ~~`changeDuringAnySiege` was declared outside the loop and set false on first use, so **one besieged territory per turn** got its siege-time processing~~ | ~~The latch is gone — and the branch is now scoped by the same path check as the income branch beside it, without which dropping the latch would have run it 359 times per besieged territory~~ |
| **N** | ~~`activateAiTerritoriesForNewTurn` compared a uniqueId against the **array** rather than `[i][0]`, so AI territories were **never reactivated** after a conquest~~ | ~~Index the entry~~ |
| **O** | ~~Reactivated entries were never removed, so once the counter matched, reactivation **re-fired every turn forever**~~ | ~~Both functions walk backwards and splice the served entry out~~ |
| **L** | ~~`proportionsOfAttackArray` is module-level and was only ever pushed to, so **every battle inherited the retrieval proportions of every battle before it**~~ | ~~Cleared at the top of `setupBattle`~~ |
| **M** | ~~A local `let` shadow discarded the freshly computed probability — it was shown once and thrown away~~ | ~~Assign the module binding~~ |
| **Q** | ~~`selectRandomEvent` can return `"Warehouse Fire"`, but the handler tested for `"Forest Fire"`, so one of the four random events **did nothing** — and worse than nothing, because `randomEventHappening` still suppressed that turn's regeneration and population change~~ | ~~The handler tests for `"Warehouse Fire"`~~ |
| **AJ** | ~~**Starvation drove population and army below zero.** The famine death toll was capped against the combined population but applied to the civilians alone; `starveArmyInstead` let `armyForCurrentTerritory` drift away from the units it summarises (−32,263 on a territory holding 549,615 infantry); and a negative productive population made `Math.log10` return `NaN`, which `goldForCurrentTerritory` then carried forever~~ | ~~Deaths capped at the civilian population too, the army total recomputed from what remains, and a territory with nothing productive left earns nothing rather than `NaN`~~ |
| **AI** | ~~Six territory names carry **real parentheses** — `Andros Island (Bahamas)` and friends — and the siege marker was looked up with `querySelector("#siegeImage_" + name)`. That is not valid CSS, so it **threw** rather than returning null, from inside the per-turn siege sweep~~ | ~~`getElementById`, which takes the id literally. `gameTurnsLoop.js` already did this for the same id; only `ui.js` used a selector~~ |
| **AH** | ~~The battle-results Accept button assumed a **player-initiated** battle. `originalDefendingTerritory` is set only when the player opens one, but the results screen is shared — a siege arrest and an AI attack on the player both raise it — so the first such result of a session threw from a click handler~~ | ~~The handler records nothing when there is no player battle to describe: the war those results show has already been recorded by whoever raised the screen~~ |

---

## 4. The three Phase 3 fixes that are design decisions

~~Most of Phase 3 restores intent. These three had to **choose** it, so the reasoning is
recorded here rather than only in a code comment.~~

### Z — the country-selection gate is a rank

~~Re-scaling `40000` would only have moved the guess, so the gate was measured first. On a
fresh world the normalised strengths run:~~

| | | | | | |
|---|---|---|---|---|---|
| China 10000 | United States 9545 | India 7965 | Indonesia 5697 | Russia 4438 | *then* Italy 3504 |

~~Five is where the superpowers stop.~~ `COUNTRY_GREYOUT_RANK = 5` takes the countries that would
make the game trivial and leaves every genuine mid-sized power — Italy, Germany (rank 8),
Japan (rank 9), the United Kingdom — playable.

~~**This changed the test fixtures.** Seven spec files used Alaska, and therefore the United
States, as "the multi-territory country the player owns". They now use **Hokkaido (Japan)**,
which is a better fixture anyway: it reaches four other Japanese territories and two enemy
ones, where Alaska reached fewer.~~

### K — cross-type skirmishes, with a matchup matrix

~~Refactor 3.15 offered two ways out of the deadlock and recommended this one, because it makes
army composition matter.~~ `UNIT_MATCHUP_EFFECTIVENESS` in [battle.js](../battle.js) scales the
attacker's odds by how effective its unit type is against the one it engages. Same-type values
are `1`, so a conventional battle fights exactly as it always did; an attacker with no
matching opponent engages the type it is best against instead of stalling.

`totalSkirmishes` is now the number of pairings the two armies can make — the smaller of the
two head counts — which is zero only when one side is empty. That is a **resolved** battle
rather than a stalled one, which is the whole point.

### R — maintenance re-enabled, and re-tuned

~~The plan predicted this would "change balance significantly", so it was measured before being
switched on. A territory earns roughly **44–100 gold a turn**. At the original rates:~~

| Country | Starting infantry | Upkeep per turn | Gold in hand |
|---|---:|---:|---:|
| China | 2,472,249 | 1,384 | 48,337 |
| India | 2,146,145 | 1,099 | 48,237 |
| United States | 1,598,712 | 948 | 52,323 |
| Germany | 783,052 | 396 | 23,348 |

~~Every major power would have been bankrupt inside forty turns with no way to respond. At a
tenth of those rates a normal standing army costs about what its territory earns, so **holding**
an army is sustainable and **growing** one is what has to be paid for — which is the brake the
mechanic was for.~~

A territory's gold is now floored at zero when the turn change is applied. Nothing in this
game models debt, and a negative balance would flow straight into the AI's spending
calculations. What an unpayable army *should* cost you is desertion, and that is a Phase 7
design decision — logged in §2 above rather than invented here.

---

## 4b. Closed in Phase 4

~~**AD**, plus four defects found while inverting the SVG relationship. None of the four was
reachable by reading one function: each was a pair of writes that had to agree and did not,
which is the shape Phase 4 exists to remove.~~

| Id | Issue | Fix |
|---|---|---|
| **AD** | ~~**INVADE! never debited the source territory.** The battle ran on copies, so the same garrison could be committed to two attacks in one turn and a failed attack cost nothing~~ | ~~The source is debited at INVADE!. Sieges now hold a territory id, so there is one territory to debit. The army returns through `retrievalArray` on a no-penalty retreat — which had to be made unconditional, because the `battleStart` branch only queued the retrieval for a siege pullout and would otherwise have destroyed the army. `attack/attack-window.spec.js` un-`fixme`d~~ |
| **AB** | ~~The AI substituted whole elements of `mainGameArray`, orphaning the territory index~~ | ~~**Structurally closed.** There is one index, it is the store's own `Map`, and nothing can replace an element: the write-back is `updateTerritory(id, patch)`~~ |
| — | ~~`transferArmyOutOfTerritoryOnStartingInvasion()` computed `armyForCurrentTerritory -= (sum of what remains)`, subtracting the garrison a second time and driving the total negative~~ | ~~It is the sum of the units, so it is an assignment. Only reachable now that the debit runs at all~~ |
| — | ~~`deactivateTerritoryAi()` took a **territory** from the AI and an **SVG path** from `handleWarEndingsAndOptions()`. A path has no `uniqueId` property, so every AI conquest of a player territory pushed `[undefined, n, 0]` onto the deactivation list, deactivated nothing, and left the entry there forever~~ | ~~Accepts either and resolves one id~~ |
| — | ~~`setCountryNameOnPath()` wrote `territory.owner` into `data-name` — the *current owner* attribute. Correct only because an AI country name happens to be both, and wrong the moment the player held the territory~~ | ~~Deleted. Ownership is `setTerritoryOwner(id, owner, country)` and the attributes are rendered from it~~ |
| — | ~~`setMainArrayToArmyRemaining()` wrote the siege survivors back, then wrote them a second time into the siege's own copy — read from `getSiegeObjectFromPath(lastClickedPath)`, a *different* siege from the one passed in~~ | ~~`applySiegeSurvivorsToTerritory()`: one write, no copy, no second lookup~~ |
| — | ~~The AI siege-arrest log printed `undefined's attacking troops` — `attackingTerritory` is a name string, not an object~~ | ~~Uses `attackingCountry`~~ |
| **AL** | ~~**A siege arrest could set a territory's army to `NaN`, permanently.** `handleEndSiegeDueArrest()` restored the defender's four unit types by adding back half the arrested attackers. Three lines read `defendingArmyRemaining[n] + Math.floor(attackingArmyRemaining[n] * 0.5)`; the assault line had the bracket in the wrong place and read `defendingArmyRemaining[1 + Math.floor(...)]` — indexing a four-element array by half the attacker's assault count. Any arrest against an attacker with two or more assault units assigned `undefined`, `armyForCurrentTerritory` came out `NaN`, and every later turn recomputed population, productive population and food consumption from it~~ | ~~The bracket. Found by the ten-turn `long-run` on turn 10, once **AK** stopped it failing on turn 2~~ |
| **AK** | ~~**A siege could set a territory's `foodCapacity` to `NaN`, permanently.** `calculateDamageDone()` declared `collateralDamage` and assigned it in three of four paths: it was left `undefined` when the destroy roll succeeded and the score difference was under 50, which is reachable for any difference in [20, 50) where the destroy probability is 0.3. `foodCapacityDestroyed` then came out `NaN`, and `arrested` came out `false` because `undefined === 0` is false, so the siege could not be arrested either~~ | ~~Computed once, before the branch — every path wanted the same value. `changeDefendingTerritoryStatsBasedOnSiege()` also clamps `foodCapacity` at zero and ignores a non-finite damage figure~~ |

~~**AK** and **AL** are the clearest illustration of what the phase was for. The `NaN` was **always** being
computed; it landed on the siege's own copy of the territory, and the copy-back at the end of a
siege carried only the four building counts, so it never reached the world. Removing the copy
made a five-turn-old bug visible on turn 2 of the ten-turn `long-run` — a spec that has been
green since Phase 3 and that specifically looks for non-finite numbers. Nothing about the
defect changed; the place it could hide did.~~

~~**AL** then came out from behind **AK**: the ten-turn run had never reached turn 10 while **AK**
was failing it on turn 2. Two `NaN`-producing defects, in the same subsystem, neither visible
while the other was in front of it — which is the argument for a characterisation suite that
asserts an invariant over the whole world rather than one number at a time.~~

~~**One defect Phase 4 introduced and fixed before the phase closed**, recorded because the
shape of it will recur in Phases 5 and 6. Converting `colorCountriesRandomly()` from
`path.getAttribute("data-name")` to a store read broke it, because that function runs during
bootstrap — after `svgMapLoaded()` populates `paths`, but before `seedTerritories()` fills the
store. Every path answered `null`, they all grouped into one country, and the whole map came
out a single flat colour with every territory's `countryColor` wrong for the rest of the game.~~

Two things are worth keeping from it:

- **The SVG genuinely is the truth in that window**, because it is what the model is seeded
  from. `state/pathState.js` now reads the attribute while `territoriesReady()` is false, and
  the store once it is true — bounded by readiness rather than by "the lookup returned null",
  so that a missing territory after seeding still surfaces as a bug.
- ~~**225 specs did not notice the map going one colour**, because they all assert on state and
  text.~~ `bootstrap/state-layer.spec.js` now asserts the map has one colour per country, before
  a game starts and after one does.

**What Phase 4 makes impossible**, as opposed to fixed:

- the map and the model disagreeing about ownership, deactivation or siege status — there is
  one fact and the attribute is rendered from it (`bootstrap/state-layer.spec.js`);
- a siege damaging a territory the rest of the game never hears about — the siege references
  the territory rather than copying it;
- two phase counters drifting apart — there is one, and it is an enum;
- a module reassigning another module's game state — the `export let`s that held world state
  are gone.

---

## 5. How the register is used, and how it is kept

### Maintaining this document

- **Keep the `Currently open` list at the top accurate, and keep it to one line per issue.**
  It is the index: a reader who wants to know what is outstanding should not have to read the
  register to find out. Every entry names the issue and the phase that owns it, and nothing
  else — the detail belongs in the section below that owns it.
- **When an issue is closed, DELETE its line from `Currently open`.** Do not strike it through
  there and do not leave it with a "done" marker; the list is only useful if its length is the
  number of open issues. The record of what it was survives in its own section.
- **When an issue is closed, strike through its description in the section that owns it**
  (`~~like this~~`) and say in plain text what closed it and where the code is now. Strike the
  *description of the broken behaviour*, not the explanation of the fix — a reader skimming for
  what is still true should be able to read the un-struck text and get only the present tense.
  The same convention applies to [03-e2e-test-plan.md](./03-e2e-test-plan.md).
- **Add a new issue to both places at once**: a line in `Currently open`, and an entry with its
  detail in the section that will own it.
- **Never renumber an id.** They are cited by the e2e specs and by the refactor plan.
- **Update `Last updated` and the scoreboard** when a phase closes.

### Using the register

- **Before "fixing" something odd, look here first.** If it has an id it is understood and
  sequenced, and fixing it out of order breaks the bisect guarantee (house rule 3).
- **Every 🔴 with a spec has that spec as `test.fixme`.** A phase's job is to flip them green,
  not to invent new expectations. Where the wrong behaviour was worth stating out loud, a
  companion spec characterised what the game did *today*, written to **fail when the defect is
  fixed** — ~~Phase 3 deleted three of those and un-`fixme`d what they guarded~~.
- **A defect without a spec is not "untested by choice".** ~~The areas that used to be
  deferred on the scenario loader are delivered: `siege-offer`, the battle terminal conditions
  and `deactivated-source` (which moved into `conquest-lifecycle/`) all have specs, and
  **D**, **E**, **F** and **K** are asserted in the running game rather than only in the
  rules.~~ What is still deferred is deferred for a stated reason, written down in the README of
  the folder that would own it — never silently.
- **A test MAY now assert an exact combat or economy outcome across runs.** ~~**Y** is closed
  (Phase 5.8): cosmetic randomness lives on its own stream in `src/platform/cosmeticRng.js`,
  so `?seed=` repeats. `battle/rout.spec.js`, `battle/outcomes.spec.js` and the AI determinism
  spec all depend on it.~~ The invariant style is still the right choice where the invariant is
  the more useful thing to state — it is a choice now, not a limit.
- **Those exact-outcome specs pin the whole `Math.random` stream, not just the rule under
  test.** Phase 6 found this the hard way: deleting `generateDistinctRGBs()` — dead decorative
  code, never read — changed how the whole-garrison attack on France resolves, because it drew
  from the game's stream at module load. Four specs moved. **Anything that removes or adds a
  `Math.random` draw anywhere in bootstrap re-baselines those specs**, so it is its own change
  with its own commit, never a tidy-up inside another one. See the `Currently open` entry.

## 6. What Phase 3 made visible

~~Fixing the defects did not only remove crashes — it started the parts of the game that had
never run. Two things are now plainly true that were invisible before, and neither is a defect
to patch:~~

**The AI besieges far more than it can finish.** Measured on a 14-turn playthrough as Germany,
concurrent AI sieges went 17 → 29 → 38 → 46 → 51 → … → 67. New sieges are launched much faster
than existing ones resolve, because a siege only ends on an arrest or a conquest and the AI has
no notion of committing enough force to finish one. Every AI country evaluates every reachable
enemy territory independently, which is exactly what **7.7 — consolidate 206 countries into
8–16 powers** and **7.8 — long-term AI goals** exist to fix.

**A besieged territory earns nothing, and can stay besieged indefinitely.** The player was
besieged on turn 3 of that run and was still besieged on turn 14, with gold frozen at 24,077
the whole time and population grinding down. The income suspension is not a considered rule —
the gold, oil and construction-material lines in the siege branch are commented out under
`//uncomment other features if decided to involve them in sieges`. It is a placeholder that
nobody had reached before, because §5.1 D and §5.2 J meant at most one siege was processed per
turn.

Both belong to the design work in **Phase 7**, and to the GDD rather than this register. They
are recorded here because Phase 3 is what made them observable, and because a player would feel
them long before they would feel any of the arithmetic that Phase 3 corrected.

## 7. Found during Phase 5, deliberately not fixed there

Phase 5 is an extraction, and House Rule 3 says a bug fix does not travel inside a move. These
were all found while lifting the rules out and were left exactly as they were, so that a
regression in the extraction stays bisectable. Each is a one-commit fix on its own.

| Ref | Where | What |
|---|---|---|
| **AM** | ~~[ui.js](../ui.js) `getHistoricWarObject()`~~ | ~~**FIXED in Phase 5.7.** It returned the **string** `"Error - Siege not found in either array in getHistoricWarObject()"` when the siege was not in the historic array, and `removeSiegeImageFromPath()` read `.defendingTerritory.territoryName` off it — `Cannot read properties of undefined`, which escaped the `gameLoop()` promise chain and froze the game on `AI MOVING...`. The `TurnEngine` caught it on the first Phase 5.7 `turn-loop` run, which is what made it reproducible at last. The lookup was never needed: the only thing taken from the siege was the besieged territory's name, and `removeSiegeImageFromPath()` is handed that territory's path — `territory-name` is identity, so it reads it directly. `getHistoricWarObject()` now returns `null` and has no callers.~~ |
| **AN** | [src/rules/economy/population.js](../src/rules/economy/population.js) `planArmyStarvation()` | A famine whose losses **exactly equal** the infantry count falls into the `else` branch for all three vehicle types and destroys the entire mechanised army. `remaining === 0` is not `remaining > 0`, so the partial-loss branch is skipped. Preserved verbatim from `starveArmyInstead()` and commented at the site. Owner: **Phase 7** balance pass. |
| **AO** | [resourceCalculations.js](../resourceCalculations.js) `calculateAllTerritoryCapacitiesForPlayerCountry()` | `playerOwnedTerritories` is appended to on conquest without a duplicate check, and the capacity/demand totals used to count a duplicated path twice for the rest of that turn. ~~Phase 5.2 replaced the nested scan with a `Set` of unique ids, which incidentally **fixes** this — the only behaviour change in the extraction, and it is a strict improvement.~~ Recorded so it is not mistaken for drift. |
| ~~**AP**~~ — **FIXED, battle overhaul B.4; the file it lived in was DELETED at B.10.1** | ~~`src/rules/military/battle.js` `classifyOutcome()`~~ → [src/rules/military/battleModel.js](../src/rules/military/battleModel.js) `classifyBattleState()` | The rout / last-push / attacker-rout thresholds used to be compared against each side's combined force **as it stood at the start of the round**, not after that round's casualties — a full round of lag. The dice model checks one symmetric `BREAK_THRESHOLD` **after** casualties are applied, against each side's own starting force, so the lag is gone by construction rather than by a guard. The five-round skirmish model that carried the defect no longer exists. |
| **AQ** | ~~[resourceCalculations.js](../resourceCalculations.js)~~ | ~~**CLOSED in Phase 5.5.** The initial-data seeding computed the defence bonus as `Math.ceil(f*(f+1)*10) * dev + landlocked`, with the ceiling around the fort term rather than the whole expression — different brackets from the three other sites. It never actually diverged, because `fortsBuilt` is 0 at seeding and both forms then reduce to the land-locked bonus; a fourth copy of the formula is how the divergence would have arrived. It calls the shared `defenseBonusFor()` now.~~ |
| **AR** (description corrected, battle overhaul B.2.6) | [src/rules/military/probability.js](../src/rules/military/probability.js) `areaBonusFor()` | `Math.min(1, MAX_AREA_THRESHOLD / area)` can never exceed 1, so the intended small-territory defence bonus does not exist: every territory at or below the threshold scores exactly 1, and every territory above it is **penalised** instead — the reverse of what the comment and `AREA_BONUS_DAMPENING` describe. Almost certainly a `min`/`max` slip, of a piece with **P** (`Math.max(x), 1` discarding the area term from gold income). **IT IS NOT A ONE-CHARACTER FIX**, which the wording above implied and battle overhaul B.2.6 measured: the ratio is UNBOUNDED as area approaches zero and there is no cap anywhere. A naive `min` -> `max` gives the smallest territory on the map (167 km2) a **1,047x** defence bonus; 296 of 359 territories sit below the threshold, 248 would defend above 2x and 161 above 10x. The documented intent needs a CAP that was never written, and choosing it is a design decision rather than a correction. Measured with the most conservative form (capped at 2x, so at most 1.5x after dampening), over 60 turns on one seed: countries surviving 118 -> 148, largest empire **80 -> 33**, top-sixteen share 65% -> 52%. `tests/unit/rules-military.spec.js` asserts what it does, not what it was meant to do.

**DECIDED at battle overhaul B.10.4, and this row is now a record rather than a to-do.** Leigh's call was to **leave `areaBonusFor()` exactly as it is and correct the description instead**, which is what this entry has become. The reasoning is the measurement above: even the most conservative form of the "fix" is a major balance change (largest empire 80 -> 33 over sixty turns, thirty more countries alive), so applying it as a bug fix would have re-baselined the whole game under the heading of a typo. `probability.js` is byte-for-byte unchanged; the trial was applied, measured and reverted, and the raw series are in `test-reports/ai-sim/ar-baseline.json` and `ar-capped.json`.

What is still open is a DESIGN question and belongs to a balance pass, not here: whether a small-territory defence bonus is wanted at all and, if it is, what caps it. Anyone reopening it should start from those two files rather than from `Math.min`. |

## 8. Closed in Phase 5.8

~~Phase 5 met its exit criteria at 5.7 and still left its own `fixme` list unfinished. 5.8 is
that list, and the defects that finishing it made reachable.~~

### Y — the one that was holding the suite back

| Id | Issue | Fix |
|---|---|---|
| **Y** | ~~**Cosmetic randomness shared the game's RNG stream.** `addSparklesRegularly()` re-armed a timer every 0–100 ms and burned three `Math.random()` draws per tick — interval, top, left — on the same stream the economy, combat and the AI drew from. How many cosmetic draws fell between two game draws depended on wall-clock timing, so two runs of the same seed diverged and **no spec anywhere was allowed to assert an exact combat or economy outcome**~~ | ~~`src/platform/cosmeticRng.js`: a self-contained mulberry32, seeded from the clock, that never touches `Math.random`. The sparkle timer and the battle's dice sound draw from it. Cosmetics are deliberately *not* reproducible — seeding them from the harness would only put the timer back on a stream game logic reads~~ |

~~**What Y was costing.** Not one spec — a whole class of them. With it closed,
`bootstrap/e2e-hook.spec.js`'s "the same seed produces the same world" is green, `ai-turn/`
has the determinism spec the e2e plan calls "the guard that makes every other AI test
possible", and `battle/rout.spec.js` asserts an exact rout outcome twice over. Five functional
areas that had been waiting on it now exist.~~

### Seven found by writing the specs Y unblocked

~~None of these was reachable before: each needed either a run that repeats or a scenario that
sets up a situation clicking cannot reach.~~

| Id | Issue | Fix |
|---|---|---|
| **AS** | ~~**Every fresh battle debited its source territories twice.** Phase 4.7 moved the debit to INVADE! (audit §5.1 **AD**) and added the call without removing the original one in the advance button's `Begin War!` branch. A player committing a whole garrison was left holding a **negative** army — which then fed population, food consumption and defence for the rest of the game, the same shape as **AJ**. A battle resumed from a siege skipped the second debit (`hasSiegedBefore` guarded it), which is why no siege spec ever saw it~~ | ~~The second call is gone. `battle/outcomes.spec.js` asserts the source is charged once and never goes below zero~~ |
| **AT** | ~~**An empty battle-results screen at the start of almost every turn.** `handleEndSiegeDueArrest()` called `setUpResultsOfWarExternal(true)` for *every* arrest, including AI-versus-AI sieges the player has nothing to do with — and only the `!ai` branch ever populated the screen. The AI arrests something nearly every turn, so the player was handed a results screen holding column headers and nothing else, on top of the phase button~~ | ~~The screen is raised only when the player was a party to the siege — besieging, or besieged. An AI siege on a *player* territory that is broken now populates properly instead of being silent~~ |
| **AU** | ~~**The start-of-turn info panel never opened.** `beginTurn()` gated it on `continueSiege === true` as well as on the player's preference, so it was suppressed on any turn where a siege ended in an arrest. That was defensible when at most one siege was processed per turn; once **D** and **J** were fixed and sieges actually ticked, an arrest happened nearly every turn and the preference silently never took effect at all~~ | ~~The gate says what it means. The collision it was avoiding is **AT**, and **AT** is fixed~~ |
| **AV** | ~~**Two siege markers per siege, with the same id.** Phase 4.5 moved marker rendering to `src/ui/siegeOverlay.js` on the `siegeChanged` event and left the imperative `addImageToPath(…, "siege.png", 1)` behind in the siege button handler — and the same again on the AI side in `aiCalculations.js`. Two `<image>` elements, one duplicated id, and only one of them ever removed~~ | ~~Both call sites deleted. The marker is rendered from state, which is what Phase 4.5 was for~~ |
| **AW** | ~~**The siege marker swallowed the click underneath it.** It carried no `pointer-events: none`, so a hit test at the centre of a besieged territory returned the marker rather than the path — and clicking the territory is the player's only route to `VIEW SIEGE`. A besieged territory could not be opened at all~~ | ~~`pointer-events: none` on the overlay, and on anything `addImageToPath()` draws. Same class as `#tooltip`, which the page objects still work around~~ |
| **AX** | ~~**The country-selection lock was enforced by a fill colour.** The confirm button was gated on `country.getAttribute("fill") === GREY_OUT_COLOR`, in a block *outside* the `pathIsGreyedOut()` guard that opens `selectCountry()`. The colour picker repaints, so the lock came off in three clicks — click a locked country, change the colour, click it again — and the player could start as the United States. Measured, not theorised. The five were also painted flat grey, which read as "failed to render" rather than "not available"~~ | ~~The gate reads the store. The picker refuses to repaint a locked country and re-applies the lock after any whole-map restore. Locked countries keep their own hue muted toward grey, and clicking one says why there is no confirm button. `country-selection/locked-countries.spec.js`~~ |
| **AY** | ~~**A territory could be painted `fill="undefined"`, which renders black.** Clicking a playable country and then a locked one un-picked the first through `setColorOnMap(territory)` with no second argument — the *in-game* form, which paints `territory.countryColor`, a field not populated until `pushColorsToMainArray()` runs on confirm. Separately the colour picker's markup value (`#000000`) and the store's default player colour (white) were two facts nothing reconciled, so any `change` on the untouched input adopted black~~ | ~~The call site passes the country-selection form, `setColorOnMap()` refuses to paint a non-colour rather than corrupting the map, and the picker is seeded from `playerColour()` when the selection screen opens~~ |

~~**AS is the one worth remembering.** It is Phase 4.7's own fix, half-applied: the new debit was
added and the old one was left. Nothing caught it for two phases because the only spec that
looked at the source territory looked *during* the battle, where one debit had happened and
the second had not yet. The lesson is the one **AK** and **AL** already taught — a defect
hides wherever no assertion looks, and "the number was right when I checked" is a statement
about *when*.~~

### One more, in the info panel

| Issue | Fix |
|---|---|
| **The active-tab mark never moved.** ~~`active` was added to `summaryButton` once, at game start, and removed from the other three only by the X button — no tab click touched it. `.tab-button.active` is what `style.css` highlights, so the Summary tab looked permanently selected however many times the player switched, and the `mouseout` handler (which asks `classList.contains("active")`) reset the wrong button's colour~~ | ~~`markActiveTab()` — one place writes which tab is selected.~~ Phase 6.3 turns it into `InfoTable.update(state)` |

---

## 9. Closed in Phase 6

~~Phase 6 is a decomposition, not a defect phase, so most of what it closed is
structural — a shape that made a class of bug possible, rather than one bug.~~

### The last 🔴

| Id | Issue | Fix |
|---|---|---|
| **AE** | ~~The attack marker survived a cancel by either route~~ | ~~`src/ui/map/markers.js` owns the target and the marker as one fact. See §1~~ |

### Structural, closed by 6.7

| Issue | Fix |
|---|---|
| ~~Map colour is a **snapshot**, saved and restored from ~30 call sites across five files, with `false` and `"true"` both passed as the same flag~~ | ~~`repaintMap()` derives every path's fill and stroke from `GameState`. `currentMapColorAndStrokeArray` and its four accessors are deleted~~ |
| ~~The country-selection restore lifted the lock off all five locked countries, so `paintLockedCountries()` had to be called after every repaint or the lock came off~~ | ~~`repaintCountrySelection()` states each country's colour as a fact about that country — base colour, muted if locked, player colour if picked — so there is no exception to re-apply~~ |
| ~~`deactivateTerritory()` patched the colour snapshot by hand so a conquered territory would be replayed in the player's colour~~ | ~~Deleted. `setTerritoryOwner()` is what makes the repaint answer "the player"~~ |
| ~~`addImageToPath()`'s `siege === 1` and `siege === 2` branches were dead from Phase 5.8 and still pulled `battle.js` into the marker code~~ | ~~Deleted with the function~~ |

### Structural, closed by 6.6

| Issue | Fix |
|---|---|
| ~~The move button's click handler was **re-created and re-attached on every territory selection**, and `removeEventListener("click", transferAttackClickHandler)` could never remove the previous one because each call built a new function object. Listeners accumulated: one click fired once per selection made since the window opened. `eventHandlerExecuted` plus four `setTimeout(…, 200)` calls were suppressing the symptom~~ | ~~One listener, installed once from bootstrap. The latch and all four timers are gone~~ |
| ~~What the button showed was decided in five blocks that each removed four of five background classes and added a fifth — and no two removed the same set, so the button could carry two backgrounds at once~~ | ~~`deriveMoveButtonState()` is pure and has no DOM in it; `tests/unit/ui-move-button.spec.js` states the whole table of outcomes in Node~~ |

### Structural, closed by 6.8

| Issue | Fix |
|---|---|
| ~~`xButton` was one id on two elements — the info panel's close button and the upgrade window's~~ | ~~`xButtonInfoPanel` and `xButtonUpgrade`. `tests/support/selectors.js` addresses each directly instead of scoping a bare `#xButton` to a container~~ |
| ~~The battle UI's defender-stat strip was eight cells named `battleUIRow4Col2A` through `H` — where they sat, not what they showed~~ | ~~`battleStatsProdPopIcon` / `Value`, `battleStatsFoodIcon` / `Value`, `battleStatsDefenseIcon` / `Value`, `battleStatsMountainIcon` / `Value`. The id, the CSS class and the entry in `BattleUI.js` are one string, so it was one edit in `registry.js` plus the classes in `style.css`~~ |
| ~~The transfer spinner's buttons set `height`/`width` to 20px inline, over a stylesheet that already said 20px — at a higher specificity, so the stylesheet would have looked broken the first time anyone changed it~~ | ~~Inline pair removed; the classes are authoritative~~ |

## 10. Closed in Phase 7.2 / 7.3

| Issue | Fix |
|---|---|
| ~~No save or load — a refresh destroys everything~~ | ~~`src/state/snapshot.js` + `src/platform/storage.js`. A one-minute autosave to `localStorage`, offered as Resume Game on the next visit, and an lz-string-compressed code the player can copy out and paste back~~ |
| ~~No new game or restart without reloading the page — `gameLoop()` recursed forever with no teardown~~ | ~~`TurnEngine.reset()` (Phase 5.7) plus a pristine snapshot captured at bootstrap: Restart is a load. New Game asks first when there is a game to lose~~ |
| ~~The main menu was unreachable once a game started, unless you happened to know Escape opened it~~ | ~~A hamburger button over the map (`src/ui/components/MenuButton.js`), and `setUnsetMenuOnEscape()` split into `openInGameMenu()` / `closeInGameMenu()` so three callers share two transitions~~ |

### AS — the Wars & Sieges tab showed the ATTACKER's flag in the defending-country column

**Reported by the developer during 7.3, fixed in the same pass.**

`src/ui/infoTable/warColumns.js` rendered the *Defending Country* flag from
`war.defendingTerritory.dataName`. `dataName` is the **current owner** of a territory and
changes on conquest — so as soon as the attacker won and took the place, the row describing
that war showed the attacker's own flag on both sides.

This is the `dataName` / `territoryName` / `originalOwner` confusion that CLAUDE.md warns about,
in its most easily missed form: the expression was correct for every row where the territory
had **not** changed hands — every ongoing siege, and every war the attacker lost — and wrong
only on the outcome anybody would actually look back at.

**The fix is to record rather than derive.** A war now carries `defendingCountry`, set when it
is created from the defending territory as it stood at that moment. All three construction
sites in `battle.js` set it: the player-initiated siege and the one-battle historic war both
take it from `getOriginalDefendingTerritory()` — which is a snapshot taken when the battle UI
opens, so it predates any conquest — and the AI siege takes it from the defender, which cannot
have changed hands yet. The column falls back to the old expression for war objects that
predate the field (a siege already in progress, or an older save); those are all *unresolved*
wars, whose territory has not changed hands, so the fallback is right for exactly the cases
that can reach it.

Covered by `tests/e2e/info-panels/wars-tab.spec.js`, which conquers rather than besieging —
asserting the flag on any other outcome would have passed against the bug.

---

### One found during Phase 6 and deliberately NOT fixed

| Issue | Why not |
|---|---|
| `generateDistinctRGBs()` in [src/ui/map/colouring.js](../src/ui/map/colouring.js) is **dead code that is still called**. `ui.js` assigned its result to `colorArray` at module load and never read it — dead since before the refactor began. It cannot simply be deleted: it draws from `Math.random` at module load, on the same stream the economy, combat and the AI read from, so removing it shifts every seeded outcome in the game | **Measured, not assumed.** With the call gone, the whole-garrison attack on France in `conquest-lifecycle/ownership-transfer.spec.js` resolves as a last push rather than an outright victory, and three more exact-outcome specs move with it. That is a balance change, and Phase 6 is a decomposition — behaviour is preserved unless a defect is being fixed deliberately. The draws stay, isolated in one function with the reason written at the site. Removing them and re-baselining the four specs is one Phase 7 change, and doing both together is the only way it stays bisectable. Same species as audit 5.3 **Y**, with the difference that this one IS reproducible, which is why it can wait |

---

## 10b. Closed in Phase 7.8 — the AI's mid-term goals

Five of these are the same species and are worth reading together: **a decision was taken and
then silently discarded by a second rule that could not see the first.** The AI did not lack
intelligence so much as it lacked a chain of custody between deciding and doing.

They were found with `tools/ai-sim.mjs`, a hundred-turn headless playthrough that reports what
the world looks like each turn and, on request, what every AI country was thinking. None of
them has a textual signature: nothing throws, every turn completes, every test passes, and the
map simply stops changing.

### BA — the world froze at 163 countries because 93% of it was forbidden to expand

`choosePosture()` read `if (development < developAt || territories <= smallCountryTerritories)`
→ DEVELOP. This map begins as 207 countries of which the great majority hold one or two
territories, so the second clause disqualified nearly the whole world from expanding — and
never expanding is what kept them at one or two territories. Measured over a hundred turns:
204 countries at turn 1, 163 at turn 100, the largest empire on the map **unchanged at 30
territories**, and on turn 20 a hundred and fifty-three of a hundred and sixty-five countries
sat in DEVELOP with a mean development of 0.355 — well clear of the 0.22 the posture describes.

Being small is now a reason to expand, asking only for a little more economy first
(`developAt × 1.3`). DEVELOP is also time-boxed: a country whose development has not moved in
`developStallTurns` concludes that building is not working and fights instead, which is the
economic half of "recognise a failed approach".

### BB — a fighting posture with a budget of zero attacks

`attackBudget` was `round((1 + territories/10) × postureScale × expansionBias)`, and DEVELOP's
scale of 0.4 rounds one attack to **nought**. So the budget, not the odds, was deciding that
nothing happened. The odds floors are what keep an attack honest; a budget of zero is not
discipline. Every posture but DEFEND now floors at one.

### BC — the planner and the executor fought two different battles

`targeting.js` approved an attack on odds computed from the attacking territory's **whole
garrison**. The executor then sized the actual force as the MEAN of every threat facing the
whole country minus one territory's defence score — not a quantity of anything — and pressed
the attack on `probability >= 1`, a floor the planner would never have accepted. Twelve failed
attacks a turn against two conquests, on the same borders, turn after turn. The AI was not
failing to plan; it was failing to send what it had planned with, and learning nothing from
the difference because the two were never compared. `src/ai/commitment.js` now sizes the force
by asking the real probability function about the force being SENT.

### BD — `setSiege()` threw away sieges the rest of the AI had decided on

A third odds gate, a bare `switch` on leader type inside `setSiege()`, invisible to the
planner and to the commitment layer. The log said "going to start a siege attack on Belgium
from Austria", an army was sized for it, and no siege existed afterwards: **eighty-seven
sieges decided upon across the world in one turn and none laid, for a hundred turns.** Both
places read `siegeDiscipline.leaderOddsModifier` now.

### BE — `calculateArmyMakeupOfAttack()` could hang the browser outright

Every branch of its allocation loop can decline to buy, and every early exit can decline to
fire, whenever the remaining budget falls between two unit costs while the territory holds
only the dearer ones — 3,000 personnel to spend, no assault units at 1,000, air at 5,000 and
naval at 20,000 in stock. Nothing changes, so the next pass makes the same non-decision. A
hundred-turn run froze on turn 61 with **no error of any kind**: the tab simply stopped
responding. Long-standing, and exposed only because the new sizing asks the same question four
times with smaller budgets. A pass that allocates nothing now ends the loop.

### BF — New Game inherited the previous world's AI plans

Nothing called `resetCampaigns()`. Harmless while a campaign was three continent names;
not harmless now that a country also remembers which neighbour it was absorbing and which
borders it had written off, all of which would be applied to a country of the same name in a
world that had never fought those wars. `resetChromeForCountrySelection()` clears both
registers alongside the activity feed and the plan ring it already cleared.

---

## 11. Reported by the developer during Phase 7

### AZ — an AI-versus-AI siege handed the conquered territory to the PLAYER

**Reported by the developer: Russia besieged Estonia, the player was offered a rout, and the
player ended the turn holding Estonia. Not a one-off — territories were arriving in the
player's hands across several games with no battle ever fought for them.**

There are two ways a siege ends: an arrest, and the besieged garrison starving out. The second
is resolved by `calculatePopulationChange()` in [resourceCalculations.js](../resourceCalculations.js),
from the income pass inside `beginTurn()`. It takes an `ai` flag that decides everything about
what happens next — whether the siege is closed through `addRemoveWarSiegeObject()` or
`addRemoveWarSiegeObjectAi()`, whether `routeSiegeUIProcesses()` raises the rout screen, and
which branch of `handleWarEndingsAndOptions()` awards the territory.

**Its caller never worked out what to pass.** `calculateTerritoryResourceIncomesEachTurn()`
declared a bare `let ai;` above both of its loops and assigned it in exactly one place: the
post-siege food-capacity reset in the branch *beside* the siege branch, which is about historic
wars and has nothing to do with the siege being processed. So by the time a besieged territory
was reached, `ai` held whatever an unrelated war had left in it — and on most turns nothing had
written to it at all, so it was still `undefined`.

`undefined` is falsy, and falsy means "the player". Every AI-versus-AI siege that starved its
garrison out therefore resolved down the player's branch:

- `handleWarEndingsAndOptions(2, …, ai = undefined)` ran its `!ai` case-2 body, which ends
  `setTerritoryOwner(uniqueId, "Player", playerCountryName())` — the player was handed a
  territory in a war they were no party to, and credited with the captured survivors;
- `routeSiegeUIProcesses()` raised the rout screen over a siege between two AI countries, which
  is the popup that was reported. Same family as **AT**, which was the arrest-side version of
  the same mistake;
- the siege was removed through `addRemoveWarSiegeObject(1, warId, false)`, which scans the
  **player's** siege list for that `warId`. The siege was in the AI's list, so nothing matched
  and it was never removed — leaving a live siege standing on a territory that had already
  changed hands.

**A second defect sat behind the first**, unreachable while the flag was always falsy: both AI
branches read the besieger as `siegeObject.dataName`. `dataName` is a **territory's** field; a
siege object does not have one. On the rare turn the leaked flag happened to be `true`, the AI
branch called `setTerritoryOwner(uniqueId, undefined)` and the territory was left with no owner
and no country at all. The besieger is `attackingCountry`, which is set when the siege is laid —
the third instance of the `dataName` confusion CLAUDE.md warns about, after **AS**.

**The fix.** Which side is besieging is a property of the siege, and the only honest place to
read it from is the list the siege is in: the siege branch looks the territory up in
`playerSiegeWarsList` first and derives `siegeIsAi` from whether that lookup found anything.
The outer `let ai;` and both of its assignments are gone, so there is nothing left to leak.
`battle.js` reads `siegeObject.attackingCountry` at all three sites that wanted the besieger.

Covered by `tests/e2e/siege/ai-versus-ai-resolution.spec.js` over the
`ai-siege-starves-out` scenario — an AI siege on an AI territory whose garrison is already
inside the rout band with no food and no forts, so the next turn's income pass resolves it.
The spec asserts the territory does not end up with the player, that whoever takes it is a
real country rather than `undefined`, and that the siege is gone from the AI's list. It fails
on all three counts against the old code.
