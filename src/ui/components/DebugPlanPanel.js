// The way in to an injected plan: pick a country, point it at something, say how hard.
//
// The rules are `src/ai/debugPlans.js` and every decision about what a priority MEANS lives
// there. This file is the form and the readout, and it is deliberately thin -- it holds no
// copy of the plan table, reads the priorities out of the module rather than listing them,
// and writes through `setDebugPlan()` the way the spectator console writes through
// `aiGameMode.js` rather than keeping a second copy of the speed.
//
// It exists only in spectator mode. The button that opens it is in `aiGameButtonsContainer`,
// which `applySpectatorChrome()` shows and nothing else does -- the same reasoning that
// keeps the AI reasoning panel off the map chrome in a played game, except that here there
// is no player to protect from it.
//
// FOUR THINGS ABOUT THE READOUT, because it is most of the window and all four were what
// the brief asked for.
//
// **It refreshes on TURN_CHANGED and nothing else.** A country's army, its territories and
// its buildings all move during an AI turn, and `TERRITORY_CHANGED` fires for every one of
// those movements -- subscribing to it would repaint a two-hundred-row panel several
// thousand times a turn while the run is trying to be watched. A turn is the rate the
// figures are worth reading at, and it is also the rate the campaign is re-derived at, so
// the plans half and the figures half cannot show two different moments.
//
// **The plans half is read live and never cached.** `currentCampaign()` is the campaign the
// country actually planned with this turn, memoised in `strategy.js` on the turn number, so
// what this prints is the same object `goals.js` acted on rather than a re-derivation that
// could differ.
//
// **The territory rows are the country's OWN, keyed by `dataName`.** That is the current
// owner, so a country that takes ground gains a row and one that loses ground loses one,
// which is the whole point of watching it turn by turn.
//
// **A country with no campaign yet says so.** Before a country has taken its first turn
// there is no plan to print, and a blank section reads as the panel having broken -- the
// same reasoning behind the spectator log printing its `Absorbing` line even when there is
// nothing to absorb.

import { classNames, ids } from "../core/registry.js";
import { clear, el, mount } from "../core/dom.js";
import { bringToFront, makeDraggable } from "../core/draggable.js";
import { Events, on as onStoreEvent } from "../../state/events.js";
import { allTerritories, currentTurn, isUnderSiege } from "../../state/selectors.js";
import { defenseMultiplierFor } from "../../rules/military/probability.js";
import { currentCampaign } from "../../ai/strategy.js";
import { describeRoute } from "../../ai/route.js";
import {
    DebugPlanKind,
    activeDebugPlans,
    clearAllDebugPlans,
    clearDebugPlan,
    debugPlanPriorities,
    debugPlanStrength,
    onDebugPlansChanged,
    setDebugPlan
} from "../../ai/debugPlans.js";

let panelRoot = null;
let bodyElement = null;
let countrySelect = null;
let kindSelect = null;
let targetSelect = null;
let prioritySelect = null;
let priorityNote = null;
let summaryElement = null;
let activeListElement = null;
let undrag = null;
const unsubscribes = [];

/** Injected: the click sound, so this component does not import the audio layer. */
let playSound = null;

/**
 * The country being manipulated.
 *
 * Held here rather than read back off the `<select>` because the select is REBUILT whenever
 * the world changes shape -- a country that is conquered out of existence has to leave the
 * list -- and reading a control that is about to be replaced is how a selection silently
 * becomes the first option.
 */
let selectedCountry = "";

// --- construction ----------------------------------------------------------

/**
 * Build the window. It starts hidden and is opened by the "D" button over the map.
 *
 * @param {object} deps
 * @param {() => void} [deps.onSound]
 */
