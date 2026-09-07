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

**Four, all found by the combat audit**, and all of them are the same shape: a comment and the
code under it disagree, and nothing throws. The analysis, the measurements and the file/line
references are [05-combat-and-conquest-audit.md](./05-combat-and-conquest-audit.md) §6.

| Id | Issue | Owner |
|---|---|---|
| **C1** | **`winProbability()`'s contract is false.** Its docstring says *"the attacker's chance of taking the territory, as a percentage"*. It is not: it is a strength ratio built from a defence multiplier the battle does not use, and it knows nothing about the dice model that decides the outcome. Measured against the real model over the real map, its error runs **+95 to −77 percentage points and changes sign on fortification** — it over-rates an attack on unfortified mountain and under-rates one on a fortress. Four consumers read it as a probability: the AI's odds floors, `sizeCommitment()`, the player's attack window and the siege gate. `node tools/combat-lab.mjs calibration` | combat stage 1 |
| **C2** | **`defenseMultiplierFor()` returns 0 where its comment promises 1.** `Math.ceil(0 / 15)` is zero, so a territory with no forts, no mountains and no land-locked bonus has its defending strength multiplied by nothing and `winProbability()` reports 100% against any garrison. Latent on the shipped map — every territory has `mountainDefenseFactor >= 1` — but it is exactly the case the comment claims to handle, and it is reachable from a scenario or a map edit | combat stage 1 |
| **C3** | **The fortification dice bands are documented in forts and applied to mountains.** `DIE_MODIFIERS.fortification` explains its 25 and 100 thresholds as *"one fort is a nuisance, two is a die, three is a fortress"*, which describes `defenseBonus`. It reads `defenseBonus + mountainDefenseBonus`, and mountains alone put **192 of 359 territories (53.5%) at or past the first band with zero forts built**. Either the bands or the comment is wrong; until it is decided which, nobody tuning them knows what they are tuning. `node tools/combat-lab.mjs terrain` | combat stage 1 |
| **C4** | **A cancelled attack that was never fought is recorded as a defeat.** `decideCommitment()`'s `below-floor` branch calls `recordAttackOutcome(..., false, ...)`, which charges `SETBACK_ODDS_PENALTY` (12 points on both floors) against that target. The distinction the code draws between `no-force` (never remembered) and `below-floor` (remembered) is right; what is wrong is that `below-floor` currently fires on most borders in the world because the floors are stated in C1's units. At turn 25, **168 pairings were already refused for "lost here N time(s) already"** against 187 that got through | combat stage 2 |

### Previously closed

