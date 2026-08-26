// A window onto what the AI is thinking. Numpad / opens and closes it.
//
// The AI's reasoning has always gone to `console.log`, and since the campaign layer landed
// there is a great deal more of it: an objective, a posture, two budgets, an odds floor,
// and a verdict with a reason for every enemy territory a country can reach. That is the
// right amount of detail and completely the wrong medium -- two hundred collapsed console
// groups a turn is not something a person reads.
//
// So this is the same data as a panel. One collapsible section per country, newest first,
// and inside each:
//
//   OBJECTIVE   the continents this country has committed to under the active victory
//               condition, which one it is pushing, and how far along it is.
//   POSTURE     what kind of turn it decided this was, and the budgets that follow.
//   PLAN        the ranked goals it is about to attempt.
//   WEIGHED     every target it considered, with the verdict and the REASON. This is the
//               half worth having: "why did that country do nothing?" is the commonest
//               question of an AI turn and the goal list has never been able to answer it,
//               because a goal list only records what a country decided TO do.
//
// Three decisions worth stating. It has **no button over the map** -- it is not part of
// the game, and a piece of map chrome that opens a debug view is a piece of map chrome a
// player will click. It **renders on open and on demand**, not on every plan recorded, so
// an AI turn does not pay for a panel nobody has open. And it is **draggable and
// focus-ordered** like the other windows, because a debug view that cannot be moved off
// the thing it is explaining is no use.

import { classNames, ids } from "../core/registry.js";
import { clear, el, listenerGroup, mount } from "../core/dom.js";
import { bringToFront, makeDraggable } from "../core/draggable.js";
import { onPlanRecorded, recentPlans } from "../../ai/planRecord.js";

let panelRoot = null;
let bodyElement = null;
let unsubscribe = null;
let undrag = null;
const listeners = listenerGroup();

/** Which country sections are expanded. View state; never saved. */
const openCountries = new Set();

/** Build the panel. It starts hidden and has no control that reveals it but the key. */
export function create() {
    if (panelRoot) return panelRoot;

    const closeButton = el("button", {
        id: ids.xButtonAiDebug,
        class: "x-button",
        html: "X",
        attrs: { type: "button", "aria-label": "Close the AI debug panel" },
        on: { click: () => close() }
    });

    const header = el("div", { class: "ai-debug-panel-header" }, [
        el("div", {
            id: ids.aiDebugPanelTitle,
            class: "ai-debug-panel-title",
            text: "AI Reasoning"
        }),
        closeButton
    ]);

    bodyElement = el("div", { id: ids.aiDebugPanelBody, class: "ai-debug-panel-body" });

    panelRoot = el("div", { id: ids.aiDebugPanel, class: "ai-debug-panel" }, [header, bodyElement]);
    mount(ids.aiDebugPanelContainer, panelRoot);

    undrag = makeDraggable(document.getElementById(ids.aiDebugPanelContainer), header);

    //Numpad / and nothing else. `event.code` rather than `event.key`, because `key` is "/"
    //for both the numpad and the main keyboard and a debug window that opens whenever
    //somebody types a slash would be its own bug report.
    listeners.on(document, "keydown", (event) => {
        if (event.code !== "NumpadDivide") {
            return;
        }
        //Never while the player is typing into something.
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
            return;
        }
        event.preventDefault();
        toggle();
    });

    //Only repaint while it is up. An AI turn records two hundred plans; a hidden panel
    //re-rendering two hundred times is two hundred layouts nobody sees.
    unsubscribe = onPlanRecorded(() => {
        if (isOpen()) render();
    });

    return panelRoot;
}

export function destroy() {
    listeners.removeAll();
    unsubscribe?.();
    undrag?.();
    const container = document.getElementById(ids.aiDebugPanelContainer);
    if (container) clear(container);
    panelRoot = null;
    bodyElement = null;
    unsubscribe = null;
    undrag = null;
    openCountries.clear();
}

// --- visibility ------------------------------------------------------------

export function isOpen() {
    const container = document.getElementById(ids.aiDebugPanelContainer);
    return Boolean(container) && container.style.display === "block";
}

