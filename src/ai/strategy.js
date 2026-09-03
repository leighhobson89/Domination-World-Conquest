// The campaign: what an AI country is trying to achieve over the next several turns.
//
// This is the layer the AI did not have. `threat.js` measures, `goals.js` decides what to
// do this turn and `aiCalculations.js` carries it out -- all of it turn-local. The
// Dominapedia's "How the AI Thinks" page said so plainly under "What it cannot do":
//
//     Plan. The AI is entirely turn-local: it has no memory of what it was trying to
//     achieve last turn and no notion of what it will need next turn. It does not know
//     it already has forty sieges running.
//
// A CAMPAIGN is the missing middle. It is derived once per country per turn and it says
// four things:
//
//   OBJECTIVE   the long term, and it comes from the active victory condition rather than
//               from anything this file invents. Under the default CONTINENTAL condition
//               that is three named continents this country has committed to taking.
//   FOCUS       which of those it is pushing THIS turn -- the one it is closest to
//               finishing and has not finished.
//   POSTURE     DEVELOP, EXPAND, CONSOLIDATE or DEFEND. What kind of turn this is, which
//               is what decides whether gold goes on farms, forts or units.
//   BUDGETS     how many sieges may be running and how many attacks may be pressed. This
//               is the direct answer to "it does not know it already has forty sieges
//               running": it counts them, and it stops.
//
// COMMITMENTS ARE STICKY, and that is the whole point of the module holding state. A
// country that re-picked its three continents every turn would chase whichever front
// happened to look best that turn and would finish none of them -- which is precisely the
// turn-local behaviour being replaced. A commitment is reviewed every
// `CAMPAIGN_REVIEW_INTERVAL` turns, and abandoned early only when it has become pointless:
// the continent is held outright already, or the country has been thrown off it entirely.
//
// Pure with respect to the rest of the app: it imports `config/`, `state/selectors.js` and
// its two siblings here, so it runs in Node and is unit-tested there. Randomness is
// INJECTED, like everywhere else in `src/ai/` -- nothing in this file may call
// `Math.random`, because two runs of one seed would then diverge.
//
// The per-country campaign table is durable state outside the store, so it needs a save
// slice; `captureCampaigns()` / `restoreCampaigns()` are that, and `aiCalculations.js`
// registers them. The registration lives there rather than here to keep this module free
// of any import from `platform/`.

import {
    attackDiscipline,
    campaignPostures,
    campaignTargetWeights,
    CAMPAIGN_REVIEW_INTERVAL,
    continentAmbitionWeights,
    continentModifiers,
    maxFarms,
    maxForests,
    maxForts,
    maxOilWells,
    postureThresholds,
    siegeDiscipline
} from "../config/balance.js";
import { aiSieges, playerSieges, territoriesOwnedByCountry } from "../state/selectors.js";
import {
    captureTheatres,
    frontierFor,
    noteAttemptOutcome,
    noteDevelopment,
    restoreTheatres,
    resetTheatres,
    reviewTheatre,
    theatreWeightFor,
    wallsFor
} from "./theatre.js";
import {
    activeVictoryCondition,
    continentStandingsFor,
    VictoryCondition,
    victoryProgress,
    worldStandings
} from "./victory.js";

/** The four postures, named so that nothing has to spell the strings. */
export const Posture = Object.freeze({
    DEVELOP: "DEVELOP",
    EXPAND: "EXPAND",
    CONSOLIDATE: "CONSOLIDATE",
    DEFEND: "DEFEND"
});

/**
 * country -> { continents: string[], chosenOnTurn: number }
 *
 * The only thing that persists between turns, and the reason it persists is above.
 */
const commitments = new Map();

/**
 * country -> Map(targetTerritoryName -> {failures, lastTurn})
 *
 * What a country has tried and lost. Without this an AI re-attacks the territory that just
 * beat it, every turn, forever -- it re-derives the same threat, gets the same odds and
 * makes the same decision, because nothing anywhere remembered the outcome. It showed up
 * in the activity feed as the same line repeating turn after turn ("Niger fails to conquer
 * Libya", turns 2, 3 and 4) and it is the clearest thing a turn-local AI does wrong.
 *
 * A failure decays: it is forgotten after `SETBACK_MEMORY_TURNS` quiet turns, so a country
 * that has since built an army will try again rather than being permanently deterred.
 */
