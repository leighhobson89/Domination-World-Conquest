# Economy — Task Checklist

The task breakdown for [05-economy-audit.md](./05-economy-audit.md). Breathing document: ticked
as work lands, and each item records what was *measured* rather than what was intended.

**Only §0.1 is done** — the measurement harness, built first so that every claim in the audit
is reproducible rather than remembered.

**Stages 1 and 2 are one phase**, and that is Leigh's call: the defect work changes what all 206
AI countries can afford, and the income floor is the direct answer to "no reason to upgrade", so
they are worth having in front of him together. **Stages 3 and 4 wait until he has played it.**
Every §7 question in the audit is now answered and nothing below is gated on a decision.

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
- [ ] **0.2** `--goal` control runs of `tools/ai-sim.mjs`, 150 turns, recorded in this file
      before Stage 1 lands. Same five goals as the archived Goals and Victory §5 table, so the
      two are directly comparable.
- [ ] **0.3** Three new columns in `tools/ai-sim.mjs`: mean upgrades standing per country, mean
      forts standing per country, and gold held against gold earned. Without them Stage 1's
      effect is invisible — E1 and E2 are precisely failures that change no count anything
      currently reports.

---

## Stage 1 — Make the economy do what it says

Defect work. No balance number moves. Expect the world to change anyway, because E1 and E2 have
been taxing all 206 AI countries since the AI was written.

### 1a. One definition of an upgrade

- [ ] **1.1** New `src/rules/economy/upgrades.js`, pure, importing only `config/balance.js` and
      `capacity.js`. Two functions:
      - `upgradePriceFor(kind, nth, devIndex)` → `{gold, consMats}`. **The `nth` is the number
        that will be STANDING after the purchase**, which is what all five correct copies mean
        and what the sixth got wrong.
      - `applyUpgrade(territory, kind, count)` → a patch of the fields that change
        (`farmsBuilt`/`foodCapacity`, `forestsBuilt`/`consMatsCapacity`,
        `oilWellsBuilt`/`oilCapacity`, `fortsBuilt`/`defenseBonus`). Returns a patch rather than
        mutating, so the caller writes through `state/mutations.js`.
- [ ] **1.2** Unit tests first, in `tests/unit/rules-economy-upgrades.spec.js`. The ones that
      matter: the ladder is quadratic and the 5th costs ~26× the 1st; N bought in one
      transaction is +10% of the capacity BEFORE the transaction and not compounded (audit
      5.1 A, already fixed once — pin it); a fort recomputes `defenseBonus` through
      `defenseBonusFor()` and not by a fourth copy of the formula; the price at `nth` matches
      what `incrementDecrementUpgrades()` charges today, byte for byte, so Stage 1 is provably
      not a balance change.

### 1b. Both sides call it — closes E1, E2, E5

- [ ] **1.3** `addPlayerUpgrades()` in `resourceCalculations.js` calls `applyUpgrade()` instead
      of its three inline capacity writes. Behaviour identical; this is the reference
      implementation the AI was missing.
- [ ] **1.4** **E1** — `analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild()` calls
      `applyUpgrade()`. This is the fix that makes every farm, forest and oil well the AI has
      ever bought actually do something. Measure it on its own before touching E2 or E3: three
      simultaneous fixes to the AI's economy cannot be attributed afterwards.
- [ ] **1.5** **E2** — `analyzeAndBuildFortDefenses()` calls `applyUpgrade()`, so an AI fort
      finally moves the die band it exists to move. In the same function, three loop errors:
      the price is not recalculated between forts, `consMatsToSpend` is not decremented, and
      `fortsBuilt` is incremented after the loop so the cap can be exceeded within one turn.
- [ ] **1.6** **E5** — delete the four price formulas in `aiCalculations.js` and the one in
      `incrementDecrementUpgrades()`. `upgradePriceFor()` is the only one left.

### 1c. The player is told the right price — closes E4

- [ ] **1.7** `calculateAvailableUpgrades()` prices from `upgradePriceFor(kind,
      territory[kind + "sBuilt"] + 1, devIndex)`. Today it uses the n = 1 formula floored by
      `simulatedCostsAll`, a module-level array left over from the *previously rendered*
      territory, so the "Can Build" label and the plus button's enabled state are decided from
      the wrong number.
- [ ] **1.8** Delete `simulatedCostsAll` and the eight assignments that fill it. The
      "what does the next one cost" figure the tooltip wants is now a call, not a cache.
- [ ] **1.9** An e2e spec in `tests/e2e/resources-economy/` that opens the upgrade window on a
      territory with buildings already standing and asserts the displayed price is the price
      charged. That divergence is invisible in a unit test because both halves are correct in
      isolation — it is a wiring fault, the same shape as the derived battle bar.

