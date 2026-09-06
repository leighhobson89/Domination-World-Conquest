// What a finished game says about itself.
//
// The last item under "Missing" in the register: the game decided itself correctly and emitted
// `GAME_OVER` exactly once, and the only listener was a `console.log`. A player who won a game
// was left sitting on a map with nothing to tell them so.
//
// This is the wording, and it is a PURE FUNCTION of the result plus a standings snapshot --
// the same arrangement `goalCatalogue.js` has with `GoalSelect.js` and `topics.js` has with
// `Dominapedia.js`. Three reasons it is worth the extra file rather than being inlined into
// the component:
//
//   * **It is unit-testable in Node.** An ending is by definition the state hardest to reach
//     by clicking -- it needs a whole game played to a conclusion -- so a spec that had to
//     drive the real UI to see one would be the slowest and least reliable test in the suite.
//     `tests/unit/ui-game-over.spec.js` covers every outcome in about a millisecond.
//   * **The five goals end five different ways.** A Timed Game that reaches its turn limit is
//     not a Domination that reached its land share, and saying "You have won" to both wastes
//     the one screen the whole game builds to. The condition kind is read HERE, once.
//   * **A defeat is a different sentence from somebody else's victory.** Being eliminated and
//     watching a rival complete their objective are both `outcome: "DEFEAT"`, and telling a
//     player they were "driven from the map" when they still held forty territories would be
//     the sort of wrong that is worse than saying nothing.
//
// The vocabulary is the same block shape the rest of the UI data uses -- `p`, `h`, `ul` -- so
// the component has no opinion about the content and adding a sixth goal changes nothing here
// but a label.

import { VictoryCondition } from "../../ai/victory.js";

/** A paragraph. */
const p = (text) => ({ kind: "p", text });
/** A sub-heading. */
const h = (text) => ({ kind: "h", text });

/**
 * Human name for a victory condition, for the line that says what was being played for.
 *
 * ELIMINATION is here even though it is not a goal and `goalCatalogue.js` deliberately omits
 * it: it is what LOSING means, it runs underneath every goal, and no chooser offers it. It is
 * named anyway because this map is keyed on `VictoryCondition` and a kind that fell through to
 * "Unknown Goal" would be a screen telling a player, at the one moment the game has their full
 * attention, that it does not know what they were playing. A unit test walks the whole enum
 * for exactly that reason.
 */
const CONDITION_NAMES = Object.freeze({
    [VictoryCondition.CONQUEST]: "World Conquest",
    [VictoryCondition.CONTINENTAL]: "Continental Supremacy",
    [VictoryCondition.DOMINATION]: "Domination",
    [VictoryCondition.ELIMINATION]: "Survival",
    [VictoryCondition.GREAT_POWERS]: "Great Powers",
    [VictoryCondition.TURN_LIMIT]: "Timed Game"
});

export function conditionName(kind) {
    return CONDITION_NAMES[kind] ?? "Unknown Goal";
}

/**
 * What the condition asked for, in one clause, so the ending can say what was achieved.
 *
 * Reads the same field per kind that `conditionFor()` writes, and nothing else -- the one
 * mistake that would be silent here is naming the wrong field and quoting a number from a
 * different goal, which would read as perfectly plausible.
 */
export function conditionDemand(condition) {
    if (!condition) {
        return "";
    }
    switch (condition.kind) {
        case VictoryCondition.CONQUEST:
            return "every territory on the map";
        case VictoryCondition.CONTINENTAL:
            return (condition.continentsRequired ?? 0) + " continents held whole";
        case VictoryCondition.DOMINATION:
            return Math.round((condition.landShare ?? 0) * 100) + "% of the world's land";
        case VictoryCondition.GREAT_POWERS:
            return (condition.greatPowersRequired ?? 0) + " great powers broken";
        case VictoryCondition.TURN_LIMIT:
            return "the largest empire by turn " + (condition.turnLimit ?? 0);
        case VictoryCondition.ELIMINATION:
            //Not a goal and never chosen; it has no demand to state. See CONDITION_NAMES.
            return "staying on the map";
        default:
            return "";
    }
}

/**
 * The final table: who held what when it ended.
 *
 * Territories first and area second, because territories are what four of the five goals are
 * counted in. `worldTerritories` comes from the standings rather than being summed here, so a
 * country holding nothing cannot quietly change the denominator.
 *
 * @param {object} standings  a `worldStandings()` snapshot
 * @param {number} limit
 * @returns {{country: string, territories: number, share: number}[]}
 */