const setbacks = new Map();

/** How long a country remembers losing an attack against a particular territory. */
const SETBACK_MEMORY_TURNS = 6;

/** country -> the campaign object built this turn. Rebuilt every turn; a cache, not state. */
const campaignsThisTurn = new Map();
let campaignsCachedForTurn = null;

/**
 * country -> the posture it took last turn.
 *
 * Needed because "have I been developing fruitlessly?" is a question about what this country
 * HAS been doing, and the campaign that knew is two turns of garbage collection ago.
 */
const lastPosture = new Map();

/** Wipe every campaign. New Game and the unit tests call this. */
export function resetCampaigns() {
    commitments.clear();
    setbacks.clear();
    campaignsThisTurn.clear();
    campaignsCachedForTurn = null;
    lastPosture.clear();
    resetTheatres();
}

/**
 * Remember how an attack went.
 *
 * A win clears the memory outright -- the territory is now this country's, and if it is
 * ever lost again the next failure starts a fresh count.
 */
export function recordAttackOutcome(country, targetTerritoryName, won, turn, targetOwner = null) {
    if (!country || !targetTerritoryName) {
        return;
    }
    //The same outcome, told twice, because the two memories answer different questions.
    //This one is per TERRITORY -- "do not throw the army at that hill again". The theatre's
    //is per COUNTRY -- "this whole neighbour is a wall, go around". A country that keeps
    //picking new territories along the same unbreakable border would satisfy the first
    //memory perfectly and still be stuck.
    noteAttemptOutcome(country, targetOwner, won, turn);
    if (!setbacks.has(country)) {
        setbacks.set(country, new Map());
    }
    const byTarget = setbacks.get(country);

    if (won) {
        byTarget.delete(targetTerritoryName);
        return;
    }
    const previous = byTarget.get(targetTerritoryName);
    byTarget.set(targetTerritoryName, {
        failures: (previous?.failures ?? 0) + 1,
        lastTurn: Number(turn) || 0
    });
}

/** How many times in a row this country has lost against this territory, lately. */
export function failuresAgainst(country, targetTerritoryName, turn = 0) {
    const record = setbacks.get(country)?.get(targetTerritoryName);
    if (!record) {
        return 0;
    }
    return turn - record.lastTurn > SETBACK_MEMORY_TURNS ? 0 : record.failures;
}

export function captureCampaigns() {
    //One save slice, two modules: the mid-term goals live in `theatre.js` and are captured
    //through here rather than registering a second slice, because a restore that brought
    //back a country's continents without the rival it was in the middle of absorbing would
    //be a plan with its middle missing.
    const data = { commitments: {}, setbacks: {}, theatres: captureTheatres() };
    for (const [country, commitment] of commitments) {
        data.commitments[country] = {
            continents: [...commitment.continents],
            chosenOnTurn: commitment.chosenOnTurn
        };
    }
    for (const [country, byTarget] of setbacks) {
        data.setbacks[country] = Object.fromEntries(byTarget);
    }
    return data;
}

export function restoreCampaigns(data) {
    resetCampaigns();
    //A save written before setbacks existed has the commitments at the top level; one
    //written since nests them. Both load, because refusing an old save over a plan the AI
    //can simply re-derive would be the wrong trade.
    const commitmentData = data?.commitments ?? data ?? {};
    for (const [country, commitment] of Object.entries(commitmentData)) {
        if (Array.isArray(commitment?.continents)) {
            commitments.set(country, {
                continents: [...commitment.continents],
                chosenOnTurn: Number(commitment.chosenOnTurn) || 0
            });
        }
    }
    for (const [country, byTarget] of Object.entries(data?.setbacks ?? {})) {
        setbacks.set(country, new Map(Object.entries(byTarget ?? {})));
    }
    //Absent from a save written before mid-term goals existed, which restores as "nobody has
    //committed to anything yet" -- the same state a new game starts in, so it costs a few
    //turns of re-choosing rather than failing the load.
    restoreTheatres(data?.theatres);
}

