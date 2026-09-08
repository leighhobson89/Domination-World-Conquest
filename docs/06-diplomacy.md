# Diplomacy — Peace, War and Alliance

**The phase in flight.** `05` stays the standing list of what to do next; this is the item
taken off it, and [06-diplomacy-checklist.md](./06-diplomacy-checklist.md) is the task
breakdown. Breathing document: it describes the design as decided and the code as it is
today, and it is edited as work lands.

---

## 1. What is wrong with the world today

Every country on this map is at permanent, undeclared, all-out war with every country it can
reach. There is no other state and there never has been. Three things follow from that, and
they are the reason this phase exists.

**A war has no beginning, so it has no meaning.** Nothing is ever declared, so nothing can be
a surprise, a provocation or a mistake. The player cannot antagonise anybody and cannot avoid
anybody. The one thing that decides who fights whom — 359 territories' worth of it — is a
constant.

**A country cannot choose its enemies, so it cannot choose its friends either.** The AI is
already sophisticated about *which* target to take (`src/ai/targeting.js` returns one verdict
per pairing, `src/ai/theatre.js` commits a country to absorbing one neighbour at a time) and
has no vocabulary at all for *whom not to fight*. A country losing badly on two fronts has no
move available to it but to keep losing on two fronts.

**Nothing can gang up on the leader.** This is the one Leigh named as the goal: *"the eventual
idea is that countries will work together to overcome adversaries"*. The machinery for
noticing a runaway leader already exists and is already computed every turn —
`doctrine.js`'s `urgency` is the strongest rival's share of the world's land, and it is what
makes the whole world attack a player who pulls ahead. What it can do with that today is
raise an attack budget. It cannot pick up a telephone.

---

## 2. The six states

| State | May attack? | How it is entered | How it is left |
|---|---|---|---|
| **No contact** | no | the default for all 21,321 pairs | their borders touch, once, and never again |
| **Neutral** | no | first contact; and a ceasefire or a broken peace lands here | somebody declares war, or an agreement is signed |
| **War** | **yes** | **declared**, out of any state but no contact | a ceasefire or a peace is agreed |
| **Ceasefire** | no | agreed, with a turn it runs out on | it expires (back to what it was agreed out of), or firms into a peace |
| **Peace** | no | agreed, no end date | war is declared out of it — which is a breach, and costs |
| **Alliance** | no | agreed, out of peace | war is declared out of it — the largest breach in the game |

**The register is SPARSE and that is the design.** 207 countries make 21,321 pairs; a record
exists only for a pair that has left no contact, so an empty register is literally *"every
country at no contact with every other"*, and it costs nothing in memory or in a save file. A
record existing is also the permanent proof that the two have met, which is why there is no
separate "have they ever touched" set to keep in step.

**A relation is one record per unordered pair.** There is no "France's relation to Spain" and
"Spain's relation to France" — a relation has no subject and no object, so the two directions
cannot drift apart. This is not fussiness: five straits in
[manualAdjacencyExceptions.js](../src/data/manualAdjacencyExceptions.js) were listed on ONE
SIDE ONLY for the life of the project (known-issue **BS**), and a one-way border has no
signature at all — nothing throws, both countries plan normally. A one-way *relation* would
be worse, because the country on the wrong side of it would plan a war its opponent did not
know it was in.

---

## 3. The decisions Leigh has taken, and what each one costs

### 3.1 First contact is NEUTRAL, not war

**This is the single most consequential line in the system**, and it is one constant:
`FIRST_CONTACT_STATE` in [diplomacy.js](../src/state/diplomacy.js). Two countries who have
merely met may not attack each other. War is a thing a country **declares**.

**The consequence, stated plainly: until declarations exist, wiring the attack gates to the
register would freeze the entire world.** `allowsAttack()` permits WAR and nothing else, so a
map of neutral pairs is a map where nobody may fight. That is not a hypothetical failure mode
in this codebase — it is known-issue **BA**, where a posture rule disqualified 93% of the
world from expanding and the map froze at 163 countries with the largest empire never passing
30. Nothing threw, every turn completed, and the only symptom was a map that quietly stopped
changing.

