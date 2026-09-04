// Open battle: the whole of it, as pure functions over plain data.
//
// Battle overhaul B.1. Pure, with the RNG injected. `resolveBattleRound()` takes a battle state
// and returns a NEW one plus a record of what happened; it mutates nothing, touches no DOM, and
// decides nothing about what the UI should do next.
//
// This replaces `src/rules/military/battle.js` (five rounds of per-unit skirmishes) and
// `doAttack()` in aiCalculations.js (a fight-to-the-death loop on combined force) with ONE
// model, which is the largest single point of docs/archived/battle_overhaul.md. Neither of those is
// touched yet: nothing imports this file until phase B.4.
//
// THE MODEL, in the order the functions appear:
//
//   shareFor()            two armies and a territory become one number, 0..1
//   modifiersFor()        terrain and composition become named +1s and -1s
//   beginBattle()         a starting state, remembering each side's force at the start
//   resolveBattleRound()  roll, pair, apply casualties, classify
//   classifyBattleState() what the state of the two armies means
//   occupyingArmyFor()    what the winner is left holding
//
// The one thing to hold on to: `share` and the displayed ODDS are different quantities and are
// deliberately not the same function. `share` is force only, and its job is to pick dice
// counts. The odds the player is shown come from `forecast.js`, which plays the whole battle
// out. Today's code uses one number for both jobs and does neither well.

import {
    BREAK_THRESHOLD,
    DICE_ATTACK_ADVANTAGE,
    DIE_MODIFIERS,
    DIG_IN_CASUALTY_SHARE,
    LAST_PUSH_BAND,
    MAX_BATTLE_ROUNDS,
    PAIRING_CASUALTY_SHARE,
    battleOutcomeEffects
} from "../../config/balance.js";
import {
    PERSONNEL_WORTH_BY_INDEX,
    UNIT_INDEX,
    combinedForce,
    isDestroyed
} from "./units.js";
import { areaBonusFor, combatContinentModifierFor } from "./probability.js";
import { clampModifier, defenderDiceCountFor, diceCountFor, resolvePairings, rollDice } from "./dice.js";

/**
 * What a battle can be, after any round.
 *
 * `LAST_PUSH_AVAILABLE` is the one that is not terminal: it is an OFFER, and the battle
 * continues normally if the attacker declines. Today's equivalent ("massive assault") fires by
 * itself, which is why the player has never had a decision at that moment.
 */
export const BattleState = Object.freeze({
    IN_PROGRESS: "in-progress",
    LAST_PUSH_AVAILABLE: "last-push-available",
    DEFENDER_WIPED: "defender-wiped",
    DEFENDER_ROUTED: "defender-routed",
    ATTACKER_WIPED: "attacker-wiped",
    ATTACKER_BROKEN: "attacker-broken",
    STALEMATE: "stalemate"
});

/** The states in which the attacker holds the field. */
const ATTACKER_WON = new Set([
    BattleState.DEFENDER_WIPED,
    BattleState.DEFENDER_ROUTED
]);

/** True when this state ends the battle. */
export function isTerminal(state) {
    return state !== BattleState.IN_PROGRESS && state !== BattleState.LAST_PUSH_AVAILABLE;
}

/** True when the attacker takes the territory in this state. */
export function attackerTookIt(state) {
    return ATTACKER_WON.has(state);
}

// --- share -----------------------------------------------------------------

/**
 * The attacker's share of the two strengths: the number the DICE COUNTS come from.
 *
 * Personnel-weighted force on both sides, multiplied on the attacker's side by the dice model's
 * attack dial, how developed the attacking territories are and how hard the continent is to
 * invade; and on the defender's side by the territory's size.
 *
 * The dial is `DICE_ATTACK_ADVANTAGE`, not `ATTACK_ADVANTAGE`, and the note on it in balance.js
 * carries the measurement that forced them apart. In short: a 44% multiplier crosses a dice
 * band, and a spare die is a guaranteed casualty rather than a small edge.
 *
 * Note what is NOT here: `defenseMultiplierFor()`. Forts and mountains leave the strength
 * calculation entirely and become a die modifier in `modifiersFor()` instead. That is the split
 * described in docs/archived/battle_overhaul.md section 4.4 -- diffuse multipliers shape the share,
 * actionable ones become itemised modifiers -- and counting them in both places is the one
 * mistake this arrangement makes easy. There is a unit test asserting they are not.
 *
 * @param {number[]} attackers  army array
 * @param {number[]} defenders  army array, the defender's USEABLE counts
 * @param {object} territory    the defending territory
 * @param {{attackingDevelopmentIndex?: number, combatContinentModifier?: number}} [context]
 * @returns {number} 0..1
 */