/** What this country has committed to taking, or an empty list if it has not chosen yet. */
export function committedContinents(country) {
    return [...(commitments.get(country)?.continents ?? [])];
}

/**
 * The campaign for one country on one turn.
 *
 * Called once per country per AI turn, before its goals are planned. Memoised on the turn
 * number, so the plan logger and the goal planner see the same object rather than two
 * independently-derived ones that could disagree.
 *
 * @param {string} country
 * @param {{turn: number, leader?: object, rng?: () => number, standings?: object,
 *          condition?: object}} context
 * @returns {object} the campaign -- see the module comment
 */
export function planCampaign(country, context = {}) {
    const turn = Number(context.turn) || 0;

    if (campaignsCachedForTurn !== turn) {
        campaignsThisTurn.clear();
        campaignsCachedForTurn = turn;
    }
    if (campaignsThisTurn.has(country)) {
        return campaignsThisTurn.get(country);
    }

    const condition = context.condition ?? activeVictoryCondition();
    const standings = context.standings ?? worldStandings();
    const rows = continentStandingsFor(country, standings);
    const traits = context.leader?.traits ?? {};
    const leaderType = context.leader?.leaderType ?? "balanced";
    const rng = typeof context.rng === "function" ? context.rng : () => 0.5;

    const objective = chooseObjective(country, { condition, rows, turn, rng });
    const focus = chooseFocusContinent(objective, rows);
    const health = assessCountry(country);

    //The MID-TERM goal, between the objective above and this turn's goals below: the
    //neighbouring country this one is trying to absorb, kept while it is working and
    //dropped for another when it is not. `theatre.js` owns the judgement and the memory.
    const theatre = context.theatre ?? reviewTheatre({
        country,
        turn,
        focusContinent: focus?.continent ?? null,
        frontier: context.frontier ?? frontierFor(country),
        //Every country's size, already counted in one pass by `worldStandings()` above.
        //Without this the ranking runs a 359-territory scan per candidate rival per country
        //per turn -- the same shape of mistake Phase 1.5 took out of the goal planner.
        sizeOf: (name) => standings.byCountry.get(name)?.territories ?? 0,
        rng
    });

    //Has developing got this country anywhere lately? Asked with LAST turn's posture,
    //because the question is about what it has been doing, not what it is about to do.
    const development = noteDevelopment(country, health.development, turn, lastPosture.get(country));

    const posture = choosePosture({
        health, focus, leaderType, traits, rows, objective,
        developmentStalled: development.stalled,
        theatre
    });
    lastPosture.set(country, posture);
    const budgets = deriveBudgets({ country, health, posture, traits, leaderType });

    const tuning = campaignPostures[posture] ?? campaignPostures.EXPAND;

    const campaign = {
        country,
        turn,
        leaderType,
        objective,
        focusContinent: focus?.continent ?? null,
        focusStanding: focus ?? null,
        standings: rows,
        /**
         * The mid-term goal: the country being absorbed, why it was chosen or dropped, and
         * what has come of it so far. `targeting.js` weighs targets by it and the debug
         * panel prints it -- it is the answer to "what is this country actually doing?",
         * which neither the objective (too far away) nor the goal list (too close) gives.
         */
        theatre,
        /** Rivals this country has tried and failed against, and is leaving alone for now. */
        walls: wallsFor(country, turn),
        /** Whether developing has stopped getting this country anywhere. */
        development,
        posture,
        progress: victoryProgress(country, condition, standings),
        health,
        ...budgets,
        economyBias: tuning.economyBias,
        defenceBias: tuning.defenceBias,
        offenceBias: tuning.offenceBias,
        fortShare: tuning.fortShare,
        upgradeScale: tuning.upgradeScale,
        /**
         * Per-turn scratch. `goals.js` writes a rating in here as it decides what is worth
         * attacking, and the prioritiser reads it back. It is on the campaign rather than
         * threaded through four functions because the goal ROWS are positional arrays that
         * are rebuilt and spread twice during refinement -- anything attached to a row does
         * not survive the trip.
         */
        /** What this country has tried and lost against lately. `targeting.js` reads it. */
        failuresAgainst: (territoryName) => failuresAgainst(country, territoryName, turn),
        ratings: new Map(),
        /**
         * Every pairing this country weighed and what it concluded, filled in by
         * `goals.js`. The debug panel reads it; nothing in the rules does.
         */
        decisions: [],
        /** Counted up by the executor so it can stop when the budget is spent. */
        siegesOpenedThisTurn: 0,
        attacksPressedThisTurn: 0
    };

    campaignsThisTurn.set(country, campaign);
    return campaign;
}

