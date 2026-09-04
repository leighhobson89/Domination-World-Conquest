// The itemised dice preview, in the ATTACK window, before you commit.
//
// Battle overhaul B.6.7, and it is docs/battle_overhaul.md section 4.9 rendered:
//
//     YOU  ⚀⚀⚀⚀  4 dice                THEM  ⚀⚀⚀  3 dice
//       air superiority        +1        their fortifications   -1 die
//       no armour              -1        ties go to them
//     68% to take it · 4-6 rounds · ~230k survivors expected
//
// It answers the first complaint in section 2 -- "the player has no lever". Committing more
// force used to move a percentage and nothing else; here it moves a DIE, visibly, at a threshold
// the player can see coming. "Forty thousand more infantry gets me a fourth die" is a decision.
// A continuous curve is not.
//
// THE FORECAST IS THE HONEST NUMBER. The bar above this shows `winProbability()`, which is the
// attacker's share of the two strengths -- a quantity that decides how many dice each side rolls
// and is NOT the chance of taking the territory. `battleForecast()` answers the player's actual
// question by playing the whole battle out five hundred times, on a stream of its own, seeded
// from a stable hash of the setup so the figure does not flicker while the plus button is held.
// Both are shown, and the wording says which is which, because a 59% bar over a 24% fight with
// no explanation is worse than either number alone.
//
// IT DRAWS NOTHING IT DID NOT COMPUTE FROM THE MODEL. `modifiersFor()` and `shareFor()` are the
// same functions the battle resolves with, so the preview and the fight cannot disagree. There is
// no second estimate anywhere in this file.

import { ids } from "../core/registry.js";
import { el, mount } from "../core/dom.js";
import { defenderDiceCountFor, diceCountFor } from "../../rules/military/dice.js";
import { modifiersFor, shareFor } from "../../rules/military/battleModel.js";
import { battleForecast } from "../../rules/military/forecast.js";

/** Unicode die faces. The preview shows blanks -- nothing has been rolled yet. */
const BLANK_DIE = "⬜";

let root = null;
let parts = null;

/** `+1` / `-1`, never a bare `1`. The sign is the information. */
function signed(value) {
    return value >= 0 ? `+${value}` : `${value}`;
}

/** `230k`, `1.2m`. Local for the same reason `RoundLog.js` has one. */
function short(value) {
    const n = Math.round(value);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
}

function renderSide(column, title, side) {
    const dice = Math.max(1, side.dice);
    const rows = [
        el("div", { class: "attackPreviewHeader" }, [
            el("div", { class: "attackPreviewSide", html: title }),
            el("div", {
                class: "attackPreviewDice",
                html: Array.from({ length: dice }, () => BLANK_DIE).join("")
            }),
            el("div", {
                class: "attackPreviewCount",
                html: `${dice} ${dice === 1 ? "die" : "dice"}`
            })
        ])
    ];

    for (const row of side.rows ?? []) {
        rows.push(el("div", { class: "attackPreviewRow" }, [
            el("div", { class: "attackPreviewLabel", html: row.label }),
            el("div", {
                class: "attackPreviewValue",
                //A FACE bonus and a DICE change are different things, and only a dice change can
                //answer an opponent's unmatched dice. Saying "+1" for both would hide the one
                //distinction the ledger exists to make.
                html: row.dice ? `${signed(row.dice)} ${Math.abs(row.dice) === 1 ? "die" : "dice"}`
                    : signed(row.face ?? 0)
            })
        ]));
    }

    if (side.tieAdvantage) {
        //Not a modifier -- it is how a pairing is scored -- but it is worth about seventeen
        //points a pairing, which is more than anything in the list above it. Leaving it out
        //because it is not a row in `modifiersFor()` would misrepresent the whole ledger.
        rows.push(el("div", { class: ["attackPreviewRow", "attackPreviewTies"] }, [
            el("div", { class: "attackPreviewLabel", html: "ties go to them" }),
            el("div", { class: "attackPreviewValue", html: "" })
        ]));
    }

    column.innerHTML = "";
    for (const row of rows) {
        column.appendChild(row);
    }
}

export function create() {
    if (root) return root;

    const attacker = el("div", {
        id: ids.attackPreviewAttacker,
        class: ["attackPreviewColumn", "attackPreviewColumnAttacker"]
    });
    const defender = el("div", {
        id: ids.attackPreviewDefender,
        class: ["attackPreviewColumn", "attackPreviewColumnDefender"]
    });
    const forecast = el("div", { id: ids.attackPreviewForecast, class: "attackPreviewForecast" });

    root = el("div", { id: ids.attackPreview, class: "attackPreview" }, [
        el("div", { class: "attackPreviewColumns" }, [attacker, defender]),
        forecast
    ]);
    parts = { attacker, defender, forecast };
    mount(ids.transferAttackWindowContainer, root);
    return root;
}

/**
 * Redraw from a battle setup.
 *
 * @param {{attackers: number[], defenders: number[], territory: object, context: object,
 *          siegeTurns?: number}|null} setup the same shape `resolveBattle()` takes. Null clears.
 */
export function update(setup) {
    if (!parts) {
        return null;
    }
    const committed = (setup?.attackers ?? []).reduce((sum, count) => sum + (count ?? 0), 0);
    if (!setup || committed === 0) {
        //Nothing committed: there is no fight to itemise, and showing "1 die against 4" for an
        //empty army would read as advice.
        clear();
        return null;
    }

    show(true);

    const share = shareFor(setup.attackers, setup.defenders, setup.territory, setup.context);
    const modifiers = modifiersFor(setup.attackers, setup.defenders, setup.territory, {
        siegeTurns: setup.siegeTurns ?? 0
    });

    renderSide(parts.attacker, "YOU", {
        dice: diceCountFor(share) + modifiers.attacker.diceChange,
        rows: modifiers.attacker.rows
    });
    renderSide(parts.defender, "THEM", {
        dice: defenderDiceCountFor(1 - share) + modifiers.defender.diceChange,
        rows: modifiers.defender.rows,
        tieAdvantage: true
    });

    const forecast = battleForecast(setup);
    const [low, high] = forecast.roundsRange;
    const rounds = low === high ? `${low} rounds` : `${low}–${high} rounds`;
    //One element, not three. `.attackPreviewForecast` is a flex row, so a bare `<strong>` in it
    //becomes a flex ITEM -- which renders on its own line, and reads back with a line break
    //between the percentage and the words. The emphasis goes inside a single span instead.
    parts.forecast.innerHTML =
        `<span class="attackPreviewForecastText">`
        + `<strong>${Math.round(forecast.takeProbability * 100)}%</strong> to take it`
        + ` · ${rounds}`
        + ` · ~${short(forecast.survivorsIfWon)} survivors if you win`
        + `</span>`;
    return forecast;
}

export function show(visible) {
    if (root) {
        root.style.display = visible ? "block" : "none";
    }
}

export function clear() {
    if (!parts) return;
    parts.attacker.innerHTML = "";
    parts.defender.innerHTML = "";
    parts.forecast.innerHTML = "";
    show(false);
}

export function destroy() {
    root?.remove();
    root = null;
    parts = null;
}

export const attackPreview = { create, update, show, clear, destroy };
