// Play the game for N turns with no player action and report what the AI did with the world.
//
// The question this exists to answer is not "does the turn loop survive", which
// `tests/e2e/turn-loop/long-run.spec.js` already owns -- it is "does the world CONSOLIDATE".
// A world of 207 independent countries that is still 207 countries after a hundred turns has
// an AI that plans but never finishes anything, and no unit test can see that: it is a
// property of a hundred turns of interacting countries, not of any one function.
//
// So this is a measuring instrument, not a test. It prints one row per turn -- surviving
// countries, the largest empires, conquests, failed attacks, sieges -- and writes the whole
// series to JSON so two runs can be diffed after a change to `src/ai/`.
//
// It drives the REAL game in a real browser through `tests/support/game.js`, the same driver
// the e2e suite uses, because every rule that matters (adjacency, odds, income, sieges) lives
// in the page. Running it against `npm run dev` rather than the preview server is deliberate:
// Vite serves from source, so there is no build step between an edit and a measurement, and
// none of the "Playwright reused a preview server it did not build" trap in CLAUDE.md.
//
//   npm run dev                                    (in another terminal)
//   node tools/ai-sim.mjs --turns=100 --seed=alpha
//
// DO NOT EDIT SOURCE FILES WHILE A RUN IS IN FLIGHT. Vite pushes an HMR update, the page
// reloads, `window.__game` goes with it, and the run dies part way through with
// "Cannot read properties of undefined (reading 'turn')" -- which looks exactly like a game
// defect and is not one. Finish the edit, then measure.
//
// Options:
//   --turns=N        how many turns to play (default 40)
//   --seed=STRING    the seed for Math.random, installed before any page script runs
//   --country=NAME   the country the (idle) player starts as (default Germany)
//   --url=URL        where the game is served (default http://localhost:3000)
//   --out=FILE       where to write the JSON series (default test-reports/ai-sim/<seed>.json)
//   --every=N        sample the world every N turns (default 1); the per-turn cost is small
//                    but a hundred-turn run of a busy map is not free
//   --diagnose=A,B   after these turns, also dump WHY: postures, budgets, verdicts and the
//                    commonest reasons a target was skipped, aggregated over every country
//   --goal=KIND[:S]  play under a named victory condition instead of the default. KIND is one
//                    of CONQUEST, CONTINENTAL, DOMINATION, GREAT_POWERS or TURN_LIMIT, and S
//                    is that goal's scale in its own units -- CONTINENTAL:4, DOMINATION:0.8,
//                    TURN_LIMIT:350, GREAT_POWERS:3. Omit the scale for the goal's default.
//
//                    This is the acceptance criterion for `src/ai/doctrine.js`: the claim is
//                    that the five goals produce five visibly DIFFERENT worlds, and that no
//                    goal freezes one. Neither can be seen from any single turn, and neither
//                    has a textual signature -- nothing throws, every turn completes, and the
//                    map quietly stops changing. So it is measured, per goal, over 150 turns.
//   --trace=TEXT     print the game's own console lines containing TEXT from the LAST turn.
//                    The AI narrates every decision it makes; when it decides something and
//                    then does not do it, that narration is the only record of where it
//                    stopped
//   --headed         watch it play

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { GameDriver } from "../tests/support/game.js";

const options = parseArgs(process.argv.slice(2));

/** The seeded PRNG the e2e fixtures install, copied rather than imported: `fixtures.js`
 *  pulls in `@playwright/test`, which a plain script must not depend on. */
function installSeededRandomSource(seed) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(seed).length; i += 1) {
        h ^= String(seed).charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    Math.random = function seededRandom() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    window.__seed = String(seed);
}

/**
 * One reading of the world.
 *
 * Ownership is read from the store through `window.__game.territory()` rather than from the
 * map's `data-name` attributes: the attributes are output (CLAUDE.md), and a measurement that
 * reads the rendering cannot tell "the AI stopped conquering" from "the sync stopped writing".
 */
