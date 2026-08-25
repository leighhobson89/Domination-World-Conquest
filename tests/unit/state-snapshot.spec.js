// Unit tests for the Phase 7.3 save/load data path.
//
// `snapshot.js` and `storage.js` were written to run in Node -- no DOM, no `ui.js`
// -- so the part of save/load that can be wrong silently is testable here. What is
// asserted below is not "a round trip works" but the four specific ways it could
// fail while appearing to work:
//
//   * a siege's live `defendingTerritory` getter being serialised as a dead copy,
//     so writing through the siege stops writing the world;
//   * the aliased collections (`store.sieges.player`, `store.wars.historic`) being
//     REPLACED rather than refilled, which silently orphans the module-level
//     `const`s battle.js took at page load;
//   * Sets stringifying to `{}`;
//   * a restore merging with the abandoned game instead of replacing it.

import { describe, it, expect, beforeEach } from "vitest";

import {
    seedTerritories,
    __resetStateForTests,
    __setGuardModeForTests,
    __store
} from "../../src/state/GameState.js";
import { __resetEventsForTests, Events, on } from "../../src/state/events.js";
import { captureState, restoreState, SNAPSHOT_VERSION } from "../../src/state/snapshot.js";
import { referenceDefendingTerritory } from "../../src/state/sieges.js";
import * as mutate from "../../src/state/mutations.js";
import * as select from "../../src/state/selectors.js";
import { Phase } from "../../src/state/phases.js";
import {
    __resetSaveSlicesForTests,
    captureSlices,
    registerSaveSlice,
    registeredSliceNames,
    restoreSlices
} from "../../src/platform/saveSlices.js";
import {
    applyGame,
    captureGame,
    decodeSave,
    encodeSave,
    SAVE_FORMAT
} from "../../src/platform/storage.js";

function territory(overrides = {}) {
    return {
        uniqueId: "1",
        territoryName: "Alpha",
        dataName: "Aland",
        owner: "Aland",
        originalOwner: "Aland",
        defenseBonus: 10,
        isDeactivated: false,
        goldForCurrentTerritory: 100,
        fortsBuilt: 0,
        ...overrides
    };
}

const SAMPLE = [
    territory({ uniqueId: "1", territoryName: "Alpha", defenseBonus: 30 }),
    territory({ uniqueId: "2", territoryName: "Beta", dataName: "Bland", owner: "Bland", defenseBonus: 20 }),
    // The parentheses are real -- six territory names carry them. See CLAUDE.md.
    territory({ uniqueId: "3", territoryName: "Gamma (Bahamas)", owner: "Player", defenseBonus: 10 })
];

beforeEach(() => {
    __resetStateForTests();
    __resetEventsForTests();
    __resetSaveSlicesForTests();
    __setGuardModeForTests("off");
    seedTerritories(SAMPLE.map((t) => ({ ...t })));
});

describe("captureState", () => {
    it("returns null before the territory model exists", () => {
        __resetStateForTests();
        expect(captureState()).toBeNull();
    });

    it("carries every territory, and plain objects rather than store references", () => {
        const snapshot = captureState();
        expect(snapshot.version).toBe(SNAPSHOT_VERSION);
        expect(snapshot.territories).toHaveLength(3);
        expect(snapshot.territories[0]).not.toBe(select.getTerritory("1"));
        expect(snapshot.territories.map((t) => t.territoryName))
            .toContain("Gamma (Bahamas)");
    });

    it("turns the two selection Sets into arrays, because a Set stringifies to {}", () => {
        mutate.setGreyedOutCountries(["Aland", "Bland"]);
        mutate.setAttackableTerritories(["2"]);
        const snapshot = captureState();
        expect(snapshot.ui.greyedOutCountries.sort()).toEqual(["Aland", "Bland"]);
        expect(snapshot.ui.attackableTerritories).toEqual(["2"]);
        expect(JSON.parse(JSON.stringify(snapshot)).ui.greyedOutCountries).toHaveLength(2);
    });

    it("drops a siege's live defendingTerritory getter and keeps the id", () => {
        mutate.addSiege("player", "Beta",
            referenceDefendingTerritory({ warId: 7, turnsInSiege: 2 }, "2"));

        const snapshot = captureState();
        const siege = snapshot.sieges.player.Beta;
        expect(siege.defendingTerritoryId).toBe("2");
        expect(siege).not.toHaveProperty("defendingTerritory");
        // The failure this guards: a whole territory serialised inside the siege.
        expect(JSON.stringify(snapshot).includes("\"defendingTerritory\":{")).toBe(false);
    });
});

