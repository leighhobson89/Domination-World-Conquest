# Opinion — how a country feels about you specifically



**What this is.** The layer [05-diplomatic-acceptance.md](../05-diplomatic-acceptance.md) §7
proposes, built. Every diplomatic decision in the game today is taken from **present-tense
facts about the world** — how many wars a country is fighting, what its posture is, how big it
is next to you, how alarmed it is by the runaway leader, and who is in charge of it this
decade. Not one of them is a memory of what the two of you have done to each other. §6.3 of
that document names the gap in four parts, and the shortest version of it is this: **taking a
province off a country changes its army, its income and its posture, and changes nothing at
all about how it feels toward you.**

Opinion is that missing word. It is a number from **−100 to +100** that each country holds
about each other country, moved by what happens between them and pulled back over time toward
whatever their standing relationship implies.

---

## 1. The five decisions

These were put to Leigh before anything was built, because each one changes what gets built.

### 1.1 It is a heavy TERM, not a percentage of the answer — for now

The original brief was to make acceptance **30% the facts of state and 70% opinion**. The
analysis that came back, and the reason it was not built that way in this stage:

**It is not double-counting.** The six terms in `proposalOutcomeFor()` are all present-tense
world facts and none of them is a history between two countries, so opinion is genuinely
orthogonal to them. (The one overlap is the *"attacks lost here"* term, which opinion
subsumes and which §2.2 of the acceptance document already records as almost never firing.)

**The objection is different: at turn 1 every pair sits at the baseline.** Under a literal
70/30 blend, seventy per cent of every negotiation in the first fifty turns would be a
constant, and diplomacy would get flatter before it got richer. So opinion enters as a
**seventh scored term**, sized so that a full grudge can sink an offer on its own and full
warmth can carry one on its own — `opinionWeight` × opinion, worth up to **±1.4** on a peace
against a threshold of 1.0, which already makes it the heaviest single input in the rule.

**The blend is not abandoned, it is sequenced.** The existing arithmetic and every existing
threshold survive this stage, which is what keeps the five-goal `ai-sim` table comparable
before and after. If the measurement is good, restructuring into a normalised 30/70 blend is
one further balance edit against a baseline that already includes opinion — rather than two
unmeasured changes at once, which is the mistake the economy phase records twice.

### 1.2 It decays toward a resting point the STANDING RELATIONSHIP implies

Not toward zero. Each state has a resting value — WAR **−40**, NEUTRAL **0**, CEASEFIRE
**+10**, PEACE **+25**, ALLIANCE **+50** — and every turn each stored opinion moves a fraction
of the distance toward it.

Three things this buys, and they are the reason it beats decaying to zero:

- **"Maintained peace warms a relationship" costs no hook at all.** It is what a resting point
  above zero *means*. Eighty turns of peace and an alliance that has stood for thirty are both
  simply relationships that have had time to settle.
- **An opinion never drifts to neutral while the shooting continues.** Decay toward zero would
  have a fifty-turn war and a fifty-turn peace both arrive at the same number.
- **It answers §7.4's second warning structurally.** A grudge that only grows is the ratchet
  that stage 3 of the diplomacy phase already shipped once and had to fix. Here the pawl is
  not a rule, it is the shape of the mechanism: everything returns to where the relationship
  says it belongs.

The state is *not* thereby double-counted in the acceptance score, because that score has no
term for the state at all — `canPropose()` gates on it and nothing weighs it.

### 1.3 It reaches `theatre.js` — a country can pick a grudge over a soft target

The biggest of the five decisions (§7.6 Q4), and Leigh took it in this stage rather than
deferring it. `rankRivals()` decides the ONE neighbour a country commits to absorbing, and
today that is decided almost entirely by **weakness** — the army ratio across the shared
frontier. A `grudge` term (weight **1.0**, against weakness 2.2 and onFocusContinent 1.5) is
what turns opinion from a diplomatic modifier into a reason the world goes to war.

It cuts both ways by construction: a disliked neighbour gains up to +1.0 and a **liked** one
loses up to 1.0, so a country stops choosing its own allies and peace partners to absorb.

### 1.4 An opinion survives a succession untouched

