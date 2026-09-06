// The three places that say which continent a territory is on, reconciled.
//
// Known-issue BI. A territory's continent is decided in one place -- `initialData.js`, keyed by
// COUNTRY, so a territory belongs to the continent of the country that ORIGINALLY owned it -- and
// two other files repeat the answer:
//
//   * `resources/svgMaster.svg` carries a `continent=` attribute on every one of the 359
//     territory paths. Nothing in the game reads it today, which is exactly why it drifted
//     without anyone noticing: Easter Island is Chilean, so South American to the model, and the
//     SVG called it Oceanian. The model's Oceania was 65 territories and the SVG's was 66.
//   * `resources/SVG_coastLines.svg` carries `shadow=` on its 205 coastline paths, which is what
//     the continent view colours the boundaries from. Those paths have no territory identity at
//     all -- no id, no name -- so they cannot disagree with the model about a TERRITORY. They can
//     only disagree about which continents exist, and that is what the last test here pins.
//
// The register's worry was never that the game reads the wrong one today; it was that a fourth
// reader would pick the wrong one silently. This spec is the reconciliation, and it runs in about
// a millisecond, so the drift cannot come back.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { dataTableCountriesInitialState } from "../../initialData.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const MASTER = path.join(ROOT, "resources", "svgMaster.svg");
const COASTLINES = path.join(ROOT, "resources", "SVG_coastLines.svg");

const attributeOf = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

const territoryPaths = () =>
    (fs.readFileSync(MASTER, "utf8").match(/<path\b[^>]*>/g) ?? [])
        .map((tag) => ({
            name: attributeOf(tag, "territory-name"),
            uniqueId: attributeOf(tag, "uniqueid"),
            originalOwner: attributeOf(tag, "owner"),
            continent: attributeOf(tag, "continent"),
        }))
        .filter((row) => row.continent !== null);

const continentByCountry = new Map(
    dataTableCountriesInitialState.map((row) => [row.country, row.continent])
);

describe("continent data reconciles across its three sources", () => {
    it("gives every territory path in svgMaster.svg the continent of its original owner", () => {
        const disagreements = territoryPaths()
            .filter((row) => continentByCountry.get(row.originalOwner) !== row.continent)
            .map((row) =>
                `${row.name} (${row.originalOwner}): svg says ${row.continent}, ` +
                `the model says ${continentByCountry.get(row.originalOwner)}`);
        expect(disagreements).toEqual([]);
    });

    it("knows an original owner for every territory path", () => {
        const orphans = territoryPaths()
            .filter((row) => !continentByCountry.has(row.originalOwner))
            .map((row) => `${row.name}: no country "${row.originalOwner}" in initialData.js`);
        expect(orphans).toEqual([]);
    });

    it("counts the same six continents in the model and in the map", () => {
        //Not just the same NAMES: the same territory counts. This is the test that would have
        //caught Easter Island -- Oceania 66 against the model's 65 -- and it is the number the
        //continent bonus and the CONTINENTAL victory condition are both decided from.
        const fromSvg = {};
        for (const row of territoryPaths()) {
            fromSvg[row.continent] = (fromSvg[row.continent] ?? 0) + 1;
        }
        expect(fromSvg).toEqual({
            Asia: 87,
            Oceania: 65,
            Africa: 59,
            Europe: 52,
            "South America": 49,
            "North America": 47,
        });
    });

    it("draws its coastline boundaries in the same six continents", () => {
        //`shadow=` is a DRAWING attribute -- these paths are coastlines, not territories, so
        //there is no per-territory answer to compare. What can drift is the vocabulary: a
        //seventh name here would colour a boundary the continent view has no colour for, and
        //`CONTINENT_COLOR_ARRAY.find(...)` would throw on the undefined row rather than
        //degrading.
        const shadows = new Set(
            (fs.readFileSync(COASTLINES, "utf8").match(/shadow="([^"]*)"/g) ?? [])
                .map((match) => match.slice('shadow="'.length, -1))
        );
        expect([...shadows].sort()).toEqual([
            "Africa", "Asia", "Europe", "North America", "Oceania", "South America",
        ]);
    });
});
