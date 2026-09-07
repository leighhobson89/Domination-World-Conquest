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

## Stage 1 — Make the AI decide with the function that fights — **DONE**

Closes **C1**, **C2**.

### 1a. A take-probability the AI can afford to call

- [x] **1.1** Unit test first: `tests/unit/rules-take-probability.spec.js`, 25 specs
- [x] **1.2** `src/rules/military/takeProbability.js`. **Not a precomputed table in the end, and
      not an approximation of anything**: it calls the real `battleForecast()` and MEMOISES the
      answer, so §7.1 holds by construction — the number the AI decides on comes out of the
      model that will fight. The cache key is the opening share (bucketed at 0.01), the
      fortification dice change, both face modifiers, and a signature of any unit count below 10
- [x] **1.3** Cost measured, `node tools/combat-lab.mjs cost` — 1,888 questions over 400 real
      pairings and a four-rung ladder: **112 cells, 94.1% hit rate, 282 ms cold and 3 ms warm**
- [x] **1.4** Pure and Node-runnable; imports `config/` and three rules modules, no rng of its own

#### What the cache key cost to get right, because the first version was wrong

The argument was that the battle is scale-free — casualties take a fixed FRACTION of each
side's current force and the break test is against its OWN starting force — so only the ratio
matters. Measured at a fixed seed, that is exactly true from a force of **2,000** upward and
false at 200, which is the integer floor in `applyCasualties()` and was expected.

What was **not** expected is that the face modifiers are only constant through a battle when the
COUNTS are large. A side holding one air unit loses it to that same floor in the first round and
its air superiority with it; a side holding a thousand keeps both. Two setups differing only in
that scaling came out **41.6 points apart** — four times the phase gate:

| smallest non-zero unit count | 1 | 2 | 5 | 10 | 25 | 50 |
|---|---|---|---|---|---|---|
| worst gap in take probability | **41.6** | 27.2 | 4.0 | 0.8 | 3.0 | 0.2 |

Hence `EXACT_COUNT_BELOW = 10`: exact where the floor bites, coarse where it does not. Raising
it further would defeat the cache, because vehicles are gated by oil and are genuinely counted in
single figures. Two specs in the invariance block assert the property with EXPLICIT SEEDS, so
they test the model rather than the cache.

### 1b. Every consumer on it

- [x] **1.5** `oddsFor()` in `calculateArmyQuantityBeingSentOrIfCancellingInteraction()`
- [x] **1.6** The `probability` passed into `rateTarget()`
- [x] **1.7** The hard floor in `getPossibleTurnGoals()`
- [x] **1.8** `siegeReview.js`'s assault odds

  All four are one swap: every AI path goes through `calculateProbabilityPreBattle(..., false)`,
  so `battle.js` gained `calculateTakeProbabilityPreBattle()` beside it and `aiCalculations.js`
  changed at three call sites and one import. The new function **calls the old one to build the
  setup** rather than repeating it — unpacking the attack array, summing four unit types across
  several attacking territories and averaging their development indexes is the bulk of the work,
  and two copies of it would be two answers to "which battle are we talking about".
- [x] **1.9** The player's window: **the BAR is untouched** and the question stays open for
      Leigh. What did change is the **Siege button's gate**, which now reads the real odds —
      otherwise `PROBABILITY_THRESHOLD_FOR_SIEGE` would mean one thing for the AI and another
      for the player, which is the drift this phase exists to end. `transferAndAttack.js`
      exports `takeOdds` alongside `probability` and both are commented with what they are for

### 1c. The latent defect underneath

- [x] **1.10** **C2** — `defenseMultiplierFor()` floors at 1. **Two existing specs asserted the
      defect as correct behaviour**, one of them with a comment explaining that "an undefended
      territory has a defence multiplier of 0, so the defender contributes nothing". Both were
      true descriptions of the bug. They now assert the documented intent, and say so. No
      territory on the shipped map moves: the lowest real bonus is 10, not 0

### Stage 1 gate — MET

- [x] The calibration table re-run: **worst error 2.2 points** against a gate of 10, from
      **+95 / −77** before. `node tools/combat-lab.mjs calibration` prints both tables
- [x] `npm run test:unit` — **1,060 passing** (was 1,035); lint baseline **unchanged** at
      343 problems / 73 errors / 270 warnings
- [x] 150-turn CONTINENTAL run

  | | control | after stage 1 |
  |---|---|---|
  | countries surviving | 126 | **121** |
  | largest empire | 43 | **48** |
  | top-16 share | 59% | **64%** |
  | nearest continent | 58%, receding | **98%** |
  | `needs-more-force` cancellations, one turn | 17 | **0** |
  | `committing` | 2 | 4 |

**The 17 requisition-instead-of-attack cancellations went to zero**, which is what the stage was
for. The world moved, and not far enough — and the executor's log now says why, in a sentence it
could not say before: *"the most this territory can spare reaches only **0%**"*, over and over.
With honest odds, most borders in this world genuinely cannot win. That is **G1** and **G2**, and
no odds constant fixes it.

