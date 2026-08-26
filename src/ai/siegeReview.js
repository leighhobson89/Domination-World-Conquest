// What a besieging country does about a siege it already has.
//
// A siege used to be fire-and-forget. `runSiegeTurnFor()` rolled its hit and took its
// buildings, `calculatePopulationChange()` starved its garrison, and the country that laid
// it never looked at it again -- `siegesRunBy()` counted it, the count shrank next turn's
// siege budget, and that was the whole of the relationship. Nothing happened between the
// turn a siege opened and the turn it starved out or was arrested, and nothing about it
// appeared in the plan, which is how the gap was spotted.
//
// So every turn, for every siege it is running, a country now answers one question:
//
//   PRESS    the siege is working, or has not been given long enough to fail. Wait.
//   ASSAULT  the walls are down far enough that storming finishes it this turn rather
//            than in five. Only on odds that clear the campaign's attack floor by a
//            MARGIN, because a besieging army has no line of retreat -- it is already
//            committed, so a coin-flip assault loses it outright.
//   LIFT     the siege is achieving nothing, or the country needs the army at home.
//            Recall it and take the loss.
//
// Two orderings matter and both are deliberate. **A nearly-starved garrison is never
// stormed and never abandoned** -- the territory falls by itself next turn, so risking the
// army on an assault, or walking away from it, are both worse than waiting. And **patience
// is a trait, not a constant**: `style_of_war` is documented as "low favours sieges, high
// favours pressing on", so it is what decides how long a leader waits before giving up.
//
// Pure, like the rest of `src/ai/`: it takes the siege's own starting snapshots, the
// territory as it now stands, and the odds an assault would face. It reads no store, opens
// no window and resolves no battle -- `aiCalculations.js` carries the verdict out.

import { siegeReview as tuning } from "../config/balance.js";
import { Posture } from "./strategy.js";

/** What a review can conclude. */
export const SiegeVerdict = Object.freeze({
    PRESS: "Press",
    ASSAULT: "Assault",
    LIFT: "Lift"
});

/**
 * How far a siege has worn its target down, on 0..1.
 *
 * The mean of the three things a siege actually damages, each measured against the
 * snapshot taken when the siege opened: the population it is starving, the food capacity
 * it is destroying, and the defence bonus its damage to forts erodes. A mean rather than
 * any one of them because they move at different rates and a siege that has flattened the
 * forts but not yet touched the population is genuinely half way there.
 *
 * A starting value of zero contributes nothing rather than dividing by zero -- a territory
 * with no forts to begin with has no defence bonus to wear away, which is not progress.
 */
export function siegeProgress(siege, target) {
    if (!siege || !target) {
        return 0;
    }

    const pairs = [
        [siege.startingTerritoryPop, target.territoryPopulation],
        [siege.startingFoodCapacity, target.foodCapacity],
        [siege.startingDefenseBonus, target.defenseBonus]
    ];

    let measured = 0;
    let total = 0;
    for (const [start, now] of pairs) {
        const from = Number(start);
        const to = Number(now);
        if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to)) {
            continue;
        }
        measured += 1;
        total += clamp01(1 - to / from);
    }

    return measured === 0 ? 0 : total / measured;
}

/**
 * Review one siege this country is running.
 *
 * @param {{siege: object, target: object, campaign?: object, traits?: object,
 *          assaultOdds?: number}} input
 *        `assaultOdds` is the probability the besieging army would win if it stormed the
 *        territory as it now stands -- injected rather than derived, because the
 *        calculation lives in `battle.js` and this module runs in Node.
 * @returns {{verdict: string, reason: string, target: string, turnsInSiege: number,
 *            progress: number, assaultOdds: number}}
 */
export function reviewSiege(input) {
    const siege = input?.siege ?? null;
    const target = input?.target ?? null;

    //A review that threw would take the AI turn with it, and one that defaulted to LIFT
    //would dissolve real sieges on a missing field. Doing nothing is the safe default.
    if (!siege || !target) {
        return verdict(SiegeVerdict.PRESS, "no siege data to review", siege, target, 0, 0);
    }

    const campaign = input?.campaign ?? null;
    const traits = input?.traits ?? {};
    const odds = Number(input?.assaultOdds) || 0;
    const turns = Number(siege.turnsInSiege) || 0;
    const progress = siegeProgress(siege, target);
    const percent = Math.round(progress * 100);

    //--- ABOUT TO FALL ----------------------------------------------------------------
    if (progress >= tuning.starvationImminent) {
        return verdict(SiegeVerdict.PRESS,
            "the garrison is " + percent + "% spent and will not last -- nothing to gain by storming it",
            siege, target, progress, odds);
    }

    //--- WORTH STORMING? --------------------------------------------------------------
    const attackFloor = Number(campaign?.attackOddsFloor) || 34;
    const stormAt = attackFloor + tuning.assaultOddsMargin;
    if (odds >= stormAt) {
        return verdict(SiegeVerdict.ASSAULT,
            "walls " + percent + "% worn down and an assault now runs at " + Math.round(odds) +
            "%, clear of the " + Math.round(stormAt) + "% a committed army needs",
            siege, target, progress, odds);
    }

    //--- WORTH CONTINUING? ------------------------------------------------------------
    const stalled = progress < tuning.stalledProgress;

    //`style_of_war` is low for a leader who favours sieges, so the patient end of the
    //trait is the one that waits longest before writing the siege off.
    const style = finiteOr(traits.style_of_war, 0.5);
    const patience = tuning.basePatienceTurns + Math.round(tuning.patienceSwing * (1 - style));

    if (stalled && turns >= patience) {
        return verdict(SiegeVerdict.LIFT,
            turns + " turns and the defender is only " + percent +
            "% worn down -- the army is worth more at home",
            siege, target, progress, odds);
    }

    const siegeFloor = Number(campaign?.siegeOddsFloor) || 22;
    if (turns >= tuning.hopelessAfterTurns && odds < siegeFloor) {
        return verdict(SiegeVerdict.LIFT,
            "the garrison now outguns the besiegers -- an assault runs at " + Math.round(odds) +
            "%, under the " + Math.round(siegeFloor) + "% floor this siege was opened on",
            siege, target, progress, odds);
    }

    //A country with a fifth of itself besieged has better uses for an army than a siege
    //that is going nowhere. It does not abandon one that is nearly won: that case was
    //answered at the top.
    if (campaign?.posture === Posture.DEFEND && turns >= tuning.defendRecallTurns &&
        progress < tuning.starvationImminent / 2) {
        return verdict(SiegeVerdict.LIFT,
            "recalled to defend the country -- " + percent + "% worn down after " + turns + " turns",
            siege, target, progress, odds);
    }

    return verdict(SiegeVerdict.PRESS,
        "turn " + turns + " of the siege, defender " + percent + "% worn down",
        siege, target, progress, odds);
}

function verdict(kind, reason, siege, target, progress, odds) {
    return {
        verdict: kind,
        reason,
        target: target?.territoryName ?? "unknown",
        defender: target?.dataName ?? "unknown",
        source: siege?.attackingTerritory ?? "unknown",
        turnsInSiege: Number(siege?.turnsInSiege) || 0,
        progress: Number(progress.toFixed(3)),
        assaultOdds: Math.round(odds)
    };
}

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
