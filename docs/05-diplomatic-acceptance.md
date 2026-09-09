# Diplomatic Acceptance — what actually decides yes and no

**What this document is.** A term-by-term account of every decision the diplomacy system
makes: whether a country accepts a ceasefire, a peace or an alliance; whether an ally answers
a call to arms; and whether a country declares war in the first place. It quotes the real
constants and names the file and function each one lives in.

**Why it exists.** The next piece of work is a **personality and opinion** layer — making a
country's attitude to *you specifically* a thing that grows, sours and is remembered. That is
a change to these rules, and the honest way to start is by writing down exactly what they do
now, including the four places where the answer is *nothing at all*. Everything below is what
is in the code today; §7 is the only part that proposes anything.

Reading order: §1 is the shape of the whole mechanic in one page. §2–§4 are the three scoring
questions. §5 is declaring war. §6 is where personality already reaches. §7 is the analysis
for the opinion mechanic.

---

## 1. The shape of it

### 1.1 A proposal is answered at once, and there is one door

There is no waiting period anywhere in this system. You ask, and you are told, in the same
tick. What separates the three agreements is not delay but how hard each is to get.

Every answer — the player's offer to an AI, and an AI's offer to another AI — goes through
**one function**: `proposalOutcomeFor()` in [`src/ai/diplomacy.js`](../src/ai/diplomacy.js).
That is the rule `countriesMayFight()` established for the attack gates, and for the same
reason: two paths answering the same question separately will eventually answer it
differently, and here that would be a player told no by a calculation the world never made.

```
the player asks    ui.js  proposeToCountry()      answerProposal()   proposalOutcomeFor()
an AI asks an AI   aiCalculations.js
                     applyAiPeaceOffer()          answerProposal()   proposalOutcomeFor()
an AI asks the player
                     applyAiPeaceOffer()  queueProposal()  the inbox  a prompt at end of turn
```

`answerProposal()` in [`aiCalculations.js`](../aiCalculations.js) is the gatherer: it reads
the live world once — the leader's traits, the posture, the urgency, the theatre commitment,
the war count off the register, the setback ledger, both territory counts, whether a siege
stands, whether the proposer is bound to somebody else's war, the shared enemies and the
existing ally count — and hands plain values to the pure rule.

**`proposalOutcomeFor()` takes plain values and not a campaign object, deliberately.** The
player's offer is answered by a country whose campaign has already been derived this turn; an
AI's offer to another AI is answered by a country whose turn may not have come round yet, and
deriving a whole campaign to answer one question would be up to 207 extra derivations on a
busy turn. **Every term degrades to zero when its input is missing**, so the second caller
gets a slightly less informed answer rather than a wrong one.

### 1.2 Who offers what, and how often

`planAgreementOffer()` gives each AI country **at most one offer per turn**. That cap is not a
performance decision: two hundred countries each asking three neighbours is six hundred
negotiations a turn, most refused, and every refusal sets an eight-turn cooldown — the world
would exhaust its own diplomacy in three turns and then go quiet for eight.

The priority order inside one country's turn:

| # | It offers | When | To whom |
|---|---|---|---|
| 1 | an **alliance** | `urgency ≥ 0.55` — a power is running away with the game | somebody it is already at **peace** with, most shared enemies first |
| 2 | a **peace** | always, if it holds a ceasefire | somebody already under a **ceasefire**, never the theatre rival |
| 3 | a **ceasefire** | only if it *wants out*: more than one war, **or** posture DEFEND/DEVELOP, **or** `risk_taking < 0.4`, **or** `urgency ≥ 0.6` | the war it values least — most attacks lost first, never the theatre rival |
| — | nothing | otherwise | — |

Three things worth noting. **A ceasefire comes before a peace in cost but after it in
priority**: firming an existing ceasefire into a peace is the cheapest thing in the system
that permanently removes a war, because the shooting has already stopped. **A country needs a
reason to sue for a ceasefire** — without the `wantsOut` gate every country would offer every
turn, which is a world of diplomats rather than a world with diplomacy in it. And **"most
attacks lost first" is in practice alphabetical**, for the reason set out at the end of §2.2:
the ledger only counts defeats against the committed theatre rival, who is excluded from this
list — so every candidate reads zero and the tie-break decides. That is not a bug (the
tie-break exists precisely so the choice is stable and reproducible rather than following
`Map` insertion order) but it is a place where the *stated* intention and the *effective*
behaviour differ, and it is the second of two.

