// What the activity feed learns from the diplomacy register, and what it deliberately does not.
//
// Diplomacy stage 6. The register is the one part of this game whose events leave NO mark on
// the board -- a declaration repaints nothing, a peace repaints nothing, and an alliance
// ending is a control quietly disappearing from a panel the player may not have open. Until
// this landed the whole of it went to `console.log`.
//
// Three decisions under test here are the ones that would look like bugs to somebody who did
// not know they were chosen:
//
//   * FIRST CONTACT IS NOT NEWS. `diplomacyContacts.js` writes NEUTRAL for every pair whose
//     borders have met, and a busy turn 1 walks something like 1,900 pairings. Recording
//     those would flush every real entry out of the bounded ring inside a turn.
//   * A BETRAYAL IS DERIVED, NOT ANNOTATED. Going to war out of an AGREEMENT is exactly what
//     `betrayalPenalty` charges for, so the kind is read off the transition rather than
//     trusted to a caller having labelled it.
//   * THE ACTOR IS STORED FIRST. `playerAttacking` on a diplomatic entry means "the player is
//     the one who acted", which is how `involvesPlayer()` and the panel decide what gets a
//     card without being taught a second vocabulary.

import { beforeEach, describe, expect, it } from "vitest";

import { ActivityKind, activityTurns, clearActivityLog } from "../../src/state/activityLog.js";
import { installActivityRecorder } from "../../src/state/activityRecorder.js";
import { DiplomaticState, FIRST_CONTACT_STATE } from "../../src/state/diplomacy.js";
import { __resetStateForTests } from "../../src/state/GameState.js";
import { __resetEventsForTests } from "../../src/state/events.js";
import { clearRelations, setRelationState } from "../../src/state/mutations.js";

/** Every entry in the log, newest turn first, flattened. */
function entries() {
    return activityTurns().flatMap(({ entries: rows }) => rows);
}

/** The one entry the log holds, and a readable failure when it holds none or several. */
function only() {
    const rows = entries();
    expect(rows).toHaveLength(1);
    return rows[0];
}

let uninstall = () => {};

beforeEach(() => {
    __resetStateForTests();
    __resetEventsForTests();
    clearActivityLog();
    uninstall();
    uninstall = installActivityRecorder({ leaderNameFor: () => "" });
});

describe("what is not news", () => {
    it("says nothing when two countries' borders first meet", () => {
        //1,900 pairings on a busy turn 1. "Two countries can now see each other" is the map's
        //geometry, not an event.
        setRelationState("France", "Spain", FIRST_CONTACT_STATE, { via: "contact" });
        expect(entries()).toHaveLength(0);
    });

    it("says nothing about a first contact even when nobody annotated it", () => {
        //The two guards are deliberately independent: the annotation AND the
        //no-contact-to-neutral transition. Either alone would be a single point of failure
        //for the one write that must never be reported.
        setRelationState("France", "Spain", DiplomaticState.NEUTRAL, {});
        expect(entries()).toHaveLength(0);
    });

    it("says nothing when the register is replaced wholesale", () => {
        //A restore. `clearRelations()` and `snapshot.js` both emit `{replaced: true}`, and a
        //loaded game must not read as two hundred countries declaring war at once.
        setRelationState("France", "Spain", DiplomaticState.WAR, { by: "France", via: "declared" });
        clearActivityLog();
        clearRelations();
        expect(entries()).toHaveLength(0);
    });
});

describe("a declaration of war", () => {
    it("is recorded, with the country that declared stored first", () => {
        setRelationState("France", "Spain", DiplomaticState.WAR, {
            by: "Spain", via: "declared"
        });
        const entry = only();
        expect(entry.kind).toBe(ActivityKind.DECLARATION);
        expect(entry.diplomacy.actor).toBe("Spain");
        expect(entry.diplomacy.a).toBe("Spain");
        expect(entry.diplomacy.b).toBe("France");
        expect(entry.diplomacy.via).toBe("declared");
    });

    it("keeps both names when nobody is named as the actor", () => {
        //A ceasefire lapsing back into war has no agent. The pair is then taken in the
        //register's own canonical order and the wording says so.
        setRelationState("France", "Spain", DiplomaticState.WAR, { via: "expired" });
        const entry = only();
        expect(entry.diplomacy.actor).toBeNull();
        expect([entry.diplomacy.a, entry.diplomacy.b].sort()).toEqual(["France", "Spain"]);
    });

    it("is a DECLARATION and not a betrayal when it comes out of neutral", () => {
        setRelationState("France", "Spain", DiplomaticState.NEUTRAL, { via: "contact" });
        setRelationState("France", "Spain", DiplomaticState.WAR, {
            by: "France", via: "declared"
        });
        expect(only().kind).toBe(ActivityKind.DECLARATION);
    });

    it("records an ally entering a war it was called into, and names the principal", () => {
        setRelationState("Belgium", "Spain", DiplomaticState.WAR, {
            by: "Belgium", via: "calledIn", onBehalfOf: "France"
        });
        const entry = only();
        expect(entry.kind).toBe(ActivityKind.DECLARATION);
        expect(entry.diplomacy.via).toBe("calledIn");
        expect(entry.diplomacy.onBehalfOf).toBe("France");
    });
});

