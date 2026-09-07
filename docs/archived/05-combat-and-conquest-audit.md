# Combat and Conquest — Audit, and a Plan

**Why a world of 207 countries stops fighting, measured.**

The task breakdown for this document is
[06-combat-and-conquest-checklist.md](./06-combat-and-conquest-checklist.md).

---

## 0. The question, and the short answer

The question was Leigh's, and it was asked from watching the game rather than from reading it:
*a spectated AI game never produces a winner, the attacks dry up, and nothing reaches an
ending.* The register has carried a version of this since Phase 7.8, first as **"attacking is
too hard"** and most recently as **"has attacking gone too far the other way? Nobody has played
the world the measurements describe."** It has been moved four times by defect fixes and twice
by tuning, in both directions.

It is measured now, and the answer is not a dial. **Four independent things are wrong, and only
one of them is a balance number.**

1. **A battle is a step function, not a probability.** Against a real defending territory an
   attacker at 1:1 takes it 3% of the time and an attacker at 3.5:1 takes it 94% of the time,
   and almost the whole transition happens across a single band edge. There is no ratio at
   which a battle is a decision rather than a foregone conclusion. (§3.1)
2. **The attacker is scaled down twice and the defender is never scaled up.** A median attacker
   fights at ×0.63 of its own force, so it must field **1.58× just to draw level**. (§3.2)
3. **Over half the map takes a die off the attacker before anybody builds anything.** The
   fortification bands are documented in terms of *forts*; they are applied to *forts plus
   mountains*, and mountains alone put **53.5% of the 359 territories** at or past the band the
   comment describes as "two forts". (§3.3)
4. **The AI decides with a different function from the one that fights**, and the two disagree
   by up to **95 percentage points in both directions**. On top of that its aim,
   `commitmentDiscipline.decisiveOdds = 65`, means **raw four to one** in that function's units —
   so on almost every border in the world an attack is planned, ranked, budgeted, and then
   cancelled at the last step in favour of a requisition. Measured on one turn: **43 of 48
   attacks that reached the executor were cancelled**, one of them refused at 63% for being
   "2 points short" of 65. (§4)

The world does not stop because the AI cannot see a target. It stops because **every country in
it is holding out for a battle it is never going to be offered**, and meanwhile the army it is
saving piles up: the top eight countries hold 44 million men at turn 25 and **126 million at
turn 150**, while conquests across the whole world fall to **zero**. (§5)

---

## 1. The instruments

Three, and each answers something the others cannot.

| Instrument | What it answers | Cost |
|---|---|---|
| `node tools/battle-lab.mjs` | Does a matchup of shape X behave as the overhaul designed, on a featureless lab territory | ~1s |
| `node tools/combat-lab.mjs [section]` | **New in this phase.** What the same rules do against the REAL map, and what the AI is told about it. Sections: `terrain`, `cliff`, `calibration`, `forts`, `siege`, `floors` | ~20s |
| `node tools/ai-sim.mjs --turns=150 …` | Does the world consolidate. Nothing else can see a frozen map — nothing throws, every turn completes, the unit suite passes | ~3 min |

`combat-lab.mjs` reconstructs every territory's *defensive* identity from the three files the
game seeds from — `resources/svgMaster.svg`, `resources/pathAreas.json` and `initialData.js` —
and runs the real rules over it. Like `econ-lab.mjs` it **imports every formula it measures and
re-copies none of them**, for the reason recorded in `CLAUDE.md`: an instrument holding its own
copy of the thing it measures will eventually measure the copy.

Every number below is reproducible from those three commands on seed `goals`.

---

## 2. How a battle is actually decided

Four things happen, in this order, and only the third is the dice.

**One — the share.** `shareFor()` in `src/rules/military/battleModel.js` reduces two armies and
a territory to one number:

```
attacking  = force × DICE_ATTACK_ADVANTAGE × attackerDevIndex × combatContinentModifier
defending  = force × areaBonusFor(territory)
share      = attacking / (attacking + defending)
```

**Two — the dice counts.** `DICE_SHARE_BANDS` turns that share into 1–5 dice, and the defender
takes the same table capped at 4. Then `DIE_MODIFIERS.fortification` **subtracts** dice from the
attacker, banded on `defenseBonus + mountainDefenseBonus`.

**Three — the round.** Both sides roll, faces are sorted and paired high against high, ties go
to the defender, and **any die the other side cannot match is an automatic hit**. Each lost
pairing costs 10% of that side's *current* force. Rounds run until one side is below 20% of what
it started with.

