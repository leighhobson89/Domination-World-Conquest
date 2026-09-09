// The opinion store: what a country thinks of another country specifically.
//
// It is pure and runs in Node, which is what makes the whole policy assertable here rather
// than by playing two hundred turns and watching. The four things worth pinning are the ones
// that are invisible in a running game: that the two directions of a pair are independent,
// that an absent pair reads as its RESTING point rather than as zero, that settling actually
// arrives rather than creeping asymptotically for ever, and that a round trip through a save
// changes nothing.

import { describe, expect, it, beforeEach } from "vitest";

import { opinionDiscipline } from "../../src/config/balance.js";
import { DiplomaticState } from "../../src/state/diplomacy.js";
import {
    adjustOpinion,
    allOpinions,
    applyOpinionEvent,
    clearOpinionsFor,
    describeOpinion,
    describeOpinionReason,
    OpinionEvent,
    opinionOf,
    resetOpinions,
    restingFor,
    restoreOpinions,
    settleOpinions
} from "../../src/ai/opinion.js";

const relations = (rows) => rows.map(([a, b, state]) => ({ a, b, state }));

beforeEach(() => {
    resetOpinions();
});

describe("the resting point", () => {
    it("is what an unrecorded pair reads as, and it is not zero", () => {
        expect(opinionOf("France", "Spain", DiplomaticState.WAR))
            .toBe(opinionDiscipline.resting.war);
        expect(opinionOf("France", "Spain", DiplomaticState.ALLIANCE))
            .toBe(opinionDiscipline.resting.alliance);
        expect(opinionOf("France", "Spain", DiplomaticState.NEUTRAL)).toBe(0);
    });

    it("runs hostile through neutral to warm across the six states", () => {
        expect(restingFor(DiplomaticState.WAR)).toBeLessThan(0);
        expect(restingFor(DiplomaticState.NEUTRAL)).toBe(0);
        expect(restingFor(DiplomaticState.CEASEFIRE))
            .toBeLessThan(restingFor(DiplomaticState.PEACE));
        expect(restingFor(DiplomaticState.PEACE))
            .toBeLessThan(restingFor(DiplomaticState.ALLIANCE));
    });

    it("answers neutral for a state it has never heard of, rather than throwing", () => {
        //Called for every row in the register on every turn -- a state the enum grows later
        //must not stop the world settling.
        expect(restingFor("condominium")).toBe(0);
    });
});

describe("directionality", () => {
    it("keeps the two halves of a pair independent", () => {
        adjustOpinion("France", "Spain", -40);
        expect(opinionOf("France", "Spain")).toBe(-40);
        expect(opinionOf("Spain", "France")).toBe(0);
    });

    it("has no opinion of itself", () => {
        expect(adjustOpinion("France", "France", -40)).toBe(0);
        expect(allOpinions()).toHaveLength(0);
    });

    it("clamps to the range in both directions", () => {
        const limit = opinionDiscipline.range;
        adjustOpinion("France", "Spain", -1000);
        expect(opinionOf("France", "Spain")).toBe(-limit);
        adjustOpinion("Spain", "France", 1000);
        expect(opinionOf("Spain", "France")).toBe(limit);
    });

    it("starts a new entry from the resting point, not from zero", () => {
        //The first thing that ever happens between two countries at war is felt on top of the
        //fact that they are at war.
        adjustOpinion("France", "Spain", -10, { state: DiplomaticState.WAR });
        expect(opinionOf("France", "Spain")).toBe(opinionDiscipline.resting.war - 10);
    });
});

describe("events", () => {
    it("moves only the wronged side for an act somebody chose", () => {
        applyOpinionEvent(OpinionEvent.DECLARED_WAR, { holder: "Spain", subject: "France" });
        expect(opinionOf("Spain", "France")).toBe(opinionDiscipline.events.declaredWar);
        //A declarer does not resent having declared.
        expect(opinionOf("France", "Spain")).toBe(0);
    });

    it("moves both sides for a treaty and for an attack thrown back", () => {
        applyOpinionEvent(OpinionEvent.PEACE_AGREED, { holder: "Spain", subject: "France" });
        expect(opinionOf("Spain", "France")).toBe(opinionDiscipline.events.peaceAgreed);
        expect(opinionOf("France", "Spain")).toBe(opinionDiscipline.events.peaceAgreed);

        resetOpinions();
        applyOpinionEvent(OpinionEvent.FAILED_ATTACK, { holder: "Spain", subject: "France" });
        expect(opinionOf("Spain", "France")).toBeLessThan(0);
        expect(opinionOf("France", "Spain")).toBeLessThan(0);
    });

    it("scales an event when it is told to, which is how reconquista reaches a conquest", () => {
        applyOpinionEvent(OpinionEvent.CONQUEST,
            { holder: "Spain", subject: "France", scale: 1.5 });
        expect(opinionOf("Spain", "France")).toBe(opinionDiscipline.events.conquest * 1.5);
    });

    it("does nothing at all for a name it does not know", () => {
        //A closed set, the rule `ActivityKind` follows: an unrecognised name must be a no-op
        //rather than a silent zero that looks like a working hook.
        expect(applyOpinionEvent("sulked", { holder: "Spain", subject: "France" })).toBeNull();
        expect(allOpinions()).toHaveLength(0);
    });

    it("makes a betrayal the heaviest thing that can happen between two countries", () => {
        const worst = Math.min(...Object.values(opinionDiscipline.events));
        expect(opinionDiscipline.events.betrayal).toBe(worst);
    });
});

