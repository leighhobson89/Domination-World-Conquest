// What the world does to what countries think of each other.
//
// The recorder is driven entirely by events, so it can be exercised in Node by emitting them
// -- which is the only affordable way to assert the two floods record NOTHING. A busy turn 1
// walks something like 1,900 first contacts, and the failure mode if that ever starts
// registering is not an exception, it is every real grudge in the world being averaged away.

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { opinionDiscipline } from "../../src/config/balance.js";
import { ActivityKind } from "../../src/state/activityLog.js";
import { DiplomaticState } from "../../src/state/diplomacy.js";
import { Events, emit } from "../../src/state/events.js";
import { installOpinionRecorder } from "../../src/ai/opinionRecorder.js";
import { allOpinions, opinionOf, resetOpinions } from "../../src/ai/opinion.js";

let uninstall = () => {};

const logged = (entry) => emit(Events.ACTIVITY_LOGGED, { entry });
const relationChanged = (payload) => emit(Events.DIPLOMACY_CHANGED, payload);

beforeEach(() => {
    resetOpinions();
    uninstall = installOpinionRecorder({
        traitsFor: (country) => (country === "Spain" ? { reconquista: 1 } : { reconquista: 0.5 })
    });
});

afterEach(() => {
    uninstall();
});

describe("what the fighting does", () => {
    it("makes a conquest the loser's grudge and not the taker's", () => {
        logged({
            kind: ActivityKind.CONQUEST,
            territory: "Catalonia",
            attacker: "France",
            defender: "Portugal"
        });
        expect(opinionOf("Portugal", "France")).toBe(opinionDiscipline.events.conquest);
        expect(opinionOf("France", "Portugal")).toBe(0);
    });

    it("scales a conquest by the loser's reconquista", () => {
        //The one trait that scales an event, and it is the trait for exactly this.
        logged({
            kind: ActivityKind.CONQUEST,
            territory: "Catalonia",
            attacker: "France",
            defender: "Spain"
        });
        expect(opinionOf("Spain", "France"))
            .toBeLessThan(opinionDiscipline.events.conquest);
    });

    it("records a siege laid, and an attack thrown back both ways", () => {
        logged({ kind: ActivityKind.SIEGE_STARTED, attacker: "France", defender: "Portugal" });
        expect(opinionOf("Portugal", "France")).toBe(opinionDiscipline.events.siegeLaid);

        resetOpinions();
        logged({ kind: ActivityKind.ATTACK_FAILED, attacker: "France", defender: "Portugal" });
        expect(opinionOf("Portugal", "France")).toBe(opinionDiscipline.events.failedAttack);
        expect(opinionOf("France", "Portugal")).toBe(opinionDiscipline.events.failedAttack);
    });

    it("ignores an entry with nobody on one side of it", () => {
        logged({ kind: ActivityKind.CONQUEST, attacker: "France", defender: "" });
        logged(null);
        expect(allOpinions()).toHaveLength(0);
    });

    it("ignores the kinds it has no feeling about", () => {
        logged({ kind: ActivityKind.SIEGE_ONGOING, attacker: "France", defender: "Portugal" });
        expect(allOpinions()).toHaveLength(0);
    });
});

describe("what the diplomacy does", () => {
    it("makes a declaration the victim's grudge alone", () => {
        relationChanged({
            a: "France", b: "Portugal", state: DiplomaticState.WAR,
            previous: DiplomaticState.NEUTRAL, by: "France", via: "declared"
        });
        expect(opinionOf("Portugal", "France")).toBe(opinionDiscipline.events.declaredWar);
        expect(opinionOf("France", "Portugal")).toBe(0);
    });

    it("charges a BETRAYAL when the war was declared out of an agreement", () => {
        //Derived rather than annotated: going to war out of an AGREEMENT is exactly the
        //transition `applyBreach()` charges for, so this asks the register the same question
        //the penalty asks.
        relationChanged({
            a: "France", b: "Portugal", state: DiplomaticState.WAR,
            previous: DiplomaticState.ALLIANCE, by: "France", via: "declared"
        });
        expect(opinionOf("Portugal", "France")).toBeLessThan(opinionDiscipline.events.declaredWar);
    });

    it("warms both sides of an agreement, by how much it cost to reach", () => {
        for (const [state, expected] of [
            [DiplomaticState.CEASEFIRE, opinionDiscipline.events.ceasefireAgreed],
            [DiplomaticState.PEACE, opinionDiscipline.events.peaceAgreed],
            [DiplomaticState.ALLIANCE, opinionDiscipline.events.allianceAgreed]
        ]) {
            resetOpinions();
            relationChanged({
                a: "France", b: "Portugal", state,
                previous: DiplomaticState.WAR, by: "France", via: "agreed"
            });
            //It starts from the WAR resting point, because that is where the pair was.
            const moved = opinionOf("Portugal", "France") - opinionDiscipline.resting.war;
            expect(moved).toBe(expected);
            expect(opinionOf("France", "Portugal")).toBe(opinionOf("Portugal", "France"));
        }
    });

    it("thanks an ally that answers a call, and is resented by who it now fights", () => {
        relationChanged({
            a: "Portugal", b: "Germany", state: DiplomaticState.WAR,
            previous: DiplomaticState.NEUTRAL, by: "Portugal", via: "calledIn",
            onBehalfOf: "France"
        });
        expect(opinionOf("France", "Portugal")).toBe(opinionDiscipline.events.callAnswered);
        expect(opinionOf("Germany", "Portugal")).toBe(opinionDiscipline.events.declaredWar);
    });

    it("costs both sides when a call is refused", () => {
        relationChanged({
            a: "Portugal", b: "France", state: DiplomaticState.NEUTRAL,
            previous: DiplomaticState.ALLIANCE, by: "Portugal", via: "declinedCall"
        });
        expect(opinionOf("France", "Portugal")).toBeLessThan(0);
        expect(opinionOf("Portugal", "France")).toBeLessThan(0);
    });

    it("says nothing about a ceasefire simply lapsing", () => {
        relationChanged({
            a: "France", b: "Portugal", state: DiplomaticState.WAR,
            previous: DiplomaticState.CEASEFIRE, via: "expired"
        });
        //It goes back to war on its own; nobody did anything, so nobody feels anything.
        //The resting point is what makes the war felt from here.
        expect(allOpinions()).toHaveLength(0);
    });
});

describe("the two floods", () => {
    it("records nothing at first contact, on either guard", () => {
        relationChanged({
            a: "France", b: "Portugal", state: DiplomaticState.NEUTRAL,
            previous: DiplomaticState.NO_CONTACT, via: "contact"
        });
        relationChanged({
            a: "France", b: "Spain", state: DiplomaticState.NEUTRAL,
            previous: DiplomaticState.NO_CONTACT
        });
        expect(allOpinions()).toHaveLength(0);
    });

    it("records nothing for a restore replacing the whole register", () => {
        relationChanged({
            a: "France", b: "Portugal", state: DiplomaticState.WAR, replaced: true
        });
        expect(allOpinions()).toHaveLength(0);
    });
});

describe("installing", () => {
    it("stops listening when it is uninstalled", () => {
        uninstall();
        logged({ kind: ActivityKind.CONQUEST, attacker: "France", defender: "Portugal" });
        expect(allOpinions()).toHaveLength(0);
    });
});
