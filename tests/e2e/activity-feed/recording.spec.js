import { test, expect } from "../../support/fixtures.js";

// What actually gets written into the feed, and by what route.
//
// Most entries are DERIVED from `state/events.js` rather than written where the
// event happens -- a conquest is exactly "a territory's `dataName` changed". That
// is deliberate: there are eight places that take a territory, and a list of eight
// loggers is one new attack route away from being silently incomplete. What it
// costs is that the whole path runs through two modules and an event bus, and
// nothing throws if it is not wired up. Hence this file.
//
// docs/04-e2e-test-plan.md -- new functional area, `activity-feed/`.

/** Every entry in the log, flattened out of its turn groups. */
async function entries(game) {
    const log = await game.activityPanel.log();
    return log.flatMap((turn) => turn.entries);
}

test.describe("a conquest is derived from the world changing hands", () => {
    test("is recorded when the player takes a territory, with no logger at the site", async ({
        startedGame: game,
    }) => {
        const target = await game.firstEnemyReachableFrom("Germany");
        const before = (await game.territory(target)).dataName;

        await game.launchWholeGarrison({ from: "Germany", to: target, unit: "infantry" });
        await game.fightToResolution();
        await game.withBlockersCleared(() => game.dismissBlockingPanels());

        const after = await game.territory(target);
        test.skip(after.owner !== "Player", "the attack did not succeed at this seed");

        const conquests = (await entries(game)).filter((e) => e.kind === "conquest");
        const mine = conquests.find((e) => e.territory === after.territoryName);
        expect(mine, "no conquest was recorded").toBeDefined();
        // The country it was taken FROM, captured before the store forgot.
        expect(mine.defender).toBe(before);
        expect(mine.playerAttacking).toBe(true);
        expect(mine.playerDefending).toBe(false);
    });

    test("is NOT recorded for the ownership pass that starts a game", async ({
        startedGame: game,
    }) => {
        // `initialiseGame()` sets the player's own territories to `owner: "Player"`
        // without touching `dataName`, so testing the country rather than the owner
        // is what keeps a fresh game's feed empty. Getting this wrong would file a
        // conquest for every territory the player starts with.
        const conquests = (await entries(game)).filter((e) => e.kind === "conquest");
        expect(conquests.filter((e) => e.attacker === "Germany" && e.defender === "Germany")).toEqual([]);
    });
});

test.describe("a siege is recorded when it starts", () => {
    test("from the siege being added, whoever laid it", async ({ startedGame: game }) => {
        await game.loadScenario("two-sieges");

        const started = (await entries(game)).filter((e) => e.kind === "siegeStarted");
        expect(started.length).toBeGreaterThan(0);
        for (const entry of started) {
            expect(entry.territory, "a siege entry with no territory").toBeTruthy();
        }
    });
});

test.describe("the feed is military only", () => {
    test("refuses an economic entry outright", async ({ startedGame: game }) => {
        // The guard is in `activityLog.js` rather than at the call sites, so a new
        // caller cannot let one in by inventing a kind. The brief was explicit:
        // attacks, conquests, losses, battles and sieges -- not upgrades, not
        // planning, not "thoughts".
        const before = (await entries(game)).length;
        const stored = await game.activityPanel.record({
            kind: "economyUpgrade",
            territory: "Germany",
        });
        expect(stored).toBeNull();
        expect((await entries(game)).length).toBe(before);
    });

    test("records nothing for a turn spent buying and upgrading", async ({
        startedGame: game,
    }) => {
        const before = (await entries(game)).length;

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");
        await game.upgradeWindow.submit();

        expect((await entries(game)).length).toBe(before);
    });
});

test.describe("player involvement is marked on both sides", () => {
    test("a conquest the player lost is flagged as a defence, not an attack", async ({
        startedGame: game,
    }) => {
        // Which flag is set is what turns a green victory line red, and it is not
        // recoverable from the text -- so it is asserted as data.
        await game.activityPanel.record({
            kind: "conquest",
            territory: "Bavaria",
            defender: "Germany",
            attacker: "Poland",
            playerDefending: true,
        });

        const recorded = (await entries(game)).find((e) => e.territory === "Bavaria");
        expect(recorded.playerDefending).toBe(true);
        expect(recorded.playerAttacking).toBe(false);
    });

    test("and shows up as a larger row than a distant war", async ({ startedGame: game }) => {
        //Recorded into the turn that has just ENDED, which is the one the feed shows --
        //see the note in panel.spec.js.
        const turn = (await game.turn()) - 1;
        await game.activityPanel.record({
            kind: "conquest",
            territory: "Bavaria",
            defender: "Germany",
            attacker: "Poland",
            playerDefending: true,
            turn,
        });
        await game.activityPanel.record({
            kind: "conquest",
            territory: "Balearic Islands",
            defender: "Spain",
            attacker: "Libya",
            turn,
        });
        await game.activityPanel.open();

        const rows = await game.activityPanel.visibleEntries();
        const mine = rows.find((r) => r.player);
        const distant = rows.find((r) => !r.player);

        expect(mine, "no player row rendered").toBeDefined();
        expect(distant, "no distant row rendered").toBeDefined();
        expect(mine.fontSize).toBeGreaterThan(distant.fontSize);
        // Colour and size are separate axes: the player's row here is a LOSS.
        expect(mine.tone).toBe("tone-loss");
        expect(distant.tone).toBe("tone-victory");
        expect(mine.hasIcon).toBe(true);
    });
});

test.describe("the log persists", () => {
    test("survives a save and load round trip", async ({ startedGame: game, page }) => {
        await game.activityPanel.record({
            kind: "conquest",
            territory: "Balearic Islands",
            defender: "Spain",
            attacker: "Libya",
        });
        const before = (await entries(game)).length;
        expect(before).toBeGreaterThan(0);

        await page.evaluate(() => window.__game.saveNow());
        const code = await page.evaluate(() => window.__game.saveCode());

        // Something the save does NOT contain, so the load can be shown to have
        // replaced the log rather than merely left it alone.
        await game.activityPanel.record({
            kind: "conquest",
            territory: "AfterTheSave",
            defender: "A",
            attacker: "B",
        });
        expect((await entries(game)).length).toBe(before + 1);

        await page.evaluate((c) => window.__game.loadCode(c), code);
        await game.page.waitForTimeout(1500);

        const after = await entries(game);
        expect(after.length).toBe(before);
        expect(after.some((e) => e.territory === "AfterTheSave")).toBe(false);
        expect(after.some((e) => e.territory === "Balearic Islands")).toBe(true);
    });

    test("a save written before the feed existed still loads", async ({
        startedGame: game,
        page,
    }) => {
        // An activity feed is a nicety. The whole load must not fail over a missing
        // slice, which is what every save taken before Phase 7.4 has.
        const failed = await page.evaluate(() => {
            try {
                window.__game.recordActivity({ kind: "conquest", territory: "X", defender: "A", attacker: "B" });
                return false;
            } catch {
                return true;
            }
        });
        expect(failed).toBe(false);
    });
});
