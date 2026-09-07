// Where the attack arrows go, as arithmetic. No DOM, no SVG, no store.
//
// The same arrangement `deriveMoveButtonState()` and `src/ui/battle/buttonState.js`
// have: the shape of the thing is a pure function of a few numbers, and one module --
// `attackArrows.js` -- is the only thing allowed to turn that into elements. What it
// buys here is that "the arrows must not overlap or interfere with one another" is a
// claim a unit test can settle in a millisecond, rather than one somebody has to
// judge by clicking Germany and squinting.
//
// EVERY SIZE IN THIS FILE IS A SCREEN PIXEL, and `unit` is `userUnitsPerPixel()` --
// how many map user units one screen pixel covers at the current zoom. An arrow drawn
// in user units is magnified with the land, so one set of constants cannot be right at
// zoom 1 and at zoom 6; multiplying by `unit` is what makes it right at both, and it
// is the reason the arrows are redrawn when the camera's magnification changes.
//
// The two decisions worth stating, because neither is arbitrary:
//
// **The head never moves.** The arrow's job is to say "this territory, from that one",
// and the target's centre is the half of that a player reads first. When an arrow is
// too short to see, it is the TAIL that is pulled back, and when two arrows lie on top
// of one another it is their BOW that is spread. Moving the head to make room would
// solve a drawing problem by mis-stating the fact.
//
// **A short arrow is extended, but barely.** Neighbouring centroids in Europe sit
// twenty-odd user units apart on a map 1947 units wide -- a dozen screen pixels at zoom
// 1, which is not an arrow. The tail is dragged back towards `MIN_ARROW_PX`, and the
// drag is capped HARD, at half the chord. That cap is not a taste: the pull-back runs
// along the REVERSE bearing, so a generously lengthened arrow puts its tail on the far
// side of the source from its own target -- and Germany, which has eleven attackable
// neighbours, drew eleven of those crossing in its middle. A fan became a star, and the
// territory the player had just clicked disappeared under it. Past the cap an arrow is
// simply drawn short, because the honest fix for a short arrow is the zoom: the
// extension is measured in pixels and the territories are not, so the same pairing that
// needs stretching at zoom 1 needs nothing at zoom 4.

// --- shaft and head --------------------------------------------------------

export const SHAFT_WIDTH_PX = 4.5;
export const HEAD_LENGTH_PX = 20;
export const HEAD_WIDTH_PX = 17;

/** How far the shaft stops short of the tip, as a fraction of the head's length, so
 *  the line does not show through the triangle drawn over it. */
const HEAD_OVERLAP = 0.55;

// --- length ----------------------------------------------------------------

/** The shortest arrow worth drawing, and the pixel ceiling on the pull-back that gets
 *  it there. `MAX_TAIL_EXTENSION_CHORD` below is the cap that usually binds. */
export const MIN_ARROW_PX = 34;
export const MAX_TAIL_EXTENSION_PX = 26;

/**
 * Tails sit on a ring INSIDE the source territory, each in the direction of its own
 * target, rather than all on one point -- so eleven arrows leave Germany from eleven
 * places on its border instead of from one bright knot in the middle of it.
 *
 * The ring is sized from the source's own bounding box, which is what makes it right
 * for Germany and for a one-pixel island in the same expression; the pixel clamps stop
 * a huge source throwing its tails out into the sea and a tiny one collapsing the ring
 * to a point. It is capped against the CHORD as well, because on a short pairing a ring
 * sized for the source would be most of the arrow.
 */
const START_RING_FRACTION = 0.75;
const START_INSET_MIN_PX = 6;
const START_INSET_MAX_PX = 34;
const START_INSET_CHORD_LIMIT = 0.35;

/**
 * How far past the source centre a tail may be dragged, as a fraction of the chord.
 *
 * This is the tighter of the two caps on the extension and it is the one that matters:
 * the pull-back runs along the REVERSE bearing, so an arrow lengthened generously puts
 * its tail on the far side of the source from its target -- and eleven of those cross
 * in the middle and draw a star over the territory the player just clicked. Measured on
 * Germany at zoom 4, which has eleven attackable neighbours and is what caught it.
 */
const MAX_TAIL_EXTENSION_CHORD = 0.5;

// --- separation ------------------------------------------------------------

