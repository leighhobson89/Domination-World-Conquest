// src/ui/goals/goalCatalogue.js -- the five goals, as data.
//
// Built the way `src/ui/dominapedia/topics.js` is built and for the same reason: the panel
// that renders it should have no opinion about what is in it, so adding a sixth goal is one
// entry here and no change to `GoalSelect.js`. That only holds if the shape is pinned, which
// is what this file is for.
//
// The interesting properties are not the prose. They are: every goal offers at least one
// scale and a default that is actually IN its own list (a dropdown whose default is not one
// of its options shows blank); `conditionFor()` puts the scale on the right FIELD, which is
// the one place a mistake would be silent -- a Domination game with the scale written into
// `continentsRequired` reads as a valid condition and plays as the default one; and the
// bodies are blocks rather than markup, because content carrying HTML would carry the
// panel's styling decisions with it.

import { describe, expect, it } from "vitest";

import {
    allGoals,
    conditionFor,
    defaultScaleFor,
    describeLeaderProgress,
    goalFor,
    goalLabel,
    randomGoalCondition,
    scaleOf,
    scalesFor
} from "../../src/ui/goals/goalCatalogue.js";
import { VictoryCondition } from "../../src/ai/victory.js";
import {
    CONTINENTS_REQUIRED_FOR_VICTORY,
    DOMINATION_LAND_SHARE,
    GREAT_POWERS_REQUIRED,
    VICTORY_TURN_LIMIT
} from "../../src/config/balance.js";

const KINDS = [
    VictoryCondition.CONQUEST,
    VictoryCondition.DOMINATION,
    VictoryCondition.CONTINENTAL,
    VictoryCondition.GREAT_POWERS,
    VictoryCondition.TURN_LIMIT
];

describe("the catalogue", () => {
    it("offers five goals and never ELIMINATION", () => {
        //Elimination was written as a victory condition and never was one -- it is what
        //losing means, and it runs underneath every goal rather than being one of them.
        const kinds = allGoals().map(goal => goal.kind);
        expect(kinds).toHaveLength(5);
        expect(kinds).not.toContain(VictoryCondition.ELIMINATION);
        for (const kind of KINDS) {
            expect(kinds).toContain(kind);
        }
    });

    it("gives every goal a player-facing name that is not the enum key", () => {
        for (const goal of allGoals()) {
            expect(goal.name.length).toBeGreaterThan(0);
            expect(goal.name).not.toBe(goal.kind);
        }
    });

    it("gives every goal a one-line summary that is not its title again", () => {
        for (const goal of allGoals()) {
            expect(goal.summary.length).toBeGreaterThan(10);
            expect(goal.summary).not.toBe(goal.name);
        }
    });

    it("is frozen all the way down, so nothing can edit the rules by editing the menu", () => {
        expect(Object.isFrozen(allGoals())).toBe(true);
        for (const goal of allGoals()) {
            expect(Object.isFrozen(goal)).toBe(true);
            expect(Object.isFrozen(goal.scales)).toBe(true);
            expect(Object.isFrozen(goal.body)).toBe(true);
        }
    });

    it("writes bodies as blocks and never as markup", () => {
        const allowed = new Set(["p", "h", "ul"]);
        for (const goal of allGoals()) {
            expect(goal.body.length).toBeGreaterThan(0);
            for (const block of goal.body) {
                expect(allowed.has(block.kind)).toBe(true);
                const text = block.kind === "ul" ? block.items.join(" ") : block.text;
                expect(text).not.toMatch(/<[a-z/]/i);
            }
        }
    });
});

