// Every tunable number in the game, in one place.
//
// Refactor plan Phase 5.1. Before this file the balance numbers were scattered across
// `resourceCalculations.js`, `battle.js` and `aiCalculations.js` -- some named, most
// written inline at the point of use, and several written inline in more than one place
// (the productive-population formula appeared five times, the defence-bonus formula three).
// Audit section 5.4 called them out as the "magic numbers throughout" item.
//
// Rules for this file:
//
// - It imports NOTHING. It is data, it loads in Node, and every rule module can depend on
//   it without dragging anything else in.
// - A number belongs here if changing it changes how the game PLAYS. Numbers that are
//   structural -- array indexes, the four unit types, the number of resources -- do not.
// - The comments are the reason a number is what it is. If a number was tuned against
//   something measurable, that measurement is recorded next to it.
//
// Grouped by the rule module that consumes it: units, economy, military, siege, ai.

// --- units -----------------------------------------------------------------

/** How many actual soldiers one infantry unit represents. */
export const INFANTRY_IN_A_TROOP = 1000;

/** Gold cost to buy one unit. */
export const armyGoldPrices = {
    infantry: 10,
    assault: 50,
    air: 100,
    naval: 200
};

/**
 * Productive-population cost to buy one unit -- the people who crew it.
 *
 * **Economy stage 4.1, closing audit D4.** These were 1,000 / 1,000 / 5,000 / 20,000, which is
 * exactly `vehicleArmyPersonnelWorth` below -- so productive population cost exactly 1.00 per
 * unit of FORCE for every one of the four types, and prod-pop was therefore a pure army-size cap
 * that never once decided WHICH unit to buy. Combined with an identical upkeep per unit of force
 * (see `armyCostPerTurn`), nothing but the die modifiers and the siege score distinguished an
 * infantryman from a battleship, and infantry strictly DOMINATED naval in open battle: the same
 * force per gold, the same force per person, the same upkeep, and no oil bill.
 *
 * A vehicle is crewed rather than manned, so it now buys its force with far fewer people:
 * 1.00 per unit of force for infantry, 1.67 for assault, 2.00 for air, 2.50 for naval. That is
 * a TRADE and not a ranking -- the vehicle pays for it in gold (unchanged, and still 2-5x
 * infantry per unit of force), in upkeep, and in oil, which infantry does not owe at all.
 *
 * What it buys the game: a populous poor country and a rich thinly-peopled one field visibly
 * different armies, which is the decision D4 said the economy was not offering. `node
 * tools/econ-lab.mjs units` is the table.
 *
 * **Infantry must stay at `INFANTRY_IN_A_TROOP`** and is not a tuning dial: `bolsterArmy()` in
 * `aiCalculations.js` adds `armyProdPopPrices.infantry` SOLDIERS per purchase and debits the
 * same figure in people, so for infantry this constant is the size of a troop and not a price.
 */
export const armyProdPopPrices = {
    infantry: INFANTRY_IN_A_TROOP,
    assault: 600,
    air: 2500,
    naval: 8000
};

/** Oil a unit demands per turn. Infantry demand none, which is why they are not listed. */
export const oilRequirements = {
    naval: 1000,
    air: 300,
    assault: 100
};

// Tuned when maintenance was re-enabled (audit 5.2 R, refactor 3.16). Measured on a fresh
// world: a territory earns roughly 44-100 gold a turn, while Germany starts with 783,052
// infantry and China with 2,472,249. At the original rates Germany owed 396 gold a turn
// against ~50 of income and China owed 1,384 -- every major power bankrupt inside forty
// turns, with no way to respond. At a tenth of that a normal standing army costs about what
// its territory earns, so holding an army is sustainable and GROWING one is what has to be
// paid for.
/**
 * Gold a unit costs to maintain per turn.
 *
 * **Economy stage 4.1, the other half of audit D4.** These were 0.00005 / 0.05 / 0.25 / 1, which
 * is 0.050 gold per thousand units of force for every one of the four types -- upkeep did not
 * discriminate either, so a fleet cost exactly what the infantry it displaced cost to keep.
 *
 * It now rises with the platform: 0.050 gold per thousand force for infantry, 0.080 for assault,
 * 0.100 for air, 0.150 for naval. A standing fleet is a permanent bill in a way a standing army
 * is not, and it is the counterweight to the population discount above -- a rich country can
 * buy force with fewer people, and then has to keep paying for it every turn.
 *
 * The infantry figure is untouched, and the paragraph above the previous version of this table
 * still applies to it: it was cut to a tenth when maintenance was re-enabled, because at the
 * original rates every major power was bankrupt inside forty turns with no way to respond.
 */
export const armyCostPerTurn = {
    infantry: 0.00005,
    assault: 0.08,
    air: 0.5,
    naval: 3
};

/**
 * How much of the army deserts when its upkeep cannot be paid.
 *
 * Upkeep was charged and then clamped -- `goldForCurrentTerritory = Math.max(0, gold + change)`
 * -- so a territory that could not pay simply sat at zero gold and kept its army for nothing.
 * Gold was a drag on income and never a ceiling on army size, which is the whole of what upkeep
 * was supposed to be for (audit 5.2 R re-enabled the charge; nothing ever gave it teeth).
 *
 * The rule is deliberately one-for-one and SELF-LIMITING: the share of the army that deserts is
 * the share of the bill that went unpaid. Miss a tenth of your upkeep and you lose a tenth of
 * your army -- and next turn the bill is a tenth smaller, so a territory converges on the army
 * it can afford instead of collapsing. That property is why the dial sits at 1.0 and why it is
 * a multiplier on the unpaid share rather than a flat rate: at 1.0 the rule needs no separate
 * argument for why it terminates.
 *
 * Desertion walks infantry first and then the vehicles, through `planArmyStarvation()`, which
 * is the same walk a famine uses. Deliberate: a soldier who is not paid goes home, and the
 * crews go last because a vehicle is a smaller number of people.
 */
export const ARMY_DESERTION_RATE = 1.0;

/**
 * How many people a unit is worth when an army is expressed as a single head count.
 *
 * This is the conversion between the four unit counts and `armyForCurrentTerritory`, and
 * it is also what `calculateCombinedForce()` weighs a battle by.
 */
export const vehicleArmyPersonnelWorth = {
    infantry: 1,
    naval: 20000,
    air: 5000,
    assault: 1000
};

/** Gold a unit costs to maintain per turn during the initial army-sizing adjustment. */
export const INITIAL_ARMY_ADJUSTMENT_COST_PER_UNIT = 0.001;

/** Floor, in gold per turn, that a territory must still clear after the initial army trim. */
export const INITIAL_GOLD_MIN_PER_TURN_AFTER_ARMY_ADJ = 10;

// --- territory upgrades ----------------------------------------------------

/**
 * Base gold price of one upgrade.
 *
 * The Nth of a kind costs `ceil(base * N * (N * 1.05) * devIndex / 4)` -- **QUADRATIC in N**,
 * so the fifth is about twenty-six times the first, not five times. This comment said "N times
 * this" until the economy audit measured the ladder; it was the only description of the price
 * law anywhere, and it was wrong by a whole power (docs/archived/05-economy-audit.md section 4 E6).
 *
 * The formula itself is `upgradePriceFor()` in `src/rules/economy/upgrades.js`, which is the
 * only copy -- there were six, and one of them disagreed.
 */
export const territoryUpgradeBaseCostsGold = {
    farm: 200,
    forest: 200,
    oilWell: 1100,
    fort: 1000
};

/**
 * Base construction-materials price of one upgrade.
 *
 * Same quadratic ladder as the gold price, except that a FARM squares at 1.1 where the other
 * three square at 1.05 -- so farms are the construction-materials-expensive upgrade even though
 * their base is the same as a forest's. That difference is in every copy of the formula the
 * codebase ever had, including the AI's, so it is behaviour and not a typo.
 */
export const territoryUpgradeBaseCostsConsMats = {
    farm: 500,
    forest: 500,
    oilWell: 200,
    fort: 600
};

/**
 * What an upgrade adds to its ceiling ON TOP of the ten per cent -- economy stage 3.1.
 *
 * This is the whole of stage 3, and it is one term rather than a curve because of the
 * principle the stage was decided on (docs/archived/05-economy-audit.md section 6, Q2):
 *
 *   *"Larger territories should not be penalised for their size as it is a good thing to be
 *   larger and players will try to conquer bigger territories to win their resources, but
 *   smaller countries get a little nudge so that they are not just a total waste of time."*
 *
 * The obvious fix -- pricing an upgrade against the territory's own income, so that payback is
 * uniform across the map -- was TURNED DOWN, and it will be proposed again by anyone who reads
 * the payback table without the reason. It taxes the large to pay the small, and being large
 * is a reward this game has to keep paying. So the lever is the BENEFIT and never the price.
 *
 * A flat term does the whole job by itself, because it is read entirely differently at the two
 * ends of the map. Vatican City's food ceiling is 801 people, so ten per cent of it is eighty
 * and a farm there paid back in thirteen thousand turns; the flat 100,000 IS the upgrade. China's
 * ceiling is 1.45 billion, so the same 100,000 is a fourteen-thousandth of what its own ten per
 * cent is worth and China notices nothing at all. Measured, `node tools/econ-lab.mjs upgrades`:
 * the first farm's payback across the whole map goes from 0.8 - 3,780 turns to 0.8 - 202, and
 * the 95th percentile from 472 turns to 61. It does not collapse to zero and it must not --
 * a flat payback curve would mean size had stopped paying, which is the thing this stage exists
 * to avoid.
 *
 * One number per CEILING, because the three ceilings are in three different units -- people,
 * tonnes of construction material, barrels of oil -- and a single constant across them would be
 * three unrelated balance decisions wearing one name. The oil figure is the legible one:
 * `oil * maxOilWells` is exactly `oilRequirements.naval`, so five oil wells fuel one warship
 * anywhere on the map, and an island whose oil ceiling is two barrels stops reading "vehicles
 * are not for you".
 */
export const upgradeFlatCapacityGain = {
    food: 100000,
    consMats: 500,
    oil: 200
};

/** How many of each upgrade a single territory may hold. */
export const maxFarms = 5;
export const maxForests = 5;
export const maxOilWells = 5;
export const maxForts = 5;

/**
 * Defence bonus from forts: `ceil(forts * (forts + 1) * FORT_DEFENSE_SCALE * devIndex) +
 * landLockedBonus`. Quadratic, so the fifth fort is worth far more than the first.
 */
export const FORT_DEFENSE_SCALE = 10;

/**
 * The `mountainDefenseFactor` on an SVG path is a small integer; this is what one point of
 * it is worth as a defence bonus. Written out as a bare `* 10` in the initial-data builder
 * until Phase 5.5.
 */
export const MOUNTAIN_DEFENSE_SCALE = 10;

// --- economy ---------------------------------------------------------------

/**
 * Food is stored in units of ten thousand people-fed. Every comparison between food and a
 * head count multiplies the food by this first.
 */
export const FOOD_UNIT_SCALE = 10000;

/** Percentage of the population that is productive, before the development index. */
export const PRODUCTIVE_POP_PERCENT = 45;

/**
 * General continent modifier, applied to a territory once per turn. Also one of the six
 * inputs to a territory's strength score.
 */
export const continentModifiers = {
    "Europe": 1,
    "North America": 1,
    "Asia": 0.7,
    "Oceania": 0.6,
    "South America": 0.6,
    "Africa": 0.5
};

/** Continent modifier applied to gold income specifically. */
export const goldContinentModifiers = {
    "Europe": 1,
    "North America": 1,
    "Asia": 0.5,
    "Oceania": 0.8,
    "South America": 0.4,
    "Africa": 0.3
};

// The three tables below are used ONCE EACH, at world creation, and they were written inline in
// `resourceCalculations.js` until the economy phase moved them here (audit section 4 E7). Five
// continent tables is defensible -- what a continent is worth to LIVE on, what it is worth to
// EARN on, and what it is worth to have STARTED on are three different facts. Five tables of
// which three were invisible is not, and it is the same species as known-issue BI: several
// sources disagreeing about a continent, with nothing anywhere reconciling them.
//
// Note how far apart they are. Europe is 15 for starting gold and 1.4 for starting oil; Africa
// is 2 and 1.8. They are not variations on one idea and must not be merged into one.

/**
 * Multiplies the population term of a territory's STARTING gold, once, at world creation.
 *
 * The largest spread of the five tables by a wide margin -- Europe and North America at 15 and
 * 14 against 1 for Asia and Oceania. It is what gives the small, dense, developed countries an
 * opening treasury at all; their populations are tiny next to China's and the per-turn income
 * formula is dominated by population.
 */
export const startingGoldContinentModifiers = {
    "Europe": 15,
    "North America": 14,
    "Asia": 1,
    "Oceania": 1,
    "South America": 1.8,
    "Africa": 2
};

/** Continent term in a territory's STARTING oil stock and capacity, at world creation. */
export const startingOilContinentModifiers = {
    "Europe": 1.4,
    "North America": 1.5,
    "Asia": 1.5,
    "Oceania": 1.2,
    "South America": 1.6,
    "Africa": 1.8
};

/**
 * Continent term in a territory's STARTING construction materials, at world creation.
 *
 * Worth knowing when reading audit D7: this term is small next to the AREA term beside it, so
 * construction-materials capacity is very nearly a function of land area alone -- which is why
 * Germany needs eighty turns of regeneration to fill one territory's upgrade slots and China
 * needs one.
 */