export function shareFor(attackers, defenders, territory, context = {}) {
    const developmentIndex = context.attackingDevelopmentIndex ?? 1;
    const continentModifier = context.combatContinentModifier ?? combatContinentModifierFor(territory);

    const attackingStrength =
        combinedForce(attackers) * DICE_ATTACK_ADVANTAGE * developmentIndex * continentModifier;
    const defendingStrength = combinedForce(defenders) * areaBonusFor(territory);

    const total = attackingStrength + defendingStrength;
    //Two empty armies is a resolved battle, not a coin flip -- the same guard winProbability()
    //carries, and for the same reason: without it every later round inherits a NaN.
    if (total <= 0) {
        return 0;
    }
    return attackingStrength / total;
}

// --- modifiers -------------------------------------------------------------

/**
 * One row of the ledger.
 *
 * A row carries a `value` (added to every die on that side) or a `dice` change (added to that
 * side's dice COUNT), and the two are not interchangeable. A die bonus improves the pairings you
 * contest; a dice change alters how many you contest at all -- and only a dice change can answer
 * an opponent's UNMATCHED dice, which are automatic hits and are untouched by any face bonus.
 *
 * That distinction was found by measurement, not designed: with fortification as a die bonus,
 * `tools/battle-lab.mjs` reported a 2:1 attacker taking a fortress 100% of the time. Four dice
 * against two is two guaranteed casualties a round, and +2 on the defender's two dice cannot
 * touch them. Terrain that cannot be answered by terrain is not terrain.
 */
function row(key, label, { value = 0, dice = 0 }) {
    return { key, label, value, dice };
}

/** Personnel of one unit type in an army array. */
function personnelOf(army, index) {
    return (army[index] ?? 0) * PERSONNEL_WORTH_BY_INDEX[index];
}

/**
 * Whether one side has air superiority over the other: it has air and they have none, or it
 * has `airRatio` times as much of it by personnel.
 */
function hasAirSuperiority(ours, theirs) {
    const ourAir = personnelOf(ours, UNIT_INDEX.air);
    const theirAir = personnelOf(theirs, UNIT_INDEX.air);
    if (ourAir <= 0) {
        return false;
    }
    if (theirAir <= 0) {
        return true;
    }
    return ourAir >= theirAir * DIE_MODIFIERS.airRatio;
}

/**
 * The itemised die modifiers for both sides.
 *
 * Every row here appears verbatim on the attack screen, which is the constraint that decides
 * what belongs: a modifier the player cannot act on is a strength multiplier and belongs in
 * `shareFor()` instead.
 *
 * Returns rows AND a clamped total for each side, so a caller can render the reasoning and
 * resolve the round from the same call rather than computing the modifier twice.
 *
 * @param {number[]} attackers
 * @param {number[]} defenders
 * @param {object} territory
 * @param {{attackerDugIn?: boolean, defenderDugIn?: boolean, siegeTurns?: number}} [options]
 */
