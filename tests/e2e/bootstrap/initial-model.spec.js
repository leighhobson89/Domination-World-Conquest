import { test, expect } from "../../support/fixtures.js";
import { territoryNames } from "../../support/territories.js";
import { dataTableCountriesInitialState } from "../../../initialData.js";

const devIndices = dataTableCountriesInitialState.map((country) => country.dev_index);
const DEV_INDEX_MIN = Math.min(...devIndices);
const DEV_INDEX_MAX = Math.max(...devIndices);

// The territory model as built, asserted through window.__game rather than the
// DOM: the numeric truth of this game lives in mainGameArray, not in a
// KMB-formatted table cell.
//
// docs/04-e2e-test-plan.md section 5.1.

const EXPECTED_TERRITORIES = 359;

// calculatePathAreas() scales the sampled polygon areas so they sum to the real
// land area of the Earth. The precomputed resources/pathAreas.json carries the
// same scaling, so the total is a cheap integrity check on both paths.
const TOTAL_LAND_AREA_KM2 = 136_067_649;

test.describe("the initial territory model", () => {
    test("holds one entry per territory on the map", async ({ startedGame: game }) => {
        const found = await game.state(
            (names) => names.filter((name) => window.__game.territory(name) !== null).length,
            territoryNames
        );
        expect(found).toBe(EXPECTED_TERRITORIES);
    });

    test("owns each territory by 'Player' or by its country, never by nothing", async ({
        startedGame: game,
    }) => {
        // There is no "Ai" owner: an AI territory is owned by the country name
        // itself. Only the player's territories carry the literal "Player".
        const report = await game.state((names) => {
            let player = 0;
            const unowned = [];
            for (const name of names) {
                const t = window.__game.territory(name);
                if (!t) continue;
                if (t.owner === "Player") player += 1;
                else if (!t.owner) unowned.push(name);
            }
            return { player, unowned: unowned.slice(0, 10) };
        }, territoryNames);

        expect(report.unowned).toEqual([]);
        expect(report.player).toBeGreaterThan(0);
    });

    test("gives every territory a non-zero area, population and army", async ({
        startedGame: game,
    }) => {
        const bad = await game.state((names) => {
            const problems = [];
            for (const name of names) {
                const t = window.__game.territory(name);
                if (!t) {
                    problems.push(`${name}: missing`);
                    continue;
                }
                if (!(t.area > 0)) problems.push(`${name}: area ${t.area}`);
                if (!(t.territoryPopulation > 0)) {
                    problems.push(`${name}: population ${t.territoryPopulation}`);
                }
                if (!(t.armyForCurrentTerritory >= 0)) {
                    problems.push(`${name}: army ${t.armyForCurrentTerritory}`);
                }
            }
            return problems.slice(0, 10);
        }, territoryNames);

        expect(bad).toEqual([]);
    });

    test("gives every territory a devIndex drawn from its country's data", async ({
        startedGame: game,
    }) => {
        // The e2e plan quotes 0.4-0.95; the shipped data is 0.326 (Somalia) to
        // 0.962 (Switzerland), so the bound is taken from initialData.js -- the
        // actual source -- rather than from the prose.
        const range = await game.state((names) => {
            const values = names
                .map((name) => window.__game.territory(name))
                .filter(Boolean)
                .map((t) => t.devIndex);
            return { min: Math.min(...values), max: Math.max(...values), count: values.length };
        }, territoryNames);

        expect(range.count).toBe(EXPECTED_TERRITORIES);
        expect(range.min).toBeGreaterThanOrEqual(DEV_INDEX_MIN);
        expect(range.max).toBeLessThanOrEqual(DEV_INDEX_MAX);
    });

    test("sums the territory areas to the land area of the Earth", async ({
        startedGame: game,
    }) => {
        const total = await game.state(
            (names) =>
                names
                    .map((name) => window.__game.territory(name))
                    .filter(Boolean)
                    .reduce((sum, t) => sum + t.area, 0),
            territoryNames
        );
        expect(total).toBeGreaterThan(TOTAL_LAND_AREA_KM2 * 0.99);
        expect(total).toBeLessThan(TOTAL_LAND_AREA_KM2 * 1.01);
    });

    test("holds no NaN in any numeric territory field", async ({ startedGame: game }) => {
        const nans = await game.state((names) => {
            const problems = [];
            for (const name of names) {
                const t = window.__game.territory(name);
                if (!t) continue;
                for (const [key, value] of Object.entries(t)) {
                    if (typeof value === "number" && !Number.isFinite(value)) {
                        problems.push(`${name}.${key} = ${value}`);
                    }
                }
            }
            return problems.slice(0, 10);
        }, territoryNames);

        expect(nans).toEqual([]);
    });

    test("keeps territoryName stable and dataName as the current owner", async ({
        startedGame: game,
    }) => {
        // dataName is the CURRENT owning country and changes on conquest;
        // territoryName is the stable identity; originalOwner is historical. At
        // turn 1 all three agree for the player's own territories.
        const germany = await game.territory("Germany");
        expect(germany.territoryName).toBe("Germany");
        expect(germany.dataName).toBe("Germany");
        expect(germany.originalOwner).toBe("Germany");
        expect(germany.owner).toBe("Player");
    });

    test("resolves every territory name from the SVG through the state hook", async ({
        startedGame: game,
    }) => {
        // tests/uniqueIdLookup.json is generated from resources/svgMaster.svg and
        // has drifted from it before. If this fails, regenerate it rather than
        // editing either by hand.
        const missing = await game.state(
            (names) => names.filter((name) => window.__game.territory(name) === null),
            territoryNames
        );
        expect(missing).toEqual([]);
    });
});