export function create({ onSound } = {}) {
    if (panelRoot) return panelRoot;
    playSound = onSound ?? null;

    const closeButton = el("button", {
        id: ids.xButtonDebugPlan,
        class: "x-button",
        html: "X",
        attrs: { type: "button", "aria-label": "Close the debug plan window" },
        on: {
            click: () => {
                playSound?.();
                close();
            }
        }
    });

    const header = el("div", { class: "debug-plan-panel-header" }, [
        el("div", {
            id: ids.debugPlanPanelTitle,
            class: "debug-plan-panel-title",
            //Named for what it IS rather than for what it holds. "Injected Plans" reads like
            //a feature of the game; this is not one, and the window that can restart a war
            //between two countries on somebody's say-so should say DEBUG on the way in.
            text: "DEBUG: Plan Injecter"
        }),
        closeButton
    ]);

    countrySelect = el("select", {
        id: ids.debugPlanCountrySelect,
        class: "debug-plan-select",
        attrs: { "aria-label": "Which country to manipulate" },
        on: {
            change: () => {
                selectedCountry = countrySelect.value;
                //The target list excludes the manipulated country, so it has to be rebuilt
                //rather than merely re-read when the manipulated country changes.
                refreshTargets();
                refreshSummary();
            }
        }
    });

    kindSelect = el("select", {
        id: ids.debugPlanKindSelect,
        class: "debug-plan-select",
        attrs: { "aria-label": "Point the plan at a country or at one territory" },
        //The summary redraws too, and not only the list: switching to Territory is what
        //brings the target's own figures into the window, and switching back to Country is
        //what takes them away again. Rebuilding the options alone left the panel showing
        //stats for a territory that was no longer being aimed at.
        on: {
            change: () => {
                refreshTargets();
                refreshSummary();
            }
        }
    }, [
        el("option", { value: DebugPlanKind.COUNTRY, text: "Country" }),
        el("option", { value: DebugPlanKind.TERRITORY, text: "Territory" })
    ]);

    targetSelect = el("select", {
        id: ids.debugPlanTargetSelect,
        class: "debug-plan-select",
        attrs: { "aria-label": "What to go after" },
        //Choosing a target territory redraws the summary, because the summary carries that
        //territory's own figures -- the garrison standing in it, what has been built there
        //and what it defends with. Deciding how hard to push at a place without those in
        //front of you is guesswork, and they are exactly the numbers that explain why an
        //injected plan bounced.
        on: { change: () => refreshSummary() }
    });

    //The priorities are read out of `debugPlans.js` rather than listed here, so adding a
    //fifth tier is one entry in that table and no change to this file -- the same
    //arrangement the goal chooser has with `goalCatalogue.js` and the Dominapedia with
    //`topics.js`.
    prioritySelect = el("select", {
        id: ids.debugPlanPrioritySelect,
        class: "debug-plan-select",
        attrs: { "aria-label": "How hard to push" },
        on: { change: () => refreshPriorityNote() }
    }, debugPlanPriorities.map(row =>
        el("option", { value: row.id, text: row.label })));

    priorityNote = el("p", { id: ids.debugPlanPriorityNote, class: "debug-plan-note" });

    const confirmButton = el("button", {
        id: ids.debugPlanConfirmBtn,
        class: "options-button debug-plan-confirm",
        text: "Confirm plan",
        attrs: { type: "button" },
        on: {
            click: () => {
                playSound?.();
                confirmPlan();
            }
        }
    });

    const cancelAllButton = el("button", {
        id: ids.debugPlanCancelAllBtn,
        class: "options-button-ghost debug-plan-cancel-all",
        text: "Cancel all debug plans",
        attrs: { type: "button" },
        on: {
            click: () => {
                playSound?.();
                clearAllDebugPlans();
            }
        }
    });

    //No heading on this section: the title bar immediately above it already says DEBUG:
    //PLAN INJECTER, and a form captioned with the name of the window it is the only thing in
    //is a caption nobody reads twice. The sections BELOW it keep theirs, because those are
    //readouts and need saying apart.
    const form = el("div", { class: classNames.debugPlanSection }, [
        labelledRow("Country", countrySelect),
        labelledRow("Go after", kindSelect),
        labelledRow("Target", targetSelect),
        labelledRow("Priority", prioritySelect),
        priorityNote,
        el("div", { class: "debug-plan-actions" }, [confirmButton, cancelAllButton])
    ]);

    activeListElement = el("div", { id: ids.debugPlanActiveList, class: "debug-plan-active" });

    const active = el("div", { class: classNames.debugPlanSection }, [
        el("h3", { class: classNames.debugPlanSectionTitle, text: "In force" }),
        activeListElement
    ]);

    summaryElement = el("div", { id: ids.debugPlanSummary, class: "debug-plan-summary" });

    bodyElement = el("div", { id: ids.debugPlanPanelBody, class: "debug-plan-panel-body" }, [
        form,
        active,
        summaryElement
    ]);

    panelRoot = el("div", { id: ids.debugPlanPanel, class: "debug-plan-panel" }, [
        header,
        bodyElement
    ]);

    mount(ids.debugPlanPanelContainer, panelRoot);
    undrag = makeDraggable(document.getElementById(ids.debugPlanPanelContainer), header);

    //THE TURN IS THE REFRESH RATE, and the note at the top of the file says why it is not
    //`TERRITORY_CHANGED`. It is subscribed for the life of the component rather than only
    //while the window is open, because `refreshAll()` returns immediately when it is shut.
    unsubscribes.push(onStoreEvent(Events.TURN_CHANGED, () => refreshAll()));
    unsubscribes.push(onDebugPlansChanged(() => {
        refreshActiveList();
        refreshSummary();
    }));

    refreshPriorityNote();
    refreshActiveList();

    return panelRoot;
}

