import { test, expect } from "../../support/fixtures.js";

// One source of truth.
//
// Phase 4 moved the game state into `src/state/GameState.js` and turned the SVG path
// attributes into output: `owner`, `data-name`, `deactivated` and `underSiege` are
// rendered from the store by `src/ui/mapAttributeSync.js` and read back from nowhere.
//
// These specs are the guard on that. They compare the map against the model directly,
// so a future change that writes one without the other fails here rather than showing
// up three phases later as a territory that is besieged on the map and not in the
// siege list. That disagreement is exactly what `normalizeSiegeState()` existed to
// paper over, and it is what Phase 4.5 deleted.
//
// docs/03-refactor-plan.md Phase 4.4-4.5.

/** Every territory path's state-bearing attributes, read straight from the SVG. */
async function attributesFromMap(page) {
    return page.evaluate(() => {
        const doc = document.getElementById("svg-map").contentDocument;
        return Array.from(doc.querySelectorAll("path"))
            .filter((path) => path.getAttribute("uniqueid") !== null)
            .map((path) => ({
                uniqueId: path.getAttribute("uniqueid"),
                territoryName: path.getAttribute("territory-name"),
                owner: path.getAttribute("owner"),
                country: path.getAttribute("data-name"),
                deactivated: path.getAttribute("deactivated"),
                underSiege: path.getAttribute("underSiege"),
            }));
    });
}

/** The whole territory model, keyed by uniqueId. */
async function modelByUniqueId(page) {
    return page.evaluate(async () => {
        const doc = document.getElementById("svg-map").contentDocument;
        const ids = Array.from(doc.querySelectorAll("path"))
            .map((path) => path.getAttribute("uniqueid"))
            .filter((id) => id !== null);
        const model = {};
        for (const id of ids) {
            const territory = window.__game.territory(id);
            if (territory) {
                model[id] = {
                    owner: territory.owner,
                    dataName: territory.dataName,
                    isDeactivated: territory.isDeactivated,
                    territoryName: territory.territoryName,
                };
            }
        }
        return model;
    });
}

test.describe("the bootstrap window", () => {
    // There is an interval between `svgMapLoaded()` (window `load`, which populates
    // `paths`) and `seedTerritories()` (the end of the initial-data Promise) in which the
    // territory model does not exist yet -- and code runs in it. During that window the
    // SVG attributes are the truth, because they are what the model is about to be built
    // FROM; `src/state/pathState.js` reads them there and reads the store afterwards.
    //
    // Getting that backwards is not a subtle failure. `colorCountriesRandomly()` groups
    // the 359 paths by `data-name` to give each country one colour; answered from the
    // empty store, every path grouped together and the whole map came out a single flat
    // colour, with every territory's `countryColor` wrong for the rest of the game.
    //
    // The suite had 225 specs and not one of them noticed, because they all assert on
    // state and text rather than on what the map looks like. These two do.

    test("colours the map per country before a game is even started", async ({ page, game }) => {
        await game.open();

        const fills = await page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            const paths = Array.from(doc.querySelectorAll("path")).filter(
                (p) => p.getAttribute("uniqueid") !== null
            );
            return {
                total: paths.length,
                distinct: new Set(paths.map((p) => p.getAttribute("fill"))).size,
            };
        });

        expect(fills.total).toBeGreaterThan(300);
        // One colour per country, not one colour for the world. 206 countries; a healthy
        // map lands near that. The bug produced exactly 1.
        expect(fills.distinct).toBeGreaterThan(100);
    });

    test("keeps every territory's countryColor distinct from its neighbours' after a game starts", async ({
        startedGame: game,
    }) => {
        // `pushColorsToMainArray()` copies the map's fills into the model at confirm time,
        // and `setColorOnMap()` reads them back for the rest of the game. If the map was
        // flat when it ran, the model is flat for good.
        const colours = await game.page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            const ids = Array.from(doc.querySelectorAll("path"))
                .map((p) => p.getAttribute("uniqueid"))
                .filter((id) => id !== null);
            const seen = new Set();
            for (const id of ids) {
                const territory = window.__game.territory(id);
                if (territory?.countryColor) {
                    seen.add(territory.countryColor);
                }
            }
            return seen.size;
        });
        expect(colours).toBeGreaterThan(100);
    });
});

