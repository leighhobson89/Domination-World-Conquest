// Close the gaps between neighbouring territories in `resources/svgMaster.svg`.
//
// THE DEFECT. Every land border on this map is drawn TWICE -- once as part of each territory --
// and the two copies were digitised independently. Measured before this ran: of 9,508 anchor
// points across 359 paths, exactly **15** coincided with a point on another path. Everywhere
// else the two sides of a border are a quarter of a unit to a unit apart, which is under a
// pixel at zoom 1 and up to five pixels at zoom 6 -- so the map grew visible slivers of sea
// between countries the further you zoomed in, and no amount of stroke work hides them,
// because the fills genuinely do not meet.
//
// WHAT IT DOES, in two passes, and both are needed.
//
//   1. WELD. Anchors from different paths that lie within `SNAP` of one another are one point
//      that was typed twice, so they are merged onto their centroid. At most one anchor per
//      path joins a cluster: two anchors of the SAME path merged onto one point would collapse
//      the segment between them to zero length, which is a spike or a self-touching outline.
//
//   2. STITCH. Welding is not enough on its own, and this is the half that is easy to miss. The
//      two sides of a border rarely have the same NUMBER of points: Canada may turn where the
//      United States runs straight. Those unmatched vertices leave a sliver as wide as the
//      turn, with nothing to weld them to. So every anchor that lies within `SNAP` of another
//      path's SEGMENT -- and not near either of that segment's ends -- is inserted into that
//      segment as a new vertex at exactly the anchor's position. After it, both sides of the
//      border pass through the same set of points and the fills meet.
//
// A cubic segment is split with de Casteljau at the nearest parameter, so a curved coastline
// keeps its shape rather than being flattened to a line through the new point.
//
// WHAT IT DELIBERATELY DOES NOT DO. It never moves a point further than `SNAP`, so no border
// is redrawn and no territory changes shape in any way a player could see -- the largest
// movement it is capable of is under a pixel at world zoom. It does not merge two paths, does
// not remove a vertex, and does not touch anything but the `d` attributes.
//
// **`npm run build:data` AFTERWARDS, ALWAYS.** `resources/pathAreas.json` guards itself on the
// SVG's byte length and silently falls back to measuring all 359 paths at bootstrap when it
// does not match, so a stale cache is invisible except as a slower boot.
//
// **THE NEIGHBOUR GRAPH IS NOT AT RISK, and it is worth knowing why.** The obvious fear is
// that closing a gap makes two territories neighbours that were not, changing the game.
// `resources/adjacency.json` is not derived from these outlines at all: `build-adjacency.mjs`
// reads `resources/closestPathsData.json` and uses the SVG only for territory NAMES. Measured
// on this change, the regenerated file was byte-identical.
//
// **AREA IS AT RISK, mildly, and area feeds the economy.** `pathAreas.json` is normalised to a
// fixed world total, so every territory's share moves a little when any outline does. Measured:
// median 0.05%, ninetieth percentile 1.5%, and the outliers are the microstates -- Gibraltar
// +13%, Singapore -10% -- where a tenth of a small bounding box is a large share of a small
// area. Their absolute contribution is a rounding error in a 136-million-km2 world, but a
// seeded run started before this change will not reproduce exactly after it.
//
//   node tools/weld-map-borders.mjs            report what it would do, write nothing
//   node tools/weld-map-borders.mjs --write    do it
//   node tools/weld-map-borders.mjs --snap=0.6 try a different tolerance

import { readFileSync, writeFileSync } from "node:fs";

const SVG_URL = new URL("../resources/svgMaster.svg", import.meta.url);

/**
 * How far apart two points may be and still be treated as the same point, in map user units.
 *
 * The map is 1947 units wide and renders at about 0.82 units per pixel at zoom 1, so 0.75 is
 * roughly six tenths of a pixel there and three and a half at maximum zoom. It was chosen
 * against the measured distribution rather than by eye: 3,352 of the 4,995 anchors that have a
 * foreign anchor within two units have one within half a unit, and the count is still climbing
 * gently at 0.75 and flattens after 1.0 -- so 0.75 takes the bulk of the real border points
 * and stops short of the range where two points are genuinely different places.
 */
