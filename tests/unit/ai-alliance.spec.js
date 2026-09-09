// Who will sign an alliance, who will answer a call to arms, and who is BOUND by having
// answered one.
//
// Diplomacy checklist stages 5.2–5.5. An alliance is the only agreement in this system that
// GIVES something rather than merely withholding it — income, capacity, reach and sight — and
// the whole of §3.4 is that the price of taking it is being ASKED into somebody else's war,
// with the right to say no.
//
// TWO RULES HERE ARE LEIGH'S, WORD FOR WORD, AND THEY PULL IN OPPOSITE DIRECTIONS. An ally is
// called in on DEFENCE as well as on aggression (*"yes they are"*), which reopens the cascade
// the first draft designed out — and the guard is that nothing is automatic, so a war still
// spreads exactly one country per yes. And a country that answered a call *"may not
// independently make peace with that adversary"*: the peace has to be asked by the attacked
// ally or by the adversary, and when it is agreed it applies to the joiner too.

import { beforeEach, describe, expect, it } from "vitest";

import { allianceDiscipline } from "../../src/config/balance.js";
import { DiplomaticState, ProposalKind } from "../../src/state/diplomacy.js";
import { clearPlansFor } from "../../src/ai/strategy.js";
import { isTreacherous, recordBreach } from "../../src/ai/diplomacy.js";
import {
    allCallIns,
    allianceScoreFor,
    bindJoiner,
    callInOutcomeFor,
    isBoundJoiner,
    planAgreementOffer,
    proposalOutcomeFor,
    releaseAllFor,
    releaseJoiners,
    resetDiplomacyMemory
} from "../../src/ai/diplomacy.js";

beforeEach(() => {
    resetDiplomacyMemory();
});

describe("who will sign an alliance", () => {
    const offer = (overrides = {}) => proposalOutcomeFor({
        country: "Brava",
        proposer: "Alba",
        kind: ProposalKind.ALLIANCE,
        state: DiplomaticState.PEACE,
        turn: 40,
        traits: { risk_taking: 0.5 },
        urgency: 0,
        sharedEnemies: 0,
        existingAllies: 0,
        territories: 5,
        proposerTerritories: 5,
        ...overrides
    });

    it("refuses a country with nothing to be afraid of", () => {
        //An alliance is a promise to be asked into somebody else's wars. A country with
        //nothing to fear has no reason to make one.
        expect(offer().accepted).toBe(false);
    });

    it("signs when a power is running away with the game", () => {
        //Leigh's stated goal for the whole phase: *"countries will work together to overcome
        //adversaries"*. `urgency` is already the strongest rival's share of the world's land,
        //and it is the heaviest term here by a distance.
        const answer = offer({ urgency: 1 });
        expect(answer.accepted).toBe(true);
        expect(answer.reason).toMatch(/running away/i);
    });

    it("signs more readily with somebody fighting the same enemies", () => {
        const alone = offer({ urgency: 0.6, sharedEnemies: 0 });
        resetDiplomacyMemory();
        const together = offer({ urgency: 0.6, sharedEnemies: 3 });
        expect(together.score).toBeGreaterThan(alone.score);
        expect(together.accepted).toBe(true);
    });

    it("is less interested the more allies it already has", () => {
        const first = offer({ urgency: 1, existingAllies: 0 });
        resetDiplomacyMemory();
        const fourth = offer({ urgency: 1, existingAllies: 3 });
        expect(fourth.score).toBeLessThan(first.score);
    });

    it("refuses somebody far smaller, and the refusal is one-way", () => {
        //An alliance with a country that cannot help you is a promise to fight their wars for
        //nothing. A SMALLER country is glad of a large ally, so only the larger side is
        //talked out of it.
        const giant = offer({ urgency: 1, territories: 60, proposerTerritories: 3 });
        resetDiplomacyMemory();
        const minnow = offer({ urgency: 1, territories: 3, proposerTerritories: 60 });
        expect(giant.score).toBeLessThan(minnow.score);
    });

    it("leans on the leader, cautious towards yes", () => {
        const cautious = offer({ urgency: 0.8, traits: { risk_taking: 0.05 } });
        resetDiplomacyMemory();
        const aggressive = offer({ urgency: 0.8, traits: { risk_taking: 0.95 } });
        expect(cautious.score).toBeGreaterThan(aggressive.score);
    });

    it("asks a harder question than a peace does", () => {
        expect(allianceDiscipline.acceptThreshold).toBeGreaterThan(1.0);
    });

    it("scores on terms a peace shares none of", () => {
        //Peace asks "do you want out of this war"; an alliance asks "do you want into
        //somebody else's". They are different questions and take different branches.
        const { parts } = allianceScoreFor({ urgency: 1, sharedEnemies: 2 });
        expect(parts.map(part => part.text).join(" ")).toMatch(/same enemies/);
    });
});

