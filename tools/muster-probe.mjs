// Where does an empire's army actually SIT?
//
// The claim `src/ai/muster.js` makes is that the interior reinforces the front. This measures
// whether it does, by the only test that matters: after N turns, how far from the nearest
// enemy is each country's infantry standing?
//
// For every country holding more than one territory it walks a breadth-first search inwards
// from the frontier -- hop 0 is a territory that touches an enemy, hop 1 is a territory that
// touches one of those, and so on -- and reports the share of infantry standing at each depth.
// A working muster puts the army at hop 0. Infantry piled at hop 2 and beyond is army that
// will never see the war it was raised for.
//
//   npm run dev                                  (in another terminal)
//   node tools/muster-probe.mjs --turns=40 --seed=alpha
//
// Same rules as tools/ai-sim.mjs: do not edit source files while a run is in flight.

import { chromium } from "playwright";
import { GameDriver } from "../tests/support/game.js";

const args = new Map(process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
}));
const turns = Number(args.get("turns") ?? 40);
const seed = args.get("seed") ?? "alpha";
const country = args.get("country") ?? "Germany";
const url = args.get("url") ?? "http://localhost:3000";
const top = Number(args.get("top") ?? 12);

function installSeededRandomSource(seedText) {
    let h = 1779033703 ^ seedText.length;
    for (let i = 0; i < seedText.length; i += 1) {
        h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    window.__seed = seedText;
    Math.random = function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function measure(topN) {
    //There is no "every territory" accessor, so the world is reassembled from the country
    //list the selection screen already computes. `owner` is carried over on conquest, so an
    //AI country's owner and dataName agree; the player's territories come back under "Player".
    const names = (window.__game.countryStrengths() ?? []).map(entry => entry[0]);
    const all = [];
    const byCountry = new Map();
    for (const name of [...names, "Player"]) {
        const held = window.__game.territoriesOwnedBy(name) ?? [];
        if (held.length === 0) continue;
        for (const t of held) all.push(t);
        byCountry.set(name, held);
    }

    const ownerOf = new Map(all.map(t => [t.territoryName, t.dataName]));
    const neighbours = new Map();
    for (const t of all) {
        neighbours.set(t.territoryName, window.__game.interactableFrom(t.territoryName) ?? []);
    }

    const rows = [];
    for (const [owner, territories] of byCountry) {
        if (!owner || territories.length < 2) continue;
        const mine = new Set(territories.map(t => t.territoryName));

        //Hop 0: touches an enemy at all.
        const depth = new Map();
        const queue = [];
        for (const t of territories) {
            const touchesEnemy = (neighbours.get(t.territoryName) ?? [])
                .some(n => ownerOf.has(n) && !mine.has(n));
            if (touchesEnemy) { depth.set(t.territoryName, 0); queue.push(t.territoryName); }
        }
        for (let i = 0; i < queue.length; i += 1) {
            const here = queue[i];
            const d = depth.get(here);
            for (const n of neighbours.get(here) ?? []) {
                if (!mine.has(n) || depth.has(n)) continue;
                depth.set(n, d + 1);
                queue.push(n);
            }
        }

        const buckets = [];
        const forceBuckets = [];
        let totalInfantry = 0;
        let totalForce = 0;
        let unreachable = 0;
        let vehiclesForward = 0;
        let vehiclesTotal = 0;
        for (const t of territories) {
            const inf = Number(t.infantryForCurrentTerritory) || 0;
            const force = Number(t.armyForCurrentTerritory) || 0;
            const vehicles = (Number(t.useableAssault) || 0) + (Number(t.useableAir) || 0) +
                (Number(t.useableNaval) || 0);
            totalInfantry += inf;
            totalForce += force;
            vehiclesTotal += vehicles;
            if (depth.get(t.territoryName) === 0) vehiclesForward += vehicles;
            const d = depth.get(t.territoryName);
            if (d === undefined) { unreachable += inf; continue; }
            const bucket = Math.min(d, 4);
            buckets[bucket] = (buckets[bucket] ?? 0) + inf;
            forceBuckets[bucket] = (forceBuckets[bucket] ?? 0) + force;
        }
        rows.push({
            owner,
            territories: territories.length,
            frontline: [...depth.values()].filter(d => d === 0).length,
            totalInfantry,
            buckets: Array.from({ length: 5 }, (_, i) => buckets[i] ?? 0),
            forceBuckets: Array.from({ length: 5 }, (_, i) => forceBuckets[i] ?? 0),
            totalForce,
            vehiclesForward,
            vehiclesTotal,
            unreachable
        });
    }
    rows.sort((a, b) => b.territories - a.territories);
    return rows.slice(0, topN);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: url });
const page = await context.newPage();
await page.addInitScript(installSeededRandomSource, seed);
page.on("pageerror", e => console.log("pageerror: " + e.message));

const game = new GameDriver(page);
console.log(`seed "${seed}", ${turns} turns, player idles as ${country}`);
await game.start({ country, seed });
for (let turn = 1; turn <= turns; turn += 1) {
    await game.playTurn();
    if (turn % 10 === 0) console.log(`  ...turn ${turn}`);
}

const rows = await page.evaluate(measure, top);
console.log("");
console.log("infantry by hops from the nearest enemy border (hop 0 = front line)");
console.log("country                terr  front        total    hop0    hop1    hop2    hop3   hop4+  unreach");
for (const r of rows) {
    const pct = v => (r.totalInfantry ? (100 * v / r.totalInfantry).toFixed(0) + "%" : "-").padStart(7);
    console.log(
        r.owner.padEnd(22).slice(0, 22) +
        String(r.territories).padStart(5) +
        String(r.frontline).padStart(7) +
        String(Math.round(r.totalInfantry / 1000) + "k").padStart(13) +
        r.buckets.map(pct).join("") +
        pct(r.unreachable)
    );
}
const deep = rows.reduce((s, r) => s + r.buckets[2] + r.buckets[3] + r.buckets[4] + r.unreachable, 0);
const all = rows.reduce((s, r) => s + r.totalInfantry, 0);
console.log("");
console.log(`across these ${rows.length} empires: ${(100 * deep / (all || 1)).toFixed(1)}% of infantry stands two or more hops from any enemy`);
const deepForce = rows.reduce((s, r) => s + r.forceBuckets[2] + r.forceBuckets[3] + r.forceBuckets[4], 0);
const allForce = rows.reduce((s, r) => s + r.totalForce, 0);
const vf = rows.reduce((s, r) => s + r.vehiclesForward, 0);
const vt = rows.reduce((s, r) => s + r.vehiclesTotal, 0);
console.log(`by FORCE rather than head count: ${(100 * deepForce / (allForce || 1)).toFixed(1)}% two or more hops back`);
console.log(`useable vehicles standing on the front line: ${vf} of ${vt} (${(100 * vf / (vt || 1)).toFixed(1)}%)`);

await browser.close();
