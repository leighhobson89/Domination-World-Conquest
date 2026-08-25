// The military activity feed: a button over the map, and the window it opens.
//
// Refactor plan Phase 7.4, and the biggest "feel" gap the design document lists.
// Two hundred and six AI countries fight each other every turn and, until now, the
// only trace of it a player could see was that the map had quietly changed colour
// while they were looking at their own economy. Everything that happened was going
// to `console.log`.
//
// Four decisions shape this file.
//
// **A turn is a section, and it collapses.** The feed is not a flat scroll --
// forty turns of a busy map is thousands of lines and no way to ask "what happened
// last turn". Each turn is its own group with a header; opening a new turn's
// section closes the one before it, which is the behaviour a player expects from
// something that opens itself every turn, and any older section can be reopened by
// hand. Which sections are open is view state and deliberately NOT saved: a
// restored game opens on its own current turn, which is what the player wants to
// see, not on whatever they happened to have expanded when they saved.
//
// **The panel renders from the log, never from an appended row.** An entry arriving
// while the panel is open re-renders it. That is more work than appending one row
// and it is the right trade: the alternative keeps a second copy of the log in the
// DOM and has to be told about restores, clears and turn boundaries as well as
// additions -- four things to get right instead of one.
//
// **It sits OVER the territory panel.** The brief asks for it to appear at the
// start of a turn on top of that panel, so it takes a higher z-index and is a
// window in its own right rather than a fifth tab. They answer different
// questions: the info panel is the state of the world, this is what just happened
// to it.
//
// **Opening at the start of a turn is a preference, and it is the same control as
// the info panel's.** The repeat-panel icon, the same class, the same `is-on`
// state -- because two panels that both offer "show me this every turn" and offer
// it differently is how a settings screen starts.

import { classNames, ids } from "../core/registry.js";
import { clear, el, listenerGroup, mount } from "../core/dom.js";
import { bringToFront, makeDraggable } from "../core/draggable.js";
import { activityTurns } from "../../state/activityLog.js";
import { Events, on as onStateEvent } from "../../state/events.js";
import { describeActivity, summariseTurn } from "../activityFeed/describeActivity.js";
import {
    activityLogIcon,
    castleShieldIcon,
    chevronIcon,
    crossedSwordsIcon,
    repeatPanelIcon,
} from "../icons.js";

let buttonRoot = null;
let panelRoot = null;
let bodyElement = null;
let repeatButton = null;
let unsubscribe = null;
let undrag = null;
const listeners = listenerGroup();

/** Which turn sections the player has open. View state; never saved. */
let openTurns = new Set();

/** Does the panel open itself at the start of every turn? */
let appearsAtStartOfTurn = true;

/** Injected: the click sound, so this component does not import the audio layer. */
let playSound = null;

/**
 * Build the button and the panel.
 *
 * @param {object} deps
 * @param {() => void} [deps.onSound]  the click sound
 */
export function create({ onSound } = {}) {
    if (panelRoot) return panelRoot;
    playSound = onSound ?? null;

    const toggleButton = el(
        "button",
        {
            id: ids.activityToggleButton,
            class: "chrome-button activity-panel-button",
            attrs: {
                type: "button",
                title: "Military activity",
                "aria-label": "Military activity log",
            },
            on: {
                click() {
                    playSound?.();
                    toggle();
                },
            },
        },
        activityLogIcon()
    );
    buttonRoot = mount(ids.activityButtonContainer, toggleButton);

    repeatButton = el(
        "button",
        {
            id: ids.checkBoxActivityAtStartOfTurn,
            // The info panel's control, the same class and the same `is-on` state.
            // See the note at the top of the file.
            class: ["checkBox-appear-start-of-turn", "is-on"],
            attrs: {
                type: "button",
                "aria-pressed": "true",
                title: "Open this log at the start of every turn",
            },
            on: {
                click() {
                    playSound?.();
                    setAppearAtStartOfTurn(!appearsAtStartOfTurn);
                },
            },
        },
        repeatPanelIcon()
    );

    const closeButton = el("button", {
        id: ids.xButtonActivity,
        class: "x-button",
        html: "X",
        attrs: { type: "button", "aria-label": "Close the activity log" },
        on: {
            click() {
                playSound?.();
                close();
            },
        },
    });

    bodyElement = el("div", { id: ids.activityPanelBody, class: "activity-panel-body" });

    const header = el("div", { class: "activity-panel-header" }, [
        el("div", {
            id: ids.activityPanelTitle,
            class: "activity-panel-title",
            text: "Military Activity",
        }),
        repeatButton,
        closeButton,
    ]);

    panelRoot = el("div", { id: ids.activityPanel, class: "activity-panel" }, [
        header,
        bodyElement,
    ]);

    mount(ids.activityPanelContainer, panelRoot);
    //Phase 7.4. The header is the grip. The two buttons in it are excluded by
    //`makeDraggable()` itself -- a close button that is also a drag handle stops
    //closing the window the moment the pointer moves a pixel.
    undrag = makeDraggable(document.getElementById(ids.activityPanelContainer), header);

    unsubscribe = onStateEvent(Events.ACTIVITY_LOGGED, () => {
        // Only while it is up. A turn of AI fighting can write eighty entries and
        // re-rendering a hidden panel eighty times is eighty layouts nobody sees.
        if (isOpen()) render();
    });

    render();
    return panelRoot;
}

