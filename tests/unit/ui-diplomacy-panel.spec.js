// The diplomacy panel's content, and the confirmation shown before a declaration.
//
// Diplomacy checklist stage 4. Both modules under test are pure and both are tested here
// rather than in a browser, and that is not the usual trade -- it is the only option. Almost
// everything they describe is a state no running game reaches: nothing in the game agrees a
// peace, a ceasefire or an alliance until stage 5, so the peace row, the alliance row and
// the whole breach confirmation cannot be produced by clicking. A scenario can write one,
// which is what the e2e work in stage 6 will use; until then this is the whole account.

import { describe, expect, it } from "vitest";

import { DiplomaticState } from "../../src/state/diplomacy.js";
import { declarationPromptFor } from "../../src/ui/diplomacy/declarationPrompt.js";
import {
    countryDetail,
    diplomacyGroups,
    diplomacySummary
} from "../../src/ui/diplomacy/relationsPanelModel.js";

const relation = (country, state, extra = {}) => ({
    country, state, since: null, until: null, ...extra
});

describe("the panel's list of countries", () => {
    const relations = [
        relation("Spain", DiplomaticState.NEUTRAL),
        relation("Andorra", DiplomaticState.WAR),
        relation("Portugal", DiplomaticState.WAR),
        relation("Morocco", DiplomaticState.ALLIANCE),
        relation("Italy", DiplomaticState.PEACE)
    ];

    it("groups by state, war first", () => {
        const { groups } = diplomacyGroups({ relations });
        expect(groups.map(group => group.state)).toEqual([
            DiplomaticState.WAR,
            DiplomaticState.PEACE,
            DiplomaticState.ALLIANCE,
            DiplomaticState.NEUTRAL
        ]);
    });

    it("orders alphabetically inside a group", () => {
        //By NAME and never by size: a player looking for a country knows its name, and a
        //list that re-sorts itself as armies change is one you cannot find anything in twice.
        const { groups } = diplomacyGroups({ relations });
        expect(groups[0].rows.map(row => row.country)).toEqual(["Andorra", "Portugal"]);
    });

    it("drops a pair at no contact", () => {
        const { groups } = diplomacyGroups({
            relations: [...relations, relation("Chile", DiplomaticState.NO_CONTACT)]
        });
        expect(groups.some(group => group.state === DiplomaticState.NO_CONTACT)).toBe(false);
    });

    it("reports how many territories each holds when it is told", () => {
        const { groups } = diplomacyGroups({
            relations,
            territoryCountOf: (country) => (country === "Spain" ? 7 : 1)
        });
        const spain = groups.at(-1).rows[0];
        expect(spain).toMatchObject({ country: "Spain", territories: 7 });
    });

    it("filters on a substring of the name, case-insensitively", () => {
        const { groups } = diplomacyGroups({ relations, search: "por" });
        expect(groups.flatMap(group => group.rows).map(row => row.country))
            .toEqual(["Portugal"]);
    });

    it("counts before it filters", () => {
        //The heading says how many countries the player is at war with. That figure must not
        //move because somebody typed three letters into the search box -- a count that
        //follows the filter answers a different question from the one the heading asks.
        const { groups } = diplomacyGroups({ relations, search: "por" });
        expect(groups[0]).toMatchObject({ state: DiplomaticState.WAR, count: 2 });
        expect(groups[0].rows).toHaveLength(1);
    });

    it("says nothing at all when the player has met nobody", () => {
        expect(diplomacyGroups({ relations: [] }).groups).toEqual([]);
    });
});

describe("the summary line", () => {
    it("leads with the wars and says nobody rather than zero", () => {
        //A count of zero reads as a figure that has not loaded.
        expect(diplomacySummary({})).toMatch(/^At war with nobody/);
    });

    it("counts the three agreements together", () => {
        const line = diplomacySummary({
            [DiplomaticState.WAR]: 2,
            [DiplomaticState.PEACE]: 1,
            [DiplomaticState.ALLIANCE]: 1,
            [DiplomaticState.NEUTRAL]: 5
        });
        expect(line).toContain("At war with 2 countries");
        expect(line).toContain("2 agreements");
        expect(line).toContain("9 countries met");
    });
});

