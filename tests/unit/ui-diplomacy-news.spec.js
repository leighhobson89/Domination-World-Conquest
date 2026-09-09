// How a diplomatic entry reads: the compact line, the card, and the tone.
//
// Diplomacy stage 6, and the same arrangement `ui-news-cards.spec.js` has with the war
// entries -- the wording is pure, so it is pinned here where it costs a millisecond rather
// than in a browser where it would cost a playthrough. Nothing in `tests/e2e/diplomacy/`
// asserts a sentence, for exactly that reason.
//
// Four rules under test, and each is a decision:
//
//   * NO COUNTRY NAME IS EVER USED AS AN ADJECTIVE. There are no demonyms for 207 countries,
//     so "the France garrison" is what a naive template produces and no table would fix it.
//     This is the feed's oldest rule and the reason it is asserted again here is that the
//     diplomatic phrasings are the ones most tempted by it -- "the Spain delegation".
//   * THE VIA CARRIES THE MEANING, not the pair of states. A pair arriving at NEUTRAL out of
//     an alliance is three different pieces of news, as different as SIEGE_LIFTED is from
//     SIEGE_ABANDONED.
//   * A CARD IS THE PLAYER'S OWN DIPLOMACY AND NOTHING ELSE. Two hundred countries
//     negotiating produce far more events than two hundred countries fighting.
//   * AMBER IS LEFT ALONE. The feed's colour vocabulary says amber means a siege; a
//     diplomatic event borrowing it would cost the one tone that means exactly one thing.

import { describe, expect, it } from "vitest";

import { ActivityKind } from "../../src/state/activityLog.js";
import { DiplomaticState } from "../../src/state/diplomacy.js";
import { InboxKind } from "../../src/state/diplomacyInbox.js";
import { describeInboxEntry } from "../../src/ui/diplomacy/describeInbox.js";
import { Tone, describeActivity, newsCardFor } from "../../src/ui/activityFeed/describeActivity.js";

/** An entry as `activityRecorder.js` stores one, with the diplomacy facts filled in. */
function entry({ kind = ActivityKind.DECLARATION, diplomacy = {}, ...rest } = {}) {
    return {
        id: 1,
        kind,
        territory: "",
        defender: "",
        attacker: "",
        playerAttacking: false,
        playerDefending: false,
        attackerLeader: "",
        defenderLeader: "",
        event: "",
        territoriesHit: null,
        turnsUnderSiege: null,
        briefing: null,
        diplomacy: {
            actor: "Spain",
            a: "Spain",
            b: "France",
            from: DiplomaticState.NEUTRAL,
            to: DiplomaticState.WAR,
            via: "declared",
            onBehalfOf: null,
            ...diplomacy
        },
        ...rest
    };
}

/** Every phrasing this file can produce, for the sweeps at the bottom. */
function everyWording() {
    const rows = [];
    const add = (built) => {
        rows.push(describeActivity(built).text);
        for (const mine of [{ playerAttacking: true }, { playerDefending: true }]) {
            const card = newsCardFor({ ...built, ...mine });
            if (card) {
                rows.push(card.headline, card.story);
            }
        }
    };

    add(entry());
    add(entry({ diplomacy: { via: "calledIn", onBehalfOf: "Portugal" } }));
    add(entry({ diplomacy: { actor: null, via: "expired" } }));
    add(entry({
        kind: ActivityKind.BETRAYAL,
        diplomacy: { from: DiplomaticState.ALLIANCE, to: DiplomaticState.WAR, via: "declared" }
    }));
    for (const to of [DiplomaticState.CEASEFIRE, DiplomaticState.PEACE]) {
        add(entry({
            kind: ActivityKind.TREATY,
            diplomacy: { from: DiplomaticState.WAR, to, via: "agreed" }
        }));
    }
    add(entry({
        kind: ActivityKind.TREATY,
        diplomacy: {
            from: DiplomaticState.CEASEFIRE, to: DiplomaticState.PEACE,
            via: "released", onBehalfOf: "Portugal"
        }
    }));
    for (const to of [DiplomaticState.WAR, DiplomaticState.NEUTRAL]) {
        add(entry({
            kind: ActivityKind.TREATY,
            diplomacy: { actor: null, from: DiplomaticState.CEASEFIRE, to, via: "expired" }
        }));
    }
    add(entry({
        kind: ActivityKind.TREATY,
        diplomacy: { from: DiplomaticState.PEACE, to: DiplomaticState.NEUTRAL, via: "dropped" }
    }));
    add(entry({
        kind: ActivityKind.ALLIANCE,
        diplomacy: { from: DiplomaticState.PEACE, to: DiplomaticState.ALLIANCE, via: "agreed" }
    }));
    for (const via of ["declinedCall", "dissolved", "dropped"]) {
        add(entry({
            kind: ActivityKind.ALLIANCE,
            diplomacy: { from: DiplomaticState.ALLIANCE, to: DiplomaticState.NEUTRAL, via }
        }));
    }
    return rows;
}

