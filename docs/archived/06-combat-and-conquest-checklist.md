# Combat and Conquest — Task Checklist

The task breakdown for [05-combat-and-conquest-audit.md](./05-combat-and-conquest-audit.md).
Breathing document: ticked as work lands, and each stage records **what was measured**, not what
was intended.

**The measurement is the deliverable. The diff is not.** That is the lesson the economy phase
paid for twice — both of its halves moved the world further than either predicted, in opposite
directions, and neither was a defect.

---

## The rules this phase works under

1. **Nothing ships on `combat-lab.mjs` alone.** It is the cheap check that comes first; the
   acceptance criterion is `tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND`
   across all five goals, which is what `CLAUDE.md` names for any change to `src/ai/`.
2. **Do not edit a source file while a sim run is in flight.** Vite pushes an HMR update, the
   page reloads, `window.__game` goes with it, and the run dies looking exactly like a game
   defect. This was demonstrated during the audit itself: a `sed` over a comment in
   `balance.js` killed a 75-turn run at turn 35.
3. **§7 of the audit is the list of things a change must survive.** Ten items. The two that are
   easiest to break by accident are *one combat model for both sides* and *the two attack dials
   are permanent*.
4. **Work test-first.** A failing unit test, watched to fail, then the fix.
5. **Leigh commits.** Work is left in the working tree with a note of what would go in the commit.

---

## Stage 0 — Baseline, before anything is touched

- [x] **0.1** `tools/combat-lab.mjs` written — six sections, importing every rule it measures
- [x] **0.2** Control run recorded: `--turns=150 --seed=goals --every=25 --goal=CONTINENTAL`

  | turn | countries | top16 | largest | conq | sieges | continents | nearest | top-8 army |
  |---|---|---|---|---|---|---|---|---|
  | 25 | 143 | 55% | 37 | 3 | 1 | 0 | 64% | 44,034,355 |
  | 50 | 138 | 56% | 41 | 2 | 1 | 0 | 62% | 54,997,086 |
  | 75 | 136 | 57% | 42 | **0** | 0 | 0 | 55% | 58,785,346 |
  | 100 | 130 | 57% | 39 | **0** | 0 | 0 | 52% | 75,033,226 |
  | 125 | 130 | 58% | 40 | **0** | 1 | 0 | 54% | 87,662,703 |
  | 150 | 126 | 59% | **43** | 2 | 1 | 0 | 58% | **126,185,339** |

  Written to `test-reports/ai-sim/audit-continental.json`.
- [x] **0.3** Control funnel recorded, turn 25 of the same seed: **1,583 pairings weighed → 187
      attack verdicts → 48 reach the executor → 5 attacks pressed → 3 conquests**, with the
      executor's own 48 decisions splitting 2 `committing` / 3 `pressing the war` /
      17 `needs-more-force` / 26 `below-floor`
- [x] **0.4** The other four goals at 150 turns. **The freeze is universal** — no goal completes
      a single continent, and the largest empire never passes 52 of 359.

  | goal | countries | largest | top16 | continents | nearest | top-8 army |
  |---|---|---|---|---|---|---|
  | CONTINENTAL | 126 | 43 | 59% | 0 | 58% | 126,185,339 |
  | CONQUEST | 122 | 52 | 61% | 0 | 71% | 263,140,777 |
  | DOMINATION | 115 | 46 | 64% | 0 | 65% | 121,055,095 |
  | GREAT_POWERS | 104 | 48 | 68% | 0 | 96% | 100,356,307 |
  | TURN_LIMIT | 113 | 36 | 58% | 0 | 54% | 72,446,703 |

  Two of the files in `test-reports/ai-sim/` called `control-*` were **stale**, dated the day
  before and taken before the register sweep's free-attack fix — one of them carried a world
  army of **minus 6.6 billion**, the signature of the garrison defect that sweep closed. They
  were overwritten rather than read. A control is only a control if you check its date.

---

## Stage 1 — Make the AI decide with the function that fights

Closes **C1**, **C2**; the precondition for **G3** and **G4**.

The AI must estimate the battle the dice model will actually fight. It must NOT be given a
different battle — audit §7.1, and the reason `doAttack()`'s separate resolver was deleted.

