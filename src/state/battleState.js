// The battle in progress, as state.
//
// Battle overhaul B.3. A MOVE, not a behaviour change: this file is introduced holding what
// `battle.js` has always held in module-level `let`s, and B.4 is what makes the new resolver
// read and write it.
//
// WHY IT HAS TO BE STATE. `battle.js` exports about twenty-five `let`s of per-battle scratch,
// and other modules import them as live bindings -- `ui.js` reads `defendingArmyRemaining` and
// `skirmishesPerRound` directly, `gameTurnsLoop.js` reads the two armies through getters. That
// works for a battle that exists only while a modal is open and is thrown away afterwards. It
// does not work for what the overhaul asks for:
//
//   * B.6 renders a round LOG, so the rounds have to survive the round that produced them;
//   * B.7 lets reserves arrive a round late, so a battle has a future as well as a present;
//   * B.8 replays an AI attack on the player, so a battle has to be describable without the
//     module that fought it;
//   * and a battle that can be watched is a battle that can, in principle, be saved.
//
// ARRAY IDENTITY: FRESH PER BATTLE, STABLE WITHIN ONE. Each battle gets new army arrays, and
// they are written IN PLACE for the whole of that battle. Both halves matter, for opposite
// reasons.
//
// They must be stable WITHIN a battle because a round's casualties have to be visible through
// every reference already handed out -- `ui.js` reads the arrays to fill the battle window, and
// a siege laid mid-battle stores them on the siege object.
//
// They must be fresh BETWEEN battles for exactly the same reason. `addRemoveWarSiegeObject()`
// puts `attackingArmyRemaining` and `defendingArmyRemaining` straight onto the siege, so the
// siege ALIASES them. One set of arrays reused for the life of the page would mean the next
// battle silently rewrote the armies of every siege still standing. `battle.js` gets this right
// today by building `[...totalAttackingArmy]` per battle, and that is preserved here rather
// than "improved" into a single reused pair.
//
// (This is why the arrays are not `export const` refilled in place, which is the pattern
// `saveSlices.js` records for `retrievalArray`. That one is a single collection for the life of
// the game; these are per battle.)

import { registerSaveSlice } from "../platform/saveSlices.js";

/** An empty army array. Four slots: infantry, assault, air, naval. */
function emptyArmy() {
    return [0, 0, 0, 0];
}

/**
 * The one battle in progress, or null.
 *
 * There is deliberately only one. The game has never supported two open battles -- the battle
 * UI is a single modal and `battle.js`'s scratch was a single set of variables -- and making
 * this a collection would invent a capability nothing asks for.
 */
let battle = null;

/** The current battle's arrays. Replaced by `openBattle()`, written in place until then. */
let attackers = emptyArmy();
let defenders = emptyArmy();

/** Copy `source` into `target` without replacing it. */
function writeInPlace(target, source) {
    for (let index = 0; index < target.length; index++) {
        target[index] = source?.[index] ?? 0;
    }
}

/** True while a battle is open. */
export function hasBattle() {
    return battle !== null;
}

/** The battle in progress, or null. Read-only by convention; write through the functions here. */
export function currentBattle() {
    return battle;
}

/** The attacking army. The same array for the life of THIS battle; a new one for the next. */
export function attackingArmy() {
    return attackers;
}

/** The defending army. The same array for the life of THIS battle; a new one for the next. */
export function defendingArmy() {
    return defenders;
}

/**
 * Open a battle.
 *
 * The two army arrays are ADOPTED by reference -- see the note in the body, and the note on
 * array identity at the top of this file. Pass a fresh copy unless you specifically want the
 * battle to write through to whatever else holds that array.
 *
 * @param {{attackers: number[], defenders: number[], territoryId: string, territory: object,
 *          context?: object, siegeTurns?: number}} setup
 */
export function openBattle(setup) {
    //ADOPTED, not copied. The caller decides identity, and `battle.js` needs both behaviours:
    //a fresh battle passes `[...totalAttackingArmy]`, while a battle resumed from a siege passes
    //the siege's OWN `defendingArmyRemaining` so that the fighting writes through to the siege
    //record. Copying here would silently break the second case, and the symptom would be a siege
    //whose garrison never changed no matter how many times it was assaulted.
    attackers = setup.attackers;
    defenders = setup.defenders;
    battle = {
        territoryId: setup.territoryId ?? setup.territory?.uniqueId ?? null,
        context: setup.context ?? {},
        siegeTurns: setup.siegeTurns ?? 0,
        startingAttackForce: setup.startingAttackForce ?? 0,
        startingDefendForce: setup.startingDefendForce ?? 0,
        round: 0,
        state: "in-progress",
        attackerDugIn: false,
        defenderDugIn: false,
        //Every round fought so far, newest last. The round log renders this; the dice stage
        //renders the last entry. Bounded by MAX_BATTLE_ROUNDS, so it cannot grow without limit.
        records: [],
        //The forecast shown when the battle opened, kept so the results screen can say what the
        //player was told before they committed.
        openingForecast: setup.openingForecast ?? null,
        //Battle overhaul B.7. Force committed mid-battle that has not arrived yet, as
        //`{ army, arrivesAtRound }`. Reserves are debited from their source the moment they are
        //committed -- the same rule INVADE! follows (audit 5.1 AD) -- and join the fight at the
        //START of a later round. The delay is the whole point: it is what makes committing them a
        //decision with a cost rather than a free top-up.
        reserves: []
    };
    return battle;
}

/**
 * Advance the battle to a new state, keeping the army arrays' identity.
 *
 * Takes the object `resolveBattleRound()` returned rather than individual fields, so the model
 * stays the single description of what a battle is.
 */
