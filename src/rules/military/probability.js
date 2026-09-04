// Pre-battle odds.
//
// Refactor plan Phase 5.3. Pure -- and, unlike the version it replaces, it does not read two
// module-level `let`s (`reusableAttackingAverageDevelopmentIndex`,
// `reusableCombatContinentModifier`) that the previous battle left behind. Those arrive in
// the context, so a recalculation mid-battle uses the modifiers of THIS battle rather than
// whichever one ran last.
//
// The model: both sides are reduced to a head count, the defender's is multiplied up by its
// fortifications and its size, the attacker's by how developed it is and how hard the
// continent is to invade, and the answer is the attacker's share of the total.
//
// The attacker's side carries one more factor, `ATTACK_ADVANTAGE`, and it is not a property
// of either army: it is the global attack/defence dial, and this is the only place open
// battle reads it. See the note on it in src/config/balance.js for why it multiplies the
// STRENGTH rather than the probability that comes out.

import {
    AREA_BONUS_DAMPENING,
    ATTACK_ADVANTAGE,
    combatContinentModifiers,
    DEFENSE_BONUS_DIVISOR,
    MAX_AREA_THRESHOLD
} from "../../config/balance.js";
import { combinedForce } from "./units.js";

/**
 * How much a territory's size affects its defence.
 *
 * INTENDED: a small territory is easier to garrison completely, so it defends above 1; past
 * `MAX_AREA_THRESHOLD` there is no bonus. The result is pulled halfway back towards 1 by
 * `AREA_BONUS_DAMPENING`, because at full strength the smallest territories on the map were
 * effectively untakeable.
 *
 * ACTUAL: `Math.min` caps the ratio at 1, so the term can never exceed 1. Every territory at
 * or below the threshold scores exactly 1 -- there is no small-territory bonus at all -- and
 * every territory ABOVE it is penalised instead, which is the reverse of the intent. Almost
 * certainly a `min`/`max` slip (compare audit 5.2 P, where `Math.max(x), 1` discarded the
 * area term from gold income entirely). Logged as known-issues AR and left alone here:
 * correcting it changes the odds of every attack on the map, which is a balance change and
 * belongs in its own commit. `tests/unit/rules-military.spec.js` asserts what it does, not
 * what it was meant to do.
 */
export function areaBonusFor(territory) {
    const raw = Math.min(1, MAX_AREA_THRESHOLD / territory.area);
    return 1 + (raw - 1) * AREA_BONUS_DAMPENING;
}

/** How hard the defender's continent is to invade. Unknown continents are neutral. */
export function combatContinentModifierFor(territory) {
    if (!territory) {
        return 1;
    }
    return combatContinentModifiers[territory.continent] ?? 1;
}

/**
 * The multiplier a territory's fortifications put on its defending force.
 *
 * The CEILING of the division is deliberate and is why a single fort matters: any bonus at
 * all takes the multiplier from 1 to 2. A territory with no forts, no mountains and no
 * land-locked bonus defends at face value.
 */
export function defenseMultiplierFor(territory) {
    return Math.ceil((territory.defenseBonus + territory.mountainDefenseBonus) / DEFENSE_BONUS_DIVISOR);
}

/**
 * The attacker's chance of taking the territory, as a percentage.
 *
 * @param {number[]} attackers  army array
 * @param {number[]} defenders  army array
 * @param {object} territory    the defending territory
 * @param {{attackingDevelopmentIndex: number, combatContinentModifier: number}} context
 * @returns {number} 0..100
 */
//The global attacker's advantage is applied here and NOT in the caller, so that the
//pre-battle figure the player is shown, the mid-battle recalculation, and every odds the
//AI rates a target on are the same number. Applying it at a call site is how the two used
//to drift (see the note at the top of this file).
export function winProbability(attackers, defenders, territory, context) {
    const attackingStrength =
        combinedForce(attackers) *
        context.attackingDevelopmentIndex *
        context.combatContinentModifier *
        ATTACK_ADVANTAGE;

    const defendingStrength =
        combinedForce(defenders) *
        defenseMultiplierFor(territory) *
        areaBonusFor(territory);

    const total = attackingStrength + defendingStrength;
    //Two empty armies is a resolved battle, not a coin flip. Without this the caller gets
    //NaN and every later round inherits it.
    return total > 0 ? (attackingStrength / total) * 100 : 0;
}

/**
 * The mean development index of the territories an attack is launched from.
 *
 * More developed attackers have an easier time of it. Averaged rather than summed so that
 * attacking from six poor territories is not automatically better than from one rich one.
 *
 * @param {object[]} attackingTerritories
 */
export function attackingDevelopmentIndex(attackingTerritories) {
    if (attackingTerritories.length === 0) {
        return 0;
    }
    const total = attackingTerritories.reduce(
        (sum, territory) => sum + parseFloat(territory.devIndex), 0);
    return total / attackingTerritories.length;
}
