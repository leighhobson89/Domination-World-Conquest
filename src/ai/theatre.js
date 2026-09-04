// The MID-TERM goal: which neighbour a country is currently trying to absorb, and when it
// admits that is not working and goes somewhere else.
//
// The AI had a long term (`victory.js` -- the continents it must hold to win) and a short
// term (`goals.js` -- what it will attempt this turn). What it did not have is the horizon a
// person actually plays on: "I am taking Belgium. If Belgium turns out to be a wall I will
// take Denmark instead, and come back to Belgium when I have an army worth the trip."
//
// Without that middle, a country spreads its one attack a turn across every border it can
// reach. It takes the free territories in the first ten turns and then grinds against
// defended ones forever, because each turn it re-derives the same odds against the same
// neighbours and makes the same decision. Measured over a hundred turns before this module
// existed: 204 countries at turn 1, 163 at turn 100 -- and the largest empire in the world
// went from 31 territories to 30. Nothing was being absorbed by anybody.
//
// A THEATRE is one committed rival plus the continent the war is being fought on. Three
// properties make it a plan rather than a preference:
//
//   IT IS STICKY.   Re-chosen every turn it would be no better than having none; a country
//                   commits and stays committed while it is making ground.
//   IT IS JUDGED.   The ledger records what the country held when it committed and what it
//                   holds now. Gains mean it is working. No gains for `stallTurns`, or
//                   `failuresBeforeWall` lost attacks, mean it is not.
//   IT IS DROPPED.  A rival that is not working is written off as a WALL and the country
//                   picks a different one -- which is the whole of "when it comes across a
//                   wall it finds another way to the same long-term goal". Walls decay,
//                   because "we could not break them in turn 12" stops being true once
//                   there is an army that can.
//
// The same ledger answers the ECONOMIC form of the same question. A country that has been
// developing for `developStallTurns` without its development materially improving has learned
// that building is not the way out of being small, and stops waiting to be ready.
//
// Pure with respect to the app: `config/`, `state/selectors.js`, `data/adjacency.js` and one
// leaf sibling. It runs in Node -- adjacency is not loaded there, so the frontier is an
// injectable dependency and defaults to the real one only when it is available.

import { postureThresholds, theatreCommitment } from "../config/balance.js";
import { getInteractableFrom, isAdjacencyLoaded } from "../data/adjacency.js";
import { getTerritoryByName, territoriesOwnedByCountry } from "../state/selectors.js";
import { territoryValue } from "./value.js";

/**
 * country -> {
 *   rival, continent, chosenOnTurn,
 *   takenFromRival,     territories taken from THIS rival since committing -- the measure of
 *                       whether the mid-term goal is working, and the only one that matters:
 *                       ground taken from somebody else is not progress against this war
 *   lastGainTurn,       the last turn it took one
 *   failures            attacks lost against the rival since committing
 * }
 */
const theatres = new Map();

/** country -> Map(rivalCountry -> turn it was written off). Decays; see `wallMemoryTurns`. */
const walls = new Map();

/** country -> { since, developmentAtStart } -- the economic half of the same ledger. */
const developWatch = new Map();

/** Wipe every mid-term goal. New Game and the unit tests call this. */
export function resetTheatres() {
    theatres.clear();
    walls.clear();
    developWatch.clear();
}

export function captureTheatres() {
    return {
        theatres: Object.fromEntries([...theatres].map(([country, theatre]) => [country, { ...theatre }])),
        walls: Object.fromEntries([...walls].map(([country, byRival]) => [country, Object.fromEntries(byRival)])),
        developWatch: Object.fromEntries([...developWatch].map(([country, watch]) => [country, { ...watch }]))
    };
}

export function restoreTheatres(data) {
    resetTheatres();
    for (const [country, theatre] of Object.entries(data?.theatres ?? {})) {
        if (theatre?.rival) {
            theatres.set(country, { ...theatre });
        }
    }
    for (const [country, byRival] of Object.entries(data?.walls ?? {})) {
        walls.set(country, new Map(Object.entries(byRival ?? {})));
    }
    for (const [country, watch] of Object.entries(data?.developWatch ?? {})) {
        developWatch.set(country, { ...watch });
    }
}

