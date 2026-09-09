// Whether a country will agree to stop fighting, and who it offers to.
//
// Diplomacy checklist stage 5.1. `src/ai/diplomacy.js` is still the only module in `src/ai/`
// allowed to decide a diplomatic action, so this is the other half of that containment: the
// half that can END a war.
//
// WHY THIS MATTERS MORE THAN THE DECLARATION TABLE. Stage 3 measured a world in which a war,
// once declared, could never end — pairs at war climbed 536 → 749 across a 150-turn run under
// every one of the five goals, which is the map walking back towards the permanent undeclared
// war this whole phase exists to replace. A declaration rule with no matching peace rule is a
// ratchet. These cases are the pawl coming off it.

import { beforeEach, describe, expect, it } from "vitest";

import { peaceDiscipline } from "../../src/config/balance.js";
import { DiplomaticState, ProposalKind } from "../../src/state/diplomacy.js";
import {
    planAgreementOffer,
    proposalCooldownLeft,
    proposalOutcomeFor,
    resetDiplomacyMemory
} from "../../src/ai/diplomacy.js";

beforeEach(() => {
    //The refusal cooldown is module state that outlives a test, so a second case asking the
    //same pair the same question would be answered by the first case's refusal.
    resetDiplomacyMemory();
});

/** A country with no reason at all to accept: one war, expanding, an ordinary leader. */
function ask(overrides = {}) {
    return proposalOutcomeFor({
        country: "Brava",
        proposer: "Alba",
        kind: ProposalKind.PEACE,
        state: DiplomaticState.WAR,
        turn: 40,
        traits: { risk_taking: 0.5 },
        posture: "EXPAND",
        urgency: 0,
        theatreRival: null,
        otherWars: 0,
        failuresAgainstProposer: 0,
        territories: 5,
        proposerTerritories: 5,
        ...overrides
    });
}

describe("what can be offered out of what", () => {
    it("refuses a ceasefire between two countries who are not fighting", () => {
        //Offering to stop doing something nobody is doing.
        const answer = ask({ kind: ProposalKind.CEASEFIRE, state: DiplomaticState.NEUTRAL });
        expect(answer.accepted).toBe(false);
        expect(answer.reason).toMatch(/cannot be offered/i);
    });

    it("allows a peace out of neutral, which turns an absence into an agreement", () => {
        const answer = ask({ state: DiplomaticState.NEUTRAL, posture: "DEFEND", otherWars: 2 });
        expect(answer.accepted).toBe(true);
    });

    it("refuses anything at no contact", () => {
        expect(ask({ state: DiplomaticState.NO_CONTACT }).accepted).toBe(false);
    });

    it("allows an alliance out of peace and nothing else", () => {
        //An alliance is peace PLUS shared resources, and a country that will not first agree
        //not to fight you is not going to share its oil.
        expect(ask({ kind: ProposalKind.ALLIANCE, state: DiplomaticState.WAR }).reason)
            .toMatch(/cannot be offered/i);
        expect(ask({ kind: ProposalKind.ALLIANCE, state: DiplomaticState.NEUTRAL }).reason)
            .toMatch(/cannot be offered/i);
        //Out of peace it is weighed rather than refused out of hand.
        expect(ask({ kind: ProposalKind.ALLIANCE, state: DiplomaticState.PEACE }).reason)
            .not.toMatch(/cannot be offered/i);
    });
});

describe("a siege blocks an agreement — Q1", () => {
    it("refuses while one stands, and says so", () => {
        const answer = ask({ siegeStanding: true, otherWars: 5, posture: "DEFEND" });
        expect(answer.accepted).toBe(false);
        expect(answer.reason).toMatch(/siege/i);
    });

    it("refuses it whichever way round the siege is", () => {
        //The predicate is about the PAIR, so it cannot be dodged by asking from the other
        //side. That symmetry is what makes it a rule rather than a penalty on the besieger.
        const answer = ask({ siegeStanding: true, kind: ProposalKind.CEASEFIRE });
        expect(answer.accepted).toBe(false);
    });

    it("does not spend the cooldown on it", () => {
        //A refusal a player can DO something about must not lock them out for eight turns:
        //they lift the siege, or it ends, and then they ask.
        ask({ siegeStanding: true });
        expect(proposalCooldownLeft("Brava", "Alba", ProposalKind.PEACE, 40)).toBe(0);
    });
});

describe("the theatre rival", () => {
    it("will not agree a peace, because that is the war it committed to", () => {
        const answer = ask({ theatreRival: "Alba", otherWars: 5, posture: "DEFEND" });
        expect(answer.accepted).toBe(false);
        expect(answer.reason).toMatch(/committed/i);
    });

    it("will not agree a ceasefire while it is winning", () => {
        const answer = ask({
            kind: ProposalKind.CEASEFIRE, theatreRival: "Alba", failuresAgainstProposer: 0
        });
        expect(answer.accepted).toBe(false);
    });

    it("WILL agree a ceasefire once it has been beaten badly enough", () => {
        //The deliberate escape. A country being beaten wants a breather, and that is exactly
        //the moment the other side most wants to buy one — without it, the one country a
        //player most needs to talk to is the one country that never listens.
        const answer = ask({
            kind: ProposalKind.CEASEFIRE,
            theatreRival: "Alba",
            failuresAgainstProposer: peaceDiscipline.theatreCeasefireFailures,
            otherWars: 1
        });
        expect(answer.accepted).toBe(true);
    });
});

