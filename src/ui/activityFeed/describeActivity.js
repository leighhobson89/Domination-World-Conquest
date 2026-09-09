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
import { DiplomaticState } from "../../state/diplomacy.js";
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

    //The four diplomatic kinds share one wording function, because what separates them is
    //`via` rather than the kind -- see the diplomacy section below.
    if (DIPLOMATIC_KINDS.has(entry.kind)) {
        return {
            text: diplomaticLine(entry),
            tone: diplomaticTone(entry),
            isPlayer,
            icon: "diplomacy"
        };
    }

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

// --- diplomacy: the compact line -------------------------------------------
//
// Diplomacy stage 6. The register is the one part of this game whose events leave NO mark on
// the board: a declaration repaints nothing, a peace repaints nothing, and an alliance ending
// is a control quietly disappearing from a panel the player may not have open. Before this
// the whole of it went to `console.log`, which is where `recordCallInNews()` in `ui.js` said
// it was living "until stage 6".
//
// **THE VIA IS WHAT THE WORDING IS BUILT ON, not the states.** A pair arriving at NEUTRAL out
// of an alliance is three different pieces of news -- an ally refused a call to arms, both
// sides agreed to part, or a third country's breach took this agreement down with it -- and
// they are as different from each other as SIEGE_LIFTED is from SIEGE_ABANDONED. The states
// alone cannot tell them apart, which is why `setRelationState()` carries the annotation.
//
// **NO COUNTRY NAME IS EVER USED AS AN ADJECTIVE.** There are no demonyms for 207 countries,
// so "the France garrison" is what a naive template produces and there is no table that would
// fix it. Every phrasing here names a country as a noun or as a genitive ("Germany's call to
// arms"), and `tests/unit/ui-diplomacy-news.spec.js` fails the build if one reappears.

/**
 * The four kinds this file words as diplomacy. A SET rather than four `||`s, because it is
 * asked in two places and the two must not drift.
 */
const DIPLOMATIC_KINDS = new Set([
    ActivityKind.DECLARATION,
    ActivityKind.TREATY,
    ActivityKind.ALLIANCE,
    ActivityKind.BETRAYAL
]);

/** An agreement as a NOUN, for "breaks ___ with". `describeState()` is sentence-shaped. */
const AGREEMENT_NOUN = Object.freeze({
    [DiplomaticState.CEASEFIRE]: "a ceasefire",
    [DiplomaticState.PEACE]: "a peace",
    [DiplomaticState.ALLIANCE]: "an alliance"
});

function agreementNoun(state) {
    return AGREEMENT_NOUN[state] ?? "an agreement";
}

/** The two countries and the manner, with every field guaranteed to be something. */
function diplomaticFacts(entry) {
    const d = entry?.diplomacy ?? {};
    return {
        a: d.a ?? "",
        b: d.b ?? "",
        actor: d.actor ?? null,
        from: d.from ?? "",
        to: d.to ?? "",
        via: d.via ?? "",
        onBehalfOf: d.onBehalfOf ?? null
    };
}

/**
 * The one-line form, for the "Elsewhere in the world" list.
 *
 * Two hundred countries negotiating produce far more events than two hundred countries
 * fighting, and almost none of them are the player's -- so this is the form most diplomatic
 * news takes, and it has to say the whole thing in one clause.
 */
function diplomaticLine(entry) {
    const f = diplomaticFacts(entry);

    switch (entry.kind) {
        case ActivityKind.BETRAYAL:
            return `${f.a} breaks ${agreementNoun(f.from)} with ${f.b} and declares war`;

        case ActivityKind.DECLARATION:
            if (f.via === "calledIn") {
                return f.onBehalfOf
                    ? `${f.a} answers ${f.onBehalfOf} and enters the war with ${f.b}`
                    : `${f.a} enters the war with ${f.b}`;
            }
            return f.actor
                ? `${f.a} declares war on ${f.b}`
                : `${f.a} and ${f.b} are at war`;

        case ActivityKind.ALLIANCE:
            if (f.to === DiplomaticState.ALLIANCE) {
                return `${f.a} and ${f.b} sign an alliance`;
            }
            if (f.via === "declinedCall") {
                return `${f.a} refuses ${f.b}'s call to arms — the alliance ends`;
            }
            if (f.via === "dropped") {
                return `${f.a} tears up its alliance with ${f.b}`;
            }
            return `${f.a} and ${f.b} end their alliance by agreement`;

        default:
            //TREATY. A ceasefire or a peace, arriving or going.
            if (f.to === DiplomaticState.CEASEFIRE || f.to === DiplomaticState.PEACE) {
                if (f.via === "released" && f.onBehalfOf) {
                    return `${f.a} comes out of the war with ${f.b} alongside ${f.onBehalfOf}`;
                }
                return `${f.a} and ${f.b} agree ${agreementNoun(f.to)}`;
            }
            if (f.via === "expired") {
                return f.to === DiplomaticState.WAR
                    ? `The ceasefire between ${f.a} and ${f.b} runs out and the war resumes`
                    : `The ceasefire between ${f.a} and ${f.b} runs out`;
            }
            return `${f.a} tears up ${agreementNoun(f.from)} with ${f.b}`;
    }
}