/**
 * A siege this country was running has ended during its own turn -- stormed, or abandoned
 * by `siegeReview.js`. Give the slot back.
 *
 * The budgets are derived once, at the top of the turn, from the sieges that were running
 * THEN. Ending one afterwards without this would leave the country believing it is still
 * at its concurrent cap and refusing to open a siege it can now afford -- the campaign
 * would be describing a world one decision out of date.
 */
export function releaseSiegeSlot(campaign) {
    if (!campaign) {
        return null;
    }
    campaign.activeSieges = Math.max(0, (campaign.activeSieges ?? 0) - 1);
    if (campaign.health) {
        campaign.health.activeSieges = campaign.activeSieges;
    }
    campaign.siegeBudget = clampInt(
        Math.min(siegeDiscipline.maxOpenedPerTurn,
            (campaign.concurrentSiegeCap ?? 0) - campaign.activeSieges),
        0, siegeDiscipline.maxOpenedPerTurn);
    return campaign;
}

/** The campaign already planned for this country this turn, or null. */
export function currentCampaign(country) {
    return campaignsThisTurn.get(country) ?? null;
}

/**
 * The long-term objective, derived from the active victory condition.
 *
 * Under CONTINENTAL this is the three continents the country is taking. Under DOMINATION
 * there is no continent to name, but a country still has to expand SOMEWHERE, and the
 * cheapest area is the continent it already has most of -- so the same machinery is used
 * with the required count widened, which makes a domination AI spread rather than tunnel.
 */
function chooseObjective(country, { condition, rows, turn, rng }) {
    const required = condition.kind === VictoryCondition.CONTINENTAL
        ? condition.continentsRequired
        : Math.min(rows.length, condition.kind === VictoryCondition.DOMINATION ? 4 : 2);

    const held = commitments.get(country);
    const stale = !held ||
        held.continents.length !== required ||
        turn - held.chosenOnTurn >= CAMPAIGN_REVIEW_INTERVAL ||
        commitmentIsPointless(held.continents, rows);

    let continents;
    if (stale) {
        continents = rankContinentsByAmbition(rows, rng).slice(0, required).map(row => row.continent);
        commitments.set(country, { continents, chosenOnTurn: turn });
    } else {
        continents = held.continents;
    }

    return {
        kind: condition.kind,
        required,
        continents: [...continents],
        //Under CONTINENTAL, a committed continent already held outright is banked; the
        //country stops spending attacks on it and defends it instead.
        banked: rows.filter(row => row.complete && continents.includes(row.continent))
            .map(row => row.continent)
    };
}

/**
 * A commitment is pointless when every continent in it is either finished or lost.
 *
 * "Finished" is only pointless if ALL of them are -- a country that has taken one of its
 * three continents is doing well, not stuck. "Lost" means no foothold at all, which is
 * what happens when a country is driven off a continent and would otherwise keep planning
 * for a war it cannot reach.
 */
function commitmentIsPointless(continents, rows) {
    const byName = new Map(rows.map(row => [row.continent, row]));
    return continents.every(name => {
        const row = byName.get(name);
        return !row || row.complete || row.held === 0;
    });
}

