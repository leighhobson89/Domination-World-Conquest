# Economy — Task Checklist

The task breakdown for [05-economy-audit.md](./05-economy-audit.md). Breathing document: ticked
as work lands, and each item records what was *measured* rather than what was intended.

**Stages 0, 1 and 2 are done and measured.** The before/after over five goals and 150 turns
each is at the end of this document, and it is the deliverable — the diff is not. Read that
section before starting Stage 2, because it turned up something the plan did not predict: no
continent is completed in any run any more, so the continent bonus is currently unreachable.

**Stage 2 shipped with Stage 1 as one phase**, which was Leigh's call: the defect work changes
what all 206 AI countries can afford, and the income floor is the direct answer to "no reason to
upgrade", so they belong in front of him together. **Stages 3 and 4 wait until he has played
it** — they are tuning, and tuning over a world that has just moved this far would be measuring
the wrong thing.

House rules that apply to every item here:

- **Stage 1 changes no balance number.** A defect fix and a tuning change must never land in the
  same commit, or the register stops being bisectable.
- **Leigh commits.** Work is left in the tree with the change set described.
- **Work test-first.** The failing unit test goes in before the fix.
- **The full e2e suite is not run without asking**, and no more than three functional areas in
  one decision.

---

## Stage 0 — Baseline, before anything is touched

Nothing in this phase can be judged without a before. Both of these are pure measurement and
change no source file.

- [x] **0.1** `tools/econ-lab.mjs` — the headless harness that produced every number in audit
      §3: `node tools/econ-lab.mjs [income|upgrades|units|consmats]`. It imports
      `initialData.js` and `src/rules/economy/`, reconstructs a territory the way
      `assignArmyAndResourcesToPaths()` does, and prints four tables: income spread and the
      floor, upgrade payback per territory, unit value per gold, and the construction-materials
      bottleneck. It must run in Node with no browser, which is only possible because the
      economy rules import nothing but `config/` — do not add an import that breaks that.
      It carries copies of the three inline continent tables audit §4 E7 names, with a note
      saying to import them instead once §1.13 has moved them into `balance.js`.
- [x] **0.2** Control runs, `--turns=150 --seed=goals --every=25`, one per goal. Deliberately
      the SAME invocation the archived Goals and Victory §5 table used, so the control could be
      checked against a number already in the repository before being trusted: Domination came
      back 96/79/76% against a recorded 96/79/76%, and Conquest 78/78/80% against 78/78/80%.
      Continental and Great Powers have drifted since that table was taken, which is expected —
      the continent-bonus phase landed in between. Written to `test-reports/econ/before-*.json`
- [x] **0.3** Four new columns in `tools/ai-sim.mjs` — `upg` (upgrades standing), `forts`,
      `gold` (held, world-wide) and `foodCap` (world food capacity). The last is the one that
      matters and it replaced the planned "gold earned": capacity is what an upgrade BUYS, so
      upgrades rising while capacity stays flat IS audit E1, stated in a single row. The tool
      also prints that conclusion in words at the end of a run rather than leaving it to be
      spotted in a column. Without these four, Stage 1's effect is invisible — E1 and E2 change
      no count the tool reported before

---

## Stage 1 — Make the economy do what it says

Defect work. No balance number moves. Expect the world to change anyway, because E1 and E2 have
been taxing all 206 AI countries since the AI was written.

### 1a. One definition of an upgrade

- [x] **1.1** New `src/rules/economy/upgrades.js`, pure, importing only `config/balance.js` and
      `capacity.js`. Two functions:
      - `upgradePriceFor(kind, nth, devIndex)` → `{gold, consMats}`. **The `nth` is the number
        that will be STANDING after the purchase**, which is what all five correct copies mean
        and what the sixth got wrong.
      - `applyUpgrade(territory, kind, count)` → a patch of the fields that change
        (`farmsBuilt`/`foodCapacity`, `forestsBuilt`/`consMatsCapacity`,
        `oilWellsBuilt`/`oilCapacity`, `fortsBuilt`/`defenseBonus`). Returns a patch rather than
        mutating, so the caller writes through `state/mutations.js`.
- [x] **1.2** Unit tests first, in `tests/unit/rules-economy-upgrades.spec.js`. The ones that
      matter: the ladder is quadratic and the 5th costs ~26× the 1st; N bought in one
      transaction is +10% of the capacity BEFORE the transaction and not compounded (audit
      5.1 A, already fixed once — pin it); a fort recomputes `defenseBonus` through
      `defenseBonusFor()` and not by a fourth copy of the formula; the price at `nth` matches
      what `incrementDecrementUpgrades()` charges today, byte for byte, so Stage 1 is provably
      not a balance change.

