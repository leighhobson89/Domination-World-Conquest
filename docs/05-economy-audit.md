# The Economy — Audit, and a Plan

**Current work.** What the economy is today, what of it reaches the military and the dice,
which parts of it are broken, which parts are working-as-written but make no decision for the
player, and what to do about each. The task breakdown is
[06-economy-checklist.md](./06-economy-checklist.md).

Everything numeric below was **measured**, not read off the source — a headless harness over
`src/rules/economy/` and `initialData.js`, reproduced by `node tools/econ-lab.mjs`.
Where a number appears in this document it is a number the game actually
produces on turn one of a real world.

---

## 1. What the economy is

Four resources, all held **per territory**. Three are stocks with a ceiling; one is a flow.

| Resource | Kind | Where it comes from | What it is spent on |
|---|---|---|---|
| **Gold** | flow, earned each turn | `goldChangeFor()` — productive population, development index, area, continent | units, upgrades, army upkeep |
| **Food** | stock → `foodCapacity` | regenerates 20% of the shortfall per turn | feeds civilians **and** the army; a shortfall is a famine |
| **Oil** | stock → `oilCapacity` | regenerates 30% of the shortfall per turn | fuels vehicles; a shortfall grounds them |
| **Cons. mats.** | stock → `consMatsCapacity` | regenerates 25% of the shortfall per turn | **upgrades, and nothing else** |

Four upgrades, capped at five each per territory. Three of them raise a ceiling by 10% of what
it was before the transaction; the fourth is military.

| Upgrade | Base gold | Base mats | Effect |
|---|---|---|---|
| Farm | 200 | 500 | `foodCapacity` × 1.1 |
| Forest | 200 | 500 | `consMatsCapacity` × 1.1 |
| Oil well | 1100 | 200 | `oilCapacity` × 1.1 |
| Fort | 1000 | 600 | `defenseBonus` = `ceil(f(f+1)·10·devIndex) + landlocked` |

The **price ladder is quadratic**, not linear:
`ceil(base · n · (n · 1.05) · devIndex / 4)`, where `n` is the number that will be standing
after the purchase. The fifth of a kind costs about 26 times the first.

Four unit types, bought with gold **and** productive population, gated at use-time by oil.

The rules themselves live in `src/rules/economy/` — `income.js`, `capacity.js`,
`population.js`, `maintenance.js` — and are pure, `(territory, context) → number`, running in
Node. That much is in good order and none of what follows is a complaint about it. The problems
are in the **numbers**, in the **prices**, and in `resourceCalculations.js` and
`aiCalculations.js`, which are where the rules are called from and where the parallel copies
live.

---

## 2. How the economy reaches the military and the dice

It reaches them in five places, and it is worth being precise, because three of the five are
weaker than they look.

1. **Gold and productive population buy units.** Force is personnel-weighted
   (`vehicleArmyPersonnelWorth`), and personnel-weighted force is exactly what `shareFor()`
   weighs a battle by. This is the main channel and it works.
2. **Oil gates which vehicles can fight.** `useableUnitsFor()` grounds vehicles in rotation
   when demand exceeds the stock, and a grounded vehicle is absent from
   `armyForCurrentTerritory` and therefore from the battle. This is the game's most distinctive
   economic idea and it also works.
3. **Food gates population, and population gates gold.** A farm raises `foodCapacity`;
   population grows to the ceiling; productive population is the input to `goldChangeFor()`.
   This is the compounding loop the continent-bonus phase relied on, and it is real — but §4 D1
   shows it is almost completely damped for most of the map.
4. **Forts take dice off the attacker.** `DIE_MODIFIERS.fortification` bands the raw
   `defenseBonus + mountainDefenseBonus`: 25+ costs the attacker one die, 100+ costs two. This
   is the only upgrade with a direct combat effect, and it is the strongest single purchase in
   the game — an unmatched die is an automatic hit every round.
5. **`devIndex` multiplies attacking strength.** `shareFor()` takes
   `context.attackingDevelopmentIndex`. It is also in gold income, fort defence, productive
   population, population growth, the famine death rate, and the territory strength score.

