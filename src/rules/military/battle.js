// Open battle: how a round of skirmishes resolves, and what the five rounds add up to.
//
// Refactor plan Phase 5.3. Pure, with the RNG injected. `resolveRound()` takes two army
// arrays and returns two new ones -- it does not mutate its arguments, does not touch the
// DOM, and does not decide what happens next. Deciding what happens next is
// `classifyOutcome()`, which is also pure, so a test can set up a hopeless defender and
// assert that the answer is a rout without playing a battle to get there.
//
// This is what finally makes a combat outcome assertable. Until the RNG was injected, no
// test could assert an exact result across runs: `addSparklesRegularly()` in ui.js burns
// three draws per timer tick on the same global stream as combat, so seeding `Math.random`
// did not make two runs agree (audit 5.3). Pass a seeded `rng` here and it does.

import {
    battleOutcomeEffects,
    battleOutcomeThresholds,
    SKIRMISH_ODDS_CAP,
    UNIT_MATCHUP_EFFECTIVENESS
} from "../../config/balance.js";
import { combinedForce, isDestroyed, UNIT_TYPES, unitCount } from "./units.js";

/**
 * How a battle can end.
 *
 * The numbers are the `situation` argument `handleWarEndingsAndOptions()` has always taken,
 * so the legacy caller can switch on `WarOutcome.X` without a translation table.
 */
export const WarOutcome = Object.freeze({
    ATTACKER_WON: 0,
    DEFENDER_WON: 1,
    DEFENDER_ROUTED: 2,
    LAST_PUSH: 3,
    ATTACKER_ROUTED: 4,
    /** Neither side broke: fight another five rounds, with attrition. */
    FIGHT_AGAIN: 5
});

/**
 * Which of the defender's remaining unit types an attacking type engages.
 *
 * Its own type first, so a conventional battle fights exactly as it always did. Failing
 * that, whichever surviving defender type this attacker is most effective against. Returns
 * -1 when the defender has nothing left at all.
 *
 * audit 5.2 K: skirmishes used to pair matching types only, so an all-infantry attack on an
 * all-naval defender produced zero possible skirmishes and hung -- the battle could neither
 * progress nor resolve.
 */
export function chooseDefendingUnitTypeIndex(attackingUnitTypeIndex, defenders) {
    if (defenders[attackingUnitTypeIndex] > 0) {
        return attackingUnitTypeIndex;
    }

    let bestIndex = -1;
    let bestEffectiveness = -1;
    for (let index = 0; index < defenders.length; index++) {
        if (defenders[index] <= 0) {
            continue;
        }
        const effectiveness = UNIT_MATCHUP_EFFECTIVENESS[attackingUnitTypeIndex][index];
        if (effectiveness > bestEffectiveness) {
            bestEffectiveness = effectiveness;
            bestIndex = index;
        }
    }
    return bestIndex;
}

/**
 * How many pairings the two armies can make between them.
 *
 * Every attacking unit can engage some defending unit, so this is simply the smaller of the
 * two head counts. It is zero only when one side is empty, which is a resolved battle rather
 * than a stalled one.
 */
export function countPossibleSkirmishes(attackers, defenders) {
    return Math.min(unitCount(attackers), unitCount(defenders));
}

/**
 * How many of each type would meet its own kind. Display only -- it is how much of the
 * battle is a like-for-like fight, which is what the battle panel shows.
 */
export function likeForLikeSkirmishes(attackers, defenders) {
    return UNIT_TYPES.map((_type, index) => Math.min(attackers[index], defenders[index]));
}

/**
 * One attacker's chance of winning one skirmish against one defender.
 *
 * Capped: without the ceiling, a lopsided probability plus a favourable matchup makes an
 * attack a formality, and the five-round structure stops meaning anything.
 */
export function skirmishOdds(probabilityPercent, attackingIndex, defendingIndex) {
    const effectiveness = UNIT_MATCHUP_EFFECTIVENESS[attackingIndex][defendingIndex];
    return Math.min((probabilityPercent / 100) * effectiveness, SKIRMISH_ODDS_CAP);
}

/**
 * Fight one round.
 *
 * The attacker's unit types engage in a random order, and each type fights until it is spent
 * or the round's skirmish budget is used up. Every skirmish is one attacking unit against
 * one defending unit and exactly one of them dies -- there are no partial casualties.
 *
 * The round STOPS at the first unit type that cannot fight -- because it has no units left,
 * or because the round's budget is spent -- rather than skipping over it to the next type.
 * That is what the legacy loop did, and it is load-bearing: the type order is random, so a
 * round in which the first type drawn is empty is a quiet round. Changing it to skip would
 * make every battle shorter and every attacker stronger, which is a balance change and not
 * part of an extraction. `halted` says which of those happened.
 *
 * @param {number[]} attackers  army array; not mutated
 * @param {number[]} defenders  army array; not mutated
 * @param {{skirmishesPerRound: number, probabilityPercent: number}} context
 * @param {() => number} [rng]
 * @returns {{attackers: number[], defenders: number[], skirmishesFought: number,
 *            halted: "noDefenders"|"noAttackers"|"nothingToFight"|null}}
 */
