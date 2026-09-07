// src/ai/debugPlans.js -- a plan asserted from outside, and what it does to the four gates
// a target has to pass.
//
// The behaviour worth pinning is not "the table remembers what was put in it". It is that
// the priority tiers move ALL FOUR gates together, because the failure mode this feature
// has is silent and looks exactly like the tool not working: a country ranks the injected
// target first (the weight gate) and then declines to attack it, because the odds floor,
// the budget or the force sizing still said no. Every test below is one of those four.
//
// The other half is the promise the module makes about its own lifetime: a succession wipes
// a country's theatre, walls, setbacks and posture, and must NOT wipe this.
//
// Everything runs in Node. `debugPlans.js` imports nothing at all, and the campaign layer
// it feeds takes its randomness injected, so there is nothing to stub.

import { beforeEach, describe, expect, it } from "vitest";

import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import {
    DebugPlanKind,
    DebugPlanPriority,
    __resetDebugPlansForTests,
    activeDebugPlans,
    clearAllDebugPlans,
    clearDebugPlan,
    debugPlanPriorities,
    debugPlanPush,
    debugPlanReach,
    debugPlanStrength,
    debugPlanTargets,
    describeDebugPlan,
    onDebugPlansChanged,
    retireRealisedDebugPlans,
    setDebugPlan
} from "../../src/ai/debugPlans.js";
import {
    campaignWeightForTarget,
    clearPlansFor,
    planCampaign,
    resetCampaigns
} from "../../src/ai/strategy.js";
import { rateTarget, Verdict } from "../../src/ai/targeting.js";
import { decideCommitment, disposableForce } from "../../src/ai/commitment.js";
import { resetVictoryCondition } from "../../src/ai/victory.js";
import {
    attackDiscipline,
    commitmentDiscipline,
    siegeDiscipline
} from "../../src/config/balance.js";

const HALF = () => 0.5;

function territory(overrides = {}) {
    return {
        uniqueId: "1",
        territoryName: "Somewhere",
        continent: "Europe",
        dataName: "Alba",
        owner: "Alba",
        originalOwner: "Alba",
        area: 1000,
        devIndex: 0.5,
        continentModifier: 1,
        defenseBonus: 0,
        armyForCurrentTerritory: 1000,
        goldForCurrentTerritory: 500,
        farmsBuilt: 0,
        forestsBuilt: 0,
        oilWellsBuilt: 0,
        fortsBuilt: 0,
        ...overrides
    };
}

/** Alba holds most of Europe; Brava holds the rest and all of Africa. */
function world() {
    const rows = [];
    for (let index = 0; index < 5; index++) {
        rows.push(territory({
            uniqueId: "eu" + index,
            territoryName: "Europe" + index,
            continent: "Europe",
            dataName: index < 4 ? "Alba" : "Brava",
            owner: index < 4 ? "Alba" : "Brava"
        }));
    }
    for (let index = 0; index < 6; index++) {
        rows.push(territory({
            uniqueId: "af" + index,
            territoryName: "Africa" + index,
            continent: "Africa",
            continentModifier: 0.5,
            dataName: "Brava",
            owner: "Brava"
        }));
    }
    return rows;
}

function leader(traits = {}) {
    return {
        leaderType: "balanced",
        name: "Test Leader",
        traits: {
            fortification: 0.5,
            territory_expansion: 0.5,
            style_of_war: 0.5,
            reconquista: 0.5,
            risk_taking: 0.5,
            ...traits
        }
    };
}

function planFor(country = "Alba", turn = 10) {
    return planCampaign(country, { turn, leader: leader(), rng: HALF });
}

beforeEach(() => {
    __resetStateForTests();
    __resetDebugPlansForTests();
    resetCampaigns();
    resetVictoryCondition();
    seedTerritories(world());
});