**What may be offered out of what** (`canPropose()`) — a ceasefire only out of WAR; a peace out
of WAR, NEUTRAL or CEASEFIRE; **an alliance out of PEACE alone**, because a country that will
not first agree not to fight you is not going to share its oil. Nothing at all at NO_CONTACT.

### 1.3 The scale everything is measured on

Peace and ceasefire scores are in one currency with a threshold of **1.0**
(`peaceDiscipline.acceptThreshold`). An alliance is scored on a different question entirely
and has its own threshold of **1.6**. A call to arms has its own, **1.0**. All three are in
[`src/config/balance.js`](../src/config/balance.js), so a change of temperament is a balance
edit rather than a code edit.

---

## 2. Peace and ceasefire — `proposalOutcomeFor()`

### 2.1 The five hard refusals, in order

These run **before** any score is computed. Each returns a reason the player can read.

| # | Refusal | Why it is absolute | Spends the cooldown? |
|---|---|---|---|
| 1 | **The state does not allow it.** `canPropose()` | You cannot offer a peace to somebody you are already at peace with | no |
| 2 | **A siege stands between you** | Q1's answer. Peace agreed while an army is three turns from starving a province out is a contradiction. Lifting the siege means moving army out of a siege object from two unrelated code paths, and a write that creates or destroys army is the largest class of defect this project has had; letting it run under a peace makes the register say something untrue about the map. It is about the **pair**, so it cannot be dodged by asking from the other side | **no** — a refusal the player can act on must not cost them the chance to act on it |
| 3 | **The proposer was called into somebody else's war against you.** `isBoundJoiner()` | Leigh's rule: a joiner may not settle out alone; the principal or the adversary has to agree it, and it then releases every joiner on the same terms. Without it a call-in is a free favour — an ally turns up, is thanked, and buys its own way out next turn | no |
| 4 | **The proposer is marked TREACHEROUS.** `isTreacherous()` | The whole of the betrayal penalty on the diplomatic side: while the mark stands, no agreement of any kind can be reached with them. Checked **before** the cooldown so the reason given is the one the player can act on | **no** — punishing twice for one act is not the rule |
| 5 | **You asked recently and were refused.** `proposalCooldownLeft()` | 8 turns, per pair **per kind**. A player who can ask every turn until the dice fall their way is not negotiating, they are rerolling — and the answer is a pure function of a world that barely moves between turns | it *is* the cooldown |

Then one conditional refusal:

**6. The proposer is this country's THEATRE RIVAL.** `theatre.js` commits each country to
absorbing ONE neighbour; a war that could be ended by asking would make the mid-term goal a
suggestion. So:

- a **peace** or an **alliance** from the theatre rival: refused outright, cooldown spent;
- a **ceasefire** from the theatre rival: refused *unless* the rival has beaten it at least
  `theatreCeasefireFailures` (**2**) times. That escape is the point rather than a softening —
  a country being beaten wants a breather, and that is exactly when the other side most wants
  to buy one. Without it, the country a player most needs to talk to is the one that never
  listens.

### 2.2 The six terms that are scored

Only reached if all six refusals pass. The threshold is **1.0**.

| Term | Constant | Value | What it is |
|---|---|---|---|
| **A ceasefire is the cheap one** | `ceasefireAllowance` | **+0.60** | A flat head start for a ceasefire and nothing for a peace. It expires, so agreeing to one costs a country far less than agreeing never to fight again |
| **Fighting on more than one front** | `perOtherWar` × wars, capped by `maxOtherWarWeight` | **+0.45 each, max +1.50** | The classic reason to want out of a war. Capped so a country at war with nine neighbours is not automatically a pushover |
| **A posture not looking for a fight** | `defensivePosture` | **+0.80** | DEFEND or DEVELOP |
| **Losing here** | `perFailure` × attacks lost against the proposer, capped by `maxFailureWeight` | **+0.35 each, max +1.05** | The most legible reason of the lot, and **in practice it is almost always zero** — see the note below |
| **Who is in charge** | `riskSwing` × (0.5 − `risk_taking`) | **±0.60** at the extremes | A pacifist (0.0–0.4) leans toward yes, an aggressive leader (0.6–1.0) away. **This is the only personality input in the whole calculation** |
| **Somebody is running away with the game** | `urgencyWeight` × urgency | **up to +0.70** | `urgency` is the strongest rival's share of the world's land, already computed each turn by `doctrine.js`. This is the mechanism behind *"countries will work together to overcome adversaries"*, arriving one handshake at a time |
| **You are beating them** | −`strongerRefusal` × advantage, where advantage ramps to 1 at `strongerRatio` | **down to −0.90** at 2× their territories | Agreeing not to fight somebody you are beating is what a country does not do. Without this the strongest empire on the map signs peace with everything it is about to eat |

