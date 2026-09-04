#!/usr/bin/env node
//
// Runs the Playwright suite into a timestamped folder under test-reports/runs/ and
// keeps a rolling history of recent runs.
//
// Usage:
//   node tests/run-e2e.mjs                          # whole suite
//   node tests/run-e2e.mjs attack                   # one area
//   node tests/run-e2e.mjs attack turn-loop siege   # several areas, in one run
//   node tests/run-e2e.mjs --list                   # what exists, and how many specs
//   node tests/run-e2e.mjs --headed                 # watch it in a real browser
//   node tests/run-e2e.mjs --headed --slow          # ...500ms between actions
//   node tests/run-e2e.mjs --slow=1000              # custom pause, in ms
//   node tests/run-e2e.mjs attack/multi-territory.spec.js:42   # one test
//
// A bare word is a FOLDER under tests/e2e/, and every extra word is another folder
// added to the same run. A word that is not a folder there is forwarded to
// Playwright as a path/regex if it looks like one (it contains a slash, a dot or a
// colon) and is otherwise rejected with the list of areas, so a typo cannot quietly
// run nothing.
//
// Everything else is forwarded to `playwright test` verbatim, except --slow[=ms],
// --list (--list-categories) and --category <name>, which this script consumes.
//
// Adding a coverage area needs no code change: create tests/e2e/<name>/, drop
// .spec.js files in it, and it is runnable by name at once.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");
const REPORTS_ROOT = path.join(PROJECT_ROOT, "test-reports");
const RUNS_ROOT = path.join(REPORTS_ROOT, "runs");
const E2E_ROOT = path.join(PROJECT_ROOT, "tests", "e2e");
const HISTORY_LIMIT = Number.parseInt(process.env.DWC_HISTORY_LIMIT || "10", 10);
const DEFAULT_SLOW_MS = 500;

function countSpecs(dir) {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
        if (entry.isDirectory()) return total + countSpecs(path.join(dir, entry.name));
        return total + (entry.name.endsWith(".spec.js") ? 1 : 0);
    }, 0);
}

function listCategories() {
    if (!fs.existsSync(E2E_ROOT)) return [];
    return fs
        .readdirSync(E2E_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
            name: entry.name,
            specCount: countSpecs(path.join(E2E_ROOT, entry.name)),
        }))
        .sort((a, b) => b.specCount - a.specCount || a.name.localeCompare(b.name));
}

function printCategories() {
    const categories = listCategories();
    if (!categories.length) {
        console.log("No test areas found under tests/e2e/.");
        return;
    }
    const width = Math.max(...categories.map((c) => c.name.length));
    console.log(`Test areas under tests/e2e/ (${categories.length}):\n`);
    for (const { name, specCount } of categories) {
        const label =
            specCount === 0 ? "(empty)" : `${specCount} spec${specCount === 1 ? "" : "s"}`;
        console.log(`  ${name.padEnd(width)}   ${label}`);
    }
    console.log(`\nRun one:     node tests/run-e2e.mjs <name>`);
    console.log(`Run several: node tests/run-e2e.mjs <name> <name> ...`);
}

/** 2026-08-23T13-05-04 -- sorts chronologically, and is legal on Windows. */
function runStamp(date = new Date()) {
    return date.toISOString().replace(/\..+$/, "").replace(/:/g, "-");
}

function stripAnsi(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\[[0-9;]*m/g, "");
}