**AND THAT FREEZE IS NOW A DELIVERABLE, NOT A HAZARD.** The first draft of this plan put the
declaration rules before the gates precisely to avoid it. Leigh read that and asked for the
opposite: *"by the end of stage 2 we should have a situation where neutral states are actually
neutral and are not attacking, then we will reintroduce the fighting once we have the capability
of changing state by communication diplomacy and also declaring without chatting too."*

So the order is **gates first, declarations second**, and the quiet world in between is a
checkpoint to be looked at rather than a failure to be avoided. The reasoning is sound and worth
recording, because it inverts a rule this codebase otherwise follows: a mechanism that stops
things happening is far easier to trust when you can *see* it stop them. A world that goes
silent the moment the gates land is proof the gates work; the same gates landing on top of a
declaration system would be proof of nothing in particular, because the world would carry on
fighting either way and no measurement could separate "the gates hold" from "the gates leak".

What follows from taking that route deliberately is that **Stage 2 leaves the game unplayable as
a game** — nobody may attack anybody, including the player — and that is expected, temporary and
recorded here so that nobody reading the tree at that commit mistakes it for known-issue **BA**
happening again.

### 3.2 A declaration takes effect at once

There is no waiting period anywhere in this system. Declare war and attack the same turn.

What separates the states is therefore not *delay* but **price**: declaring out of neutral is
free, because nothing was promised; declaring out of peace, a ceasefire or an alliance is
breaking something, and that is what §5.4 costs.

This is also what keeps the player's controls simple. A territory belonging to a country you
are not at war with is not attackable; the attack control says why and offers the
declaration; taking it makes the territory attackable in the same breath.

### 3.3 An alliance shares four things

Leigh's answer, in full: **passage and stacking rights**, a **standing share of income**, the
same **standing share of oil, construction materials and food**, and **shared intelligence**.

That is the most expensive of the four decisions to build, and it is the one that makes an
alliance worth the risk in 3.4. Each half is designed in §5.5.

### 3.4 An ally is CALLED IN, and refusing costs nothing

**Revised by Leigh after the first draft, which had co-belligerence automatic.** It is not
automatic and nothing cascades. When a party to an alliance **declares war** — when it is the
aggressor — its ally is *asked* to join:

* **the ally joins**, and enters the war; or
* **the ally refuses**, and the alliance ends **with no penalty to either side**. The aggressor
  is not punished either. Their cost is exactly the thing that happened: they have gone to war
  without an ally they were relying on.

That makes the penalty rule a single sentence, and it is worth stating on its own because
everything else about alliances follows from it:

> **The penalty is for ENDING AN ALLIANCE WHEN BOTH SIDES DO NOT AGREE, and for nothing else.**

So there are exactly **two penalty-free ways out** of an alliance, and they are the two where
both parties have in effect agreed:

1. **declining a call-in.** The refusal itself dissolves the alliance, and neither side pays.
   The aggressor chose a war their ally would not fight; the ally chose not to fight it. Both
   have made a decision, and the alliance is simply over.
2. **a mutual dissolution.** Either side may propose *ending the alliance*, and if the other
   accepts, it ends free for both. (New, at Leigh's request, and it is what makes an alliance
   something a country can plan its way out of rather than only betray its way out of.)

Everything else is the **breach**: walking out unilaterally, or declaring war on the ally
directly. That is what §5.4 costs, and it is now the only thing that does.

**This deletes the cascade problem outright.** The first draft's automatic co-belligerence
needed a rule forbidding a transitive closure, or one signature would have put the whole map at
war in three hops. Nothing propagates now: a war spreads one country at a time, and only ever
because somebody said yes.

Two things this leaves open, both **Q3**: whether an ally is called in when the partner is
*attacked* rather than attacking (Leigh's rule names the aggressor, and defence is arguably the
one case where an alliance ought to bind), and when the call has to be answered — before the
declaring country may attack, or at the start of the following turn.

### 3.5 Later: a federation

