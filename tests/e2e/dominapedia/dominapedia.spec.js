import { test, expect } from "../../support/fixtures.js";
import { dominapedia, menu } from "../../support/selectors.js";

// The Dominapedia: the manual, opened from the main menu (Phase 7.6).
//
// The catalogue and the walk over it are pure and are already pinned in Node by
// `tests/unit/ui-dominapedia-topics.spec.js` -- including the wrap at both ends,
// which is the case nobody exercises by hand. So nothing here asserts what the
// book CONTAINS or what order it is in. What needs a browser is the part the
// player touches:
//
//   * the button in the menu opens it and three things close it;
//   * clicking a main topic opens and shuts it, and clicking a sub-topic changes
//     the page;
//   * Previous and Next move the page AND move the mark in the contents column,
//     which is two pieces of state that have to stay in step;
//   * both columns scroll independently and the panel itself does not, which is
//     what keeps the title bar and the two buttons on screen.
//
// docs/03-e2e-test-plan.md -- new functional area, `dominapedia/`.

/** The topic id of the page currently showing, read from the contents column. */
async function currentTopic(page) {
    return page.locator(dominapedia.currentLink).getAttribute("data-topic");
}

/** Every sub-topic link that is on screen -- i.e. inside an OPEN section. */
function visibleLinks(page) {
    return page.locator(`${dominapedia.nav} ${dominapedia.topicLink}:visible`);
}

