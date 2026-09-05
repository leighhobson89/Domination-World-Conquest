# Known Issues — Domination: World Conquest

**This document holds ONLY what is still open.** Every closed defect, with the analysis behind
it and the record of how it was fixed, is in
[archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md).

An entry moves to the archive **in the same change that closes it** — it is not struck through
and left here, and closures are not batched up for a later tidy-up. That is what keeps this
document able to answer the one question it exists for: *what is wrong with the game right now?*

The analysis behind most of these is [01-codebase-audit.md](./01-codebase-audit.md), written
against commit `b7ae0af`. Where the audit and this document disagree about where something is in
the code today, this document is right.

---

## Defects

Things that are wrong: the code does not do what it is meant to do.

| Id | Issue | Owner |
|---|---|---|
| **BJ** | **A large empire's `armyForCurrentTerritory` goes hugely NEGATIVE.** India at −6.5 billion after 150 headless turns. Re-checked after economy stage 1, because **BM** (the AI buying infantry at a tenth price) looked like a plausible cause and was not: same seed and goal gives Mexico at **−107,929,590 before** that fix and **−29,085,461 after**, so paying the correct price shrinks it about fourfold and does not remove it. Whatever subtracts more army than a territory has is still there and it is not the purchase path | 7.x balance |
| **BI** | **Three sources disagree about which continent a territory is on**, and one territory falls through the gap: Easter Island is Chilean, so South American to the game model and Oceanian to the SVG's `continent=` attribute. The model is authoritative — a continent is the ORIGINAL OWNER's continent, from `initialData.js` — but nothing reconciles the three, so a fourth reader could pick the wrong one silently | balance / data |
| **AN** | **A famine whose losses exactly equal the infantry count destroys the entire mechanised army.** `planArmyStarvation()` in [src/rules/economy/population.js](../src/rules/economy/population.js): `remaining === 0` falls into the `else` branch for all three vehicle types, so the partial-loss branch is skipped. Preserved verbatim from `starveArmyInstead()` during the Phase 5 extraction and commented at the site, because a bug fix does not travel inside a move | 7.x balance |
| — | **The transfer table's row-selection handler is on the row's NAME column, not on the row.** Worked around in `tests/support/` | 7.x |

## Design problems

The code does what it says; what it says does not produce the game it should.

| Id | Issue | Owner |
|---|---|---|
| **BO** | **No continent is completed in a 150-turn game any more, so the continent bonus is unreachable.** Found by the economy phase's stage 1 measurement. Before it, Continental finished North America and Conquest finished South America; after it, `cont` is 0 for all 150 turns of all five goals, and Continental's nearest continent freezes at 66% from turn 25 and never moves again. **The cause is not a defect** — it is **BL** being fixed: about six hundred previously inert AI forts now take dice off attackers, and the last few territories of a continent are the hardest on the map. This is the item below arriving somewhere new, and it means the mechanic the continent-bonus phase shipped, measured and documented does not arrive in a played game | economy / attack dials |
| — | **Attacking is too hard for the world to consolidate.** Measured after Phase 7.8 over two seeds: ~59% of every reachable (attacker, defender) pairing in the world is below the 15% win probability the game applies to everybody, before any AI decision is taken. A hundred turns still ends with 106–145 countries rather than the 16 or so a world of great powers implies. **Economy stage 1 made this worse, and did so correctly**: two defects had been flattering the world, so the largest empire fell in four goals of five (Continental 104 territories to 35). The defender's fort multiplier and the attacker's sub-1 `devIndex` are the two terms to look at, together with the `areaBonusFor()` design question below. `tools/ai-sim.mjs` is the instrument | 7.x balance |
| — | **A besieged territory earns no gold, oil or construction materials, indefinitely.** The income suspension is not a considered rule: those three lines are commented out in the siege branch under `//uncomment other features if decided to involve them in sieges`. A player besieged on turn 3 of a measured run was still besieged on turn 14 with gold frozen throughout. (The other half of this item — AI sieges accumulating 17 → 67 — was closed by the campaign budgets in 7.8) | 7.x design |
| **BQ** | **A besieged territory can still BUILD, and a farm outruns the siege that is grinding it down.** Found while fixing **BP**: France, under siege, put up a farm and its food ceiling rose 64,967,839 → 65,032,807 across the turn the siege began — the farm's +10% against one tick of ~10% collateral damage. It only became visible when **BK** was fixed and AI upgrades started working. It sits oddly beside the rule that a besieged territory earns no gold, oil or construction materials: it cannot earn, but it can spend. Whether a siege should suspend construction is a design decision, not a defect, and it is worth taking together with the income-suspension item above | 7.x design |
| — | **Unpaid army upkeep has no consequence.** A broke territory keeps its army for free. Desertion is a design decision, not a defect fix | 7.x balance |
| — | **Should a small territory get a defence bonus at all, and what caps it?** The open half of **AR**, which is otherwise closed as a design decision. `areaBonusFor()` is deliberately unchanged: the ratio is unbounded as area approaches zero, and even the most conservative capped form halves the largest empire over sixty turns. Anyone reopening it should start from `test-reports/ai-sim/ar-baseline.json` and `ar-capped.json` rather than from `Math.min` | 7.x balance |
| **E8** | **An upgrade order is priced at the LAST one in it, not as the sum of the ladder.** Five farms in one transaction cost `price(5)`; five bought one a turn cost about 2.2× that — so bulk buying is cheap and the AI, which buys one at a time, pays full price. Left exactly as it is by economy stage 1, which changed no balance number, and pinned by a unit test. It is stated once now, in `upgradeOrderPriceFor()`, instead of being an emergent property of a DOM cell | economy stage 3 |
| — | **The AI can eliminate a single-territory player in ten turns** once it plans its first turn with full information. Same root as the old unbounded-sieges item: 206 independent actors, each evaluating every reachable enemy | 7.x |
| — | **Bootstrap ordering is timing-luck.** CPU leaders and the AI's starting forts are created *after* `initialiseGame()` resolves, which is after the engine has run turn 1 — so turn 1 plans and earns over a world with no leaders and no forts, and `newTurnResources()` skips the income pass on turn 1 to hide it. Moving the setup inside `initialiseGame()` was implemented, measured and reverted: the ten-turn `long-run` went from 6/6 green to 0/6, the player eliminated every time. A fully-formed AI first turn is a balance change, and the finding is recorded at the site in `gameTurnsLoop.js` so nobody repeats it blind | 7.x balance |