/** One label and one control, which is every row of the form. */
function labelledRow(label, control) {
    return el("div", { class: classNames.debugPlanRow }, [
        el("label", {
            class: classNames.debugPlanLabel,
            text: label,
            attrs: { for: control.id }
        }),
        control
    ]);
}

// --- visibility ------------------------------------------------------------

function container() {
    return document.getElementById(ids.debugPlanPanelContainer);
}

export function isOpen() {
    const node = container();
    return Boolean(node) && node.style.display === "block";
}

export function open() {
    const node = container();
    if (!node) return;
    node.style.display = "block";
    bringToFront(node);
    refreshAll();
}

export function close() {
    const node = container();
    if (node) node.style.display = "none";
}

export function toggle() {
    isOpen() ? close() : open();
}

// --- the form --------------------------------------------------------------

function confirmPlan() {
    const country = countrySelect?.value ?? "";
    const target = targetSelect?.value ?? "";
    if (!country || !target) {
        return;
    }
    setDebugPlan({
        country,
        kind: kindSelect.value,
        target,
        priority: prioritySelect.value,
        turn: currentTurn()
    });
}

function refreshPriorityNote() {
    if (!priorityNote) return;
    const chosen = debugPlanPriorities.find(row => row.id === prioritySelect?.value);
    priorityNote.textContent = chosen?.description ?? "";
}

/**
 * Rebuild the country list, keeping the current selection where it still exists.
 *
 * A country conquered out of existence stops appearing, and if it was the one selected the
 * selection falls back to the first -- which is right, because a plan for a country with no
 * territories left is a plan nothing will ever read.
 */
function refreshCountries() {
    if (!countrySelect) return;
    const names = countryNames();
    const wanted = names.includes(selectedCountry) ? selectedCountry : (names[0] ?? "");

    clear(countrySelect);
    for (const name of names) {
        mount(countrySelect, el("option", { value: name, text: name }));
    }
    countrySelect.value = wanted;
    selectedCountry = wanted;
}

/** Rebuild the target list for the kind now chosen, keeping the selection if it survives. */
function refreshTargets() {
    if (!targetSelect) return;
    const previous = targetSelect.value;
    const rows = kindSelect.value === DebugPlanKind.TERRITORY
        ? enemyTerritoryOptions(selectedCountry)
        : otherCountryOptions(selectedCountry);

    clear(targetSelect);
    for (const row of rows) {
        mount(targetSelect, el("option", { value: row.value, text: row.label }));
    }
    if (rows.some(row => row.value === previous)) {
        targetSelect.value = previous;
    }
}

/** The territory now named in the target dropdown, or null when a COUNTRY is being aimed at. */
function selectedTargetTerritory() {
    if (!targetSelect || kindSelect?.value !== DebugPlanKind.TERRITORY) {
        return null;
    }
    const name = targetSelect.value;
    return allTerritories().find(territory => territory.territoryName === name) ?? null;
}

// --- the readouts ----------------------------------------------------------

function refreshAll() {
    if (!isOpen()) return;
    refreshCountries();
    refreshTargets();
    refreshActiveList();
    refreshSummary();
}