---

## Stage 2 — Re-derive the floors and the aim — **DONE, and smaller than planned**

Closes **G3**, **G4**, **C4**.

**The plan for this stage was wrong, and stage 1's measurement is what corrected it.** It was
written expecting the floors to be far too LOW — 25 / 34 / 45 corresponding to real take
probabilities of 0.1% / 3.5% / 37.1% — and proposed raising them to 35 / 50 / 65. That would
have been a serious mistake. Once the AI reads real odds, those same figures mean what they say,
and the binding constraint has moved somewhere none of them can reach: the executor now reports
*"the most this territory can spare reaches only **0%**"*, which is a fact about two armies and
a mountain, not about a constant. Raising the floors would have suppressed the few attacks left.

So most of this stage is **restating** what the numbers now mean, and exactly two figures moved
— both on evidence.

- [x] **2.1** `attackDiscipline.minimumOdds` — **unchanged at 25 / 34 / 45**, with the measured
      before/after in the comment. They are sentences about the world now rather than in a
      currency that is not the world
- [x] **2.2** `commitmentDiscipline.decisiveOdds` — **unchanged at 65**. It meant a raw **3.91:1
      and a 94.1% real chance**; it now means a 65% chance, needing **2.21:1**. The constant did
      not move and the defect is closed, which is the shape of the whole phase
- [x] **2.3** `PROBABILITY_THRESHOLD_FOR_SIEGE` **15 → 8**. Measured at turn 25 straight after
      stage 1: **1,366 of 1,624 weighed pairings (84%) died at this gate**, up from 761 when it
      floored nothing. It is the wrong gate to be the biggest filter in the AI, because it sits
      ABOVE the siege decision — and a siege is exactly the answer to a target that cannot be
      stormed. Refusing to consider one because the assault odds are poor is refusing the tool
      for the job it exists for
- [x] **2.4** `siegeDiscipline.minimumOdds` **22 → 12**, same reason and same units: demanding a
      better than one-in-five chance of STORMING before you may lay a siege asks the target to
      be nearly takeable already
- [x] **2.5** **C4** — the `recordAttackOutcome(..., false, ...)` call in the `below-floor`
      branch is gone. It charged `SETBACK_ODDS_PENALTY` (12 points on both floors, compounding)
      for a battle that was never fought, and at turn 25 that had already produced **168
      refusals** for "lost here N time(s) already" against 187 verdicts that got through. The
      reinforcement demand is kept — "this border needs troops" is the useful half and costs the
      target nothing. A setback is now recorded only where one was suffered, in `doAttack()`
- [x] **2.6** Every figure above carries its measured meaning in its own comment

### The instrument had to be fixed too

`tools/combat-lab.mjs floors` was still calibrating against `winProbability()` after stage 1 —
measuring a number nobody reads, which is the same species of mistake as a lab holding its own
copy of the formula it measures. It prints **both** tables now:

| constant | needs a raw ratio of | real take there | |
|---|---|---|---|
| 8% | 1.16:1 | 9.1% | `PROBABILITY_THRESHOLD_FOR_SIEGE` |
| 12% | 1.26:1 | 13.4% | `siegeDiscipline.minimumOdds` |
| 25% | 1.52:1 | 27.1% | `minimumOdds.aggressive` |
| 34% | 1.65:1 | 36.7% | `minimumOdds.balanced` |
| 45% | 1.79:1 | 46.9% | `minimumOdds.pacifist` |
| **65%** | **2.21:1** | **66.7%** | `decisiveOdds` — was 3.91:1 and 94.1% |

Every figure now reads within about a point of its own value. That is what stage 1 bought.

### Stage 2 gate — MET

- [x] **The funnel from §0.3 re-measured.** Same seed, same turn, `--diagnose=25`:

  | | control (§0.3) | after stages 1-4 |
  |---|---|---|
  | pairings weighed | 1,583 | 1,560 |
  | attack verdicts | 187 | **382** |
  | siege verdicts | not reported separately | **91** |
  | `needs-more-force` cancellations | 17 | **0** |
  | conquests, that turn | 3 | **8** |
  | sieges laid / won, retained window | 1 standing, none won | **15 laid, 15 won** |

  **The gate this stage moved is no longer the gate that binds.** With the odds constants
  restated into real currency the executor's `needs-more-force` branch is empty, which is what
  stage 1 was for — but tracing the executor's own decisions on one turn returns
  *"the most this territory can spare reaches only **0%**"* in **56 of 61** sampled lines. That
  is a fact about two armies, not about a constant, and no odds figure in `balance.js` can reach
  it. It is the standing answer to what would move **G6** next, and it points at `muster.js`,
  `theatre.js` and the economy rather than at anything in this phase.
- [x] **150-turn CONTINENTAL run, tabled** — the `stage 2` column of the stage 3 gate table
      below: 105 countries, largest 56, one continent held from turn 100

