// Turning one AI country's turn into the block the spectator console prints.
//
// The AI already produces everything needed here; what it does not do is put the
// four halves of a turn next to each other. The plan is in `src/ai/goalHorizons.js`,
// the campaign carries the reasoning, the economy is a set of numbers on the
// territories themselves, and the fighting is in `state/activityLog.js`. Watching
// the AI means reading all four for one country, in order, and then the same for the
// next -- which is what this file assembles.
//
// Two decisions shape it.
//
// **The economy is measured, not reported.** Nothing in the AI says "I built two
// farms": `analyzeAllocatedResourcesAndPrioritizeUpgradesThenBuild()` spends what it
// has and returns a boolean. So the country's holdings are snapshotted before it acts
// and again afterwards, and the difference IS the report. That has the useful property
// of being true by construction -- a build path added later shows up here with no
// change to this file.
//
// **The measurement is confined to the territories held BEFORE the turn.** A country
// that conquers a province acquires its gold, its farms and its garrison, and counting
// those would read as "built 3 farms, recruited 2.1k infantry" on a turn it built
// nothing at all. Conquests are reported on their own line, from the activity log,
// where they belong.
//
// Pure apart from one read of the store, which is the same latitude `src/ai/` has: no
// DOM and no `ui.js`. The two functions that touch the world are separate from the one
// that does the wording, so the wording can be unit-tested against fixtures.

import { allTerritories } from "../state/selectors.js";
import { ActivityKind } from "../state/activityLog.js";
import { AiGameTone } from "./aiGameLog.js";

/** The fields worth watching. Each is compared per territory, then summed. */
const TRACKED = Object.freeze([
    "goldForCurrentTerritory",
    "oilForCurrentTerritory",
    "consMatsForCurrentTerritory",
    "foodForCurrentTerritory",
    "armyForCurrentTerritory",
    "infantryForCurrentTerritory",
    "assaultForCurrentTerritory",
    "airForCurrentTerritory",
    "navalForCurrentTerritory",
    "farmsBuilt",
    "oilWellsBuilt",
    "forestsBuilt",
    "fortsBuilt"
]);

/**
 * What one country holds right now, per territory.
 *
 * Keyed by `uniqueId` rather than summed, because the diff has to ignore territories
 * the country did not hold at the start -- see the note at the top of the file.
 *
 * @param {string} country  a `dataName`
 * @returns {Map<string, object>}
 */
export function snapshotHoldings(country) {
    const holdings = new Map();
    for (const territory of allTerritories()) {
        if (territory.dataName !== country) continue;
        const row = {};
        for (const field of TRACKED) {
            row[field] = Number(territory[field]) || 0;
        }
        holdings.set(territory.uniqueId, row);
    }
    return holdings;
}

/**
 * Field-by-field change across the territories present in BOTH snapshots.
 *
 * @param {Map<string, object>} before
 * @param {Map<string, object>} after
 * @returns {object} one signed total per tracked field
 */
export function diffHoldings(before, after) {
    const delta = {};
    for (const field of TRACKED) delta[field] = 0;

    for (const [uniqueId, was] of before ?? new Map()) {
        const now = after?.get(uniqueId);
        // Absent means the territory changed hands mid-turn. Nothing sensible can be
        // said about its economy, and the loss is reported from the activity log.
        if (!now) continue;
        for (const field of TRACKED) {
            delta[field] += now[field] - was[field];
        }
    }
    return delta;
}

// --- wording ---------------------------------------------------------------

/** 1234 -> "1.2k". Local rather than imported: `formatNumbersToKMB` lives in ui.js. */
function short(value) {
    const n = Math.round(Number(value) || 0);
    const sign = n < 0 ? "-" : "";
    const size = Math.abs(n);
    if (size >= 1000000) return sign + (size / 1000000).toFixed(1) + "m";
    if (size >= 1000) return sign + (size / 1000).toFixed(1) + "k";
    return sign + String(size);
}

/** "+1.2k" / "-340", and the empty string when nothing moved. */
function signed(value) {
    const n = Math.round(Number(value) || 0);
    if (n === 0) return "";
    return (n > 0 ? "+" : "") + short(n);
}

function joinParts(parts) {
    return parts.filter(Boolean).join(", ");
}

function plural(count, noun) {
    return count + " " + noun + (count === 1 ? "" : "s");
}

