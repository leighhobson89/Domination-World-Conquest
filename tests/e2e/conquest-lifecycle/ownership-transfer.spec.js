import { test, expect } from "../../support/fixtures.js";

// The full arc from taking a territory to using it normally.
// docs/04-e2e-test-plan.md section 5.15.

/**
 * Take France with an overwhelming fleet and accept the victory.
 *
 * The ending is asserted as "one of the winning states" rather than "Victory!" specifically.
 * Battle overhaul B.4 replaced the old 5% / 15% / 10% thresholds with one symmetric
 * `BREAK_THRESHOLD`, and the break test runs before annihilation can matter -- so a garrison of
 * any size is ROUTED long before it is wiped out, and "Victory!" (a total wipe) is reachable only
 * for a handful of units. What this helper is actually for is the arc AFTER the win, so which of
 * the three winning states got there is not its business.
 */
const WINNING_ENDINGS = ["Victory!", "Rout The Enemy", "Massive Assault"];

async function conquerFrance(game) {
    await game.loadScenario("outright-conquest");
    await game.launchWholeGarrison({ from: "Germany", to: "France" });
    const { ending } = await game.fightToResolution();
    expect(WINNING_ENDINGS).toContain(ending);
    await expect.poll(async () => game.battle.resultsShown()).toBe(true);
    await game.battle.acceptResult();
    await expect.poll(async () => (await game.territory("France")).owner).toBe("Player");
}

test.describe("taking a territory", () => {
    test.setTimeout(300_000);

    test("moves ownership in the state and on the map together", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "conquest-own" });

        const before = await game.territory("France");
        expect(before.owner).not.toBe("Player");
        expect(before.originalOwner).toBe("France");

        await conquerFrance(game);

        const after = await game.territory("France");
        expect(after.owner).toBe("Player");
        // `dataName` is the CURRENT owner and changes on conquest; `territoryName` is the
        // stable identity; `originalOwner` is historical. Mixing them up is a recurring
        // source of bugs in this codebase, so all three are pinned here.
        expect(after.dataName).toBe("Germany");
        expect(after.territoryName).toBe("France");
        expect(after.originalOwner, "history is preserved").toBe("France");

        // Phase 4 made the SVG attributes output, rendered from the store. They cannot
        // disagree with it -- and this is the assertion that says so.
        expect(await game.map.attribute("France", "owner")).toBe("Player");
        expect(await game.map.attribute("France", "data-name")).toBe("Germany");
        expect(await game.map.attribute("France", "territory-name")).toBe("France");

        const fill = await game.map.fill("France");
        const germanyFill = await game.map.fill("Germany");
        expect(fill, "a conquered territory takes the player's colour").toBe(germanyFill);
    });

    test("adds the territory to the player's holdings and totals", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "conquest-totals" });

        const ownedBefore = await game.playerTerritories();
        expect(ownedBefore.map((t) => t.territoryName)).toEqual(["Germany"]);

        await conquerFrance(game);

        const ownedAfter = await game.playerTerritories();
        expect(ownedAfter.map((t) => t.territoryName).sort()).toEqual(["France", "Germany"]);

        // The top table is recomputed from the territories, so the two must agree.
        const { totals, summed } = await page.evaluate(() => {
            const owned = window.__game.territoriesOwnedBy("Player");
            const sum = (key) => owned.reduce((a, t) => a + t[key], 0);
            return {
                totals: window.__game.totals(),
                summed: {
                    gold: sum("goldForCurrentTerritory"),
                    area: sum("territoryArea"),
                },
            };
        });
        expect(totals.gold).toBeCloseTo(summed.gold, 0);
    });

    test("locks the conquered territory for a turn or three", async ({ game, page }) => {
        // A freshly taken territory sits out its lockout: it cannot transfer or attack, and
        // the move button says how long is left.
        await game.start({ country: "Germany", seed: "conquest-lock" });
        await conquerFrance(game);

        expect(
            await game.map.attribute("France", "deactivated"),
            "a conquered territory is deactivated"
        ).toBe("true");

        await game.withBlockersCleared(async () => {
            await game.selectOnMap("France");
        });
        const label = await game.moveButton.label();
        expect(label, `the move button should show the countdown, saw "${label}"`).toMatch(
            /^DEACTIVATED \(\d+\)$/
        );
    });

    test("reactivates exactly once and then stays active", async ({ game, page }) => {
        // audit 5.2 N and O, fixed in Phase 3.10. `activateAiTerritoriesForNewTurn` compared
        // a uniqueId against the ARRAY rather than against `[i][0]`, so a conquered territory
        // was never reactivated; and the served entry was never spliced out, so once the
        // counter did match, reactivation re-fired every turn forever. Both functions walk
        // backwards and splice now.
        await game.start({ country: "Germany", seed: "conquest-react" });
        await conquerFrance(game);
        expect(await game.map.attribute("France", "deactivated")).toBe("true");

        // The lockout is 1-3 turns; five is comfortably past it.
        let becameActive = false;
        for (let turn = 0; turn < 5; turn += 1) {
            await game.playTurn();
            if ((await game.map.attribute("France", "deactivated")) === "false") {
                becameActive = true;
                break;
            }
        }
        expect(becameActive, "the lockout must expire").toBe(true);

        // And it stays active -- the entry was removed, so nothing re-fires.
        for (let turn = 0; turn < 2; turn += 1) {
            await game.playTurn();
            const owner = await game.map.attribute("France", "owner");
            if (owner !== "Player") {
                return; // lost it again to the AI; nothing left to assert
            }
            expect(
                await game.map.attribute("France", "deactivated"),
                "reactivation must not re-fire"
            ).toBe("false");
        }
    });
});
