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
// **THE FIGURES ARE THE FRONTIER'S, AND THE ZOOM DECLUTTERS WITHIN IT.** A figure is drawn on
// the player's own land and on every enemy territory that touches it, wherever the territory is
// big enough ON SCREEN to hold one -- so zooming in fills in the smaller provinces of that
// frontier rather than the rest of the world. This has been both ways round. It first drew a
// subset, was widened to the whole map on the argument that a subset is a decision about what
// the player is allowed to compare, and was narrowed again by Leigh: 359 figures is a great
// deal of ink for a question about your own border, and the number competes with the shade,
// which is the thing the view is actually built on. What makes the narrowing safe is that
// **nothing is hidden** -- the shade still covers the whole world, and the TOOLTIP still gives
// the full comparison for any territory the pointer is over, frontier or not.

import { allTerritories, getTerritoryByName, playerColour, playerCountryName } from "../../state/selectors.js";
import { takeProbability } from "../../rules/military/takeProbability.js";
import {
    attackingDevelopmentIndex,
    combatContinentModifierFor
} from "../../rules/military/probability.js";
import { getInteractableFrom, isAdjacencyLoaded } from "../../data/adjacency.js";
import { Events, on } from "../../state/events.js";
import { onZoomChanged, userUnitsPerPixel } from "./camera.js";
import { zoomWeight } from "./strokes.js";
import { ids } from "../core/registry.js";
import { mapInk, parseColour, tokenColour } from "./themeColours.js";
import { anchorKeys, parseSegments, sharedBorderPath } from "./borderSegments.js";
import { attachOverlayLayers, overlayGroup, removeOverlayGroup } from "./overlayLayers.js";
import { HAIRLINE_PX } from "./strokes.js";
import { THEME_CHANGED } from "../theme/theme.js";
import {
    FORCE_BAND_COUNT,
    THREAT_CRITICAL,
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

/**
 * The shadow the marked border casts INTO the player's own territory.
 *
 * A stroke is centred on the line it is drawn along, so half of the mark necessarily lies in
 * the neighbour -- which is right for a border, since a border belongs to both sides. What is
 * NOT right is a mark that reads the same in both directions, because the warning is about one
 * of them: this is the player's border being threatened, not the neighbour's.
 *
 * So the mark is backed by wider strokes CLIPPED TO THE SUBJECT TERRITORY, which is what makes
 * the shadow fall on the player's side and only there -- the clip cuts away everything beyond
 * the shared line, so no part of it reaches the neighbour whatever width it is drawn at. Three
 * stacked layers rather than a Gaussian blur: an SVG filter needs a region, and a region big
 * enough for a border that crosses half the map is a raster the size of the map allocated per
 * marked territory. Stepping the width and the alpha costs three paths and reads as soft.
 *
 * Each row is `[width as a multiple of STROKE_THREAT, alpha]`, widest and faintest first.
 */
const THREAT_SHADOW_LAYERS = [[3.2, 0.10], [2.4, 0.14], [1.7, 0.20]];

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
    attachOverlayLayers(svgDocument);
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

/**
 * The territories that carry a force figure while this view is up: the player's own land and
 * every enemy territory touching it.
 *
 * Exported for `flagOverlay.js`, which draws a flag on everything ELSE -- so the war zone is
 * measured and the rest of the world is named, and the two never fight for the same few pixels
 * in the middle of a territory. It is derived rather than remembered from the last render, so
 * the two overlays cannot disagree about a frame: whichever redraws first, both are asking the
 * same plan the same question.
 *
 * @returns {Set<string>} empty when the view is off
 */
export function militaryFrontierIds() {
    const frontier = new Set();
    if (!active) {
        return frontier;
    }
    for (const [uniqueId, entry] of plan) {
        if (entry.frontier) {
            frontier.add(uniqueId);
        }
    }
    return frontier;
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

/**
 * The outline: who owns it, and nothing else.
 *
 * **THE THREAT IS NOT DRAWN HERE ANY MORE.** Colouring a territory's whole outline red says
 * "somewhere around here you are in trouble", so a country facing one dangerous neighbour and
 * six harmless ones read as encircled -- Leigh: *"i would want the border section only which
 * touches the stronger country to have the red border"*. The mark is a separate overlay along
 * the shared stretch now; see `renderThreatBorders()`.
 */
export function militaryStrokeFor(path) {
    if (!active) {
        return null;
    }
    const entry = entryFor(path);
    if (!entry) {
        return null;
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
 * The comparison as a ratio, written the way round that keeps a figure in it.
 *
 * `n : 1` is the natural form until the territory is the weaker side, where it collapses --
 * a thousand men facing nine hundred thousand is "0.0 : 1", which is a rounding artefact
 * pretending to be information. Below parity it is inverted to `1 : n`, so the sentence always
 * carries the number a player would quote.
 */
function describeRatio(force, faced) {
    if (force >= faced) {
        return `${(force / faced).toFixed(1)} : 1`;
    }
    const inverse = faced / force;
    return force > 0 ? `1 : ${inverse < 10 ? inverse.toFixed(1) : Math.round(inverse)}` : "0 : 1";
}

/** A neighbouring TERRITORY, named the way a player would name it. */
function describeNeighbour(name, country) {
    if (name && country && name !== country) {
        return `${name} (${country})`;
    }
    return name || country || "an enemy";
}

/**
 * How many threatening neighbours the tooltip lists before it counts the rest.
 *
 * The tooltip follows the pointer, so it cannot grow without covering the map it describes.
 * Three is enough for the case this exists for -- a province facing two or three real dangers
 * -- and the tail is counted rather than dropped, so the player is never told there is one
 * threat when there are five.
 */
const TOOLTIP_THREAT_LINES = 3;

/**
 * What the tooltip says about a territory while this view is up.
 *
 * The shade is a RATIO and a colour cannot explain a ratio: two million men is pale next to a
 * neighbour holding five and dark next to one holding one, and without this the map can only
 * be read by somebody who already knows the rule. So the tooltip states both halves of the
 * comparison and names the TERRITORY the figure belongs to -- the shade is measured against a
 * single enemy province, so naming its country alone would be a slightly different claim from
 * the one the colour is making.
 *
 * The threats are then listed one per line, because they are separate borders with separate
 * answers: a colour on the map says which stretch is dangerous and only this can say how
 * dangerous, and by whom.
 *
 * @returns {string[]} nothing when the view is off or the territory is not in the plan
 */
export function militaryTooltipLines(path) {
    if (!active) {
        return [];
    }
    const entry = entryFor(path);
    if (!entry) {
        return [];
    }

    const lines = [];
    if (entry.faced > 0) {
        const from = describeNeighbour(entry.facedName, entry.facedBy);
        lines.push(
            `Garrison ${formatForce(entry.force)} against ${formatForce(entry.faced)}` +
            (from ? ` from ${from}` : "") +
            ` — ${describeRatio(entry.force, entry.faced)}`
        );
    } else {
        //The other half of the rule, and the one that surprises people: an interior province
        //is drawn as secure whatever it holds, because nothing can attack it.
        lines.push(`Garrison ${formatForce(entry.force)} — no enemy can reach it`);
    }

    const threats = entry.threats ?? [];
    if (threats.length > 1) {
        lines.push(`Threatened by ${threats.length} neighbours:`);
    }
    for (const threat of threats.slice(0, TOOLTIP_THREAT_LINES)) {
        const verdict = threat.threat === THREAT_CRITICAL
            ? "would likely take it"
            : "could take it";
        lines.push(
            `${describeNeighbour(threat.name, threat.country)}` +
            ` — ${Math.round(threat.odds)}%, ${verdict}`
        );
    }
    if (threats.length > TOOLTIP_THREAT_LINES) {
        lines.push(`…and ${threats.length - TOOLTIP_THREAT_LINES} more`);
    }
    return lines;
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

/**
 * This view's group inside the shared overlay.
 *
 * `overlayLayers.js` owns being last in the document and owns the stacking between overlays --
 * it has to, because two observers each enforcing "I am last" is a loop and not two fixes. The
 * `pointer-events: none` that used to be written here is on the shared parent now.
 */
function labelLayer() {
    return overlayGroup("military", ids.militaryLabelLayer);
}

/**
 * Draw the threatened stretches of border, and only those stretches.
 *
 * ONE OVERLAY PER THREATENING NEIGHBOUR, not one per territory. A province can be threatened
 * from several directions at once -- Canada faces the United States along the 49th parallel and
 * Alaska in the north-west -- and each of those is a different border with a different answer,
 * so marking only the worst of them draws the other one clean and says it is safe. Each mark
 * takes its own colour from its own forecast, so one border can be red while the next is amber.
 *
 * Along the segments the two outlines share: `sharedBorderPath()` finds those by EXACT
 * coordinate equality, which is only meaningful because the map was welded -- before that, two
 * neighbours had no points in common and this would have drawn nothing at all, everywhere.
 *
 * Drawn UNDER the figures (same layer, added first) and over the territory fills, so a warning
 * never hides a number.
 */
function renderThreatBorders(layer, paths) {
    const byId = new Map();
    for (const path of paths) {
        byId.set(path.getAttribute("uniqueid"), path);
    }
    //One parse per neighbour, however many of our territories that neighbour threatens.
    const neighbourAnchors = new Map();
    const scale = zoomWeight() * userUnitsPerPixel();
    //Rebuilt with the marks rather than kept: the layer is emptied on every redraw, and a clip
    //shape that outlived its mark would be a stale outline referenced by nothing.
    const defs = mapDocument.createElementNS(SVG_NS, "defs");
    layer.appendChild(defs);
    //Every shadow is laid down before any mark, so two marked territories sharing a corner
    //cannot have one's shadow fall across the other's line.
    const marks = [];

    for (const [uniqueId, entry] of plan) {
        const threats = entry.threats ?? [];
        if (threats.length === 0) {
            continue;
        }
        const subject = byId.get(uniqueId);
        if (!subject) {
            continue;
        }
        //Parsed ONCE however many neighbours this province is threatened by. Canada's outline
        //is several thousand tokens and the whole overlay is rebuilt on every zoom notch.
        const subjectSubpaths = parseSegments(subject.getAttribute("d"));
        //The clip is the player's own outline, so anything drawn through it stops dead at the
        //shared line. `clipPathUnits` defaults to user space, which is the coordinate system
        //the `d` is already in. One per territory, shared by all of its marks, and created
        //only once something is actually going to be drawn against it.
        const clipId = `${ids.militaryLabelLayer}-clip-${uniqueId}`;
        let clipped = false;

        for (const threat of threats) {
            const neighbour = byId.get(threat.id);
            if (!neighbour) {
                continue;
            }
            if (!neighbourAnchors.has(threat.id)) {
                neighbourAnchors.set(threat.id, anchorKeys(neighbour.getAttribute("d")));
            }
            const shared = sharedBorderPath(subjectSubpaths, neighbourAnchors.get(threat.id));
            if (!shared) {
                //Reachable but not touching: an amphibious neighbour across a strait. The shade
                //and the tooltip still carry the warning; there is no border to draw it on.
                continue;
            }

            if (!clipped) {
                const clip = mapDocument.createElementNS(SVG_NS, "clipPath");
                clip.setAttribute("id", clipId);
                const clipShape = mapDocument.createElementNS(SVG_NS, "path");
                clipShape.setAttribute("d", subject.getAttribute("d"));
                clip.appendChild(clipShape);
                defs.appendChild(clip);
                clipped = true;
            }

            for (const [multiple, alpha] of THREAT_SHADOW_LAYERS) {
                const shadow = mapDocument.createElementNS(SVG_NS, "path");
                shadow.setAttribute("d", shared);
                shadow.setAttribute("fill", "none");
                shadow.setAttribute("stroke", `rgba(0, 0, 0, ${alpha})`);
                shadow.setAttribute("stroke-width", String(STROKE_THREAT * multiple * scale));
                shadow.setAttribute("stroke-linecap", "butt");
                shadow.setAttribute("stroke-linejoin", "round");
                shadow.setAttribute("clip-path", `url(#${clipId})`);
                //Deliberately NOT `data-threat`: that attribute addresses the mark itself, in
                //the e2e spec and in anything else that counts the warnings on the map.
                shadow.setAttribute("data-threat-shadow", threat.threat);
                layer.appendChild(shadow);
            }

            const mark = mapDocument.createElementNS(SVG_NS, "path");
            mark.setAttribute("d", shared);
            mark.setAttribute("fill", "none");
            mark.setAttribute("stroke",
                threat.threat === THREAT_CRITICAL ? colours.critical : colours.warned);
            mark.setAttribute("stroke-width", String(STROKE_THREAT * scale));
            //BUTT AND NEVER ROUND. A round cap extends half the stroke width PAST the last
            //shared anchor, along the direction the outline was heading -- which at the end of
            //a shared stretch is into the border with the NEXT neighbour, so the warning about
            //one country put a red blob on another country's frontier. A butt cap ends the
            //line where the shared border ends, which is the only place it means anything.
            mark.setAttribute("stroke-linecap", "butt");
            mark.setAttribute("stroke-linejoin", "round");
            mark.setAttribute("data-threat", threat.threat);
            mark.setAttribute("data-threat-from", threat.id);
            marks.push(mark);
        }
    }

    //A CRITICAL MARK IS NEVER COVERED BY AN AMBER ONE. Two threatened borders can meet at a
    //corner, and what is painted last wins -- so the marks are laid down in band order rather
    //than in the order the territories came out of the plan.
    marks.sort((first, second) =>
        Number(first.getAttribute("data-threat") === THREAT_CRITICAL) -
        Number(second.getAttribute("data-threat") === THREAT_CRITICAL));
    marks.forEach(mark => layer.appendChild(mark));
}

export function clearMilitaryLabels() {
    removeOverlayGroup(ids.militaryLabelLayer);
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

    //The threat marks go in first so the figures sit on top of them.
    renderThreatBorders(layer, paths);

    const scale = userUnitsPerPixel();
    const fontSize = LABEL_PX * scale;

    for (const path of paths) {
        const entry = entryFor(path);
        if (!entry || !entry.frontier) {
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
