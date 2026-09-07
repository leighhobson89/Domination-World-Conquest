// The news cards: which entries get one, and what they say.
//
// `newsCardFor()` is the wording layer for the panel's cards, and it is pure for
// the same reason `describeActivity()` beside it is: the judgement is in the
// selection and the phrasing, and both are cheap to pin here and expensive to
// assert through a browser.
//
// Three rules under test are decisions rather than mechanics, and each of them
// would look like a bug to someone who did not know it was chosen:
//
//   * MOST ENTRIES GET NO CARD. A busy turn logs fifty-one conquests and the panel
//     would be fifty-one cards, which is a spreadsheet with more whitespace. Only
//     the player's own news is a card; the rest stays a compact line.
//   * A DISASTER IS ONE CARD however many territories it struck, and the count is
//     the thing the story is about. Recording per territory would write a hundred
//     entries a turn and flush the bounded log.
//   * A LEADER'S NAME IS OPTIONAL and always a separate trailing sentence. Entries
//     from before leaders were recorded, and from spectated games, carry none --
//     so every template has to read correctly without one.

import { describe, expect, it } from "vitest";

import { ActivityKind } from "../../src/state/activityLog.js";
import { Tone, newsCardFor } from "../../src/ui/activityFeed/describeActivity.js";

function entry(overrides = {}) {
    return {
        id: 1,
        kind: ActivityKind.CONQUEST,
        territory: "Alsace",
        defender: "France",
        attacker: "Germany",
        playerAttacking: false,
        playerDefending: false,
        attackerLeader: "",
        defenderLeader: "",
        event: "",
        territoriesHit: null,
        turnsUnderSiege: null,
        ...overrides,
    };
}

describe("which entries become cards", () => {
    it("gives no card to a war between two other countries", () => {
        expect(newsCardFor(entry({ territory: "Peru", defender: "Peru", attacker: "Chile" })))
            .toBeNull();
    });

    it("gives a card when the player took the territory", () => {
        expect(newsCardFor(entry({ playerAttacking: true }))).not.toBeNull();
    });

    it("gives a card when the player lost the territory", () => {
        expect(newsCardFor(entry({ playerDefending: true }))).not.toBeNull();
    });

    it("gives a card to a disaster, which nobody attacked anybody over", () => {
        // The involvement test would reject this one: `playerAttacking` and
        // `playerDefending` describe a war, and a famine is not one. Disasters are
        // only ever recorded for the player, so the kind is checked first.
        const card = newsCardFor(entry({
            kind: ActivityKind.DISASTER,
            event: "Food Disaster",
            territory: "Bavaria",
            territoriesHit: 1,
            playerAttacking: false,
            playerDefending: false,
        }));
        expect(card).not.toBeNull();
    });

    it("returns null rather than throwing for a missing entry", () => {
        expect(newsCardFor(null)).toBeNull();
        expect(newsCardFor(undefined)).toBeNull();
    });
});

describe("a conquest the player made", () => {
    const card = () => newsCardFor(entry({ playerAttacking: true }));

    it("is a victory and names the territory in the headline", () => {
        expect(card().tone).toBe(Tone.VICTORY);
        expect(card().headline).toContain("Alsace");
    });

    it("names both countries in every phrasing", () => {
        // Who LOST the territory is half the news -- "the former French territory
        // of Alsace" is the sentence this card exists to write -- so a phrasing
        // that names only the winner is a phrasing with the story missing from it.
        for (let id = 0; id < 6; id += 1) {
            const story = newsCardFor(entry({ id, playerAttacking: true })).story;
            expect(story, `phrasing ${id}`).toContain("Germany");
            expect(story, `phrasing ${id}`).toContain("France");
        }
    });

    it("never uses a country name as an adjective", () => {
        // "The France garrison" and "Germany administrators" are what a naive
        // template produces, and there is no demonym for 207 countries to fix it
        // with -- so the phrasings are built to avoid the construction entirely.
        for (let id = 0; id < 6; id += 1) {
            const story = newsCardFor(entry({ id, playerAttacking: true })).story;
            expect(story).not.toMatch(/\b(France|Germany) (garrison|administrators|advance|defences|province|troops|citizens|soil)\b/);
        }
    });
});

describe("a conquest the player suffered", () => {
    const card = () => newsCardFor(entry({ playerDefending: true }));

    it("is a loss, not a victory, even though somebody won", () => {
        // The compact line calls a conquest green whoever did it. A card is the
        // PLAYER's news, so the one the player lost is red.
        expect(card().tone).toBe(Tone.LOSS);
    });

    it("says the territory is lost", () => {
        expect(card().headline).toContain("Alsace");
        expect(card().headline).toContain("lost");
    });

    it("names who took it, in every phrasing", () => {
        for (let id = 0; id < 6; id += 1) {
            const story = newsCardFor(entry({ id, playerDefending: true })).story;
            expect(story, `phrasing ${id}`).toContain("Germany");
        }
    });
});

