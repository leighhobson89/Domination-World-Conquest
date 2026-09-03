// The spectator window: the controls that pace a self-playing game, and the log it
// writes.
//
// It is deliberately NOT the activity feed with different content. That panel groups
// a turn into a section that expands and collapses, and re-renders the whole list on
// every entry; both are right for a player asking "what happened to me last turn" and
// both are wrong for watching. A list whose rows move as you read them cannot be read,
// and a full map writes two hundred blocks a turn.
//
// So four things are different here.
//
// **It is one continuous stream, oldest at the top.** Nothing collapses, nothing
// re-orders, and a block's text never changes after it is written. A turn is marked by
// a rule across the log rather than by a container, which is what lets the rule stay
// put when the block above it falls off the front of the ring.
//
// **It appends rather than re-renders.** A new block is one `mount()` onto the end, so
// the cost of a block does not grow with the length of the log, and the browser keeps
// the scroll position of everything above it for free. The DOM is trimmed from the
// front to the same bound the ring uses, so an overnight run does not grow a hundred
// thousand rows.
//
// **It follows the tail, unless you scroll up.** Auto-scrolling a log somebody is
// reading is the same defect as re-ordering it. The button in the header says which
// mode it is in and puts it back.
//
// **The filter hides rows rather than rebuilding the list.** Typing three or more
// characters shows only the countries whose name contains them; fewer than three, or
// an empty field, shows everything again. It is a visibility pass over the rows that
// are already there, so filtering never re-renders and never disturbs the scroll --
// and a block that arrives while a filter is on is filtered as it lands.
//
// The controls are the mode's, not the window's: the slider and the pause button write
// through `src/debug/aiGameMode.js` and read back from its change event, so the window
// never holds a second copy of the speed. That is the same contract the audio panel
// and the Options panel share for the two mutes.

import { classNames, ids } from "../core/registry.js";
import { clear, el, mount } from "../core/dom.js";
import { bringToFront, makeDraggable } from "../core/draggable.js";
import {
    AiGameTone,
    MAX_BLOCKS_KEPT,
    aiGameBlocks,
    onAiGameBlock
} from "../../debug/aiGameLog.js";
import {
    SPEED_SLIDER_STEPS,
    aiGameState,
    describeAiGameSpeed,
    onAiGameChanged,
    secondsForSliderPosition,
    setAiGameSecondsPerCountry,
    sliderPositionForSeconds,
    toggleAiGamePaused
} from "../../debug/aiGameMode.js";
import {
    filterIsActive as filterIsActiveFor,
    matchesCountryFilter,
    normaliseFilter
} from "../../debug/aiGameFilter.js";
import { pauseIcon, playIcon } from "../icons.js";

/** Tone -> the class `style.css` colours it with. One place, so a tone is one word. */
const TONE_CLASS = Object.freeze({
    [AiGameTone.NEUTRAL]: classNames.aiGameToneNeutral,
    [AiGameTone.THOUGHT]: classNames.aiGameToneThought,
    [AiGameTone.PLAN]: classNames.aiGameTonePlan,
    [AiGameTone.ECONOMY]: classNames.aiGameToneEconomy,
    [AiGameTone.VICTORY]: classNames.aiGameToneVictory,
    [AiGameTone.LOSS]: classNames.aiGameToneLoss,
    [AiGameTone.SIEGE]: classNames.aiGameToneSiege
});

/** How close to the bottom still counts as "at the bottom", in pixels. */
const TAIL_SLACK = 40;

let panelRoot = null;
let bodyElement = null;
let emptyElement = null;
let noMatchElement = null;
let turnElement = null;
let speedLabel = null;
let speedSlider = null;
let pauseButton = null;
let followButton = null;
let filterInput = null;
let filterCount = null;
let undrag = null;
let unsubscribeLog = null;
let unsubscribeMode = null;

/** Does the log scroll itself to the newest block? Off once the reader scrolls up. */
let following = true;