**Back burner, recorded so the shape of the register is not painted into a corner.** An
alliance may eventually be **opened into a FEDERATION** by inviting other states to join it: a
multi-party bloc rather than a pair.

It is listed here rather than left out because it is the one future feature that could break
the register's central assumption. **A relation is a fact about a PAIR**, and a federation is a
fact about a SET — so a federation is not a sixth relation state, it is a second structure
(a named bloc with a membership list) whose members happen to be pairwise allied. Building it
that way keeps the pair register exactly as it is; building it as a state would need every
member's relation to every other member kept in step by hand, which is the two-rows-per-relation
mistake at a larger scale.

Nothing is designed for it yet. Stage 7 of the checklist holds a placeholder.

## 4. What is already built

Stage 0 is delivered and in the working tree. It changes no outcome in the game: nothing reads
the register to decide anything yet.

| Module | What it is |
|---|---|
| [src/state/diplomacy.js](../src/state/diplomacy.js) | The vocabulary. The six states, the canonical pair key, `allowsAttack()`, `allowsDeclaration()`, `isAgreement()`, `sharesResources()`, `describeState()`. **Imports nothing at all**, the same arrangement `phases.js` has, so it can be read by the store, the rules, the AI and the UI without dragging anything into any of them |
| [src/state/GameState.js](../src/state/GameState.js) | The register itself: `store.diplomacy.relations`, a sparse `Map` keyed by the pair key |
| [src/state/selectors.js](../src/state/selectors.js) | `relationBetween()`, `relationStateBetween()`, `countriesMayFight()`, `relationsFor()`, `allRelations()`, `relationCount()` |
| [src/state/mutations.js](../src/state/mutations.js) | `setRelationState()` and `clearRelations()`, and `Events.DIPLOMACY_CHANGED` |
| [src/state/snapshot.js](../src/state/snapshot.js) | Save and load, as rows rather than as `Map` entries. **The snapshot version did not move**: a save taken before diplomacy existed restores an empty register, which is exactly "every country at no contact", so an old save is still a valid one |
| [src/rules/diplomacy/contact.js](../src/rules/diplomacy/contact.js) | The pure walk: which countries' territories touch. Takes the neighbour lookup as an argument, because `src/data/adjacency.js` throws in Node |
| [src/state/diplomacyContacts.js](../src/state/diplomacyContacts.js) | The live half: asks the real graph and records first contact. Dirty-flagged on `TERRITORY_CHANGED`, run at the turn boundary and lazily on read |
| [src/ui/map/diplomacyTooltip.js](../src/ui/map/diplomacyTooltip.js) | The tooltip rows, pure and unit-tested |

Four things worth knowing about that code before extending it.

**The country is `dataName`, never `owner`.** `pathOwner()` answers `"Player"` on the player's
own land, so the first version of the tooltip made the player's own territory take the
*somebody else's country* branch and list the player's own country as a foreign power at no
contact with itself. The register is keyed by COUNTRY, and the country is the current owner.
It was found by hovering the running game, not by reading — which is house rule 7 earning its
place again.

**Contact is re-derived, not computed once.** A conquest is precisely how two countries on
opposite sides of the world come to share a border, so the walk runs on a dirty flag rather
than at seeding.

**The walk is cheap but not free**, so it is coalesced: a busy turn 1 logs fifty-one
conquests and the walk is ~1,900 pairings, so it runs at most once per turn rather than once
per conquest.

**The tooltip shows two different lists, on purpose.** On your own territory: everybody you
have a relation with, no-contact filtered out. On somebody else's: the state between them and
**you** first, always, *even at no contact* — because "we have never met" is exactly what a
player wants to know about a country on the far side of the map, and it is the one row that
would otherwise be missing precisely when it is most informative. Six rows, then a count.

---

## 5. The system, part by part

### 5.1 Who declares war, and why — `src/ai/diplomacy.js`

The new module, and the one the whole phase stands on. It is the diplomatic counterpart of
[doctrine.js](../src/ai/doctrine.js), and it should follow the same containment rule: **it is
the only module in `src/ai/` allowed to decide a diplomatic action**, so the rest of the AI
keeps reading a state rather than re-deriving an intention.