/**
 * Rank every continent by how good a campaign it would make.
 *
 * The five terms are all in `continentAmbitionWeights` with a sentence each. The rng term
 * is deliberately small -- it exists so that two neighbours with identical standings do not
 * always commit to the same continent, not so that the choice is a coin flip.
 */
export function rankContinentsByAmbition(rows, rng = () => 0.5) {
    const weights = continentAmbitionWeights;

    return rows
        .map(row => {
            const value = continentModifiers[row.continent] ?? 0.5;
            const brevity = 1 - Math.min(1, row.total / weights.brevityScale);
            const score =
                row.share * weights.share +
                (row.held > 0 ? weights.foothold : 0) +
                value * weights.value +
                brevity * weights.brevity -
                row.strongestRivalShare * weights.contest +
                rng() * 0.25;
            return { ...row, ambition: score };
        })
        .sort((a, b) => b.ambition - a.ambition || a.continent.localeCompare(b.continent));
}

/** The committed continent to push this turn: closest to done, and not already done. */
function chooseFocusContinent(objective, rows) {
    const byName = new Map(rows.map(row => [row.continent, row]));
    let best = null;
    for (const name of objective.continents) {
        const row = byName.get(name);
        if (!row || row.complete) {
            continue;
        }
        if (!best || row.share > best.share || (row.share === best.share && row.missing < best.missing)) {
            best = row;
        }
    }
    //Every committed continent finished -- rare, and it means the country has won under a
    //CONTINENTAL condition. Fall back to whatever it holds most of so it keeps playing.
    return best ?? rows.find(row => !row.complete && row.held > 0) ?? null;
}

/**
 * The country's own condition, in the four numbers a posture is chosen from.
 *
 * `development` is what fraction of the buildings its territories could hold are built,
 * and it is the honest measure of whether a country has an economy yet. `besiegedShare`
 * is how much of it is currently paying nothing because somebody is sitting outside.
 */
export function assessCountry(country) {
    const owned = territoriesOwnedByCountry(country);
    const maximumBuildings = maxFarms + maxForests + maxOilWells + maxForts;

    let built = 0;
    let besieged = 0;
    let army = 0;
    let gold = 0;

    const player = playerSieges();
    const ai = aiSieges();

    for (const territory of owned) {
        built += (territory.farmsBuilt ?? 0) + (territory.forestsBuilt ?? 0) +
            (territory.oilWellsBuilt ?? 0) + (territory.fortsBuilt ?? 0);
        army += Number(territory.armyForCurrentTerritory) || 0;
        gold += Number(territory.goldForCurrentTerritory) || 0;
        if (player[territory.territoryName] || ai[territory.territoryName]) {
            besieged += 1;
        }
    }

    const territories = owned.length;
    return {
        territories,
        army,
        gold,
        besieged,
        besiegedShare: territories === 0 ? 0 : besieged / territories,
        development: territories === 0 ? 0 : built / (territories * maximumBuildings),
        activeSieges: siegesRunBy(country)
    };
}

/** How many sieges this country currently has running. The number it never used to count. */
export function siegesRunBy(country) {
    let count = 0;
    for (const siege of Object.values(aiSieges())) {
        if (siege?.attackingCountry === country) {
            count += 1;
        }
    }
    return count;
}

