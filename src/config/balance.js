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

// --- ai strategy -----------------------------------------------------------
//
// The numbers behind the AI's long- and medium-term planning (src/ai/victory.js and
// src/ai/strategy.js). Before these existed the AI was entirely turn-local: it scored
// every reachable enemy territory, ranked the results by its leader's personality and
// executed the list, which is why it started far more sieges than it could ever finish
// and why it fought equally hard for a Caribbean island and for the last territory it
// needed to own a continent outright. See docs/05-known-issues.md section 6.

/**
 * The default victory condition, and the one the AI campaigns towards until the player
 * chooses otherwise. CONTINENTAL: hold every territory on this many continents.
 *
 * The Dominapedia's "Goals and Victory" page is the design this comes from. The player-
 * facing chooser is still to come; `setVictoryCondition()` is the seam it will use.
 */
export const CONTINENTS_REQUIRED_FOR_VICTORY = 3;

/** Fraction of the world's land area a DOMINATION victory requires. */
export const DOMINATION_LAND_SHARE = 0.6;

/** The turn a TURN_LIMIT game is scored on. */
export const VICTORY_TURN_LIMIT = 100;

/**
 * How often a country re-examines WHICH continents it is campaigning for.
 *
 * Commitments are deliberately sticky: a country that re-picked its three continents
 * every turn would chase whichever front happened to look best this turn and never
 * finish one, which is the turn-local behaviour the campaign layer exists to replace.
 * A commitment is abandoned early only when it becomes pointless -- the continent is
 * already held outright, or the country has been thrown off it entirely.
 */
export const CAMPAIGN_REVIEW_INTERVAL = 5;

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
     */
    minimumOdds: 22
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

/** How many attacks one country may press per turn, and the odds each leader type demands. */
export const attackDiscipline = {
    basePerTurn: 1,
    territoriesPerExtraAttack: 10,
    maxPerTurn: 5,
    /**
     * Odds floor by leader type, before `style_of_war` shifts it. An aggressive leader
     * will press on unclear odds; a pacifist wants a near-certainty before committing.
     * The old code demanded only `probability >= 1`, which is why the AI threw armies at
     * anything at all.
     */
    minimumOdds: { aggressive: 25, balanced: 34, pacifist: 45 },
    /** How far `style_of_war` (0..1) may move that floor, in percentage points, either way. */
    styleOfWarSwing: 12
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
    /** A country smaller than this leans on its economy before it picks fights. */
    smallCountryTerritories: 3
};
