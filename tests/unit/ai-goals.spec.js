// ai/goals.js -- Phase 5.5/5.6.
//
// The goal pipeline is four passes over one array whose SHAPE changes at each pass, which is
// the part that was impossible to follow in place and is what these tests pin down:
//
//   in   [type, ...fields]                 -- type at index 0
//   out  [count, type, ...fields]          -- type at index 1, count of duplicates at 0
//
// `countAndUnshiftSimilarRows()` is what moves it, which is why every function after it reads
// the type at `[1]` and every function before it reads the type at `[0]`. Getting that wrong
// silently produces goals of type `undefined` that no action handler matches.
//
// The whole module runs in Node: no DOM, no ui.js. `upPriorityForReconquistaTerritories()`
// reads the store, which is empty here, so it is a no-op -- exactly as it is for a country
// with no territory it once owned.

import { describe, expect, it } from "vitest";

import {
    prioritiseTurnGoalsBasedOnPersonality,
    refineTurnGoals
} from "../../src/ai/goals.js";

/** A leader's traits, all dialled to the middle unless a test cares. */
function traits(overrides = {}) {
    return {
        fortification: 0.5,
        territory_expansion: 0.5,
        reconquista: 0.5,
        style_of_war: 0.5,
        ...overrides
    };
}

function constantRng(value) {
    return () => value;
}

/**
 * `refineTurnGoals` is handed the goals wrapped in one more array -- `unrefinedGoals` is
 * built with a single `push()` of the whole list in the AI turn -- so the refinement reads
 * `arr[0]`. Wrapping here rather than in each test keeps that visible.
 */
const asUnrefined = (rows) => [rows];

describe("refineTurnGoals", () => {
    it("counts duplicate goals and puts the count on the front", () => {
        const goals = refineTurnGoals(
            asUnrefined([
                ["Siege", "Alsace", "Baden", 100, 40],
                ["Siege", "Alsace", "Wurttemberg", 120, 45]
            ]),
            "Germany",
            traits());

        expect(goals).toHaveLength(1);
        expect(goals[0][0]).toBe(2);   //two threats produced this one siege goal
        expect(goals[0][1]).toBe("Siege");
    });

    it("sums the threat of the goals it collapses", () => {
        const [goal] = refineTurnGoals(
            asUnrefined([
                ["Siege", "Alsace", "Baden", 100, 40],
                ["Siege", "Alsace", "Wurttemberg", 200, 45]
            ]),
            "Germany",
            traits());
        expect(goal).toContain(300);
    });

    it("keeps goals against different targets apart", () => {
        const goals = refineTurnGoals(
            asUnrefined([
                ["Siege", "Alsace", "Baden", 100, 40],
                ["Siege", "Lorraine", "Baden", 100, 40]
            ]),
            "Germany",
            traits());
        expect(goals).toHaveLength(2);
    });

    it("keeps the four goal types apart", () => {
        const goals = refineTurnGoals(
            asUnrefined([
                ["Siege", "Alsace", "Baden", 100, 40],
                ["Attack", "Alsace", "Baden", 100, 40],
                ["Bolster", "Alsace", "Baden", 1, 500, true, 100, 40],
                ["Economy", "Baden", 1, 2, 3]
            ]),
            "Germany",
            traits());
        expect(goals.map((goal) => goal[1]).sort())
            .toEqual(["Attack", "Bolster", "Economy", "Siege"]);
    });

    it("plans nothing from nothing", () => {
        expect(refineTurnGoals(asUnrefined([]), "Germany", traits())).toEqual([]);
    });
});

describe("prioritiseTurnGoalsBasedOnPersonality", () => {
    //Rows as refineTurnGoals leaves them: [count, type, target, source, threat, probability].
    const siege = (count, target) => [count, "Siege", target, "Baden", 100, 40];
    const bolster = (count, target) => [count, "Bolster", target, "Baden", 1, 500, true, 100];

    it("ranks a fortifier's bolstering above an expansionist's sieges", () => {
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [siege(1, "Alsace"), bolster(10, "Baden")],
            "Germany",
            traits({ fortification: 1, territory_expansion: 0.01 }),
            constantRng(0));
        expect(ranked[0][1]).toBe("Bolster");
    });

    it("ranks an expansionist's sieges above their fortifications", () => {
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [bolster(1, "Baden"), siege(10, "Alsace")],
            "Germany",
            traits({ fortification: 0.01, territory_expansion: 1 }),
            constantRng(0));
        expect(ranked[0][1]).toBe("Siege");
    });

    it("prefers the goal more threats agreed on, all else equal", () => {
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [siege(1, "Alsace"), siege(9, "Lorraine")],
            "Germany",
            traits(),
            constantRng(0));
        expect(ranked[0][2]).toBe("Lorraine");
    });

    it("drops a second interaction against a target it is already committed to", () => {
        //A country cannot both besiege and storm the same territory in one turn. The pair is
        //keyed on (target, source), so the first one planned survives and the other goes.
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [
                [5, "Siege", "Alsace", "Baden", 100, 40],
                [5, "Attack", "Alsace", "Baden", 100, 40]
            ],
            "Germany",
            traits(),
            constantRng(0));
        expect(ranked.filter((goal) => goal[2] === "Alsace")).toHaveLength(1);
    });

    it("leaves economy goals alone when the two interactions are deduplicated", () => {
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [
                [5, "Siege", "Alsace", "Baden", 100, 40],
                [5, "Attack", "Alsace", "Baden", 100, 40],
                [1, "Economy", "Baden", 1, 2, 3]
            ],
            "Germany",
            traits(),
            constantRng(0));
        expect(ranked.some((goal) => goal[1] === "Economy")).toBe(true);
    });

    it("draws from the injected stream, not from Math.random", () => {
        //The economy goal's priority is `rng() * fortification`, so a stream that always
        //returns 1 ranks it above a stream that always returns 0. If the module had reached
        //for Math.random instead, neither would be reproducible.
        const rows = () => [
            [1, "Economy", "Baden", 1, 2, 3],
            [1, "Bolster", "Alsace", "Baden", 1, 500, true, 100]
        ];
        const eager = prioritiseTurnGoalsBasedOnPersonality(
            rows(), "Germany", traits({ fortification: 1 }), constantRng(1));
        const idle = prioritiseTurnGoalsBasedOnPersonality(
            rows(), "Germany", traits({ fortification: 1 }), constantRng(0));
        expect(eager[0][1]).toBe("Economy");
        expect(idle[0][1]).toBe("Bolster");
    });
});