---

## Stage 3 — Flatten the cliff — **DECIDED**

Addresses **G1**, **G2**. Stages 1–2 make the AI fight the battles it should; they do not change
the fact that those battles are decided before they are rolled.

**REVISED after the e2e suite.** The first table tried was 3–7 dice (base 6 at parity, 13 on the
tray). It measured best on the cliff — but the `battle/` e2e area began TIMING OUT, and that was
not brittle specs. It is now **2–6 dice, base 5 at parity, 11 on the tray**, with
`PAIRING_CASUALTY_SHARE` at 0.09 rather than 0.07. See "what it cost in wall clock" below.

Leigh's answers to audit §9 Q1 and Q2 settle what this stage is. **Two changes, and the other two
candidates are explicitly not taken.**

### 3a. More dice bands — closes G1

- [x] **3.1** **Done, and by the opposite route to the one this item names — see the arithmetic
      below.** More ROWS cannot flatten the cliff at all; a higher BASE count can. `DICE_SHARE_BANDS`
      is still five rows and now spans **2..6 dice** rather than 1..5, so a one-die gap is one in
      five rather than one in four. The unit tests were written first and they assert the
      PROPERTIES — monotonic, the bottom row never returns zero, the edges are exact — reading the
      band numbers out of the table, so the next band change re-baselines them by itself
- [x] **3.2** `DEFENDER_DICE_CAP` re-read and moved **4 → 5**, preserving the intent rather than
      the number: it is one below the top band, whatever the top band is. `rules-dice.spec.js`
      asserts `DEFENDER_DICE_CAP < TOP_BAND.dice` and that the cap does nothing at parity, so the
      relationship is pinned and neither figure is written down twice. The constant's own comment
      was still describing the 1..5 table and is corrected
- [x] **3.3** Three candidate tables built and measured on the same median defender. The shipped
      one spans **1.94×** — 10% at a 1.26:1 attacker, 90% at 2.45:1 — against a gate of 1.50×.
      The reverted wide table spanned 2.05×. See the table below for all three

### 3b. Rebase the attacker's multipliers — closes G2

- [x] **3.4** **The rebase is done and the median attacker fights at ×1.00 — but it is applied at
      the DIAL, not to the two tables.** `DICE_ATTACK_ADVANTAGE` goes 1.0 → **1.54**, which is
      arithmetically identical to rebasing both tables (a global multiplier preserves every
      relative difference ratio-for-ratio) and is what 3.5 forces. `node tools/combat-lab.mjs
      terrain` prints the check: devIndex × continent has a median of ×0.648 over 1,888 real
      adjacent enemy pairings, and combined with the dial it is **×1.00**
- [x] **3.5** **This is what decided 3.4's mechanism.** `devIndex` feeds `defenseBonusFor()`, the
      quadratic upgrade price ladder, `productivePopulationFor()` and the construction-materials
      ceiling, so touching the data would have made a combat decision into an economy change. The
      dial sits in `battleModel.js` and is read nowhere else, so the rebase cannot leak by
      construction — which is stronger than a comment asking it not to
- [x] **3.6** **Not taken, and correctly.** Editing the continent table alone would have left
      half the tax standing (the tax is the PRODUCT of the two), and editing it alongside a
      devIndex rebase was ruled out by 3.5. The dial does both halves at once. The table keeps
      its 0.75–0.99 spread, which is the regional character it exists for; what changed is where
      the centre of the product sits, and `terrain` is the standing check on it
- [x] **3.7** **Confirmed, and the wording of this item was wrong when it was written.** It said
      `DICE_ATTACK_ADVANTAGE` "stays at 1.0", which assumed the rebase would land in the two
      tables; 3.5 forced it onto the dial instead, so the number that moved is the dial itself.
      **That is still not a third dial** — it is the SAME lever the two-dials rule names for open
      battle, set to a new value. `ATTACK_ADVANTAGE` stays at **1.44** and still owns sieges
      through `scoreDifferenceFor()`, neither reaches into the other's model, and no constant was
      added. `CLAUDE.md`'s two-attack-dials note is restated to say 1.54 and why

### Not taken, and the reasons are on the record

- **The unmatched die stays an automatic hit.** It is the actual cause of the cliff, and it is
  also the reason a 2:1 attacker does not take a fortress 100% of the time — the overhaul
  measured that failure once already. Not off the table forever; off the table until nine bands
  have been measured and found insufficient.
- **`DICE_ATTACK_ADVANTAGE` is not moved.** It shifts the cliff sideways without changing its
  shape, so it addresses G2 and not G1, and 3b addresses G2 better.
- **`areaBonusFor()` is not touched** (known-issue AR, closed as a decision at B.10.4).

### What the band change actually required, and why "more bands" alone is impossible

