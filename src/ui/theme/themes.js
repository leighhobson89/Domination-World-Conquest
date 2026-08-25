// The theme catalogue, as data.
//
// A theme is an id, a name the player sees, a one-line description, a pair of
// swatch colours for the dropdown preview, and a complete map of design tokens
// (see `tokens.js`). Nothing here executes; `theme.js` is what applies it.
//
// The DEFAULT theme, "Command", carries NO tokens on purpose. Its values are the
// `:root` block in `style.css`, so there is exactly one definition of the
// default look rather than two that can drift apart. Selecting Command removes
// every inline custom property and lets the stylesheet answer again.
//
// Every OTHER theme must define every token in `TOKENS`. That is not a style
// preference -- inheriting half a palette is how a light theme ends up with
// white text on a cream panel. `tests/unit/ui-theme.spec.js` fails the build if
// a theme is incomplete.
//
// The themes deliberately differ in more than hue. Radius, border width, display
// font, tracking and letter case are all tokens, because five recolours of one
// shape look like one dated design in five colours -- which is the thing being
// fixed.

const SANS = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
const CONDENSED = '"Arial Narrow", "Oswald", Impact, sans-serif';
const MONO = '"Cascadia Mono", Consolas, "Roboto Mono", monospace';

export const DEFAULT_THEME_ID = "command";

