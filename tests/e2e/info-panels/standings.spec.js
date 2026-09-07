import { test, expect } from "../../support/fixtures.js";
import { infoTable } from "../../support/selectors.js";

// The Standings tab (register item E5) and the turn-start briefing card (E7).
//
// The ranking and the wording are pinned in `tests/unit/ui-standings-table.spec.js` and
// `tests/unit/state-briefing.spec.js`, which is where they belong: both are pure, and the
// unit suite walks every victory condition in a millisecond where a browser would need a
// game played to turn forty for each.
//
// What is left for an e2e spec is the part a unit test cannot see, and it is mostly LAYOUT.
// The tab exposed a live defect the moment it existed: `.blur-background` is `display: block`
// in the info panel, so `.content-window`'s `flex-grow: 1` had no flex parent to grow into
// and the table stayed at its 445px base height inside an 800px window. Every tab had been
// wasting about 350px, and the Standings tab is simply the first one with enough rows to make
// that visible -- it looked like the table was being clipped at ten rows when it was in fact
// scrolling correctly inside a box far shorter than the window holding it.
//
// So the assertions below are about the shape of the thing rather than its contents.

/**
 * Open the info panel and select Standings.
 *
 * The panel is SHUT on turn 1 -- it raises itself at the start of a turn, and turn 1 has no
 * news to raise it for -- so a spec that clicks a tab without opening it first waits out its
 * whole timeout on a button that exists, is enabled, and is not visible. The news panel is
 * pushed down at the same time because it opens over this one.
 */
async function openStandings(page) {
    await page.evaluate(() => {
        const feed = document.getElementById("activity-panel-container");
        if (feed) feed.style.display = "none";
    });
    const panel = page.locator("#main-ui-container");
    if (!(await panel.isVisible())) {
        await page.click(infoTable.toggle);
        await expect(panel).toBeVisible();
    }
    await page.click(infoTable.standingsTab);
}

test.describe("the standings tab", () => {
    test("lists the world in rank order and marks the player", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "standings" });
        await openStandings(page);

        const table = await page.evaluate(() => {
            const rows = Array.from(
                document.querySelectorAll("#uiTable .ui-table-row, #uiTable .ui-table-row-player"));
            return {
                header: Array.from(rows[0]?.children ?? []).map(cell => cell.textContent.trim()),
                ranks: rows.slice(1)
                    .map(row => Number(row.children[0]?.textContent.trim()))
                    .filter(Number.isFinite),
                playerRows: document.querySelectorAll("#uiTable .ui-table-row-player").length,
                playerText: document.querySelector("#uiTable .ui-table-row-player")?.textContent ?? ""
            };
        });

        // Rank, country, the two fixed facts, and the two the goal supplies.
        expect(table.header).toEqual(
            ["#", "Country", "Territories", "Army", "Continents", "Closest"]);

        // Strictly ascending: the player's pinned row carries a TRUE rank, so it is bigger
        // than the sixteenth rather than a seventeenth.
        expect(table.ranks.length).toBeGreaterThan(1);
        for (let i = 1; i < table.ranks.length; i += 1) {
            expect(table.ranks[i], `rank ${table.ranks[i]} after ${table.ranks[i - 1]}`)
                .toBeGreaterThan(table.ranks[i - 1]);
        }

        // Exactly one row is the player's, wherever they placed -- a row returned both in
        // the top sixteen and as the pinned row would draw them twice.
        expect(table.playerRows).toBe(1);
        expect(table.playerText).toContain("(you)");
    });

    test("is ordered by the number it displays, not by size", async ({ page, game }) => {
        // The ranking is progress toward the goal in force. Under Continental that is the
        // sum of the best continents' shares rather than the count of completed ones, which
        // is why the count column carries the percentage beside it -- without it the table
        // is visibly ordered by something it never shows, and reads as a sorting bug.
        await game.start({ country: "Germany", seed: "standings" });
        await openStandings(page);

        const percentages = await page.evaluate(() =>
            Array.from(document.querySelectorAll("#uiTable .ui-table-row, #uiTable .ui-table-row-player"))
                .slice(1)
                .map(row => row.children[4]?.textContent ?? "")
                .map(text => Number((text.match(/(\d+)%/) ?? [])[1]))
                .filter(Number.isFinite));

        expect(percentages.length).toBeGreaterThan(1);
        for (let i = 1; i < percentages.length; i += 1) {
            expect(percentages[i]).toBeLessThanOrEqual(percentages[i - 1]);
        }
    });

    test("fills the window rather than a 445px box inside it", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "standings" });
        await openStandings(page);

        const layout = await page.evaluate(() => {
            const panel = document.getElementById("main-ui-container");
            const content = document.querySelector(".content-window");
            const scroller = document.getElementById("info-panel");
            return {
                panel: panel.getBoundingClientRect().height,
                content: content.getBoundingClientRect().height,
                scrolls: scroller.scrollHeight > scroller.clientHeight,
                canScroll: getComputedStyle(scroller).overflowY
            };
        });

        // The table area is most of the window. Before the fix it was 445 of 800 whatever
        // the window's height, which is the number this guards against coming back.
        expect(layout.content).toBeGreaterThan(layout.panel * 0.75);
        // And it is the INNER column that scrolls, not the window that grows.
        expect(layout.canScroll).toBe("auto");
        expect(layout.scrolls).toBe(true);
    });
});

test.describe("the turn-start briefing", () => {
    test("leads the turn's news with where the player stands", async ({ page, game }) => {
        test.setTimeout(180_000);
        await game.start({ country: "Germany", seed: "standings" });
        await game.playTurn();

        const panel = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll(".activity-card"));
            const first = cards[0];
            return {
                count: cards.length,
                firstKind: first?.getAttribute("data-kind"),
                headline: first?.querySelector(".activity-card-headline")?.textContent,
                story: first?.querySelector(".activity-card-story")?.textContent ?? "",
                //The world's other wars still need their heading even on a turn whose only
                //card is the briefing -- the label was lost once when the briefing was
                //lifted out of the card list.
                label: document.querySelector(".activity-elsewhere-label")?.textContent ?? null
            };
        });

        expect(panel.count).toBeGreaterThan(0);
        // FIRST, whatever order the log holds. It is written after the income pass, so the
        // siege lines recorded earlier in the same turn precede it in the log; the panel
        // puts it at the top because a summary leads and an event follows.
        expect(panel.firstKind).toBe("briefing");
        expect(panel.headline).toBe("The state of the nation");
        expect(panel.story).toMatch(/lie \d+(st|nd|rd|th) of \d+/);
        expect(panel.label).toBe("Elsewhere in the world");
    });

    test("does not count itself as something that happened to the player", async ({ page, game }) => {
        // The section header reads "N actions, M involving you". A briefing is written every
        // turn whether or not anything happened, so counting it told a player something had
        // happened to them on every quiet turn of the game.
        test.setTimeout(180_000);
        await game.start({ country: "Germany", seed: "standings" });
        await game.playTurn();

        const summary = await page.evaluate(() =>
            document.querySelector(".activity-turn-summary")?.textContent ?? "");

        const briefings = await page.evaluate(() =>
            document.querySelectorAll('.activity-card[data-kind="briefing"]').length);

        expect(briefings).toBeGreaterThan(0);
        expect(summary).not.toBe("1 action, 1 involving you");
    });
});
