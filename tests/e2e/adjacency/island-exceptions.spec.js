import { test, expect } from "../../support/fixtures.js";

// Regression coverage for docs/01-codebase-audit.md section 3.1.
//
// The manual island adjacency rules used to be built inside a
// `setTimeout(..., 1000)` before a dynamic import of resourceCalculations.js. If
// the territory model was not ready within that second, every id lookup returned
// undefined, the whole Map collapsed to a single `undefined` key, and every rule
// below silently stopped applying -- non-deterministically, per machine and load.
//
// These assert the rules actually take effect in the running game.

test.describe("manual island adjacency", () => {
    test.beforeEach(async ({ game }) => {
        await game.start({ country: "Germany" });
    });

    test("the exception table is fully populated, with no undefined keys", async ({ game }) => {
        const table = await game.state(() => window.__game.adjacencyExceptions());
        // 69 since Greenland gained the second Atlantic door -- see the test below.
        expect(Object.keys(table).length).toBe(69);
        expect(Object.keys(table)).not.toContain("undefined");
    });

    // THE SECOND ATLANTIC DOOR, asserted end-to-end because it is a deliberate change to
    // the map's strategic geography rather than a repair. Greenland <-> Iceland was the ONLY
    // crossing between Europe and North America, and Greenland had two neighbours in the
    // whole game -- which made North America a cul-de-sac under a goal asking for three
    // continents. See docs/archived/06-force-and-succession.md section 7.6 and known-issue BO.
    test("Greenland reaches Europe through Svalbard as well as Iceland", async ({ game }) => {
        const fromGreenland = await game.state(() => window.__game.interactableFrom("Greenland"));
        expect(fromGreenland).toEqual(
            expect.arrayContaining(["Svalbard", "Iceland", "Ellesmere Island"])
        );

        const fromSvalbard = await game.state(() => window.__game.interactableFrom("Svalbard"));
        expect(fromSvalbard).toContain("Greenland");
    });

    // The terrain drop that shipped with the door. It is asserted as the BONUS the model
    // built rather than as the SVG attribute, because the attribute is input and the bonus
    // is what every combat rule reads -- and because 20 is under the 25 the dice bands use,
    // which is the whole point of choosing 2 rather than 3 or 4 (archived docs/06 section 7.5).
    test("Greenland and Iceland are terrain 2, which is under the dice band", async ({ game }) => {
        const terrain = await game.state(() => ({
            greenland: window.__game.territory("Greenland").mountainDefenseBonus,
            iceland: window.__game.territory("Iceland").mountainDefenseBonus
        }));
        expect(terrain.greenland).toBe(20);
        expect(terrain.iceland).toBe(20);
    });

    test("Fiji 2 can reach Vanuatu 2 and both New Caledonia territories", async ({ game }) => {
        const reachable = await game.state(() => window.__game.interactableFrom("Fiji 2"));
        expect(reachable).toEqual(
            expect.arrayContaining(["Vanuatu 2", "New Caledonia 2", "New Caledonia 3"])
        );
    });

    test("Vanuatu 1 can reach Fiji 1 and Solomon Islands 6", async ({ game }) => {
        const reachable = await game.state(() => window.__game.interactableFrom("Vanuatu 1"));
        expect(reachable).toEqual(expect.arrayContaining(["Fiji 1", "Solomon Islands 6"]));
    });

    // "Grand Bahama (Bahamas)" is the real territory-name in svgMaster.svg,
    // parentheses included. It looks like a typo and is not.
    test("Grand Bahama (Bahamas) connects to Bermuda and the US", async ({ game }) => {
        const fromGrandBahama = await game.state(() =>
            window.__game.interactableFrom("Grand Bahama (Bahamas)")
        );
        expect(fromGrandBahama).toEqual(expect.arrayContaining(["Bermuda", "United States"]));

        const fromBermuda = await game.state(() => window.__game.interactableFrom("Bermuda"));
        expect(fromBermuda).toContain("Grand Bahama (Bahamas)");
    });

    // Regression: "New Caledonia 1" was a duplicate Map key; the second entry
    // overwrote the first, losing these two links.
    test("New Caledonia 1 keeps its King Island and Fraser Island links", async ({ game }) => {
        const reachable = await game.state(() => window.__game.interactableFrom("New Caledonia 1"));
        expect(reachable).toEqual(
            expect.arrayContaining(["King Island", "Fraser Island", "New Zealand North Island"])
        );
    });

    test("denials are applied: the UK cannot reach Luxembourg", async ({ game }) => {
        const fromUk = await game.state(() => window.__game.interactableFrom("United Kingdom"));
        expect(fromUk).not.toContain("Luxembourg");
        const fromLux = await game.state(() => window.__game.interactableFrom("Luxembourg"));
        expect(fromLux).not.toContain("United Kingdom");
    });

    test("Laos and Hainan Island deny each other", async ({ game }) => {
        expect(await game.state(() => window.__game.interactableFrom("Laos"))).not.toContain(
            "Hainan Island"
        );
        expect(
            await game.state(() => window.__game.interactableFrom("Hainan Island"))
        ).not.toContain("Laos");
    });

    test("the Bahamas territories keep their neighbours", async ({ game }) => {
        for (const name of ["Grand Bahama (Bahamas)", "Andros Island (Bahamas)"]) {
            const reachable = await game.state(
                (territoryName) => window.__game.interactableFrom(territoryName),
                name
            );
            expect(reachable.length, `${name} has no neighbours`).toBeGreaterThan(0);
            expect(reachable, `${name} reaches itself`).not.toContain(name);
        }
    });

    test("no territory is stranded with zero interactable neighbours", async ({ game }) => {
        const stranded = await game.state(() => window.__game.strandedTerritories());
        expect(stranded).toEqual([]);
    });
});
