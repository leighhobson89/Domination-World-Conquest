// The four map views, and the one button that walks them.
//
// **The political map is not a view module and that is the point of the arrangement**: it is
// the map, and the other three are decorations ON it. `continent` adds the boundary bands,
// `military` replaces the fills with a force ramp, `physical` swaps the whole thing for the
// relief. So applying a view is a statement of which decorations are on, and there is exactly
// one place -- `applyMapView()` -- that says it. What that replaced was a `continentView`
// string, a `mapMode` integer and three functions in `ui.js` that each half-owned the answer,
// with seventeen sites reading `mapMode === 2` to mean "the relief is up".
//
// ORDER MATTERS INSIDE `applyMapView()`, and it is the trap the battle bar recorded first:
// once state is DERIVED, two writers that happened not to collide become last-writer-wins.
// The military view decides what `repaintMap()` paints, and leaving the relief map repaints on
// its way out -- so the military state is settled before either of the other two run.
//
// THE BUTTON IS NOT TOUCHED FROM HERE. `ui.js` subscribes with `onMapViewChanged()` and owns
// the icon, the title and the legend, which keeps this module free of the DOM outside the two
// SVG documents and lets the cycle be reasoned about on its own.

import { repaintMap } from "./MapView.js";
import { setMilitaryViewActive } from "./militaryView.js";
import { applyPhysicalView } from "./views/physicalView.js";
import { applyContinentBoundaries } from "./views/continentView.js";

/** The four views. The string values are what `data-view` on the button carries. */
export const MAP_VIEWS = Object.freeze({
    CONTINENT: "continent",
    NORMAL: "normal",
    MILITARY: "military",
    PHYSICAL: "physical"
});

/**
 * The order one press of the button walks.
 *
 * `continent` is first because it is the default and a game opens on it. `military` sits
 * between the two political maps and the relief because the political map is what it is read
 * AGAINST -- who owns what, and then where the force is.
 */
export const MAP_VIEW_CYCLE = Object.freeze([
    MAP_VIEWS.CONTINENT,
    MAP_VIEWS.NORMAL,
    MAP_VIEWS.MILITARY,
    MAP_VIEWS.PHYSICAL
]);

/**
 * The view a new game opens on.
 *
 * Named once because three places have to agree about it, and **applied** rather than merely
 * declared: the SVG ships with plain sea-coloured strokes, so setting the variable alone would
 * put the button in one state and the map in another.
 */
export const DEFAULT_MAP_VIEW = MAP_VIEWS.CONTINENT;

/** What the button's tooltip says in each view. */
export const MAP_VIEW_TITLE = Object.freeze({
    [MAP_VIEWS.NORMAL]: "Map view (political map)",
    [MAP_VIEWS.MILITARY]: "Map view (force and threatened borders)",
    [MAP_VIEWS.PHYSICAL]: "Map view (relief and boundaries)",
    [MAP_VIEWS.CONTINENT]: "Map view (continent boundaries)"
});

let current = DEFAULT_MAP_VIEW;
let context = { paths: [], coastPaths: [], coastDocument: null };
const listeners = new Set();

/**
 * Hand the views the two documents and their path lists. Called from `svgMapLoaded()`.
 *
 * @param {{paths: Element[], coastPaths: Element[], coastDocument: Document}} handles
 */
export function attachMapViews(handles) {
    context = { ...context, ...handles };
}

/** Be told when the view changes. Returns its own remover, the `on()` contract. */
export function onMapViewChanged(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function currentMapView() {
    return current;
}

/**
 * Is the relief map up?
 *
 * The replacement for `mapMode === 2`, which `ui.js` read in seventeen places -- hover
 * lightening, the selection restore, the colour picker, the turn boundary. `mapMode === 1`
 * meant "anything else", so its replacement is this negated.
 */
export function isPhysicalMapActive() {
    return current === MAP_VIEWS.PHYSICAL;
}

/**
 * Put the map into one view.
 *
 * Idempotent in effect but NOT skipped when the view is unchanged: `applyMapView()` is also
 * how the opening view is asserted onto a map that has never been painted, and an early return
 * would make the first call the one that did nothing.
 */
export function applyMapView(view) {
    const physical = view === MAP_VIEWS.PHYSICAL;
    const wasPhysical = isPhysicalMapActive();
    const wasMilitary = current === MAP_VIEWS.MILITARY;

    //FIRST, because it decides what the repaint inside the other two will paint.
    setMilitaryViewActive(view === MAP_VIEWS.MILITARY, context.paths);

    if (physical !== wasPhysical) {
        applyPhysicalView(physical, { ...context, repaint: repaintMap });
    } else if (wasMilitary) {
        //LEAVING THE FORCE RAMP WITH NO RELIEF TRANSITION TO DO IT FOR US. `setMilitaryViewActive`
        //stops answering for the fills but paints nothing itself, and the old code only ever
        //repainted on the way out of the relief map -- so this was latent: every route the
        //BUTTON takes out of the military view passes through the relief, and anything calling
        //the view directly (a new game's reset, say) would have left the map wearing the ramp.
        //It is not repainted on any other transition, because a repaint takes the attack arrows
        //and the reachable-destination highlights off with it.
        repaintMap();
    }

    //The continent bands come off for the military view as well as for the political one: that
    //view is already spending colour on force, and two colour systems over one map is neither.
    applyContinentBoundaries(
        view === MAP_VIEWS.CONTINENT || physical,
        { coastPaths: context.coastPaths, overRelief: physical }
    );

    current = view;
    for (const listener of listeners) {
        listener(view);
    }
}

/** One press of the button. */
export function cycleMapView() {
    const next = MAP_VIEW_CYCLE[(MAP_VIEW_CYCLE.indexOf(current) + 1) % MAP_VIEW_CYCLE.length];
    applyMapView(next);
    return next;
}

/**
 * Leave the relief map, because something needs the territories legible.
 *
 * Clicking a territory does this. **The military view is deliberately NOT left on a click**:
 * the relief is abandoned because a territory has to be readable to be clicked on, and the
 * military view is the one a player is in BECAUSE they are about to reinforce something.
 */
export function exitPhysicalMap() {
    if (!isPhysicalMapActive()) {
        return;
    }
    applyMapView(MAP_VIEWS.CONTINENT);
}

/**
 * Back to the opening view, for a new game.
 *
 * Goes to `DEFAULT_MAP_VIEW` and not to the literal `normal`, which are no longer the same
 * view -- otherwise the second game of a session opens on a different map from the first.
 */
export function resetMapView() {
    applyMapView(DEFAULT_MAP_VIEW);
}
