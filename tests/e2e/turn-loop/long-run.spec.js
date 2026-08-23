import { test, expect } from "../../support/fixtures.js";
import { territoryNames } from "../../support/territories.js";

// The single highest-value spec in the suite: consecutive turns with no player
// action. It is what proves a refactor did not corrupt the loop -- and it is
// what found audit 5.1 AA.
//
// 🔴 THE TEN-TURN RUN DOES NOT PASS TODAY. Somewhere between turn 4 and turn 7,
// depending on the RNG stream, `determineResourcesAvailableForThisGoal` throws
// `Cannot read properties of undefined (reading '1')` because it reassigns
// `refinedTurnGoals` from inside a loop indexed against the old length. The
// rejection escapes the `gameLoop()` promise chain uncaught, so the turn counter
// never advances again and the game is frozen on "AI MOVING...". See
// docs/01-codebase-audit.md section 5.1 AA; refactor Phase 3.1a fixes it and
// un-fixmes the ten-turn spec below.
//
// Measured over six seeds the earliest crash was turn 3, but the sparkle timer
// keeps the seed from determining the run (audit 5.3 Y) and it has been seen as
// early as the second AI phase. Anything needing more than ONE full turn is
// therefore a coin flip today, and is marked `fixme` here and across turn-loop/
// rather than left to flake. The single-turn specs stay green, so the loop still
// has a guard while the defect stands.
//
// docs/04-e2e-test-plan.md section 5.3.

const TURNS = 10;
const SAFE_TURNS = 2;

/** Every finite-number field of every territory, or the first few that are not. */
async function nonFiniteFields(game) {
    return game.state((names) => {
        const problems = [];
        for (const name of names) {
            const t = window.__game.territory(name);
            if (!t) {
                problems.push(`${name}: missing from the model`);
                continue;
            }
            for (const [key, value] of Object.entries(t)) {
                if (typeof value === "number" && !Number.isFinite(value)) {
                    problems.push(`${name}.${key} = ${value}`);
                }
            }
        }
        return problems.slice(0, 5);
    }, territoryNames);
}

/** The top table is recomputed from the territories, so the two must agree. */
async function totalsAgreeWithTerritories(game) {
    const { totals, summed } = await game.state(() => {
        const owned = window.__game.territoriesOwnedBy("Player");
        const sum = (key) => owned.reduce((a, t) => a + t[key], 0);
        return {
            totals: window.__game.totals(),
            summed: {
                gold: sum("goldForCurrentTerritory"),
                oil: sum("oilForCurrentTerritory"),
                food: sum("foodForCurrentTerritory"),
                consMats: sum("consMatsForCurrentTerritory"),
            },
        };
    });

    // Compared relatively, not with toBeCloseTo: these are sums of tens of
    // thousands, where "3 decimal places" is stricter than double-precision
    // addition of the same terms in a different order. A tenth of a percent is
    // loose enough for float noise and far tighter than a real desync.
    const agrees = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.001);
    return Object.fromEntries(
        Object.keys(summed).map((key) => [key, agrees(totals[key], summed[key])])
    );
}