**THE "LOSING HERE" TERM ONLY EVER DOES WORK IN ONE CASE, AND THAT IS WORTH KNOWING BEFORE
TUNING IT.** `theatreFailuresAgainst()` counts defeats **only against the committed theatre
rival** — `noteAttemptOutcome()` records a loss only when the target belonged to that rival,
because the ledger exists to answer *"is this war working"* about the ONE war the country
chose. So a country asked to make peace by anybody else reads **zero** here however badly it
has been beaten by them. And against the theatre rival, a peace is refused outright anyway
(§2.1 refusal 6). The term's whole practical job is therefore the one escape it was built for:
deciding whether a theatre rival that is losing will take a **ceasefire**. Widening it means a
per-rival ledger, which is a change to what `theatre.js` remembers rather than a reading of
it — and it is the single most obvious place an opinion mechanic would slot in (§7.2).

**A worked example.** A balanced leader (`risk_taking` 0.5) in EXPAND posture, at war with two
others besides you, in a world with no runaway (urgency 0.1), the same size as you, offered a
**ceasefire**:

```
  0.60  ceasefire allowance
+ 0.45  one other war (2 wars total, 1 besides you)
+ 0.00  posture is EXPAND
+ 0.00  attacks lost against you -- zero, because you are not its theatre rival
+ 0.00  risk_taking 0.5 is exactly neutral
+ 0.07  urgency 0.1
- 0.00  the same size
= 1.12  against a threshold of 1.00  ->  ACCEPTED
```

Take away one of its other wars and it scores 0.67 and refuses. The same country offered a
**peace** scores 0.52 and refuses, because the ceasefire allowance is the only difference.
That is the intended shape: the cheap agreement is reachable and the permanent one needs a
second reason. It is also how narrow the margins are — **one other war is worth more than the
entire personality range**, which is the observation §7 starts from.

### 2.3 The sentence the player is given

`reasonFrom()` builds it, and it follows one rule that is easy to get wrong: **it names only
the terms that argued the way the answer went**, heaviest first, three at most.

This was found by driving the game rather than by reading it. Hungary accepted an offer and
explained itself with *"its leader is aggressive, it is much the larger of the two"* — which
are the two reasons it should have said **no**. An explanation that argues against its own
conclusion is worse than none.

A term is only eligible to be named if its weight exceeds **0.15**, and when nothing argues
either way the answer is *"nothing in particular moves it"* (refused) or *"it sees no reason
to keep fighting"* (accepted) — which is truer than printing the strongest of six tiny numbers.

---

## 3. An alliance — `allianceScoreFor()`

**An alliance is scored on a different question entirely**, which is why it takes its own
branch rather than six more terms in the one above. Peace and a ceasefire ask *"do you want
out of this war"*; an alliance asks *"do you want into somebody else's"*, and the two share
not one term.

The five hard refusals in §2.1 still apply first (state, siege, bound joiner, treachery,
cooldown), and the theatre rival cannot be allied with.

Threshold **1.6** — higher than a peace, because it costs more.

