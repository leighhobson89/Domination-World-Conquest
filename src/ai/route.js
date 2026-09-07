// How far away something is, over the graph the game actually lets armies cross.
//
// WHY THIS HAD TO EXIST. An injected plan (`debugPlans.js`) started life as a weight and a
// set of floors applied in `rateTarget()`, and `rateTarget()` is only ever called on
// pairings that already exist -- an enemy territory ADJACENT to one of ours. So telling the
// United States to take the Falkland Islands did precisely nothing: no pairing between them
// is ever weighed, the plan was never consulted, and the country carried on choosing its own
// targets while the panel cheerfully reported a plan in force. It would have come true only
// if the United States happened, by its own reasoning, to conquer its way to the South
// Atlantic, at which point the plan would have taken the credit.
//
// That is the difference between an objective and a wish, and it is the same distinction
// `commitment.js` records about sizing an attack: a plan that cannot be acted on from where
// you are standing is not a plan.
//
// WHAT THIS DOES INSTEAD. One breadth-first search per plan per turn, seeded at the
// objective and run OUTWARDS, which gives every territory on the map its distance from the
// objective in conquests. The country's own distance is the smallest of those over the
// ground it holds, and from that two things fall out for free:
//
//   THE CORRIDOR   an enemy territory is on the route exactly when taking it would bring the
//                  country strictly CLOSER -- `distance < ourBest`. That is one comparison,
//                  it needs no path to be stored, and it is automatically re-derived every
//                  turn, so a corridor that is blocked by a conquest somewhere else simply
//                  becomes a different corridor next turn rather than a stale plan.
//   THE STAGING    the country's own territory nearest the objective. It is handed to
//                  `muster.js` as the spearhead, so the interior walks its infantry towards
//                  the front of the corridor over the turns it takes to get there. That is
//                  the "reinforce the territories on the way" half, and without it the
//                  country reaches the corridor with one province's garrison and stops.
//
// THE SEARCH IS OVER `getInteractableFrom`, NOT OVER GEOGRAPHY, and that matters: the
// adjacency table is what the game will actually let an army cross, sea crossings and the
// ninety-five hand-written straits included, so a route this returns is a route that can be
// walked. A distance of `Infinity` therefore means genuinely unreachable -- an island with no
// crossing to it -- and is worth saying out loud rather than silently producing no corridor.
//
// Pure, with the neighbour lookup INJECTED, so it runs in Node and is unit-tested there --
// the same arrangement `theatre.js` and `muster.js` both use, and for the same reason: the
// adjacency module throws when its data has not been loaded, which is the case in Node.

/**
 * Distance, in conquests, from every territory to the nearest objective territory.
 *
 * @param {{territories: object[], isObjective: (t: object) => boolean,
 *          neighboursOf: (t: object) => string[]}} input
 * @returns {Map<string, number>} territoryName -> hops. Missing means unreachable.
 */
export function distancesToObjective({ territories = [], isObjective, neighboursOf }) {
    const distances = new Map();
    if (typeof isObjective !== "function" || typeof neighboursOf !== "function") {
        return distances;
    }

    const byName = new Map();
    for (const territory of territories) {
        byName.set(territory.territoryName, territory);
    }

    //Seeded at the OBJECTIVE and run outwards. A country plan names many territories at
    //once, so they all start at zero and the search finds the nearest of them without ever
    //having to ask which one -- which is right, because "take France" is satisfied by
    //whichever piece of France is cheapest to reach.
    const queue = [];
    for (const territory of territories) {
        if (isObjective(territory)) {
            distances.set(territory.territoryName, 0);
            queue.push(territory);
        }
    }

    //A plain array with a head index rather than `shift()`: this walks 359 territories and
    //`shift()` is O(n) per call, which turns a linear search into a quadratic one.
    for (let head = 0; head < queue.length; head++) {
        const territory = queue[head];
        const distance = distances.get(territory.territoryName) + 1;
        for (const neighbourName of neighboursOf(territory)) {
            if (distances.has(neighbourName)) {
                continue;
            }
            const neighbour = byName.get(neighbourName);
            if (!neighbour) {
                continue;
            }
            distances.set(neighbourName, distance);
            queue.push(neighbour);
        }
    }

    return distances;
}