It needs to answer four questions per country per turn:

1. **Whom do we declare war on?** The natural hook already exists: `theatre.js` commits each
   country to absorbing ONE neighbouring country and keeps that commitment until the rival
   becomes a wall. **A theatre commitment is a declaration of war** — that is the rule, and it
   costs almost nothing to implement because the commitment is already made, already
   persistent and already the country's own answer to "who is my enemy".
2. **Whom do we make peace with?** A country fighting on more than one front, losing ground,
   or with a pacifist leader (`risk_taking` is already a trait, 0.0–0.4 on a pacifist) should
   want out of its least valuable war. A ceasefire is the cheap version and the AI should
   reach for it first.
3. **Whom do we ally with?** `doctrine.js` already computes `urgency` — the strongest rival's
   share of the world's land — every turn, memoised on the standings object. **That number is
   already the "somebody is running away with it" signal**, and it is the input the alliance
   rule wants. The shape is: at high urgency, a country seeks an alliance with a neighbour who
   is *also* threatened by the same leader.
4. **Do we accept what has been offered?** Symmetric with the above, plus a memory of who has
   betrayed whom.

**It must not reach into the siege budget.** `doctrine.js` deliberately exposes no siege dial
because the siege budget's subtraction of running sieges is what ended the 17-to-67-concurrent
problem, and a multiplier over that cap walks straight back into it. The same discipline
applies here.

### 5.2 The gates — where a relation actually stops a fight

Four places, and they must all read the same selector (`countriesMayFight()`), for the reason
the dice model established for combat: two gates that answer the same question separately will
eventually answer it differently.

| Gate | Where | What changes |
|---|---|---|
| The AI's target rating | `rateTarget()` in [targeting.js](../src/ai/targeting.js) | A refusal with a **stated reason**, next to the player's grace period — that is the one place a target is declined with a reason the debug panel and the plan log can read |
| The player's attack destinations | the highlight walk in [ui.js](../ui.js) | A territory of a country not at war is not a valid destination; the attack arrows do not reach it |
| The player's attack control | the move button / attack window | Says *why*, and offers the declaration |
| The siege gates | [siege.js](../src/rules/military/siege.js), `siegeReview.js` | A siege may not be **opened** against a country not at war |

**A standing siege is not cancelled by a peace** unless §5.3 says so — see **Q1**.

### 5.3 Negotiation, and what a ceasefire reverts to

A ceasefire carries `until`, the turn it runs out on. The register record already has the
field.

**What it reverts to is an open design point and it needs a third field.** A ceasefire agreed
during a war and allowed to lapse should plainly go back to WAR — that is what a ceasefire
*is*. But with NEUTRAL as first contact, "reverts to war" and "reverts to neutral" are now
genuinely different outcomes, and the record has to remember which. The proposal is a
`revertsTo` field set at the moment the ceasefire is signed, so the answer is a fact about
that agreement rather than a rule guessed at expiry. This is **Q2**.

### 5.4 Breaking an agreement — and the three ways of ending one that are not a breach

Leigh: *"a very large penalty indeed if broken"*, narrowed by §3.4 to exactly one act. **An
alliance ends without penalty whenever both sides have, in effect, agreed it should**, and the
system now recognises three such endings:

| Ending | Penalty? | Why |
|---|---|---|
| The ally **declines a call-in** | **none, either side** | The aggressor chose a war the ally would not fight, and the ally said so. Both decided |
| A **mutual dissolution** is proposed and accepted | **none, either side** | Both agreed |
| A **ceasefire expires** or a peace lapses by its own terms | none | Nothing was broken; a thing ended |
| One side **walks out** unilaterally, or **declares war on its own ally** | **the full penalty** | This is the breach, and now the only one |

So the "very large penalty indeed" attaches to a single, sharply-defined act, which is what
makes it safe to make it large. The proposal for its shape, still **Q4**:

