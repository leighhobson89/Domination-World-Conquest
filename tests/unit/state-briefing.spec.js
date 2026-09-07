// The turn-start briefing (register item E7): the facts, and the card built from them.
//
// The log stores facts and never sentences, so this is two modules under test at once --
// `src/state/briefing.js` gathers the figures and `newsCardFor()` turns them into prose. Both
// are pure; `briefing.js` deliberately imports nothing at all, because the border warning
// needs the adjacency graph and that module THROWS when its data has not been loaded, which
// is always the case in Node.
//
// The rule that shapes the wording: **any paragraph may be absent.** A quiet turn is a
// two-sentence card, and that is correct rather than incomplete -- printing "no borders are
// threatened" every turn is how you train a player to stop reading the one time it matters.

import { describe, expect, it } from "vitest";

import { ActivityKind } from "../../src/state/activityLog.js";
import { briefingFacts, weakBordersFor } from "../../src/state/briefing.js";
import { newsCardFor } from "../../src/ui/activityFeed/describeActivity.js";

const territory = (territoryName, army) => ({ territoryName, armyForCurrentTerritory: army });

describe("which borders are in danger", () => {
    it("names a territory whose garrison is smaller than the enemy facing it", () => {
        const owned = [territory("Alsace", 100), territory("Bavaria", 900)];
        const enemies = {
            Alsace: [territory("Lorraine", 400)],
            Bavaria: [territory("Tyrol", 200)]
        };

        const result = weakBordersFor(owned, (own) => enemies[own.territoryName]);

        expect(result.names).toEqual(["Alsace"]);
        expect(result.count).toBe(1);
    });

    it("takes the STRONGEST neighbour, not the nearest or the last", () => {
        const owned = [territory("Alsace", 300)];
        const result = weakBordersFor(owned, () => [
            territory("Weak", 50), territory("Strong", 900), territory("Middling", 200)
        ]);
        expect(result.names).toEqual(["Alsace"]);
    });

    it("orders by MARGIN, so the worst is named first", () => {
        // Not by ratio: a province held by nobody is infinite against any attacker, and
        // every undefended territory would then tie and sort arbitrarily.
        const owned = [
            territory("Slightly", 90), territory("Badly", 10), territory("Somewhat", 50)
        ];
        const enemies = { Slightly: 100, Badly: 5000, Somewhat: 800 };
        const result = weakBordersFor(owned,
            (own) => [territory("enemy", enemies[own.territoryName])]);
        expect(result.names).toEqual(["Badly", "Somewhat", "Slightly"]);
    });

    it("names only the worst few but counts them all", () => {
        const owned = Array.from({ length: 9 }, (_, n) => territory("T" + n, 1));
        const result = weakBordersFor(owned, () => [territory("enemy", 100)], 3);
        expect(result.names).toHaveLength(3);
        expect(result.count).toBe(9);
    });

    it("says nothing about an even border, because equal is not losing", () => {
        const owned = [territory("Alsace", 500)];
        expect(weakBordersFor(owned, () => [territory("enemy", 500)]).count).toBe(0);
    });

    it("copes with no territories, no neighbours and missing figures", () => {
        expect(weakBordersFor([], () => [])).toEqual({ names: [], count: 0 });
        expect(weakBordersFor(undefined, () => [])).toEqual({ names: [], count: 0 });
        expect(weakBordersFor([territory("A", 5)], () => undefined).count).toBe(0);
        expect(weakBordersFor([{ territoryName: "A" }], () => [{ territoryName: "B" }]).count)
            .toBe(0);
    });
});

