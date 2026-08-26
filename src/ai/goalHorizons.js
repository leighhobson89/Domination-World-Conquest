// What an AI country is actually trying to do, over three horizons.
//
// Refactor plan Phase 7.4, the developer-facing half. The player-facing activity
// feed reports what HAPPENED; this reports what an AI INTENDS, and it goes to the
// console rather than to the screen. The two are deliberately separate: a feed
// that leaked the AI's plans would be a cheat, and a console that only repeated
// the outcomes would tell a developer nothing they could not read off the map.
//
// The problem it solves is that the AI turn already logs a great deal -- forty-odd
// lines per country, most of them about gold -- and none of it answers the
// question a developer actually has, which is "why did Libya do that?". The goal
// list exists (`goals.js` produces a ranked array), but it is a list of arrays of
// mixed shape, printed nowhere, and it only describes THIS turn.
//
// So this module derives three horizons from data the AI already has:
//
//   SHORT   what it will attempt this turn, in priority order -- the goal list,
//           read back as sentences.
//   MEDIUM  what that adds up to. Which enemy is taking the pressure, which of
//           its own territories it is reinforcing, and whether this is a fighting
//           turn or a building one.
//   LONG    the standing ambitions.
//
// When this file was written the AI had no explicit plan of any kind, so the medium
// term was a SUMMARY of the goal list and the long term was inferred from the world.
// It has one now -- `strategy.js` derives a campaign per country per turn -- so both
// take an optional campaign and report the real thing when they are given one:
// the posture it actually chose, the budgets it is working inside, the continents it
// has committed to under the active victory condition, and how far along it is. The
// derived-from-the-world versions are kept and are what a caller without a campaign
// still gets, which is what keeps the unit tests over this file meaningful.
//
// Pure, and imports only from `state/selectors.js`, so it runs in Node and is
// unit-tested there. `planLog.js` does the printing.

import { allTerritories } from "../state/selectors.js";

/** A goal row after refinement is `[count, type, ...fields]`. These name the parts. */
const GOAL_TYPE = 1;
const GOAL_TARGET = 2;
const GOAL_SOURCE = 3;

/**
 * One readable sentence per goal, in the order the AI will attempt them.
 *
 * `Economy` and `Bolster` are included here even though the activity FEED excludes
 * them -- the exclusion there is about what a player should see, and a developer
 * asking why a country did not attack needs to know it spent the turn building.
 */
export function shortTermGoals(refinedGoals, limit = 8) {
    return (refinedGoals ?? []).slice(0, limit).map((goal) => {
        const type = goal[GOAL_TYPE];
        const target = goal[GOAL_TARGET];
        const source = goal[GOAL_SOURCE];
        const weight = Number(goal[0]) || 0;

        switch (type) {
            case "Attack":
                return `Attack ${target} from ${source} (priority ${weight.toFixed(1)})`;
            case "Siege":
                return `Besiege ${target} from ${source} (priority ${weight.toFixed(1)})`;
            case "Bolster":
                return `Reinforce ${target} (priority ${weight.toFixed(1)})`;
            case "Economy":
                return `Develop ${target} (priority ${weight.toFixed(1)})`;
            default:
                return `${type} ${target}`;
        }
    });
}

/**
 * What this turn's goals add up to.
 *
 * @returns {{posture: string, pressureOn: string|null, holding: string[],
 *            counts: {attack: number, siege: number, bolster: number, economy: number}}}
 */