describe("looking for an ally", () => {
    const relations = (rows) => rows.map(([country, state, theirWars]) =>
        ({ country, state, theirWars: theirWars ?? [] }));

    it("does not go looking while there is nothing to fear", () => {
        const plan = planAgreementOffer({
            country: "Alba",
            turn: 40,
            urgency: 0,
            posture: "EXPAND",
            relations: relations([["Brava", DiplomaticState.PEACE]])
        });
        expect(plan).toBeNull();
    });

    it("seeks a partner at peace once a power is running away with it", () => {
        const plan = planAgreementOffer({
            country: "Alba",
            turn: 40,
            urgency: 1,
            posture: "EXPAND",
            relations: relations([["Brava", DiplomaticState.PEACE]])
        });
        expect(plan).toMatchObject({ target: "Brava", kind: ProposalKind.ALLIANCE });
    });

    it("prefers the partner fighting the same enemies", () => {
        const plan = planAgreementOffer({
            country: "Alba",
            turn: 40,
            urgency: 1,
            posture: "EXPAND",
            relations: relations([
                ["Cadra", DiplomaticState.WAR],
                ["Dorn", DiplomaticState.WAR],
                ["Brava", DiplomaticState.PEACE, ["Elin"]],
                ["Elin", DiplomaticState.PEACE, ["Cadra", "Dorn"]]
            ])
        });
        expect(plan.target).toBe("Elin");
    });

    it("puts the alliance ahead of tidying up its own wars", () => {
        //A country that can see a power running away with the game should be looking for a
        //partner before it goes back to settling its own quarrels.
        const plan = planAgreementOffer({
            country: "Alba",
            turn: 40,
            urgency: 1,
            posture: "DEFEND",
            relations: relations([
                ["Cadra", DiplomaticState.WAR],
                ["Dorn", DiplomaticState.WAR],
                ["Brava", DiplomaticState.PEACE]
            ])
        });
        expect(plan.kind).toBe(ProposalKind.ALLIANCE);
    });

    it("falls back to suing for a ceasefire when nobody is available to ally with", () => {
        const plan = planAgreementOffer({
            country: "Alba",
            turn: 40,
            urgency: 1,
            posture: "DEFEND",
            relations: relations([
                ["Cadra", DiplomaticState.WAR],
                ["Dorn", DiplomaticState.WAR]
            ])
        });
        expect(plan.kind).toBe(ProposalKind.CEASEFIRE);
    });
});