/** The theatre this country has committed to, or null. Read-only. */
export function currentTheatre(country) {
    const theatre = theatres.get(country);
    return theatre ? { ...theatre } : null;
}

/** Is this rival currently written off by this country? */
export function isWall(country, rival, turn = 0) {
    const writtenOffOn = walls.get(country)?.get(rival);
    if (writtenOffOn === undefined) {
        return false;
    }
    if (turn - writtenOffOn > theatreCommitment.wallMemoryTurns) {
        walls.get(country).delete(rival);
        return false;
    }
    return true;
}

/** Every rival this country is currently refusing to attack, for the debug panel. */
export function wallsFor(country, turn = 0) {
    const byRival = walls.get(country);
    if (!byRival) {
        return [];
    }
    return [...byRival.keys()].filter(rival => isWall(country, rival, turn));
}

function recordWall(country, rival, turn) {
    if (!rival) {
        return;
    }
    if (!walls.has(country)) {
        walls.set(country, new Map());
    }
    walls.get(country).set(rival, turn);
}

/**
 * Who this country can actually reach, grouped by the country that holds it.
 *
 * One entry per rival country, because the mid-term goal is a COUNTRY -- "absorb Belgium" --
 * and a decision about a country cannot be made from a list of territories.
 *
 * @param {string} country
 * @param {{interactableFrom?: (uniqueId: string, territoryName: string) => string[]}} [deps]
 *        injected so this runs in Node, where the adjacency data is not loaded.
 * @returns {Map<string, {rival: string, territories: string[], frontage: number, value: number,
 *                        theirArmy: number, ourArmy: number, continents: Map<string, number>}>}
 */
export function frontierFor(country, deps = {}) {
    const reach = deps.interactableFrom ??
        (isAdjacencyLoaded() ? getInteractableFrom : () => []);
    const byRival = new Map();
    const owned = territoriesOwnedByCountry(country);

    for (const source of owned) {
        const ourArmy = Number(source.armyForCurrentTerritory) || 0;
        for (const neighbourName of reach(source.uniqueId, source.territoryName)) {
            const neighbour = getTerritoryByName(neighbourName);
            if (!neighbour || neighbour.dataName === country) {
                continue;
            }
            const rival = neighbour.dataName;
            if (!byRival.has(rival)) {
                byRival.set(rival, {
                    rival,
                    territories: [],
                    frontage: 0,
                    value: 0,
                    theirArmy: 0,
                    ourArmy: 0,
                    continents: new Map()
                });
            }
            const entry = byRival.get(rival);
            //`frontage` counts PAIRINGS -- how much of our border this rival occupies --
            //while `territories` is the distinct list, so a rival we can reach from four of
            //our territories reads as a bigger war than one we can touch at a single point.
            entry.frontage += 1;
            entry.ourArmy += ourArmy;
            if (!entry.territories.includes(neighbourName)) {
                entry.territories.push(neighbourName);
                entry.value += territoryValue(neighbour);
                entry.theirArmy += Number(neighbour.armyForCurrentTerritory) || 0;
                const continent = neighbour.continent ?? "Unknown";
                entry.continents.set(continent, (entry.continents.get(continent) ?? 0) + 1);
            }
        }
    }

    return byRival;
}

/** Named by the goal, ordinary, or written off. See the sort at the end of `rankRivals()`. */
function tierOf(candidate) {
    if (candidate.walled) {
        return 2;
    }
    return candidate.preferred ? 0 : 1;
}

/**
 * Rank the reachable rivals by how good an absorption each would make.
 *
 * The terms are all in `theatreCommitment.weights` and each says what it means. `weakness`
 * carries the most because it is the term that decides whether this is a plan or a wish: a
 * neighbour whose border territories are held more thinly than ours can actually be taken,
 * and one whose are not cannot, however valuable it is.
 */