// --- visibility ------------------------------------------------------------

export function isOpen() {
    const container = document.getElementById(ids.activityPanelContainer);
    return Boolean(container) && container.style.display === "block";
}

export function open() {
    const container = document.getElementById(ids.activityPanelContainer);
    if (!container) return;
    container.style.display = "block";
    //Opening IS focusing. The brief asks for this panel to appear over the territory
    //panel at the start of a turn, and since Phase 7.4 made every window raisable
    //that is no longer a fixed z-index -- it is this call. The player can then raise
    //the territory panel back over it, which is the point of the whole mechanism.
    bringToFront(container);
    render();
}

export function close() {
    const container = document.getElementById(ids.activityPanelContainer);
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
    const container = document.getElementById(ids.activityButtonContainer);
    if (container) container.style.display = visible ? "block" : "none";
}

// --- the start-of-turn preference ------------------------------------------

export function appearsAtStartOfTurnEnabled() {
    return appearsAtStartOfTurn;
}

export function setAppearAtStartOfTurn(enabled) {
    appearsAtStartOfTurn = Boolean(enabled);
    if (repeatButton) {
        repeatButton.classList.toggle("is-on", appearsAtStartOfTurn);
        repeatButton.setAttribute("aria-pressed", appearsAtStartOfTurn ? "true" : "false");
    }
}

/**
 * A new turn has begun.
 *
 * Closes whatever the player had expanded and opens the new turn, which is the
 * behaviour the brief asks for and the only one that makes sense for a panel that
 * raises itself: arriving on turn 12 with turn 7 expanded and turn 12 shut would
 * be worse than not opening at all. Older sections stay one click away.
 *
 * It opens the PREVIOUS turn as well when the new one has nothing in it yet, and
 * that is not a hedge -- it is the turn boundary being in a different place from
 * where a player thinks it is. `endTurn: advanceTurn` in `gameTurnsLoop.js` means
 * the AI moves during turn N and the counter reaches N+1 afterwards, so everything
 * the player is about to be shown -- every conquest, every failed attack -- is
 * filed under the turn that has just ENDED. Opening only turn N+1 would raise a
 * panel showing an empty section directly above the one thing the player wanted to
 * see. Turn N+1 usually has its own content too (the siege lines written moments
 * earlier by `recordOngoingSieges`), in which case both are worth having open.
 *
 * Raising the panel is separate and gated on the preference; re-pointing it at the
 * new turn is not, so the right sections are waiting whenever the player opens it
 * by hand.
 */
export function onTurnStarted(turn) {
    // Exactly one section: the turn that has just begun. Everything else folds
    // away and the list goes back to the top, so a panel that raises itself every
    // turn always presents the same thing -- the newest news, at the top, with the
    // history underneath it and out of the way.
    //
    // `render()` still has the last word when that section does not exist yet: it
    // will not draw a panel in which every section is shut, and falls back to the
    // newest turn that has anything in it. That matters on the turn boundary,
    // because `endTurn: advanceTurn` means the AI moves during turn N and the
    // counter reaches N+1 afterwards -- so a quiet N+1 with no siege lines has no
    // section at all, and the fallback lands on the conquests the player came to
    // read.
    openTurns = new Set([turn]);

    // Nothing has happened on turn 1, so there is nothing to raise a panel for --
    // the same rule the info panel applies, and for the same reason.
    if (appearsAtStartOfTurn && turn > 1) {
        open();
    } else if (isOpen()) {
        render();
    }
    scrollToTop();
}