The three weak ones: **army upkeep does not discriminate** (§4 D4), **oil is only worth
spending on in a siege** (§4 D4), and **`devIndex` is frozen for the whole game** (§4 D6) — so
the single most influential number in the model is one the player can only acquire by conquest,
never by investment.

---

## 3. What the numbers actually are

### 3.1 Gold income, whole-country territories, turn one

| | gold/turn |
|---|---|
| minimum (Falkland Islands) | 44.5 |
| 25th percentile | 50.5 |
| **median** | **68.5** |
| 75th percentile | 131.2 |
| maximum (China) | 3,500.8 |

Ratio of largest to median: **51×**. Largest to smallest: **79×**.

By continent, mean gold per turn: North America 638, Asia 314, Europe 199, Oceania 145,
South America 77, Africa 76.

### 3.2 The floor

A territory with **zero population, zero area and the worst continent multiplier on the map**
earns **44.44 gold a turn**. That is not a coincidence, it is arithmetic:

```
normalised = (scaled - normaliseMin) / (normaliseMax - normaliseMin) × 100
           = (0 - (-800)) / (1000 - (-800)) × 100 = 44.44
```

The `normaliseMin: -800` in `goldIncome` is a **guaranteed participation fee** paid to every
territory on the map every turn, whatever it is and whatever has been done to it. Against a
median income of 68.5, the floor is **65% of what a median territory earns**.

How much population it takes to climb off it, for a mid-sized African territory at dev 0.5:

| productive population | gold/turn | above the floor |
|---|---|---|
| 10,000 | 44.52 | +0.08 |
| 100,000 | 45.03 | +0.59 |
| 1,000,000 | 49.32 | +4.88 |
| 10,000,000 | 86.23 | +41.79 |
| 100,000,000 | 410.01 | +365.57 |

### 3.3 What an upgrade pays back

Five farms, bought in order, against the gold they then earn (population equilibrates to the
food ceiling, so N farms is 1.1^N population):

| Territory | 1st farm | 3rd farm | 5th farm (cumulative) |
|---|---|---|---|
| China | +333 g/t, payback **<1 turn** | +1,097 g/t, payback 1 turn | +2,013 g/t, payback 1 turn |
| Brazil | +42 g/t, payback 1 turn | +139 g/t, payback 4 turns | +255 g/t, payback 9 turns |
| Germany | +84 g/t, payback 1 turn | +275 g/t, payback 3 turns | +504 g/t, payback 5 turns |
| Nigeria | +19 g/t, payback 2 turns | +62 g/t, payback 6 turns | +114 g/t, payback 14 turns |
| Chad | +0.9 g/t, payback 23 turns | +3.1 g/t, payback 94 turns | +5.7 g/t, payback **201 turns** |
| Fiji | +0.8 g/t, payback 52 turns | +2.5 g/t, payback 215 turns | +4.6 g/t, payback **462 turns** |
| Vatican City | +0.04 g/t, payback 1,290 turns | +0.1 g/t, payback 5,980 turns | +0.2 g/t, payback **13,202 turns** |

**The payback on the same upgrade spans four orders of magnitude, and the price barely moves.**
A farm in Vatican City costs 43 gold and a farm in China costs 41.

### 3.4 What a gold buys, in combat

| purchase | gold | prodPop | force | oil/turn | upkeep/turn | force/gold | force/prodPop | upkeep per 1,000 force | siege value/gold |
|---|---|---|---|---|---|---|---|---|---|
| Infantry (×1000) | 10 | 1,000 | 1,000 | 0 | 0.050 | **100** | 1.00 | 0.050 | 0.010 |
| Assault | 50 | 1,000 | 1,000 | 100 | 0.050 | 20 | 1.00 | 0.050 | **0.060** |
| Air | 100 | 5,000 | 5,000 | 300 | 0.250 | 50 | 1.00 | 0.050 | 0.050 |
| Naval | 200 | 20,000 | 20,000 | 1,000 | 1.000 | **100** | 1.00 | 0.050 | 0.050 |

