import { test, expect } from "../../support/fixtures.js";
import { cls, containers, infoTable, sel } from "../../support/selectors.js";

// That the windows Phase 7.11 rebuilt actually fit what is in them, and that the
// state they carry is carried once.
//
// The fault this exists to catch has no textual signature at all. Upgrade
// Territory shipped with `height: 500px` over a `366px` content window over a
// `300px` table -- three ordinary CSS declarations that had to agree and did
// not, so the fourth of four rows was drawn underneath the bottom bar. Nothing
// in the source looks wrong. Only a measurement finds it.
//
// docs/04-e2e-test-plan.md -- new functional area, `ui-layout/`.

/**
 * Is every child row fully inside its scroll container?
 *
 * Deliberately not a screenshot comparison. A pixel baseline would fail on every
 * theme change and every font-metric difference between machines, and would say
 * "something moved" rather than "the last row is unreachable".
 */
async function rowsWithinPanel(page, panelSelector, rowSelector) {
    return page.evaluate(
        ([panelSel, rowSel]) => {
            const panel = document.querySelector(panelSel);
            const panelBox = panel.getBoundingClientRect();
            return [...document.querySelectorAll(rowSel)].map((row, index) => {
                const box = row.getBoundingClientRect();
                return {
                    index,
                    // A couple of pixels of tolerance: a 1px border rounding the
                    // wrong way is not a clipped row.
                    overflowsBottom: Math.round(box.bottom - panelBox.bottom) > 2,
                    height: Math.round(box.height),
                };
            });
        },
        [panelSelector, rowSelector]
    );
}

test.describe("no window clips its own content", () => {
    test("the upgrade window shows all four building rows above the bottom bar", async ({
        startedGame: game,
        page,
    }) => {
        await game.openUpgrade("Germany");

        const rows = await rowsWithinPanel(page, sel.upgradeContainer, cls.upgradeRow);
        expect(rows).toHaveLength(4);
        expect(rows.filter((r) => r.overflowsBottom)).toEqual([]);

        // And the bottom bar is not sitting on top of the last one, which is a
        // different failure from overflowing the window.
        const overlap = await page.evaluate(
            ([rowSel, barSel]) => {
                const allRows = [...document.querySelectorAll(rowSel)];
                const bar = document.querySelector(barSel).getBoundingClientRect();
                const last = allRows[allRows.length - 1].getBoundingClientRect();
                return Math.round(last.bottom - bar.top);
            },
            [cls.upgradeRow, ".bottom-bar-upgrade-window"]
        );
        expect(overlap, "the bottom bar overlaps the last row").toBeLessThanOrEqual(2);
    });

    test("the buy window shows all four unit rows above the bottom bar", async ({
        startedGame: game,
        page,
    }) => {
        await game.openBuy("Germany");

        const rows = await rowsWithinPanel(page, sel.buyContainer, cls.buyRow);
        expect(rows).toHaveLength(4);
        expect(rows.filter((r) => r.overflowsBottom)).toEqual([]);
    });

    test("both windows fit on the screen", async ({ startedGame: game, page }) => {
        // Closed through each window's own X rather than Escape: Escape opens the
        // main menu, which leaves the second half of this test looking at a title
        // screen and failing for a reason that has nothing to do with layout.
        const measure = async (container) =>
            page.locator(container).evaluate((el) => {
                const box = el.getBoundingClientRect();
                return {
                    top: Math.round(box.top),
                    bottom: Math.round(box.bottom),
                    viewport: window.innerHeight,
                };
            });

        await game.openUpgrade("Germany");
        const upgrade = await measure(containers.upgrade);
        await game.upgradeWindow.close();

        await game.openBuy("Germany");
        const buy = await measure(containers.buy);
        await game.buyWindow.close();

        for (const [name, fits] of [["upgrade", upgrade], ["buy", buy]]) {
            expect(fits.top, `${name} window is off the top of the screen`).toBeGreaterThanOrEqual(0);
            expect(fits.bottom, `${name} window runs off the bottom`).toBeLessThanOrEqual(
                fits.viewport
            );
        }
    });
});