The five that stood here -- **AN**, **BI**, **BJ**, **BR** and the
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
| **BO** | **Continental completes NO continent in a 150-turn game and needs three, and the nearest one is RECEDING.** Re-measured for the combat audit, `--turns=150 --seed=goals --every=25 --goal=CONTINENTAL`: zero continents held outright at turn 150, and the nearest goes **64% at turn 25 → 58% at turn 150**. The previous entry recorded North America falling to the United States on turn 100 and being held to the end; that is no longer true and nothing was tuned between — what landed was the register sweep's free-attack fix. **This item has now moved five times and has never once been a defect in the continent rule itself.** It is not an independent problem: it is **G6** seen through one goal, and it closes when the world starts conquering again. The other four goals have still not been re-measured (checklist item 0.4). The full history is in the archive under the economy phase and the register sweep | combat stage 5 |
| — | **Turn 1 still grants no income to anybody, and the reason it did has gone.** `newTurnResources()` skips `calculateTerritoryResourceIncomesEachTurn()` when `currentTurn() === 1`, and that guard existed to hide turn 1 being planned and earned over a world with no CPU leaders and no forts on it. The world is finished before the engine starts now, so the guard is scaffolding for a problem that no longer exists — but removing it grants every territory on the map an extra turn of income, which is a balance change and wants its own measurement. `tests/e2e/turn-loop/turn-counter.spec.js` asserts the current behaviour in two specs ("applies no income on turn 1", "applies income from turn 2 onward"), so whoever takes it re-baselines those in the same change | 7.x balance |
| **G1** | **A battle is a step function, not a decision.** Against a single median defender (mountain factor 3, no forts, Africa, median-development attacker) the real take probability runs **0.0% at 1.5:1, 7.6% at 1.75:1, 50.7% at 3.0:1 and 94.6% at 3.5:1**. Half a rung of force moves it from a coin flip to a certainty, because it crosses a band edge and buys an unmatched die — and an unmatched die is a free casualty every round. There is no ratio at which committing more force is an interesting trade. Bands are RIGHT and the intent is recorded in `balance.js`; five of them plus an automatic-hit rule is too coarse a lattice. **This is the item that replaces "has attacking gone too far the other way", which was written before any of it was measured.** `node tools/combat-lab.mjs cliff` | combat stage 3 |
| **G2** | **Two multipliers weaken an attack and none strengthens a defence.** `devIndex` (median 0.745) and `combatContinentModifier` (0.75–0.99) both scale the ATTACKER only; `areaBonusFor()` is measured at min 0.507 / median 1.000 / max 1.000 across the real map, so it never helps a defender and only penalises a large one (that half is AR, closed as a decision). Median combined **×0.63 — the attacker must field 1.58× to draw level**, and at the tail (Afghan devIndex 0.326 into Oceania ×0.75) it is ×0.24 and four to one to reach parity. The defender's only structural edge in the dice model is winning ties | combat stage 3 |
| **G3** | **The AI aims at a figure that means four to one, so it almost never attacks.** `commitmentDiscipline.decisiveOdds = 65` corresponds to a raw ratio of **3.91:1** and a 94% real take. `decideCommitment()` walks the force a border can spare, fails to reach it, returns `needs-more-force` and requisitions instead. Measured on one turn: of 48 attacks that reached the executor, **2 committed, 3 pressed as a theatre war, 17 requisitioned and 26 were refused below the floor** — one of them at 63%, for being *"2 points short"* of 65 | combat stage 2 |
| **G4** | **The AI's odds floors mean almost nothing in their stated units.** `attackDiscipline.minimumOdds` of 25 / 34 / 45 correspond to real take probabilities of **0.1% / 3.5% / 37.1%**, and `PROBABILITY_THRESHOLD_FOR_SIEGE` of 15 corresponds to **zero**. So both ends fail in opposite directions from one cause: the aim refuses fights it would win, and the floor permits fights it cannot win whenever `pressOnBelowAim` lets a committed theatre through. `node tools/combat-lab.mjs floors` | combat stage 2 |
| **G5** | **Sieges cannot be laid by the army the AI can move.** `armyTypeSiegeValues.infantry` is 0.0001, so **250,000 infantry** are needed to escape the arrest band against bare terrain while ten naval units are worth a million infantry — and every territory on the map carries a mountain bonus of at least 10. In the arrest band there is a 60% chance a turn that the besieging army is destroyed and half of it joins the defender. Meanwhile `src/ai/muster.js`, the AI's only route to concentrating force between turns, **moves infantry and nothing else**, because vehicles are gated by the oil capacity of wherever they stand. The whole world held **0 or 1 siege at every sample of a 150-turn run** | combat stage 4 |
| **G6** | **Nothing ever ends.** 150 turns of CONTINENTAL on seed `goals`: **126 countries alive, largest empire 43 of 359 (12%), zero continents held, the nearest one receding from 64% to 58%, and no conquest at all across three of six samples.** Conquest stops around turn 50 and the largest empire went DOWN between turns 75 and 125. This is also a regression: the register's last figure for this exact invocation was 102 surviving and a largest of 65, and what landed between was the free-attack fix — which is correct and must stand. It removed the last thing hiding this: while attacks were free the AI could throw armies at 3% battles indefinitely and occasionally win one | combat stage 5 |
| **G7** | **The world accumulates an army it cannot spend.** Top-eight army **44M at turn 25 → 126M at turn 150** while conquests fall to zero; India ends the run with 22.5M men across 14 territories, 1.6 million per territory, and takes nothing. The world is not short of force, it is unable to spend it — every country is saving for an attack priced in a currency that does not exist. Upkeep and desertion are supposed to make an unaffordable army self-limiting and the economy is comfortably paying for this one | combat stage 5 |

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
