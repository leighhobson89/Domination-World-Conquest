// Invariants of the stylesheet itself.
//
// Phase 7.11 brought the last five windows -- the territory info panel, Upgrade
// Territory, Buy Military, the transfer/attack window and the battle UI -- onto
// the design tokens, and replaced twelve PNG controls with drawn ones. Both of
// those are the kind of change that is complete on the day and then leaks: the
// next person to add a rule writes `border: 1px solid white` because that is
// what the rule above it used to say, and nothing fails.
//
// So the properties are asserted here rather than left to review. Every one of
// these caught something real while the phase was being written.
//
// What this file deliberately does NOT do is check how anything LOOKS. A
// computed colour, a panel that clips its last row, a control that is hidden
// behind another -- those need a browser, and they are in
// `tests/e2e/ui-layout/`. The division is the same one `tests/e2e/save-load/`
// records: the unit suite owns what the source SAYS, the e2e suite owns what
// the page DOES.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TOKENS } from "../../src/ui/theme/tokens.js";
import { classNames } from "../../src/ui/core/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");

/** The stylesheet with every comment removed. Comments discuss the literals. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Source with its comments taken out.
 *
 * The retired-asset check needs this: every site that USED to draw one of these
 * PNGs now carries a note saying what stood there and why it went, and those
 * notes name the file. Matching on raw text would fail on the documentation of
 * the very change being asserted.
 */
function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** The `:root` block, which IS the default theme and is the one place literals belong. */
function rootBlock() {
    const start = CODE.indexOf(":root {");
    expect(start, "style.css has no :root block").toBeGreaterThan(-1);
    return CODE.slice(start, CODE.indexOf("}", start) + 1);
}

/** Everything except `:root`. */
function outsideRoot() {
    const start = CODE.indexOf(":root {");
    const end = CODE.indexOf("}", start) + 1;
    return CODE.slice(0, start) + CODE.slice(end);
}

describe("design tokens", () => {
    it("gives every token in the vocabulary a default in :root", () => {
        const root = rootBlock();
        const missing = TOKENS.filter((token) => !root.includes(token + ":"));
        expect(missing, "tokens with no default value").toEqual([]);
    });

    it("defines no custom property in :root that is not a token", () => {
        const declared = [...rootBlock().matchAll(/(--[a-z-]+):/g)].map((m) => m[1]);
        const stray = declared.filter((name) => !TOKENS.includes(name));
        expect(stray, "properties in :root that no theme can override").toEqual([]);
    });
});

describe("no colour literals outside :root", () => {
    // Two deliberate exceptions, both in the colour picker's selected-swatch
    // ring. A swatch can be any colour including white and including black, so
    // the mark on it is two rings, one light over one dark -- there is no token
    // that can be right on both and the comment at the site says so.
    const ALLOWED = new Set(["#fff", "#000"]);

    it("uses no hex or rgb() colour outside the default-theme block", () => {
        const found = [...outsideRoot().matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)]
            .map((m) => m[0])
            .filter((literal) => !ALLOWED.has(literal));
        expect(found, "literal colours a theme cannot reach").toEqual([]);
    });

    it("uses no named colour as a VALUE outside the default-theme block", () => {
        // `white-space: nowrap` and `.move-phase-button-green-background` both
        // contain a colour word and neither is a colour, so the test looks for a
        // colour word after a `:` and before the `;` -- which is what a value is.
        const declarations = [...outsideRoot().matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1]);
        const named = /\b(white|black|yellow|grey|gray|red|green|blue|orange|purple|silver|lime|teal|navy|maroon|olive|fuchsia|aqua)\b/;
        const offenders = declarations.filter((value) => named.test(value));
        expect(offenders, "named colours used as values").toEqual([]);
    });
});

