// Printing what an AI country is trying to do, for whoever is holding the console.
//
// Phase 7.4. The AI turn already logs around forty lines per country and none of
// them answer "why did that country do that" -- they are a running commentary on
// gold. This is the header that makes the rest of them legible: one collapsed
// group per country, with its plan at three horizons inside it.
//
// It is `console.groupCollapsed`, deliberately. Two hundred and six countries take
// a turn; two hundred and six expanded reports is worse than no report at all, and
// a collapsed group is one line until it is wanted. Where grouping is unavailable
// -- a piped console, some test runners -- the fallbacks below degrade to plain
// lines rather than throwing, because a logging helper must never be what breaks
// the AI turn.
//
// This file is the only one in `src/ai/` that does I/O, which is why it is
// separate from `goalHorizons.js`: the derivation is pure and unit-tested, the
// printing is not testable and does not need to be.

import { summariseGoalHorizons } from "./goalHorizons.js";
import { recordPlan } from "./planRecord.js";

/** Console styling. Muted for structure, accent for the country, red for a rival. */
const HEADING = "color: #7fc4e8; font-weight: bold;";
const LABEL = "color: #9db4c6;";
const RIVAL = "color: #d0463b;";

function group(label, style) {
    if (typeof console.groupCollapsed === "function") {
        console.groupCollapsed(label, style);
    } else {
        console.log(label, style);
    }
}

function endGroup() {
    if (typeof console.groupEnd === "function") {
        console.groupEnd();
    }
}

/**
 * Report one country's plan.
 *
 * Called from the AI turn once the goals are refined and prioritised, and BEFORE
 * they are carried out -- a plan reported after the fact is a summary, and the
 * point of this is to be able to compare the intent with what followed.
 *
 * @param {{country: string, leader: object, refinedGoals: Array, turn: number,
 *          campaign?: object}} view
 */
export function logAiPlan({ country, leader, refinedGoals, turn, campaign = null }) {
    const plan = summariseGoalHorizons({ country, leader, refinedGoals, campaign });
    const { mediumTerm, longTerm } = plan;

    group(
        `%cTurn ${turn} — ${country} (${plan.leaderName}, ${plan.leaderType}) — ${mediumTerm.posture}`,
        HEADING
    );

    console.log(
        "%cSHORT TERM (this turn)",
        LABEL
    );
    if (plan.shortTerm.length === 0) {
        console.log("  nothing to attempt — no enemy territory in range");
    } else {
        for (const line of plan.shortTerm) {
            console.log("  " + line);
        }
    }

    //The sieges this country was already running, and what it decided about each. Printed
    //between the plan and the posture because that is where it belongs in the turn: these
    //were reviewed BEFORE anything else was planned, and an assault or a lift here is what
    //the rest of the turn was then planned around.
    const reviews = campaign?.siegeReviews ?? [];
    if (reviews.length > 0) {
        console.log("%cSIEGES ALREADY RUNNING", LABEL);
        for (const review of reviews) {
            console.log("  " + review.verdict.toUpperCase() + " " + review.target +
                " (turn " + review.turnsInSiege + ", " + Math.round(review.progress * 100) +
                "% worn down, assault would run at " + review.assaultOdds + "%) -- " + review.reason);
        }
    }

    console.log("%cMEDIUM TERM (what that adds up to)", LABEL);
    console.log(
        `  Posture: ${mediumTerm.posture}` +
        ` (${mediumTerm.counts.attack} attack, ${mediumTerm.counts.siege} siege,` +
        ` ${mediumTerm.counts.bolster} reinforce, ${mediumTerm.counts.economy} develop)`
    );
    if (mediumTerm.focusContinent) {
        console.log(`  Pushing on: ${mediumTerm.focusContinent}`);
    }
    if (mediumTerm.budgets) {
        //The budgets are the answer to "why did it not attack?", which is the question a
        //developer asks most often of a quiet AI turn, so they are printed even when they
        //are zero -- especially when they are zero.
        const budgets = mediumTerm.budgets;
        console.log(
            `  Affordable this turn: ${budgets.attack} attack(s), ${budgets.siege} new siege(s)` +
            ` (${budgets.activeSieges} of ${budgets.concurrentSiegeCap} concurrent sieges already running)`
        );
        console.log(`  Will not attack below ${budgets.attackOddsFloor}% odds`);
    }
    if (mediumTerm.pressureOn) {
        console.log(`  Pressing hardest against: ${mediumTerm.pressureOn}`);
    }
    if (mediumTerm.holding.length > 0) {
        console.log(`  Shoring up: ${mediumTerm.holding.join(", ")}`);
    }

    console.log("%cLONG TERM (standing ambitions)", LABEL);
    console.log(`  Holds ${longTerm.territoriesHeld} territories`);
    if (longTerm.objective) {
        const objective = longTerm.objective;
        console.log(
            `  Objective (${objective.kind}): ${objective.continents.join(", ") || "none chosen"}` +
            (objective.banked.length > 0 ? ` — holds ${objective.banked.join(", ")} outright` : "")
        );
    }
    if (longTerm.progress) {
        console.log(`  Progress: ${longTerm.progress.label} (${Math.round(longTerm.progress.fraction * 100)}%)`);
    }
    if (longTerm.nearestContinent) {
        const { continent, held, total } = longTerm.nearestContinent;
        console.log(
            `  Closest continent: ${continent} — ${held} of ${total}` +
            (held === total ? " (COMPLETE)" : "")
        );
    }
    if (longTerm.reconquistaTotal > 0) {
        console.log(
            `  Wants back (${longTerm.reconquistaTotal}): ${longTerm.reconquista.join(", ")}` +
            (longTerm.reconquistaTotal > longTerm.reconquista.length ? ", …" : "")
        );
    }
    if (longTerm.principalRival) {
        console.log(
            `%c  Principal rival: ${longTerm.principalRival.country}` +
            ` (holds ${longTerm.principalRival.count} of its former territories)`,
            RIVAL
        );
    }

    endGroup();

    //The same view, kept for the in-game debug panel (numpad /). The console is fine for
    //one country you already know the name of; the panel is for the question a strategic
    //AI actually provokes, which is "what is it thinking?" across the last few countries
    //at once, with the reason each target was taken or left alone.
    recordPlan({
        country,
        turn,
        leader,
        campaign,
        shortTerm: plan.shortTerm,
        mediumTerm: plan.mediumTerm,
        longTerm: plan.longTerm
    });

    return plan;
}
