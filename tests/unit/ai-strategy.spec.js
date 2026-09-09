// src/ai/strategy.js and src/ai/targeting.js -- the campaign layer.
//
// This is the layer the AI did not have, and the behaviours worth pinning down are the
// ones whose absence was visible in play:
//
//   * it opened sieges without counting the ones already running (17 rising to 67 over
//     fourteen turns -- docs/03-known-issues.md section 6);
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
    attacksPerTerritoryFor,
    campaignWeightForTarget,
    clearPlansFor,
    choosePosture,
    committedContinents,
    deriveBudgets,
    failuresAgainst,
    planCampaign,
    Posture,
    rankContinentsByAmbition,
    recordAttackOutcome,
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
import { PLAYER_GRACE_TURNS, attackDiscipline, maxForts } from "../../src/config/balance.js";

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
function world({ albaEuropeanTerritories = 4, albaDevelopment = 3, albaAfricanTerritories = 1 } = {}) {
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
            dataName: index < albaAfricanTerritories ? "Alba" : "Brava",
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
    // `required` rather than `continents.length`, in this and the two below, because the
    // objective is now committed to ONE continent at a time and grows as each is taken --
    // see "commits to one continent first" further down. What these three pin is that the
    // AI reads the victory condition for how far it must go, which is what they were
    // written for; the pace it commits at is a separate property with its own tests.
    it("takes its target continent count from the victory condition", () => {
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        expect(campaign.objective.kind).toBe(VictoryCondition.CONTINENTAL);
        expect(campaign.objective.required).toBe(3);
    });

    it("adapts to a victory condition the player changed", () => {
        //The whole point of deriving the objective from the condition rather than
        //hard-coding three continents: when the start-of-game chooser lands, the AI
        //follows the player's choice with no further change here.
        setVictoryCondition({ kind: VictoryCondition.CONTINENTAL, continentsRequired: 2 });
        expect(planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })
            .objective.required).toBe(2);
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

    // THE LONG TERM IS SET ONCE AND HELD. It used to be re-picked every
    // `CAMPAIGN_REVIEW_INTERVAL` turns, and again the moment it looked "pointless" -- which
    // for a country whose only foothold continent was complete was EVERY turn. Leigh's
    // decision: the continent conquest is the long-term plan and does not change; what
    // changes is the medium term (which neighbour to absorb) and the short term (what to do
    // in the next turn or two).
    it("never re-picks the long-term continents, however long the game runs", () => {
        const first = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })
            .objective.continents;
        //The world MOVES underneath it -- Alba is thrown out of Europe and into Africa, so a
        //fresh ranking would put them in a different order. The point of the test is that
        //nothing re-ranks: a re-pick on the review interval would have reordered these.
        __resetStateForTests();
        seedTerritories(world({ albaEuropeanTerritories: 0, albaAfricanTerritories: 5 }));
        for (const turn of [6, 20, 75, 150]) {
            expect(planCampaign("Alba", { turn, leader: leader(), rng: HALF })
                .objective.continents).toEqual(first);
        }
    });

    // COMMITTED INCREMENTALLY, because "never change it" and "choose it dynamically" are in
    // tension if the whole objective is fixed on turn 1. On turn 1 a country holds one or two
    // territories and borders almost nothing, so `reach` is uninformative and the score
    // collapses to the static `continentModifiers` -- which put ["own", "Europe", "South
    // America"] on almost every country in the world, measured. Committing the NEXT continent
    // only once the current ones are taken means each choice is made from a world the country
    // can actually see, and nothing already chosen is ever revisited.
    it("commits to one continent first rather than to the whole objective at once", () => {
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        expect(campaign.objective.required).toBe(3);
        expect(campaign.objective.continents).toHaveLength(1);
    });

    it("adds the next continent once the ones it holds are complete, and keeps the old", () => {
        __resetStateForTests();
        seedTerritories(world({ albaEuropeanTerritories: 4 }));
        const first = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })
            .objective.continents;
        expect(first).toEqual(["Europe"]);

        //Alba finishes Europe. Only now is a second continent chosen.
        __resetStateForTests();
        seedTerritories(world({ albaEuropeanTerritories: 5 }));
        const grown = planCampaign("Alba", { turn: 8, leader: leader(), rng: HALF })
            .objective.continents;
        expect(grown).toHaveLength(2);
        expect(grown[0]).toBe("Europe");
    });

    it("does not grow while the continent it is on is unfinished", () => {
        __resetStateForTests();
        seedTerritories(world({ albaEuropeanTerritories: 4 }));
        planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        for (const turn of [5, 20, 90]) {
            expect(planCampaign("Alba", { turn, leader: leader(), rng: HALF })
                .objective.continents).toEqual(["Europe"]);
        }
    });

    it("never revisits a continent it has already committed to", () => {
        //The case that used to re-pick every single turn: Alba owns the whole of Europe and
        //has no foothold on anything else, so every committed row was `complete || held === 0`.
        //It may GROW here -- Europe is finished, so a second continent is chosen -- but
        //whatever was already on the list stays on it, in order.
        __resetStateForTests();
        seedTerritories(world({ albaEuropeanTerritories: 5 }));
        const first = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })
            .objective.continents;
        const later = planCampaign("Alba", { turn: 40, leader: leader(), rng: HALF })
            .objective.continents;
        expect(later.slice(0, first.length)).toEqual(first);
    });

    // A country cannot campaign for a continent it cannot get to, and before this the
    // ranking had no idea where the country WAS -- `foothold` counts only territories
    // already held, so a continent across a shared border scored exactly the same as one on
    // the far side of the world. That is what made the choice effectively fixed: with no
    // foothold anywhere the score collapsed to the static `continentModifiers` table, so
    // every power in the same position committed to the same continent.
    it("ranks a continent it borders above an equally foreign one it does not", () => {
        const rows = continentStandingsFor("Alba");
        const bordersAsia = rankContinentsByAmbition(rows, HALF, {
            reach: new Map([["Asia", 8]])
        });
        const asia = bordersAsia.findIndex(row => row.continent === "Asia");
        const africa = bordersAsia.findIndex(row => row.continent === "Africa");
        //Africa outranks Asia on a foothold alone; a wide border into Asia overturns it.
        expect(asia).toBeLessThan(africa);
    });

    it("ignores reachability it was given nothing about, so Node callers are unaffected", () => {
        const withNothing = rankContinentsByAmbition(continentStandingsFor("Alba"), HALF);
        const withEmpty = rankContinentsByAmbition(continentStandingsFor("Alba"), HALF, {
            reach: new Map()
        });
        expect(withEmpty.map(row => row.continent)).toEqual(withNothing.map(row => row.continent));
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

    describe("the player's opening grace period", () => {
        //206 countries plan their first turn with full information, so a player who chose a
        //one-territory country is reachable by several at once on turn 1 and could be
        //eliminated inside ten turns without ever taking a decision that mattered.
        const player = () => territory({
            dataName: "Player", owner: "Player", continent: "Europe"
        });

        it("refuses the player on turn 1 whatever the odds say", () => {
            const rating = rate({ target: player(), probability: 99 });
            expect(rating.verdict).toBe(Verdict.SKIP);
        });

        it("says why, so the debug window and the plan log can report it", () => {
            expect(rate({ target: player(), probability: 99 }).reason)
                .toContain("grace period");
        });

        it("refuses on the last turn of the grace period and allows the next one", () => {
            const onLastGraceTurn = rateTarget({
                target: player(),
                source: territory({ territoryName: "Home", armyForCurrentTerritory: 10000 }),
                probability: 90,
                threatScore: -100,
                campaign: planCampaign("Alba", {
                    turn: PLAYER_GRACE_TURNS, leader: leader(), rng: HALF
                }),
                traits: leader().traits,
                country: "Alba"
            });
            expect(onLastGraceTurn.verdict).toBe(Verdict.SKIP);

            const afterwards = rateTarget({
                target: player(),
                source: territory({ territoryName: "Home", armyForCurrentTerritory: 10000 }),
                probability: 90,
                threatScore: -100,
                campaign: planCampaign("Alba", {
                    turn: PLAYER_GRACE_TURNS + 1, leader: leader(), rng: HALF
                }),
                traits: leader().traits,
                country: "Alba"
            });
            expect(afterwards.verdict).not.toBe(Verdict.SKIP);
        });

        it("protects nobody else, on any turn", () => {
            //One-directional and narrow. An AI country is fair game on turn 1 exactly as it
            //always was, and nothing in the battle model knows the grace period exists.
            const rating = rate({
                target: territory({ dataName: "Brava", owner: "Brava", continent: "Europe" }),
                probability: 90
            });
            expect(rating.verdict).not.toBe(Verdict.SKIP);
        });
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

// ---------------------------------------------------------------------------
// The doctrine, where the consumers read it (Q2.2).
//
// The point of `src/ai/doctrine.js` is that these three functions stop switching on the
// victory condition. What is worth pinning is not the dial values -- `ai-doctrine.spec.js`
// owns those -- but that each dial actually reaches the decision it is supposed to reach,
// because a dial that is derived and then ignored has no signature at all: nothing throws,
// every turn completes, and the goal simply does not happen.
// ---------------------------------------------------------------------------

describe("the goal reaching the campaign", () => {
    it("commits a World Conquest AI to every continent on the map", () => {
        setVictoryCondition({ kind: VictoryCondition.CONQUEST });
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        //Three continents in the fixture, and CONQUEST asks for `Infinity` of them --
        //`chooseObjective()` is what clamps that to how many there actually are.
        expect(campaign.objective.required).toBe(3);
        expect(campaign.doctrine.neverSatisfied).toBe(true);
    });

    it("spreads a Domination AI over four fronts where the map has them", () => {
        setVictoryCondition({ kind: VictoryCondition.DOMINATION });
        //The fixture has three continents, so four is clamped to three; what matters is
        //that DOMINATION asks for more than the two the old `else` branch gave it.
        expect(planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF })
            .doctrine.continentsToCommit).toBe(4);
    });

    it("carries the doctrine on the campaign, where targeting can read it", () => {
        setVictoryCondition({
            kind: VictoryCondition.GREAT_POWERS,
            greatPowers: ["Brava", "Carda"],
            greatPowersRequired: 2
        });
        const campaign = planCampaign("Alba", { turn: 1, leader: leader(), rng: HALF });
        expect(campaign.doctrine.targetCountries).toContain("Brava");
    });
});

describe("urgency", () => {
    const health = (overrides = {}) => ({
        territories: 20, army: 5000, gold: 5000, besieged: 0, besiegedShare: 0,
        development: 0.5, activeSieges: 0, ...overrides
    });

    it("buys more attacks when a rival is running away with the game", () => {
        const calm = deriveBudgets({
            country: "Alba", health: health(), posture: Posture.EXPAND,
            traits: leader().traits, leaderType: "balanced", urgency: 0
        });
        const alarmed = deriveBudgets({
            country: "Alba", health: health(), posture: Posture.EXPAND,
            traits: leader().traits, leaderType: "balanced", urgency: 1
        });
        expect(alarmed.attackBudget).toBeGreaterThan(calm.attackBudget);
    });

    it("NEVER buys more sieges, however alarmed", () => {
        //The seventeen-to-sixty-seven concurrent sieges problem was closed by the siege
        //budget subtracting the sieges already running. A multiplier over that cap walks
        //straight back into it, so urgency is not allowed anywhere near it.
        const shared = health();
        const calm = deriveBudgets({
            country: "Alba", health: shared, posture: Posture.EXPAND,
            traits: leader().traits, leaderType: "balanced", urgency: 0
        });
        const alarmed = deriveBudgets({
            country: "Alba", health: shared, posture: Posture.EXPAND,
            traits: leader().traits, leaderType: "balanced", urgency: 1
        });
        expect(alarmed.siegeBudget).toBe(calm.siegeBudget);
        expect(alarmed.concurrentSiegeCap).toBe(calm.concurrentSiegeCap);
    });

    it("still leaves a defending country able to be reduced to no attacks", () => {
        expect(deriveBudgets({
            country: "Alba", health: health({ territories: 1 }), posture: Posture.DEFEND,
            traits: leader().traits, leaderType: "pacifist", urgency: 1
        }).attackBudget).toBeGreaterThanOrEqual(0);
    });
});

describe("a goal with no resting point", () => {
    const health = () => ({
        territories: 10, army: 5000, gold: 5000, besieged: 0, besiegedShare: 0,
        development: 0.5, activeSieges: 0
    });
    const banked = { kind: "CONQUEST", required: 3, continents: ["Europe"], banked: ["Europe"] };

    it("consolidates once everything committed to is taken, under an ordinary goal", () => {
        expect(choosePosture({
            health: health(), focus: null, leaderType: "balanced",
            traits: leader().traits, objective: banked, neverSatisfied: false
        })).toBe(Posture.CONSOLIDATE);
    });

    it("keeps expanding under World Conquest, where there is no such thing as arriving", () => {
        expect(choosePosture({
            health: health(), focus: null, leaderType: "balanced",
            traits: leader().traits, objective: banked, neverSatisfied: true
        })).toBe(Posture.EXPAND);
    });
});

describe("what the goal makes worth taking", () => {
    const campaign = (doctrine) => ({
        country: "Alba",
        turn: 1,
        objective: { kind: doctrine.kind, required: 3, continents: ["Europe"], banked: [] },
        focusContinent: "Europe",
        standings: [],
        posture: Posture.EXPAND,
        attackOddsFloor: 30,
        siegeOddsFloor: 20,
        siegeBudget: 1,
        attackBudget: 1,
        failuresAgainst: () => 0,
        doctrine
    });
    const dials = (overrides = {}) => ({
        kind: "DOMINATION", continentsToCommit: 4, areaHunger: 0,
        targetCountries: [], urgency: 0, neverSatisfied: false, ...overrides
    });
    const rate = (doctrine, target) => rateTarget({
        target,
        source: territory({ armyForCurrentTerritory: 5000 }),
        probability: 80,
        threatScore: 0,
        campaign: campaign(doctrine),
        traits: leader().traits,
        country: "Alba"
    });

    it("prefers the larger territory when the goal is scored in land area", () => {
        const small = territory({ territoryName: "Islet", area: 100 });
        const large = territory({ territoryName: "Steppe", area: 350000 });
        const hungry = dials({ areaHunger: 1 });
        const indifferent = dials({ areaHunger: 0 });

        //With hunger, the big one is worth materially more; without it, the two differ
        //only by `territoryValue()`'s own modest area term.
        const hungryGap = rate(hungry, large).value / rate(hungry, small).value;
        const indifferentGap = rate(indifferent, large).value / rate(indifferent, small).value;
        expect(hungryGap).toBeGreaterThan(indifferentGap);
    });

    it("weights a target power's homeland however holds it now", () => {
        //The whole point of measuring GREAT_POWERS from `originalOwner`: Brava's homeland
        //taken by Carda first is still the ground the goal is about, so taking it from
        //Carda is the route to the same objective rather than a distraction from it.
        const doctrine = dials({ kind: "GREAT_POWERS", targetCountries: ["Brava"] });
        const homeland = territory({ territoryName: "Bravaland", dataName: "Carda", originalOwner: "Brava" });
        const elsewhere = territory({ territoryName: "Nowhere", dataName: "Carda", originalOwner: "Carda" });
        expect(rate(doctrine, homeland).value).toBeGreaterThan(rate(doctrine, elsewhere).value);
    });

    it("leaves an ordinary goal blind to whose homeland a territory was", () => {
        const doctrine = dials({ kind: "CONTINENTAL", areaHunger: 0, targetCountries: [] });
        const homeland = territory({ territoryName: "Bravaland", dataName: "Carda", originalOwner: "Brava" });
        const elsewhere = territory({ territoryName: "Nowhere", dataName: "Carda", originalOwner: "Carda" });
        expect(rate(doctrine, homeland).value).toBeCloseTo(rate(doctrine, elsewhere).value, 10);
    });
});

describe("how many attacks one territory may press", () => {
    // THE PLAYER HAS ALWAYS BEEN ABLE TO ATTACK REPEATEDLY IN A TURN AND THE AI HAD NOT --
    // `doAiActions()` carried a bare "only one attack from any territory per turn". So a
    // province bordering three weak enemies took one a turn whatever it had left standing,
    // and a breakthrough could not be exploited in the turn it was made.
    //
    // This is a CAP, not a ration. The force is never divided in advance: each attack is
    // sized against what is left after the previous one. Splitting it up front would be
    // strictly worse, because the battle is a step function -- two attacks at 0.175:1 are
    // 0% and 0% where one at 1.5:1 is 77%.

    it("gives a bold expansionist more attacks than a cautious homebody", () => {
        const bold = attacksPerTerritoryFor("aggressive",
            { risk_taking: 1, territory_expansion: 1 });
        const cautious = attacksPerTerritoryFor("pacifist",
            { risk_taking: 0, territory_expansion: 0 });
        expect(bold).toBeGreaterThan(cautious);
    });

    it("never returns fewer than one, so no leader is barred from attacking at all", () => {
        //The same argument the attack BUDGET already makes: a budget of nought is not
        //discipline, it is a country told to sit still whatever it can see in front of it.
        for (const risk of [0, 0.25, 0.5, 0.75, 1]) {
            for (const type of ["aggressive", "balanced", "pacifist"]) {
                expect(attacksPerTerritoryFor(type, { risk_taking: risk }))
                    .toBeGreaterThanOrEqual(1);
            }
        }
    });

    it("never exceeds the cap, because a territory is not an army group", () => {
        expect(attacksPerTerritoryFor("aggressive",
            { risk_taking: 1, territory_expansion: 1, style_of_war: 1 }))
            .toBeLessThanOrEqual(attackDiscipline.maxAttacksPerTerritory);
    });

    it("survives a leader with no traits at all", () => {
        //Leaders are generated data and a save predating `risk_taking` carries none.
        expect(attacksPerTerritoryFor("balanced", {})).toBeGreaterThanOrEqual(1);
        expect(attacksPerTerritoryFor(undefined, undefined)).toBeGreaterThanOrEqual(1);
    });
});

describe("wiping one country's plans when its leader dies", () => {
    // THIS BLOCK EXISTS BECAUSE THE UNIT SUITE MISSED THE BUG. `clearPlansFor()` shipped with
    // `clearTheatreMemoryFor` never imported into this module, so every call threw a
    // ReferenceError -- and 1,080 unit tests passed, because not one of them called it. The
    // headless sim found it on turn 20, as the AI stage throwing and the turn loop stalling.
    //
    // The lesson is the one the combat phase kept relearning: a function no test calls is a
    // function whose failure mode is indistinguishable from its success.

    it("can be called at all -- the regression that got past the suite", () => {
        expect(() => clearPlansFor("France")).not.toThrow();
    });

    // A SUCCESSION KEEPS THE LONG TERM AND CLEARS THE REST. Leigh's decision, and the
    // reversal of what this used to do: the continent conquest is the country's plan rather
    // than the leader's, so an heir inherits the war and re-decides only HOW to fight it --
    // which neighbour to absorb, which borders were not worth another try, what posture to
    // take. Wiping the objective too made a succession a country forgetting what it was for.
    it("keeps this country's committed continents -- the long-term plan survives the leader", () => {
        resetCampaigns();
        __resetStateForTests();
        seedTerritories(world());
        const before = planCampaign("Alba", { turn: 5, leader: leader(), rng: HALF })
            .objective.continents;
        expect(before.length).toBeGreaterThan(0);

        clearPlansFor("Alba");

        expect(committedContinents("Alba")).toEqual(before);
        //And the campaign derived under the dead leader is gone, so the heir plans afresh.
        expect(planCampaign("Alba", { turn: 5, leader: leader(), rng: HALF })
            .objective.continents).toEqual(before);
    });

    it("forgets this country's medium and short term, and leaves everyone else alone", () => {
        resetCampaigns();
        planCampaign("France", { turn: 5 });
        planCampaign("Germany", { turn: 5 });

        //A border France decided was not worth another try -- the short-term memory.
        recordAttackOutcome("France", "Somewhere", false, 5, "Brava");
        expect(failuresAgainst("France", "Somewhere", 5)).toBe(1);

        clearPlansFor("France");

        expect(failuresAgainst("France", "Somewhere", 5)).toBe(0);
        //Germany is untouched: a succession in France is not a world event.
        expect(() => committedContinents("Germany")).not.toThrow();
    });

    it("ignores a missing country rather than wiping something", () => {
        expect(() => clearPlansFor(undefined)).not.toThrow();
        expect(() => clearPlansFor("")).not.toThrow();
        expect(() => clearPlansFor(null)).not.toThrow();
    });
});
