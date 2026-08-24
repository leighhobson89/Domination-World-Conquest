# Known Issues — Domination: World Conquest

**Companion documents:** [01-codebase-audit.md](./01-codebase-audit.md) ·
[02-game-design-document.md](./02-game-design-document.md) ·
[03-refactor-plan.md](./03-refactor-plan.md) · [04-e2e-test-plan.md](./04-e2e-test-plan.md)

This is the **register**: every defect found so far, in one table, with its current status, the
code that is wrong today, the test that covers it, and the refactor phase that closes it.

The audit ([01](./01-codebase-audit.md)) explains *why* each defect exists and what it does to
the game — that analysis is not repeated here. This document answers three different
questions:

1. Is it still broken?
2. Where is it *now*? Line numbers in the audit are against commit `b7ae0af` and have since
   drifted; the numbers here are against the current working tree.
3. What proves it fixed?

**Issue ids are the audit's letters** (`A`–`Z`, `AA`–`AL`) and are stable. They are cited by
the e2e specs and by the refactor plan, so they must not be renumbered. `AD` and `AE` were
found by the Phase 2 suite; `AF` through `AJ` by the ten-turn run in Phase 3; `AK` and `AL` by the
same ten-turn run in Phase 4 — `AK` once removing the territory copies stopped it hiding the
symptom, and `AL` once `AK` stopped the run failing on turn 2.

**Last updated: end of refactor Phase 4.**

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
| 🟢 Fixed | 13 | 15 | 9 | — |
| 🔴 Open | 0 | 0 | 1 | — |
| 🟡 / ⚪ | 0 | 0 | 7 | 5 |

Phase 3 closed every critical and every high-severity defect in the register, plus five
(**AF** through **AJ**) that only became reachable once the others were fixed. Every one of
those five was found by the same spec: the ten-turn `long-run`.

Phase 4 closed **AD**, **AK** and **AL**, structurally closed **AB**, and closed five more
found while doing it (§4b). One defect is left open: **AE**, which Phase 6.7 owns.

---

## 1. Still open

One defect, structural rather than arithmetic, already sequenced.

| Id | Issue | Status | Now at | Fixed by | Covered by |
|---|---|---|---|---|---|
| **AE** | **The attack marker survives a cancel** by either route — the window's X, or the move button's CANCEL | 🔴 Open | [transferAndAttack.js](../transferAndAttack.js), [ui.js](../ui.js) | 6.7 | `attack/attack-window.spec.js` (fixme) |

It is not a patch. **AE** is the marker half of the map-state desync, and Phase 6.7 removes
the whole class by making markers a pure function of state rather than something pushed onto
the SVG from ~30 call sites. Phase 4 did the same thing to the six *attribute* halves of that
desync, which is why the attribute specs in `bootstrap/state-layer.spec.js` can now assert
map-equals-model outright.

---

## 2. Accepted, and sequenced

Real, understood, deliberately not being fixed yet.

