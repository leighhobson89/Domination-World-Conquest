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

        case ActivityKind.SIEGE_ABANDONED:
            return {
                text: `Siege of ${place(entry)} abandoned — ${entry.attacker} withdraws`,
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
    //The briefing is not an ACTION -- it is the summary of the turn the actions made up, and
    //it is written every turn whether or not anything happened. Counting it made every quiet
    //turn read "1 action, 1 involving you", which is the feed telling a player something
    //happened to them when nothing did.
    const actions = entries.filter(entry => entry.kind !== ActivityKind.BRIEFING);
    const total = actions.length;
    const mine = actions.filter(involvesPlayer).length;
    if (total === 0) {
        return "quiet";
    }
    const plural = total === 1 ? "action" : "actions";
    return mine > 0 ? `${total} ${plural}, ${mine} involving you` : `${total} ${plural}`;
}

// --- the news cards --------------------------------------------------------
//
// The panel is the player's news now, not a battle report, and a news item is a
// CARD: a headline and a short story rather than a line in a list. Four decisions
// shape this half of the file.
//
// **Only the player's news gets a card.** A busy turn 1 writes fifty-one conquests,
// and fifty-one cards is not a newspaper -- it is a spreadsheet with more
// whitespace. `newsCardFor()` returns null for anything the player has no stake in,
// and the panel drops those into a compact list under the cards. That list is
// exactly the terse feed that existed before this change, kept rather than thrown
// away, because "what happened everywhere" is a real thing to want and a card
// cannot answer it.
//
// **The wording varies, and the variation is DETERMINISTIC.** Reading the same
// sentence every time a province changes hands is what makes generated prose feel
// generated. The template is chosen from the entry's own id, so it is stable across
// re-renders -- the panel re-renders on every logged entry while it is open, and a
// card that reworded itself each time would be unreadable. Choosing it from the id
// also costs no `Math.random` draw, which would put the newspaper on the game's
// seeded stream and make two runs of one seed diverge.
//
// **A leader is named only when the entry carries one.** The name is recorded at the
// event, because leaders die every 15-20 turns, and it is absent from old saves and
// from spectated games. So every template has to read correctly without it, which is
// why a leader is always a SEPARATE trailing sentence and never a clause spliced
// into the middle of one.
//
// **A disaster is one card however many territories it hit**, and the count is what
// the story is about: "the harvest has failed in Bavaria" and "across thirty-one of
// your territories" are different news.

/** Pick one of several phrasings, stably, from the entry's own id. */
function variant(entry, options) {
    const id = Number.isFinite(entry?.id) ? entry.id : 0;
    return options[Math.abs(id) % options.length];
}

/** A trailing sentence about a leader, or "" when the entry does not name one. */
function leaderNote(name, template) {
    return name ? " " + template.replace("%s", name) : "";
}

/** What each disaster is called and what it did, for the headline and the story. */
const DISASTERS = Object.freeze({
    "Food Disaster": {
        headline: "Harvests fail",
        one: "The harvest has failed in %WORST%. Granaries are half what they were, and no one will grow fat this season.",
        many: "The harvest has failed across %N% of your territories, %WORST% worst among them. Granaries are half what they were and there will be no growth this season."
    },
    "Oil Well Fire": {
        headline: "Oil fields ablaze",
        one: "Fire has taken the wells at %WORST%. Most of the reserve burned before the crews could cap them.",
        many: "Fire has taken the wells in %N% of your territories, worst at %WORST%. Most of the reserve burned before the crews could cap them."
    },
    "Warehouse Fire": {
        headline: "Warehouses burn",
        one: "The stores at %WORST% have burned. The construction materials held there are gone.",
        many: "Stores have burned in %N% of your territories, worst at %WORST%. The construction materials held there are gone."
    },
    "Mutiny": {
        headline: "Mutiny in the ranks",
        one: "Unpaid soldiers at %WORST% have broken into the treasury and helped themselves to a quarter of it.",
        many: "Unpaid soldiers have broken into the treasuries of %N% of your territories, worst at %WORST%. A quarter of the gold is gone."
    }
});

