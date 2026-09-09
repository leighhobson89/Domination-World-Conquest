// What an alliance pays, and why it is a dividend rather than a transfer.
//
// Diplomacy stage 5.3. Leigh's answer for what an alliance shares, in full: passage and
// stacking rights, a standing share of income, the same share of oil, construction materials
// and food, and shared intelligence. This is the economic half of it.
//
// IT IS A MUTUAL DIVIDEND AND NOT A TRANSFER, AND THAT IS THE DECISION TO READ FIRST. The
// design asks for "a standing share of income", and a share taken out of one treasury and put
// into another has to be WRITTEN onto a territory -- which means an exact inverse write the
// moment the alliance ends. That is the silent bug `continentBonus.js` exists to prevent (an
// ally who kept the income afterwards), and writes that create or destroy a quantity are the
// class of defect that has cost this project the most: known-issue BJ, and the free-attack
// bug before it, where every AI attack was free because a write-back restored the garrison.
//
// So both allies simply EARN MORE while the alliance stands. It is derived at the point of
// use and stored nowhere, so the instant the alliance ends the multiplier is 1 again and
// there is nothing to unwind. That is the same arrangement `effectiveCapacityFor()` already
// has with the continent bonus, and it is the reason that bonus has never gone wrong.
//
// SYMMETRIC, WHICH ANSWERS Q5. A percentage of a flow is worth more in absolute gold to the
// larger ally -- Leigh's standing rule that being large stays an advantage -- while the
// smaller ally gets the larger proportional lift, which is the nudge. A rule that made the
// strong subsidise the weak is the "price each upgrade against the territory's own income"
// idea that was proposed for the economy and turned down.
//
// TWO DIALS, NOT ONE, for the reason the continent bonus has two: gold multiplies a FLOW and
// the other three multiply CEILINGS, and a ceiling compounds into gold a few turns later
// while gold compounds into nothing.
//
// Pure: it imports `config/` and nothing else, so it runs in Node and `tools/econ-lab.mjs`
// can IMPORT it rather than carrying a copy -- a measuring instrument holding its own copy of
// the thing it measures will eventually measure the copy.

import { allianceShare } from "../../config/balance.js";

/**
 * How many allies count towards the benefit.
 *
 * Capped, and the cap is doing real work: without one an alliance web is a runaway, because
 * every signature raises the income of everybody in it, which pays for the army that wins the
 * game. Three is enough for an alliance to be worth having and few enough that a coalition
 * against a runaway leader stays a military fact rather than an economic one.
 */
export function countedAllies(allyCount) {
    const count = Math.max(0, Number(allyCount) || 0);
    return Math.min(count, allianceShare.maxAllies);
}

/** The multiplier on GOLD INCOME. 1 when a country has no allies. */
export function allianceGoldMultiplier(allyCount) {
    return 1 + countedAllies(allyCount) * allianceShare.gold;
}

/** The multiplier on the oil, construction-materials and food CEILINGS. */
export function allianceCapacityMultiplier(allyCount) {
    return 1 + countedAllies(allyCount) * allianceShare.capacity;
}