**Four — and separately — what the AI was told.** `winProbability()` in
`src/rules/military/probability.js` is a completely different calculation:

```
attacking  = force × attackerDevIndex × combatContinentModifier × ATTACK_ADVANTAGE (1.44)
defending  = force × defenseMultiplierFor(territory) × areaBonusFor(territory)
odds       = attacking / (attacking + defending) × 100
```

Note what is in one and not the other. The dice model has **no** `defenseMultiplierFor()` — that
was deliberate and is right, because forts became a dice penalty instead. The odds function has
**no idea the dice exist**. `ATTACK_ADVANTAGE` is 1.44 in one and `DICE_ATTACK_ADVANTAGE` is 1.0
in the other, and `CLAUDE.md` records why that split is permanent.

**Everything in §4 follows from the fact that the AI's every decision is taken on the fourth
calculation and every battle is fought with the first three.**

---

## 3. What the numbers actually are

### 3.1 The battle is a step function

`node tools/combat-lab.mjs cliff` — 105 real adjacent enemy pairings, infantry against infantry,
the attacker fielding a multiple of the defender's force:

| raw ratio | commonest dice | AI is told | **real take** |
|---|---|---|---|
| 0.50:1 | 1v4 | 21.2% | **0.0%** |
| 1.00:1 | 2v4 | 34.4% | **3.1%** |
| 1.25:1 | 2v4 | 39.4% | **12.6%** |
| 1.50:1 | 3v3 | 43.7% | **23.0%** |
| 1.75:1 | 3v3 | 47.3% | **41.0%** |
| 2.00:1 | 3v3 | 50.5% | **53.6%** |
| 2.50:1 | 4v3 | 55.8% | **76.5%** |
| 3.00:1 | 4v2 | 60.1% | **87.5%** |
| 3.50:1 | 4v2 | 63.6% | **93.8%** |
| 5.00:1 | 4v2 | 71.1% | **99.0%** |

Averaging over the map hides how sharp it is on any one territory. Against a *single* median
defender — mountain factor 3, no forts, in Africa, attacked by a median-development neighbour —
it is a cliff:

| raw ratio | dice | real take |
|---|---|---|
| 1.50:1 | 2v4 | **0.0%** |
| 1.75:1 | 3v3 | 7.6% |
| 3.00:1 | 3v3 | 50.7% |
| **3.50:1** | **3v2** | **94.6%** |
| 4.00:1 | 4v2 | 100.0% |

**Half a rung of force, from 3.0 to 3.5, moves the outcome from a coin flip to a certainty**,
because it crosses a band edge and buys an unmatched die — and an unmatched die is not a small
edge, it is a free casualty every round for the rest of the battle. Below 1.75:1 the attacker's
chance is not small, it is **zero**.

This is the correct behaviour of the model as designed. `balance.js` says so explicitly and says
why bands were chosen over a curve: *"forty thousand more infantry gets me a fourth die is a
decision; my odds went up 1.8% is not."* The design intent is sound. What was not foreseen is
that with **five** bands and an automatic-hit rule, the space between "cannot win" and "cannot
lose" is narrower than the granularity any country can actually manoeuvre within.

### 3.2 Two multipliers on the attacker, none on the defender

`node tools/combat-lab.mjs terrain`:

```
attacker's development index  min / median / max   0.326 / 0.745 / 0.962
   DICE_ATTACK_ADVANTAGE            x1.00
   devIndex, median                 x0.745
   combat continent modifier        x0.75 (Oceania) .. x0.99 (North America)
   combined, median                 x0.63   -- must field 1.58x to draw LEVEL
```

The defender's only multiplier in the dice model is `areaBonusFor()`, and it is measured across
the real map at **min 0.507, median 1.000, max 1.000**. It never rises above 1. It cannot: the
`Math.min` that known-issue **AR** describes caps the ratio at 1, so the term is exactly 1 for
every territory under the threshold and a *penalty* for every one above it. That was measured at
B.2.6 and **closed as a design decision** — the naive correction gives the smallest territory on
the map a 1,047× defence bonus — and this document does not reopen it.

But the consequence has never been stated in one place, so it is stated here: **the dice model
has two multipliers that make an attack weaker and none at all that makes a defence stronger.**
An attacker at true parity is at 0.63, which is the 0.35 band — three dice against four — and
three dice against four is a loss.

At the extreme this is severe rather than merely unfavourable. An Afghan territory (devIndex
0.326) attacking into Oceania (×0.75) fights at **×0.24**, so it needs **four to one in raw men
to reach parity** and something over ten to one to actually take the place.