describe("the compact line", () => {
    it("names who declared and who was declared on", () => {
        expect(describeActivity(entry()).text).toBe("Spain declares war on France");
    });

    it("names nobody as the actor when nobody acted", () => {
        const text = describeActivity(entry({ diplomacy: { actor: null, via: "expired" } })).text;
        expect(text).toBe("Spain and France are at war");
    });

    it("says an ally was called in, and by whom", () => {
        const text = describeActivity(
            entry({ diplomacy: { via: "calledIn", onBehalfOf: "Portugal" } })).text;
        expect(text).toBe("Spain answers Portugal and enters the war with France");
    });

    it("says what was broken when a treaty is torn up for a war", () => {
        const text = describeActivity(entry({
            kind: ActivityKind.BETRAYAL,
            diplomacy: { from: DiplomaticState.ALLIANCE, to: DiplomaticState.WAR }
        })).text;
        expect(text).toBe("Spain breaks an alliance with France and declares war");
    });

    it("keeps the three ways an alliance ends apart", () => {
        const ending = (via) => describeActivity(entry({
            kind: ActivityKind.ALLIANCE,
            diplomacy: { from: DiplomaticState.ALLIANCE, to: DiplomaticState.NEUTRAL, via }
        })).text;
        //Three vias, three sentences, no two the same -- the SIEGE_LIFTED / SIEGE_ABANDONED
        //rule applied to diplomacy.
        const lines = ["declinedCall", "dissolved", "dropped"].map(ending);
        expect(new Set(lines).size).toBe(3);
        expect(lines[0]).toContain("call to arms");
        expect(lines[1]).toContain("by agreement");
        expect(lines[2]).toContain("tears up");
    });

    it("wears the diplomacy icon and never the crossed swords", () => {
        //One picture, one meaning, across the whole game -- the rule the siege shield keeps
        //with the Wars & Sieges tab.
        for (const kind of [ActivityKind.DECLARATION, ActivityKind.TREATY,
            ActivityKind.ALLIANCE, ActivityKind.BETRAYAL]) {
            expect(describeActivity(entry({ kind })).icon, kind).toBe("diplomacy");
        }
    });
});

describe("the tone", () => {
    it("is green for an agreement made", () => {
        for (const to of [DiplomaticState.CEASEFIRE, DiplomaticState.PEACE,
            DiplomaticState.ALLIANCE]) {
            expect(describeActivity(entry({
                kind: ActivityKind.TREATY,
                diplomacy: { from: DiplomaticState.WAR, to, via: "agreed" }
            })).tone, to).toBe(Tone.VICTORY);
        }
    });

    it("is red for a war opened and for an agreement lost", () => {
        expect(describeActivity(entry()).tone).toBe(Tone.LOSS);
        expect(describeActivity(entry({
            kind: ActivityKind.ALLIANCE,
            diplomacy: { from: DiplomaticState.ALLIANCE, to: DiplomaticState.NEUTRAL,
                via: "dissolved" }
        })).tone).toBe(Tone.LOSS);
    });

    it("never uses amber, which means a siege", () => {
        for (const text of [describeActivity(entry()),
            describeActivity(entry({ kind: ActivityKind.TREATY }))]) {
            expect(text.tone).not.toBe(Tone.SIEGE);
        }
    });
});

describe("which entries become cards", () => {
    it("gives no card to two other countries agreeing something", () => {
        expect(newsCardFor(entry({ kind: ActivityKind.TREATY }))).toBeNull();
        expect(newsCardFor(entry())).toBeNull();
    });

    it("gives a card when the player declared, and names the other country", () => {
        const card = newsCardFor(entry({ playerAttacking: true }));
        expect(card).not.toBeNull();
        expect(card.headline).toContain("France");
        expect(card.icon).toBe("diplomacy");
    });

    it("gives a card when war was declared on the player", () => {
        const card = newsCardFor(entry({ playerDefending: true }));
        expect(card.headline).toBe("Spain declares war");
    });

    it("never names the player's own country back at them", () => {
        //THE OTHER COUNTRY IS WORKED OUT FROM WHICH SIDE THE PLAYER IS ON. The actor is
        //stored first, so a card reading `b` unconditionally would name the player half the
        //time -- and only half, which is exactly the kind of defect that survives a demo.
        const asActor = newsCardFor(entry({
            playerAttacking: true,
            diplomacy: { actor: "Player Country", a: "Player Country", b: "France" }
        }));
        expect(asActor.headline + asActor.story).not.toContain("Player Country");

        const asSubject = newsCardFor(entry({
            playerDefending: true,
            diplomacy: { actor: "Spain", a: "Spain", b: "Player Country" }
        }));
        expect(asSubject.headline + asSubject.story).not.toContain("Player Country");
    });

    it("says what an alliance gives, when one is signed", () => {
        const card = newsCardFor(entry({
            kind: ActivityKind.ALLIANCE,
            playerAttacking: true,
            diplomacy: { from: DiplomaticState.PEACE, to: DiplomaticState.ALLIANCE,
                via: "agreed" }
        }));
        expect(card.tone).toBe(Tone.VICTORY);
        //The three things an alliance actually pays, which is the whole reason it is worth
        //the risk of a call to arms.
        expect(card.story).toMatch(/treasur/i);
        expect(card.story).toMatch(/call on the other/i);
    });

    it("says the breach costs every other agreement, when the player is the one who broke it", () => {
        const card = newsCardFor(entry({
            kind: ActivityKind.BETRAYAL,
            playerAttacking: true,
            diplomacy: { from: DiplomaticState.ALLIANCE, to: DiplomaticState.WAR }
        }));
        //`betrayalPenalty.dropsOtherAgreements` is the heart of the penalty and the player is
        //owed the reason their whole diplomatic position just collapsed.
        expect(card.story).toMatch(/no other country/i);
        expect(card.tone).toBe(Tone.LOSS);
    });
});