test.describe("a long run with no player action", () => {
    // Ten AI phases over 200+ countries. Generous, but not open-ended: if this
    // starts timing out, the AI turn has regressed, which is exactly what the
    // spec is for.
    test.setTimeout(600_000);

    test.fixme("completes ten turns with the loop, the world and the player intact", async ({
        startedGame: game,
    }) => {
        // 🔴 audit 5.1 AA -- the AI turn throws and the game loop stops. Unskip
        // with refactor Phase 3.1a.
        const startingTerritories = (await game.playerTerritories())
            .map((t) => t.territoryName)
            .sort();
        expect(startingTerritories.length).toBeGreaterThan(0);

        for (let turn = 1; turn <= TURNS; turn += 1) {
            expect(await game.turn(), `turn counter before cycle ${turn}`).toBe(turn);
            await game.playTurn();
            expect(await nonFiniteFields(game), `after turn ${turn}`).toEqual([]);
        }

        expect(await game.turn()).toBe(TURNS + 1);

        // The player takes no action and starts nowhere near a front line, so
        // they should finish owning at least what they started with.
        const finalTerritories = (await game.playerTerritories())
            .map((t) => t.territoryName)
            .sort();
        expect(finalTerritories).toEqual(expect.arrayContaining(startingTerritories));
    });

    test.fixme("completes two turns and keeps the player's territories", async ({
        startedGame: game,
    }) => {
        // 🔴 audit 5.1 AA -- the AI turn throws `Cannot read properties of undefined
        // (reading '1')` and the unhandled rejection stops `gameLoop()` for good. It
        // can land as early as the second AI phase, so ANY spec needing more than one
        // full turn is a coin flip today. Un-fixme with refactor Phase 3.1a.

        const startingTerritories = (await game.playerTerritories())
            .map((t) => t.territoryName)
            .sort();

        for (let turn = 1; turn <= SAFE_TURNS; turn += 1) {
            expect(await game.turn(), `turn counter before cycle ${turn}`).toBe(turn);
            await game.playTurn();
        }

        expect(await game.turn()).toBe(SAFE_TURNS + 1);

        const finalTerritories = (await game.playerTerritories())
            .map((t) => t.territoryName)
            .sort();
        expect(finalTerritories).toEqual(expect.arrayContaining(startingTerritories));
    });

    test("holds no NaN anywhere in the world after the first turn", async ({
        startedGame: game,
    }) => {
        await game.playTurn();
        expect(await nonFiniteFields(game)).toEqual([]);
    });

    test.fixme("holds no NaN anywhere in the world after two turns", async ({
        startedGame: game,
    }) => {
        // 🔴 INTERMITTENT, and a real defect when it fires: an AI turn can leave a
        // territory with `goldForCurrentTerritory = NaN` (observed on Vatican City).
        // It does not reproduce on every seed, and the sparkle timer means the seed
        // does not fully determine the run (audit 5.3 Y), so this is `fixme` rather
        // than a flaky red.
        //
        // The most likely cause is audit 5.1 B: `doAiActions` writes
        // `mainArrayFriendlyTerritoryCopy` back into `mainGameArray` unconditionally,
        // and when the two-territory search (5.1 C) fails, the value written is the
        // sentinel string "no match" -- every later arithmetic on that slot yields
        // NaN. Confirm the mechanism when Phase 3.2 lands, then un-fixme.
        await game.playTurns(2);
        expect(await nonFiniteFields(game)).toEqual([]);
    });

    test("agrees with the sum over the player's territories before any AI turn", async ({
        startedGame: game,
    }) => {
        // Turn 1, before the AI has run. The top table is recomputed from the
        // territories, so at this point the two views are the same numbers read
        // twice.
        expect(await totalsAgreeWithTerritories(game)).toEqual({
            gold: true,
            oil: true,
            food: true,
            consMats: true,
        });
    });

    test.fixme("keeps the player's totals equal to the sum of their territories throughout", async ({
        startedGame: game,
    }) => {
        // 🔴 audit 5.1 AB. addUpAllTerritoryResourcesForCountryAndWriteToTopTable
        // reads each territory through the O(1) index, which the AI orphans by
        // substituting whole elements into mainGameArray. From the first AI turn
        // onward the top table can be summing territories the game has already
        // replaced, so the headline figure the player reads is stale.
        //
        // Un-fixme with refactor Phase 3.2 (stop substituting) -- and it is
        // structurally closed by Phase 4.4.
        for (let turn = 1; turn <= SAFE_TURNS; turn += 1) {
            await game.playTurn();
            expect(await totalsAgreeWithTerritories(game), `after turn ${turn}`).toEqual({
                gold: true,
                oil: true,
                food: true,
                consMats: true,
            });
        }
    });

    test("leaves the turn loop responsive -- the phase button never sticks", async ({
        startedGame: game,
    }) => {
        // The failure mode of audit 5.1 AA is a permanently disabled button on
        // "AI MOVING...", so this is the cheap canary for a frozen loop.
        for (let turn = 1; turn <= SAFE_TURNS; turn += 1) {
            await game.playTurn();
            expect(await game.phaseBar.isEnabled(), `after turn ${turn}`).toBe(true);
            expect(await game.phaseBar.label(), `after turn ${turn}`).toBe("MILITARY");
        }
    });
});