### 3.3 Half the map costs a die before anyone builds anything

```
territories                            359
dice taken off the attacker  0 / 1 / 2  167 / 192 / 0
share of the map that costs a die       53.5%  -- with ZERO forts built
```

`DIE_MODIFIERS.fortification` bands at 25 and 100 on `defenseBonus + mountainDefenseBonus`. Its
comment explains the bands entirely in terms of forts — *"one fort is a nuisance, two is a die,
three is a fortress"* — and that is a fair description of `defenseBonus`, which is
`ceil(forts × (forts+1) × 10 × devIndex) + landlockedBonus`.

It is not a description of what the band actually reads. `mountainDefenseBonus` is
`mountainDefenseFactor × 10`, and the SVG's distribution of that factor is:

| factor | bonus | territories |
|---|---|---|
| 1 | 10 | 42 |
| 2 | 20 | 144 |
| 3 | 30 | 126 |
| 4 | 40 | 36 |
| 5 | 50 | 11 |

Every territory with factor 3 or more clears the 25-point band on terrain alone, and so does
every landlocked factor-2 territory (20 + 10). **192 of 359 territories cost an attacker a die
with no fort anywhere on the map**, and §3.1 shows what one die is worth: on a median defender
it is the difference between needing 2:1 and needing 3.5:1.

### 3.4 The fort ladder barely exists in the model that fights — and dominates the one that decides

`node tools/combat-lab.mjs forts`:

| forts | defBonus | +mountain | dice off | `winProbability` × | ratio for a 70% real take |
|---|---|---|---|---|---|
| 0 | 0 | 30 | −1 | ×2 | 3.5:1 |
| 1 | 15 | 45 | −1 | ×3 | 3.5:1 |
| 2 | 45 | 75 | −1 | ×5 | 3.5:1 |
| 3 | 90 | 120 | −2 | ×8 | 4:1 |
| 4 | 149 | 179 | −2 | ×12 | 4:1 |
| 5 | 224 | 254 | −2 | ×17 | 4:1 |

**Building five forts moves the force an attacker needs from 3.5:1 to 4:1.** The dice penalty
caps at −2 and the defender's dice cap at 4, so past the second band a fort buys nothing at all
in the battle.

In the function the AI decides on, the same five forts multiply the defence by **seventeen**.
`defenseMultiplierFor()` is `ceil((defenseBonus + mountainDefenseBonus) / 15)`, an unbounded
ceiling division — which also means that at zero total bonus it returns **zero**, not one, and
`winProbability()` then reports 100% against any garrison whatsoever. That is latent rather than
live (every territory on the shipped map has a mountain factor of at least 1) but it is the case
the function's own comment claims to handle: *"A territory with no forts, no mountains and no
land-locked bonus defends at face value."* It does not; it defends at nothing.

### 3.5 Sieges are shut to the army the AI actually has

`node tools/combat-lab.mjs siege`:

```
siege value per unit  {"infantry":0.0001,"assault":3,"air":5,"naval":10}
so one point of siege score costs 10,000 infantry, or a tenth of one naval unit

besieging force              score   x1.44   difference against a defence of 20 / 30 / 40 / 50
100,000 infantry                10      14       -6    -16    -26    -36
250,000 infantry                25      36       16      6     -4    -14
1,000,000 infantry             100     144      124    114    104     94
10 naval                       100     144      124    114    104     94
```

A negative score difference is the **arrest band**: `SIEGE_ARREST_CHANCE` is 0.6, so each turn
there is a 60% chance the besieging army is destroyed outright and
`SIEGE_ARREST_CAPTURE_SHARE` of it *joins the defender*.

Every territory on the map carries a mountain bonus of at least 10. So an infantry-only siege
sits in the arrest band **until it is a quarter of a million men**, and ten naval units are
worth a million infantry.

That is a defensible rule — the comment on `siegeScore()` states it deliberately: *"a siege is
broken by artillery and blockade, not by numbers"*. What makes it a problem rather than a
flavour is the other end. `src/ai/muster.js` — the only mechanism in the AI that moves force
between turns — **carries infantry and nothing else**, and it says why: vehicles are gated by
the oil capacity of wherever they stand. So the AI's one route to massing a force cannot mass a
force that can lay a siege.

Measured over 150 turns, the whole world had **0 or 1 siege standing** at every sample.

---

## 4. The AI decides with a different function from the one that fights

### 4.1 The two disagree, and the sign flips