**A candidate table at the same 1..5 dice range cannot work, and the reason is arithmetic.**
The gap between the two sides' counts is `f(share) - f(1 - share)`, so it grows by TWO every
band-width of share: re-cutting edges moves where the gap appears but cannot make one extra die
matter less. And one extra die is an UNMATCHED die, which is a free hit every round. The only
band-side fix is to raise the BASE count at parity, so that a one-die gap is one in five rather
than one in four. Measured on a single median defender (mountain 3, no forts, Africa):

| | control | dial only | **shipped: max 11 dice** | reverted: max 13 dice |
|---|---|---|---|---|
| bands | 1..5, base 4 | 1..5, base 4 | **2..6, base 5** | 3..7, base 6 |
| 10%-to-90% span | 1.92x | 1.77x | **1.94x** | 2.51x |
| biggest single jump | 45 pts | 45 pts | **40 pts** | 34 pts |
| battle length, rounds | 4–6 | 4–6 | **4–6** | 4–7 |
| `PAIRING_CASUALTY_SHARE` | 0.10 | 0.10 | **0.09** | 0.07 |

**The shipped table is barely flatter than the control** — 1.92× to 1.94×, and the biggest jump
only 45 points to 40. That is the honest reading and it is worth stating plainly: the cliff is
**still a cliff**, and what stage 3 actually bought was G2 rather than G1. What moved is *where*
the step sits — the median attacker fights at ×1.00 instead of ×0.63, so the ratio that clears it
is one a real border can reach. The wide table is the one that genuinely flattened it (2.51×,
biggest jump 34) and it was **reverted**: it made battles slower to WATCH, which the `battle/`
e2e area found by timing out and no amount of reading would have. **The dice STAGE is the ceiling
on this** — every die from both sides lands on one tray, so the table's maximum sets the count:
5 + 4 = 9 before, **6 + 5 = 11 shipped**, 7 + 6 = 13 for the reverted table. The spawn geometry
takes 13 (three lanes, ranks 1.7 apart in x, so they reach x = 3.0 against a wall at −1), but
`MAX_ROLL_MS` is 2,200 ms and more dice take longer to settle, so
`tests/e2e/battle/dice-stage.spec.js` is the check that matters and a further widening should not
be attempted without it.

### Two knock-on effects, both found by tests rather than by reading

- **Battles changed length, twice, and the second time is the one that mattered.** More dice per
  round means more pairings lost per round, so the wide table took battles to 3-5 rounds against
  the designed 5-8 and `PAIRING_CASUALTY_SHARE` went 0.10 -> 0.07 to compensate. The NARROWER
  table then had the opposite problem — fewer pairings, slower attrition, **5-8 rounds with a
  median of 6** — so it went to **0.09**, which restores 4-6 rounds and a median of 5: exactly
  what it was before this phase touched anything.

  **ROUND COUNT IS WHAT THE PLAYER WAITS FOR, not pairings.** Each round costs a dice throw
  capped at `MAX_ROLL_MS` (2,200 ms) plus a clash panel that lingers `LINGER_MS` (7,200 ms), and
  both are paid ONCE PER ROUND whatever the pairing count — so six short rounds are slower to
  watch than five long ones. That is why the pacing dial is set against rounds and not against
  attrition per round, and it is the whole reason the wide table was reverted.
- **That moved the scale-free threshold `takeProbability()`'s cache depends on**, from a force
  of **2,000 to 20,000** — a smaller casualty share means more rounds and so more chances for
  the integer floor in `applyCasualties()` to bite. `MIN_CACHEABLE_FORCE` is raised and now
  carries a note that it must be re-measured whenever that dial moves. **The spec asserting the
  property is what caught it**, which is the whole reason it was written as a property rather
  than as a number.

### The instruments had to be re-anchored too

`tools/battle-lab.mjs` used `attackingDevelopmentIndex: 1, combatContinentModifier: 1`. **No such
attacker exists**: development tops out at 0.962 and the friendliest continent is 0.99, so the
strongest on the map is 0.95 and the median is 0.648. Every figure it printed was about a country
nobody can play — and that is not academic, because the measurement arguing against ever raising
`DICE_ATTACK_ADVANTAGE` ("at 1.44 the attacker won 88.3% of even fights") was taken in exactly
that context. Both it and `tests/unit/rules-forecast.spec.js` now use the median real attacker,
and both say why.

Five unit specs also hard-coded the band numbers. They are derived from `DICE_SHARE_BANDS` now,
so the next band change re-baselines them by itself.

### Stage 3 gate — MET

- [x] `node tools/battle-lab.mjs` — even 1:1 still FAILS for the attacker (6.4%), 4-6 rounds,
      **stalemate rate zero everywhere**
