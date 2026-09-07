// src/ai/route.js -- how far away an objective is, over the graph armies can actually cross.
//
// This exists because an injected plan without it was a wish. `rateTarget()` is only ever
// called on pairings that already exist -- an enemy territory ADJACENT to one of ours -- so
// pointing the United States at the Falkland Islands consulted the plan exactly never, and
// the country carried on choosing its own targets while the panel reported a plan in force.
//
// The behaviour worth pinning is therefore not "BFS works". It is the two derived facts the
// rest of the AI acts on: which territories are STRICTLY on the way (the corridor), and where
// the army should MASS to walk there (the staging point). Plus the answer that has no other
// way of being discovered: that an objective is unreachable at all.
//
// The neighbour lookup is injected, so this runs in Node like everything else in `src/ai/`.

import { describe, expect, it } from "vitest";

import {
    describeRoute,
    distancesToObjective,
    routeToObjective,
    stepsRemainingOnRoute
} from "../../src/ai/route.js";

/**
 * A line of territories: A -- B -- C -- D -- E, plus an island nothing borders.
 *
 * Deliberately a chain rather than a blob: a corridor is a claim about ORDER, and on a
 * fully-connected cluster every wrong answer looks like a right one.
 */
const CHAIN = ["A", "B", "C", "D", "E"];

function chainWorld(owners = {}) {
    const rows = CHAIN.map((name, index) => ({
        uniqueId: String(index),
        territoryName: name,
        dataName: owners[name] ?? "Neutral",
        armyForCurrentTerritory: 100
    }));
    rows.push({
        uniqueId: "island",
        territoryName: "Island",
        dataName: owners.Island ?? "Neutral",
        armyForCurrentTerritory: 100
    });
    return rows;
}

/** A -- B -- C -- D -- E, and Island borders nothing. */
function chainNeighbours(territory) {
    const index = CHAIN.indexOf(territory.territoryName);
    if (index === -1) {
        return [];
    }
    return [CHAIN[index - 1], CHAIN[index + 1]].filter(Boolean);
}

describe("distances to the objective", () => {
    it("counts hops outwards from the objective", () => {
        const distances = distancesToObjective({
            territories: chainWorld(),
            isObjective: (t) => t.territoryName === "E",
            neighboursOf: chainNeighbours
        });

        expect(distances.get("E")).toBe(0);
        expect(distances.get("D")).toBe(1);
        expect(distances.get("A")).toBe(4);
    });

    it("leaves anything with no chain of borders out of the map entirely", () => {
        const distances = distancesToObjective({
            territories: chainWorld(),
            isObjective: (t) => t.territoryName === "E",
            neighboursOf: chainNeighbours
        });
        //Not Infinity, not -1: absent. Every caller tests with `Number.isFinite`, and an
        //island that is genuinely unreachable must not be given a number that compares.
        expect(distances.has("Island")).toBe(false);
    });

    it("seeds every objective territory at once, so a COUNTRY plan finds the nearest piece", () => {
        //"Take France" is satisfied by whichever bit of France is cheapest to reach, and the
        //search should never have to decide which one that is.
        const distances = distancesToObjective({
            territories: chainWorld(),
            isObjective: (t) => t.territoryName === "A" || t.territoryName === "E",
            neighboursOf: chainNeighbours
        });
        expect(distances.get("C")).toBe(2);
        expect(distances.get("B")).toBe(1);
    });
});