| Term | Constant | Value | Note |
|---|---|---|---|
| **Somebody is running away with the game** | `urgency` × urgency | **up to +1.80** | The heaviest term by a distance, and deliberately: a country with nothing to fear has no reason to tie itself to somebody else's wars |
| **Shared enemies** | `perSharedEnemy` × count, capped | **+0.50 each, max +1.50** | The most legible reason two countries ally, and free to ask — both war lists are already in the register. Counted from what the asked country can see: it is not asking the other side who it is fighting, it is noticing that they are fighting the same people |
| **They already have allies** | `perExistingAlly` × count | **−0.45 each** | A web has diminishing worth |
| **Who is in charge** | `riskSwing` × (0.5 − `risk_taking`) | **±0.50** | Cautious leaders ally. Again the only personality input |
| **You are much smaller than them** | −`strongerRefusal` × advantage to `strongerRatio` 3.0 | **down to −0.80** | An alliance with a country that cannot help you is a promise to fight their wars for nothing. **One-way on purpose**: a smaller country is glad of a large ally, so only the larger side is talked out of it |

**Note what this means in practice.** With urgency at zero — which is most of a game's first
fifty turns — the maximum reachable score is 1.50 from shared enemies plus 0.50 from a
cautious leader = **2.00**, so an alliance needs *either* three shared enemies *or* real
alarm. That is the design working: alliances are meant to be a response to a threat rather
than a routine.

### 3.1 What an alliance is worth, so the risk is priced

Measured by `node tools/econ-lab.mjs alliance`:

| | gold (a FLOW) | the three ceilings |
|---|---|---|
| per ally | ×1.10 | ×1.06 |
| at the 3-ally cap | **×1.30** | **×1.18** |
| a continent held whole, for comparison | ×1.50 | ×1.25 |
| both at once | **×1.95** | ×1.48 |

Symmetric, so the same percentage is worth +13.3 gold a turn to the Falkland Islands and
+1,050.3 to China — Leigh's standing rule that being large stays an advantage, while the
smaller ally takes the larger proportional lift. It is **a mutual dividend and never a
transfer**: both allies simply earn more while it stands, derived at the point of use and
stored nowhere, so the instant it ends the multiplier is 1 again with nothing to unwind.

Plus shared sight: an ally's frontier is drawn on the military map with the same force figures
and threat marks as your own.

---

## 4. A call to arms — `callInOutcomeFor()`

When a party to an alliance goes to war, **both** belligerents' allies are asked — Q3, answered
by Leigh: an ally is called in on **defence as well as on aggression**.

**Nothing cascades.** `resolveCallIns()` walks the two belligerents' ally lists **once** and
stops; a joiner's own allies are never asked. Without that, one signature would put the whole
map at war in three hops. A war spreads exactly one country per yes.

Threshold **1.0**.

| Term | Constant | Value | Note |
|---|---|---|---|
| **Already at war with the adversary** | `alreadyFighting` | **+2.00** | The heaviest term, because it costs nothing: the ally is being asked to keep doing what it is doing |
| **The partner was ATTACKED** | `defensive` | **+0.80** | Coming to the aid of somebody who has been attacked is what an alliance is understood to be for; being dragged into a war your partner started is not |
| **Somebody is running away with the game** | `urgency` × urgency | **up to +1.20** | A shared fear is what makes an ally turn up |
| **Already stretched** | `perExistingWar` × wars | **−0.30 each** | |
| **Who is in charge** | `riskSwing` × (`risk_taking` − 0.5) | **±0.50** | **Note the sign is REVERSED here.** An *aggressive* leader answers a call to arms; a cautious one does not. That is the opposite of the peace terms, and correctly so |
| **The adversary is far larger** | −`strongerAdversary` × gap to `strongerRatio` 3.0 | **down to −0.90** | |

### 4.1 The three ways an alliance ends, and only one costs

| Ending | Price |
|---|---|
| An ally **declines** a call-in | The alliance ends. **Free for both.** Back to NEUTRAL rather than to peace: the two have not agreed anything, they have stopped having an agreement. The aggressor's cost is exactly the thing that happened — they have gone to war without an ally they were relying on |
| Both agree to **dissolve** it | **Free for both.** Almost always accepted, and that is the design rather than a shortcut: an AI that haggled over being let go would turn the honest route into a gamble, and the moment it is a gamble the breach becomes the reliable option. Refused in exactly one case — one of you answered the other's call and is fighting on their account |
| One side **walks out**, or declares war on its own ally | **The full penalty.** This is the only act the system calls a BREACH |