export function rankRivals(frontier, { focusContinent = null, country = "", turn = 0, rng = () => 0.5, sizeOf = null, preferredRivals = [] } = {}) {
    const weights = theatreCommitment.weights;
    const rivals = [...frontier.values()];
    const widestFrontage = Math.max(1, ...rivals.map(entry => entry.frontage));
    //`territoriesOwnedByCountry()` is a scan of all 359 territories, and this would run it
    //once per candidate per country per turn. `planCampaign()` already has every country's
    //size from `worldStandings()`, computed in ONE pass over the map, so it passes it in;
    //the scan is the fallback for a caller that has no standings to hand.
    const sizeOfCountry = sizeOf ?? ((name) => territoriesOwnedByCountry(name).length);

    return rivals
        .map(entry => {
            const size = sizeOfCountry(entry.rival);
            //A ratio rather than a difference: "their border is half the weight of ours" is
            //the same military fact whether the armies are hundreds or millions.
            const weakness = entry.ourArmy <= 0
                ? 0
                : Math.max(0, Math.min(1, 1 - entry.theirArmy / (entry.ourArmy + entry.theirArmy)));

            const onFocus = focusContinent && entry.continents.has(focusContinent) ? 1 : 0;
            const sizePenalty = Math.min(1, size / weights.sizeScale);

            //The GOAL's own opinion about who the enemy is. Under Great Powers this is the
            //powers still to be broken; empty under every other goal, which costs nothing.
            //It is a TIER rather than a term in the score, and that is the whole reason it
            //works: a great power is by definition one of the strongest countries on the
            //map, so it scores near zero on `weakness` -- the term carrying the most weight
            //here -- and no bonus small enough to be a bias would ever lift it above a
            //convenient small neighbour, while one large enough to lift it would also lift
            //a hopeless rival that the goal did not name. Under Great Powers the strongest
            //neighbour IS the objective, and the ranking's job is to choose between the
            //powers rather than to talk the country out of fighting one.
            const preferred = preferredRivals.includes(entry.rival);

            const score =
                (entry.frontage / widestFrontage) * weights.frontage +
                weakness * weights.weakness +
                Math.min(1, entry.value / Math.max(1, entry.territories.length)) * weights.value +
                onFocus * weights.onFocusContinent -
                sizePenalty * weights.size +
                rng() * 0.2;

            return {
                ...entry,
                size,
                weakness,
                onFocusContinent: Boolean(onFocus),
                preferred,
                walled: isWall(country, entry.rival, turn),
                score
            };
        })
        //Three tiers, and the score decides only WITHIN one.
        //
        //A rival already written off is ranked last rather than removed: if every neighbour
        //is a wall the country still has to point at one, and pointing at the least bad of
        //them is better than having no mid-term goal at all. A rival the goal NAMES is
        //ranked first, for the reason given above -- but a walled one is still walled, so a
        //country that has thrown itself at a great power and failed goes elsewhere for a
        //while rather than grinding against it forever. That escape is the safety valve
        //that makes the top tier safe to have at all.
        .sort((a, b) => tierOf(a) - tierOf(b) || b.score - a.score ||
            a.rival.localeCompare(b.rival));
}

/**
 * Choose, keep, or abandon this country's mid-term goal, and say why.
 *
 * Called once per country per turn, from `planCampaign()`.
 *
 * @param {{country: string, turn: number, focusContinent?: string|null, frontier?: Map,
 *          sizeOf?: (country: string) => number, rng?: () => number,
 *          preferredRivals?: string[]}} input
 * @returns {{rival: string|null, continent: string|null, reason: string, committedOnTurn: number,
 *            takenFromRival: number, failures: number, turnsCommitted: number, changed: boolean,
 *            candidates: Array}}
 */
