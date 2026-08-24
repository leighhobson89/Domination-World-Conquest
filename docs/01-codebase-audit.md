# Codebase Audit — Domination: World Conquest

**Audited commit:** `b7ae0af` (branch `master`)
**Date:** 2026-08-23
**Scope:** Full read of all 13 source modules, the SVG map, and the data files.

---

## 1. What this project is

A browser-based, single-player, turn-based world-conquest strategy game. Despite the repo name (`OnlineRiskGame`) there is **no networking, no multiplayer and no server-side game logic** — [app.js](../app.js) is a 20-line Express static file server on port 3000. Everything runs in the browser as ES modules loaded directly from [index.html](../index.html) (no bundler for game code; webpack is only used to pre-bundle `three`, `cannon-es` and `buffer-utils` into `dist/`).

The map is an SVG (`resources/svgMaster.svg`) with **359 `<path>` territories** carrying game state as XML attributes (`uniqueid`, `data-name`, `territory-name`, `owner`, `originalOwner`, `continent`, `isCoastal`, `mountainDefenseFactor`, `underSiege`, `deactivated`, `greyedOut`, `attackableTerritory`). Those 359 territories map onto **207 countries**, each defined in [initialData.js](../initialData.js) (208 entries — `Faroe Islands` has no matching SVG path and is dead data).

---

## 2. Repository inventory

### 2.1 Source files (all at repo root, no `src/`)

| File | Lines | Role |
|---|---:|---|
| [ui.js](../ui.js) | 6,217 | God module: DOM construction, all event wiring, map rendering, zoom/pan, battle UI, siege UI, AI dialogue, flags, colours, turn transitions |
| [resourceCalculations.js](../resourceCalculations.js) | 4,885 | Territory model construction, per-turn economy, buy/upgrade tables and their DOM, UI info table, tooltips |
| [aiCalculations.js](../aiCalculations.js) | 1,858 | AI threat model, goal generation, personality weighting, AI economy/bolster/attack/siege execution |
| [battle.js](../battle.js) | 1,541 | Combat probability, skirmish resolution, war outcomes, siege tick logic, war history |
| [transferAndAttack.js](../transferAndAttack.js) | 1,140 | Transfer/attack table DOM + army-quantity selection |
| [initialData.js](../initialData.js) | 2,704 | Pure data: 208 country records |
| [gameTurnsLoop.js](../gameTurnsLoop.js) | 501 | Game bootstrap, turn loop, phase promises, random events, army retrieval |
| [dices.js](../dices.js) | 485 | Three.js + cannon-es 3D dice — **currently dead code** (call site in `battle.js:processRound` is commented out) |
| [manualExceptionsForInteractions.js](../manualExceptionsForInteractions.js) | 442 | Hand-authored island adjacency add/deny list |
| [cpuPlayerGenerationAndLoading.js](../cpuPlayerGenerationAndLoading.js) | 149 | Random AI leader name/personality generation |
| [leaderPersonalities.js](../leaderPersonalities.js) | 79 | Three personality archetypes (aggressive / balanced / pacifist) with trait ranges |
| [music.js](../music.js) / [sfx.js](../sfx.js) | 63 / 14 | Audio |
| [style.css](../style.css) | 51 KB | All styling, single file |

### 2.2 Directory scaffolding that is completely empty

Created 2025-10-18, never populated — evidence of an abandoned refactor attempt:

```
game/{config,constants,data,state}
mechanics/{army,battle,resources}
ui/{components,core,interactions,map}
utils/{errors,validation}
```

### 2.3 Dead / problem assets

| Item | Issue |
|---|---|
| `DominationWC_0.2.5.zip` | 65 MB binary committed to git |
| `resources/closestPathsData.json` | 19 MB committed data file (see §4.1) |
| `resources/SVG_coastLines - Copy.svg` | Stale duplicate |
| `database_OBSOLETE/` | Self-declared obsolete, still tracked |
| `dist/` | Build output committed |
| `.idea/` | JetBrains config partially committed |
| `tests/` | Contains only `uniqueIdLookup.json` (territory name → uniqueId map — **useful**, keep) |
| `testJest/` | Empty |
| `node_modules/` | Contains `jest`, `puppeteer`, `cypress` remnants **not declared in package.json** |
| `.gitignore` | Ignores `package.json` and `package-lock.json` (both are nonetheless tracked) |

Git pack size is **300 MB** for 377 tracked files. History rewrite is the only way to fix this.

### 2.4 Documentation

**None.** No README, no CLAUDE.md, no comments-as-spec beyond scattered `//TODO`s. The only design artefact is `resources/CodeFlow.drawio(.png)`.

### 2.5 Tests

**None.** `npm test` is `echo "Error: no test specified" && exit 1`. [.vscode/launch.json](../.vscode/launch.json) references `tests/e2eTestSelectCountryDoAttack.js`, a file that no longer exists.

---

## 3. Architecture

### 3.1 Module graph — fully cyclic

```
ui.js  ⇄  resourceCalculations.js  ⇄  battle.js  ⇄  ui.js
  ⇅               ⇅                       ⇅
gameTurnsLoop.js ⇄ aiCalculations.js ⇄ transferAndAttack.js
```

Every core module imports every other core module. Three modules work around the resulting `undefined` bindings with an **explicit 1-second `setTimeout` before a dynamic `import()`**:

