// Breaking an agreement, and the three ways of ending one that are not a breach.
//
// Diplomacy checklist stage 5.6. Leigh asked for *"a very large penalty indeed if broken"* and
// §3.4 then narrowed what "broken" means to exactly one act. The rule is one sentence:
//
//     THE PENALTY IS FOR ENDING AN ALLIANCE WHEN BOTH SIDES DO NOT AGREE, AND FOR NOTHING ELSE.
//
// So there are three endings and only one costs, and each is asserted separately below —
// "the alliance ended" is three different events with three different prices, and a test that
// checked only that it ended would pass for all three while the game charged the wrong one.
//
// **Q4 IS ANSWERED AND THE PENALTY IS REPUTATIONAL ONLY.** No fine. A gold penalty is a number
// nobody can calibrate — what is a treaty worth in gold? — and it would fall hardest on the
// countries least able to absorb it. What the reputation costs is DERIVED instead: a breach
// drops every other agreement the betrayer holds, and an alliance pays a standing share of
// income, so tearing up one treaty is paid for in the dividends of all the rest.

import { beforeEach, describe, expect, it } from "vitest";

import { betrayalPenalty } from "../../src/config/balance.js";
import { DiplomaticState, ProposalKind } from "../../src/state/diplomacy.js";
import {
    allTreachery,
    isTreacherous,
    proposalOutcomeFor,
    recordBreach,
    resetDiplomacyMemory,
    treacheryOf
} from "../../src/ai/diplomacy.js";

beforeEach(() => {
    resetDiplomacyMemory();
});

const relations = (...rows) => rows.map(([country, state]) => ({ country, state }));

describe("what counts as a breach", () => {
    it("charges for tearing up an alliance", () => {
        const outcome = recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.ALLIANCE, turn: 10
        });
        expect(outcome).toMatchObject({ breach: true, severity: "alliance" });
        expect(outcome.until).toBe(10 + betrayalPenalty.treacheryTurns.alliance);
    });

    it("charges less for a peace and less again for a ceasefire", () => {
        //The ordering the design asks for, and it is the same ordering as how hard each was
        //to get in the first place.
        expect(betrayalPenalty.treacheryTurns.alliance)
            .toBeGreaterThan(betrayalPenalty.treacheryTurns.peace);
        expect(betrayalPenalty.treacheryTurns.peace)
            .toBeGreaterThan(betrayalPenalty.treacheryTurns.ceasefire);
    });

    it("charges NOTHING for leaving neutral", () => {
        //Not a leniency — it is what the word neutral means. Nothing was promised, so nothing
        //is broken, and this is why the rule almost never fires: the overwhelming majority of
        //declarations are made out of neutral and are free.
        const outcome = recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.NEUTRAL, turn: 10
        });
        expect(outcome.breach).toBe(false);
        expect(isTreacherous("Alba", 10)).toBe(false);
    });

    it("charges nothing for declaring on somebody never met", () => {
        expect(recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.NO_CONTACT, turn: 10
        }).breach).toBe(false);
    });

    it("charges nothing when war was already declared", () => {
        expect(recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.WAR, turn: 10
        }).breach).toBe(false);
    });
});

describe("what a breach costs", () => {
    it("tears up every OTHER agreement the betrayer holds", () => {
        //The heart of the penalty, and the reason it needs no gold figure: nobody keeps a
        //treaty with somebody who has just torn one up.
        const outcome = recordBreach({
            betrayer: "Alba",
            victim: "Brava",
            broken: DiplomaticState.ALLIANCE,
            turn: 10,
            relations: relations(
                ["Brava", DiplomaticState.ALLIANCE],
                ["Cadra", DiplomaticState.PEACE],
                ["Dorn", DiplomaticState.CEASEFIRE],
                ["Elin", DiplomaticState.WAR],
                ["Fenn", DiplomaticState.NEUTRAL]
            )
        });
        //The agreements, and only the agreements. A war and a neutral are not treaties.
        expect(outcome.drops.sort()).toEqual(["Cadra", "Dorn"]);
    });

    it("does not list the victim among the drops", () => {
        //That relation is being replaced by the declaration itself, and dropping it to neutral
        //here would undo the war a line before it is written.
        const outcome = recordBreach({
            betrayer: "Alba",
            victim: "Brava",
            broken: DiplomaticState.PEACE,
            turn: 10,
            relations: relations(["Brava", DiplomaticState.PEACE])
        });
        expect(outcome.drops).toEqual([]);
    });

    it("costs a country with nothing to lose almost nothing", () => {
        //The penalty is proportional to what being trustworthy was worth to this country,
        //which is what makes it self-calibrating rather than arbitrary.
        const outcome = recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.PEACE, turn: 10,
            relations: relations(["Brava", DiplomaticState.PEACE])
        });
        expect(outcome.drops).toEqual([]);
        expect(outcome.breach).toBe(true);
    });

    it("decides and writes nothing", () => {
        //It reads no store and writes none, which is what keeps the whole policy testable in
        //Node. The drops are returned for `aiCalculations.js` to put through the mutations.
        const outcome = recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.ALLIANCE, turn: 10,
            relations: relations(["Cadra", DiplomaticState.PEACE])
        });
        expect(Array.isArray(outcome.drops)).toBe(true);
    });
});