describe("the table", () => {
    it("holds one plan per country and the newest replaces the last", () => {
        setDebugPlan({ country: "Alba", kind: DebugPlanKind.COUNTRY, target: "Brava", priority: DebugPlanPriority.NUDGE, turn: 3 });
        setDebugPlan({ country: "Alba", kind: DebugPlanKind.COUNTRY, target: "Carda", priority: DebugPlanPriority.PUSH, turn: 5 });

        expect(activeDebugPlans()).toHaveLength(1);
        expect(activeDebugPlans()[0].target).toBe("Carda");
        expect(activeDebugPlans()[0].setOnTurn).toBe(5);
    });

    it("refuses a plan with no country or no target rather than storing a broken one", () => {
        expect(setDebugPlan({ country: "", target: "Brava" })).toBeNull();
        expect(setDebugPlan({ country: "Alba", target: "" })).toBeNull();
        expect(activeDebugPlans()).toHaveLength(0);
    });

    it("falls back to the weakest tier rather than throwing on an unknown priority", () => {
        const plan = setDebugPlan({ country: "Alba", target: "Brava", priority: "nonsense" });
        expect(plan.priority).toBe(debugPlanPriorities[0].id);
        expect(debugPlanStrength(plan)).toBe(debugPlanPriorities[0]);
    });

    it("tells its listeners on every write, including the cancels", () => {
        const seen = [];
        const stop = onDebugPlansChanged(plans => seen.push(plans.length));

        setDebugPlan({ country: "Alba", target: "Brava" });
        setDebugPlan({ country: "Brava", target: "Alba" });
        clearDebugPlan("Alba");
        clearAllDebugPlans();
        stop();
        setDebugPlan({ country: "Alba", target: "Brava" });

        expect(seen).toEqual([1, 2, 1, 0]);
    });

    it("does not notify when there was nothing to cancel", () => {
        let calls = 0;
        onDebugPlansChanged(() => calls++);
        clearDebugPlan("Nobody");
        clearAllDebugPlans();
        expect(calls).toBe(0);
    });
});

describe("what a plan points at", () => {
    it("matches a COUNTRY plan on the current owner, so conquered ground joins the war", () => {
        const plan = setDebugPlan({ country: "Alba", kind: DebugPlanKind.COUNTRY, target: "Brava" });

        expect(debugPlanTargets(plan, { territoryName: "Africa0", dataName: "Brava" })).toBe(true);
        //The same hill once Carda has taken it: no longer Brava's, no longer the plan's.
        expect(debugPlanTargets(plan, { territoryName: "Africa0", dataName: "Carda" })).toBe(false);
    });

    it("matches a TERRITORY plan on the stable identity, whoever ends up holding it", () => {
        const plan = setDebugPlan({ country: "Alba", kind: DebugPlanKind.TERRITORY, target: "Africa0" });

        expect(debugPlanTargets(plan, { territoryName: "Africa0", dataName: "Brava" })).toBe(true);
        expect(debugPlanTargets(plan, { territoryName: "Africa0", dataName: "Carda" })).toBe(true);
        expect(debugPlanTargets(plan, { territoryName: "Africa1", dataName: "Brava" })).toBe(false);
    });

    it("treats anything that is not a territory plan as a country plan", () => {
        const plan = setDebugPlan({ country: "Alba", kind: "nonsense", target: "Brava" });
        expect(plan.kind).toBe(DebugPlanKind.COUNTRY);
    });
});

describe("gate one: the campaign carries the plan and its dials", () => {
    it("attaches nothing when no plan is injected", () => {
        expect(planFor().debugPlan).toBeUndefined();
    });

    it("lowers both odds floors, never below the 5% the leader's own floors clamp to", () => {
        const before = planFor();
        const plainAttack = before.attackOddsFloor;
        const plainSiege = before.siegeOddsFloor;

        resetCampaigns();
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PRESS });
        const pressed = planFor();

        expect(pressed.attackOddsFloor).toBeCloseTo(Math.max(5, plainAttack * 0.5), 5);
        expect(pressed.siegeOddsFloor).toBeCloseTo(Math.max(5, plainSiege * 0.5), 5);

        resetCampaigns();
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.ALL_OUT });
        const allOut = planFor();
        expect(allOut.attackOddsFloor).toBe(5);
        expect(allOut.siegeOddsFloor).toBe(5);
    });

    it("raises the budgets to the tier's floor, so a posture cannot ration the plan away", () => {
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.ALL_OUT });
        const campaign = planFor();

        expect(campaign.attackBudget).toBe(attackDiscipline.maxPerTurn);
        expect(campaign.siegeBudget).toBe(siegeDiscipline.maxOpenedPerTurn);
        expect(campaign.attacksPerTerritory).toBe(attackDiscipline.maxAttacksPerTerritory);
    });

    it("never asks for a budget the rest of the game does not recognise", () => {
        //A floor above `maxPerTurn` or `maxOpenedPerTurn` is not a harder push; it is a
        //budget that means something different from every other budget in the game, and
        //`doAiActions()` spends it without noticing. The top tier stops at the ceiling.
        for (const tier of debugPlanPriorities) {
            expect(tier.minAttackBudget).toBeLessThanOrEqual(attackDiscipline.maxPerTurn);
            expect(tier.minSiegeBudget).toBeLessThanOrEqual(siegeDiscipline.maxOpenedPerTurn);
        }
    });

    it("never LOWERS a budget the country had already earned", () => {
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.NUDGE });
        const nudged = planFor();

        resetCampaigns();
        __resetDebugPlansForTests();
        const plain = planFor();

        expect(nudged.attackBudget).toBeGreaterThanOrEqual(plain.attackBudget);
        expect(nudged.siegeBudget).toBeGreaterThanOrEqual(plain.siegeBudget);
    });
});

