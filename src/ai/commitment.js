// How much of a garrison to commit to an attack -- and whether to make it at all.
//
// This is the decision that turned the AI's plans into losses. Everything upstream of it is
// careful: `targeting.js` demands the odds clear a floor set by the leader's personality,
// `strategy.js` rations how many attacks a country may press, and the odds they both read are
// computed from the attacking territory's WHOLE garrison. Then the executor sized the actual
// force like this:
//
//     for (every enemy territory in range of the COUNTRY)
//         threatArray.push(thatThreat - thisTerritoryDefenseScore);
//     amountCanSend = mean(threatArray);
//
// -- the average of every threat facing the whole country, minus one territory's defence,
// used as a number of soldiers. It is not a quantity of anything. Worse, it decides the
// attack in both directions: at or above zero the interaction is cancelled as too dangerous,
// and when the country's neighbours are weak it goes so far negative that the AI tries to
// send more than the territory owns, and cancels again. In between, it commits a force with
// no relation to the target and presses on at `probability >= 1` -- a floor the planner would
// never have accepted. Measured over a hundred turns: twelve failed attacks a turn against
// two conquests, the same borders, turn after turn.
//
// So the AI was not failing to plan. It was failing to send what it had planned with, and
// then learning nothing, because the plan and the battle were two different battles.
//
// The replacement answers two questions in order, and both are honest quantities:
//
//   WHAT CAN LEAVE?   the garrison a territory can spare is its army less what the worst
//                     threat ON THAT BORDER requires -- a local fact, not a national average.
//                     Personality moves it: an aggressive leader strips a border thinner than
//                     a pacifist, which is what the trait is FOR.
//   HOW MUCH GOES?    the SMALLEST commitment out of that which clears the campaign's odds
//                     floor, found by asking the real probability function. Smallest, not
//                     largest: an army that wins by a hair and leaves three divisions at home
//                     has won twice. If nothing available clears the floor, the attack is
//                     cancelled and SAID SO, which is what lets the country remember that
//                     this border is not worth another try.
//
// Pure. It takes numbers and two callbacks and returns a decision; the odds function and the
// composition function are injected because both live in `battle.js` and `aiCalculations.js`,
// which import the UI. That is the same arrangement `goals.js` uses and it is what keeps this
// testable in Node.

import { commitmentDiscipline } from "../config/balance.js";

/**
 * The garrison a territory must keep to hold itself, in the same units as an army.
 *
 * `localEnemyPower` is the army power of the strongest enemy territory that can actually
 * reach this one -- a QUANTITY, not a comparison. The first version of this module used the
 * threat SCORE instead, which is a difference between two armies inflated by the attacking
 * leader's personality, and the result was a decision that could not be made: between two
 * comparable neighbours the score sits near zero, so the surplus was near zero, so nothing
 * could ever be spared. Measured: two hundred and eight sieges decided upon across the world
 * in one turn and not one of them laid.
 *
 * Less than the enemy's power is kept, and deliberately: the defender is the one with the
 * forts, the mountains and the ground, so holding a border does not take as much as
 * assaulting one. That asymmetry is what makes an attack possible at all.
 */
export function garrisonNeeded(army, localEnemyPower) {
    const total = Math.max(0, Number(army) || 0);
    const enemy = Number(localEnemyPower);
    if (!Number.isFinite(enemy) || enemy <= 0) {
        //Nothing can reach this territory. It still keeps a token garrison, because a
        //conquest elsewhere can put it on a border overnight.
        return Math.floor(total * commitmentDiscipline.interiorReserve);
    }
    return Math.min(total, enemy * commitmentDiscipline.defenceKeepRatio);
}

/**
 * How much of a territory's army may leave it.
 *
 * @param {{army: number, localEnemyPower: number, leaderType?: string, traits?: object}} input
 * @returns {number} personnel-worth that may be committed, never more than the army present
 */
export function disposableForce({ army, localEnemyPower, leaderType = "balanced", traits = {} }) {
    const total = Math.max(0, Number(army) || 0);
    if (total === 0) {
        return 0;
    }

    const tuning = commitmentDiscipline;
    const style = finiteOr(traits.style_of_war, 0.5);
    const expansion = finiteOr(traits.territory_expansion, 0.5);

    //How much of the surplus a leader is willing to march out with. The traits are the ones
    //documented for it: `style_of_war` high favours pressing an attack, `territory_expansion`
    //is the standing appetite for taking ground.
    const appetite = clamp(
        (tuning.baseAppetite[leaderType] ?? tuning.baseAppetite.balanced) +
        (style - 0.5) * tuning.styleSwing +
        (expansion - 0.5) * tuning.expansionSwing,
        tuning.minimumAppetite, tuning.maximumAppetite);

    const surplus = total - garrisonNeeded(total, localEnemyPower);

    if (surplus <= 0) {
        //Outgunned on this border. Sending anything is a gamble with the territory itself,
        //so only the leaders whose whole character is the gamble take it, and only with the
        //slice they would not miss.
        const reckless = (leaderType === "aggressive" && style > 0.5) ? tuning.recklessShare : 0;
        return Math.floor(total * reckless);
    }

    return Math.floor(surplus * appetite);
}

