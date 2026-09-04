// The ledger: how many dice each side rolls, and why.
//
// Battle overhaul B.6.3. This is the answer to the second complaint in
// docs/archived/battle_overhaul.md section 2 -- "the mechanic is invisible". The old battle window gave
// the player one percentage and four defender statistics with nothing connecting them. This says,
// in the player's own units:
//
//     YOU    4 dice   [5][4][2][1]        THEM   3 dice   [6][3][2]
//       air superiority        +1           their fortifications   -1 die
//       no armour              -1           ties go to them
//
// It is a pure render of what `modifiersFor()` returned. It computes nothing, which is what makes
// it impossible for the explanation and the battle to disagree -- the same `modifiers` object
// that resolved the round is the one drawn here.
//
// Two kinds of row, and they are not interchangeable (see `row()` in battleModel.js): a FACE
// bonus adds to every die, a DICE change alters how many you roll. Only a dice change can answer
// an opponent's unmatched dice, so the ledger says which is which rather than showing both as a
// bare "+1".

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";

/** Unicode die faces, indexed by pip value minus one. */
const DIE_GLYPHS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/** A die whose value is not known yet -- before the first round is rolled. */
const BLANK_DIE = "⬜";

let root = null;
let parts = null;

/** `+1` / `-1`, never a bare `1`. The sign is the information. */
function signed(value) {
    return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * One side's half of the ledger.
 *
 * @param {HTMLElement} column
 * @param {string} title
 * @param {{dice: number, faces: number[], rows: object[]}} side
 * @param {boolean} winsTies
 */
function renderSide(column, title, side, winsTies) {
    const dice = Math.max(0, side.dice ?? 0);
    const faces = side.faces ?? [];

    //Faces when the round has been rolled, blanks when it has not. Sorted descending, because
    //that is the order they are PAIRED in, and a player reading the two rows should be able to
    //compare them straight across.
    const glyphs = faces.length > 0
        ? [...faces].sort((a, b) => b - a).map((face) => DIE_GLYPHS[face - 1] ?? BLANK_DIE)
        : Array.from({ length: dice }, () => BLANK_DIE);

    const header = el("div", { class: "battleLedgerHeader" }, [
        el("div", { class: "battleLedgerSide", html: title }),
        el("div", { class: "battleLedgerCount", html: `${dice} ${dice === 1 ? "die" : "dice"}` }),
        el("div", { class: "battleLedgerDice", html: glyphs.join(" ") })
    ]);

    const rows = (side.rows ?? []).map((entry) => el("div", { class: "battleLedgerRow" }, [
        el("div", { class: "battleLedgerLabel", html: entry.label }),
        el("div", {
            class: "battleLedgerValue",
            html: entry.dice ? `${signed(entry.dice)} die` : signed(entry.value)
        })
    ]));

    //The defender's tie advantage is real, permanent and worth about seventeen points a pairing,
    //and it is the one thing in the model with no number attached. Saying so is the difference
    //between a player who understands why an even attack fails and one who thinks the dice hate
    //them.
    if (winsTies) {
        rows.push(el("div", { class: "battleLedgerRow" }, [
            el("div", { class: "battleLedgerLabel", html: "ties go to them" }),
            el("div", { class: "battleLedgerValue", html: "" })
        ]));
    }

    column.replaceChildren(header, ...rows);
}

export function create() {
    if (root) return root;

    const attacker = el("div", { id: ids.battleLedgerAttacker, class: "battleLedgerColumn" });
    const defender = el("div", {
        id: ids.battleLedgerDefender,
        class: ["battleLedgerColumn", "battleLedgerColumnDefender"]
    });

    root = el("div", { id: ids.battleLedger, class: ["battleUIRow", "battleLedger"] }, [
        attacker,
        defender
    ]);
    parts = { attacker, defender };
    return root;
}

/**
 * Draw the ledger.
 *
 * @param {{attackerDice: number, defenderDice: number, attackerFaces?: number[],
 *          defenderFaces?: number[], modifiers: object}} view
 */
export function update(view) {
    if (!parts || !view) {
        return;
    }
    renderSide(parts.attacker, "YOU", {
        dice: view.attackerDice,
        faces: view.attackerFaces,
        rows: view.modifiers?.attacker?.rows
    }, false);
    renderSide(parts.defender, "THEM", {
        dice: view.defenderDice,
        faces: view.defenderFaces,
        rows: view.modifiers?.defender?.rows
    }, true);
}

/** Blank it -- a siege has no dice of this kind. */
export function clear() {
    parts?.attacker?.replaceChildren();
    parts?.defender?.replaceChildren();
}

export function show(visible) {
    const node = document.getElementById(ids.battleLedger);
    if (node) {
        node.style.display = visible ? "flex" : "none";
    }
}

export function destroy() {
    root?.remove();
    root = null;
    parts = null;
}

export const forceLedger = { create, update, clear, show, destroy };