async function sampleWorld(page) {
    return page.evaluate(() => {
        const owners = new Map();
        // uniqueIds are the SVG path ids, 0..N; territory() accepts either an id or a name.
        for (let id = 0; id < 400; id += 1) {
            const territory = window.__game.territory(String(id));
            if (!territory) {
                continue;
            }
            const owner = territory.dataName;
            if (!owners.has(owner)) {
                owners.set(owner, { territories: 0, area: 0, army: 0 });
            }
            const entry = owners.get(owner);
            entry.territories += 1;
            entry.area += Number(territory.area) || 0;
            entry.army += Number(territory.armyForCurrentTerritory) || 0;
        }

        const ranked = [...owners.entries()]
            .map(([country, entry]) => ({ country, ...entry }))
            .sort((a, b) => b.territories - a.territories);

        const activity = window.__game.activity() ?? [];
        const turn = window.__game.turn();
        // The AI moves during turn N and the counter reaches N+1 afterwards, so the turn
        // that has just been played is the one below the counter (CLAUDE.md).
        const played = activity.find((section) => section.turn === turn - 1);
        const counts = {};
        for (const entry of played?.entries ?? []) {
            counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
        }

        const worldTerritories = ranked.reduce((sum, row) => sum + row.territories, 0);
        //`sieges()` answers with the two LISTS, not with a count -- reading its key count
        //returns 2 forever, which is exactly the sort of measurement that looks like a
        //finding ("sieges are pinned at 2") and is really a bug in the instrument.
        const siegeLists = window.__game.sieges() ?? { player: [], ai: [] };
        return {
            turn,
            countries: ranked.length,
            worldTerritories,
            sieges: (siegeLists.player?.length ?? 0) + (siegeLists.ai?.length ?? 0),
            top: ranked.slice(0, 8),
            // What one country would have to hold to be one of "sixteen powers".
            largest: ranked[0]?.territories ?? 0,
            heldByTopSixteen: ranked.slice(0, 16).reduce((sum, row) => sum + row.territories, 0),
            player: ranked.find((row) => row.country === window.__simPlayerCountry)?.territories ?? 0,
            activity: counts,
        };
    });
}

/**
 * What the AI countries were thinking on the turn just played.
 *
 * A frozen world is the AI's worst failure and it has no textual signature -- nothing
 * throws, every turn completes, and the map simply stops changing. The answer is always in
 * the SKIP reasons, which is why `goals.js` records them for every pairing it weighs.
 */
async function sampleReasoning(page) {
    return page.evaluate(() => {
        const plans = window.__game.aiPlans?.(400) ?? [];
        const latestTurn = plans[0]?.turn ?? 0;
        const thisTurn = plans.filter((plan) => plan.turn === latestTurn);

        const postures = {};
        const verdicts = {};
        const reasons = {};
        const siegeVerdicts = {};
        let attackBudget = 0;
        let siegeBudget = 0;
        let oddsFloor = 0;
        let weighed = 0;
        let development = 0;
        let territories = 0;
        let noGoals = 0;

        for (const plan of thisTurn) {
            postures[plan.posture ?? "none"] = (postures[plan.posture ?? "none"] ?? 0) + 1;
            attackBudget += plan.budgets?.attack ?? 0;
            siegeBudget += plan.budgets?.siege ?? 0;
            oddsFloor += plan.budgets?.attackOddsFloor ?? 0;
            development += plan.health?.development ?? 0;
            territories += plan.health?.territories ?? 0;
            if ((plan.goals ?? []).length === 0) {
                noGoals += 1;
            }
            for (const review of plan.siegeReviews ?? []) {
                siegeVerdicts[review.verdict] = (siegeVerdicts[review.verdict] ?? 0) + 1;
            }
            for (const decision of plan.decisions ?? []) {
                weighed += 1;
                verdicts[decision.verdict] = (verdicts[decision.verdict] ?? 0) + 1;
                // The reasons carry numbers ("odds 12% below the siege floor of 22%"), so
                // they are collapsed to their shape before being counted.
                const shape = String(decision.reason)
                    .replace(/-?\d+(\.\d+)?/g, "N")
                    .slice(0, 70);
                reasons[shape] = (reasons[shape] ?? 0) + 1;
            }
        }

        const countries = thisTurn.length || 1;
        return {
            turn: latestTurn,
            countriesPlanning: thisTurn.length,
            postures,
            verdicts,
            siegeVerdicts,
            weighedPairings: weighed,
            meanAttackBudget: Number((attackBudget / countries).toFixed(2)),
            meanSiegeBudget: Number((siegeBudget / countries).toFixed(2)),
            meanAttackOddsFloor: Number((oddsFloor / countries).toFixed(1)),
            meanDevelopment: Number((development / countries).toFixed(3)),
            meanTerritories: Number((territories / countries).toFixed(2)),
            countriesWithNoGoalsAtAll: noGoals,
            topReasons: Object.entries(reasons)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([reason, count]) => ({ count, reason })),
        };
    });
}

