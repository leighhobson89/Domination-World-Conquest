import { test, expect } from "../../support/fixtures.js";
import { upgradePriceFor } from "../../../src/rules/economy/upgrades.js";

// Upgrades, end to end: the price the player is SHOWN is the price the player is CHARGED, and
// an upgrade the AI buys actually raises a ceiling.
//
// docs/05-economy-audit.md, economy stage 1. Two of the phase's four defects are invisible to
// the unit suite by construction, because in both cases each half is correct on its own:
//
//   E4  `calculateAvailableUpgrades()` priced every upgrade as a FIRST one -- no quadratic
//       term -- floored by a module-level cache belonging to whichever upgrade table had been
//       rendered last. `incrementDecrementUpgrades()` charged the real ladder price. Both
//       formulas were individually right about something; they were right about different
//       things, and only opening the window on a territory that already has buildings shows it.
//   E1  An AI country's upgrades raised no capacity at all, because the only upgrade-driven
//       capacity write in the codebase was on the player's confirm path. A unit test of
//       `applyUpgrade()` cannot see that, because the defect was that nothing CALLED it.
//
// Both are wiring faults, and a wiring fault is what the end-to-end suite is for.

/**
 * Every territory in the world, as the store has it, plus whether it is under siege.
 *
 * The siege flag is not incidental. A siege is the ONE other thing in the game that writes a
 * capacity: `siegeDamageFor()` grinds `foodCapacity` down by a collateral percentage every
 * tick, and when the siege ends `calculateTerritoryResourceIncomesEachTurn()` restores it to
 * the figure recorded when the war began. So over any window that contains a siege, a
 * territory's food ceiling moves for reasons that have nothing to do with what it built --
 * which is exactly what the first version of this spec tripped over, on Austria, and it is a
 * confound rather than a defect.
 */
async function allTerritories(page) {
    return page.evaluate(() => {
        const siegeLists = window.__game.sieges() ?? { player: [], ai: [] };
        const besieged = new Set([
            ...(siegeLists.player ?? []),
            ...(siegeLists.ai ?? [])
        ].map((entry) => (typeof entry === "string" ? entry : entry?.territoryName)));

        const rows = [];
        for (let id = 0; id < 400; id += 1) {
            const territory = window.__game.territory(String(id));
            if (!territory) {
                continue;
            }
            rows.push({
                id: String(id),
                name: territory.territoryName,
                owner: territory.dataName,
                besieged: besieged.has(territory.territoryName),
                farmsBuilt: territory.farmsBuilt,
                forestsBuilt: territory.forestsBuilt,
                oilWellsBuilt: territory.oilWellsBuilt,
                fortsBuilt: territory.fortsBuilt,
                foodCapacity: territory.foodCapacity,
                consMatsCapacity: territory.consMatsCapacity,
                oilCapacity: territory.oilCapacity,
                defenseBonus: territory.defenseBonus
            });
        }
        return rows;
    });
}

/**
 * Play `turns` turns, reading the whole world after each one.
 *
 * Turn by turn rather than start-and-end, because the question is "did THIS purchase raise
 * THIS ceiling" and a window of eight turns can contain a conquest, a siege beginning and the
 * same siege ending -- each of which moves a capacity on its own.
 */
async function worldEachTurn(page, game, turns) {
    const samples = [await allTerritories(page)];
    for (let turn = 0; turn < turns; turn += 1) {
        await game.playTurn();
        samples.push(await allTerritories(page));
    }
    return samples;
}

/**
 * Every (before, after) pair of consecutive turns in which a territory can be held to account:
 * same owner, and not under siege at either end.
 */
function* comparableSteps(samples) {
    for (let i = 1; i < samples.length; i += 1) {
        const before = new Map(samples[i - 1].map((row) => [row.id, row]));
        for (const after of samples[i]) {
            const was = before.get(after.id);
            if (!was || was.owner !== after.owner || was.besieged || after.besieged) {
                continue;
            }
            yield [was, after];
        }
    }
}

/** The gold and cons-mats cells of one upgrade row, as the player reads them. */
async function displayedCost(game, building) {
    const row = game.upgradeWindow.row(building);
    const cells = row.locator(".upgrade-column");
    return {
        gold: Number(await cells.nth(3).innerText()),
        consMats: Number(await cells.nth(4).innerText())
    };
}