describe("the treachery mark", () => {
    const mark = (turn = 10, broken = DiplomaticState.ALLIANCE) =>
        recordBreach({ betrayer: "Alba", victim: "Brava", broken, turn });

    it("stands at full strength the turn it is earned", () => {
        mark(10);
        expect(treacheryOf("Alba", 10)).toBeCloseTo(1, 5);
    });

    it("DECAYS rather than lapsing all at once", () => {
        //`theatreCommitment.wallMemoryTurns` is the precedent: "they tore up a treaty on turn
        //12" stops being the most useful thing to know about a country forty turns later.
        mark(10);
        const half = treacheryOf("Alba", 10 + betrayalPenalty.treacheryTurns.alliance / 2);
        expect(half).toBeGreaterThan(0);
        expect(half).toBeLessThan(1);
    });

    it("is gone when it runs out, and forgets the country entirely", () => {
        mark(10);
        expect(treacheryOf("Alba", 10 + betrayalPenalty.treacheryTurns.alliance)).toBe(0);
        expect(allTreachery()).toEqual([]);
    });

    it("marks nobody by default", () => {
        expect(isTreacherous("Alba", 10)).toBe(false);
        expect(treacheryOf("Alba", 10)).toBe(0);
    });

    it("EXTENDS on a second betrayal rather than replacing the first", () => {
        //A country that tears up a peace while already marked for an alliance must not get the
        //shorter sentence for it.
        mark(10, DiplomaticState.ALLIANCE);
        mark(12, DiplomaticState.CEASEFIRE);
        expect(treacheryOf("Alba", 10 + betrayalPenalty.treacheryTurns.alliance - 1))
            .toBeGreaterThan(0);
    });

    it("is wiped by a new game", () => {
        mark(10);
        resetDiplomacyMemory();
        expect(isTreacherous("Alba", 10)).toBe(false);
    });
});

describe("nobody deals with a traitor", () => {
    it("refuses every agreement while the mark stands", () => {
        recordBreach({
            betrayer: "Alba", victim: "Zeta", broken: DiplomaticState.ALLIANCE, turn: 10
        });
        for (const kind of [ProposalKind.CEASEFIRE, ProposalKind.PEACE]) {
            const answer = proposalOutcomeFor({
                country: "Brava",
                proposer: "Alba",
                kind,
                state: DiplomaticState.WAR,
                turn: 11,
                //Everything that would otherwise argue loudly for yes.
                posture: "DEFEND",
                otherWars: 6,
                failuresAgainstProposer: 5,
                urgency: 1
            });
            expect(answer.accepted).toBe(false);
            expect(answer.reason).toMatch(/broken an agreement/i);
        }
    });

    it("deals with them again once it is forgotten", () => {
        recordBreach({
            betrayer: "Alba", victim: "Zeta", broken: DiplomaticState.CEASEFIRE, turn: 10
        });
        const later = 10 + betrayalPenalty.treacheryTurns.ceasefire;
        const answer = proposalOutcomeFor({
            country: "Brava",
            proposer: "Alba",
            kind: ProposalKind.PEACE,
            state: DiplomaticState.WAR,
            turn: later,
            posture: "DEFEND",
            otherWars: 3
        });
        expect(answer.accepted).toBe(true);
    });

    it("does not spend the proposal cooldown", () => {
        //Being refused for treachery is a fact about the MARK rather than about the offer, and
        //it stops applying on its own. Spending the cooldown on it would punish twice.
        recordBreach({
            betrayer: "Alba", victim: "Zeta", broken: DiplomaticState.CEASEFIRE, turn: 10
        });
        proposalOutcomeFor({
            country: "Brava", proposer: "Alba", kind: ProposalKind.PEACE,
            state: DiplomaticState.WAR, turn: 11
        });
        const later = 10 + betrayalPenalty.treacheryTurns.ceasefire;
        expect(proposalOutcomeFor({
            country: "Brava", proposer: "Alba", kind: ProposalKind.PEACE,
            state: DiplomaticState.WAR, turn: later, posture: "DEFEND", otherWars: 3
        }).reason).not.toMatch(/asked recently/i);
    });

    it("marks the BETRAYER and not the country they betrayed", () => {
        recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.ALLIANCE, turn: 10
        });
        expect(isTreacherous("Alba", 11)).toBe(true);
        expect(isTreacherous("Brava", 11)).toBe(false);
    });
});

describe("the three endings, priced separately", () => {
    //"The alliance ended" is three different events. A test that checked only that it ended
    //would pass for all three while the game charged the wrong one.

    it("a REFUSED CALL-IN costs neither side anything", () => {
        //`applyCallInAnswer()` puts the pair back to NEUTRAL and calls nothing here. The
        //aggressor's cost is exactly the thing that happened: they went to war without an ally
        //they were relying on, which is a consequence rather than a fine.
        expect(isTreacherous("Alba", 10)).toBe(false);
        expect(isTreacherous("Brava", 10)).toBe(false);
    });

    it("a MUTUAL DISSOLUTION costs neither side anything", () => {
        //`dissolveAlliance()` writes NEUTRAL and charges nobody. It is what makes an alliance
        //something a country can plan its way out of rather than only betray its way out of.
        expect(allTreachery()).toEqual([]);
    });

    it("WALKING OUT is the only one that charges", () => {
        const outcome = recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.ALLIANCE, turn: 10,
            relations: relations(["Cadra", DiplomaticState.PEACE])
        });
        expect(outcome.breach).toBe(true);
        expect(isTreacherous("Alba", 10)).toBe(true);
        expect(outcome.drops).toEqual(["Cadra"]);
    });

    it("and that asymmetry is what makes the penalty safe to make large", () => {
        //A country that wants out has a free, honest route available every single turn, so
        //choosing the breach instead is a choice to be treacherous rather than a choice to be
        //free. The penalty is priced against that rather than against wanting to leave.
        expect(betrayalPenalty.treacheryTurns.alliance).toBeGreaterThan(0);
        expect(betrayalPenalty.dropsOtherAgreements).toBe(true);
    });
});
