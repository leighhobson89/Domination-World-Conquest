// The key to the military map.
//
// A map that shades 359 territories on a five-step ramp and outlines two of them in red is
// only readable if the reader is told what the ramp MEANS, and this is the one view in the
// game whose colours are a quantity rather than an identity -- everywhere else a colour is
// simply "who owns this". Without a key the honest reading of a pale territory is "some
// country I have not met", which is exactly the wrong conclusion.
//
// THE SWATCHES ARE PAINTED FROM THE SAME RAMP THE MAP IS, and are asked for at every show
// rather than baked in: the ramp is two theme tokens, so a key holding its own copy of the
// colours would be right until somebody switched theme, and would then be a key to a map that
// no longer exists. `forceRampColours()` and `threatColours()` in `militaryView.js` are the
// one source, and `THEME_CHANGED` repaints both.
//
// It lives in the HOST document, not in the map's -- unlike the force figures. A legend is
// chrome: it belongs at a fixed corner of the screen and must not zoom, pan or scale with the
// land, which is the whole difference between it and everything `militaryView.js` draws.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { THEME_CHANGED } from "../theme/theme.js";
import { forceRampColours, threatColours } from "../map/militaryView.js";
import { playerColour } from "../../state/selectors.js";

let root = null;
let rampRow = null;
let threatRows = null;

/** The view is up, and the map chrome is up. Both have to be true to show a key. */
let viewActive = false;
//STARTS TRUE, and that is not laziness. `toggleMapModeButton()` is the only thing that writes
//it, and it is called to HIDE the chrome as often as to show it -- so starting false would
//leave the key waiting for a call that may not come before the player reaches the map. The
//other half of the condition is what keeps it off screen until then: nothing can be in the
//military view before the button that selects it has been clicked.
let chromeVisible = true;

function swatch(colour, className = "map-legend-swatch") {
    const box = el("span", { class: className });
    box.style.backgroundColor = colour;
    return box;
}

function outlineSample(colour) {
    const box = el("span", { class: "map-legend-swatch map-legend-outline" });
    //A threat is a STROKE on the map, so its key is a box with a border rather than a filled
    //box -- a filled red square would say "a red territory", which is not what the map draws.
    box.style.borderColor = colour;
    return box;
}

/** Build the key once. It is cheap to keep and there is nothing to reconcile. */
export function create() {
    if (root) return root;

    rampRow = el("div", { class: "map-legend-ramp" });
    threatRows = el("div", { class: "map-legend-threats" });

    root = el("div", { id: ids.mapLegend, class: "map-legend" }, [
        el("div", { class: "map-legend-title", text: "Force on this border" }),
        rampRow,
        el("div", { class: "map-legend-scale" }, [
            el("span", { text: "outnumbered" }),
            el("span", { text: "secure" })
        ]),
        threatRows,
        //THE RULE, STATED. It has to be, and the question that proved it was Leigh's: the
        //United States holding two million was pale while France holding the same two million
        //was dark, which is correct -- the shade is a COMPARISON and the two face different
        //neighbours -- and is unreadable unless the map says so. The figure and the shade are
        //two different statements about one territory, and a player who takes the number to BE
        //the shade will misread every interior province on the board.
        el("div", {
            class: "map-legend-note",
            text: "Shade compares a garrison with the strongest army that can reach it — " +
                "not its size."
        }),
        el("div", {
            class: "map-legend-note",
            //WHY IT SAYS "FRONTIER". The figures are drawn on the player's own land and on
            //every enemy territory touching it, and a player who does not know that reads the
            //blank interior of the world as territories holding nothing. The shade still
            //covers everybody and the tooltip still answers for anybody, which is what makes
            //the subset safe -- so the note says where to go for the rest.
            text: "Figures are garrisons along your frontier. Hover any territory for its " +
                "comparison; zoom in for smaller ones."
        })
    ]);

    root.style.display = "none";
    mount(document.body, root);
    return root;
}

/** Repaint the swatches from the theme in force. */
export function refresh() {
    if (!root) return;
    const ramp = forceRampColours();
    const threat = threatColours();

    rampRow.replaceChildren(...ramp.map(colour => swatch(colour)));
    threatRows.replaceChildren(
        el("div", { class: "map-legend-row" }, [
            outlineSample(threat.warned),
            el("span", { text: "Border at risk" })
        ]),
        el("div", { class: "map-legend-row" }, [
            outlineSample(threat.critical),
            el("span", { text: "Border would likely fall" })
        ]),
        //Ownership is the one thing this view gives up -- the fills are a quantity here, not an
        //identity -- so the outline is all the player has to find their own empire by, and it
        //has to be said. Read live, because the player can change that colour from the phase
        //bar and a key showing the previous one is worse than no key.
        el("div", { class: "map-legend-row" }, [
            outlineSample(playerColour()),
            el("span", { text: "Yours" })
        ])
    );
}

function apply() {
    if (!root) return;
    const show = viewActive && chromeVisible;
    root.style.display = show ? "" : "none";
    if (show) {
        refresh();
    }
}

/** The military view was entered or left. */
export function setViewActive(active) {
    viewActive = Boolean(active);
    apply();
}

/**
 * The map chrome went up or down -- a battle, the transfer window, the main menu.
 *
 * The key follows the map-mode button exactly, because it is a caption for a view that button
 * selects: leaving it on top of a battle screen would be a legend to a map nobody can see.
 */
export function setChromeVisible(visible) {
    chromeVisible = Boolean(visible);
    apply();
}

export function isVisible() {
    return Boolean(root) && root.style.display !== "none";
}

if (typeof window !== "undefined") {
    window.addEventListener(THEME_CHANGED, () => {
        if (isVisible()) {
            refresh();
        }
    });
}

export function destroy() {
    root?.remove();
    root = null;
    rampRow = threatRows = null;
    viewActive = false;
    chromeVisible = false;
}

export const mapLegend = {
    create, refresh, setViewActive, setChromeVisible, isVisible, destroy
};
