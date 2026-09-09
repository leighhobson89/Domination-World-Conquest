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

**Stages 0 to 5.5 are delivered, except 5.2.** The register exists, the gates read it, both
sides declare war, the player has a panel, a war can END, and an alliance can be signed — it
pays a standing share, shares the military map, and carries the call-in that is the price of
it. The game reaches all six states.

**Two things are not built.** PASSAGE AND STACKING (5.2) is blocked on the data model rather
than deferred: a territory holds ONE garrison, so "your army may sit in your ally's province"
means a second army under a second flag on a tile with no field for whose it is, and every
reader of a garrison — the battle model, income, upkeep, desertion, the muster, the threat
array — would have to learn that question. And the BETRAYAL PENALTY (5.6) does not exist, so
today the breach is defined, refused by the AI, named in the confirmation the player sees, and
free.

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
| [src/ui/diplomacy/relationTone.js](../src/ui/diplomacy/relationTone.js) | How a state is COLOURED, in one place: a class name and never a colour. Read by the tooltip and by the panel, and it is its own module for exactly that reason |
| [src/ai/diplomacy.js](../src/ai/diplomacy.js) | **Stage 3.** Who the AI declares war on, and who it leaves alone. Pure, draws no randomness at all, and the only module in `src/ai/` allowed to decide a diplomatic action |
| [aiCalculations.js](../aiCalculations.js) | `applyAiDeclarations()` — the WRITING half of the above, run from `planAiCampaign()` after the succession and before the goals |
| [src/ui/moveButton/deriveMoveButtonState.js](../src/ui/moveButton/deriveMoveButtonState.js) | **Stage 3.2.** `MoveMode.DECLARE`: the greyed button becomes an enabled DECLARE WAR wherever a declaration is possible, in a colour that is deliberately not the attack colour |
| [src/ui/diplomacy/declarationPrompt.js](../src/ui/diplomacy/declarationPrompt.js) | **Stage 4.** The confirmation before a declaration that would break an agreement — and `null`, meaning no dialog at all, out of neutral |
| [src/ui/diplomacy/relationsPanelModel.js](../src/ui/diplomacy/relationsPanelModel.js) | **Stage 4.** What the panel says: the grouped list, one country's detail, and the actions with the reason each is offered or refused. Pure, unit-tested |
| [src/ui/components/DiplomacyPanel.js](../src/ui/components/DiplomacyPanel.js) | **Stage 4.** The window that draws it, and the button in the map's left-hand chrome column |
| [src/ai/diplomacy.js](../src/ai/diplomacy.js) | **Stage 5.1** as well: `proposalOutcomeFor()` decides whether a country accepts what it has been offered, and `planPeaceOffer()` decides who it asks. Still pure, still drawing no randomness |
| [src/rules/diplomacy/expiry.js](../src/rules/diplomacy/expiry.js) | **Stage 5.1.** Which ceasefires have run out and what each falls back to — read off `revertsTo`, never guessed |
| [src/state/diplomacyExpiry.js](../src/state/diplomacyExpiry.js) | The live half, on `TURN_CHANGED`. Reached by a side-effect import in `ui.js` and nothing else, so deleting that line means a ceasefire never ends |
| [src/rules/economy/allianceShare.js](../src/rules/economy/allianceShare.js) | **Stage 5.3.** What an alliance pays, as two multipliers. Pure, importable by `econ-lab` |
| [src/state/diplomacyInbox.js](../src/state/diplomacyInbox.js) | **Stage 5.5.** What the AI has put to the PLAYER and is waiting on: a call to arms, or an offer. Filled during the AI phase, emptied at the end of it, imports nothing |
| [src/ui/diplomacy/describeInbox.js](../src/ui/diplomacy/describeInbox.js) | The wording of those prompts. Facts in the queue, sentences here — the activity feed's rule |
| [src/ai/diplomacy.js](../src/ai/diplomacy.js) | **Stages 5.4 and 5.5 too**: `allianceScoreFor()`, `callInOutcomeFor()`, and the call-in bindings that stop a joiner settling out of somebody else's war |

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

**Built, stage 3.** The diplomatic counterpart of [doctrine.js](../src/ai/doctrine.js), and it
follows the same containment rule: **it is the only module in `src/ai/` allowed to decide a
diplomatic action**, so the rest of the AI keeps reading a state rather than re-deriving an
intention.

