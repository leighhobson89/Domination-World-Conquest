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
// THE THREE HORIZONS ARE DECIDED AT THREE DIFFERENT RATES, and that is the whole point of
// the module holding state:
//
//   LONG   the committed continents. Chosen ONCE, from the world as it stands when the
//          country first plans, and never re-picked -- not on a review interval, not when
//          the plan looks pointless, and not when the leader dies. It is the war the
//          country is fighting.
//   MEDIUM the theatre (`theatre.js`): which neighbour to absorb on the way. Re-judged
//          continuously, dropped when it stalls, and wiped by a succession.
//   SHORT  this turn's goals, and the borders lately not worth another try. Turn-local.
//
// It used to re-pick the long term every `CAMPAIGN_REVIEW_INTERVAL` turns and again whenever
// the commitment "became pointless", which for a country whose only foothold continent was
// complete was EVERY turn -- so the horizon meant to be the most stable was the one that
// churned most. Leigh's decision: a country does not change its mind about which continents
// it is conquering; it changes its mind about how.
//
// THE CHOICE IS MADE FROM THE WORLD, NOT FROM A TABLE. `foothold` counts only territories
// already HELD, so a continent across a shared border used to score the same as one on the
// far side of the planet, and a country with no foothold outside its own continent had its
// score collapse to the static `continentModifiers` -- which made the objective effectively
// fixed. `reach` is the term that fixes it: how much of the continent this country can
// actually touch. Measured on the real map, it is the difference between a finished North
// American power committing to Europe (one crossing) and to South America (eleven).
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
    continentAmbitionWeights,
    continentModifiers,
    continentReachSaturation,
    doctrineUrgency,
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
    clearTheatreMemoryFor,
    resetTheatres,
    reviewTheatre,
    theatreWeightFor,
    wallsFor
} from "./theatre.js";
import { doctrineFor } from "./doctrine.js";
import {
    activeVictoryCondition,
    continentStandingsFor,
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
 * Wipe ONE country's MEDIUM and SHORT term, so a new leader decides again how to fight the
 * war it has inherited -- and keep the LONG term, which is the war itself.
 *
 * THE COMMITTED CONTINENTS SURVIVE A SUCCESSION, and that is a reversal of what this used to
 * do. It wiped them too, which made a succession a country forgetting what it was for: the
 * heir re-ranked from scratch and could point the whole apparatus at a different continent,
 * so a fifty-turn war ended because somebody died. The conquest of a continent is the
 * COUNTRY's plan and outlives whoever is running it; what an heir gets to change is
 * everything about HOW.
 *
 * So what goes is: the theatre it was absorbing and the rivals it had written off as walls
 * (the medium term, `theatre.js`), the borders it decided were not worth another try (the
 * short term, `setbacks`), the posture it had settled into, and any campaign already derived
 * for this turn. `campaignsThisTurn` is deliberately included because a succession is applied
 * BEFORE the country plans, so a campaign derived under the dead leader must not be reused.
 *
 * What is NOT touched is the world -- the army, the territories, the sieges standing --
 * because a succession is a change of mind and not a change of circumstances.
 */
export function clearPlansFor(country) {
    if (!country) {
        return;
    }
    setbacks.delete(country);
    campaignsThisTurn.delete(country);
    lastPosture.delete(country);
    clearTheatreMemoryFor(country);
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

    //The goal, turned into the dials this file already thinks in. Everything below reads
    //the doctrine; nothing in `src/ai/` outside `doctrine.js` asks which condition is
    //active any more, which is what makes adding a sixth goal one entry in a table.
    const doctrine = context.doctrine ?? doctrineFor(condition, {
        country,
        turn,
        standings,
        progress: victoryProgress(country, condition, standings, turn)
    });

    //ONE frontier, read twice. It was built inside the `reviewTheatre()` argument list; it
    //is hoisted because `chooseObjective()` needs it too, and walking the border twice a turn
    //per country is the shape of mistake Phase 1.5 took out of the goal planner.
    const frontier = context.frontier ?? frontierFor(country);
    const reach = reachByContinent(frontier);

    const objective = chooseObjective(country, { condition, doctrine, rows, turn, rng, reach });
    const focus = chooseFocusContinent(objective, rows);
    const health = assessCountry(country);

    //The MID-TERM goal, between the objective above and this turn's goals below: the
    //neighbouring country this one is trying to absorb, kept while it is working and
    //dropped for another when it is not. `theatre.js` owns the judgement and the memory.
    const theatre = context.theatre ?? reviewTheatre({
        country,
        turn,
        focusContinent: focus?.continent ?? null,
        frontier,
        //Under GREAT_POWERS this is the powers still to be broken, so a country that
        //borders one commits to absorbing IT rather than to whichever small neighbour
        //happened to rank best. Empty under every other goal, which costs nothing.
        preferredRivals: doctrine.targetCountries,
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
        theatre,
        neverSatisfied: doctrine.neverSatisfied
    });
    lastPosture.set(country, posture);
    const budgets = deriveBudgets({
        country, health, posture, traits, leaderType, urgency: doctrine.urgency
    });

    const tuning = campaignPostures[posture] ?? campaignPostures.EXPAND;

    const campaign = {
        country,
        turn,
        leaderType,
        objective,
        /**
         * The active goal, as dials. On the campaign because `targeting.js` weighs a
         * target by `areaHunger` and by whether its `originalOwner` is a target power,
         * and the debug panel and the spectator log both print what this country is
         * ultimately playing for.
         */
        doctrine,
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
        progress: victoryProgress(country, condition, standings, turn),
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
 * The long-term objective, derived from the doctrine.
 *
 * Under CONTINENTAL this is the three continents the country is taking. Under every other
 * goal there is no continent the condition names, but a country still has to expand
 * SOMEWHERE, and the cheapest ground is the continent it already has most of -- so the same
 * machinery runs with the count the doctrine asks for, which is what makes a Domination AI
 * spread over four fronts and a Conquest AI point at the whole map.
 *
 * This function used to be the ONLY place the victory condition was read, and it read it by
 * name: CONTINENTAL got its own figure, DOMINATION got four and everything else got two.
 * That is now one row in `goalDoctrines`, and this asks the doctrine.
 */
function chooseObjective(country, { doctrine, rows, turn, rng, reach }) {
    //`Infinity` is what CONQUEST asks for and means "as many as the map has". The clamp is
    //here rather than in the doctrine because only this function knows how many continents
    //there are, and the lower bound matters as much as the upper: a country committed to no
    //continents at all has no objective and stops choosing targets.
    const required = Math.max(1, Math.min(rows.length || 1, doctrine.continentsToCommit));

    //CHOSEN ONCE EACH, AND GROWN ONE AT A TIME. Nothing already on this list is ever
    //re-ranked, re-ordered or dropped -- not on a timer, not when the plan looks hopeless,
    //and not when the leader dies. What the list may do is GROW, and that is what keeps the
    //choice a derived one rather than a table lookup.
    //
    //WHY IT IS NOT ALL CHOSEN AT ONCE. On turn 1 a country holds one or two territories and
    //borders almost nothing, so `reach` is near zero for every foreign continent and the
    //score collapses to `continentModifiers` -- a static table. Measured on the real map with
    //the whole objective fixed on turn 1, almost every country in the world came out with
    //["its own continent", "Europe", "South America"], which is a fixed objective wearing the
    //clothes of a derived one. Deciding the next continent only when the current ones are
    //TAKEN means each decision is made from a world the country can actually see: a power
    //that has just finished North America knows it borders South America through eleven
    //crossings and Europe through one.
    //
    //There is deliberately no escape for a commitment that has become unreachable. A country
    //driven off every continent it committed to keeps planning for them, and what that costs
    //is one multiplier: every target it can actually see falls to `offContinent` weight, which
    //is uniform, so it behaves as though it had no preference rather than as though it were
    //paralysed. `theatre.js` still picks its neighbour by adjacency and the country still
    //fights. Buying that back with a re-pick is what used to make the long term churn.
    const held = commitments.get(country);
    let continents = held ? held.continents : [];

    if (continents.length > required) {
        //The victory condition was changed mid-game and now asks for fewer. Trim from the
        //end so the continents it has been fighting for longest are the ones it keeps.
        continents = continents.slice(0, required);
        commitments.set(country, { continents, chosenOnTurn: held.chosenOnTurn });
    } else if (continents.length === 0 || (continents.length < required && allComplete(continents, rows))) {
        const next = rankContinentsByAmbition(rows, rng, { reach })
            .map(row => row.continent)
            .find(name => !continents.includes(name));
        if (next) {
            continents = [...continents, next];
            commitments.set(country, { continents, chosenOnTurn: held?.chosenOnTurn ?? turn });
        }
    }

    return {
        kind: doctrine.kind,
        required,
        continents: [...continents],
        //Under CONTINENTAL, a committed continent already held outright is banked; the
        //country stops spending attacks on it and defends it instead.
        banked: rows.filter(row => row.complete && continents.includes(row.continent))
            .map(row => row.continent)
    };
}

/**
 * Is every continent on this list held outright?
 *
 * The gate on committing to a further one. A country still fighting for what it has does not
 * open a second long-term front -- the medium-term goal in `theatre.js` is where "what next"
 * is decided at the pace a war actually moves.
 */
function allComplete(continents, rows) {
    if (continents.length === 0) {
        return false;
    }
    const byName = new Map(rows.map(row => [row.continent, row]));
    return continents.every(name => byName.get(name)?.complete === true);
}

/**
 * Rank every continent by how good a campaign it would make.
 *
 * The six terms are all in `continentAmbitionWeights` with a sentence each. The rng term is
 * deliberately small -- it exists so that two neighbours with identical standings do not
 * always commit to the same continent, not so that the choice is a coin flip.
 *
 * `reach` is a Map of continent -> how many distinct adjacent ENEMY territories this country
 * can touch there, folded from the same frontier `theatre.js` is about to use. It is optional
 * and absent means zero for everything, which is what a Node caller with no adjacency loaded
 * gets -- the ranking then degrades to what it was rather than throwing.
 *
 * WITHOUT IT THE CHOICE IS NOT DERIVED AT ALL. `foothold` counts only territories already
 * held, so a country with no presence outside its own continent scores every other continent
 * on `value` and `brevity`, both static tables -- and every power in that position therefore
 * commits to the same continent, whether or not it shares a metre of border with it.
 *
 * @param {Array} rows from `continentStandingsFor()`
 * @param {() => number} [rng]
 * @param {{reach?: Map<string, number>}} [options]
 */
export function rankContinentsByAmbition(rows, rng = () => 0.5, { reach = null } = {}) {
    const weights = continentAmbitionWeights;

    return rows
        .map(row => {
            const value = continentModifiers[row.continent] ?? 0.5;
            const brevity = 1 - Math.min(1, row.total / weights.brevityScale);
            const adjacent = Number(reach?.get(row.continent)) || 0;
            const reachable = Math.min(1, adjacent / Math.max(1, continentReachSaturation));
            const score =
                row.share * weights.share +
                (row.held > 0 ? weights.foothold : 0) +
                value * weights.value +
                brevity * weights.brevity +
                reachable * weights.reach -
                row.strongestRivalShare * weights.contest +
                rng() * 0.25;
            return { ...row, reachable: adjacent, ambition: score };
        })
        .sort((a, b) => b.ambition - a.ambition || a.continent.localeCompare(b.continent));
}

/**
 * The frontier, folded into "how much of each continent can this country actually touch".
 *
 * Distinct enemy TERRITORIES rather than pairings: a pairing count says how much of OUR
 * border faces them, and the question being asked here is how much of THEIRS is open to us.
 * `frontierFor()` already de-duplicates its `territories` list per rival, and a territory
 * belongs to exactly one continent, so summing the per-rival continent tallies is a count of
 * distinct enemy territories.
 *
 * @param {Map} frontier from `frontierFor()`
 * @returns {Map<string, number>} continent -> adjacent enemy territories
 */
export function reachByContinent(frontier) {
    const reach = new Map();
    for (const entry of frontier?.values() ?? []) {
        for (const [continent, count] of entry.continents ?? []) {
            reach.set(continent, (reach.get(continent) ?? 0) + count);
        }
    }
    return reach;
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
export function choosePosture({ health, focus, leaderType, traits, objective, developmentStalled = false, theatre = null, neverSatisfied = false }) {
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

    //Everything the country committed to is taken and there is nothing left to push.
    //Under most goals that is a country that has arrived and should hold what it has --
    //but under World Conquest there is no such thing as having arrived, and a large empire
    //that reached this branch would sit in CONSOLIDATE for the rest of the game while the
    //one territory it still does not own goes untaken. `neverSatisfied` is the doctrine
    //saying the goal has no resting point; the country re-commits and keeps going.
    if (objective.banked.length > 0 && !focus && !neverSatisfied) {
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
 *
 * `urgency` -- the doctrine's runaway-leader dial -- scales the ATTACK budget and NOTHING
 * ELSE. It is what makes a player who pulls ahead get attacked harder by the whole world.
 * It must never reach the siege budget: that budget counting the sieges already running is
 * precisely what ended the seventeen-to-sixty-seven concurrent sieges problem, and a
 * multiplier applied over the cap would undo the subtraction that fixed it. `doctrine.js`
 * offers no siege dial at all so that this cannot be done by accident.
 */
export function deriveBudgets({ country, health, posture, traits, leaderType, urgency = 0 }) {
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
    const hurry = 1 + clamp01(urgency) * (doctrineUrgency.attackBudgetBoost - 1);
    const scaledAttacks = Math.round((attackDiscipline.basePerTurn +
        Math.floor(health.territories / attackDiscipline.territoriesPerExtraAttack)) *
        tuning.attackBudgetScale * expansionBias * hurry);
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
        /**
         * How many attacks any ONE of this country's territories may press this turn. The
         * country budget above still applies on top: this is what stops a single province
         * being the whole war, not what decides how much war there is.
         */
        attacksPerTerritory: attacksPerTerritoryFor(leaderType, traits),
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
/**
 * How many attacks ONE TERRITORY may press this turn.
 *
 * The player has always been able to attack repeatedly in a turn and the AI could not:
 * `doAiActions()` carried a bare `//only one attack from any territory per turn`, so a
 * province bordering three weak enemies took one of them a turn however much army it had
 * left standing, and a breakthrough could never be exploited in the turn it was made.
 *
 * IT IS A CAP AND NOT A RATION. Nothing is divided up in advance: each attack is sized
 * against what the territory has left AFTER the previous one, through the same
 * `decideCommitment()` as every other attack, so the odds floor is what actually stops the
 * second and the third. Splitting the garrison up front would be strictly worse and the
 * measurement is unambiguous -- the battle is a STEP function, so two attacks at 0.175:1 are
 * 0% and 0% where one at 1.5:1 is 77%. Concentration beats dispersion, and going again with
 * the survivors gets the extra attacks without paying the dispersion price.
 *
 * @returns {number} at least 1, never more than `maxAttacksPerTerritory`
 */
export function attacksPerTerritoryFor(leaderType, traits) {
    const tuning = attackDiscipline;
    //Both halves of "will this leader push on": the appetite for risk and the appetite for
    //ground. A leader has to have both to press a territory three times in one turn.
    const risk = finiteOr(traits?.risk_taking, 0.5);
    const expansion = finiteOr(traits?.territory_expansion, 0.5);
    const bonus = ((risk + expansion) / 2) * tuning.attacksPerTerritorySwing;
    return clampInt(
        Math.round(tuning.baseAttacksPerTerritory + bonus),
        1, tuning.maxAttacksPerTerritory);
}

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

function clamp01(value) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function clampInt(value, low, high) {
    if (!Number.isFinite(value)) {
        return low;
    }
    return Math.max(low, Math.min(high, Math.round(value)));
}
