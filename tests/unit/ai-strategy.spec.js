// src/ai/strategy.js and src/ai/targeting.js -- the campaign layer.
//
// This is the layer the AI did not have, and the behaviours worth pinning down are the
// ones whose absence was visible in play:
//
//   * it opened sieges without counting the ones already running (17 rising to 67 over
//     fourteen turns -- docs/04-known-issues.md section 6);
//   * it fought as hard for anything reachable as for the territory that would complete a
//     continent, because it had no notion of a continent;
//   * it decided attack-or-besiege with two coin flips against personality traits, so it
//     could produce both against the same target and let a later pass throw one away;
//   * it re-derived everything every turn, so it could not be said to have a plan at all.
//
// Everything here runs in Node. The rng is injected, as it is everywhere in `src/ai/`, so
// the tests can make the small tie-breaking term a constant and be rid of it.

import { beforeEach, describe, expect, it } from "vitest";

import { __resetStateForTests, seedTerritories } from "../../src/state/GameState.js";
import { addSiege } from "../../src/state/mutations.js";
import {
    assessCountry,
    campaignWeightForTarget,
    choosePosture,
    committedContinents,
    deriveBudgets,
    planCampaign,
    Posture,
    rankContinentsByAmbition,
    resetCampaigns,
    siegesRunBy
} from "../../src/ai/strategy.js";
import {
    rateTarget,
    territoryValue,
    Verdict,
    withinBudget
} from "../../src/ai/targeting.js";
import {
    continentStandingsFor,
    resetVictoryCondition,
    setVictoryCondition,
    VictoryCondition
} from "../../src/ai/victory.js";
import { maxForts } from "../../src/config/balance.js";

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

/**
 * A world Alba can plausibly campaign in: it nearly owns Europe, has a foothold in Africa
 * and none at all in Asia.
 */
function world({ albaEuropeanTerritories = 4, albaDevelopment = 3 } = {}) {
    const rows = [];
    for (let index = 0; index < 5; index++) {
        rows.push(territory({
            uniqueId: "eu" + index,
            territoryName: "Europe" + index,
            continent: "Europe",
            dataName: index < albaEuropeanTerritories ? "Alba" : "Brava",
            farmsBuilt: albaDevelopment,
            forestsBuilt: albaDevelopment,
            oilWellsBuilt: albaDevelopment,
            fortsBuilt: albaDevelopment
        }));
    }
    for (let index = 0; index < 6; index++) {
        rows.push(territory({
            uniqueId: "af" + index,
            territoryName: "Africa" + index,
            continent: "Africa",
            continentModifier: 0.5,
            dataName: index < 1 ? "Alba" : "Brava",
            farmsBuilt: albaDevelopment,
            forestsBuilt: albaDevelopment,
            oilWellsBuilt: albaDevelopment,
            fortsBuilt: albaDevelopment
        }));
    }
    for (let index = 0; index < 8; index++) {
        rows.push(territory({
            uniqueId: "as" + index,
            territoryName: "Asia" + index,
            continent: "Asia",
            continentModifier: 0.7,
            dataName: "Carda"
        }));
    }
    return rows;
}

function leader(overrides = {}) {
    return {
        leaderType: "balanced",
        name: "Test Leader",
        traits: {
            fortification: 0.5,
            territory_expansion: 0.5,
            style_of_war: 0.5,
            reconquista: 0.5,
            ...overrides.traits
        },
        ...overrides
    };
}

beforeEach(() => {
    __resetStateForTests();
    resetCampaigns();
    resetVictoryCondition();
    seedTerritories(world());
});