- [x] `node tools/combat-lab.mjs cliff` — span **1.94x** against a gate of 1.50x, biggest single
      jump 40 points at the 0.50 band edge. (This line read **2.05x** until stage 5: that was the
      WIDE table's figure, left standing when it was reverted. Re-measured on the shipped table.)
- [x] `node tools/combat-lab.mjs terrain` — median combined attacker multiplier **x1.00**
- [x] `npm run test:unit` 1,061 passing; lint baseline unchanged
- [x] 150-turn CONTINENTAL run

  | | control | stage 1 | stage 2 | **stage 3** |
  |---|---|---|---|---|
  | countries surviving | 126 | 121 | 105 | **108** |
  | largest empire | 43 | 48 | 56 | **55** |
  | top-16 share | 59% | 64% | 62% | **62%** |
  | continents held | 0 | 0 | 1, from t100 | **1, from t75** |
  | conquests at t25 | 3 | 1 | 1 | **5** |

**Stage 3 is roughly neutral on the headline and better underneath it**: the continent falls 25
turns earlier and early conquest is up. It did NOT deliver the target band (50-80 countries,
largest 90-120), and the reason is visible in the executor's log — sieges are still 0 or 1 in the
entire world, so a fortified target still cannot be taken by any means at all. That is **G5**.

---

## Stage 4 — Make the siege the answer to a fortress again — **DONE, by neither route the audit proposed**

Closes **G5**.

### What the trace found

Sieges were not being refused. They were being **laid and then destroyed**. Traced over 30 turns
with `--trace="iege"`, the log is full of countries deciding and opening them —
*"Besiege Croatia from Switzerland (priority 1.0)"*, *"going to start a siege attack on Croatia
from Switzerland..."* — while `ai-sim` reported **0 or 1 siege standing in the entire world** at
every sample of every run across stages 1 to 3.

The cause is two decisions that are individually right and jointly fatal:

- `armyTypeSiegeValues.infantry` is 0.0001, so one point of siege score costs ten thousand men.
  Deliberate: *"a siege is broken by artillery and blockade, not by numbers."*
- `src/ai/muster.js` moves **infantry only**. Also deliberate: vehicles are gated by the oil
  capacity of the territory they stand in, so marching tanks into a dry province turns them into
  scenery.

Together they mean the AI's besieging armies are infantry, an infantry besieger scores about 10
against a bare mountain's 30, and **any negative score difference at all was the arrest band** —
a 60% chance every turn of being wiped out with half of it joining the defender. Expected life
under two turns.

### Why neither proposed fix works

- [x] **4.1** ~~Let `muster.js` move vehicles~~ — **does not address it.** The oil gate is on the
      DESTINATION, so moving vehicles to a front-line territory with no oil capacity leaves them
      unusable on arrival. The constraint is oil logistics, not transport, and that is a
      mechanism this phase did not set out to build.
- [x] **4.2** ~~Reprice `armyTypeSiegeValues.infantry`~~ — **blocked by a protected invariant, and
      this was found by breaking it.** `tests/unit/balance-unit-economics.spec.js` pins vehicles
      at five to six times better per gold in a siege, and `CLAUDE.md` records that it was written
      as a RATIO precisely so a later tuning pass could not quietly undo the siege-versus-battle
      trade. Raising infantry 0.0001 → 0.0004 dropped that ratio to **1.5**. The invariant caps
      the value at **0.00012**, and at 0.00012 a hundred thousand infantry still score 17 against
      a defence of 30 — still inside the arrest band. **Repricing cannot close G5 without
      destroying the one genuine economic decision the military layer offers.** Reverted.

### What was done instead — checklist item 4.4

- [x] **4.3** `siegeScore()`'s stated intent is preserved exactly: vehicles are untouched,
      infantry is untouched, and ten naval units are still worth a million infantry
- [x] **4.4** `SIEGE_ARREST_MARGIN`, a new constant, splits a state the model could not express.
      **"Cannot match the defences" and "is being destroyed" were the same thing.** A siege within
      50 points of the defences now INVESTS — it does no damage, starves nobody faster, and is not
      destroyed: an army sitting outside a town it cannot crack, which is what a siege at those
      odds should look like. Only a siege further under than the margin is swept away
- [x] `SIEGE_ARREST_CHANCE` stays at **0.6**. The audit asked whether it was too harsh; the answer
      is that the penalty was never the problem — most of the world could not LEAVE the band it
      applies to. Now that being in it means genuinely hopeless, losing the army is right

Three specs asserted the old behaviour with a score difference of −1 or −12, both of which are
now inside the margin. They cover **both sides of the split** instead, and read the margin from
the constant rather than naming a number.

### Stage 4 gate — MET on four goals of five

- [x] Five-goal 150-turn run, `--seed=goals --every=25`, against the §0.2/§0.4 control

  | goal | countries | largest | top-16 | continents | conquests (sampled) |
  |---|---|---|---|---|---|
  | CONTINENTAL | 126 → **82** | 43 → **70** | 59% → **75%** | 0 → **1** | 7 → **28** |
  | CONQUEST | 122 → **80** | 52 → **62** | 61% → **76%** | 0 → **1** | 6 → **37** |
  | DOMINATION | 115 → **87** | 46 → **65** | 64% → **74%** | 0 → **1** | 8 → **20** |
  | GREAT_POWERS | 104 → **98** | 48 → **53** | 68% → **69%** | 0 → **1** | 12 → **21** |
  | TURN_LIMIT | 113 → **107** | 36 → **62** | 58% → **63%** | 0 → **1** | 11 → **12** |

- [x] **A continent is held outright in EVERY goal**, against **zero in every goal** in the
      control — and the nearest continent reaches 100% in all five, where the control's was
      *receding* from 64% to 58%. That is the mechanic the continent-bonus phase built becoming
      reachable again, and it is the single clearest result of the phase.
- [x] **Conquest restarted everywhere.** Summed over the sampled turns: 7 → 28, 6 → 37, 8 → 20,
      12 → 21, 11 → 12. The control had three samples with **not one conquest anywhere in the
      world**; CONQUEST reached 17 in a single turn.
- [x] **The goals produce visibly different worlds again**, which is the archived Goals and
      Victory acceptance criterion: 80 to 107 countries surviving and a largest empire of 53 to
      70, against a control that had flattened them all into 104–126 and 36–52.

**GREAT_POWERS and TURN_LIMIT moved least** — 104 → 98 and 113 → 107 countries. Both are goals
whose doctrine points the AI at named rivals or at the clock rather than at contiguous ground, so
they benefit least from combat being winnable and most from whatever makes a leader compound.
They are the two to watch in stage 5.

- [x] **Sieges standing is still 0–2 per sample — and stage 5.1 shows that is the GOOD
      explanation.** With cumulative counters in the instrument, a 40-turn run reports **32
      sieges laid and 29 won**. They were never rare; they were short and successful, and a
      snapshot taken every 25 turns simply could not see them. **G5 is closed, with evidence
      rather than by inference** — which is the whole reason this box was left unticked until
      the instrument could answer it.

      The superseded reasoning, kept because it is the habit worth carrying: `siegeWon` now
      appears where it did not before, which is consistent with the good explanation — a siege
      that succeeds does not show up in a snapshot taken every 25 turns — but it is equally
      consistent with sieges still being rare. **A snapshot count cannot tell a short successful
      siege from a siege that never happened**, and that is a defect in the instrument rather
      than a finding: `ai-sim.mjs` needs a CUMULATIVE siege counter (stage 5.1) before this can
      honestly be called fixed. The conquest numbers above are strong enough that the phase does
      not depend on it, but the claim would be unevidenced.

---

## Stage 5 — Measure a whole game

Addresses **G6**, **G7**, and known-issue **BO**.

- [x] **5.1** `tools/ai-sim.mjs` gains the columns the audit had to read the JSON for, and stage
      4 added a third to the list:
      - **cumulative conquests** — the per-turn number is sampled every 25 turns, so it reports a
        window and not a total
      - **world army** — a run whose army triples while its conquests fall to zero is a
        diagnosis, and it was invisible in the printed row
      - **cumulative sieges LAID and RESOLVED.** The standing count is a snapshot, and a snapshot
        cannot tell a short successful siege from a siege that never happened.

      **The third one earned its place immediately.** The first run with it reported **32 sieges
      laid and 29 won over 40 turns**, against a standing count that never rose above 2, and the
      final run reports 15 laid and 15 WON by turn 25. Stage 4 had been unable to say whether G5
      was fixed; one column settled it.

      **They are NOT cumulative, and the first version of this claimed they were.**
      `window.__game.activity()` is a bounded ring, so the totals rise and then FALL as early
      turns are evicted — measured on one 150-turn run the conquest figure read 288 at turn 25,
      455 at turn 50 and **134 at turn 150**. They are a window: wider than the single turn the
      columns beside them report, narrower than the run. The columns are named `conqLog`, `laid`
      and `sgWon` rather than `conqAll` so the row cannot be read as a total, and the limitation
      is written at the site. **A true cumulative count needs `--every=1` or a counter kept by
      the game rather than derived from the feed**; that is worth doing and is not done. It does
      not weaken the G5 finding — 15 laid and 15 won inside one retained window still proves
      sieges are laid and won, which a standing count of 0 can never show.
- [x] **5.2** The five-goal table against the target band in §9 Q3 — **measured, and the band is
      NOT met by the shipped table.** Both tables are below; the wide one reaches it and the
      narrow one does not. That trade is the open decision this phase ends on
- [x] **5.3** Does any goal now *finish*? **No, and that is the target** — audit §9 Q3 asks for a
      world consolidating at 150 and decided at 200–300, deliberately not won at 150
- [x] **5.4** Known-issue **BO** **re-stated, not closed** — which was the box, and either
      outcome ticks it. The control completed no continent in any goal with the nearest RECEDING
      64% → 58%; both new tables complete one and the wide one completes one in all five goals.
      Continental asks for three. BO now closes when **G6** does and the register says so
- [x] **5.5** Somebody plays it. Stages 1 and 2 were defects; stage 3 is a judgement and stage 4
      is a rule change. No table settles either. **Ticked as CARRIED rather than as done**: it is
      Leigh's to do, and it is the ground on which the dice table was decided — keep the narrow
      one and judge the trade by playing. Carried into
      [05-outstanding-improvements.md](./05-outstanding-improvements.md)

### Stage 5.2 — the five-goal table, all three tables side by side

`--turns=150 --seed=goals --every=25`, control against the wide table stage 4 shipped first and
the narrower one that replaced it:

| goal | countries: control → wide → **narrow** | largest | continents |
|---|---|---|---|
| CONTINENTAL | 126 → 82 → **101** | 43 → 70 → **65** | 0 → 1 → **1** |
| CONQUEST | 122 → 80 → **98** | 52 → 62 → **66** | 0 → 1 → **1** |
| DOMINATION | 115 → 87 → **120** | 46 → 65 → **50** | 0 → 1 → **1** |
| GREAT_POWERS | 104 → 98 → **102** | 48 → 53 → **59** | 0 → 1 → **0** |
| TURN_LIMIT | 113 → 107 → **103** | 36 → 62 → **47** | 0 → 1 → **0** |

**The wide table is the better game and the narrow one is the better battle**, and that is the
trade this phase ends on. The narrow table loses two of the five continents and takes DOMINATION
back to 120 countries — barely better than the 115 control — while keeping a battle at the 4–6
rounds it has always been. The wide table held a continent in every goal.

**The wall-clock objection to the wide table is now weaker than it looked**, because the e2e
budgets that raised it were themselves wrong (below). Going back to it is a live option and it is
Leigh's call, because it is a change to how long a battle takes to WATCH and no table settles that.

### Stage 5.3 — does any goal finish?

**No, and that is the target.** Audit §9 Q3 asks for a world consolidating at 150 and decided at
200–300, deliberately not won at 150.

### Stage 5.4 — known-issue BO

**Moved further than at any point in its history, not closed.** The control completed no continent
in any goal with the nearest RECEDING 64% → 58%. Both new tables complete one; the wide one
completes one in all five goals. Continental asks for three.

### Stage 5.5 — somebody plays it

**Outstanding when this phase was archived, and it is the item the phase cannot do for itself.**
Stages 1 and 2 were defects; stage 3 is a judgement and stage 4 is a rule change.

It is also what settled the dice table. Given the trade in 5.2 — the wide table reaches the target
band, the narrow one keeps a battle at the length it has always been — Leigh kept the narrow table
and chose to judge it by playing rather than by any further measurement. That is the right call
for the same reason this item exists: no table settles how long a battle should take to watch.

---

## What the e2e suite cost, and what it found

One full run (464 passed / 14 failed / 28 min) and three targeted re-runs. It found **two real
defects and one wrong instrument**, none of which any amount of reading would have produced:

1. **The siege gate spec was comparing two different quantities.** It read the attack window's BAR
   (`winProbability`) against `PROBABILITY_THRESHOLD_FOR_SIEGE`, which now gates on
   `takeProbability`. Its sibling was passing by luck. `window.__game.siegeGateOdds()` exposes the
   gate's real input and both specs assert the rule the game enforces. **This is evidence for
   closing item 1.9 by switching the player's bar**: the first thing that happened after leaving
   the two different was that a reasonable assumption became false.
2. **Known-issue C5**, logged not fixed: the player's own territories are given random starting
   forts, because `addRandomFortsToAllNonPlayerTerritories()` reads `playerOwnedTerritories`
   before `getPlayerTerritories()` has filled it.
3. **The battle spec budgets were inconsistent for no stated reason** — `rounds.spec.js` had none
   at all (so the 120s default), `defender-playback.spec.js` had 120s where its siblings had 180s,
   and three of its polls allowed **8 seconds** for a playback round that takes 6.2 by design.
   The `siege/` area had already budgeted 240–300s for the same battles. They are 240s and 30s
   now, with the pacing arithmetic written at the site.

**The `battle/` area went 9 failures → 5 → 2** across the three re-runs, and the failing SET
changed every time — `rout` failed once and passed twice, `rounds` passed then failed then passed.
That is load-sensitivity, not a fault. The two that remain are named races:
`defender-playback:201` clicks a Skip button the playback has already removed, and
`known-broken:59` (two concurrent sieges) still runs on `game.js`'s own 120s `waitForFunction`.
**Neither is chased further here**; both are spec races and both are written down rather than
left as folklore.

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

## How this phase closed

**Every box in stages 0–5 is ticked.** The closing pass re-measured what had only been asserted,
corrected three documents that described a dice table which had been reverted, and took the three
decisions that were left over. Everything still outstanding is carried into
[05-outstanding-improvements.md](./05-outstanding-improvements.md), which is the standing list of
what the measurements say to do next.

### The three decisions taken at close — Leigh's

1. **The dice table stays NARROW (2..6 dice).** Stage 5.2's trade: the wide table reaches the
   target band, the narrow one keeps a battle at the 4–6 rounds it has always been. Judged by
   playing rather than by another table, which is exactly what 5.5 is for. **The wide table is not
   deleted** — it is on the record in 5.2 with both its numbers, and going back to it is one
   `DICE_SHARE_BANDS` edit plus a `PAIRING_CASUALTY_SHARE` change. Worth carrying: the wall-clock
   objection that got it reverted rested partly on e2e budgets that were themselves wrong and have
   since been corrected.
2. **Item 1.9 is CLOSED by switching the player's bar to `takeProbability()`.** The attack window's
   bar now shows the same quantity the Siege gate is judged on, the AI decides with, and the
   preview's forecast line states — one number, one meaning, everywhere. **The cost is stated
   rather than hidden**: the bar no longer shows the strength ratio that picks the DICE COUNT, so
   the itemised dice preview is now the only place a player can see a die coming.

   Done test-first, and **the spec written for it found two more specs in `attack/` that had been
   asserting nothing at all.** They read the BATTLE UI's probability element while the attack
   window was open, where it is empty: the text was `""`, `Number("")` was 0, and both assertions
   — "is it finite and within 0..100" and "did it not go down" — are true of a constant zero. Then
   the same trap caught the replacement, which passed before the fix because a single committed
   infantryman puts both quantities at zero. It carries a guard assertion now.
3. **Known-issue C5 stays logged and unassigned.** Fixing the player's random starting forts
   removes about one `Math.random` draw per player territory during bootstrap, which moves every
   seeded outcome in the game. It wants its own measurement, not a tail-end fix here.

### What was corrected at close, and it is this phase's own lesson repeated

Three documents described the **wide dice table that was reverted** as though it had shipped: the
stage 3 gate quoted its 2.05× span, the register's **G1** entry described 3–7 dice and 13 dice on
the tray, and `CLAUDE.md` still gave `DICE_ATTACK_ADVANTAGE` as 1.0 when it is 1.54. Two source
comments were stale the same way — `DEFENDER_DICE_CAP`'s said "the defender never rolls five" when
five is now exactly what it rolls, and `takeProbability.js` stopped its history at 0.07.

None of it was wrong when it was written. All of it was left standing when the decision reversed.
**A revert is a documentation change as much as a code change**, and the shipped span had to be
re-measured from scratch to find out which of the two figures in the document was the true one:
**1.94×**, 10% at a 1.26:1 attacker and 90% at 2.45:1.

### The findings carried forward

1. **The binding constraint has moved, and it is no longer combat.** `needs-more-force`
   cancellations are at zero and attack verdicts have doubled, but the executor answers *"the most
   this territory can spare reaches only 0%"* in **56 of 61** sampled decisions. No figure in
   `balance.js` can reach that. It points at `muster.js`, `theatre.js` and the economy — a phase of
   its own, not a remainder of this one.
2. **G6, G7 and BO stay open**, and the register now says where each of them lives.
3. **The cliff is still a cliff.** Stage 3 bought G2 rather than G1: 1.92× → 1.94×. The lever held
   in reserve is making an unmatched die a contested roll, which touches `resolvePairings()`.
4. **A class of test defect worth one deliberate sweep**: the assertion whose failure mode is also
   its default. Three instances in this phase, none of them found by reading.

### What the closing e2e runs said

`attack` **17/17**. `siege` clean. `battle` **40/42**, failing on `known-broken:59` and `:95` —
which are the documented race and not a regression: the whole file passes **4/4 in 18 seconds at
`--workers=1`** and times out under four. A combined `siege battle` run failed a *different* set
of four and passed all of those, which is the load-sensitivity this area has had all along.
Unit suite **1,062 passing**; lint baseline unchanged at 343 problems.

---

## The decisions, in one place

So they are not relitigated. All three are Leigh's, taken with the audit's measurements in front
of them; the reasoning is audit §9.

1. **More dice bands** — roughly nine instead of five. Not the unmatched-die change, and not
   "leave the model alone".

   *Carried out as a wider RANGE rather than more rows*, because more rows cannot flatten the
   cliff at all — the arithmetic is in stage 3. Five rows still, spanning 2..6 dice instead of
   1..5. The decision's intent (crossing an edge should buy less) is served; its mechanism was
   not available.
2. **Rebase `devIndex` and `combatContinentModifier` together** so the median attacker fights at
   ×1.00, keeping the spread. Not devIndex alone, and not "keep them as they are".

   *Carried out at `DICE_ATTACK_ADVANTAGE` (1.0 → 1.54) rather than in the two tables*, which is
   arithmetically the same rebase and is what item 3.5 forces: `devIndex` also feeds the economy,
   and a combat decision must not leak into it.
3. **Consolidating at 150, decided at 200–300.** Not a winner by 150, and not merely a return to
   the archived table.

   *Achieved in direction and not in degree.* The world consolidates and no goal finishes by 150,
   which is the shape asked for; the shipped table lands at 98–120 countries against a band of
   50–80. See stage 5.2 — the wide dice table reaches the band, and choosing between them is the
   open question this phase ends on.