### 1a. A take-probability the AI can afford to call

- [ ] **1.1** Unit test first: assert that a new `takeProbability()` agrees with
      `battleForecast()` to within a stated tolerance across the matchup grid
- [ ] **1.2** Build it as a **precomputed table** over the model's own state space —
      (attacker dice 1–5) × (defender dice 1–4) × (attacker modifier −2..+2) × (defender modifier
      −2..+2), 500 cells, generated once by `battleForecast()` and frozen into a rules module.
      The share still comes from `shareFor()`, so nothing about how dice are CHOSEN changes
- [ ] **1.3** Measure the cost. The AI weighs ~1,583 pairings a turn and `sizeCommitment()` walks
      a four-rung ladder over each, so the budget is roughly 6,000 calls a turn. A table lookup
      is free; a 40-trial forecast is ~240,000 battles a turn and is not
- [ ] **1.4** Confirm it stays pure and Node-runnable — audit §7.7. Both labs and the unit suite
      depend on it

### 1b. Put every consumer on it

- [ ] **1.5** `oddsFor()` in `calculateArmyQuantityBeingSentOrIfCancellingInteraction()`
- [ ] **1.6** The `probability` passed into `rateTarget()`
- [ ] **1.7** The hard floor in `getPossibleTurnGoals()` (`PROBABILITY_THRESHOLD_FOR_SIEGE`)
- [ ] **1.8** `siegeReview.js`'s assault odds
- [ ] **1.9** Decide what happens to the player's attack window. `CLAUDE.md` records that the bar
      (`winProbability`) and the forecast line (`battleForecast`) are **allowed to differ** and
      says why. That stays true — but the bar is now known to be wrong by up to 95 points, so
      "allowed to differ" is doing more work than it was meant to. **A question for Leigh, not a
      decision to take here** - UPDATE, WE CAN TAKE THIS DECISION HERE LEIGH SAYS THE BAR IS CONFUSING AND REALISTICALLY HE IS HAPPY FOR THE AI TO TAKE THE INITIATIVE ON THIS AND EITHER GET RID OR MAKE IT MORE ACCURATE, EITHER IS TOTALLY FINE

### 1c. The latent defect underneath

- [ ] **1.10** **C2** — `defenseMultiplierFor()` returns `Math.ceil(0 / 15)` = 0 where its own
      comment promises "defends at face value", so `winProbability()` reports 100% against any
      garrison on a territory with no terrain at all. Latent on the shipped map; a unit test
      first, then a floor of 1

### Stage 1 gate

- [ ] The calibration table (audit §4.1) re-run: **every row inside ±10 points**
- [ ] The full five-goal 150-turn run, tabled against §0.2 **before Stage 2 begins**
- [ ] `npm run test:unit` green; the `battle/`, `ai-turn/` and `siege/` e2e areas green

---

## Stage 2 — Re-derive the floors and the aim

Closes **G3**, **G4**, **C4**.

Once an odds figure means what it says, these constants become statements about the world for
the first time. They are probably close to right as *sentences* and have never been right as
*numbers*.

- [ ] **2.1** `attackDiscipline.minimumOdds` — today 25 / 34 / 45, which are real take
      probabilities of **0.1% / 3.5% / 37.1%**. Restate as what an aggressive, a balanced and a
      pacifist leader should actually accept
- [ ] **2.2** `commitmentDiscipline.decisiveOdds` — today 65, which is **raw 3.91:1 and a 94%
      real chance**. This one number is the direct cause of 17 of the 48 cancellations in §0.3
- [ ] **2.3** `PROBABILITY_THRESHOLD_FOR_SIEGE` — today 15, which is **raw 0.34:1 and a real take
      probability of zero**. It is a floor beneath everything and it currently floors nothing
- [ ] **2.4** `siegeDiscipline.minimumOdds`, `assaultOddsMargin`, and the leader modifiers, in
      the same units
- [ ] **2.5** **C4** — a `below-floor` cancellation calls `recordAttackOutcome(..., false, ...)`
      and so charges `SETBACK_ODDS_PENALTY` for a battle that was never fought. Once the floor is
      real this becomes defensible; until it is, it locks in the freeze. **168 pairings at turn
      25 were already refused for "lost here N time(s) already"**
