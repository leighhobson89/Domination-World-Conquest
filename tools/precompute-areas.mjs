#!/usr/bin/env node
//
// Regenerates resources/pathAreas.json from resources/svgMaster.svg.
//
//   node tools/precompute-areas.mjs [--check]
//
// --check verifies the committed output still matches the SVG and exits non-zero
// if not, without writing anything.
//
// WHY THIS EXISTS
//
// calculatePathAreas() samples 80 points along every one of the 359 territory
// paths with getPointAtLength(), then applies the shoelace formula. That is ~230ms
// of main-thread work on every single page load, and the answer never changes
// unless the SVG does. See docs/01-codebase-audit.md section 4.2.
//
// The sampling needs real SVG geometry APIs (getTotalLength, getPointAtLength),
// which is why this runs the *same* algorithm inside headless Chromium rather than
// reimplementing it against an SVG path parser in Node. Reimplementing it would
// risk the precomputed areas quietly disagreeing with the live fallback.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const SVG = path.join(ROOT, "resources", "svgMaster.svg");
const OUTPUT = path.join(ROOT, "resources", "pathAreas.json");

// Must stay identical to calculatePathAreas() in resourceCalculations.js.
const SAMPLE_POINTS = 80;
const TOTAL_WORLD_AREA_KM2 = 136067649;

async function computeAreas() {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.goto(`file:///${SVG.replace(/\\/g, "/")}`, { waitUntil: "load" });

        return await page.evaluate(
            ({ samplePoints, totalWorldArea }) => {
                const paths = Array.from(document.querySelectorAll("path"));
                const areas = [];
                let totalAreaPath = 0;

                for (const element of paths) {
                    const pathLength = element.getTotalLength();
                    const points = [];
                    for (let j = 0; j < samplePoints; j++) {
                        const point = element.getPointAtLength((j / samplePoints) * pathLength);
                        points.push({ x: point.x, y: point.y });
                    }

                    let area = 0;
                    for (let j = 0; j < points.length; j++) {
                        const k = (j + 1) % points.length;
                        area += points[j].x * points[k].y - points[j].y * points[k].x;
                    }
                    area = Math.abs(area / 2);
                    totalAreaPath += area;

                    areas.push({
                        uniqueId: element.getAttribute("uniqueid"),
                        dataName: element.getAttribute("data-name"),
                        territoryId: element.getAttribute("territory-id"),
                        area,
                    });
                }

                const scalingFactor = totalWorldArea / totalAreaPath;
                for (const entry of areas) {
                    entry.area *= scalingFactor;
                }
                return areas;
            },
            { samplePoints: SAMPLE_POINTS, totalWorldArea: TOTAL_WORLD_AREA_KM2 }
        );
    } finally {
        await browser.close();
    }
}

const areas = await computeAreas();
const svgBytes = fs.statSync(SVG).size;

const payload = {
    // Guard fields. The runtime loader checks these against the live SVG and falls
    // back to computing areas itself if anything disagrees, so an edited map can
    // never silently ship stale areas.
    svgBytes,
    pathCount: areas.length,
    sampledPoints: SAMPLE_POINTS,
    totalWorldAreaKm2: TOTAL_WORLD_AREA_KM2,
    areas,
};

const serialised = JSON.stringify(payload);

if (process.argv.includes("--check")) {
    if (!fs.existsSync(OUTPUT)) {
        console.error(`FAIL: ${path.relative(ROOT, OUTPUT)} does not exist.`);
        process.exit(1);
    }
    if (fs.readFileSync(OUTPUT, "utf8") !== serialised) {
        console.error(
            `FAIL: ${path.relative(ROOT, OUTPUT)} is stale. Run: node tools/precompute-areas.mjs`
        );
        process.exit(1);
    }
    console.log(`OK: ${path.relative(ROOT, OUTPUT)} matches the SVG (${areas.length} paths).`);
    process.exit(0);
}

fs.writeFileSync(OUTPUT, serialised, "utf8");
const sum = areas.reduce((total, entry) => total + entry.area, 0);
console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
console.log(`  paths:      ${areas.length}`);
console.log(`  total area: ${Math.round(sum).toLocaleString()} km2`);
console.log(`  size:       ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