Like the treachery mark and the committed continents, and unlike the setbacks, the posture,
the theatre and the walls. It is a fact about the **country**: *they took our provinces* does
not stop being true because whoever ordered it is dead. `clearPlansFor()` does not touch it.

### 1.5 It is directional, and both directions are kept

France may resent Spain more than Spain resents France, which the register deliberately
cannot say — a relation is ONE record per UNORDERED pair. So opinion lives in a **second,
directional sparse map** keyed `(holder, subject)`, in `src/ai/`'s own memory beside
`refusals` / `callIns` / `treachery`, riding the same `aiStrategy` save slice. Nothing about
the register changes and the snapshot version does not move.

**The player holds opinions too, set by exactly the same rules.** Leigh's brief: the tooltip
shows *them → you* and *you → them*, and the player's half is computed rather than chosen —
declaring war on somebody lowers their opinion of you, and being declared on lowers yours of
them. **In this stage the player's half is display only.** Nothing reads it, because there is
nothing yet for the player to express an attitude with; the posture control Leigh has in mind
is what will give it teeth.

---

## 2. What moves it

Every one of these already passes through exactly one door, which is what makes the whole
layer affordable. There are three: `ACTIVITY_LOGGED` for the fighting, `DIPLOMACY_CHANGED` for
the diplomacy, and `TURN_CHANGED` for the settle. Everything is DERIVED rather than reported
from a list of call sites, for the reason the activity feed already established: there are
eight places that take a territory, and a list of eight hooks is one new attack route away
from being wrong.

| Event | Who moves | Amount | Door |
|---|---|---|---|
| declared war on you | the victim, toward the declarer | **−30** | `DIPLOMACY_CHANGED`, `via: "declared"` |
| took a territory from you | the loser, toward the taker | **−25**, scaled by `reconquista` | `ACTIVITY_LOGGED`, a CONQUEST entry |
| laid a siege on you | the besieged, toward the besieger | **−15** | `ACTIVITY_LOGGED`, a SIEGE_STARTED entry |
| failed an attack on you | **both ways**, small | **−8** | `ACTIVITY_LOGGED`, an ATTACK_FAILED entry |
| agreed a ceasefire | both ways | **+10** | `DIPLOMACY_CHANGED` |
| agreed a peace | both ways | **+18** | `DIPLOMACY_CHANGED` |
| allied with you | both ways | **+25** | `DIPLOMACY_CHANGED` |
| answered your call to arms | the caller, toward the joiner | **+35** | `DIPLOMACY_CHANGED`, `via: "calledIn"` |
| refused your call to arms | **both ways** | **−30** | `DIPLOMACY_CHANGED`, `via: "declinedCall"` |
| betrayed you | the victim, toward the betrayer | **−85** | the BETRAYAL transition, derived |
| kept a peace / held an alliance | — | the resting point does it | §1.2 |

**THE THREE MILITARY EVENTS COME OFF `ACTIVITY_LOGGED` AND NOT OFF THE RAW STORE EVENTS**,
which is a deliberate improvement on the plan this document originally carried.
`activityRecorder.js` already owns the hard part of reading `TERRITORY_CHANGED`: which changes
are conquests, and which are the bootstrap assigning the player their starting land or a
restore patching the world back into place. Deriving that a second time here would be a second
copy of a rule that has already been got wrong once. Reading the entry the feed produced
instead means the feed cannot record a conquest this misses, and this cannot invent one the
feed does not show the player.

**A PAIR ARRIVING AT WAR IS NOT ALWAYS SOMETHING SOMEBODY DID.** A ceasefire that simply lapses
puts two countries back to war with `via: "expired"` and nobody to blame, so only `declared`
and `calledIn` are charged as acts. Everything else is left to the resting point, which makes
the renewed war felt without anybody being blamed for it. A unit test caught this: without the
guard, every ceasefire in the game had a sting in its tail that nothing in the design asked
for.

**THE BETRAYAL FIGURE HAS TO CLEAR THE RESTING POINT IT FALLS FROM**, which is why it is nearly
three times a declaration rather than merely larger. A betrayal is by definition committed out
of an AGREEMENT, and an agreement rests warm — an alliance at +50. At the −60 this document
first proposed, the victim of a betrayed alliance landed on −10, which is *milder* than being
declared on out of neutral; a unit test caught that too. At −85 it lands at −35 from an
alliance, −60 from a peace and −75 from a ceasefire: worse than any declaration from any
state, which is the ordering the whole betrayal penalty rests on.