**THE FREEZE GUARD IS THE SPLIT BETWEEN ITS TWO HALVES, AND IT IS THE ONE THING TO GET RIGHT
HERE.** From stage 3 onwards a residual freeze looks exactly like the stage 2 silence that was
the deliverable — nothing throws, every turn completes, the map quietly stops changing, which
is known-issue **BA** in this phase's clothes. So the theatre commitment becomes a declaration
UNCONDITIONALLY: no posture refuses it, and the concurrent-war cap does not apply to it, which
means every country with a reachable neighbour has a war. `declarationDiscipline`'s
`postureAllowance` gives DEVELOP and DEFEND nothing and most of this map is small countries, so
it has precisely the shape that caused BA — and it therefore governs the opportunistic
declarations and nothing else. Measured over 150 turns under all five goals, countries at war
with nobody is **zero**, against 207 at every sample of the stage 2 silence.

It answers four questions per country per turn. Only the first is built:

1. **Whom do we declare war on?** *(built)* The natural hook already existed: `theatre.js`
   commits each country to absorbing ONE neighbouring country and keeps that commitment until
   the rival becomes a wall. **A theatre commitment is a declaration of war** — that is the
   rule, and it cost almost nothing to implement because the commitment is already made,
   already persistent and already the country's own answer to "who is my enemy". On top of it
   sits ONE opportunistic declaration in a fighting posture, against a neighbour whose shared
   border is visibly weaker than ours, refused to a pacifist leader and capped by the number of
   wars already running — plus one further war when `urgency` says somebody is running away
   with the game, which is the diplomatic form of the runaway-leader response the attack budget
   already had. **It never declares out of an agreement**, because stage 5.6 is what prices a
   breach and nothing prices one yet.
2. **Whom do we make peace with?** *(built, stage 5.1)* A country fighting on more than one
   front, losing ground, or with a pacifist leader wants out of its least valuable war —
   `planPeaceOffer()` gives it ONE offer a turn, never to its theatre rival, and among the
   rest to whichever has beaten it most. A ceasefire is the cheap version and it reaches for
   that first; a peace is offered only to somebody already under a ceasefire, which is the
   classic move and the one case where the two have already stopped shooting.
3. **Whom do we ally with?** *(built, stage 5.5)* `doctrine.js` already computes `urgency` —
   the strongest rival's share of the world's land — every turn. **That number is the
   "somebody is running away with it" signal**, and it is both the heaviest term in
   `allianceScoreFor()` and the gate on whether a country goes LOOKING for a partner at all.
   Above `seekAllyUrgency` it offers an alliance ahead of tidying up its own wars, and it
   prefers a partner already fighting the same enemies — which is the design's own shape, and
   the point at which Leigh's stated goal for the phase finally arrives in full.
4. **Do we accept what has been offered?** *(built, stage 5.1)* `proposalOutcomeFor()`, and it
   is asked from BOTH directions through one door in `aiCalculations.js` — the player's offer
   and an AI's offer to another AI — so the two cannot come to different conclusions about the
   same proposal. The memory of who has betrayed whom is stage 5.6; what exists today is a
   memory of who has recently been refused, which is what stops a proposal being a reroll.

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

**Built, stage 5.1.** A ceasefire carries `until`, the turn it runs out on, and `revertsTo`,
what it falls back to then.

**Q2 IS ANSWERED: the agreement remembers.** A ceasefire agreed during a war and allowed to
lapse plainly goes back to WAR — that is what a ceasefire *is*. But with NEUTRAL as first
contact, "reverts to war" and "reverts to neutral" are genuinely different outcomes, and the
register keeps no history a rule could reconstruct the right one from. So `revertsTo` is set
at the moment of signing and `expiry.js` only has to read it. **The fallback when a record
does not say is NEUTRAL**, and that is a decision rather than a tidy default: a save taken
before ceasefires could be agreed restores rows without the field, and putting two countries
into a war neither of them declared, on the strength of a field that was absent, is the worse
of the two mistakes.

**Expiry runs from one place**, `diplomacyExpiry.js` on `TURN_CHANGED`. A ceasefire that
expired lazily — on the next read, wherever that happened to be — would lapse at a different
moment for a player who opened the panel than for one who did not, and the AI plans its turn
off the same register.