/** The economy: what the turn granted, and what the country did with it. */
function economyLines(delta, turnGains) {
    const lines = [];

    if (turnGains) {
        const income = joinParts([
            labelled(turnGains.changeGold, "gold"),
            labelled(turnGains.changeOil, "oil"),
            labelled(turnGains.changeConsMats, "cons.mats"),
            labelled(turnGains.changeFood, "food"),
            labelled(turnGains.changePop, "pop")
        ]);
        if (income) {
            lines.push({ label: "Income", text: income, tone: AiGameTone.ECONOMY });
        }
    }

    const built = joinParts([
        delta.farmsBuilt > 0 && plural(delta.farmsBuilt, "farm"),
        delta.forestsBuilt > 0 && plural(delta.forestsBuilt, "forest"),
        delta.oilWellsBuilt > 0 && plural(delta.oilWellsBuilt, "oil well"),
        delta.fortsBuilt > 0 && plural(delta.fortsBuilt, "fort")
    ]);

    const recruited = joinParts([
        delta.infantryForCurrentTerritory > 0 &&
            short(delta.infantryForCurrentTerritory) + " infantry",
        delta.assaultForCurrentTerritory > 0 &&
            short(delta.assaultForCurrentTerritory) + " assault",
        delta.airForCurrentTerritory > 0 && short(delta.airForCurrentTerritory) + " air",
        delta.navalForCurrentTerritory > 0 && short(delta.navalForCurrentTerritory) + " naval"
    ]);

    // A NEGATIVE delta over territories it still holds is what it spent. A positive one
    // would mean it saved more than it earned, which the income line above already says.
    const spending = joinParts([
        delta.goldForCurrentTerritory < 0 && short(-delta.goldForCurrentTerritory) + " gold",
        delta.consMatsForCurrentTerritory < 0 &&
            short(-delta.consMatsForCurrentTerritory) + " cons.mats"
    ]);

    const summary = joinParts([
        built && "built " + built,
        recruited && "recruited " + recruited,
        spending && "spending " + spending
    ]);

    lines.push({
        label: "Economy",
        text: summary || "built nothing and recruited nothing",
        tone: AiGameTone.ECONOMY
    });

    // The other half of the war story, and the activity log cannot say it: a failed
    // attack records that it failed, never what it cost to fail.
    if (delta.armyForCurrentTerritory < 0) {
        lines.push({
            label: "Army out",
            text: short(-delta.armyForCurrentTerritory) +
                " left its held territories (marched out, sent to battle, or fell)",
            tone: AiGameTone.LOSS
        });
    }

    return lines;
}

function labelled(value, noun) {
    const text = signed(value);
    return text ? text + " " + noun : "";
}

/**
 * The fighting, from the activity entries written while this country was acting.
 *
 * The entries are already the game's own record of what happened, so this only has to
 * pick the ones this country is a party to and give each a tone from that country's
 * point of view -- which is not the feed's point of view, because the feed is written
 * for the player and there is no player here.
 */