**The asymmetry is what makes the penalty safe to make large.** A country that wants out has a
free, honest route available every single turn, so choosing the breach instead is a choice to
be *treacherous* rather than a choice to be free.

### 4.2 What a breach costs

Q4's answer: **reputational only**. There is no fine, and that is a decision — a gold penalty
is a number nobody can calibrate (*what is a treaty worth in gold?*) and it would fall hardest
on the countries least able to absorb it.

- **Every other agreement the betrayer holds is torn up** (`dropsOtherAgreements`). Nobody
  keeps a treaty with somebody who has just broken one.
- **While the mark stands, no AI will agree anything with them at all** (§2.1 refusal 4).
- The mark **decays**: 25 turns for an alliance, 15 for a peace, 10 for a ceasefire
  (`betrayalPenalty.treacheryTurns`), and `treacheryOf()` returns a **fraction** rather than a
  flag, because a boolean cannot decay. A second betrayal *extends* the mark rather than
  replacing it.
- **Leaving NEUTRAL costs nothing at all**, which is not a leniency — it is what the word
  neutral means, and it is why this rule almost never fires: the overwhelming majority of
  declarations are made out of neutral and are free.

**The material cost is DERIVED from the reputational one and is therefore self-calibrating.**
A breach drops every other agreement, and an alliance pays a standing share of income, so
tearing up one treaty is paid for in the dividends of all the rest. A country with one peace
loses little; a country at the centre of an alliance web loses the web and the income that
came with it. That proportionality is what a flat fine could never have.

**A succession does not wipe it.** The mark is a fact about the COUNTRY, not about the leader.
If a change of leader cleared it, betraying an ally and then waiting for a succession would be
the cheapest move in the game.

---

## 5. Declaring war — `planDeclarations()`

The other half of the question, and it works completely differently: **there is nobody to say
yes**. A declaration is unilateral and takes effect at once.

### 5.1 It is split in two, and the split is a freeze guard

**THE THEATRE WAR IS UNCONDITIONAL.** `theatre.js` already commits each country to absorbing
ONE neighbour and keeps the commitment until the rival becomes a wall. That commitment *is*
the country's answer to *"who is my enemy"*; turning it into a declaration cannot be refused
by a posture, by a war cap or by a leader's temperament. **Every country with a reachable
neighbour therefore has a war**, which is what makes a frozen world impossible rather than
merely unlikely.

This matters more than it sounds. A residual freeze has no textual signature at all: nothing
throws, every turn completes, and the map quietly stops changing. That is known-issue **BA**,
which cost this project a hundred turns of measurement once already.

**THE REST IS BOUNDED.** Opportunistic declarations — a second front against a visibly weaker
neighbour — are governed by `declarationDiscipline`:

| Gate | Constant | Value |
|---|---|---|
| Extra wars by posture | `postureAllowance` | DEVELOP **0**, DEFEND **0**, CONSOLIDATE **1**, EXPAND **1** |
| A leader too cautious to start one | `opportunistRiskFloor` | `risk_taking < 0.35` → **none at all** |
| One more when somebody is winning | `urgencyForExtra` | urgency ≥ **0.7** → **+1** |
| How many wars before it opens no more | `concurrentWarCap` | **3** (the theatre war is exempt) |
| How much weaker their border must be | `opportunistWeakness` | **0.62**, where `weakness` is `ourArmy / (ourArmy + theirArmy)` over the shared frontier, so 0.5 is parity |

### 5.2 The refusals

A declaration is refused when: it is already at war; an **agreement stands** (breaking one is a
breach, and the AI does not commit an act it has not been given a reason to commit); they have
**no contact** yet; or the target is the **player inside `PLAYER_GRACE_TURNS`** (5) — 206
countries plan their first turn with full information, so a player who chose a one-territory
country is reachable by several at once on turn 1.

### 5.3 So: what makes a country want to attack you?

Answering Leigh's question directly, in the order the terms actually bind:

1. **Is your country the one its theatre commitment named?** This is by far the biggest factor
   and it is chosen by `rankRivals()` in `theatre.js`, whose heaviest term is **weakness** —
   the army ratio across the shared frontier. If yes, it declares regardless of everything
   else, and no peace can be bought (only a ceasefire, and only once it has lost twice).