### 1b. Both sides call it — closes E1, E2, E5

- [x] **1.3** `addPlayerUpgrades()` in `resourceCalculations.js` calls `applyUpgrade()` instead
      of its three inline capacity writes. Behaviour identical; this is the reference
      implementation the AI was missing.
- [x] **1.4** **E1** — `analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild()` calls
      `applyUpgrade()`. This is the fix that makes every farm, forest and oil well the AI has
      ever bought actually do something. Measure it on its own before touching E2 or E3: three
      simultaneous fixes to the AI's economy cannot be attributed afterwards.
- [x] **1.5** **E2** — `analyzeAndBuildFortDefenses()` calls `applyUpgrade()`, so an AI fort
      finally moves the die band it exists to move. In the same function, three loop errors:
      the price is not recalculated between forts, `consMatsToSpend` is not decremented, and
      `fortsBuilt` is incremented after the loop so the cap can be exceeded within one turn.
- [x] **1.6** **E5** — delete the four price formulas in `aiCalculations.js` and the one in
      `incrementDecrementUpgrades()`. `upgradePriceFor()` is the only one left.

### 1c. The player is told the right price — closes E4

- [x] **1.7** `calculateAvailableUpgrades()` prices from `upgradePriceFor(kind,
      territory[kind + "sBuilt"] + 1, devIndex)`. Today it uses the n = 1 formula floored by
      `simulatedCostsAll`, a module-level array left over from the *previously rendered*
      territory, so the "Can Build" label and the plus button's enabled state are decided from
      the wrong number.
- [x] **1.8** Delete `simulatedCostsAll` and the eight assignments that fill it. The
      "what does the next one cost" figure the tooltip wants is now a call, not a cache.
- [x] **1.9** An e2e spec in `tests/e2e/resources-economy/` that opens the upgrade window on a
      territory with buildings already standing and asserts the displayed price is the price
      charged. That divergence is invisible in a unit test because both halves are correct in
      isolation — it is a wiring fault, the same shape as the derived battle bar.

### 1d. The AI pays for its infantry — closes E3

- [x] **1.10** **E3** — `bolsterArmy()` debits `finalInfantryQuantity` (a troop COUNT) where it
      means the gold cost, so the AI's largest infantry purchase of the turn costs a tenth of
      its price. Fix the debit, then re-run `ai-sim` — the AI's armies should get *smaller* and
      its gold reserves larger, and that is the correct direction.
- [x] **1.11** Checked against known-issue **BJ**, and it is **not** the cause. Same seed, same
      goal, largest negative army in the top eight after 150 turns: **−107,929,590 (Mexico)
      before the fix and −29,085,461 after.** So paying the correct price for infantry shrinks
      the number about fourfold — consistent with the AI having far less army to lose track of
      — and does not remove it. Whatever subtracts more army than a territory has is still
      there and is not the purchase path. Recorded on BJ itself so the entry is not left
      implicitly attributed here.

### 1e. Say what the numbers are — closes E6, E7

- [x] **1.12** **E6** — correct the comment on `territoryUpgradeBaseCostsGold`: the ladder is
      `N² × 1.05 × devIndex / 4`, not `N ×`. It is the only description of the price law
      anywhere.
- [x] **1.13** **E7** — the three inline continent tables (starting gold in
      `assignArmyAndResourcesToPaths()`, `initialOilCalculation()`, `initialConsMatsCalculation()`)
      move into `balance.js` named for what they seed, alongside the two already there. Five
      tables is defensible; five tables of which three are invisible is not. Same species as
      known-issue **BI**.

### Stage 1 gate — measured before Stage 2 starts, not handed back yet

Stages 1 and 2 ship together, but Stage 1 has to be measured **on its own** first. Four
simultaneous changes to what 206 AI countries can afford cannot be attributed afterwards, and
Stage 2 moves the same numbers.

- [x] `npm run test:unit` green — **951 passing**, up from 931 (twenty new in
      `tests/unit/rules-economy-upgrades.spec.js`).
- [x] Three e2e areas green: `resources-economy` **27/27** (seven new specs), `ai-turn` and
      `turn-loop` **32/32** between them.
- [x] Lint went DOWN on the two files touched, 218 problems to 206 and 42 errors to 37. The
      consolidation deleted more than it added; no new warning was introduced.
