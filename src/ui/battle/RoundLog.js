// The round log: every round of this battle, newest first.
//
// Battle overhaul B.6.4. The last of the four things section 2 of docs/archived/battle_overhaul.md says is
// wrong with the old window. The ledger explains the round about to be fought; this is the record
// of the ones already fought, and it is what turns "the numbers got smaller" into an account:
//
//     R4   4v3   ⚄⚃⚁ vs ⚄⚂    won 2 · lost 1     -18k / -31k
//     R3   4v3   ⚅⚂⚁ vs ⚃⚂    won 1 · lost 2     -22k / -14k
//
// It is a PURE RENDER of `battle.records` -- the array `commitRound()` appends to and nothing
// else writes. It derives no outcome and stores no sentence, for the reason the activity feed
// records: a log holding phrasing rather than facts bakes today's wording into every save.
//
// Newest FIRST, which is the opposite of the array's order. A battle can run to thirty rounds and
// the round a player wants is always the one that just happened, so the list is reversed at render
// rather than scrolled to the bottom afterwards -- scrolling is a second thing to get wrong and it
// fights the player the moment they scroll back themselves.
//
// The panel is COLLAPSED by default and remembers nothing across battles. It is the detail behind
// a decision that has already been made; a window that opens with a wall of history in it buries
// the two controls that matter.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/** Unicode die faces, indexed by pip value minus one. The same vocabulary the ledger uses. */
const DIE_GLYPHS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

let root = null;
let parts = null;
let expanded = false;

function glyphs(faces) {
    if (!Array.isArray(faces) || faces.length === 0) {
        return "—";
    }
    //Sorted descending because that is the order they were PAIRED in, so the two strings can be
    //read straight across against each other.
    return [...faces].sort((a, b) => b - a).map((face) => DIE_GLYPHS[face - 1] ?? "⬜").join("");
}

/** Personnel, not units: what a round cost is the number the army figures move by. */
function personnelLost(before, after) {
    if (!Array.isArray(before) || !Array.isArray(after)) {
        return 0;
    }
    let total = 0;
    for (let index = 0; index < before.length; index++) {
        total += Math.max(0, (before[index] ?? 0) - (after[index] ?? 0));
    }
    return total;
}