/** The turn the last block drawn belonged to, so the rule is drawn once per turn. */
let lastTurnDrawn = null;

/**
 * Every block on screen, oldest first.
 *
 * The DOM alone cannot answer the two questions this needs -- which turn rule belongs
 * to which block, and which block is the oldest -- without walking and re-parsing it,
 * so the list is kept alongside. Each row is `{turn, country, blockEl, ruleEl}` where
 * `ruleEl` is the turn rule this block introduced, or null.
 *
 * @type {Array<{turn: number, country: string, blockEl: Element, ruleEl: Element|null}>}
 */
let rendered = [];

/** The filter as typed, lower-cased. Ignored until MIN_FILTER_LENGTH characters. */
let filterText = "";

/** Injected: the click sound, so this component does not import the audio layer. */
let playSound = null;

/** Called when the reader asks to leave spectator mode. */
let onStop = null;

/**
 * Build the window. It starts hidden; `open()` is called by the mode, not by a button
 * over the map -- there is no map chrome for this because it is not part of the game.
 *
 * @param {object} deps
 * @param {() => void} [deps.onSound]
 * @param {() => void} [deps.onStop]  leave spectator mode and go back to the menu
 */
export function create({ onSound, onStop: stopHandler } = {}) {
    if (panelRoot) return panelRoot;
    playSound = onSound ?? null;
    onStop = stopHandler ?? null;

    pauseButton = el(
        "button",
        {
            id: ids.aiGamePauseBtn,
            class: "ai-game-control",
            attrs: { type: "button", title: "Pause or resume the game", "aria-label": "Pause" }
        },
        pauseIcon()
    );
    pauseButton.addEventListener("click", () => {
        playSound?.();
        toggleAiGamePaused();
    });

    // The track is POSITIONS, not seconds. The useful range spans a factor of fifty
    // and the pace anybody watches at -- one second -- sits a fiftieth of the way
    // along it, so a slider measured in seconds would bury everything readable in its
    // first two pixels. `secondsForSliderPosition()` puts 1s dead centre, ten
    // countries a second at the left and five seconds each at the right; see the note
    // on it in src/debug/aiGameMode.js.
    speedSlider = el("input", {
        id: ids.aiGameSpeedSlider,
        class: "ai-game-speed-slider",
        attrs: {
            type: "range",
            min: "0",
            max: String(SPEED_SLIDER_STEPS),
            step: "1",
            "aria-label": "How long each AI country's turn is held on screen"
        }
    });
    // `input`, not `change`: the label has to follow the thumb while it is being
    // dragged, and the next country is due in a second either way.
    speedSlider.addEventListener("input", () => {
        setAiGameSecondsPerCountry(secondsForSliderPosition(Number(speedSlider.value)));
    });

    speedLabel = el("span", { id: ids.aiGameSpeedLabel, class: "ai-game-speed-label" });

    followButton = el("button", {
        id: ids.aiGameFollowBtn,
        class: "ai-game-control ai-game-follow",
        text: "TAIL",
        attrs: { type: "button", title: "Scroll with the newest entry" }
    });
    followButton.addEventListener("click", () => {
        playSound?.();
        setFollowing(true);
        scrollToTail();
    });

    filterInput = el("input", {
        id: ids.aiGameFilter,
        class: "ai-game-filter",
        attrs: {
            type: "search",
            placeholder: "Filter by country (3+ letters)",
            "aria-label": "Show only countries whose name contains this",
            spellcheck: "false",
            autocomplete: "off"
        }
    });
    // `input` rather than `change`, so the log narrows as the name is typed. The pass
    // it triggers is a loop over at most MAX_BLOCKS_KEPT rows setting one property,
    // which is cheaper than the layout the browser was going to do anyway.
    filterInput.addEventListener("input", () => setFilter(filterInput.value));
    // A search field's clear button fires `search`, not `input`, in some browsers.
    filterInput.addEventListener("search", () => setFilter(filterInput.value));

    filterCount = el("span", { id: ids.aiGameFilterCount, class: "ai-game-filter-count" });

    const closeButton = el("button", {
        id: ids.xButtonAiGame,
        class: "x-button",
        html: "X",
        attrs: { type: "button", "aria-label": "End the AI game" }
    });
    closeButton.addEventListener("click", () => {
        playSound?.();
        // Closing IS stopping. A spectated game with its console shut is a page that
        // looks idle while two hundred countries fight behind it, and there is no
        // button anywhere that would bring the window back.
        onStop?.();
    });

    turnElement = el("span", { id: ids.aiGameConsoleTurn, class: "ai-game-console-turn" });

    const header = el("div", { class: "ai-game-console-header" }, [
        el("div", {
            id: ids.aiGameConsoleTitle,
            class: "ai-game-console-title",
            text: "AI Game"
        }),
        turnElement,
        closeButton
    ]);

    const controls = el("div", { class: "ai-game-console-controls" }, [
        pauseButton,
        el("span", { class: "ai-game-speed-caption", text: "Speed" }),
        speedSlider,
        speedLabel,
        followButton
    ]);

    const filterRow = el("div", { class: "ai-game-console-filter-row" }, [
        filterInput,
        filterCount
    ]);

    emptyElement = el("p", {
        id: ids.aiGameConsoleEmpty,
        class: "ai-game-console-empty",
        text: "Waiting for the first AI country to take its turn…"
    });

    // Shown INSTEAD of a blank body when a filter matches nothing. An empty window
    // with no explanation reads as the log having broken rather than as the filter
    // having worked, which is a bug report waiting to happen.
    noMatchElement = el("p", {
        id: ids.aiGameConsoleNoMatch,
        class: "ai-game-console-empty",
        hidden: true
    });

    bodyElement = el("div", { id: ids.aiGameConsoleBody, class: "ai-game-console-body" }, [
        emptyElement,
        noMatchElement
    ]);

    // Following the tail is the default and the reader turns it off by scrolling away
    // from the bottom -- not by pressing anything. A log that keeps yanking itself back
    // down while somebody is reading the middle of it is the whole reason this is a
    // setting at all.
    bodyElement.addEventListener("scroll", () => {
        const distance =
            bodyElement.scrollHeight - bodyElement.scrollTop - bodyElement.clientHeight;
        setFollowing(distance <= TAIL_SLACK);
    });

    panelRoot = el("div", { id: ids.aiGameConsole, class: "ai-game-console" }, [
        header,
        controls,
        filterRow,
        bodyElement
    ]);

    mount(ids.aiGameConsoleContainer, panelRoot);
    undrag = makeDraggable(document.getElementById(ids.aiGameConsoleContainer), header);

    unsubscribeLog = onAiGameBlock((block) => {
        if (!isOpen()) return;
        if (block === null) {
            renderAll();
        } else {
            appendBlock(block);
        }
    });

    unsubscribeMode = onAiGameChanged(applyModeState);
    applyModeState(aiGameState());
    updateFilterCount();

    return panelRoot;
}