`node tools/combat-lab.mjs calibration` — a median attacker (devIndex 0.745) into Africa:

| defender | ratio | AI is told | real take | the AI's error |
|---|---|---|---|---|
| flat ground, no forts | 1.5:1 | 100.0% | 5.5% | **+95 pts too optimistic** |
| mountain 3, no forts | 1.5:1 | 39.5% | 0.0% | **+39 pts too optimistic** |
| mountain 3, no forts | 2.5:1 | 52.1% | 30.3% | +22 pts too optimistic |
| mountain 5, no forts | 2.5:1 | 35.2% | 31.3% | +4 pts |
| mountain 3, 2 forts | 4:1 | 41.0% | 100.0% | **−59 pts too pessimistic** |
| mountain 3, 5 forts | 4:1 | 17.0% | 80.3% | **−63 pts too pessimistic** |
| mountain 3, 5 forts | 6:1 | 23.5% | 100.0% | **−77 pts too pessimistic** |

It is not a bias that could be tuned out with a constant. **The sign flips on exactly the
feature that matters most.** The AI over-rates an attack on unfortified mountain — which it then
loses — and under-rates one on a fortress, which it would have walked into.

That B.5 measured the AI's swap onto the shared battle model as *balance-neutral* is not
evidence against this; it is the same finding seen from the other side. The checklist records
the reason: *"the AI rates targets against odds floors and mostly attacks where it is already
strongly favoured… the two models agree almost exactly on a lopsided fight and only diverge near
parity, which is the region the AI deliberately avoids."* That was true, and it is a description
of a country that never fights anything close. It was read at the time as "no retune needed".

### 4.2 What the AI's constants actually mean

`node tools/combat-lab.mjs floors`:

| constant | means a raw ratio of | real take there | which constant |
|---|---|---|---|
| 15% | 0.34:1 | **0.0%** | `PROBABILITY_THRESHOLD_FOR_SIEGE` — the floor beneath everything |
| 25% | 0.66:1 | **0.1%** | `attackDiscipline.minimumOdds.aggressive` |
| 34% | 1.03:1 | **3.5%** | `attackDiscipline.minimumOdds.balanced` |
| 45% | 1.67:1 | **37.1%** | `attackDiscipline.minimumOdds.pacifist` |
| **65%** | **3.91:1** | **94.1%** | `commitmentDiscipline.decisiveOdds` — what an attack AIMS at |

Read the last row first. **An ordinary AI attack is sized to reach a figure that means four to
one in raw men.** `decideCommitment()` walks a four-rung ladder of the force a border can spare,
stops at the first rung clearing the aim, and if nothing clears it, returns `needs-more-force`
and files a requisition instead of attacking.

Read the top rows second. An aggressive leader's floor of 25 is satisfied at **two thirds of the
defender's strength**, where the real take probability is one tenth of one per cent. So when the
AI *does* fight below its aim — which it does whenever the target belongs to its committed
theatre rival, via `pressOnBelowAim` — it fights battles it has essentially no chance of
winning, and every one costs it the army it sent.

**Both ends are wrong, in opposite directions, from the same cause**: the numbers are stated in
the units of a function that is not the battle.

### 4.3 The measured consequence, on one turn

`node tools/ai-sim.mjs --turns=25 --seed=goals --goal=CONTINENTAL --diagnose=25`, turn 25, 143
countries planning:

```
verdicts   {"Skip":1310,"Attack":187,"Siege":86}  over 1583 pairings
budgets    attack 1.43/country, siege 0.64/country, odds floor 38.5%
   761  below the 15% floor the game applies to everybody
   324  odds N% below the siege floor of N%
   187  odds N% clear the floor of N%
   168  lost here N time(s) already and N% is no better than it was
    68  odds N% too thin to storm
```

And then `--trace=" against "` on the last turn, which prints the executor's own account of
every commitment decision it took. **48 decisions:**

| outcome | count |
|---|---|
| `committing` — cleared the 65% aim | **2** |
| `pressing the war` — theatre rival, allowed below the aim | **3** |
| `needs-more-force` — cancelled, troops requisitioned | **17** |
| `below-floor` — cancelled, and recorded as a defeat | **26** |

**Forty-three of forty-eight planned attacks were cancelled at the last step.** The sentence
that says the whole thing is one of the seventeen:

> `only 63% against Fraser Island with what this border can spare — 2 points short, so send
> troops rather than men`

63% on `winProbability` is roughly 3.5:1 in raw men, which §3.1 measures at a **94% real chance
of taking the territory**. It was refused for missing an arbitrary 65 by two points.