describe("gate two: the weight it is ranked by", () => {
    const target = () => territory({
        territoryName: "Africa0",
        continent: "Africa",
        dataName: "Brava",
        owner: "Brava"
    });

    it("multiplies the target's worth by the tier's weight and leaves everything else alone", () => {
        const plain = campaignWeightForTarget(planFor(), target());

        resetCampaigns();
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PUSH });
        const pushed = campaignWeightForTarget(planFor(), target());

        expect(pushed / plain).toBeCloseTo(12, 5);
    });

    it("leaves a territory the plan does not name exactly as it was", () => {
        const other = territory({
            territoryName: "Europe4",
            continent: "Europe",
            dataName: "Brava",
            owner: "Brava"
        });
        setDebugPlan({ country: "Alba", kind: DebugPlanKind.TERRITORY, target: "Africa0", priority: DebugPlanPriority.ALL_OUT });
        const campaign = planFor();

        resetCampaigns();
        __resetDebugPlansForTests();
        const plain = planFor();

        expect(campaignWeightForTarget(campaign, other))
            .toBeCloseTo(campaignWeightForTarget(plain, other), 5);
    });
});

describe("gate three: the refusals in rateTarget", () => {
    const source = () => territory({ territoryName: "Europe0", armyForCurrentTerritory: 1000 });
    const target = () => territory({
        territoryName: "Africa0",
        continent: "Africa",
        dataName: "Brava",
        owner: "Brava"
    });

    /** A campaign with the floors and posture the test wants, and the plan already folded in. */
    function campaignWith(overrides = {}) {
        const campaign = planFor();
        Object.assign(campaign, overrides);
        return campaign;
    }

    it("still refuses odds under the floor at the tiers that do not say otherwise", () => {
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PUSH });
        const rating = rateTarget({
            target: target(), source: source(), probability: 2, threatScore: 0,
            campaign: campaignWith(), traits: leader().traits, country: "Alba"
        });
        expect(rating.verdict).toBe(Verdict.SKIP);
    });

    it("storms rather than besieges at ALL OUT, whatever the odds say", () => {
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.ALL_OUT });
        const rating = rateTarget({
            target: target(), source: source(), probability: 2, threatScore: 0,
            campaign: campaignWith(), traits: leader().traits, country: "Alba"
        });
        expect(rating.verdict).toBe(Verdict.ATTACK);
        expect(rating.reason).toContain("injected plan");
    });

    it("forgets previous defeats at PRESS and above, and remembers them below it", () => {
        const beaten = { failuresAgainst: () => 3 };

        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PUSH });
        const remembered = rateTarget({
            target: target(), source: source(), probability: 40, threatScore: 0,
            campaign: campaignWith(beaten), traits: leader().traits, country: "Alba"
        });
        expect(remembered.verdict).toBe(Verdict.SKIP);
        expect(remembered.reason).toContain("lost here");

        resetCampaigns();
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PRESS });
        const forgotten = rateTarget({
            target: target(), source: source(), probability: 40, threatScore: 0,
            campaign: campaignWith(beaten), traits: leader().traits, country: "Alba"
        });
        expect(forgotten.verdict).not.toBe(Verdict.SKIP);
    });

    it("attacks off the objective while defending at PRESS and above", () => {
        const defending = { posture: "DEFEND", objective: { continents: ["Europe"], banked: [] } };

        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PUSH });
        const refused = rateTarget({
            target: target(), source: source(), probability: 80, threatScore: 0,
            campaign: campaignWith(defending), traits: leader().traits, country: "Alba"
        });
        expect(refused.verdict).toBe(Verdict.SKIP);
        expect(refused.reason).toContain("defending");

        resetCampaigns();
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PRESS });
        const pressed = rateTarget({
            target: target(), source: source(), probability: 80, threatScore: 0,
            campaign: campaignWith(defending), traits: leader().traits, country: "Alba"
        });
        expect(pressed.verdict).not.toBe(Verdict.SKIP);
    });

    it("leaves the player's opening grace period standing, at every tier", () => {
        //The grace period is refused before the odds are looked at and before the plan is
        //read. A debug tool that could eliminate a human player inside ten turns would be
        //undoing the one protection the opening has.
        setDebugPlan({ country: "Alba", target: "Player", priority: DebugPlanPriority.ALL_OUT });
        const rating = rateTarget({
            target: territory({ territoryName: "Africa0", dataName: "Player", owner: "Player" }),
            source: source(), probability: 99, threatScore: 0,
            campaign: planCampaign("Alba", { turn: 2, leader: leader(), rng: HALF }),
            traits: leader().traits, country: "Alba"
        });
        expect(rating.verdict).toBe(Verdict.SKIP);
        expect(rating.reason).toContain("grace period");
    });
});