/**
 * Which kind of turn this is.
 *
 * The order of the tests is the priority: being besieged beats everything, then having no
 * economy to fight a war with, then being close enough to finishing a continent that
 * opening a second front would be a mistake. Personality shifts the thresholds rather than
 * overriding the answer -- a pacifist develops sooner and an aggressive leader expands
 * through more discomfort, but neither ignores a quarter of its country being besieged.
 *
 * Two rules here are the difference between a world that consolidates and one that freezes,
 * and both are forms of the same mistake: a posture that guarantees the conditions for
 * choosing it again next turn.
 *
 *   BEING SMALL IS A REASON TO EXPAND. It used to be an `||` -- a country under four
 *   territories DEVELOPed whatever its economy looked like. On a map that begins as 207
 *   countries, most of them holding one or two territories, that disqualified the great
 *   majority of the world from ever expanding, and never expanding is what kept them small.
 *   A small country builds its first farms; a small country that HAS farms takes a
 *   neighbour, because no amount of building will make one territory into an empire.
 *
 *   DEVELOPING IS A MEANS, NOT A STATE. A country whose development has not moved in
 *   `developStallTurns` has learned that building is not working -- besieged, boxed in, or
 *   on ground too poor to pay for the next upgrade -- and fights instead. Without this the
 *   posture that produced the failure is the posture the failure keeps it in, which is the
 *   whole of what "the AI gets stuck repeating a failed approach" means economically.
 */
export function choosePosture({ health, focus, leaderType, traits, objective, developmentStalled = false, theatre = null }) {
    const thresholds = postureThresholds;
    const expansion = finiteOr(traits?.territory_expansion, 0.5);
    const fortify = finiteOr(traits?.fortification, 0.5);

    const defendAt = thresholds.besiegedShareForDefend * (leaderType === "aggressive" ? 1.5 : 1) *
        (fortify > 0.6 ? 0.75 : 1);
    if (health.besiegedShare >= defendAt && health.besieged > 0) {
        return Posture.DEFEND;
    }

    //A small country is asked for a little MORE economy before it starts a war, rather than
    //being forbidden one: it has fewer territories to raise an army from, so the first farms
    //genuinely do come first. What it is not is permanently disqualified.
    const developAt = thresholds.developmentForDevelop *
        (leaderType === "pacifist" ? 1.6 : leaderType === "aggressive" ? 0.6 : 1) *
        (health.territories <= thresholds.smallCountryTerritories ? 1.3 : 1);

    if (health.development < developAt) {
        //An aggressive leader with somewhere obvious to go will still go, small or not; and
        //nobody keeps developing once developing has stopped paying.
        const pushOnAnyway = developmentStalled ||
            (leaderType === "aggressive" && expansion > 0.85 && focus && focus.missing <= 3);
        if (!pushOnAnyway) {
            return Posture.DEVELOP;
        }
    }

    if (objective.banked.length > 0 && !focus) {
        return Posture.CONSOLIDATE;
    }

    if (focus && focus.share >= thresholds.focusShareForConsolidate) {
        return Posture.CONSOLIDATE;
    }

    return Posture.EXPAND;
}

/**
 * How much war this country may start.
 *
 * Both budgets scale with how much country there is to draw an army from, are scaled again
 * by the posture, and the siege budget is then reduced by the sieges ALREADY running. That
 * last subtraction is the fix for the AI's most visible failure: it opened sieges it could
 * not feed until two thirds of its army was standing still outside somebody else's forts.
 */
export function deriveBudgets({ country, health, posture, traits, leaderType }) {
    const tuning = campaignPostures[posture] ?? campaignPostures.EXPAND;
    const expansionBias = 0.6 + finiteOr(traits?.territory_expansion, 0.5) * 0.8;

    const concurrentSiegeCap = clampInt(
        Math.round((siegeDiscipline.baseConcurrent +
            Math.floor(health.territories / siegeDiscipline.territoriesPerExtraConcurrent)) *
            tuning.siegeBudgetScale * expansionBias),
        0, siegeDiscipline.maxConcurrent);

    //A country in a fighting posture always gets at least one attack. The scaled figure
    //rounded to ZERO for the great majority of the world -- one base attack times DEVELOP's
    //0.4 is 0.4 -- so the budget, not the odds, was deciding that nothing happened. The
    //ODDS FLOORS are what keep an attack honest; a budget of nought is not discipline, it
    //is a country that has been told to sit still whatever it can see in front of it. Only
    //DEFEND may be reduced to none, because a country with a fifth of itself besieged has
    //somewhere better to put the army.
    const scaledAttacks = Math.round((attackDiscipline.basePerTurn +
        Math.floor(health.territories / attackDiscipline.territoriesPerExtraAttack)) *
        tuning.attackBudgetScale * expansionBias);
    const attackBudget = clampInt(
        posture === Posture.DEFEND ? scaledAttacks : Math.max(1, scaledAttacks),
        0, attackDiscipline.maxPerTurn);

    const siegeBudget = clampInt(
        Math.min(siegeDiscipline.maxOpenedPerTurn, concurrentSiegeCap - health.activeSieges),
        0, siegeDiscipline.maxOpenedPerTurn);

    return {
        country,
        concurrentSiegeCap,
        activeSieges: health.activeSieges,
        /** New sieges this country may open this turn. Zero is a perfectly ordinary answer. */
        siegeBudget,
        attackBudget,
        /** Odds floor an attack must clear, in percent. See `attackDiscipline`. */
        attackOddsFloor: attackOddsFloorFor(leaderType, traits, posture),
        siegeOddsFloor: siegeOddsFloorFor(posture)
    };
}