export const startingConsMatsContinentModifiers = {
    "Europe": 1.2,
    "North America": 1.6,
    "Asia": 1.8,
    "Oceania": 0.8,
    "South America": 1.8,
    "Africa": 1.3
};

/**
 * How much a territory's PEOPLE contribute to its starting construction materials.
 *
 * Economy stage 3.2, closing audit D7. The seed is `sqrt(population / 1000) * devIndex * this`,
 * added to the three area terms that were the whole of it before. Construction materials are
 * made by people and industry rather than by land, and until this stage the ceiling was
 * `f(area)` almost entirely -- so Germany needed eighty turns of regeneration to fill one
 * territory's upgrade slots and China needed one, which is a small developed country locked out
 * of its own upgrade tree at any price.
 *
 * It is 50 because that is what lifts Germany by an order of magnitude (1,244 -> 14,893) while
 * lifting China by well under one (64,316 -> 110,509). The square root is what makes those two
 * numbers different; a linear term would have paid China most. `node tools/econ-lab.mjs consmats`
 * is the measurement.
 */
export const CONS_MATS_POPULATION_SCALE = 50;

/**
 * The floor under a territory's construction-materials capacity.
 *
 * The same instrument as `TERRITORY_BASE_INCOME`, and there for the same reason. It was 500,
 * written inline in `assignArmyAndResourcesToPaths()` beside the seed it floored. The population
 * term above does nothing for a territory with 800 people on one square kilometre, and at 500 an
 * island needed 171 turns of its own regeneration to fill its upgrade slots -- so this is what
 * carries the very bottom of the map, where neither land nor people can.
 *
 * At 2,500 the worst territory on the map fills its slots in about forty turns, against China's
 * one. That spread is deliberate and must not close: being large has to keep paying.
 */
export const MIN_CONS_MATS_CAPACITY = 2500;

/**
 * What holding a WHOLE continent is worth: gold income, and the three capacities.
 *
 * All or nothing. A partly-held continent earns nothing extra, which is the only shape that
 * creates a decision -- under proportional credit a continent stops being an objective and
 * becomes a slope, and the thirteenth territory of a thirteen-territory continent stops being
 * worth a war of its own. It is also the same threshold the CONTINENTAL victory condition
 * uses, so the game measures "holding a continent" exactly once.
 *
 * These are DELIBERATELY SEPARATE from `continentModifiers` / `goldContinentModifiers` above.
 * Those say what a continent is worth to live on; these say what it is worth to own outright.
 * Two different facts, and merging them would make a later balance pass retune both at once.
 *
 * TWO CONSTANTS, NOT ONE, and the difference between them is not a rounding of taste:
 * capacity COMPOUNDS into gold and gold compounds into nothing. Food capacity gates
 * population, population gates productive population, and productive population is the input
 * to `goldChangeFor()` -- so a capacity multiplier arrives in the gold income a few turns
 * later on top of the gold multiplier. Equal numbers would not be equal effects, and the
 * measurement in docs/archived/05-continent-bonuses.md section 6 has to be able to move one without
 * the other.
 *
 * Neither number is final until that measurement has been taken.
 */
export const CONTINENT_BONUS_GOLD = 1.5;

/**
 * The multiplier on `oilCapacity`, `foodCapacity` and `consMatsCapacity` for a continent held
 * whole. See `CONTINENT_BONUS_GOLD` above for why it is smaller.
 *
 * It is the CEILING that is raised and never the regeneration DELTA. The three commodities
 * are stocks moving towards a capacity, so multiplying the change makes a territory reach the
 * same ceiling slightly sooner and is worth nothing within a handful of turns. The ceiling is
 * the lever; `src/rules/economy/capacity.js` is where it is applied.
 */
export const CONTINENT_BONUS_CAPACITY = 1.25;

/**
 * Per-resource regeneration.
 *
 * `growth` is the fraction of the shortfall recovered each turn when a territory holds less
 * than its capacity; `decay` the fraction of the excess lost each turn when it holds more.
 * Growth is faster than decay for all three, so a territory refills quicker than it spills.
 */
export const resourceRegeneration = {
    consMats: { growth: 0.25, decay: 0.1 },
    oil: { growth: 0.3, decay: 0.1 },
    food: { growth: 0.2, decay: 0.1 }
};

/**
 * What every territory earns for existing, before it earns anything for what it IS.
 *
 * Economy stage 2.1, and the number is not new -- it is 44.44 gold a turn and it has been paid
 * to every territory on the map every turn since the game was written. It was **hidden inside a
 * normalisation window**: income was `(scaled - normaliseMin) / (normaliseMax - normaliseMin)`
 * with `normaliseMin` at -800, which is an affine transform and not a clamp, so the -800 was
 * simply a constant added to everybody. Nothing named it and nothing could tune it.
 *
 * Why that mattered enough to be its own stage: it is **65% of what a MEDIAN territory earns in
 * total** (median 68.5 gold a turn), so for anything below roughly a million productive
 * population -- most of the 359 territories on the map -- income was very nearly constant and
 * nothing the player did to a territory moved it. That is the direct answer to "players have no
 * reason to upgrade": on most of the map they were right. See docs/archived/05-economy-audit.md section
 * 4 D1, and `node tools/econ-lab.mjs income` for the measurement.
 *
 * Splitting it out changes no income on the turn it lands -- deliberately, because stage 2 is a
 * refactor of the floor and the tuning is stage 3. **It is 44.44 rather than the exact 44.444...
 * the old window produced**, a difference of 0.0044 gold per territory per turn, which is 1.6
 * gold a turn across the whole world and is the price of the constant being a readable number
 * instead of a repeating decimal.
 *
 * Raising this makes a bad start survivable and makes upgrading matter less. Lowering it does
 * the reverse, and at zero a one-territory country in Africa earns almost nothing at all.
 */
export const TERRITORY_BASE_INCOME = 44.44;

/** Gold income, on top of `TERRITORY_BASE_INCOME`. */
export const goldIncome = {
    /** Territory area is divided by this before being used as a multiplier, floored at 1. */
    areaDivisor: 10000000,
    /** Fraction of the productive population that earns. */
    productivePopRate: 0.1,
    /** Applied after the log-scaling division. */
    scale: 0.2,
    /**
     * The scaled figure is divided by this to become gold. Raising it pushes the large
     * economies down and leaves the small ones on the base income; lowering it spreads the
     * world further apart.
     *
     * It is 18 because that is what the old window was: a span of 1800 followed by a
     * multiplication by 100. **The window never clamped anything** -- China's scaled figure is
     * about 61,400 against a `normaliseMax` of 1000 -- so nothing is lost by saying so plainly.
     */
    earnedDivisor: 18
};

/** Population growth and starvation. */
export const population = {
    /** People per unit of food shortage before the death rate is applied. */
    shortagePerDeathRoll: 1000,
    /** Deaths per shortage unit: `round(deathRateScale * (1 - devIndex) * deathRateFactor)`. */
    deathRateScale: 100,
    deathRateFactor: 3,
    /** Fraction of the current population that can be added in one turn, given the food. */
    growthRate: 0.1,
    /** Chance per turn that a besieged territory starves its ARMY rather than its civilians. */
    siegeArmyStarvationChance: 0.3,
    /** Multiplier on the army's share of a famine while under siege. */
    siegeArmyStarvationFactor: 10
};

/** Random-event severity. Each event is a coin flip; these are what it costs when it lands. */
export const randomEventSeverity = {
    /** "Warehouse Fire": construction materials are DIVIDED by this. */
    warehouseFireDivisor: 1.5,
    /** "Oil Well Fire": oil is divided by this. */
    oilWellFireDivisor: 1.5,
    /** "Food Disaster": food is divided by this. */
    foodDisasterDivisor: 2,
    /** "Mutiny": gold is multiplied by this. */
    mutinyGoldMultiplier: 0.75,
    /** Probability the territory is hit rather than escaping harm. */
    hitChance: 0.5
};

/** Scaling factors that turn a territory's holdings into a single strength number. */
export const territoryStrengthScales = {
    area: 0.00001,
    resources: 0.2,
    devIndex: 0.6,
    population: 0.00001,
    continentModifier: 0.2,
    army: 0.5
};

/** The starting army a territory is given, before the maintenance-affordability trim. */
export const startingArmy = {
    /** Fraction of the starting population, times the development index. */
    populationRate: 0.01,
    /** China and India start with so much population that they need moderating. */
    moderatedCountries: ["China", "India"],
    moderationDivisor: 4
};

/** How a territory's opening army is split across the four unit types. */
export const initialArmyDistribution = {
    infantryShare: 0.1,
    /** Per type: the share of territory oil, and the share of the remaining army value. */
    naval: { oilShare: 0.2, armyShare: 0.3 },
    air: { oilShare: 0.2, armyShare: 0.2 },
    assault: { oilShare: 0.2, armyShare: 0.2 }
};

// --- military --------------------------------------------------------------

/**
 * How much harder an attacker hits than its head count says. THE attack/defence dial.
 *
 * The world was not changing hands. Forty headless turns of `tools/ai-sim.mjs` left 156
 * of 207 countries alive with roughly two conquests a turn across the whole map, and the
 * reason is structural rather than a matter of the AI being timid: `defenseMultiplierFor()`
 * takes the CEILING of the fortification bonus, so a single fort -- or a mountain, or the
 * land-locked bonus -- doubles a territory's defending strength outright. Most territories
 * on the map have at least one of those, so most attacks are fought at a two-to-one
 * disadvantage before a single unit is counted.
 *
 * Rather than unpick that (the ceiling is load-bearing: it is what makes the FIRST fort
 * worth building), the attacker gets a flat multiplier on its strength, applied at the one
 * place attack and defence are finally compared. The attack-to-defence RATIO improves by
 * exactly this much at every point on the scale, which is what "attacking is N per cent
 * easier COMPARED TO defence" says.
 *
 * It has been raised twice, twenty per cent each time, and COMPOUNDED rather than added:
 * 1.0 -> 1.2 -> 1.44. That is the arithmetic the multiplier implies -- another twenty per
 * cent on top of an attack that was already twenty per cent better -- and it is why the
 * number is 1.44 and not 1.4.
 *
 * Note what that is not: it is not a fixed number of points added to the win probability.
 * The probability is a share, `attack / (attack + defence)`, so at 1.44 an even fight goes
 * from 50% to 59% and a losing one from 25% to 32.4%. That is the well-behaved form -- it
 * cannot push a probability past 100, it cannot make a hopeless attack look winnable, and
 * raising it again is another proportional step rather than another fixed number of
 * points. Multiplying the probability itself would do all three of those things wrong.
 *
 * TUNING. What it moves changed at the battle overhaul, and the list is now shorter than
 * the paragraphs above imply:
 *
 *   * SIEGES, through `scoreDifferenceFor()` in src/rules/military/siege.js, which is the
 *     single number every siege band is scored on -- the hit roll, the destroy roll, the
 *     collateral damage and the arrest. This is the dial's main job today.
 *   * The PRE-BATTLE ODDS, through `winProbability()` in src/rules/military/probability.js.
 *     That figure is what the AI rates targets on and what the attack window shows, but it
 *     no longer decides a round: the dice model has its own dial, below.
 *
 * OPEN BATTLE runs on `DICE_ATTACK_ADVANTAGE` instead, and that split is now permanent
 * rather than the temporary exception the overhaul plan proposed. See the note on that
 * constant for the measurement and the reasoning; the short form is that a banded model and
 * a continuous one cannot share a multiplier, because the banded one turns a 44% edge into a
 * whole extra die and therefore a guaranteed casualty every round.
 *
 * The AI needs no change at all: it rates targets with the real probability function and
 * the real siege score, so its odds floors, its budgets and its posture thresholds all
 * re-derive from this on their own.
 *
 * Battle overhaul B.10. Two constants this note used to name as deliberately untouched --
 * `SKIRMISH_ODDS_CAP` and `battleOutcomeThresholds` -- are DELETED. They belonged to the
 * five-round skirmish model, which no longer exists. `BREAK_THRESHOLD` is what measures an
 * army against its own starting size now, and there is no per-exchange cap to raise: the
 * dice bands are the ceiling on a lopsided fight.
 */
export const ATTACK_ADVANTAGE = 1.44;

/**
 * Defence bonus and mountain bonus are summed and divided by this, and the CEILING of that
 * is the multiplier on defending strength. So a total bonus of 1..15 doubles the defence,
 * 16..30 triples it, and a bonus of zero leaves it alone.
 */
export const DEFENSE_BONUS_DIVISOR = 15;

/**
 * Area above which a territory gets no defensive area bonus at all. Below it the bonus
 * scales up, halved by `areaBonusDampening` so the largest territories are not untouchable.
 */
export const MAX_AREA_THRESHOLD = 350000;
export const AREA_BONUS_DAMPENING = 0.5;

/** Continent modifier applied to ATTACKING strength -- some continents are harder to invade. */
export const combatContinentModifiers = {
    "Europe": 0.98,
    "North America": 0.99,
    "Asia": 0.87,
    "Oceania": 0.75,
    "South America": 0.82,
    "Africa": 0.81
};

