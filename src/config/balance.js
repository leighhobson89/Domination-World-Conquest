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
 */
export const DICE_ATTACK_ADVANTAGE = 1.0;

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
    Object.freeze({ minimumShare: 0.70, dice: 5 }),
    Object.freeze({ minimumShare: 0.50, dice: 4 }),
    Object.freeze({ minimumShare: 0.35, dice: 3 }),
    Object.freeze({ minimumShare: 0.20, dice: 2 }),
    Object.freeze({ minimumShare: 0, dice: 1 })
]);

/**
 * The defender never rolls five.
 *
 * At even strength both sides sit in the 0.50 band, so the cap does nothing there and both
 * roll four. It bites only where the DEFENDER is the stronger side, and it is what stops a
 * heavily garrisoned territory being able to grind an attacker down at no risk: the defender
 * can always be attacked, just very badly.
 */
export const DEFENDER_DICE_CAP = 4;

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
 */
export const PAIRING_CASUALTY_SHARE = 0.10;

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
// needed to own a continent outright. See docs/04-known-issues.md section 6.

/**
 * The default victory condition, and the one the AI campaigns towards until the player
 * chooses otherwise. CONTINENTAL: hold every territory on this many continents.
 *
 * The Dominapedia's "Goals and Victory" page is the design this comes from, and
 * docs/05-goals-and-victory.md is the phase that implements it. Each condition now has a
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
    minimumOdds: 22,
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
