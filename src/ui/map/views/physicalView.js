// The relief map: the land as terrain rather than as politics.
//
// One of the four map views, and the second to become a module of its own (the military view
// was the first, and set the shape). It was `setPhysicalMap()` in `ui.js`, reading a
// module-level `mapMode` that seventeen other places also read.
//
// WHAT IT DOES. The coast-line document carries a relief `<image>` and one path per landmass;
// switching on reveals the image, tints each landmass with its continent's colour at low
// opacity, and drops the TERRITORY fills to near-transparent so the relief shows through.
// The player's own territories are the exception -- they keep the player's colour at half
// opacity, because an empire you cannot see on the terrain map is an empire you cannot plan
// with.
//
// TWO THINGS WERE REMOVED IN THE MOVE AND NEITHER CHANGES A PIXEL.
//
// The "on" branch ran a nested loop over all 359 territories for each of 359 paths, looking
// for `territory.unique === path.getAttribute("uniqueid")` in order to call `setStrokeOnMap()`
// on the match. **There is no `unique` field** -- the store's is `uniqueId` -- so the
// comparison was false 129,000 times per toggle and the call it guarded never once ran.
// Porting it faithfully means porting nothing, which is what happened; `setStrokeOnMap()`
// itself had no other caller and is gone with it. (Had it ever fired it would have painted
// every territory's outline in its owner's colour, which is a different map from the one this
// has always drawn -- so it is a change, not a fix, and it is not being made here.)
//
// The stroke width was written as the string `"1px"`. SVG geometry attributes take user units
// and a unit suffix is ignored by every renderer that accepts it at all; it goes through
// `strokes.js` here, which measures in screen pixels and re-applies on a zoom -- so the relief
// map's outlines hold their weight as you go in, like everything else on the map now.

import { pathIsPlayerOwned } from "../../../state/pathState.js";
import { playerColour } from "../../../state/selectors.js";
import { CONTINENT_COLOR_ARRAY } from "../colouring.js";
import { mapInk } from "../themeColours.js";
import { HAIRLINE_PX, setPathStrokePx } from "../strokes.js";

/** How much of the relief image shows through a landmass tint. */
const LANDMASS_TINT_OPACITY = "0.20";

/** Territory fills on the relief map: present enough to be hit-tested, invisible to read. */
const TERRITORY_FILL_OPACITY = "0.01";

/** The player's own land, which stays legible on the terrain. */
const PLAYER_FILL_OPACITY = "0.5";

/** The continent tint for one landmass path, from its `shadow` attribute. */
function continentTint(coastPath) {
    const continent = coastPath.getAttribute("shadow");
    const row = CONTINENT_COLOR_ARRAY.find(([name]) => name === continent);
    return row ? `rgb(${row[1].join(", ")})` : null;
}

/**
 * Turn the relief on or off.
 *
 * @param {boolean} on
 * @param {object} context
 * @param {Element[]} context.paths        the territory paths
 * @param {Element[]} context.coastPaths   the landmass paths in the coast-line document
 * @param {Document} context.coastDocument
 * @param {() => void} context.repaint     `repaintMap()`, which restores the political fills
 */
export function applyPhysicalView(on, { paths, coastPaths, coastDocument, repaint }) {
    const reliefImage = coastDocument?.querySelector("image");

    if (on) {
        reliefImage?.setAttribute("style", "opacity: 1");

        for (const coastPath of coastPaths) {
            coastPath.setAttribute("fill-opacity", LANDMASS_TINT_OPACITY);
            const tint = continentTint(coastPath);
            if (tint) {
                coastPath.setAttribute("fill", tint);
            }
        }

        for (const path of paths) {
            path.setAttribute("fill-opacity", TERRITORY_FILL_OPACITY);
            setPathStrokePx(path, HAIRLINE_PX);
            if (pathIsPlayerOwned(path)) {
                path.setAttribute("fill", playerColour());
                path.setAttribute("fill-opacity", PLAYER_FILL_OPACITY);
            }
        }
        return;
    }

    for (const path of paths) {
        path.style.stroke = mapInk();
        setPathStrokePx(path, HAIRLINE_PX);
        path.setAttribute("fill-opacity", "1");
    }
    //ORDER MATTERS: the loop above restores the OPACITY every path was drawn at, and the
    //repaint restores the COLOUR from the store. Repainting first would put the political
    //colours back underneath a near-transparent fill, which is a blank map.
    repaint();

    reliefImage?.setAttribute("style", "opacity: 0");
    for (const coastPath of coastPaths) {
        coastPath.setAttribute("fill", "none");
    }
}