describe("gate four: the force that actually leaves", () => {
    const border = { army: 1000, localEnemyPower: 2000, leaderType: "balanced", traits: leader().traits };

    it("sends nothing extra without a plan", () => {
        expect(disposableForce(border)).toBe(disposableForce({ ...border, push: null }));
    });

    it("strips the reserve by the tier's keepScale and sends more as a result", () => {
        const plain = disposableForce(border);
        const pressed = disposableForce({
            ...border,
            push: debugPlanPush(setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PRESS }))
        });
        expect(pressed).toBeGreaterThan(plain);
    });

    it("NEVER empties a province, however hard the plan pushes", () => {
        //The one invariant no tier may break. A border held by nobody is a territory given
        //away, and a debug tool that could delete a country's own provinces would be
        //measuring itself rather than the AI.
        const allOut = debugPlanPush(setDebugPlan({
            country: "Alba", target: "Brava", priority: DebugPlanPriority.ALL_OUT
        }));
        const ceiling = Math.floor(1000 * (1 - commitmentDiscipline.minimumHomeShare));

        expect(disposableForce({ ...border, push: allOut })).toBeLessThanOrEqual(ceiling);
        //And on a border with no enemy at all, where the reserve is a flat share.
        expect(disposableForce({ ...border, localEnemyPower: 0, push: allOut }))
            .toBeLessThanOrEqual(ceiling);
    });

    it("commits the whole disposable force at ALL OUT instead of the smallest that clears", () => {
        //A ladder that would have stopped at the first rung: every amount clears the floor.
        const decision = decideCommitment({
            ...border,
            floor: 30,
            oddsFor: () => 90,
            targetName: "Africa0",
            push: debugPlanPush(setDebugPlan({
                country: "Alba", target: "Brava", priority: DebugPlanPriority.ALL_OUT
            }))
        });
        expect(decision.commit).toBe(true);
        expect(decision.amount).toBe(disposableForce({
            ...border,
            push: debugPlanPush({ country: "Alba", target: "Brava", priority: DebugPlanPriority.ALL_OUT })
        }));
    });

    it("commits at ALL OUT even when nothing on the ladder reaches the floor", () => {
        //This is the whole tier in one assertion. Without it the country weighs the target
        //first, sizes a force for it, and then says "the most this territory can spare
        //reaches only 3%" -- which is the sentence the instruction was given to override.
        const decision = decideCommitment({
            ...border,
            floor: 65,
            oddsFor: () => 3,
            targetName: "Africa0",
            push: debugPlanPush(setDebugPlan({
                country: "Alba", target: "Brava", priority: DebugPlanPriority.ALL_OUT
            }))
        });
        expect(decision.commit).toBe(true);
        expect(decision.amount).toBeGreaterThan(0);
        expect(decision.reasonCode).toBe("committed");
    });

    it("still cancels below the floor at the tiers that are not ALL OUT", () => {
        const decision = decideCommitment({
            ...border,
            floor: 65,
            oddsFor: () => 3,
            targetName: "Africa0",
            push: debugPlanPush(setDebugPlan({
                country: "Alba", target: "Brava", priority: DebugPlanPriority.PRESS
            }))
        });
        expect(decision.commit).toBe(false);
        expect(decision.reasonCode).toBe("below-floor");
    });
});