/** `12.3k`, `1.2m`. Local, because `formatNumbersToKMB` lives in the economy and imports ui.js. */
function short(value) {
    const n = Math.round(value);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

/**
 * One row of the log.
 *
 * `dug in` is called out rather than left to be inferred from a zero-loss column, because a round
 * in which nobody took casualties and a round in which one side chose not to inflict any look
 * identical in the numbers and mean opposite things.
 */
function renderRow(record) {
    const attackerNote = record.attackerDugIn ? " · you dug in" : "";
    const defenderNote = record.defenderDugIn ? " · they dug in" : "";
    const won = record.defenderLosses ?? 0;
    const lost = record.attackerLosses ?? 0;

    return el("div", { class: "battleRoundLogRow" }, [
        el("div", { class: "battleRoundLogRound", html: `R${record.round}` }),
        el("div", {
            class: "battleRoundLogDice",
            html: `${record.attackerDice}v${record.defenderDice}`
        }),
        el("div", {
            class: "battleRoundLogFaces",
            html: `${glyphs(record.attackerFaces)} <span class="battleRoundLogVersus">vs</span> `
                + `${glyphs(record.defenderFaces)}`
        }),
        el("div", {
            class: "battleRoundLogPairings",
            html: `won ${won} · lost ${lost}${attackerNote}${defenderNote}`
        }),
        el("div", {
            class: "battleRoundLogCasualties",
            //Attacker's losses then defender's, in the same order as every other pair in the
            //window: yours on the left.
            html: `−${short(personnelLost(record.attackersBefore, record.attackersAfter))}`
                + ` / −${short(personnelLost(record.defendersBefore, record.defendersAfter))}`
        })
    ]);
}

export function create() {
    if (root) return root;

    const toggle = el("button", {
        id: ids.battleRoundLogToggle,
        class: "battleRoundLogToggle",
        html: "Rounds ▸"
    });
    const list = el("div", { id: ids.battleRoundLogList, class: "battleRoundLogList" });

    //The last round, in a sentence, next to the toggle.
    //
    //The clash panel over the dice is TRANSIENT by design -- it plays, it fades, and the window
    //is back to numbers. That is right for an animation and wrong as the only account of the
    //round: a player who looked away, or who skipped, is left with two army totals that changed
    //and no statement of why. This line stays up until the next round replaces it, and it is the
    //same facts in the same words.
    const summary = el("div", { id: ids.battleRoundSummary, class: "battleRoundSummary" });

    root = el("div", { id: ids.battleRoundLog, class: "battleRoundLog" }, [toggle, summary, list]);
    parts = { toggle, summary, list };

    toggle.addEventListener("click", (event) => {
        //The battle container listens in CAPTURE for a click anywhere to settle the dice, which is
        //correct and stays. Opening the log should not also skip the animation, so this one stops
        //here.
        event.stopPropagation();
        setExpanded(!expanded);
    });

    setExpanded(false);
    return root;
}

/** Mount into an already-built battle window. Separate from `create()` so BattleUI owns the order. */
export function mountInto(parentId) {
    mount(parentId, create());
    return root;
}

export function setExpanded(value) {
    expanded = Boolean(value);
    if (!parts) return expanded;
    parts.toggle.innerHTML = expanded ? "Rounds ▾" : "Rounds ▸";
    parts.toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    parts.list.style.display = expanded ? "block" : "none";
    return expanded;
}

export function isExpanded() {
    return expanded;
}

/**
 * Redraw from the battle's records.
 *
 * @param {object[]} records `battle.records`, oldest first. Rendered newest first.
 */
export function update(records) {
    if (!parts) return;
    const rows = Array.isArray(records) ? records : [];
    parts.list.innerHTML = "";
    if (rows.length === 0) {
        parts.list.appendChild(el("div", {
            class: "battleRoundLogEmpty",
            html: "No rounds fought yet."
        }));
    } else {
        for (let index = rows.length - 1; index >= 0; index--) {
            parts.list.appendChild(renderRow(rows[index]));
        }
    }
    //The heading carries the count, so a collapsed log still says there is something in it.
    parts.toggle.innerHTML = expanded
        ? `Rounds ▾ (${rows.length})`
        : `Rounds ▸ (${rows.length})`;

    parts.summary.innerHTML = rows.length === 0 ? "" : describeRound(rows[rows.length - 1]);
}

/**
 * The last round in one sentence.
 *
 * Derived here rather than stored, for the reason the activity feed records: a record holding
 * phrasing bakes today's wording into every save file. It says the three things the numbers on
 * their own do not -- how many dice each side rolled, how many pairings each side took, and
 * whether any of them were unanswered, which is the rule a player is least likely to guess.
 */
export function describeRound(record) {
    if (!record) {
        return "";
    }
    if (record.lastPush) {
        return "Last push — the territory was taken outright.";
    }
    const won = record.defenderLosses ?? 0;
    const lost = record.attackerLosses ?? 0;
    const unanswered = Array.isArray(record.pairings)
        ? record.pairings.filter((pairing) => pairing.unmatched).length
        : 0;

    let sentence = `R${record.round}: `
        + `${record.attackerDice}v${record.defenderDice} dice — `
        + `you won ${won}, lost ${lost}`;
    if (unanswered > 0) {
        sentence += `, ${unanswered} unanswered`;
    }
    return `${sentence}.`;
}

/** Empty it. Called when a battle opens, so the previous one's rounds do not carry over. */
export function reset() {
    setExpanded(false);
    update([]);
    if (parts) {
        parts.summary.innerHTML = "";
    }
}

export function show() {
    if (root) root.style.display = "flex";
}

export function hide() {
    if (root) root.style.display = "none";
}

export function destroy() {
    root?.remove();
    root = null;
    parts = null;
    expanded = false;
}

export const roundLog = {
    create, mountInto, update, reset, setExpanded, isExpanded, show, hide, destroy, describeRound
};