describe("what the panel offers against one country", () => {
    const actionsFor = (state) => {
        const byKind = {};
        for (const action of countryDetail({ country: "Spain", state }).actions) {
            byKind[action.kind] = action;
        }
        return byKind;
    };

    it("puts everything that needs agreeing before the acts that need nobody's consent", () => {
        //The order is the answer to "what should I do here". A declaration is one click away
        //on the map itself and is the irreversible one, so it comes last.
        expect(countryDetail({ country: "Spain", state: DiplomaticState.WAR })
            .actions.map(action => action.kind))
            .toEqual(["ceasefire", "peace", "alliance", "declare"]);
        //Dissolution is only ever offered where there is an alliance to dissolve, and it sits
        //with the declaration because it too needs nobody's agreement to attempt.
        expect(countryDetail({ country: "Spain", state: DiplomaticState.ALLIANCE })
            .actions.map(action => action.kind))
            .toEqual(["ceasefire", "peace", "alliance", "dissolve", "declare"]);
    });

    it("offers a declaration out of neutral, and says it costs nothing", () => {
        const declare = actionsFor(DiplomaticState.NEUTRAL).declare;
        expect(declare).toMatchObject({ enabled: true });
        expect(declare.reason).toMatch(/costs nothing/i);
    });

    it("offers it out of an agreement, warning that it will be confirmed", () => {
        expect(actionsFor(DiplomaticState.PEACE).declare).toMatchObject({ enabled: true });
        expect(actionsFor(DiplomaticState.PEACE).declare.reason).toMatch(/break an agreement/i);
    });

    it("refuses it with a reason when the two are already at war", () => {
        expect(actionsFor(DiplomaticState.WAR).declare).toMatchObject({ enabled: false });
        expect(actionsFor(DiplomaticState.WAR).declare.reason).toContain("already at war");
    });

    it("offers both agreements to somebody it is at war with", () => {
        const actions = actionsFor(DiplomaticState.WAR);
        expect(actions.ceasefire.enabled).toBe(true);
        expect(actions.peace.enabled).toBe(true);
    });

    it("refuses a ceasefire to somebody it is not fighting, and says why", () => {
        //Offering to stop doing something nobody is doing.
        const ceasefire = actionsFor(DiplomaticState.NEUTRAL).ceasefire;
        expect(ceasefire.enabled).toBe(false);
        expect(ceasefire.reason).toMatch(/not fighting/i);
    });

    it("still offers a peace out of neutral, which is a real move", () => {
        //Neutral to peace turns an absence into an agreement: neither may attack, and
        //breaking it later is a breach. That is worth something the absence was not.
        expect(actionsFor(DiplomaticState.NEUTRAL).peace.enabled).toBe(true);
    });

    it("offers a peace to firm up a standing ceasefire", () => {
        expect(actionsFor(DiplomaticState.CEASEFIRE).peace.enabled).toBe(true);
    });

    it("refuses a second peace to somebody already at peace", () => {
        const peace = actionsFor(DiplomaticState.PEACE).peace;
        expect(peace.enabled).toBe(false);
        expect(peace.reason).toMatch(/already at peace/i);
    });

    it("offers an alliance out of peace and explains what it costs", () => {
        const alliance = actionsFor(DiplomaticState.PEACE).alliance;
        expect(alliance.enabled).toBe(true);
        //THE CALL-IN IS NAMED IN THE SAME BREATH AS THE BENEFIT. It is the price of an
        //alliance, and a player should not meet it for the first time as a surprise.
        expect(alliance.reason).toMatch(/ASKED to join/);
        expect(alliance.reason).toMatch(/refusing ends the alliance/i);
    });

    it("sends the player to make peace first when they ask to ally out of a war", () => {
        //An alliance is peace PLUS shared resources: a country that will not first agree not
        //to fight you is not going to share its oil. The refusal says what to do instead.
        const alliance = actionsFor(DiplomaticState.WAR).alliance;
        expect(alliance.enabled).toBe(false);
        expect(alliance.reason).toMatch(/built on a peace/i);
    });

    it("offers dissolution only where there is an alliance to dissolve", () => {
        expect(actionsFor(DiplomaticState.ALLIANCE).dissolve).toMatchObject({ enabled: true });
        for (const state of [DiplomaticState.PEACE, DiplomaticState.WAR,
            DiplomaticState.NEUTRAL, DiplomaticState.CEASEFIRE]) {
            expect(actionsFor(state).dissolve).toBeUndefined();
        }
    });

    it("says dissolution is free for both, which is what makes the breach costly", () => {
        //A country that wants out of an alliance has a free, honest route available every
        //turn, so choosing the breach instead is a choice to be treacherous rather than a
        //choice to be free. That asymmetry is what makes the penalty safe to make large.
        expect(actionsFor(DiplomaticState.ALLIANCE).dissolve.reason)
            .toMatch(/nothing owed/i);
    });

    it("gives every action a reason, offered or refused", () => {
        for (const state of Object.values(DiplomaticState)) {
            for (const action of countryDetail({ country: "Spain", state }).actions) {
                expect(action.reason.length).toBeGreaterThan(10);
                //Never a demonym: there are no adjective forms for 207 country names.
                expect(action.reason).not.toMatch(/Spain[a-z]/);
            }
        }
    });

    it("refuses everything with a reason when the two have never met", () => {
        //A DISABLED CONTROL ALWAYS SAYS WHY. Standing rule in this project, and the whole
        //argument for the panel: a map can grey a button, only a panel has room for the
        //sentence that says what would change the answer.
        const detail = countryDetail({ country: "Chile", state: DiplomaticState.NO_CONTACT });
        for (const action of detail.actions) {
            expect(action.enabled).toBe(false);
            expect(action.reason.length).toBeGreaterThan(10);
        }
    });

    it("lists who else they are fighting and who they are allied with", () => {
        const detail = countryDetail({
            country: "Spain",
            state: DiplomaticState.NEUTRAL,
            theirRelations: [
                relation("Portugal", DiplomaticState.WAR),
                relation("Andorra", DiplomaticState.WAR),
                relation("Morocco", DiplomaticState.ALLIANCE),
                relation("Italy", DiplomaticState.NEUTRAL)
            ]
        });
        expect(detail.theirWars).toEqual(["Andorra", "Portugal"]);
        expect(detail.theirAllies).toEqual(["Morocco"]);
    });

    it("reports how long the standing has held", () => {
        const detail = countryDetail({
            country: "Spain", state: DiplomaticState.PEACE, since: 12, turn: 26
        });
        expect(detail.facts.find(fact => fact.label === "Since").value)
            .toBe("turn 12 (14 turns)");
    });

    it("reports a ceasefire's expiry", () => {
        const detail = countryDetail({
            country: "Spain", state: DiplomaticState.CEASEFIRE, since: 12, until: 20, turn: 14
        });
        expect(detail.facts.some(fact => fact.label === "Runs out")).toBe(true);
    });

    it("says nothing about a turn count it was not given", () => {
        //`since` is null on a relation restored from an older save and on anything a
        //scenario wrote without one. "turn null" is worse than saying nothing.
        const detail = countryDetail({ country: "Spain", state: DiplomaticState.PEACE });
        expect(detail.facts.some(fact => fact.label === "Since")).toBe(false);
    });
});

