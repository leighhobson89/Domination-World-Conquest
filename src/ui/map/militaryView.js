// The military map, drawn: force shading, threatened borders, and the figures.
//
// Register item E1, and the impure half of it -- `militaryShading.js` decides what the view
// says and this turns that into elements. It reads the store and the adjacency graph and
// writes the map document; it never reads a game fact back off an attribute, which is the
// same direction `MapView.js` is allowed.
//
// THE ODDS COME FROM `takeProbability()` DIRECTLY, and not through
// `calculateTakeProbabilityPreBattle()` in `battle.js`, which is the function every other
// caller uses. Two reasons, and the second is the one that matters. `battle.js` imports
// `ui.js` and `ui.js` imports this, so going that way closes a cycle for nothing. And that
// function keeps MODULE-LEVEL state -- `reusableAttackingAverageDevelopmentIndex` and the
// setup `preBattleSetup()` hands to the attack preview -- so a map refresh landing while the
// player is allocating units in the attack window would overwrite the setup of the battle
// they are about to fight with a pairing they never asked about. The rule is pure and takes
// its context as an argument, so asking it costs nothing and changes nothing.
//
// WHAT THE WARNING ASSUMES is that the neighbour commits its whole useable garrison. It is a
// question about capability -- *could this be taken* -- and not a prediction of what the AI
// will choose to send, which depends on the leader's personality and on what its other borders
// are doing that turn. Calibrated against `node tools/combat-lab.mjs cliff`, which measures the
// real map: at raw parity an attacker takes a territory 24.3% of the time, at 1.25:1 44.2% and
// at 1.5:1 63.6%. So the amber band lights at roughly a 15% force advantage to the neighbour
// and the red at roughly 45% -- a warning that fires where a border really is soft, rather
// than on every province that happens to face a large country.
//
// DRAWING INTO THE MAP DOCUMENT is the whole difficulty, and `siegeOverlay.js` records the
// trap: `#svg-map` is an `<object>`, so the SVG inside it is its own document. `style.css`
// does not reach it, the theme's custom properties do not cascade into it, and `currentColor`
// has nothing to resolve against. Every colour here is therefore read off the HOST root and
// written on as a literal, and the whole view is repainted when the theme changes.
// `themeColours.js` is the one copy of that lookup -- this file, `attackArrows.js` and
// `siegeOverlay.js` each grew their own.
//
// THE FIGURES ARE SIZED IN SCREEN PIXELS, which is the rule `attackArrows.js` establishes: a
// label drawn in map user units is magnified with the land, so one font size cannot be right
// at zoom 1 and at zoom 6. Every size below is a pixel figure multiplied by
// `userUnitsPerPixel()`, and the labels are redrawn on `onZoomChanged()`.
//
// **THE ZOOM IS THE DECLUTTERING, and it is why every territory is a candidate.** A figure is
// drawn wherever the territory is big enough ON SCREEN to hold it, so the world map carries
// the figures of the countries large enough to read and zooming in fills in the rest -- Europe
// at zoom 1 is a dozen numbers and at zoom 4 is all of them. That is a better rule than
// choosing a subset in advance, which is what this did first (the player's own land and its
// neighbours): a subset is a decision about what the player is allowed to compare, and the
// question "who is massing two provinces away" is a perfectly good one.

import { allTerritories, getTerritoryByName, playerColour, playerCountryName } from "../../state/selectors.js";
import { takeProbability } from "../../rules/military/takeProbability.js";
import {
    attackingDevelopmentIndex,
    combatContinentModifierFor
} from "../../rules/military/probability.js";
import { getInteractableFrom, isAdjacencyLoaded } from "../../data/adjacency.js";
import { Events, on } from "../../state/events.js";
import { onZoomChanged, userUnitsPerPixel } from "./camera.js";
import { ids } from "../core/registry.js";
import { mapInk, parseColour, tokenColour } from "./themeColours.js";
import { HAIRLINE_PX } from "./strokes.js";
import { THEME_CHANGED } from "../theme/theme.js";
import {
    FORCE_BAND_COUNT,
    THREAT_CRITICAL,
    THREAT_WARNED,
    planMilitaryView,
    rampFor
} from "./militaryShading.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The figure's height on screen, whatever the zoom. */
const LABEL_PX = 11;

