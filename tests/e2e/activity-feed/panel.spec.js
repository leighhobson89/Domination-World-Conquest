import { test, expect } from "../../support/fixtures.js";
import { activityPanel, containers } from "../../support/selectors.js";

// The activity panel as a WINDOW: where its button lives, how it opens and
// closes, how its per-turn sections behave, and when it raises itself.
//
// docs/03-e2e-test-plan.md -- new functional area, `activity-feed/`.

/** A conquest on the far side of the map, filed under a turn of the caller's choosing. */
function distantConquest(turn, territory = "Balearic Islands") {
    return { kind: "conquest", territory, defender: "Spain", attacker: "Libya", turn };
}

test.describe("the button over the map", () => {
    test("appears with the rest of the in-game chrome, once a country is chosen", async ({
        startedGame: game,
    }) => {
        expect(await game.activityPanel.buttonVisible()).toBe(true);
    });

    test("is not up on the main menu", async ({ game, page }) => {
        await game.open();
        expect(await game.activityPanel.buttonVisible()).toBe(false);
    });

    test("opens and closes the panel", async ({ startedGame: game }) => {
        await game.activityPanel.close();
        expect(await game.activityPanel.isOpen()).toBe(false);

        await game.activityPanel.open();
        expect(await game.activityPanel.isOpen()).toBe(true);

        await game.activityPanel.button.click();
        expect(await game.activityPanel.isOpen()).toBe(false);
    });

    test("the X closes it too", async ({ startedGame: game }) => {
        await game.activityPanel.open();
        await game.activityPanel.closeButton.click();
        expect(await game.activityPanel.isOpen()).toBe(false);
    });
});

test.describe("the empty state", () => {
    test("says what will appear here rather than showing nothing", async ({
        startedGame: game,
        page,
    }) => {
        // A blank panel is indistinguishable from one that failed to render -- the
        // same complaint that took the tick out of the info panel's start-of-turn
        // button in Phase 6.3.
        await game.activityPanel.open();
        const sections = await game.activityPanel.turnSections();
        if (sections.length === 0) {
            await expect(page.locator(activityPanel.empty)).toBeVisible();
        }
    });
});

test.describe("per-turn sections", () => {
    /**
     * Reach turn 3 with an entry on turn 3 and an entry on turn 1.
     *
     * `onTurnStarted()` opens exactly one section -- the turn that has just begun --
     * so anything older is shut and can be toggled. Two turns of history is simply
     * the smallest world in which there is an older section to toggle.
     */
    async function twoTurnsOfHistory(game) {
        await game.playTurns(2);
        //The feed hides the turn that has just BEGUN -- the news a player opens it for
        //happened in the turn that ENDED, because `endTurn: advanceTurn` means the AI
        //moved during turn N and the counter reached N+1 afterwards. So "recent" here is
        //the turn behind the current one, not the current one.
        const current = await game.turn();
        const now = current - 1;
        await game.activityPanel.record(distantConquest(now, "Recent"));
        await game.activityPanel.record(distantConquest(now - 2, "Ancient"));
        await game.activityPanel.open();
        return { now, old: now - 2 };
    }

    test("groups entries by the turn they happened on, newest first", async ({
        startedGame: game,
    }) => {
        const { now, old } = await twoTurnsOfHistory(game);
        const sections = await game.activityPanel.turnSections();

        expect(sections.map((s) => s.turn)).toEqual([...sections.map((s) => s.turn)].sort((a, b) => b - a));
        expect(sections[0].turn).toBe(now);
        expect(sections.some((s) => s.turn === old)).toBe(true);
    });

    test("opens the newest turn and leaves an older one shut", async ({
        startedGame: game,
    }) => {
        const { now, old } = await twoTurnsOfHistory(game);
        const sections = await game.activityPanel.turnSections();

        expect(sections.find((s) => s.turn === now).open).toBe(true);
        expect(sections.find((s) => s.turn === old).open).toBe(false);
    });

    test("a shut section can be opened, and an open one shut", async ({
        startedGame: game,
    }) => {
        const { old } = await twoTurnsOfHistory(game);

        await game.activityPanel.toggleSection(old);
        let sections = await game.activityPanel.turnSections();
        expect(sections.find((s) => s.turn === old).open).toBe(true);

        await game.activityPanel.toggleSection(old);
        sections = await game.activityPanel.turnSections();
        expect(sections.find((s) => s.turn === old).open).toBe(false);
    });

    test("a shut section's rows are out of the layout, not merely invisible", async ({
        startedGame: game,
    }) => {
        // `display: none`, not a zero height: a closed section can hold dozens of
        // rows and forty turns of them would be a scroll container full of nothing.
        const { old } = await twoTurnsOfHistory(game);

        const closed = game.activityPanel.section(old).locator(".activity-turn-entries");
        expect(await closed.evaluate((el) => getComputedStyle(el).display)).toBe("none");
    });
});

