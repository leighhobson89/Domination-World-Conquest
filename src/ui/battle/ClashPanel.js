// The clash: what the dice MEANT, shown as the dice meaning it.
//
// The complaint this answers, in the words it was made in: "we see that we have more dice, great
// I suppose that means we have more forces. If we get a six and they get a one what does that
// mean? What happens to the extra dice we have that they don't?" Every one of those questions is
// already answered by `resolvePairings()` in src/rules/military/dice.js, and until now none of the
// answers reached the screen. The ledger says how many dice each side rolls and why; the round log
// records what a round cost. Nothing said what happened BETWEEN the two, which is the only part
// with a rule in it.
//
// So this is the missing middle, and it is deliberately the same shape as the rule:
//
//   * both sides' dice are SORTED and PAIRED high against high -- so the panel lays them out in
//     that order, in matched pairs, rather than in the order they were rolled;
//   * the higher value takes the pairing, and a TIE GOES TO THE DEFENDER -- so the loser of each
//     pairing visibly shatters, and a tie shatters the attacker's die with the tie called out by
//     name, because a player watching a 4 lose to a 4 will otherwise believe it is a bug;
//   * a die the other side cannot answer is an AUTOMATIC hit -- so an unmatched die is drawn
//     against an empty socket, which is what makes "bring more dice" legible as the point of the
//     whole model;
//   * a MODIFIER changes the number a die FIGHTS WITH, not the number it shows -- so a modified
//     die carries its badge, and a 3 beating a 4 has a visible reason.
//
// THREE THINGS ABOUT ITS PLACE IN THE WINDOW.
//
// IT IS TRANSIENT AND IT OWNS NO STATE. It plays, it fades, and the durable record of the round
// stays where it was: the ledger for the explanation, the round log for the history. A permanent
// panel would have to come out of the battle window's row percentages, which sum to 100 and are
// re-cut by hand.
//
// IT IS NOT INSIDE THE BATTLE WINDOW, AND IT CANNOT BE. `#battleContainer` carries
// `transform: translate(-50%, -50%)`, and a transform creates a stacking context -- so no
// descendant of it can paint above `#threeCanvasForDice`, which is a later sibling. The panel has
// its own container after the canvas in `index.html` for exactly that reason, and the cost is that
// showing and hiding it is explicit rather than inherited.
//
// IT NEVER GATES THE ROUND. Same contract as the dice (see the header of `DiceStage.js`): the
// numbers in the battle window are already correct when this starts, `play()` is not awaited, and
// a click anywhere over the battle window runs `finish()` to jump to the end state. A player who
// does not want to watch never has to, and no e2e spec's timing depends on a render loop.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/**
 * Which cells of a three-by-three grid carry a pip, by face value.
 *
 * Pips rather than the Unicode die glyphs the ledger and the round log use. Those are a typeface's
 * idea of a die drawn at whatever size the font offers, and blown up to the size this panel wants
 * they are a grey smudge -- the same complaint the 3D dice drew. These are elements: they scale
 * cleanly and they take the side's own colour.
 */
const PIPS = Object.freeze({
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
});

/** How long one pairing takes to close, clash and resolve. */
const PAIR_STEP_MS = 420;

/** The beat between two dice meeting and the impact landing. */
const IMPACT_MS = 170;

/**
 * How long the finished panel stays up before it fades on its own.
 *
 * It has to outlast the DICE, which are drawn on top of it and fade two seconds after they come
 * to rest (`SETTLED_LINGER_MS` in DiceStage.js). The order the player is meant to experience is:
 * watch the throw, read the faces, the dice clear, read the account of the round -- and that last
 * step is the one the panel exists for, so it gets the most time rather than the least.
 *
 * The linger runs from the last PAIRING resolving, which now follows the dice settling rather
 * than a guess at when they might (see `reveal()`), so the whole sequence hangs off one real
 * event and this number is the only slack in it.
 */
const LINGER_MS = 7200;

/** How long the fade-out runs. Must match `.clashPanel`'s transition in style.css. */
const FADE_MS = 260;

let root = null;
let parts = null;

/** Every pending timer, so a skip or a close can cancel the sequence mid-flight. */
let timers = [];