Three things fall out of that table and all three matter:

- **Productive population costs exactly 1 per unit of force for every unit type.** Prod-pop is
  therefore a pure army-size cap and plays no part in *which* unit you buy.
- **Upkeep per 1,000 force is 0.050 gold for every unit type.** Upkeep does not discriminate
  either.
- **Infantry and naval are identical on gold, prod-pop and upkeep per unit of force — and naval
  additionally burns 1,000 oil a turn.** In open battle, infantry *strictly dominates* naval.
  The only reasons to own a vehicle are the die modifiers (air superiority +1, armour parity
  avoids −1, a naval landing on a coast +1) and the siege score, where vehicles are 5–6× better
  per gold. That siege-versus-battle split is a genuinely good tension and §5 says so.

### 3.5 Construction materials, the real bottleneck

Filling every upgrade slot on one territory (5 farms, 5 forests, 5 wells, 5 forts) costs, in
construction materials and in turns of that territory's own regeneration:

| Territory | consMats capacity | regen/turn | full ladder | turns of regen |
|---|---|---|---|---|
| China | 64,316 | 16,079 | 20,230 | **1** |
| Brazil | 52,542 | 13,136 | 19,863 | **2** |
| Chad | 1,716 | 429 | 10,384 | 24 |
| Nigeria | 1,659 | 415 | 14,099 | 34 |
| Germany | 1,244 | 311 | 24,815 | **80** |
| Fiji | 500 | 125 | 19,231 | **154** |
| Vatican City | 500 | 125 | 21,392 | **171** |

Note Germany: a rich, high-development, high-income country whose construction-materials
capacity is 1,244 because the initial figure is driven almost entirely by **area**. Germany
needs eighty turns of saving to develop one territory. China needs one.

---

## 4. Findings

Two kinds, kept apart deliberately. **E** items are defects — the economy does not do what the
code says it does. **D** items are design — the economy does exactly what it says, and what it
says does not produce a decision.

### E — defects