### 1d. The AI pays for its infantry — closes E3

- [ ] **1.10** **E3** — `bolsterArmy()` debits `finalInfantryQuantity` (a troop COUNT) where it
      means the gold cost, so the AI's largest infantry purchase of the turn costs a tenth of
      its price. Fix the debit, then re-run `ai-sim` — the AI's armies should get *smaller* and
      its gold reserves larger, and that is the correct direction.
- [ ] **1.11** Check whether this is behind known-issue **BJ** (a large empire's
      `armyForCurrentTerritory` going hugely negative, India at −6.5 billion after 150 turns).
      It inflates army counts by 10× on the main purchase path, which is the kind of thing that
      turns a signed-arithmetic slip elsewhere into a visible catastrophe. If it is not the
      cause, say so in the register rather than leaving BJ implicitly attributed here.

### 1e. Say what the numbers are — closes E6, E7

- [ ] **1.12** **E6** — correct the comment on `territoryUpgradeBaseCostsGold`: the ladder is
      `N² × 1.05 × devIndex / 4`, not `N ×`. It is the only description of the price law
      anywhere.
- [ ] **1.13** **E7** — the three inline continent tables (starting gold in
      `assignArmyAndResourcesToPaths()`, `initialOilCalculation()`, `initialConsMatsCalculation()`)
      move into `balance.js` named for what they seed, alongside the two already there. Five
      tables is defensible; five tables of which three are invisible is not. Same species as
      known-issue **BI**.

### Stage 1 gate — measured before Stage 2 starts, not handed back yet

Stages 1 and 2 ship together, but Stage 1 has to be measured **on its own** first. Four
simultaneous changes to what 206 AI countries can afford cannot be attributed afterwards, and
Stage 2 moves the same numbers.

- [ ] `npm run test:unit` green.
- [ ] Three e2e areas: `resources-economy`, `ai-turn`, `turn-loop`.
- [ ] `tools/ai-sim.mjs` 150 turns per goal against the §0.2 control, recorded here as a table.
      **The measurement is the deliverable, not the diff.** The specific prediction to check:
      AI countries hold more capacity and more forts, spend more gold on units and less on
      nothing, and the world consolidates *further* than the control — which would make E1/E2 a
      partial answer to the register's oldest open item, and from a direction nobody has looked
      in (softer AI defenders and poorer AI economies, rather than the attack dials).
- [ ] Keep the change set separable for Leigh: the price-formula consolidation is a MOVE, the
      four AI fixes are behaviour, and Stage 2 is balance. Three groups, so a regression stays
      bisectable.

---

## Stage 2 — Make income respond to what a player does

**Decided (audit Q1): split the floor out as a named constant.** It is 44.44 gold a turn, 65% of
the median territory's income, and it is why upgrading a small territory changes nothing.

- [ ] **2.1** `TERRITORY_BASE_INCOME` in `balance.js`, added in `goldChangeFor()` **after** the
      normalisation, with `normaliseMin` / `normaliseMax` re-cut around zero. Written as a TERM
      and not as a re-tuned window — the whole point is that it becomes a dial that can be read,
      moved and reasoned about, where today it is an emergent consequence of a window nobody
      would guess was a subsidy.
- [ ] **2.2** Assert it is income-neutral on the turn it lands: `econ-lab income` before and
      after must produce the same spread. This is a REFACTOR of the floor, not a nerf; anything
      that changes a total here is a mistake, and the tuning happens in Stage 3 once Leigh has
      played it.
- [ ] **2.3** `econ-lab upgrades` re-run: the marginal gold per farm on a *small* territory has
      to be a number a player can see move. State the target before tuning rather than after —
      an upgrade wants to pay back inside roughly 10–25 turns for a mid-sized territory, and
      "hard but not pointless" rather than "pays back" at the very bottom of the map.
- [ ] **2.4** Decide whether `CONTINENT_BONUS_GOLD` multiplies the base income or only the
      earned part. **This is a real design question, not a wiring detail**: 1.5× applied to a
      number that is 97% participation fee is mostly a bonus for owning territories rather than
      for holding a continent, which is not what the archived phase measured or intended. The
      case for multiplying only the earned part is that it makes the bonus mean what its own
      documentation says it means; the case against is that it silently weakens a dial that was
      measured over 150 turns per goal. Measure both before choosing.
- [ ] **2.5** `tests/e2e/resources-economy/continent-bonus.spec.js` still green — it asserts the
      bonus lands exactly on the turn a continent completes, and that has to survive an income
      change whichever way 2.4 goes.
- [ ] **2.6** Dominapedia "Income and Upkeep" rewritten in the same change. It describes the
      normalisation in prose and will be wrong the moment 2.1 lands. A manual that is
      confidently wrong is worse than no manual.

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