/**
 * Put the list back to the top.
 *
 * Re-rendering does not do this on its own: the body is a scroll container and
 * the browser keeps its `scrollTop` across a `replaceChildren`, so a player who
 * had scrolled down to turn 4 would get the new turn's section drawn at the top
 * of a list they are looking at the middle of.
 */
function scrollToTop() {
    if (bodyElement) {
        bodyElement.scrollTop = 0;
    }
}

/** New game, restart, or a load: forget which sections were expanded. */
export function reset() {
    openTurns = new Set();
    close();
    render();
}

// --- rendering -------------------------------------------------------------

function render() {
    if (!bodyElement) return;
    clear(bodyElement);

    const turns = activityTurns();
    if (turns.length === 0) {
        mount(
            bodyElement,
            el("p", {
                id: ids.activityPanelEmpty,
                class: "activity-panel-empty",
                text: "No military activity yet. Conquests, sieges and battles will appear here as they happen.",
            })
        );
        return;
    }

    // Never draw a panel in which every section is shut. That is what a player
    // sees if the turn the feed was pointed at has no entries -- which is the
    // ordinary case on turn 1, where `onTurnStarted()` runs before anything has
    // happened. The newest turn is the fallback, because it is the one they came
    // to look at.
    if (!turns.some(({ turn }) => openTurns.has(turn))) {
        openTurns.add(turns[0].turn);
    }

    for (const { turn, entries } of turns) {
        mount(bodyElement, turnSection(turn, entries));
    }
}

function turnSection(turn, entries) {
    const isOpenSection = openTurns.has(turn);

    const header = el(
        "button",
        {
            class: classNames.activityTurnHeader,
            attrs: {
                type: "button",
                "aria-expanded": isOpenSection ? "true" : "false",
                "data-turn": String(turn),
            },
            on: {
                click() {
                    playSound?.();
                    if (openTurns.has(turn)) {
                        openTurns.delete(turn);
                    } else {
                        openTurns.add(turn);
                    }
                    render();
                },
            },
        },
        [
            chevronIcon(),
            el("span", { class: "activity-turn-label", text: `Turn ${turn}` }),
            el("span", { class: "activity-turn-summary", text: summariseTurn(entries) }),
        ]
    );

    const list = el(
        "div",
        { class: classNames.activityTurnEntries },
        entries.map(entryRow)
    );

    const group = el("div", { class: classNames.activityTurnGroup }, [header, list]);
    group.classList.toggle(classNames.activityIsOpen, isOpenSection);
    group.setAttribute("data-turn", String(turn));
    return group;
}

function entryRow(entry) {
    const { text, tone, isPlayer, icon } = describeActivity(entry);

    const row = el(
        "div",
        {
            class: [classNames.activityEntry, tone],
            attrs: { "data-kind": entry.kind },
        },
        [
            // Crossed swords for a battle, the siege shield for a siege -- the same
            // two icons the Wars & Sieges tab uses, so one picture means one thing
            // across the whole game.
            icon === "siege" ? castleShieldIcon() : crossedSwordsIcon(),
            el("span", { class: classNames.activityEntryText, text: text }),
        ]
    );

    if (isPlayer) {
        row.classList.add(classNames.activityIsPlayer);
    }
    return row;
}

// --- teardown --------------------------------------------------------------

export function destroy() {
    unsubscribe?.();
    unsubscribe = null;
    undrag?.();
    undrag = null;
    listeners.removeAll();
    panelRoot?.remove();
    buttonRoot?.replaceChildren();
    panelRoot = null;
    buttonRoot = null;
    bodyElement = null;
    repeatButton = null;
    openTurns = new Set();
}

export const activityPanel = {
    create,
    destroy,
    open,
    close,
    toggle,
    isOpen,
    reset,
    onTurnStarted,
    setButtonVisible,
    setAppearAtStartOfTurn,
    appearsAtStartOfTurnEnabled,
};