test.describe("opening itself at the start of a turn", () => {
    test("raises the panel when a turn begins", async ({ startedGame: game }) => {
        await game.activityPanel.close();
        await game.playTurns(1);
        expect(await game.activityPanel.isOpen()).toBe(true);
    });

    test("opens exactly one section, and it is the newest", async ({ startedGame: game }) => {
        // Everything else folds away, so a panel that raises itself every turn always
        // presents the same thing: the newest news at the top with the history out of
        // the way. What "newest" means on a turn boundary is subtle -- `endTurn:
        // advanceTurn` means the AI moves during turn N and the counter reaches N+1
        // afterwards, so a quiet N+1 has no section at all and the fallback in
        // `render()` lands on turn N, where the conquests are.
        const before = await game.turn();
        await game.activityPanel.record(distantConquest(before, "Fought"));
        await game.playTurns(1);

        const sections = await game.activityPanel.turnSections();
        const open = sections.filter((s) => s.open);
        expect(open).toHaveLength(1);
        expect(open[0].turn).toBe(Math.max(...sections.map((s) => s.turn)));
    });

    test("scrolls the list back to the top", async ({ startedGame: game, page }) => {
        // The body is a scroll container and the browser keeps its `scrollTop` across
        // a re-render, so without this a player who had scrolled down to turn 4 gets
        // the new section drawn at the top of a list they are looking at the middle of.
        await game.playTurns(2);
        await game.activityPanel.open();
        await page.locator("#activity-panel-body").evaluate((el) => {
            el.scrollTop = el.scrollHeight;
        });

        await game.playTurns(1);
        const scrollTop = await page
            .locator("#activity-panel-body")
            .evaluate((el) => el.scrollTop);
        expect(scrollTop).toBe(0);
    });

    test("the toggle switches that off, and the panel stays down", async ({
        startedGame: game,
    }) => {
        await game.activityPanel.open();
        expect(await game.activityPanel.startOfTurnEnabled()).toBe(true);

        await game.activityPanel.toggleStartOfTurn();
        expect(await game.activityPanel.startOfTurnEnabled()).toBe(false);

        await game.activityPanel.close();
        await game.playTurns(1);
        expect(await game.activityPanel.isOpen()).toBe(false);
    });

    test("still re-points at the right turn while switched off", async ({
        startedGame: game,
    }) => {
        // Suppressing the pop-up must not mean the panel is stale when the player
        // does open it by hand.
        await game.activityPanel.open();
        await game.activityPanel.toggleStartOfTurn();
        await game.activityPanel.close();

        const before = await game.turn();
        await game.activityPanel.record(distantConquest(before, "Fought"));
        await game.playTurns(1);

        await game.activityPanel.open();
        const sections = await game.activityPanel.turnSections();
        const open = sections.filter((s) => s.open);
        expect(open).toHaveLength(1);
        expect(open[0].turn).toBe(Math.max(...sections.map((s) => s.turn)));
    });
});

test.describe("stacking against the territory panel", () => {
    test("opens over the territory panel, and can be pushed back under it", async ({
        startedGame: game,
        page,
    }) => {
        // The brief asks for the feed to appear over the territory panel. Since
        // Phase 7.4 that is not a fixed z-index -- opening a window focuses it -- and
        // that is what lets the player raise the territory panel back over the feed.
        await game.infoTable.open();
        await game.activityPanel.open();

        const z = () =>
            page.evaluate(() => ({
                feed: Number(document.getElementById("activity-panel-container").style.zIndex),
                territory: Number(document.getElementById("main-ui-container").style.zIndex),
            }));

        expect((await z()).feed).toBeGreaterThan((await z()).territory);

        await page.locator(containers.mainUi).locator(".window-title-bar").click();
        expect((await z()).territory).toBeGreaterThan((await z()).feed);
    });

    test("sits above the phase bar, always", async ({ startedGame: game, page }) => {
        // The phase bar is furniture the player reads THROUGH. It used to be at 9999,
        // above every window in the game.
        await game.activityPanel.open();
        const stacking = await page.evaluate(() => ({
            bar: Number(getComputedStyle(document.querySelector(".popup-with-confirm-container")).zIndex),
            feed: Number(document.getElementById("activity-panel-container").style.zIndex),
            territory: Number(document.getElementById("main-ui-container").style.zIndex),
        }));
        expect(stacking.feed).toBeGreaterThan(stacking.bar);
        expect(stacking.territory).toBeGreaterThan(stacking.bar);
    });
});