/**
 * Green when an agreement is made, red when one is lost or a war is opened.
 *
 * AMBER IS LEFT ALONE, and that is deliberate: the feed's colour vocabulary says amber means
 * a siege, and a diplomatic event borrowing it would cost the one tone in the panel that
 * currently means exactly one thing. A ceasefire lapsing back into a war is bad news, so it
 * is red; there is no third case that wants a third colour.
 */
function diplomaticTone(entry) {
    const f = diplomaticFacts(entry);
    if (f.to === DiplomaticState.CEASEFIRE || f.to === DiplomaticState.PEACE ||
        f.to === DiplomaticState.ALLIANCE) {
        return Tone.VICTORY;
    }
    return Tone.LOSS;
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

// --- the diplomacy cards ---------------------------------------------------
//
// The player's OWN diplomacy, and nothing else. Everything above is the compact line, which
// is where the other two hundred countries' negotiations go -- and there are a great many of
// them: a measured 150-turn run ends with something like five hundred agreements standing and
// two hundred pairs at war, against a map on which fifty-one territories change hands on turn
// one. A card for each would be a spreadsheet with more whitespace.
//
// **THE OTHER COUNTRY IS WORKED OUT FROM WHICH SIDE THE PLAYER IS ON**, never from a fixed
// slot. A diplomatic entry stores the ACTOR first, so the player is `a` when they did it and
// `b` when it was done to them, and a card that read `f.b` unconditionally would name the
// player's own country back at them half the time.

/** The country on the other side of this, and whoever rules it. */
function counterparty(entry) {
    const f = diplomaticFacts(entry);
    return {
        them: entry.playerAttacking ? f.b : f.a,
        //`attackerLeader` is the leader of whoever is stored FIRST, so the other side's
        //leader is the opposite field. Both may be empty -- old saves and spectated games
        //carry none -- which is why a leader is always a separate trailing sentence.
        theirLeader: entry.playerAttacking ? entry.defenderLeader : entry.attackerLeader
    };
}

function declarationCard(entry) {
    const f = diplomaticFacts(entry);
    const { them, theirLeader } = counterparty(entry);

    if (f.via === "calledIn") {
        return entry.playerAttacking
            ? { headline: "We enter the war with " + them,
                story: "Our ally " + (f.onBehalfOf ?? "a partner") + " called, and we answered. " +
                    "The war with " + them + " is ours now as well." }
            : { headline: them + " joins the war against us",
                story: them + " has answered " + (f.onBehalfOf ?? "an ally") +
                    "'s call to arms. There is a second army in the field against us." +
                    leaderNote(theirLeader, "%s did not have to come.") };
    }
    if (entry.playerAttacking) {
        return {
            headline: "War declared on " + them,
            story: variant(entry, [
                "The declaration was delivered this morning. Nothing now stands between our " +
                    "armies and " + them + " but the border itself.",
                "We are at war with " + them + ". The garrisons along that frontier have " +
                    "been told to expect orders."
            ]) + leaderNote(theirLeader, "%s is said to have expected it.")
        };
    }
    return {
        headline: them + " declares war",
        story: variant(entry, [
            them + " has declared war on us. The frontier is closed and the first reports " +
                "of movement are already in.",
            "A declaration of war has arrived from " + them + ". Whatever was holding that " +
                "border together is no longer holding it."
        ]) + leaderNote(theirLeader, "%s gave the order.")
    };
}

function betrayalCard(entry) {
    const f = diplomaticFacts(entry);
    const { them, theirLeader } = counterparty(entry);
    const broken = agreementNoun(f.from);

    return entry.playerAttacking
        ? { headline: "We break " + broken + " with " + them,
            story: "We had " + broken + " with " + them + " and we have gone to war anyway. " +
                "No other country will agree anything with us until this is forgotten, and " +
                "what we had agreed elsewhere has gone with it." }
        : { headline: them + " breaks faith",
            story: them + " had " + broken + " with us and has declared war regardless." +
                leaderNote(theirLeader, "%s will find nobody willing to sign anything for " +
                    "some time.") };
}

function treatyCard(entry) {
    const f = diplomaticFacts(entry);
    const { them, theirLeader } = counterparty(entry);

    if (f.to === DiplomaticState.CEASEFIRE || f.to === DiplomaticState.PEACE) {
        const signed = f.to === DiplomaticState.CEASEFIRE ? "Ceasefire" : "Peace";
        return {
            headline: signed + " with " + them,
            story: f.to === DiplomaticState.CEASEFIRE
                ? "The guns are down along the border with " + them + ". It will not last " +
                    "for ever, and while it holds there is a front we do not have to garrison."
                : "There is peace with " + them + ". Neither of us will attack the other " +
                    "again unless one of us tears this up." +
                    leaderNote(theirLeader, "%s signed for the other side.")
        };
    }
    if (f.via === "expired") {
        return {
            headline: "The ceasefire with " + them + " runs out",
            story: f.to === DiplomaticState.WAR
                ? "The clock has run down on the ceasefire with " + them +
                    " and the war it paused is back on."
                : "The ceasefire with " + them + " has lapsed. Neither of us is bound to " +
                    "anything now."
        };
    }
    return {
        headline: them + " tears up " + agreementNoun(f.from),
        story: them + " will not stand by what we agreed. It was torn up because they " +
            "broke faith somewhere else, and nobody keeps a treaty with a country that has " +
            "just broken one."
    };
}

function allianceCard(entry) {
    const f = diplomaticFacts(entry);
    const { them, theirLeader } = counterparty(entry);

    if (f.to === DiplomaticState.ALLIANCE) {
        return {
            headline: "Alliance with " + them,
            story: "We are allied with " + them + ". Both treasuries are the better for it, " +
                "we can see what they can see, and either of us may call on the other when " +
                "the fighting starts." +
                leaderNote(theirLeader, "%s put a name to it.")
        };
    }
    if (f.via === "declinedCall") {
        return entry.playerAttacking
            ? { headline: "We refuse " + them + "'s call to arms",
                story: "We would not fight the war " + them + " chose, and the alliance " +
                    "has ended. Nothing is owed either way." }
            : { headline: them + " will not answer the call",
                story: them + " has refused to join the war and the alliance is over. " +
                    "Nothing is owed either way, and we are fighting it alone." +
                    leaderNote(theirLeader, "%s would not be moved.") };
    }
    if (f.via === "dropped") {
        return {
            headline: them + " tears up our alliance",
            story: them + " has broken faith elsewhere, and the alliance went with every " +
                "other agreement they held."
        };
    }
    return {
        headline: "The alliance with " + them + " ends",
        story: "Both sides agreed to it and nothing is owed either way. The income it paid " +
            "stops this turn."
    };
}

/** The diplomacy card for an entry, with the tone and the icon the four kinds share. */
function diplomacyCard(entry) {
    const card = entry.kind === ActivityKind.BETRAYAL ? betrayalCard(entry)
        : entry.kind === ActivityKind.DECLARATION ? declarationCard(entry)
            : entry.kind === ActivityKind.ALLIANCE ? allianceCard(entry)
                : treatyCard(entry);
    return {
        ...card,
        tone: diplomaticTone(entry),
        isPlayer: true,
        icon: "diplomacy"
    };
}

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
    if (DIPLOMATIC_KINDS.has(entry.kind)) {
        return diplomacyCard(entry);
    }
    const siege = SIEGE_CARDS[entry.kind];
    if (siege) {
        return { ...siege(entry), tone: Tone.SIEGE, isPlayer: true, icon: "siege" };
    }
    return null;
}