const DEFAULT_SNAP = 0.75;

/**
 * The tolerance the SECOND pass is allowed, and why it may be nearly twice the first.
 *
 * The first pass is deliberately timid because it has no idea what it is looking at: two points
 * a unit apart might be two typings of one corner, or might be two countries facing each other
 * across a strait, and welding the second pair would draw a land bridge that does not exist.
 *
 * After the first pass that ambiguity is gone. Two territories that now share an EXACT point
 * are two territories that genuinely share a border, and between that pair a wider tolerance
 * cannot invent a connection -- it can only finish one. So the second pass runs at this
 * tolerance and refuses every pair the first pass did not prove. Measured on the shipped map,
 * the worst remaining separations between real neighbours were about 1.2 units, which is why
 * this sits above that and below the 2.0 where genuinely separate coastlines begin.
 */
const NEIGHBOUR_SNAP = 1.6;

/**
 * No point may move further than this fraction of its own territory's size.
 *
 * A tolerance in absolute units is the right idea for Canada and a disaster for Singapore. The
 * first run of this tool moved Singapore's area by **35%** and Gibraltar's by 18%, because a
 * unit and a half is most of the way across them -- while the median territory moved 0.05%.
 * The fix is not a smaller tolerance, which would abandon the borders that actually needed the
 * work; it is to measure the tolerance against the SHAPE BEING EDITED. A tenth of a territory's
 * bounding diagonal is invisible on any territory and is what keeps the microstates the shape
 * the map drew them.
 *
 * A point that would have to move further than its cap simply does not join the weld, so a
 * corner of Singapore stays where it is and its neighbour keeps its own point. That is a gap
 * left open ON PURPOSE, in the one place where closing it would be worse than the gap.
 */
const SIZE_CAP_FRACTION = 0.1;

