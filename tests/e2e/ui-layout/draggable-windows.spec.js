import { test, expect } from "../../support/fixtures.js";
import { containers, draggableWindows, sel } from "../../support/selectors.js";

// Windows that move, and a window that comes to the front when you touch it.
//
// Phase 7.4. Every floating window used to be nailed to a percentage of the
// viewport, and two of them overlap by design -- the activity feed opens on top
// of the territory panel at the start of every turn -- so the only way to read
// what was underneath was to close what was on top.
//
// Three things here can only be checked in a browser, and all three have already
// been wrong once:
//
//   * that a drag MOVES the window rather than teleporting it. Three of these
//     windows are centred with `transform: translate(-50%, -50%)`, and the naive
//     implementation -- write `left`/`top` from the bounding rectangle -- jumps
//     them by half their own size on the first pointer move.
//   * that the transfer window's transform SURVIVES the drag. Two of its own
//     children are `position: fixed`, which resolves against the nearest
//     transformed ancestor; take the transform off and the window's header flies
//     to the corner of the screen.
//   * that focus actually reorders anything. The first version compared each
//     window's z-index against the counter's high-water mark, which was true for
//     every window while they all sat at the base -- so nothing could ever be
//     raised, and nothing threw.
//
// docs/04-e2e-test-plan.md -- `ui-layout/`.

/**
 * Drag `handle` by (dx, dy) and return how far the window actually moved.
 *
 * `grabFrom` picks which end of the handle to take hold of, and it is not a
 * detail. The territory panel's title bar has to be grabbed at its RIGHT end,
 * because the activity feed covers its left end and a drag that starts on the
 * wrong window is a test that passes for the wrong reason. The activity feed's
 * header has to be grabbed at its LEFT end, because its right end is the repeat
 * toggle and the close button -- which `makeDraggable()` deliberately excludes
 * from the grip, so a drag started there correctly does nothing at all.
 */
async function dragBy(page, containerSelector, handleSelector, dx, dy, grabFrom = "right") {
    const handle = await page.locator(handleSelector).boundingBox();
    const before = await page.locator(containerSelector).boundingBox();

    const grabX =
        grabFrom === "left"
            ? handle.x + 30
            : Math.min(handle.x + handle.width - 40, handle.x + handle.width / 2 + 300);
    const grabY = handle.y + handle.height / 2;

    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + dx, grabY + dy, { steps: 12 });
    await page.mouse.up();

    const after = await page.locator(containerSelector).boundingBox();
    return { x: Math.round(after.x - before.x), y: Math.round(after.y - before.y) };
}

/**
 * Raise a window by pointing at it, without asking whether that pixel is
 * reachable.
 *
 * The two windows in these tests overlap almost completely by design -- an
 * 85.5%-wide territory panel over a 420px feed -- which is the whole reason
 * dragging and focus exist. A coordinate click on the covered one lands on the
 * cover, so the event is dispatched to the element instead. What is under test
 * here is that a pointerdown on a window reorders the stack; that a window can be
 * reached at all is the separate off-screen test below.
 */
async function focusByPointer(page, selector) {
    await page.locator(selector).dispatchEvent("pointerdown");
}

const zOf = (page, selector) =>
    page.locator(selector).evaluate((el) => Number(el.style.zIndex) || 0);

test.describe("dragging", () => {
    test("the territory panel moves by the distance the pointer moved", async ({
        startedGame: game,
        page,
    }) => {
        await game.infoTable.open();
        // Out of the way first: it opens over the territory panel's title bar.
        await game.activityPanel.close();

        const moved = await dragBy(page, containers.mainUi, draggableWindows.mainUiTitleBar, -120, 90);
        expect(moved.x).toBe(-120);
        expect(moved.y).toBe(90);
    });

    test("the upgrade window moves by its nav bar, and keeps its centring transform", async ({
        startedGame: game,
        page,
    }) => {
        await game.activityPanel.close();
        await game.openUpgrade("Germany");

        const before = await page
            .locator(containers.upgrade)
            .evaluate((el) => getComputedStyle(el).transform);

        const moved = await dragBy(page, containers.upgrade, sel.navbarUpgradeWindow, 140, 60);
        expect(moved.x).toBe(140);
        expect(moved.y).toBe(60);

        const after = await page
            .locator(containers.upgrade)
            .evaluate((el) => getComputedStyle(el).transform);
        expect(after, "the drag must not touch the transform").toBe(before);
    });

    test("the activity feed moves by its header", async ({ startedGame: game, page }) => {
        await game.activityPanel.open();
        const moved = await dragBy(
            page,
            containers.activityPanel,
            "#activity-panel .activity-panel-header",
            160,
            120,
            "left"
        );
        expect(moved.x).toBe(160);
        expect(moved.y).toBe(120);
    });

    test("a button inside a title bar still does its own job", async ({
        startedGame: game,
        page,
    }) => {
        // `makeDraggable()` excludes controls from the grip. Without that the close
        // button becomes a drag handle and a click that wanders by one pixel stops
        // closing the window.
        await game.activityPanel.close();
        await game.openUpgrade("Germany");
        await page.click(sel.xButtonUpgrade);
        await expect(page.locator(containers.upgrade)).toBeHidden();
    });

    test("a window cannot be dragged entirely off the screen", async ({
        startedGame: game,
        page,
    }) => {
        // A window with no part of its title bar on screen is a window that cannot be
        // brought back.
        await game.infoTable.open();
        await game.activityPanel.close();
        await dragBy(page, containers.mainUi, draggableWindows.mainUiTitleBar, -5000, 5000);

        const box = await page.locator(containers.mainUi).boundingBox();
        const viewport = page.viewportSize();
        expect(box.x + box.width).toBeGreaterThan(0);
        expect(box.y).toBeLessThan(viewport.height);
        expect(box.y).toBeGreaterThanOrEqual(-1);
    });
});