/**
 * Two targets whose bearings from the source differ by less than this are one cluster
 * and are bowed apart. Below about twenty degrees, two straight arrows of different
 * lengths lie on top of one another for the whole of the shorter one -- which is the
 * overlap this file exists to prevent, and it is an ANGULAR fact, so the threshold is
 * an angle and not a distance.
 */
const MIN_SEPARATION_DEGREES = 22;

/**
 * How far an arrow bows, as a fraction of its own length.
 *
 * Every arrow gets `BASE_BOW`, so the whole set curves the same way and reads as one
 * family rather than as a tangle. Within a cluster the members are spread symmetrically
 * about that by `BOW_STEP`: the signed offset is what sends them to opposite sides of
 * the line they would otherwise share.
 */
const BASE_BOW = 0.14;
const BOW_STEP = 0.17;

// --- the travelling band ---------------------------------------------------

const BAND_LENGTH_PX = 30;
const BAND_SPEED_PX_PER_SEC = 105;
const MIN_BAND_SECONDS = 0.55;
const MAX_BAND_SECONDS = 2.6;

/**
 * The band's length and cycle time for a shaft of `total` user units.
 *
 * The dash pattern is `band, total`: a period longer than the path, so exactly one
 * dash is ever on it. The duration comes from the distance travelled against a SCREEN
 * speed, which is what stops a long arrow's band crawling while a short one's races --
 * the two would otherwise take the same time to cover very different ground.
 */
export function bandFor(total, unit) {
    const band = Math.min(Math.max(BAND_LENGTH_PX * unit, total * 0.22), total * 0.7);
    const seconds = Math.min(
        MAX_BAND_SECONDS,
        Math.max(MIN_BAND_SECONDS, (total + band) / (BAND_SPEED_PX_PER_SEC * unit))
    );
    return { band, seconds, from: band, to: -total };
}

// --- the plan --------------------------------------------------------------

/**
 * Sort the targets round the compass and hand each one the bow that keeps it clear of
 * its neighbours.
 *
 * The list is walked in bearing order and cut wherever the gap to the previous member
 * exceeds `MIN_SEPARATION_DEGREES`. The wrap from the last bearing back to the first is
 * closed by hand: two arrows either side of due north are as close together as any
 * other pair, and a sort by angle puts them at opposite ends of the array.
 *
 * @param {{bearing: number}[]} entries  sorted by bearing, ascending
 * @returns {number[]} one bow fraction per entry, in the same order
 */
export function bowsFor(entries) {
    const count = entries.length;
    const bows = new Array(count).fill(BASE_BOW);
    if (count < 2) {
        return bows;
    }

    const separation = (MIN_SEPARATION_DEGREES * Math.PI) / 180;
    const clusters = [];
    let current = [0];

    for (let i = 1; i < count; i++) {
        if (entries[i].bearing - entries[i - 1].bearing < separation) {
            current.push(i);
        } else {
            clusters.push(current);
            current = [i];
        }
    }
    clusters.push(current);

    const wrapGap = entries[0].bearing + 2 * Math.PI - entries[count - 1].bearing;
    if (clusters.length > 1 && wrapGap < separation) {
        const last = clusters.pop();
        clusters[0] = last.concat(clusters[0]);
    }

    for (const cluster of clusters) {
        const size = cluster.length;
        cluster.forEach((index, position) => {
            bows[index] = BASE_BOW + (position - (size - 1) / 2) * BOW_STEP;
        });
    }
    return bows;
}

/**
 * One arrow's control points: where it starts, where it bends, where it points.
 *
 * Returns null for a pairing with no direction at all -- a target whose centre is the
 * source's centre, which the map does not contain but a scenario could.
 */