describe("the confirmation before a declaration", () => {
    it("asks nothing at all when nothing was agreed", () => {
        //THE COMMON CASE IS SILENCE. A dialog in front of every declaration is a
        //click-through inside three turns, which is worse than no dialog at all because it
        //trains the player to dismiss the one that matters.
        expect(declarationPromptFor({ country: "Spain", state: DiplomaticState.NEUTRAL }))
            .toBeNull();
        expect(declarationPromptFor({ country: "Spain", state: DiplomaticState.WAR }))
            .toBeNull();
        expect(declarationPromptFor({ country: "Spain", state: DiplomaticState.NO_CONTACT }))
            .toBeNull();
    });

    it("asks before breaking each of the three agreements", () => {
        for (const state of [
            DiplomaticState.PEACE,
            DiplomaticState.CEASEFIRE,
            DiplomaticState.ALLIANCE
        ]) {
            const prompt = declarationPromptFor({ country: "Spain", state });
            expect(prompt).toBeTruthy();
            expect(prompt.confirmLabel).toBe("Declare war");
            expect(prompt.message).toMatch(/breach/i);
        }
    });

    it("names the agreement in the title and in the cancel button", () => {
        const prompt = declarationPromptFor({ country: "Spain", state: DiplomaticState.ALLIANCE });
        expect(prompt.title).toContain("the alliance");
        expect(prompt.title).toContain("Spain");
        expect(prompt.cancelLabel).toContain("the alliance");
    });

    it("says an alliance is the most costly of them to break", () => {
        expect(declarationPromptFor({ country: "Spain", state: DiplomaticState.ALLIANCE }).message)
            .toMatch(/most costly/i);
    });

    it("quotes no penalty figure, because there is not one yet", () => {
        //The price of a breach is stage 5.6 and does not exist. A confirmation naming a
        //penalty the game does not levy is the same class of lie the move button's hint was
        //written to avoid, and the Dominapedia's War section had to be rewritten wholesale
        //once for exactly that.
        for (const state of [
            DiplomaticState.PEACE,
            DiplomaticState.CEASEFIRE,
            DiplomaticState.ALLIANCE
        ]) {
            const { message } = declarationPromptFor({ country: "Spain", state });
            expect(message).not.toMatch(/\d+\s*(turns?|%|gold)/i);
        }
    });

    it("says how long the agreement has stood, and nothing when it cannot", () => {
        expect(declarationPromptFor({
            country: "Spain", state: DiplomaticState.PEACE, since: 4, turn: 19
        }).message).toContain("15 turns ago");
        expect(declarationPromptFor({
            country: "Spain", state: DiplomaticState.PEACE, since: 19, turn: 19
        }).message).toContain("agreed this turn");
        expect(declarationPromptFor({
            country: "Spain", state: DiplomaticState.PEACE
        }).message).not.toMatch(/agreed/);
    });

    it("never uses a country name as an adjective", () => {
        //There are no demonym forms for 207 country names. The activity feed's rule, and it
        //applies to anything a player reads.
        for (const state of [
            DiplomaticState.PEACE,
            DiplomaticState.CEASEFIRE,
            DiplomaticState.ALLIANCE
        ]) {
            const prompt = declarationPromptFor({ country: "Spain", state });
            for (const text of [prompt.title, prompt.message, prompt.cancelLabel]) {
                expect(text).not.toMatch(/Spain[a-z]/);
            }
        }
    });
});