function disasterCard(entry) {
    const hit = Number(entry.territoriesHit) || 1;
    const disaster = DISASTERS[entry.event];
    if (!disaster) {
        //A disaster was added to `RANDOM_EVENTS` and not to the table above. Say
        //something true rather than drawing a blank card.
        return {
            headline: entry.event || "Disaster",
            story: (entry.event || "A disaster") + " has struck " + hit +
                (hit === 1 ? " of your territories." : " of your territories."),
            tone: Tone.LOSS,
            isPlayer: true,
            icon: "disaster"
        };
    }
    const story = (hit > 1 ? disaster.many : disaster.one)
        .replace("%WORST%", entry.territory || "your lands")
        .replace("%N%", String(hit));
    return {
        headline: disaster.headline,
        //The suppressed population change is a real mechanical effect the player is
        //otherwise never told about -- growth simply stops everywhere for a turn and
        //nothing on screen says why. Being told is the whole of register item E3.
        story: story + " Nothing will grow anywhere this turn while the country takes stock.",
        tone: Tone.LOSS,
        isPlayer: true,
        icon: "disaster"
    };
}

function conquestCard(entry) {
    if (entry.playerAttacking) {
        return {
            headline: entry.territory + " is taken",
            story: variant(entry, [
                "Citizens of " + entry.attacker + " are already moving into " +
                    entry.territory + ", until this week a territory of " + entry.defender + ".",
                "The garrison " + entry.defender + " kept at " + entry.territory +
                    " has laid down its arms, and administrators from " + entry.attacker +
                    " arrive to take up their posts.",
                "Flags change over " + entry.territory + " tonight. The province was " +
                    entry.defender + "'s this morning and is " + entry.attacker + "'s now."
            ]) + leaderNote(entry.defenderLeader, "%s is said to have taken the news badly."),
            tone: Tone.VICTORY,
            isPlayer: true,
            icon: "war"
        };
    }
    return {
        headline: entry.territory + " is lost",
        story: variant(entry, [
            "Troops from " + entry.attacker + " hold " + entry.territory +
                ". Families are leaving the province ahead of the occupation.",
            entry.territory + " has fallen to " + entry.attacker +
                ". What was left of the garrison did not withdraw in time.",
            "The advance out of " + entry.attacker + " did not stop at the border. " +
                entry.territory + " is theirs."
        ]) + leaderNote(entry.attackerLeader, "%s claims the province by right of conquest."),
        tone: Tone.LOSS,
        isPlayer: true,
        icon: "war"
    };
}

function battleCard(entry) {
    if (entry.playerDefending) {
        return {
            headline: entry.territory + " holds",
            story: variant(entry, [
                entry.attacker + " came at " + entry.territory + " and was thrown back. The line holds.",
                "The assault on " + entry.territory + " broke against the defences. " +
                    entry.attacker + " withdrew before nightfall."
            ]) + leaderNote(entry.attackerLeader,
                "%s has not said whether there will be a second attempt."),
            tone: Tone.VICTORY,
            isPlayer: true,
            icon: "war"
        };
    }
    return {
        headline: "Assault on " + entry.territory + " fails",
        story: variant(entry, [
            "Our attack on " + entry.territory + " was thrown back. The defences of " +
                entry.defender + " held.",
            entry.territory + " could not be taken. The survivors are back across the border."
        ]) + leaderNote(entry.defenderLeader, "%s is reported to be strengthening the garrison."),
        tone: Tone.LOSS,
        isPlayer: true,
        icon: "war"
    };
}

/**
 * The siege kinds. All amber, and all written so the four endings read as four
 * different pieces of news rather than as one -- which is the same distinction
 * `ActivityKind` draws between LIFTED and ABANDONED, and for the same reason: from
 * the store both are "a siege was removed", and telling a player their troops had
 * been arrested when they had marched home would be worse than saying nothing.
 */