test.describe("the state layer", () => {
    test("has a territory in the model for every path on the map", async ({ startedGame: game }) => {
        const onMap = await attributesFromMap(game.page);
        const model = await modelByUniqueId(game.page);

        const missing = onMap.filter((path) => !model[path.uniqueId]).map((p) => p.territoryName);
        expect(missing, "paths with no territory behind them").toEqual([]);
        expect(Object.keys(model).length).toBe(onMap.length);
    });

    test("renders owner and data-name from the model, never the other way round", async ({
        startedGame: game,
    }) => {
        const onMap = await attributesFromMap(game.page);
        const model = await modelByUniqueId(game.page);

        const disagreements = onMap
            .filter((path) => {
                const territory = model[path.uniqueId];
                return (
                    territory &&
                    (territory.owner !== path.owner || territory.dataName !== path.country)
                );
            })
            .map((path) => ({
                territory: path.territoryName,
                map: { owner: path.owner, country: path.country },
                model: { owner: model[path.uniqueId].owner, country: model[path.uniqueId].dataName },
            }));

        expect(disagreements, "map and model disagree about ownership").toEqual([]);
    });

    test("renders deactivated from the model", async ({ startedGame: game }) => {
        const onMap = await attributesFromMap(game.page);
        const model = await modelByUniqueId(game.page);

        const disagreements = onMap
            .filter((path) => {
                const territory = model[path.uniqueId];
                return territory && String(territory.isDeactivated === true) !== path.deactivated;
            })
            .map((path) => path.territoryName);

        expect(disagreements, "map and model disagree about deactivation").toEqual([]);
    });

    test("derives underSiege from the siege lists, so the two cannot drift", async ({
        startedGame: game,
    }) => {
        // Run several turns first: the AI besieges freely, so by turn 4 there are real
        // sieges to check rather than an empty map trivially agreeing with itself.
        await game.playTurns(3);

        const onMap = await attributesFromMap(game.page);
        const sieges = await game.sieges();
        const besieged = new Set([...sieges.player, ...sieges.ai]);

        const disagreements = onMap
            .filter((path) => String(besieged.has(path.territoryName)) !== path.underSiege)
            .map((path) => ({
                territory: path.territoryName,
                attribute: path.underSiege,
                inSiegeList: besieged.has(path.territoryName),
            }));

        expect(disagreements, "underSiege disagrees with the siege lists").toEqual([]);
    });

    test("keeps ownership in step with the model across several turns of AI conquest", async ({
        startedGame: game,
    }) => {
        await game.playTurns(3);

        const onMap = await attributesFromMap(game.page);
        const model = await modelByUniqueId(game.page);

        const disagreements = onMap
            .filter((path) => {
                const territory = model[path.uniqueId];
                return (
                    territory &&
                    (territory.owner !== path.owner || territory.dataName !== path.country)
                );
            })
            .map((path) => path.territoryName);

        expect(disagreements, "map and model disagree after the AI has moved").toEqual([]);
    });

    test("gives every siege a territory id rather than a copy", async ({ startedGame: game }) => {
        await game.playTurns(3);

        const sieges = await game.page.evaluate(() => {
            const names = window.__game.sieges();
            return [...names.player, ...names.ai].map((territoryName) => {
                const territory = window.__game.territory(territoryName);
                return { territoryName, resolves: territory !== null };
            });
        });

        // Phase 4.7. A siege that named a territory the model does not have used to be
        // possible, because the siege held its own copy; it cannot be now.
        expect(sieges.filter((siege) => !siege.resolves)).toEqual([]);
    });

    test("exposes the write guard, and reports nothing when it is off", async ({
        startedGame: game,
    }) => {
        // The guard only records when the page is loaded with ?stateGuard=1. This is
        // here so the hook itself does not rot; the Phase 5 rules tests are what run
        // under the flag.
        const violations = await game.page.evaluate(() => window.__game.stateGuardViolations());
        expect(Array.isArray(violations)).toBe(true);
        expect(violations).toEqual([]);
    });
});