The funnel over one turn is therefore: **1,583 pairings weighed → 187 attack verdicts → 48 reach
the executor → 5 attacks pressed → 3 conquests.** The budget is not the constraint (mean attack
budget 1.43 × 143 countries ≈ 204 slots against 187 verdicts). The last step is.

### 4.4 And the memory then locks it in

`SETBACK_ODDS_PENALTY` adds 12 points to both floors per previous defeat against a target, and
`decideCommitment()`'s `below-floor` branch **records a defeat without a battle having been
fought**. At turn 25 that is already the fourth-commonest skip reason — 168 pairings refused for
*"lost here N time(s) already"* — against 187 that got through. A border refused three times on
arithmetic is then off the table for the rest of the game.

The distinction the code makes between `no-force` (never remembered) and `below-floor`
(remembered) is a good one and is documented as such. What was not anticipated is that
`below-floor` would fire on almost every border in the world, because the floors are stated in
the wrong units.

---

## 5. What a 150-turn world actually does

`node tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=CONTINENTAL`:

| turn | countries | top16 | largest | conquests | failed | sieges | continents | nearest | top-8 army |
|---|---|---|---|---|---|---|---|---|---|
| 25 | 143 | 55% | 37 | 3 | 3 | 1 | 0 | 64% | 44,034,355 |
| 50 | 138 | 56% | 41 | 2 | 2 | 1 | 0 | 62% | 54,997,086 |
| 75 | 136 | 57% | 42 | **0** | 0 | 0 | 0 | 55% | 58,785,346 |
| 100 | 130 | 57% | 39 | **0** | 1 | 0 | 0 | 52% | 75,033,226 |
| 125 | 130 | 58% | 40 | **0** | 0 | 1 | 0 | 54% | 87,662,703 |
| 150 | 126 | 59% | **43** | 2 | 1 | 1 | 0 | 58% | **126,185,339** |

Five things in that table.

**Conquest stops around turn 50.** Not slows — stops. Three of the six samples show zero
conquests across the entire world.

**The largest empire does not grow.** 37 at turn 25, 43 at turn 150, out of 359 territories.
That is 12% of the map after a hundred and fifty turns, and between turns 75 and 125 it went
*down*.

**The nearest continent gets further away**, 64% → 58%. Known-issue **BO** asks whether a
Continental game can complete three continents; this run does not complete one, and it is
receding.

**The army triples while the fighting stops.** The top eight countries hold 44 million men at
turn 25 and 126 million at turn 150. India ends the run with **22.5 million men across 14
territories — 1.6 million per territory** — and takes nothing. This is the signature that
matters: the world is not short of force, it is **unable to spend it**. Every country is saving
for an attack whose price is set in a currency that does not exist.

**And this is a regression.** The register's most recent figure for this exact invocation was
102 surviving countries and a largest empire of 65. It is now 126 and 43. Nothing was tuned
between: what landed was the register sweep, whose largest item was the **free-attack fix** — AI
attacks used to cost the attacker nothing, because `doAttack()` debited the store and the goal
loop wrote a pre-attack copy back over it. That fix was correct and must stand. But it removed
the last thing hiding this: while attacks were free, an AI could throw armies at 3%-chance
battles indefinitely and occasionally win one. Now that they cost what they should, **the AI has
correctly worked out that it cannot afford to fight, and stopped.**

---

## 6. Findings

### C — defects (the code does not do what it says)