| Id | Issue | Fixed by | Notes |
|---|---|---|---|
| **Y** | Global `Math.random` — cosmetic sparkles share the game's RNG stream, so **seeding cannot make two runs agree** | 5.5 — injected RNG | `bootstrap/e2e-hook.spec.js` is `fixme`. **No test may assert an exact combat or economy outcome across runs until this is closed.** |
| **S** | ~60 bare `tooltip` / `uiTable` identifiers resolve **only via named window access** | 6.3 | ESLint `no-undef` is the checklist |
| — | Map colour is snapshotted and restored from ~30 call sites, with `false` and `"true"` both truthy in one path | 6.7 | the same root cause as **AE** |
| — | `gameLoop()` **recurses infinitely** — no unwinding, no cancellation, no restart | 5.7 | |
| — | Bootstrap ordering is timing-luck: turn 1's economy runs before leaders and forts exist | 5.7 | |
| — | `eventHandlerExecuted` plus `setTimeout(…, 200)` as a click de-bounce — timing, not state | 6.6 | |
| — | Essentially **no error handling** — two `try/catch` in 19,800 lines, one of them empty | 5.7 | This is why every defect in §3 below froze the *whole game* rather than one turn |
| — | **No win or lose condition.** The game cannot be finished | 7.1 | |
| — | **No save or load.** A refresh destroys everything | 7.3 | |
| — | Unpaid army upkeep has **no consequence** — a broke territory keeps its army for free | 7.x | New in Phase 3, with maintenance re-enabled (**R**). Desertion is a design decision, not a defect fix |
| — | The start-of-turn info panel is **suppressed on any turn that ends a siege by arrest** (`continueSiege === true` gates it), because the arrest raises the battle-results screen instead | 6.3 | Long-standing, but only visible now that sieges tick properly (**D**, **J**). `turn-loop/start-of-turn-ui.spec.js` states the rule rather than assuming the next turn |
| — | **AI sieges accumulate without bound, and a besieged territory earns nothing.** Measured over 14 turns: 17 → 67 concurrent AI sieges, and a player besieged on turn 3 was still besieged on turn 14 with its income suspended throughout | 7.7 / 7.8 | See §5 — the single most player-visible consequence of Phase 3, and a design problem rather than a defect |
| — | `dices.js` is fully wired but its call site is commented out; `dist/` (~1 MB) loads on every page view for it | 7.9 | decide: wire it or delete it |
| — | `xButton` is a **duplicated id**; `#tooltip` has no `pointer-events: none` and eats the click beneath it; the transfer table's row handler is on the NAME column | 6.1 / 6.3 / 6.5 | all three are worked around in `tests/support/` |

### Low — hygiene

| Issue | Fixed by |
|---|---|
| Mixed tabs and spaces, inconsistent brace style, commented-out blocks left in place | per file, as each moves into `src/` — house rule 5 |
| `//DEBUG` blocks shipped in the turn loop (`logGoldStats`, `setDebugArraysToZero`) | 5.7 |
| ~200 `console.log` calls in the turn and battle hot path | 5.7 |
| Magic numbers throughout — `15`, `0.7`, `8000000`, `136067649`, `1000`, and now `COUNTRY_GREYOUT_RANK`, `UNIT_MATCHUP_EFFECTIVENESS`, `armyCostPerTurn` | 5.1 — `config/balance.js` |
| Four names for one structure: `mainGameArray` / `mainArrayOfTerritoriesAndResources` / `mainArray` / `territories` — the first is gone, the parameter name survives in `battle.js` and `transferAndAttack.js` | 5.2 / 5.3, as each function becomes pure |
| `dataName` is the *current owner* and changes on conquest, `territoryName` is the stable identity, `originalOwner` is historical. Named as such in `state/selectors.js` (`countryOf` vs `getTerritoryByName`) but the fields keep their old names in the model | 5.2 |
| `battle.js` still exports ~25 `let`s of per-battle scratch (`currentRound`, `attackingArmyRemaining`, …) | 5.3 — `resolveRound()` is pure and has no module state |
| Lint baseline: **205 errors, 380 warnings** (was 214 / 394 after Phase 3) | per file, as each moves into `src/` — house rule 6 |

---

## 3. Closed in Phase 3

Every critical and every high-severity defect. Each fix carries the audit reference in a
comment at the site, so the code explains itself without this document.

### The one that stopped the game

| Id | Issue | Fix |
|---|---|---|
| **AA** | `determineResourcesAvailableForThisGoal` reassigned `refinedTurnGoals` from inside a loop indexed against its old length; the last index vanished, `refinedTurnGoals[i][1]` threw, and the unhandled rejection killed `gameLoop()` for good — the phase button stuck on `AI MOVING...` until a reload | The Bolster goals that need no infantry are dropped **once, before the loop**, over a list that then does not change, and only goals after the cursor are eligible — removing one at or before it is what shifted the index. A `count` of zero now divides as one instead of producing `Infinity` |

### Critical — corrupted game state

