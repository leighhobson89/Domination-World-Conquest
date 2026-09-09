// The military map view (register item E1).
// docs/02-e2e-test-plan.md section 5.4.
//
// The view shades every territory by how its garrison stands against the strongest enemy that
// can reach it, marks the player's threatened borders from the real battle model, and draws
// each territory's force wherever the territory is big enough on screen to hold the figure --
// so zooming in reveals the smaller countries rather than magnifying the numbers.
//
// WHAT IS ASSERTED HERE AND WHAT IS NOT. The decision -- which band, which mark, which
// territory carries a figure -- is a pure function and is pinned in
// `tests/unit/ui-military-shading.spec.js`, in milliseconds. What only a browser can answer is
// whether any of it reaches the map at all, and that is a genuinely dangerous question here:
// the map is an `<object>` with its own document, the theme's tokens do not cascade into it,
// and the first version of this feature threw inside the click handler and left the political
// map standing with the button reading "military". Nothing in the unit suite could see it.
//
// NO COLOUR LITERAL IS ASSERTED. The ramp comes from two theme tokens, so pinning an rgb here
// would make a palette edit a red suite. The properties asserted are structural: the map
// collapses to a handful of fills rather than 207, the player's outline changes when the
// border becomes indefensible, and the figures come and go with the view.

import { test, expect } from "../../support/fixtures.js";
import { containers, map } from "../../support/selectors.js";
import { ids } from "../../../src/ui/core/registry.js";

/** Every distinct fill on the territory layer, and how many paths wear each. */
const fillsOf = (page) =>
    page.evaluate((mapId) => {
        const doc = document.getElementById(mapId).contentDocument;
        const counts = {};
        for (const path of doc.querySelectorAll("path[uniqueid]")) {
            const fill = path.getAttribute("fill");
            counts[fill] = (counts[fill] ?? 0) + 1;
        }
        return counts;
    }, ids.svgMap);

/** The figures drawn into the map document. */
const labelsOf = (page) =>
    page.evaluate((layerId) => {
        const doc = document.getElementById("svg-map").contentDocument;
        const layer = doc.getElementById(layerId);
        return Array.from(layer?.querySelectorAll("text") ?? []).map(node => node.textContent);
    }, ids.militaryLabelLayer);

/** One territory's outline, as the view writes it. */
const outlineOf = (page, territoryName) =>
    page.evaluate(([mapId, name]) => {
        const doc = document.getElementById(mapId).contentDocument;
        const path = Array.from(doc.querySelectorAll("path[uniqueid]"))
            .find(candidate => candidate.getAttribute("territory-name") === name);
        return { stroke: path.style.stroke, width: Number(path.getAttribute("stroke-width")) };
    }, [ids.svgMap, territoryName]);