test.describe("the tab strip carries its selection in one place", () => {
    test("exactly one tab is active at a time, and clicking moves it", async ({
        startedGame: game,
        page,
    }) => {
        await game.infoTable.open();

        const activeCount = () => page.locator(`${cls.tabButton}.${"active"}`).count();
        expect(await activeCount()).toBe(1);

        await page.click(infoTable.territoriesTab);
        expect(await activeCount()).toBe(1);
        await expect(page.locator(infoTable.territoriesTab)).toHaveClass(/active/);

        await page.click(infoTable.armyTab);
        expect(await activeCount()).toBe(1);
        await expect(page.locator(infoTable.armyTab)).toHaveClass(/active/);
        await expect(page.locator(infoTable.territoriesTab)).not.toHaveClass(/active/);
    });

    test("a tab's appearance comes from the stylesheet, not from an inline write", async ({
        startedGame: game,
        page,
    }) => {
        // `InfoTable.js` used to write two literal `rgb()` strings onto the
        // element on click, on mouseover and on mouseout. An inline write beats
        // the stylesheet on specificity, so no theme could ever reach a tab.
        await game.infoTable.open();
        await page.click(infoTable.territoriesTab);

        const inlineStyles = await page
            .locator(cls.tabButton)
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("style")).filter(Boolean));
        expect(inlineStyles, "a tab is styled inline").toEqual([]);
    });

    test("the active tab is distinguishable from an idle one", async ({
        startedGame: game,
        page,
    }) => {
        await game.infoTable.open();
        await page.click(infoTable.territoriesTab);

        const [active, idle] = await Promise.all([
            page.locator(infoTable.territoriesTab).evaluate((n) => {
                const cs = getComputedStyle(n);
                return `${cs.backgroundColor}|${cs.borderColor}|${cs.color}`;
            }),
            page.locator(infoTable.summaryTab).evaluate((n) => {
                const cs = getComputedStyle(n);
                return `${cs.backgroundColor}|${cs.borderColor}|${cs.color}`;
            }),
        ]);
        expect(active).not.toBe(idle);
    });
});

test.describe("the confirm button says what it will do", () => {
    test("arms when something is allocated and disarms when it is taken back", async ({
        startedGame: game,
        page,
    }) => {
        // Ten copies of a five-line block used to write this, each also adding a
        // fresh pair of hover listeners -- so forty clicks left eighty listeners
        // on one button. `is-armed` is the whole state now.
        await game.openUpgrade("Germany");
        const confirm = page.locator(sel.bottomBarConfirmButton);

        await expect(confirm).not.toHaveClass(/is-armed/);
        expect(await game.upgradeWindow.confirmLabel()).toBe("Cancel");

        await game.upgradeWindow.plus("farm");
        await expect(confirm).toHaveClass(/is-armed/);
        expect(await game.upgradeWindow.confirmLabel()).toBe("Confirm");

        await game.upgradeWindow.minus("farm");
        await expect(confirm).not.toHaveClass(/is-armed/);
        expect(await game.upgradeWindow.confirmLabel()).toBe("Cancel");
    });

    test("is not styled inline, so a theme reaches it", async ({ startedGame: game, page }) => {
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");

        const inline = await page
            .locator(sel.bottomBarConfirmButton)
            .getAttribute("style");
        expect(inline ?? "").not.toContain("background");
    });
});

test.describe("the panels take their surface from a token", () => {
    test("every rebuilt window paints an opaque themed background", async ({
        startedGame: game,
        page,
    }) => {
        // A panel with a transparent background is the failure mode of a
        // half-converted rule: it inherits the map behind it and the text becomes
        // unreadable over the ocean but fine over land.
        await game.infoTable.open();

        for (const selector of [containers.mainUi]) {
            const background = await page
                .locator(selector)
                .evaluate((el) => getComputedStyle(el).backgroundColor);
            expect(background).not.toBe("rgba(0, 0, 0, 0)");
            expect(background).not.toBe("transparent");
        }
    });

    test("moving a surface token repaints the info panel", async ({
        startedGame: game,
        page,
    }) => {
        await game.infoTable.open();
        const panel = page.locator(containers.mainUi);
        const before = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);

        await page.evaluate(() =>
            document.documentElement.style.setProperty("--surface-panel", "rgb(4, 5, 6)")
        );
        const after = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
        await page.evaluate(() =>
            document.documentElement.style.removeProperty("--surface-panel")
        );

        expect(before).not.toBe("rgb(4, 5, 6)");
        expect(after).toBe("rgb(4, 5, 6)");
    });
});