2. **Is your border visibly weaker than theirs?** Below `opportunistWeakness` 0.62 there is no
   opportunistic war at all.
3. **Is its posture EXPAND or CONSOLIDATE?** DEVELOP and DEFEND open no new front by choice.
4. **Is its leader `risk_taking` ≥ 0.35?** Below that, never.
5. **Is somebody running away with the game?** If urgency ≥ 0.7 it gets one more war — and if
   *you* are the runaway, urgency is computed from **your** share of the world's land, so the
   whole map starts more wars, attacks with a bigger budget, and becomes readier to make peace
   with each other.

**Army size is the main factor, exactly as expected** — it enters through `weakness` in both
(1) and (2). What is *not* in there anywhere is any memory of what you have done to them.

---

## 6. Where personality reaches today, and where it does not

### 6.1 The six traits

Every AI leader is drawn from one of three personalities in
[`leaderPersonalities.js`](../leaderPersonalities.js), each of which is six ranges:

| Trait | aggressive | balanced | pacifist | What it does |
|---|---|---|---|---|
| `fortification` | 0.0–1.0 | 0.0–1.0 | 0.0–1.0 | how much it builds forts |
| `economy` | 0.1–0.5 | 0.4–0.6 | 0.7–1.0 | how much it develops territories |
| `territory_expansion` | 0.8–1.0 | 0.5–0.7 | 0.1–0.3 | how much it wants to grow; also feeds attacks-per-territory |
| `style_of_war` | 0.7–1.0 | 0.4–0.7 | 0.1–0.4 | low favours **sieges**, high favours pressing an attack |
| `reconquista` | 0.1–0.4 | 0.4–0.6 | 0.6–1.0 | how much it wants lost territory back |
| `risk_taking` | 0.6–1.0 | 0.3–0.7 | 0.0–0.4 | how thin a border it will hold in order to attack |

Leaders **die and are replaced every 15–20 turns** (`src/ai/succession.js`), and a fresh
personality is drawn — so a country's character genuinely changes over a game. What a
succession clears is the country's *judgements* (setbacks, posture, theatre, walls); what it
does **not** clear is the committed continents, the call-in bindings or the treachery mark,
because those are facts about the COUNTRY.

### 6.2 What diplomacy actually reads

**Exactly one trait: `risk_taking`.** It appears in four places:

| Where | Effect |
|---|---|
| `proposalOutcomeFor()` | ±0.60 on a peace or ceasefire — cautious leaders agree |
| `allianceScoreFor()` | ±0.50 on an alliance — cautious leaders ally |
| `callInOutcomeFor()` | ±0.50 on a call to arms — **reversed**: aggressive leaders turn up |
| `planAgreementOffer()` | `risk_taking < 0.4` is one of the four reasons a country sues for a ceasefire |
| `opportunisticAllowance()` | `risk_taking < 0.35` blocks opportunistic declarations outright |

The other five traits reach the *military* AI and never the diplomatic one.

### 6.3 The four things nobody remembers

This is the honest gap, and it is what the opinion mechanic would fill.

1. **Nothing is remembered about a specific pair beyond three narrow facts.** The register
   holds the state, the turn it began, a ceasefire's expiry and what it reverts to. The AI's
   own memory holds refusal cooldowns, call-in bindings and treachery marks. **There is no
   record of history between two countries** — who attacked whom, how many times, who took
   whose land, who kept a peace for eighty turns.
2. **Treachery is global, not personal.** A country that betrays Spain is refused by
   *everybody*, and Spain is no angrier about it than Chile. That is a defensible first cut,
   but it means the one memory in the system is impersonal.
3. **The one ledger that exists is narrow to the point of almost never firing.**
   `theatreFailuresAgainst()` counts attacks this country has **lost against** the proposer,
   and only while the proposer is its committed theatre rival — against whom a peace is
   refused anyway. So the term reads zero for essentially every negotiation in the game. There
   is no count of attacks *suffered* at all, so being invaded repeatedly makes a country no
   less willing to sign with the invader.
4. **A conquest leaves no diplomatic trace.** Taking a province off a country changes its
   army, its income and its posture — and changes nothing at all about how it feels toward
   you. The word for that is missing from the system.