/**
 * The smallest commitment out of `disposable` whose odds clear `floor`.
 *
 * Walks the ladder from the smallest share upward and stops at the first rung that clears,
 * so a country does not empty a province to win a battle it could have won with half. The
 * ladder is coarse on purpose: each rung costs one call to the real probability calculation,
 * and this runs for every attack every country considers, every turn.
 *
 * @param {{disposable: number, floor: number, oddsFor: (amount: number) => number}} input
 * @returns {{amount: number, odds: number, cleared: boolean, best: number}}
 */
export function sizeCommitment({ disposable, floor, oddsFor }) {
    const available = Math.floor(Math.max(0, Number(disposable) || 0));
    if (available <= 0) {
        return { amount: 0, odds: 0, cleared: false, best: 0 };
    }

    let best = 0;
    let bestAmount = 0;

    for (const share of commitmentDiscipline.ladder) {
        const amount = Math.floor(available * share);
        if (amount <= 0) {
            continue;
        }
        const odds = Number(oddsFor(amount)) || 0;
        if (odds > best) {
            best = odds;
            bestAmount = amount;
        }
        if (odds >= floor) {
            return { amount, odds, cleared: true, best: odds };
        }
    }

    //Nothing available clears the floor. The BEST it could manage is returned rather than
    //thrown away, because "we could only reach 19% against a floor of 34%" is the sentence
    //that tells the country to go somewhere else -- and a bare "cancelled" does not.
    return { amount: bestAmount, odds: best, cleared: false, best };
}

/**
 * The whole decision: what to send at this target, or why nothing is going.
 *
 * @param {{army: number, localThreat: number, floor: number, leaderType?: string,
 *          traits?: object, oddsFor: (amount: number) => number, targetName?: string}} input
 * @returns {{commit: boolean, amount: number, odds: number, reason: string}}
 */
export function decideCommitment(input) {
    const disposable = disposableForce(input);
    const target = input?.targetName ?? "the target";

    if (disposable <= 0) {
        //A fact about THIS TURN -- the border is busy -- not about the target. It is
        //reported with its own code because the caller must not remember it as a defeat:
        //a country that wrote off every neighbour it was briefly too stretched to attack
        //would run out of neighbours it was willing to look at within a few turns.
        return {
            commit: false, amount: 0, odds: 0, reasonCode: "no-force",
            reason: "nothing to spare -- the border facing " + target + " needs the whole garrison"
        };
    }

    const floor = Number(input?.floor) || 0;
    //Aim above the floor, not at it. The floor is the leader's appetite for risk; the aim is
    //how much force makes the attempt worth the army. `aimAt` lets a siege ask for its own
    //floor and nothing more, because a siege does not have to win a battle today.
    const aim = Math.max(floor, Math.min(Number(input?.aimAt) || commitmentDiscipline.decisiveOdds, 95));
    const sized = sizeCommitment({ disposable, floor: aim, oddsFor: input.oddsFor });

    if (sized.cleared) {
        return {
            commit: true,
            amount: sized.amount,
            odds: sized.odds,
            reasonCode: "committed",
            reason: "committing " + sized.amount + " for " + Math.round(sized.odds) + "% against " + target
        };
    }

    //Short of the aim, but past the floor the leader will fight on. Two answers, and which
    //one is right depends on whether this is a war or a raid: a country that has COMMITTED
    //to absorbing this neighbour presses at odds it would refuse from a stranger, because
    //the alternative to a hard attack in a war you have chosen is not a better attack, it is
    //no war. Everybody else waits and asks for the troops to do it properly.
    if (sized.best >= floor) {
        if (input?.pressOnBelowAim) {
            return {
                commit: true,
                amount: sized.amount,
                odds: sized.best,
                reasonCode: "committed",
                reason: "pressing the war against " + target + " at " + Math.round(sized.best) +
                    "%, under the " + Math.round(aim) + "% wanted but over the " + Math.round(floor) + "% floor"
            };
        }
        return {
            commit: false, amount: 0, odds: sized.best, reasonCode: "needs-more-force",
            shortfall: aim - sized.best,
            reason: "only " + Math.round(sized.best) + "% against " + target + " with what this border can spare" +
                " -- " + Math.round(aim - sized.best) + " points short, so send troops rather than men"
        };
    }

    //A fact about the two ARMIES, and the one worth remembering: everything this border can
    //spare was weighed and it does not even reach the floor.
    return {
        commit: false, amount: 0, odds: sized.best, reasonCode: "below-floor",
        shortfall: aim - sized.best,
        reason: "the most this territory can spare reaches only " + Math.round(sized.best) +
            "% against " + target + ", under the " + Math.round(floor) + "% this leader will fight on"
    };
}

function clamp(value, low, high) {
    return Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));
}

function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