* every other **agreement** the betrayer holds drops to NEUTRAL. Nobody keeps a treaty with
  somebody who has just torn one up;
* the betrayer carries a **treachery mark** for N turns, during which no AI will accept any
  agreement from them. This is the part that makes the benefits in §5.5 into a hostage;
* the mark decays, the way `theatre.js`'s walls already decay, so a betrayal is a setback
  rather than a permanent exclusion.

Breaking a **peace** costs less than breaking an **alliance**; leaving **neutral** costs nothing
at all, because nothing was promised.

**The asymmetry is the point.** A country that wants out of an alliance has a free, honest route
available to it every single turn — propose dissolution — so choosing the breach instead is a
choice to be treacherous rather than a choice to be free, and the penalty is priced against that
rather than against wanting to leave.

### 5.5 What an alliance actually gives

**Passage and stacking.** Allied territories become traversable: `getInteractableFrom()` is
the graph the game will let an army cross, and the muster's `pullField()` walks OWNED
territories only. Both need to widen to "owned or allied". **This is the item most likely to
have a long tail** — the muster's oil-corridor rule, the transfer window's destinations, the
attack-arrow walk and `route.js`'s corridor all read that graph.

**A standing share of income — gold, oil, construction materials and food.** One share
constant per resource, in `balance.js`. Three rules the economy phase already established
apply directly:

* **it must arrive through the economy context**, exactly as the continent bonus and the
  random event do, so `income.js` stays a pure function of `(territory, context)`;
* **it must never be written onto a territory.** A stored transfer needs an exact inverse
  write when the alliance ends, and an ally who kept the income after the alliance lapsed
  would be a silent bug of precisely the kind `continentBonus.js` exists to prevent;
* **it multiplies a FLOW, not a ceiling.** `CONTINENT_BONUS_GOLD` and
  `CONTINENT_BONUS_CAPACITY` are two dials because a flow and a ceiling behave completely
  differently over forty turns.

**A symmetric share is nearly a wash between equals and a large subsidy from the big to the
small.** Whether that is the intention is **Q5**.

**Shared intelligence.** The cheapest of the four and the most visible: the military view's
figures and threat marks extend over an ally's frontier, the tooltip shows an ally's
relations in full, and the ally's threatened borders appear in the turn briefing. Nothing new
is computed — `militaryShading.js` already plans the whole map and narrows the figures to the
player's frontier, so this is a widening of `entry.frontier` and not a new derivation.

### 5.6 What the player does about it

Two surfaces, and one of them exists.

**The tooltip** (built) answers *what is the state*. **A diplomacy panel** has to answer *what
can I do about it*: the countries in contact, their state, who they are allied with, and the
actions available against each. Where that panel lives is **Q6** — a sixth tab in the info
panel is the cheap answer and the standings tab is the precedent, but a full-screen window in
the Dominapedia's shape is the one that would take a proposal, a counter-offer and a list of
who is at war with whom.

### 5.7 The news

`ActivityKind` is a **closed** set and `recordActivity()` rejects anything else, because the
card writer switches on it. Diplomacy adds declarations, treaties, alliances and betrayals —
and the closed set is the reason that is a deliberate edit rather than a new logger.

Two rules from the feed's own design carry straight over. **No country name may be used as an
adjective** — there are no demonyms for 207 countries, and a unit test fails the build if one
reappears. And **a busy turn must not become a spreadsheet**: fifty-one conquests already
become one compact "elsewhere in the world" list, and a world with 207 countries negotiating
will produce far more diplomatic events than military ones. Only the player's own diplomacy
should get a card.

---

## 6. The things that will bite

Listed because each one has a precedent in this codebase.

1. **The world freezes and nothing throws — and at Stage 2 it is SUPPOSED to.** That is the
   inversion §3.1 records, and the danger it creates is a different one: from Stage 3 onwards a
   *residual* freeze will look exactly like the intended one. The measurement is
   `tools/ai-sim.mjs`, and it needs new columns — pairs at war, agreements standing, countries
   at war with nobody — because a world at peace and a world too polite to fight are
   indistinguishable in every column it has today.
