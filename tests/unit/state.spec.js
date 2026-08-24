// Unit tests for the Phase 4 state layer.
//
// These run in Node with no DOM, which is the point: the store, the selectors and
// the mutations are the part of the game that no longer needs a browser.

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
    seedTerritories,
    isSeeded,
    __resetStateForTests,
    __setGuardModeForTests,
    getGuardViolations
} from "../../src/state/GameState.js";
import * as select from "../../src/state/selectors.js";
import * as mutate from "../../src/state/mutations.js";
import { on, emit, Events, listenerCount, __resetEventsForTests } from "../../src/state/events.js";
import { Phase, phaseName, nextPhase, endsTurn, isPhase } from "../../src/state/phases.js";

function territory(overrides = {}) {
    return {
        uniqueId: "1",
        territoryName: "Testland",
        dataName: "Testania",
        owner: "Testania",
        originalOwner: "Testania",
        defenseBonus: 10,
        isDeactivated: false,
        goldForCurrentTerritory: 100,
        ...overrides
    };
}

const SAMPLE = [
    territory({ uniqueId: "1", territoryName: "Alpha", dataName: "Aland", owner: "Aland", defenseBonus: 30 }),
    territory({ uniqueId: "2", territoryName: "Beta", dataName: "Bland", owner: "Bland", defenseBonus: 20 }),
    territory({ uniqueId: "3", territoryName: "Gamma (Bahamas)", dataName: "Aland", owner: "Player", defenseBonus: 10 })
];

beforeEach(() => {
    __resetStateForTests();
    __resetEventsForTests();
    __setGuardModeForTests("off");
    seedTerritories(SAMPLE.map((t) => ({ ...t })));
});

describe("phases", () => {
    it("keeps the legacy numeric values so half-migrated comparisons still hold", () => {
        expect(Phase.BUY_UPGRADE).toBe(0);
        expect(Phase.MOVE_ATTACK).toBe(1);
        expect(Phase.AI).toBe(2);
    });

    it("names phases and rejects non-phases", () => {
        expect(phaseName(Phase.MOVE_ATTACK)).toBe("MOVE_ATTACK");
        expect(phaseName(7)).toBe("UNKNOWN(7)");
        expect(isPhase(0)).toBe(true);
        expect(isPhase(3)).toBe(false);
    });

    it("wraps AI back round to the buy phase, and that wrap is what ends a turn", () => {
        expect(nextPhase(Phase.BUY_UPGRADE)).toBe(Phase.MOVE_ATTACK);
        expect(nextPhase(Phase.MOVE_ATTACK)).toBe(Phase.AI);
        expect(nextPhase(Phase.AI)).toBe(Phase.BUY_UPGRADE);
        expect(endsTurn(Phase.AI)).toBe(true);
        expect(endsTurn(Phase.MOVE_ATTACK)).toBe(false);
    });
});

describe("seeding", () => {
    it("indexes by uniqueId and by the stable territory name", () => {
        expect(isSeeded()).toBe(true);
        expect(select.getTerritory("2").territoryName).toBe("Beta");
        expect(select.getTerritory(2).territoryName).toBe("Beta");
        expect(select.getTerritoryByName("Alpha").uniqueId).toBe("1");
    });

    it("indexes the parenthesised names the SVG really uses", () => {
        // resources/svgMaster.svg is authoritative and six territory names carry real
        // parentheses. Anything that treats them as a selector breaks; a Map does not.
        expect(select.getTerritoryByName("Gamma (Bahamas)").uniqueId).toBe("3");
    });

    it("preserves defenseBonus order and never implies positional indexing", () => {
        const order = select.allTerritories().map((t) => t.defenseBonus);
        expect(order).toEqual([30, 20, 10]);
        expect(select.territoryCount()).toBe(3);
    });

    it("returns null rather than throwing for an unknown territory", () => {
        expect(select.getTerritory("999")).toBeNull();
        expect(select.getTerritory(null)).toBeNull();
        expect(select.getTerritoryByName("Nowhere")).toBeNull();
        expect(select.getTerritoryByName("")).toBeNull();
    });
});

describe("ownership selectors", () => {
    it("separates dataName (current owner) from owner", () => {
        expect(select.countryOf("3")).toBe("Aland");
        expect(select.ownerOf("3")).toBe("Player");
        expect(select.isPlayerOwned("3")).toBe(true);
        expect(select.isPlayerOwned("1")).toBe(false);
    });

    it("lists by country and by owner", () => {
        expect(select.territoriesOwnedByCountry("Aland").map((t) => t.uniqueId)).toEqual(["1", "3"]);
        expect(select.territoriesWithOwner("Bland").map((t) => t.uniqueId)).toEqual(["2"]);
        expect(select.playerTerritories().map((t) => t.uniqueId)).toEqual(["3"]);
    });
});