describe("the call to arms", () => {
    const call = (overrides = {}) => callInOutcomeFor({
        ally: "Brava",
        principal: "Alba",
        adversary: "Cadra",
        traits: { risk_taking: 0.5 },
        urgency: 0,
        defensive: false,
        alreadyAtWar: false,
        existingWars: 0,
        allyTerritories: 10,
        adversaryTerritories: 10,
        ...overrides
    });

    it("is refused by an ally with no reason to turn up", () => {
        expect(call().joins).toBe(false);
    });

    it("weighs a DEFENSIVE call more heavily than an aggressive one", () => {
        //Q3, answered by Leigh: an ally IS called in on defence. Coming to the aid of
        //somebody who has been attacked is what an alliance is understood to be for; being
        //dragged into a war your partner started is not.
        expect(call({ defensive: true }).score).toBeGreaterThan(call().score);
    });

    it("is nearly free for an ally already fighting the same enemy", () => {
        expect(call({ alreadyAtWar: true }).joins).toBe(true);
    });

    it("is refused by an ally already stretched across several wars", () => {
        const fresh = call({ defensive: true, urgency: 0.5 });
        const stretched = call({ defensive: true, urgency: 0.5, existingWars: 4 });
        expect(stretched.score).toBeLessThan(fresh.score);
    });

    it("is refused against an adversary far larger than the ally", () => {
        const even = call({ defensive: true, urgency: 0.6 });
        const hopeless = call({
            defensive: true, urgency: 0.6, allyTerritories: 2, adversaryTerritories: 60
        });
        expect(hopeless.score).toBeLessThan(even.score);
    });

    it("leans the OTHER way on risk from an alliance proposal", () => {
        //Signing an alliance is a cautious act; answering a call to arms is a brave one. The
        //same trait therefore pushes opposite ways in the two rules, which is what makes a
        //leader's character legible rather than a single "peacefulness" dial.
        expect(call({ defensive: true, traits: { risk_taking: 0.95 } }).score)
            .toBeGreaterThan(call({ defensive: true, traits: { risk_taking: 0.05 } }).score);
    });

    it("always gives a reason", () => {
        expect(call().reason.length).toBeGreaterThan(0);
        expect(call({ alreadyAtWar: true }).reason.length).toBeGreaterThan(0);
    });

    it("nothing cascades: it answers one call and joins one war", () => {
        //The first draft had co-belligerence automatic, which needed a rule forbidding a
        //transitive closure or one signature would have put the whole map at war in three
        //hops. This returns a yes or a no about ONE pairing and enrols nobody.
        const answer = call({ alreadyAtWar: true });
        expect(Object.keys(answer).sort()).toEqual(["joins", "reason", "score"]);
    });
});

describe("a joiner is bound to the war it was called into", () => {
    //Leigh: *"an ally brought in to aid an attacked ally against an adversary may not
    //independently make peace with that adversary, the peace must be asked either by the ally
    //under attack or by the adversary, and agreed, where it then applies peace to the ally
    //aiding the attacked ally as well."*

    it("records who joined whose war against whom", () => {
        bindJoiner("Alba", "Brava", "Cadra");
        expect(allCallIns()).toEqual([
            { principal: "Alba", joiner: "Brava", adversary: "Cadra" }
        ]);
    });

    it("names the principal a joiner is bound to", () => {
        bindJoiner("Alba", "Brava", "Cadra");
        expect(isBoundJoiner("Brava", "Cadra")).toBe("Alba");
        expect(isBoundJoiner("Brava", "Dorn")).toBeNull();
    });

    it("does not bind the principal itself", () => {
        //The country whose war it is may always settle it. That is the whole point of the
        //rule: the peace has to be asked by the attacked ally or by the adversary.
        bindJoiner("Alba", "Brava", "Cadra");
        expect(isBoundJoiner("Alba", "Cadra")).toBeNull();
    });

    it("refuses a proposal from a bound joiner to the adversary", () => {
        bindJoiner("Alba", "Brava", "Cadra");
        const answer = proposalOutcomeFor({
            country: "Cadra",
            proposer: "Brava",
            kind: ProposalKind.CEASEFIRE,
            state: DiplomaticState.WAR,
            turn: 40,
            boundToPrincipal: "Alba"
        });
        expect(answer.accepted).toBe(false);
        expect(answer.reason).toMatch(/Alba/);
    });

    it("frees every joiner when the principal's war ends, and forgets the binding", () => {
        bindJoiner("Alba", "Brava", "Cadra");
        bindJoiner("Alba", "Dorn", "Cadra");
        bindJoiner("Alba", "Elin", "Fenn");
        expect(releaseJoiners("Alba", "Cadra").sort()).toEqual(["Brava", "Dorn"]);
        //Read and cleared in one step: a binding that outlived the war it described would
        //keep a country from ever making peace with that adversary again.
        expect(isBoundJoiner("Brava", "Cadra")).toBeNull();
        expect(isBoundJoiner("Elin", "Fenn")).toBe("Alba");
    });

    it("forgets every binding a country holds when it leaves the map", () => {
        bindJoiner("Alba", "Brava", "Cadra");
        bindJoiner("Dorn", "Alba", "Elin");
        releaseAllFor("Alba");
        expect(allCallIns()).toEqual([]);
    });

    it("is wiped by a new game", () => {
        bindJoiner("Alba", "Brava", "Cadra");
        resetDiplomacyMemory();
        expect(allCallIns()).toEqual([]);
    });
});