test.describe("focus brings a window to the front", () => {
    test("clicking a window raises it above the one that was on top", async ({
        startedGame: game,
        page,
    }) => {
        await game.infoTable.open();
        await game.activityPanel.open();
        expect(await zOf(page, containers.activityPanel)).toBeGreaterThan(
            await zOf(page, containers.mainUi)
        );

        await focusByPointer(page, `${containers.mainUi} ${draggableWindows.titleBar}`);
        expect(await zOf(page, containers.mainUi)).toBeGreaterThan(
            await zOf(page, containers.activityPanel)
        );

        await focusByPointer(page, "#activity-panel .activity-panel-title");
        expect(await zOf(page, containers.activityPanel)).toBeGreaterThan(
            await zOf(page, containers.mainUi)
        );
    });

    test("clicking deep inside a window raises it too, not only its title bar", async ({
        startedGame: game,
        page,
    }) => {
        // The focus listener is on the container in the CAPTURE phase, because rows
        // inside these tables stop the event from bubbling.
        await game.infoTable.open();
        await game.activityPanel.open();
        await game.infoTable.showTerritories();

        await focusByPointer(page, `${containers.mainUi} .ui-table-column >> nth=0`);
        expect(await zOf(page, containers.mainUi)).toBeGreaterThan(
            await zOf(page, containers.activityPanel)
        );
    });

    test("every window stays below the modals", async ({ startedGame: game, page }) => {
        // A dialog asking whether to abandon the game must never open behind the
        // panel it was opened from, which is what an unbounded counter would
        // eventually cause.
        await game.infoTable.open();
        await game.activityPanel.open();
        for (let i = 0; i < 12; i += 1) {
            await focusByPointer(page, `${containers.mainUi} ${draggableWindows.titleBar}`);
            await focusByPointer(page, "#activity-panel .activity-panel-title");
        }
        expect(await zOf(page, containers.mainUi)).toBeLessThan(10000);
        expect(await zOf(page, containers.activityPanel)).toBeLessThan(10000);
    });
});

test.describe("opening a window focuses it", () => {
    test("the upgrade window opens ABOVE the territory panel that opened it", async ({
        startedGame: game,
        page,
    }) => {
        // It is opened by a button inside the territory panel, so appearing behind
        // that panel is the one failure mode that makes it useless. Being last in
        // the document used to be enough; it stopped being enough the moment these
        // windows carried a z-index of their own.
        await game.infoTable.open();
        await page.locator(containers.mainUi).locator(draggableWindows.titleBar).click();

        await game.openUpgrade("Germany");
        expect(await zOf(page, containers.upgrade)).toBeGreaterThan(
            await zOf(page, containers.mainUi)
        );
    });

    test("and so does the buy window", async ({ startedGame: game, page }) => {
        await game.infoTable.open();
        await page.locator(containers.mainUi).locator(draggableWindows.titleBar).click();

        await game.openBuy("Germany");
        expect(await zOf(page, containers.buy)).toBeGreaterThan(
            await zOf(page, containers.mainUi)
        );
    });
});

test.describe("every window has something to be dragged by", () => {
    test("the territory panel has a title bar above its tabs", async ({
        startedGame: game,
        page,
    }) => {
        // It is new: that window had four tabs and a close button and nothing that
        // said what it WAS, which was liveable while it could not move and is not
        // once the tab strip has to double as a grip.
        await game.infoTable.open();
        const bar = page.locator(draggableWindows.mainUiTitleBar);
        await expect(bar).toBeVisible();
        await expect(bar).toHaveClass(new RegExp(draggableWindows.dragHandle.slice(1)));

        const order = await page.evaluate(() => {
            const kids = [...document.querySelector("#main-ui-container .blur-background").children];
            return kids.map((k) => k.id || k.className);
        });
        expect(order[0]).toContain("main-ui-title-bar");
    });

    test("the upgrade, buy and activity windows carry the handle class", async ({
        startedGame: game,
        page,
    }) => {
        await game.openUpgrade("Germany");
        await expect(page.locator(sel.navbarUpgradeWindow)).toHaveClass(/window-drag-handle/);
        await game.upgradeWindow.close();

        await game.openBuy("Germany");
        await expect(page.locator(sel.navbarBuyWindow)).toHaveClass(/window-drag-handle/);
        await game.buyWindow.close();

        await game.activityPanel.open();
        await expect(page.locator("#activity-panel .activity-panel-header")).toHaveClass(
            /window-drag-handle/
        );
    });
});