export function warLines(entries, country) {
    const lines = [];
    for (const entry of entries ?? []) {
        const isAttacker = entry.attacker === country;
        if (!isAttacker && entry.defender !== country) continue;

        switch (entry.kind) {
            case ActivityKind.CONQUEST:
                lines.push({
                    label: isAttacker ? "Conquest" : "Lost",
                    text: isAttacker
                        ? `took ${from(entry)}`
                        : `lost ${entry.territory} to ${entry.attacker}`,
                    tone: isAttacker ? AiGameTone.VICTORY : AiGameTone.LOSS
                });
                break;
            case ActivityKind.ATTACK_FAILED:
                lines.push({
                    label: isAttacker ? "Repulsed" : "Held",
                    text: isAttacker
                        ? `attack on ${entry.territory} (${entry.defender}) failed`
                        : `held ${entry.territory} against ${entry.attacker}`,
                    tone: isAttacker ? AiGameTone.LOSS : AiGameTone.VICTORY
                });
                break;
            case ActivityKind.SIEGE_STARTED:
                lines.push({
                    label: "Siege",
                    text: isAttacker
                        ? `laid siege to ${entry.territory} (${entry.defender})`
                        : `${entry.attacker} laid siege to ${entry.territory}`,
                    tone: AiGameTone.SIEGE
                });
                break;
            case ActivityKind.SIEGE_WON:
                lines.push({
                    label: "Siege",
                    text: isAttacker
                        ? `stormed ${entry.territory} (${entry.defender}) and took it`
                        : `lost ${entry.territory} when ${entry.attacker} stormed it`,
                    tone: isAttacker ? AiGameTone.VICTORY : AiGameTone.LOSS
                });
                break;
            case ActivityKind.SIEGE_LOST:
                lines.push({
                    label: "Siege",
                    text: isAttacker
                        ? `stormed ${entry.territory} (${entry.defender}) and was thrown back`
                        : `threw back ${entry.attacker}'s assault on ${entry.territory}`,
                    tone: isAttacker ? AiGameTone.LOSS : AiGameTone.VICTORY
                });
                break;
            case ActivityKind.SIEGE_ABANDONED:
                lines.push({
                    label: "Siege",
                    text: isAttacker
                        ? `broke off the siege of ${entry.territory} (${entry.defender})`
                        : `${entry.attacker} broke off the siege of ${entry.territory}`,
                    tone: AiGameTone.SIEGE
                });
                break;
            case ActivityKind.SIEGE_LIFTED:
                lines.push({
                    label: "Siege",
                    text: isAttacker
                        ? `siege of ${entry.territory} lifted -- its troops were arrested`
                        : `arrested ${entry.attacker}'s besiegers at ${entry.territory}`,
                    tone: isAttacker ? AiGameTone.LOSS : AiGameTone.VICTORY
                });
                break;
            default:
                break;
        }
    }
    return lines;
}

/**
 * `"Barcelona from Spain"`, or just `"Eswatini"` when the two are the same word.
 *
 * A country and its only province share a name all over this map, and "took Eswatini
 * from Eswatini" reads as a bug even though it is the truth.
 */
function from(entry) {
    return entry.defender && entry.defender !== entry.territory
        ? `${entry.territory} from ${entry.defender}`
        : entry.territory;
}

/** What the country was thinking: objective, theatre, walls and budgets. */
function thoughtLines(plan, campaign) {
    const lines = [];
    const longTerm = plan?.longTerm ?? null;
    const mediumTerm = plan?.mediumTerm ?? null;

    if (longTerm?.objective) {
        const objective = longTerm.objective;
        const wants = objective.continents.join(", ") || "nothing in particular";
        const banked = objective.banked.length > 0 ? ` (holds ${objective.banked.join(", ")})` : "";
        const progress = longTerm.progress
            ? `, ${Math.round(longTerm.progress.fraction * 100)}% of the way there`
            : "";
        lines.push({
            label: "Objective",
            text: `${objective.kind} -- ${wants}${banked}${progress}`,
            tone: AiGameTone.THOUGHT
        });
    }

    if (mediumTerm?.focusContinent) {
        lines.push({
            label: "Pushing on",
            text: mediumTerm.focusContinent,
            tone: AiGameTone.THOUGHT
        });
    }

    // The mid-term goal, and it explains most of what a country does: which neighbour
    // it has committed to absorbing, and how that is going.
    const theatre = campaign?.theatre ?? null;
    if (theatre?.rival) {
        const progress = theatre.takenFromRival > 0
            ? `${theatre.takenFromRival} territory(ies) taken so far`
            : "nothing taken yet";
        const setbacks = theatre.failures > 0 ? `, ${theatre.failures} setback(s)` : "";
        const fresh = theatre.changed ? " -- newly chosen this turn" : "";
        lines.push({
            label: "Absorbing",
            text: `${theatre.rival} (${progress}${setbacks})${fresh}` +
                (theatre.reason ? ` -- ${theatre.reason}` : ""),
            tone: AiGameTone.THOUGHT
        });
    }

    if ((campaign?.walls ?? []).length > 0) {
        lines.push({
            label: "Written off",
            text: campaign.walls.join(", ") + " -- attacks there have stalled",
            tone: AiGameTone.THOUGHT
        });
    }

    if (mediumTerm?.budgets) {
        const budgets = mediumTerm.budgets;
        lines.push({
            label: "Budget",
            text: `${budgets.attack} attack(s) and ${budgets.siege} new siege(s) affordable` +
                ` (${budgets.activeSieges} of ${budgets.concurrentSiegeCap} concurrent sieges` +
                ` already running); will not attack below ${budgets.attackOddsFloor}% odds`,
            tone: AiGameTone.THOUGHT
        });
    }

    if (longTerm?.principalRival) {
        lines.push({
            label: "Principal rival",
            text: `${longTerm.principalRival.country}, holding ${longTerm.principalRival.count}` +
                " of its former territories",
            tone: AiGameTone.THOUGHT
        });
    }

    return lines;
}