const SIEGE_CARDS = Object.freeze({
    [ActivityKind.SIEGE_STARTED]: (e) => e.playerDefending
        ? { headline: e.territory + " under siege",
            story: e.attacker + " has closed the roads around " + e.territory +
                ". Nothing is getting in or out." }
        : { headline: "Siege laid at " + e.territory,
            story: "Our army has invested " + e.territory + ". The garrison holding it for " +
                e.defender + " is cut off, and hunger will do what an assault would cost." },

    [ActivityKind.SIEGE_ONGOING]: (e) => e.playerDefending
        ? { headline: e.territory + " still holds",
            story: e.territory + " has been under " + e.attacker + "'s guns for " +
                (e.turnsUnderSiege ?? "several") + " turns now. Rations are short." }
        : { headline: "Siege of " + e.territory + " continues",
            story: e.territory + " has been invested for " + (e.turnsUnderSiege ?? "several") +
                " turns. The garrison has not yet come out." },

    [ActivityKind.SIEGE_LIFTED]: (e) => e.playerDefending
        ? { headline: "Siege of " + e.territory + " broken",
            story: "The besiegers at " + e.territory + " have been taken. " + e.attacker +
                "'s army will not be marching home." }
        : { headline: "Our army at " + e.territory + " is taken",
            story: "The siege of " + e.territory + " has collapsed and the besieging army " +
                "with it. The garrison of " + e.defender + " took what was left." },

    [ActivityKind.SIEGE_ABANDONED]: (e) => e.playerDefending
        ? { headline: e.territory + " is relieved",
            story: e.attacker + " has struck camp and marched away from " + e.territory +
                ". The roads are open again." }
        : { headline: "We withdraw from " + e.territory,
            story: "The siege of " + e.territory + " is lifted. The army was worth more at " +
                "home than standing in front of a wall it was not going to take." },

    [ActivityKind.SIEGE_WON]: (e) => e.playerDefending
        ? { headline: e.territory + " is stormed",
            story: e.attacker + " did not wait for hunger to do the work. " + e.territory +
                " was carried by assault." }
        : { headline: e.territory + " is carried",
            story: "Our besiegers went over the walls at " + e.territory + " rather than " +
                "wait, and the garrison of " + e.defender + " did not hold." },

    [ActivityKind.SIEGE_LOST]: (e) => e.playerDefending
        ? { headline: e.territory + " throws them back",
            story: e.attacker + " tried the walls at " + e.territory +
                " and failed. The garrison is still ours." }
        : { headline: "Assault on " + e.territory + " fails",
            story: "Our siege of " + e.territory + " broke into an assault, and the " +
                "garrison of " + e.defender + " held it." }
});

// --- the briefing card -----------------------------------------------------
//
// Register item E7, and the one card that is a SUMMARY rather than an event. Everything else
// in the panel says "this happened"; this says "and here is where it leaves you", which is the
// question a log of individual events cannot answer however long it gets.
//
// It leads its turn's section. That is a rendering decision made in `ActivityPanel.js` rather
// than an ordering of the log, because the log is a narrative in the order things occurred and
// the briefing is computed after most of them.
//
// **Four paragraphs, and any of them may be absent.** A quiet turn with no threatened border
// and no siege is a two-sentence card, which is correct -- padding it with "no borders are
// threatened" every turn trains the player to stop reading the one time it says otherwise.

/** How a goal reads in a sentence. Kept here rather than imported so this file stays pure. */
const GOAL_NAMES = Object.freeze({
    CONQUEST: "World Conquest",
    CONTINENTAL: "Continental Supremacy",
    DOMINATION: "Domination",
    ELIMINATION: "survival",
    GREAT_POWERS: "Great Powers",
    TURN_LIMIT: "the Timed Game"
});

/** "1st", "2nd", "3rd", "4th" ... — the rank reads as a placing, not as a quantity. */
function ordinal(n) {
    const value = Number(n) || 0;
    if (value <= 0) {
        return "";
    }
    const lastTwo = value % 100;
    if (lastTwo >= 11 && lastTwo <= 13) {
        return value + "th";
    }
    switch (value % 10) {
        case 1: return value + "st";
        case 2: return value + "nd";
        case 3: return value + "rd";
        default: return value + "th";
    }
}

/** A list that reads as English: "Alsace", "Alsace and Baden", "Alsace, Baden and Metz". */
function andList(names) {
    const list = names.filter(Boolean);
    if (list.length === 0) return "";
    if (list.length === 1) return list[0];
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
}

function plural(count, one, many) {
    return count === 1 ? one : many;
}

