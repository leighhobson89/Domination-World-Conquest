// The design-token vocabulary the stylesheet reads and a theme writes.
//
// Every visual decision the themed chrome makes goes through one of these names.
// `style.css` declares the DEFAULT value of each on `:root` -- that default set
// IS the "Command" theme, which is why `themes.js` gives Command no overrides.
// Switching to any other theme writes the whole list onto the root element as
// inline custom properties; switching back removes them again.
//
// The list is exported rather than left implicit because it is what makes a
// theme testable: `themes.spec.js` asserts that every theme other than the
// default defines every token, so a half-finished theme cannot ship a palette
// with one colour inherited from a completely different one (light panel,
// light text, invisible menu).
//
// Adding a token means adding it here, giving it a default in `style.css`, and
// giving every non-default theme a value. The unit test enforces the third.

export const TOKENS = Object.freeze([
    // --- Surfaces -------------------------------------------------------------
    "--surface-scrim", // the full-screen wash behind the main menu
    "--surface-panel", // panel and window backgrounds
    "--surface-raised", // rows and cells that sit on top of a panel
    "--surface-control", // buttons at rest
    "--surface-control-hover",

    // --- Ink ------------------------------------------------------------------
    "--text-primary",
    "--text-muted",
    "--text-on-accent",

    // --- Accent ---------------------------------------------------------------
    "--accent", // the title, the active tab, the focus ring
    "--accent-strong", // hover/pressed form of the accent
    "--positive", // music on, gains, "yes"
    "--negative", // music off, losses, "no"
    // A siege is neither. It is the third state the activity feed needs -- a
    // territory that has not fallen and has not held -- and giving it a token of
    // its own is what stops five themes rendering it as the same literal amber.
    "--siege-amber",
    // The military map's strength ramp, weak end and strong end. Two rather than
    // five: the steps between them are mixed in JS (`militaryShading.js`), so a
    // theme chooses the FEEL of the ramp -- sepia, phosphor, ice -- and never has
    // to balance five swatches against one another. They are drawn into the map's
    // own document as literals, which is why nothing in `style.css` reads them.
    "--force-weak",
    "--force-strong",

    // --- The map ------------------------------------------------------------
    // The map is two `<object>` documents, so none of these reaches it through the
    // cascade: they are read off the host root and written onto elements as
    // literals (`src/ui/map/themeColours.js`). `--sea-tint` is the exception and
    // is the only one `style.css` uses directly, because the ocean is a background
    // image on the host's own coast-line element.
    "--map-ink", // every territory's outline
    "--map-coast", // the coast line with no continent boundary on it
    // THE SEA IS THE SAME IN EVERY THEME, on Leigh's call, and the three below
    // therefore join the debug pair as tokens whose value no theme may change.
    // They are tokens only because `style.css` may not carry a colour literal
    // outside `:root` and all three are read from rules that are. The reasoning
    // for pinning them: the ocean is the one surface on screen that is neither
    // chrome nor a game object -- it is the ground the whole map stands on, and a
    // theme recolouring it changes what the map IS rather than how it is dressed.
    // Tinting it per theme was tried and produced a Terminal ocean the same weight
    // as the land inside it.
    "--sea-tint", // blended over `sea.png`
    // HOW that tint is composited, and it has to be a token rather than one
    // global choice: `soft-light` keeps the image's own light and dark and moves
    // only its hue, which is right for a theme that wants a daylight ocean, and
    // CANNOT darken far enough for one that wants a night ocean -- the formula
    // pulls a 0.75-lightness base to about 0.58 at full strength. Terminal's sea
    // came out the same weight as the land it surrounds, which is the one thing
    // an ocean must never be. `multiply` is what gives a theme the dark end.
    "--sea-blend",
    "--sea-sparkle", // the glint on the water

    // --- Debug ----------------------------------------------------------------
    // The one pair that is deliberately the SAME in every theme. A debug
    // affordance has to be unmistakable, and a control whose colour a theme could
    // soften into the palette would eventually stop reading as one -- which is the
    // whole job of the "AI Game" button and the spectator console's chrome. They
    // are tokens rather than literals only because `style.css` is not allowed
    // literals outside `:root`, and every theme is given the same values on
    // purpose. Do not "harmonise" them: a debug button that matches the theme is a
    // debug button somebody ships.
    "--debug-surface",
    "--debug-ink",

    // --- Line and shape -------------------------------------------------------
    // These are what make the themes differ in FEEL and not only in hue: a
    // square-cornered 3px border reads as a different product from a 16px
    // radius with a hairline.
    "--border-color",
    "--border-strong",
    "--border-width",
    "--radius",
    "--radius-sm",

    // --- Depth ----------------------------------------------------------------
    "--shadow-panel",
    "--shadow-text",
    "--panel-blur", // backdrop-filter blur radius for the menu scrim
    // The halo a reactive control throws when it is hovered, focused or armed.
    // A token rather than `--accent` at some alpha, because how much a theme
    // should glow is a stylistic decision and not a derived one: Terminal is a
    // phosphor tube and wants to bloom, Parchment is ink on paper and must not.
    "--glow",

    // --- Type -----------------------------------------------------------------
    "--font-display", // title and menu buttons
    "--font-body", // everything else
    "--display-tracking", // letter-spacing on display text
    "--display-transform", // none | uppercase -- a real stylistic difference
    "--display-weight",
]);

/** `true` when `name` is a token this system knows about. */
export function isToken(name) {
    return TOKENS.includes(name);
}
