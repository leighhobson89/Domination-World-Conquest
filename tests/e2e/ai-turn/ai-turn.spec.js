import { test, expect } from "../../support/fixtures.js";
import { territoryNames } from "../../support/territories.js";

// What the AI phase does, and that it does the same thing twice.
// docs/03-e2e-test-plan.md section 5.12.

test.describe("the AI turn", () => {
    test.setTimeout(300_000);

    test("completes for every country, leaving nothing broken behind", async ({
        startedGame: game,
        page,
    }) => {
        // audit 5.1 B and C, fixed in Phase 3.2: a goal whose territory was not found left
        // the sentinel STRING "no match", which the write-back then wrote into the model, so
        // every later arithmetic on that slot came out NaN. The sentinel is null now and an
        // unfound goal is skipped. The console-error gate in tests/support/fixtures.js is the
        // other half of this spec -- a throw inside the AI turn fails it.
        await game.playTurn();
        expect(await game.turn()).toBe(2);

        const broken = await page.evaluate((names) => {
            const problems = [];
            for (const name of names) {
                const territory = window.__game.territory(name);
                if (!territory || typeof territory !== "object") {
                    problems.push(`${name}: not an object`);
                    continue;
                }
                if (typeof territory.dataName !== "string" || territory.dataName === "no match") {
                    problems.push(`${name}.dataName = ${territory.dataName}`);
                }
                for (const [key, value] of Object.entries(territory)) {
                    if (typeof value === "number" && !Number.isFinite(value)) {
                        problems.push(`${name}.${key} = ${value}`);
                    }
                }
            }
            return problems.slice(0, 5);
        }, territoryNames);
        expect(broken).toEqual([]);
    });

    test("the AI actually moves: the world is not the same after a turn", async ({
        startedGame: game,
        page,
    }) => {
        // Before Phase 3 the AI turn threw before it got anywhere, so "nothing changed" was
        // indistinguishable from "the AI did nothing". It besieges and conquers now.
        const ownership = () =>
            page.evaluate((names) =>
                names.map((name) => window.__game.territory(name)?.owner ?? null), territoryNames);

        const before = await ownership();
        const siegesBefore = (await game.sieges()).ai.length;

        await game.playTurn();
        await game.playTurn();

        const after = await ownership();
        const siegesAfter = (await game.sieges()).ai.length;

        const changed = after.filter((owner, index) => owner !== before[index]).length;
        expect(
            changed + (siegesAfter - siegesBefore),
            "two AI turns should move something in the world"
        ).toBeGreaterThan(0);
    });

    test("two runs of the same seed produce the same world", async ({ game, page }) => {
        // The spec the plan calls `determinism.spec.js`, and "the guard that makes every
        // other AI test possible". It was impossible until Phase 5.5: `addSparklesRegularly()`
        // burned three draws per timer tick on the same global stream as the AI, so how many
        // cosmetic draws landed between two AI draws depended on wall-clock timing (audit
        // 5.3 Y). Cosmetic randomness lives on its own stream now.
        const worldAfterTwoTurns = async () => {
            await game.start({ country: "Germany", seed: "ai-determinism" });
            await game.playTurn();
            await game.playTurn();
            return page.evaluate((names) => {
                const owners = names.map(
                    (name) => `${name}:${window.__game.territory(name)?.owner ?? "?"}`
                );
                const sieges = window.__game.sieges();
                return {
                    turn: window.__game.turn(),
                    owners,
                    aiSieges: [...sieges.ai].sort(),
                    playerGold: Math.round(window.__game.totals()?.gold ?? 0),
                };
            }, territoryNames);
        };

        const first = await worldAfterTwoTurns();
        const second = await worldAfterTwoTurns();

        expect(second.turn).toBe(first.turn);
        expect(second.aiSieges).toEqual(first.aiSieges);
        expect(second.playerGold).toBe(first.playerGold);
        expect(second.owners).toEqual(first.owners);
    });

    test("does not besiege a territory that is already under siege", async ({ game, page }) => {
        // The behaviour added in a3a3e3c / ef689fb: one siege per territory. Two AI countries
        // both piling onto the same target would give one territory two sieges, and the
        // second would overwrite the first in a map keyed by territory name.
        await game.start({ country: "Germany", seed: "ai-sieges" });
        await game.loadScenario("two-sieges");

        for (let turn = 0; turn < 2; turn += 1) {
            await game.playTurn();
            const sieges = await game.sieges();
            const all = [...sieges.player, ...sieges.ai];
            expect(
                new Set(all).size,
                "a territory may be besieged once, not twice"
            ).toBe(all.length);
        }
    });
});