## Missing

| Issue | Owner |
|---|---|
| **The ending has no SCREEN.** The game decides itself correctly and emits `GAME_OVER` exactly once; the victory and defeat screens are the only listener still missing, and they are a second subscriber rather than a change to the rule | next |

## Hygiene

Not defects. Sequenced per file, as each moves into `src/` — house rule 6 says a lint warning is
not fixed in passing.

| Issue | Owner |
|---|---|
| **`ui.js` is 5,752 lines and `resourceCalculations.js` 3,919**, so Phase 6's "no behavioural module over 400 lines" is not met | 6.9 Part A / Part B |
| **108 `console.log` calls in the turn and battle hot path** — `aiCalculations.js` 51, `resourceCalculations.js` 36, `gameTurnsLoop.js` 17, `ui.js` 4. `battle.js` is down to zero. They come out with the files rather than in a sweep of their own | per file |
| **Inline `.style.` writes that set a literal colour from JS do not follow the theme**, so a themed page has a handful of elements still painted in the old steel blue. `ui.js` is the bulk of it | 6.9.7 |
| Mixed tabs and spaces, inconsistent brace style, commented-out blocks in the legacy root sources | per file |
| Four names for one structure: the `mainArrayOfTerritoriesAndResources` / `mainArray` parameter names survive in `battle.js` and `transferAndAttack.js` | per file |
| `dataName` / `territoryName` / `originalOwner` are named correctly in the selectors but keep their old names in the model | per file |
| `battle.js` still exports ~25 `let`s of per-battle scratch | per file |
| The data tables keep `font-family: Arial, Helvetica, sans-serif` rather than `var(--font-body)`. Deliberate for now: the rows are a fixed 30px and Terminal's monospace face would reflow them | 7.x |
| **A measurement owed before anything touches map colour**: `generateDistinctRGBs()` in `src/ui/map/colouring.js` is dead code that is still CALLED, because its `Math.random` draws are on the game's stream and removing them moves every seeded outcome. Deleting it and re-baselining the four exact-outcome specs it moves is one change | 6.9.0 |
| Lint baseline: **345 problems (75 errors, 270 warnings)** across the repository | per file |

---

## How this register is kept

- **One entry per open issue, and the entry leaves when the issue closes** — moved to
  [archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md) in the same change,
  with its id intact so existing citations still resolve.
- **An id is permanent.** `AN`, `BI`, `BJ`, `BO`, `BP` and the rest keep their letters wherever
  they live, because source comments and `CLAUDE.md` refer to them.
- **Severity is not tracked any more.** The old scoreboard counted 🔴/🟡/⚪ and every 🔴 is long
  closed; what is left is a short list that can simply be read. The historical scoreboard is in
  the archive.
- **Say where it is in the code TODAY.** The audit is the analysis; this is the current location.
- **A design problem is not a defect.** They are separated above because they are decided
  differently: a defect is fixed, a design problem is measured and chosen.
- **Record what was measured, not what was intended.** Several entries here exist only because a
  measurement contradicted a plausible theory — **BJ** is not caused by **BM**, and that was
  checked rather than assumed.
