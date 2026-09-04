// src/state/battlePlayback.js -- battle overhaul B.8.
//
// The queue of battles the player DEFENDED, waiting to be shown to them. It exists because the AI
// moves inside its own turn step and a step that waited for an animation would stall the turn
// loop -- so the battle is fought and applied immediately and the RECORD is queued.
//
// The property that matters most here is that nothing is read back off the world at playback
// time. By then the territory may have changed hands, which is the trap that made the Wars &
// Sieges tab draw the winner's flag on both sides of a war (known-issues AS).

import { beforeEach, describe, expect, it } from "vitest";

import {
    clearDefences,
    pendingDefences,
    recordDefence,
    takeNextDefence
} from "../../src/state/battlePlayback.js";

function aDefence(overrides = {}) {
    return {
        attackerCountry: "Russia",
        defenderCountry: "Germany",
        territoryId: "12",
        territoryName: "Poland",
        startingAttackers: [1000, 0, 0, 0],
        startingDefenders: [800, 0, 0, 0],
        records: [{ round: 1 }],
        state: "attacker-broken",
        tookTerritory: false,
        ...overrides
    };
}

beforeEach(() => {
    clearDefences();
});

describe("the defence playback queue", () => {
    it("starts empty", () => {
        expect(pendingDefences()).toBe(0);
        expect(takeNextDefence()).toBeNull();
    });

    it("hands battles back oldest first", () => {
        recordDefence(aDefence({ territoryName: "Poland" }));
        recordDefence(aDefence({ territoryName: "Denmark" }));
        expect(pendingDefences()).toBe(2);
        expect(takeNextDefence().territoryName).toBe("Poland");
        expect(takeNextDefence().territoryName).toBe("Denmark");
        expect(takeNextDefence()).toBeNull();
    });

    it("keeps several, because one turn can bring several attacks", () => {
        for (let n = 0; n < 5; n++) {
            recordDefence(aDefence());
        }
        expect(pendingDefences()).toBe(5);
    });

    it("copies the armies, so later fighting cannot rewrite the record", () => {
        const attackers = [1000, 0, 0, 0];
        recordDefence(aDefence({ startingAttackers: attackers }));
        attackers[0] = 1;
        expect(takeNextDefence().startingAttackers).toEqual([1000, 0, 0, 0]);
    });

    it("records who it happened to, rather than leaving it to be read back later", () => {
        // The territory may have changed hands by the time this is drawn. Both countries and the
        // territory NAME are captured now for exactly that reason.
        const entry = aDefence({ tookTerritory: true, state: "defender-routed" });
        recordDefence(entry);
        const queued = takeNextDefence();
        expect(queued.attackerCountry).toBe("Russia");
        expect(queued.defenderCountry).toBe("Germany");
        expect(queued.territoryName).toBe("Poland");
        expect(queued.tookTerritory).toBe(true);
    });

    it("normalises the territory id to a string, so a lookup cannot miss on type", () => {
        recordDefence(aDefence({ territoryId: 12 }));
        expect(takeNextDefence().territoryId).toBe("12");
    });

    it("can be emptied for a new game", () => {
        recordDefence(aDefence());
        recordDefence(aDefence());
        clearDefences();
        expect(pendingDefences()).toBe(0);
    });
});