describe("how long a plan lives", () => {
    it("SURVIVES a succession, unlike every other plan a country holds", () => {
        //`clearPlansFor()` is what a succession calls. It wipes the theatre, the walls, the
        //setbacks and the posture, because those are judgements reached by somebody no
        //longer in charge. An injected plan is the operator's instruction and outlives them.
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PRESS });
        clearPlansFor("Alba");

        expect(activeDebugPlans()).toHaveLength(1);
        expect(planFor().debugPlan.target).toBe("Brava");
    });

    it("is re-read on the campaign derived after the succession", () => {
        const before = planFor();
        expect(before.debugPlan).toBeUndefined();

        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PUSH });
        //`clearPlansFor()` drops the campaign already derived this turn, which is what makes
        //a plan set mid-turn take effect on the very next country turn rather than the one
        //after it.
        clearPlansFor("Alba");
        expect(planFor().debugPlan.target).toBe("Brava");
    });

    it("goes when it is cancelled, and the campaign stops carrying it", () => {
        setDebugPlan({ country: "Alba", target: "Brava", priority: DebugPlanPriority.PRESS });
        expect(planFor().debugPlan).toBeTruthy();

        clearAllDebugPlans();
        resetCampaigns();
        expect(planFor().debugPlan).toBeUndefined();
    });
});

describe("the corridor: an objective that is not next door", () => {
    //THE HOLE THIS FILLS. `rateTarget()` is only ever called on pairings that already exist,
    //so before routing, a plan against something on another continent was consulted exactly
    //never -- the country chose its own targets and the panel reported a plan in force. These
    //tests are about the plan reaching territories BETWEEN here and there.
    //
    //`debugPlanReach()` takes the route off the campaign, so the route can be handed in
    //directly. In the game it is built by `routeToObjective()` in `applyDebugPlan()`; here it
    //is stated, because what is being tested is what the AI does with a route rather than how
    //the route is found (`ai-route.spec.js` owns that).
    function campaignWithRoute(priority, distances, ourBest) {
        setDebugPlan({ country: "Alba", kind: DebugPlanKind.TERRITORY, target: "Far", priority });
        const campaign = planFor();
        campaign.debugRoute = { distances: new Map(Object.entries(distances)), ourBest };
        return campaign;
    }

    it("lifts a territory that is strictly closer to the objective", () => {
        const campaign = campaignWithRoute(DebugPlanPriority.PUSH,
            { Far: 0, Middle: 1, Near: 2, Home: 3 }, 3);
        const near = { territoryName: "Near", dataName: "Brava" };

        const reach = debugPlanReach(campaign, near);
        expect(reach).not.toBeNull();
        expect(reach.distance).toBe(2);
        expect(reach.objective).toBe(false);
        expect(reach.weight).toBeGreaterThan(1);
    });

    it("gives the objective itself the tier's full weight and the corridor less, by distance", () => {
        const campaign = campaignWithRoute(DebugPlanPriority.PUSH,
            { Far: 0, Middle: 1, Near: 2 }, 3);

        const objective = debugPlanReach(campaign, { territoryName: "Far", dataName: "Brava" });
        const middle = debugPlanReach(campaign, { territoryName: "Middle", dataName: "Brava" });
        const near = debugPlanReach(campaign, { territoryName: "Near", dataName: "Brava" });

        expect(objective.weight).toBe(debugPlanStrength(campaign.debugPlan).targetWeight);
        //Decaying, so the country still prefers the step that shortens the journey most.
        //Without the decay every hop of a fifteen-hop route is worth what the objective is
        //worth, and the plan stops expressing a direction at all.
        expect(middle.weight).toBeLessThan(objective.weight);
        expect(near.weight).toBeLessThan(middle.weight);
        expect(near.weight).toBeGreaterThan(1);
    });

    it("refuses a sideways move -- no closer than the ground we already hold", () => {
        const campaign = campaignWithRoute(DebugPlanPriority.PRESS,
            { Far: 0, Sideways: 3 }, 3);
        expect(debugPlanReach(campaign, { territoryName: "Sideways", dataName: "Brava" })).toBeNull();
    });

    it("gives the corridor the SAME dispensations as the objective", () => {
        //The half that makes a distant plan achievable. A country that will forget a defeat
        //and ignore its posture for the objective and for nothing on the way there gets as
        //far as the next province and stops, having done everything the plan asked of it.
        const campaign = campaignWithRoute(DebugPlanPriority.PRESS,
            { Far: 0, Middle: 1 }, 2);

        const reach = debugPlanReach(campaign, { territoryName: "Middle", dataName: "Brava" });
        expect(reach.strength.ignoreSetbacks).toBe(true);
        expect(reach.strength.ignorePosture).toBe(true);
    });

    it("still matches the objective with NO route at all", () => {
        //Node has no adjacency data loaded, and a plan set this instant has not been routed.
        //A plan against an immediate neighbour has to keep working in both cases -- that is
        //what the feature did before routing existed and is still the common case.
        setDebugPlan({ country: "Alba", kind: DebugPlanKind.COUNTRY, target: "Brava" });
        const campaign = planFor();
        campaign.debugRoute = null;

        expect(debugPlanReach(campaign, { territoryName: "Africa0", dataName: "Brava" }).objective).toBe(true);
        expect(debugPlanReach(campaign, { territoryName: "Africa0", dataName: "Carda" })).toBeNull();
    });

    it("produces no corridor when the objective is unreachable", () => {
        const campaign = campaignWithRoute(DebugPlanPriority.ALL_OUT, { Far: 0 }, Infinity);
        expect(debugPlanReach(campaign, { territoryName: "Anywhere", dataName: "Brava" })).toBeNull();
        //The objective itself still matches: it is matched by name, not by the route.
        expect(debugPlanReach(campaign, { territoryName: "Far", dataName: "Brava" }).objective).toBe(true);
    });
});