export function resolveRound(attackers, defenders, context, rng = Math.random) {
    const attackersLeft = [...attackers];
    const defendersLeft = [...defenders];
    let skirmishesFought = 0;
    let halted = null;

    //Read once, before any fighting, as the legacy loop did. Both are effectively dead
    //branches -- a battle whose defender or attacker was already wiped out was resolved at
    //the end of the previous round and never reaches another one -- but they are reported
    //rather than dropped, so the caller can see it if that ever stops being true.
    const startedWithNoDefenders = isDestroyed(defenders);
    const startedWithNoAttackers = isDestroyed(attackers);

    //Randomised so that no unit type is systematically first into the fight, which would
    //otherwise make the infantry a permanent shield for everything behind them.
    const order = UNIT_TYPES.map((_type, index) => index).sort(() => rng() - 0.5);

    for (const attackingIndex of order) {
        const canFight =
            attackersLeft[attackingIndex] > 0 &&
            !isDestroyed(defendersLeft) &&
            skirmishesFought < context.skirmishesPerRound;

        if (!canFight) {
            if (startedWithNoDefenders) {
                halted = "noDefenders";
                continue;
            }
            if (startedWithNoAttackers) {
                halted = "noAttackers";
                continue;
            }
            halted = "nothingToFight";
            break;
        }

        while (attackersLeft[attackingIndex] > 0 && skirmishesFought < context.skirmishesPerRound) {
            const defendingIndex = chooseDefendingUnitTypeIndex(attackingIndex, defendersLeft);
            if (defendingIndex === -1) {
                break; //nothing left to fight
            }

            if (rng() <= skirmishOdds(context.probabilityPercent, attackingIndex, defendingIndex)) {
                defendersLeft[defendingIndex]--;
            } else {
                attackersLeft[attackingIndex]--;
            }
            skirmishesFought++;
        }
    }

    return {
        attackers: attackersLeft,
        defenders: defendersLeft,
        skirmishesFought: skirmishesFought,
        halted: halted
    };
}

/**
 * What the state of the two armies means, once the rounds are done.
 *
 * The thresholds are measured against each side's OWN starting force. audit 5.1 E: all three
 * used to be compared against the attacker's starting force, so a battle resolved at the
 * wrong moment whenever the two armies differed in size -- which is almost always.
 *
 * Wiping a side out is checked against the armies as they stand NOW. The three threshold
 * checks are not: they are measured against `attackForce` / `defendForce`, which the caller
 * supplies and which the game measures at the START of the round, before its casualties.
 * That is a full round of lag and it is deliberate here only in the sense that it is what
 * the game has always done -- correcting it moves every rout and last-push threshold by one
 * round, which is a balance change and belongs in its own commit. The two are separate
 * parameters precisely so the lag is visible rather than buried.
 *
 * @param {number[]} attackers
 * @param {number[]} defenders
 * @param {{startingAttackForce: number, startingDefendForce: number,
 *          attackForce?: number, defendForce?: number}} start
 * @returns {number} a `WarOutcome`
 */
export function classifyOutcome(attackers, defenders, start) {
    if (isDestroyed(defenders)) {
        return WarOutcome.ATTACKER_WON;
    }
    if (isDestroyed(attackers)) {
        return WarOutcome.DEFENDER_WON;
    }

    const attackForce = start.attackForce ?? combinedForce(attackers);
    const defendForce = start.defendForce ?? combinedForce(defenders);

    if (defendForce < battleOutcomeThresholds.defenderRout * start.startingDefendForce) {
        return WarOutcome.DEFENDER_ROUTED;
    }
    if (defendForce < battleOutcomeThresholds.defenderLastPush * start.startingDefendForce) {
        return WarOutcome.LAST_PUSH;
    }
    if (attackForce < battleOutcomeThresholds.attackerRout * start.startingAttackForce) {
        return WarOutcome.ATTACKER_ROUTED;
    }
    return WarOutcome.FIGHT_AGAIN;
}

/**
 * The attacking army that carries on into a second set of five rounds.
 *
 * A battle that neither side can finish costs the attacker a slice of what is left, to
 * desertion and war weariness. Without it a stalemate is free and an attacker can grind a
 * defender down indefinitely at no cost.
 */
export function applyWarWeariness(attackers) {
    return attackers.map(
        (count) => Math.max(0, Math.floor(count * battleOutcomeEffects.warWearinessSurvivorShare)));
}

/**
 * The garrison a conqueror is left holding, by how it won.
 *
 * - A clean win keeps everything that survived.
 * - A rout also absorbs half the defenders who were routed: they surrendered rather than died.
 * - A last push costs the attacker a fifth of what is left to take the territory.
 *
 * @param {number} outcome  a `WarOutcome`
 * @param {number[]} attackers
 * @param {number[]} defenders
 * @returns {number[]|null} the occupying army, or null if the attacker did not take it
 */
export function occupyingArmyFor(outcome, attackers, defenders) {
    switch (outcome) {
        case WarOutcome.ATTACKER_WON:
            return [...attackers];
        case WarOutcome.DEFENDER_ROUTED:
            return attackers.map((count, index) =>
                count + Math.floor(defenders[index] * battleOutcomeEffects.routCaptureShare));
        case WarOutcome.LAST_PUSH:
            return attackers.map(
                (count) => Math.floor(count * battleOutcomeEffects.lastPushSurvivorShare));
        default:
            return null;
    }
}