describe("the route a country is on", () => {
    it("reports how far it has to go and where to mass", () => {
        const route = routeToObjective({
            territories: chainWorld({ A: "Us", E: "Them" }),
            isObjective: (t) => t.territoryName === "E",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        });

        expect(route.reachable).toBe(true);
        expect(route.ourBest).toBe(4);
        expect(route.staging).toBe("A");
        expect(route.nextSteps).toEqual(["B"]);
    });

    it("masses at the province NEAREST the objective, not the first one it walks past", () => {
        const route = routeToObjective({
            territories: chainWorld({ A: "Us", B: "Us", C: "Us", E: "Them" }),
            isObjective: (t) => t.territoryName === "E",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        });
        expect(route.staging).toBe("C");
        expect(route.ourBest).toBe(2);
    });

    it("breaks a tie on ARMY, because reinforcing the strong province is nearer an attack", () => {
        const territories = chainWorld({ A: "Us", E: "Them" });
        //Two of ours the same distance from the objective, one of them garrisoned.
        territories.push({
            uniqueId: "A2", territoryName: "A2", dataName: "Us", armyForCurrentTerritory: 9000
        });
        //THE EXTRA EDGE HAS TO GO BOTH WAYS. The search runs outwards from the OBJECTIVE, so
        //a fixture that gave A2 a border with B without giving B a border with A2 would leave
        //A2 undiscovered and the tie-break untested -- which is exactly the shape of
        //known-issue BS, where five real straits were listed on one side only and had no
        //signature at all. `adjacency.spec.js` asserts the real graph carries no such edge.
        const neighbours = (t) => {
            if (t.territoryName === "A2") return ["B"];
            if (t.territoryName === "B") return [...chainNeighbours(t), "A2"];
            return chainNeighbours(t);
        };

        const route = routeToObjective({
            territories,
            isObjective: (t) => t.territoryName === "E",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: neighbours
        });
        expect(route.ourBest).toBe(4);
        expect(route.staging).toBe("A2");
    });

    it("says UNREACHABLE rather than quietly producing no corridor", () => {
        //The one outcome nothing else in the game would ever reveal: a plan that will sit
        //there doing nothing for the rest of the run because no chain of borders leads there.
        const route = routeToObjective({
            territories: chainWorld({ A: "Us", Island: "Them" }),
            isObjective: (t) => t.territoryName === "Island",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        });

        expect(route.reachable).toBe(false);
        expect(route.ourBest).toBe(Infinity);
        expect(route.staging).toBeNull();
        expect(describeRoute(route)).toContain("UNREACHABLE");
    });

    it("offers only next steps this country can actually attack from where it stands", () => {
        //Filtered on distance alone, a United States seven hops from the Falkland Islands was
        //told its next steps were "Niger, Algeria, Western Sahara" -- the right distance from
        //the objective, across an ocean it cannot cross, and not a move it can make. Here
        //`D` is closer to the objective than `A` is, and equally out of reach.
        const route = routeToObjective({
            territories: chainWorld({ A: "Us", E: "Them" }),
            isObjective: (t) => t.territoryName === "E",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        });
        expect(route.nextSteps).toEqual(["B"]);
    });

    it("puts the step nearest the objective at the head of the list", () => {
        //Two moves available, one of them two hops better. The head of the list is what the
        //panel prints first, so it has to be the best move rather than the first one walked.
        const territories = chainWorld({ A: "Us", C: "Us", E: "Them" });
        const route = routeToObjective({
            territories,
            isObjective: (t) => t.territoryName === "E",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        });
        expect(route.ourBest).toBe(2);
        expect(route.nextSteps[0]).toBe("D");
    });

    it("knows when the objective is already held", () => {
        const route = routeToObjective({
            territories: chainWorld({ A: "Us", E: "Us" }),
            isObjective: (t) => t.territoryName === "E",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        });
        expect(route.arrived).toBe(true);
        expect(route.nextSteps).toEqual([]);
    });
});

describe("what counts as a step on the way", () => {
    const route = () => routeToObjective({
        territories: chainWorld({ A: "Us", E: "Them" }),
        isObjective: (t) => t.territoryName === "E",
        isOurs: (t) => t.dataName === "Us",
        neighboursOf: chainNeighbours
    });

    it("admits everything strictly closer to the objective than we already are", () => {
        const on = route();
        expect(stepsRemainingOnRoute(on, "B")).toBe(3);
        expect(stepsRemainingOnRoute(on, "C")).toBe(2);
        expect(stepsRemainingOnRoute(on, "E")).toBe(0);
    });

    it("refuses a sideways move and anything off the graph", () => {
        //`A` is ours and is exactly `ourBest` away, so taking something at the same distance
        //advances nothing. That STRICTNESS is the whole corridor test -- without it every
        //territory in the world qualifies and the plan stops meaning anything.
        const on = route();
        expect(stepsRemainingOnRoute(on, "A")).toBeNull();
        expect(stepsRemainingOnRoute(on, "Island")).toBeNull();
        expect(stepsRemainingOnRoute(null, "B")).toBeNull();
    });

    it("gives nothing at all when the objective cannot be reached", () => {
        const nowhere = routeToObjective({
            territories: chainWorld({ A: "Us", Island: "Them" }),
            isObjective: (t) => t.territoryName === "Island",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        });
        for (const name of [...CHAIN, "Island"]) {
            expect(stepsRemainingOnRoute(nowhere, name)).toBeNull();
        }
    });
});

describe("describing a route", () => {
    it("names the distance, the staging point and the next steps", () => {
        const line = describeRoute(routeToObjective({
            territories: chainWorld({ A: "Us", E: "Them" }),
            isObjective: (t) => t.territoryName === "E",
            isOurs: (t) => t.dataName === "Us",
            neighboursOf: chainNeighbours
        }));
        expect(line).toContain("4 conquest(s) away");
        expect(line).toContain("massing at A");
        expect(line).toContain("next B");
    });

    it("has something to say when there is no route at all", () => {
        expect(describeRoute(null)).toBe("no route worked out");
    });
});