/** The dark outline under the figure, in screen pixels. Legibility over any band. */
const LABEL_HALO_PX = 2.6;

/**
 * How wide a glyph is, as a fraction of the font size.
 *
 * Used to decide whether a territory can hold its own figure without measuring text, which in
 * an `<object>`'s document means laying it out and reading it back for all 359 paths on every
 * zoom notch. 0.62 is a little generous for the digits and the `k` this ever prints, which is
 * the right direction to be wrong in: it declutters slightly early rather than overlapping.
 */
const GLYPH_WIDTH_RATIO = 0.62;

/**
 * How long a burst of world changes is allowed to settle before the view is rebuilt.
 *
 * An AI turn writes hundreds of territory changes in a few seconds -- every purchase, every
 * conquest, every muster -- and each rebuild is a forecast per player territory plus a repaint
 * of all 359 paths. Coalescing on a zero timeout collapses only what lands in one task, which
 * during an AI turn is almost nothing, because the loop awaits between countries. A sixth of a
 * second collapses the burst and is still faster than a player can look up from the map.
 */
const REFRESH_DELAY_MS = 160;

/**
 * Territory outline widths, in SCREEN pixels -- the currency `strokes.js` works in.
 *
 * The enemy weight IS the map's ordinary border (`HAIRLINE_PX`), so the view adds emphasis
 * rather than changing the whole map's line work: what the player sees is their own outline
 * and the marked borders standing OUT of the map, not everything else receding.
 */
const STROKE_ENEMY = HAIRLINE_PX;
const STROKE_PLAYER = 3.2;
const STROKE_THREAT = 4.4;

let mapDocument = null;
let active = false;
let plan = new Map();
let ramp = [];
let colours = { warned: "#e0b33c", critical: "#c0392b" };
let requestRepaint = null;
let formatForce = (value) => String(Math.round(value));
let stopZoom = null;
let unsubscribes = [];
let refreshQueued = false;

/** Point the view at the map's contentDocument. Called from `svgMapLoaded()`. */
export function attachMilitaryLayer(svgDocument) {
    mapDocument = svgDocument;
}

/**
 * The two things this module cannot import.
 *
 * `repaint` is `MapView.repaintMap()`, which imports this -- injecting it is what keeps that
 * one-way. `format` is `formatNumbersToKMB()`, which lives in `resourceCalculations.js` and
 * would drag the whole economy in behind it.
 *
 * @param {object} wiring
 * @param {() => void} wiring.repaint      what re-asserts every fill and stroke
 * @param {(value: number) => string} wiring.format  the abbreviation the rest of the UI uses
 */
export function configureMilitaryView({ repaint, format }) {
    requestRepaint = repaint ?? null;
    if (typeof format === "function") {
        formatForce = format;
    }
}

/** A territory's army as the four-slot array every combat rule takes. */
function armyArrayOf(territory) {
    return [
        Number(territory.infantryForCurrentTerritory) || 0,
        Number(territory.useableAssault) || 0,
        Number(territory.useableAir) || 0,
        Number(territory.useableNaval) || 0
    ];
}

/**
 * The chance `attacker` takes `defender` if it throws everything it can field.
 *
 * The same call the AI decides on and the same one behind the figure on the attack screen --
 * terrain, forts, area, composition and the dice bands all included, because it plays the
 * battle out. `siegeTurns` is left at zero: this is the storm, not the siege.
 */
function oddsAgainst(attacker, defender) {
    return takeProbability(armyArrayOf(attacker), armyArrayOf(defender), defender, {
        attackingDevelopmentIndex: attackingDevelopmentIndex([attacker]),
        combatContinentModifier: combatContinentModifierFor(defender)
    });
}

export function isMilitaryViewActive() {
    return active;
}

/** Rebuild the ramp and the two threat colours from the theme in force. */
function readTheme() {
    ramp = forceRampColours();
    colours = threatColours();
}

/**
 * Every territory of another flag that can reach this one.
 *
 * `getInteractableFrom()` is the graph the game will actually let an army cross, sea crossings
 * included, which is the same question the AI's threat array asks. It THROWS when the data has
 * not been loaded, so the guard is the caller's -- see `buildPlan()`.
 */