// audit 5.2 K. Skirmishes used to pair matching unit types only, so two armies sharing no
// unit type produced zero skirmishes and the battle could neither progress nor resolve --
// an all-infantry attack on an all-naval defender simply hung. Refactor plan 3.15 offered
// two ways out and recommended this one: let any type engage any type, scaled by how
// effective it is against that opponent. Army composition now matters, and because every
// attacker can find someone to fight, a battle always resolves.
/**
 * Rows are the ATTACKING unit type, columns the DEFENDING one, in unit-type order:
 * infantry, assault, air, naval. Same-type values are 1, so the common case is unchanged.
 */
export const UNIT_MATCHUP_EFFECTIVENESS = [
    //           vs inf  vs assault  vs air  vs naval
    /* infantry */ [1, 0.6, 0.4, 0.5],
    /* assault  */ [1.4, 1, 0.5, 0.7],
    /* air      */ [1.5, 1.6, 1, 1.4],
    /* naval    */ [0.8, 0.7, 0.5, 1]
];


/** What each outcome costs or yields. */
export const battleOutcomeEffects = {
    /** Fraction of the routed defender's survivors that join the conqueror. */
    routCaptureShare: 0.5,
    /** Fraction of the attacker that survives a "last push" conquest. */
    lastPushSurvivorShare: 0.8,
    /** Attrition applied to the attacker when a battle goes to a second set of five rounds. */
    warWearinessSurvivorShare: 0.95
};

/** A conquered territory sits out between this many turns, inclusive. */
export const conquestLockout = { minTurns: 1, maxTurns: 3 };

// --- battle: dice ----------------------------------------------------------
//
// Battle overhaul B.1. See docs/archived/battle_overhaul.md section 4 for the reasoning; this is the
// numeric half of it.
//
// The shape of the model in one paragraph: force ratio produces a SHARE, the share produces a
// number of DICE, terrain and composition produce flat MODIFIERS on those dice, sorted dice
// are paired high against high with ties going to the defender, dice the other side cannot
// match are automatic hits, and each lost pairing costs a fixed fraction of the loser's
// CURRENT force. Rounds run until one side falls below `BREAK_THRESHOLD` of what it started
// with.
//
// Nothing here is measured yet. The table in docs/archived/battle_overhaul.md section 4.6 is modelled,
// and section 6 is explicit that no constant in this block ships on judgement: each one is
// measured with tools/ai-sim.mjs on a fixed seed before and after. `tools/battle-lab.mjs`
// is the cheap version of that check -- it runs the model headlessly and prints the matchup
// table -- but it is not a substitute for a hundred turns of a real world.

/**
 * The attack/defence dial FOR THE DICE MODEL, and why it is not `ATTACK_ADVANTAGE`.
 *
 * CLAUDE.md is emphatic that `ATTACK_ADVANTAGE` is the one dial and that a second one is drift.
 * This is the one standing exception, and at B.10 it was made PERMANENT rather than reconciled.
 * The reason is a measurement, taken with `tools/battle-lab.mjs`:
 *
 *   At 1.44, a raw-EVEN fight -- identical armies, no terrain, no composition edge -- was won
 *   by the ATTACKER 88.3% of the time.
 *
 * That is the exact opposite of what docs/archived/battle_overhaul.md section 4.3 designs, and the cause
 * is banding. 1.44 moves the attacker's share from 0.500 to 0.590, which crosses a band edge, so
 * the attacker rolls FOUR dice against THREE -- and a spare die is not a small edge, it is an
 * unmatched die, which is a guaranteed casualty every single round. A continuous probability
 * absorbs a 44% strength multiplier smoothly; a banded one amplifies it into a permanent free
 * hit.
 *
 * Re-cutting the bands cannot fix it. For a raw-even fight to come out 4v4, one band has to
 * contain both 0.590 and 0.410 -- and a raw 1:2 attacker sits at 0.419, inside that same band,
 * so it would get equal dice with a half-sized army. The band that fixes 1:1 breaks 1:2.
 *
 * So the dice model runs at 1.0: no thumb on the scale. It does not need one, because the
 * defender's advantage in this model is TIES, which is worth about seventeen points a pairing
 * and is far stronger than anything the old model gave a defender. The attacker's advantage is
 * bringing more, which is what the bands are for.
 *
 * `ATTACK_ADVANTAGE` is untouched at 1.44 and runs sieges and the pre-battle odds figure.
 *
 * WHY THEY WERE NOT RECONCILED (battle overhaul B.10, Leigh's decision to delegate, the reasoning
 * recorded here so it is not relitigated). The plan assumed B.5 would collapse the two into one
 * number. B.5 measured the AI swap as balance-neutral, which removed the pressure to retune, and
 * left the question standing on its own merits -- at which point the answer is that these are not
 * two settings of one thing. A dial multiplying a CONTINUOUS share moves the outcome smoothly and
 * proportionally; a dial multiplying a BANDED share moves it in whole dice, and a whole die is an
 * unmatched die, which is a guaranteed casualty. Forcing them together has exactly two forms and
 * both are worse for the player:
 *
 *   * 1.44 everywhere -- open battle returns to an 88.3% attacker win on an even fight, which
 *     deletes the defender's tie advantage, deletes the reason to fortify, and makes the ledger
 *     in the attack window a formality rather than a decision.
 *   * 1.0 everywhere -- every siege band loses its 44% attacker multiplier at once. Sieges are
 *     already the slow option chosen against a target that cannot be stormed; making them harder
 *     with no measurement behind it removes the strategic alternative rather than balancing it.
 *
 * So there are two dials, each owning one model, each documented at its own constant. What is NOT
 * allowed is a third, or either of these reaching into the other's model. If open battle needs to
 * get easier or harder, this is the number; if sieges do, that one is.
 *
 * COMBAT STAGE 3: 1.0 -> 1.54, AND THIS IS THE REBASE, NOT A NEW THUMB ON THE SCALE.
 *
 * Leigh's decision (audit section 9, Q2) was to keep `devIndex` and `combatContinentModifier`,
 * keep their full spread, and move their CENTRE so that the median attacker fights at x1.00
 * instead of x0.63. Measured over all 1,888 real adjacent enemy pairings on the map, the
 * product `devIndex x combatContinentModifier` is:
 *
 *     min 0.264   p25 0.529   MEDIAN 0.648   mean 0.652   p75 0.792   max 0.949
 *
 * -- so 1/0.648 = 1.543 from the median and 1/0.652 = 1.535 from the mean, which agree closely
 * enough that 1.54 is the number either way.
 *
 * It is applied HERE rather than by editing the two tables, and that is deliberate for two
 * reasons. First, it is arithmetically identical: a global multiplier preserves every relative
 * difference, so the spread is untouched (0.41x to 1.46x of the median, exactly as before) and
 * Europe still attacks better than Africa. Second, `devIndex` is read by `defenseBonusFor()`,
 * the upgrade price ladder, `productivePopulationFor()` and the construction-materials ceiling,
 * and `attackingDevelopmentIndex()` feeds `winProbability()` as well as `shareFor()`. Rebasing
 * the DATA would have leaked a combat decision into the economy. Rebasing the dial cannot.
 *
 * THIS REVERSES WHAT THE NOTE ABOVE SAYS, and the reason is that the note's measurement was
 * taken in a context that does not occur. `tools/battle-lab.mjs` uses `attackingDevelopmentIndex
 * = 1, combatContinentModifier = 1`. There is no such attacker: the best on the map is Monaco
 * into North America at 0.962 x 0.99 = 0.95, and the median is 0.648. So "at 1.44 a raw-EVEN
 * fight was won by the ATTACKER 88.3% of the time" describes an idealised attacker that no
 * country in the game can be, and the world it was protecting -- where an even fight favours the
 * defender -- was never actually delivered: at x0.63 the median attacker LOST an even fight
 * overwhelmingly, which is docs/05-combat-and-conquest-audit.md section 3.2 and known-issue G2.
 *
 * At 1.54 the median real attacker sits at x1.00, so an even fight is 4 dice against 4, ties go
 * to the defender, and the defender is favoured -- which is what
 * docs/archived/battle_overhaul.md section 4.3 designs and what the two dials existed to
 * protect. The design intent is not being abandoned here; it is being delivered for the first
 * time to the attackers who actually exist.
 *
 * WHAT IS STILL FORBIDDEN is unchanged and this does not touch it: `ATTACK_ADVANTAGE` stays at
 * 1.44 and owns sieges and the pre-battle strength figure, there is still no third dial, and
 * neither reaches into the other's model. `node tools/combat-lab.mjs terrain` reports the median
 * combined attacker multiplier and is the check that this number is still right if either table
 * is ever edited.
 */
export const DICE_ATTACK_ADVANTAGE = 1.54;

/**
 * How many dice a side rolls, by its own share of the two strengths.
 *
 * Read as: the first row whose `minimumShare` the side has reached. Ordered high to low so
 * `find()` is the whole lookup.
 *
 * BANDS, not a continuous curve, and that is the point. A band edge is a threshold the player
 * can see and aim at in the attack window -- "forty thousand more infantry gets me a fourth
 * die" is a decision; "my odds went up 1.8%" is not.
 *
 * The bottom row is what guarantees the underdog always keeps one die. Overwhelming force
 * gets you the maximum number of dice; it never gets you a round for free.
 */
export const DICE_SHARE_BANDS = Object.freeze([
    Object.freeze({ minimumShare: 0.70, dice: 6 }),
    Object.freeze({ minimumShare: 0.50, dice: 5 }),
    Object.freeze({ minimumShare: 0.35, dice: 4 }),
    Object.freeze({ minimumShare: 0.20, dice: 3 }),
    Object.freeze({ minimumShare: 0, dice: 2 })
]);

/**
 * The defender never rolls the top band.
 *
 * One below `DICE_SHARE_BANDS`'s maximum, whatever that maximum is -- combat stage 3 widened
 * the table from 1..5 dice to 2..6 and this moved 4 -> 5 with it, which is why
 * `rules-dice.spec.js` asserts the RELATIONSHIP (`DEFENDER_DICE_CAP < TOP_BAND.dice`) rather
 * than either number.
 *
 * At even strength both sides sit in the 0.50 band, so the cap does nothing there and both
 * roll five. It bites only where the DEFENDER is the stronger side, and it is what stops a
 * heavily garrisoned territory being able to grind an attacker down at no risk: the defender
 * can always be attacked, just very badly.
 */
export const DEFENDER_DICE_CAP = 5;

/** An ordinary d6. Named because the pairing maths reads better than a bare 6. */
export const DIE_FACES = 6;

/**
 * Ceiling on the sum of one side's die modifiers, in either direction.
 *
 * +1 to every die is worth roughly seventeen percentage points on a pairing (an unmodified
 * pairing is 15/36 to the attacker, +1 makes it 21/36), so this is a hard cap on purpose. Two
 * is already decisive; three would make the dice a formality and put the game back where the
 * 65% skirmish cap left it.
 */
export const MODIFIER_CLAMP = 2;

/**
 * The named, itemised modifiers -- the half of the model the player is SHOWN.
 *
 * Diffuse always-on multipliers (development index, continent, area, ATTACK_ADVANTAGE) shape
 * the share instead and stay out of this list. The division is deliberate: a modifier appears
 * as a line of text on the attack screen, so every entry here has to suggest something the
 * player could do about it. "Your continent modifier is 0.87" does not.
 */
export const DIE_MODIFIERS = Object.freeze({
    /**
     * How many dice a territory's fortifications take OFF the attacker, banded on the raw
     * `defenseBonus + mountainDefenseBonus`.
     *
     * Deliberately NOT `defenseMultiplierFor()`. That function takes the CEILING of the bonus
     * over 15, which CLAUDE.md records as load-bearing-but-odd: it makes a single fort double a
     * territory's defence outright. Fort defence is `forts * (forts + 1) * 10 * devIndex`, so
     * one fort is 20 and already "doubles", and two forts is 60 and already "triples". Reusing
     * that here cost the attacker a die for one fort and two dice for two, which measured at a
     * 1.1% take probability for an even attack on a single-fort territory -- the mirror image of
     * the bug this whole section exists to fix.
     *
     * These bands are read against the raw number instead, so the progression follows the forts
     * rather than the ceiling: one fort is a nuisance, two is a die, three is a fortress.
     */
    fortification: Object.freeze([
        Object.freeze({ minimumBonus: 100, dice: 2 }),
        Object.freeze({ minimumBonus: 25, dice: 1 })
    ]),
    /** Air superiority: this side has air and the other has none, or holds `airRatio` times as much. */
    airSuperiority: 1,
    airRatio: 3,
    /** Fielding no armour against an opponent who does. */
    noArmourAgainstArmour: -1,
    /** A coastal target attacked by a force at least `coastalNavalShare` naval. */
    coastalAssault: 1,
    coastalNavalShare: 0.25,
    /** Spent the previous round consolidating instead of attacking. */
    dugIn: 1,
    /** Assaulting out of a siege: +1 per this many turns spent grinding, to `siegeGrindingCap`. */
    siegeGrindingTurnsPerStep: 3,
    siegeGrindingCap: 2
});