export function reviewTheatre(input) {
    const country = input?.country;
    const turn = Number(input?.turn) || 0;
    const rng = typeof input?.rng === "function" ? input.rng : () => 0.5;
    const frontier = input?.frontier ?? frontierFor(country);

    const sizeOf = typeof input?.sizeOf === "function" ? input.sizeOf : null;
    const rank = () => rankRivals(frontier, {
        focusContinent: input?.focusContinent ?? null,
        country,
        turn,
        rng,
        sizeOf,
        preferredRivals: input?.preferredRivals ?? []
    });

    const standing = theatres.get(country);
    const verdict = standing
        ? judgeTheatre(standing, frontier, turn, sizeOf)
        : { keep: false, reason: "no mid-term goal yet" };

    if (standing && verdict.keep) {
        return describe(standing, turn, verdict.reason, rank(), false);
    }

    //A theatre being abandoned because it stalled is what a WALL is. One abandoned because
    //the rival no longer exists, or because the border has moved away from them, is not --
    //there is nothing there to write off, and writing it off would stop the country going
    //back when the border returns.
    //
    //This has to happen BEFORE the candidates are ranked, or the country writes a rival off
    //and then immediately re-picks it off a ranking taken a moment too early -- which is a
    //country that has learned nothing, dressed up as one that has.
    if (standing && verdict.wall) {
        recordWall(country, standing.rival, turn);
    }

    const candidates = rank();

    const chosen = candidates[0] ?? null;
    if (!chosen) {
        theatres.delete(country);
        return {
            rival: null, continent: null, reason: "nothing reachable to campaign against",
            committedOnTurn: turn, takenFromRival: 0, failures: 0, turnsCommitted: 0,
            changed: Boolean(standing), candidates
        };
    }

    const continent = mostCommonContinent(chosen.continents);
    const fresh = {
        rival: chosen.rival,
        continent,
        chosenOnTurn: turn,
        takenFromRival: 0,
        lastGainTurn: turn,
        failures: 0
    };
    theatres.set(country, fresh);

    const reason = standing
        ? "switched from " + standing.rival + " to " + chosen.rival + " -- " + verdict.reason
        : "committed to absorbing " + chosen.rival;
    return describe(fresh, turn, reason, candidates, true);
}

/**
 * Is the standing theatre still worth pursuing?
 *
 * The order is the priority. A rival that has been eliminated or is no longer on our border
 * is not a decision, it is a fact. Progress beats the clock -- a country taking ground is
 * never made to re-plan. Then the two ways of failing: the clock, and the casualties.
 */
function judgeTheatre(theatre, frontier, turn, sizeOf = null) {
    const tuning = theatreCommitment;
    const sizeOfCountry = sizeOf ?? ((name) => territoriesOwnedByCountry(name).length);

    if (!frontier.has(theatre.rival)) {
        return { keep: false, wall: false, reason: "no longer share a border with " + theatre.rival };
    }
    if (sizeOfCountry(theatre.rival) === 0) {
        return { keep: false, wall: false, reason: theatre.rival + " no longer exists" };
    }

    //Losing attacks makes a wall whatever the clock says. It is the one signal that is about
    //the enemy rather than about time.
    if (theatre.failures >= tuning.failuresBeforeWall) {
        return { keep: false, wall: true, reason: theatre.failures + " attacks lost against " +
            theatre.rival + " -- it is a wall, try somewhere else" };
    }

    //The two deadlines are different because the two situations are. A war that has never
    //produced anything is given `reviewInterval` turns to start; one that HAS is given
    //`stallTurns` from its last gain to produce the next. A new plan deserves longer to get
    //going than a stalled one deserves to restart, and running both off one clock made the
    //longer of the two unreachable.
    if (theatre.takenFromRival === 0) {
        const turnsCommitted = turn - theatre.chosenOnTurn;
        if (turnsCommitted < tuning.reviewInterval) {
            return { keep: true, reason: "committed to " + theatre.rival + " since turn " +
                theatre.chosenOnTurn + ", nothing taken yet" };
        }
        return { keep: false, wall: true, reason: turnsCommitted +
            " turns without taking anything from " + theatre.rival };
    }

    const turnsSinceGain = turn - (theatre.lastGainTurn ?? theatre.chosenOnTurn);
    if (turnsSinceGain < tuning.stallTurns) {
        return { keep: true, reason: "taking ground from " + theatre.rival +
            " -- " + theatre.takenFromRival + " territory(ies) so far" };
    }
    return { keep: false, wall: true, reason: turnsSinceGain +
        " turns without taking anything from " + theatre.rival };
}