describe("committing to an objective", () => {
    it("commits to as many continents as the victory condition asks for", () => {
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        expect(campaign.objective.kind).toBe(VictoryCondition.CONTINENTAL);
        expect(campaign.objective.continents).toHaveLength(3);
    });

    it("adapts to a victory condition the player changed", () => {
        //The whole point of deriving the objective from the condition rather than
        //hard-coding three continents: when the start-of-game chooser lands, the AI
        //follows the player's choice with no further change here.
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 2 });
        expect(planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })
            .objective.continents).toHaveLength(2);
    });

    it("prefers the continent it is closest to owning", () => {
        expect(planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })
            .objective.continents[0]).toBe("Europe");
    });

    it("keeps the commitment across turns rather than re-choosing every turn", () => {
        const first = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF }).objective.continents;
        //Turn 2, and Alba has meanwhile been thrown out of Europe entirely -- but not off
        //every committed continent, so the plan stands. A country that re-picked here
        //would abandon a war the moment it started going badly, which is the turn-local
        //behaviour the campaign replaces.
        __resetStateForTests();
        seedTerritories(world({ albaEuropeanTerritories: 0 }));
        const second = planCampaign("Alba", { turn: 2, leader: leader(), rng: HALF }).objective.continents;
        expect(second).toEqual(first);
        expect(committedContinents("Alba")).toEqual(first);
    });

    it("reviews the commitment once the interval has passed", () => {
        planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        const reviewed = planCampaign("Alba", { turn: 20, leader: leader(), rng: HALF });
        expect(reviewed.objective.continents).toHaveLength(3);
    });

    it("banks a continent it already holds outright and pushes the next one", () => {
        __resetStateForTests();
        seedTerritories(world({ albaEuropeanTerritories: 5 }));
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        expect(campaign.objective.banked).toContain("Europe");
        expect(campaign.focusContinent).not.toBe("Europe");
    });

    it("ranks a continent it has a foothold on above one it does not", () => {
        const ranked = rankContinentsByAmbition(continentStandingsFor("Alba"), HALF);
        const africa = ranked.findIndex(row => row.continent === "Africa");
        const asia = ranked.findIndex(row => row.continent === "Asia");
        expect(africa).toBeLessThan(asia);
    });
});

describe("choosing a posture", () => {
    const health = (overrides = {}) => ({
        territories: 10, army: 5000, gold: 5000, besieged: 0, besiegedShare: 0,
        development: 0.5, activeSieges: 0, ...overrides
    });
    const focus = (overrides = {}) => ({ continent: "Europe", share: 0.5, missing: 3, total: 6, held: 3, ...overrides });
    const objective = { kind: "CONTINENTAL", required: 3, continents: ["Europe"], banked: [] };

    it("defends when a fifth of the country is besieged", () => {
        expect(choosePosture({
            health: health({ besieged: 3, besiegedShare: 0.3 }),
            focus: focus(), leaderType: "balanced", traits: leader().traits, objective
        })).toBe(Posture.DEFEND);
    });

    it("develops when there is barely an economy to fight a war with", () => {
        expect(choosePosture({
            health: health({ development: 0.05 }),
            focus: focus(), leaderType: "balanced", traits: leader().traits, objective
        })).toBe(Posture.DEVELOP);
    });

    it("lets an aggressive expansionist push on regardless when the prize is close", () => {
        expect(choosePosture({
            health: health({ development: 0.05 }),
            focus: focus({ missing: 2 }),
            leaderType: "aggressive",
            traits: { ...leader().traits, territory_expansion: 0.95 },
            objective
        })).toBe(Posture.EXPAND);
    });

    it("consolidates rather than opening a second front when the focus is nearly done", () => {
        expect(choosePosture({
            health: health(),
            focus: focus({ share: 0.9, missing: 1 }),
            leaderType: "balanced", traits: leader().traits, objective
        })).toBe(Posture.CONSOLIDATE);
    });

    it("expands in the ordinary case", () => {
        expect(choosePosture({
            health: health(), focus: focus(),
            leaderType: "balanced", traits: leader().traits, objective
        })).toBe(Posture.EXPAND);
    });

    it("puts most of a bolstering territory's gold into walls when defending", () => {
        const defending = planCampaignWith({ besiegedShare: 0.4 });
        const expanding = planCampaignWith({ besiegedShare: 0 });
        expect(defending.fortShare).toBeGreaterThan(expanding.fortShare);
    });
});