/** Every plan in force, each with its own way of being cancelled. */
function refreshActiveList() {
    if (!activeListElement) return;
    clear(activeListElement);

    const plans = activeDebugPlans();
    if (plans.length === 0) {
        mount(activeListElement, el("p", {
            class: "debug-plan-empty",
            text: "No plans injected. Every country is deciding for itself."
        }));
        return;
    }

    for (const plan of plans) {
        const strength = debugPlanStrength(plan);
        mount(activeListElement, el("div", { class: classNames.debugPlanActiveRow }, [
            el("span", { class: classNames.debugPlanChip, text: strength.label }),
            el("span", {
                class: "debug-plan-active-text",
                text: plan.country + " to take " +
                    (plan.kind === DebugPlanKind.TERRITORY ? "" : "all of ") + plan.target +
                    " (set turn " + plan.setOnTurn + ")"
            }),
            el("button", {
                class: "options-button-ghost debug-plan-drop",
                text: "Cancel",
                attrs: { type: "button", "aria-label": "Cancel the plan for " + plan.country },
                on: {
                    click: () => {
                        playSound?.();
                        clearDebugPlan(plan.country);
                    }
                }
            })
        ]));
    }
}

/**
 * Everything known about the selected country, rebuilt from the store.
 *
 * Called on open, on a country change, on a plan change and once a turn. It walks the
 * territory list once and folds the seven figures out of it, which is why the army totals
 * and the per-territory rows cannot disagree.
 */
function refreshSummary() {
    if (!summaryElement) return;
    clear(summaryElement);

    //THE TARGET FIRST, when one is named. It is the thing being decided about, and it is
    //also the thing that explains a refusal: a plan that bounces off eight forts on a
    //mountain is not the injection failing, and the only way to see that is to have the
    //target's own figures next to the priority dropdown.
    const target = selectedTargetTerritory();
    if (target) {
        mount(summaryElement, targetFacts(target));
    }

    if (!selectedCountry) {
        mount(summaryElement, el("p", {
            class: "debug-plan-empty",
            text: "No country selected."
        }));
        return;
    }

    const held = allTerritories().filter(territory => territory.dataName === selectedCountry);
    const totals = foldTotals(held);

    mount(summaryElement, el("h3", {
        class: classNames.debugPlanSectionTitle,
        text: selectedCountry + " -- turn " + currentTurn()
    }));

    mount(summaryElement, planFacts(selectedCountry));

    mount(summaryElement, el("div", { class: "debug-plan-stats" }, [
        stat("Infantry", totals.infantry),
        stat("Tanks", totals.assault),
        stat("Air", totals.air),
        stat("Navy", totals.naval),
        stat("Territories", held.length),
        stat("Forts", totals.forts),
        stat("Farms", totals.farms),
        stat("Forests", totals.forests),
        stat("Oil wells", totals.oilWells)
    ]));

    if (held.length === 0) {
        mount(summaryElement, el("p", {
            class: "debug-plan-empty",
            text: "Holds no territory -- it has been conquered."
        }));
        return;
    }

    const table = el("table", { class: "debug-plan-table" }, [
        el("tr", {}, [
            el("th", { text: "Territory" }),
            el("th", { text: "Forts" }),
            el("th", { text: "Farms" }),
            el("th", { text: "Forests" }),
            el("th", { text: "Oil" }),
            el("th", { text: "Army" })
        ])
    ]);
    for (const territory of [...held].sort(byName)) {
        mount(table, el("tr", { class: classNames.debugPlanTerritoryRow }, [
            el("td", { text: territory.territoryName }),
            el("td", { text: String(Number(territory.fortsBuilt) || 0) }),
            el("td", { text: String(Number(territory.farmsBuilt) || 0) }),
            el("td", { text: String(Number(territory.forestsBuilt) || 0) }),
            el("td", { text: String(Number(territory.oilWellsBuilt) || 0) }),
            el("td", { text: compact(territory.armyForCurrentTerritory) })
        ]));
    }
    mount(summaryElement, el("div", { class: "debug-plan-table-scroll" }, table));
}

/**
 * What this country is currently planning, as the campaign layer sees it.
 *
 * `currentCampaign()` is the memoised campaign this country actually planned with this
 * turn, not a re-derivation -- so a discrepancy between this panel and what the country
 * does is a real disagreement rather than two answers to the same question.
 */