/**
 * Tell the ledger how an attempt against the mid-term rival went.
 *
 * Called by the executor for every attack it resolves, win or lose. A win is what "the
 * approach is working" MEANS, and it is the only thing that resets the stall clock; a loss
 * is what eventually makes a wall.
 */
export function noteAttemptOutcome(country, targetOwner, won, turn) {
    const theatre = theatres.get(country);
    if (!theatre || !targetOwner || theatre.rival !== targetOwner) {
        return;
    }
    if (won) {
        theatre.takenFromRival += 1;
        theatre.lastGainTurn = Number(turn) || theatre.lastGainTurn;
        //Success clears the record of failure. Three losses followed by a win is a country
        //that has just worked out how to fight this war, not one that should give up.
        theatre.failures = 0;
        return;
    }
    theatre.failures += 1;
}

/**
 * How much a target is worth to this country's mid-term goal.
 *
 * This is what concentrates a war. Two territories of equal worth and equal odds are not
 * equally useful: the one belonging to the country we have committed to absorbing takes us a
 * step towards owning a whole neighbour, and the one belonging to a rival we have already
 * failed against three times does not.
 */
export function theatreWeightFor(country, targetOwner, turn = 0) {
    if (!country || !targetOwner) {
        return 1;
    }
    const theatre = theatres.get(country);
    if (theatre && theatre.rival === targetOwner) {
        return theatreCommitment.rivalWeight;
    }
    if (isWall(country, targetOwner, turn)) {
        return theatreCommitment.wallWeight;
    }
    return 1;
}

/**
 * Watch whether DEVELOPing is getting this country anywhere, and say when it is not.
 *
 * The economic form of the same judgement the theatre makes about a war. A country whose
 * income cannot buy the next upgrade -- besieged, tiny, or sat on poor ground -- would
 * otherwise develop for the rest of the game, because the posture that produced the failure
 * is the posture the failure keeps it in.
 *
 * @returns {{turnsDeveloping: number, stalled: boolean, gained: number}}
 */
export function noteDevelopment(country, development, turn, posture) {
    const now = Number(development) || 0;

    //Only DEVELOP turns count. A country that spent six turns fighting has not been
    //"failing to develop"; it has been doing something else.
    if (posture !== "DEVELOP") {
        developWatch.delete(country);
        return { turnsDeveloping: 0, stalled: false, gained: 0 };
    }

    const watch = developWatch.get(country) ?? { since: turn, developmentAtStart: now };
    if (!developWatch.has(country)) {
        developWatch.set(country, watch);
    }

    const turnsDeveloping = Math.max(0, turn - watch.since);
    const gained = now - watch.developmentAtStart;
    const expected = turnsDeveloping * postureThresholds.developProgressPerTurn;
    const stalled = turnsDeveloping >= postureThresholds.developStallTurns && gained < expected;

    if (stalled) {
        //Reset the clock as the verdict is delivered, so a country that is let off the leash
        //this turn is judged afresh from here rather than being permanently marked as stalled.
        developWatch.set(country, { since: turn, developmentAtStart: now });
    }
    return { turnsDeveloping, stalled, gained: Number(gained.toFixed(4)) };
}

function describe(theatre, turn, reason, candidates, changed) {
    return {
        rival: theatre.rival,
        continent: theatre.continent,
        reason,
        committedOnTurn: theatre.chosenOnTurn,
        takenFromRival: theatre.takenFromRival,
        failures: theatre.failures,
        turnsCommitted: turn - theatre.chosenOnTurn,
        changed,
        candidates: candidates.slice(0, 5).map(candidate => ({
            rival: candidate.rival,
            score: Number(candidate.score.toFixed(3)),
            frontage: candidate.frontage,
            weakness: Number(candidate.weakness.toFixed(3)),
            size: candidate.size,
            walled: candidate.walled
        }))
    };
}

function mostCommonContinent(continents) {
    let best = null;
    let most = 0;
    for (const [continent, count] of continents ?? []) {
        if (count > most) {
            most = count;
            best = continent;
        }
    }
    return best;
}