describe("updateTerritory", () => {
    it("applies a patch and reports which fields actually changed", () => {
        const seen = [];
        on(Events.TERRITORY_CHANGED, (payload) => seen.push(payload));

        mutate.updateTerritory("1", { goldForCurrentTerritory: 250, defenseBonus: 30 });

        expect(select.getTerritory("1").goldForCurrentTerritory).toBe(250);
        expect(seen).toHaveLength(1);
        expect(seen[0].changed).toEqual(["goldForCurrentTerritory"]);
    });

    it("emits nothing for a no-op patch", () => {
        const seen = [];
        on(Events.TERRITORY_CHANGED, (payload) => seen.push(payload));
        mutate.updateTerritory("1", { defenseBonus: 30 });
        expect(seen).toHaveLength(0);
    });

    it("warns and returns null for an unknown territory instead of throwing", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(mutate.updateTerritory("999", { defenseBonus: 1 })).toBeNull();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe("conquest", () => {
    it("sets owner and current country together", () => {
        mutate.setTerritoryOwner("1", "Player", "France");
        expect(select.ownerOf("1")).toBe("Player");
        expect(select.countryOf("1")).toBe("France");
    });

    it("defaults the country to the owner for an AI conquest", () => {
        mutate.setTerritoryOwner("1", "Bland");
        expect(select.countryOf("1")).toBe("Bland");
    });

    it("deactivates a conquered territory and reactivates the whole map at once", () => {
        mutate.setTerritoryDeactivated("1", true);
        mutate.setTerritoryDeactivated("2", true);
        expect(select.isDeactivated("1")).toBe(true);

        expect(mutate.reactivateAllTerritories()).toBe(2);
        expect(select.isDeactivated("1")).toBe(false);
        expect(select.isDeactivated("2")).toBe(false);
        expect(mutate.reactivateAllTerritories()).toBe(0);
    });
});

describe("turn and phase", () => {
    it("advances the turn and announces the previous value", () => {
        const seen = [];
        on(Events.TURN_CHANGED, (payload) => seen.push(payload));
        expect(select.currentTurn()).toBe(1);
        mutate.advanceTurn();
        expect(select.currentTurn()).toBe(2);
        expect(seen[0]).toMatchObject({ turn: 2, previous: 1 });
    });

    it("moves through the phases and exposes them as predicates", () => {
        expect(select.isBuyPhase()).toBe(true);
        mutate.setPhase(Phase.MOVE_ATTACK);
        expect(select.isMovePhase()).toBe(true);
        mutate.setPhase(Phase.AI);
        expect(select.isAiPhase()).toBe(true);
        expect(select.currentPhase()).toBe(Phase.AI);
    });

    it("refuses a phase outside the enum rather than storing it", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        mutate.setPhase(3);
        expect(select.currentPhase()).toBe(Phase.BUY_UPGRADE);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe("sieges", () => {
    it("derives underSiege from the siege lists rather than storing a flag", () => {
        expect(select.isUnderSiege("Alpha")).toBe(false);
        mutate.addSiege("player", "Alpha", { warId: 1, defendingTerritoryId: "1" });
        expect(select.isUnderSiege("Alpha")).toBe(true);
        expect(select.isUnderSiegeById("1")).toBe(true);

        mutate.removeSiege("player", "Alpha");
        expect(select.isUnderSiege("Alpha")).toBe(false);
        expect(select.isUnderSiegeById("1")).toBe(false);
    });

    it("finds a siege from either side and lists every besieged territory once", () => {
        mutate.addSiege("player", "Alpha", { warId: 1 });
        mutate.addSiege("ai", "Beta", { warId: 2 });
        expect(select.siegeOn("Beta").warId).toBe(2);
        expect(select.besiegedTerritoryNames().sort()).toEqual(["Alpha", "Beta"]);
        expect(select.siegeOn("Gamma (Bahamas)")).toBeNull();
    });

    it("prunes sieges whose territory no longer exists", () => {
        mutate.addSiege("player", "Alpha", { warId: 1 });
        mutate.addSiege("ai", "Vanished", { warId: 2 });
        const removed = mutate.pruneSiegesForMissingTerritories(
            (name) => select.getTerritoryByName(name) !== null
        );
        expect(removed).toBe(1);
        expect(select.isUnderSiege("Alpha")).toBe(true);
        expect(Object.keys(select.aiSieges())).toEqual([]);
    });

    it("announces adds, updates and removes", () => {
        const seen = [];
        on(Events.SIEGE_CHANGED, (payload) => seen.push(payload.action));
        mutate.addSiege("player", "Alpha", { warId: 1, turnsInSiege: 0 });
        mutate.updateSiege("player", "Alpha", { turnsInSiege: 1 });
        mutate.removeSiege("player", "Alpha");
        expect(seen).toEqual(["add", "update", "remove"]);
        expect(mutate.removeSiege("player", "Alpha")).toBeNull();
        expect(mutate.updateSiege("player", "Alpha", { turnsInSiege: 9 })).toBeNull();
    });
});

describe("wars", () => {
    it("ignores a duplicate warId", () => {
        expect(mutate.recordHistoricWar({ warId: 1 })).toBe(true);
        expect(mutate.recordHistoricWar({ warId: 1 })).toBe(false);
        expect(select.historicWarsList()).toHaveLength(1);
    });

    it("keeps the player and AI war lists apart", () => {
        mutate.recordHistoricWar({ warId: 1 });
        mutate.recordHistoricAiWar({ warId: 1 });
        expect(select.historicWarsList()).toHaveLength(1);
        expect(select.historicAiWarsList()).toHaveLength(1);
    });

    it("tracks the war id counters", () => {
        mutate.setNextWarId(4);
        mutate.setCurrentWarId(3);
        mutate.setNextAiWarId(9);
        mutate.setCurrentAiWarId(8);
        expect(select.warIds()).toEqual({
            nextWarId: 4,
            currentWarId: 3,
            nextAiWarId: 9,
            currentAiWarId: 8
        });
    });
});

describe("selection state", () => {
    it("greys out countries and clears them when the game starts", () => {
        mutate.setGreyedOutCountries(["Aland", "Bland"]);
        expect(select.isCountryGreyedOut("Aland")).toBe(true);
        expect(select.anyCountryGreyedOut()).toBe(true);
        mutate.clearGreyedOutCountries();
        expect(select.isCountryGreyedOut("Aland")).toBe(false);
        expect(select.anyCountryGreyedOut()).toBe(false);
    });

    it("stores attackable territories as strings so a numeric id still matches", () => {
        mutate.setAttackableTerritories([1, "2"]);
        expect(select.isAttackable("1")).toBe(true);
        expect(select.isAttackable(2)).toBe(true);
        expect(select.isAttackable("3")).toBe(false);
        mutate.clearAttackableTerritories();
        expect(select.isAttackable("1")).toBe(false);
    });
});

describe("the player", () => {
    it("stores the chosen country, colour and flag", () => {
        expect(select.playerCountryName()).toBeNull();
        mutate.setPlayerCountry("France");
        mutate.setPlayerColour("rgb(1,2,3)");
        mutate.setPlayerFlag("resources/flags/France.png");
        expect(select.playerCountryName()).toBe("France");
        expect(select.playerColour()).toBe("rgb(1,2,3)");
        expect(select.playerFlag()).toBe("resources/flags/France.png");
    });
});

describe("events", () => {
    it("unsubscribes, and survives a listener that throws", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const good = vi.fn();
        const unsubscribe = on(Events.TURN_CHANGED, () => {
            throw new Error("boom");
        });
        on(Events.TURN_CHANGED, good);

        emit(Events.TURN_CHANGED, { turn: 2 });
        expect(good).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalled();

        unsubscribe();
        expect(listenerCount(Events.TURN_CHANGED)).toBe(1);
        error.mockRestore();
    });

    it("lets a handler unsubscribe itself mid-emit", () => {
        let calls = 0;
        const stop = on(Events.PHASE_CHANGED, () => {
            calls++;
            stop();
        });
        mutate.setPhase(Phase.MOVE_ATTACK);
        mutate.setPhase(Phase.AI);
        expect(calls).toBe(1);
    });
});

describe("the write guard", () => {
    it("is off by default, so legacy direct writes still work", () => {
        select.getTerritory("1").goldForCurrentTerritory = 5;
        expect(select.getTerritory("1").goldForCurrentTerritory).toBe(5);
        expect(getGuardViolations()).toEqual([]);
    });

    it("records a direct write in warn mode, naming the territory and field", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        __resetStateForTests();
        __setGuardModeForTests("warn");
        seedTerritories(SAMPLE.map((t) => ({ ...t })));

        select.getTerritory("1").goldForCurrentTerritory = 5;

        const violations = getGuardViolations();
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
            territory: "Alpha",
            field: "goldForCurrentTerritory"
        });
        expect(select.getTerritory("1").goldForCurrentTerritory).toBe(5);
        warn.mockRestore();
    });

    it("does not flag writes made through mutations.js", () => {
        __resetStateForTests();
        __setGuardModeForTests("warn");
        seedTerritories(SAMPLE.map((t) => ({ ...t })));

        mutate.updateTerritory("1", { goldForCurrentTerritory: 5 });
        mutate.setTerritoryOwner("2", "Player", "France");

        expect(getGuardViolations()).toEqual([]);
    });

    it("throws in strict mode", () => {
        __resetStateForTests();
        __setGuardModeForTests("strict");
        seedTerritories(SAMPLE.map((t) => ({ ...t })));

        expect(() => {
            select.getTerritory("1").goldForCurrentTerritory = 5;
        }).toThrow(/state guard/);
    });

    it("lets legacy code opt out explicitly while Phase 5 is outstanding", () => {
        __resetStateForTests();
        __setGuardModeForTests("strict");
        seedTerritories(SAMPLE.map((t) => ({ ...t })));

        mutate.legacyDirectWrite(() => {
            select.getTerritory("1").goldForCurrentTerritory = 5;
        });
        expect(select.getTerritory("1").goldForCurrentTerritory).toBe(5);
    });
});