describe("a succession does not void anything a country agreed", () => {
    // `clearPlansFor()` wipes the judgements a DEAD LEADER reached — the theatre, the walls,
    // the development watch — because a new leader inherits the country rather than the last
    // leader's conclusions. It deliberately keeps the committed continents, because the
    // conquest of a continent is the COUNTRY's plan and outlives whoever is running it.
    //
    // A TREATY IS THE SAME KIND OF THING. An heir who forgot every alliance would make a
    // fifty-turn coalition end because somebody died, which is the opposite of what a treaty
    // is for. The agreements themselves live in the store and `clearPlansFor()` cannot reach
    // them; what these cases pin is that the memory in `src/ai/diplomacy.js` is not reached
    // either, because that is the part a future edit could plausibly get wrong.

    it("keeps a call-in binding across a succession", () => {
        //The country is fighting on somebody's account. A new leader does not undo that.
        bindJoiner("Alba", "Brava", "Cadra");
        clearPlansFor("Brava");
        expect(isBoundJoiner("Brava", "Cadra")).toBe("Alba");
    });

    it("keeps a treachery mark across a succession", () => {
        //The world remembers what the COUNTRY did. A change of leader is not an alibi, and if
        //it were, betraying an ally and then waiting for a succession would be the cheapest
        //move in the game.
        recordBreach({
            betrayer: "Alba", victim: "Brava", broken: DiplomaticState.ALLIANCE, turn: 10
        });
        clearPlansFor("Alba");
        expect(isTreacherous("Alba", 11)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// OPINION AS A TERM (docs/archived/08-opinion.md).
//
// Every other term in these three rules is a PRESENT-TENSE fact about the world and would
// read the same whether the two countries had never met or had been sacking each other's
// provinces for eighty turns. These are the assertions that the memory reaches the answer,
// and -- more importantly -- that it reaches it as a TERM, which is the property that makes
// it incapable of freezing the world however far it swings.
// ---------------------------------------------------------------------------

describe("what a country thinks of you specifically", () => {
    const peaceOffer = (overrides = {}) => proposalOutcomeFor({
        country: "Brava",
        proposer: "Alba",
        kind: ProposalKind.CEASEFIRE,
        state: DiplomaticState.WAR,
        turn: 40,
        traits: { risk_taking: 0.5 },
        otherWars: 1,
        territories: 5,
        proposerTerritories: 5,
        ...overrides
    });

    it("can carry a ceasefire on its own, and can sink one on its own", () => {
        resetDiplomacyMemory();
        expect(peaceOffer({ opinion: 100 }).accepted).toBe(true);
        resetDiplomacyMemory();
        expect(peaceOffer({ opinion: -100 }).accepted).toBe(false);
    });

    it("is worth more than the whole personality range", () => {
        //The observation the mechanic started from: before it, one other war was worth more
        //than the difference between the most pacifist and the most aggressive leader alive.
        resetDiplomacyMemory();
        const cautious = peaceOffer({ traits: { risk_taking: 0 } }).score;
        resetDiplomacyMemory();
        const aggressive = peaceOffer({ traits: { risk_taking: 1 } }).score;
        resetDiplomacyMemory();
        const warm = peaceOffer({ opinion: 100 }).score;
        resetDiplomacyMemory();
        const cold = peaceOffer({ opinion: -100 }).score;

        expect(warm - cold).toBeGreaterThan(cautious - aggressive);
    });

    it("says so in the sentence, on whichever side of the argument it fell", () => {
        //A refusal a player can act on is the whole point: the reason you are told no
        //becomes a thing you can change rather than a fact about arithmetic you cannot see.
        resetDiplomacyMemory();
        expect(peaceOffer({ opinion: -100 }).reason).toContain("will not forgive");
        resetDiplomacyMemory();
        expect(peaceOffer({ opinion: 100 }).reason).toContain("friend");
    });

    it("says nothing about an opinion too small to be worth a sentence", () => {
        //Two independent floors -- the 0.15 on the weight and the 20 points on the value --
        //would disagree the first time either was tuned, and the symptom would be a refusal
        //explained by a grudge the tooltip draws as neutral.
        resetDiplomacyMemory();
        expect(peaceOffer({ opinion: 10 }).reason).not.toContain("thinks well");
        resetDiplomacyMemory();
        expect(peaceOffer({ opinion: -10 }).reason).not.toContain("grudge");
    });

    it("weighs heavier on an alliance than on a peace, because you ally with friends", () => {
        const swing = (kind, state) => {
            resetDiplomacyMemory();
            const warm = proposalOutcomeFor({
                country: "Brava", proposer: "Alba", kind, state, turn: 40,
                traits: { risk_taking: 0.5 }, territories: 5, proposerTerritories: 5,
                opinion: 100
            }).score;
            resetDiplomacyMemory();
            const cold = proposalOutcomeFor({
                country: "Brava", proposer: "Alba", kind, state, turn: 40,
                traits: { risk_taking: 0.5 }, territories: 5, proposerTerritories: 5,
                opinion: -100
            }).score;
            return warm - cold;
        };
        expect(swing(ProposalKind.ALLIANCE, DiplomaticState.PEACE))
            .toBeGreaterThan(swing(ProposalKind.CEASEFIRE, DiplomaticState.WAR));
    });

    it("brings an ally to a call to arms, and keeps a resented one at home", () => {
        const answer = (opinion) => callInOutcomeFor({
            ally: "Brava",
            principal: "Alba",
            adversary: "Carda",
            traits: { risk_taking: 0.5 },
            defensive: true,
            existingWars: 1,
            allyTerritories: 5,
            adversaryTerritories: 5,
            opinion
        });
        expect(answer(100).score).toBeGreaterThan(answer(-100).score);
        expect(answer(100).joins).toBe(true);
        expect(answer(-100).joins).toBe(false);
    });

    it("is a TERM and never a gate, so no opinion can refuse an offer outright", () => {
        //The one rule here that is not a matter of taste. A rule that can refuse is a rule
        //that can freeze the world -- known-issue BA -- and the guard is structural: at the
        //very bottom of the scale a strong enough case still gets through.
        resetDiplomacyMemory();
        const desperate = peaceOffer({
            opinion: -100,
            otherWars: 5,
            posture: "DEFEND",
            urgency: 1,
            traits: { risk_taking: 0 }
        });
        expect(desperate.accepted).toBe(true);
    });

    it("decides who a country sues for peace with, among equally beaten enemies", () => {
        //THE TIE-BREAK IS WHERE THE WORK HAPPENS. `theatreFailuresAgainst()` counts defeats
        //only against the committed theatre rival, who is excluded from this list -- so every
        //candidate reads ZERO failures and the choice used to fall straight through to the
        //alphabet. "The war it values least" had no mechanism behind it until now.
        resetDiplomacyMemory();
        const offer = planAgreementOffer({
            country: "Alba",
            turn: 20,
            relations: [
                { country: "Brava", state: DiplomaticState.WAR },
                { country: "Carda", state: DiplomaticState.WAR }
            ],
            traits: { risk_taking: 0.5 },
            posture: "DEFEND",
            opinionOf: (other) => (other === "Carda" ? 40 : -80)
        });
        expect(offer.target).toBe("Carda");
        expect(offer.kind).toBe(ProposalKind.CEASEFIRE);
    });
});
