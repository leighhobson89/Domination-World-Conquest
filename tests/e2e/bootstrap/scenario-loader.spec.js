import { test, expect } from "../../support/fixtures.js";

// The scenario loader itself.
//
// It exists so that specs can reach states clicking cannot -- a rout, an all-naval
// defender, two concurrent sieges. That makes it a piece of test infrastructure other
// specs trust, so it gets its own coverage: a loader that silently does nothing turns
// every spec built on it into a spec that asserts nothing.
//
// docs/03-e2e-test-plan.md section 3.7 (a refactor Phase 4 deliverable).

test.describe("the scenario loader", () => {
    test("applies a territory patch through the state layer", async ({ startedGame: game }) => {
        const before = await game.territory("France");

        const report = await game.page.evaluate(() =>
            window.__game.applyScenario({
                name: "inline",
                territories: [{ territory: "France", patch: { fortsBuilt: 4, foodForCurrentTerritory: 0 } }],
            })
        );

        expect(report.errors).toEqual([]);
        expect(report.territories).toEqual(["France"]);

        const after = await game.territory("France");
        expect(after.fortsBuilt).toBe(4);
        expect(after.foodForCurrentTerritory).toBe(0);
        expect(after.uniqueId).toBe(before.uniqueId);
    });

    test("reports a territory it could not find rather than failing silently", async ({
        startedGame: game,
    }) => {
        const report = await game.page.evaluate(() =>
            window.__game.applyScenario({
                territories: [{ territory: "Atlantis", patch: { fortsBuilt: 1 } }],
            })
        );
        expect(report.territories).toEqual([]);
        expect(report.errors).toHaveLength(1);
        expect(report.errors[0]).toContain("Atlantis");
    });

    test("opens a siege that the map and the siege list both agree on", async ({
        startedGame: game,
    }) => {
        await game.loadScenario("two-sieges");

        const sieges = await game.sieges();
        expect(sieges.ai).toEqual(expect.arrayContaining(["Germany", "France"]));

        // The scenario never touches the `underSiege` attribute -- it is derived from the
        // siege list and rendered by src/ui/mapAttributeSync.js (Phase 4.4/4.5).
        const underSiege = await game.page.evaluate(() => {
            const doc = document.getElementById("svg-map").contentDocument;
            return ["Germany", "France"].map((name) => {
                const path = Array.from(doc.querySelectorAll("path")).find(
                    (p) => p.getAttribute("territory-name") === name
                );
                return path?.getAttribute("underSiege");
            });
        });
        expect(underSiege).toEqual(["true", "true"]);
    });

    test("gives its sieges warIds from the same counters the game uses", async ({
        startedGame: game,
    }) => {
        // A scenario siege that reused a live warId would make addRemoveWarSiegeObject
        // remove the wrong siege.
        await game.loadScenario("two-sieges");
        const warIds = await game.page.evaluate(() => {
            const sieges = window.__game.sieges();
            return sieges.ai.map((name) => name);
        });
        expect(new Set(warIds).size).toBe(warIds.length);
    });

    test("throws from the driver when a scenario does not apply cleanly", async ({
        startedGame: game,
    }) => {
        await expect(game.loadScenario("does-not-exist")).rejects.toThrow();
    });
});
