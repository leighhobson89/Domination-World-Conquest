// Whether a particular territory is worth fighting for, and which way to fight for it.
//
// This replaces the two coin flips that used to decide it. `getPossibleTurnGoals()` in
// `goals.js` did, for every reachable enemy territory:
//
//     const considerSiege = rng() >= styleOfWar;
//     let considerWar = rng() <= territoryExpansion;
//
// -- so an AI besieged roughly `1 - style_of_war` of everything it could see, every turn,
// regardless of whether the target mattered, whether it could finish the siege, or whether
// it already had thirty running. It could also emit a Siege AND an Attack against the same
// target and let `removeDoubleAttackSiege()` throw one away arbitrarily.
//
// A rating answers three questions in order, and stops at the first "no":
//
//   CAN IT?      the odds have to clear a floor set by the leader's type and
//                `style_of_war`, and lifted again when the country is defending or
//                developing. A siege has a lower floor than an attack, because a siege is
//                the answer to a target too strong to storm.
//   SHOULD IT?   the target has to be worth having. `campaignWeightForTarget()` is where
//                the objective enters: a territory on the continent the country is
//                finishing is worth several times one that is nowhere near it, and a
//                territory that would COMPLETE a continent is worth several times again.
//   WHICH WAY?   attack when the odds are comfortably clear and the target is not heavily
//                fortified; besiege when the odds are thin or the walls are high, and only
//                while there is siege budget left.
//
// One verdict per target, so the two goal types can no longer contradict each other.
//
// Pure. Takes territories and numbers, returns a verdict; it reads no store and draws no
// randomness, which is what makes the whole "pick your battles" policy testable in Node.

import {
    campaignTargetWeights,
    doctrineTargeting,
    maxForts,
    PLAYER_GRACE_TURNS
} from "../config/balance.js";
import { campaignWeightForTarget, Posture } from "./strategy.js";
import { debugPlanReach } from "./debugPlans.js";
import { territoryValue } from "./value.js";

//Re-exported rather than moved outright: `territoryValue()` is part of this module's public
//story ("SHOULD IT?"), and both the unit suite and `strategy.js` already name it here. Its
//body moved to `value.js` only so that `theatre.js` can use it without closing an import
//cycle back through this file.
export { territoryValue };

/**
 * Percentage points added to both odds floors per previous defeat against a target.
 *
 * Three defeats therefore demand odds a good deal better than the first attempt did, which
 * is what stops a country grinding itself away against the same territory.
 */
const SETBACK_ODDS_PENALTY = 12;

/** What a rating can say. `Skip` is a first-class answer and the common one. */
export const Verdict = Object.freeze({
    ATTACK: "Attack",
    SIEGE: "Siege",
    SKIP: "Skip"
});

/**
 * Rate one (source territory, target territory) pairing.
 *
 * @param {{target: object, source: object, probability: number, threatScore: number,
 *          campaign: object, traits: object, country: string,
 *          targetAlreadyBesieged?: boolean}} input
 * @returns {{verdict: string, score: number, reason: string, value: number, weight: number}}
 */