function planFacts(country) {
    const campaign = currentCampaign(country);
    if (!campaign) {
        return el("p", {
            class: "debug-plan-empty",
            text: "No campaign yet -- this country has not taken a turn since the game began."
        });
    }

    const objective = campaign.objective?.continents?.join(", ") || "nothing in particular";
    const banked = campaign.objective?.banked ?? [];
    const rows = [
        ["Posture", campaign.posture],
        ["Objective", objective + (banked.length > 0 ? " (holds " + banked.join(", ") + ")" : "")],
        ["Focus", campaign.focusContinent ?? "none"],
        ["Absorbing", campaign.theatre?.rival ?? "nobody"],
        ["Written off", (campaign.walls ?? []).join(", ") || "nobody"],
        ["Budgets", campaign.attackBudget + " attack(s), " + campaign.siegeBudget +
            " new siege(s) on top of " + campaign.activeSieges + " running"],
        ["Odds floors", Math.round(campaign.attackOddsFloor) + "% attack, " +
            Math.round(campaign.siegeOddsFloor) + "% siege"],
        ["Playing for", campaign.progress?.label ?? "no goal"]
    ];
    if (campaign.debugPlan) {
        //The ROUTE is the answer to the only hard question this window raises: an objective
        //on another continent is not attacked, it is walked to, and without this line a
        //country pushing towards it looks like a country ignoring its instruction. It also
        //says UNREACHABLE, which is the one outcome nothing else would ever reveal.
        rows.unshift(["Route", describeRoute(campaign.debugRoute)]);
        rows.unshift(["Injected", "take " +
            (campaign.debugPlan.kind === DebugPlanKind.TERRITORY ? "" : "all of ") +
            campaign.debugPlan.target + " at " +
            debugPlanStrength(campaign.debugPlan).label.toLowerCase()]);
    }

    return el("div", { class: "debug-plan-facts" }, rows.map(([label, text]) =>
        el("div", { class: classNames.debugPlanStat }, [
            el("span", { class: classNames.debugPlanLabel, text: label }),
            el("span", { class: classNames.debugPlanStatValue, text: String(text) })
        ])));
}

/**
 * Everything about the territory being aimed at: who holds it, what stands in it, what has
 * been built there, and what it defends with.
 *
 * THE DEFENCE FIGURE IS STATED THREE WAYS, and it has to be, because the three answer
 * different questions and the game does not treat them as one. `defenseBonus +
 * mountainDefenseBonus` is the raw number; `defenseMultiplierFor()` is what the pre-battle
 * BAR the player sees and the siege score are computed from; and the DICE BAND is what the
 * battle is actually fought with -- 25 costs the attacker a die and 100 costs two, and
 * everything in between changes nothing at all. That last row is the one that stops a
 * reader concluding a terrain edit worked because the multiplier moved (CLAUDE.md, "TERRAIN
 * IS QUANTISED"), and it is the number an injected plan runs into.
 */
function targetFacts(territory) {
    const fortification = (Number(territory.defenseBonus) || 0) +
        (Number(territory.mountainDefenseBonus) || 0);
    const diceOff = fortification >= 100 ? 2 : fortification >= 25 ? 1 : 0;
    const rows = [
        ["Held by", territory.dataName],
        ["Continent", territory.continent ?? "unknown"],
        ["Army", compact(territory.armyForCurrentTerritory)],
        ["Infantry", compact(territory.infantryForCurrentTerritory)],
        ["Tanks", compact(territory.assaultForCurrentTerritory)],
        ["Air", compact(territory.airForCurrentTerritory)],
        ["Navy", compact(territory.navalForCurrentTerritory)],
        ["Forts", String(Number(territory.fortsBuilt) || 0)],
        ["Farms", String(Number(territory.farmsBuilt) || 0)],
        ["Forests", String(Number(territory.forestsBuilt) || 0)],
        ["Oil wells", String(Number(territory.oilWellsBuilt) || 0)],
        ["Defence bonus", Math.round(Number(territory.defenseBonus) || 0) + " from forts, " +
            Math.round(Number(territory.mountainDefenseBonus) || 0) + " from terrain (" +
            Math.round(fortification) + " total)"],
        ["Defence multiplier", "x" + defenseMultiplierFor(territory) + " on the shown odds"],
        ["In the battle", diceOff === 0
            ? "no dice taken off the attacker"
            : diceOff === 1
                ? "one die off the attacker"
                : diceOff + " dice off the attacker"],
        ["Coastal", territory.isCoastal ? "yes -- reachable by sea" : "no"],
        ["Under siege", isUnderSiege(territory.territoryName) ? "yes" : "no"]
    ];

    return el("div", { class: classNames.debugPlanSection }, [
        el("h3", {
            class: classNames.debugPlanSectionTitle,
            text: "Target: " + territory.territoryName
        }),
        el("div", { class: "debug-plan-facts" }, rows.map(([label, text]) =>
            el("div", { class: classNames.debugPlanStat }, [
                el("span", { class: classNames.debugPlanLabel, text: label }),
                el("span", { class: classNames.debugPlanStatValue, text: String(text) })
            ])))
    ]);
}