export function finalStandings(standings, limit = 8) {
    const world = Number(standings?.worldTerritories) || 0;
    const rows = [...(standings?.byCountry ?? new Map()).entries()]
        .map(([country, entry]) => ({
            country,
            territories: Number(entry?.territories) || 0,
            area: Number(entry?.area) || 0,
            share: world === 0 ? 0 : (Number(entry?.territories) || 0) / world
        }))
        //Name is the tie-break, so two countries on the same holding are ordered the same way
        //every time rather than by whatever order the map walk happened to produce.
        .sort((a, b) => b.territories - a.territories ||
            b.area - a.area ||
            a.country.localeCompare(b.country));
    return rows.slice(0, Math.max(0, limit));
}

/**
 * The whole ending, as data.
 *
 * @param {{outcome: string, winner: string|null, reason: string, turn: number,
 *          condition: object}} result   the `GAME_OVER` payload, verbatim
 * @param {{standings?: object, playerCountry?: string|null}} [context]
 * @returns {{tone: "victory"|"defeat"|"decided", title: string, subtitle: string,
 *           body: object[], standings: object[], playedFor: string}}
 */
export function describeEnding(result, context = {}) {
    const { standings = null, playerCountry = null } = context;
    const condition = result?.condition ?? null;
    const goal = conditionName(condition?.kind);
    const demand = conditionDemand(condition);
    const turn = Number(result?.turn) || 0;
    const winner = result?.winner ?? null;
    const table = finalStandings(standings);
    const leader = table[0] ?? null;

    const playedFor = demand ? goal + " — " + demand : goal;

    if (result?.outcome === "VICTORY") {
        return {
            tone: "victory",
            title: "Victory",
            subtitle: (playerCountry ?? winner ?? "You") + " has won on turn " + turn + ".",
            playedFor,
            standings: table,
            body: [
                h("What you achieved"),
                p("You completed " + goal + ": " + demand + "."),
                p(leader
                    ? "You finished holding " + leader.territories + " of the world's " +
                      (standings?.worldTerritories ?? 0) + " territories, " +
                      Math.round(leader.share * 100) + "% of the map."
                    : "The map is yours."),
            ]
        };
    }

    //ELIMINATION and a rival's victory are both DEFEAT, and they are not the same sentence.
    //Telling a player they were driven from the map while they still held forty territories
    //would be worse than saying nothing at all.
    if (result?.outcome === "DEFEAT" && result?.reason === "ELIMINATED") {
        return {
            tone: "defeat",
            title: "Defeat",
            subtitle: "You were driven from the map on turn " + turn + ".",
            playedFor,
            standings: table,
            body: [
                h("What happened"),
                p("Your last territory was taken. A country that holds nothing cannot win " +
                    "anything, whatever else is true of the world, so the game ends here " +
                    "rather than running on without you."),
                p(leader
                    ? leader.country + " leads what is left, with " + leader.territories +
                      " territories."
                    : "")
            ].filter(block => block.text !== "")
        };
    }

    if (result?.outcome === "DEFEAT") {
        const beatenByClock = result?.reason === "TURN_LIMIT";
        return {
            tone: "defeat",
            title: "Defeat",
            subtitle: (winner ?? "Another country") + " won on turn " + turn + ".",
            playedFor,
            standings: table,
            body: [
                h("What happened"),
                p(beatenByClock
                    ? "The clock ran out and " + (winner ?? "another country") +
                      " held the largest empire when it did."
                    : (winner ?? "Another country") + " completed " + goal + " first: " +
                      demand + "."),
                p(playerCountry && standings?.byCountry?.get(playerCountry)
                    ? "You finished with " +
                      standings.byCountry.get(playerCountry).territories + " territories."
                    : "")
            ].filter(block => block.text !== "")
        };
    }

    //DECIDED: a spectated game, which has no player to have won or lost it.
    return {
        tone: "decided",
        title: "The Game Is Decided",
        subtitle: (winner ?? "Nobody") + " won on turn " + turn + ".",
        playedFor,
        standings: table,
        body: [
            h("What happened"),
            p((winner ?? "Nobody") + " completed " + goal + ": " + demand + "."),
        ]
    };
}