/** `d` -> subpaths of `{ start, segs, closed }`; segs are `["L", p]` or `["C", c1, c2, p]`. */
function parsePathData(d) {
    const tokens = d.match(/[A-Za-z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
    const subpaths = [];
    let current = null;
    let command = null;
    let index = 0;

    const number = () => Number(tokens[index++]);

    while (index < tokens.length) {
        const token = tokens[index];
        if (/^[A-Za-z]$/.test(token)) {
            command = token.toUpperCase();
            index++;
            if (command === "Z") {
                if (current) current.closed = true;
                continue;
            }
            if (command === "M") {
                const start = [number(), number()];
                current = { start, segs: [], closed: false };
                subpaths.push(current);
                //A moveto followed by bare pairs means lineto, which this file uses everywhere.
                command = "L";
                continue;
            }
            //Every letter is tokenised, not just the four this understands, so an arc or a
            //quadratic THROWS here instead of being skipped and leaving its coordinates to be
            //read as points of the previous command -- which would rewrite the map wrongly and
            //say nothing about it.
            if (command !== "L" && command !== "C") {
                throw new Error(`unhandled path command ${command}`);
            }
        }
        if (command === "L") {
            current.segs.push(["L", [number(), number()]]);
        } else if (command === "C") {
            current.segs.push([
                "C",
                [number(), number()],
                [number(), number()],
                [number(), number()]
            ]);
        } else {
            throw new Error(`unhandled path command ${command}`);
        }
    }
    return subpaths;
}

/**
 * Three decimals, trailing zeros stripped -- the file's own style.
 *
 * Byte-for-byte round-tripping matters here: it is what makes the diff of this change the
 * points that MOVED and nothing else, on a file of 359 paths.
 */
function formatNumber(value) {
    const fixed = value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return fixed === "-0" || fixed === "" ? "0" : fixed;
}

function writePathData(subpaths) {
    const parts = [];
    for (const subpath of subpaths) {
        parts.push(`M ${formatNumber(subpath.start[0])} ${formatNumber(subpath.start[1])}`);
        for (const seg of subpath.segs) {
            if (seg[0] === "L") {
                parts.push(`L ${formatNumber(seg[1][0])} ${formatNumber(seg[1][1])}`);
            } else {
                const [, c1, c2, end] = seg;
                parts.push(
                    `C ${formatNumber(c1[0])} ${formatNumber(c1[1])}` +
                    ` ${formatNumber(c2[0])} ${formatNumber(c2[1])}` +
                    ` ${formatNumber(end[0])} ${formatNumber(end[1])}`
                );
            }
        }
        if (subpath.closed) {
            parts.push("Z");
        }
    }
    return parts.join(" ");
}

/** Every anchor in a path, as references that can be written through. */
function anchorsOf(subpaths) {
    const out = [];
    for (const subpath of subpaths) {
        out.push({ point: subpath.start, holder: subpath, key: "start" });
        for (const seg of subpath.segs) {
            out.push({ point: seg[seg.length - 1], holder: seg, key: seg.length - 1 });
        }
    }
    return out;
}

function setAnchor(anchor, x, y) {
    anchor.holder[anchor.key] = [x, y];
    anchor.point = anchor.holder[anchor.key];
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** How far a point of this path may move: the tolerance, capped by the territory's own size. */
function capsFor(paths, snap) {
    return paths.map(path => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const anchor of anchorsOf(path.subpaths)) {
            minX = Math.min(minX, anchor.point[0]);
            minY = Math.min(minY, anchor.point[1]);
            maxX = Math.max(maxX, anchor.point[0]);
            maxY = Math.max(maxY, anchor.point[1]);
        }
        const diagonal = Math.hypot(maxX - minX, maxY - minY);
        return Math.min(snap, diagonal * SIZE_CAP_FRACTION);
    });
}

/** An unordered pair of path indexes, as a key. */
const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Which pairs of paths PROVABLY share a border: they have a point in common.
 *
 * This is the whole safety argument for the second pass. It is derived from the geometry after
 * the first weld rather than read out of `resources/adjacency.json`, deliberately -- that file
 * carries hand-added crossings (five straits and a good deal of the Pacific) which are exactly
 * the pairs that must NOT be pulled together.
 */
function touchingPairs(all) {
    const byPoint = new Map();
    for (const anchor of all) {
        const key = `${anchor.point[0]},${anchor.point[1]}`;
        if (!byPoint.has(key)) byPoint.set(key, new Set());
        byPoint.get(key).add(anchor.owner);
    }
    const pairs = new Set();
    for (const owners of byPoint.values()) {
        const list = [...owners];
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                pairs.add(pairKey(list[i], list[j]));
            }
        }
    }
    return pairs;
}