/**
 * The odds an attack has to show before this leader will press it.
 *
 * `style_of_war` is documented as "low favours sieges, high favours pressing an attack on
 * unclear odds", so it moves the floor down as it rises. The old planner demanded only
 * `probability >= 1`, which is why an AI would throw an army at a one-percent chance.
 */
export function attackOddsFloorFor(leaderType, traits, posture) {
    const base = attackDiscipline.minimumOdds[leaderType] ?? attackDiscipline.minimumOdds.balanced;
    const style = Number(traits?.style_of_war);
    const swing = Number.isFinite(style)
        ? (0.5 - style) * 2 * attackDiscipline.styleOfWarSwing
        : 0;

    const postureShift = posture === Posture.DEFEND ? 20 : posture === Posture.DEVELOP ? 10 : 0;
    return Math.max(5, Math.min(90, base + swing + postureShift));
}

/** A siege may be opened on worse odds than an attack -- that is what a siege is for. */
export function siegeOddsFloorFor(posture) {
    const postureShift = posture === Posture.DEFEND ? 25 : posture === Posture.DEVELOP ? 10 : 0;
    return Math.max(5, siegeDiscipline.minimumOdds + postureShift);
}

/**
 * How much the campaign multiplies a target's worth by, given where it is.
 *
 * This is "pick your battles" reduced to one number. A territory on the continent the
 * country is finishing is worth two and a half times one that is nowhere near it, and the
 * completion bonus makes the last few territories of a continent worth fighting hard for.
 */
export function campaignWeightForTarget(campaign, target) {
    if (!campaign || !target) {
        return 1;
    }
    const continent = target.continent;
    const weights = campaignTargetWeights;

    let weight;
    if (continent && continent === campaign.focusContinent) {
        weight = weights.focusContinent;
    } else if (continent && campaign.objective.continents.includes(continent)) {
        weight = campaign.objective.banked.includes(continent)
            ? weights.committedContinent * 0.5   //already held outright; nothing to take
            : weights.committedContinent;
    } else {
        weight = weights.offContinent;
    }

    const standing = campaign.standings?.find(row => row.continent === continent);
    if (standing && standing.missing > 0 && campaign.objective.continents.includes(continent)) {
        //The last territory of a continent is worth the full bonus; the tenth-from-last
        //is worth almost none of it.
        weight *= 1 + (weights.completionBonus - 1) / standing.missing;
    }

    //And the MID-TERM goal, which is the term that concentrates a war rather than spreading
    //it. Two targets of equal worth on the same continent are not equally useful: the one
    //belonging to the country being absorbed is a step towards owning a whole neighbour,
    //and the one belonging to a rival already written off as a wall is a step back into the
    //fight that produced the wall.
    weight *= theatreWeightFor(campaign.country, target.dataName, campaign.turn);

    return weight;
}

/** A trait read defensively: leaders are generated data and a missing trait must not poison a budget. */
function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function clampInt(value, low, high) {
    if (!Number.isFinite(value)) {
        return low;
    }
    return Math.max(low, Math.min(high, Math.round(value)));
}
