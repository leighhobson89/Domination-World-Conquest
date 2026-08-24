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

/** Productive-population cost to buy one unit -- the people who crew it. */
export const armyProdPopPrices = {
    infantry: INFANTRY_IN_A_TROOP,
    assault: 1000,
    air: 5000,
    naval: 20000
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
/** Gold a unit costs to maintain per turn. */
export const armyCostPerTurn = {
    infantry: 0.00005,
    assault: 0.05,
    air: 0.25,
    naval: 1
};

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

/** Base gold price of one upgrade. The Nth of a kind costs N times this. */
export const territoryUpgradeBaseCostsGold = {
    farm: 200,
    forest: 200,
    oilWell: 1100,
    fort: 1000
};

/** Base construction-materials price of one upgrade. */
export const territoryUpgradeBaseCostsConsMats = {
    farm: 500,
    forest: 500,
    oilWell: 200,
    fort: 600
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

/** Gold income. */
export const goldIncome = {
    /** Territory area is divided by this before being used as a multiplier, floored at 1. */
    areaDivisor: 10000000,
    /** Fraction of the productive population that earns. */
    productivePopRate: 0.1,
    /** Applied after the log-scaling division. */
    scale: 0.2,
    /**
     * The raw figure is normalised onto this window and then multiplied by 100. Lowering
     * `min` lifts small countries; raising `max` pushes large ones down.
     */
    normaliseMin: -800,
    normaliseMax: 1000
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

/** A battle is five rounds; the skirmishes are spread evenly across them. */
export const BATTLE_ROUNDS = 5;

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

/**
 * Ceiling on a single skirmish's win chance for the attacker. Without it a lopsided
 * probability plus a favourable matchup would make an attack a formality.
 */
export const SKIRMISH_ODDS_CAP = 0.65;

/**
 * Thresholds against each side's combined force AT THE START of the war, checked once the
 * five rounds are done and neither army is wiped out.
 *
 * audit 5.1 E: all three used to be compared against the ATTACKER's starting force, so
 * battles resolved at the wrong moment whenever the two armies differed in size.
 */
export const battleOutcomeThresholds = {
    /** Defender below this fraction of its starting force is routed; territory is taken. */
    defenderRout: 0.05,
    /** Defender below this is one push from breaking -- "last push", at a cost. */
    defenderLastPush: 0.15,
    /** Attacker below this fraction of its starting force is routed instead. */
    attackerRout: 0.1
};

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

// --- sieges ----------------------------------------------------------------

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

/** Below the lowest band, this is the chance the besieging force is arrested outright. */
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
 * Below these odds an attack is not worth mounting as a siege -- for the AI when it plans a
 * goal, and for the player's attack window, which is where it lived until Phase 5.5 (it was
 * declared in `ui.js`, which is what made `ai/goals.js` import the UI).
 */
export const PROBABILITY_THRESHOLD_FOR_SIEGE = 15;

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