| Id | Issue | Fix |
|---|---|---|
| **AC** | Every military purchase charged **twice**: `addPlayerPurchases` deducted the cost and then called two helpers that each deduct it again | The caller no longer deducts. The helpers borrow from the player's other territories if this one is short, then charge — once |
| **A** | Upgrade capacity bonuses **compounded**: the multiplier was the *total* buildings built, applied to the already-boosted capacity, on every purchase of any kind — a 5th farm applied +50 %, and a fort re-applied the farm, forest and oil bonuses | +10 % per building **bought in this transaction**, against the capacity the territory had **before** it. The three guards test what was bought, not what has ever been built |
| **B** | A goal whose territory was not found left the sentinel string `"no match"`, which the write-back then wrote into `mainGameArray` — every later arithmetic on that slot came out `NaN` | The sentinel is `null`, and a goal whose territory is not on the map is skipped |
| **C** | `count` was declared **inside** the loop it was meant to count across, so it reset every iteration and `count === 2` was unreachable — the second territory of a Siege or Attack goal was never found | The search stops when both territories are found, by checking the two results rather than a counter |
| **AB** | The AI **substituted** whole elements (`mainGameArray[i] = copy`), orphaning the Phase 1.5 territory index — which holds object references, so every index reader was left looking at the object that used to be in that slot | `Object.assign` into the live element. Identity is preserved, so the index cannot be orphaned. Structurally closed by Phase 4.4 |
| **D** | A siege that missed its hit roll did `return`, abandoning the loop and handing `gameTurnsLoop` `undefined` — **one quiet siege cancelled every other siege's turn** | `continue`, pushing `true`: a miss is a quiet turn for that one siege |
| **E** | `unchangeableWarStartCombinedForceDefend` was computed from `totalAttackingArmy`, so all three rout and last-push thresholds compared the defender's remaining force against the **attacker's** starting force | Computed from `totalDefendingArmy` |
| **F** | Starvation sign error: `populationChange` is negative while starving, and subtracting it made the simulated population go **up**, so the "starve the army instead of the civilians" branch never fired during a famine and fired spuriously during growth | `+ populationChange` |
| **G** | Each AI country's turn gains were **re-zeroed on every territory**, so they only ever reflected the last one processed | The whole map is zeroed once per turn, at the top of the income pass; a country's record is created only if absent |
| **H** | `for (country of turnGainsArrayAi)` — an implicit global over a plain object that is not iterable. It threw every time an AI rout resolved | `for (const [countryName, country] of Object.entries(...))` |
| **AF** | `calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory` indexed two arrays of **different lengths** with the same counter. They agree only while a country has lost nothing; the moment it loses a territory, `[j][1]` threw on `undefined` and took the game loop with it | Matched on the territory name, which is what the two entries genuinely share |
| **AG** | Two faults from one assumption — that the world does not change shape during the AI turn. `calculateTurnGoals` threw on an empty threat list (an ordinary state once a country's neighbours are all its own), and `handleAITurn` iterated `arrayOfLeadersAndCountries` by a bare index while conquest **rebuilds that array in place** | A country with no threats plans no goals. The turn *order* is fixed at the start of the phase and each country's index into the live array is resolved fresh, so a country conquered earlier in the same turn takes no turn |

**AF through AJ were only reachable once the others were fixed.** Before Phase 3 the AI turn threw
before it got that far, and **B**/**C** meant conquests rarely wrote back to the right slot.
Fixing them let the AI actually take and lose territory — which is what exposed these two.
All four of **AA**, **C**, **AF** and **AG** are the same species: **loop state and loop
subject disagreeing**. It is the most common defect shape in this codebase, and worth
watching for in every phase that follows.

### High — logic errors

| Id | Issue | Fix |
|---|---|---|
| **Z** | The country-selection strength gate **could never fire**: `calculateTerritoryStrengths` min-max normalises into 0–10000 and the threshold was 40000, so no country was ever greyed out and the player could start as the United States | The gate is now a **rank**, not a magnitude. Re-scaling the number would only have moved the guess; the intent ("the top few countries are too strong") is a rank. See §4 |
| **R** | Per-turn army maintenance was **commented out** — standing armies were free, which removed the principal economic brake and made permanent sieges costless | Re-enabled, with `armyCostPerTurn` re-tuned. See §4 |
| **K** | Skirmishes paired **matching unit types only**, so two armies sharing no type produced `totalSkirmishes === 0` and the battle could neither progress nor resolve | A cross-type matchup matrix — refactor 3.15 offered two designs and recommended this one. See §4 |
| **P** | `(Math.max(territory.area / 10000000), 1)` — `Math.max` of one argument returns it, the comma operator discards it and yields `1`, so territory **area had no effect on gold income at all** | `Math.max(territory.area / 10000000, 1)`, kept as a floor of 1 so a small territory earns what it used to |
| **I** | Two inner loops used `i`, **shadowing** the territory index, so the post-siege food-capacity reset landed on whichever territory sat at the *war's* index | Renamed to `w` and `k`; ESLint `no-shadow` stops it coming back |
| **J** | `changeDuringAnySiege` was declared outside the loop and set false on first use, so **one besieged territory per turn** got its siege-time processing | The latch is gone — and the branch is now scoped by the same path check as the income branch beside it, without which dropping the latch would have run it 359 times per besieged territory |
| **N** | `activateAiTerritoriesForNewTurn` compared a uniqueId against the **array** rather than `[i][0]`, so AI territories were **never reactivated** after a conquest | Index the entry |
| **O** | Reactivated entries were never removed, so once the counter matched, reactivation **re-fired every turn forever** | Both functions walk backwards and splice the served entry out |
| **L** | `proportionsOfAttackArray` is module-level and was only ever pushed to, so **every battle inherited the retrieval proportions of every battle before it** | Cleared at the top of `setupBattle` |
| **M** | A local `let` shadow discarded the freshly computed probability — it was shown once and thrown away | Assign the module binding |
| **Q** | `selectRandomEvent` can return `"Warehouse Fire"`, but the handler tested for `"Forest Fire"`, so one of the four random events **did nothing** — and worse than nothing, because `randomEventHappening` still suppressed that turn's regeneration and population change | The handler tests for `"Warehouse Fire"` |
| **AJ** | **Starvation drove population and army below zero.** The famine death toll was capped against the combined population but applied to the civilians alone; `starveArmyInstead` let `armyForCurrentTerritory` drift away from the units it summarises (−32,263 on a territory holding 549,615 infantry); and a negative productive population made `Math.log10` return `NaN`, which `goldForCurrentTerritory` then carried forever | Deaths capped at the civilian population too, the army total recomputed from what remains, and a territory with nothing productive left earns nothing rather than `NaN` |
| **AI** | Six territory names carry **real parentheses** — `Andros Island (Bahamas)` and friends — and the siege marker was looked up with `querySelector("#siegeImage_" + name)`. That is not valid CSS, so it **threw** rather than returning null, from inside the per-turn siege sweep | `getElementById`, which takes the id literally. `gameTurnsLoop.js` already did this for the same id; only `ui.js` used a selector |
| **AH** | The battle-results Accept button assumed a **player-initiated** battle. `originalDefendingTerritory` is set only when the player opens one, but the results screen is shared — a siege arrest and an AI attack on the player both raise it — so the first such result of a session threw from a click handler | The handler records nothing when there is no player battle to describe: the war those results show has already been recorded by whoever raised the screen |

---

## 4. The three Phase 3 fixes that are design decisions

Most of Phase 3 restores intent. These three had to **choose** it, so the reasoning is
recorded here rather than only in a code comment.

### Z — the country-selection gate is a rank

Re-scaling `40000` would only have moved the guess, so the gate was measured first. On a
fresh world the normalised strengths run:

| | | | | | |
|---|---|---|---|---|---|
| China 10000 | United States 9545 | India 7965 | Indonesia 5697 | Russia 4438 | *then* Italy 3504 |

Five is where the superpowers stop. `COUNTRY_GREYOUT_RANK = 5` takes the countries that would
make the game trivial and leaves every genuine mid-sized power — Italy, Germany (rank 8),
Japan (rank 9), the United Kingdom — playable.

**This changed the test fixtures.** Seven spec files used Alaska, and therefore the United
States, as "the multi-territory country the player owns". They now use **Hokkaido (Japan)**,
which is a better fixture anyway: it reaches four other Japanese territories and two enemy
ones, where Alaska reached fewer.

### K — cross-type skirmishes, with a matchup matrix

Refactor 3.15 offered two ways out of the deadlock and recommended this one, because it makes
army composition matter. `UNIT_MATCHUP_EFFECTIVENESS` in [battle.js](../battle.js) scales the
attacker's odds by how effective its unit type is against the one it engages. Same-type values
are `1`, so a conventional battle fights exactly as it always did; an attacker with no
matching opponent engages the type it is best against instead of stalling.

`totalSkirmishes` is now the number of pairings the two armies can make — the smaller of the
two head counts — which is zero only when one side is empty. That is a **resolved** battle
rather than a stalled one, which is the whole point.

### R — maintenance re-enabled, and re-tuned

The plan predicted this would "change balance significantly", so it was measured before being
switched on. A territory earns roughly **44–100 gold a turn**. At the original rates:

| Country | Starting infantry | Upkeep per turn | Gold in hand |
|---|---:|---:|---:|
| China | 2,472,249 | 1,384 | 48,337 |
| India | 2,146,145 | 1,099 | 48,237 |
| United States | 1,598,712 | 948 | 52,323 |
| Germany | 783,052 | 396 | 23,348 |

Every major power would have been bankrupt inside forty turns with no way to respond. At a
tenth of those rates a normal standing army costs about what its territory earns, so **holding**
an army is sustainable and **growing** one is what has to be paid for — which is the brake the
mechanic was for.

A territory's gold is now floored at zero when the turn change is applied. Nothing in this
game models debt, and a negative balance would flow straight into the AI's spending
calculations. What an unpayable army *should* cost you is desertion, and that is a Phase 7
design decision — logged in §2 above rather than invented here.

---

## 4b. Closed in Phase 4

**AD**, plus four defects found while inverting the SVG relationship. None of the four was
reachable by reading one function: each was a pair of writes that had to agree and did not,
which is the shape Phase 4 exists to remove.

| Id | Issue | Fix |
|---|---|---|
| **AD** | **INVADE! never debited the source territory.** The battle ran on copies, so the same garrison could be committed to two attacks in one turn and a failed attack cost nothing | The source is debited at INVADE!. Sieges now hold a territory id, so there is one territory to debit. The army returns through `retrievalArray` on a no-penalty retreat — which had to be made unconditional, because the `battleStart` branch only queued the retrieval for a siege pullout and would otherwise have destroyed the army. `attack/attack-window.spec.js` un-`fixme`d |
| **AB** | The AI substituted whole elements of `mainGameArray`, orphaning the territory index | **Structurally closed.** There is one index, it is the store's own `Map`, and nothing can replace an element: the write-back is `updateTerritory(id, patch)` |
| — | `transferArmyOutOfTerritoryOnStartingInvasion()` computed `armyForCurrentTerritory -= (sum of what remains)`, subtracting the garrison a second time and driving the total negative | It is the sum of the units, so it is an assignment. Only reachable now that the debit runs at all |
| — | `deactivateTerritoryAi()` took a **territory** from the AI and an **SVG path** from `handleWarEndingsAndOptions()`. A path has no `uniqueId` property, so every AI conquest of a player territory pushed `[undefined, n, 0]` onto the deactivation list, deactivated nothing, and left the entry there forever | Accepts either and resolves one id |
| — | `setCountryNameOnPath()` wrote `territory.owner` into `data-name` — the *current owner* attribute. Correct only because an AI country name happens to be both, and wrong the moment the player held the territory | Deleted. Ownership is `setTerritoryOwner(id, owner, country)` and the attributes are rendered from it |
| — | `setMainArrayToArmyRemaining()` wrote the siege survivors back, then wrote them a second time into the siege's own copy — read from `getSiegeObjectFromPath(lastClickedPath)`, a *different* siege from the one passed in | `applySiegeSurvivorsToTerritory()`: one write, no copy, no second lookup |
| — | The AI siege-arrest log printed `undefined's attacking troops` — `attackingTerritory` is a name string, not an object | Uses `attackingCountry` |
| **AL** | **A siege arrest could set a territory's army to `NaN`, permanently.** `handleEndSiegeDueArrest()` restored the defender's four unit types by adding back half the arrested attackers. Three lines read `defendingArmyRemaining[n] + Math.floor(attackingArmyRemaining[n] * 0.5)`; the assault line had the bracket in the wrong place and read `defendingArmyRemaining[1 + Math.floor(...)]` — indexing a four-element array by half the attacker's assault count. Any arrest against an attacker with two or more assault units assigned `undefined`, `armyForCurrentTerritory` came out `NaN`, and every later turn recomputed population, productive population and food consumption from it | The bracket. Found by the ten-turn `long-run` on turn 10, once **AK** stopped it failing on turn 2 |
| **AK** | **A siege could set a territory's `foodCapacity` to `NaN`, permanently.** `calculateDamageDone()` declared `collateralDamage` and assigned it in three of four paths: it was left `undefined` when the destroy roll succeeded and the score difference was under 50, which is reachable for any difference in [20, 50) where the destroy probability is 0.3. `foodCapacityDestroyed` then came out `NaN`, and `arrested` came out `false` because `undefined === 0` is false, so the siege could not be arrested either | Computed once, before the branch — every path wanted the same value. `changeDefendingTerritoryStatsBasedOnSiege()` also clamps `foodCapacity` at zero and ignores a non-finite damage figure |

**AK** and **AL** are the clearest illustration of what the phase was for. The `NaN` was **always** being
computed; it landed on the siege's own copy of the territory, and the copy-back at the end of a
siege carried only the four building counts, so it never reached the world. Removing the copy
made a five-turn-old bug visible on turn 2 of the ten-turn `long-run` — a spec that has been
green since Phase 3 and that specifically looks for non-finite numbers. Nothing about the
defect changed; the place it could hide did.

**AL** then came out from behind **AK**: the ten-turn run had never reached turn 10 while **AK**
was failing it on turn 2. Two `NaN`-producing defects, in the same subsystem, neither visible
while the other was in front of it — which is the argument for a characterisation suite that
asserts an invariant over the whole world rather than one number at a time.

**One defect Phase 4 introduced and fixed before the phase closed**, recorded because the
shape of it will recur in Phases 5 and 6. Converting `colorCountriesRandomly()` from
`path.getAttribute("data-name")` to a store read broke it, because that function runs during
bootstrap — after `svgMapLoaded()` populates `paths`, but before `seedTerritories()` fills the
store. Every path answered `null`, they all grouped into one country, and the whole map came
out a single flat colour with every territory's `countryColor` wrong for the rest of the game.

Two things are worth keeping from it:

- **The SVG genuinely is the truth in that window**, because it is what the model is seeded
  from. `state/pathState.js` now reads the attribute while `territoriesReady()` is false, and
  the store once it is true — bounded by readiness rather than by "the lookup returned null",
  so that a missing territory after seeding still surfaces as a bug.
- **225 specs did not notice the map going one colour**, because they all assert on state and
  text. `bootstrap/state-layer.spec.js` now asserts the map has one colour per country, before
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

## 5. How the register is used

- **Before "fixing" something odd, look here first.** If it has an id it is understood and
  sequenced, and fixing it out of order breaks the bisect guarantee (house rule 3).
- **Every 🔴 with a spec has that spec as `test.fixme`.** A phase's job is to flip them green,
  not to invent new expectations. Where the wrong behaviour was worth stating out loud, a
  companion spec characterised what the game did *today*, written to **fail when the defect is
  fixed** — Phase 3 deleted three of those and un-`fixme`d what they guarded.
- **A defect without a spec is not "untested by choice".** Several areas are deferred because
  their setup is not reachable by clicking and they need the scenario loader
  ([04](./04-e2e-test-plan.md) §3.7, a Phase 4 deliverable): `starvation`,
  `resource-borrowing`, `deactivated-source`, `siege-offer`, and the battle terminal
  conditions. **D**, **E**, **F** and **K** are fixed in the code and read correctly, but
  their assertions wait on that loader — hoping the live map produces a rout is a seed
  lottery, not a test.
- **No test may assert an exact combat or economy outcome across runs** until **Y** is closed
  in Phase 5.

## 6. What Phase 3 made visible

Fixing the defects did not only remove crashes — it started the parts of the game that had
never run. Two things are now plainly true that were invisible before, and neither is a defect
to patch:

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
