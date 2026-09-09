// The diplomacy panel: who the player has met, where they stand with each of them, and what
// can be done about it.
//
// Diplomacy checklist stage 4, and **Q6 answered**: its own full-screen window rather than a
// sixth info-panel tab. The reason is stage 5 and not stage 4 -- a proposal, a counter-offer
// and a call-in are a CONVERSATION, and a conversation does not fit in a column beside four
// tables of numbers. It borrows the Dominapedia's shape, a list on the left and the subject
// on the right, because that is already this game's shape for "browse a set, read one".
//
// FOUR THINGS ABOUT IT.
//
// **This file draws and `relationsPanelModel.js` decides.** Every group, every fact, every
// action and its reason comes out of that module, which imports the enum and nothing else and
// is unit-tested in Node. That split matters more here than usual: nothing in the game agrees
// a peace, a ceasefire or an alliance until stage 5, so most of what this panel can say
// describes states a browser CANNOT be used to check.
//
// **The listeners are installed once, from bootstrap.** `create()` runs once and the rows are
// re-rendered under a single delegated click listener on the list, rather than one listener
// per row rebuilt on every render. `removeEventListener` cannot take off a handler built
// fresh at each call, which is the move button's old defect, the territory tooltip's defect
// and the status bars' defect -- three times, the same shape.
//
// **The panel itself never scrolls.** It is a fixed height with `overflow: hidden` and the two
// columns each own their overflow, the contract the Dominapedia has: that is what keeps the
// title bar and the actions on screen however long the list of countries gets. On this map the
// list can genuinely reach two hundred rows.
//
// **It re-renders from the store on `DIPLOMACY_CHANGED` and `TURN_CHANGED`, never from an
// appended row.** A declaration made from the map has to show here, and a conquest during the
// AI's turn is precisely how a country the player has never met becomes a neighbour. The
// alternative keeps a second copy of the register in the DOM and has to be told about
// restores, new games and turn boundaries as well as writes -- four things to get right
// instead of one.

import { ids } from "../core/registry.js";
import { clear, el, listenerGroup, mount } from "../core/dom.js";
import { bringToFront, makeDraggable } from "../core/draggable.js";
import { Events, on as onStateEvent } from "../../state/events.js";
import {
    currentTurn,
    playerCountryName,
    relationBetween,
    relationsFor,
    territoriesOwnedByCountry
} from "../../state/selectors.js";
import { DiplomaticState } from "../../state/diplomacy.js";
import { ensureDiplomaticContacts } from "../../state/diplomacyContacts.js";
import {
    countryDetail,
    diplomacyGroups,
    diplomacySummary
} from "../diplomacy/relationsPanelModel.js";
import { diplomacyIcon } from "../icons.js";

let buttonRoot = null;
let panelRoot = null;
let summaryNode = null;
let searchInput = null;
let listNode = null;
let detailNode = null;
let unsubscribe = [];
let undrag = null;
const listeners = listenerGroup();

/** Which country the right-hand column is describing. Null until one is picked. */
let selected = null;
/** The substring filter. View state, never saved. */
let search = "";

/**
 * Which action gets which id. Every id in the registry and none written by hand, which is
 * what lets the e2e page objects address these without a literal selector.
 */
const ACTION_BUTTON_IDS = Object.freeze({
    declare: ids.diplomacyDeclareBtn,
    ceasefire: ids.diplomacyCeasefireBtn,
    peace: ids.diplomacyPeaceBtn,
    alliance: ids.diplomacyAllianceBtn,
    dissolve: ids.diplomacyDissolveBtn,
});

/** Injected, so this component imports neither the audio layer nor the diplomacy rules. */
let playSound = null;
let declareWar = null;
let propose = null;

/**
 * The answer to the last thing the player offered, and who it was offered to.
 *
 * VIEW STATE, NEVER SAVED, AND CLEARED WHEN THE SELECTION MOVES. A proposal is answered on
 * the spot -- there is no waiting period anywhere in this system -- so the answer has nowhere
 * to live but here, and the alternative of a dialog would put a modal in front of a player
 * doing the one thing this panel is for. It is shown IN the detail column, under the button
 * that was pressed, because that is where the player is looking.
 */
let lastAnswer = null;