function formatDuration(ms) {
    const totalSeconds = Math.round((ms || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    return minutes > 0 ? `${minutes}m ${totalSeconds % 60}s` : `${totalSeconds}s`;
}

function flattenTests(jsonReport) {
    const rows = [];
    const walk = (suite, fileHint) => {
        const file = suite.file || fileHint || "";
        for (const spec of suite.specs || []) {
            for (const entry of spec.tests || []) {
                const last = (entry.results || []).at(-1) || {};
                rows.push({
                    file: spec.file || file,
                    title: spec.title,
                    status: entry.status || last.status || "unknown",
                    duration: last.duration || 0,
                    attachments: (last.attachments || [])
                        .filter((a) => a.path)
                        .map((a) => ({ name: a.name, path: a.path })),
                    errors: (last.errors || [])
                        .map((e) => stripAnsi(String(e.message || "")).split("\n")[0])
                        .filter(Boolean),
                });
            }
        }
        for (const child of suite.suites || []) walk(child, file);
    };
    for (const suite of jsonReport.suites || []) walk(suite, suite.file);
    return rows;
}

function summarise(rows) {
    const counts = { passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0, other: 0 };
    for (const { status } of rows) {
        if (status in counts) counts[status] += 1;
        else if (status === "expected") counts.passed += 1;
        else if (status === "unexpected") counts.failed += 1;
        else counts.other += 1;
    }
    return counts;
}

function groupBy(rows, keyOf) {
    const map = new Map();
    for (const row of rows) {
        const key = keyOf(row);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
    }
    return map;
}

/** A row's category is the folder directly under tests/e2e/. */
function categoryOf(filePath) {
    const segments = String(filePath || "")
        .split(/[\\/]/)
        .filter(Boolean);
    if (segments[0] !== "e2e") return segments[0] || "(unknown)";
    return segments.length > 2 ? `e2e/${segments[1]}` : "e2e/(uncategorized)";
}

function writeSummary(runDir, stamp, rows, counts, wallClockMs, exitCode) {
    const failedCount = counts.failed + counts.timedOut + counts.interrupted;
    const lines = [
        `# Test run ${stamp}`,
        "",
        `**Result:** ${exitCode === 0 ? "PASS" : "FAIL"}  `,
        `**Total:** ${rows.length}  `,
        `**Passed:** ${counts.passed}  `,
        `**Failed:** ${failedCount}  `,
        `**Skipped:** ${counts.skipped}  `,
        `**Wall clock:** ${formatDuration(wallClockMs)}`,
        "",
        "## By category",
        "",
        "| Category | Tests | Passed | Failed | Time |",
        "| --- | ---: | ---: | ---: | ---: |",
    ];

    for (const [category, catRows] of groupBy(rows, (r) => categoryOf(r.file))) {
        const c = summarise(catRows);
        const time = catRows.reduce((sum, r) => sum + (r.duration || 0), 0);
        lines.push(
            `| ${category} | ${catRows.length} | ${c.passed} | ` +
                `${c.failed + c.timedOut + c.interrupted} | ${formatDuration(time)} |`
        );
    }

    lines.push(
        "",
        "## By suite",
        "",
        "| Suite | Tests | Passed | Failed | Time |",
        "| --- | ---: | ---: | ---: | ---: |"
    );
    for (const [file, fileRows] of groupBy(rows, (r) => r.file || "(unknown)")) {
        const c = summarise(fileRows);
        const time = fileRows.reduce((sum, r) => sum + (r.duration || 0), 0);
        lines.push(
            `| ${file} | ${fileRows.length} | ${c.passed} | ` +
                `${c.failed + c.timedOut + c.interrupted} | ${formatDuration(time)} |`
        );
    }

    const failures = rows.filter((r) =>
        ["failed", "timedOut", "interrupted", "unexpected"].includes(r.status)
    );
    if (failures.length) {
        lines.push("", "## Failures", "");
        const rel = (a) => path.relative(runDir, a.path).split(path.sep).join("/");
        for (const row of failures) {
            lines.push(`### ${row.title}`, "");
            lines.push(`- **Status:** ${row.status}`);
            lines.push(`- **Spec:** \`${row.file}\``);
            for (const message of row.errors) lines.push(`- **Error:** ${message}`);
            const shot = row.attachments.find((a) => a.name === "screenshot");
            const video = row.attachments.find((a) => a.name === "video");
            const trace = row.attachments.find((a) => a.name === "trace");
            if (shot) lines.push(`- **Screenshot:** [\`${rel(shot)}\`](${rel(shot)})`);
            if (video) lines.push(`- **Video:** [\`${rel(video)}\`](${rel(video)})`);
            if (trace) {
                lines.push(
                    `- **Trace:** \`npx playwright show-trace ${path.relative(PROJECT_ROOT, trace.path)}\``
                );
            }
            if (shot) lines.push("", `![${row.title}](${rel(shot)})`);
            lines.push("");
        }
    }

    lines.push(
        "",
        `_Full HTML report: \`${path.relative(PROJECT_ROOT, path.join(runDir, "html", "index.html"))}\`_`,
        ""
    );
    fs.writeFileSync(path.join(runDir, "summary.md"), lines.join("\n"), "utf8");
    return { total: rows.length, failedCount };
}

function pruneHistory() {
    if (!fs.existsSync(RUNS_ROOT)) return [];
    const runDirs = fs
        .readdirSync(RUNS_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== "adhoc")
        .map((e) => e.name)
        .sort()
        .reverse();
    for (const name of runDirs.slice(HISTORY_LIMIT)) {
        fs.rmSync(path.join(RUNS_ROOT, name), { recursive: true, force: true });
    }
    return runDirs.slice(0, HISTORY_LIMIT);
}

function writeHistoryIndex(retained) {
    const lines = [
        "# Test run history",
        "",
        `Most recent ${HISTORY_LIMIT} runs, newest first. Regenerated on every`,
        "`npm run test:e2e`. See `runs/<stamp>/summary.md` for per-run detail.",
        "",
        "| Run | Result | Passed | Failed | Total |",
        "| --- | --- | ---: | ---: | ---: |",
    ];
    for (const name of retained) {
        const summaryPath = path.join(RUNS_ROOT, name, "summary.md");
        if (!fs.existsSync(summaryPath)) {
            lines.push(`| ${name} | (no summary) | | | |`);
            continue;
        }
        const text = fs.readFileSync(summaryPath, "utf8");
        const read = (label) =>
            (text.match(new RegExp(`\\*\\*${label}:\\*\\* (.+?)\\s*$`, "m")) || [])[1] || "";
        lines.push(
            `| [${name}](runs/${name}/summary.md) | ${read("Result")} | ` +
                `${read("Passed")} | ${read("Failed")} | ${read("Total")} |`
        );
    }
    lines.push("");
    fs.writeFileSync(path.join(REPORTS_ROOT, "history.md"), lines.join("\n"), "utf8");
}

/** A bare word only reaches Playwright as a path if it cannot be an area name. */
function looksLikeAPath(word) {
    return word.includes("/") || word.includes("\\") || word.includes(".") || word.includes(":");
}

/**
 * Splits argv into the areas to run and the flags to forward. Bare words are area
 * names; --category <name> / --category=<name> is kept as an alias for them so the
 * older command line still works.
 */
function parseArgs(rawArgs) {
    const areas = [];
    const forwarded = [];
    const unknown = [];

    for (let i = 0; i < rawArgs.length; i += 1) {
        const arg = rawArgs[i];

        if (arg === "--category" || arg.startsWith("--category=")) {
            const inline = arg.startsWith("--category=") ? arg.slice("--category=".length) : "";
            const next = rawArgs[i + 1];
            let name = inline;
            if (!name && next && !next.startsWith("-")) {
                name = next;
                i += 1;
            }
            if (!name) unknown.push("(none given)");
            else if (isArea(name)) areas.push(name);
            else unknown.push(name);
            continue;
        }

        if (arg.startsWith("-")) {
            forwarded.push(arg);
            continue;
        }

        if (isArea(arg)) areas.push(arg);
        else if (looksLikeAPath(arg)) forwarded.push(arg);
        else unknown.push(arg);
    }

    return { areas: [...new Set(areas)], forwarded, unknown };
}

export function isArea(name) {
    return (
        Boolean(name) &&
        fs.existsSync(path.join(E2E_ROOT, name)) &&
        fs.statSync(path.join(E2E_ROOT, name)).isDirectory()
    );
}

/**
 * Everything the run needs, worked out from argv alone: which areas, what to hand
 * Playwright, and how many workers. Separated from main() so the unit suite can
 * assert the command line without starting a browser.
 */
export function planRun(rawArgs, env = process.env) {
    const { areas, forwarded, unknown } = parseArgs(rawArgs);
    const empty = areas.filter((name) => countSpecs(path.join(E2E_ROOT, name)) === 0);

    // --slow / --slow=<ms> is ours, not Playwright's.
    const slowArg = forwarded.find((a) => a === "--slow" || a.startsWith("--slow="));
    const playwrightArgs = forwarded.filter((a) => a !== slowArg);

    // Playwright treats positional args as regexes over forward-slash paths, even
    // on Windows. path.join would emit backslashes, which a regex reads as escape
    // sequences and silently drops.
    playwrightArgs.push(...areas.map((name) => `tests/e2e/${name}`));

    const slowMo = slowArg
        ? Number(slowArg.split("=")[1]) || DEFAULT_SLOW_MS
        : Number(env.DWC_SLOWMO) || 0;

    // Playwright's own --headed cannot reach the `workers` expression in the config,
    // which would leave eight visible browsers racing. Detect it and set the env var
    // the config reads, so headed always means one browser.
    const isHeaded =
        playwrightArgs.includes("--headed") || env.DWC_HEADED === "1" || env.DWC_HEADED === "true";

    return {
        areas,
        unknown,
        empty,
        playwrightArgs,
        slowMo,
        isHeaded,
        // The bootstrap area contains wall-clock budget assertions, which are only
        // meaningful with the machine to ourselves -- and only when it is the whole run.
        perfOnly: areas.length === 1 && areas[0] === "bootstrap",
    };
}

function main() {
    const rawArgs = process.argv.slice(2);

    if (rawArgs.includes("--list") || rawArgs.includes("--list-categories")) {
        printCategories();
        process.exit(0);
    }

    const { areas, unknown, empty, playwrightArgs, slowMo, isHeaded, perfOnly } = planRun(rawArgs);

    if (unknown.length) {
        console.error(`No such test area: ${unknown.map((a) => `"${a}"`).join(", ")}\n`);
        printCategories();
        process.exit(1);
    }

    if (empty.length) {
        console.error(
            `${empty.map((a) => `"${a}"`).join(", ")} ` +
                `exist${empty.length === 1 ? "s" : ""} but ha${empty.length === 1 ? "s" : "ve"} ` +
                `no .spec.js files yet.`
        );
        process.exit(1);
    }

    const stamp = runStamp();
    const runDir = path.join(RUNS_ROOT, stamp);
    fs.mkdirSync(runDir, { recursive: true });

    if (areas.length) {
        console.log(
            `Running ${areas.length} area${areas.length === 1 ? "" : "s"}: ${areas.join(", ")}`
        );
    }
    if (isHeaded) {
        console.log(
            `Headed mode: one worker, ${slowMo ? `${slowMo}ms between actions` : "full speed"}.`
        );
    }

    let playwrightCli;
    try {
        playwrightCli = require.resolve("@playwright/test/cli");
    } catch {
        console.error("Could not resolve @playwright/test -- run `npm install` first.");
        process.exit(1);
    }

    const startedAt = Date.now();
    // Run Playwright's CLI under the current Node binary rather than shelling out to
    // npx: on Windows, Node refuses to spawn .cmd shims without a shell.
    const result = spawnSync(process.execPath, [playwrightCli, "test", ...playwrightArgs], {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
        env: {
            ...process.env,
            DWC_REPORT_DIR: runDir,
            DWC_HEADED: isHeaded ? "1" : "",
            DWC_SLOWMO: String(slowMo),
            DWC_WORKERS: perfOnly ? "1" : process.env.DWC_WORKERS || "",
        },
    });

    if (result.error) {
        console.error(`\nCould not start Playwright: ${result.error.message}`);
        process.exit(1);
    }

    const wallClockMs = Date.now() - startedAt;
    const exitCode = result.status ?? 1;
    const jsonPath = path.join(runDir, "results.json");

    if (fs.existsSync(jsonPath)) {
        const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        const rows = flattenTests(report);
        const counts = summarise(rows);
        const { total, failedCount } = writeSummary(
            runDir,
            stamp,
            rows,
            counts,
            wallClockMs,
            exitCode
        );
        console.log(
            `\n${exitCode === 0 ? "PASS" : "FAIL"}  ${counts.passed}/${total} passed, ` +
                `${failedCount} failed, ${formatDuration(wallClockMs)}`
        );
        console.log(`Summary: ${path.relative(PROJECT_ROOT, path.join(runDir, "summary.md"))}`);
    } else {
        console.error("\nNo results.json produced; Playwright may have failed to start.");
    }

    writeHistoryIndex(pruneHistory());
    process.exit(exitCode);
}

// Only when run as a command. tests/unit/run-e2e-args.spec.js imports this file to
// assert the command line it builds, and importing must not start a browser.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