| Id | Finding | Where |
|---|---|---|
| **C1** | **`winProbability()`'s contract is false.** Its docstring is *"The attacker's chance of taking the territory, as a percentage"*. It is not, and cannot be — it is a strength ratio computed from a defence multiplier the battle does not use, missing every dice rule that decides the outcome. Measured error against the real model: **+95 to −77 points, sign-flipping on fortification** (§4.1). Four consumers read it as a probability: the AI's odds floors, `sizeCommitment()`, the player's attack window, and the siege gate | [probability.js:83](../src/rules/military/probability.js#L83) |
| **C2** | **`defenseMultiplierFor()` returns 0 where its comment promises 1.** `Math.ceil(0 / 15)` is 0, so a territory with no forts, no mountains and no land-locked bonus has its defending strength multiplied by zero and `winProbability()` reports 100% against any garrison. Latent on the shipped map — every territory has `mountainDefenseFactor >= 1` — but reachable from a scenario, a map edit, or any future territory seeded without terrain | [probability.js:65](../src/rules/military/probability.js#L65) |
| **C3** | **The fortification dice bands are documented in forts and applied to mountains.** The comment explains 25 and 100 as *"one fort is a nuisance, two is a die, three is a fortress"*; the bands read `defenseBonus + mountainDefenseBonus`, and mountains alone put **192 of 359 territories (53.5%)** at or past the first band with zero forts built (§3.3). Either the bands or the comment is wrong, and until it is decided which, nobody tuning them knows what they are tuning | [balance.js:757](../src/config/balance.js#L757) |
| **C4** | **A cancelled attack that was never fought is recorded as a defeat.** `decideCommitment()`'s `below-floor` branch calls `recordAttackOutcome(..., false, ...)`, which adds `SETBACK_ODDS_PENALTY` (12 points) to both floors for that target. Because the floors are in the wrong units (C1), this fires on most borders in the world: 168 pairings at turn 25 were already refused for *"lost here N time(s) already"*. The code deliberately distinguishes `no-force` (a fact about this turn, never remembered) from `below-floor` (a fact about the two armies) — the distinction is right; what is wrong is that `below-floor` is currently a fact about a miscalibrated constant | [aiCalculations.js:1081](../aiCalculations.js#L1081) |

**Not a defect, and deliberately not reopened:** `areaBonusFor()`'s `min`/`max` slip is
known-issue **AR**, measured at B.2.6 and closed as a design decision. Its *consequence* — that
there is no defender-side multiplier at all — is design finding **G2** below.

### G — design problems (the code does what it says; what it says does not produce a game)

| Id | Finding |
|---|---|
| **G1** | **A battle is a step function, not a decision.** Against a single median defender the real take probability runs 0.0% at 1.5:1, 7.6% at 1.75:1, 50.7% at 3.0:1 and **94.6% at 3.5:1** (§3.1). There is no band in which committing more force is an interesting trade rather than the difference between certain defeat and certain victory. Five dice bands plus an automatic-hit rule for unmatched dice is too coarse a lattice for a world where borders differ by tens of per cent |
| **G2** | **Two multipliers weaken an attack and none strengthens a defence.** Median combined ×0.63, so the attacker must field **1.58× to draw level**; at the tail (Afghan devIndex 0.326 into Oceania ×0.75) it is ×0.24 and **four to one to reach parity** (§3.2). `areaBonusFor()` is ≤1 everywhere, so the defender's only structural edge in the dice model is winning ties |
| **G3** | **The AI aims at a figure that means four to one, so it almost never attacks.** `commitmentDiscipline.decisiveOdds = 65` is raw 3.91:1 (§4.2). Measured on one turn: 43 of 48 planned attacks cancelled, 17 of them requisitioning instead, one refused at 63% for being two points short of a number that means near-certainty (§4.3) |
| **G4** | **The AI's odds floors are stated in a currency where they mean almost nothing.** `minimumOdds` of 25 / 34 / 45 correspond to real take probabilities of **0.1% / 3.5% / 37.1%**. So the two ends fail in opposite directions: the aim refuses fights it would win, and the floor — reached through `pressOnBelowAim` in a committed theatre — permits fights it cannot win |
| **G5** | **Sieges cannot be laid by the army the AI can move.** 250,000 infantry to escape the arrest band against bare terrain, against 10 naval units for the same score; and `src/ai/muster.js` moves infantry only, because vehicles are gated by the oil capacity of wherever they stand (§3.5). The whole world held 0 or 1 siege at every sample of a 150-turn run. The siege is supposed to be the answer to a target too strong to storm, and it is not available |
| **G6** | **Nothing ever ends.** 150 turns of CONTINENTAL: 126 countries alive, largest empire 43 of 359 (12%), zero continents held, the nearest one receding from 64% to 58%, and no conquest at all across three of six samples (§5). No victory condition is reachable in any plausible number of turns |
| **G7** | **The world accumulates an army it cannot spend.** Top-eight army 44M → 126M across the run while conquests fall to zero; India ends with 1.6 million men per territory. Upkeep and desertion are supposed to make an unaffordable army self-limiting, and the economy is comfortably paying for this one, so there is no counter-pressure at all |

---

## 7. What is right, and must not be broken

Stated because the next section changes combat, and this list is what the change has to survive.
Several of these were expensive to arrive at and are recorded in `CLAUDE.md` as decisions rather
than accidents.

1. **There is ONE combat model, and the player and the AI fight the same battle.** `doAttack()`'s
   separate fight-to-the-death loop is deleted. Never reintroduce a second resolver "for speed" —
   that divergence is what made every previous measurement of this game measure one of two
   systems at a time. **Any fix to §4 must make the AI's ESTIMATE agree with the battle, never
   give the AI a different battle.**
2. **Bands, not a curve.** A player can see a band edge and aim at it. The problem in G1 is that
   there are five of them, not that they exist.
3. **Ties go to the defender**, and that is the defender's structural advantage in place of a
   multiplier. It is worth roughly seventeen points a pairing and it is why
   `DICE_ATTACK_ADVANTAGE` can be 1.0.
4. **Fortification is a dice change and not a face bonus.** A face bonus cannot answer unmatched
   dice, and as one, a 2:1 attacker took a fortress 100% of the time.
5. **Two attack dials, permanently.** `DICE_ATTACK_ADVANTAGE` owns open battle,
   `ATTACK_ADVANTAGE` owns sieges and the pre-battle figure. There may never be a third and
   neither may reach into the other's model.
6. **`areaBonusFor()` stays byte-for-byte as it is** (AR, closed at B.10.4).
7. **The rules run in Node**, take an injected rng, and import nothing from the UI. Whatever
   replaces the AI's odds function must keep that property or the unit suite and both labs stop
   working.
8. **The siege budget subtracts the sieges already running.** That is what ended the
   17-to-67-concurrent-sieges problem, and `doctrine.js` deliberately exposes no siege dial so it
   cannot be undone by a multiplier.
9. **The free-attack fix stands.** An AI attack costs the attacker its army. Everything in §5 is
   downstream of that being true, and it should be true.
10. **The player's grace period stays**, and stays out of the battle model.

---

## 8. The proposal

Five stages. Each ends with the game playable, each ends with a **measurement** rather than a
diff, and the first two are the ones that are not judgement calls.

The acceptance measurement throughout is the one `CLAUDE.md` names for any change to `src/ai/`:
`tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND` over all five goals. **The
control run is §5 above** and it is taken on the current tree before anything is touched.

### Stage 1 — Make the AI decide with the function that fights (C1, C2, G3, G4)

The single largest item, and the only one that is unambiguously a defect rather than a taste.

Give the AI a `takeProbability()` that is the *dice model's* answer, and put every odds floor,
the commitment aim, the siege gate and the player's attack window on it. `battleForecast()`
already is that answer and is already pure — but at ~6,000 sizing calls a turn it cannot be run
at 500 trials. The proposal is a **precomputed table** over the model's own small state space:
the outcome is decided by (attacker dice, defender dice, attacker modifier, defender modifier),
which is 5 × 4 × 5 × 5 = 500 cells, generated once by `battleForecast()` and validated against it.
The share still comes from `shareFor()`, so nothing about how dice are chosen changes.

The two calibration defects go with it: **C2** (`defenseMultiplierFor()`'s zero) and, once the
AI no longer reads `winProbability()`, the question of whether that function survives at all —
the player's attack window shows a bar from it and a forecast beside it, and `CLAUDE.md` records
that the two are *allowed to differ*. That stays true; what changes is that the AI stops using
the bar.

**Measured by:** the calibration table in §4.1 re-run — every row's error inside ±10 points —
and then the five-goal 150-turn run.

### Stage 2 — Re-derive the floors and the aim in the new units (G4)

Once an odds figure means what it says, `minimumOdds` 25 / 34 / 45 and `decisiveOdds` 65 are
finally statements about the world: "an aggressive leader fights at one in four", "an attack
aims at two to one". They are probably close to right *as sentences*; they have never been right
as numbers. Re-state them, and fix **C4** in the same change — a `below-floor` cancellation
should only be remembered as a setback once the floor it failed is a real one.

**Measured by:** the funnel in §4.3 — 1,583 pairings → 187 verdicts → 48 executor decisions → 5
attacks. The number to watch is the last two: how many planned attacks survive commitment.

### Stage 3 — Flatten the cliff (G1, G2) — **DECIDED, see §9**

Stages 1 and 2 make the AI fight the battles it *should* fight. They do not change the fact that
those battles are decided before they are rolled. Leigh has chosen two of the four candidate
levers:

- **More dice bands.** `DICE_SHARE_BANDS` goes from five rows to roughly nine, so crossing an
  edge buys about half a die rather than a whole one. Keeps everything §7 protects, including
  "bands, not a curve".
- **Rebase the attacker's taxes.** `devIndex` × `combatContinentModifier` has a median product of
  0.63; both are rebased together so the median attacker fights at **×1.00**, keeping the spread.
  "A developed country fights better" survives; "everybody attacks at a disadvantage" does not.

Not taken: `DICE_ATTACK_ADVANTAGE` (moves the cliff sideways without changing its shape, so it
addresses G2 and not G1), and making an unmatched die a contested roll (the true cause, and also
the reason a 2:1 attacker does not take a fortress 100% of the time — held in reserve until nine
bands have been measured and found insufficient).

### Stage 4 — Make the siege the answer to a fortress again (G5)

Two halves and they are independent. Either let `muster.js` move vehicles subject to the
receiving territory's oil, or reprice `armyTypeSiegeValues.infantry` so that a large infantry
army is a slow siege rather than no siege. The first is the truer fix and the second is the
cheaper one.

### Stage 5 — Measure a whole game, per goal (G6, G7, BO)

The acceptance run, five goals, 150 turns, plus the two columns §5 shows are the real witnesses
and which `ai-sim.mjs` does not yet print: **conquests cumulative** and **world army**. A run
whose army triples while its conquests fall to zero is a diagnosis, and today it takes reading
the JSON to see it.

---

## 9. The questions, and the answers

All three were put to Leigh with the measurements above in front of them, and all three are
**answered**. They are recorded here rather than in the checklist because they are the reasoning
the stages are built on, and because the first one will otherwise be proposed again.

### Q1 — Should a battle be a near-certainty or a gamble? **MORE DICE BANDS.**

Not "leave the model alone", and not the unmatched-die change. **Roughly nine bands instead of
five**, so that crossing an edge buys about half a die of advantage rather than a whole one and
the 0% → 94% jump spreads over a real span of force.

What that preserves, and it is why this option was chosen over the other three. Bands stay bands,
so a player can still see an edge and aim at it — the thing `balance.js` argues for and the thing
a continuous curve loses. Ties still go to the defender. Fortification is still a dice change
rather than a face bonus, so a fortress can still blunt an overwhelming force. And
`resolvePairings()` — the one file in the model that knows nothing about this game — is not
touched, so the automatic-hit rule that makes scale matter at all survives intact.

**The unmatched-die change is explicitly NOT taken**, and the reason is worth keeping: it is the
actual cause of the cliff, but it is also the reason a 2:1 attacker does not take a fortress
100% of the time, and the overhaul measured that failure once already. It is not off the table
forever; it is off the table until nine bands have been measured and found insufficient.

### Q2 — Should a developed country attack better? **YES, BUT REBASED TO A MEDIAN OF 1.00.**

Keep `devIndex` and `combatContinentModifier`, keep their full spread, and divide through so the
**median attacker fights at ×1.00 instead of ×0.63**. Not "keep them as they are", and not
"devIndex only" — both multipliers are rebased together, because the tax is their product and
rebasing one leaves half of it standing.

The sentence that decides it: *"a developed country attacks better"* is a design intent worth
having; *"everybody in the world attacks at a 1.58× disadvantage"* is not a design intent at all,
it is where the centre happened to land. The spread stays, so Europe still attacks better than
Africa and Oceania is still hard to invade — and the poorest attacker, which pays this tax
hardest (Afghanistan into Oceania is ×0.24 today), stops needing four to one merely to reach
parity.

**This is not a third attack dial.** `DICE_ATTACK_ADVANTAGE` is untouched at 1.0 and remains the
only lever on open battle; what changes is the centre of two existing per-territory multipliers,
which is a different thing from a global dial and does not reach into the siege model.

### Q3 — What should a finished 150-turn AI game look like? **CONSOLIDATING, NOT YET DECIDED.**

Between the two anchors offered. Concretely:

| | today | **target at turn 150** | the archived Goals and Victory control |
|---|---|---|---|
| countries surviving | 126 | **50–80** | 78–114 |
| largest empire | 43 (12%) | **90–120** (25–33%) | 51–97 |
| continents held outright | 0 | **at least one, and more than one under CONTINENTAL** | — |
| a goal completed by 150 | no | **no, and that is deliberate** | — |

So: consolidation plainly happening and continents completing inside a normal game, with the
game itself **decided in the 200–300 turn range** rather than won at 150. That is a stronger
target than the archived table in the largest-empire column and a weaker one than "a winner by
turn 150", and it is chosen for what it does to a player's own game — a world that produces a
winner by turn 150 is a race a player can lose by turn 60 without ever having had a game.

**This target is what stages 3, 4 and 5 are measured against**, and it replaces the archived
Goals and Victory §5 table as the acceptance band *for this phase only*. That table remains the
acceptance criterion for any change to `src/ai/` that is not part of this phase.