/**
 * Build the button and the window.
 *
 * @param {object} deps
 * @param {() => void} [deps.onSound]      the click sound
 * @param {(country: string) => Promise<boolean>} [deps.onDeclareWar]  the whole declaration,
 *        confirmation included. It is injected rather than imported because the confirmation
 *        and the map's repaint live in `ui.js`, and importing that here would drag the game
 *        into a component that is otherwise reachable from the store alone.
 * @param {(country: string, kind: string) => {accepted: boolean, reason: string}}
 *        [deps.onPropose]  offer a ceasefire or a peace, and get the answer back. Injected
 *        for the same reason: the answer needs the leader table and the siege lists, and
 *        neither belongs in a component.
 */
export function create({ onSound, onDeclareWar, onPropose } = {}) {
    if (panelRoot) return panelRoot;
    playSound = onSound ?? null;
    declareWar = onDeclareWar ?? null;
    propose = onPropose ?? null;

    const toggleButton = el(
        "button",
        {
            id: ids.diplomacyToggleButton,
            class: "chrome-button diplomacy-panel-button",
            attrs: {
                type: "button",
                title: "Diplomacy",
                "aria-label": "Diplomacy: who you have met and where you stand",
            },
            on: {
                click() {
                    playSound?.();
                    toggle();
                },
            },
        },
        diplomacyIcon()
    );
    buttonRoot = mount(ids.diplomacyButtonContainer, toggleButton);

    const closeButton = el("button", {
        id: ids.xButtonDiplomacy,
        class: "x-button",
        html: "X",
        attrs: { type: "button", "aria-label": "Close the diplomacy panel" },
        on: {
            click() {
                playSound?.();
                close();
            },
        },
    });

    summaryNode = el("div", {
        id: ids.diplomacyPanelSummary,
        class: "diplomacy-panel-summary",
    });

    searchInput = el("input", {
        id: ids.diplomacyPanelSearch,
        class: "diplomacy-panel-search",
        attrs: {
            type: "search",
            placeholder: "Find a country",
            "aria-label": "Find a country",
            autocomplete: "off",
        },
    });

    listNode = el("div", { id: ids.diplomacyPanelList, class: "diplomacy-panel-list" });
    detailNode = el("div", { id: ids.diplomacyPanelDetail, class: "diplomacy-panel-detail" });

    const header = el("div", { class: "diplomacy-panel-header" }, [
        el("div", {
            id: ids.diplomacyPanelTitle,
            class: "diplomacy-panel-title",
            text: "Diplomacy",
        }),
        closeButton,
    ]);

    panelRoot = el("div", { id: ids.diplomacyPanel, class: "diplomacy-panel" }, [
        header,
        summaryNode,
        el("div", { class: "diplomacy-panel-columns" }, [
            el("div", { class: "diplomacy-panel-column diplomacy-panel-column-list" }, [
                searchInput,
                listNode,
            ]),
            detailNode,
        ]),
    ]);

    mount(ids.diplomacyPanelContainer, panelRoot);
    undrag = makeDraggable(document.getElementById(ids.diplomacyPanelContainer), header);

    //ONE delegated listener for every row, installed here and never rebuilt. See the note at
    //the top of the file: a listener per row, re-attached on every render, is the defect this
    //codebase has shipped three times.
    listeners.on(listNode, "click", (event) => {
        const row = event.target.closest("[data-country]");
        if (!row) return;
        playSound?.();
        selected = row.getAttribute("data-country");
        //An answer belongs to the country it was about. Carrying it to the next country
        //would report Portugal's refusal under Spain's name.
        lastAnswer = null;
        render();
    });
    listeners.on(searchInput, "input", () => {
        search = searchInput.value ?? "";
        render();
    });
    //The detail column's controls, all three of them under ONE delegated listener,
    //installed here and never rebuilt -- the column is replaced wholesale on every render.
    listeners.on(detailNode, "click", async (event) => {
        const button = event.target.closest("[data-action]");
        if (!button || button.getAttribute("aria-disabled") === "true") return;
        playSound?.();
        const country = button.getAttribute("data-country");
        const action = button.getAttribute("data-action");

        if (action === "declare") {
            //`declareWar` runs the confirmation and the write. It is awaited so that a player
            //who cancels a breach dialog gets the panel back exactly as it was.
            lastAnswer = null;
            await declareWar?.(country);
            render();
            return;
        }

        //A PROPOSAL IS ANSWERED ON THE SPOT, which is the same rule a declaration follows:
        //there is no waiting period anywhere in this system, so the player asks and is told.
        //Dissolution goes through the same door: it is an offer like any other, and the other
        //side may simply prefer the alliance.
        const answer = propose?.(country, action);
        lastAnswer = answer ? { ...answer, country, kind: action } : null;
        render();
        //AND THE ANSWER IS SCROLLED TO. It is the last thing in a column that owns its own
        //overflow, so on a country with a long list of wars it lands below the fold -- which
        //means the one thing the player just asked for is the one thing they cannot see.
        //Found by driving it, not by reading it.
        document.getElementById(ids.diplomacyAnswer)
            ?.scrollIntoView({ block: "nearest" });
    });

    unsubscribe = [
        onStateEvent(Events.DIPLOMACY_CHANGED, () => {
            //Only while it is up. A turn in which the AI declares forty wars would otherwise
            //re-render a hidden panel forty times.
            if (isOpen()) render();
        }),
        onStateEvent(Events.TURN_CHANGED, () => {
            if (isOpen()) render();
        }),
    ];

    render();
    return panelRoot;
}

