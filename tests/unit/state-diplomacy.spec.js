// The diplomacy register: the vocabulary, the pair key, the store slice and the
// first-contact rule.
//
// Four modules are exercised here and all four run in Node:
//   * `src/state/diplomacy.js`          the enum and the pair key -- imports nothing
//   * `src/state/mutations.js`          the one writer
//   * `src/state/selectors.js`          the reads
//   * `src/rules/diplomacy/contact.js`  the pure walk that finds who touches whom
//
// The invariant every case here is really defending is SYMMETRY. A relation has no
// subject and no object, so there is one record per unordered pair; a register that
// could hold "France is at peace with Spain" without also holding the reverse would
// reproduce known-issue BS -- five straits listed on one side only, which has no
// signature at all and which nobody noticed until it was asserted.

import { beforeEach, describe, expect, it } from "vitest";

import {
    allowsAttack,
    allowsDeclaration,
    DEFAULT_DIPLOMATIC_STATE,
    describeState,
    DiplomaticState,
    DIPLOMATIC_STATES,
    FIRST_CONTACT_STATE,
    isAgreement,
    isDiplomaticState,
    relationKey,
    relationPair,
    sharesResources
} from "../../src/state/diplomacy.js";
import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import { __resetEventsForTests, Events, on } from "../../src/state/events.js";
import { clearRelations, setRelationState } from "../../src/state/mutations.js";
import {
    allRelations,
    countriesMayFight,
    relationBetween,
    relationCount,
    relationsFor,
    relationStateBetween
} from "../../src/state/selectors.js";
import { newContactsAmong, touchingCountryPairs } from "../../src/rules/diplomacy/contact.js";

beforeEach(() => {
    __resetStateForTests();
    __resetEventsForTests();
});

describe("the vocabulary", () => {
    it("has six states and no more", () => {
        expect(DIPLOMATIC_STATES).toHaveLength(6);
        for (const state of DIPLOMATIC_STATES) {
            expect(isDiplomaticState(state)).toBe(true);
            expect(describeState(state)).not.toBe("Unknown");
        }
        expect(isDiplomaticState("truce")).toBe(false);
    });

    it("lets only war be fought", () => {
        for (const state of DIPLOMATIC_STATES) {
            expect(allowsAttack(state)).toBe(state === DiplomaticState.WAR);
        }
    });

    it("counts the three negotiated states as agreements, and only those", () => {
        expect(isAgreement(DiplomaticState.PEACE)).toBe(true);
        expect(isAgreement(DiplomaticState.CEASEFIRE)).toBe(true);
        expect(isAgreement(DiplomaticState.ALLIANCE)).toBe(true);
        expect(isAgreement(DiplomaticState.WAR)).toBe(false);
        expect(isAgreement(DiplomaticState.NO_CONTACT)).toBe(false);
    });

    it("lets war be declared out of anything but no contact and war itself", () => {
        expect(allowsDeclaration(DiplomaticState.NEUTRAL)).toBe(true);
        expect(allowsDeclaration(DiplomaticState.PEACE)).toBe(true);
        expect(allowsDeclaration(DiplomaticState.CEASEFIRE)).toBe(true);
        expect(allowsDeclaration(DiplomaticState.ALLIANCE)).toBe(true);
        //Already at war, and never met -- the two states there is nothing to declare
        //out of.
        expect(allowsDeclaration(DiplomaticState.WAR)).toBe(false);
        expect(allowsDeclaration(DiplomaticState.NO_CONTACT)).toBe(false);
    });

    it("counts neutral as neither an agreement nor a licence to fight", () => {
        //The distinction the whole sixth state exists for: nothing was promised, so
        //breaking out of it costs nothing -- and nothing was declared, so nobody may
        //attack until it is.
        expect(isAgreement(DiplomaticState.NEUTRAL)).toBe(false);
        expect(allowsAttack(DiplomaticState.NEUTRAL)).toBe(false);
    });

    it("shares resources under an alliance and under nothing else", () => {
        for (const state of DIPLOMATIC_STATES) {
            expect(sharesResources(state)).toBe(state === DiplomaticState.ALLIANCE);
        }
    });
});