export function open() {
    const container = document.getElementById(ids.aiDebugPanelContainer);
    if (!container) return;
    container.style.display = "block";
    bringToFront(container);
    render();
}

export function close() {
    const container = document.getElementById(ids.aiDebugPanelContainer);
    if (container) container.style.display = "none";
}

export function toggle() {
    isOpen() ? close() : open();
}

// --- rendering -------------------------------------------------------------

function render() {
    if (!bodyElement) return;
    clear(bodyElement);

    const plans = recentPlans();
    if (plans.length === 0) {
        mount(bodyElement, el("div", {
            id: ids.aiDebugPanelEmpty,
            class: "ai-debug-panel-empty",
            text: "Nothing yet. The AI plans during its phase — end a turn and reopen this."
        }));
        return;
    }

    //NOTHING is expanded by default. The panel used to open the newest plan, on the theory
    //that it was the country whose turn had just happened -- but the sections are ordered
    //by name now, so that one open section landed at an arbitrary point down a list of two
    //hundred and read as a country singled out for a reason nobody could see. A closed list
    //of names is the thing to scan.
    for (const plan of displayOrder(plans)) {
        mount(bodyElement, countrySection(plan));
    }
}

/**
 * Newest turn first, and ALPHABETICAL by country within a turn.
 *
 * The ring is in the order the AI planned in, which is the order the countries happen to
 * sit in the turn loop -- meaningless to a reader, and different every game. Somebody with
 * this panel open is looking for one named country among two hundred, so the sections are
 * ordered by name. The turn stays the outer key because a section is a country-turn, and
 * interleaving two turns of the same country would be worse than either order.
 *
 * `localeCompare` rather than `<`, because country names are proper nouns and a few are
 * accented.
 */
function displayOrder(plans) {
    return [...plans].sort((a, b) => b.turn - a.turn || a.country.localeCompare(b.country));
}

function sectionKey(plan) {
    return plan.turn + "|" + plan.country;
}

function countrySection(plan) {
    const key = sectionKey(plan);
    const expanded = openCountries.has(key);

    const header = el("button", {
        class: classNames.aiDebugCountryHeader,
        attrs: { type: "button", "aria-expanded": String(expanded) },
        on: {
            click() {
                openCountries.has(key) ? openCountries.delete(key) : openCountries.add(key);
                render();
            }
        }
    }, [
        el("span", { class: "ai-debug-country-name", text: plan.country }),
        el("span", {
            class: "ai-debug-country-meta",
            text: "T" + plan.turn + " · " + plan.leaderType + " · " + (plan.posture ?? "no campaign")
        })
    ]);

    const body = el("div", {
        class: [classNames.aiDebugCountryBody, expanded ? classNames.aiDebugIsOpen : ""]
    }, expanded ? sectionContent(plan) : []);

    return el("div", {
        class: [classNames.aiDebugCountry, expanded ? classNames.aiDebugIsOpen : ""]
    }, [header, body]);
}