describe("the phrasing rules, across every wording this file can produce", () => {
    const wordings = everyWording();

    it("produces a sentence for every case, and no undefined in any of them", () => {
        expect(wordings.length).toBeGreaterThan(20);
        for (const text of wordings) {
            expect(text, text).toBeTruthy();
            expect(text, text).not.toContain("undefined");
            expect(text, text).not.toContain("null");
        }
    });

    it("never uses a country name as an adjective", () => {
        //"The Spain delegation" and "France troops" are what a naive template produces, and
        //there is no demonym for 207 countries to fix it with. A genitive is fine and is used
        //deliberately -- "Spain's call to arms" -- so the pattern tests for a bare name
        //directly in front of a noun.
        for (const text of wordings) {
            expect(text, text).not.toMatch(
                /\b(Spain|France|Portugal) (delegation|government|troops|army|armies|border|envoy|envoys|forces|ambassador|ministers|garrison|soil|treaty|alliance|peace)\b/);
        }
    });

    it("never says a country did something to itself", () => {
        for (const text of wordings) {
            expect(text, text).not.toMatch(/\bSpain\b[^.]*\bwith Spain\b/);
            expect(text, text).not.toMatch(/\bFrance\b[^.]*\bwith France\b/);
        }
    });
});

// ---------------------------------------------------------------------------
// A WAR OPENED AGAINST THE PLAYER IS PUT TO THEM AS A NOTICE.
//
// Reported by Leigh: the only record of being declared on was a line in the activity feed.
// A war opened against you is the single most consequential thing that can happen on somebody
// else's turn, and it was the quietest one.
//
// It is a NOTICE and not a question — a declaration takes effect at once and cannot be
// refused, so offering two buttons would ask the player to decide something that has already
// happened. `dismissOnly` is what says so.
// ---------------------------------------------------------------------------

describe("the declaration notice", () => {
    it("names who declared, and offers one button", () => {
        const prompt = describeInboxEntry({
            kind: InboxKind.DECLARATION,
            by: "Brava",
            via: "declared",
            onBehalfOf: null
        });
        expect(prompt.title).toContain("Brava");
        expect(prompt.dismissOnly).toBe(true);
        expect(prompt.cancelLabel).toBeUndefined();
    });

    it("says an ally answered somebody else's call, when that is what happened", () => {
        //A pair arriving at WAR looks identical whichever route wrote it, which is the whole
        //reason `via` is annotated on the event in the first place.
        const prompt = describeInboxEntry({
            kind: InboxKind.DECLARATION,
            by: "Brava",
            via: "calledIn",
            onBehalfOf: "Carda"
        });
        expect(prompt.message).toContain("Carda");
        expect(prompt.message).toContain("call to arms");
    });

    it("tells the player what they can now do about it", () => {
        //The part that makes the modal worth raising rather than merely alarming: being at
        //war is the only state an attack is legal out of, so the news is also the news that
        //this border is live in both directions.
        const prompt = describeInboxEntry({
            kind: InboxKind.DECLARATION, by: "Brava", via: "declared"
        });
        expect(prompt.message).toContain("you may attack them");
    });

    it("uses no country name as an adjective", () => {
        //The rule the whole feed follows: there are no demonym forms for 207 country names.
        for (const via of ["declared", "calledIn"]) {
            const prompt = describeInboxEntry({
                kind: InboxKind.DECLARATION, by: "Brava", via, onBehalfOf: "Carda"
            });
            expect(prompt.message).not.toMatch(/\bBrava [a-z]+ (garrison|army|forces)\b/);
        }
    });
});