describe("settling", () => {
    it("pulls a grudge back toward the resting point of the state it is in", () => {
        adjustOpinion("Spain", "France", -90);
        settleOpinions(relations([["Spain", "France", DiplomaticState.PEACE]]));
        expect(opinionOf("Spain", "France")).toBeGreaterThan(-90);
        expect(opinionOf("Spain", "France")).toBeLessThan(opinionDiscipline.resting.peace);
    });

    it("pulls a warm relationship DOWN when the two are at war", () => {
        adjustOpinion("Spain", "France", 90);
        settleOpinions(relations([["Spain", "France", DiplomaticState.WAR]]));
        expect(opinionOf("Spain", "France")).toBeLessThan(90);
    });

    it("arrives, and forgets the entry when it does", () => {
        //A geometric approach never lands exactly on its target, and rounding to one decimal
        //place makes the last stretch a fixed point -- so "arrived" is a distance. Without
        //that, every pair that ever exchanged a shot is stored for the rest of the game.
        adjustOpinion("Spain", "France", -90);
        const rows = relations([["Spain", "France", DiplomaticState.PEACE]]);
        for (let turn = 0; turn < 500; turn += 1) {
            settleOpinions(rows);
        }
        expect(allOpinions()).toHaveLength(0);
        expect(opinionOf("Spain", "France", DiplomaticState.PEACE))
            .toBe(opinionDiscipline.resting.peace);
    });

    it("settles a pair that has no entry at all, so a long war sours it with no event", () => {
        const rows = relations([["Spain", "France", DiplomaticState.WAR]]);
        settleOpinions(rows);
        //Nothing to store: an unrecorded pair is already AT the war resting point.
        expect(opinionOf("Spain", "France", DiplomaticState.WAR))
            .toBe(opinionDiscipline.resting.war);
    });

    it("moves both directions of every row it is given", () => {
        adjustOpinion("Spain", "France", -90);
        adjustOpinion("France", "Spain", 90);
        const moved = settleOpinions(relations([["Spain", "France", DiplomaticState.NEUTRAL]]));
        expect(moved).toBe(2);
        expect(opinionOf("Spain", "France")).toBeGreaterThan(-90);
        expect(opinionOf("France", "Spain")).toBeLessThan(90);
    });
});

describe("housekeeping", () => {
    it("forgets a country that no longer exists, in both directions", () => {
        adjustOpinion("Spain", "France", -40);
        adjustOpinion("France", "Spain", -40);
        adjustOpinion("Spain", "Portugal", -40);
        expect(clearOpinionsFor("France")).toBe(2);
        expect(allOpinions()).toHaveLength(1);
    });

    it("round-trips through a save", () => {
        adjustOpinion("Spain", "France", -40.5);
        adjustOpinion("France", "Spain", 12);
        const saved = JSON.parse(JSON.stringify(allOpinions()));
        resetOpinions();
        expect(opinionOf("Spain", "France")).toBe(0);
        restoreOpinions(saved);
        expect(opinionOf("Spain", "France")).toBe(-40.5);
        expect(opinionOf("France", "Spain")).toBe(12);
    });

    it("saves rows rather than keys, because the key carries a control character", () => {
        adjustOpinion("Grand Bahama (Bahamas)", "France", -40);
        const [row] = allOpinions();
        expect(row.holder).toBe("Grand Bahama (Bahamas)");
        expect(row.subject).toBe("France");
    });

    it("restores nothing from a save taken before opinion existed", () => {
        restoreOpinions(undefined);
        expect(allOpinions()).toHaveLength(0);
    });
});

describe("wording", () => {
    it("runs hostile to devoted, symmetric about neutral", () => {
        expect(describeOpinion(-100)).toBe("hostile");
        expect(describeOpinion(-50)).toBe("cold");
        expect(describeOpinion(0)).toBe("neutral");
        expect(describeOpinion(50)).toBe("friendly");
        expect(describeOpinion(100)).toBe("devoted");
    });

    it("says nothing about an opinion too small to be worth a sentence", () => {
        //The same contract `reasonFrom()`'s 0.15 floor has: an explanation naming a term that
        //barely moved is worse than no explanation.
        expect(describeOpinionReason(opinionDiscipline.notableFrom - 1)).toBeNull();
        expect(describeOpinionReason(-(opinionDiscipline.notableFrom - 1))).toBeNull();
        expect(describeOpinionReason(-80)).toBeTruthy();
        expect(describeOpinionReason(80)).toBeTruthy();
    });
});