export function commitRound(next, record) {
    if (!battle) {
        return null;
    }
    writeInPlace(attackers, next.attackers);
    writeInPlace(defenders, next.defenders);
    battle.round = next.round;
    battle.state = next.state;
    battle.attackerDugIn = next.attackerDugIn;
    battle.defenderDugIn = next.defenderDugIn;
    if (record) {
        battle.records.push(record);
    }
    return battle;
}

/**
 * How the ATTACKER lost, when they did: "wiped" or "routed", else null.
 *
 * This used to be a fifth element pushed onto `defendingArmyRemaining`, a four-slot army array
 * (overhaul B.4.5). The retreat handler read it back as `[4]` to decide whether the defender
 * simply held the ground or captured half the attackers as well. An army array that is sometimes
 * five long is a trap for anything that iterates one, and that array is aliased by any siege the
 * battle produced.
 */
export function setDefeatType(type) {
    if (battle) {
        battle.defeatType = type;
    }
}

/** @returns {"wiped"|"routed"|null} */
export function defeatType() {
    return battle?.defeatType ?? null;
}

/**
 * True while the attacker is being offered the decisive final round.
 *
 * A question, not a command: the offer stands alongside "fight another round" and "withdraw",
 * and the whole value of it is that it can be DECLINED. Taking it buys the territory for a fifth
 * of the survivors; declining it and rolling on may rout them instead, which absorbs half of what
 * is left of the garrison rather than paying for it.
 */
export function lastPushIsOffered() {
    return battle?.state === "last-push-available";
}

/**
 * Commit force that will join the attack at the start of round `arrivesAtRound`.
 *
 * The army is ADOPTED as data, not aliased: reserves are a record of an intention, and nothing
 * else holds them.
 */
export function queueReserves(army, arrivesAtRound) {
    if (!battle) {
        return;
    }
    battle.reserves.push({ army: [...army], arrivesAtRound });
}

/**
 * Take whatever reserves are due by `round`, merging them into one army array.
 *
 * Removes them from the queue, so a reserve can only arrive once. Returns null when nothing is
 * due, which lets the caller skip the merge entirely rather than adding four zeroes.
 */
export function takeArrivedReserves(round) {
    if (!battle || battle.reserves.length === 0) {
        return null;
    }
    const due = battle.reserves.filter((entry) => entry.arrivesAtRound <= round);
    if (due.length === 0) {
        return null;
    }
    battle.reserves = battle.reserves.filter((entry) => entry.arrivesAtRound > round);
    return due.reduce(
        (total, entry) => total.map((count, index) => count + (entry.army[index] ?? 0)),
        [0, 0, 0, 0]);
}

/** Reserves committed but not yet arrived. The UI greys the button when a set is already in transit. */
export function pendingReserves() {
    return battle?.reserves ?? [];
}

/** Add force to the attacking army in place, so every existing reference sees it. */
export function reinforceAttackers(army) {
    for (let index = 0; index < attackers.length; index++) {
        attackers[index] += army[index] ?? 0;
    }
}

/** The most recent round fought, or null before the first. */
export function lastRound() {
    return battle?.records?.[battle.records.length - 1] ?? null;
}

/** How many rounds have been fought. */
export function roundsFought() {
    return battle?.records?.length ?? 0;
}

/**
 * Close the battle.
 *
 * The army arrays are NOT cleared: a siege created from this battle aliases them, and the
 * retrieval of a withdrawing army reads them after the battle window has gone.
 */
export function closeBattle() {
    battle = null;
}

/**
 * The battle state, as the model wants it.
 *
 * `battleModel.js` takes a plain object with `attackers`, `defenders` and a territory. This
 * builds one from the store, with the LIVE arrays, so a caller cannot accidentally fight a
 * copy and then wonder why nothing changed.
 *
 * @param {object} territory  the live territory, which the store does not hold
 */
export function asModelState(territory) {
    if (!battle) {
        return null;
    }
    return {
        attackers,
        defenders,
        territory,
        context: battle.context,
        siegeTurns: battle.siegeTurns,
        startingAttackForce: battle.startingAttackForce,
        startingDefendForce: battle.startingDefendForce,
        round: battle.round,
        attackerDugIn: battle.attackerDugIn,
        defenderDugIn: battle.defenderDugIn,
        state: battle.state
    };
}

/** Test seam, and what `reset()` uses when a new game starts. */
export function __resetBattleState() {
    battle = null;
    attackers = emptyArmy();
    defenders = emptyArmy();
}

//A battle in progress should never actually reach a save file: the autosave is gated against
//firing while a battle, battle-results or transfer window is open, precisely because
//`battle.js` used to hold the resolution in module variables that no snapshot could see. The
//slice is registered anyway, for two reasons. It makes that gate a belt rather than the only
//thing standing between a player and an unresumable save; and B.8's defender playback is a
//battle the player did not open, which makes "no battle can be in flight at save time" a
//weaker claim than it is today. Capturing null is cheap.
registerSaveSlice("battleInProgress", {
    capture: () => (battle === null ? null : {
        ...battle,
        attackers: [...attackers],
        defenders: [...defenders]
    }),
    restore: (data) => {
        if (!data) {
            __resetBattleState();
            return;
        }
        const { attackers: savedAttackers, defenders: savedDefenders, ...rest } = data;
        attackers = [...(savedAttackers ?? emptyArmy())];
        defenders = [...(savedDefenders ?? emptyArmy())];
        battle = { records: [], ...rest };
    }
});