/**
 * What one lost pairing costs, as a fraction of that side's force AS IT STANDS.
 *
 * Compounded rather than summed across a round's pairings, so a side losing every pairing of a
 * five-dice round keeps 0.9^5 of its force rather than half of it -- and can never be driven
 * below zero by arithmetic.
 *
 * This is the pacing dial. It, and the band edges above, are what set the "5-8 rounds" in
 * docs/archived/battle_overhaul.md section 3. Raising it makes every battle shorter and bloodier.
 *
 * 0.10 -> 0.09 at combat stage 3, and the reason is the band change above rather than a wish for
 * bloodier battles. Widening the dice range put FIVE dice at parity where there were four, so a
 * round contests more pairings and a side loses more of them; at 0.10 that took battles to 3-5
 * rounds against the designed 5-8, and at 0.07 (tried first, with a wider table still) it went
 * the other way to 5-8 with a median of 6.
 *
 * ROUND COUNT IS WHAT THE PLAYER ACTUALLY WAITS FOR, and that is the constraint this number is
 * set against. Each round costs a dice throw capped at `MAX_ROLL_MS` plus a clash panel that
 * lingers `LINGER_MS`, and both are paid ONCE PER ROUND whatever the pairings -- so a battle of
 * six short rounds is slower to watch than one of five longer ones. At 0.09 the median battle is
 * five rounds and the range 4-6, which is what it was before this phase touched anything. The
 * e2e suite is the witness: at 0.07 the `battle/` area began timing out, and that was not the
 * specs being brittle, it was a battle genuinely taking longer to play out.
 */
export const PAIRING_CASUALTY_SHARE = 0.09;

/**
 * A side is BROKEN below this fraction of the force it started the battle with.
 *
 * Measured against that side's OWN starting force -- audit 5.1 E is the bug that comes from
 * getting this wrong -- and checked AFTER the round's casualties are applied, which is what
 * closes known-issue AP by construction rather than by a guard.
 *
 * One threshold replaces the old `battleOutcomeThresholds` trio (0.05 defender rout, 0.15 last
 * push, 0.10 attacker rout). Those three fired against a five-round battle that annihilated
 * the smaller army anyway; with continuous attrition and no round limit, a single symmetric
 * break point is what decides every battle.
 */
export const BREAK_THRESHOLD = 0.20;

/**
 * The last push is offered while the defender is within this multiple of the break threshold.
 *
 * So at the defaults: the defender between 20% and 30% of its starting force is nearly gone,
 * and the attacker may spend `battleOutcomeEffects.lastPushSurvivorShare` to finish it now
 * rather than risk more rounds. It is an offer, not an outcome -- which is the difference from
 * today, where "massive assault" fires on its own.
 */
export const LAST_PUSH_BAND = 1.5;

/** Digging in: forfeit this round's attack dice, take this fraction of normal casualties. */
export const DIG_IN_CASUALTY_SHARE = 0.5;

/**
 * Safety valve, not a balance number.
 *
 * A battle cannot run forever, but nothing in the model should ever reach this: every round
 * costs the loser of at least one pairing a tenth of its force. If `tools/battle-lab.mjs` or
 * ai-sim ever reports a battle hitting the cap, that is a bug in the casualty floor -- a round
 * that killed nobody -- and not a tuning question.
 */
export const MAX_BATTLE_ROUNDS = 30;

/** Reserves committed mid-battle arrive at the start of the round this many rounds later. */
export const RESERVE_ARRIVAL_DELAY = 1;

// --- sieges ----------------------------------------------------------------

/**
 * What share of its gold, oil and construction materials a BESIEGED territory still earns.
 *
 * Until this existed the answer was zero, and that was never a decision: the siege branch of
 * the income pass in `resourceCalculations.js` handles food and population and simply never
 * had the other three lines written into it. A player besieged on turn 3 of a measured run was
 * still frozen on turn 14, and nothing in the game ends a siege except an arrest or a conquest.
 *
 * A quarter is chosen so that a siege HURTS without removing the defender from the game. The
 * distinction that matters is between a bleed and a freeze: a besieged territory on a quarter
 * income is still accumulating, slowly, toward the fort or the troops that might break the
 * siege, so the player has something to do about it. On zero there is no decision to take at
 * all -- which is what made the item a design problem rather than a balance number.
 *
 * FOOD IS NOT SCALED BY THIS. The siege's whole mechanism is starvation, through
 * `calculateFoodChange()` and `siegeArmyStarvationChange()`, and taxing the food a second time
 * here would be charging for the siege twice.
 */
export const SIEGE_INCOME_SHARE = 0.25;

/**
 * May a besieged territory BUILD? Known-issue BQ.
 *
 * It could, and it could not earn -- it was able to spend but not to receive, which is an odd
 * pair on its own and produced a plainly wrong outcome: France, under siege, put up a farm and
 * its food ceiling rose 64,967,839 to 65,032,807 across the turn the siege began, so the farm
 * outran the siege that was grinding it down. Economy stage 3.1 widened that, because a farm
 * now adds a flat 100,000 on top of its ten per cent and a small territory's ceiling is small.
 *
 * A siege is a territory cut off, so it is one rule now: no income to speak of, and nothing
 * built. This is a constant rather than a bare `if` because it is a rule a later phase may
 * want to relax to "forts only" -- digging in is what a besieged garrison would actually do.
 */
export const SIEGE_SUSPENDS_CONSTRUCTION = true;

/**
 * Turns before the AI will open an attack or a siege against the PLAYER.
 *
 * The AI plans its first turn with full information, and there are 206 of them. A player who
 * chose a one-territory country is reachable by several at once on turn 1 and could be
 * eliminated inside ten turns without ever having taken a decision that mattered -- which is
 * the single item most likely to decide whether somebody's first game is worth finishing.
 *
 * Three things this deliberately is NOT. It is not a difficulty setting: the AI fights the
 * player exactly as hard from turn 6 as it ever did. It is not a shield on the player's
 * territory -- the AI may still be attacked BY the player during it, and an AI already at war
 * with another AI over a territory the player then takes is unaffected, because the grace is
 * about opening a new interaction and not about existing ones. And it is not a bonus to the
 * player's odds anywhere; nothing in the battle model knows about it.
 *
 * It sits in `rateTarget()`, which is the one place a target is refused with a stated reason,
 * so the AI debug window and the plan log both say why.
 */
export const PLAYER_GRACE_TURNS = 5;

/** How much one unit of each type contributes to a siege score. */
export const armyTypeSiegeValues = {
    infantry: 0.0001,
    assault: 3,
    air: 5,
    naval: 10
};

/** The hit roll is repeated this many times a turn; a majority of hits is a hit. */
export const SIEGE_HIT_ITERATIONS = 10;

/**
 * Chance of a siege hit: `base + (siegeScore - defence) / scoreDivisor`, clamped to 0..1.
 * An evenly matched siege therefore lands half its turns.
 */
export const siegeHitChance = {
    base: 0.5,
    scoreDivisor: 1000
};

/**
 * Probability that a landed siege hit destroys anything at all, by how far the siege score
 * exceeds the territory's defence. Read as: the highest entry whose `scoreDifference` the
 * siege has reached.
 */
export const siegeDestroySlidingScale = [
    { scoreDifference: 0, destroyProbability: 0 },
    { scoreDifference: 20, destroyProbability: 0.3 },
    { scoreDifference: 70, destroyProbability: 0.5 },
    { scoreDifference: 130, destroyProbability: 0.7 },
    { scoreDifference: 200, destroyProbability: 0.9 },
    { scoreDifference: 280, destroyProbability: 1 }
];

/**
 * How many buildings a successful destroy roll takes out. An overwhelming siege
 * (difference >= 200) rolls twice; a strong one (>= 50) rolls once; anything weaker does
 * collateral damage only.
 */
export const siegeDestructionRolls = {
    overwhelmingThreshold: 200,
    overwhelmingFirstRollChance: 0.3,
    overwhelmingSecondRollChance: 0.5,
    strongThreshold: 50,
    strongRollChance: 0.5
};

/**
 * Collateral damage, as a percentage of the territory's food capacity, by score difference.
 * Each band rolls `1..max`. The negative band is the ARREST band: a siege that cannot even
 * match the territory's defence is rounded up rather than sustained.
 */
export const siegeCollateralBands = [
    { min: 0, max: 20, damageMax: 6 },
    { min: 20, max: 50, damageMax: 12 },
    { min: 50, max: 100, damageMax: 18 },
    { min: 100, max: Infinity, damageMax: 25 }
];

/**
 * How far BELOW a territory's defences a siege may sit and still merely achieve nothing.
 *
 * Combat stage 4, closing known-issue G5, and the distinction is the whole of it: until now
 * "cannot match the defences" and "is being destroyed" were the SAME state. Any negative score
 * difference at all put the besieging force in the arrest band, where it had a 60% chance every
 * turn of being wiped out with half of it joining the defender.
 *
 * That made a siege unusable by the army the AI can actually field. `armyTypeSiegeValues`
 * prices infantry at a ten-thousandth of a point, deliberately -- a siege is broken by artillery
 * and blockade, not by numbers -- and `src/ai/muster.js` moves infantry ONLY, also deliberately,
 * because vehicles are gated by the oil capacity of the territory they stand in. Both decisions
 * are individually right and jointly fatal: an infantry-only besieger scores about 10 against a
 * bare mountain's 30, sits at minus 16, and has an expected life of under two turns. Traced over
 * 30 turns, sieges were being DECIDED and laid all over Europe -- "going to start a siege attack
 * on Croatia from Switzerland" -- and the world still held 0 or 1 standing at every sample.
 *
 * The obvious fix is not available. Repricing infantry upward is capped by
 * `tests/unit/balance-unit-economics.spec.js`, which pins vehicles at five to six times better
 * per gold in a siege; anything past 0.00012 breaks the siege-versus-battle trade that CLAUDE.md
 * records as the one genuine economic decision the military layer offers, and 0.00012 is not
 * nearly enough to leave the band.
 *
 * So the band itself is split. A siege within this margin of the defences HOLDS: it does no
 * damage, it starves nobody faster, and it is not destroyed -- an army sitting outside a town it
 * cannot crack, which is what a siege at those odds should look like and is the state the model
 * had no way to express. Only a siege further under than this is swept away.
 *
 * Fifty, because a bare mountain territory is a defence of 10 to 50 and an infantry-only
 * besieging army of any size should be able to invest one; a fortress at 250 still arrests
 * anything that is not a real siege train.
 */
export const SIEGE_ARREST_MARGIN = 50;

/**
 * Below `SIEGE_ARREST_MARGIN` under the defences, the chance the besieging force is arrested.
 *
 * Left at 0.6, and the audit's question about whether that is too harsh (§6 G5) is answered by
 * the margin above rather than by softening this. The penalty was never the problem; the problem
 * was that most of the world could not LEAVE the band it applies to. Now that being in it means
 * a siege genuinely hopeless against the walls in front of it, losing the army is the right
 * outcome.
 */
export const SIEGE_ARREST_CHANCE = 0.6;

/** Fraction of an arrested besieging force that is absorbed by the defender. */
export const SIEGE_ARREST_CAPTURE_SHARE = 0.5;

/**
 * A siege is abandoned as hopeless when the defender is below this fraction of its starting
 * force AND has no forts left. Forts are what make a siege worth continuing.
 */
export const SIEGE_ROUT_THRESHOLD = 0.05;

// --- ai --------------------------------------------------------------------

/**
 * The score given to a threat the AI should ignore entirely. Large and negative so that it
 * sorts below every real threat without needing a separate filtering pass.
 */
export const THREAT_DISREGARD_CONSTANT = -9999999999;

/** How many territory upgrades one AI country may buy in a single turn. */
export const MAX_AI_UPGRADES_PER_TURN = 5;

/**
 * The floor beneath everything: below this an interaction is not offered to anybody.
 *
 * Read by the AI's goal planner and by the player's Siege button, and since combat stage 1 both
 * compare it against the SAME quantity -- `takeProbability()`, the chance of actually taking the
 * territory. It used to be compared against `winProbability()`, a ratio of two strengths, where
 * 15 corresponded to a raw force ratio of 0.34:1 and a real take probability of ZERO. It floored
 * nothing at all.
 *
 * Lowered 15 -> 8 in combat stage 2, and this is the one figure in this block that moved on
 * evidence rather than on restatement. Measured at turn 25 of a Continental run immediately
 * after stage 1: **1,366 of 1,624 weighed pairings (84%) died at this gate**, up from 761 before
 * it meant anything. That is the wrong gate to be the biggest filter in the AI, because it sits
 * ABOVE the siege decision -- and a siege is precisely the answer to a target that cannot be
 * stormed. Refusing to consider a siege because the assault odds are poor is refusing to use the
 * tool for the job it exists for.
 *
 * Eight, not zero: something has to stop an army being parked in front of a fortress forever,
 * and `siegeDiscipline.minimumOdds` is the gate that then decides whether the siege is worth
 * opening.
 */
export const PROBABILITY_THRESHOLD_FOR_SIEGE = 8;

// --- random events ---------------------------------------------------------

/** The four disasters, in the order `selectRandomEvent()` draws from. */
export const RANDOM_EVENTS = ["Food Disaster", "Oil Well Fire", "Warehouse Fire", "Mutiny"];

/**
 * A random event becomes likelier every quiet turn. The chance is compared against the mean
 * of `samples` draws, which makes an event on turn 2 very unlikely and one by turn 20 close
 * to certain; a fired event resets the counter to zero.
 */
export const randomEventLikelihood = {
    startingProbabilityPercent: 0,
    incrementPerQuietTurn: 1,
    samples: 5
};