function enemyNeighboursOf(territory) {
    const neighbours = [];
    for (const name of getInteractableFrom(territory.uniqueId, territory.territoryName)) {
        const neighbour = getTerritoryByName(name);
        if (neighbour && neighbour.dataName !== territory.dataName) {
            neighbours.push(neighbour);
        }
    }
    return neighbours;
}

/**
 * Recompute the plan from the world.
 *
 * The odds are the expensive part -- `takeProbability()` plays out two hundred battles per
 * uncached shape -- and `planMilitaryView()` asks for exactly one per player territory, so a
 * player holding sixty provinces pays sixty forecasts. That is a fraction of the sixteen
 * hundred pairings an AI turn already weighs, and the cache is shared with it.
 */
function buildPlan() {
    if (!isAdjacencyLoaded()) {
        plan = new Map();
        return;
    }
    const player = playerCountryName();
    plan = planMilitaryView({
        territories: allTerritories(),
        enemyNeighboursOf,
        isPlayerOwned: (territory) => Boolean(player) && territory.dataName === player,
        //Spectator mode has no player, so there is nobody to warn and nothing to forecast.
        oddsFor: player ? oddsAgainst : null
    });
}

function entryFor(path) {
    return plan.get(path?.getAttribute("uniqueid")) ?? null;
}

/**
 * The fill a territory takes in this view, or null if the view is off or has nothing to say.
 *
 * `MapView.repaintMap()` calls this rather than this module painting the map itself, so there
 * is still exactly one place that decides what colour a path is.
 */
export function militaryFillFor(path) {
    if (!active) {
        return null;
    }
    const entry = entryFor(path);
    return entry ? ramp[entry.band] ?? null : null;
}

/** The outline: the threat mark if there is one, otherwise who owns it. */
export function militaryStrokeFor(path) {
    if (!active) {
        return null;
    }
    const entry = entryFor(path);
    if (!entry) {
        return null;
    }
    if (entry.threat === THREAT_CRITICAL) {
        return { colour: colours.critical, width: STROKE_THREAT };
    }
    if (entry.threat === THREAT_WARNED) {
        return { colour: colours.warned, width: STROKE_THREAT };
    }
    if (entry.player) {
        //Asked LIVE rather than cached beside the theme colours: the player can change their
        //colour from the phase bar, which repaints the map without touching the theme, and a
        //cached copy would leave their own border drawn in the colour they just abandoned.
        return { colour: playerColour(), width: STROKE_PLAYER };
    }
    return { colour: mapInk(), width: STROKE_ENEMY };
}

/**
 * The ramp and the two threat colours, for the legend.
 *
 * Resolved on demand rather than handed out of `ramp`, because the key can be asked to
 * repaint on a theme change in the same tick the map is, and the order of two listeners on one
 * event is not something either of them should depend on.
 */
export function forceRampColours() {
    const weak = parseColour(tokenColour("--force-weak", "#e9f0d6"), { r: 233, g: 240, b: 214 });
    const strong = parseColour(tokenColour("--force-strong", "#1e3d17"), { r: 30, g: 61, b: 23 });
    return rampFor(weak, strong, FORCE_BAND_COUNT);
}

/** The two outline colours a threatened border is marked in. */
export function threatColours() {
    return {
        warned: tokenColour("--siege-amber", "#e0b33c"),
        critical: tokenColour("--negative", "#c0392b")
    };
}

/** The label layer, created on demand and always re-appended last so nothing covers it. */
function labelLayer() {
    if (!mapDocument) {
        return null;
    }
    let layer = mapDocument.getElementById(ids.militaryLabelLayer);
    if (!layer) {
        layer = mapDocument.createElementNS(SVG_NS, "g");
        layer.setAttribute("id", ids.militaryLabelLayer);
        //Decoration, and decoration must never intercept a click: a label sits over the middle
        //of the territory it describes, which is where the player clicks to select it. Same
        //rule as the siege markers and `#tooltip`.
        layer.setAttribute("style", "pointer-events: none");
    }
    mapDocument.documentElement.appendChild(layer);
    return layer;
}

export function clearMilitaryLabels() {
    mapDocument?.getElementById(ids.militaryLabelLayer)?.remove();
}