describe("restoreState", () => {
    it("rejects a snapshot from another version rather than half-applying it", () => {
        const snapshot = captureState();
        snapshot.version = SNAPSHOT_VERSION + 1;
        expect(() => restoreState(snapshot)).toThrow(/version/);
    });

    it("rejects anything that is not a snapshot", () => {
        expect(() => restoreState(null)).toThrow();
        expect(() => restoreState({ version: SNAPSHOT_VERSION, territories: [] })).toThrow();
    });

    it("puts the turn, the phase and the player back", () => {
        mutate.setTurn(9);
        mutate.setPhase(Phase.MOVE_ATTACK);
        mutate.setPlayerCountry("Aland");
        mutate.setPlayerColour("rgb(1,2,3)");
        const snapshot = captureState();

        mutate.setTurn(20);
        mutate.setPhase(Phase.BUY_UPGRADE);
        mutate.setPlayerCountry("Bland");

        restoreState(snapshot);
        expect(select.currentTurn()).toBe(9);
        expect(select.currentPhase()).toBe(Phase.MOVE_ATTACK);
        expect(select.playerCountryName()).toBe("Aland");
        expect(select.playerColour()).toBe("rgb(1,2,3)");
    });

    it("emits turnChanged and phaseChanged, because PhaseBar follows them", () => {
        mutate.setTurn(4);
        mutate.setPhase(Phase.MOVE_ATTACK);
        const snapshot = captureState();
        mutate.setTurn(5);
        mutate.setPhase(Phase.AI);

        const seen = [];
        on(Events.TURN_CHANGED, (p) => seen.push(["turn", p.turn]));
        on(Events.PHASE_CHANGED, (p) => seen.push(["phase", p.phase]));
        restoreState(snapshot);

        expect(seen).toEqual([["turn", 4], ["phase", Phase.MOVE_ATTACK]]);
    });

    it("patches territories in place, so anything holding one still holds the right one",
        () => {
            const alpha = select.getTerritory("1");
            mutate.updateTerritory("1", { goldForCurrentTerritory: 500 });
            const snapshot = captureState();
            mutate.updateTerritory("1", { goldForCurrentTerritory: 5 });

            restoreState(snapshot);
            expect(select.getTerritory("1")).toBe(alpha);
            expect(alpha.goldForCurrentTerritory).toBe(500);
        });

    it("replaces a territory rather than merging with the abandoned game", () => {
        const snapshot = captureState();
        // A field the save does not know about -- a leader assigned after the
        // snapshot was taken, say.
        mutate.updateTerritory("1", { leader: { name: "Someone" } });
        expect(select.getTerritory("1").leader).toBeTruthy();

        restoreState(snapshot);
        expect(select.getTerritory("1").leader).toBeUndefined();
    });

    it("reports saved territories that are not on this map instead of throwing", () => {
        const snapshot = captureState();
        snapshot.territories.push(territory({ uniqueId: "999", territoryName: "Nowhere" }));
        const result = restoreState(snapshot);
        expect(result.missingTerritories).toEqual(["999"]);
    });

    it("refills the aliased collections in place -- battle.js holds them by reference",
        () => {
            const store = __store();
            const siegeList = store.sieges.player;
            const historic = store.wars.historic;

            mutate.addSiege("player", "Beta",
                referenceDefendingTerritory({ warId: 1 }, "2"));
            mutate.recordHistoricWar(referenceDefendingTerritory({ warId: 1 }, "2"));
            const snapshot = captureState();

            mutate.removeSiege("player", "Beta");
            restoreState(snapshot);

            expect(store.sieges.player).toBe(siegeList);
            expect(store.wars.historic).toBe(historic);
            expect(Object.keys(siegeList)).toEqual(["Beta"]);
            expect(historic).toHaveLength(1);
        });

    it("restores defendingTerritory as a live getter, not a dead copy", () => {
        mutate.addSiege("player", "Beta",
            referenceDefendingTerritory({ warId: 1 }, "2"));
        const snapshot = captureState();
        mutate.removeSiege("player", "Beta");

        restoreState(snapshot);
        const siege = select.siegeOn("Beta");
        expect(siege.defendingTerritory).toBe(select.getTerritory("2"));

        // The whole point of the getter: writing through the siege writes the world.
        mutate.legacyDirectWrite(() => {
            siege.defendingTerritory.goldForCurrentTerritory = 42;
        });
        expect(select.getTerritory("2").goldForCurrentTerritory).toBe(42);
    });

    it("derives underSiege from the restored siege lists", () => {
        mutate.addSiege("ai", "Alpha", referenceDefendingTerritory({ warId: 3 }, "1"));
        const snapshot = captureState();
        mutate.removeSiege("ai", "Alpha");
        expect(select.isUnderSiege("Alpha")).toBe(false);

        restoreState(snapshot);
        expect(select.isUnderSiege("Alpha")).toBe(true);
    });

    it("survives a JSON round trip, which is what a save actually is", () => {
        mutate.setTurn(6);
        mutate.setGreyedOutCountries(["Aland"]);
        mutate.addSiege("player", "Beta", referenceDefendingTerritory({ warId: 2 }, "2"));
        const snapshot = JSON.parse(JSON.stringify(captureState()));

        __resetStateForTests();
        seedTerritories(SAMPLE.map((t) => ({ ...t })));
        restoreState(snapshot);

        expect(select.currentTurn()).toBe(6);
        expect([...select.greyedOutCountryNames()]).toEqual(["Aland"]);
        expect(select.siegeOn("Beta").defendingTerritory.territoryName).toBe("Beta");
    });
});

