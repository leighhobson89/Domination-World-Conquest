// src/ai/muster.js -- moving an army to where the war is.
//
// The behaviour has never existed in this game, so there is no regression to pin: what these
// tests hold is the shape of the loop that makes the AI adapt ACROSS turns rather than
// within one. A front-line territory that cannot raise the odds it needs asks for men; the
// interior provinces, which had otherwise sat out the entire game, send them; the attack
// that was impossible last turn becomes possible this turn.
//
// The two rules worth breaking a test over are the ones that keep it from being a cheat:
// nothing marches out of a border that needs it, and a move is one hop between neighbours,
// so an army walks to the front over several turns rather than teleporting across an empire.

import { beforeEach, describe, expect, it } from "vitest";

import {
    clearReinforcementDemand,
    planMusters,
    recordReinforcementDemand,
    reinforcementDemands,
    resetMusters,
    spareInfantry
} from "../../src/ai/muster.js";
import { musterDiscipline } from "../../src/config/balance.js";

function territory(name, overrides = {}) {
    return {
        uniqueId: name,
        territoryName: name,
        dataName: "Alba",
        infantryForCurrentTerritory: 1000,
        armyForCurrentTerritory: 1000,
        ...overrides
    };
}

/** Interior -- Rear -- Front, in a line. Only neighbours can reinforce each other. */
const line = {
    Interior: ["Rear"],
    Rear: ["Interior", "Front"],
    Front: ["Rear"]
};
const neighboursOf = (from) => line[from.territoryName] ?? [];

beforeEach(() => {
    resetMusters();
});

describe("what a territory can send", () => {
    it("sends nothing from a border that only matches what faces it", () => {
        expect(spareInfantry(territory("Front"), 1000)).toBe(0);
    });

    it("sends a share of the surplus from a border that is comfortably ahead", () => {
        const spare = spareInfantry(territory("Rear", {
            infantryForCurrentTerritory: 5000, armyForCurrentTerritory: 5000
        }), 1000);
        expect(spare).toBeGreaterThan(0);
        expect(spare).toBeLessThan(5000);
    });

    it("sends a share of an interior province, which nothing can reach", () => {
        const spare = spareInfantry(territory("Interior"), 0);
        expect(spare).toBe(Math.floor(1000 * musterDiscipline.share));
    });

    it("has nothing to send when it has no infantry", () => {
        expect(spareInfantry(territory("Interior", {
            infantryForCurrentTerritory: 0, armyForCurrentTerritory: 4000
        }), 0)).toBe(0);
    });
});

describe("planning the movements", () => {
    const territories = () => [
        territory("Interior"),
        territory("Rear", { infantryForCurrentTerritory: 4000, armyForCurrentTerritory: 4000 }),
        territory("Front", { infantryForCurrentTerritory: 100, armyForCurrentTerritory: 100 })
    ];

    /** Only the front is in reach of an enemy, and a strong one. */
    const localEnemyPowerFor = (name) => (name === "Front" ? 3000 : 0);

    it("moves nothing when nobody has asked and there is no war to prepare for", () => {
        expect(planMusters({
            country: "Alba", turn: 5, territories: territories(),
            localEnemyPowerFor, neighboursOf
        })).toEqual([]);
    });

    it("reinforces the territory that asked for it", () => {
        recordReinforcementDemand("Alba", "Front", 20, 5);
        const moves = planMusters({
            country: "Alba", turn: 5, territories: territories(),
            localEnemyPowerFor, neighboursOf
        });

        expect(moves).toHaveLength(1);
        expect(moves[0]).toMatchObject({ from: "Rear", to: "Front" });
        expect(moves[0].infantry).toBeGreaterThan(0);
    });

    it("will not march from a territory that is asking for help itself", () => {
        recordReinforcementDemand("Alba", "Front", 20, 5);
        recordReinforcementDemand("Alba", "Rear", 30, 5);
        const moves = planMusters({
            country: "Alba", turn: 5, territories: territories(),
            localEnemyPowerFor, neighboursOf
        });

        expect(moves.every(move => move.from !== "Rear")).toBe(true);
    });

    it("only moves between neighbours -- the interior cannot teleport to the front", () => {
        recordReinforcementDemand("Alba", "Front", 20, 5);
        const moves = planMusters({
            country: "Alba", turn: 5, territories: territories(),
            localEnemyPowerFor, neighboursOf
        });

        expect(moves.some(move => move.from === "Interior" && move.to === "Front")).toBe(false);
    });

    it("masses at the spearhead before anybody has failed, not only after", () => {
        // The mid-term goal names a front-line territory; a country that only ever
        // reinforced where it had already lost would still be reacting rather than planning.
        const moves = planMusters({
            country: "Alba", turn: 5, territories: territories(),
            localEnemyPowerFor, neighboursOf, spearhead: "Front"
        });

        expect(moves.some(move => move.to === "Front")).toBe(true);
    });

    it("sends from any one territory only once in a turn", () => {
        recordReinforcementDemand("Alba", "Front", 20, 5);
        recordReinforcementDemand("Alba", "Interior", 25, 5);
        const moves = planMusters({
            country: "Alba", turn: 5, territories: territories(),
            localEnemyPowerFor, neighboursOf
        });

        const sources = moves.map(move => move.from);
        expect(new Set(sources).size).toBe(sources.length);
    });
});

describe("the memory of what was asked for", () => {
    it("forgets a request that has gone stale", () => {
        recordReinforcementDemand("Alba", "Front", 20, 1);
        expect(reinforcementDemands("Alba", 1)).toHaveLength(1);
        expect(reinforcementDemands("Alba", 1 + musterDiscipline.demandMemoryTurns + 1))
            .toHaveLength(0);
    });

    it("answers the cheapest war to make possible first", () => {
        recordReinforcementDemand("Alba", "Hopeless", 60, 5);
        recordReinforcementDemand("Alba", "Nearly", 8, 5);
        expect(reinforcementDemands("Alba", 5)[0].territoryName).toBe("Nearly");
    });

    it("forgets a request once it has been answered", () => {
        recordReinforcementDemand("Alba", "Front", 20, 5);
        clearReinforcementDemand("Alba", "Front");
        expect(reinforcementDemands("Alba", 5)).toHaveLength(0);
    });
});
