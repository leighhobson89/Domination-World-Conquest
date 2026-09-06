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

**There are none open.** The five that stood here -- **AN**, **BI**, **BJ**, **BR** and the
transfer table's row-selection handler -- were closed together in one sweep, along with a sixth
found underneath **BJ**: every AI attack was free, because `doAttack()` debited the store and the
goal loop then wrote a pre-attack copy back over it. The analysis, the five sites the trap named,
the before/after measurement of the free-attack fix and the two entries that turned out not to be
defects at all are in
[archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md) under *Closed in the
register sweep*.

Two of them are worth carrying forward as habits rather than as history. **BR had never been
true** -- it described a thousandfold player/AI asymmetry that was not in the code and had not
been for three years, and it was closed by reproducing it against the running game rather than by
reading the file. And **BJ's stated cause was wrong**: the entry proposed army maintenance or
casualties charged twice, and a proxy trap over 30 headless turns named five sites, none of them
either.

## Design problems

The code does what it says; what it says does not produce the game it should.

| Id | Issue | Owner |
|---|---|---|
| **BO** | **Continental completes ONE continent in a 150-turn game and needs three.** Measured `--turns=150 --seed=goals --every=25 --goal=CONTINENTAL`: North America falls to the United States on turn 100 and is held to the end, and the nearest continent reaches 100%. That is the first time this item has moved on its own account rather than being knocked sideways by some other change — and what moved it was the AI's siege guard asking the AI's siege list alone, so a territory besieged by the PLAYER kept upgrading, fortifying and attacking out of the siege. **The other four goals have not been re-measured since the register sweep**, and their last figures (Great Powers, Conquest and Timed completing two each; Domination the outlier at 67%) predate both the free-attack fix and the design pass, so they are stale by an unknown amount. The full history of this item — it has now moved four times, twice in each direction, and **none of it was ever a defect in the continent rule itself** — is in the archive under the economy phase and the register sweep | economy / attack dials |
| — | **Turn 1 still grants no income to anybody, and the reason it did has gone.** `newTurnResources()` skips `calculateTerritoryResourceIncomesEachTurn()` when `currentTurn() === 1`, and that guard existed to hide turn 1 being planned and earned over a world with no CPU leaders and no forts on it. The world is finished before the engine starts now, so the guard is scaffolding for a problem that no longer exists — but removing it grants every territory on the map an extra turn of income, which is a balance change and wants its own measurement. `tests/e2e/turn-loop/turn-counter.spec.js` asserts the current behaviour in two specs ("applies no income on turn 1", "applies income from turn 2 onward"), so whoever takes it re-baselines those in the same change | 7.x balance |
| — | **Has attacking gone too far the other way? Nobody has played the world the measurements describe.** The item was written as *attacking is too hard*: measured after Phase 7.8 over two seeds, ~59% of every reachable (attacker, defender) pairing in the world sits below the 15% win probability the game applies to everybody, before any AI decision is taken, and a hundred turns still ended with 106–145 countries. It has since been moved four times by defect fixes and twice by tuning, in both directions and by more than any of them predicted — most recently the free-attack fix, which took Continental from 89 surviving countries to 109 and the largest empire from 71 to 60, and the design pass, which brought those back to 102 and 65. **So the open question is no longer a number, it is a judgement, and it is the one thing here that measurement cannot answer.** If it does need moving, the dials are the defender's fort multiplier and the attacker's sub-1 `devIndex`, — but not `areaBonusFor()`, whose open half is now closed as a decision — and `DICE_ATTACK_ADVANTAGE` for open battle or `ATTACK_ADVANTAGE` for sieges, never a third. `tools/ai-sim.mjs` is the instrument | 7.x balance |

## Missing

**Nothing.** The last item here was the ending screen, and it is built: `GAME_OVER` has a second
subscriber, the panel names the goal, the outcome and the final standings, and it offers New
Game, Main Menu and View Final Map. The analysis is in
[archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md) under *Closed in the
second design pass*.

## Hygiene

Not defects. Sequenced per file, as each moves into `src/` — house rule 6 says a lint warning is
not fixed in passing.

| Issue | Owner |
|---|---|
| **`ui.js` is 4,579 lines and `resourceCalculations.js` 3,418**, so Phase 6's "no behavioural module over 400 lines" is not met. (Both figures were stated as 5,752 and 3,919 here for some time after they stopped being true — measured again, `wc -l`, during the register sweep) | 6.9 Part A / Part B |
| **75 `console.log` calls in the turn and battle hot path** — `aiCalculations.js` 49, `gameTurnsLoop.js` 16, `resourceCalculations.js` 5, `ui.js` 5. `battle.js` is down to zero. They come out with the files rather than in a sweep of their own. (Counted again during the register sweep; this line had said 108 across a different distribution) | per file |
| **Inline `.style.` writes that set a literal colour from JS do not follow the theme**, so a themed page has a handful of elements still painted in the old steel blue. `ui.js` is the bulk of it | 6.9.7 |
| Mixed tabs and spaces, inconsistent brace style, commented-out blocks in the legacy root sources | per file |
| Four names for one structure: the `mainArrayOfTerritoriesAndResources` / `mainArray` parameter names survive in `battle.js` and `transferAndAttack.js` | per file |
| `dataName` / `territoryName` / `originalOwner` are named correctly in the selectors but keep their old names in the model | per file |
| `battle.js` still exports ~25 `let`s of per-battle scratch | per file |
| The data tables keep `font-family: Arial, Helvetica, sans-serif` rather than `var(--font-body)`. Deliberate for now: the rows are a fixed 30px and Terminal's monospace face would reflow them | 7.x |
| Lint baseline: **343 problems (73 errors, 270 warnings)** across the repository | per file |

---

## How this register is kept

- **One entry per open issue, and the entry leaves when the issue closes** — moved to
  [archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md) in the same change,
  with its id intact so existing citations still resolve.
- **An id is permanent.** `AN`, `BI`, `BJ`, `BO`, `BP` and the rest keep their letters wherever
  they live, because source comments and `CLAUDE.md` refer to them.
- **An entry is closed by reproducing it, not by reading it.** `BR` described a thousandfold
  player/AI asymmetry in the price of infantry that had not been in the code since 2023, and it
  was believed twice — once here and once in the Dominapedia. `BJ` named a cause that was not
  one of the five real ones. Both cost more to disprove than they would have cost to check when
  they were written.
- **Severity is not tracked any more.** The old scoreboard counted 🔴/🟡/⚪ and every 🔴 is long
  closed; what is left is a short list that can simply be read. The historical scoreboard is in
  the archive.
- **Say where it is in the code TODAY.** The audit is the analysis; this is the current location.
- **A design problem is not a defect.** They are separated above because they are decided
  differently: a defect is fixed, a design problem is measured and chosen.
- **Record what was measured, not what was intended.** Several entries here exist only because a
  measurement contradicted a plausible theory — **BJ** is not caused by **BM**, and that was
  checked rather than assumed.