**`reconquista` is the one trait that scales an event**, and it is the trait for exactly this:
*how much it wants lost territory back*. A country at 1.0 resents a conquest half again as
much as one at 0.0. It is read at the moment the territory changes hands, so a later
succession does not re-price a grudge already formed.

**Nothing here draws randomness.** `src/ai/diplomacy.js` draws none today, which is why
nothing in it can move a seeded outcome, and §7.4's third warning is that an opinion with a
random component would put diplomacy on the game's stream.

**Two floods are guarded, both derived from what the activity feed already learned.** First
contact writes ~1,900 pairings on a busy turn 1 and is not an event; and the conquest hook
fires 51 times on that same turn, which is fine as a map write and would not be fine as
anything more expensive.

---

## 3. What reads it

Additive everywhere. **An opinion is never a gate** — §7.4's first warning, and the reason is
known-issue **BA**: a rule that disqualified 93% of the world froze the map, and it took a
hundred turns of measurement to find because nothing throws. As a term it cannot do that.

| Rule | How it enters | Worth |
|---|---|---|
| `proposalOutcomeFor()` | a seventh scored term, and a clause in `reasonFrom()` | **±1.4** against a threshold of 1.0 |
| `allianceScoreFor()` | the same, heavier — you ally with people you like | **±1.8** against a threshold of 1.6 |
| `callInOutcomeFor()` | the same — you turn up for people you like | **±1.6** against a threshold of 1.0 |
| `planAgreementOffer()` | among the wars it values least, it offers to the one it least dislikes | a tie-break, and see below |
| `rankRivals()` in `theatre.js` | the `grudge` term, §1.3 | **±1.0** against weakness 2.2 |

`theatre.js` and `diplomacy.js` are both pure and both run in Node, so the lookup is
**injected** as a function rather than imported — the same arrangement the seeded rng and
`calculateProbabilityPreBattle` already have.

**THE TIE-BREAK IS WHERE MORE WORK HAPPENS THAN IT LOOKS.** `planAgreementOffer()` is
documented as offering peace to *"the war it has lost most against"*, and
[05-diplomatic-acceptance.md](../05-diplomatic-acceptance.md) §1.2 already records that in
practice this is alphabetical: `theatreFailuresAgainst()` counts defeats only against the
committed theatre rival, who is excluded from that list, so **every candidate reads zero and
the choice falls straight through to the tie-break**. The stated intention had no effective
mechanism behind it. It has one now — a country sues for peace with the enemy it minds least,
which is what anybody reading that sentence would have assumed it already did.

---

## 4. What the player sees

**A bar in the territory tooltip, both directions.** Leigh's brief, and it overturns §7.5 of
the acceptance document, which argued the tooltip should not carry it on the grounds that an
opinion is the same class of thing as a trait value — the number the AI plans with. The
counter-argument is the one that decided it: **a relation the player cannot see is a rule they
cannot play against**, and the whole point of the mechanic is that *the reason you are told no
becomes a thing you can change*. A trait is fixed and secret; an opinion is a consequence of
the player's own actions, and it has to be legible for those actions to mean anything.

Two bars, red at −100 through neutral at 0 to green at +100, on any territory that is not the
player's own: **how they see you**, and **how you see them**. Each carries a word — *hostile,
cold, cool, neutral, warm, friendly, devoted* — because a bar with no label is a shape.

**And a fact in the diplomacy panel**, beside *Holds*, *Standing*, *Since* and *Runs out*,
where the offers are actually made and refused.

---

## 5. Measurement

The acceptance criterion for any change to `src/ai/` is
`tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND`, and this change touches
the theatre choice as well as the three acceptance scores — so it moves both the consolidation
numbers and the diplomatic ones. What to watch:

- **pairs at war** — stage 5.1's pawl took this from a ratchet to a curve that settles around
  200. An opinion layer that makes grudges self-sustaining would put the ratchet back.
- **agreements standing** — around 500 at the last measurement.
- **largest empire / countries surviving** — the theatre term is the one that can move these,
  because it changes who each country goes after.