/** A grid of points for "everything within r of (x, y)". */
function spatialIndex(items, cell) {
    const grid = new Map();
    items.forEach((item, index) => {
        const key = `${Math.floor(item.point[0] / cell)},${Math.floor(item.point[1] / cell)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
    });
    return {
        near(x, y) {
            const cx = Math.floor(x / cell);
            const cy = Math.floor(y / cell);
            const found = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const bucket = grid.get(`${cx + dx},${cy + dy}`);
                    if (bucket) found.push(...bucket);
                }
            }
            return found;
        }
    };
}

/**
 * PASS 1 -- weld near-coincident anchors from different paths onto their centroid.
 *
 * Greedy from a seed rather than transitive: a chain of points each within the tolerance of the
 * next would otherwise drag one end of it onto the other, which is a move nobody asked for.
 */
function weld(all, snap, allowed = null, caps = null) {
    const capOf = (owner) => (caps ? caps[owner] : snap);
    const index = spatialIndex(all, Math.max(snap * 2, 1));
    const done = new Set();
    let moved = 0;
    let worst = 0;

    all.forEach((anchor, i) => {
        if (done.has(i)) return;

        const cluster = [i];
        const claimed = new Set([anchor.owner]);
        //Nearest first, so that when two anchors of one path are both in range the one that is
        //really the shared corner is the one that joins.
        const candidates = index
            .near(anchor.point[0], anchor.point[1])
            .filter(j => j !== i && !done.has(j) &&
                distance(all[j].point, anchor.point) <=
                    Math.min(capOf(anchor.owner), capOf(all[j].owner)))
            .sort((a, b) => distance(all[a].point, anchor.point) - distance(all[b].point, anchor.point));

        for (const j of candidates) {
            //ONE ANCHOR PER PATH. Two anchors of the same path merged onto one point collapse
            //the segment between them to nothing, which draws as a spike.
            if (claimed.has(all[j].owner)) continue;
            //The second pass welds only between pairs the first pass proved share a border.
            if (allowed && !allowed.has(pairKey(anchor.owner, all[j].owner))) continue;
            claimed.add(all[j].owner);
            cluster.push(j);
        }

        if (cluster.length < 2) return;

        //NOBODY MOVES FURTHER THAN THEIR OWN CAP. The centroid of a cluster can sit outside one
        //member's allowance even when every pair was inside it, so the furthest member is
        //dropped and the centroid recomputed until what is left can all reach it.
        let cx = 0;
        let cy = 0;
        for (;;) {
            cx = cluster.reduce((sum, k) => sum + all[k].point[0], 0) / cluster.length;
            cy = cluster.reduce((sum, k) => sum + all[k].point[1], 0) / cluster.length;
            if (cluster.length < 2) return;
            let worstIndex = -1;
            let worstOver = 0;
            cluster.forEach((k, at) => {
                const over = distance(all[k].point, [cx, cy]) - capOf(all[k].owner);
                if (over > worstOver) {
                    worstOver = over;
                    worstIndex = at;
                }
            });
            if (worstIndex < 0) break;
            cluster.splice(worstIndex, 1);
        }
        for (const k of cluster) {
            worst = Math.max(worst, distance(all[k].point, [cx, cy]));
            setAnchor(all[k], cx, cy);
            done.add(k);
            moved++;
        }
    });

    return { moved, worst };
}

/** Split a cubic at t, returning the two halves' control points (de Casteljau). */
function splitCubic(p0, c1, c2, p3, t) {
    const lerp = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a = lerp(p0, c1);
    const b = lerp(c1, c2);
    const c = lerp(c2, p3);
    const d = lerp(a, b);
    const e = lerp(b, c);
    const f = lerp(d, e);
    return { first: [a, d, f], second: [e, c, p3], mid: f };
}

/** The parameter of the closest point on a segment to `p`, and the distance to it. */
function closestOnLine(p0, p1, p) {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return { t: 0, distance: distance(p0, p) };
    let t = ((p[0] - p0[0]) * dx + (p[1] - p0[1]) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    return { t, distance: Math.hypot(p0[0] + dx * t - p[0], p0[1] + dy * t - p[1]) };
}

function cubicAt(p0, c1, c2, p3, t) {
    const u = 1 - t;
    return [
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]
    ];
}

/** The closest point on a cubic, by sampling then bisecting. Exact enough at this scale. */
function closestOnCubic(p0, c1, c2, p3, p) {
    let bestT = 0;
    let best = Infinity;
    for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const d = distance(cubicAt(p0, c1, c2, p3, t), p);
        if (d < best) {
            best = d;
            bestT = t;
        }
    }
    let step = 1 / 24;
    for (let refine = 0; refine < 20; refine++) {
        step /= 2;
        for (const t of [bestT - step, bestT + step]) {
            if (t < 0 || t > 1) continue;
            const d = distance(cubicAt(p0, c1, c2, p3, t), p);
            if (d < best) {
                best = d;
                bestT = t;
            }
        }
    }
    return { t: bestT, distance: best };
}

/**
 * PASS 2 -- stitch: give every segment a vertex wherever another path already has one.
 *
 * Runs after the weld, so anything that was going to become a shared corner already is one and
 * is skipped here by the endpoint test. What is left is the genuine mismatch: a turn on one
 * side of the border that the other side runs straight past.
 */
function stitch(paths, all, snap, allowed = null, caps = null) {
    const capOf = (owner) => (caps ? caps[owner] : snap);
    const index = spatialIndex(all, Math.max(snap * 2, 1));
    let inserted = 0;

    for (const path of paths) {
        for (const subpath of path.subpaths) {
            const rebuilt = [];
            let from = subpath.start;

            for (const seg of subpath.segs) {
                const to = seg[seg.length - 1];

                //Everything foreign near this segment's bounding box, once.
                const nearby = new Set();
                for (const point of [from, to, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]]) {
                    for (const j of index.near(point[0], point[1])) {
                        if (all[j].owner === path.index) continue;
                        if (allowed && !allowed.has(pairKey(path.index, all[j].owner))) continue;
                        nearby.add(j);
                    }
                }

                const hits = [];
                for (const j of nearby) {
                    const p = all[j].point;
                    //Already an endpoint of this segment: the weld dealt with it.
                    if (distance(p, from) <= 1e-9 || distance(p, to) <= 1e-9) continue;

                    const found = seg[0] === "L"
                        ? closestOnLine(from, to, p)
                        : closestOnCubic(from, seg[1], seg[2], to, p);
                    //The receiving path is the one whose outline gains a point, so the cap
                    //that applies is its own.
                    if (found.distance > Math.min(capOf(path.index), capOf(all[j].owner))) continue;
                    //Not at the very ends, where it would make a zero-length segment.
                    if (found.t <= 1e-6 || found.t >= 1 - 1e-6) continue;
                    hits.push({ t: found.t, point: p });
                }

                if (hits.length === 0) {
                    rebuilt.push(seg);
                    from = to;
                    continue;
                }

                hits.sort((a, b) => a.t - b.t);
                //DEDUPE BY POSITION. After the weld, several paths meeting at one corner all
                //carry an anchor at the SAME coordinates, so the same point arrives here once
                //per path and would be inserted once per path -- 217 zero-length segments on
                //the first run. They render as nothing and mean nothing, but they are noise in
                //a file that is read by hand.
                const seen = new Set();
                const unique = [];
                for (const hit of hits) {
                    const key = `${hit.point[0].toFixed(3)},${hit.point[1].toFixed(3)}`;
                    if (seen.has(key)) continue;
                    if (distance(hit.point, from) <= 1e-9 || distance(hit.point, to) <= 1e-9) continue;
                    seen.add(key);
                    unique.push(hit);
                }
                hits.length = 0;
                hits.push(...unique);
                if (hits.length === 0) {
                    rebuilt.push(seg);
                    from = to;
                    continue;
                }
                if (seg[0] === "L") {
                    for (const hit of hits) {
                        rebuilt.push(["L", [hit.point[0], hit.point[1]]]);
                        inserted++;
                    }
                    rebuilt.push(seg);
                } else {
                    //Split the curve at each hit in turn, keeping the shape of what is left.
                    let p0 = from;
                    let c1 = seg[1];
                    let c2 = seg[2];
                    const end = to;
                    let consumed = 0;
                    for (const hit of hits) {
                        const t = (hit.t - consumed) / (1 - consumed);
                        if (!(t > 1e-6 && t < 1 - 1e-6)) continue;
                        const split = splitCubic(p0, c1, c2, end, t);
                        //The new vertex sits exactly on the other path's anchor, not on the
                        //curve: that is the whole point, and the error is under `snap`.
                        rebuilt.push(["C", split.first[0], split.first[1], [hit.point[0], hit.point[1]]]);
                        inserted++;
                        p0 = [hit.point[0], hit.point[1]];
                        c1 = split.second[0];
                        c2 = split.second[1];
                        consumed = hit.t;
                    }
                    rebuilt.push(["C", c1, c2, end]);
                }
                from = to;
            }

            subpath.segs = rebuilt;
        }
    }

    return inserted;
}

function main() {
    const args = process.argv.slice(2);
    const write = args.includes("--write");
    const snapArg = args.find(a => a.startsWith("--snap="));
    const snap = snapArg ? Number(snapArg.split("=")[1]) : DEFAULT_SNAP;

    const source = readFileSync(SVG_URL, "utf8");
    const matches = [...source.matchAll(/<path\b[^>]*?\sd="([^"]+)"[^>]*>/g)];

    const paths = matches.map((match, index) => ({
        index,
        match,
        original: match[1],
        subpaths: parsePathData(match[1])
    }));

    //A guarantee worth checking rather than assuming: if the writer is not byte-exact on the
    //untouched paths, the diff of this change is the whole file and nobody can review it.
    const drift = paths.filter(p => writePathData(p.subpaths) !== p.original.trim()).length;
    if (drift > 0) {
        console.error(`refusing to run: ${drift} paths do not survive a re-write unchanged`);
        process.exitCode = 1;
        return;
    }

    const all = [];
    for (const path of paths) {
        for (const anchor of anchorsOf(path.subpaths)) {
            all.push({ ...anchor, owner: path.index });
        }
    }

    const before = all.length;
    const caps = capsFor(paths, snap);
    const welded = weld(all, snap, null, caps);

    //The anchor list is rebuilt because the weld replaced point arrays in place.
    const afterWeld = [];
    for (const path of paths) {
        for (const anchor of anchorsOf(path.subpaths)) {
            afterWeld.push({ ...anchor, owner: path.index });
        }
    }
    const inserted = stitch(paths, afterWeld, snap, null, caps);

    //SECOND PASS, at a wider tolerance and only between pairs the first pass proved share a
    //border. This is what finishes the seams the timid tolerance could not reach: the worst
    //real neighbours on this map were about 1.2 units apart, and no amount of care at 0.75
    //closes those without also risking a land bridge across a strait.
    const anchorsNow = () => {
        const list = [];
        for (const path of paths) {
            for (const anchor of anchorsOf(path.subpaths)) {
                list.push({ ...anchor, owner: path.index });
            }
        }
        return list;
    };
    const neighbours = touchingPairs(anchorsNow());
    const wideCaps = capsFor(paths, NEIGHBOUR_SNAP);
    const wideWeld = weld(anchorsNow(), NEIGHBOUR_SNAP, neighbours, wideCaps);
    const wideInserted = stitch(paths, anchorsNow(), NEIGHBOUR_SNAP, neighbours, wideCaps);

    const changed = paths.filter(p => writePathData(p.subpaths) !== p.original.trim());

    console.log(`tolerance          ${snap} user units`);
    console.log(`anchors            ${before}`);
    console.log(`welded             ${welded.moved} (largest move ${welded.worst.toFixed(3)})`);
    console.log(`stitched in        ${inserted} new vertices`);
    console.log(`proven neighbours  ${neighbours.size} pairs share a point`);
    console.log(`pass 2 welded      ${wideWeld.moved} (largest move ${wideWeld.worst.toFixed(3)})`);
    console.log(`pass 2 stitched    ${wideInserted} new vertices`);
    console.log(`paths changed      ${changed.length} of ${paths.length}`);

    if (!write) {
        console.log("\nnothing written -- pass --write, then run `npm run build:data`");
        return;
    }

    let output = "";
    let cursor = 0;
    for (const path of paths) {
        const start = path.match.index;
        const end = start + path.match[0].length;
        const replacement = path.match[0].replace(
            `d="${path.original}"`,
            `d="${writePathData(path.subpaths)}"`
        );
        output += source.slice(cursor, start) + replacement;
        cursor = end;
    }
    output += source.slice(cursor);

    writeFileSync(SVG_URL, output);
    console.log(`\nwritten. NOW RUN \`npm run build:data\` -- pathAreas.json guards on this` +
        ` file's byte length and adjacency.json is derived from these outlines.`);
}

main();