export const THEMES = Object.freeze([
    {
        id: "command",
        name: "Command",
        description: "The house style. Steel blue on slate, soft corners.",
        swatch: ["#2d5a7b", "#7fc4e8"],
        // Intentionally empty -- see the note above.
        tokens: Object.freeze({}),
    },

    {
        id: "parchment",
        name: "Parchment",
        description: "An atlas on a library table. Sepia, ink and a serif face.",
        swatch: ["#e8dcc0", "#7a4a2b"],
        tokens: Object.freeze({
            "--surface-scrim": "rgba(62, 45, 30, 0.72)",
            "--surface-panel": "rgba(238, 226, 200, 0.97)",
            "--surface-raised": "rgba(224, 208, 175, 0.95)",
            "--surface-control": "rgba(206, 185, 145, 0.95)",
            "--surface-control-hover": "rgba(184, 158, 112, 0.98)",

            "--text-primary": "#3a2a18",
            "--text-muted": "#6f5942",
            "--text-on-accent": "#f6efdd",

            "--accent": "#7a4a2b",
            "--accent-strong": "#5c3520",
            "--positive": "#4b6b32",
            "--negative": "#9a3320",

            "--border-color": "rgba(122, 74, 43, 0.45)",
            "--border-strong": "#7a4a2b",
            "--border-width": "2px",
            "--radius": "4px",
            "--radius-sm": "2px",

            "--shadow-panel": "0 18px 48px rgba(50, 32, 16, 0.45)",
            "--shadow-text": "0 1px 0 rgba(255, 248, 230, 0.6)",
            "--panel-blur": "2px",

            "--font-display": SERIF,
            "--font-body": SERIF,
            "--display-tracking": "0.02em",
            "--display-transform": "none",
            "--display-weight": "700",
        }),
    },

    {
        id: "midnight",
        name: "Midnight",
        description: "Near-black glass with a cyan edge. Rounded and quiet.",
        swatch: ["#0d1117", "#3ddbd9"],
        tokens: Object.freeze({
            "--surface-scrim": "rgba(6, 9, 14, 0.82)",
            "--surface-panel": "rgba(19, 25, 34, 0.92)",
            "--surface-raised": "rgba(30, 39, 52, 0.92)",
            "--surface-control": "rgba(34, 45, 60, 0.9)",
            "--surface-control-hover": "rgba(52, 71, 92, 0.95)",

            "--text-primary": "#e6edf3",
            "--text-muted": "#8b98a8",
            "--text-on-accent": "#04191c",

            "--accent": "#3ddbd9",
            "--accent-strong": "#6ef2ef",
            "--positive": "#3fb950",
            "--negative": "#f85149",

            "--border-color": "rgba(125, 216, 214, 0.22)",
            "--border-strong": "rgba(61, 219, 217, 0.65)",
            "--border-width": "1px",
            "--radius": "16px",
            "--radius-sm": "10px",

            "--shadow-panel": "0 24px 70px rgba(0, 0, 0, 0.7)",
            "--shadow-text": "0 0 18px rgba(61, 219, 217, 0.35)",
            "--panel-blur": "10px",

            "--font-display": SANS,
            "--font-body": SANS,
            "--display-tracking": "0.06em",
            "--display-transform": "none",
            "--display-weight": "300",
        }),
    },

    {
        id: "crimson",
        name: "Crimson",
        description: "Imperial. Square edges, gold rule, everything in caps.",
        swatch: ["#1a1416", "#c8102e"],
        tokens: Object.freeze({
            "--surface-scrim": "rgba(14, 8, 10, 0.85)",
            "--surface-panel": "rgba(26, 20, 22, 0.96)",
            "--surface-raised": "rgba(40, 30, 33, 0.96)",
            "--surface-control": "rgba(52, 38, 42, 0.96)",
            "--surface-control-hover": "#c8102e",

            "--text-primary": "#f2e6d8",
            "--text-muted": "#a8968a",
            // Dark, not light. Crimson's accent is a pale gold, so the near-white
            // this used to be gave the primary button 2.2:1 -- caught by the
            // contrast check in `tests/unit/ui-theme.spec.js`, which is why that
            // test exists rather than a note asking someone to eyeball it.
            "--text-on-accent": "#1f1509",

            "--accent": "#d4a017",
            "--accent-strong": "#f0bd35",
            "--positive": "#6a8f3c",
            "--negative": "#c8102e",

            "--border-color": "rgba(212, 160, 23, 0.35)",
            "--border-strong": "#d4a017",
            "--border-width": "3px",
            "--radius": "0px",
            "--radius-sm": "0px",

            "--shadow-panel": "0 20px 60px rgba(0, 0, 0, 0.75)",
            "--shadow-text": "3px 3px 0 rgba(0, 0, 0, 0.55)",
            "--panel-blur": "3px",

            "--font-display": CONDENSED,
            "--font-body": SANS,
            "--display-tracking": "0.12em",
            "--display-transform": "uppercase",
            "--display-weight": "700",
        }),
    },

    {
        id: "arctic",
        name: "Arctic",
        description: "Daylight. Pale, high contrast, for a bright room.",
        swatch: ["#eef4f8", "#1b6ca8"],
        tokens: Object.freeze({
            "--surface-scrim": "rgba(180, 200, 214, 0.78)",
            "--surface-panel": "rgba(248, 251, 253, 0.97)",
            "--surface-raised": "rgba(230, 239, 245, 0.97)",
            "--surface-control": "rgba(216, 230, 240, 0.97)",
            "--surface-control-hover": "rgba(27, 108, 168, 0.92)",

            "--text-primary": "#12222e",
            "--text-muted": "#54687a",
            "--text-on-accent": "#f8fbfd",

            "--accent": "#1b6ca8",
            "--accent-strong": "#12507e",
            "--positive": "#1f7a3d",
            "--negative": "#b3261e",

            "--border-color": "rgba(27, 108, 168, 0.28)",
            "--border-strong": "#1b6ca8",
            "--border-width": "2px",
            "--radius": "8px",
            "--radius-sm": "5px",

            "--shadow-panel": "0 16px 44px rgba(30, 60, 85, 0.28)",
            "--shadow-text": "none",
            "--panel-blur": "5px",

            "--font-display": SANS,
            "--font-body": SANS,
            "--display-tracking": "0.01em",
            "--display-transform": "none",
            "--display-weight": "600",
        }),
    },

    {
        id: "terminal",
        name: "Terminal",
        description: "Phosphor green on black, monospaced. For the war room.",
        swatch: ["#04120a", "#4af07a"],
        tokens: Object.freeze({
            "--surface-scrim": "rgba(2, 10, 5, 0.88)",
            "--surface-panel": "rgba(4, 18, 10, 0.95)",
            "--surface-raised": "rgba(8, 30, 17, 0.95)",
            "--surface-control": "rgba(10, 38, 21, 0.95)",
            "--surface-control-hover": "rgba(20, 74, 41, 0.98)",

            "--text-primary": "#9df5b8",
            "--text-muted": "#4e8f65",
            "--text-on-accent": "#02170a",

            "--accent": "#4af07a",
            "--accent-strong": "#7dffa4",
            "--positive": "#4af07a",
            "--negative": "#ff5f56",

            "--border-color": "rgba(74, 240, 122, 0.3)",
            "--border-strong": "#4af07a",
            "--border-width": "1px",
            "--radius": "2px",
            "--radius-sm": "2px",

            "--shadow-panel": "0 0 60px rgba(74, 240, 122, 0.14)",
            "--shadow-text": "0 0 12px rgba(74, 240, 122, 0.55)",
            "--panel-blur": "1px",

            "--font-display": MONO,
            "--font-body": MONO,
            "--display-tracking": "0.14em",
            "--display-transform": "uppercase",
            "--display-weight": "700",
        }),
    },
]);

/** The theme with this id, or `undefined`. */
export function themeById(id) {
    return THEMES.find((theme) => theme.id === id);
}

/** Every theme id, in the order the dropdown shows them. */
export function themeIds() {
    return THEMES.map((theme) => theme.id);
}