- [x] `tools/ai-sim.mjs` 150 turns per goal against the §0.2 control — the table is at the
      end of this document. **The prediction was half right**: capacities and the world's food
      ceiling rose in every run, and the world consolidates slightly more on average; but the
      largest empire SHRANK in four goals of five, and no continent is completed any more.
      **The measurement is the deliverable, not the diff.** The specific prediction to check:
      AI countries hold more capacity and more forts, spend more gold on units and less on
      nothing, and the world consolidates *further* than the control — which would make E1/E2 a
      partial answer to the register's oldest open item, and from a direction nobody has looked
      in (softer AI defenders and poorer AI economies, rather than the attack dials).
- [x] Keep the change set separable for Leigh: the price-formula consolidation is a MOVE, the
      four AI fixes are behaviour, and Stage 2 is balance. Three groups, so a regression stays
      bisectable.

---

## Stage 2 — Make income respond to what a player does

**Decided (audit Q1): split the floor out as a named constant.** It is 44.44 gold a turn, 65% of
the median territory's income, and it is why upgrading a small territory changes nothing.

- [x] **2.1** `TERRITORY_BASE_INCOME = 44.44` in `balance.js`, added in `goldChangeFor()` as a
      TERM: income is now `TERRITORY_BASE_INCOME + scaled / earnedDivisor`, where the divisor of
      18 is what the old window's span of 1800 followed by `× 100` always was. **The window
      never clamped anything** — China's scaled figure is about 61,400 against a `normaliseMax`
      of 1000 — so `normaliseMin` / `normaliseMax` are gone rather than re-cut, and calling the
      operation a "normalisation" was itself part of why nobody noticed the −800 was a subsidy
      paid to every territory on the map.
- [x] **2.2** Income-neutral, verified two ways. `econ-lab income` reports the identical spread
      to the control — min 44.5, p25 50.5, median 68.5, p75 131.2, max 3500.8 — and a unit test
      writes out the old arithmetic and asserts the new function agrees with it to within a
      hundredth of a gold piece across five sample territories. The hundredth is real and is
      stated on the constant: 44.44 against the window's 44.444…, which is 0.0044 gold per
      territory per turn, or about 1.6 gold a turn across the whole world.
- [x] **2.3** Target STATED rather than met, which is the honest position: an upgrade wants to
      pay back inside roughly 10–25 turns for a mid-sized territory, and "hard but not
      pointless" at the very bottom of the map. Stage 2 deliberately moves no money, so the
      payback table is unchanged — `econ-lab upgrades` still spans one turn to 13,202. **Closing
      that spread is Stage 3**, and by Leigh's decision it is done by moving the BENEFIT, not
      the price.
- [x] **2.4** **Decided: the continent bonus multiplies the WHOLE income, base included** — the
      status quo, but now a decision with a measurement behind it rather than an accident of
      where the line happened to sit. `node tools/econ-lab.mjs bonus` reports what the 1.5×
      adds per territory per turn under each rule:

      | Continent | whole-income | earned-only |
      |---|---|---|
      | Africa | 37.8 | **15.6** |
      | South America | 38.6 | **16.4** |
      | Oceania | 72.6 | 50.4 |
      | Europe | 99.4 | 77.2 |
      | Asia | 157.0 | 134.8 |
      | North America | 319.2 | 297.0 |

      An earned-only rule roughly HALVES the bonus on Africa and South America — the two poorest
      continents, and the two most likely to actually be finished — while barely touching North
      America. It would pay least for the hardest objectives. Known-issue **BO** settles it:
      no continent is completed in a 150-turn game at all right now, so weakening this dial is
      the wrong direction whatever the argument from tidiness.
- [x] **2.5** `tests/e2e/resources-economy/continent-bonus.spec.js` green, 27/27 in the area.
- [x] **2.6** Dominapedia "Income and Upkeep" rewritten. It described the normalisation in prose
      and would have been wrong the moment 2.1 landed. It now says plainly that income has two
      halves, that the base is about 65% of what a middling territory earns, and what follows
      from that for the player: *"fifty scattered islands are a real income; they are just not
      an income you can grow."*
- [x] **2.7** **Known-issue BP fixed** — a siege erased any upgrade bought while it was in
      progress. The siege accumulates what it actually destroyed and the income pass adds that
      back when the siege lifts, instead of assigning `startingFoodCapacity` over whatever the
      ceiling has since become. Same number as before whenever nothing was built, so it is a
      defect fix and not a balance change; an older save's war has no accumulator and falls back
      to the old assignment.