export function rateTarget(input) {
    const {
        target,
        source,
        probability = 0,
        threatScore = 0,
        campaign,
        traits = {},
        country,
        targetAlreadyBesieged = false
    } = input;

    if (!target || !source) {
        return skip("no territory");
    }

    //THE PLAYER'S GRACE PERIOD. The AI plans its first turn with full information and there
    //are 206 of it, so a player who chose a one-territory country is reachable by several at
    //once on turn 1 and could be eliminated inside ten turns without ever taking a decision
    //that mattered. It is refused HERE, before the odds are even looked at, because this is
    //the one place a target is declined with a stated reason -- the AI debug window and the
    //plan log both read `reason`, so a target that vanished for five turns says why it did.
    //
    //Deliberately one-directional and deliberately narrow: the player may attack throughout,
    //nothing in the battle model changes, and a siege already standing is untouched, because
    //this refuses the OPENING of an interaction and not the continuation of one.
    if (target.owner === "Player" && (campaign?.turn ?? Infinity) <= PLAYER_GRACE_TURNS) {
        return skip("the player is inside the opening grace period (turn " +
            (campaign?.turn ?? "?") + " of " + PLAYER_GRACE_TURNS + ")");
    }

    //AN INJECTED PLAN, if this target is the objective OR a step on the route towards it. It
    //is read off the campaign rather than looked up, because `strategy.js` is the one place a
    //plan enters the AI -- see `applyDebugPlan()`. `injected` is null on every ordinary turn
    //of every ordinary game, and the four tests below then cost nothing.
    //
    //THE CORRIDOR GETS THE SAME DISPENSATIONS AS THE OBJECTIVE, which is the whole of making
    //a distant plan achievable: a country that will forget a defeat and ignore its posture
    //for the Falkland Islands and for nothing on the way there gets as far as Panama and
    //stops, having done everything the plan asked of it.
    const reach = debugPlanReach(campaign, target);
    const injected = reach?.strength ?? null;

    //What it has already tried and lost. An AI with no memory of the last attempt re-derives
    //the same threat, gets the same odds and makes the same decision, so it attacks the
    //territory that just beat it every turn for the rest of the game. Each defeat raises the
    //bar it has to clear. An injected plan at PRESS or above forgets the lot: "go at it
    //again" is precisely the instruction, and this memory is what would refuse it.
    //
    //It is read ONCE, here, because it is used twice -- as a penalty on the attack floor and
    //as its own refusal further down -- and the two disagreeing is how a target ends up
    //declined for a reason the panel does not print.
    const failures = injected?.ignoreSetbacks
        ? 0
        : (campaign?.failuresAgainst?.(target.territoryName) ?? 0);

    const odds = Number(probability) || 0;
    const attackFloor = (campaign?.attackOddsFloor ?? 34) + failures * SETBACK_ODDS_PENALTY;
    const siegeFloor = campaign?.siegeOddsFloor ?? 22;

    //--- SHOULD IT? -------------------------------------------------------------------
    const weight = campaignWeightForTarget(campaign, target);
    let value = territoryValue(target) * weight;

    if (target.originalOwner && target.originalOwner === country) {
        const reconquista = finiteOr(traits.reconquista, 0.5);
        value *= 1 + (campaignTargetWeights.reconquista - 1) * reconquista;
    }

    //--- AND WHAT THE GOAL ASKS FOR ---------------------------------------------------
    //Two terms, both from the doctrine, and both are the reason a goal produces a
    //different world rather than a differently-labelled one.
    const doctrine = campaign?.doctrine ?? null;
    if (doctrine) {
        //LAND. `territoryValue()` already has an area term, weighted for what owning a
        //place does for your economy. This is the second question a goal scored in area
        //asks: how much of the MAP is it. Domination and a Timed Game are decided on land
        //area, so they should prefer Russia to a Caribbean island in a way Continental
        //Supremacy -- which counts territories -- should not.
        const area = Math.min(1,
            (Number(target.area) || 0) / doctrineTargeting.areaSaturation);
        value *= 1 + area * finiteOr(doctrine.areaHunger, 0);

        //THE ANTAGONIST. Under Great Powers the ground that matters is whatever a target
        //power ORIGINALLY owned, whoever holds it now -- that is what keeps the goal
        //achievable when a third party takes half of the United States first, and turns it
        //into a different war rather than an impossible one.
        if (target.originalOwner &&
            doctrine.targetCountries.includes(target.originalOwner)) {
            value *= doctrineTargeting.homelandWeight;
        }
    }
    if (targetAlreadyBesieged) {
        //A besieged territory is nobody's to plan against from here. The game refuses
        //every interaction with one -- `calculateArmyQuantityBeingSentOrIfCancelling
        //Interaction()` cancels an attack or a siege on any territory in either siege
        //list -- so an ATTACK verdict was a goal that could never be carried out, and it
        //cost the source territory its one attack for the turn on the way to being
        //thrown away. If the siege is this country's OWN, what happens next is
        //`siegeReview.js`'s decision and it is taken before goals are planned; if it is
        //somebody else's, there is nothing to decide. Either way this is where the
        //ordinary target list stops.
        return skip("already besieged -- the siege decides this one, not an attack",
            value * campaignTargetWeights.opportunism, weight);
    }

    //A target that is itself a THREAT is worth taking even off-objective: `threatScore`
    //is positive when the enemy territory outguns ours, and leaving that next door is how
    //a country loses the continent it was campaigning for.
    const menace = threatScore > 0 ? 1 + Math.min(1, threatScore / (Math.abs(source.armyForCurrentTerritory) + 1)) : 1;
    value *= menace;

    //--- CAN IT? ----------------------------------------------------------------------
    //A second attempt needs materially better odds than the first and a fourth is
    //effectively off the table -- until the memory decays, or the odds genuinely improve
    //because the country built an army. `failures` is read above; see the note there.
    const setbackPenalty = failures * SETBACK_ODDS_PENALTY;
    if (failures > 0 && odds < siegeFloor + setbackPenalty) {
        return skip(
            "lost here " + failures + " time(s) already and " + Math.round(odds) +
            "% is no better than it was",
            value, weight);
    }

    if (odds < siegeFloor && !injected?.ignoreHardFloor) {
        return skip("odds " + Math.round(odds) + "% below the siege floor of " + Math.round(siegeFloor) + "%", value, weight);
    }

    const offTheObjective = campaign && target.continent &&
        !campaign.objective.continents.includes(target.continent);

    //Consolidating means finishing what you started. A country one continent away from a
    //victory condition does not open a front on another one unless the target is a real
    //threat to what it already holds.
    //An injected plan at PRESS or above overrides both refusals. Being told to take a place
    //and then declining it because the campaign was consolidating somewhere else is the
    //commonest way a debug instruction would appear to do nothing.
    if (!injected?.ignorePosture) {
        if (offTheObjective && campaign?.posture === Posture.CONSOLIDATE && threatScore <= 0) {
            return skip("off the objective while consolidating " + campaign.focusContinent, value, weight);
        }
        if (offTheObjective && campaign?.posture === Posture.DEFEND) {
            return skip("off the objective while defending", value, weight);
        }
    }

    //--- WHICH WAY? -------------------------------------------------------------------
    const style = finiteOr(traits.style_of_war, 0.5);
    const forts = Number(target.fortsBuilt) || 0;
    const heavilyFortified = forts >= Math.ceil(maxForts / 2);

    //`score` is the number the prioritiser ranks by: what the target is worth, discounted
    //by how likely the attempt is to come off.
    const score = value * (odds / 100);

    const canSiege = (campaign?.siegeBudget ?? 0) > 0;
    const clearlyWinnable = odds >= attackFloor;

    //THROWING CAUTION TO THE WIND IS AN ASSAULT, NOT A SIEGE. At the top tier the odds have
    //stopped being the question, and a siege is the patient answer to a target that cannot
    //be stormed -- it ties the army up for turns and is the opposite of what was asked for.
    //Below that tier the ordinary attack-or-besiege judgement stands, which is what makes
    //the lower tiers "slide into the existing logic" rather than replace it.
    if (injected?.commitAll) {
        return {
            verdict: Verdict.ATTACK,
            score,
            value,
            weight,
            reason: "injected plan at " + injected.label.toLowerCase() + " -- storming at " +
                Math.round(odds) + "% whatever the floor says"
        };
    }

    if (clearlyWinnable && (!heavilyFortified || style > 0.6 || !canSiege)) {
        return {
            verdict: Verdict.ATTACK,
            score,
            value,
            weight,
            reason: "odds " + Math.round(odds) + "% clear the floor of " + Math.round(attackFloor) + "%"
        };
    }

    if (canSiege) {
        return {
            verdict: Verdict.SIEGE,
            //A siege is slower and ties an army up, so it ranks below an attack of the
            //same worth. Without this a country would prefer to besiege everything.
            score: score * 0.8,
            value,
            weight,
            reason: heavilyFortified
                ? forts + " forts -- worth besieging rather than storming"
                : "odds " + Math.round(odds) + "% too thin to storm"
        };
    }

    return skip("no siege budget left and the odds will not carry an assault", value, weight);
}

/**
 * Rank a set of ratings and cut them to the campaign's budgets.
 *
 * The budget is applied AFTER ranking, so what survives is the best of what was possible
 * rather than the first few the map happened to be walked in.
 */
export function withinBudget(ratings, campaign) {
    const sorted = [...ratings].sort((a, b) => b.score - a.score);
    let attacks = campaign?.attackBudget ?? Infinity;
    let sieges = campaign?.siegeBudget ?? Infinity;

    return sorted.filter(rating => {
        if (rating.verdict === Verdict.ATTACK) {
            return attacks-- > 0;
        }
        if (rating.verdict === Verdict.SIEGE) {
            return sieges-- > 0;
        }
        return false;
    });
}

function skip(reason, value = 0, weight = 1) {
    return { verdict: Verdict.SKIP, score: 0, value, weight, reason };
}

function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