function printReasoning(reasoning) {
    console.log("");
    console.log(`--- why, on turn ${reasoning.turn} (${reasoning.countriesPlanning} countries planned) ---`);
    console.log(`postures        ${JSON.stringify(reasoning.postures)}`);
    console.log(`verdicts        ${JSON.stringify(reasoning.verdicts)} over ${reasoning.weighedPairings} pairings`);
    console.log(`siege reviews   ${JSON.stringify(reasoning.siegeVerdicts)}`);
    console.log(
        `budgets         attack ${reasoning.meanAttackBudget}/country, ` +
        `siege ${reasoning.meanSiegeBudget}/country, odds floor ${reasoning.meanAttackOddsFloor}%`
    );
    console.log(
        `condition       ${reasoning.meanTerritories} territories/country, ` +
        `development ${reasoning.meanDevelopment}, ` +
        `${reasoning.countriesWithNoGoalsAtAll} countries planned nothing at all`
    );
    for (const { count, reason } of reasoning.topReasons) {
        console.log(`  ${String(count).padStart(5)}  ${reason}`);
    }
    console.log("");
}

function formatRow(sample, elapsedMs) {
    const activity = sample.activity;
    const pad = (value, width) => String(value).padStart(width);
    return [
        `t${pad(sample.turn - 1, 3)}`,
        `countries ${pad(sample.countries, 3)}`,
        `top16 ${pad(Math.round((sample.heldByTopSixteen / sample.worldTerritories) * 100), 3)}%`,
        `largest ${pad(sample.largest, 3)}`,
        `conq ${pad(activity.conquest ?? 0, 3)}`,
        `failed ${pad(activity.attackFailed ?? 0, 3)}`,
        `sieges ${pad(sample.sieges, 3)}`,
        `siegeWon ${pad(activity.siegeWon ?? 0, 2)}`,
        `player ${pad(sample.player, 3)}`,
        `${pad(Math.round(elapsedMs / 1000), 4)}s`,
    ].join("  ");
}