// --- visibility ------------------------------------------------------------

function container() {
    return document.getElementById(ids.aiGameConsoleContainer);
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
    renderAll();
}

export function close() {
    const node = container();
    if (node) node.style.display = "none";
}

/** Say which turn is being played. Written by the turn loop, not derived here. */
export function setTurn(turn) {
    if (turnElement) turnElement.textContent = "Turn " + turn;
}

// --- the controls ----------------------------------------------------------

function applyModeState(state) {
    if (speedSlider && document.activeElement !== speedSlider) {
        speedSlider.value = String(sliderPositionForSeconds(state.secondsPerCountry));
    }
    if (speedLabel) {
        speedLabel.textContent = describeAiGameSpeed(state.secondsPerCountry);
    }
    if (pauseButton) {
        // The icon says what pressing it DOES, which is the convention every transport
        // control in this game already follows (`AudioPanel.js`).
        clear(pauseButton);
        pauseButton.appendChild(state.paused ? playIcon() : pauseIcon());
        pauseButton.classList.toggle("is-paused", state.paused);
        pauseButton.setAttribute("aria-label", state.paused ? "Resume" : "Pause");
        pauseButton.setAttribute("title", state.paused ? "Resume the game" : "Pause the game");
    }
}

function setFollowing(value) {
    following = Boolean(value);
    followButton?.classList.toggle("is-on", following);
}