function sectionContent(plan) {
    const parts = [];

    parts.push(label("Long term"));
    if (plan.objective) {
        parts.push(fact("Objective", plan.objective.kind + " — " +
            (plan.objective.continents.join(", ") || "none chosen")));
        if (plan.objective.banked.length > 0) {
            parts.push(fact("Held outright", plan.objective.banked.join(", ")));
        }
    } else {
        parts.push(fact("Objective", "none — this plan was made without a campaign"));
    }
    if (plan.progress) {
        parts.push(fact("Progress", plan.progress.label +
            " (" + Math.round(plan.progress.fraction * 100) + "%)"));
    }
    if (plan.standings.length > 0) {
        parts.push(fact("Continents", plan.standings
            .map(row => row.continent + " " + row.held + "/" + row.total).join("  ")));
    }

    parts.push(label("This turn"));
    parts.push(fact("Posture", plan.posture ?? "unknown"));
    if (plan.focusContinent) {
        parts.push(fact("Pushing on", plan.focusContinent));
    }
    if (plan.health) {
        parts.push(fact("Country", plan.health.territories + " territories, " +
            plan.health.besieged + " besieged, " +
            Math.round(plan.health.development * 100) + "% developed"));
    }
    if (plan.budgets) {
        parts.push(fact("Budget", plan.budgets.attack + " attack, " +
            plan.budgets.siege + " new siege (" + plan.budgets.activeSieges + " of " +
            plan.budgets.concurrentSiegeCap + " running)"));
        parts.push(fact("Odds floor", plan.budgets.attackOddsFloor + "% to attack, " +
            plan.budgets.siegeOddsFloor + "% to besiege"));
    }
    if (plan.traits) {
        parts.push(fact("Leader", plan.leaderName + " — " + Object.entries(plan.traits)
            .map(([name, value]) => name.replace(/_/g, " ") + " " + Number(value).toFixed(2))
            .join(", ")));
    }

    //Before the plan, because it comes before the plan in the turn: these sieges were
    //reviewed first, and an assault or a lift is what the rest of the turn was planned
    //around. A country with none of its own running shows no section at all.
    if (plan.siegeReviews?.length > 0) {
        parts.push(label("Sieges already running"));
        for (const review of plan.siegeReviews) {
            parts.push(siegeReviewRow(review));
        }
    }

    parts.push(label("Plan, in order"));
    if (plan.goals.length === 0) {
        parts.push(fact("", "nothing to attempt"));
    } else {
        for (const goal of plan.goals) {
            parts.push(el("div", { class: classNames.aiDebugFact }, [
                el("span", { class: classNames.aiDebugFactValue, text: goal })
            ]));
        }
    }

    if (plan.decisions.length > 0) {
        parts.push(label("Targets weighed"));
        for (const decision of plan.decisions) {
            parts.push(decisionRow(decision));
        }
    }

    return parts;
}

function siegeReviewRow(review) {
    const verdictClass = review.verdict === "Assault"
        ? classNames.aiDebugVerdictAssault
        : review.verdict === "Lift"
            ? classNames.aiDebugVerdictLift
            : classNames.aiDebugVerdictSiege;

    //Same three columns as a weighed target, so the two lists read as one table: what it
    //decided, which territory, the odds behind it, and why. The odds column is what an
    //ASSAULT would run at, which is the number every one of these verdicts turns on.
    return el("div", { class: [classNames.aiDebugDecision, verdictClass] }, [
        el("span", { class: "ai-debug-decision-verdict", text: review.verdict.toUpperCase() }),
        el("span", {
            class: "ai-debug-decision-target",
            text: review.target + " (turn " + review.turnsInSiege + ", " +
                Math.round(review.progress * 100) + "% worn)"
        }),
        el("span", { class: "ai-debug-decision-odds", text: review.assaultOdds + "%" }),
        el("span", { class: classNames.aiDebugDecisionReason, text: review.reason ?? "" })
    ]);
}

function decisionRow(decision) {
    const verdictClass = decision.verdict === "Attack"
        ? classNames.aiDebugVerdictAttack
        : decision.verdict === "Siege"
            ? classNames.aiDebugVerdictSiege
            : classNames.aiDebugVerdictSkip;

    return el("div", { class: [classNames.aiDebugDecision, verdictClass] }, [
        el("span", { class: "ai-debug-decision-verdict", text: decision.verdict.toUpperCase() }),
        el("span", {
            class: "ai-debug-decision-target",
            text: decision.target + (decision.continent ? " (" + decision.continent + ")" : "")
        }),
        el("span", { class: "ai-debug-decision-odds", text: decision.odds + "%" }),
        el("span", { class: classNames.aiDebugDecisionReason, text: decision.reason ?? "" })
    ]);
}

function label(text) {
    return el("div", { class: classNames.aiDebugSectionLabel, text });
}

function fact(name, value) {
    return el("div", { class: classNames.aiDebugFact }, [
        name ? el("span", { class: classNames.aiDebugFactLabel, text: name }) : null,
        el("span", { class: classNames.aiDebugFactValue, text: value })
    ]);
}

export const aiDebugPanel = {
    create,
    destroy,
    open,
    close,
    toggle,
    isOpen
};
