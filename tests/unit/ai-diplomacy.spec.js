// Who the AI declares war on, and who it leaves alone.
//
// Diplomacy checklist stage 3.1. `src/ai/diplomacy.js` is the only module in `src/ai/`
// allowed to decide a diplomatic action -- the containment `doctrine.js` has over victory
// conditions and `standingsGoalColumns.js` has on the UI side -- so this is where the whole
// declaration policy is pinned.
//
// THE ONE THING TO READ FIRST is the freeze guard. `allowsAttack()` permits WAR and nothing
// else, so a world that stops declaring is a world that stops fighting, and it looks
// identical to stage 2's deliberate silence: nothing throws, every turn completes, the map
// quietly stops changing. That is known-issue BA exactly. The guard is that a country's
// THEATRE commitment becomes a declaration unconditionally -- no posture refuses it, no war
// cap applies to it -- and the first three cases below are that guard, stated as tests.

import { describe, expect, it } from "vitest";

import { declarationDiscipline } from "../../src/config/balance.js";
import { DiplomaticState } from "../../src/state/diplomacy.js";
import { planDeclarations } from "../../src/ai/diplomacy.js";

const NEUTRAL = DiplomaticState.NEUTRAL;

/** Everything neutral unless the case under test says otherwise. */
function relations(overrides = {}) {
    return (other) => overrides[other] ?? NEUTRAL;
}

function campaign(overrides = {}) {
    const { theatre, ...rest } = overrides;
    return {
        country: "Alba",
        turn: 40,
        posture: "EXPAND",
        doctrine: { urgency: 0.1 },
        theatre: {
            rival: "Brava",
            candidates: [],
            ...theatre
        },
        ...rest
    };
}

function plan(overrides = {}) {
    return planDeclarations({
        country: "Alba",
        turn: overrides.turn ?? 40,
        campaign: campaign(overrides.campaign),
        relationStateOf: overrides.relationStateOf ?? relations(),
        warCount: overrides.warCount ?? 0,
        traits: overrides.traits ?? { risk_taking: 0.5 },
        playerCountry: overrides.playerCountry ?? null,
        graceTurns: overrides.graceTurns ?? 5
    });
}

const targets = (result) => result.declarations.map(row => row.target);

describe("the theatre commitment is a declaration of war", () => {
    it("declares on the committed rival", () => {
        expect(targets(plan())).toContain("Brava");
    });

    it("declares on it whatever the posture says", () => {
        //THE FREEZE GUARD. `postureAllowance` gives DEVELOP and DEFEND nothing, and most of
        //this map is small countries: if that table governed the theatre war too, the world
        //would go quiet and look exactly like the stage 2 checkpoint.
        for (const posture of ["DEVELOP", "DEFEND", "CONSOLIDATE", "EXPAND"]) {
            expect(targets(plan({ campaign: { posture } }))).toContain("Brava");
        }
    });

    it("declares on it even when the country is already over the war cap", () => {
        expect(targets(plan({ warCount: declarationDiscipline.concurrentWarCap + 4 })))
            .toContain("Brava");
    });

    it("says nothing when there is no theatre rival", () => {
        expect(plan({ campaign: { theatre: { rival: null } } }).declarations).toEqual([]);
    });

    it("does not declare again on a country it is already at war with", () => {
        const result = plan({ relationStateOf: relations({ Brava: DiplomaticState.WAR }) });
        expect(targets(result)).not.toContain("Brava");
        expect(result.skipped.some(row => row.target === "Brava")).toBe(true);
    });
});

describe("an agreement is not broken", () => {
    //Stage 5.6 prices a breach and nothing prices one yet, so the AI does not commit an act
    //whose consequence has not been built. A country walking out of a peace treaty for free
    //would teach the player that treaties are worthless, which is the opposite of what this
    //phase is for.
    for (const state of [
        DiplomaticState.PEACE,
        DiplomaticState.CEASEFIRE,
        DiplomaticState.ALLIANCE
    ]) {
        it("refuses to declare out of " + state, () => {
            const result = plan({ relationStateOf: relations({ Brava: state }) });
            expect(targets(result)).not.toContain("Brava");
            expect(result.skipped.find(row => row.target === "Brava").reason)
                .toMatch(/agreement/i);
        });
    }

    it("refuses a pair that has not met", () => {
        const result = plan({ relationStateOf: relations({ Brava: DiplomaticState.NO_CONTACT }) });
        expect(targets(result)).not.toContain("Brava");
    });
});

