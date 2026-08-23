// Territory name <-> uniqueId, so specs can address territories the way a player
// thinks about them.
//
// The map is the convenience file `tests/uniqueIdLookup.json`. It is generated
// FROM resources/svgMaster.svg, which is the authoritative source of names -- it
// is what the running game reads. The lookup has drifted from the SVG before
// ("Grand Bahama" vs "Grand Bahama (Bahamas)"), so `verifyAgainstSvg` exists and
// the unit suite asserts the two agree. Never hand-edit the JSON.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const lookup = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "uniqueIdLookup.json"), "utf8"));

const byName = new Map(Object.entries(lookup));
const byId = new Map(Object.entries(lookup).map(([name, id]) => [String(id), name]));

/** Every territory name in the map, in file order. */
export const territoryNames = [...byName.keys()];

export function uniqueIdFor(territoryName) {
    const id = byName.get(territoryName);
    if (id === undefined) {
        throw new Error(`Unknown territory "${territoryName}" -- check resources/svgMaster.svg`);
    }
    return id;
}

export function territoryNameFor(uniqueId) {
    const name = byId.get(String(uniqueId));
    if (name === undefined) {
        throw new Error(`No territory has uniqueId ${uniqueId}`);
    }
    return name;
}

/**
 * Countries known to own more than one territory, used by the specs that check a
 * multi-territory pick hands the player all of them. Derived from the SVG rather
 * than hard-coded, because `data-name` changes on conquest and only the starting
 * map is stable.
 */
export function countriesWithSeveralTerritories() {
    const svg = fs.readFileSync(path.join(ROOT, "resources", "svgMaster.svg"), "utf8");
    const counts = new Map();
    for (const match of svg.matchAll(/data-name="([^"]+)"/g)) {
        counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

/** How many territories a country starts the game owning. */
export function startingTerritoryCount(countryName) {
    const svg = fs.readFileSync(path.join(ROOT, "resources", "svgMaster.svg"), "utf8");
    return [...svg.matchAll(/data-name="([^"]+)"/g)].filter((m) => m[1] === countryName).length;
}
