import { test, expect } from "../../support/fixtures.js";

// The diplomacy panel: the button, the list, and the five controls.
//
// Diplomacy stage 4 built it and stage 5 filled it. What is asserted here is the part that
// only exists in a browser -- that the button is up with the rest of the map chrome, that the
// list is the register rather than a second copy of it, and that the five actions are offered
// or refused according to the state the pair is actually in.
//
// NOT THE REASONS. Every sentence on this panel comes out of `countryDetail()` and
// `proposalOutcomeFor()`, both pure, and both already pinned by unit tests
// (`ui-diplomacy-panel.spec.js`, `ai-negotiation.spec.js`). A spec here matching on prose
// would test the phrasing twice and the behaviour not at all.

test.describe("the panel and its button", () => {
    test("the button is up with the rest of the map chrome, and opens the panel", async ({
        startedGame: game,
    }) => {
        expect(await game.diplomacy.buttonVisible()).toBe(true);
        expect(await game.diplomacy.isOpen()).toBe(false);

        await game.diplomacy.open();
        expect(await game.diplomacy.isOpen()).toBe(true);

        await game.diplomacy.close();
        expect(await game.diplomacy.isOpen()).toBe(false);
    });

    test("lists exactly the countries the player has a relation with", async ({
        startedGame: game,
    }) => {
        // The panel is a VIEW of the register and not a second copy of it. A list built from
        // anything else -- the countries on the map, the ones adjacent to the player -- would
        // be right on turn 1 and wrong by turn 20.
        await game.diplomacy.open();

        const rows = await game.diplomacy.rows();
        const known = (await game.diplomacy.relations())
            .filter((row) => row.a === "Germany" || row.b === "Germany")
            .map((row) => (row.a === "Germany" ? row.b : row.a));

        expect(rows.length).toBe(known.length);
        expect(rows.map((row) => row.country).sort()).toEqual(known.sort());
    });

    test("never lists the player's own country", async ({ startedGame: game }) => {
        // `relationKey()` refuses a country paired with itself, so this is belt to that
        // braces -- and it is the same mistake the tooltip made, where `pathOwner()` reads
        // "Player" and the panel listed the player as a foreign power at no contact with
        // itself.
        await game.diplomacy.open();
        const rows = await game.diplomacy.rows();
        expect(rows.map((row) => row.country)).not.toContain("Germany");
    });
});

test.describe("what the panel will let the player do", () => {
    /** Open the panel on the first country the register knows about. */
    async function selectSomebody(game) {
        await game.diplomacy.open();
        const rows = await game.diplomacy.rows();
        if (rows.length === 0) return null;
        await game.diplomacy.select(rows[0].country);
        return rows[0].country;
    }

    test("offers a declaration out of neutral, and no dissolution", async ({
        startedGame: game,
    }) => {
        const country = await selectSomebody(game);
        test.skip(!country, "the player has met nobody at this seed");
        await game.diplomacy.setRelation("Germany", country, "neutral");
        await game.diplomacy.select(country);

        const actions = await game.diplomacy.actions();
        const declare = actions.find((one) => one.kind === "declare");
        expect(declare, "no declaration control").toBeDefined();
        expect(declare.enabled).toBe(true);
        // There is no alliance to end, so the control is either absent or refused -- never
        // offered as something that would work.
        expect(actions.find((one) => one.kind === "dissolve")?.enabled ?? false).toBe(false);
    });

    test("refuses a declaration on a country already at war", async ({
        startedGame: game,
    }) => {
        const country = await selectSomebody(game);
        test.skip(!country, "the player has met nobody at this seed");

        await game.diplomacy.setRelation("Germany", country, "war");
        await game.diplomacy.select(country);

        const declare = (await game.diplomacy.actions()).find((one) => one.kind === "declare");
        expect(declare.enabled).toBe(false);
        // A DISABLED CONTROL MUST SAY WHY -- the standing rule for this game, and the whole
        // argument for the panel being a full window rather than a tab.
        expect(declare.reason.length).toBeGreaterThan(0);
    });

    test("answers a proposal on the spot, and the register agrees with the answer", async ({
        startedGame: game,
    }) => {
        // THE ANSWER ARRIVES AT ONCE. There is no waiting period anywhere in this system:
        // the player asks and is told, under the button they pressed. What is asserted is
        // that the panel's answer and the store cannot disagree -- an "accepted" that did
        // not write, or a refusal that did, is the defect this catches.
        const country = await selectSomebody(game);
        test.skip(!country, "the player has met nobody at this seed");

        await game.diplomacy.setRelation("Germany", country, "war");
        await game.diplomacy.select(country);

        const ceasefire = (await game.diplomacy.actions())
            .find((one) => one.kind === "ceasefire");
        test.skip(!ceasefire?.enabled, "a ceasefire cannot be offered in this world");

        await game.diplomacy.act("ceasefire");
        const answer = await game.diplomacy.lastAnswer();
        expect(answer, "no answer was shown").not.toBeNull();

        const state = (await game.diplomacy.between("Germany", country)).state;
        expect(state).toBe(answer.accepted ? "ceasefire" : "war");
    });

    test("a refusal sets a cooldown, so the same offer cannot be re-rolled", async ({
        startedGame: game,
    }) => {
        // A player who can ask every turn until the dice fall their way is not negotiating,
        // they are rerolling -- and the answer is a pure function of a world that barely
        // moves between turns, so asking again immediately is asking the same question.
        const country = await selectSomebody(game);
        test.skip(!country, "the player has met nobody at this seed");

        await game.diplomacy.setRelation("Germany", country, "war");
        await game.diplomacy.select(country);

        const offered = (await game.diplomacy.actions()).find((one) => one.kind === "peace");
        test.skip(!offered?.enabled, "a peace cannot be offered in this world");

        await game.diplomacy.act("peace");
        const first = await game.diplomacy.lastAnswer();
        test.skip(first?.accepted, "the offer was accepted, so there is no cooldown to see");

        await game.diplomacy.act("peace");
        const second = await game.diplomacy.lastAnswer();
        // The second refusal names the wait rather than repeating the first reason. Asserting
        // the WORD "turn" is as close to the wording as this file goes, and it is the one
        // thing about the cooldown visible from outside the pure rule.
        expect(second.text).toMatch(/turn/i);
    });
});
