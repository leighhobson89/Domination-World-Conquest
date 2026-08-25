// The theme catalogue and the id it resolves to.
//
// The completeness check is the one that earns its place. A theme is a palette,
// and a palette with a hole in it inherits whatever the previous theme left on
// the root element -- which is how "Arctic" ends up with a white panel and the
// white text it did not bother to override. Nothing about that fails loudly in
// a browser; it just looks broken. So it is asserted here instead.

import { describe, expect, it } from "vitest";

import { TOKENS, isToken } from "../../src/ui/theme/tokens.js";
import { DEFAULT_THEME_ID, THEMES, themeById, themeIds } from "../../src/ui/theme/themes.js";
import { resolveThemeId } from "../../src/ui/theme/theme.js";

describe("theme catalogue", () => {
    it("has a default theme, and it is in the catalogue", () => {
        expect(themeById(DEFAULT_THEME_ID)).toBeDefined();
    });

    it("gives the default theme no tokens, so the stylesheet stays the one definition", () => {
        expect(Object.keys(themeById(DEFAULT_THEME_ID).tokens)).toEqual([]);
    });

    it("gives every OTHER theme a value for every token", () => {
        for (const theme of THEMES) {
            if (theme.id === DEFAULT_THEME_ID) continue;
            const missing = TOKENS.filter((token) => theme.tokens[token] === undefined);
            expect(missing, `theme "${theme.id}" is missing tokens`).toEqual([]);
        }
    });

    it("defines no token outside the vocabulary", () => {
        for (const theme of THEMES) {
            const stray = Object.keys(theme.tokens).filter((name) => !isToken(name));
            expect(stray, `theme "${theme.id}" defines unknown tokens`).toEqual([]);
        }
    });

    it("gives every theme a unique id, a name, a description and two swatches", () => {
        expect(new Set(themeIds()).size).toBe(THEMES.length);
        for (const theme of THEMES) {
            expect(theme.name, theme.id).toBeTruthy();
            expect(theme.description, theme.id).toBeTruthy();
            expect(theme.swatch, theme.id).toHaveLength(2);
        }
    });

    it("offers more than one theme, or the dropdown has nothing to do", () => {
        expect(THEMES.length).toBeGreaterThan(1);
    });
});

// --- Contrast ---------------------------------------------------------------
// WCAG relative luminance. Only the pairs that are GUARANTEED to meet -- a token
// named "on-accent" is painted on the accent by definition -- can be checked
// this way; the rest depend on which surface a rule happens to use and are
// measured in the browser instead.

function channels(colour) {
    const hex = colour.trim();
    if (hex.startsWith("#")) {
        const n = hex.length === 4
            ? [...hex.slice(1)].map((c) => parseInt(c + c, 16))
            : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return n;
    }
    return (hex.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
}

function luminance(colour) {
    const [r, g, b] = channels(colour).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe("theme contrast", () => {
    // 4.5:1 is WCAG AA for body text. The primary button -- New Game, Done -- is
    // `--text-on-accent` on `--accent`, and Crimson shipped that pair at 2.2:1
    // (near-white on pale gold) because the theme was written by copying a dark
    // theme's ink. Nothing about it throws; it is just hard to read, which is
    // exactly the class of defect a human reviewer signs off by accident.
    const MIN = 4.5;

    it("puts readable ink on the accent in every theme", () => {
        for (const theme of THEMES) {
            if (theme.id === DEFAULT_THEME_ID) continue;
            const ratio = contrast(theme.tokens["--text-on-accent"], theme.tokens["--accent"]);
            expect(ratio, `${theme.id}: --text-on-accent on --accent`).toBeGreaterThanOrEqual(MIN);
        }
    });

    it("puts readable ink on every surface in every theme", () => {
        const surfaces = ["--surface-panel", "--surface-raised", "--surface-control"];
        for (const theme of THEMES) {
            if (theme.id === DEFAULT_THEME_ID) continue;
            for (const surface of surfaces) {
                const ratio = contrast(theme.tokens["--text-primary"], theme.tokens[surface]);
                expect(ratio, `${theme.id}: --text-primary on ${surface}`).toBeGreaterThanOrEqual(MIN);
            }
        }
    });

    it("keeps muted text legible, at the 3:1 large-text floor", () => {
        for (const theme of THEMES) {
            if (theme.id === DEFAULT_THEME_ID) continue;
            const ratio = contrast(theme.tokens["--text-muted"], theme.tokens["--surface-panel"]);
            expect(ratio, `${theme.id}: --text-muted on --surface-panel`).toBeGreaterThanOrEqual(3);
        }
    });
});

describe("resolveThemeId", () => {
    it("passes a known id through", () => {
        for (const id of themeIds()) expect(resolveThemeId(id)).toBe(id);
    });

    it("falls back to the default for anything it does not know", () => {
        // The middle three are what a value left by an older build looks like.
        for (const bad of [undefined, null, "", "no-such-theme", 7, {}, []]) {
            expect(resolveThemeId(bad)).toBe(DEFAULT_THEME_ID);
        }
    });
});