export function modifiersFor(attackers, defenders, territory, options = {}) {
    const attackerRows = [];
    const defenderRows = [];

    // Fortification -- the defender's terrain. It costs the ATTACKER dice, and the row sits on
    // the attacker's side of the ledger because that is who pays it: "their fortifications,
    // -1 die" is a sentence about the attack. Taking dice off the attacker rather than adding
    // faces to the defender is what lets a fortress blunt an overwhelming force at all; see
    // `row()`.
    const fortification = (territory?.defenseBonus ?? 0) + (territory?.mountainDefenseBonus ?? 0);
    const fortBand = DIE_MODIFIERS.fortification.find((band) => fortification >= band.minimumBonus);
    if (fortBand) {
        attackerRows.push(row("fortification", "their fortifications and terrain",
            { dice: -fortBand.dice }));
    }

    // Air superiority, either way.
    if (hasAirSuperiority(attackers, defenders)) {
        attackerRows.push(row("airSuperiority", "air superiority", { value: DIE_MODIFIERS.airSuperiority }));
    } else if (hasAirSuperiority(defenders, attackers)) {
        defenderRows.push(row("airSuperiority", "air superiority", { value: DIE_MODIFIERS.airSuperiority }));
    }

    // Armour against no armour, either way.
    const attackerArmour = attackers[UNIT_INDEX.assault] ?? 0;
    const defenderArmour = defenders[UNIT_INDEX.assault] ?? 0;
    if (attackerArmour <= 0 && defenderArmour > 0) {
        attackerRows.push(row("noArmour", "no armour against armour", { value: DIE_MODIFIERS.noArmourAgainstArmour }));
    } else if (defenderArmour <= 0 && attackerArmour > 0) {
        defenderRows.push(row("noArmour", "no armour against armour", { value: DIE_MODIFIERS.noArmourAgainstArmour }));
    }

    // A naval-led landing on a coast.
    const attackerForce = combinedForce(attackers);
    const navalShare = attackerForce > 0 ? personnelOf(attackers, UNIT_INDEX.naval) / attackerForce : 0;
    if (territory?.isCoastal && navalShare >= DIE_MODIFIERS.coastalNavalShare) {
        attackerRows.push(row("coastalAssault", "naval landing", { value: DIE_MODIFIERS.coastalAssault }));
    }

    // Consolidating last round.
    if (options.attackerDugIn) {
        attackerRows.push(row("dugIn", "dug in", { value: DIE_MODIFIERS.dugIn }));
    }
    if (options.defenderDugIn) {
        defenderRows.push(row("dugIn", "dug in", { value: DIE_MODIFIERS.dugIn }));
    }

    // Assaulting out of a siege that has been grinding the place down.
    const siegeTurns = options.siegeTurns ?? 0;
    if (siegeTurns > 0) {
        const steps = Math.min(
            Math.floor(siegeTurns / DIE_MODIFIERS.siegeGrindingTurnsPerStep),
            DIE_MODIFIERS.siegeGrindingCap);
        if (steps > 0) {
            attackerRows.push(row("siegeGrinding", "siege has worn them down", { value: steps }));
        }
    }

    const sumValues = (rows) => rows.reduce((total, entry) => total + entry.value, 0);
    const sumDice = (rows) => rows.reduce((total, entry) => total + entry.dice, 0);
    return {
        attacker: {
            rows: attackerRows,
            total: clampModifier(sumValues(attackerRows)),
            diceChange: sumDice(attackerRows)
        },
        defender: {
            rows: defenderRows,
            total: clampModifier(sumValues(defenderRows)),
            diceChange: sumDice(defenderRows)
        }
    };
}

// --- casualties ------------------------------------------------------------

/**
 * What is left of an army after losing `pairingsLost` pairings.
 *
 * Compounded, not summed: each pairing takes `PAIRING_CASUALTY_SHARE` of what is left AT THAT
 * MOMENT, so five lost pairings leave 0.9^5 rather than half, and no number of losses can drive
 * a count below zero by arithmetic alone.
 *
 * Proportional across the four unit types, so composition survives attrition -- an army that
 * starts combined-arms stays combined-arms, and the modifiers it earns for that do not
 * evaporate after one bad round.
 *
 * The FLOOR is load-bearing. Flooring each type can, on a large army, leave the combined force
 * unchanged if the share is tiny; a round that kills nobody is a round that can repeat forever,
 * which is exactly what `MAX_BATTLE_ROUNDS` exists to catch and should never actually catch.
 * So a side that lost a pairing and is not already empty always loses at least one unit.
 *
 * @param {number[]} army
 * @param {number} pairingsLost
 * @param {{share?: number}} [options]
 * @returns {number[]} a new army array
 */
export function applyCasualties(army, pairingsLost, options = {}) {
    if (pairingsLost <= 0 || isDestroyed(army)) {
        return [...army];
    }
    const share = options.share ?? PAIRING_CASUALTY_SHARE;
    const survivalFraction = Math.pow(1 - share, pairingsLost);

    const survivors = army.map((count) => Math.max(0, Math.floor(count * survivalFraction)));

    if (combinedForce(survivors) >= combinedForce(army)) {
        //Nothing died. Take one unit of whatever this army has most of by head count, so the
        //battle always makes progress. `indexOf(Math.max(...))` is safe here because the array
        //is four long and we have already established it is not empty.
        const largest = survivors.indexOf(Math.max(...survivors));
        if (survivors[largest] > 0) {
            survivors[largest]--;
        }
    }
    return survivors;
}

