import { test, expect } from "../../support/fixtures.js";

// The continent bonus, measured end to end.
//
// docs/05-continent-bonuses.md. A country that holds EVERY territory on a continent earns
// 1.5x gold from every territory on it and holds 1.25x the oil, food and construction-
// materials capacity. All or nothing, and derived every turn from ownership rather than
// stored anywhere.
//
// WHY THESE EXIST AT ALL. Leigh's instruction, and it is the whole reason this file is not
// three lines in a checklist saying "verified in a browser": completing a continent is
// forty turns of play away, so nobody is ever going to reach it by clicking, and a mechanic
// nobody can reach is a mechanic nobody can check. The unit suite proves the arithmetic --
// `goldChangeFor()` multiplies, `effectiveCapacityFor()` derives -- and cannot prove that
// the multiplier ever arrives at a real territory in a real game. That is what is measured
// here.
//
// The instrument is `window.__game.economyFor(territory)`, which reports one territory's
// derived income and its EFFECTIVE capacities with the two multipliers in force stated
// alongside, plus the stored capacities so the "never written back" rule can be asserted
// rather than assumed. It uses a simulated context, so taking a reading changes nothing.
//
// The world is put into shape with `applyScenario()`, which writes through
// `state/mutations.js` exactly as the game does -- handing a country a whole continent is
// one write per territory and cannot produce a world the game could not have produced.

/** Every territory on `continent`, from the model rather than from the SVG. */
async function territoriesOn(page, continent) {
    return page.evaluate((name) => {
        const rows = [];
        for (let id = 0; id < 400; id += 1) {
            const territory = window.__game.territory(String(id));
            if (territory && (territory.continent ?? "Unknown") === name) {
                rows.push({ name: territory.territoryName, owner: territory.dataName });
            }
        }
        return rows;
    }, continent);
}

/** The continent with the fewest territories -- the cheapest one to hand over. */
async function smallestContinent(page) {
    const continents = await page.evaluate(() => window.__game.continents());
    return [...continents].sort((a, b) => a.total - b.total || a.continent.localeCompare(b.continent))[0];
}

/** Give every territory on `continent` to `owner`. Returns the territory names, in order. */
async function handContinentTo(game, page, continent, owner) {
    const rows = await territoriesOn(page, continent);
    const report = await page.evaluate(
        (input) =>
            window.__game.applyScenario({
                name: "whole-continent",
                territories: input.names.map((name) => ({
                    territory: name,
                    patch: { owner: input.owner, dataName: input.owner },
                })),
            }),
        { names: rows.map((row) => row.name), owner }
    );
    expect(report.errors, "the continent handover applied cleanly").toEqual([]);
    return rows.map((row) => row.name);
}