test.describe("the price shown is the price charged", () => {
    test("a territory with farms standing is quoted the NEXT farm, not a first one", async ({ page, game }) => {
        await game.start({ country: "Germany" });
        await game.loadScenario("upgraded-territory");

        const before = await game.territory("Germany");
        expect(before.farmsBuilt, "the scenario is what makes this test meaningful").toBe(3);

        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");

        const expected = upgradePriceFor("farm", 4, before.devIndex);
        expect(await displayedCost(game, "farm")).toEqual(expected);

        // E4: the fourth farm is roughly sixteen times a first. If the window is quoting a
        // first, this is the assertion that says so rather than "a number was wrong".
        const asAFirst = upgradePriceFor("farm", 1, before.devIndex);
        expect(expected.gold).toBeGreaterThan(asAFirst.gold * 10);
    });

    test("confirming debits exactly what the window totalled", async ({ page, game }) => {
        await game.start({ country: "Germany" });
        await game.loadScenario("upgraded-territory");

        const before = await game.territory("Germany");
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");

        const totals = await game.upgradeWindow.totals();
        expect(totals.gold).toBe(upgradePriceFor("farm", 4, before.devIndex).gold);

        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        expect(after.farmsBuilt).toBe(4);
        expect(after.goldForCurrentTerritory).toBeCloseTo(
            before.goldForCurrentTerritory - totals.gold, 6);
        expect(after.consMatsForCurrentTerritory).toBeCloseTo(
            before.consMatsForCurrentTerritory - totals.consMats, 6);
    });

    test("a farm raises the food ceiling by a tenth, and touches no other ceiling", async ({ page, game }) => {
        await game.start({ country: "Germany" });
        await game.loadScenario("upgraded-territory");

        const before = await game.territory("Germany");
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("farm");
        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        expect(after.foodCapacity).toBeCloseTo(before.foodCapacity * 1.1, 4);
        expect(after.oilCapacity).toBeCloseTo(before.oilCapacity, 6);
        expect(after.consMatsCapacity).toBeCloseTo(before.consMatsCapacity, 6);
    });

    test("a fort raises the defence bonus the battle reads", async ({ page, game }) => {
        await game.start({ country: "Germany" });
        await game.loadScenario("upgraded-territory");

        const before = await game.territory("Germany");
        await game.openUpgrade("Germany");
        await game.upgradeWindow.plus("fort");
        await game.upgradeWindow.submit();

        const after = await game.territory("Germany");
        expect(after.fortsBuilt).toBe(before.fortsBuilt + 1);
        expect(after.defenseBonus).toBeGreaterThan(before.defenseBonus);
        // Forts are the economy's only direct line into the dice: `DIE_MODIFIERS.fortification`
        // bands the raw bonus and takes a die off the attacker at 25.
        expect(after.foodCapacity).toBeCloseTo(before.foodCapacity, 6);
    });
});

test.describe("an AI country receives what it pays for", () => {
    // audit E1 and E2, measured through the game rather than through the rule. The AI buys
    // upgrades on almost every turn; before stage 1 not one of them raised a ceiling, and not
    // one fort recomputed a defence bonus.
    test("every AI upgrade bought over eight turns raised the ceiling it acts on", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "ai-upgrades" });
        const samples = await worldEachTurn(page, game, 8);

        const pairs = [
            { built: "farmsBuilt", capacity: "foodCapacity" },
            { built: "forestsBuilt", capacity: "consMatsCapacity" },
            { built: "oilWellsBuilt", capacity: "oilCapacity" }
        ];

        let upgradesSeen = 0;
        const stalled = [];
        for (const [was, now] of comparableSteps(samples)) {
            for (const pair of pairs) {
                if (now[pair.built] <= was[pair.built]) {
                    continue;
                }
                upgradesSeen += 1;
                if (now[pair.capacity] <= was[pair.capacity]) {
                    stalled.push(`${now.name} (${now.owner}): ${pair.built} ` +
                        `${was[pair.built]} -> ${now[pair.built]} but ${pair.capacity} ` +
                        `${Math.round(was[pair.capacity])} -> ${Math.round(now[pair.capacity])}`);
                }
            }
        }

        expect(upgradesSeen, "the AI must actually be buying upgrades for this to mean anything")
            .toBeGreaterThan(0);
        expect(stalled.slice(0, 10), "audit E1: an AI upgrade that raised no ceiling").toEqual([]);
    });

    test("every AI fort bought over eight turns raised its defence bonus", async ({ page, game }) => {
        await game.start({ country: "Germany", seed: "ai-forts" });
        const samples = await worldEachTurn(page, game, 8);

        let fortsSeen = 0;
        const stalled = [];
        for (const [was, now] of comparableSteps(samples)) {
            if (now.fortsBuilt <= was.fortsBuilt) {
                continue;
            }
            fortsSeen += 1;
            if (now.defenseBonus <= was.defenseBonus) {
                stalled.push(`${now.name} (${now.owner}): fortsBuilt ${was.fortsBuilt} -> ` +
                    `${now.fortsBuilt} but defenseBonus stayed at ${now.defenseBonus}`);
            }
        }

        expect(fortsSeen, "the AI must actually be building forts for this to mean anything")
            .toBeGreaterThan(0);
        expect(stalled.slice(0, 10), "audit E2: an AI fort that moved no defence bonus").toEqual([]);
    });

    test("no country ever exceeds the five-fort cap", async ({ page, game }) => {
        // audit E2's fourth error: `fortsBuilt` was incremented AFTER the build loop, so the
        // `< maxForts` guard read a stale count and one turn could carry a territory past it.
        await game.start({ country: "Germany", seed: "fort-cap" });
        for (let turn = 0; turn < 8; turn += 1) {
            await game.playTurn();
        }
        const over = (await allTerritories(page))
            .filter((row) => row.fortsBuilt > 5)
            .map((row) => `${row.name}: ${row.fortsBuilt}`);
        expect(over).toEqual([]);
    });
});