// --- the battle ------------------------------------------------------------

/**
 * A fresh battle state.
 *
 * `startingAttackForce` / `startingDefendForce` are recorded once and never recomputed: every
 * break test measures a side against its OWN force at the start, and audit 5.1 E is what
 * happens when those two numbers get crossed.
 *
 * @param {{attackers: number[], defenders: number[], territory: object,
 *          context?: object, siegeTurns?: number}} setup
 */
export function beginBattle(setup) {
    const attackers = [...setup.attackers];
    const defenders = [...setup.defenders];
    return {
        attackers,
        defenders,
        territory: setup.territory,
        context: setup.context ?? {},
        siegeTurns: setup.siegeTurns ?? 0,
        startingAttackForce: combinedForce(attackers),
        startingDefendForce: combinedForce(defenders),
        round: 0,
        attackerDugIn: false,
        defenderDugIn: false,
        state: BattleState.IN_PROGRESS
    };
}

/**
 * What the state of the two armies means.
 *
 * Checked AFTER casualties, against each side's own starting force. Wipeouts first, because a
 * side with nothing left is not "broken", it is gone -- and because the break test would
 * otherwise report both at once.
 *
 * @param {object} battle
 * @returns {string} a `BattleState`
 */
export function classifyBattleState(battle) {
    if (isDestroyed(battle.defenders)) {
        return BattleState.DEFENDER_WIPED;
    }
    if (isDestroyed(battle.attackers)) {
        return BattleState.ATTACKER_WIPED;
    }

    const attackForce = combinedForce(battle.attackers);
    const defendForce = combinedForce(battle.defenders);

    if (defendForce < BREAK_THRESHOLD * battle.startingDefendForce) {
        return BattleState.DEFENDER_ROUTED;
    }
    if (attackForce < BREAK_THRESHOLD * battle.startingAttackForce) {
        return BattleState.ATTACKER_BROKEN;
    }
    if (battle.round >= MAX_BATTLE_ROUNDS) {
        return BattleState.STALEMATE;
    }
    if (defendForce < BREAK_THRESHOLD * LAST_PUSH_BAND * battle.startingDefendForce) {
        return BattleState.LAST_PUSH_AVAILABLE;
    }
    return BattleState.IN_PROGRESS;
}

/**
 * Fight one round.
 *
 * @param {object} battle  a state from `beginBattle()` or a previous round
 * @param {() => number} rng
 * @param {{attackerDigsIn?: boolean, defenderDigsIn?: boolean}} [choices]
 * @returns {{battle: object, record: object}} the new state, and what happened
 */
export function resolveBattleRound(battle, rng, choices = {}) {
    const share = shareFor(battle.attackers, battle.defenders, battle.territory, battle.context);
    const modifiers = modifiersFor(battle.attackers, battle.defenders, battle.territory, {
        attackerDugIn: battle.attackerDugIn,
        defenderDugIn: battle.defenderDugIn,
        siegeTurns: battle.siegeTurns
    });

    //A dice change can never take a side below one die: the underdog always rolls, which is the
    //same guarantee the bottom band gives and for the same reason.
    const attackerDice = Math.max(1, diceCountFor(share) + modifiers.attacker.diceChange);
    const defenderDice = Math.max(1, defenderDiceCountFor(1 - share) + modifiers.defender.diceChange);

    const attackerFaces = rollDice(attackerDice, rng);
    const defenderFaces = rollDice(defenderDice, rng);
    const outcome = resolvePairings(
        attackerFaces, defenderFaces, modifiers.attacker.total, modifiers.defender.total);

    //Digging in gives up this round's OFFENCE, not its dice. The side still rolls, and those
    //dice still answer the enemy's -- so it is not simply handing over every pairing as an
    //unmatched hit -- but the pairings it wins inflict nothing. Zeroing the dice count instead
    //was tried and is strictly worse than not digging in at all: with no dice to answer with,
    //every enemy die becomes an automatic hit, and halving the casualties does not make up for
    //taking four of them.
    const attackerLosses = choices.defenderDigsIn ? 0 : outcome.attackerLosses;
    const defenderLosses = choices.attackerDigsIn ? 0 : outcome.defenderLosses;

    const attackerShare = choices.attackerDigsIn
        ? PAIRING_CASUALTY_SHARE * DIG_IN_CASUALTY_SHARE
        : PAIRING_CASUALTY_SHARE;
    const defenderShare = choices.defenderDigsIn
        ? PAIRING_CASUALTY_SHARE * DIG_IN_CASUALTY_SHARE
        : PAIRING_CASUALTY_SHARE;

    const attackers = applyCasualties(battle.attackers, attackerLosses, { share: attackerShare });
    const defenders = applyCasualties(battle.defenders, defenderLosses, { share: defenderShare });

    const next = {
        ...battle,
        attackers,
        defenders,
        round: battle.round + 1,
        //Digging in this round is what earns the bonus NEXT round.
        attackerDugIn: Boolean(choices.attackerDigsIn),
        defenderDugIn: Boolean(choices.defenderDigsIn)
    };
    next.state = classifyBattleState(next);

    const record = {
        round: next.round,
        share,
        attackerDice,
        defenderDice,
        attackerFaces,
        defenderFaces,
        modifiers,
        pairings: outcome.pairings,
        attackerLosses,
        defenderLosses,
        attackerDugIn: Boolean(choices.attackerDigsIn),
        defenderDugIn: Boolean(choices.defenderDigsIn),
        attackersBefore: [...battle.attackers],
        defendersBefore: [...battle.defenders],
        attackersAfter: [...attackers],
        defendersAfter: [...defenders],
        state: next.state
    };

    return { battle: next, record };
}

