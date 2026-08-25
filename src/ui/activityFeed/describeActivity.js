// Turning one activity-log entry into the line the player reads.
//
// Phase 7.4. Pure, and separate from the panel, for the same reason
// `deriveMoveButtonState()` is separate from the move button: the wording and the
// colour rules are the part with judgement in them, and judgement is what a unit
// test can hold still. The panel does the DOM.
//
// The brief's rules, restated here because they are what this file implements and
// they are not obvious from the code alone:
//
//   * A conquest is a VICTORY and reads green and bold, with crossed swords --
//     "Balearic Islands (Spain) conquered by Libya". It is green whoever did it,
//     because somebody won; the exception is the one case where the player is the
//     country that lost the territory, which is a loss and reads red.
//   * A failed attack is red, whoever attacked -- "Libya fails to conquer Balearic
//     Islands (Spain)". Note this includes an attack the PLAYER repelled: the
//     entry describes the attack, and the attack failed. It is stated that way in
//     the brief and it keeps the colour meaning one thing.
//   * Anything to do with a siege is amber, in all four of its states: begun,
//     still running, lifted, and broken into a battle.
//   * An entry the player has a stake in, either side, is set a few points larger
//     than the rest. Size and colour are SEPARATE axes -- a player defeat is red
//     AND large, a distant AI conquest is green and small.

import { ActivityKind, involvesPlayer } from "../../state/activityLog.js";
import { classNames } from "../core/registry.js";

/** The three tones, which are the three classes `style.css` colours. */
export const Tone = Object.freeze({
    VICTORY: classNames.activityToneVictory,
    LOSS: classNames.activityToneLoss,
    SIEGE: classNames.activityToneSiege
});

/**
 * `"Territory (Country)"`, or just the territory when nobody is named.
 *
 * The parenthesised country is the one that HELD the territory when the thing
 * happened, never the one that holds it now. Reading it back off the world later
 * is the mistake that made the Wars & Sieges tab show the attacker's flag on both
 * sides of a war they had won (known-issues AS), which is why the log stores it.
 */
function place(entry) {
    return entry.defender ? `${entry.territory} (${entry.defender})` : entry.territory;
}

/**
 * The sentence and the tone for one entry.
 *
 * @param {object} entry  as stored by `state/activityLog.js`
 * @returns {{text: string, tone: string, isPlayer: boolean, icon: "war"|"siege"}}
 */
export function describeActivity(entry) {
    const isPlayer = involvesPlayer(entry);

    switch (entry.kind) {
        case ActivityKind.CONQUEST:
            return {
                text: `${place(entry)} conquered by ${entry.attacker}`,
                // The one case where a conquest is not a victory: the player is the
                // country it was taken from.
                tone: entry.playerDefending ? Tone.LOSS : Tone.VICTORY,
                isPlayer,
                icon: "war"
            };

        case ActivityKind.ATTACK_FAILED:
            return {
                text: `${entry.attacker} fails to conquer ${place(entry)}`,
                tone: Tone.LOSS,
                isPlayer,
                icon: "war"
            };

        case ActivityKind.SIEGE_STARTED:
            return {
                text: `${entry.attacker} lays siege to ${place(entry)}`,
                tone: Tone.SIEGE,
                isPlayer,
                icon: "siege"
            };

        case ActivityKind.SIEGE_ONGOING:
            return {
                text: entry.turnsUnderSiege
                    ? `${place(entry)} still besieged by ${entry.attacker} — turn ${entry.turnsUnderSiege}`
                    : `${place(entry)} still besieged by ${entry.attacker}`,
                tone: Tone.SIEGE,
                isPlayer,
                icon: "siege"
            };

        case ActivityKind.SIEGE_LIFTED:
            return {
                text: `Siege of ${place(entry)} lifted — ${entry.attacker}'s troops arrested`,
                tone: Tone.SIEGE,
                isPlayer,
                icon: "siege"
            };

        case ActivityKind.SIEGE_WON:
            return {
                text: `Siege of ${place(entry)} breaks into battle — ${entry.attacker} wins`,
                tone: Tone.SIEGE,
                isPlayer,
                icon: "siege"
            };

        case ActivityKind.SIEGE_LOST:
            return {
                text: `Siege of ${place(entry)} breaks into battle — ${entry.defender} holds`,
                tone: Tone.SIEGE,
                isPlayer,
                icon: "siege"
            };

        default:
            // `recordActivity()` rejects unknown kinds, so reaching here means a kind
            // was added to `ActivityKind` and not to this switch. Say so rather than
            // drawing an empty row, which is what the old feed did with a blank
            // `console.log`.
            console.warn("describeActivity: no wording for kind", entry.kind);
            return { text: place(entry), tone: Tone.SIEGE, isPlayer, icon: "war" };
    }
}

/**
 * A one-line count of a turn, for its collapsed header.
 *
 * Deliberately not "12 events". A player scanning shut sections wants to know
 * whether anything happened TO THEM, and a bare total buries that -- so the
 * player's own count is called out when there is one.
 */
export function summariseTurn(entries) {
    const total = entries.length;
    const mine = entries.filter(involvesPlayer).length;
    if (total === 0) {
        return "quiet";
    }
    const plural = total === 1 ? "action" : "actions";
    return mine > 0 ? `${total} ${plural}, ${mine} involving you` : `${total} ${plural}`;
}
