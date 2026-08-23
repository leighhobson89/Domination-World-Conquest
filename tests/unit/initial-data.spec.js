import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { dataTableCountriesInitialState } from "../../initialData.js";

// Integrity of the seed data the whole world is built from.
//
// These run in Node because `initialData.js` is one of the very few root modules
// with no DOM side effects at import time -- most of the others call
// `document.getElementById` while evaluating, which is why the numeric coverage
// for the rules themselves has to wait for refactor Phase 5.
//
// resources/svgMaster.svg is the authoritative source of territory and country
// names; `initialData.js` supplies each country's starting figures. A country in
// one and not the other is dead weight at best and a crash at worst.

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SVG = path.join(ROOT, "resources", "svgMaster.svg");
const FLAGS = path.join(ROOT, "resources", "flags");

/** Every distinct `data-name` on the starting map. */
function countriesOnTheMap() {
    const svg = fs.readFileSync(SVG, "utf8");
    return new Set([...svg.matchAll(/data-name="([^"]+)"/g)].map((match) => match[1]));
}

const countries = dataTableCountriesInitialState;

describe("initialData.js", () => {
    it("gives every country a unique id and a unique name", () => {
        const ids = new Set(countries.map((country) => country.id));
        const names = new Set(countries.map((country) => country.country));

        expect(ids.size, "duplicate ids").toBe(countries.length);
        expect(names.size, "duplicate country names").toBe(countries.length);
    });

    it("gives every country a complete set of starting figures", () => {
        const required = [
            "country",
            "startingPop",
            "area",
            "startingArmy",
            "continent",
            "res_gold",
            "res_oil",
            "res_food",
            "res_cons_mats",
            "dev_index",
        ];

        const incomplete = countries
            .filter((country) => required.some((key) => country[key] === undefined))
            .map((country) => country.country);

        expect(incomplete).toEqual([]);
    });

    it("keeps every numeric figure positive and finite", () => {
        const numeric = [
            "startingPop",
            "area",
            "startingArmy",
            "res_gold",
            "res_oil",
            "res_food",
            "res_cons_mats",
            "dev_index",
        ];

        const bad = [];
        for (const country of countries) {
            for (const key of numeric) {
                const value = country[key];
                if (!Number.isFinite(value) || value < 0) {
                    bad.push(`${country.country}.${key} = ${value}`);
                }
            }
        }

        expect(bad).toEqual([]);
    });

    it("keeps dev_index inside 0..1", () => {
        const outside = countries
            .filter((country) => country.dev_index <= 0 || country.dev_index > 1)
            .map((country) => `${country.country}: ${country.dev_index}`);

        expect(outside).toEqual([]);
    });

    it("uses only the six continents the game colours and modifies", () => {
        // Every economy formula switches on this string and silently leaves its
        // modifier `undefined` -- and the result NaN -- for anything unrecognised.
        const known = new Set([
            "Europe",
            "North America",
            "South America",
            "Asia",
            "Africa",
            "Oceania",
        ]);
        const unknown = [
            ...new Set(countries.map((country) => country.continent).filter((c) => !known.has(c))),
        ];

        expect(unknown).toEqual([]);
    });

    it("describes every country that actually appears on the map", () => {
        const onTheMap = countriesOnTheMap();
        const described = new Set(countries.map((country) => country.country));

        const missing = [...onTheMap].filter((name) => !described.has(name)).sort();
        expect(missing, "on the map but with no starting data").toEqual([]);
    });

    it("carries exactly one country that is not on the map, and it is Faroe Islands", () => {
        // Recorded rather than fixed: audit section 2 notes this entry has no SVG
        // path and is dead data. Pinning it means a SECOND orphan shows up as a
        // failure rather than sliding in unnoticed.
        const onTheMap = countriesOnTheMap();
        const orphans = countries
            .map((country) => country.country)
            .filter((name) => !onTheMap.has(name))
            .sort();

        expect(orphans).toEqual(["Faroe Islands"]);
    });

    it("ships a flag image for every country on the map", () => {
        // setFlag() builds `./resources/flags/${name}.png` by concatenation and has
        // no fallback, so a missing file renders as a broken image with no error.
        const missing = [...countriesOnTheMap()]
            .filter((name) => !fs.existsSync(path.join(FLAGS, `${name}.png`)))
            .sort();

        expect(missing).toEqual([]);
    });
});