// --- visibility ------------------------------------------------------------

export function isOpen() {
    const container = document.getElementById(ids.diplomacyPanelContainer);
    return Boolean(container) && container.style.display === "block";
}

export function open() {
    const container = document.getElementById(ids.diplomacyPanelContainer);
    if (!container) return;
    container.style.display = "block";
    //Opening IS focusing, the rule every window in this game follows since Phase 7.4.
    bringToFront(container);
    render();
}

export function close() {
    const container = document.getElementById(ids.diplomacyPanelContainer);
    if (container) container.style.display = "none";
}

export function toggle() {
    if (isOpen()) {
        close();
    } else {
        open();
    }
}

/** Show or hide the button that opens it. Follows the rest of the map chrome. */
export function setButtonVisible(visible) {
    const container = document.getElementById(ids.diplomacyButtonContainer);
    if (container) container.style.display = visible ? "block" : "none";
}

/** New game, restart or a load: forget the selection and the filter. */
export function reset() {
    selected = null;
    search = "";
    lastAnswer = null;
    if (searchInput) searchInput.value = "";
    close();
}

// --- rendering -------------------------------------------------------------

export function render() {
    if (!panelRoot || !isOpen()) return;

    const player = playerCountryName();
    if (!player) {
        //Spectator mode, or before a country has been chosen. There is nobody whose
        //diplomacy this would be.
        summaryNode.textContent = "";
        clear(listNode);
        clear(detailNode);
        detailNode.append(emptyNote("There is no player in this game, so there is nobody to " +
            "have relations with."));
        return;
    }

    //Contact is coalesced -- walked at most once per turn on a dirty flag -- so a border that
    //opened during the AI's turn is recorded the first time somebody looks, rather than only
    //at the next turn boundary. The territory tooltip does the same before it reads.
    ensureDiplomaticContacts();

    const relations = relationsFor(player);
    const { groups, counts } = diplomacyGroups({
        relations,
        territoryCountOf: (country) => territoriesOwnedByCountry(country).length,
        search,
    });

    summaryNode.textContent = diplomacySummary(counts);

    clear(listNode);
    if (groups.length === 0) {
        listNode.append(emptyNote(relations.length === 0
            ? "You have not met anybody yet."
            : "No country matches that."));
    }
    for (const group of groups) {
        listNode.append(el("div", { class: "diplomacy-group-heading" }, [
            el("span", { class: "diplomacy-group-name", text: group.heading }),
            el("span", { class: "diplomacy-group-count", text: String(group.count) }),
        ]));
        for (const row of group.rows) {
            listNode.append(el("button", {
                class: [
                    "diplomacy-row",
                    "is-" + row.tone,
                    row.country === selected ? "is-selected" : "",
                ],
                attrs: {
                    type: "button",
                    "data-country": row.country,
                    "aria-pressed": row.country === selected ? "true" : "false",
                },
            }, [
                el("span", { class: "diplomacy-row-name", text: row.country }),
                el("span", {
                    class: "diplomacy-row-size",
                    text: row.territories === null ? "" : String(row.territories),
                }),
            ]));
        }
    }

    renderDetail(player);
}