**HOW HARD AN AGREEMENT IS TO GET IS THE WHOLE OF WHAT SEPARATES THE TWO.** There is no
waiting period anywhere in this system: a proposal is answered on the spot, exactly as a
declaration takes effect on the spot. What differs is price. A ceasefire expires, so agreeing
to one costs a country far less than promising never to fight again, and `ceasefireAllowance`
in `peaceDiscipline` is that difference written down. Six things move the answer — how many
other wars the country is fighting, whether its posture is looking for a fight, how badly it
has been beaten by the asker, its leader's appetite for risk, whether somebody is running away
with the game, and whether it is simply much the larger of the two.

**The last of those is what stops the strongest empire signing peace with everything it is
about to eat**, and the fifth is where Leigh's stated goal for the phase first arrives:
`urgency` is already the strongest rival's share of the world's land, so when somebody is
winning, the rest of the world becomes readier to stop fighting each other. The same number
raises the attack budget, so a runaway leader gets attacked harder *and* finds the world less
busy with itself.

**The theatre rival is the one country a peace cannot be bought from.** `theatre.js` commits a
country to absorbing ONE neighbour and keeps the commitment while it takes ground; a war that
could be ended by asking would make the mid-term goal a suggestion. The deliberate escape is
that a rival which has been beaten badly enough will take a CEASEFIRE — a country losing wants
a breather, and that is exactly the moment the other side most wants to buy one. Without it,
the country a player most needs to talk to is the one that never listens.

**A refusal sets a cooldown**, per pair and per kind. A player who can ask every turn until
the dice fall their way is not negotiating, they are rerolling, and the answer is a pure
function of a world that barely moves between turns.

**Q1 IS ANSWERED TOO, and against a standing siege the agreement WAITS.** See §7.

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

**The tooltip** answers *what is the state*. **The diplomacy panel** answers *what can I do
about it*: the countries in contact, grouped by state, with one country's detail and the
actions available against it beside the list.

**Q6 IS ANSWERED — its own full-screen window, not a sixth info-panel tab**, and the reason is
stage 5 rather than stage 4. A proposal, a counter-offer and a call-in are a CONVERSATION, and
a conversation does not fit in a column beside four tables of numbers. It borrows the
Dominapedia's shape — a list on the left, the subject on the right, each column owning its own
overflow while the panel itself never scrolls — because that is already this game's shape for
"browse a set, read one".

Three rules the panel keeps, each of which has a scar behind it.
`relationsPanelModel.js` DECIDES and `DiplomacyPanel.js` DRAWS, which matters more here than
usual: nothing in the game agrees a peace or an alliance until stage 5, so most of what the
panel can say describes states a browser cannot be used to check. **Every action carries its
reason whether it is offered or refused**, which is the standing rule about a control that
refuses to act — and it is the whole argument for a panel, since a map can grey a button and
only a panel has room for the sentence saying what would change the answer. And **stage 4
offers exactly one action**, which is not an oversight: dead buttons for peace, ceasefire and
alliance would advertise a game that does not exist yet.

**One deliberate absence.** The panel shows who a country is at war with and who it is allied
with — facts about the world both parties already know, which the territory tooltip lists too
— and never what anybody is ABOUT to do. The AI's diplomatic intentions go to the console with
the rest of its plan; a panel naming who is about to declare war would be a cheat, and the line
is already drawn for the activity feed.

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

* **Q1 — a standing siege when a war ends. ANSWERED, stage 5.1: peace cannot be agreed while
  a siege stands, and the refusal is symmetric.** Both alternatives are worse. LIFTING the
  siege means moving an army back out of a siege object from two unrelated code paths, the
  player's and the AI's, and a write that creates or destroys army is the single largest class
  of defect this project has had — known-issue **BJ**, and the free-attack bug before it.
  LETTING IT RUN under a peace makes the register say something untrue about the map. So the
  agreement waits: finish the siege, or lift it, then talk. **The cost is real and is
  accepted** — a player besieged by the AI cannot lift that siege themselves, so peace is
  unavailable to them for as long as it stands, which is exactly when they most want it. What
  makes it bearable is that `siegeReview.js` already lifts a siege that stalls, that sieges
  are rare (nought to five standing across the whole world at every sample ever taken), and
  that a refusal a player can act on does not spend the proposal cooldown. If this turns out
  to bite in play, the next answer is a LIFT that goes through `writeGarrison()` and nowhere
  else, and it should be built once for both sides.