- [ ] **2.6** Every one of these carries its measured meaning in a comment, the way the economy
      constants do — "34% here means a raw ratio of about X and a real take of about Y". A number
      whose units are not written down is what produced this whole phase

### Stage 2 gate

- [ ] The funnel from §0.3 re-measured. The numbers that matter are the last two: **how many
      planned attacks survive commitment**, and how many conquests result
- [ ] Five-goal 150-turn run, tabled

---

## Stage 3 — Flatten the cliff — **DECIDED**

Addresses **G1**, **G2**. Stages 1–2 make the AI fight the battles it should; they do not change
the fact that those battles are decided before they are rolled.

Leigh's answers to audit §9 Q1 and Q2 settle what this stage is. **Two changes, and the other two
candidates are explicitly not taken.**

### 3a. More dice bands — closes G1

- [ ] **3.1** `DICE_SHARE_BANDS` goes from **five rows to roughly nine**, so crossing an edge buys
      about half a die of advantage rather than a whole one. A unit test first, asserting the
      table is monotonic, that it still spans 1..5 dice, and that the bottom row still guarantees
      the underdog one die
- [ ] **3.2** `DEFENDER_DICE_CAP` is re-read against the new table. Today it is 4 against a
      maximum of 5 and it bites only where the defender is stronger; with nine rows the same
      *intent* may want a different number
- [ ] **3.3** `node tools/combat-lab.mjs cliff` after each candidate table. The target is stated
      rather than eyeballed: **the span from 10% to 90% real take should cover a ratio band of at
      least 1.5× rather than half a rung**

### 3b. Rebase the attacker's multipliers — closes G2

- [ ] **3.4** `devIndex` and `combatContinentModifier` are rebased **together** so the median
      attacker fights at **×1.00 instead of ×0.63**, keeping the full spread. Rebasing one leaves
      half the tax standing, because the tax is their product
- [ ] **3.5** `devIndex` is read from `initialData.js` and used in several places that are NOT
      combat — `defenseBonusFor()`, the upgrade price ladder, `productivePopulationFor()`, the
      construction-materials ceiling. **The rebase must not reach any of them.** It belongs in
      `attackingDevelopmentIndex()` or in a named combat-side constant, not in the data
- [ ] **3.6** `combatContinentModifiers` is a six-row table in `balance.js` and is read by
      `combatContinentModifierFor()` only, so that half is a straight edit — with the comment
      restated to say what the numbers now mean relative to 1.00
- [ ] **3.7** Confirm this is **not a third attack dial**. `DICE_ATTACK_ADVANTAGE` stays at 1.0
      and remains the only lever on open battle; `ATTACK_ADVANTAGE` stays at 1.44 and owns
      sieges. What moves is the centre of two existing per-territory multipliers

### Not taken, and the reasons are on the record

- **The unmatched die stays an automatic hit.** It is the actual cause of the cliff, and it is
  also the reason a 2:1 attacker does not take a fortress 100% of the time — the overhaul
  measured that failure once already. Not off the table forever; off the table until nine bands
  have been measured and found insufficient.
- **`DICE_ATTACK_ADVANTAGE` is not moved.** It shifts the cliff sideways without changing its
  shape, so it addresses G2 and not G1, and 3b addresses G2 better.
- **`areaBonusFor()` is not touched** (known-issue AR, closed as a decision at B.10.4).

### Stage 3 gate

- [ ] `node tools/battle-lab.mjs` — the overhaul's own §4.6 targets still met, stalemate rate
      still **zero everywhere**. A non-zero stalemate rate after a band change is a bug in the
      casualty floor, not a tuning question
- [ ] `node tools/combat-lab.mjs cliff` — the 10%→90% span covers at least a 1.5× ratio band
- [ ] `node tools/combat-lab.mjs terrain` — median combined attacker multiplier is 1.00 ± 0.02
- [ ] Five-goal 150-turn run, tabled against §0.2 and against the **target band** below

---

## Stage 4 — Make the siege the answer to a fortress again

Closes **G5**. Two halves, independent, and the first is the truer fix.