export function mediumTermPosture(refinedGoals, campaign = null) {
    const counts = { attack: 0, siege: 0, bolster: 0, economy: 0 };
    const pressure = new Map();
    const holding = [];

    for (const goal of refinedGoals ?? []) {
        const type = goal[GOAL_TYPE];
        const target = goal[GOAL_TARGET];

        if (type === "Attack" || type === "Siege") {
            counts[type.toLowerCase()] += 1;
            const owner = ownerOf(target);
            if (owner) {
                pressure.set(owner, (pressure.get(owner) ?? 0) + 1);
            }
        } else if (type === "Bolster") {
            counts.bolster += 1;
            if (!holding.includes(target)) {
                holding.push(target);
            }
        } else if (type === "Economy") {
            counts.economy += 1;
        }
    }

    const offensive = counts.attack + counts.siege;
    const defensive = counts.bolster;

    // Three postures, and the thresholds are stated rather than tuned: a country
    // with no offensive goal at all is building, one with more offence than defence
    // is on the front foot, anything else is holding what it has.
    //
    // This is the INFERRED posture, and it is only used when there is no campaign to
    // ask. With one, the country's actual choice is reported -- inferring it from the
    // goal list would occasionally contradict the plan that produced the list.
    let posture = "Holding";
    if (offensive === 0) {
        posture = "Building";
    } else if (offensive > defensive) {
        posture = "Advancing";
    }
    if (campaign?.posture) {
        posture = campaign.posture;
    }

    let pressureOn = null;
    let most = 0;
    for (const [country, count] of pressure) {
        if (count > most) {
            most = count;
            pressureOn = country;
        }
    }

    return {
        posture,
        pressureOn,
        holding: holding.slice(0, 5),
        counts,
        //Null without a campaign, which is how a caller tells the two apart.
        budgets: campaign
            ? {
                siege: campaign.siegeBudget,
                attack: campaign.attackBudget,
                activeSieges: campaign.activeSieges,
                concurrentSiegeCap: campaign.concurrentSiegeCap,
                attackOddsFloor: Math.round(campaign.attackOddsFloor)
            }
            : null,
        focusContinent: campaign?.focusContinent ?? null
    };
}

/**
 * The standing ambitions, derived from the world rather than from this turn's plan.
 *
 * @param {string} country  the AI country whose view this is
 * @returns {{reconquista: string[], nearestContinent: object|null, principalRival: object|null,
 *            territoriesHeld: number}}
 */
export function longTermAmbitions(country, campaign = null) {
    const territories = allTerritories();

    /** Territories this country started with and no longer holds. */
    const lost = [];
    /** Who holds them now, and how many each. */
    const takenBy = new Map();
    /** Continent -> { held, total } */
    const continents = new Map();

    let held = 0;

    for (const territory of territories) {
        const continentName = territory.continent ?? "Unknown";
        if (!continents.has(continentName)) {
            continents.set(continentName, { continent: continentName, held: 0, total: 0 });
        }
        const continent = continents.get(continentName);
        continent.total += 1;

        if (territory.dataName === country) {
            held += 1;
            continent.held += 1;
        } else if (territory.originalOwner === country) {
            lost.push(territory.territoryName);
            takenBy.set(territory.dataName, (takenBy.get(territory.dataName) ?? 0) + 1);
        }
    }

    // The continent it is closest to owning outright -- but only one it has a
    // foothold on. "Closest to holding Antarctica, 0 of 4" is not an ambition.
    let nearestContinent = null;
    for (const continent of continents.values()) {
        if (continent.held === 0 || continent.total === 0) {
            continue;
        }
        const share = continent.held / continent.total;
        if (!nearestContinent || share > nearestContinent.share) {
            nearestContinent = { ...continent, share };
        }
    }

    let principalRival = null;
    for (const [rival, count] of takenBy) {
        if (!principalRival || count > principalRival.count) {
            principalRival = { country: rival, count };
        }
    }

    return {
        territoriesHeld: held,
        reconquista: lost.slice(0, 6),
        reconquistaTotal: lost.length,
        nearestContinent,
        principalRival,
        //The actual objective, when there is one. `nearestContinent` above is where the
        //country happens to be strongest; this is where it has decided to go, and the two
        //are different facts -- a country commits to a continent it is NOT yet strongest
        //on often enough that reporting only the first would be misleading.
        objective: campaign?.objective ?? null,
        progress: campaign?.progress ?? null
    };
}

/** Who holds the territory with this name, or null. */
function ownerOf(territoryName) {
    for (const territory of allTerritories()) {
        if (territory.territoryName === territoryName) {
            return territory.dataName;
        }
    }
    return null;
}

/**
 * All three horizons in one object, which is what `planLog.js` prints.
 *
 * @param {{country: string, leader: object, refinedGoals: Array}} view
 */
export function summariseGoalHorizons({ country, leader, refinedGoals, campaign = null }) {
    return {
        country,
        leaderName: leader?.name ?? "unknown",
        leaderType: leader?.leaderType ?? "unknown",
        shortTerm: shortTermGoals(refinedGoals),
        mediumTerm: mediumTermPosture(refinedGoals, campaign),
        longTerm: longTermAmbitions(country, campaign)
    };
}