**E1. An AI country's economy upgrades raise no capacity at all.** *This is the big one.*
`analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild()` in
[aiCalculations.js:1046](../aiCalculations.js#L1046) debits gold and construction materials and
increments `farmsBuilt` / `forestsBuilt` / `oilWellsBuilt` — and never touches `foodCapacity`,
`consMatsCapacity` or `oilCapacity`. The only three writes to those fields in the whole codebase
that come from an upgrade are in `addPlayerUpgrades()`
([resourceCalculations.js:3585](../resourceCalculations.js#L3585)), which only the player
reaches. **Every farm, forest and oil well the AI has ever built has been a pure cost.** Worse,
the AI's *desire* logic reads the effective capacity to decide what to build next, so the
ceiling it is trying to raise never moves and it keeps buying the next one up a quadratic price
ladder forever.

**E2. An AI country's forts raise no defence bonus, and the fort loop is wrong three ways.**
`analyzeAndBuildFortDefenses()` at [aiCalculations.js:1119](../aiCalculations.js#L1119):
`defenseBonus` is never recomputed, so an AI fort contributes nothing to the die band that forts
exist to move. Additionally, inside the loop the price is never recalculated (so N forts all
cost the price of the first), `consMatsToSpend` is never decremented, and `fortsBuilt` is
incremented **after** the loop, so the `fortsBuilt < maxForts` guard reads a stale value and the
AI can exceed the cap in a single turn. The AI's *starting* forts are fine — those go through
`addRandomFortsToAllNonPlayerTerritories()`, which does recompute.

Taken together E1 and E2 mean **the AI has been paying for an economy it does not receive**,
which is a plausible contributor to the register's oldest open item (attacking is too hard for
the world to consolidate) from the opposite direction to the one that has been investigated:
AI defenders are softer than they should be, AI economies are poorer than they should be, and
the AI is burning its gold on nothing instead of on army.

**E3. The AI buys its main tranche of infantry at a tenth of the price.**
[aiCalculations.js:1238](../aiCalculations.js#L1238):

```js
let finalInfantryQuantity = goldToSpend / armyGoldPrices.infantry   // a COUNT of troops
finalInfantryProdPop = (goldToSpend / armyGoldPrices.infantry) * INFANTRY_IN_A_TROOP;
if (prodPopToSpend >= finalInfantryProdPop) {
    territory.goldForCurrentTerritory -= finalInfantryQuantity;      // debits the COUNT, not the COST
```

The infantry delivered is correct for spending `goldToSpend`; the gold debited is
`goldToSpend / 10`. The AI gets 1,000 infantry per gold on this purchase where the player gets
100. This is the *last* tranche, after vehicles, so on most turns it is the bulk of the budget.
The first tranche a few lines above is charged correctly, which is why it is easy to miss.

**E4. The affordability check and the price charged are computed by different formulas.**
`calculateAvailableUpgrades()` at
[resourceCalculations.js:2215](../resourceCalculations.js#L2215) prices a farm at
`base · 1.05 · devIndex/4` — **the n = 1 price, with no `n²` term** — floored by
`Math.max(simulatedCostsAll[i], …)`, where `simulatedCostsAll` is a module-level array written
by the *previously rendered* upgrade table and never reset. `calculateAvailableUpgrades()` is
called at the top of `populateUpgradeTable()`, *before* the loop that fills that array. So on
the first upgrade window of a session the "Can Build" / "Not enough gold" condition, and the
enabled state of the plus button, are decided from the price of a *first* farm no matter how
many are already standing; afterwards they are decided from the last territory's price.

**E5. There are six copies of the upgrade price formula and one of them disagrees.** One in
`incrementDecrementUpgrades()`, four in `aiCalculations.js` (farm/forest/well, then the same
three again for the re-price, then forts), and the divergent one in
`calculateAvailableUpgrades()`. `balance.js` holds only the base costs. A price is a rule and
belongs in `src/rules/economy/`.

**E6. `balance.js` states the wrong price law.** `territoryUpgradeBaseCostsGold` is documented
as *"The Nth of a kind costs N times this"*. It is `N² × 1.05 × devIndex/4`. The comment is the
only description of the ladder anywhere and it is off by a whole power.

**E7. Five different continent tables.** `continentModifiers` (balance.js, feeds only the
strength score), `goldContinentModifiers` (balance.js, feeds gold income), an inline
15/14/1/1/1.8/2 table in `assignArmyAndResourcesToPaths()` used once for starting gold, and two
more inline tables in `initialOilCalculation()` and `initialConsMatsCalculation()`. Only two of
the five are in `balance.js`, and none of the three inline ones is documented anywhere. This is
the same species as known-issue **BI**.

### D — design

**D1. Most territories earn a participation fee, not an income.** The 44.44 floor of §3.2 is
65% of the median territory's total income. For anything smaller than about a million productive
population — which is most of the 359 territories on the map — **nothing the player does changes
the gold at all**. Farms, population growth, the continent bonus's 1.5× on a number that is
almost entirely floor: all of it moves an income that is 97% constant. This is the direct answer
to *"players have no reason to upgrade"*: on most of the map, they are correct not to.

**D2. The price of an upgrade is unrelated to its benefit.** §3.3: identical price, payback from
under one turn to 13,202 turns. The price is a function of `devIndex` alone; the benefit is a
function of population and area, which vary by six orders of magnitude across the map. For a
large country the whole upgrade ladder is free money and therefore not a decision; for a small
one it is a trap.

**D3. And the price scales the wrong way.** `devIndex / 4` means a *developed* territory pays
more for the same building. Development is already correlated with income, so this is a
progressive tax on the territories that need the least help — but it is also the *only* thing
resembling a scaling term, and it does not scale with the thing that actually determines the
benefit (population, capacity, area).

**D4. Unit choice is almost never an economic decision.** §3.4: prod-pop per force and upkeep
per force are constant across all four types, and infantry ties naval for the best force per
gold while costing no oil. Nothing except the die modifiers and the siege score distinguishes
them. Since one assault unit is enough to avoid the armour penalty, the optimal army in open
battle is: infantry, plus a token vehicle or two. The genuine tension is siege-versus-battle
(§5) and it is currently the only one.

**D5. Per-territory gold is a fiction for the player.**
`checkForMinusAndTransferMoneyFromRichEnoughTerritories()` and its prod-pop twin move resources
from the richest territories to the buying one, instantly, in unlimited quantity, at no cost and
with no adjacency requirement. So the player's economy is one pooled treasury wearing 359 labels
— while the AI's genuinely is per-territory, which is a second player/AI asymmetry alongside E1
and E3. This is not necessarily wrong (it is a real convenience) but it should be a *decision*,
and the UI presents the opposite.

**D6. Nothing raises a development index, ever.** There is no write to `devIndex` anywhere in
the codebase. It is set once from `initialData.js` and read forever, in seven different rules
including attacking strength. The Dominapedia already tells the player this outright
(*"nothing raises a development index and nothing changes a continent"*). It is a defensible
design — development is something you conquer, not something you build — but it means the only
economic verb the game offers is *expand*, which is the same shape as the over-extension problem
named in the Design Notes.

**D7. Construction materials are the real bottleneck and their ceiling is set by area alone.**
§3.5. Germany needs 80 turns of construction-material regeneration to fill one territory's
upgrade slots; China needs one. Because the initial capacity is `f(area, devIndex, continent)`
and the price ladder is `f(devIndex)`, a small developed country is locked out of its own
upgrade tree while a large one is not. The AI's `forestWorkAround` in
[aiCalculations.js:1031](../aiCalculations.js#L1031) — *"sometimes the cost of a forest upgrade
in consMats is too much for the country when it has max consmats, so this helps it out"* — is a
plaster over exactly this.

**D8. There is no economic reason to hold ground you are not fighting from.** The continent
bonus is the one exception and it is all-or-nothing. Between "one territory" and "a whole
continent" there is no shape at all, which is the same gap the archived continent-bonus plan
named and the same one the over-extension counterweight is meant to close from the other side.

---

## 5. What is right, and must not be broken

Listed because an overhaul is exactly when good mechanics get thrown out with bad numbers.

- **The rules are pure and run in Node.** `src/rules/economy/` imports only `config/` and its
  own siblings. Every number in this document was measured without a browser because of that.
- **The oil gate.** Buying a fleet and being able to sail it are different things, the shortfall
  grounds units in rotation so an army keeps its shape, and the gate applies at the point a
  battle is fought. This is the best idea in the economy.
- **Siege economics versus battle economics.** Vehicles are 5–6× better per gold in a siege and
  strictly worse in open battle. That is a real decision and oil is what prices it. Any change
  to unit costs has to preserve it.
- **The continent bonus's two dials, and the fact that it is derived.** Settled and measured in
  the archived phase; a capacity multiplier compounds into gold and a gold multiplier compounds
  into nothing. Do not collapse them and do not store the bonus.
- **Capacity as a ceiling, with regeneration towards it.** Growth faster than decay, disaster
  turns suppressing both so the player gets a turn to react. The shape is right.
- **Upgrades raise the ceiling and not the delta.** Same reasoning; already documented in
  `income.js`.
- **The quadratic price ladder as a shape.** A fifth farm costing 26× a first is a reasonable
  diminishing-returns curve. The problem is the *base* it multiplies, not the curve.

---

## 6. The proposal

Four stages. Each ends with the game playable, and stages 1 and 2 are separable from 3 and 4 so
that a bug fix never lands inside a balance change — the register stays bisectable.

### Stage 1 — Make the economy do what it says (E1–E7)

Pure defect work. **No balance number changes.** The expectation is that this alone moves the
world measurably, because E1 and E2 have been silently taxing all 206 AI countries.

- One `applyUpgrade(territory, kind, count)` in `src/rules/economy/upgrades.js`, pure, that
  returns the capacity and defence patch. Both `addPlayerUpgrades()` and the AI call it. E1 and
  E2 close by construction rather than by two parallel fixes.
- One `upgradePriceFor(kind, nth, devIndex)` in the same module. Six copies become one; E4, E5
  and E6 close with it. `calculateAvailableUpgrades()` takes the real price and
  `simulatedCostsAll` is deleted.
- Fix the fort loop's three errors and E3's debit.
- Move the three inline continent tables into `balance.js` and name them for what they seed.

**Acceptance:** unit tests on the new module; `tools/ai-sim.mjs` over 150 turns, before and
after, reported against the archived Goals and Victory §5 table. Expect the AI's fort counts and
capacities to rise and its gold to fall.

### Stage 2 — Make income respond to what a player does (D1) — **DECIDED**

Leigh's call: **split the floor out as an explicit named constant.** A `TERRITORY_BASE_INCOME`
added after normalisation, with the normalisation window re-cut around zero so today's total
income is unchanged on the turn it lands.

The point is not to make anyone poorer. It is that `normaliseMin: -800` currently *hides* a flat
44.44 gold participation fee inside a formula that looks as though it responds to population and
area, and swamps the marginal return of everything the player can actually do. Once the fee is a
named term, two things become possible that are impossible today: the marginal gold from a farm
is visible on a small territory, and "how poor may a bad start be" is a dial rather than an
emergent consequence of a normalisation window.

Rejected, and recorded because both will be proposed again: **lowering the floor** makes a
one-territory start unplayable, and **replacing it entirely with earned income** takes the nudge
too far — see Stage 3 for the principle that governs both.

### Stage 3 — Nudge the small without taxing the large (D2, D3, D7) — **DECIDED, and not what this section first proposed**

The first draft of this stage proposed pricing every upgrade against the territory's own income,
so that the payback period would be constant across the map. **That was rejected**, and the
reason is the governing principle for the whole phase:

> *"I'd like to find a middle ground, where it is still playable for smaller countries but
> harder. Equally larger territories should not be penalised for their size as it is a good
> thing to be larger and players will try to conquer bigger territories to win their resources,
> but smaller countries get a little nudge so that they are not just a total waste of time."*

**Size is a reward the game must keep paying.** Conquering a large rich territory is supposed to
be visibly better than conquering a small one — that is what makes a target worth a war, and it
is why the five strongest countries are the ones the player is locked out of choosing. A uniform
payback curve achieved by taxing the large is the wrong instrument even though it produces the
tidier graph. The target is not parity; it is *"a small territory's upgrade is a real but hard
decision"* against today's *"a rounding error"*.

So the lever moves from the PRICE to the BENEFIT:

- **An upgrade grants a flat component alongside its percentage.** A farm raises `foodCapacity`
  by 10% *and* by a flat amount. On Vatican City the flat part is the whole of it; on China the
  percentage swamps it. Neither is penalised, and one term does the whole job — which is why
  this is the same change as Stage 2's `TERRITORY_BASE_INCOME` rather than a second one beside
  it.
- **The price ladder keeps its shape.** Quadratic in `n`, scaled by `devIndex`. D3's observation
  that developed territories pay more still stands, but it is small and it is not what makes the
  payback spread four orders of magnitude — the benefit is.
- **D7 is now the larger half of this stage.** `consMatsCapacity` is driven almost entirely by
  area, so Germany needs eighty turns of regeneration to fill one territory's upgrade slots and
  China needs one. That is a small *developed* country locked out of its own upgrade tree, which
  is exactly the case the nudge exists for, and **no change to the benefit reaches it** — the
  player cannot buy the thing at any price. Re-base the capacity against something other than
  area alone.

### Stage 4 — Give unit choice an economic edge (D4) — **DECIDED**

Wanted. Prod-pop per force and upkeep per force are identical across all four unit types today,
so nothing but the die modifiers distinguishes them and infantry strictly dominates naval in
open battle. Two candidates: differ upkeep per unit of force (vehicles expensive to keep,
infantry cheap), or differ prod-pop per force (vehicles cheap in people and expensive in gold,
which is also the more plausible reading), so that a rich small-population country and a poor
populous one field visibly different armies.

**The constraint that decides it:** vehicles must stay 5–6× better per gold in a siege and worse
in open battle. That split is the one genuine economic decision the military layer currently
offers, and it is what makes oil matter at all.

### Not in this phase — three decided and closed

- **D5, the pooled treasury: KEPT, deliberately.** The reason is the shape of the game:
  *"so that they can enjoy the benefits of conquering China, for example, to help them launch an
  attack from Venezuela to Colombia."* A conquest anywhere should fund a war anywhere. It is not
  an oversight and it is not to be turned into a logistics constraint. What is left of D5 is a
  UI question — the panels imply per-territory treasuries and should stop.
- **D6, `devIndex`: STAYS, and the player may never buy it.** It is not an accident that nothing
  writes it. The reason: *"so that countries like United States can't end up as weak as African
  countries, and same for Europe — they are given a boost they wouldn't have otherwise because
  they are very small."* It is a deliberate regional handicap that stops the world being ranked
  by land area alone. It need not be permanent forever, but **a fifth upgrade that raises
  development is explicitly not the direction** — anything that changes it would have to come
  from conquest, decay or an event.
- **D8, the over-extension counterweight: NOT NOW.** Deferred again, and deliberately not folded
  into this phase.

---

## 7. The questions, and the answers

Asked once the audit was taken. The answers are folded into §6 above; they are kept here
because three of them turned a proposal down and the reasons are what stop it coming back.

| | Question | Answer |
|---|---|---|
| **Q1** | The 44.44 gold floor — lower it, name it, or make it earned? | **Name it.** `TERRITORY_BASE_INCOME`, normalisation window re-cut around zero, today's income unchanged on landing |
| **Q2** | Price upgrades against the territory, so payback is uniform? | **No — a middle ground.** Being large must stay good; small territories get a nudge, not parity. The lever moves to the benefit side |
| **Q3** | Is `devIndex` meant to be permanent? | **Yes, and the player may never buy it.** It exists so that small developed countries are not ranked as weakly as their land area. Open to it changing by some other route |
| **Q4** | Should the player's treasury stay pooled? | **Yes, deliberately.** Conquering a rich country should fund a war on the other side of the map |
| **Q5** | How much is one phase? | **Stages 1 and 2 together**, then Leigh plays it before Stages 3 and 4 are tuned |
| **Q6** | Does the over-extension counterweight belong here? | **No.** Deferred again |

The one answer that changes this document structurally is Q2: **§6 Stage 3 no longer proposes
what it originally proposed.** The rejected version is kept inside that section rather than
deleted, because "price the upgrade against the territory's income" is the obvious fix and will
be proposed again by whoever next reads §3.3 without the reason it was turned down.

---

## 8. How this will be measured

The economy has the same property the continent bonus had: **nothing throws, every turn
completes, and the failure is that the map quietly stops being interesting.** So the acceptance
criteria are measurements, not a playthrough.

1. **`tools/econ-lab.mjs`** — a new headless harness (checklist §1.1) producing the tables of
   §3 on demand: income spread and floor, upgrade payback per territory, unit value per gold,
   construction-material bottleneck. Every one of those tables is a regression test for a
   balance change.
2. **`tools/ai-sim.mjs`, 150 turns per goal**, against
   [archived/05-goals-and-victory.md](./archived/05-goals-and-victory.md) §5 — the standing
   acceptance criterion for any change to `src/ai/`, and Stage 1 changes what the AI can afford.
   New columns needed: mean upgrades built per country, mean fort count, and gold held versus
   gold earned.
3. **`tests/e2e/resources-economy/`** — the area that already owns the continent bonus. A
   before/after on an upgrade's effect, and a spec asserting the AI's capacity actually rises,
   which today it does not.
4. **The Dominapedia is part of the deliverable, not documentation of it.** The manual quotes
   real numbers, and the War section had to be rewritten wholesale when the dice model shipped
   because it was confidently describing a deleted model. Any price or income change is a
   `topics.js` change in the same commit.