// --- ai strategy -----------------------------------------------------------
//
// The numbers behind the AI's long- and medium-term planning (src/ai/victory.js and
// src/ai/strategy.js). Before these existed the AI was entirely turn-local: it scored
// every reachable enemy territory, ranked the results by its leader's personality and
// executed the list, which is why it started far more sieges than it could ever finish
// and why it fought equally hard for a Caribbean island and for the last territory it
// needed to own a continent outright. See docs/03-known-issues.md section 6.

/**
 * The default victory condition, and the one the AI campaigns towards until the player
 * chooses otherwise. CONTINENTAL: hold every territory on this many continents.
 *
 * The Dominapedia's "Goals and Victory" page is the design this comes from, and
 * docs/archived/05-goals-and-victory.md is the phase that implemented it. Each condition now has a
 * TIER LIST as well as a default -- the goal chooser offers the tiers, and everything that
 * reads the single value keeps reading the default, so adding the tiers changed nothing.
 */
export const CONTINENTS_REQUIRED_FOR_VICTORY = 3;

/** What the chooser offers for CONTINENTAL. The default must be one of these. */
export const CONTINENTAL_TIERS = Object.freeze([2, 3, 4]);

/** Fraction of the world's land area a DOMINATION victory requires. */
export const DOMINATION_LAND_SHARE = 0.6;

/** What the chooser offers for DOMINATION. */
export const DOMINATION_TIERS = Object.freeze([0.4, 0.6, 0.8]);

/**
 * The turn a TURN_LIMIT game is scored on.
 *
 * This was 100 and is 200, because 100 was not a game. `tools/ai-sim.mjs` puts the largest
 * empire at roughly thirty territories of 359 after a hundred turns, so a game scored there
 * would end before anything decisive had happened and would be won by whoever happened to
 * have started biggest. The tiers below all sit above that measurement.
 */
export const VICTORY_TURN_LIMIT = 200;

/** What the chooser offers for TURN_LIMIT. */
export const TURN_LIMIT_TIERS = Object.freeze([200, 350, 500]);

/**
 * How many of the world's strongest countries a GREAT_POWERS victory asks you to break.
 *
 * The target set is the same five the country-selection screen locks -- `COUNTRY_GREYOUT_RANK`
 * in `ui.js` is the other half of that number and the two must agree. They are separate
 * because this module may not import the UI; the chooser is what reconciles them, freezing
 * the five names into the condition at the moment a game starts.
 */
export const GREAT_POWERS_REQUIRED = 5;

/** What the chooser offers for GREAT_POWERS: any three of the five, or all five. */
export const GREAT_POWERS_TIERS = Object.freeze([3, 5]);

/**
 * The dials `src/ai/doctrine.js` turns the active victory condition into.
 *
 * One row per goal, and the row is the ONLY place a goal's character is written down --
 * `strategy.js`, `theatre.js` and `targeting.js` read a doctrine and never ask which
 * condition is active, so a sixth goal is one entry here and no change to any of them.
 *
 * `continentsToCommit` feeds `chooseObjective()`; `Infinity` means "as many as the map has"
 * and is clamped there, and `null` means "whatever the condition itself asks for", which is
 * only CONTINENTAL. `areaHunger` is how much a target's raw LAND is worth on top of what
 * `territoryValue()` already says about it -- Domination and a Timed Game are both scored in
 * area, so they should prefer Russia to a Caribbean island in a way Continental Supremacy
 * should not. `neverSatisfied` says the goal has no resting point, which is what stops a
 * large empire under World Conquest settling into CONSOLIDATE for the rest of the game.
 */
export const goalDoctrines = Object.freeze({
    CONQUEST: { continentsToCommit: Infinity, areaHunger: 1, neverSatisfied: true },
    CONTINENTAL: { continentsToCommit: null, areaHunger: 0.2, neverSatisfied: false },
    DOMINATION: { continentsToCommit: 4, areaHunger: 0.8, neverSatisfied: false },
    ELIMINATION: { continentsToCommit: 2, areaHunger: 0.4, neverSatisfied: false },
    GREAT_POWERS: { continentsToCommit: 2, areaHunger: 0.3, neverSatisfied: false },
    TURN_LIMIT: { continentsToCommit: 3, areaHunger: 0.9, neverSatisfied: false }
});

/**
 * How a doctrine's `urgency` is derived, and what it is allowed to do.
 *
 * Urgency is the runaway-leader response: when one country is visibly winning, everybody
 * else fights harder. It is measured from the strongest RIVAL's share of the world's land
 * area rather than from `victoryProgress()` for every country, because the second is 207
 * calls per country per turn and the first is already counted in the one pass
 * `worldStandings()` makes. Area share is an honest proxy under every goal -- a country
 * running away with a Great Powers game is a country that is getting bigger.
 *
 * A Timed Game takes its urgency from the clock instead. There is nothing to conserve on
 * the last turn, and the deadline is the thing that actually ends that game.
 *
 * ONE TRAP, ALREADY PAID FOR ONCE: urgency scales the ATTACK budget and NEVER the siege
 * budget. The siege budget counting the sieges already running is what ended the
 * seventeen-to-sixty-seven concurrent sieges problem, and a multiplier over that cap walks
 * straight back into it.
 */
export const doctrineUrgency = {
    /** The rival land share at which urgency reaches 1. A third of the world is a runaway. */
    rivalShareForFull: 0.35,
    /** Urgency every country carries regardless, so an early game is not wholly placid. */
    floor: 0.1,
    /** The most urgency may multiply the attack budget by, at urgency 1. */
    attackBudgetBoost: 1.6
};

/**
 * What a doctrine's `targetCountries` is worth to the two modules that read it.
 *
 * `theatre.js` needs no number here: a named rival is a sort TIER above an unnamed one, not
 * a term in its score, because a great power is one of the strongest countries on the map
 * and no bias small enough to be a bias would ever lift it past a convenient small neighbour.
 * `targeting.js` uses `homelandWeight` on any territory whose `originalOwner` is a target
 * power -- which is what makes the goal survive a third party taking half of the United
 * States first: those territories are still the ones worth having, whoever holds them now.
 */
export const doctrineTargeting = {
    homelandWeight: 2.2,
    /**
     * Territory area treated as "a large territory" when `areaHunger` weighs one. The same
     * saturation `targetValueWeights` uses, so the two area terms speak the same units.
     */
    areaSaturation: MAX_AREA_THRESHOLD
};

/**
 * How wide a border into a continent counts as "I can get there", when a country is
 * choosing what to campaign for.
 *
 * THE TERM THAT MAKES THE CHOICE DYNAMIC. `continentAmbitionWeights.foothold` counts only
 * territories already HELD, so before this a continent across a shared border scored exactly
 * the same as one on the far side of the world -- and a country with no foothold anywhere
 * outside its own continent had its score collapse to `continentModifiers`, a static table.
 * Every power in the same position therefore committed to the same continent, which is a
 * fixed objective wearing the clothes of a derived one. Measured on the real map, a North
 * American power that had finished North America committed to EUROPE every time, which it
 * reaches through one territory, over South America, which it reaches through eleven.
 *
 * Counted in distinct adjacent ENEMY territories rather than in pairings, because pairings
 * measure how much of OUR border faces them and this question is about how much of THEIRS is
 * open to us.
 */
export const continentReachSaturation = 6;

/** How a continent is scored when a country is choosing what to campaign for. */
export const continentAmbitionWeights = {
    /** Weight on the share of the continent already held. Progress is the strongest signal. */
    share: 3,
    /** Flat bonus for having any foothold at all -- you cannot campaign for Antarctica from Peru. */
    foothold: 1.2,
    /** Weight on the continent's economic worth (`continentModifiers`). Europe beats Africa. */
    value: 1.5,
    /** Weight on how small the continent is. A 12-territory continent is a shorter war than a 60. */
    brevity: 1,
    /** Penalty weight on the strongest rival's share of the continent. */
    contest: 1.4,
    /**
     * Weight on how much of this continent this country can actually REACH -- saturating at
     * `continentReachSaturation` adjacent enemy territories.
     *
     * Heavier than `value` (1.5) on purpose, because it is the term that answers a different
     * question: `value` says what a continent is worth to own and this says whether owning it
     * is a plan at all. A country that cannot get to a continent does not campaign for it,
     * and the static table has to be able to lose to that.
     */
    reach: 2,
    /** Territory count treated as "a big continent" when scoring brevity. */
    brevityScale: 60
};

/**
 * How many sieges one country may have running at once, and how many it may open per turn.
 *
 * Measured before the campaign layer: the AI went from 17 to 67 concurrent sieges over
 * fourteen turns, most of them on a negative margin and therefore armies standing still
 * waiting to be arrested. A siege is now a scarce commitment, budgeted against how much
 * country there is to draw an army from.
 */
export const siegeDiscipline = {
    baseConcurrent: 1,
    territoriesPerExtraConcurrent: 14,
    maxConcurrent: 6,
    /** New sieges one country may OPEN in a single turn, whatever its standing budget. */
    maxOpenedPerTurn: 2,
    /**
     * Odds floor for a siege to be worth opening at all. Lower than an attack's, because a
     * siege is the answer to a target too strong to storm -- but not so low that the army
     * is simply parked in front of a fort forever.
     *
     * Lowered 22 -> 12 in combat stage 2, for the same reason as
     * `PROBABILITY_THRESHOLD_FOR_SIEGE` and in the same units: this is now a floor on the
     * chance of STORMING the place, and demanding a better than one-in-five chance of storming
     * before you may lay a siege asks the target to be nearly takeable already. Twelve keeps
     * the "parked in front of a fort forever" guard -- and `siegeReview.js` is the other half
     * of it, abandoning a siege that stops making progress.
     */
    minimumOdds: 12,
    /**
     * Percentage points a leader adds to the GAME's siege floor before it will lay one.
     *
     * This lived inside `setSiege()` as a bare switch, which made it a third odds gate that
     * nothing else in the AI could see: the planner approved a siege, the commitment sized an
     * army for it, `setSiege()` compared the odds against its own private number and returned
     * without doing anything. The turn's log said "going to start a siege attack on Belgium"
     * and no siege existed afterwards -- measured at eighty-seven decided and zero laid, every
     * turn for a hundred turns. Both places read this now, so a siege that is decided on is a
     * siege that happens.
     */
    leaderOddsModifier: { aggressive: -5, balanced: 10, pacifist: 15 }
};

/**
 * What a besieging country decides about a siege it ALREADY has, once a turn.
 *
 * Before this existed a siege was fire-and-forget: the rules ticked it, and the country
 * that laid it never looked at it again between the turn it opened and the turn it starved
 * out or was arrested. These are the numbers behind "press on, storm it, or go home".
 */
export const siegeReview = {
    /**
     * Turns of no visible progress the most patient leader will tolerate. `style_of_war`
     * moves it: low favours sieges, so a siege-minded leader waits `base + swing` turns and
     * one who would rather storm waits `base`.
     */
    basePatienceTurns: 4,
    /** How many further turns `style_of_war` at its most siege-minded adds to the wait. */
    patienceSwing: 4,
    /** Progress (0..1) below which a siege is judged to be achieving nothing. */
    stalledProgress: 0.15,
    /**
     * Progress at or above which the territory is falling by itself. Above this the army
     * is never recalled and never risked on an assault -- there is nothing left to win by
     * storming a garrison that will be gone next turn.
     */
    starvationImminent: 0.85,
    /**
     * Percentage points an assault must clear the campaign's ATTACK floor by before the
     * besiegers storm. A margin rather than the bare floor, because the besieging army has
     * no line of retreat: it is already committed, so a coin-flip assault loses it outright.
     */
    assaultOddsMargin: 12,
    /** Turns before a country that has gone onto the DEFEND posture recalls a besieging army. */
    defendRecallTurns: 2,
    /**
     * Turns after which a siege whose assault odds have fallen below the campaign's SIEGE
     * floor is abandoned -- the garrison has been reinforced or the besiegers worn down, and
     * an army that can no longer take the place is an army standing in a field.
     */
    hopelessAfterTurns: 3
};

/**
 * When a country's leader dies and a new one takes over. See `src/ai/succession.js`.
 *
 * A country's character was drawn once at the start of a game and never changed again, so a
 * cautious country stayed cautious for two hundred turns -- and because a stalemate between
 * two comparable neighbours is symmetric, nothing in the game could ever break one. Measured:
 * the largest empire reached 71 territories at turn 50 and was still on 71 at turn 150, while
 * the world's army tripled and its gold multiplied by five. **Everyone gets richer together,
 * so the ratio never moves.** A new leader with a different appetite for risk is one of the
 * few things that can shift it.
 *
 * The term is DERIVED from a hash of the country name rather than drawn, so it costs no
 * `Math.random` draw (which would move every seeded outcome in the game), needs no save slice,
 * and staggers the world's two hundred successions instead of pulsing them.
 */
export const leaderSuccession = {
    /**
     * Shortest a leader serves.
     *
     * FIFTEEN TO TWENTY, HALVED FROM THIRTY TO FORTY, and the halving is what makes a
     * succession the game's main source of change rather than a rare event. A term of
     * thirty-plus turns means a 150-turn game sees each country change its mind about four
     * times; at fifteen to twenty it is eight or nine, and since a succession now KEEPS the
     * long-term continent objective and clears only the medium and short term, what an heir
     * changes is how the war is fought rather than what it is for. That makes a shorter term
     * cheap: it re-decides the reversible half more often and never loses the plan.
     */
    minimumTermTurns: 15,
    /** Longest a leader serves. */
    maximumTermTurns: 20,
    /**
     * Nothing happens before this turn.
     *
     * The opening is when a leader's personality is doing the most work -- which continent it
     * commits to, whether it builds or expands -- and replacing one in the middle of that
     * reads as the plan being lost rather than changed.
     */
    firstPossibleTurn: 20
};

