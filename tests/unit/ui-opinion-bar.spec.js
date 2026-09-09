// The opinion bar, as geometry and a word.
//
// Pinned here rather than in an e2e spec for the reason every piece of wording in this
// project is: no e2e spec asserts prose, and the tooltip is rebuilt dozens of times a second
// while the pointer moves. What these actually protect is the CENTRED track -- the one
// decision in the control that had to be made rather than copied, and the one a later
// refactor is most likely to flatten into an ordinary left-to-right fill.

import { describe, expect, it } from "vitest";

import { BAR_CENTRE_PERCENT, opinionBarModel, opinionTooltipBars }
    from "../../src/ui/diplomacy/opinionBar.js";
import { opinionDiscipline } from "../../src/config/balance.js";

describe("one bar", () => {
    it("draws nothing at all at neutral, and marks where nothing is", () => {
        //A relation nobody feels anything about must not draw half a bar, which is what a
        //left-to-right fill would do and is why the track is centred.
        const bar = opinionBarModel(0);
        expect(bar.fillPercent).toBe(0);
        expect(bar.offsetPercent).toBe(BAR_CENTRE_PERCENT);
        expect(bar.word).toBe("neutral");
    });

    it("grows leftwards out of the centre when it is negative", () => {
        const bar = opinionBarModel(-opinionDiscipline.range);
        expect(bar.side).toBe("left");
        expect(bar.fillPercent).toBe(BAR_CENTRE_PERCENT);
        expect(bar.offsetPercent).toBe(0);
        expect(bar.tone).toBe("hostile");
    });

    it("grows rightwards out of the centre when it is positive", () => {
        const bar = opinionBarModel(opinionDiscipline.range);
        expect(bar.side).toBe("right");
        expect(bar.fillPercent).toBe(BAR_CENTRE_PERCENT);
        expect(bar.offsetPercent).toBe(BAR_CENTRE_PERCENT);
        expect(bar.tone).toBe("friendly");
    });

    it("never leaves the track, whatever it is handed", () => {
        for (const value of [-1000, 1000, NaN, undefined, "hello"]) {
            const bar = opinionBarModel(value);
            expect(bar.offsetPercent).toBeGreaterThanOrEqual(0);
            expect(bar.offsetPercent + bar.fillPercent).toBeLessThanOrEqual(100);
        }
    });

    it("shows a whole number, because the store keeps a decimal so the settle can move", () => {
        expect(opinionBarModel(-37.4).value).toBe(-37);
    });

    it("uses the same four tone names the relation rows do", () => {
        //An opinion bar with a fifth vocabulary beside those rows would be two colour systems
        //in one box.
        const tones = new Set([-100, -20, 0, 60].map(value => opinionBarModel(value).tone));
        expect([...tones].every(tone =>
            ["hostile", "caution", "muted", "friendly"].includes(tone))).toBe(true);
    });
});

describe("the pair of them", () => {
    it("puts THEIR view of you first, because that is what you are asking", () => {
        const bars = opinionTooltipBars({
            country: "Spain", playerCountry: "France", theirs: -80, ours: 20
        });
        expect(bars).toHaveLength(2);
        expect(bars[0].label).toContain("How Spain sees you");
        expect(bars[0].value).toBe(-80);
        expect(bars[1].label).toContain("How you see Spain");
        expect(bars[1].value).toBe(20);
    });

    it("draws none on the player's own land", () => {
        expect(opinionTooltipBars({
            country: "France", playerCountry: "France", theirs: 0, ours: 0
        })).toHaveLength(0);
    });

    it("draws none in spectator mode, where there is nobody to have an opinion", () => {
        expect(opinionTooltipBars({
            country: "Spain", playerCountry: null, theirs: 0, ours: 0
        })).toHaveLength(0);
    });
});