describe("what moves the answer", () => {
    it("refuses when nothing in the world argues for it", () => {
        expect(ask().accepted).toBe(false);
    });

    it("accepts more readily the more wars it is already fighting", () => {
        //FRESH EACH TIME, because a refusal sets the cooldown and the second ask would
        //otherwise be answered by the first one's refusal rather than by the world. That is
        //the rule working, and it is worth stating that these comparisons have to step
        //around it rather than quietly benefiting from it.
        const scoreFor = (otherWars) => {
            resetDiplomacyMemory();
            return ask({ otherWars }).score;
        };
        expect(ask({ otherWars: 0 }).accepted).toBe(false);
        expect(scoreFor(3)).toBeGreaterThan(scoreFor(0));
    });

    it("accepts when it is defending rather than expanding", () => {
        expect(ask({ posture: "DEFEND", otherWars: 1 }).accepted).toBe(true);
    });

    it("accepts when it has been losing here", () => {
        expect(ask({ failuresAgainstProposer: 3, otherWars: 1 }).accepted).toBe(true);
    });

    it("leans on the leader's appetite for risk", () => {
        const cautious = ask({ traits: { risk_taking: 0.05 }, otherWars: 1 });
        resetDiplomacyMemory();
        const aggressive = ask({ traits: { risk_taking: 0.95 }, otherWars: 1 });
        expect(cautious.score).toBeGreaterThan(aggressive.score);
    });

    it("refuses a country it is much larger than", () => {
        //Agreeing not to fight somebody you are beating is what a country does not do.
        //Without this the strongest empire signs peace with everything it is about to eat.
        const even = ask({ territories: 5, proposerTerritories: 5, posture: "DEFEND", otherWars: 1 });
        resetDiplomacyMemory();
        const lopsided = ask({ territories: 40, proposerTerritories: 4, posture: "DEFEND", otherWars: 1 });
        expect(even.score).toBeGreaterThan(lopsided.score);
    });

    it("becomes readier when somebody is running away with the game", () => {
        //Leigh's stated goal for the phase, arriving one handshake at a time.
        const calm = ask({ urgency: 0, otherWars: 1 });
        resetDiplomacyMemory();
        const alarmed = ask({ urgency: 1, otherWars: 1 });
        expect(alarmed.score).toBeGreaterThan(calm.score);
        expect(alarmed.reason).toMatch(/bigger threat/i);
    });

    it("gives a ceasefire an allowance a peace does not get", () => {
        //A ceasefire expires, so agreeing to one costs far less than promising never to
        //fight again. The design's own words: reach for the cheap one first.
        const peace = ask({ otherWars: 1 });
        resetDiplomacyMemory();
        const ceasefire = ask({ kind: ProposalKind.CEASEFIRE, otherWars: 1 });
        expect(ceasefire.score - peace.score).toBeCloseTo(peaceDiscipline.ceasefireAllowance, 5);
    });

    it("names only the terms that argued the way the answer went", () => {
        //THE ONE OUTPUT OF THIS RULE ANYBODY READS, so it has to argue in one direction. An
        //accepted offer explained by "its leader is aggressive, it is much the larger of the
        //two" is printing the reasons it should have said no, which is what the panel showed
        //in the browser before this: Hungary agreed, and gave four reasons not to.
        const agreed = ask({
            posture: "DEVELOP",
            otherWars: 4,
            traits: { risk_taking: 0.95 },
            //Both negative terms are present and BOTH are filtered out: a size edge big
            //enough to be noted, small enough that the offer is still accepted.
            territories: 7,
            proposerTerritories: 5
        });
        expect(agreed.accepted).toBe(true);
        expect(agreed.reason).not.toMatch(/aggressive|larger/i);

        resetDiplomacyMemory();
        const refused = ask({ traits: { risk_taking: 0.95 }, otherWars: 1 });
        expect(refused.accepted).toBe(false);
        expect(refused.reason).toMatch(/aggressive/i);
        expect(refused.reason).not.toMatch(/other war/i);
    });

    it("keeps the sentence to three clauses at most", () => {
        //A player reading a refusal wants the reason, not the arithmetic.
        const answer = ask({
            posture: "DEFEND", otherWars: 6, failuresAgainstProposer: 5,
            urgency: 1, traits: { risk_taking: 0.05 }
        });
        expect(answer.reason.split(", ").length).toBeLessThanOrEqual(3);
    });

    it("says so plainly when nothing pushed either way", () => {
        expect(ask().reason).toBe("nothing in particular moves it");
    });

    it("always gives a reason, accepted or refused", () => {
        resetDiplomacyMemory();
        const refused = ask();
        resetDiplomacyMemory();
        const agreed = ask({ posture: "DEFEND", otherWars: 2 });
        for (const answer of [refused, agreed]) {
            expect(typeof answer.reason).toBe("string");
            expect(answer.reason.length).toBeGreaterThan(0);
        }
    });
});