/** A campaign for a country whose world has been rigged to force a posture. */
function planCampaignWith({ besiegedShare }) {
    __resetStateForTests();
    resetCampaigns();
    seedTerritories(world());
    if (besiegedShare > 0) {
        //Three of Alba's five territories besieged is well past the DEFEND threshold.
        for (const name of ["Europe0", "Europe1", "Europe2"]) {
            addSiege("ai", name, { attackingCountry: "Brava", defendingTerritoryId: name });
        }
    }
    return planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
}

describe("siege discipline", () => {
    it("counts the sieges a country is already running", () => {
        addSiege("ai", "Africa1", { attackingCountry: "Alba", defendingTerritoryId: "af1" });
        addSiege("ai", "Africa2", { attackingCountry: "Alba", defendingTerritoryId: "af2" });
        addSiege("ai", "Africa3", { attackingCountry: "Brava", defendingTerritoryId: "af3" });
        expect(siegesRunBy("Alba")).toBe(2);
        expect(assessCountry("Alba").activeSieges).toBe(2);
    });

    it("subtracts the running sieges from the budget for new ones", () => {
        const health = {
            territories: 60, army: 1e6, gold: 1e6, besieged: 0, besiegedShare: 0,
            development: 0.5, activeSieges: 0
        };
        const fresh = deriveBudgets({ country: "Alba", health, posture: Posture.EXPAND, traits: leader().traits, leaderType: "balanced" });
        const committed = deriveBudgets({
            country: "Alba",
            health: { ...health, activeSieges: fresh.concurrentSiegeCap },
            posture: Posture.EXPAND, traits: leader().traits, leaderType: "balanced"
        });
        expect(fresh.siegeBudget).toBeGreaterThan(0);
        //This is the fix for the forty-sieges problem, stated as an assertion: a country
        //at its concurrent cap may open none at all.
        expect(committed.siegeBudget).toBe(0);
    });

    it("never lets a budget go negative however over-committed the country is", () => {
        const budgets = deriveBudgets({
            country: "Alba",
            health: { territories: 2, army: 10, gold: 10, besieged: 0, besiegedShare: 0, development: 0.5, activeSieges: 40 },
            posture: Posture.DEFEND, traits: leader().traits, leaderType: "pacifist"
        });
        expect(budgets.siegeBudget).toBe(0);
        expect(budgets.attackBudget).toBeGreaterThanOrEqual(0);
    });

    it("gives a big empire more of a budget than a small one", () => {
        const small = deriveBudgets({
            country: "Alba",
            health: { territories: 3, army: 1, gold: 1, besieged: 0, besiegedShare: 0, development: 0.5, activeSieges: 0 },
            posture: Posture.EXPAND, traits: leader().traits, leaderType: "balanced"
        });
        const large = deriveBudgets({
            country: "Alba",
            health: { territories: 90, army: 1, gold: 1, besieged: 0, besiegedShare: 0, development: 0.5, activeSieges: 0 },
            posture: Posture.EXPAND, traits: leader().traits, leaderType: "balanced"
        });
        expect(large.attackBudget).toBeGreaterThan(small.attackBudget);
    });

    it("demands better odds of a pacifist than of an aggressive leader", () => {
        const shared = { territories: 10, army: 1, gold: 1, besieged: 0, besiegedShare: 0, development: 0.5, activeSieges: 0 };
        const aggressive = deriveBudgets({ country: "A", health: shared, posture: Posture.EXPAND, traits: leader().traits, leaderType: "aggressive" });
        const pacifist = deriveBudgets({ country: "A", health: shared, posture: Posture.EXPAND, traits: leader().traits, leaderType: "pacifist" });
        expect(pacifist.attackOddsFloor).toBeGreaterThan(aggressive.attackOddsFloor);
    });

    it("lowers the odds floor for a leader who presses on unclear odds", () => {
        const shared = { territories: 10, army: 1, gold: 1, besieged: 0, besiegedShare: 0, development: 0.5, activeSieges: 0 };
        const cautious = deriveBudgets({ country: "A", health: shared, posture: Posture.EXPAND, traits: { ...leader().traits, style_of_war: 0.1 }, leaderType: "balanced" });
        const bold = deriveBudgets({ country: "A", health: shared, posture: Posture.EXPAND, traits: { ...leader().traits, style_of_war: 0.9 }, leaderType: "balanced" });
        expect(bold.attackOddsFloor).toBeLessThan(cautious.attackOddsFloor);
    });
});