export function arrowSpineFor(from, to, bow, unit, sourceRadius = 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const chord = Math.hypot(dx, dy);
    if (!(chord > 1e-6)) {
        return null;
    }

    const ux = dx / chord;
    const uy = dy / chord;

    const ring = Math.min(
        Math.max(sourceRadius * START_RING_FRACTION, START_INSET_MIN_PX * unit),
        START_INSET_MAX_PX * unit
    );
    const inset = Math.min(ring, chord * START_INSET_CHORD_LIMIT);
    let start = { x: from.x + ux * inset, y: from.y + uy * inset };
    let length = chord - inset;

    const minimum = MIN_ARROW_PX * unit;
    if (length < minimum) {
        const extension = Math.min(
            minimum - length,
            MAX_TAIL_EXTENSION_PX * unit,
            chord * MAX_TAIL_EXTENSION_CHORD
        );
        start = { x: start.x - ux * extension, y: start.y - uy * extension };
        length += extension;
    }

    // The quadratic's control point: the midpoint pushed along the chord's normal. The
    // bow is SIGNED, which is what sends the members of a cluster to opposite sides.
    const offset = bow * length;
    return {
        start,
        control: {
            x: (start.x + to.x) / 2 - uy * offset,
            y: (start.y + to.y) / 2 + ux * offset
        },
        tip: { x: to.x, y: to.y },
        length
    };
}

/**
 * The arrowhead: a triangle on the curve's tangent at the tip, and the point the shaft
 * must stop at so it does not show through.
 *
 * A triangle rather than an SVG `<marker>`, because a marker needs a `<defs>` entry in
 * the map's own document -- somebody else's document, which already carries the
 * hatching patterns the highlight builds and tears down on every click.
 */
export function arrowHeadFor(control, tip, unit) {
    const dx = tip.x - control.x;
    const dy = tip.y - control.y;
    const along = Math.hypot(dx, dy) || 1;
    const ux = dx / along;
    const uy = dy / along;

    const length = HEAD_LENGTH_PX * unit;
    const half = (HEAD_WIDTH_PX * unit) / 2;

    const baseX = tip.x - ux * length;
    const baseY = tip.y - uy * length;

    return {
        points: [
            { x: tip.x, y: tip.y },
            { x: baseX - uy * half, y: baseY + ux * half },
            { x: baseX + uy * half, y: baseY - ux * half }
        ],
        shaftEnd: {
            x: tip.x - ux * length * HEAD_OVERLAP,
            y: tip.y - uy * length * HEAD_OVERLAP
        }
    };
}

function pathData(points) {
    return "M " + points[0].x + " " + points[0].y
        + points.slice(1).map(point => " L " + point.x + " " + point.y).join("")
        + " Z";
}

/**
 * Plan every arrow leaving one territory.
 *
 * @param {{x: number, y: number}} from        the source territory's centre
 * @param {{uniqueId: string, x: number, y: number}[]} targets
 * @param {number} unit                        user units per screen pixel
 * @param {number} [sourceRadius]              half the smaller side of the source's
 *                                             bounding box, which sizes the tail ring
 * @returns {{uniqueId: string, shaftD: string, headD: string, strokeWidth: number,
 *            unit: number, bow: number, length: number, start: object,
 *            control: object, tip: object}[]}  in bearing order, which is the order
 *            they are drawn
 */
export function planAttackArrows(from, targets, unit, sourceRadius = 0) {
    const entries = targets.map(target => {
        let bearing = Math.atan2(target.y - from.y, target.x - from.x);
        //atan2 gives (-pi, pi]; shifting to [0, 2pi) makes a sort by bearing a walk
        //round the compass, which is what the clustering above reads.
        if (bearing < 0) {
            bearing += 2 * Math.PI;
        }
        return { target, bearing };
    });
    entries.sort((a, b) => a.bearing - b.bearing);

    const bows = bowsFor(entries);
    const plans = [];

    entries.forEach((entry, index) => {
        const spine = arrowSpineFor(from, entry.target, bows[index], unit, sourceRadius);
        if (!spine) {
            return;
        }
        const head = arrowHeadFor(spine.control, spine.tip, unit);
        plans.push({
            uniqueId: entry.target.uniqueId,
            bearing: entry.bearing,
            bow: bows[index],
            length: spine.length,
            start: spine.start,
            control: spine.control,
            tip: spine.tip,
            //Carried on the plan rather than re-derived by the renderer: the plan is
            //what a redraw is judged against, and two places asking the camera for the
            //magnification is two places that can be asked at different moments.
            unit,
            strokeWidth: SHAFT_WIDTH_PX * unit,
            shaftD: "M " + spine.start.x + " " + spine.start.y
                + " Q " + spine.control.x + " " + spine.control.y
                + " " + head.shaftEnd.x + " " + head.shaftEnd.y,
            headD: pathData(head.points)
        });
    });

    return plans;
}