describe("the player's opening grace period", () => {
    it("refuses to declare on the player inside it", () => {
        const result = plan({ turn: 3, playerCountry: "Brava" });
        expect(targets(result)).not.toContain("Brava");
        expect(result.skipped.find(row => row.target === "Brava").reason)
            .toMatch(/grace/i);
    });

    it("declares on the player the moment it is over", () => {
        expect(targets(plan({ turn: 6, playerCountry: "Brava" }))).toContain("Brava");
    });

    it("leaves everybody else alone inside it", () => {
        //It is the PLAYER's grace period and nobody else's: the AI countries fight each
        //other from turn 1, exactly as `rateTarget()`'s copy of this rule already allows.
        expect(targets(plan({ turn: 3, playerCountry: "Zeta" }))).toContain("Brava");
    });
});

describe("opportunistic declarations", () => {
    const weak = { rival: "Cadra", weakness: 0.9, walled: false };
    const even = { rival: "Dorn", weakness: 0.5, walled: false };

    it("adds a visibly weaker neighbour when the posture allows one", () => {
        const result = plan({ campaign: { posture: "EXPAND", theatre: { candidates: [weak] } } });
        expect(targets(result)).toEqual(["Brava", "Cadra"]);
    });

    it("adds nobody while developing or defending", () => {
        for (const posture of ["DEVELOP", "DEFEND"]) {
            const result = plan({ campaign: { posture, theatre: { candidates: [weak] } } });
            expect(targets(result)).toEqual(["Brava"]);
        }
    });

    it("leaves an evenly-matched neighbour alone", () => {
        const result = plan({ campaign: { posture: "EXPAND", theatre: { candidates: [even] } } });
        expect(targets(result)).toEqual(["Brava"]);
    });

    it("leaves a rival already written off as a wall alone", () => {
        const result = plan({
            campaign: {
                posture: "EXPAND",
                theatre: { candidates: [{ rival: "Cadra", weakness: 0.95, walled: true }] }
            }
        });
        expect(targets(result)).toEqual(["Brava"]);
    });

    it("is refused to a pacifist leader, who still fights the theatre war", () => {
        const result = plan({
            traits: { risk_taking: 0.1 },
            campaign: { posture: "EXPAND", theatre: { candidates: [weak] } }
        });
        expect(targets(result)).toEqual(["Brava"]);
    });

    it("stops at the concurrent war cap", () => {
        const result = plan({
            warCount: declarationDiscipline.concurrentWarCap,
            campaign: { posture: "EXPAND", theatre: { candidates: [weak] } }
        });
        expect(targets(result)).toEqual(["Brava"]);
    });

    it("grants one further war when somebody is running away with the game", () => {
        const candidates = [weak, { rival: "Elin", weakness: 0.88, walled: false }];
        const calm = plan({
            campaign: { posture: "EXPAND", doctrine: { urgency: 0.1 }, theatre: { candidates } }
        });
        const alarmed = plan({
            campaign: { posture: "EXPAND", doctrine: { urgency: 0.9 }, theatre: { candidates } }
        });
        expect(targets(calm)).toEqual(["Brava", "Cadra"]);
        expect(targets(alarmed)).toEqual(["Brava", "Cadra", "Elin"]);
    });

    it("never declares twice on the same country", () => {
        const result = plan({
            campaign: {
                posture: "EXPAND",
                doctrine: { urgency: 0.9 },
                theatre: { rival: "Cadra", candidates: [weak, weak] }
            }
        });
        expect(targets(result)).toEqual(["Cadra"]);
    });

    it("never declares on itself", () => {
        const result = plan({
            campaign: {
                posture: "EXPAND",
                theatre: { rival: null, candidates: [{ rival: "Alba", weakness: 0.99 }] }
            }
        });
        expect(targets(result)).toEqual([]);
    });
});

describe("what it reports", () => {
    it("gives every declaration a reason the plan log can print", () => {
        const result = plan({
            campaign: {
                posture: "EXPAND",
                theatre: { candidates: [{ rival: "Cadra", weakness: 0.9, walled: false }] }
            }
        });
        for (const row of result.declarations) {
            expect(typeof row.reason).toBe("string");
            expect(row.reason.length).toBeGreaterThan(0);
        }
        expect(result.declarations[0].source).toBe("theatre");
        expect(result.declarations[1].source).toBe("opportunistic");
    });

    it("never uses a country name as an adjective", () => {
        //The activity feed's rule, and it applies to anything a player may end up reading:
        //there are no demonym forms for 207 country names.
        const result = plan({ campaign: { theatre: { candidates: [] } } });
        for (const row of [...result.declarations, ...result.skipped]) {
            expect(row.reason).not.toMatch(/\b(Alba|Brava)\s+(army|forces|border|leader)/);
        }
    });
});

describe("containment", () => {
    it("exposes no siege dial", () => {
        //`doctrine.js` refuses one because the siege budget's subtraction of running sieges
        //is what ended the seventeen-to-sixty-seven concurrent problem, and a multiplier
        //over that cap walks straight back into it. The same discipline here.
        for (const key of Object.keys(declarationDiscipline)) {
            expect(key).not.toMatch(/siege/i);
        }
    });
});