test.describe("the military map", () => {
    test("is the third stop on the map-view button, between the political map and the relief", async ({
        startedGame: game,
        page,
    }) => {
        const button = page.locator(map.continentViewButton);

        await expect(button).toHaveAttribute("data-view", "continent");
        await game.map.cycleContinentView();
        await expect(button).toHaveAttribute("data-view", "normal");
        await game.map.cycleContinentView();
        await expect(button).toHaveAttribute("data-view", "military");
        await game.map.cycleContinentView();
        await expect(button).toHaveAttribute("data-view", "physical");
        await game.map.cycleContinentView();
        await expect(button).toHaveAttribute("data-view", "continent");
    });

    test("collapses the political colours onto one ramp, and puts them back on the way out", async ({
        startedGame: game,
        page,
    }) => {
        const political = await fillsOf(page);
        //207 countries, so the political map is a great many distinct fills.
        expect(Object.keys(political).length).toBeGreaterThan(100);

        await game.map.setContinentView("military");

        const shaded = await fillsOf(page);
        //Five bands and nothing else. This is the assertion that would have caught the view
        //failing to apply at all: a map still wearing its owner colours has hundreds.
        expect(Object.keys(shaded).length).toBeLessThanOrEqual(5);
        //And every territory is painted: no band is missing its fill.
        expect(Object.values(shaded).reduce((sum, count) => sum + count, 0)).toBe(359);

        await game.map.setContinentView("continent");

        expect(Object.keys(await fillsOf(page)).length).toBe(Object.keys(political).length);
    });

    test("draws the force figures while it is up, and takes them away with it", async ({
        startedGame: game,
        page,
    }) => {
        expect(await labelsOf(page)).toHaveLength(0);

        await game.map.setContinentView("military");
        const figures = await labelsOf(page);

        expect(figures.length).toBeGreaterThan(0);
        //Abbreviated, not raw: a six-figure garrison written out does not fit inside Belgium.
        for (const figure of figures) {
            expect(figure).toMatch(/^\d+(\.\d)?[kMB]?$/);
        }

        await game.map.setContinentView("normal");
        expect(await labelsOf(page)).toHaveLength(0);
    });

    test("fills in the smaller territories as the map is zoomed into", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.setContinentView("military");
        const atWorldZoom = (await labelsOf(page)).length;

        await game.map.zoom(-100, { steps: 3 });

        //THE ZOOM IS THE DECLUTTERING. A figure is drawn wherever the territory is big enough
        //ON SCREEN to hold it, and the figures are sized in screen pixels -- so zooming in
        //does not magnify the numbers, it reveals the countries that could not carry one. That
        //is the whole reason the labels are redrawn on `onZoomChanged()` rather than left to
        //scale with the land.
        expect((await labelsOf(page)).length).toBeGreaterThan(atWorldZoom);
    });

    test("puts a key on screen with the view, and takes it away again", async ({
        startedGame: game,
        page,
    }) => {
        const legend = page.locator("#" + ids.mapLegend);

        await expect(legend).toBeHidden();

        await game.map.setContinentView("military");

        await expect(legend).toBeVisible();
        //Five swatches, one per band, painted from the same two theme tokens the map is. The
        //colours are deliberately not asserted -- a palette edit must not turn this red.
        await expect(legend.locator(".map-legend-ramp .map-legend-swatch")).toHaveCount(5);
        //Two threat marks and the player's own outline: ownership is the one thing this view
        //gives up, so the key has to say how to find it.
        await expect(legend.locator(".map-legend-row")).toHaveCount(3);

        await game.map.setContinentView("physical");
        await expect(legend).toBeHidden();
    });

    test("marks the shared stretch of border, not the whole territory", async ({
        startedGame: game,
        page,
    }) => {
        await game.map.setContinentView("military");

        const outlineBefore = await outlineOf(page, "Germany");


        //Germany reduced to a token garrison with its forts gone, against a neighbour that
        //could throw the better part of a million men at it. Nothing about this is a close
        //call, which is the point: the assertion is that the mark appears and WHERE, not where
        //the band edge sits -- that is pinned in the unit suite.
        await page.evaluate((input) => window.__game.applyScenario(input), {
            name: "military-view-threatened-border",
            territories: [
                {
                    territory: "Germany",
                    patch: {
                        armyForCurrentTerritory: 1000,
                        infantryForCurrentTerritory: 1000,
                        assaultForCurrentTerritory: 0, useableAssault: 0,
                        airForCurrentTerritory: 0, useableAir: 0,
                        navalForCurrentTerritory: 0, useableNaval: 0,
                        fortsBuilt: 0, defenseBonus: 0
                    }
                },
                {
                    territory: "France",
                    patch: {
                        armyForCurrentTerritory: 900000,
                        infantryForCurrentTerritory: 900000,
                        assaultForCurrentTerritory: 0, useableAssault: 0,
                        airForCurrentTerritory: 0, useableAir: 0,
                        navalForCurrentTerritory: 0, useableNaval: 0
                    }
                }
            ]
        });

        //The view follows the world rather than the click that opened it, and it coalesces a
        //burst of changes rather than rebuilding per event -- so this waits for the mark.
        await expect
            .poll(async () => await page.evaluate((mapId) => {
                const doc = document.getElementById(mapId).contentDocument;
                return doc.querySelectorAll("path[data-threat]").length;
            }, ids.svgMap))
            .toBeGreaterThan(0);

        const drawn = await page.evaluate(([mapId]) => {
            const doc = document.getElementById(mapId).contentDocument;
            const path = doc.querySelector("path[data-threat]");
            const germany = Array.from(doc.querySelectorAll("path[uniqueid]"))
                .find(candidate => candidate.getAttribute("territory-name") === "Germany");
            return {
                threat: path.getAttribute("data-threat"),
                markLength: path.getTotalLength(),
                outlineLength: germany.getTotalLength(),
                germanyStroke: germany.style.stroke
            };
        }, [ids.svgMap]);

        //THE POINT OF THIS TEST. The mark is a fraction of Germany's outline -- the stretch it
        //shares with France -- and not the whole ring. Ringing a country in red because one of
        //its seven neighbours is dangerous says "you are encircled", which is a different and
        //untrue statement.
        expect(drawn.threat).toBe("critical");
        expect(drawn.markLength).toBeGreaterThan(0);
        expect(drawn.markLength).toBeLessThan(drawn.outlineLength * 0.5);
        //And the territory's own outline still says whose it is.
        expect(drawn.germanyStroke).toBe(outlineBefore.stroke);
    });

    test("marks every neighbour that could take the border, not only the strongest", async ({
        game,
        page,
    }) => {
        //THE BUG THIS GUARDS, and it was found on the real map rather than in a fixture. The
        //plan used to forecast ONE pairing per province -- the strongest enemy beside it -- so
        //Canada, threatened by the United States along the 49th parallel and by Alaska in the
        //north-west, was marked on the long border and drawn clean on the short one. A border
        //left unmarked reads as a border that is safe, which is the opposite of true here.
        //
        //Canada rather than the fixture's Germany because it is the case Leigh reported and
        //because it is the shape that makes the bug visible: one country, two of its
        //territories, two separate stretches of the same frontier.
        await game.start({ country: "Canada" });
        await game.map.setContinentView("military");

        const unit = (territoryName, army) => ({
            territory: territoryName,
            patch: {
                armyForCurrentTerritory: army, infantryForCurrentTerritory: army,
                assaultForCurrentTerritory: 0, useableAssault: 0,
                airForCurrentTerritory: 0, useableAir: 0,
                navalForCurrentTerritory: 0, useableNaval: 0
            }
        });
        await page.evaluate((input) => window.__game.applyScenario(input), {
            name: "military-view-two-threatening-territories",
            territories: [
                {
                    ...unit("Canada", 200000),
                    patch: { ...unit("Canada", 200000).patch, fortsBuilt: 0, defenseBonus: 0 }
                },
                //Both far stronger than the garrison, so neither is a close call: what is
                //asserted is that BOTH are marked, not where the band edge sits -- that is
                //pinned in the unit suite.
                unit("United States", 2000000),
                unit("Alaska", 800000)
            ]
        });

        //The view coalesces a burst of world changes rather than rebuilding per event.
        const marksOn = async () => await page.evaluate((mapId) => {
            const doc = document.getElementById(mapId).contentDocument;
            const nameOf = (uniqueId) =>
                doc.querySelector(`path[uniqueid="${uniqueId}"]`)?.getAttribute("territory-name");
            return Array.from(doc.querySelectorAll("path[data-threat]")).map(mark => ({
                from: nameOf(mark.getAttribute("data-threat-from")),
                cap: mark.getAttribute("stroke-linecap"),
                length: mark.getTotalLength()
            }));
        }, ids.svgMap);

        await expect.poll(async () => (await marksOn()).length).toBe(2);

        const marks = await marksOn();
        expect(new Set(marks.map(mark => mark.from))).toEqual(
            new Set(["United States", "Alaska"])
        );
        for (const mark of marks) {
            expect(mark.length).toBeGreaterThan(0);
            //A ROUND CAP OVERHANGS. It extends half the stroke width past the last shared
            //anchor, along the direction the outline was heading -- which at the end of a
            //shared stretch is into the border with the next country along.
            expect(mark.cap).toBe("butt");
        }

        //Each mark is backed by a shadow clipped to the player's own outline, so the warning
        //has a side: it falls inside the territory being threatened and reaches no further.
        const shadows = await page.evaluate((mapId) => {
            const doc = document.getElementById(mapId).contentDocument;
            return Array.from(doc.querySelectorAll("path[data-threat-shadow]"))
                .map(shadow => shadow.getAttribute("clip-path"));
        }, ids.svgMap);
        expect(shadows.length).toBeGreaterThan(0);
        expect(shadows.every(clip => /^url\(#/.test(clip ?? ""))).toBe(true);

        //And the tooltip names them, because a colour cannot say WHO. The wording is not
        //asserted -- that both territories are named is the substance of the fix.
        await game.map.hover("Canada");
        const tooltip = await page.locator(containers.tooltip).innerText();
        expect(tooltip).toContain("Alaska");
        expect(tooltip).toContain("United States");
    });

    test("keeps a territory's figure when it is clicked", async ({ startedGame: game, page }) => {
        //THE BUG THIS GUARDS. SVG has no z-index: what is painted last wins. Clicking a
        //territory re-appends its path to the end of the map document -- that is how a
        //selection is raised above its neighbours -- which put the clicked territory's own
        //fill OVER the overlay, and its force figure vanished the moment you touched it.
        await game.map.setContinentView("military");
        const before = await labelsOf(page);
        expect(before.length).toBeGreaterThan(0);

        await game.map.click("France");

        expect(await labelsOf(page)).toHaveLength(before.length);
        //THE OVERLAY ROOT is what has to be last, not the military group itself: the flags are
        //a second overlay and two observers each enforcing "I am last" is a loop rather than
        //two fixes, so there is one parent kept last with the overlays ordered inside it.
        expect(await page.evaluate(([mapId, layerId]) => {
            const doc = document.getElementById(mapId).contentDocument;
            const layer = doc.getElementById(layerId);
            const root = doc.documentElement.lastElementChild;
            return Boolean(layer) && root.contains(layer) && root.id === "mapOverlayLayer";
        }, [ids.svgMap, ids.militaryLabelLayer])).toBe(true);
    });
});