test.describe("dominapedia", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/?e2e=1", { waitUntil: "domcontentloaded" });
        await expect(page.locator(menu.newGame)).toBeEnabled({ timeout: 30_000 });
    });

    test("the main menu offers Dominapedia, and it opens a full-screen window", async ({
        page,
    }) => {
        const button = page.locator(menu.dominapedia);
        await expect(button).toHaveText("Dominapedia");
        await expect(page.locator(dominapedia.container)).toBeHidden();

        await button.click();

        await expect(page.locator(dominapedia.panel)).toBeVisible();
        await expect(page.locator(dominapedia.title)).toHaveText("Dominapedia");
        // "Full-screen" is a claim about size, so it is measured rather than
        // assumed: both columns and the footer have to fit inside one viewport.
        const box = await page.locator(dominapedia.panel).boundingBox();
        const viewport = page.viewportSize();
        expect(box.width).toBeGreaterThan(viewport.width * 0.6);
        expect(box.height).toBeGreaterThan(viewport.height * 0.6);
        expect(box.height).toBeLessThanOrEqual(viewport.height);
    });

    test("closes on the X, on Escape and on a click outside the panel", async ({ page }) => {
        await page.click(menu.dominapedia);
        await page.click(dominapedia.close);
        await expect(page.locator(dominapedia.container)).toBeHidden();

        await page.click(menu.dominapedia);
        await expect(page.locator(dominapedia.panel)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator(dominapedia.container)).toBeHidden();

        await page.click(menu.dominapedia);
        await expect(page.locator(dominapedia.panel)).toBeVisible();
        // The scrim, well clear of the panel in the middle of it.
        await page.locator(dominapedia.container).click({ position: { x: 5, y: 5 } });
        await expect(page.locator(dominapedia.container)).toBeHidden();
    });

    test("opens on a page, with its section expanded and its link marked", async ({ page }) => {
        await page.click(menu.dominapedia);

        await expect(page.locator(dominapedia.currentLink)).toHaveCount(1);
        await expect(page.locator(dominapedia.contentTitle)).not.toBeEmpty();
        await expect(page.locator(dominapedia.breadcrumb)).not.toBeEmpty();
        await expect(page.locator(dominapedia.contentBody)).not.toBeEmpty();
        // The mark in the contents and the page in the pane are the same page.
        // `textContent`, not `innerText`: the page title carries
        // `text-transform: var(--display-transform)` and several themes set it to
        // uppercase, so `innerText` would compare a shouted title against a link
        // that is not shouted.
        await expect(page.locator(dominapedia.currentLink)).toHaveText(
            await page.locator(dominapedia.contentTitle).textContent()
        );
    });

    test("a main topic collapses and expands, taking its sub-topics with it", async ({ page }) => {
        await page.click(menu.dominapedia);

        // Whichever section the panel opened on -- the spec must not know the
        // catalogue's first entry by name.
        const openGroup = page.locator(`${dominapedia.section}${dominapedia.isOpen}`).first();
        const sectionId = await openGroup.getAttribute("data-section");
        const header = page.locator(dominapedia.sectionFor(sectionId));
        const group = page.locator(dominapedia.sectionGroupFor(sectionId));
        const topics = group.locator(dominapedia.topicLink);

        await expect(header).toHaveAttribute("aria-expanded", "true");
        await expect(topics.first()).toBeVisible();

        await header.click();
        await expect(header).toHaveAttribute("aria-expanded", "false");
        await expect(topics.first()).toBeHidden();

        await header.click();
        await expect(header).toHaveAttribute("aria-expanded", "true");
        await expect(topics.first()).toBeVisible();
    });

    test("clicking a sub-topic shows that page", async ({ page }) => {
        await page.click(menu.dominapedia);

        // Open every main topic, then take a link that is not the current page.
        for (const header of await page.locator(dominapedia.sectionHeader).all()) {
            if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
        }

        const links = visibleLinks(page);
        expect(await links.count()).toBeGreaterThan(1);

        const target = links.nth(await links.count() - 1);
        const targetId = await target.getAttribute("data-topic");
        const targetTitle = await target.textContent();
        expect(targetId).not.toBe(await currentTopic(page));

        await target.click();

        expect(await currentTopic(page)).toBe(targetId);
        await expect(page.locator(dominapedia.contentTitle)).toHaveText(targetTitle);
        await expect(target).toHaveAttribute("aria-current", "page");
    });

    test("Next and Previous move the page and the mark together, and are inverse", async ({
        page,
    }) => {
        await page.click(menu.dominapedia);

        const first = await currentTopic(page);
        await page.click(dominapedia.next);
        const second = await currentTopic(page);
        expect(second).not.toBe(first);
        // The contents column follows the buttons: the two are one piece of state.
        // `textContent`, not `innerText`: the page title carries
        // `text-transform: var(--display-transform)` and several themes set it to
        // uppercase, so `innerText` would compare a shouted title against a link
        // that is not shouted.
        await expect(page.locator(dominapedia.currentLink)).toHaveText(
            await page.locator(dominapedia.contentTitle).textContent()
        );

        await page.click(dominapedia.previous);
        expect(await currentTopic(page)).toBe(first);
    });

    test("Next wraps from the last page round to the first, and Previous the other way", async ({
        page,
    }) => {
        await page.click(menu.dominapedia);

        const first = await currentTopic(page);
        // "N of M" -- the second number is the length of the book, which is the one
        // thing this spec is allowed to learn from the panel rather than assert.
        // The counter is drawn in caps by `text-transform`, so it is read as
        // `textContent` and split case-insensitively below.
        const position = await page.locator(dominapedia.position).textContent();
        const total = Number(position.split(/\s+of\s+/i)[1]);
        expect(total).toBeGreaterThan(1);

        // Walk to the end.
        for (let step = 1; step < total; step += 1) await page.click(dominapedia.next);
        await expect(page.locator(dominapedia.position)).toHaveText(`${total} of ${total}`);
        const last = await currentTopic(page);
        expect(last).not.toBe(first);

        // One more comes back to the start.
        await page.click(dominapedia.next);
        expect(await currentTopic(page)).toBe(first);
        await expect(page.locator(dominapedia.position)).toHaveText(`1 of ${total}`);

        // And backwards off the front goes to the end.
        await page.click(dominapedia.previous);
        expect(await currentTopic(page)).toBe(last);
        await expect(page.locator(dominapedia.position)).toHaveText(`${total} of ${total}`);
    });

    test("neither navigation button is ever disabled", async ({ page }) => {
        await page.click(menu.dominapedia);
        await expect(page.locator(dominapedia.previous)).toBeEnabled();
        await expect(page.locator(dominapedia.next)).toBeEnabled();
    });

    test("both columns scroll and the panel itself does not", async ({ page }) => {
        await page.click(menu.dominapedia);

        // With every section open the contents column is taller than its box.
        for (const header of await page.locator(dominapedia.sectionHeader).all()) {
            if ((await header.getAttribute("aria-expanded")) === "false") await header.click();
        }

        const overflow = (selector) =>
            page.locator(selector).evaluate((node) => ({
                scrollable: node.scrollHeight > node.clientHeight,
                overflowY: getComputedStyle(node).overflowY,
            }));

        expect((await overflow(dominapedia.nav)).overflowY).toBe("auto");
        expect((await overflow(dominapedia.nav)).scrollable).toBe(true);
        expect((await overflow(dominapedia.content)).overflowY).toBe("auto");

        // The panel is the fixed thing: if IT scrolls, the title bar and the two
        // buttons leave the screen and the layout has failed.
        const panel = await page.locator(dominapedia.panel).evaluate((node) => ({
            overflow: getComputedStyle(node).overflowY,
            overflowing: node.scrollHeight > node.clientHeight + 1,
        }));
        expect(panel.overflow).toBe("hidden");
        expect(panel.overflowing).toBe(false);

        // And the footer is still on screen after all that.
        await expect(page.locator(dominapedia.next)).toBeInViewport();
    });

    test("changing the page scrolls the reading pane back to the top", async ({ page }) => {
        await page.click(menu.dominapedia);

        await page.locator(dominapedia.content).evaluate((node) => {
            node.scrollTop = 40;
        });
        await page.click(dominapedia.next);

        expect(
            await page.locator(dominapedia.content).evaluate((node) => node.scrollTop)
        ).toBe(0);
    });

    test("reopening comes back to the page that was being read", async ({ page }) => {
        await page.click(menu.dominapedia);
        await page.click(dominapedia.next);
        await page.click(dominapedia.next);
        const reading = await currentTopic(page);

        await page.keyboard.press("Escape");
        await page.click(menu.dominapedia);

        expect(await currentTopic(page)).toBe(reading);
    });
});