describe("scales", () => {
    it("gives World Conquest exactly one, because there is only one way to own everything", () => {
        expect(scalesFor(VictoryCondition.CONQUEST)).toHaveLength(1);
    });

    it("gives every other goal a choice", () => {
        for (const kind of KINDS.filter(k => k !== VictoryCondition.CONQUEST)) {
            expect(scalesFor(kind).length).toBeGreaterThan(1);
        }
    });

    it("labels every option, so a dropdown never shows a bare number", () => {
        for (const kind of KINDS) {
            for (const scale of scalesFor(kind)) {
                expect(typeof scale.label).toBe("string");
                expect(scale.label.length).toBeGreaterThan(0);
            }
        }
    });

    it("has a default that is one of its own options", () => {
        //A dropdown whose default value is not in its list renders blank, which reads as a
        //rendering fault on the one screen a player cannot skip.
        for (const kind of KINDS) {
            const values = scalesFor(kind).map(scale => scale.value);
            expect(values).toContain(defaultScaleFor(kind));
        }
    });

    it("takes its defaults from balance.js rather than restating them", () => {
        expect(defaultScaleFor(VictoryCondition.CONTINENTAL)).toBe(CONTINENTS_REQUIRED_FOR_VICTORY);
        expect(defaultScaleFor(VictoryCondition.DOMINATION)).toBe(DOMINATION_LAND_SHARE);
        expect(defaultScaleFor(VictoryCondition.TURN_LIMIT)).toBe(VICTORY_TURN_LIMIT);
        expect(defaultScaleFor(VictoryCondition.GREAT_POWERS)).toBe(GREAT_POWERS_REQUIRED);
    });

    it("answers for a goal it has never heard of rather than throwing", () => {
        expect(scalesFor("NOT_A_GOAL")).toEqual([]);
        expect(goalFor("NOT_A_GOAL")).toBe(null);
    });
});

describe("conditionFor -- the scale on the right field", () => {
    it("writes a continent count into continentsRequired", () => {
        expect(conditionFor(VictoryCondition.CONTINENTAL, 4))
            .toMatchObject({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 4 });
    });

    it("writes a land share into landShare", () => {
        expect(conditionFor(VictoryCondition.DOMINATION, 0.8))
            .toMatchObject({ kind: VictoryCondition.DOMINATION, landShare: 0.8 });
    });

    it("writes a turn into turnLimit", () => {
        expect(conditionFor(VictoryCondition.TURN_LIMIT, 350))
            .toMatchObject({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 350 });
    });

    it("writes a power count into greatPowersRequired, with the names beside it", () => {
        const condition = conditionFor(VictoryCondition.GREAT_POWERS, 3, {
            greatPowers: ["United States", "Russia", "China", "India", "Brazil"]
        });
        expect(condition.greatPowersRequired).toBe(3);
        expect(condition.greatPowers).toHaveLength(5);
    });

    it("copies the names rather than adopting the caller's array", () => {
        const names = ["United States", "Russia"];
        const condition = conditionFor(VictoryCondition.GREAT_POWERS, 3, { greatPowers: names });
        names.push("Somewhere Else");
        expect(condition.greatPowers).toHaveLength(2);
    });

    it("carries no great powers under any other goal", () => {
        for (const kind of KINDS.filter(k => k !== VictoryCondition.GREAT_POWERS)) {
            expect(conditionFor(kind, defaultScaleFor(kind), {
                greatPowers: ["United States"]
            }).greatPowers).toEqual([]);
        }
    });

    it("falls back to the default scale when handed nonsense", () => {
        expect(conditionFor(VictoryCondition.TURN_LIMIT, "soon").turnLimit)
            .toBe(defaultScaleFor(VictoryCondition.TURN_LIMIT));
    });

    it("needs no scale at all for World Conquest", () => {
        expect(conditionFor(VictoryCondition.CONQUEST).kind).toBe(VictoryCondition.CONQUEST);
    });
});

