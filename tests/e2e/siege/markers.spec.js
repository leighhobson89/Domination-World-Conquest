import { test, expect } from "../../support/fixtures.js";
import { battle } from "../../support/selectors.js";

// The siege marker on the map: that there is exactly one, that it does not intercept the
// click it sits on top of, and that it goes away with the siege.
//
// docs/04-e2e-test-plan.md sections 5.4 and 5.11.

/** Every siege overlay in the map document, by id. */
function overlayIds(page) {
    return page.evaluate(() => {
        const doc = document.getElementById("svg-map").contentDocument;
        return [...doc.querySelectorAll("image")]
            .map((image) => image.getAttribute("id"))
            .filter((id) => id && id.startsWith("siegeImage_"));
    });
}

/** What a click at the centre of a territory would actually land on. */
function hitTestCentre(page, territoryName) {
    return page.evaluate((name) => {
        const doc = document.getElementById("svg-map").contentDocument;
        const path = [...doc.querySelectorAll("path")].find(
            (p) => p.getAttribute("territory-name") === name
        );
        const bounds = path.getBBox();
        const svg = doc.documentElement;
        const point = svg.createSVGPoint();
        point.x = bounds.x + bounds.width / 2;
        point.y = bounds.y + bounds.height / 2;
        const screen = point.matrixTransform(svg.getScreenCTM());
        const hit = doc.elementFromPoint(screen.x, screen.y);
        return hit ? { tag: hit.tagName, territory: hit.getAttribute("territory-name") } : null;
    }, territoryName);
}

test.describe("siege markers", () => {
    test.setTimeout(240_000);

    test("there is exactly one per besieged territory", async ({ game, page }) => {
        // Phase 4.5 moved marker rendering into src/ui/siegeOverlay.js, driven by the store's
        // `siegeChanged` event. The old imperative call in the siege button handler was left
        // behind, so laying a siege drew the marker TWICE -- two <image> elements carrying
        // the same `siegeImage_<name>` id, of which only one was ever removed.
        await game.start({ country: "Germany", seed: "marker-one" });
        expect(await overlayIds(page)).toEqual([]);

        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await page.locator(battle.siege).click();
        await expect.poll(async () => (await game.sieges()).player).toContain("France");

        expect(await overlayIds(page)).toEqual(["siegeImage_France"]);
    });

    test("does not swallow the click on the territory it marks", async ({ game, page }) => {
        // The marker is decoration. It used to have no `pointer-events: none`, so it covered
        // the middle of the territory and a hit test at the centre returned the IMAGE -- and
        // clicking a besieged territory is the only route the player has to VIEW SIEGE.
        // Same class of bug as `#tooltip`, which the page objects still work around.
        await game.start({ country: "Germany", seed: "marker-click" });
        await game.loadScenario("evenly-matched");
        await game.launchWholeGarrison({ from: "Germany", to: "France" });
        await page.locator(battle.siege).click();
        await expect.poll(async () => (await game.sieges()).player).toContain("France");

        const hit = await hitTestCentre(page, "France");
        expect(hit.tag, "the marker must not be the hit target").toBe("path");
        expect(hit.territory).toBe("France");
    });

    test("an AI siege renders the AI variant", async ({ game, page }) => {
        await game.start({ country: "Germany", seed: "marker-ai" });
        const report = await game.loadScenario("two-sieges");
        expect(report.sieges).toHaveLength(2);

        const ids = await overlayIds(page);
        expect(ids).toEqual(expect.arrayContaining(["siegeImage_Germany", "siegeImage_France"]));

        const variant = await page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            const image = doc.getElementById("siegeImage_Germany");
            return {
                href:
                    image.getAttributeNS("http://www.w3.org/1999/xlink", "href") ??
                    image.getAttribute("href"),
                opacity: getComputedStyle(image).opacity,
                pointerEvents: getComputedStyle(image).pointerEvents,
            };
        });
        expect(variant.href).toContain("siegeai");
        expect(Number(variant.opacity), "the AI marker is the faded variant").toBeLessThan(1);
        expect(variant.pointerEvents).toBe("none");
    });

    test("no orphan marker survives the siege that raised it", async ({ game, page }) => {
        // `normalizeSiegeState()` used to sweep all 359 paths once a turn to reconcile the
        // markers against the siege lists, because the two were separate facts. They are one
        // fact now -- the marker is rendered from `siegeChanged` -- so removing the siege has
        // to be the whole operation.
        await game.start({ country: "Germany", seed: "marker-orphan" });
        await game.loadScenario("doomed-ai-siege");
        expect(await overlayIds(page)).toEqual(["siegeImage_Germany"]);

        // Take the siege back out through the same door it came in.
        await page.evaluate(() => window.__game.applyScenario({ name: "noop" }));
        const stillThere = await page.evaluate(() => window.__game.siegeAt("Germany"));
        expect(stillThere, "the scenario siege is still standing").not.toBeNull();

        // Play until it resolves on its own, then check nothing was left behind.
        for (let turn = 0; turn < 3; turn += 1) {
            await game.playTurn();
            const siege = await page.evaluate(() => window.__game.siegeAt("Germany"));
            if (!siege) {
                expect(await overlayIds(page)).not.toContain("siegeImage_Germany");
                expect(await game.map.attribute("Germany", "underSiege")).toBe("false");
                return;
            }
        }
        // Still besieged after three turns is a legitimate outcome -- the AI besieges far
        // more than it can finish (docs/05-known-issues.md section 6). The invariant that
        // matters either way is that the marker and the state agree.
        expect(await overlayIds(page)).toContain("siegeImage_Germany");
        expect(await game.map.attribute("Germany", "underSiege")).toBe("true");
    });
});
