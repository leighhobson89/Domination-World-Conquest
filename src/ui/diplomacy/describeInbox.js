// How a question the AI has put to the player is worded.
//
// Diplomacy stage 5.5. `diplomacyInbox.js` holds FACTS and this derives the sentences, which
// is the rule `activityLog.js` established and for the same reason: a queue that stored its
// own wording would bake today's phrasing into anything that outlived it.
//
// TWO RULES CARRY OVER FROM THE ACTIVITY FEED AND BOTH ARE ENFORCED BY TESTS. **No country
// name may be used as an adjective** -- there are no demonym forms for 207 country names, so
// "the France garrison" is what a naive template produces. And **the wording never varies by
// a draw**: a `Math.random()` here would put a dialog on the game's seeded stream.
//
// THE CONSEQUENCE OF SAYING NO IS ALWAYS STATED, and that is the whole point of the prompt
// rather than a nicety. The design: *"the player's side of a call-in is a prompt, and it must
// not be dismissible into a default: declining has a real consequence and a click-through
// would apply it silently."* A player who refuses a call to arms loses the alliance, and they
// have to be told so before they answer, not after.

import { describeProposal } from "../../state/diplomacy.js";
import { InboxKind } from "../../state/diplomacyInbox.js";

/**
 * The dialog for one queued question.
 *
 * @param {object} entry from `takePendingDiplomacy()`
 * @returns {{title: string, message: string, confirmLabel: string, cancelLabel: string}|null}
 */
export function describeInboxEntry(entry) {
    if (entry?.kind === InboxKind.CALL_IN) {
        return callInPrompt(entry);
    }
    if (entry?.kind === InboxKind.PROPOSAL) {
        return proposalPrompt(entry);
    }
    if (entry?.kind === InboxKind.DECLARATION) {
        return declarationPrompt(entry);
    }
    return null;
}

/**
 * Somebody has gone to war with the player, and there is nothing to answer.
 *
 * `dismissOnly` is what makes it a notice rather than a question. Every other prompt in this
 * file states the consequence of saying no, because refusing is a real choice with a real
 * price; here refusing is not available at all -- a declaration takes effect at once, which
 * is Leigh's rule for the whole system -- and offering two buttons would be asking the player
 * to decide something that has already happened.
 *
 * IT SAYS WHAT THE PLAYER CAN DO ABOUT IT, which is the part that makes the modal worth
 * raising rather than merely alarming. Being at war is the only state an attack is legal out
 * of, so the news is also the news that this border is now live in both directions.
 */
function declarationPrompt({ by, via, onBehalfOf }) {
    const joined = via === "calledIn" && onBehalfOf && onBehalfOf !== by;
    return {
        title: by + " declares war on you",
        message: (joined
            ? by + " has answered " + onBehalfOf + "'s call to arms and entered the war " +
              "against you."
            : by + " has declared war on you. It takes effect at once.") +
            " Your border with " + by + " is now open in both directions: they may attack " +
            "you, and you may attack them. You can sue for a ceasefire or a peace from the " +
            "diplomacy panel, though a country that has just declared is unlikely to listen " +
            "yet.",
        confirmLabel: "Understood",
        dismissOnly: true
    };
}

function callInPrompt({ principal, adversary, defensive }) {
    return {
        title: principal + " calls on you",
        message:
            (defensive
                ? principal + " has been attacked by " + adversary + " and asks you to " +
                  "honour the alliance."
                : principal + " has gone to war with " + adversary + " and asks you to " +
                  "honour the alliance.") +
            " Joining puts you at war with " + adversary + " at once, and you may not make " +
            "peace with " + adversary + " on your own afterwards -- " + principal +
            " has to agree it. " +
            //THE COST OF SAYING NO, stated before the answer. Neither side pays a penalty:
            //that is Leigh's rule, and it is what makes refusing an honest choice rather than
            //a trap.
            "Refusing ends the alliance. Neither of you pays anything for that, but it ends.",
        confirmLabel: "Join the war",
        cancelLabel: "Refuse"
    };
}

function proposalPrompt({ from, proposal, reason }) {
    const offered = describeProposal(proposal);
    //THEIR reason, not a forecast of what happens next. An unsolicited offer with no reason
    //behind it reads as arbitrary, and the reason is the one thing that makes it a move in a
    //game rather than a dice roll.
    const because = reason ? " " + capitalise(reason) + "." : "";
    return {
        title: from + " offers " + offered,
        message: from + " proposes " + offered + " with you." + because +
            " Accepting takes effect at once. Refusing costs nothing at all -- nothing has " +
            "been agreed and nothing is owed.",
        confirmLabel: "Accept",
        cancelLabel: "Decline"
    };
}

function capitalise(text) {
    const trimmed = String(text ?? "").trim();
    return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : "";
}