describe("a betrayal", () => {
    it("is derived from going to war out of an agreement, not from an annotation", () => {
        //`applyBreach()` is called on this transition and on no other, so asking the register
        //asks the same question the penalty asks.
        setRelationState("France", "Spain", DiplomaticState.PEACE, {
            by: "France", via: "agreed"
        });
        clearActivityLog();
        setRelationState("France", "Spain", DiplomaticState.WAR, {
            by: "France", via: "declared"
        });
        const entry = only();
        expect(entry.kind).toBe(ActivityKind.BETRAYAL);
        expect(entry.diplomacy.from).toBe(DiplomaticState.PEACE);
    });

    it("is a betrayal out of an alliance and out of a ceasefire too", () => {
        for (const broken of [DiplomaticState.ALLIANCE, DiplomaticState.CEASEFIRE]) {
            __resetStateForTests();
            clearActivityLog();
            setRelationState("France", "Spain", broken, { by: "France", via: "agreed" });
            clearActivityLog();
            setRelationState("France", "Spain", DiplomaticState.WAR, {
                by: "France", via: "declared"
            });
            expect(only().kind, broken).toBe(ActivityKind.BETRAYAL);
        }
    });
});

describe("agreements", () => {
    it("records a ceasefire as a treaty, with the proposer first", () => {
        setRelationState("France", "Spain", DiplomaticState.CEASEFIRE, {
            by: "Spain", via: "agreed", until: 20, revertsTo: DiplomaticState.WAR
        });
        const entry = only();
        expect(entry.kind).toBe(ActivityKind.TREATY);
        expect(entry.diplomacy.a).toBe("Spain");
        expect(entry.diplomacy.to).toBe(DiplomaticState.CEASEFIRE);
    });

    it("records an alliance as its own kind", () => {
        setRelationState("France", "Spain", DiplomaticState.ALLIANCE, {
            by: "France", via: "agreed"
        });
        expect(only().kind).toBe(ActivityKind.ALLIANCE);
    });

    it("records an alliance ending, and keeps the three endings apart", () => {
        for (const via of ["declinedCall", "dissolved", "dropped"]) {
            __resetStateForTests();
            clearActivityLog();
            setRelationState("France", "Spain", DiplomaticState.ALLIANCE, {
                by: "France", via: "agreed"
            });
            clearActivityLog();
            setRelationState("France", "Spain", DiplomaticState.NEUTRAL, {
                by: "Spain", via
            });
            const entry = only();
            expect(entry.kind, via).toBe(ActivityKind.ALLIANCE);
            expect(entry.diplomacy.via, via).toBe(via);
            expect(entry.diplomacy.from, via).toBe(DiplomaticState.ALLIANCE);
        }
    });

    it("records a ceasefire running out", () => {
        setRelationState("France", "Spain", DiplomaticState.CEASEFIRE, {
            by: "France", via: "agreed", until: 5
        });
        clearActivityLog();
        setRelationState("France", "Spain", DiplomaticState.NEUTRAL, { via: "expired" });
        const entry = only();
        expect(entry.kind).toBe(ActivityKind.TREATY);
        expect(entry.diplomacy.via).toBe("expired");
    });
});

describe("who the entry says the player is", () => {
    it("marks nobody when there is no player, which is a spectated game", () => {
        setRelationState("France", "Spain", DiplomaticState.WAR, {
            by: "France", via: "declared"
        });
        const entry = only();
        expect(entry.playerAttacking).toBe(false);
        expect(entry.playerDefending).toBe(false);
    });
});
