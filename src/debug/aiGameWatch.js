// The two calls the AI turn loop makes while the world is playing itself.
//
// `gameTurnsLoop.js` brackets each country's slot with these: `beginAiGameCountry()`
// before it plans, `endAiGameCountry()` once it has acted. Everything else in this
// feature hangs off those two lines, which is deliberate -- a spectator mode that
// needed hooks scattered through the AI would be a spectator mode that goes stale
// the first time the AI changes.
//
// Both are no-ops with a single boolean test when the mode is off, so an ordinary
// game pays nothing for them. That matters: this runs 206 times a turn.
//
// The wait is here rather than in the loop for the same reason: the loop should say
// "this country has finished" and not know that finishing means a second and a half
// of somebody watching.

import { activityForTurn } from "../state/activityLog.js";
import { currentTurn } from "../state/selectors.js";
import { awaitCountryPacing, isAiGameActive } from "./aiGameMode.js";
import { recordAiGameBlock } from "./aiGameLog.js";
import { buildCountryReport, diffHoldings, snapshotHoldings } from "./aiGameReport.js";

/** The country currently being watched, and what it held when its slot opened. */
let watching = null;

/**
 * A country is about to take its turn.
 *
 * Two things are captured, and both have to be taken BEFORE the campaign is planned:
 * the country's holdings, because the economy report is the difference across them,
 * and how much of this turn's activity log already existed, because everything
 * appended from here until the country is done is what it did.
 */
export function beginAiGameCountry(country) {
    if (!isAiGameActive()) {
        watching = null;
        return;
    }
    watching = {
        country: country,
        turn: currentTurn(),
        holdings: snapshotHoldings(country),
        activityMark: activityForTurn(currentTurn()).length
    };
}

/**
 * A country has finished acting: write its block, then hold the screen on it.
 *
 * @param {object} view
 * @param {string} view.country
 * @param {object} [view.leader]
 * @param {object} [view.campaign]
 * @param {object} [view.plan]       as returned by `logAiPlan()`
 * @param {object} [view.turnGains]  this country's row of `turnGainsArrayAi`
 * @param {string} [view.note]       said instead of a report -- "took no turn"
 */
export async function endAiGameCountry(view) {
    if (!isAiGameActive()) {
        watching = null;
        return;
    }

    const country = view?.country ?? watching?.country ?? "unknown";
    const turn = watching?.turn ?? currentTurn();
    const after = snapshotHoldings(country);

    recordAiGameBlock(
        buildCountryReport({
            country: country,
            turn: turn,
            leader: view?.leader ?? null,
            campaign: view?.campaign ?? null,
            plan: view?.plan ?? null,
            note: view?.note ?? "",
            // Without a `beginAiGameCountry()` the diff would compare a snapshot against
            // itself and read as a country that did nothing, which is worse than saying
            // nothing at all -- so the economy lines are dropped instead.
            delta: watching ? diffHoldings(watching.holdings, after) : null,
            turnGains: view?.turnGains ?? null,
            entries: watching
                ? activityForTurn(turn).slice(watching.activityMark)
                : [],
            territoriesHeld: after.size
        })
    );

    watching = null;
    await awaitCountryPacing();
}