/** How many attacks one country may press per turn, and the odds each leader type demands. */
export const attackDiscipline = {
    /**
     * Attacks a country may press per turn, before its size and its posture scale it.
     *
     * TWO RATHER THAN ONE, because 85% of the countries on this map hold exactly ONE
     * territory (176 of 207) and `territoriesPerExtraAttack` therefore never fires for them:
     * at 1 they got a single attack a turn no matter what, so `attacksPerTerritory` below
     * would have been dead for the great majority of the world. A one-territory country can
     * now take a neighbour and, if what survives still clears the odds floor, go again --
     * which is the whole of what "play by the player's rules" means for a small country.
     */
    basePerTurn: 2,
    territoriesPerExtraAttack: 10,
    maxPerTurn: 5,
    /**
     * How many attacks ONE TERRITORY may press in a turn, before traits move it.
     *
     * THE PLAYER HAS ALWAYS HAD THIS AND THE AI HAD NOT. `doAiActions()` carried a bare
     * `//only one attack from any territory per turn`, so a province bordering three weak
     * enemies took one of them a turn however much army it had left standing afterwards --
     * and a breakthrough could never be exploited in the turn it was made.
     *
     * IT IS A CAP AND NOT A RATION: the force is NOT divided up in advance. Each attack is
     * sized against what the territory has left AFTER the previous one, by the same
     * `decideCommitment()` every other attack goes through, so the odds floor is what stops
     * the second and third. Dividing the army up front would be strictly worse and the
     * measurement says so plainly -- the battle is a STEP function, so two half-strength
     * attacks at 0.175:1 are 0% and 0% where one at 1.5:1 is 77%. Concentration beats
     * dispersion every time, and the sequential form gets the extra attacks without paying
     * for them.
     */
    baseAttacksPerTerritory: 1,
    /** How far `risk_taking` and `territory_expansion` together add to that. */
    attacksPerTerritorySwing: 2,
    /** Nothing may exceed this, whatever the leader: a territory is not an army group. */
    maxAttacksPerTerritory: 3,
    /**
     * Odds floor by leader type, before `style_of_war` shifts it. An aggressive leader will
     * press on unclear odds; a pacifist wants a clear favourite before committing.
     *
     * THE NUMBERS ARE UNCHANGED AND THEIR MEANING IS NOT. Until combat stage 1 these were
     * compared against `winProbability()`, and measured against the real map they corresponded
     * to real take probabilities of **0.1% / 3.5% / 37.1%** -- an aggressive leader's "floor"
     * was two thirds of the defender's strength, where it would take the territory one time in
     * a thousand. They are compared against `takeProbability()` now, so for the first time the
     * sentence and the number agree: a quarter, a third, a bit under a half.
     *
     * They were deliberately NOT retuned in the same change. Stage 1's measurement is that the
     * binding constraint moved: `needs-more-force` cancellations went from 17 a turn to ZERO,
     * and what the executor reports instead is "the most this territory can spare reaches only
     * 0%" -- a fact about the two armies and the terrain, not about these constants. Raising
     * them would make that worse; lowering them would licence attacks that genuinely cannot be
     * won. The dials that answer it are in stage 3. `node tools/combat-lab.mjs floors` is where
     * these are checked against the world.
     */
    minimumOdds: { aggressive: 25, balanced: 34, pacifist: 45 },
    /** How far `style_of_war` (0..1) may move that floor, in percentage points, either way. */
    styleOfWarSwing: 12
};

/**
 * How much of a garrison an AI territory commits to an attack. See `src/ai/commitment.js`.
 *
 * The numbers a leader's character actually shows up in. Everything above decides WHETHER to
 * fight; this decides what is sent, which is what the AI was getting wrong -- it planned
 * against a territory's whole garrison and then committed a figure derived from the average
 * threat facing the entire country.
 */
export const commitmentDiscipline = {
    /** Fraction of the local surplus a leader will march out with, before traits move it. */
    baseAppetite: { aggressive: 0.85, balanced: 0.7, pacifist: 0.55 },
    /** How far `style_of_war` (0..1) moves that appetite, either way. */
    styleSwing: 0.3,
    /** How far `territory_expansion` (0..1) moves it, either way. */
    expansionSwing: 0.2,
    minimumAppetite: 0.3,
    maximumAppetite: 1,
    /**
     * What an aggressive leader will still throw at a border where it is ALREADY outgunned.
     * Small, because the alternative to a bad attack is not a lost war, it is next turn.
     */
    recklessShare: 0.25,
    /**
     * How much of the strongest neighbouring enemy's army power a territory keeps at home.
     *
     * Below 1 because defending is the easier half of this game: the defender has the forts,
     * the mountains and the area bonus, and the attacker is scaled DOWN by its development
     * index. Holding a border therefore costs less than storming one, and that asymmetry is
     * the whole reason an attack can be afforded at all.
     */
    defenceKeepRatio: 0.5,
    /**
     * How far `risk_taking` (0..1) moves `defenceKeepRatio`, either way.
     *
     * THIS IS THE DIAL THAT UNSTUCK THE WORLD, and the measurement behind it is worth keeping.
     * A border territory kept `defenceKeepRatio` x the strongest enemy that could reach it and
     * marched out with `appetite` of the rest, so against a comparable neighbour it attacked at
     * **0.35:1** -- and 0.35:1 is a **0.0% chance of taking the territory on FLAT GROUND WITH
     * NO FORTS**, never mind a mountain. Inverted, the entry price to an attack was:
     *
     *     army needed  =  E x (ratio / appetite + keep)
     *     flat ground, 65% odds:   2.36x the neighbour's army
     *     mountain 3,  65% odds:   3.36x
     *
     * Between neighbours with similar economies that never happens, so nothing ever attacked
     * anything, and the executor said *"the most this territory can spare reaches only 0%"* on
     * 56 of 61 sampled decisions. **It was never the terrain** -- flat ground with no forts is
     * also 0% at the ratio a territory could actually send. It was this arithmetic.
     *
     * A high-risk leader now keeps `defenceKeepRatio - riskKeepSwing/2` and a cautious one
     * `defenceKeepRatio + riskKeepSwing/2`, so the world contains leaders who can break a
     * deadlock and leaders who cannot -- which is the point, and is why this is a TRAIT rather
     * than a lower constant for everybody.
     */
    riskKeepSwing: 0.5,
    /**
     * The keep-back floor, as a share of the territory's OWN army.
     *
     * A border held by nobody is a territory given away, whatever the leader's character, so
     * no combination of traits may empty a province. It is expressed against the garrison
     * rather than against the enemy because that is the quantity being protected.
     */
    minimumHomeShare: 0.1,
    /** What an interior territory -- nothing can reach it -- still keeps behind. */
    interiorReserve: 0.15,
    /**
     * The shares of the disposable force the sizing walks, smallest first. Coarse on purpose:
     * every rung costs a real probability calculation, and this runs for every attack every
     * country weighs every turn.
     */
    ladder: [0.35, 0.55, 0.75, 1],
    /**
     * The odds an attack aims for, over and above the floor its leader will fight on.
     *
     * The floor answers "is this worth doing at all"; this answers "how much do I send". They
     * are not the same question, and treating them as one was measurable: sizing to the
     * smallest force that merely cleared the floor made every battle in the world a 35%
     * battle, so two thirds of them were lost and conquests fell to nothing over a hundred
     * turns. An army that masses for a decisive result and skips the marginal fights takes
     * more ground than one that fights everything at even money.
     *
     * SIXTY-FIVE MEANT SOMETHING ELSE ENTIRELY UNTIL COMBAT STAGE 1. Compared against
     * `winProbability()` it corresponded to a raw force ratio of **3.91:1 and a 94.1% real
     * chance** -- so on almost every border in the world it could not be reached, the attack
     * was cancelled as `needs-more-force`, and the country filed a requisition instead of
     * fighting. Measured on one turn before the fix: 17 of 48 commitment decisions ended that
     * way, one of them refused at 63% for being "2 points short". Against `takeProbability()`
     * the same 65 means a 65% chance of taking the place, which is what the paragraph above
     * has always described, and those 17 cancellations went to ZERO in the stage 1 run.
     *
     * So the value is unchanged and the defect is closed, which is the whole shape of stage 1:
     * the constants were mostly reasonable sentences denominated in the wrong currency.
     */
    decisiveOdds: 65
};

/**
 * Moving an army to where the war is. See `src/ai/muster.js`.
 *
 * The capability the AI never had: every attack in the game was fought with whatever the one
 * territory on the border could raise by itself, while the provinces behind it sat out the
 * whole game. These numbers decide how much of an interior garrison marches, and how long a
 * front-line territory's request for reinforcement stands.
 */
export const musterDiscipline = {
    /** Fraction of a territory's surplus infantry that marches out to a neighbour. */
    share: 0.6,
    /** Fewer than this many infantry is not worth a march. */
    minimumMove: 25,
    /**
     * How much of the strongest neighbouring enemy's power a territory keeps before it will
     * send any army away. Higher than the attack commitment's `defenceKeepRatio`, because
     * reinforcing elsewhere is worth less than holding here.
     */
    keepAgainstNeighbour: 0.8,
    /** A flat cushion on top of that, so a border level with its enemy still sends nothing. */
    comfortMargin: 200,
    /** Turns a request for reinforcement stands before it is assumed to have gone stale. */
    demandMemoryTurns: 4
};

/** What a candidate target is worth, before the odds of taking it are applied. */
export const targetValueWeights = {
    continentModifier: 0.4,
    devIndex: 0.3,
    area: 0.2,
    resources: 0.1,
    /** Area at which the area term saturates. Matches the combat area cap. */
    areaSaturation: MAX_AREA_THRESHOLD
};

/**
 * How much the campaign multiplies a target's value by, according to where it sits.
 *
 * `offContinent` below 1 is what "pick your battles" means in practice: a territory that
 * does nothing for the objective has to be considerably better odds, or considerably more
 * valuable, before it outranks one that does.
 */
export const campaignTargetWeights = {
    focusContinent: 2.5,
    committedContinent: 1.6,
    offContinent: 0.5,
    /**
     * Multiplier when taking this territory would leave the continent nearly complete.
     * Scaled by how few territories are left: the last one is worth far more than the tenth.
     */
    completionBonus: 3,
    /** Multiplier applied to a territory this country originally owned, times `reconquista`. */
    reconquista: 1.5,
    /** Multiplier for a territory that is already besieged by this country's enemies. */
    opportunism: 1.25
};

/**
 * The four postures, and what each one does to the turn's spending and appetite.
 *
 * `fortShare` is the fraction of a Bolster goal's gold that goes on forts before the rest
 * is spent on units -- a defending country builds walls, an expanding one builds armies.
 * `siegeBudgetScale` and `attackBudgetScale` scale the budgets above.
 */
export const campaignPostures = {
    DEVELOP: { economyBias: 1, defenceBias: 0.7, offenceBias: 0.35, fortShare: 0.45, siegeBudgetScale: 0.35, attackBudgetScale: 0.4, upgradeScale: 1.6 },
    EXPAND: { economyBias: 0.5, defenceBias: 0.6, offenceBias: 1, fortShare: 0.3, siegeBudgetScale: 1, attackBudgetScale: 1, upgradeScale: 1 },
    CONSOLIDATE: { economyBias: 0.7, defenceBias: 0.85, offenceBias: 0.8, fortShare: 0.5, siegeBudgetScale: 0.7, attackBudgetScale: 0.9, upgradeScale: 1.2 },
    DEFEND: { economyBias: 0.6, defenceBias: 1, offenceBias: 0.25, fortShare: 0.8, siegeBudgetScale: 0.2, attackBudgetScale: 0.3, upgradeScale: 0.8 }
};

/** The thresholds that choose a posture. Stated rather than tuned; each says what it means. */
export const postureThresholds = {
    /** Fraction of a country's own territories under siege that forces DEFEND. */
    besiegedShareForDefend: 0.2,
    /** Development (built upgrades as a fraction of the maximum) below which it DEVELOPs. */
    developmentForDevelop: 0.22,
    /** Share of the focus continent above which it CONSOLIDATEs rather than opening new fronts. */
    focusShareForConsolidate: 0.75,
    /**
     * A country this small builds its first farms before it picks a fight -- but ONLY while
     * it is also undeveloped. It used to be an `||`, and that one character froze the world:
     * this map begins as 207 countries of which the great majority own one or two
     * territories, so "smaller than three territories" disqualified ~93% of the world from
     * expanding, and being disqualified from expanding is precisely what kept them small.
     * Measured over a hundred turns: 204 countries at turn 1, 163 at turn 100, the largest
     * empire unchanged at 30 territories, and 153 of 165 countries in DEVELOP on turn 20
     * with a mean development of 0.355 -- well clear of the 0.22 that posture is meant to
     * describe. See tools/ai-sim.mjs, which is the instrument that found it.
     */
    smallCountryTerritories: 3,
    /**
     * Turns a country will keep DEVELOPing without its development materially improving
     * before it concludes that building is not the way out and fights instead.
     *
     * This is the economic half of "recognise a failed approach". A country whose income
     * cannot buy the next upgrade -- besieged, tiny, or squeezed onto poor ground -- would
     * otherwise develop for the rest of the game, because the posture that produced the
     * failure is the posture the failure keeps it in.
     */
    developStallTurns: 8,
    /** Development gained per turn that counts as the approach WORKING rather than stalling. */
    developProgressPerTurn: 0.008
};