There is also one structural fact worth naming before designing anything: **`urgency` is the
only "world state" input** any of these rules has, and it is the same number everywhere — the
strongest rival's share of the world's land. It is a fine runaway-leader signal and it is not
an opinion, because it is identical for every pair.

---

## 7. Where an opinion mechanic would go

**THIS SECTION HAS BEEN BUILT.** It was written as a proposal to be argued with, it was argued
with, and what came out of that argument is [08-opinion.md](./archived/08-opinion.md), which is the
design of record. Read this section for the reasoning that led there and that document for
what the code does.

Four of its proposals were **overturned**, and each is worth knowing before reopening one:

* **§7.3's list of readers is right, and §7.6's fourth question was answered YES** — opinion
  reaches `rankRivals()` in `theatre.js` in the same stage rather than a later one, which is
  what makes a grudge a reason the world goes to war rather than only a diplomatic modifier.
* **§7.1's "decay toward a baseline" became decay toward a RESTING POINT the standing state
  implies** — war rests at −40 and an alliance at +50, which gives "a maintained peace warms
  a relationship" with no hook at all and stops a fifty-turn war and a fifty-turn peace
  arriving at the same number.
* **§7.5 is overruled: the tooltip DOES carry it**, as two bars. The argument here was that an
  opinion is the same class of thing as a trait value; the argument that won is that a trait
  is fixed and secret while an opinion is a consequence of the player's own actions, and a
  relation the player cannot see is a rule they cannot play against.
* **§7.6's claim that this lands on Q8 and Q9 of [06-diplomacy.md](./archived/06-diplomacy.md) was
  simply wrong**, and is corrected here rather than quietly dropped: Q8 is whether an alliance
  changes the victory condition and Q9 is whether the player's neighbours should start at war.
  Neither is about opinion and both remain **open**.

The brief's *"30% facts of state, 70% opinion"* was **sequenced rather than refused** — see
[08-opinion.md](./archived/08-opinion.md) §1.1 for why a literal blend would make seventy per cent of
every negotiation in the first fifty turns a constant.

Everything below is the section as it was written, unchanged.

### 7.1 The shape that fits what already exists

The register is already **one record per unordered pair**, sparse, saved and restored. An
opinion is a fact about a pair — but it is **directional** (France may resent Spain more than
Spain resents France), which the register deliberately is not.

That is the first real design question, and there are two clean answers:

- **Directional opinion in a second sparse map**, keyed `(holder, subject)`, living in
  `src/ai/diplomacy.js`'s memory beside `refusals` / `callIns` / `treachery` and riding in the
  same `aiStrategy` save slice. Nothing about the register changes. This is the cheaper and
  safer option and it is what I would build.
- **A symmetric "relationship warmth" on the relation record itself.** Simpler to reason about
  and simpler to show, but it cannot say *"you wronged me"*, which is most of the point.

Either way it should be a **number that decays toward a baseline**, exactly as
`treacheryOf()` already does — the precedent is `theatreCommitment.wallMemoryTurns`, and the
reason is stated there: *"they tore up a treaty on turn 12" stops being the most useful thing
to know about a country forty turns later*, and a permanent grudge makes one bad turn an
unrecoverable game state.

### 7.2 What would move it

The events that already exist and are already routed through single doors, so each is one hook:

| Event | Direction | Where the hook goes |
|---|---|---|
| declared war on you | they → you, large negative | `applyAiDeclarations()` / `declareWarOnCountry()` |
| took a territory from you | large negative, scaled by what it was worth, and if the attacked country is high reconquista | `TERRITORY_CHANGED`, the same event the feed derives a conquest from |
| failed an attack on you | small negative both ways | `recordFailedAttack()` |
| laid a siege on you | negative | `SIEGE_CHANGED` |
| agreed a ceasefire / peace | small positive | `acceptProposal()` |
| kept a peace for N turns | slow positive drift | the relation's own `since`, read at the turn boundary — costs nothing to store |
| allied with you | positive | `acceptProposal()` |
| answered your call to arms | large positive | `applyCallInAnswer()` |
| refused your call to arms | negative, both ways | `applyCallInAnswer()` |
| betrayed you | very large negative, **personal**, on top of the existing global mark | `applyBreach()` |
| fights your enemies | positive drift | already computed as `sharedEnemiesBetween()` |
| is allied to your enemy | negative drift | one register walk |

