// The wording and the colour of one activity-feed line.
//
// Phase 7.4. `describeActivity()` is separate from the panel for the same reason
// `deriveMoveButtonState()` is separate from the move button: the part with
// judgement in it is the part worth pinning, and it happens to be pure.
//
// The rules under test are the brief's, and two of them are counter-intuitive
// enough to be worth naming here rather than only at the assertion:
//
//   * A conquest is GREEN whoever did it, because somebody won. The single
//     exception is the one the player lost, which is red. Colour describes the
//     event; it is not a scoreboard.
//   * A failed attack is RED whoever attacked -- including an attack the player
//     repelled. The line describes the attack, and the attack failed. Making that
//     one green would be the only place in the feed where the same event had two
//     colours depending on who was reading it.
//
// Size is a SEPARATE axis from colour, which is what lets a player defeat be red
// and large at the same time.

import { describe, expect, it } from "vitest";

import { ActivityKind } from "../../src/state/activityLog.js";
import { Tone, describeActivity, summariseTurn } from "../../src/ui/activityFeed/describeActivity.js";

function entry(overrides = {}) {
    return {
        kind: ActivityKind.CONQUEST,
        territory: "Balearic Islands",
        defender: "Spain",
        attacker: "Libya",
        playerAttacking: false,
        playerDefending: false,
        turnsUnderSiege: null,
        ...overrides,
    };
}

describe("a conquest", () => {
    it("reads Territory (Country) conquered by Country, the brief's format", () => {
        expect(describeActivity(entry()).text).toBe(
            "Balearic Islands (Spain) conquered by Libya"
        );
    });

    it("names the country it was taken FROM, not the one that holds it now", () => {
        // The trap this avoids has already been hit once, in the Wars & Sieges tab:
        // reading the owner back off the world after the fact showed the winner's
        // flag on both sides of a war they had won (known-issues AS). The log stores
        // the defender at the moment it happened; this only formats it.
        const line = describeActivity(entry({ defender: "Spain", attacker: "Libya" })).text;
        expect(line).toContain("(Spain)");
        expect(line).toMatch(/conquered by Libya$/);
    });

    it("is a victory whoever did it", () => {
        expect(describeActivity(entry()).tone).toBe(Tone.VICTORY);
        expect(describeActivity(entry({ playerAttacking: true })).tone).toBe(Tone.VICTORY);
    });

    it("is a LOSS when the player is the country it was taken from", () => {
        expect(describeActivity(entry({ playerDefending: true })).tone).toBe(Tone.LOSS);
    });

    it("takes the crossed swords", () => {
        expect(describeActivity(entry()).icon).toBe("war");
    });
});

describe("a failed attack", () => {
    const failed = (overrides) =>
        describeActivity(entry({ kind: ActivityKind.ATTACK_FAILED, ...overrides }));

    it("reads Country fails to conquer Territory (Country)", () => {
        expect(failed().text).toBe("Libya fails to conquer Balearic Islands (Spain)");
    });

    it("is red whether the attacker is an AI or the player", () => {
        expect(failed().tone).toBe(Tone.LOSS);
        expect(failed({ playerAttacking: true }).tone).toBe(Tone.LOSS);
        // And when the PLAYER repelled it. See the note at the top of this file:
        // the line describes the attack, and the attack failed.
        expect(failed({ playerDefending: true }).tone).toBe(Tone.LOSS);
    });
});

describe("sieges", () => {
    const siege = (kind, overrides) => describeActivity(entry({ kind, ...overrides }));

    it("are amber in all four of their states", () => {
        for (const kind of [
            ActivityKind.SIEGE_STARTED,
            ActivityKind.SIEGE_ONGOING,
            ActivityKind.SIEGE_LIFTED,
            ActivityKind.SIEGE_WON,
            ActivityKind.SIEGE_LOST,
        ]) {
            expect(siege(kind).tone, kind).toBe(Tone.SIEGE);
            expect(siege(kind).icon, kind).toBe("siege");
        }
    });

    it("says who laid the siege and on whom", () => {
        expect(siege(ActivityKind.SIEGE_STARTED).text).toBe(
            "Libya lays siege to Balearic Islands (Spain)"
        );
    });

    it("counts the turns on an ongoing siege, and copes when it cannot", () => {
        expect(siege(ActivityKind.SIEGE_ONGOING, { turnsUnderSiege: 3 }).text).toContain("turn 3");
        expect(siege(ActivityKind.SIEGE_ONGOING).text).not.toContain("turn null");
    });

    it("says which side won when a siege becomes a battle", () => {
        expect(siege(ActivityKind.SIEGE_WON).text).toContain("Libya wins");
        expect(siege(ActivityKind.SIEGE_LOST).text).toContain("Spain holds");
    });

    it("says who was arrested when a siege is lifted", () => {
        expect(siege(ActivityKind.SIEGE_LIFTED).text).toContain("Libya's troops arrested");
    });
});

describe("the player flag is a separate axis from the colour", () => {
    it("is set for either side, and does not change the tone", () => {
        const win = describeActivity(entry({ playerAttacking: true }));
        const loss = describeActivity(entry({ playerDefending: true }));

        expect(win.isPlayer).toBe(true);
        expect(loss.isPlayer).toBe(true);
        // Same flag, opposite tones -- which is the whole point of keeping them apart.
        expect(win.tone).toBe(Tone.VICTORY);
        expect(loss.tone).toBe(Tone.LOSS);
    });

    it("is unset for a war on the far side of the map", () => {
        expect(describeActivity(entry()).isPlayer).toBe(false);
    });
});

describe("a collapsed turn's summary", () => {
    it("counts the actions", () => {
        expect(summariseTurn([entry(), entry()])).toBe("2 actions");
        expect(summariseTurn([entry()])).toBe("1 action");
    });

    it("calls out the player's own, which is what a shut section is scanned for", () => {
        const entries = [entry(), entry({ playerDefending: true }), entry()];
        expect(summariseTurn(entries)).toBe("3 actions, 1 involving you");
    });

    it("says so when nothing happened", () => {
        expect(summariseTurn([])).toBe("quiet");
    });
});

describe("an unknown kind", () => {
    it("still renders something rather than an empty row", () => {
        // `recordActivity()` rejects unknown kinds, so this can only happen if one is
        // added to `ActivityKind` and not to the switch. Drawing a blank row is how
        // that would go unnoticed.
        const described = describeActivity(entry({ kind: "somethingNew" }));
        expect(described.text).toContain("Balearic Islands");
    });
});