async function main() {
    const browser = await chromium.launch({ headless: !options.headed });
    const context = await browser.newContext({ baseURL: options.url });
    const page = await context.newPage();
    await page.addInitScript(installSeededRandomSource, options.seed);

    const failures = [];
    // The AI narrates itself to the console -- forty-odd lines per country per turn -- and
    // when a decision is made but never carried out, that narration is the only record of
    // where it stopped. Collected only while `--trace` is on, because attaching a listener
    // makes the browser serialise every one of those lines across the wire.
    const traced = [];
    let tracing = false;
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.stack || error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") {
            failures.push(`console.error: ${message.text()}`);
            return;
        }
        if (tracing && options.trace && message.text().includes(options.trace)) {
            traced.push(message.text());
        }
    });

    const game = new GameDriver(page);
    console.log(`seed "${options.seed}", ${options.turns} turns, player idles as ${options.country}` +
        (options.goal ? `, goal ${options.goal.kind}` +
            (options.goal.scale === undefined ? "" : `:${options.goal.scale}`) : ""));
    await game.start({ country: options.country, seed: options.seed });
    await page.evaluate((country) => {
        window.__simPlayerCountry = country;
    }, options.country);

    //The goal, set AFTER the game has started, which is deliberate: the great powers a
    //GREAT_POWERS condition names are the five countries the selection screen locks, and
    //those are only computed once the world has been built.
    if (options.goal) {
        const condition = await page.evaluate(
            ({ kind, scale }) => window.__game.setGoal(kind, scale),
            options.goal
        );
        console.log(`goal: ${condition.kind}` +
            (condition.greatPowers?.length ? ` vs ${condition.greatPowers.join(", ")}` : "") +
            ` (continents ${condition.continentsRequired}, share ${condition.landShare},` +
            ` turn limit ${condition.turnLimit}, powers ${condition.greatPowersRequired})`);
    }

    const series = [];
    const diagnostics = [];
    const startedAt = Date.now();
    let stoppedBecause = null;

    for (let turn = 1; turn <= options.turns; turn += 1) {
        const turnStartedAt = Date.now();
        //Only the last turn is traced: one turn of two hundred countries narrating
        //themselves is already several thousand lines.
        tracing = Boolean(options.trace) && turn === options.turns;
        try {
            await game.playTurn();
        } catch (error) {
            stoppedBecause = `turn ${turn} did not complete: ${error.message}`;
            break;
        }
        if (turn % options.every !== 0 && turn !== options.turns) {
            continue;
        }
        const sample = await sampleWorld(page);
        sample.elapsedMs = Date.now() - turnStartedAt;
        series.push(sample);
        console.log(formatRow(sample, sample.elapsedMs));

        if (options.diagnoseAt.includes(turn)) {
            const reasoning = await sampleReasoning(page);
            reasoning.playedTurn = turn;
            diagnostics.push(reasoning);
            printReasoning(reasoning);
        }
    }

    const report = {
        seed: options.seed,
        goal: options.goal,
        country: options.country,
        turnsRequested: options.turns,
        turnsPlayed: series.at(-1)?.turn ?? 0,
        wallClockSeconds: Math.round((Date.now() - startedAt) / 1000),
        stoppedBecause,
        pageFailures: failures.slice(0, 20),
        series,
        diagnostics,
    };

    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, JSON.stringify(report, null, 2), "utf8");

    if (options.trace) {
        console.log("");
        console.log(`--- console lines containing "${options.trace}" on the last turn (${traced.length}) ---`);
        for (const line of traced.slice(0, options.traceLimit)) {
            console.log("  " + line);
        }
    }

    console.log("");
    console.log(`wrote ${options.out}`);
    if (stoppedBecause) {
        console.log(`STOPPED: ${stoppedBecause}`);
    }
    if (failures.length > 0) {
        console.log(`${failures.length} page error(s); first: ${failures[0]}`);
    }
    const last = series.at(-1);
    if (last) {
        console.log(
            `after ${last.turn - 1} turns: ${last.countries} countries survive, ` +
            `the largest holds ${last.largest} territories, ` +
            `the top sixteen hold ${Math.round((last.heldByTopSixteen / last.worldTerritories) * 100)}% of the map`
        );
    }

    await browser.close();
}

function parseArgs(argv) {
    const values = new Map();
    for (const argument of argv) {
        const [key, value] = argument.replace(/^--/, "").split("=");
        values.set(key, value ?? "true");
    }
    const seed = values.get("seed") ?? "sim";
    const diagnoseAt = (values.get("diagnose") ?? "")
        .split(",")
        .map((turn) => Number(turn))
        .filter((turn) => Number.isFinite(turn) && turn > 0);
    //"--goal=DOMINATION:0.8" -> { kind: "DOMINATION", scale: 0.8 }. The scale is left
    //undefined when it is absent or not a number, which is what makes the catalogue fall
    //back to that goal's own default rather than to a condition with a NaN in it.
    const goalArgument = values.get("goal") ?? null;
    let goal = null;
    if (goalArgument) {
        const [kind, scaleText] = goalArgument.split(":");
        const scale = Number(scaleText);
        goal = { kind: kind.toUpperCase(), scale: Number.isFinite(scale) ? scale : undefined };
    }

    return {
        diagnoseAt,
        goal,
        turns: Number(values.get("turns") ?? 40),
        seed,
        country: values.get("country") ?? "Germany",
        url: values.get("url") ?? "http://localhost:3000",
        every: Math.max(1, Number(values.get("every") ?? 1)),
        headed: values.has("headed"),
        trace: values.get("trace") ?? null,
        traceLimit: Number(values.get("traceLimit") ?? 60),
        //The goal goes in the default filename, so five runs of one seed under five goals do
        //not overwrite one another -- which is exactly what the acceptance criterion asks
        //for, and exactly the mistake that would make the whole measurement worthless.
        out: resolve(values.get("out") ??
            `test-reports/ai-sim/${seed}${goal ? "-" + goal.kind.toLowerCase() : ""}.json`),
    };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
