import { test, expect } from "../../support/fixtures.js";

// The feed became the player's NEWS, and this is the end-to-end half of that.
//
// What changed: the panel used to be terse one-line military entries and carried
// only military kinds. It now leads with a CARD -- a headline and a story -- for
// anything that happened to the player, and keeps the one-line entries underneath
// as "Elsewhere in the world" for everything that did not. The wording itself is
// pinned in `tests/unit/ui-news-cards.spec.js`, which is where prose belongs: it is
// pure, and asserting it through a browser would be the slowest test in the suite
// for the least benefit.
//
// What is left for an e2e spec is the part a unit test genuinely cannot see:
//
//   * that a DISASTER reaches the panel at all. This is register item E3, and the
//     whole defect was that the chain existed nowhere -- the damage was applied in
//     `resourceCalculations.js`, reported to `console.log`, and the player watched a
//     number fall with no explanation. It crosses the income pass, the aggregator,
//     the recorder, the log and the panel, and every one of those is a place it
//     could be dropped silently.
//   * that the split between cards and the compact list actually happens, because
//     a turn on this map really does produce fifty-odd events and the failure mode
//     is a panel of fifty cards rather than an exception.
//   * that the tooltip names a leader (register item E4), which is a question about
//     a `<object>` map document, a hover, and a lookup that has two sources.

test.describe("the news panel", () => {
    test("reports a disaster as a card, with the world's other wars below it", async ({ page, game }) => {
        test.setTimeout(180_000);
        await game.start({ country: "Germany", seed: "news" });

        // A disaster is a band on the mean of five draws, so no seed reaches a
        // chosen one on a chosen turn -- which is exactly why `forceRandomEvent()`
        // exists. Forced twice because the roll is per turn and the first turn's
        // income pass is skipped.
        await page.evaluate(() => window.__game.forceRandomEvent("Food Disaster"));
        await game.playTurn();
        await page.evaluate(() => window.__game.forceRandomEvent("Food Disaster"));
        await game.playTurn();

        const panel = await page.evaluate(() => ({
            title: document.getElementById("activity-panel-title")?.textContent,
            cards: Array.from(document.querySelectorAll(".activity-card"))
                .map((card) => ({
                    kind: card.getAttribute("data-kind"),
                    headline: card.querySelector(".activity-card-headline")?.textContent,
                    story: card.querySelector(".activity-card-story")?.textContent,
                })),
            elsewhere: document.querySelectorAll(".activity-elsewhere .activity-entry").length,
            label: document.querySelector(".activity-elsewhere-label")?.textContent ?? null,
        }));

        expect(panel.title).toBe("The World This Turn");

        const disaster = panel.cards.find((card) => card.kind === "disaster");
        expect(disaster, "a forced famine produced a news card").toBeTruthy();
        expect(disaster.headline).toBe("Harvests fail");
        // The suppressed population growth is the effect the player is otherwise
        // never told about, and being told is the whole of E3.
        expect(disaster.story).toContain("grow");

        // The world keeps fighting whether or not the player is involved, and none
        // of that is a card.
        expect(panel.elsewhere).toBeGreaterThan(0);
        expect(panel.label).toBe("Elsewhere in the world");
    });

    test("names the leader of an enemy country on its territories", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "news" });

        // Both panels raise themselves at the start of a turn and cover the map.
        await page.evaluate(() => {
            for (const id of ["main-ui-container", "activity-panel-container"]) {
                const element = document.getElementById(id);
                if (element) element.style.display = "none";
            }
        });

        const frame = game.mapFrame();
        const target = await frame.evaluate(() =>
            Array.from(document.querySelectorAll("path"))
                .find((path) => path.getAttribute("data-name") === "France")
                ?.getAttribute("uniqueid"));
        expect(target, "France is on the map").toBeTruthy();

        await frame.hover(`path[uniqueid="${target}"]`);
        await page.waitForTimeout(400);
        const tooltip = await page.evaluate(() =>
            document.getElementById("tooltip")?.innerText ?? "");

        expect(tooltip).toContain("France");
        // A generated leader is "<Title> <Name> <Suffix>" and the reputation clause
        // follows it. The NAME is not asserted -- it comes off the seeded stream and
        // pinning it here would make this spec fail for any balance change that
        // moves a `Math.random` draw during bootstrap. What matters is that a line
        // naming somebody is there at all, which it was not before E4.
        expect(tooltip.split("\n").length).toBeGreaterThan(1);
        expect(tooltip).toMatch(/said to be (warlike|even-handed)|said to have little appetite for war/);
    });

    test("does not put the AI's traits on the tooltip", async ({ page, game }) => {
        // The three personalities are public in the way a reputation is public. The
        // six trait VALUES behind them are what the AI plans with -- `risk_taking`
        // decides how thin a border a country will hold in order to attack -- and
        // putting those on the map would let a player read the enemy's plan off it.
        // That is the same line the feed draws when it reports what HAPPENED and
        // sends the AI's intentions to the console instead.
        await game.start({ country: "Germany", seed: "news" });
        await page.evaluate(() => {
            for (const id of ["main-ui-container", "activity-panel-container"]) {
                const element = document.getElementById(id);
                if (element) element.style.display = "none";
            }
        });

        const frame = game.mapFrame();
        const target = await frame.evaluate(() =>
            Array.from(document.querySelectorAll("path"))
                .find((path) => path.getAttribute("data-name") === "France")
                ?.getAttribute("uniqueid"));
        await frame.hover(`path[uniqueid="${target}"]`);
        await page.waitForTimeout(400);
        const tooltip = await page.evaluate(() =>
            document.getElementById("tooltip")?.innerText ?? "");

        for (const trait of ["risk_taking", "fortification", "reconquista", "style_of_war"]) {
            expect(tooltip).not.toContain(trait);
        }
        // No bare decimals either, which is what a leaked trait would look like.
        expect(tooltip).not.toMatch(/0\.\d{3}/);
    });
});