- [x] **2.8** **Known-issue BQ opened, not fixed**: a besieged territory can still BUILD, and a
      farm outruns the siege grinding it down. It cannot earn gold, oil or materials, but it can
      spend them. Only visible once BK was fixed. It is a design decision and belongs with the
      besieged-income item, not here.

### Stages 1 + 2 exit — hand back to Leigh here

- [ ] `npm run test:unit` green, three e2e areas green.
- [ ] `ai-sim` 150 turns per goal against the §0.2 control, tabled in this document.
- [ ] `econ-lab income` before/after showing the floor is now a named term and the totals did
      not move.
- [ ] Change set described for Leigh to commit, in the three groups named at the Stage 1 gate.
- [ ] **Leigh plays it.** Stages 3 and 4 are tuning and are not started until he has — that is
      the whole reason the phase splits here.

---

## Stage 3 — Nudge the small without taxing the large

**Decided (audit Q2), and NOT what this checklist first said.** The obvious fix — price every
upgrade against the territory's own income so payback is uniform — was turned down. The
principle that replaced it, in Leigh's words:

> *"Larger territories should not be penalised for their size as it is a good thing to be
> larger and players will try to conquer bigger territories to win their resources, but smaller
> countries get a little nudge so that they are not just a total waste of time."*

**So the lever is the BENEFIT, not the PRICE.** The target is not a uniform payback curve; it is
that a small territory's upgrade stops being a rounding error while a large territory's stays
worth having. Do not re-propose income-scaled pricing without reading audit §6 Stage 3 first.

- [ ] **3.1** An upgrade grants a FLAT component alongside its 10%. On the smallest territories
      the flat part is the whole of it; on China the percentage swamps it; neither is penalised.
      One term, in `applyUpgrade()`, doing the whole job — and it is the same term as Stage 2's
      `TERRITORY_BASE_INCOME` rather than a second one beside it.
- [ ] **3.1a** The price ladder KEEPS its shape: quadratic in `n`, scaled by `devIndex`. Audit
      D3 (developed territories pay more) stands as an observation and is deliberately not
      acted on — it is small, and it is not what makes the payback spread four orders of
      magnitude.
- [ ] **3.2** **D7** — re-base `consMatsCapacity`. It is `f(area)` almost entirely, so Germany
      needs 80 turns of regeneration to fill one territory's upgrade slots and China needs one.
      Either it scales with something other than area, or the price does. Doing neither leaves
      the Stage 3 price change academic for exactly the countries it is meant to help.
- [ ] **3.3** Delete `forestWorkAround` in `aiCalculations.js`. It exists solely to paper over
      D7 and should not survive the fix — if it still has to, D7 is not fixed.
- [ ] **3.4** `econ-lab upgrades` across the whole map. The spread should collapse from four
      orders of magnitude to roughly one — **not to zero.** A flat curve would mean size had
      stopped paying, which is the thing this stage exists to avoid.
- [ ] **3.5** `ai-sim` 150 turns per goal again. A price change that makes upgrades affordable
      everywhere is a change to what every AI country can do with its turn.

---

## Stage 4 — Unit choice

**Decided (audit Q3–Q6).** Only one item survives; the other three closed as design decisions
and are recorded at the end of this section so they are not re-opened by accident.

- [ ] **4.1** **D4** — differentiate the unit types economically. Prod-pop per force and upkeep
      per force are both exactly constant across all four types today, so nothing but the die
      modifiers distinguishes them and infantry strictly dominates naval in open battle.
      **Whatever is changed must preserve the siege-versus-battle tension** — vehicles 5–6×
      better per gold in a siege, worse in open battle — which is the one genuine economic
      decision the military layer currently offers.
- [ ] **4.2** **D5 follow-up, the only work left from a closed decision.** The pooled treasury
      STAYS — it is deliberate, so that conquering a rich country funds a war on the other side
      of the map. What is left is that the panels imply per-territory treasuries and should stop
      implying it. UI only; no rule changes.

### Closed as design decisions — do not re-open

- **D6, `devIndex` stays and the player may never buy it.** It exists so that small developed
  countries are not ranked as weakly as their land area: *"so that countries like United States
  can't end up as weak as African countries, and same for Europe."* A fifth upgrade that raises
  development is explicitly not the direction. Anything that changes it would have to come from
  conquest, decay or an event, and would be its own phase.
- **D5, the pooled treasury stays.** See 4.2 for the only work it leaves.
- **D8, the over-extension counterweight is not in this phase.** Deferred again. Possibly later.

---

## What this phase must not break

Carried from audit §5, listed here because a checklist is what gets read while working.