test.describe("a continent held whole", () => {
    test("pays nothing while one territory of it is still in other hands", async ({
        startedGame: game,
        page,
    }) => {
        // All or nothing is the design, and it is the half that is easy to get wrong: a
        // bonus that leaked proportionally would look right on every screen and would
        // quietly remove the reason to finish a continent at all.
        const continent = await smallestContinent(page);
        const names = await handContinentTo(game, page, continent.continent, "Player");

        // Take one back.
        await page.evaluate(
            (name) =>
                window.__game.applyScenario({
                    territories: [{ territory: name, patch: { owner: "Nowhere", dataName: "Nowhere" } }],
                }),
            names[0]
        );

        const economy = await page.evaluate(
            (name) => window.__game.economyFor(name),
            names[1]
        );
        expect(economy.bonus).toEqual({ gold: 1, capacity: 1 });
    });

    test("multiplies gold income and the three capacities on the turn it is completed", async ({
        startedGame: game,
        page,
    }) => {
        const continent = await smallestContinent(page);
        const rows = await territoriesOn(page, continent.continent);

        // A territory the player already holds, so the reading before and after is of the
        // same territory in the same hands -- the ONLY thing that changes between the two
        // readings is whether the rest of the continent is complete.
        const subject = rows.find((row) => row.owner === "Player")?.name ?? rows[0].name;
        await page.evaluate(
            (name) =>
                window.__game.applyScenario({
                    territories: [{ territory: name, patch: { owner: "Player", dataName: "Player" } }],
                }),
            subject
        );

        const before = await page.evaluate((name) => window.__game.economyFor(name), subject);
        expect(before.bonus).toEqual({ gold: 1, capacity: 1 });

        await handContinentTo(game, page, continent.continent, "Player");

        const after = await page.evaluate((name) => window.__game.economyFor(name), subject);

        expect(after.bonus).toEqual({ gold: 1.5, capacity: 1.25 });
        expect(after.income.gold).toBeCloseTo(before.income.gold * 1.5, 6);
        expect(after.capacities.oil).toBeCloseTo(before.capacities.oil * 1.25, 6);
        expect(after.capacities.food).toBeCloseTo(before.capacities.food * 1.25, 6);
        expect(after.capacities.consMats).toBeCloseTo(before.capacities.consMats * 1.25, 6);
    });

    test("raises the ceiling and never the stored capacity", async ({
        startedGame: game,
        page,
    }) => {
        // The trap `effectiveCapacityFor()` exists to avoid. Writing the bonus into the
        // stored capacity would need an exact inverse write when the continent is lost, the
        // two would disagree the first time any path forgot, and a player would keep a bonus
        // for a continent they no longer held -- silently, because nothing in the game
        // compares a stored capacity against what it should be.
        const continent = await smallestContinent(page);
        const names = await handContinentTo(game, page, continent.continent, "Player");

        const economy = await page.evaluate((name) => window.__game.economyFor(name), names[0]);
        const stored = await page.evaluate((name) => {
            const territory = window.__game.territory(name);
            return {
                oil: territory.oilCapacity,
                food: territory.foodCapacity,
                consMats: territory.consMatsCapacity,
            };
        }, names[0]);

        expect(economy.storedCapacities).toEqual(stored);
        expect(economy.capacities.oil).toBeCloseTo(stored.oil * 1.25, 6);
        expect(economy.capacities.oil).toBeGreaterThan(stored.oil);
    });

    test("withdraws the bonus the moment one territory is lost", async ({
        startedGame: game,
        page,
    }) => {
        // Derived, so losing the continent is simply the next answer. No grace period, no
        // ramp, and -- the point -- nothing to remember to undo.
        const continent = await smallestContinent(page);
        const names = await handContinentTo(game, page, continent.continent, "Player");

        const held = await page.evaluate((name) => window.__game.economyFor(name), names[1]);
        expect(held.bonus.gold).toBe(1.5);

        await page.evaluate(
            (name) =>
                window.__game.applyScenario({
                    territories: [{ territory: name, patch: { owner: "Nowhere", dataName: "Nowhere" } }],
                }),
            names[0]
        );

        const lost = await page.evaluate((name) => window.__game.economyFor(name), names[1]);
        expect(lost.bonus).toEqual({ gold: 1, capacity: 1 });
        expect(lost.income.gold).toBeCloseTo(held.income.gold / 1.5, 6);
    });

    test("pays an AI country exactly as it pays the player", async ({
        startedGame: game,
        page,
    }) => {
        // The player and the AI fight the same battle; they run the same economy too. An
        // asymmetric bonus would make every measurement taken with `tools/ai-sim.mjs` a
        // measurement of a different game from the one being played.
        const continent = await smallestContinent(page);
        const names = await handContinentTo(game, page, continent.continent, "Sealand");

        const economy = await page.evaluate((name) => window.__game.economyFor(name), names[0]);
        expect(economy.owner).toBe("Sealand");
        expect(economy.bonus).toEqual({ gold: 1.5, capacity: 1.25 });
    });

    test("survives a save and a load with nothing about it in the snapshot", async ({
        startedGame: game,
        page,
    }) => {
        // Nothing about the bonus is saved, because there is nothing to save: it is a
        // function of who owns what, and who owns what is already in the snapshot.
        const continent = await smallestContinent(page);
        const names = await handContinentTo(game, page, continent.continent, "Player");

        const before = await page.evaluate((name) => window.__game.economyFor(name), names[0]);
        expect(before.bonus.gold).toBe(1.5);

        //`saveCode()` / `loadCode()` are the save panel's two buttons without the panel,
        //which is the shortest real round trip a spec can take.
        const code = await page.evaluate(() => window.__game.saveCode());
        expect(code, "a save code was produced").toBeTruthy();
        await page.evaluate((saved) => window.__game.loadCode(saved), code);

        const after = await page.evaluate((name) => window.__game.economyFor(name), names[0]);
        expect(after.bonus).toEqual(before.bonus);
        expect(after.capacities).toEqual(before.capacities);
    });
});

test.describe("the continent walk the rule reads", () => {
    test("reports six continents whose sizes sum to the whole map", async ({
        startedGame: game,
        page,
    }) => {
        // The sizes are NOT the SVG's. A territory's continent comes from its original
        // owner's row in `initialData.js`, so Easter Island -- filed under Oceania by the
        // path attribute and owned by Chile -- counts towards South America. This asserts
        // the model's own arithmetic rather than a number copied from the map data, which
        // is the only version that could ever be checked against the bonus.
        const continents = await page.evaluate(() => window.__game.continents());

        expect(continents).toHaveLength(6);
        expect(continents.reduce((sum, row) => sum + row.total, 0)).toBe(359);
        expect(continents.every((row) => row.total > 0)).toBe(true);
    });

    test("names nobody as holding a continent outright at the start of a game", async ({
        startedGame: game,
        page,
    }) => {
        // 207 countries on 359 territories: if any continent began the game complete, the
        // bonus would be an opening gift rather than an objective.
        const continents = await page.evaluate(() => window.__game.continents());

        expect(continents.map((row) => row.heldOutrightBy)).toEqual([null, null, null, null, null, null]);
    });

    test("names the holder once a continent is complete, and stops naming them when it is not", async ({
        startedGame: game,
        page,
    }) => {
        const continent = await smallestContinent(page);
        const names = await handContinentTo(game, page, continent.continent, "Player");

        const held = await page.evaluate(() => window.__game.continents());
        expect(held.find((row) => row.continent === continent.continent).heldOutrightBy).toBe("Player");

        await page.evaluate(
            (name) =>
                window.__game.applyScenario({
                    territories: [{ territory: name, patch: { owner: "Nowhere", dataName: "Nowhere" } }],
                }),
            names[0]
        );

        const broken = await page.evaluate(() => window.__game.continents());
        expect(broken.find((row) => row.continent === continent.continent).heldOutrightBy).toBeNull();
    });
});
