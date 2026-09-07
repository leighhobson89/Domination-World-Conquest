// What the recorder puts on an entry, and what it refuses to.
//
// Two things landed here together and both are about the same mistake in two
// different clothes: recording a fact versus looking it up again later.
//
// **A leader's name is captured AT THE EVENT.** `src/ai/succession.js` replaces a
// country's leader every 15-20 turns, so a news card drawn on turn 40 that asked the
// world who ruled Germany would credit a turn-12 conquest to whoever is in charge
// now. That is known-issue AS in a new place: the Wars & Sieges tab drew the
// defending flag from the territory's CURRENT owner and so showed the attacker's
// flag on both sides of any war the attacker had won.
//
// **A disaster is ONE entry per turn, not one per territory.** The roll happens
// against every territory on the map independently, so a large empire would write a
// hundred entries in a turn, flush the bounded log, and read as a spreadsheet. The
// aggregation is done by the caller in `resourceCalculations.js`; what is pinned
// here is that the entry carries a count and that a nonsense count is refused
// rather than stored.

import { beforeEach, describe, expect, it } from "vitest";

import {
    ActivityKind,
    activityTurns,
    clearActivityLog,
} from "../../src/state/activityLog.js";
import {
    installActivityRecorder,
    recordDisaster,
    recordFailedAttack,
} from "../../src/state/activityRecorder.js";

/** Every entry in the log, newest turn first, flattened. */
function entries() {
    return activityTurns().flatMap(({ entries: rows }) => rows);
}

beforeEach(() => clearActivityLog());

describe("the injected leader lookup", () => {
    it("puts the leader's name on a failed attack, for both sides", () => {
        installActivityRecorder({
            leaderNameFor: (country) =>
                country === "France" ? "Queen Audrey the Conqueror" : "Chancellor Adler II",
        });

        recordFailedAttack({
            territory: "Alsace",
            defender: "France",
            attacker: "Germany",
            playerAttacking: true,
        });

        const [entry] = entries();
        expect(entry.attackerLeader).toBe("Chancellor Adler II");
        expect(entry.defenderLeader).toBe("Queen Audrey the Conqueror");
    });

    it("records an empty name rather than throwing when the lookup fails", () => {
        // The lookup reaches game code built in a different half of bootstrap from
        // the recorder. An entry with no leader costs the player a clause in a
        // sentence; an exception here would cost them the whole event.
        installActivityRecorder({
            leaderNameFor: () => {
                throw new Error("leaders are not built yet");
            },
        });

        expect(() => recordFailedAttack({
            territory: "Alsace",
            defender: "France",
            attacker: "Germany",
            playerDefending: true,
        })).not.toThrow();

        expect(entries()[0].attackerLeader).toBe("");
    });

    it("is replaced on a repeat install, because bootstrap installs before leaders exist", () => {
        installActivityRecorder({ leaderNameFor: () => "First" });
        installActivityRecorder({ leaderNameFor: () => "Second" });

        recordFailedAttack({
            territory: "Alsace",
            defender: "France",
            attacker: "Germany",
            playerDefending: true,
        });
        expect(entries()[0].attackerLeader).toBe("Second");
    });
});

describe("recording a disaster", () => {
    it("stores the event, the worst-hit territory and the count", () => {
        recordDisaster({ event: "Food Disaster", territory: "Bavaria", territoriesHit: 12 });

        const [entry] = entries();
        expect(entry.kind).toBe(ActivityKind.DISASTER);
        expect(entry.event).toBe("Food Disaster");
        expect(entry.territory).toBe("Bavaria");
        expect(entry.territoriesHit).toBe(12);
    });

    it("marks it as the player's own news", () => {
        // A famine is nobody's attack, so the card writer cannot reach it through
        // the involvement test the war entries use. Disasters are only recorded for
        // the player, and this is the flag that says so.
        recordDisaster({ event: "Mutiny", territory: "Saxony", territoriesHit: 1 });
        expect(entries()[0].playerDefending).toBe(true);
    });

    it("refuses a disaster that hit nothing", () => {
        // The income pass calls this once per turn whether or not anything was
        // struck; a zero-count entry would be a card reporting a famine that did
        // not happen.
        expect(recordDisaster({ event: "Food Disaster", territory: "", territoriesHit: 0 })).toBeNull();
        expect(recordDisaster({ event: "Food Disaster", territory: "", territoriesHit: NaN })).toBeNull();
        expect(recordDisaster({ event: "", territory: "Bavaria", territoriesHit: 3 })).toBeNull();
        expect(entries()).toHaveLength(0);
    });
});
