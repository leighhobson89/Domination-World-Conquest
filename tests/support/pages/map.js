import { ATTACK_ARROW_PREFIX, containers, ids, map, territorySelectors } from "../selectors.js";

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
        return this.page.evaluate(({ attr, mapId, allPaths }) => {
            const doc = document.getElementById(mapId).contentDocument;
            const counts = {};
            for (const path of doc.querySelectorAll(allPaths)) {
                const value = path.getAttribute(attr);
                counts[String(value)] = (counts[String(value)] ?? 0) + 1;
            }
            return counts;
        }, { attr: attribute, mapId: ids.svgMap, allPaths: territorySelectors.all });
    }

    async territoryCount() {
        return this.page.evaluate(
            ({ mapId, allPaths }) =>
                document.getElementById(mapId).contentDocument.querySelectorAll(allPaths).length,
            { mapId: ids.svgMap, allPaths: territorySelectors.all }
        );
    }

    /** Territory names currently flagged reachable from the current selection. */
    async attackableTerritories() {
        return this.page.evaluate(
            ({ mapId, attackable }) => {
                const doc = document.getElementById(mapId).contentDocument;
                return [...doc.querySelectorAll(attackable)].map((p) =>
                    p.getAttribute("territory-name")
                );
            },
            { mapId: ids.svgMap, attackable: territorySelectors.attackable }
        );
    }

    /**
     * The animated attack arrows, one entry per arrow.
     *
     * They live in the MAP's document, so there is no reaching them from the host
     * page -- which is also why the shaft is measured with `getTotalLength()` here
     * rather than by parsing the `d` attribute: the arrow is a Bezier and its length
     * is not its chord, and the length is what "long enough for the player to see" is
     * a claim about.
     */
    async attackArrows() {
        return this.page.evaluate(
            ({ mapId, layerId, prefix }) => {
                const doc = document.getElementById(mapId).contentDocument;
                const layer = doc.getElementById(layerId);
                if (!layer) {
                    return [];
                }
                return [...layer.children].map((group) => {
                    const paths = group.querySelectorAll("path");
                    const shaft = paths[2];
                    return {
                        uniqueId: group.id.slice(prefix.length),
                        shaftLength: shaft.getTotalLength(),
                        strokeWidth: Number(shaft.getAttribute("stroke-width")),
                        dashArray: shaft.getAttribute("stroke-dasharray"),
                        animations: group.querySelectorAll("animate").length,
                        pointerEvents: getComputedStyle(group).pointerEvents,
                    };
                });
            },
            { mapId: ids.svgMap, layerId: ids.attackArrowLayer, prefix: ATTACK_ARROW_PREFIX }
        );
    }

    /**
     * Wheel over the map. `at` is a fraction of the map element in each axis and
     * defaults to its centre; pass one to test that zoom anchors on the pointer.
     */
    async zoom(deltaY, { steps = 1, at = { x: 0.5, y: 0.5 } } = {}) {
        const box = await this.page.locator(map.object).boundingBox();
        await this.page.mouse.move(box.x + box.width * at.x, box.y + box.height * at.y);
        for (let i = 0; i < steps; i += 1) {
            await this.page.mouse.wheel(0, deltaY);
            await this.settle();
        }
    }

    /**
     * Wait until the map document has processed whatever was just dispatched to it.
     *
     * `page.mouse.wheel()` resolves once the event has been SENT, not once it has
     * been handled -- and the map is an embedded document, so a `page.evaluate()`
     * straight afterwards can read the viewBox a frame early and see the value from
     * before the wheel. That is what it did: the reads in `zoom-pan.spec.js` came
     * back one step behind, consistently, and looked like the camera ignoring the
     * pointer. Two frames INSIDE the map document is enough, and it is a wait on a
     * real signal rather than an arbitrary sleep.
     *
     * This was not needed before Phase 6.7 only because zoom animated for 500 ms and
     * the specs polled for the motion to stop, which absorbed it by accident.
     */
    async settle() {
        await this.page.evaluate((mapId) => {
            const view = document.getElementById(mapId).contentDocument.defaultView;
            return new Promise((resolve) => {
                view.requestAnimationFrame(() => view.requestAnimationFrame(resolve));
            });
        }, ids.svgMap);
    }

    /** The viewBox of the territory layer, as four numbers. */
    async viewBox() {
        return this.page.evaluate((mapId) => {
            const doc = document.getElementById(mapId).contentDocument;
            const [x, y, width, height] = doc
                .querySelector("svg")
                .getAttribute("viewBox")
                .split(/\s+/)
                .map(Number);
            return { x, y, width, height };
        }, ids.svgMap);
    }

    /**
     * One click of the continent-view button, which walks
     * normal -> physical -> continent -> normal (Phase 7.4).
     */
    async cycleContinentView() {
        await this.page.locator(map.continentViewButton).click();
    }

    /** Which of the three views the button says it is in. */
    async continentView() {
        return this.page.locator(map.continentViewButton).getAttribute("data-view");
    }

    /** Walk the cycle until it reaches `view`, and no further than one full lap. */
    async setContinentView(view) {
        for (let i = 0; i < 3; i++) {
            if ((await this.continentView()) === view) return;
            await this.cycleContinentView();
        }
        throw new Error(`setContinentView: never reached "${view}"`);
    }
}