/**
 * The route one country is on towards one objective.
 *
 * @param {{territories: object[], isObjective: (t: object) => boolean,
 *          isOurs: (t: object) => boolean, neighboursOf: (t: object) => string[]}} input
 * @returns {{distances: Map<string, number>, ourBest: number, staging: string|null,
 *            nextSteps: string[], reachable: boolean, arrived: boolean}}
 */
export function routeToObjective({ territories = [], isObjective, isOurs, neighboursOf }) {
    const distances = distancesToObjective({ territories, isObjective, neighboursOf });

    let ourBest = Infinity;
    let staging = null;
    let stagingArmy = -1;

    for (const territory of territories) {
        if (!isOurs(territory)) {
            continue;
        }
        const distance = distances.get(territory.territoryName);
        if (!Number.isFinite(distance)) {
            continue;
        }
        const army = Number(territory.armyForCurrentTerritory) || 0;
        //Nearest first, and among equals the STRONGEST. Two provinces the same distance from
        //the objective are not equally good places to mass an army: reinforcing the one that
        //already has the garrison is one turn nearer an attack that clears its odds floor.
        if (distance < ourBest || (distance === ourBest && army > stagingArmy)) {
            ourBest = distance;
            staging = territory.territoryName;
            stagingArmy = army;
        }
    }

    //The first conquests that would actually shorten the journey. Reported for the panel and
    //the log -- nothing in the rules reads it, because the corridor test below is a
    //comparison rather than a list, and a stored path would go stale the moment anybody
    //anywhere took a territory.
    //
    //THEY MUST BE ADJACENT TO US, not merely the right distance from the objective. Filtered
    //on distance alone, a United States seven hops from the Falkland Islands was told its
    //next steps were "Niger, Algeria, Western Sahara" -- all genuinely six hops from the
    //objective, all across an ocean it cannot cross, and none of them a step this country
    //can take. The corridor test itself needs no such filter, because `rateTarget()` is only
    //ever called on pairings that already border each other; this line is read by a person,
    //and a person reading it deserves the move rather than the arithmetic.
    const nextSteps = [];
    if (Number.isFinite(ourBest) && ourBest > 0) {
        const withinReach = new Set();
        for (const territory of territories) {
            if (!isOurs(territory)) {
                continue;
            }
            for (const neighbourName of neighboursOf(territory)) {
                withinReach.add(neighbourName);
            }
        }
        for (const territory of territories) {
            if (isOurs(territory) || !withinReach.has(territory.territoryName)) {
                continue;
            }
            if (distances.get(territory.territoryName) < ourBest) {
                nextSteps.push(territory.territoryName);
            }
        }
        //Closest to the objective first, so the head of the list is the best move available.
        nextSteps.sort((a, b) => distances.get(a) - distances.get(b));
    }

    return {
        distances,
        ourBest,
        staging,
        nextSteps,
        reachable: Number.isFinite(ourBest),
        //`ourBest === 0` means one of the objective territories is already ours. For a
        //territory plan that is the whole objective; for a country plan it means a foothold
        //and nothing more, which is why realisation is judged separately.
        arrived: ourBest === 0
    };
}

/**
 * Is taking this territory a step towards the objective?
 *
 * Strictly closer, not merely close: a territory at the same distance as the ground we
 * already hold is a sideways move, and one further away is a step backwards. This is the
 * whole corridor test, and it is a comparison rather than a stored path precisely so that it
 * cannot go stale -- the route is re-derived every turn from the world as it then is.
 *
 * @param {{distances: Map<string, number>, ourBest: number}|null} route
 * @param {string} territoryName
 * @returns {number|null} hops still to go, or null when it is not on the route
 */
export function stepsRemainingOnRoute(route, territoryName) {
    if (!route || !Number.isFinite(route.ourBest)) {
        return null;
    }
    const distance = route.distances?.get(territoryName);
    if (!Number.isFinite(distance) || distance >= route.ourBest) {
        return null;
    }
    return distance;
}

/** How the route reads to a person. Used by the panel and the spectator log. */
export function describeRoute(route) {
    if (!route) {
        return "no route worked out";
    }
    if (!route.reachable) {
        return "UNREACHABLE -- no chain of borders leads there from anything this country holds";
    }
    if (route.arrived) {
        return "already on the objective";
    }
    const next = route.nextSteps.slice(0, 3).join(", ");
    return route.ourBest + " conquest(s) away, massing at " + route.staging +
        (next ? " -- next " + next : "");
}