- [ ] **4.1** `src/ai/muster.js` moves **infantry only**, because vehicles are gated by the oil
      capacity of wherever they stand. Let it move vehicles subject to the receiving territory's
      oil, so that a country can actually concentrate the force a siege needs
- [ ] **4.2** Or/and: `armyTypeSiegeValues.infantry` is 0.0001, so **250,000 men** are needed to
      escape the arrest band against bare terrain and ten naval units are worth a million
      infantry. Reprice so that a large infantry army is a *slow* siege rather than *no* siege
- [ ] **4.3** Whichever is chosen, `siegeScore()`'s stated intent — "a siege is broken by
      artillery and blockade, not by numbers" — is either preserved or explicitly revised in its
      own comment. It must not be quietly diluted
- [ ] **4.4** `SIEGE_ARREST_CHANCE` (0.6) and `SIEGE_ARREST_CAPTURE_SHARE` (0.5) are re-read in
      the light of 4.1/4.2 — losing the army *and* handing half of it to the defender is a very
      large penalty for being in a band most of the world cannot leave

### Stage 4 gate

- [ ] Sieges standing across the world, per sample, is no longer 0 or 1
- [ ] Five-goal 150-turn run, tabled

---

## Stage 5 — Measure a whole game

Addresses **G6**, **G7**, and known-issue **BO**.

- [ ] **5.1** `tools/ai-sim.mjs` gains two columns the audit had to read the JSON for:
      **cumulative conquests** and **world army**. A run whose army triples while its conquests
      fall to zero is a diagnosis, and it is currently invisible in the printed row
- [ ] **5.2** The five-goal 150-turn table, against the archived Goals and Victory §5 control
      (78–114 countries surviving, largest empire 51–97)
- [ ] **5.3** Does any goal now *finish*? CONQUEST and DOMINATION are the two that can be won
      outright inside 150 turns if the world consolidates at all
- [ ] **5.4** Known-issue **BO** re-stated with the new figures, or closed
- [ ] **5.5** Somebody plays it. The audit is emphatic that stages 1–2 are defects and stage 3 is
      a judgement; the judgement cannot be settled by a table

---

## What this phase must not break

Restated from audit §7 so it is in front of whoever is doing the work.

1. **One combat model. The player and the AI fight the same battle.** Never a second resolver.
2. **Bands, not a curve.**
3. **Ties go to the defender** — that is the defender's advantage in place of a multiplier.
4. **Fortification is a dice change, not a face bonus.**
5. **Two attack dials, permanently. Never a third.**
6. **`areaBonusFor()` stays byte-for-byte as it is** (AR).
7. **The rules run in Node** with an injected rng and no UI imports.
8. **The siege budget subtracts the sieges already running.**
9. **An AI attack costs the attacker its army.**
10. **The player's grace period stays**, and stays out of the battle model.

---

## The target

Audit §9 Q3, answered. **This replaces the archived Goals and Victory §5 table as the acceptance
band for this phase**, and only for this phase.

| | control (§0.2) | **target at turn 150** |
|---|---|---|
| countries surviving | 126 | **50–80** |
| largest empire | 43 of 359 (12%) | **90–120 (25–33%)** |
| continents held outright | 0 | **at least one; more than one under CONTINENTAL** |
| nearest continent | receding, 64% → 58% | **advancing** |
| conquests, late game | zero across three of six samples | **non-zero at every sample** |
| a goal completed by turn 150 | no | **no, and deliberately so** |

The game should be **decided in the 200–300 turn range**, not won at 150. The reason is about the
player's own game rather than the AI's: a world that produces a winner by turn 150 is a race a
player can lose by turn 60 without ever having had a game.

---

## The decisions, in one place

So they are not relitigated. All three are Leigh's, taken with the audit's measurements in front
of them; the reasoning is audit §9.

1. **More dice bands** — roughly nine instead of five. Not the unmatched-die change, and not
   "leave the model alone".
2. **Rebase `devIndex` and `combatContinentModifier` together** so the median attacker fights at
   ×1.00, keeping the spread. Not devIndex alone, and not "keep them as they are".
3. **Consolidating at 150, decided at 200–300.** Not a winner by 150, and not merely a return to
   the archived table.