describe("retiring a plan that has come true", () => {
    it("drops a TERRITORY plan once the injecting country holds the territory", () => {
        setDebugPlan({ country: "Alba", kind: DebugPlanKind.TERRITORY, target: "Africa0" });
        expect(retireRealisedDebugPlans(() => false)).toHaveLength(0);
        expect(activeDebugPlans()).toHaveLength(1);

        const retired = retireRealisedDebugPlans(plan => plan.target === "Africa0");
        expect(retired).toHaveLength(1);
        expect(activeDebugPlans()).toHaveLength(0);
    });

    it("tells its listeners, so the window empties itself", () => {
        setDebugPlan({ country: "Alba", target: "Brava" });
        let notified = 0;
        onDebugPlansChanged(() => notified++);

        retireRealisedDebugPlans(() => false);
        expect(notified).toBe(0);

        retireRealisedDebugPlans(() => true);
        expect(notified).toBe(1);
    });

    it("retires the realised plans and leaves the rest standing", () => {
        setDebugPlan({ country: "Alba", target: "Brava" });
        setDebugPlan({ country: "Carda", target: "Delta" });

        retireRealisedDebugPlans(plan => plan.country === "Alba");
        expect(activeDebugPlans().map(plan => plan.country)).toEqual(["Carda"]);
    });

    it("does nothing without a usable predicate", () => {
        setDebugPlan({ country: "Alba", target: "Brava" });
        expect(retireRealisedDebugPlans(null)).toEqual([]);
        expect(activeDebugPlans()).toHaveLength(1);
    });
});

describe("the tier table itself", () => {
    it("is ordered weakest first, which is the order the dropdown renders", () => {
        const weights = debugPlanPriorities.map(row => row.targetWeight);
        expect([...weights].sort((a, b) => a - b)).toEqual(weights);

        const floors = debugPlanPriorities.map(row => row.floorScale);
        expect([...floors].sort((a, b) => b - a)).toEqual(floors);
    });

    it("gives every tier a label and a description, because both are rendered", () => {
        for (const row of debugPlanPriorities) {
            expect(row.label.length).toBeGreaterThan(0);
            expect(row.description.length).toBeGreaterThan(20);
        }
    });

    it("reserves the three rule-breaking dials for the top tier alone", () => {
        //`ignoreHardFloor` bypasses the 8% the game applies to everybody and `commitAll`
        //abandons the sizing. If a lower tier ever picks either up, "slide into the existing
        //prioritising logic" has stopped being true of it.
        const breakers = debugPlanPriorities.filter(row => row.ignoreHardFloor || row.commitAll);
        expect(breakers).toHaveLength(1);
        expect(breakers[0].id).toBe(DebugPlanPriority.ALL_OUT);
    });

    it("describes a plan in one line naming the target and the tier", () => {
        const plan = setDebugPlan({
            country: "Alba", kind: DebugPlanKind.TERRITORY, target: "Africa0",
            priority: DebugPlanPriority.PRESS, turn: 12
        });
        const line = describeDebugPlan(plan);
        expect(line).toContain("Africa0");
        expect(line).toContain("press hard");
        expect(line).toContain("12");
        expect(describeDebugPlan(null)).toBe("");
    });
});
