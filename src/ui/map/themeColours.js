// Reading the theme from inside the map.
//
// `#svg-map` and `#svg-coast-lines` are `<object>` elements, so the SVG in each is its own
// document: `style.css` does not reach it, the custom properties written onto the HOST root do
// not cascade into it, and `currentColor` has nothing to resolve against. Everything drawn on
// the map therefore has to ASK the host for a colour and write it on as a literal, and repaint
// when the theme changes. `siegeOverlay.js` was the first place that discovered this and
// `attackArrows.js` and `militaryView.js` each grew their own copy of these two functions;
// this is the one copy.
//
// The fallbacks are not decoration. There is a bootstrap window in which the map is painted
// before a theme has been applied, and `getComputedStyle` on a document that is being torn
// down throws -- so every reader here answers with something sane rather than with `null`,
// which would be written onto a path as the string "null" and render the territory black.
// That is the failure `setColorOnMap()` guards against for the same reason.

/**
 * One custom property, resolved on the HOST document.
 *
 * @param {string} name      e.g. `--map-ink`
 * @param {string} fallback  used before a theme exists, and if the lookup throws
 */
export function tokenColour(name, fallback) {
    try {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    } catch {
        return fallback;
    }
}

/** `#rgb`, `#rrggbb` or `rgb(...)` to channels. Anything else falls back. */
export function parseColour(value, fallback) {
    const text = String(value ?? "").trim();
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const digits = hex[1].length === 3
            ? hex[1].split("").map(character => character + character).join("")
            : hex[1];
        return {
            r: parseInt(digits.slice(0, 2), 16),
            g: parseInt(digits.slice(2, 4), 16),
            b: parseInt(digits.slice(4, 6), 16)
        };
    }
    const rgb = text.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (rgb) {
        return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
    }
    return fallback;
}

/**
 * The line every territory is outlined in.
 *
 * A soft near-black rather than `#000`: pure black against mid-tone land is the single most
 * dated thing a map can do, and it is what 359 hairlines of `rgb(0,0,0)` were doing. Themed,
 * because a border is chrome -- Parchment wants brown ink and Terminal wants none of either.
 */
export function mapInk() {
    return tokenColour("--map-ink", "rgba(24, 32, 40, 0.72)");
}

/**
 * The coast line when no continent boundaries are drawn on it.
 *
 * The default is the colour the SVG has always shipped with, so the plain map is unchanged in
 * the default theme and every other theme gets a coast that belongs to it.
 */
export function plainCoastStroke() {
    return tokenColour("--map-coast", "rgb(103, 124, 160)");
}