function stat(label, value) {
    return el("div", { class: classNames.debugPlanStat }, [
        el("span", { class: classNames.debugPlanLabel, text: label }),
        el("span", { class: classNames.debugPlanStatValue, text: compact(value) })
    ]);
}

// --- the world, read ------------------------------------------------------

/** Every country holding at least one territory, sorted. */
function countryNames() {
    const names = new Set();
    for (const territory of allTerritories()) {
        if (territory.dataName) names.add(territory.dataName);
    }
    return [...names].sort();
}

function otherCountryOptions(country) {
    return countryNames()
        .filter(name => name !== country)
        .map(name => ({ value: name, label: name }));
}

/**
 * Every territory the manipulated country does not already hold.
 *
 * Its own are excluded because a plan against your own province is not a plan, and because
 * the executor refuses it anyway -- an option that silently does nothing is worse than one
 * that is not offered.
 */
function enemyTerritoryOptions(country) {
    return allTerritories()
        .filter(territory => territory.dataName !== country)
        .sort(byName)
        .map(territory => ({
            value: territory.territoryName,
            label: territory.territoryName + " (" + territory.dataName + ")"
        }));
}

function byName(a, b) {
    return String(a.territoryName).localeCompare(String(b.territoryName));
}

function foldTotals(territories) {
    const totals = {
        infantry: 0, assault: 0, air: 0, naval: 0,
        forts: 0, farms: 0, forests: 0, oilWells: 0
    };
    for (const territory of territories) {
        totals.infantry += Number(territory.infantryForCurrentTerritory) || 0;
        totals.assault += Number(territory.assaultForCurrentTerritory) || 0;
        totals.air += Number(territory.airForCurrentTerritory) || 0;
        totals.naval += Number(territory.navalForCurrentTerritory) || 0;
        totals.forts += Number(territory.fortsBuilt) || 0;
        totals.farms += Number(territory.farmsBuilt) || 0;
        totals.forests += Number(territory.forestsBuilt) || 0;
        totals.oilWells += Number(territory.oilWellsBuilt) || 0;
    }
    return totals;
}

/**
 * A figure short enough to sit in a cell.
 *
 * Infantry runs into the tens of millions on a large country, and an un-abbreviated total
 * pushes the table into a horizontal scroller -- the same rule the Dominapedia's tables
 * follow for the same reason.
 */
function compact(value) {
    const number = Math.round(Number(value) || 0);
    const sign = number < 0 ? "-" : "";
    const size = Math.abs(number);
    if (size >= 1e9) return sign + (size / 1e9).toFixed(1) + "bn";
    if (size >= 1e6) return sign + (size / 1e6).toFixed(1) + "m";
    if (size >= 1e4) return sign + Math.round(size / 1e3) + "k";
    return String(number);
}

// --- teardown --------------------------------------------------------------

export function destroy() {
    for (const unsubscribe of unsubscribes.splice(0)) {
        unsubscribe();
    }
    undrag?.();
    const node = container();
    if (node) clear(node);
    panelRoot = null;
    bodyElement = null;
    countrySelect = null;
    kindSelect = null;
    targetSelect = null;
    prioritySelect = null;
    priorityNote = null;
    summaryElement = null;
    activeListElement = null;
    undrag = null;
    selectedCountry = "";
}

/** Forget which country was being looked at. A new game, not a new turn. */
export function reset() {
    selectedCountry = "";
    close();
}

export const debugPlanPanel = {
    create,
    destroy,
    open,
    close,
    toggle,
    isOpen,
    reset
};