function briefingCard(entry) {
    const facts = entry.briefing ?? {};
    const parts = [];

    // 1. The treasury. Negative income is the one figure here that is an alarm rather than a
    //    report: unpaid upkeep deserts an army, so a player running a deficit is losing
    //    soldiers every turn and nothing else on screen says so in words.
    if (facts.goldIncome > 0) {
        parts.push("The treasury took " + facts.goldIncome.toLocaleString() + " gold this turn.");
    } else if (facts.goldIncome < 0) {
        parts.push("The treasury is " + Math.abs(facts.goldIncome).toLocaleString() +
            " gold down on the turn; unpaid soldiers will start going home.");
    }

    // 2. Where that leaves you. The rank is the standings tab's rank -- progress toward the
    //    goal in force, not size -- so the two cannot tell the player different things.
    if (facts.rank > 0 && facts.surviving > 0) {
        parts.push("You hold " + facts.territories +
            plural(facts.territories, " territory", " territories") + " and lie " +
            ordinal(facts.rank) + " of " + facts.surviving + " in the race for " +
            (GOAL_NAMES[facts.goalKind] ?? "victory") + ", " +
            Math.round((Number(facts.progressFraction) || 0) * 100) + "% of the way there.");
    }

    // 3. The borders. The game has never warned about a massing army at all.
    if (facts.weakBorderCount > 0) {
        const named = andList(facts.weakBorderNames ?? []);
        const unnamed = facts.weakBorderCount - (facts.weakBorderNames?.length ?? 0);
        let sentence = named + plural(facts.weakBorderNames?.length ?? 0, " is", " are") +
            " held by fewer troops than the enemy facing " +
            plural(facts.weakBorderNames?.length ?? 0, "it", "them") + ".";
        if (unnamed > 0) {
            sentence += " " + unnamed + " other " + plural(unnamed, "border stands", "borders stand") +
                " the same way.";
        }
        parts.push(sentence);
    }

    // 4. The sieges. They write their own cards each turn, so this is a roll-up and not a
    //    repeat -- what it adds is both halves in one sentence.
    const siegeParts = [];
    if (facts.besieging > 0) {
        siegeParts.push("besieging " + facts.besieging +
            plural(facts.besieging, " territory", " territories"));
    }
    if (facts.besieged > 0) {
        siegeParts.push("under siege in " + facts.besieged +
            plural(facts.besieged, " territory", " territories"));
    }
    if (siegeParts.length > 0) {
        parts.push("You are " + siegeParts.join(", and ") + ".");
    }

    return {
        headline: "The state of the nation",
        //A card with no paragraphs at all is possible -- turn 2 of a game where nothing has
        //happened -- and an empty card is worse than none. The caller drops it.
        story: parts.join(" "),
        tone: facts.goldIncome < 0 || facts.weakBorderCount > 0 ? Tone.LOSS : Tone.VICTORY,
        isPlayer: true,
        icon: "briefing"
    };
}

/**
 * The news card for one entry, or null when it is not the player's news.
 *
 * Null is the common case by a long way -- most of what the log holds is two other
 * countries fighting somewhere the player has never been -- and the panel renders
 * those as compact lines under the cards instead.
 *
 * @param {object} entry  as stored by `state/activityLog.js`
 * @returns {{headline: string, story: string, tone: string, isPlayer: boolean,
 *           icon: "war"|"siege"|"disaster"}|null}
 */
export function newsCardFor(entry) {
    if (!entry) {
        return null;
    }
    //A disaster is only ever recorded for the player, so it needs no involvement
    //test -- and it would fail one, because nobody attacked anybody.
    if (entry.kind === ActivityKind.DISASTER) {
        return disasterCard(entry);
    }
    if (entry.kind === ActivityKind.BRIEFING) {
        const card = briefingCard(entry);
        //A briefing with nothing in it is a turn on which the player earned nothing, holds
        //nowhere and is in no danger -- possible only in the opening turns, where a card
        //saying nothing is worse than no card.
        return card.story ? card : null;
    }
    if (!involvesPlayer(entry)) {
        return null;
    }
    if (entry.kind === ActivityKind.CONQUEST) {
        return conquestCard(entry);
    }
    if (entry.kind === ActivityKind.ATTACK_FAILED) {
        return battleCard(entry);
    }
    const siege = SIEGE_CARDS[entry.kind];
    if (siege) {
        return { ...siege(entry), tone: Tone.SIEGE, isPlayer: true, icon: "siege" };
    }
    return null;
}
