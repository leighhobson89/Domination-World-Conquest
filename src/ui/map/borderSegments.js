// The stretch of outline where two territories actually touch.
//
// A territory's threat used to be drawn by colouring its WHOLE outline, which says "somewhere
// around here you are in trouble" and makes a country facing one dangerous neighbour and six
// harmless ones look encircled. What a player wants is the section of border the danger is on.
//
// **THIS IS ONLY POSSIBLE BECAUSE THE MAP IS WELDED.** Every land border used to be drawn twice
// with different coordinates -- of 9,508 anchors exactly 15 coincided -- so "the points these
// two territories have in common" was the empty set almost everywhere and this function could
// not have existed. `tools/weld-map-borders.mjs` merged those anchors onto shared points and
// stitched a vertex into either side wherever only one of them had a turn, so a shared border
// is now literally a run of identical coordinates in both paths. The test is therefore EXACT
// equality rather than a tolerance, which is what keeps it honest: a near-miss is a coastline
// facing another coastline across water, and marking that as a shared border would draw a
// warning across a sea.
//
// Pure, and it works on `d` strings rather than elements, so it runs in Node and is unit-tested
// there. The map is an `<object>` and its geometry is not otherwise reachable from a test.

/** `d` -> subpaths of `{ start, segs }`; segs are `["L", p]` or `["C", c1, c2, p]`. */
export function parseSegments(d) {
    const tokens = String(d ?? "").match(/[A-Za-z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
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
                //A closed subpath's last segment runs back to where it started, and a shared
                //border can lie on it, so it is made explicit rather than left implied.
                if (current && current.segs.length > 0) {
                    const last = current.segs[current.segs.length - 1];
                    const end = last[last.length - 1];
                    if (end[0] !== current.start[0] || end[1] !== current.start[1]) {
                        current.segs.push(["L", current.start]);
                    }
                }
                continue;
            }
            if (command === "M") {
                current = { start: [number(), number()], segs: [] };
                subpaths.push(current);
                command = "L";
                continue;
            }
            //ANY OTHER COMMAND IS A REFUSAL, and it has to be caught HERE rather than where
            //the numbers are read: an arc or a quadratic that is merely skipped leaves its
            //coordinates behind to be read as points of whatever command came before it, which
            //is a silently wrong outline rather than an absent one. This map is all M/L/C/Z.
            if (command !== "L" && command !== "C") {
                return [];
            }
        }
        if (!current) {
            break;
        }
        if (command === "L") {
            current.segs.push(["L", [number(), number()]]);
        } else if (command === "C") {
            current.segs.push([
                "C", [number(), number()], [number(), number()], [number(), number()]
            ]);
        } else {
            //An unknown command would desynchronise the token stream, and a wrong border is
            //worse than none: stop and let the caller draw nothing.
            return [];
        }
    }
    return subpaths;
}

/** A point as a key. Coordinates are written to three decimals in the file, so this is exact. */
function key(point) {
    return `${point[0]},${point[1]}`;
}

/** Every anchor of a path, as keys. */
export function anchorKeys(d) {
    const keys = new Set();
    for (const subpath of parseSegments(d)) {
        keys.add(key(subpath.start));
        for (const seg of subpath.segs) {
            keys.add(key(seg[seg.length - 1]));
        }
    }
    return keys;
}

function formatNumber(value) {
    const fixed = value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return fixed === "-0" || fixed === "" ? "0" : fixed;
}

/**
 * The part of `subject`'s outline that runs along `neighbour`'s, as a `d` string.
 *
 * A segment is on the shared border when BOTH its endpoints are anchors of the neighbour. That
 * is a stricter test than "either end touches", deliberately: at a tri-point one endpoint of a
 * segment can be shared with a country the rest of the segment runs nowhere near, and the loose
 * test draws a spur into the middle of the map.
 *
 * Segments are emitted with their own command, so a curved border stays curved -- the shared
 * run of a coastline is not redrawn as a chord.
 *
 * `subjectData` may be the `d` string or an already-parsed `parseSegments()` result. A
 * territory can be threatened from several directions at once and is then asked about once per
 * neighbour, so its outline is parsed once by the caller rather than once per question --
 * Canada's is several thousand tokens and this runs on every zoom notch.
 *
 * @param {string|object[]} subjectData   the `d` of the territory being marked, or its subpaths
 * @param {Set<string>} neighbourAnchors  `anchorKeys()` of the territory it faces
 * @returns {string} a `d` with one `M` per run, or "" when they share no border
 */
export function sharedBorderPath(subjectData, neighbourAnchors) {
    if (!neighbourAnchors || neighbourAnchors.size === 0) {
        return "";
    }
    const parts = [];
    const subpaths = Array.isArray(subjectData) ? subjectData : parseSegments(subjectData);

    for (const subpath of subpaths) {
        let from = subpath.start;
        let open = false;

        for (const seg of subpath.segs) {
            const to = seg[seg.length - 1];
            const shared = neighbourAnchors.has(key(from)) && neighbourAnchors.has(key(to));

            if (shared) {
                if (!open) {
                    parts.push(`M ${formatNumber(from[0])} ${formatNumber(from[1])}`);
                    open = true;
                }
                if (seg[0] === "L") {
                    parts.push(`L ${formatNumber(to[0])} ${formatNumber(to[1])}`);
                } else {
                    parts.push(
                        `C ${formatNumber(seg[1][0])} ${formatNumber(seg[1][1])}` +
                        ` ${formatNumber(seg[2][0])} ${formatNumber(seg[2][1])}` +
                        ` ${formatNumber(to[0])} ${formatNumber(to[1])}`
                    );
                }
            } else {
                open = false;
            }
            from = to;
        }
    }

    return parts.join(" ");
}
