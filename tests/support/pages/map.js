import { map, containers } from "../selectors.js";

/**
 * The world map. It is an <object>, not an <iframe>, so
 * page.frameLocator("#svg-map") does not work -- Chromium exposes it as a frame
 * named after the element id, which is how the paths are reached.
 */
export class MapPage {
    constructor(page) {
        this.page = page;
    }

    frame() {
        const frame = this.page.frame({ name: map.frameName });
        if (!frame) {
            throw new Error(
                "The svg-map frame is not available yet; has the page finished loading?"
            );
        }
        return frame;
    }

    territory(territoryName) {
        return this.frame().locator(map.territory(territoryName));
    }

    country(dataName) {
        return this.frame().locator(map.country(dataName));
    }

    /**
     * Park the pointer somewhere that is not a territory, so the tooltip hides.
     *
     * `#tooltip` follows the pointer and has no `pointer-events: none`, so the
     * tooltip raised by hovering one territory sits on top of the next one and
     * eats the click. It is also what clears `clickActionsDone`, the latch that
     * otherwise stops the bottom table updating on the following click. Both
     * disappear when Phase 6.7 makes the map render from state and 6.8 moves the
     * inline styling into CSS.
     */
    async dismissTooltip() {
        for (const selector of [containers.bottomTable, containers.menu]) {
            const locator = this.page.locator(selector);
            if (await locator.isVisible().catch(() => false)) {
                await locator.hover({ position: { x: 5, y: 5 } }).catch(() => {});
                return;
            }
        }
        await this.page.mouse.move(1, 1);
    }

    async click(territoryName) {
        await this.dismissTooltip();
        await this.territory(territoryName).click();
    }

    async hover(territoryName) {
        await this.territory(territoryName).hover();
    }

    async attribute(territoryName, name) {
        return this.territory(territoryName).getAttribute(name);
    }

    async fill(territoryName) {
        return this.attribute(territoryName, "fill");
    }

    /** Attribute values for every path at once -- one round trip, not 359. */
    async attributeCounts(attribute) {
        return this.page.evaluate((attr) => {
            const doc = document.getElementById("svg-map").contentDocument;
            const counts = {};
            for (const path of doc.querySelectorAll("path[uniqueid]")) {
                const value = path.getAttribute(attr);
                counts[String(value)] = (counts[String(value)] ?? 0) + 1;
            }
            return counts;
        }, attribute);
    }

    async territoryCount() {
        return this.page.evaluate(
            () =>
                document
                    .getElementById("svg-map")
                    .contentDocument.querySelectorAll("path[uniqueid]").length
        );
    }

    /** Territory names currently flagged reachable from the current selection. */
    async attackableTerritories() {
        return this.page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            return [...doc.querySelectorAll('path[attackableTerritory="true"]')].map((p) =>
                p.getAttribute("territory-name")
            );
        });
    }

    async zoom(deltaY, { steps = 1 } = {}) {
        const box = await this.page.locator(map.object).boundingBox();
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < steps; i += 1) {
            await this.page.mouse.wheel(0, deltaY);
        }
    }

    async toggleMapMode() {
        await this.page.locator(map.mapModeButton).click();
    }

    async toggleContinentStroke() {
        await this.page.locator(map.strokeHighlightButton).click();
    }
}