describe("what a target is worth", () => {
    it("values a developed European territory above a bare African one", () => {
        const europe = territory({ continentModifier: 1, devIndex: 0.9, farmsBuilt: 3, forestsBuilt: 3, oilWellsBuilt: 3 });
        const africa = territory({ continent: "Africa", continentModifier: 0.5, devIndex: 0.3 });
        expect(territoryValue(europe)).toBeGreaterThan(territoryValue(africa));
    });

    it("weighs the continent it is finishing far above one it is not campaigning on", () => {
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        const onFocus = campaignWeightForTarget(campaign, territory({ continent: campaign.focusContinent }));
        const offObjective = campaignWeightForTarget(campaign, territory({ continent: "Nowhere" }));
        expect(onFocus).toBeGreaterThan(offObjective * 3);
    });

    it("weighs the last territory of a continent above the tenth-from-last", () => {
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        //Europe is one territory short in the fixture, Africa five.
        const nearlyDone = campaignWeightForTarget(campaign, territory({ continent: "Europe" }));
        const barelyStarted = campaignWeightForTarget(campaign, territory({ continent: "Africa" }));
        expect(nearlyDone).toBeGreaterThan(barelyStarted);
    });
});

describe("rating a target", () => {
    const campaign = () => planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });

    function rate(overrides = {}) {
        return rateTarget({
            target: territory({ dataName: "Brava", continent: "Europe" }),
            source: territory({ territoryName: "Home", armyForCurrentTerritory: 10000 }),
            probability: 60,
            threatScore: -100,
            campaign: campaign(),
            traits: leader().traits,
            country: "Alba",
            ...overrides
        });
    }

    it("returns exactly one verdict, never an attack and a siege at once", () => {
        const rating = rate();
        expect([Verdict.ATTACK, Verdict.SIEGE, Verdict.SKIP]).toContain(rating.verdict);
    });

    it("attacks on comfortable odds", () => {
        expect(rate({ probability: 80 }).verdict).toBe(Verdict.ATTACK);
    });

    it("skips a target whose odds are hopeless instead of throwing an army at it", () => {
        //The old planner demanded only `probability >= 1`, which is exactly how an AI
        //came to attack on a one-percent chance.
        const rating = rate({ probability: 2 });
        expect(rating.verdict).toBe(Verdict.SKIP);
        expect(rating.reason).toMatch(/below the siege floor/);
    });

    it("besieges rather than storms a heavily fortified target", () => {
        const rating = rate({
            probability: 60,
            target: territory({ dataName: "Brava", fortsBuilt: maxForts, continent: "Europe" }),
            traits: { ...leader().traits, style_of_war: 0.2 }
        });
        expect(rating.verdict).toBe(Verdict.SIEGE);
        expect(rating.reason).toMatch(/forts/);
    });

    it("besieges when the odds are too thin to storm", () => {
        expect(rate({ probability: 26 }).verdict).toBe(Verdict.SIEGE);
    });

    it("will not open a siege it has no budget for", () => {
        const spent = campaign();
        spent.siegeBudget = 0;
        const rating = rate({ probability: 26, campaign: spent });
        expect(rating.verdict).toBe(Verdict.SKIP);
        expect(rating.reason).toMatch(/no siege budget/);
    });

    it("leaves a besieged target alone rather than planning an attack that is always cancelled", () => {
        //Every interaction with a besieged territory is refused by
        //`calculateArmyQuantityBeingSentOrIfCancellingInteraction()`, and an ATTACK goal
        //against one still burned that source territory's single attack for the turn on
        //the way to being thrown away. What happens to a siege in progress is
        //`siegeReview.js`'s decision, taken before goals are planned.
        const rating = rate({ probability: 80, targetAlreadyBesieged: true });
        expect(rating.verdict).toBe(Verdict.SKIP);
        expect(rating.reason).toMatch(/already besieged/);
    });

    it("leaves an off-objective target alone while consolidating", () => {
        const consolidating = campaign();
        consolidating.posture = Posture.CONSOLIDATE;
        const rating = rateTarget({
            target: territory({ dataName: "Carda", continent: "Nowhere" }),
            source: territory({ armyForCurrentTerritory: 10000 }),
            probability: 80,
            threatScore: -100,
            campaign: consolidating,
            traits: leader().traits,
            country: "Alba"
        });
        expect(rating.verdict).toBe(Verdict.SKIP);
        expect(rating.reason).toMatch(/off the objective/);
    });

    it("still takes an off-objective target that is a real threat", () => {
        const consolidating = campaign();
        consolidating.posture = Posture.CONSOLIDATE;
        const rating = rateTarget({
            target: territory({ dataName: "Carda", continent: "Nowhere" }),
            source: territory({ armyForCurrentTerritory: 10000 }),
            probability: 80,
            threatScore: 5000,   //this neighbour outguns us
            campaign: consolidating,
            traits: leader().traits,
            country: "Alba"
        });
        expect(rating.verdict).toBe(Verdict.ATTACK);
    });

    it("rates a territory it once owned above an identical one it never held", () => {
        const mine = rate({ target: territory({ dataName: "Brava", originalOwner: "Alba" }) });
        const theirs = rate({ target: territory({ dataName: "Brava", originalOwner: "Brava" }) });
        expect(mine.score).toBeGreaterThan(theirs.score);
    });

    it("scores a valuable target above a worthless one at the same odds", () => {
        const rich = rate({ target: territory({ dataName: "Brava", devIndex: 0.95, area: 400000 }) });
        const poor = rate({ target: territory({ dataName: "Brava", devIndex: 0.1, area: 10 }) });
        expect(rich.score).toBeGreaterThan(poor.score);
    });
});

describe("cutting a plan to its budget", () => {
    it("keeps the best of what was possible, not the first few", () => {
        const ratings = [
            { verdict: Verdict.ATTACK, score: 1 },
            { verdict: Verdict.ATTACK, score: 9 },
            { verdict: Verdict.SIEGE, score: 5 },
            { verdict: Verdict.SKIP, score: 0 }
        ];
        const kept = withinBudget(ratings, { attackBudget: 1, siegeBudget: 1 });
        expect(kept).toHaveLength(2);
        expect(kept[0].score).toBe(9);
    });

    it("drops everything when nothing is affordable", () => {
        expect(withinBudget(
            [{ verdict: Verdict.ATTACK, score: 9 }, { verdict: Verdict.SIEGE, score: 5 }],
            { attackBudget: 0, siegeBudget: 0 }
        )).toHaveLength(0);
    });
});

describe("draws", () => {
    it("takes its randomness from the injected stream, never from Math.random", () => {
        const original = Math.random;
        Math.random = () => {
            throw new Error("the campaign planner must not touch the global stream");
        };
        try {
            expect(() => planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })).not.toThrow();
        } finally {
            Math.random = original;
        }
    });
});