describe("the campaign's budgets and biases", () => {
    //A campaign as `strategy.js` builds one, cut down to the fields the prioritiser reads.
    //Written out rather than planned through `planCampaign()` so that these tests say what
    //the goal layer does with a campaign, not how a campaign is chosen -- that is
    //ai-strategy.spec.js's job.
    const campaign = (overrides = {}) => ({
        posture: "EXPAND",
        siegeBudget: 99,
        attackBudget: 99,
        economyBias: 1,
        defenceBias: 1,
        offenceBias: 1,
        ratings: new Map(),
        objective: { kind: "CONTINENTAL", required: 3, continents: ["Europe"], banked: [] },
        ...overrides
    });

    const siege = (count, target) => [count, "Siege", target, "Baden", 100, 40];
    const attack = (count, target) => [count, "Attack", target, "Baden", 100, 40];

    it("cuts the ranked list down to the sieges the country can afford", () => {
        //The behaviour that was missing altogether: an AI planned a siege against
        //everything it could reach and opened all of them, which is how a country came to
        //have sixty-seven running at once.
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [siege(9, "Alsace"), siege(8, "Lorraine"), siege(7, "Baden")],
            "Germany",
            traits(),
            constantRng(0),
            campaign({ siegeBudget: 1 }));
        expect(ranked.filter((goal) => goal[1] === "Siege")).toHaveLength(1);
    });

    it("keeps the best sieges rather than the first ones it happened to plan", () => {
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [siege(1, "Alsace"), siege(9, "Lorraine")],
            "Germany",
            traits(),
            constantRng(0),
            campaign({ siegeBudget: 1 }));
        expect(ranked[0][2]).toBe("Lorraine");
    });

    it("budgets attacks separately from sieges", () => {
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [siege(9, "Alsace"), attack(9, "Lorraine"), attack(8, "Baden")],
            "Germany",
            traits(),
            constantRng(0),
            campaign({ siegeBudget: 1, attackBudget: 1 }));
        expect(ranked.filter((goal) => goal[1] === "Siege")).toHaveLength(1);
        expect(ranked.filter((goal) => goal[1] === "Attack")).toHaveLength(1);
    });

    it("never cuts an economy or a bolster goal, which cost gold rather than armies", () => {
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [
                [1, "Economy", "Baden", 1, 2, 3],
                [1, "Economy", "Alsace", 1, 2, 3],
                [1, "Bolster", "Baden", 1, 500, true, 100],
                siege(9, "Lorraine")
            ],
            "Germany",
            traits(),
            constantRng(0),
            campaign({ siegeBudget: 0, attackBudget: 0 }));
        expect(ranked.filter((goal) => goal[1] === "Economy")).toHaveLength(2);
        expect(ranked.filter((goal) => goal[1] === "Bolster")).toHaveLength(1);
        expect(ranked.filter((goal) => goal[1] === "Siege")).toHaveLength(0);
    });

    it("ranks reinforcing above attacking when the campaign is defending", () => {
        //Same leader, same goals; only the posture differs. Without the campaign biases an
        //AI with a quarter of itself besieged planned exactly the turn it would have
        //planned with none of itself besieged.
        const goals = () => [attack(5, "Alsace"), [5, "Bolster", "Baden", 1, 500, true, 100]];
        const defending = prioritiseTurnGoalsBasedOnPersonality(
            goals(), "Germany", traits(), constantRng(0),
            campaign({ posture: "DEFEND", defenceBias: 1, offenceBias: 0.25 }));
        const expanding = prioritiseTurnGoalsBasedOnPersonality(
            goals(), "Germany", traits(), constantRng(0),
            campaign({ posture: "EXPAND", defenceBias: 0.6, offenceBias: 1 }));
        expect(defending[0][1]).toBe("Bolster");
        expect(expanding[0][1]).toBe("Attack");
    });

    it("ranks a strategically worthwhile target above an equally-agreed worthless one", () => {
        //Both goals were agreed on by the same number of threats, so the old ranking --
        //`count * territory_expansion` -- could not tell them apart at all. The rating is
        //what says one of them completes a continent and the other is an island.
        const ratings = new Map([
            ["Attack|Alsace|Baden", { score: 0.1 }],
            ["Attack|Lorraine|Baden", { score: 4 }]
        ]);
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [attack(5, "Alsace"), attack(5, "Lorraine")],
            "Germany",
            traits(),
            constantRng(0),
            campaign({ ratings }));
        expect(ranked[0][2]).toBe("Lorraine");
    });

    it("ranks exactly as it always did when there is no campaign", () => {
        //Every existing caller passes four arguments, and the goal layer has to keep
        //working for them -- including the unit tests above this block.
        const ranked = prioritiseTurnGoalsBasedOnPersonality(
            [siege(1, "Alsace"), siege(9, "Lorraine")],
            "Germany",
            traits(),
            constantRng(0));
        expect(ranked).toHaveLength(2);
        expect(ranked[0][2]).toBe("Lorraine");
    });
});