/** True from `play()` until the pairings have finished stepping. */
let playing = false;

/** True once `reveal()` has filled the faces in. Guards a second reveal on the same round. */
let revealed = false;

function clearTimers() {
    for (const timer of timers) {
        clearTimeout(timer);
    }
    timers = [];
}

function later(fn, delay) {
    timers.push(setTimeout(fn, delay));
}

/** `12.3k`, `1.2m`. Local, for the reason RoundLog.js records: the economy's formatter imports ui.js. */
function short(value) {
    const n = Math.round(value);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

/** Personnel lost between two army arrays. */
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

/** `+1` / `-1`, never a bare `1`: the sign is the information. */
function signed(value) {
    return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/** The shard layer for one side: six fragments the die breaks into when it loses. */
function shardLayer(side) {
    return el("div", { class: ["clashShards", `clashShards-${side}`] },
        Array.from({ length: 6 }, (unused, shard) =>
            el("div", { class: ["clashShard", `clashShard-${shard + 1}`] })));
}

/**
 * One die face, or an empty socket.
 *
 * The socket is not decoration. It is the drawn form of "they had nothing to answer this with",
 * which is the rule that makes a fourth die worth more than a better third one: an unanswered die
 * is a hit every round, and no face bonus on the other side can touch it.
 */
function dieFace(face, side, modifier) {
    if (face === null || face === undefined) {
        return el("div", { class: ["clashDie", "clashDieEmpty", `clashDie-${side}`] }, [
            el("div", { class: "clashDieSocket", html: "no die" })
        ]);
    }
    const grid = el("div", { class: "clashDiePips" },
        Array.from({ length: 9 }, (unused, cell) =>
            el("div", {
                class: (PIPS[face] ?? []).includes(cell) ? ["clashPip", "is-on"] : "clashPip"
            })));

    const children = [grid];
    if (modifier) {
        //The badge is on the die rather than in a footnote, because the question it answers --
        //"why did their 3 beat my 4" -- is asked while looking at the two dice.
        children.push(el("div", { class: "clashDieBadge", html: signed(modifier) }));
    }
    return el("div", {
        class: ["clashDie", `clashDie-${side}`],
        //`attrs`, not a bare property: `el()` assigns anything it does not recognise straight onto
        //the element, and `node["data-face"] = "5"` is an expando that no selector can see.
        attrs: { "data-face": String(face) }
    }, children);
}

/** `4 dice`, `1 die`, or a dash when the record does not carry a count. */
function diceWord(count) {
    if (!Number.isFinite(count)) {
        return "—";
    }
    return `${count} ${count === 1 ? "die" : "dice"}`;
}

/** How much a side's modifier moved this die: what it fights with, less what it shows. */
function modifierOf(face, value) {
    if (face === null || face === undefined || value === null || value === undefined) {
        return 0;
    }
    return value - face;
}

/** The line between the two dice: why this pairing went the way it did. */
function verdictFor(pairing) {
    if (pairing.unmatched) {
        return "unanswered — automatic hit";
    }
    if (pairing.tied) {
        //Named, not left to be inferred. Ties going to the defender is the defender's whole
        //structural advantage in this model, and a player who is not told will read a 4 losing to
        //a 4 as the dice being broken.
        return "tie — defender holds";
    }
    const high = Math.max(pairing.attackerValue ?? 0, pairing.defenderValue ?? 0);
    const low = Math.min(pairing.attackerValue ?? 0, pairing.defenderValue ?? 0);
    return `${high} beats ${low}`;
}

/** One pairing: two dice, the verdict between them, and the shards the loser breaks into. */
function pairRow(pairing, index) {
    const winner = pairing.attackerWins ? "attacker" : "defender";
    const classes = ["clashPair", `clashPair-${winner}`];
    if (pairing.unmatched) {
        classes.push("clashPair-unmatched");
    }

    return el("div", {
        class: classes,
        attrs: { "data-pair": String(index), "data-winner": winner }
    }, [
        el("div", { class: "clashSide clashSide-attacker" }, [
            dieFace(pairing.attackerFace, "attacker",
                modifierOf(pairing.attackerFace, pairing.attackerValue)),
            shardLayer("attacker")
        ]),
        el("div", { class: "clashMiddle" }, [
            el("div", { class: "clashFlash" }),
            el("div", { class: "clashVerdict", html: verdictFor(pairing) })
        ]),
        el("div", { class: "clashSide clashSide-defender" }, [
            dieFace(pairing.defenderFace, "defender",
                modifierOf(pairing.defenderFace, pairing.defenderValue)),
            shardLayer("defender")
        ])
    ]);
}

/**
 * The three lines under the pairings.
 *
 * Derived at render time and never stored, for the reason the activity feed records: a log holding
 * phrasing bakes today's wording into every save file.
 */
export function summaryFor(record, names = {}) {
    const won = record?.defenderLosses ?? 0;
    const lost = record?.attackerLosses ?? 0;
    const attacker = names.attacker || "You";
    const defender = names.defender || "The defenders";

    let headline;
    if (won > lost) {
        headline = `${attacker} won the round`;
    } else if (lost > won) {
        headline = `${defender} won the round`;
    } else {
        headline = "The round was even";
    }

    const detail = `${won} ${won === 1 ? "pairing" : "pairings"} won, `
        + `${lost} lost. Each lost pairing costs that side a tenth of the force it has left.`;

    const cost = `${attacker} −${short(personnelLost(record?.attackersBefore, record?.attackersAfter))}`
        + `  ·  ${defender} −${short(personnelLost(record?.defendersBefore, record?.defendersAfter))}`;

    return { headline, detail, cost };
}

export function create() {
    if (root) return root;

    //The header names both sides and says how many dice each brought, because "why do they get
    //four" is the first question the panel has to answer and the answer is a column heading.
    const title = el("div", { id: ids.battleClashTitle, class: "clashTitle" }, [
        el("div", { class: "clashTitleSide clashTitleSide-attacker" }),
        el("div", { class: "clashTitleRound" }),
        el("div", { class: "clashTitleSide clashTitleSide-defender" })
    ]);
    const pairs = el("div", { id: ids.battleClashPairs, class: "clashPairs" });
    const headline = el("div", { class: "clashHeadline" });
    const detail = el("div", { class: "clashDetail" });
    const cost = el("div", { class: "clashCost" });
    const summary = el("div", { id: ids.battleClashSummary, class: "clashSummary" },
        [headline, detail, cost]);

    root = el("div", { id: ids.battleClashPanel, class: "clashPanel" }, [title, pairs, summary]);
    root.style.display = "none";
    parts = {
        title,
        attackerHead: title.children[0],
        roundHead: title.children[1],
        defenderHead: title.children[2],
        pairs,
        headline,
        detail,
        cost
    };

    mount(ids.battleClashContainer, root);
    return root;
}

/**
 * Open the panel for a round, with every face still blank.
 *
 * IT DOES NOT ANIMATE. `play()` puts up the frame -- both sides named, their dice counts, one row
 * per pairing -- with the faces drawn as empty dice and no verdicts. `reveal()` is what fills them
 * in, and the caller drives it off the dice actually coming to rest.
 *
 * The split is the whole point. The rules decide a round before a die is thrown, and the panel
 * used to say so: it opened on a fixed delay and showed the answer whether or not the dice had
 * landed on it yet, which reads as the game telling you the result and then throwing dice for
 * decoration. That is exactly what it is, and exactly what it must not look like. Blank until the
 * dice stop, then filled from the same record, is the same information in the order that makes it
 * a roll.
 *
 * @param {object} record  from `resolveBattleRound()`. Nothing is derived here that the record
 *        does not already carry -- which is what makes it impossible for the animation and the
 *        battle to disagree.
 * @param {{attacker?: string, defender?: string}} [names]  who the two sides are.
 */
export function play(record, names = {}) {
    if (!root) {
        create();
    }
    clearTimers();

    const pairings = Array.isArray(record?.pairings) ? record.pairings : [];
    if (pairings.length === 0) {
        //A last push is a transaction, not a round: it rolls nothing, so there is nothing to show
        //and the panel stays down rather than flashing an empty frame.
        hide();
        return;
    }

    const attackerName = names.attacker || "You";
    const defenderName = names.defender || "The defenders";
    parts.attackerHead.innerHTML = `<span class="clashTitleName">${attackerName}</span>`
        + `<span class="clashTitleDice">${diceWord(record.attackerDice)}</span>`;
    parts.defenderHead.innerHTML = `<span class="clashTitleName">${defenderName}</span>`
        + `<span class="clashTitleDice">${diceWord(record.defenderDice)}</span>`;
    parts.roundHead.innerHTML = `Round ${record.round ?? ""}`;

    parts.pairs.innerHTML = "";
    for (let index = 0; index < pairings.length; index++) {
        parts.pairs.appendChild(pairRow(pairings[index], index));
    }

    const summary = summaryFor(record, { attacker: attackerName, defender: defenderName });
    parts.headline.innerHTML = summary.headline;
    parts.detail.innerHTML = summary.detail;
    parts.cost.innerHTML = summary.cost;

    root.style.display = "flex";
    revealed = false;
    playing = true;
    //The CLASS as well as the flag. Only `hide()` used to take `is-revealed` off, and `hide()` has
    //not run when a second round is fought before the first one's panel has finished lingering --
    //which, with a linger measured in seconds, is most rounds. The panel then opened for round two
    //with its faces already showing, so the blanking worked exactly once per battle.
    root.classList.remove("is-revealed");

    //Up straight away, and empty. The frame is information in its own right -- four dice against
    //one is the fact the player most needs and it is true before anything is rolled.
    later(() => root.classList.add("is-open"), 20);
}

/**
 * Fill in the faces and play the pairings out.
 *
 * Called when the dice have come to rest, so what appears here is what is showing on the table.
 * Idempotent: a second call while a reveal is running is ignored, which is what lets the click
 * that settles the dice also arrive here without starting the sequence twice.
 */
export function reveal() {
    if (!root || revealed || !parts) {
        return;
    }
    revealed = true;
    clearTimers();
    root.classList.add("is-open");
    root.classList.add("is-revealed");

    const rows = [...parts.pairs.children];
    //Each pairing closes, clashes and resolves in turn. Staggering rather than showing all of them
    //at once is the whole point: the eye follows one comparison at a time, which is what makes the
    //rule readable rather than merely displayed.
    rows.forEach((row, index) => {
        later(() => resolveRow(row), index * PAIR_STEP_MS);
    });

    const done = rows.length * PAIR_STEP_MS + IMPACT_MS;
    later(() => {
        playing = false;
    }, done);
    later(hide, done + LINGER_MS);
}

/** Bring one pairing to its resolved state: the dice meet, then the loser shatters. */
function resolveRow(row) {
    row.classList.add("is-closed");
    //The impact lands a beat after the two dice have met, so the flash reads as a collision rather
    //than as the pair arriving.
    later(() => row.classList.add("is-struck"), IMPACT_MS);
}

/**
 * Jump to the end. Wired to the same click that settles the dice.
 *
 * The panel does NOT disappear on a skip: a player who skipped the animation still wants to read
 * what it was showing. It finishes instantly and then lingers as normal.
 */
export function finish() {
    if (!root || !playing) {
        return;
    }
    clearTimers();
    //A skip taken before the dice settled has to reveal as well as finish, or the panel would be
    //left showing a frame of blank dice with no way back to the numbers.
    revealed = true;
    root.classList.add("is-open");
    root.classList.add("is-revealed");
    for (const row of parts.pairs.children) {
        row.classList.add("is-closed", "is-struck");
    }
    playing = false;
    later(hide, LINGER_MS);
}

/** True while the sequence is still stepping. The guard `finish()` opens with. */
export function isPlaying() {
    return playing;
}

/** Take it down. Safe to call when it is already down, and when it was never created. */
export function hide() {
    clearTimers();
    playing = false;
    revealed = false;
    if (!root) {
        return;
    }
    root.classList.remove("is-open");
    root.classList.remove("is-revealed");
    //Left in the DOM rather than emptied: the fade needs something to fade.
    later(() => {
        if (root) {
            root.style.display = "none";
        }
    }, FADE_MS);
}

export function destroy() {
    clearTimers();
    playing = false;
    revealed = false;
    root?.remove();
    root = null;
    parts = null;
}

export const clashPanel = {
    create, play, reveal, finish, isPlaying, hide, destroy, summaryFor
};
