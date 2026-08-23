#!/usr/bin/env node
//
// Regenerates resources/adjacency.json from resources/closestPathsData.json.
//
//   node tools/build-adjacency.mjs [--check]
//
// --check verifies the committed output matches what this script would produce
// and exits non-zero if not, without writing anything.
//
// WHY THIS EXISTS
//
// closestPathsData.json is 19 MB, almost entirely full-precision {x,y} coordinate
// pairs describing the closest points between neighbouring territories. Nothing
// reads them. Every consumer -- buildFullTerritoriesInRangeArray,
// buildAttackableTerritoriesInRangeArray, formatAttackableTerritoriesArray,
// calculateThreatsFromEachEnemyTerritoryToEachFriendlyTerritory -- only ever
// touches element [0] of each neighbour tuple, the territory name. The map's live
// closest-point maths (findClosestPaths in ui.js) is computed from the SVG at
// runtime and does not use this file at all.
//
// Dropping the coordinates takes the file from 19 MB to ~78 KB.
//
// SELF-REFERENCE
//
// In the source data a territory's neighbour list begins with the territory
// itself. The old loader dropped element [0] positionally; this script strips it
// by name, which is equivalent but does not depend on ordering.
//
// NAMES COME FROM THE SVG, NOT FROM tests/uniqueIdLookup.json
//
// resources/svgMaster.svg is the authoritative source of territory names, because
// it is what the running game reads. tests/uniqueIdLookup.json is a convenience
// map that has drifted: it says "Grand Bahama" and "Andros Island" where the SVG
// says "Grand Bahama (Bahamas)" and "Andros Island (Bahamas)". Building against
// the lookup file silently failed to strip self for those two territories, and
// made the manual adjacency rules for them look like typos when they were correct.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "resources", "closestPathsData.json");
const OUTPUT = path.join(ROOT, "resources", "adjacency.json");
const SVG = path.join(ROOT, "resources", "svgMaster.svg");

/** uniqueId -> territory-name, read from the SVG. */
function territoryNamesFromSvg() {
    const svg = fs.readFileSync(SVG, "utf8");
    const pattern = /territory-name="([^"]*)"[^>]*uniqueid="(\d+)"/g;
    const byId = {};
    let match;
    while ((match = pattern.exec(svg)) !== null) {
        byId[match[2]] = match[1];
    }
    return byId;
}

function build() {
    const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
    const idToName = territoryNamesFromSvg();
    const knownNames = new Set(Object.values(idToName));

    const compact = {};
    const stats = { entries: 0, selfStripped: 0, noSelfListed: [], unknownNames: new Set() };

    for (const [uniqueId, neighbours] of source) {
        const self = idToName[uniqueId];
        const names = neighbours.map((neighbour) => neighbour[0]);

        if (self === undefined) {
            throw new Error(`uniqueId ${uniqueId} has no territory-name in svgMaster.svg`);
        }
        for (const name of names) {
            if (!knownNames.has(name)) {
                stats.unknownNames.add(name);
            }
        }
        if (names.includes(self)) {
            stats.selfStripped += 1;
        } else {
            stats.noSelfListed.push(`${uniqueId} (${self})`);
        }

        compact[uniqueId] = names.filter((name) => name !== self);
        stats.entries += 1;
    }

    // A neighbour naming a territory that does not exist would be silently
    // unreachable at runtime. Fail loudly instead.
    if (stats.unknownNames.size) {
        throw new Error(
            `Adjacency data references territories that are not in the SVG: ` +
                [...stats.unknownNames].map((n) => JSON.stringify(n)).join(", ")
        );
    }

    return { compact, stats };
}

const { compact, stats } = build();
const serialised = JSON.stringify(compact);
const checking = process.argv.includes("--check");

if (checking) {
    if (!fs.existsSync(OUTPUT)) {
        console.error(`FAIL: ${path.relative(ROOT, OUTPUT)} does not exist. Run without --check.`);
        process.exit(1);
    }
    const current = fs.readFileSync(OUTPUT, "utf8");
    if (current !== serialised) {
        console.error(
            `FAIL: ${path.relative(ROOT, OUTPUT)} is stale. Run: node tools/build-adjacency.mjs`
        );
        process.exit(1);
    }
    console.log(`OK: ${path.relative(ROOT, OUTPUT)} is up to date (${stats.entries} territories).`);
    process.exit(0);
}

fs.writeFileSync(OUTPUT, serialised, "utf8");

const before = fs.statSync(SOURCE).size;
const after = fs.statSync(OUTPUT).size;
console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
console.log(`  territories:   ${stats.entries}`);
console.log(`  self stripped: ${stats.selfStripped}`);
if (stats.noSelfListed.length) {
    console.log(`  did not list themselves (kept intact): ${stats.noSelfListed.join(", ")}`);
}
console.log(
    `  size:          ${(before / 1048576).toFixed(2)} MB -> ${(after / 1024).toFixed(1)} KB ` +
        `(-${(100 * (1 - after / before)).toFixed(2)}%)`
);