/**
 * The all-in final round offered at `LAST_PUSH_AVAILABLE`.
 *
 * Takes the territory outright at a fixed cost, rather than rolling for it. It is a
 * TRANSACTION, not a round -- the attacker is buying certainty with a fifth of what is left,
 * which is the only reason to take it over another roll.
 */
export function resolveLastPush(battle) {
    const attackers = battle.attackers.map(
        (count) => Math.floor(count * battleOutcomeEffects.lastPushSurvivorShare));
    const next = {
        ...battle,
        attackers,
        defenders: [0, 0, 0, 0],
        round: battle.round + 1,
        state: BattleState.DEFENDER_WIPED
    };
    return {
        battle: next,
        record: {
            round: next.round,
            lastPush: true,
            attackersBefore: [...battle.attackers],
            attackersAfter: [...attackers],
            defendersBefore: [...battle.defenders],
            defendersAfter: [0, 0, 0, 0],
            state: next.state
        }
    };
}

/**
 * The garrison the winner is left holding.
 *
 * A wipeout keeps what survived; a rout also absorbs `routCaptureShare` of the defenders who
 * broke, because they surrendered rather than died. Returns null when the attacker did not take
 * the territory, which is the caller's signal that there is nothing to garrison.
 *
 * @param {string} state  a `BattleState`
 * @param {number[]} attackers
 * @param {number[]} defenders
 * @returns {number[]|null}
 */
export function occupyingArmyFor(state, attackers, defenders) {
    switch (state) {
        case BattleState.DEFENDER_WIPED:
            return [...attackers];
        case BattleState.DEFENDER_ROUTED:
            return attackers.map((count, index) =>
                count + Math.floor(defenders[index] * battleOutcomeEffects.routCaptureShare));
        default:
            return null;
    }
}

/**
 * Play a battle to its end with no player input, taking the last push whenever it is offered.
 *
 * This is what the AI runs (phase B.5) and what `forecast.js` runs five hundred times. The
 * player's battle is the same `resolveBattleRound()` one round at a time, which is the point:
 * one model, two paces.
 *
 * @param {object} setup  as `beginBattle()`
 * @param {() => number} rng
 * @param {{takeLastPush?: boolean}} [options]
 */
export function resolveBattle(setup, rng, options = {}) {
    const takeLastPush = options.takeLastPush ?? true;
    let battle = beginBattle(setup);
    const records = [];

    while (!isTerminal(battle.state)) {
        if (battle.state === BattleState.LAST_PUSH_AVAILABLE && takeLastPush) {
            const push = resolveLastPush(battle);
            battle = push.battle;
            records.push(push.record);
            break;
        }
        const step = resolveBattleRound(battle, rng);
        battle = step.battle;
        records.push(step.record);
    }

    return {
        battle,
        records,
        state: battle.state,
        tookTerritory: attackerTookIt(battle.state),
        occupying: occupyingArmyFor(battle.state, battle.attackers, battle.defenders)
    };
}