- [battle.js:49](../battle.js#L49) → `transferAndAttack.js`
- [transferAndAttack.js:38](../transferAndAttack.js#L38) → `battle.js`
- [manualExceptionsForInteractions.js:11](../manualExceptionsForInteractions.js#L11) → `resourceCalculations.js`

This is a race condition dressed as a solution. On a slow load, `manualExceptionsForInteractions` builds its exception map from an empty `mainGameArray`, so every key resolves to `undefined`, the whole `Map` collapses to a single `undefined` entry, and **all island adjacency exceptions silently stop working** — Fiji / Vanuatu / New Caledonia and similar become unreachable or wrongly reachable. This is a strong candidate for part of "it doesn't play very well".

### 3.2 State model — three overlapping sources of truth

Territory state exists simultaneously in:

1. **`mainGameArray`** ([resourceCalculations.js:44](../resourceCalculations.js#L44)) — array of 359 plain objects, exported as a mutable `let` and mutated by every module.
2. **SVG path attributes** — `owner`, `data-name`, `underSiege`, `deactivated`, `greyedOut`, `attackableTerritory`, plus inline `style.stroke` / `fill`.
3. **Siege / war objects** — `playerSiegeWarsList`, `aiSiegeWarsList`, `historicWars`, `historicAiWars` each hold **copies** of `defendingTerritory` that must be manually synced back (`setMainArrayToArmyRemaining`, `changeDefendingTerritoryStatsBasedOnSiege`, `starveArmyInstead`, …).

[gameTurnsLoop.js:normalizeSiegeState()](../gameTurnsLoop.js#L69) exists purely to re-reconcile (2) against (3) at the top of every turn — a band-aid confirming the model does not hold.

There are **two independent turn-phase variables**: `ui.js:turnPhase` and `gameTurnsLoop.js:currentTurnPhase`, kept in sync by hand via `modifyCurrentTurnPhase()`.

### 3.3 Mutable exported bindings

`export let` is used pervasively for game state (`mainGameArray`, `playerCountry`, `currentTurn`, `paths`, `playerSiegeWarsList`, `attackingArmyRemaining`, ~40 more in `battle.js` alone). Consumers mutate them through setter functions, so **data flow is untraceable statically**.

### 3.4 Import-time side effects

[resourceCalculations.js:167](../resourceCalculations.js#L167) kicks off the entire territory-model construction at module evaluation time, gated by a `setInterval` polling `pageLoaded` every 800 ms. Nothing can be imported in isolation — which is why unit testing is currently impossible.

### 3.5 God functions / god blocks

| Location | Size | Contents |
|---|---:|---|
| [ui.js:563](../ui.js#L563)–~2866 | ~2,300 lines | A single `DOMContentLoaded` handler that imperatively builds **the entire application UI** — menu, popups, top table, AI dialogue, battle UI, battle results, transfer/attack window, buy/upgrade windows, UI info table, tabs — and wires every listener |
| [resourceCalculations.js:1249](../resourceCalculations.js#L1249) `drawUITable` | ~920 lines | Four different tables behind one `summaryTerritoryArmySiegesTable` integer flag, with a 16-case `switch` per column repeated for each mode |
| [transferAndAttack.js:61](../transferAndAttack.js#L61) `drawAndHandleTransferAttackTable` | ~710 lines | Transfer and attack tables behind one boolean |
| [ui.js:3769](../ui.js#L3769) `handleMovePhaseTransferAttackButton` | ~300 lines | Button state machine + nested click handler + tooltip wiring, re-registered on every call |
| [aiCalculations.js:692](../aiCalculations.js#L692) `doAiActions` | ~165 lines | 4-case switch, each case inlining the full economy/military pipeline |

Across `ui.js` + `resourceCalculations.js` + `transferAndAttack.js` there are **294 `createElement` calls and 239 `innerHTML` assignments**, with styling set inline in JS as well as in `style.css`.

### 3.6 Rendering approach

No framework, no templating, no virtual DOM. Every UI update is a targeted `getElementById(...).innerHTML = ...` or a full `innerHTML = ""` + rebuild. Element IDs are positional and numeric (`battleUIRow4Col2A`…`battleUIRow4Col2H`, `aiDialogueBoxBottomSummaryRowCol1`…`Col8`), and table cells are addressed by index (`document.getElementById("top-table").rows[0].cells[3]`), so any layout change silently breaks logic.

---

## 4. Performance

### 4.1 Game initialisation re-parses a 19 MB JSON once per territory — the headline problem

[aiCalculations.js:121](../aiCalculations.js#L121) `readClosestPointsJSON(uniqueId)` does:

```js
fetch('./resources/closestPathsData.json')
  .then(r => r.text())
  .then(JSON.parse)
  .then(data => data.find(entry => entry[0] === uniqueId.toString()))
```

[gameTurnsLoop.js:initialiseGame()](../gameTurnsLoop.js#L160) calls it **once per territory, sequentially, awaited**:

```js
for (let i = 0; i < mainGameArray.length; i++) {   // 359 iterations
    ... await findAllInteractableTerritoriesOnGameLoad(i);
}
```

That is **359 × 19 MB ≈ 6.8 GB of JSON text parsed** before the first turn, plus 359 linear scans. This is the "loading" phase where territory names tick past on the move-phase button. Fixing this to a single fetch + `Map` build is the single highest-value change in the repo, and it is a **hard prerequisite for any automated end-to-end testing**.

### 4.2 Other hot spots

- [resourceCalculations.js:calculateTerritoryResourceIncomesEachTurn](../resourceCalculations.js#L522) — nested `for (path of paths) { for (i of mainGameArray) { … } }` = ~129,000 iterations per turn, each doing further linear scans of `historicWars` / `historicAiWars` / `Object.values(playerSiegeWarsList).some(...)`.
- Every lookup in the codebase is a linear scan (`for … if (uniqueId === …) break`). There is no index from `uniqueId` → territory or → path. `tests/uniqueIdLookup.json` shows the idea existed but is unused by the game.
- `handleAITurn` iterates **every AI country** (up to 206) each turn, running the full threat/goal/action pipeline per country.
- `calculatePathAreas()` samples 80 points per path via `getPointAtLength` for 359 paths on every page load; the result is deterministic and could be precomputed.
- `paths` and DOM queries are re-derived repeatedly rather than cached.

---

## 5. Defects found during audit

Ordered by likely gameplay impact. Line numbers are against commit `b7ae0af`.

### 5.1 Critical — corrupts game state

**A. Upgrade capacity bonuses compound catastrophically** — [resourceCalculations.js:4331](../resourceCalculations.js#L4331)

```js
mainGameArray[i].farmsBuilt += parseInt(upgradeArray[0]);
if (mainGameArray[i].farmsBuilt > 0) {
    mainGameArray[i].foodCapacity += mainGameArray[i].foodCapacity * ((territory.farmsBuilt * 10) / 100);
}
```

`territory` **is the same object** as `mainGameArray[i]`, and `farmsBuilt` has already been incremented. So the multiplier applied is the *total* farms built, *every time any upgrade is purchased*, and it compounds on the already-boosted capacity. Buying a 5th farm applies +50 %, not +10 %. Identical bugs for forests → `consMatsCapacity`, oil wells → `oilCapacity`. The `if (… > 0)` guards mean an unrelated fort purchase also re-applies the farm/forest/oil bonuses. **This is the most likely cause of the "territories jump to 520k after clicking them" symptom noted in commit `b0a1f7a`.**

**B. AI writes the literal string `"no match"` into `mainGameArray`** — [aiCalculations.js:836](../aiCalculations.js#L836)

`mainArrayFriendlyTerritoryCopy` / `mainArrayEnemyTerritoryCopy` are initialised to `"no match"`. The post-action write-back loop assigns them into `mainGameArray[i]` unconditionally, so a goal whose territory was not found replaces a territory object with a string. Every later `.armyForCurrentTerritory` on it is `undefined` → `NaN` propagation.

**C. `count` is re-declared inside the loop it is meant to count across** — [aiCalculations.js:709](../aiCalculations.js#L709) and [:836](../aiCalculations.js#L836)

```js
for (let i = 0; i < mainGameArray.length; i++) {
    let count = 0;              // resets every iteration
    ...
    count++;
    if (count === 2) break;     // unreachable
}
```

Both the "find the two territories for this goal" loop and the write-back loop never terminate early as intended, so for Siege/Attack goals only the *first* matching branch ever fires and the second territory is left as `"no match"` — feeding directly into defect B.

**D. One quiet siege cancels every other siege's turn processing** — [battle.js:1140](../battle.js#L1140) and [:1185](../battle.js#L1185)

```js
for (const key in playerSiegeWarsList) {
    ...
    if (!damage) { return; }        // returns undefined from the whole function
```

A single siege that fails its hit roll aborts the loop and returns `undefined`. `gameTurnsLoop` then does `if (continueSiegeArrayPlayer) { … }`, so **all** remaining sieges are skipped that turn. Should be `continue` (and push `true`).

**E. `unchangeableWarStartCombinedForceDefend` is computed from the attacking army** — [battle.js:352](../battle.js#L352)

```js
unchangeableWarStartCombinedForceAttack = calculateCombinedForce(totalAttackingArmy);
unchangeableWarStartCombinedForceDefend = calculateCombinedForce(totalAttackingArmy);  // bug
```

All three rout / last-push thresholds in `processRound` (`< 0.05 ×`, `< 0.15 ×`) compare the defender's remaining force against the *attacker's* starting force. Battle outcomes are therefore wrong whenever the two armies differ in size — which is almost always.

**F. Starvation sign error** — [resourceCalculations.js:864](../resourceCalculations.js#L864)

```js
const simulatedProductiveTerritoryPop =
    ((((territory.territoryPopulation - populationChange) / 100) * 45) * devIndex)
    - territory.armyForCurrentTerritory;
```

`populationChange` is **negative** when starving, so subtracting it *increases* the simulated population — the "starve the army instead of the civilians" branch never triggers during actual starvation, and can trigger spuriously during growth.

**G. AI per-turn resource gains are reset to zero on every territory** — [resourceCalculations.js:612](../resourceCalculations.js#L612)

```js
turnGainsArrayAi[countryName] = { changeGold: 0, ... };   // fresh object, then +=
turnGainsArrayAi[countryName].changeGold += changeGold;
```

Assignment happens *inside* the per-territory loop, so each AI country's turn gains only ever reflect its last-processed territory. This matches the known-issue note in commit `b0a1f7a` ("capacities and demands per turn for ai players not calculated yet").

**H. `for (country of turnGainsArrayAi)` — throws** — [battle.js:522](../battle.js#L522)

Missing `const`/`let` (implicit global, and a `ReferenceError` under a module's implicit strict mode) *and* `turnGainsArrayAi` is a plain object, not iterable. This line throws whenever an AI rout resolves through `handleWarEndingsAndOptions(2, …, ai=true, …)`.

**AA. The AI turn crashes on a shortened goal list and freezes the game permanently** — [aiCalculations.js:864](../aiCalculations.js#L864) *(found in Phase 2.2, by `turn-loop/long-run.spec.js`)*

`determineResourcesAvailableForThisGoal` iterates `refinedTurnGoals` by index, and **reassigns
the array it is iterating** from inside that loop:

```js
for (let i = 0; i < refinedTurnGoals.length; i++) {           // i bound by the OLD length
    ...
    refinedTurnGoals = refinedTurnGoals.filter(item => item !== matchingElement);   // shorter now
    ...
    if (proportionsPercentageArray[j][0][1] === refinedTurnGoals[i][1] && …)        // undefined
```

The filter drops every Bolster goal whose mean infantry deficit is negative. Once it removes
an element at or before `i`, the last index of the original array no longer exists, and
`refinedTurnGoals[i][1]` throws
`TypeError: Cannot read properties of undefined (reading '1')`.

**The consequence is worse than the exception.** `doAiActions` is awaited by `handleAITurn`,
which is awaited by the `handleBuyUpgradePhase().then(…)` chain in `gameLoop`. Nothing catches
it, so the rejection propagates out of the chain, `currentTurn++` never runs, `gameLoop()`
never recurses, and **the game stops dead** — the phase button stays on `AI MOVING...`
(disabled) forever and the only way out is a page reload.

Reproduced deterministically on a clean start as Germany with no player action: the crash
lands somewhere between turn 4 and turn 7 depending on the RNG stream. It is not rare — it is
the reason a long unattended game appears to hang.

The fix is to iterate a snapshot and rebuild the goal list once at the end, rather than
mutating mid-loop. Worth doing alongside §5.1 C, which is the same "loop state and loop
subject disagree" mistake in the same file.

Covered by `tests/e2e/turn-loop/long-run.spec.js`, currently `test.fixme`.

**AC. Every military purchase charges the player twice** — [resourceCalculations.js:4634](../resourceCalculations.js#L4634) *(found in Phase 2.3, by `buy-military/purchase.spec.js`)*

`addPlayerPurchases` deducts the cost from the territory:

```js
mainGameArray[i].goldForCurrentTerritory -= totalGoldCost;
mainGameArray[i].productiveTerritoryPop -= totalProdPopCost;
```

and then calls the two "borrow from my other territories if this one is short" helpers:

```js
checkForMinusAndTransferMoneyFromRichEnoughTerritories(territory, totalGoldCost);
checkForMinusAndTransferProdPopFromPopulatedEnoughTerritories(territory, totalProdPopCost);
```

Each of those helpers ends with an **unconditional** deduction of its own, outside the
`if (short)` branch that is the reason the function exists:

```js
territory.goldForCurrentTerritory = Math.max(0, territory.goldForCurrentTerritory - goldCost);
```

`territory` is the same object as `mainGameArray[i]`, so the cost comes off twice. Measured:
2 assault units quote 100 gold and 2,000 productive population in the buy window, and cost
**200 gold and 4,000 productive population**. The units delivered are correct — only the price
is wrong, and the window's own quote is the honest one.

`addPlayerUpgrades` does **not** call these helpers, so building costs are charged correctly.
That asymmetry is why the bug survived: the same window pattern behaves differently in the two
cases.

The fix is to move each trailing deduction inside its `if`, or (better) to have the helpers
only transfer and let the single caller do the one deduction. `Math.max(0, …)` also silently
swallows the overdraft, which is why the player never sees a negative balance and never
notices.

**AB. The AI replaces whole `mainGameArray` elements, orphaning the territory index** — [aiCalculations.js:774](../aiCalculations.js#L774) *(found in Phase 2.2, while writing the per-turn income specs)*

The AI write-back does not mutate a territory, it **substitutes** it:

```js
mainGameArray[i] = mainArrayFriendlyTerritoryCopy;
```

`buildTerritoryIndex(mainGameArray)` runs once at bootstrap and stores **object references**.
The moment an element is replaced, the index still points at the object that used to be in
that slot. From then on `getTerritoryByUniqueId()` / `getTerritoryByName()` return a territory
frozen at the instant the AI last touched it, while every `for (… mainGameArray …)` loop —
including the whole per-turn income pass — reads and writes the new object.

Measured on a clean start as Germany: turn 2's income is applied and is visible through the
index; after turn 2's AI phase the index goes stale, and turn 3's income is applied to the
live array but invisible to every index reader. The game's own
`territoryByUniqueId()` in `resourceCalculations.js` reads through that index, so this is not
a test-only problem — it is two divergent views of the same territory inside the running game.

**The player can see it.** `addUpAllTerritoryResourcesForCountryAndWriteToTopTable` totals the
player's resources by looking each territory up through the index, so from the first AI turn
onward the headline figures in the top table can disagree with the sum of the territories the
game is actually simulating. `turn-loop/long-run.spec.js` asserts the two agree, passes before
the first AI turn, and is `test.fixme` after it.

This compounds §5.1 B and C: the `count` bug means the substitution frequently lands on the
**wrong** slot, so the index and the array can end up describing different territories
entirely.

Two things follow:

1. The `?e2e=1` accessor now scans `mainGameArray` directly instead of using the index, so the
   harness always reports the live model. Done in Phase 2.2 — a test-only accessor, not a
   change to game behaviour.
2. The real fix is **Phase 4**: with `GameState.territories` as a `Map` and mutations going
   through one writer, substituting an object becomes impossible. Until then, treat any index
   read after an AI turn as suspect, and fix §5.1 B/C first so the substitution at least hits
   the right slot.

**AF. The AI indexes two arrays of different lengths with the same counter** — [aiCalculations.js:231](../aiCalculations.js#L231) *(found in Phase 3, by the ten-turn `long-run` spec)*

`calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory` walks
`fullTerritoriesInRange` with `j` and reads `arrayOfAiPlayerDefenseScoresForTerritories[j]`
out of the other array with the same `j`. The two are not the same length:

- `buildFullTerritoriesInRangeArray` returns one entry per territory in
  `arrayOfLeadersAndCountries[i][2]`.
- `getFriendlyTerritoriesDefenseScores` returns one entry only for those whose `dataName` is
  still the country taking its turn.

They agree exactly while a country has lost nothing. The moment it loses a territory the
defence array is shorter, `[j]` runs off the end, and `[j][1]` throws on `undefined`. The
rejection escapes the `gameLoop()` promise chain, so the failure mode is the same as
§5.1 AA: the game freezes on `AI MOVING...`.

**This did not surface before Phase 3** because §5.1 AA killed the AI turn earlier, and
§5.1 B/C meant conquests rarely wrote back to the right slot. Fixing those exposed it — the
AI now actually takes and loses territory. Fixed by matching on the territory name, which is
what the two entries genuinely share.

**AG. An AI country with nothing to do crashes the turn** — [aiCalculations.js:298](../aiCalculations.js#L298) and [gameTurnsLoop.js:404](../gameTurnsLoop.js#L404) *(found in Phase 3, by the ten-turn `long-run` spec)*

Two faults with one cause: the AI turn was written on the assumption that the world never
changes shape during it.

1. `calculateTurnGoals` reads `sortedThreatArrayInfo[0][2].leader.traits` without checking
   that there is a `[0]`. Every goal is derived from a threat, so a country with no
   attackable enemy territory in range produces an empty list — which is an entirely
   ordinary state once the AI can conquer, because a country whose neighbours are now all
   its own has no enemy in range. It threw instead.
2. `handleAITurn` iterates `arrayOfLeadersAndCountries` by a bare index, but conquering a
   territory calls `updateArrayOfLeadersAndCountries()`, which **rebuilds that same array in
   place** — clearing it and pushing a fresh set, with any eliminated country simply absent.
   A conquest during one country's turn therefore shifts every later entry: countries get
   skipped or move twice, and once the list shrinks past the cursor
   `arrayOfLeadersAndCountries[i][2][0]` throws.

Fixed by returning no goals for a country with no threats, and by fixing the turn *order* at
the start of the phase while resolving each country's index into the live array fresh. A
country conquered earlier in the same turn now takes no turn, which is the correct rule
rather than a workaround.

Both AF and AG are the same species as §5.1 AA and §5.1 C: **loop state and loop subject
disagreeing**. It is the single most common defect shape in this codebase.

### 5.2 High — logic errors

**I. Loop-variable shadowing in the per-turn income loop** — [resourceCalculations.js:565](../resourceCalculations.js#L565)

```js
for (let i = 0; i < mainGameArray.length; i++) {
    ...
    for (let i = 0; i < historicWars.length; i++) {
        if (historicWars[i].defendingTerritory.uniqueId === defendingTerritoryId && ...) {
            mainGameArray[i].foodCapacity = historicWars[i].startingFoodCapacity;   // wrong i
```

The inner `i` shadows the outer, so the post-siege food-capacity reset is applied to whichever territory happens to sit at the *war's* index in `mainGameArray`. Same bug in the `historicAiWars` loop immediately below.

**J. `changeDuringAnySiege` is latched off after the first siege** — [resourceCalculations.js:640](../resourceCalculations.js#L640)

Declared once outside the loop and set to `false` on first use, so **only one besieged territory per turn** gets its siege-time food/population processing.

**K. Same-unit-type-only skirmishes can deadlock a battle** — [battle.js:700](../battle.js#L700)

Skirmishes only occur between matching unit types (infantry↔infantry, naval↔naval, …). `skirmishesPerType = min(attacker[t], defender[t])`; if the two armies share no unit type, `totalSkirmishes` is 0, `skirmishesPerRound` is 0, and the battle can neither progress nor resolve.

**L. `proportionsOfAttackArray` is never cleared** — [battle.js:73](../battle.js#L73)

Module-level array that is only ever `push`ed to in `setupBattle`. Retrieval proportions from previous battles leak into subsequent ones.

**M. Local shadow discards the freshly computed probability** — [battle.js:740](../battle.js#L740)

```js
let updatedProbability = getUpdatedProbability();   // shadows module binding
setAttackProbabilityOnUI(updatedProbability, 1);
```

**N. `activateAiTerritoriesForNewTurn` compares an object to an array** — [battle.js:645](../battle.js#L645)

```js
if (mainGameArray[j].uniqueId === aiTurnsDeactivatedArray[0])   // missing [i][0]
```

Always false, so **AI territories are never reactivated** after conquest.

**O. Deactivation counters never reset** — [battle.js:639](../battle.js#L639)

Both activate functions increment `[i][2]` until it equals `[i][1]`, then reactivate — but the entry is never removed from the array, so it re-fires every subsequent turn forever.

**P. Misplaced parenthesis neutralises area in gold income** — [resourceCalculations.js:750](../resourceCalculations.js#L750)

```js
const goldIncome = (Math.max(territory.area / 10000000), 1) * parseFloat(territory.devIndex) * ...
```

`Math.max(x)` returns `x`, then the comma operator discards it and yields `1`. Territory area
therefore has **no effect at all** on gold income, despite clearly being intended to.

**Q. The `Warehouse Fire` random event is unreachable** — [resourceCalculations.js:690](../resourceCalculations.js#L690) vs [gameTurnsLoop.js:378](../gameTurnsLoop.js#L378)

`selectRandomEvent()` can return `"Warehouse Fire"`, but `calculateConsMatsChange` tests for
`randomEvent === "Forest Fire"`. One of the four random events silently does nothing — and,
because `randomEventHappening` still suppresses normal regeneration and population change,
it does *worse* than nothing: it costs the player a turn of growth for no narrative payoff.

**R. Per-turn army maintenance is commented out** — [resourceCalculations.js:583](../resourceCalculations.js#L583)

```js
changeGold = calculateGoldChange(mainGameArray[i], false, false);
// changeGold -= calculateArmyMaintenanceCostPerTurn(mainGameArray[i]);
```

`calculateArmyMaintenanceCostPerTurn` is fully implemented and is used during initial army
sizing, but never during play. Standing armies are free, which removes the principal economic
brake on militarisation and makes permanent sieges nearly costless.

**Z. The country-selection strength gate can never fire** — [ui.js:175](../ui.js#L175) vs [resourceCalculations.js:4706](../resourceCalculations.js#L4706) *(found in Phase 2.2, by the spec written for it)*

`greyOutTerritoriesForUnselectableCountries()` greys a country when its strength exceeds
`COUNTRY_GREYOUT_THRESHOLD = 40000`. But `calculateTerritoryStrengths()` returns
**min-max normalised** values:

```js
const normalizedValue = (strengthValue - minStrength) / (maxStrength - minStrength) * 10000;
```

so the strongest country in the world scores exactly `10000` and every other country scores
less. `strength > 40000` is therefore never true, **no country is ever greyed out**, and the
player can start as the United States or China. The trailing `//40` in the threshold's own
comment suggests the constant predates the normalisation and was never re-scaled.

Consequences: `greyedOut` is `"false"` on all 359 paths for the whole selection screen; the
`setAllGreyedOutAttributesToFalseOnGameStart()` sweep is a no-op; and the branch of
`selectCountry()` that withdraws the confirm button for a grey fill is dead code.

The fix is a decision, not just an edit — pick the intended percentile (the comment implies
the top few countries) and express the threshold in the same units the normaliser produces.
Covered by `tests/e2e/country-selection/greyed-out.spec.js`, currently `test.fixme`.

**AH. The battle-results Accept button assumes a player-initiated battle** — [battle.js:1068](../battle.js#L1068) *(found in Phase 3, by the ten-turn `long-run` spec)*

`originalDefendingTerritory` is set in exactly one place: the setup of a battle **the player
opened**. The results screen is shared, though — a siege arrest raises it through
`handleEndSiegeDueArrest`, and so does an AI attack on the player — and its Accept button runs
the same handler either way:

```js
addWarToHistoricWarArray(getResolution(), warId, false);
```

which begins

```js
let defendingTerritoryCopy = getOriginalDefendingTerritory();   // undefined
let strokeColor = getStrokeColorOfDefendingTerritory(defendingTerritoryCopy);   // throws
```

So the first battle result of a session that the player did not themselves start throws
`Cannot read properties of undefined (reading 'uniqueId')` from a click handler. The war those
results describe has already been recorded by whoever raised the screen, so there is nothing
for this handler to add.

**Reachable only from Phase 3 onwards.** Before it, §5.1 AA killed the AI turn before the AI
ever attacked the player, so the shared screen was only ever raised by the player's own
battles. `addRemoveWarSiegeObject` reads the same value without a guard and is fixed with it;
`getStrokeColorOfDefendingTerritory` now returns `""` rather than falling off the end.

**AI. Six territory names cannot be used in a CSS selector** — [ui.js:4253](../ui.js#L4253) and [:4278](../ui.js#L4278) *(found in Phase 3, by the ten-turn `long-run` spec)*

The siege marker is looked up by an id built from the territory name:

```js
const formattedTerritoryName = territoryName.replace(/\s+/g, "_");
const imageElement = svgMap.querySelector("#siegeImage_" + formattedTerritoryName);
```

Spaces become underscores, but **parentheses are left as they are** — and several names in
`svgMaster.svg` legitimately carry them: `Andros Island (Bahamas)`,
`Grand Bahama (Bahamas)` and their neighbours. `#siegeImage_Andros_Island_(Bahamas)` is not
valid CSS, so `querySelector` **throws** rather than returning `null`:

```
SyntaxError: Failed to execute 'querySelector' on 'Document':
'#siegeImage_Andros_Island_(Bahamas)' is not a valid selector.
```

It surfaced from the per-turn siege sweep, which means it took the AI turn — and therefore
the game loop — with it. Fixed by using `getElementById`, which takes the id literally and
needs no escaping. `gameTurnsLoop.js` already did that for the same id; only `ui.js` used a
selector.

**A second instance of the CLAUDE.md gotcha**: those parentheses are real, not typos, and
anything that treats a territory name as syntax has to account for them. §5.3 X was the
first.

**AJ. Starvation drives population, and the army, below zero** — [resourceCalculations.js:960](../resourceCalculations.js#L960) and [:1024](../resourceCalculations.js#L1024) *(found in Phase 3, by the ten-turn `long-run` spec)*

Three related faults, all of which only became reachable once §5.1 F made starvation actually
starve.

1. **The famine death toll is capped against the wrong total.**

   ```js
   populationChange = -Math.min(foodShortage * deathRate, currentPopulation);
   ```

   `currentPopulation` counts the army as well as the civilians — infantry plus each vehicle
   at its personnel worth — but the change is applied to `territoryPopulation`, the civilian
   figure, alone. A famine could therefore kill more civilians than the territory had.

2. **`starveArmyInstead` lets `armyForCurrentTerritory` drift.** Its second branch zeroes the
   infantry and eats into the vehicles but never touches the total those numbers are supposed
   to summarise. Measured on the Cayman Islands at turn 4: `armyForCurrentTerritory` of
   **−32,263** on a territory still holding **549,615** infantry.

3. **A negative population makes gold `NaN`, permanently.**

   ```js
   const populationScalingFactor = Math.log10(territory.productiveTerritoryPop + 1);
   ...
   goldChange = Math.ceil(goldIncome / modifier) * 0.2;
   ```

   `Math.log10` of a negative is `NaN`, and `NaN` in `goldForCurrentTerritory` never recovers —
   every later turn adds to it. At exactly zero productive population the same line divides by
   zero instead. Observed as `Montserrat.goldForCurrentTerritory = NaN` and
   `Cayman Islands.goldForCurrentTerritory = NaN`.

Fixed by capping the deaths at the civilian population as well, recomputing
`armyForCurrentTerritory` from the units that remain, and treating a territory with nothing
productive left as earning nothing rather than `NaN`. `territoryPopulation` is floored at zero
where the turn change is applied, in both the ordinary and the under-siege branch.

**The wider point:** §5.1 F was a one-character fix, and it turned a branch that had never
executed into one that executes routinely. Every defect downstream of a dormant code path is
invisible until that path wakes up — which is the argument for the ten-turn run existing at
all.

### 5.3 Medium — fragility and correctness risk

**AD. INVADE! never debits the source territory** — [battle.js:330](../battle.js#L330) *(found in Phase 2.3, by `attack/attack-window.spec.js`)*

The e2e plan (§5.9) specifies that committed units leave their source territory the moment the
invasion launches — that is what stops a player committing the same garrison to two attacks in
one turn. Measured, the source territory's infantry and army counts are **completely
unchanged** while the battle runs, and still unchanged a second and a half later. The battle
works on its own copies of both armies (§3.2 — state in three places at once) and the source is
reconciled only when the war resolves.

Whether "immediately" is the right design is a genuine question, not just a bug. It is settled
at **Phase 4.7**, which makes siege and war objects hold a territory id rather than a copy;
the intended behaviour is `test.fixme` until then, with today's behaviour characterised beside
it.

**AE. The attack marker survives a cancel** — [transferAndAttack.js](../transferAndAttack.js) *(found in Phase 2.3, by `attack/attack-window.spec.js`)*

Cancelling an attack by either route — the window's X button, or the move button's CANCEL —
returns the committed units but leaves the attack marker drawn on the target. It is the marker
half of the map-state desync described in this section: colour and markers are pushed onto the
SVG imperatively from ~30 call sites rather than derived from state. **Phase 6.7** removes the
class of bug by making markers a pure function of state.


- **Map colour state**: colour is snapshotted into `currentMapColorAndStrokeArray` and restored from ~30 call sites with a boolean/string parameter (`saveMapColorState(false)` vs `saveMapColorState("true")` — both truthy in one call path). Colour desync is a known symptom ("all sieged territories of ai go white").
- **`gameLoop()` recurses infinitely** ([gameTurnsLoop.js:250](../gameTurnsLoop.js#L250)) — each turn nests another promise chain. No unwinding, no cancellation, no way to end or restart a game.
- **Bootstrap ordering is timing-luck**: [ui.js:746](../ui.js#L746) awaits `initialiseGame()` (which itself starts `gameLoop()` without awaiting) and *then* runs `createCpuPlayerObjectAndAddToMainArray()` and `addRandomFortsToAllNonPlayerTerritories()`. Turn 1's economy therefore runs before leaders and forts exist.
- **`mainGameArray` is re-sorted by `defenseBonus`** immediately after construction ([resourceCalculations.js:445](../resourceCalculations.js#L445)), which is only safe because every consumer scans linearly by `uniqueId`. Any future index-based access will silently break.
- **`eventHandlerExecuted` + `setTimeout(…, 200)`** is used as a click de-bounce across the move-phase button — timing-based, not state-based.
- **No error handling**: `try/catch` appears twice in the entire codebase, one of them an empty `catch {}` in `normalizeSiegeState`.
- **No win / lose condition exists.** Nothing checks whether the player owns everything, or has lost their last territory. The game cannot be finished.
- **No save / load.** No `localStorage`, no serialisation. Every session starts from scratch and a refresh destroys everything.
- **Dead code**: `dices.js` (485 lines of Three.js/cannon dice) is fully wired but its call site is commented out; `dist/` bundles (~1 MB) load on every page view to support it.

**S. ~60 bare identifiers resolve only via named window access** — [ui.js](../ui.js) throughout

`tooltip` is referenced 59 times inside the `DOMContentLoaded` block, and `uiTable` once in
`toggleUIMenu`, but neither is declared in any enclosing scope — the only `const tooltip` is
local to `svgMapLoaded()` at [ui.js:238](../ui.js#L238).

These work today, but only by accident: `<div id="tooltip">` and the runtime-created
`uiTable` element publish themselves as `window.tooltip` / `window.uiTable` under the legacy
"named access on the window object" rule, and a bare identifier in a module falls through to
the global scope. Verified in Chromium — `typeof window.tooltip === "object"` and the page
raises no errors.

It breaks silently the moment either element is renamed, an `id` collides, or the code moves
into a scope that declares a local of the same name — which is exactly what Phase 6 does.
ESLint's `no-undef` flags all 60 sites, so the migration has a checklist.

**T. Bootstrap readiness fires before the map exists** — [ui.js](../ui.js), [resourceCalculations.js](../resourceCalculations.js) *(fixed in Phase 1.4)*

`pageLoaded = true` was set at the end of the `DOMContentLoaded` handler, but `paths` is only
populated by `svgMapLoaded()`, which runs on **window load** — strictly later. The 800 ms
polling interval in `calculatePathAreasWhenPageLoaded()` had been accidentally covering the
gap: by the time a tick fired, the map had usually loaded. Removing the poll made the latent
ordering bug immediate — `calculatePathAreas()` ran against an empty `paths`, `mainGameArray`
came out short, and every later territory lookup returned `undefined`.

A performance workaround was load-bearing for correctness. Readiness now waits on both halves
explicitly.

**U. Path areas computed twice, behind two independent pollers** — *(fixed in Phase 1.4)*

`calculatePathAreasWhenPageLoaded()` was called from both the module-level bootstrap and from
`createArrayOfInitialData()`. Neither memoised, so each call started its own
`setInterval(..., 800)` **and** re-ran the 80-samples-per-path sweep over all 359 paths. That
is ~460 ms of duplicated computation behind up to 1.6 s of pure idling — the single largest
component of startup, larger than the sweep the plan had targeted.

**V. Null guard written one line after the dereference** — [resourceCalculations.js](../resourceCalculations.js) *(fixed in Phase 1.4)*

```js
const territoryData = mainGameArray.find(t => t.uniqueId === path.getAttribute("uniqueid"));
const dataName = territoryData.dataName;   // throws
if (territoryData) {                       // ...the guard is here
```

**W. Duplicate key in the manual adjacency table** — *(fixed in Phase 1.7)*

`"New Caledonia 1"` appeared twice as a key in a `new Map([...])`. The second entry silently
replaced the first, losing that territory's King Island and Fraser Island links.

**X. `tests/uniqueIdLookup.json` has drifted from the SVG** — *(fixed in Phase 1.3)*

Two of its 359 entries disagree with `svgMaster.svg`: it says `"Grand Bahama"` and
`"Andros Island"` where the map says `"Grand Bahama (Bahamas)"` and
`"Andros Island (Bahamas)"`. Anything built against the lookup file rather than the SVG
mis-handles exactly those two territories, and makes the (correct) hand-written adjacency
rules for them look like typos. **The SVG is authoritative** — it is what the game reads. The
lookup file has been regenerated from it, and both build tools now derive names from the SVG.

**Y. Global `Math.random` makes the game untestable for determinism** — [ui.js](../ui.js#L6027)

`addSparklesRegularly()` re-arms a `setTimeout` every 0–100 ms and consumes **three**
`Math.random()` calls per tick (interval, top, left) from the same global stream that initial
gold, starting forts, leader generation, combat skirmishes and siege rolls draw from. How many
cosmetic draws land between two game-logic draws depends on wall-clock timing, so **seeding
`Math.random` cannot make two runs agree**.

This blocks every test that would assert an exact combat or economy outcome. The fix is an
injected RNG for game logic, separate from cosmetics — Phase 5.

### 5.4 Low — hygiene

- Mixed tabs/spaces; inconsistent brace style; commented-out blocks left in place.
- `//DEBUG` blocks shipped in the turn loop (`logGoldStats`, `setDebugArraysToZero`).
- ~200 `console.log` calls in the turn/battle hot path.
- Magic numbers throughout (`40000`, `15`, `0.7`, `8000000`, `136067649`, `1000`).
- Inconsistent naming: `mainGameArray` / `mainArrayOfTerritoriesAndResources` / `mainArray` / `territories` all refer to the same structure.
- `dataName` means "owning country" and is overwritten on conquest, while `territoryName` is the stable identity and `originalOwner` the historical one — genuinely confusing and a frequent source of the AI's mis-targeting.

---

## 6. Strengths worth preserving

Not everything here is broken. These are good and should survive the refactor:

- **The economic model is genuinely interesting**: gold / oil / food / construction materials, each with capacity, demand and consumption; population split into total and *productive*; oil demand gating how much of your assault/air/naval fleet is actually *useable*; army maintenance as a per-turn gold drain; development index and continent modifiers.
- **Sieges as a distinct mechanic** from open battle — score-based attrition against forts and food capacity, with *arrest* (the besieging force being too weak and getting rounded up) as a failure state. This is a real differentiator from Risk.
- **The AI threat model** — per-enemy-territory threat scores against each friendly territory, filtered through personality traits (`fortification`, `territory_expansion`, `economy`, `style_of_war`, `reconquista`) — is a sound design, and `setAiRngContext` already gives it per-turn deterministic RNG.
- **Data-driven territory adjacency** via `closestPathsData.json` plus a hand-curated exceptions list is the right shape; it is the *loading* that is wrong, not the data.
- **`tests/uniqueIdLookup.json`** is exactly the index the runtime needs.
- **Real geographic / demographic data** (population, area, army size, HDI) gives the game a distinctive flavour.

---

## 7. Summary judgement

The game is a **prototype that grew without an architecture**. The mechanics are more ambitious and more interesting than the code can currently support, and the failure mode is consistent: state is duplicated across three representations, so every feature added has to manually reconcile all three, and each reconciliation is another place to get it wrong.

Three things block all progress and should be fixed before anything else:

1. **Initialisation performance** (§4.1) — nothing can be tested or iterated on while a cold start parses ~7 GB of JSON.
2. **Circular imports and the 1-second `setTimeout` hacks** (§3.1) — these make behaviour non-deterministic across machines.
3. **Single source of truth for territory state** (§3.2) — until this exists, defects like §5.1 A–H will keep reappearing in new forms.

Detailed remediation sequencing is in [03-refactor-plan.md](./03-refactor-plan.md).
