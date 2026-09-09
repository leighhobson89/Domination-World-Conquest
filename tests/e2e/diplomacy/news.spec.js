import { test, expect } from "../../support/fixtures.js";

// That the register reaches the activity feed at all.
//
// Diplomacy stage 6. Every sentence the feed writes about diplomacy is pure and is pinned by
// `tests/unit/ui-diplomacy-news.spec.js`; what THAT cannot see is the wiring, which runs from
// `setRelationState()` through the event bus, through `activityRecorder.js`, into a bounded
// ring and out again into the panel. Nothing throws if any link of it is missing, which is
// exactly the shape of failure this area exists for.
//
// The one rule with real consequences for volume is asserted first: first contact is NOT news.
// `diplomacyContacts.js` writes NEUTRAL for every pair whose borders have met, and a busy turn
// one walks something like 1,900 pairings -- recording those would flush every real entry out
// of the log inside a single turn.

/** Every entry in the log, flattened out of its turn groups. */
async function entries(game) {
    const log = await game.activityPanel.log();
    return log.flatMap((turn) => turn.entries);
}

const DIPLOMATIC = ["declaration", "treaty", "alliance", "betrayal"];

async function diplomaticEntries(game) {
    return (await entries(game)).filter((one) => DIPLOMATIC.includes(one.kind));
}

test.describe("first contact is not news", () => {
    test("a fresh game has walked the whole map and written no diplomatic entry", async ({
        startedGame: game,
    }) => {
        // The register is already populated on turn 1 -- the contact walk runs as soon as
        // anybody reads it -- so this is not asserting an empty world. It is asserting that
        // several hundred NEUTRAL records produced nothing at all.
        const relations = await game.diplomacy.relations();
        expect(relations.length).toBeGreaterThan(0);
        expect(await diplomaticEntries(game)).toEqual([]);
    });
});

test.describe("a declaration reaches the feed", () => {
    test("is recorded when the player declares, and names the player as the actor", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");
        const owner = (await game.territory(target)).dataName;

        await game.declareWarOn(target);

        const declarations = (await diplomaticEntries(game))
            .filter((one) => one.kind === "declaration");
        const mine = declarations.find((one) => one.diplomacy?.b === owner);
        expect(mine, "no declaration was recorded").toBeDefined();
        // The ACTOR is stored first, and `playerAttacking` is how the panel decides this is
        // the player's own news rather than somebody else's.
        expect(mine.diplomacy.a).toBe("Germany");
        expect(mine.playerAttacking).toBe(true);
        expect(mine.playerDefending).toBe(false);
    });

    test("draws it as a card, because it is the player's own diplomacy", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");

        await game.declareWarOn(target);
        await game.activityPanel.open();
        //THE PANEL HIDES THE TURN THAT HAS JUST BEGUN, because `endTurn: advanceTurn` files
        //the news under the turn that ENDED -- and on turn 1 there is no turn behind it. This
        //is the switch in its title bar, not a harness back door.
        await game.activityPanel.showCurrentTurn();

        // The card carries `data-kind`, so the panel can be asked what it drew without any
        // spec here reading a sentence.
        const cards = game.page.locator('.activity-card[data-kind="declaration"]');
        expect(await cards.count()).toBeGreaterThan(0);
    });
});

test.describe("an agreement reaches the feed", () => {
    test("a ceasefire is a treaty entry, and it is green", async ({ startedGame: game }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");
        const owner = (await game.territory(target)).dataName;

        await game.diplomacy.setRelation("Germany", owner, "war");
        await game.diplomacy.setRelation("Germany", owner, "ceasefire");

        const treaty = (await diplomaticEntries(game))
            .filter((one) => one.kind === "treaty")
            .at(-1);
        expect(treaty, "no treaty was recorded").toBeDefined();
        expect(treaty.diplomacy.to).toBe("ceasefire");

        await game.activityPanel.open();
        await game.activityPanel.showCurrentTurn();
        const card = game.page.locator('.activity-card[data-kind="treaty"]').last();
        expect(await card.count()).toBe(1);
        expect(await card.getAttribute("class")).toContain("tone-victory");
    });

    test("an alliance is its own kind, kept apart from a peace", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");
        const owner = (await game.territory(target)).dataName;

        await game.diplomacy.setRelation("Germany", owner, "peace");
        await game.diplomacy.setRelation("Germany", owner, "alliance");

        const kinds = (await diplomaticEntries(game)).map((one) => one.kind);
        expect(kinds).toContain("treaty");
        expect(kinds).toContain("alliance");
    });
});

test.describe("a betrayal is told apart from a declaration", () => {
    test("going to war out of an agreement is recorded as a breach", async ({
        startedGame: game,
    }) => {
        // DERIVED, NOT ANNOTATED. `applyBreach()` is charged on exactly this transition, so
        // the feed asks the register the same question the penalty asks -- rather than
        // trusting whoever wrote the declaration to have labelled it.
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");
        const owner = (await game.territory(target)).dataName;

        await game.diplomacy.setRelation("Germany", owner, "peace");
        await game.declareWarOn(target);

        const betrayals = (await diplomaticEntries(game))
            .filter((one) => one.kind === "betrayal");
        expect(betrayals.length).toBeGreaterThan(0);
        expect(betrayals.at(-1).diplomacy.from).toBe("peace");
    });
});

test.describe("the feed survives what the log survives", () => {
    test("diplomatic entries come back after a save and load", async ({
        startedGame: game,
        page,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        test.skip(!target, "Germany reaches no enemy at this seed");

        await game.declareWarOn(target);
        const before = (await diplomaticEntries(game)).length;
        expect(before).toBeGreaterThan(0);

        await page.evaluate(() => window.__game.saveNow());
        const code = await page.evaluate(() => window.__game.saveCode());
        await page.evaluate((one) => window.__game.loadCode(one), code);
        await page.waitForTimeout(1500);

        const after = await diplomaticEntries(game);
        expect(after.length).toBe(before);
        // The sub-object is what every phrasing is built on, so a restore that dropped it
        // would draw blank cards rather than failing.
        expect(after.at(-1).diplomacy).toBeTruthy();
        expect(after.at(-1).diplomacy.a).toBeTruthy();
    });
});