**Every one of those already passes through exactly one function**, which is what makes this
affordable. The one to be careful with is the conquest hook, because it fires on the same
event the activity feed uses and would run 51 times on turn 1.

### 7.3 Where it would be read

Deliberately few places, and all of them additive — an opinion term should be a *seventh term*
in an existing score, not a new gate, because a new gate can freeze the world and the terms
cannot.

| Rule | How it enters |
|---|---|
| `proposalOutcomeFor()` | one more scored term, `opinionWeight × opinion`, and one more clause in `reasonFrom()` |
| `allianceScoreFor()` | the same, weighted **heavier** — you ally with people you like |
| `callInOutcomeFor()` | the same — you turn up for people you like |
| `planAgreementOffer()` | who it offers to: currently "the war it has lost most against", could become "the war it has lost most against, among those it least dislikes" |
| `rankRivals()` in `theatre.js` | **the interesting one.** A country's mid-term goal is who it wants to absorb, and today that is decided almost entirely by weakness. An opinion term here is what would make a country pick a grudge over a soft target |
| `planDeclarations()` | opportunistic declarations could prefer a disliked neighbour; the theatre war must stay unconditional |

### 7.4 Four warnings from what this phase already measured

1. **Never gate on it.** `postureAllowance` giving DEVELOP and DEFEND zero opportunistic
   declarations has exactly the shape that caused known-issue **BA** — a rule that
   disqualified 93% of the world and froze the map — and it is only safe because the theatre
   war is unconditional. An opinion that could *refuse* a declaration or *require* a threshold
   to accept would be a new freeze risk. As a term it cannot be.
2. **A ratchet has to have a pawl.** Stage 3 shipped declarations without peace and pairs at
   war climbed 536 → 749 across a run, because a declaration was permanent. A grudge that only
   ever grows is the same mistake in a new place — hence decay toward a baseline, and hence at
   least one event that *improves* an opinion for every one that worsens it.
3. **Do not put it on `Math.random`.** Every AI diplomatic decision today draws **no**
   randomness at all, which is why nothing in `src/ai/diplomacy.js` can move a seeded outcome.
   An opinion with a random component would put diplomacy on the game's stream and two runs of
   one seed would diverge.
4. **It has to be measured, not played.** The acceptance criterion for any change to `src/ai/`
   is `tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND` across the five goals,
   and this phase's own history says why: at stage 5.1 the same measurement showed pairs at war
   *settling* around 200 with ~500 agreements standing, and the over-consolidation stage 3 had
   left open correcting itself with **nothing tuned to achieve it**. An opinion layer will move
   those numbers and there is no way to see it by playing.

### 7.5 What it should be worth showing the player

The panel already has the room and the vocabulary. `countryDetail()` builds a `facts` list —
*Holds*, *Standing*, *Since*, *Runs out* — and a row of actions each with a sentence saying
why it is offered or refused. An opinion would be one more fact and one more clause in the
refusal sentence, and **that is most of its value**: the reason a player is told no becomes a
thing they can change, rather than a fact about arithmetic they cannot see.

The territory tooltip should probably **not** carry it. The standing rule there is that the
three personality *names* are shown and the six trait *values* are not, because a trait is the
number the AI plans with and putting one on a tooltip is the enemy's plan drawn on the map. An
opinion is the same class of thing.

### 7.6 The open questions in the design document

§7 of [06-diplomacy.md](./archived/06-diplomacy.md) already carries Q4b, Q8, Q9 and Q10 as open. **Q8
and Q9 are where this lands.** Worth deciding before any of it is built:

1. **Directional or symmetric?** (§7.1 — I would say directional, in AI memory, not on the
   register.)
2. **Does the player have an opinion score too**, or only a reputation the AI reads? The
   asymmetry is defensible: the player's *attitude* is expressed by what they do.
3. **How visible?** A number, a word (*cordial / cool / hostile*), or only a clause in the
   refusal sentence.
4. **Does opinion reach `theatre.js`?** This is the biggest single decision, because that is
   what turns an opinion from a diplomatic modifier into a reason the world goes to war.