function scrollToTail() {
    if (bodyElement) bodyElement.scrollTop = bodyElement.scrollHeight;
}

// --- the filter ------------------------------------------------------------

/** Is a filter in force? The rule is in `src/debug/aiGameFilter.js`. */
function filterIsActive() {
    return filterIsActiveFor(filterText);
}

/** Does this country pass the filter as it stands? */
function countryMatchesFilter(country) {
    return matchesCountryFilter(country, filterText);
}

/** Set the filter and re-run the visibility pass. */
export function setFilter(text) {
    filterText = normaliseFilter(text);
    refreshVisibility();
    if (filterInput && filterInput.value !== text) {
        filterInput.value = text ?? "";
    }
}

/**
 * Show or hide every row for the filter as it now stands.
 *
 * A turn rule is shown when any block it introduces is shown, which is walked here in
 * one backwards-free pass: the rule is remembered as it goes by and unhidden the first
 * time a visible block under it turns up.
 */
function refreshVisibility() {
    let currentRule = null;
    let ruleHasVisibleBlock = false;

    for (const row of rendered) {
        if (row.ruleEl) {
            // The previous turn is finished; commit its rule before moving on.
            if (currentRule) currentRule.hidden = !ruleHasVisibleBlock;
            currentRule = row.ruleEl;
            ruleHasVisibleBlock = false;
        }
        const visible = countryMatchesFilter(row.country);
        row.blockEl.hidden = !visible;
        if (visible) ruleHasVisibleBlock = true;
    }
    if (currentRule) currentRule.hidden = !ruleHasVisibleBlock;

    updateFilterCount();
    // A filter that hides everything below the viewport leaves the reader looking at
    // blank space, so the tail is re-found -- but only when they were following it.
    if (following) scrollToTail();
}

function updateFilterCount() {
    if (!filterCount) return;
    const shown = filterIsActive()
        ? rendered.filter((row) => countryMatchesFilter(row.country)).length
        : rendered.length;
    filterCount.textContent = filterIsActive() ? shown + " of " + rendered.length : "";
    if (noMatchElement) {
        const nothing = filterIsActive() && shown === 0 && rendered.length > 0;
        noMatchElement.textContent = nothing
            ? `No country in the log matches “${filterText}”.`
            : "";
        noMatchElement.hidden = !nothing;
    }
}

// --- rendering -------------------------------------------------------------

/**
 * Redraw everything held.
 *
 * Only on open and on a clear. Every other arrival appends, which is what keeps the
 * cost of a block flat -- see the note at the top of the file.
 */
function renderAll() {
    if (!bodyElement) return;
    clear(bodyElement);
    rendered = [];
    lastTurnDrawn = null;

    const blocks = aiGameBlocks();
    mount(bodyElement, noMatchElement);
    if (blocks.length === 0) {
        mount(bodyElement, emptyElement);
        updateFilterCount();
        return;
    }
    for (const block of blocks) {
        addBlock(block);
    }
    setFollowing(true);
    refreshVisibility();
    scrollToTail();
}

function appendBlock(block) {
    if (!bodyElement) return;
    if (emptyElement.parentNode === bodyElement) {
        emptyElement.remove();
    }
    const row = addBlock(block);
    trimToBound();

    // Only the new row needs deciding; everything above it is already right.
    const visible = countryMatchesFilter(row.country);
    row.blockEl.hidden = !visible;
    if (row.ruleEl) {
        row.ruleEl.hidden = !visible;
    } else if (visible) {
        // Its turn's rule may have been hidden because nothing under it matched yet.
        ruleForTurn(row.turn)?.removeAttribute("hidden");
    }
    updateFilterCount();

    if (following) scrollToTail();
}