/**
 * Draw the figures.
 *
 * One text element per labelled territory that is big enough on screen to hold it. Nothing is
 * cached between redraws: a redraw happens on a zoom notch, a turn or a conquest, and building
 * a few hundred text nodes is cheaper than reconciling them.
 */
export function renderMilitaryLabels(paths) {
    const layer = labelLayer();
    if (!layer) {
        return;
    }
    layer.textContent = "";
    if (!active) {
        return;
    }

    const scale = userUnitsPerPixel();
    const fontSize = LABEL_PX * scale;

    for (const path of paths) {
        const entry = entryFor(path);
        if (!entry) {
            continue;
        }
        const text = formatForce(entry.force);
        let bounds;
        try {
            bounds = path.getBBox();
        } catch {
            //Not laid out yet. The next redraw will find it.
            continue;
        }
        const width = text.length * GLYPH_WIDTH_RATIO * fontSize;
        if (bounds.width < width || bounds.height < fontSize) {
            continue;
        }

        const label = mapDocument.createElementNS(SVG_NS, "text");
        label.setAttribute("x", String(bounds.x + bounds.width / 2));
        label.setAttribute("y", String(bounds.y + bounds.height / 2));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("dominant-baseline", "central");
        label.setAttribute("font-size", String(fontSize));
        label.setAttribute("font-family", "Segoe UI, Helvetica Neue, Arial, sans-serif");
        label.setAttribute("font-weight", "700");
        //A light figure over a dark outline, drawn as one glyph rather than as two elements.
        //The ramp runs from pale to deep, so no single colour reads against all five bands --
        //this is the same casing the attack arrows use, for the same reason.
        label.setAttribute("fill", "rgb(255,255,255)");
        label.setAttribute("stroke", "rgba(0, 0, 0, 0.75)");
        label.setAttribute("stroke-width", String(LABEL_HALO_PX * scale));
        label.setAttribute("stroke-linejoin", "round");
        label.setAttribute("paint-order", "stroke");
        label.textContent = text;
        layer.appendChild(label);
    }
}

/**
 * Recompute and redraw.
 *
 * The repaint is what applies the fills and strokes, because `MapView` owns those; this owns
 * the figures. Both have to happen and in that order, so that a label is never drawn over a
 * band the repaint is about to change.
 */
export function refreshMilitaryView(paths) {
    if (!active) {
        return;
    }
    readTheme();
    buildPlan();
    requestRepaint?.();
    renderMilitaryLabels(paths ?? []);
}

/**
 * Turn the view on or off.
 *
 * The subscriptions live exactly as long as the view does. A conquest or a purchase changes
 * the picture, and during an AI turn that is hundreds of events in a few seconds -- so a
 * refresh is COALESCED onto a timeout rather than run per event, which is what keeps a
 * forecast per player territory from being paid two hundred times a turn.
 *
 * NAMED `enabled` AND NOT `on`, which it was for one run of the suite: `on()` is this module's
 * subscribe function, imported from `state/events.js`, and a parameter of that name shadows it
 * -- so the subscription two lines below threw `on is not a function` and the view drew nothing
 * at all. Nothing in the unit suite could see it; the map simply stayed political.
 *
 * @param {boolean} enabled
 * @param {Element[]} paths  the map's path list, for the label pass
 */
export function setMilitaryViewActive(enabled, paths = []) {
    if (enabled === active) {
        return;
    }
    active = enabled;

    if (!active) {
        stopZoom?.();
        stopZoom = null;
        unsubscribes.forEach(stop => stop());
        unsubscribes = [];
        plan = new Map();
        clearMilitaryLabels();
        return;
    }

    stopZoom = onZoomChanged(() => renderMilitaryLabels(paths));
    const queue = () => {
        if (refreshQueued) {
            return;
        }
        refreshQueued = true;
        setTimeout(() => {
            refreshQueued = false;
            refreshMilitaryView(paths);
        }, REFRESH_DELAY_MS);
    };
    unsubscribes = [
        on(Events.TERRITORY_CHANGED, queue),
        on(Events.TURN_CHANGED, queue)
    ];

    refreshMilitaryView(paths);
}

if (typeof window !== "undefined") {
    window.addEventListener(THEME_CHANGED, () => {
        if (!active) {
            return;
        }
        readTheme();
        requestRepaint?.();
    });
}