describe("the pair key", () => {
    it("is the same whichever way round the two countries are given", () => {
        expect(relationKey("France", "Spain")).toBe(relationKey("Spain", "France"));
    });

    it("survives a round trip", () => {
        expect(relationPair(relationKey("Spain", "France"))).toEqual(["France", "Spain"]);
    });

    it("refuses a country paired with itself, and a missing name", () => {
        expect(relationKey("France", "France")).toBeNull();
        expect(relationKey("France", null)).toBeNull();
        expect(relationKey(undefined, "France")).toBeNull();
    });

    it("separates the names with something that cannot occur inside one", () => {
        //Six territories on this map carry real parentheses in their names, so a
        //printable separator is a key collision waiting to happen.
        const key = relationKey("Andros Island (Bahamas)", "Grand Bahama (Bahamas)");
        expect(relationPair(key)).toEqual([
            "Andros Island (Bahamas)",
            "Grand Bahama (Bahamas)"
        ]);
    });
});

describe("the register", () => {
    it("starts with every pair at no contact and no rows at all", () => {
        expect(relationCount()).toBe(0);
        expect(relationStateBetween("France", "Spain")).toBe(DEFAULT_DIPLOMATIC_STATE);
        expect(relationStateBetween("France", "Spain")).toBe(DiplomaticState.NO_CONTACT);
        expect(relationBetween("France", "Spain")).toBeNull();
        expect(relationsFor("France")).toEqual([]);
    });

    it("answers the same state from either side", () => {
        setRelationState("Spain", "France", DiplomaticState.PEACE, { since: 4 });
        expect(relationStateBetween("France", "Spain")).toBe(DiplomaticState.PEACE);
        expect(relationStateBetween("Spain", "France")).toBe(DiplomaticState.PEACE);
        expect(relationCount()).toBe(1);
    });

    it("gates fighting on the state, from either side", () => {
        setRelationState("France", "Spain", DiplomaticState.WAR);
        expect(countriesMayFight("France", "Spain")).toBe(true);
        setRelationState("France", "Spain", DiplomaticState.PEACE);
        expect(countriesMayFight("Spain", "France")).toBe(false);
    });

    it("will not let two countries who have never met fight", () => {
        //No contact is not a licence: they cannot reach each other, and on the turn
        //they can, the contact rule makes them neutral -- which is not a licence
        //either. Somebody has to declare.
        expect(countriesMayFight("France", "Chile")).toBe(false);
    });

    it("keeps a ceasefire's expiry turn, and what it falls back to", () => {
        //`revertsTo` is the answer to Q2: a fact recorded at signing rather than a rule
        //applied at expiry. With NEUTRAL as the first-contact state, "back to war" and
        //"back to neutral" are genuinely different outcomes and the register does not keep
        //the history a rule would need to reconstruct.
        setRelationState("France", "Spain", DiplomaticState.CEASEFIRE, {
            since: 10, until: 20, revertsTo: DiplomaticState.WAR
        });
        expect(relationBetween("France", "Spain")).toEqual({
            state: DiplomaticState.CEASEFIRE,
            since: 10,
            until: 20,
            revertsTo: DiplomaticState.WAR
        });
    });

    it("refuses a state that is not one of the six", () => {
        expect(setRelationState("France", "Spain", "truce")).toBeNull();
        expect(relationCount()).toBe(0);
    });

    it("refuses to put a pair back to no contact", () => {
        //Contact is something that happened. Un-happening it is what a "we have
        //never met" bug would look like from the inside.
        setRelationState("France", "Spain", DiplomaticState.PEACE);
        expect(setRelationState("France", "Spain", DiplomaticState.NO_CONTACT)).toBeNull();
        expect(relationStateBetween("France", "Spain")).toBe(DiplomaticState.PEACE);
    });

    it("emits once on a change and not at all on a no-op", () => {
        const seen = [];
        on(Events.DIPLOMACY_CHANGED, (payload) => seen.push(payload));

        setRelationState("Spain", "France", DiplomaticState.WAR, { since: 1 });
        setRelationState("France", "Spain", DiplomaticState.WAR, { since: 1 });

        expect(seen).toHaveLength(1);
        //The payload is in canonical order: a listener interested in one country has
        //to check both, because a relation names no aggressor.
        expect(seen[0]).toMatchObject({
            a: "France",
            b: "Spain",
            state: DiplomaticState.WAR,
            previous: DiplomaticState.NO_CONTACT
        });
    });

    it("lists a country's relations from both sides of the key", () => {
        setRelationState("France", "Spain", DiplomaticState.PEACE);
        setRelationState("Andorra", "France", DiplomaticState.WAR);
        const rows = relationsFor("France").sort((l, r) => l.country.localeCompare(r.country));
        expect(rows.map((row) => [row.country, row.state])).toEqual([
            ["Andorra", DiplomaticState.WAR],
            ["Spain", DiplomaticState.PEACE]
        ]);
    });

    it("empties back to every pair at no contact", () => {
        setRelationState("France", "Spain", DiplomaticState.ALLIANCE);
        clearRelations();
        expect(relationCount()).toBe(0);
        expect(allRelations()).toEqual([]);
        expect(relationStateBetween("France", "Spain")).toBe(DiplomaticState.NO_CONTACT);
    });
});

