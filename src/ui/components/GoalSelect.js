// The goal chooser: the screen a new game now opens on.
//
// Two dropdowns down the left -- which of the five goals, and at what scale -- and the
// chosen goal's description in the pane on the right. Confirm in the footer, and nothing
// else: this is the one modal in the game with no way out that does not answer the question.
//
// It has no opinion about the content. Everything it draws comes from
// `src/ui/goals/goalCatalogue.js`, which is frozen data, imports almost nothing and is
// unit-tested in Node -- the same arrangement `Dominapedia.js` has with `topics.js`, and for
// the same reason: adding a sixth goal should be one entry in a table.
//
// Four decisions, each of which is a mistake avoided rather than a preference.
//
// **THE CHOICE IS FORCED.** There is no Cancel and clicking the scrim does nothing. Escape
// goes BACK to the main menu rather than skipping the screen: a player must be able to change
// their mind about starting a game, but not to start one with no goal. That is why this
// component takes an `onBack` as well as an `onConfirm`, and why neither has a default.
//
// **THE SCALE DROPDOWN IS ALWAYS PRESENT.** For World Conquest it holds a single entry
// reading "Total -- every territory on the map". Hiding it would make the panel change shape
// as the player browses the list, which reads as a rendering fault.
//
// **CONFIRM HANDS BACK A CONDITION, NOT A KIND AND A NUMBER.** `conditionFor()` is what knows
// that a land share goes on `landShare` and a turn count on `turnLimit`. Nothing here names a
// field on the victory condition, so the one mistake that would be silent -- a Domination
// game whose share was written into `continentsRequired`, which is a perfectly valid
// condition object that plays as the default game -- cannot be made here.
//
// **THE GREAT-POWER NAMES ARE PASSED IN.** They are the five countries the selection screen
// locks, and they have to be known BEFORE this panel freezes them into the condition. The
// caller reads them from the store's locked-country set, after the lock has been computed and
// never from a fill colour; see `startNewGame()` in ui.js.

import { ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";
import { VictoryCondition } from "../../ai/victory.js";
import {
    allGoals,
    conditionFor,
    defaultScaleFor,
    goalFor,
    scalesFor
} from "../goals/goalCatalogue.js";

let root = null;
let kindSelect = null;
let scaleSelect = null;
let scaleLabel = null;
let summary = null;
let powersLine = null;
let description = null;
let removers = [];
let onConfirm = null;
let onBack = null;
let onSound = null;
/** The five locked countries, frozen into the condition if Great Powers is chosen. */
let greatPowers = [];

/** Render one description block. The vocabulary is `p`, `h` and `ul`, and nothing else. */
function blockElement(block) {
    if (block.kind === "h") {
        return el("h3", { class: "goal-select-heading", text: block.text });
    }
    if (block.kind === "ul") {
        return el("ul", { class: "goal-select-list" },
            block.items.map(item => el("li", { text: item })));
    }
    return el("p", { class: "goal-select-paragraph", text: block.text });
}

/** Repopulate the scale dropdown for the goal now selected, and select a valid default. */
function renderScales(kind, wantedValue) {
    const options = scalesFor(kind);
    const goal = goalFor(kind);
    scaleLabel.textContent = goal?.scaleLabel ?? "Scale";

    scaleSelect.replaceChildren(
        //The VALUE is stringified by the DOM whatever is put in it, so the option carries
        //its index and `chosenScale()` reads the real value back out of the catalogue.
        //Otherwise Domination's 0.6 comes back as the string "0.6" and never matches the
        //number in the tier list, which would silently hand every game the default scale.
        ...options.map((option, index) => el("option", {
            value: String(index),
            text: option.label
        }))
    );

    const wanted = options.findIndex(option => option.value === wantedValue);
    const fallback = options.findIndex(option => option.value === defaultScaleFor(kind));
    scaleSelect.value = String(wanted >= 0 ? wanted : Math.max(0, fallback));
    scaleSelect.disabled = options.length <= 1;
}

/** The scale value currently selected, read back out of the catalogue by index. */
function chosenScale() {
    const options = scalesFor(kindSelect.value);
    return options[Number(scaleSelect.value)]?.value ?? defaultScaleFor(kindSelect.value);
}

function renderGoal(kind) {
    const goal = goalFor(kind);
    if (!goal) return;
    summary.textContent = goal.summary;
    //Great Powers is the one goal with an ANTAGONIST, and the description says so at
    //length -- so the panel had better say WHO. Naming them is the difference between a
    //goal that reads as a percentage and one that reads as a war, and the names are
    //already in hand because they are what gets frozen into the condition on Confirm.
    powersLine.textContent = kind === VictoryCondition.GREAT_POWERS && greatPowers.length > 0
        ? "This game's powers: " + greatPowers.join(", ")
        : "";
    description.replaceChildren(...goal.body.map(blockElement));
}

function onKindChanged() {
    onSound?.();
    renderScales(kindSelect.value, undefined);
    renderGoal(kindSelect.value);
}

export function create({ onConfirm: confirmHandler, onBack: backHandler, onSound: soundHandler } = {}) {
    if (root) return root;
    onConfirm = confirmHandler ?? null;
    onBack = backHandler ?? null;
    onSound = soundHandler ?? null;

    kindSelect = el("select", { id: ids.goalSelectKind, class: "options-select" },
        allGoals().map(goal => el("option", { value: goal.kind, text: goal.name })));

    scaleSelect = el("select", { id: ids.goalSelectScale, class: "options-select" });
    scaleLabel = el("label", {
        id: ids.goalSelectScaleLabel,
        class: "options-label",
        text: "Scale",
        attrs: { for: ids.goalSelectScale }
    });

    summary = el("p", { id: ids.goalSelectSummary, class: "goal-select-summary" });
    powersLine = el("p", { id: ids.goalSelectPowers, class: "goal-select-powers" });
    description = el("div", { id: ids.goalSelectDescription, class: "goal-select-description" });

    const panel = el("div", { id: ids.goalSelectPanel, class: "goal-select-panel" }, [
        el("h2", { class: "options-title", text: "Choose Your Goal" }),
        el("div", { class: "goal-select-body" }, [
            el("div", { class: "goal-select-choices" }, [
                el("div", { class: "options-row" }, [
                    el("label", {
                        class: "options-label",
                        text: "Goal",
                        attrs: { for: ids.goalSelectKind }
                    }),
                    el("div", { class: "options-control" }, kindSelect)
                ]),
                el("div", { class: "options-row" }, [
                    scaleLabel,
                    el("div", { class: "options-control" }, scaleSelect)
                ]),
                summary,
                powersLine
            ]),
            description
        ]),
        el("div", { class: "options-actions" }, [
            el("button", {
                id: ids.goalSelectConfirmBtn,
                class: ["options-button", "options-button-primary"],
                text: "Begin",
                on: { click: confirm }
            })
        ])
    ]);

    root = el("div", { id: ids.goalSelectContainer, class: "options-scrim" }, panel);
    //Deliberately NO scrim-click handler. Every other modal in the game cancels on a
    //scrim click; this one has nothing to cancel to.
    removers.push(on(kindSelect, "change", onKindChanged));
    removers.push(on(scaleSelect, "change", () => onSound?.()));

    root.style.display = "none";
    mount(document.body, root);
    return root;
}

/**
 * Escape goes back to the main menu. It does NOT skip the screen.
 *
 * Captured, so it is seen before the map's own key handling -- the map is on screen behind
 * the scrim and its Escape opens the in-game menu.
 */
function onKeyDown(event) {
    if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        close();
        onBack?.();
    }
}

/**
 * @param {{greatPowers?: string[], kind?: string, scale?: number}} [options]
 *        `greatPowers` are the five locked countries, already computed by the caller.
 *        `kind` / `scale` reopen on a given choice, which is what a restart does.
 */
export function open({ greatPowers: powers = [], kind, scale } = {}) {
    if (!root) create();
    greatPowers = [...powers];

    const wantedKind = goalFor(kind) ? kind : allGoals()[0].kind;
    kindSelect.value = wantedKind;
    renderScales(wantedKind, scale);
    renderGoal(wantedKind);

    root.style.display = "flex";
    document.addEventListener("keydown", onKeyDown, true);
    //Focus the first control so the keyboard works without a click, and so a screen reader
    //lands on the question rather than on the Begin button.
    kindSelect.focus();
}

/** Hide without answering. Only Escape and `destroy()` reach this. */
export function close() {
    if (!root) return;
    root.style.display = "none";
    document.removeEventListener("keydown", onKeyDown, true);
}

/** The one way out that answers the question. */
export function confirm() {
    if (!root) return null;
    onSound?.();
    const condition = conditionFor(kindSelect.value, chosenScale(), { greatPowers });
    close();
    onConfirm?.(condition);
    return condition;
}

export function isOpen() {
    return Boolean(root) && root.style.display !== "none";
}

/** What is selected right now, without confirming. The e2e harness and specs read this. */
export function selection() {
    if (!root) return null;
    return { kind: kindSelect.value, scale: chosenScale() };
}

export function destroy() {
    document.removeEventListener("keydown", onKeyDown, true);
    for (const remove of removers) remove();
    removers = [];
    root?.remove();
    root = null;
    kindSelect = scaleSelect = scaleLabel = summary = powersLine = description = null;
    onConfirm = onBack = onSound = null;
    greatPowers = [];
}

export const goalSelect = { create, open, close, confirm, isOpen, selection, destroy };