describe("the refusal cooldown", () => {
    it("bars the same question for a while after a refusal", () => {
        expect(ask().accepted).toBe(false);
        expect(proposalCooldownLeft("Brava", "Alba", ProposalKind.PEACE, 40))
            .toBe(peaceDiscipline.proposalCooldown);
        expect(ask().reason).toMatch(/asked recently/i);
    });

    it("does not bar a DIFFERENT kind of agreement", () => {
        //Being told no to a peace is not being told no to a ceasefire, and a player who has
        //just learned the first should be able to try the second in the same breath.
        ask();
        expect(ask({ kind: ProposalKind.CEASEFIRE }).reason).not.toMatch(/asked recently/i);
    });

    it("lapses", () => {
        ask();
        expect(proposalCooldownLeft("Brava", "Alba", ProposalKind.PEACE,
            40 + peaceDiscipline.proposalCooldown)).toBe(0);
    });

    it("is not spent when the answer is yes", () => {
        expect(ask({ posture: "DEFEND", otherWars: 2 }).accepted).toBe(true);
        expect(proposalCooldownLeft("Brava", "Alba", ProposalKind.PEACE, 40)).toBe(0);
    });
});

describe("who an AI offers to", () => {
    const relations = (rows) => rows.map(([country, state]) => ({ country, state }));

    it("says nothing when it has no reason to want out", () => {
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 40,
            relations: relations([["Brava", DiplomaticState.WAR]]),
            traits: { risk_taking: 0.5 },
            posture: "EXPAND"
        });
        expect(offer).toBeNull();
    });

    it("sues for a ceasefire when it is fighting more than one war", () => {
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 40,
            relations: relations([
                ["Brava", DiplomaticState.WAR],
                ["Cadra", DiplomaticState.WAR]
            ]),
            traits: { risk_taking: 0.5 },
            posture: "EXPAND"
        });
        expect(offer).toMatchObject({ kind: ProposalKind.CEASEFIRE });
    });

    it("never offers to the country it has committed to absorbing", () => {
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 40,
            relations: relations([
                ["Brava", DiplomaticState.WAR],
                ["Cadra", DiplomaticState.WAR]
            ]),
            theatreRival: "Brava",
            posture: "DEFEND"
        });
        expect(offer.target).toBe("Cadra");
    });

    it("offers to the war it is losing worst", () => {
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 40,
            relations: relations([
                ["Brava", DiplomaticState.WAR],
                ["Cadra", DiplomaticState.WAR]
            ]),
            posture: "DEFEND",
            failuresAgainst: (rival) => (rival === "Cadra" ? 4 : 0)
        });
        expect(offer.target).toBe("Cadra");
    });

    it("firms a standing ceasefire into a peace before anything else", () => {
        //The cheapest thing in the system that permanently removes a war: the shooting has
        //already stopped and only the clock stands between these two and it starting again.
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 40,
            relations: relations([
                ["Brava", DiplomaticState.WAR],
                ["Cadra", DiplomaticState.WAR],
                ["Dorn", DiplomaticState.CEASEFIRE]
            ]),
            posture: "DEFEND"
        });
        expect(offer).toMatchObject({ target: "Dorn", kind: ProposalKind.PEACE });
    });

    it("offers to one country and no more", () => {
        //Two hundred countries asking three neighbours each is six hundred negotiations a
        //turn, most refused and every refusal setting a cooldown — the world would exhaust
        //its own diplomacy in three turns and then go quiet for eight.
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 40,
            relations: relations([
                ["Brava", DiplomaticState.WAR],
                ["Cadra", DiplomaticState.WAR],
                ["Dorn", DiplomaticState.WAR]
            ]),
            posture: "DEFEND"
        });
        expect(offer).toBeTruthy();
        expect(Array.isArray(offer)).toBe(false);
    });

    it("skips a country it has recently been refused by", () => {
        proposalOutcomeFor({
            country: "Cadra", proposer: "Alba", kind: ProposalKind.CEASEFIRE,
            state: DiplomaticState.WAR, turn: 40, posture: "EXPAND", traits: { risk_taking: 0.9 }
        });
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 41,
            relations: relations([
                ["Brava", DiplomaticState.WAR],
                ["Cadra", DiplomaticState.WAR]
            ]),
            posture: "DEFEND"
        });
        expect(offer.target).toBe("Brava");
    });

    it("draws no randomness, so a seeded game still reproduces", () => {
        const once = planAgreementOffer({
            country: "Alba", turn: 40, posture: "DEFEND",
            relations: relations([["Brava", DiplomaticState.WAR], ["Cadra", DiplomaticState.WAR]])
        });
        const twice = planAgreementOffer({
            country: "Alba", turn: 40, posture: "DEFEND",
            relations: relations([["Brava", DiplomaticState.WAR], ["Cadra", DiplomaticState.WAR]])
        });
        expect(once).toEqual(twice);
    });
});