- The economy rules stay pure and stay runnable in Node. Every number in the audit was measured
  without a browser and that has to remain true.
- The oil gate stays. Buying a fleet and being able to sail it are different things.
- Vehicles stay better in a siege and worse in open battle.
- The continent bonus keeps two dials and stays derived. Never written onto a territory.
- Upgrades raise the CEILING, never the regeneration delta.
- No `console.error` in an e2e run. A spec failing on one is the harness doing its job.

And the principle that governs every tuning decision in Stages 2–4, because it is the one that
turned down the obvious fix:

- **Being large must stay good.** Conquering a big rich territory is supposed to be visibly
  better than conquering a small one — that is what makes a target worth a war. Small
  territories get a NUDGE so that developing them is a real but hard decision; they do not get
  parity, and the large are not taxed to pay for it. Move the benefit, not the price.

---

## What Stage 1 measured

`tools/ai-sim.mjs --turns=150 --seed=goals --every=25`, one run per goal, before and after.
Every run played all 150 turns with zero page errors, both times.

### The defect closes, and it is visible in one column

| Goal | Upgrades bought | World food capacity BEFORE | World food capacity AFTER |
|---|---|---|---|
| Continental | 351 → 431 | 8017M → **8012M** | 11331M → **11506M** |
| Domination | 259 → 354 | 8010M → 8015M | 11004M → 11216M |
| Great Powers | 319 → 379 | 8018M → **8018M** | 10899M → 11324M |
| Conquest | 209 → 276 | 8017M → 8001M | 11152M → 11397M |
| Timed | 349 → 442 | 8018M → 8017M | 11409M → 11572M |

Before, **1,487 upgrades were bought across the five runs and world food capacity never moved
once** — Great Powers is the cleanest, dead flat at 8018M for 150 turns. After, it rises in
every run. The world's food ceiling at turn 25 is also 3,000M higher than it was, because the
AI's upgrades now compound from turn one instead of evaporating.

### And the world got HARDER to conquer, which was not the intention

| Goal | Countries left (before → after) | Largest empire (before → after) | Top-16 share |
|---|---|---|---|
| Continental | 77 → 93 | **104 → 35** | 83% → 74% |
| Domination | 96 → 88 | 79 → 58 | 76% → 77% |
| Great Powers | 107 → 99 | 52 → 47 | 67% → 74% |
| Conquest | 78 → 71 | 78 → 59 | 80% → 82% |
| Timed | 114 → 82 | 51 → 61 | 65% → 78% |

Read it in two halves, because they say different things.

**The world consolidates slightly MORE on average** — 94 countries surviving before, 87 after,
and the top-sixteen share is up in four goals of five. That is the intended direction.

**But no country runs away with it any more.** The largest empire falls in four goals of five,
and Continental's collapses from 104 territories to 35. That is not noise and it is not a
regression in the ordinary sense — it is two of the four defects being removed:

- **E3 was subsidising the AI's biggest armies.** The AI was buying its main infantry tranche at
  a tenth of its price, so a country with a large income could field an army out of all
  proportion to it. Correcting the debit takes that away from everyone, and it takes the most
  away from whoever had the most gold — which is the empire that would otherwise have snowballed.
- **E2 was disarming every AI defender.** An AI fort raised no `defenseBonus`, so it never
  reached the band where `DIE_MODIFIERS.fortification` takes a die off the attacker. There are
  about six hundred forts standing on the map at any time and until now not one of them defended
  anything. They all do now.

So the honest summary is that **the defects were flattering the world**: attacking was easier
than the rules said, and the runaway empires were partly bought with money the AI never paid.

### The finding that matters most, and it is not good news

**No continent is completed in any of the five runs any more.** Before, Continental finished
North America (United States) and Conquest finished South America (Mexico). After, `cont` is 0
for all 150 turns of all five goals, and Continental's nearest continent freezes at 66% from
turn 25 onward and never moves again.

That bears directly on the phase that has just shipped: **the continent bonus is now unreachable
in a 150-turn game**, so the mechanic the previous phase built, measured and documented does not
arrive. It is the register's oldest open item — attacking is too hard for the world to
consolidate — arriving in a new place, and Stage 1 has made it worse rather than better, because
the forts that were inert are now real and the last five territories of a continent are the
hardest five on the map to take.

This is not an argument for reverting any of it. Every one of the four fixes makes the game do
what its own rules say. It is an argument that **the attack side now has to be looked at with
the economy**, and it should be weighed before Stages 3 and 4 spend any effort on prices.