/** The rule element that introduced `turn`, if it is still on screen. */
function ruleForTurn(turn) {
    for (let i = rendered.length - 1; i >= 0; i--) {
        if (rendered[i].turn === turn && rendered[i].ruleEl) return rendered[i].ruleEl;
        if (rendered[i].turn !== turn) return null;
    }
    return null;
}

/** Build the nodes for one block, mount them, and record the row. */
function addBlock(block) {
    let ruleEl = null;
    if (block.turn !== lastTurnDrawn) {
        lastTurnDrawn = block.turn;
        ruleEl = el("div", {
            class: classNames.aiGameTurnRule,
            text: "TURN " + block.turn,
            attrs: { "data-turn": String(block.turn) }
        });
        mount(bodyElement, ruleEl);
    }
    const blockEl = blockNode(block);
    mount(bodyElement, blockEl);

    const row = { turn: block.turn, country: block.country, blockEl, ruleEl };
    rendered.push(row);
    return row;
}

/**
 * Keep the DOM to the same bound the log ring uses.
 *
 * Without this the window appends for as long as the game runs -- a spectated game is
 * meant to run for hours, and the ring bounding the DATA does nothing for a hundred
 * thousand rows of DOM.
 */
function trimToBound() {
    while (rendered.length > MAX_BLOCKS_KEPT) {
        const oldest = rendered.shift();
        oldest.blockEl.remove();
        // The rule it carried stays if the next survivor is in the same turn: the rule
        // already sits immediately above that block, so removing the block alone
        // leaves the log correct. It goes only when its whole turn has gone.
        if (oldest.ruleEl) {
            const next = rendered[0];
            if (next && next.turn === oldest.turn) {
                next.ruleEl = oldest.ruleEl;
            } else {
                oldest.ruleEl.remove();
            }
        }
    }
}

function blockNode(block) {
    const header = el("div", { class: classNames.aiGameBlockHeader }, [
        el("span", { class: classNames.aiGameBlockCountry, text: block.country }),
        block.leaderName
            ? el("span", {
                class: classNames.aiGameBlockLeader,
                text: block.leaderName + (block.leaderType ? " · " + block.leaderType : "")
            })
            : null,
        block.posture
            ? el("span", { class: classNames.aiGameBlockPosture, text: block.posture })
            : null
    ]);

    const lines = block.lines.map((line) =>
        el(
            "div",
            {
                class: [
                    classNames.aiGameLine,
                    TONE_CLASS[line.tone] ?? classNames.aiGameToneNeutral
                ]
            },
            [
                line.label
                    ? el("span", { class: classNames.aiGameLineLabel, text: line.label })
                    : null,
                el("span", { class: classNames.aiGameLineText, text: line.text })
            ]
        )
    );

    return el(
        "div",
        { class: classNames.aiGameBlock, attrs: { "data-country": block.country } },
        [header, ...lines]
    );
}

// --- teardown --------------------------------------------------------------

export function destroy() {
    unsubscribeLog?.();
    unsubscribeMode?.();
    undrag?.();
    const node = container();
    if (node) clear(node);
    panelRoot = null;
    bodyElement = null;
    emptyElement = null;
    noMatchElement = null;
    turnElement = null;
    speedLabel = null;
    speedSlider = null;
    pauseButton = null;
    followButton = null;
    filterInput = null;
    filterCount = null;
    unsubscribeLog = null;
    unsubscribeMode = null;
    undrag = null;
    lastTurnDrawn = null;
    rendered = [];
    filterText = "";
    following = true;
}

export const aiGameConsole = {
    create,
    destroy,
    open,
    close,
    isOpen,
    setTurn,
    setFilter
};