describe("the drawn controls have no PNGs left behind", () => {
    // Everything in this list was a `<img src=...>` whose GREY TWIN was the only
    // record that a control was disabled. Re-adding one would put the state back
    // in a file path, which is what `isStepperEnabled()` exists to end.
    const RETIRED = [
        "plusButton.png",
        "plusButtonGrey.png",
        "minusButton.png",
        "minusButtonGrey.png",
        "multipleIncrementerButton.png",
        "multipleIncrementerButtonGrey.png",
        "upgradeButtonIcon.png",
        "upgradeButtonIconPressed.png",
        "upgradeButtonGreyedOut.png",
        "buyButtonIcon.png",
        "buyButtonIconPressed.png",
        "buyButtonGreyedOut.png",
    ];

    const SOURCES = [
        "style.css",
        "ui.js",
        "resourceCalculations.js",
        "transferAndAttack.js",
        "src/ui/transferAttack/ArmyAllocationRow.js",
        "src/ui/transferAttack/TransferTable.js",
        "src/ui/transferAttack/AttackTable.js",
        "src/ui/components/ResourceWindow.js",
    ].map((file) => [file, stripComments(fs.readFileSync(path.join(ROOT, file), "utf8"))]);

    it.each(RETIRED)("no source still references %s", (asset) => {
        const users = SOURCES.filter(([, text]) => text.includes(asset)).map(([file]) => file);
        expect(users, `${asset} was replaced by a drawn control in Phase 7.11`).toEqual([]);
    });

    it("keeps the artwork PNGs that were deliberately NOT replaced", () => {
        // The brief was explicit: the resource and unit icons, and the upgrade
        // artwork, stay. This asserts the other half of the change -- that the
        // sweep did not take them with it.
        const rc = fs.readFileSync(path.join(ROOT, "resourceCalculations.js"), "utf8");
        for (const kept of [
            "farmIcon.png",
            "forestIcon.png",
            "oilWellIcon.png",
            "fortIcon.png",
            "infantryIcon.png",
            "assaultIcon.png",
            "airIcon.png",
            "navalIcon.png",
        ]) {
            expect(rc, `${kept} is artwork and is meant to stay`).toContain(kept);
        }
    });
});

describe("the stylesheet knows the classes the controls carry", () => {
    it("styles every class the stepper and action-button builders write", () => {
        const needed = [
            classNames.stepperButton,
            classNames.stepperPlus,
            classNames.stepperMinus,
            classNames.stepperCycle,
            classNames.actionButton,
            classNames.actionButtonLabel,
            classNames.isDisabled,
            classNames.isArmed,
        ];
        const missing = needed.filter((name) => !CODE.includes("." + name));
        expect(missing, "classes written by JS that the stylesheet never styles").toEqual([]);
    });

    it("gives `is-disabled` a rule on the stepper and on the action button", () => {
        // The one class that means "inert", and it has to mean something visible
        // on both controls or a disabled button looks live.
        expect(CODE).toMatch(/\.stepper-button\.is-disabled\s*\{/);
        expect(CODE).toMatch(/\.action-button\.is-disabled\s*\{/);
    });
});

describe("the two resource windows are one design", () => {
    // `ResourceWindow.js` has built Upgrade Territory and Buy Military from one
    // spec since Phase 6.3, but the stylesheet described them twice -- 300 lines
    // each, differing in nothing but the class prefix, which is how they drifted
    // to different row heights. Every shared rule now names both.
    const PAIRS = [
        [".navbar-upgrade-window", ".navbar-buy-window"],
        [".subtitle-upgrade-window", ".subtitle-buy-window"],
        [".key-bar-upgrade-window", ".key-bar-buy-window"],
        [".content-window-upgrade", ".content-window-buy"],
        [".info-panel-upgrade", ".info-panel-buy"],
        [".upgrade-table", ".buy-table"],
        [".upgrade-row", ".buy-row"],
        [".bottom-bar-upgrade-window", ".bottom-bar-buy-window"],
        [".bottom-bar-confirm-button", ".bottom-bar-buy-confirm-button"],
    ];

    it.each(PAIRS)("declares %s and %s together", (upgrade, buy) => {
        // Every selector list that mentions one must mention the other. A rule
        // that names only one is either a genuine difference -- in which case it
        // says so in a comment -- or the beginning of the next drift.
        const lists = [...CODE.matchAll(/([^{}]+)\{/g)].map((m) => m[1]);
        const lonely = lists.filter(
            (list) =>
                (list.includes(upgrade) && !list.includes(buy)) ||
                (list.includes(buy) && !list.includes(upgrade))
        );
        expect(lonely.map((s) => s.trim()), "one window styled without the other").toEqual([]);
    });
});
