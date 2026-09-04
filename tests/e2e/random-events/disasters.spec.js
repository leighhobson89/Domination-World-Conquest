import { test, expect } from "../../support/fixtures.js";
import { RANDOM_EVENTS, randomEventLikelihood } from "../../../src/config/balance.js";

// The four disasters, and the rising chance of one.
// docs/03-e2e-test-plan.md section 5.14.
//
// A random event cannot be reached by clicking and cannot be reached by seeding either: it
// is a band on the MEAN of five draws, so no seed puts a chosen disaster on a chosen turn,
// and the scenario loader sets up the world rather than the turn. `__game.forceRandomEvent()`
// is the ?e2e=1 hook that queues one for the next turn. Without it these four events could
// only be tested as pure functions, and what the GAME does with one -- halving food,
// suppressing that turn's regeneration -- would go untested entirely.
//
// The arithmetic itself is a unit test (`tests/unit/rules-economy.spec.js` and
// `src/rules/events/randomEvents.js`); what is asserted here is that the event reaches the
// world at all, and that it reaches the RIGHT resource.

/** Every player-owned territory's numbers, keyed by name. */
async function playerSnapshot(game) {
    const owned = await game.playerTerritories();
    return Object.fromEntries(
        owned.map((t) => [
            t.territoryName,
            {
                food: t.foodForCurrentTerritory,
                oil: t.oilForCurrentTerritory,
                consMats: t.consMatsForCurrentTerritory,
                gold: t.goldForCurrentTerritory,
            },
        ])
    );
}

test.describe("random events", () => {
    test.setTimeout(300_000);

    test("the chance of one rises with every quiet turn", async ({ startedGame: game, page }) => {
        // It starts at zero and climbs a point per turn, and a fired event resets it.
        const chance = () => page.evaluate(() => window.__game.randomEventProbability());

        const first = await chance();
        await game.playTurn();
        const second = await chance();
        await game.playTurn();
        const third = await chance();

        expect(second).toBeGreaterThan(first);
        expect(third).toBeGreaterThan(second);
        expect(third - second).toBe(randomEventLikelihood.incrementPerQuietTurn);
    });

    test("a fired event resets the chance to zero", async ({ startedGame: game, page }) => {
        await game.playTurn();
        await game.playTurn();
        expect(await page.evaluate(() => window.__game.randomEventProbability())).toBeGreaterThan(
            0
        );

        await page.evaluate(() => window.__game.forceRandomEvent("Mutiny"));
        await game.playTurn();

        expect(
            await page.evaluate(() => window.__game.randomEventProbability()),
            "a disaster resets the counter"
        ).toBe(randomEventLikelihood.startingProbabilityPercent);
    });

    test("only the four shipped disasters can be queued", async ({ startedGame: game, page }) => {
        // audit 5.2 Q was a fifth NAME that nothing produced: the construction-materials
        // handler tested for "Forest Fire", which `selectRandomEvent()` never returns, so one
        // of the four disasters silently did nothing -- and worse than nothing, because the
        // turn's regeneration was suppressed anyway. There is one list now.
        expect(RANDOM_EVENTS).toEqual([
            "Food Disaster",
            "Oil Well Fire",
            "Warehouse Fire",
            "Mutiny",
        ]);

        const rejected = await page.evaluate(() => {
            try {
                window.__game.forceRandomEvent("Forest Fire");
                return null;
            } catch (error) {
                return error.message;
            }
        });
        expect(rejected, "the name audit 5.2 Q tested for is not an event").toContain(
            "Forest Fire"
        );
    });

    for (const { event, resource } of [
        { event: "Food Disaster", resource: "food" },
        { event: "Oil Well Fire", resource: "oil" },
        { event: "Warehouse Fire", resource: "consMats" },
        { event: "Mutiny", resource: "gold" },
    ]) {
        test(`${event} takes ${resource} from at least one territory`, async ({ game, page }) => {
            // Japan: five territories, so "the affected ones lose it and the rest do not" is
            // a real distinction rather than a single-territory tautology.
            await game.start({ country: "Hokkaido", seed: `event-${resource}` });

            const before = await playerSnapshot(game);
            await page.evaluate((name) => window.__game.forceRandomEvent(name), event);
            await game.playTurn();
            const after = await playerSnapshot(game);

            // Only the territories the player STILL HOLDS. Since Phase 7.8 the AI masses an
            // army and presses attacks it can win, and it is entirely capable of taking one
            // of Japan's five territories during the turn this spec plays -- verified in a
            // browser when this first failed: South Korea took Kochi in a real conquest,
            // recorded in the activity feed, with the model consistent and no console error.
            // A territory that changed hands is not a disaster's doing and is not this
            // spec's business; assuming it could never happen is what made the comparison
            // read `undefined[resource]` and throw.
            const stillHeld = Object.keys(before).filter((name) => after[name]);
            expect(stillHeld.length, "the AI took the whole country -- nothing left to measure")
                .toBeGreaterThan(0);

            const hit = stillHeld.filter(
                (name) => after[name][resource] < before[name][resource]
            );
            expect(hit.length, `${event} should have taken ${resource} from someone`).toBeGreaterThan(
                0
            );

            // Nothing went negative or non-finite anywhere -- a disaster is a subtraction,
            // not a licence to corrupt the model (defect AJ, and the AK/AL family).
            for (const [name, values] of Object.entries(after)) {
                for (const [key, value] of Object.entries(values)) {
                    expect(Number.isFinite(value), `${name}.${key} is ${value}`).toBe(true);
                    expect(value, `${name}.${key} went negative`).toBeGreaterThanOrEqual(0);
                }
            }
        });
    }
});