describe("saveSlices", () => {
    it("captures and restores what has registered, in place", () => {
        const array = [1, 2, 3];
        registerSaveSlice("thing", {
            capture: () => [...array],
            restore: (data) => {
                array.length = 0;
                array.push(...data);
            }
        });

        const captured = captureSlices();
        array.length = 0;
        restoreSlices(captured);

        expect(array).toEqual([1, 2, 3]);
        expect(registeredSliceNames()).toEqual(["thing"]);
    });

    it("skips a key with no registered slice rather than failing the whole load", () => {
        registerSaveSlice("known", { capture: () => 1, restore: () => {} });
        expect(restoreSlices({ known: 1, gone: 2 })).toEqual(["known"]);
    });

    it("does not let one broken slice cost the player the rest of the save", () => {
        registerSaveSlice("bad", {
            capture: () => { throw new Error("nope"); },
            restore: () => { throw new Error("nope"); }
        });
        registerSaveSlice("good", { capture: () => "ok", restore: () => {} });

        expect(captureSlices().good).toBe("ok");
        expect(restoreSlices({ bad: 1, good: 1 })).toEqual(["good"]);
    });

    it("rejects a slice that is not a capture/restore pair", () => {
        expect(() => registerSaveSlice("half", { capture: () => 1 })).toThrow();
    });
});

describe("the save envelope", () => {
    it("round trips through encode and decode", () => {
        mutate.setTurn(3);
        mutate.setPlayerCountry("Aland");
        registerSaveSlice("turnLoop", {
            capture: () => ({ randomEventProbability: 12 }),
            restore: () => {}
        });

        const code = encodeSave(captureGame());
        expect(code.startsWith(SAVE_FORMAT + ":")).toBe(true);

        const decoded = decodeSave(code);
        expect(decoded.turn).toBe(3);
        expect(decoded.playerCountry).toBe("Aland");
        expect(decoded.slices.turnLoop.randomEventProbability).toBe(12);
    });

    it("survives the whitespace a paste through a chat window inserts", () => {
        const code = encodeSave(captureGame());
        const wrapped = "  " + code.replace(/(.{40})/g, "$1\n") + "\n";
        expect(decodeSave(wrapped).turn).toBe(select.currentTurn());
    });

    it("tells a foreign code apart from a damaged one", () => {
        expect(() => decodeSave("")).toThrow(/Paste a save code/);
        expect(() => decodeSave("no-separator-here")).toThrow(/does not look like/);
        expect(() => decodeSave("OTHER:abcdef")).toThrow(/this game reads/);
        expect(() => decodeSave(SAVE_FORMAT + ":!!!not-base64!!!")).toThrow(/damaged/);
    });

    it("applyGame puts back both halves and reports what it restored", () => {
        let sliceValue = 0;
        registerSaveSlice("turnLoop", {
            capture: () => ({ randomEventProbability: sliceValue }),
            restore: (data) => { sliceValue = data.randomEventProbability; }
        });

        mutate.setTurn(11);
        mutate.setPhase(Phase.MOVE_ATTACK);
        sliceValue = 34;
        const save = decodeSave(encodeSave(captureGame()));

        mutate.setTurn(1);
        sliceValue = 0;

        const result = applyGame(save);
        expect(result.turn).toBe(11);
        expect(result.phase).toBe(Phase.MOVE_ATTACK);
        expect(result.slices).toContain("turnLoop");
        expect(sliceValue).toBe(34);
    });

    it("refuses an envelope from an unknown format or version", () => {
        expect(() => applyGame({ format: "NOPE", version: SNAPSHOT_VERSION, state: {} }))
            .toThrow(/unknown format/);
        expect(() => applyGame({ format: SAVE_FORMAT, version: 99, state: {} }))
            .toThrow(/incompatible version/);
        expect(() => applyGame({ format: SAVE_FORMAT, version: SNAPSHOT_VERSION }))
            .toThrow(/missing its game state/);
    });
});