/**
 * The MID-TERM goal: which neighbouring country a power is currently trying to absorb, and
 * when it gives up on it.
 *
 * The long term is the victory condition and the short term is this turn's goal list. What
 * was missing between them is the thing a human plays: "I am taking Belgium, and if Belgium
 * turns out to be a wall I will take Denmark instead and come back to Belgium later." Without
 * it a country spreads one attack a turn across every neighbour it can reach, takes the free
 * ones in the first ten turns and then grinds against defended borders forever -- which is
 * exactly what the hundred-turn measurement showed.
 */
export const theatreCommitment = {
    /**
     * Turns a war that has produced NOTHING yet is given before the rival is written off.
     * Longer than `stallTurns` on purpose: a new plan deserves more room to get going than a
     * stalled one deserves to restart.
     */
    reviewInterval: 6,
    /** Turns since the LAST territory taken from the rival before the war counts as stalled. */
    stallTurns: 5,
    /** Attacks lost against the rival before it counts as a wall, whatever the clock says. */
    failuresBeforeWall: 3,
    /**
     * How long a country stays written off as a wall.
     *
     * It decays rather than being permanent, because the reason it was a wall -- their forts,
     * our army -- is a fact about a moment. A country that has since built an army should try
     * again; one that has not should not keep throwing itself at the same border.
     */
    wallMemoryTurns: 15,
    /** Multiplier on a target belonging to the country this power has committed to absorbing. */
    rivalWeight: 2,
    /** Multiplier on a target belonging to a rival written off as a wall. */
    wallWeight: 0.4,
    /** How a candidate rival is ranked. Each term is a sentence in `rankRivals()`. */
    weights: {
        /** Weight on how much of our frontier this rival occupies -- the war we are already in. */
        frontage: 1.4,
        /** Weight on how weak the rival's border territories are against ours. */
        weakness: 2.2,
        /** Weight on the worth of what taking them would win. */
        value: 1.2,
        /** Bonus for a rival sitting on the continent we have committed to finishing. */
        onFocusContinent: 1.5,
        /** Penalty weight on how large the rival is -- a giant is a war, not an absorption. */
        size: 0.9,
        /** Territory count at which the size penalty saturates. */
        sizeScale: 12
    }
};

/**
 * WHEN A COUNTRY DECLARES WAR, and how many wars it will open at once.
 *
 * Read by `src/ai/diplomacy.js` and by nothing else. Diplomacy checklist stage 3.
 *
 * THE THEATRE DECLARATION IS NOT ON THIS TABLE, AND THAT IS THE FREEZE GUARD.
 * `theatre.js` already commits a country to absorbing ONE neighbour and keeps the
 * commitment until the rival becomes a wall -- that commitment IS the country's answer to
 * "who is my enemy", so it becomes a declaration unconditionally: no posture may refuse it,
 * and `concurrentWarCap` does not apply to it. Everything below bounds the OPPORTUNISTIC
 * declarations that sit on top of it.
 *
 * The reason for that split is known-issue BA, which this phase can reproduce exactly. A
 * posture rule that disqualified 93% of the world from expanding froze the map at 163
 * countries with the largest empire never passing 30, and nothing threw. `postureAllowance`
 * below has that shape, so if it governed the theatre war as well, a world in which most
 * countries sit in DEVELOP or DEFEND would simply never declare on anybody and would look
 * identical to stage 2's deliberate silence.
 */
export const declarationDiscipline = {
    /**
     * Extra wars a country will OPEN in one turn on top of its theatre war, by posture.
     *
     * A country that is developing or defending opens no new front by choice; one that is
     * expanding will take a second if a neighbour is visibly weak. These are small numbers
     * on purpose -- a war never ends in the game as it stands (peace is stage 5), so every
     * declaration is permanent and a generous allowance would put the whole map back into
     * the undeclared all-out war this phase exists to replace, inside twenty turns.
     */
    postureAllowance: {
        DEVELOP: 0,
        DEFEND: 0,
        CONSOLIDATE: 1,
        EXPAND: 1
    },
    /**
     * How many countries this one may be at war with before it opens no MORE opportunistic
     * wars. The theatre war is exempt, so a country is never left with no enemy at all.
     */
    concurrentWarCap: 3,
    /**
     * How much stronger our border has to be than theirs before a war is worth starting for
     * its own sake. `weakness` in `rankRivals()` is `ourArmy / (ourArmy + theirArmy)` over
     * the shared frontier, so 0.5 is parity and this is comfortably above it: an
     * opportunistic war is one a country expects to win, and the ones it merely hopes to win
     * are what the theatre commitment is for.
     */
    opportunistWeakness: 0.62,
    /**
     * A leader below this `risk_taking` makes no opportunistic declaration at all.
     *
     * A pacifist (0.0-0.4) still fights the war their country has committed to and still
     * defends itself; what they will not do is start a second one because a neighbour looks
     * weak. That is the difference the trait is for, and it is why this is a trait gate
     * rather than a lower allowance for everybody.
     */
    opportunistRiskFloor: 0.35,
    /**
     * `urgency` at or above which a country gets one further opportunistic declaration.
     *
     * `doctrine.js` computes urgency as the strongest rival's share of the world's land, so
     * this is the diplomatic form of the runaway-leader response the attack budget already
     * has: when somebody is winning, the rest of the world starts more wars.
     */
    urgencyForExtra: 0.7
};

/**
 * WHETHER A COUNTRY WILL AGREE TO STOP FIGHTING, and how long a ceasefire runs.
 *
 * Read by `src/ai/diplomacy.js` and by nothing else. Diplomacy checklist stage 5.1.
 *
 * WHY THIS MATTERS MORE THAN THE DECLARATION TABLE ABOVE IT. Stage 3 measured a world in
 * which a war, once declared, could never end: pairs at war climbed 536 -> 749 across a
 * 150-turn run under every goal, which is the map walking back towards the permanent
 * undeclared war this whole phase exists to replace. A declaration rule with no matching
 * peace rule is a ratchet. These dials are the pawl coming off it.
 *
 * THE THEATRE RIVAL IS THE ONE COUNTRY A PEACE CANNOT BE BOUGHT FROM, and that is what
 * keeps the register meaningful. `theatre.js` commits a country to absorbing ONE neighbour
 * and keeps the commitment while it takes ground; if that war could be ended by asking, the
 * mid-term goal would be a suggestion. A CEASEFIRE is still available from a theatre rival
 * that is losing, which is the deliberate escape: a country that is being beaten wants a
 * breather, and that is exactly the moment a player most wants to buy one.
 */
export const peaceDiscipline = {
    /**
     * How many turns a ceasefire runs before it lapses back to whatever it was signed out
     * of. Long enough to be worth having -- a besieged front can be rebuilt in fifteen
     * turns -- and short enough that it is a breathing space rather than a peace by
     * another name, which is what the peace itself is for.
     */
    ceasefireTurns: 15,
    /**
     * The score a proposal has to reach to be accepted, before the kind's own allowance.
     * The terms below are all in the same currency and each says one thing about the
     * country being asked.
     */
    acceptThreshold: 1.0,
    /**
     * A CEASEFIRE IS THE CHEAP ONE AND IS MEANT TO BE. The design's own words: *"a
     * ceasefire is the cheap version and the AI should reach for it first."* It expires,
     * so agreeing to one costs a country far less than agreeing never to fight again.
     */
    ceasefireAllowance: 0.6,
    /** Weight per OTHER war this country is fighting. Two fronts is the classic reason. */
    perOtherWar: 0.45,
    /** Capped, so a country at war with nine neighbours is not automatically a pushover. */
    maxOtherWarWeight: 1.5,
    /** Weight for a posture that is not looking for a fight (DEFEND or DEVELOP). */
    defensivePosture: 0.8,
    /**
     * Weight per attack this country has LOST against the proposer since committing.
     * `theatre.js` already counts them, and losing is the most legible reason to want out.
     */
    perFailure: 0.35,
    /** Cap on the above, for the same reason `maxOtherWarWeight` is capped. */
    maxFailureWeight: 1.05,
    /**
     * How far a leader's `risk_taking` moves the answer, around the 0.5 that is neither
     * warlike nor peaceable. A pacifist (0.0-0.4) leans towards yes and an aggressive
     * leader (0.6-1.0) leans away, which is what makes WHO is in charge worth knowing.
     */
    riskSwing: 1.2,
    /**
     * Weight on `doctrine.urgency` -- the strongest rival's share of the world's land.
     *
     * THIS IS THE MECHANISM BEHIND LEIGH'S STATED GOAL FOR THE PHASE, *"countries will work
     * together to overcome adversaries"*, and it arrives one handshake at a time: when
     * somebody is running away with the game, everybody else becomes readier to stop
     * fighting each other. The same number already raises the attack budget, so a runaway
     * leader gets attacked harder AND finds the rest of the world less busy with itself.
     */
    urgencyWeight: 0.7,
    /**
     * Weight against a proposal from a country this one is much LARGER than. Agreeing not
     * to fight somebody you are beating is what a country does not do, and without this
     * term the strongest empire on the map signs peace with everybody it is about to eat.
     */
    strongerRefusal: 0.9,
    /** Territory ratio at or above which `strongerRefusal` applies in full. */
    strongerRatio: 2.0,
    /**
     * How badly a theatre rival has to be doing before it will take a ceasefire: attacks
     * lost against the proposer, from the same ledger `perFailure` reads.
     */
    theatreCeasefireFailures: 2,
    /**
     * Turns before the same pair may be asked again after a refusal.
     *
     * A player who can ask every turn until the dice fall their way is not negotiating,
     * they are rerolling -- and an AI asking every turn would fill the news with the same
     * sentence. The memory is per pair per proposal kind.
     */
    proposalCooldown: 8
};

/**
 * WHO WILL SIGN AN ALLIANCE, AND WHAT ONE IS WORTH.
 *
 * Read by `src/ai/diplomacy.js` and by the economy context. Diplomacy checklist stages
 * 5.2 to 5.5.
 *
 * AN ALLIANCE IS THE ONLY AGREEMENT THAT GIVES SOMETHING RATHER THAN MERELY WITHHOLDING
 * SOMETHING. Peace and a ceasefire are both promises not to do a thing. An alliance pays --
 * income, capacity, reach and sight -- and that is what makes it worth the risk of being
 * called into somebody else's war, which is the whole design in Leigh's §3.4.
 *
 * IT IS A MUTUAL DIVIDEND AND NOT A TRANSFER, and that is a decision rather than a
 * simplification. The design asks for "a standing share of income"; a share taken from one
 * treasury and put in another has to be written onto a territory, and a stored transfer needs
 * an EXACT INVERSE WRITE the moment the alliance ends -- which is the silent bug
 * `continentBonus.js` exists to prevent, and the class of defect (known-issue BJ, the
 * free-attack bug) that has cost this project the most. So both allies simply earn more while
 * the alliance stands, derived at the point of use and stored nowhere, and the instant it
 * ends the multiplier is 1 again with nothing to unwind.
 *
 * SYMMETRIC, WHICH ANSWERS Q5. A percentage of a flow is worth more in absolute gold to the
 * larger ally, which is Leigh's standing rule about balance -- being large stays an advantage
 * -- while the smaller ally gets the larger proportional lift, which is the nudge. A rule
 * that made the strong subsidise the weak would be the "price each upgrade against the
 * territory's own income" idea that was proposed and turned down for the economy.
 */
export const allianceShare = {
    /** Multiplier on GOLD INCOME per ally, as a fraction: 0.10 is +10%. A FLOW. */
    gold: 0.10,
    /**
     * Multiplier on the three CEILINGS per ally -- oil, construction materials and food.
     *
     * Smaller than the gold figure and deliberately so: the economy phase established that a
     * ceiling compounds into gold a few turns later while gold compounds into nothing, which
     * is why `CONTINENT_BONUS_GOLD` and `CONTINENT_BONUS_CAPACITY` are two dials rather than
     * one. The same asymmetry applies here.
     */
    capacity: 0.06,
    /**
     * How many allies count towards the economic benefit.
     *
     * Without a cap, an alliance web is a runaway: every signature raises the income of
     * everybody in it, which pays for the army that wins the game. Three is enough for an
     * alliance to be worth having and few enough that a coalition against a runaway leader is
     * a military fact rather than an economic one.
     */
    maxAllies: 3
};

/**
 * WHETHER A COUNTRY WILL ALLY, AND WHETHER IT WILL ANSWER A CALL TO ARMS.
 *
 * `urgency` -- the strongest rival's share of the world's land, already computed every turn
 * by `doctrine.js` -- is the input the alliance rule was always going to want, because it is
 * already the "somebody is running away with it" signal. This is where Leigh's stated goal
 * for the whole phase finally arrives in full: *"the eventual idea is that countries will
 * work together to overcome adversaries."*
 */