/** The ranked plan, the sieges it reviewed before making it, and the marching orders. */
function planLines(plan, campaign) {
    const lines = [];

    for (const review of campaign?.siegeReviews ?? []) {
        lines.push({
            label: "Siege review",
            text: `${String(review.verdict).toUpperCase()} at ${review.target}` +
                ` (turn ${review.turnsInSiege}, ${Math.round((review.progress ?? 0) * 100)}%` +
                ` worn down, an assault would run at ${review.assaultOdds}%) -- ${review.reason}`,
            tone: AiGameTone.SIEGE
        });
    }

    const goals = plan?.shortTerm ?? [];
    lines.push({
        label: "Plan",
        text: goals.length > 0
            ? goals.join("; ")
            : "nothing to attempt -- no enemy territory in range and nothing worth building",
        tone: AiGameTone.PLAN
    });

    for (const move of campaign?.musters ?? []) {
        lines.push({
            label: "Marched",
            text: `${short(move.infantry)} infantry, ${move.from} -> ${move.to}` +
                (move.reason ? ` (${move.reason})` : ""),
            tone: AiGameTone.NEUTRAL
        });
    }

    // Why a target it could SEE was left alone. This is the commonest answer to "why did
    // nothing happen" and the reason the AI debug panel exists at all -- but only the
    // skipped ones, because the ones it acted on are already the plan above.
    const skipped = (campaign?.decisions ?? [])
        .filter((decision) => decision && decision.verdict === "Skip")
        .slice(0, 4)
        .map((decision) => `${decision.target} (${decision.odds}%): ${decision.reason}`);
    if (skipped.length > 0) {
        lines.push({ label: "Passed over", text: skipped.join("; "), tone: AiGameTone.THOUGHT });
    }

    return lines;
}

/**
 * Assemble one country's block.
 *
 * Everything is optional except the country and the turn: a country that took no turn
 * at all still gets a block saying so, because a gap in the log reads to a spectator
 * as having missed something.
 *
 * @param {object} view
 * @param {string} view.country
 * @param {number} view.turn
 * @param {object} [view.leader]
 * @param {object} [view.campaign]
 * @param {object} [view.plan]        as returned by `summariseGoalHorizons()`
 * @param {object} [view.delta]       as returned by `diffHoldings()`
 * @param {object} [view.turnGains]   this country's row of `turnGainsArrayAi`
 * @param {Array}  [view.entries]     activity entries written while it acted
 * @param {number} [view.territoriesHeld]
 * @param {string} [view.note]        instead of everything else -- "took no turn"
 * @returns {object} a block for `recordAiGameBlock()`
 */
export function buildCountryReport(view) {
    const {
        country,
        turn,
        leader = null,
        campaign = null,
        plan = null,
        delta = null,
        turnGains = null,
        entries = [],
        territoriesHeld = null,
        note = ""
    } = view ?? {};

    const lines = [];

    if (note) {
        lines.push({ label: "", text: note, tone: AiGameTone.NEUTRAL });
    } else {
        if (Number.isFinite(territoriesHeld)) {
            lines.push({
                label: "Holds",
                text: territoriesHeld === 1 ? "1 territory" : territoriesHeld + " territories",
                tone: AiGameTone.NEUTRAL
            });
        }
        lines.push(...thoughtLines(plan, campaign));
        lines.push(...planLines(plan, campaign));
        if (delta) lines.push(...economyLines(delta, turnGains));

        const war = warLines(entries, country);
        lines.push(...(war.length > 0
            ? war
            : [{ label: "War", text: "no fighting", tone: AiGameTone.NEUTRAL }]));
    }

    return {
        turn: turn,
        country: country,
        leaderName: leader?.name ?? "",
        leaderType: leader?.leaderType ?? "",
        posture: campaign?.posture ?? plan?.mediumTerm?.posture ?? "",
        lines: lines
    };
}