* **Q2 — what a ceasefire reverts to. ANSWERED, stage 5.1: the agreement remembers, in
  `revertsTo`.** See §5.3. What is still open is the smaller half of the original question:
  **can a ceasefire be broken early?** Today it cannot — nothing offers it, and
  `allowsDeclaration()` permits a declaration out of a ceasefire, so the vocabulary allows one
  while the panel does not offer it. That is a gap to close deliberately in stage 5.6, when a
  breach has a price, rather than by accident now.
* **Q3 — the call-in, at its edges. ANSWERED BY LEIGH, and all three edges are built.**
  **An ally IS called in on defence as well as on aggression** (*"yes they are"*), which
  reopens the cascade the first draft designed out — and what makes that safe is the thing
  that made it safe in the first place: nothing is automatic, a joiner's own allies are never
  asked, and a war spreads exactly one country per yes. **The call is answered by the start of
  the next turn**: an AI country decides during a phase the player is not present for, so the
  question is queued and put to them at the end of the AI turn. And **a joiner may not settle
  out of the war alone** — Leigh: *"an ally brought in to aid an attacked ally against an
  adversary may not independently make peace with that adversary, the peace must be asked
  either by the ally under attack or by the adversary, and agreed, where it then applies peace
  to the ally aiding the attacked ally as well."* Both halves are enforced: the joiner's own
  proposals to that adversary are refused, and every joiner is released on the same terms the
  moment the principal settles. Without the first half a call-in is a free favour — an ally
  turns up, is thanked, and buys its own way out on the next turn.
* **Q4 — the betrayal penalty.** Now that §3.4 narrows it to one act — walking out, or turning
  on your own ally — is the shape in §5.4 right, and how long is the treachery mark? Is there a
  material cost as well as a reputational one?
* **Q4b — a refused call-in the AI is not asked about.** When the player is the ally and
  declines, they see a prompt. When two AI countries are involved the answer is a calculation.
  Should a country that has just *refused* its ally carry any memory of it at all — nothing is
  owed, but a country that agrees to alliances and never honours one is a country the world
  might reasonably stop allying with.
* **Q5 — the income share. ANSWERED, stage 5.3: symmetric, and a DIVIDEND rather than a
  transfer.** Nobody pays anybody: both allies simply earn more while it stands, derived at
  the point of use and stored nowhere. A share moved between treasuries has to be written onto
  a territory, and a stored transfer needs an exact inverse write the moment the alliance ends
  — the silent bug `continentBonus.js` exists to prevent. Symmetric because a percentage of a
  flow is worth more in absolute gold to the larger ally, which is Leigh's standing rule that
  being large stays an advantage, while the smaller ally takes the larger proportional lift.
  And the FOOD question answers itself once it is a dividend: food is a stock against a
  ceiling, so the alliance raises the CEILING, which is the same dial oil and construction
  materials take and a different one from gold.
* **Q6 — where the player's diplomacy panel lives. ANSWERED, stage 4: its own full-screen
  window.** See §5.6 for the reasoning, which is about stage 5 rather than stage 4 — a
  negotiation is a conversation, and a conversation does not fit in a column beside four tables
  of numbers.
* **Q7 — the player's protection. ANSWERED, stage 3: BOTH, and the attack gate stays.**
  `PLAYER_GRACE_TURNS` now also refuses the AI the DECLARATION, which is the same idea said
  better — the player is not merely un-attackable during the grace period, nobody has declared
  on them, so the map, the tooltip and the rule all agree. The existing refusal in
  `rateTarget()` is deliberately kept as well rather than replaced: it is the belt to this
  braces, and it is what covers a war standing before the player existed, which a loaded save
  can produce.
* **Q8 — does an alliance change the victory condition?** Under CONTINENTAL, do allies' holdings
  count together for a shared win, or does an alliance remain a means to a solo end? The
  standings tab and `victory.js` both depend on the answer.
* **Q9 — the player's own diplomacy at the start.** The player begins at neutral with their
  neighbours like everybody else. Is that the intended opening, or should the player's
  immediate neighbours start at war so turn 1 still has a fight in it?
* **Q10 — the federation.** §3.5 records the intent and the structural decision (a bloc with a
  membership list, not a seventh relation state). Everything else is open: who may invite, does
  a federation vote, does it share more than an alliance does, and does it win together.