// --- first contact ---------------------------------------------------------

/**
 * Four territories in a line: Alba -- Alba -- Bruma -- Carda.
 *
 * So Alba touches Bruma, Bruma touches Carda, and Alba and Carda have never met --
 * which is the case the whole state exists for.
 */
const LINE = [
    { uniqueId: "1", territoryName: "A1", dataName: "Alba" },
    { uniqueId: "2", territoryName: "A2", dataName: "Alba" },
    { uniqueId: "3", territoryName: "B1", dataName: "Bruma" },
    { uniqueId: "4", territoryName: "C1", dataName: "Carda" }
];

const NEIGHBOURS = {
    A1: ["A2"],
    A2: ["A1", "B1"],
    B1: ["A2", "C1"],
    C1: ["B1"]
};

function walk(territories = LINE) {
    const byName = new Map(territories.map((territory) => [territory.territoryName, territory]));
    return touchingCountryPairs({
        territories,
        neighboursOf: (territory) => NEIGHBOURS[territory.territoryName] ?? [],
        territoryByName: (name) => byName.get(name) ?? null
    });
}

describe("who is in contact with whom", () => {
    it("pairs the countries whose territories touch, and nobody else", () => {
        const pairs = [...walk()].map(relationPair).sort();
        expect(pairs).toEqual([
            ["Alba", "Bruma"],
            ["Bruma", "Carda"]
        ]);
    });

    it("counts a border once however many ways it is walked", () => {
        //A2 names B1 and B1 names A2, so a naive walk produces two entries for one
        //border. The canonical key is what collapses them.
        expect(walk().size).toBe(2);
    });

    it("does not pair a country with itself across its own internal border", () => {
        for (const key of walk()) {
            const [a, b] = relationPair(key);
            expect(a).not.toBe(b);
        }
    });

    it("brings two countries into contact when a conquest puts them side by side", () => {
        //Bruma's only territory falls to Carda, so Alba and Carda now share a border
        //they have never had.
        const conquered = LINE.map((territory) =>
            territory.territoryName === "B1" ? { ...territory, dataName: "Carda" } : territory
        );
        const pairs = [...walk(conquered)].map(relationPair);
        expect(pairs).toEqual([["Alba", "Carda"]]);
    });

    it("reports only the pairs the register has never seen", () => {
        seedTerritories(LINE);
        setRelationState("Alba", "Bruma", DiplomaticState.PEACE, { since: 1 });
        const fresh = newContactsAmong(walk(), (key) =>
            allRelations().some((row) => relationKey(row.a, row.b) === key));
        expect(fresh.map(relationPair)).toEqual([["Bruma", "Carda"]]);
    });

    it("puts a new contact into neutral, so a war has to be declared", () => {
        //The single most consequential constant in the system: two countries who
        //have merely met may not attack each other. This is the assertion that
        //fails, loudly and on purpose, if it is ever moved back.
        expect(FIRST_CONTACT_STATE).toBe(DiplomaticState.NEUTRAL);
        expect(allowsAttack(FIRST_CONTACT_STATE)).toBe(false);
        expect(allowsDeclaration(FIRST_CONTACT_STATE)).toBe(true);
    });
});