export const allianceDiscipline = {
    /** The score an alliance proposal has to reach. Higher than a peace: it costs more. */
    acceptThreshold: 1.6,
    /**
     * The `urgency` at which a country starts LOOKING for an ally rather than merely
     * accepting one that asks.
     *
     * It is a gate rather than a term because seeking is a different act from agreeing: a
     * country asked to ally weighs six things, and a country that goes out and asks has
     * decided there is something to be afraid of. Below this it tidies up its own wars
     * instead, which is `planAgreementOffer()`'s other branch.
     */
    seekAllyUrgency: 0.55,
    /**
     * Weight on `urgency`. The heaviest term by a distance, because a country with nothing to
     * fear has no reason to tie itself to somebody else's wars.
     */
    urgency: 1.8,
    /**
     * Weight per enemy the two already have IN COMMON, capped by `maxSharedEnemyWeight`.
     *
     * The most legible reason two countries ally, and the one the design names: at high
     * urgency a country seeks an alliance with a neighbour who is ALSO threatened by the same
     * leader. It is cheap to ask -- both war lists are already in the register.
     */
    perSharedEnemy: 0.5,
    maxSharedEnemyWeight: 1.5,
    /** Weight per ally the asked country already has, NEGATIVE: a web has diminishing worth. */
    perExistingAlly: -0.45,
    /** How far the leader's `risk_taking` moves it, around 0.5. Cautious leaders ally. */
    riskSwing: 1.0,
    /**
     * Weight against allying with somebody far smaller. An alliance with a country that
     * cannot help you is a promise to fight their wars for nothing.
     */
    strongerRefusal: 0.8,
    strongerRatio: 3.0,

    /**
     * THE CALL-IN. When a party to an alliance goes to war, its ally is ASKED to join --
     * never enrolled, and nothing cascades. See the design document's §3.4.
     */
    callIn: {
        /** The score a call to arms has to reach before an AI ally answers it. */
        acceptThreshold: 1.0,
        /** Weight on urgency: a shared fear is what makes an ally turn up. */
        urgency: 1.2,
        /** Weight when the ally is ALREADY at war with the adversary. Nothing is risked. */
        alreadyFighting: 2.0,
        /** Weight when the alliance partner is the one being ATTACKED rather than attacking. */
        defensive: 0.8,
        /** Weight per war the ally is already fighting, NEGATIVE. */
        perExistingWar: -0.3,
        /** How far `risk_taking` moves it. An aggressive leader answers a call to arms. */
        riskSwing: 1.0,
        /** Weight against joining a war on a country far larger than the ally. */
        strongerAdversary: 0.9,
        strongerRatio: 3.0
    }
};

/**
 * WHAT BREAKING AN AGREEMENT COSTS. Diplomacy checklist stage 5.6.
 *
 * Leigh: *"a very large penalty indeed if broken"* -- narrowed by §3.4 to exactly ONE act.
 * There are three ways an alliance can end and only this one is a breach:
 *
 *   an ally DECLINES A CALL-IN     free, both sides. Both of them decided
 *   both agree to DISSOLVE it      free, both sides. Both of them agreed
 *   one side WALKS OUT, or declares war on its own ally     THE FULL PENALTY
 *
 * THE ASYMMETRY IS THE WHOLE DESIGN, and it is what makes it safe to make the penalty large.
 * A country that wants out of an alliance has a free, honest route available every single
 * turn -- propose dissolution -- so choosing the breach instead is a choice to be TREACHEROUS
 * rather than a choice to be free, and the price is set against that rather than against
 * wanting to leave.
 *
 * **Q4 IS ANSWERED HERE AND THE PENALTY IS REPUTATIONAL ONLY.** There is no fine, and that is
 * a decision rather than an omission. A gold penalty is a number nobody can calibrate -- what
 * is a treaty worth in gold? -- and it would fall hardest on the countries least able to
 * absorb it, which is backwards. What the reputation costs instead is DERIVED and therefore
 * self-calibrating: a breach drops every OTHER agreement the betrayer holds, and an alliance
 * pays a standing share of income, so tearing one treaty up is paid for in the dividends of
 * all the rest. The material cost falls out of the reputational one and needs no dial.
 */
export const betrayalPenalty = {
    /**
     * How long the treachery mark lasts, by what was broken.
     *
     * An alliance costs most, a peace less, a ceasefire least -- which is the ordering the
     * design asks for, and it is the same ordering as how hard each was to get. Leaving
     * NEUTRAL is not on this table at all, because nothing was promised.
     *
     * It DECAYS rather than being permanent, the way `theatreCommitment.wallMemoryTurns` does
     * and for the same reason: "they tore up a treaty on turn 12" stops being the most useful
     * thing to know about a country forty turns later, and a permanent exclusion would make a
     * single betrayal an unrecoverable game state.
     */
    treacheryTurns: {
        alliance: 25,
        peace: 15,
        ceasefire: 10
    },
    /**
     * Does a breach drop the betrayer's OTHER agreements to neutral?
     *
     * Yes, and this is the heart of the penalty: nobody keeps a treaty with somebody who has
     * just torn one up. It is also what makes the cost proportional to what the betrayer had
     * -- a country with one peace loses little, and a country at the centre of an alliance web
     * loses the web and the income that came with it.
     *
     * A dial rather than a fact because it is the single most consequential line here, and one
     * that a measurement might argue with: it is the difference between a betrayal being a
     * setback and being a catastrophe.
     */
    dropsOtherAgreements: true
};

/**
 * HOW A COUNTRY FEELS ABOUT YOU SPECIFICALLY, AND WHAT IT IS WORTH.
 *
 * Read by `src/ai/opinion.js`, and through it by the three acceptance scores and by
 * `rankRivals()`. See `docs/archived/08-opinion.md` for the five decisions behind these numbers.
 *
 * WHAT IT IS FOR. Every diplomatic term in this file before it is a PRESENT-TENSE FACT about
 * the world -- how many wars a country is fighting, what its posture is, how big it is next to
 * you, how alarmed it is by the runaway leader, who is in charge of it this decade. Not one is
 * a memory of what the two of you have done to each other, which is why taking a province off
 * a country changed its army, its income and its posture and changed nothing at all about how
 * it felt toward you. Opinion is that missing word.
 *
 * IT IS A TERM AND NEVER A GATE, which is the one rule here that is not a matter of taste.
 * A rule that can REFUSE is a rule that can freeze the world -- known-issue BA, where a
 * posture check disqualified 93% of the map from expanding and cost a hundred turns of
 * measurement to find, because nothing throws and every turn completes. A term added to a
 * score cannot do that whatever value it takes.
 *
 * NOTHING HERE DRAWS RANDOMNESS. `src/ai/diplomacy.js` draws none, which is why no diplomatic
 * decision in this game can move a seeded outcome, and an opinion with a random component
 * would put the whole layer on the game's stream.
 */
export const opinionDiscipline = {
    /**
     * The end of the scale, in both directions. An opinion is clamped to this either way.
     *
     * A hundred because it is the scale the player is SHOWN -- the tooltip's bar runs -100 to
     * +100 -- and a rule whose internal units differ from its displayed ones is a rule that
     * will eventually be displayed wrongly.
     */
    range: 100,
    /**
     * WHERE AN OPINION SETTLES, BY THE STANDING RELATIONSHIP, and this is the decision the
     * whole mechanic hangs off.
     *
     * Everything decays toward the value its own state implies rather than toward zero, and
     * that buys three things no set of hooks would. "A maintained peace warms a relationship"
     * costs no hook at all -- it is what a resting point above zero MEANS. An opinion never
     * drifts to neutral while the shooting continues, where decay-to-zero would have a
     * fifty-turn war and a fifty-turn peace arrive at the same number. And it answers the
     * ratchet warning STRUCTURALLY: diplomacy stage 3 shipped declarations with no peace rule
     * and watched pairs at war climb 536 to 749 across a run, and a grudge that only grows is
     * that same mistake in new clothes. Here the pawl is not a rule, it is the shape of the
     * thing -- everything returns to where the relationship says it belongs.
     *
     * THIS DOES NOT DOUBLE-COUNT THE STATE in the acceptance score, because that score has no
     * term for the state at all: `canPropose()` gates on it and nothing weighs it.
     */
    resting: {
        noContact: 0,
        neutral: 0,
        war: -40,
        ceasefire: 10,
        peace: 25,
        alliance: 50
    },
    /**
     * The fraction of the distance to the resting point closed each turn.
     *
     * 0.06 is a half-life of about eleven turns, which is deliberately shorter than a leader's
     * 15-20 turn tenure: a grudge should be capable of outliving whoever earned it (it
     * survives a succession untouched) without being the only thing that ever explains a
     * country's behaviour fifty turns later.
     */
    settleRate: 0.06,
    /**
     * WHAT MOVES IT. Every one of these already passes through exactly one door, which is what
     * makes the layer affordable -- most are DERIVED from `DIPLOMACY_CHANGED` and
     * `TERRITORY_CHANGED`, the same two events the activity feed derives its news from, and
     * for the same reason: there are eight places that take a territory, and a list of eight
     * hooks is one new attack route away from being wrong.
     *
     * The magnitudes are set against the settle rate rather than against each other: a single
     * conquest is roughly four turns of settling, so a war of conquest outruns the pull toward
     * the resting point while an isolated raid does not.
     */
    events: {
        /** Somebody declared war on you. Felt by the victim only -- the declarer chose it. */
        declaredWar: -30,
        /** They took a province. Scaled by `reconquista`; see `reconquistaSwing`. */
        conquest: -25,
        /** An army sat down outside one of your cities. */
        siegeLaid: -15,
        /** An attack came in and was thrown back. Small, and felt BOTH ways. */
        failedAttack: -8,
        /** The shooting stopped. */
        ceasefireAgreed: 10,
        /** It stopped for good. */
        peaceAgreed: 18,
        /** You signed. */
        allianceAgreed: 25,
        /**
         * They answered your call to arms.
         *
         * The largest positive in the table, because it is the largest thing one country can
         * do for another in this game: an ally that turns up is taking on a war it had no
         * part in starting.
         */
        callAnswered: 35,
        /** They did not. Felt both ways -- one is let down, and the other knows it. */
        callRefused: -30,
        /**
         * They tore up an agreement with you.
         *
         * The largest number in the table in either direction, and PERSONAL where the existing
         * treachery mark is global: a country that betrays Spain is refused by everybody, and
         * until now Spain was no angrier about it than Chile.
         *
         * IT HAS TO CLEAR THE RESTING POINT IT IS FALLING FROM, which is why it is nearly
         * three times `declaredWar` rather than merely larger than it. A betrayal is by
         * definition committed out of an AGREEMENT, and an agreement rests warm -- an
         * alliance at +50. At -60 the victim of a betrayed alliance landed on -10, which is
         * MILDER than being declared on out of neutral, and a unit test caught it. From
         * alliance this lands at -35, from a peace at -60 and from a ceasefire at -75: worse
         * than any declaration from any state, which is the ordering the whole betrayal
         * penalty rests on.
         */
        betrayal: -85
    },
    /**
     * HOW MUCH `reconquista` SCALES A CONQUEST, either side of the 0.5 that is neither.
     *
     * The one trait that scales an event, and it is the trait for exactly this: how much a
     * country wants lost territory back. At 0.5 the multiplier is 1, at 1.0 it is 1.5 and at
     * 0.0 it is 0.5. Read at the moment the territory changes hands, so a later succession
     * does not re-price a grudge already formed.
     */
    reconquistaSwing: 1.0,
    /**
     * WHAT AN OPINION IS WORTH TO EACH RULE THAT READS IT, per point.
     *
     * Multiply by `range` for the swing at the extremes: 1.4 either way on a peace against a
     * threshold of 1.0, 1.8 on an alliance against 1.6, 1.6 on a call to arms against 1.0. In
     * every case that is enough for a full grudge to sink an offer on its own and for full
     * warmth to carry one on its own, which makes opinion the heaviest single input in each
     * rule -- the intent behind the brief's "70% opinion", expressed as a term rather than as
     * a percentage so that every existing threshold survives and the `ai-sim` table stays
     * comparable across the change.
     *
     * ALLIANCE IS THE HEAVIEST because you ally with people you like; the call to arms is next
     * because you turn up for them.
     */
    weights: {
        /** Per point, on a peace or a ceasefire. */
        peace: 0.014,
        /** Per point, on an alliance. */
        alliance: 0.018,
        /** Per point, on a call to arms. */
        callIn: 0.016,
        /**
         * Per point, on `rankRivals()` -- and this one is a SUBTRACTION, so a disliked
         * neighbour is a more attractive thing to absorb and a liked one is less.
         *
         * 1.0 at the extremes, against weakness 2.2 and onFocusContinent 1.5. Large enough to
         * pick a grudge over a slightly softer target and too small to pick one over a target
         * that is genuinely open, which is the balance the goal's own `preferredRivals` tier
         * had to be built as a TIER to achieve -- the difference being that a grudge, unlike a
         * great power, is not systematically one of the strongest countries on the map.
         */
        theatre: 0.010
    },
    /**
     * THE MINIMUM OPINION WORTH NAMING IN THE SENTENCE THE PLAYER READS.
     *
     * `reasonFrom()` names only the terms that argued the way the answer went, and only those
     * over 0.15 in weight -- this is the same idea in opinion's own units, so a pair fifteen
     * points off neutral is not described as bearing a grudge.
     */
    notableFrom: 20
};
