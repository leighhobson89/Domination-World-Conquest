// What the AI has put to the PLAYER and is waiting on an answer for.
//
// Diplomacy stage 5.5. Two things reach the player this way and they share one queue because
// they share one problem: **an AI country decides during the AI phase, and the player is not
// there.** A modal raised in the middle of a two-hundred-country loop would stop the turn
// dead, two hundred times over in the worst case, and a decision taken silently on the
// player's behalf is exactly what the design forbids — *"the player's side of a call-in is a
// prompt, and it must not be dismissible into a default: declining has a real consequence and
// a click-through would apply it silently."*
//
// So the AI turn QUEUES and the player answers at the end of it, before their own turn
// begins. That is the same arrangement `battlePlayback.js` already has for defences the
// player has to watch, and it answers the open half of **Q3** — *when must the call be
// answered* — with "by the start of your next turn".
//
// TWO KINDS, ONE QUEUE:
//
//   CALL_IN    an ally has gone to war (or been attacked) and asks the player to join.
//              Refusing ends the alliance, free for both.
//   PROPOSAL   a country offers the player a ceasefire, a peace or an alliance. Refusing
//              costs nothing at all; this is the direction stage 5.1 left unbuilt.
//
// IT HOLDS FACTS AND NEVER SENTENCES, the rule `activityLog.js` established: the wording is
// derived when the prompt is drawn, so a save file does not bake in today's phrasing. It is
// deliberately NOT a save slice — a queue is answered at the end of the turn it was filled
// in, so a save can never be taken with one outstanding, and restoring somebody else's
// half-asked question would be worse than dropping it.
//
// It imports nothing at all, the arrangement `diplomacy.js` has, so it can be filled from
// `aiCalculations.js` and read from `ui.js` without dragging either into the other.

/** What kind of thing is being put to the player. A CLOSED set: the prompt switches on it. */
export const InboxKind = Object.freeze({
    CALL_IN: "callIn",
    PROPOSAL: "proposal"
});

const queue = [];

/**
 * An ally asks the player to join a war.
 *
 * @param {{ally: string, principal: string, adversary: string, defensive: boolean}} entry
 *        `principal` is the ally doing the asking; `ally` is the player. `defensive` says
 *        whether the principal was attacked rather than attacking, which is the distinction
 *        Leigh's answer to Q3 turns on.
 */
export function queueCallIn({ principal, adversary, defensive = false }) {
    if (!principal || !adversary) {
        return;
    }
    queue.push({
        kind: InboxKind.CALL_IN,
        principal,
        adversary,
        defensive: Boolean(defensive)
    });
}

/**
 * A country offers the player an agreement.
 *
 * @param {{from: string, proposal: string, reason: string}} entry `proposal` is a
 *        `ProposalKind`; `reason` is why THEY want it, which is the only thing that makes an
 *        unsolicited offer legible rather than arbitrary.
 */
export function queueProposal({ from, proposal, reason = "" }) {
    if (!from || !proposal) {
        return;
    }
    //ONE OFFER PER COUNTRY PER TURN, and the guard is here rather than at the call site
    //because two different countries may reach the player and only a duplicate from the SAME
    //one is a mistake.
    if (queue.some(entry => entry.kind === InboxKind.PROPOSAL && entry.from === from)) {
        return;
    }
    queue.push({ kind: InboxKind.PROPOSAL, from, proposal, reason });
}

/** How many questions are waiting. Zero on almost every turn. */
export function pendingDiplomacy() {
    return queue.length;
}

/** Everything waiting, and the queue is emptied. Read once, answered once. */
export function takePendingDiplomacy() {
    const taken = [...queue];
    queue.length = 0;
    return taken;
}

/** New game, a load, or leaving to the menu with questions outstanding. */
export function clearDiplomacyInbox() {
    queue.length = 0;
}