function renderDetail(player) {
    clear(detailNode);
    if (!selected) {
        detailNode.append(emptyNote("Choose a country to see where you stand with it."));
        return;
    }

    const record = relationBetween(player, selected);
    const detail = countryDetail({
        country: selected,
        state: record?.state ?? DiplomaticState.NO_CONTACT,
        since: record?.since ?? null,
        until: record?.until ?? null,
        turn: currentTurn(),
        territories: territoriesOwnedByCountry(selected).length,
        theirRelations: relationsFor(selected),
    });

    detailNode.append(el("div", { class: "diplomacy-detail-header" }, [
        el("img", {
            class: "diplomacy-detail-flag",
            //Resolved against the HOST document, which is where this panel lives. Anything
            //drawn INSIDE the map document has the base-url problem `flagOverlay.js` records.
            attrs: { src: "resources/flags/" + selected + ".png", alt: "" },
        }),
        el("div", { class: "diplomacy-detail-names" }, [
            el("h3", { class: "diplomacy-detail-country", text: selected }),
            el("div", {
                class: ["diplomacy-detail-state", "is-" + detail.tone],
                text: detail.label,
            }),
        ]),
    ]));

    const facts = el("dl", { class: "diplomacy-detail-facts" });
    for (const fact of detail.facts) {
        facts.append(
            el("dt", { text: fact.label }),
            el("dd", { text: fact.value })
        );
    }
    detailNode.append(facts);

    //WHO ELSE THEY ARE FIGHTING. Not intelligence-sharing and not a cheat: a war is a fact
    //about the world that both parties already know, and the territory tooltip lists it too.
    //What is NOT here, and must never be, is what they are ABOUT to do -- the AI's plans go
    //to the console, and a panel showing who is about to declare war would be a cheat.
    if (detail.theirWars.length > 0) {
        detailNode.append(listSection("At war with", detail.theirWars));
    }
    if (detail.theirAllies.length > 0) {
        detailNode.append(listSection("Allied with", detail.theirAllies));
    }

    const actions = el("div", { class: "diplomacy-detail-actions" });
    for (const action of detail.actions) {
        //ONLY THE DECLARATION IS RED. The two agreements are ordinary buttons, because the
        //colour in this game means "this is the irreversible one" -- it is what the attack
        //control wears, and a peace offer dressed the same way would be saying the wrong
        //thing about the safest action on the panel.
        //ONLY THE TWO ACTS THAT END SOMETHING ARE RED. In this game that colour means "this
        //is the irreversible one", and it is what the attack control wears -- a peace offer
        //dressed the same way would say the wrong thing about the safest control here.
        //Dissolution is not red: it is free for both and is the honest way out.
        const danger = action.kind === "declare";
        const button = el("button", {
            id: ACTION_BUTTON_IDS[action.kind],
            class: [
                "options-button",
                danger ? "options-button-danger" : "options-button-ghost",
                action.enabled ? "" : "is-disabled",
            ],
            text: action.label,
            attrs: {
                type: "button",
                "data-action": action.kind,
                "data-country": selected,
                //A CLASS AND `aria-disabled`, never the `disabled` property -- the rule the
                //battle bar and the steppers both record. A disabled control that cannot be
                //hovered cannot explain itself, and the whole argument for this panel is that
                //it has room for the sentence that says what would change the answer.
                "aria-disabled": action.enabled ? "false" : "true",
                title: action.reason,
            },
        });
        actions.append(button);
        actions.append(el("p", { class: "diplomacy-action-reason", text: action.reason }));
    }
    detailNode.append(actions);

    //THE ANSWER, UNDER THE BUTTON THAT ASKED FOR IT. A proposal is answered on the spot, so
    //there is nowhere else for it to go -- and a modal in front of a player doing the one
    //thing this panel is for would be worse than no answer at all.
    if (lastAnswer && lastAnswer.country === selected) {
        detailNode.append(el("p", {
            id: ids.diplomacyAnswer,
            class: [
                "diplomacy-answer",
                lastAnswer.accepted ? "is-friendly" : "is-hostile",
            ],
            text: (lastAnswer.accepted
                ? selected + " agrees. "
                : selected + " refuses. ") + lastAnswer.reason,
        }));
    }
}

function listSection(heading, countries) {
    return el("div", { class: "diplomacy-detail-list" }, [
        el("h4", { text: heading }),
        el("p", { text: countries.join(", ") }),
    ]);
}

function emptyNote(text) {
    return el("p", { id: ids.diplomacyPanelEmpty, class: "diplomacy-panel-empty", text });
}

export function destroy() {
    for (const off of unsubscribe) off?.();
    unsubscribe = [];
    listeners.removeAll();
    undrag?.();
    undrag = null;
    panelRoot?.remove();
    buttonRoot?.remove();
    panelRoot = buttonRoot = summaryNode = searchInput = listNode = detailNode = null;
    selected = null;
    search = "";
}

export const diplomacyPanel = {
    create,
    open,
    close,
    toggle,
    isOpen,
    render,
    reset,
    setButtonVisible,
    destroy,
};