describe("the leader clause", () => {
    it("is absent when the entry names no leader", () => {
        const story = newsCardFor(entry({ playerAttacking: true, defenderLeader: "" })).story;
        expect(story.trim()).toMatch(/[.!]$/);
        expect(story).not.toContain("undefined");
    });

    it("is appended as its own sentence when there is one", () => {
        const story = newsCardFor(entry({
            playerAttacking: true,
            defenderLeader: "President Rousseau III",
        })).story;
        expect(story).toContain("President Rousseau III");
        // A trailing sentence, never spliced into the middle of another one.
        expect(story.indexOf("President Rousseau III"))
            .toBeGreaterThan(story.indexOf("."));
    });
});

describe("a disaster", () => {
    function disaster(overrides = {}) {
        return newsCardFor(entry({
            kind: ActivityKind.DISASTER,
            event: "Food Disaster",
            territory: "Bavaria",
            territoriesHit: 1,
            playerDefending: true,
            ...overrides,
        }));
    }

    it("names the worst-hit territory when only one was struck", () => {
        expect(disaster().story).toContain("Bavaria");
        expect(disaster().story).not.toContain(" 1 of your territories");
    });

    it("counts them when several were struck, and still names the worst", () => {
        const story = disaster({ territoriesHit: 31 }).story;
        expect(story).toContain("31");
        expect(story).toContain("Bavaria");
    });

    it("explains the suppressed growth, which is the effect nothing else reports", () => {
        // The disaster turn stops population change everywhere. That is a real
        // mechanical effect the player was never told about, and being told is
        // the whole of register item E3.
        expect(disaster().story).toContain("grow");
    });

    it("has its own headline per event, and its own icon", () => {
        expect(disaster({ event: "Food Disaster" }).headline).toBe("Harvests fail");
        expect(disaster({ event: "Mutiny" }).headline).toBe("Mutiny in the ranks");
        expect(disaster({ event: "Oil Well Fire" }).headline).toBe("Oil fields ablaze");
        expect(disaster({ event: "Warehouse Fire" }).headline).toBe("Warehouses burn");
        expect(disaster().icon).toBe("disaster");
    });

    it("says something true for an event with no entry in the table", () => {
        // A fifth disaster added to `RANDOM_EVENTS` and not to the wording table
        // must not draw a blank card.
        const card = disaster({ event: "Plague of Frogs", territoriesHit: 4 });
        expect(card.headline).toBe("Plague of Frogs");
        expect(card.story).toContain("4");
    });
});

describe("wording variety", () => {
    it("varies between entries but never within one", () => {
        // The panel re-renders on every logged entry while it is open, so a card
        // that reworded itself each time would be unreadable. The template is
        // chosen from the entry's own id, which is stable and costs no draw on the
        // game's seeded random stream.
        const first = newsCardFor(entry({ id: 1, playerAttacking: true })).story;
        expect(newsCardFor(entry({ id: 1, playerAttacking: true })).story).toBe(first);

        const stories = new Set(
            [1, 2, 3, 4, 5, 6].map(id => newsCardFor(entry({ id, playerAttacking: true })).story)
        );
        expect(stories.size).toBeGreaterThan(1);
    });

    it("copes with an entry that has no id", () => {
        expect(() => newsCardFor(entry({ id: undefined, playerAttacking: true })))
            .not.toThrow();
    });
});

describe("sieges", () => {
    const KINDS = [
        ActivityKind.SIEGE_STARTED,
        ActivityKind.SIEGE_ONGOING,
        ActivityKind.SIEGE_LIFTED,
        ActivityKind.SIEGE_ABANDONED,
        ActivityKind.SIEGE_WON,
        ActivityKind.SIEGE_LOST,
    ];

    it("are amber in all six of their states, on both sides", () => {
        for (const kind of KINDS) {
            for (const side of [{ playerAttacking: true }, { playerDefending: true }]) {
                const card = newsCardFor(entry({ kind, ...side }));
                expect(card, kind).not.toBeNull();
                expect(card.tone, kind).toBe(Tone.SIEGE);
                expect(card.icon, kind).toBe("siege");
            }
        }
    });

    it("reads differently for the besieger and the besieged", () => {
        // From the store, "a siege was removed" is one event with four meanings.
        // Telling a player their troops had been arrested when they had marched
        // home would be worse than saying nothing.
        for (const kind of KINDS) {
            const attacking = newsCardFor(entry({ kind, playerAttacking: true }));
            const defending = newsCardFor(entry({ kind, playerDefending: true }));
            expect(attacking.story, kind).not.toBe(defending.story);
        }
    });

    it("copes with an ongoing siege whose turn count is missing", () => {
        const card = newsCardFor(entry({
            kind: ActivityKind.SIEGE_ONGOING,
            playerDefending: true,
            turnsUnderSiege: null,
        }));
        expect(card.story).not.toContain("null");
    });
});