describe("randomGoalCondition -- what a spectated game opens on", () => {
    it("can reach every goal in the catalogue", () => {
        //Spectator mode exists to watch the AI, and an AI watched only under the default
        //condition is an AI half of whose behaviour is never seen.
        const seen = new Set();
        for (let index = 0; index < allGoals().length; index++) {
            //A draw that lands squarely in each goal's slice, and then in its first scale.
            const at = (index + 0.5) / allGoals().length;
            let call = 0;
            seen.add(randomGoalCondition(() => (call++ === 0 ? at : 0)).kind);
        }
        expect(seen.size).toBe(allGoals().length);
    });

    it("always returns a scale that goal actually offers", () => {
        for (let draw = 0; draw < 1; draw += 0.037) {
            const condition = randomGoalCondition(() => draw);
            const values = scalesFor(condition.kind).map(option => option.value);
            expect(values).toContain(scaleOf(condition));
        }
    });

    it("never runs off the end when the draw returns exactly 1", () => {
        expect(() => randomGoalCondition(() => 1)).not.toThrow();
        expect(goalFor(randomGoalCondition(() => 1).kind)).not.toBe(null);
    });

    it("takes the great powers along when it lands on Great Powers", () => {
        const powers = ["United States", "Russia", "China", "India", "Brazil"];
        const index = allGoals().findIndex(goal => goal.kind === VictoryCondition.GREAT_POWERS);
        const at = (index + 0.5) / allGoals().length;
        let call = 0;
        const condition = randomGoalCondition(() => (call++ === 0 ? at : 0), { greatPowers: powers });
        expect(condition.kind).toBe(VictoryCondition.GREAT_POWERS);
        expect(condition.greatPowers).toEqual(powers);
    });
});

describe("goalLabel -- one line naming the goal and its scale", () => {
    it("names both halves", () => {
        const label = goalLabel(VictoryCondition.CONTINENTAL, 4);
        expect(label).toContain(goalFor(VictoryCondition.CONTINENTAL).name);
        expect(label).toContain("4");
    });

    it("reads as one phrase for World Conquest rather than repeating itself", () => {
        expect(goalLabel(VictoryCondition.CONQUEST, 1))
            .toBe(goalFor(VictoryCondition.CONQUEST).name);
    });

    it("survives a goal it has never heard of", () => {
        expect(typeof goalLabel("NOT_A_GOAL", 1)).toBe("string");
    });
});

describe("describeLeaderProgress -- the leader must not be measured against itself", () => {
    const timed = { kind: VictoryCondition.TURN_LIMIT, turnLimit: 200 };

    it("passes the ordinary progress label straight through for four of the five goals", () => {
        for (const kind of KINDS.filter(k => k !== VictoryCondition.TURN_LIMIT)) {
            expect(describeLeaderProgress({ kind }, { label: "Conquest: 78 of 359 territories" }))
                .toBe("Conquest: 78 of 359 territories");
        }
    });

    it("never says 100% of the leader, which is what a timed game's own label reads", () => {
        //`victoryProgress()` under TURN_LIMIT is "Largest empire: N% of the leader" -- a
        //comparison AGAINST the leader. Applied to the leader it is 100%, every turn, in
        //every game, whoever is winning and however far ahead. It is the one line that can
        //never say anything, which is exactly why it needs replacing rather than reusing.
        const text = describeLeaderProgress(timed, {
            label: "Largest empire: 100% of the leader", territories: 51, turn: 47
        });
        expect(text).not.toContain("of the leader");
        expect(text).not.toContain("100%");
    });

    it("says instead how much the leader holds and how much clock is left", () => {
        expect(describeLeaderProgress(timed, { label: "x", territories: 51, turn: 47 }))
            .toBe("51 territories, turn 47 of 200");
    });

    it("counts one territory in the singular", () => {
        expect(describeLeaderProgress(timed, { territories: 1, turn: 3 }))
            .toBe("1 territory, turn 3 of 200");
    });

    it("uses the timed game's own limit, not the default", () => {
        expect(describeLeaderProgress({ kind: VictoryCondition.TURN_LIMIT, turnLimit: 500 },
            { territories: 10, turn: 400 })).toContain("of 500");
    });

    it("survives being asked with nothing", () => {
        expect(typeof describeLeaderProgress(undefined, undefined)).toBe("string");
        expect(describeLeaderProgress(timed, {})).toBe("0 territories, turn 0 of 200");
    });
});