describe("the facts the log stores", () => {
    it("is JSON-safe, with every field present even when nothing was passed", () => {
        // The entry goes into a save file, so a `Map`, an element or an undefined would
        // either fail to serialise or come back as something else.
        const facts = briefingFacts();
        expect(JSON.parse(JSON.stringify(facts))).toEqual(facts);
        expect(facts.weakBorderNames).toEqual([]);
        expect(facts.goldIncome).toBe(0);
    });

    it("copies the border names rather than aliasing them", () => {
        const weakBorders = { names: ["Alsace"], count: 1 };
        const facts = briefingFacts({ weakBorders });
        weakBorders.names.push("Bavaria");
        expect(facts.weakBorderNames).toEqual(["Alsace"]);
    });

    it("rounds the income, because a treasury is not written to nine decimal places", () => {
        expect(briefingFacts({ goldIncome: 4180.4172 }).goldIncome).toBe(4180);
    });
});

describe("the briefing card", () => {
    function card(overrides = {}) {
        return newsCardFor({
            id: 1,
            kind: ActivityKind.BRIEFING,
            playerDefending: true,
            briefing: briefingFacts({
                goldIncome: 4180, territories: 24, rank: 4, surviving: 188,
                goalKind: "CONTINENTAL", progressFraction: 0.27,
                weakBorders: { names: ["Alsace", "Baden"], count: 4 },
                besieging: 1, besieged: 1,
                ...overrides
            })
        });
    }

    it("leads with the treasury and names the goal by name", () => {
        const story = card().story;
        expect(story).toContain("4,180 gold");
        expect(story).toContain("Continental Supremacy");
    });

    it("gives the rank as a placing, not as a quantity", () => {
        expect(card({ rank: 1 }).story).toContain("1st");
        expect(card({ rank: 2 }).story).toContain("2nd");
        expect(card({ rank: 3 }).story).toContain("3rd");
        expect(card({ rank: 4 }).story).toContain("4th");
        // The teens are the case a naive ordinal gets wrong.
        expect(card({ rank: 11 }).story).toContain("11th");
        expect(card({ rank: 12 }).story).toContain("12th");
        expect(card({ rank: 13 }).story).toContain("13th");
        expect(card({ rank: 21 }).story).toContain("21st");
    });

    it("warns about a deficit in words, because unpaid upkeep deserts an army", () => {
        const story = card({ goldIncome: -320 }).story;
        expect(story).toContain("320");
        expect(story).toContain("going home");
    });

    it("reads as bad news when the treasury is down or a border is thin", () => {
        const calm = card({
            goldIncome: 4180, weakBorders: { names: [], count: 0 }, besieging: 0, besieged: 0
        });
        const deficit = card({
            goldIncome: -320, weakBorders: { names: [], count: 0 }, besieging: 0, besieged: 0
        });
        const threatened = card({ goldIncome: 4180 });

        expect(deficit.tone).not.toBe(calm.tone);
        expect(threatened.tone).toBe(deficit.tone);
    });

    it("names the worst borders and counts the rest", () => {
        const story = card().story;
        expect(story).toContain("Alsace and Baden");
        expect(story).toContain("2 other borders");
    });

    it("says nothing at all about borders or sieges when there are none", () => {
        const story = card({
            weakBorders: { names: [], count: 0 }, besieging: 0, besieged: 0
        }).story;
        expect(story).not.toContain("border");
        expect(story).not.toContain("siege");
        expect(story).toContain("gold");
    });

    it("reads as English for one of a thing as well as several", () => {
        const story = card({
            territories: 1, weakBorders: { names: ["Alsace"], count: 1 },
            besieging: 1, besieged: 0
        }).story;
        expect(story).toContain("1 territory and");
        expect(story).toContain("Alsace is held by fewer troops");
        expect(story).toContain("besieging 1 territory");
        expect(story).not.toContain("territorys");
        expect(story).not.toContain("Alsace are");
    });

    it("is dropped entirely when it would say nothing", () => {
        // Possible in the opening turns. An empty card is worse than no card.
        expect(newsCardFor({
            id: 2, kind: ActivityKind.BRIEFING, playerDefending: true,
            briefing: briefingFacts({})
        })).toBeNull();
    });

    it("carries its own icon so the panel can lead the turn with it", () => {
        expect(card().icon).toBe("briefing");
    });
});