2. **Every balance number moves.** Diplomacy changes who fights whom, which is upstream of
   every figure in the five-goal table. **A control run has to be taken before anything
   lands**, on the current tree, or there is nothing to compare against. This is the
   Continent Bonuses §6 method and it is not optional here.
3. **A one-way relation.** Guarded by construction (one record per unordered pair) and
   asserted, and it is the failure with no signature.
4. **A cascade — designed out, and easy to reintroduce.** The call-in in §3.4 spreads a war one
   country at a time and only when somebody says yes. Any later shortcut that joins an ally to
   a war without an answer, including the obvious-looking one for *defensive* wars (**Q3**),
   puts the transitive closure straight back and the whole map at war in three signatures.
5. **A stored bonus.** The alliance's income share written onto a territory rather than
   derived at the point of use. §5.5.
6. **`useable*` left behind.** Anything that moves army between allied territories is a
   garrison write, and a garrison write that leaves `useable*` alone hands somebody vehicles
   they do not have (known-issue **BJ**). `writeGarrison()` is the only door.
7. **The AI's plans reaching the player.** The activity feed reports what HAPPENED; a panel
   showing who is *about* to declare war is a cheat, and the line is already drawn.

---

## 7. Open questions

Answers to these become edits to this document, and then rows in the checklist.

* **Q1 — a standing siege when a war ends.** Peace is agreed while a siege of yours is three
  turns from starving a province out. Does the siege lift immediately, does it run to its
  conclusion, or can peace not be agreed while a siege stands?
* **Q2 — what a ceasefire reverts to.** Back to war (what a ceasefire classically means), or
  back to neutral (which the sixth state now makes possible)? The proposal is that the
  agreement remembers, in a `revertsTo` field. And: can a ceasefire be broken early, or is it
  the one agreement that genuinely binds?
* **Q3 — the call-in, at its edges.** §3.4 settles the aggressor's case. Three edges are not
  settled. Is an ally called in when the partner is *attacked* rather than attacking — defence
  being arguably the one case an alliance ought to bind, and also the one case that reopens the
  cascade? When must the call be answered: before the declaring country may attack, or by the
  start of the next turn? And when an ally who joined later makes peace, does the country that
  called them in leave the war too, or stay in it alone?
* **Q4 — the betrayal penalty.** Now that §3.4 narrows it to one act — walking out, or turning
  on your own ally — is the shape in §5.4 right, and how long is the treachery mark? Is there a
  material cost as well as a reputational one?
* **Q4b — a refused call-in the AI is not asked about.** When the player is the ally and
  declines, they see a prompt. When two AI countries are involved the answer is a calculation.
  Should a country that has just *refused* its ally carry any memory of it at all — nothing is
  owed, but a country that agrees to alliances and never honours one is a country the world
  might reasonably stop allying with.
* **Q5 — the income share.** Symmetric (each ally pays the other the same percentage), or does
  the stronger support the weaker? And is a share of FOOD meaningful, given food is a stock
  against a ceiling rather than a treasury?
* **Q6 — where the player's diplomacy panel lives.** A sixth info-panel tab, or its own
  full-screen window?
* **Q7 — the player's protection.** `PLAYER_GRACE_TURNS` refuses the AI the *opening* of an
  attack or siege against the player for five turns. With declarations, should the grace
  period become a refusal to declare war — which is the same idea expressed in the new
  vocabulary and is strictly cleaner?
* **Q8 — does an alliance change the victory condition?** Under CONTINENTAL, do allies' holdings
  count together for a shared win, or does an alliance remain a means to a solo end? The
  standings tab and `victory.js` both depend on the answer.
* **Q9 — the player's own diplomacy at the start.** The player begins at neutral with their
  neighbours like everybody else. Is that the intended opening, or should the player's
  immediate neighbours start at war so turn 1 still has a fight in it?
* **Q10 — the federation.** §3.5 records the intent and the structural decision (a bloc with a
  membership list, not a seventh relation state). Everything else is open: who may invite, does
  a federation vote, does it share more than an alliance does, and does it win together.
