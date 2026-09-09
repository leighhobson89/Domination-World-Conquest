# Future Plans — the standing list of what to do next

**Nothing in this document is committed.** It is the list of what could be built next and the
argument for each, kept in one place so that a decision about what to do is made against the
alternatives rather than against whatever was most recently annoying.

**It was called *What Is Missing* until the diplomacy and opinion phases closed**, and the
rename is not cosmetic: with no phase in flight this is now the only document that says what
happens next, and a reader looking for that should not have to work out that a document about
absence is also the plan.

**This document is the standing list of what to do next.** It replaces
[Outstanding Improvements](./archived/05-outstanding-improvements.md) and
[Force and Succession](./archived/06-force-and-succession.md), both now archived. Those two
asked *"does the simulation behave?"* and answered it: the world consolidates, conquest is
non-zero at every sample, the largest empire reaches 84 territories, and no goal freezes the
map. **This document asks a different question, and it is the one now worth asking — *does a
person sitting in front of it experience a game?***

The distinction matters, because almost everything open in
[03-known-issues.md](./03-known-issues.md) is of the first kind and nothing on this list is.
The register's remaining items (**G1** the cliff, **G6** the target band, **G7** the unspent
army, **BO** the third continent, **C5** the player's starting forts) are all questions about
numbers converging in a headless run. They are real and they are worth closing. **None of them
is why the game feels like a prototype**, and closing every one of them would not change the
experience of playing a turn.

**Written against the working tree at `dd86e01`.** Every claim below was checked against the
code, not against the design document — where §11 of the
[GDD](./01-game-design-document.md) disagrees with what follows, this is right and the GDD's
row is stale (item 4, army maintenance, is the known case: it was re-enabled in Phase 3.16).

---

## 0. The diagnosis, in four sentences

The mechanics are all there. **What is missing is every layer that sits between the mechanics
and the person**, and it is missing in four specific ways:

1. **The board does not carry the state.** Force and threatened borders reach it now (the
   military view), and nothing else does: no fort, no development, no economy at all, so
   reading what a territory is WORTH still means clicking 359 territories one at a time.
2. **The world has no characters.** Two hundred and six leaders with personalities, successions
   and grudges run the whole game. The player can now read a name off the map and nothing else:
   no country to inspect, no rival with a history, no voice beyond a single line of dialogue.
3. **Nothing acknowledges what the player does.** Two sound effects in the entire game, and
   no record of how a game was played once it is over.
4. **There is no arc.** A 200-turn game is the same turn 200 times at larger numbers: nothing
   escalates, nothing is scheduled, nothing pushes back against growth, and no intermediate
   objective sits between turn 1 and the win condition.

Everything below is one of those four. They are listed in that order because that is roughly
the order of what a player would notice first.

---

## 1. Verified findings

Each row is a fact about the code with the evidence beside it. **The effort figures later in
this document are the implementation only** — they do not include a five-goal 150-turn
acceptance run, and the "AI run?" column here says which items need one.

### 1.1 The board does not carry the state

| # | Finding | Evidence | AI run? |
|---|---|---|---|
| **M1** | **The map now carries force, and it does not carry anything else.** The military view ([militaryView.js](../src/ui/map/militaryView.js)) shades every territory by how its garrison stands against what can reach it, marks the player's indefensible borders from the real battle model, and draws the figures — so *"which of my borders is thin"* is answerable at a glance. What is still not on the board is everything the ECONOMY does: no fort, no farm, no development index, no indication of which territory is worth taking rather than merely takeable. That is a second view, not a change to this one | `createElementNS` across `src/ui/map/` and `siegeOverlay.js` | no |
| **M2** | **A territory's figures are reachable one at a time, through a ten-cell strip at the bottom of the screen.** `writeBottomTableInformation()` ([resourceCalculations.js:1119](../resourceCalculations.js#L1119)) writes the SELECTED territory, and there is one selection. The info panel's four tabs cover the player's own territories | — | no |

**Why this is first.** Risk prints the army count on the territory, and that one number is what
makes a Risk board readable at a glance — you can see where the front is, who is massing, and
which of your borders is thin, without clicking anything. This game has strictly more state per
territory than Risk and shows strictly less of it. Every other complaint about the game feeling
flat is downstream of not being able to see it.

### 1.2 The world has no characters

| # | Finding | Evidence | AI run? |
|---|---|---|---|
| **M4** | **206 leaders run the whole game and the player meets almost none of them.** Six traits each ([leaderPersonalities.js](../leaderPersonalities.js)), replaced every 15-20 turns with a fresh personality ([succession.js](../src/ai/succession.js)), each country carrying committed continents, a focus, a posture, a theatre it is absorbing and rivals it has written off as walls ([strategy.js](../src/ai/strategy.js), [theatre.js](../src/ai/theatre.js)). A leader's NAME and reputation reach the map; nothing else does. There is no country panel, no way to see who a rival is campaigning against, and no history of who ruled when. The postures, budgets and target lists stay in `AiDebugPanel` and the spectator console deliberately — a panel showing the AI's intentions would be a cheat | `leader` across `src/ui/` | no |
| **M5** | **There is one line of dialogue in the game.** `populateAiDialogueBox()` has exactly one `case`, `"goldForSiege"` ([ui.js:4589](../ui.js#L4589)), called from one site ([aiCalculations.js:1556](../aiCalculations.js#L1556)) — an AI besieging you offers gold to be let through. That is the whole of the game's diplomacy, and the whole of every AI country's voice | — | no |

**Why this matters more than it sounds.** The succession work in the archived
[06](./archived/06-force-and-succession.md) found that the single largest movement in the whole
simulation came from leaders *dying and being replaced* — a country's character changing is what
breaks a stalemate. That is a genuinely good story generator and it is still mostly going to a
console nobody reads: a name on a tooltip is the smallest possible share of it. The expensive
half is built, and almost all of the telling is still missing.

**THIS FINDING IS SMALLER THAN IT WAS, and M5 in the table above is now stale.** The opinion
layer ([archived/08-opinion.md](./archived/08-opinion.md)) gave every country a directional
memory of what every other country has done to it, and the diplomacy panel gives the player a
reason in words every time an offer is accepted or refused — *"it bears you a grudge"*, *"this
is the war it has committed to"*. So countries do now say something, and what they say is
derived from what actually happened between the two of you. What is still missing is the half
M4 names: the LEADERS remain almost invisible, and a succession — the thing that moves the
simulation most — still reaches the player as nothing at all.

### 1.3 Nothing acknowledges what the player does

| # | Finding | Evidence | AI run? |
|---|---|---|---|
| **M7** | **Two sound effects in the entire game.** `resources/sfx/` holds `clickButton.mp3` and `clickSwitch.mp3`, and `audio.js` documents the vocabulary as deliberately two clips. Nothing plays for a battle, a conquest, a siege, a disaster, a turn boundary, a victory or a defeat | `ls resources/sfx` | no |
| **M9** | **There are four random events, all negative, all "divide a stock".** `RANDOM_EVENTS` ([balance.js:1094](../src/config/balance.js#L1094)) is four strings and `EVENT_EFFECTS` ([randomEvents.js](../src/rules/events/randomEvents.js)) maps each to one field and one divisor. Nothing good ever happens to anybody | — | balance only |
| **M10** | **There is no record of the game as it was played.** `historicWars` in the Wars & Sieges tab is the only history the player can see. No empire-over-time, no per-turn sample of anything, so the ending screen can state the final standings and cannot say how they were arrived at | — | no |

### 1.4 There is no arc

| # | Finding | Evidence | AI run? |
|---|---|---|---|
| **M11** | **Nothing in the rules is a function of empire size except the bonus that rewards it.** Searching `src/` for unrest, cohesion, stability, supply, attrition or corruption returns four hits, all of them comments about something else. The continent bonus multiplies income for holding ground; nothing charges for holding it. This is the design tension the GDD names as §12.4 and the register carries as **G7** | — | **yes** |
| **M12** | **A 200-turn game has no intermediate structure.** One goal is chosen before the game starts ([goalCatalogue.js](../src/ui/goals/goalCatalogue.js)) and nothing sits between turn 1 and it: no missions, no eras, no crises, no scheduled pressure. `TURN_LIMIT_TIERS` offers 200/350/500 turns ([balance.js:1147](../src/config/balance.js#L1147)) | — | design |
| **M13** | **Setup is one screen with one choice.** Options is a theme picker and two mutes ([OptionsPanel.js](../src/ui/components/OptionsPanel.js)); the goal chooser is the goal and its scale. No difficulty, no map size, no handicap. AI aggression is per-leader random only | — | **yes** |
| **M14** | **Naval and air are combat modifiers, not movement.** `isCoastal` is read in three rule sites, all of them combat: the naval-landing die bonus ([battleModel.js:210](../src/rules/military/battleModel.js#L210)), the forecast cache key, and the AI's threat array. There is no transport, no sea zone, no range. A navy is a die modifier you buy for coastal fights | — | **yes** |
| **M15** | **`dev_index` is static and nothing raises it.** It scales the upgrade price ladder, the construction-materials ceiling and `defenseBonusFor()`, so it is among the most load-bearing per-country numbers in the game — and it is dealt at bootstrap and never moves. There is no second axis of progression in a 200-turn game | — | **yes** |

---

## 2. Easy wins

**Every item in this section is existing data reaching the screen.** None of them touches
`src/ai/` or `src/rules/` (E6 touches `balance.js` and is the one exception, and it is small),
so none needs the five-goal acceptance run and none can regress a measurement. That is the
argument for doing this block first regardless of what is chosen after it: it is the only block
that is free of the project's most expensive verification step.

The items are lettered in the order they were written rather than renumbered as they are
finished, because `CLAUDE.md`, the source comments and the archive all cite them by letter.

### E2 — Sound for the things that happen *(M7)*

`installActivityRecorder()` ([activityRecorder.js](../src/state/activityRecorder.js)) already
derives conquest, failed attack, siege started, siege lifted, siege abandoned, siege won and
siege lost from store events. A second subscriber alongside it, mapping kind to a clip, is most
of the work. Add the turn boundary, the disaster, and the ending.

Keep the existing rule that `audio.js` owns the vocabulary and clips are named for what they
*mean* rather than for a file, and keep anything decorative on `cosmeticRandom()` — a variant
picked with `Math.random` would put sound on the game's seeded stream and two runs of one seed
would diverge.

*Effort: hours, plus sourcing audio.*

### E6 — More events, and good ones *(M9)*

`RANDOM_EVENTS` is a list of strings and `EVENT_EFFECTS` a table of `{field, apply}`. A bumper
harvest, an oil strike, a gold windfall and a wave of migration are four table entries. It is
the cheapest way to make a turn feel like it contains something, and it is the one item here
that touches `balance.js` — so it wants `node tools/econ-lab.mjs` afterwards rather than a full
acceptance run.

Worth deciding at the same time: an event that fires on the *whole world* versus one that fires
per territory at 50%. The current model is the second, which is part of why an event reads as
noise rather than as news.

*Effort: an hour plus balance checking.*

## 3. Medium — worth doing, needs a decision first

### M-a — Difficulty settings *(M13)*

The layer for this already exists and was built for a different reason.
[doctrine.js](../src/ai/doctrine.js) is the only module in `src/ai/` allowed to switch on a
victory condition, and it turns a goal into `continentsToCommit`, `areaHunger`,
`targetCountries`, `urgency` and `neverSatisfied` — rows of dials living in `goalDoctrines` in
`balance.js`. A difficulty is the same shape: a second set of multipliers folded in beside the
doctrine, plus `PLAYER_GRACE_TURNS`.

**The trap is already documented and applies unchanged**: a difficulty dial may scale the attack
budget and must never reach the siege budget, because the siege budget subtracting the sieges
already running is what ended the seventeen-to-sixty-seven concurrent sieges problem. A unit test
asserts no doctrine key matches `/siege/`; the same assertion should cover difficulty rows.

*Effort: a day. **Needs the five-goal table**, one run per difficulty.*

### M-b — The game as it was played *(M10)*

Sample the top eight countries' territory counts once per turn into a bounded ring — the same
shape [planRecord.js](../src/ai/planRecord.js) already uses — register it as a save slice, and
draw it as a sparkline on the ending screen and in the standings tab. This is what turns "you
won" into "you won, and here are the forty turns where it was in doubt". Cheap to store, and it
is the one thing that would make a 200-turn game feel like it had a shape.

*Effort: a day.*

### M-d — A country's SCORE, and an honourable order among the defeated

**Leigh's item.** Every country accumulates a **score** as the game runs: points for good
diplomacy and for military victories. It is the first number in this game that measures a
country's whole career rather than its present position.

**IT ONLY EVER GOES UP, AND THAT IS THE DESIGN RATHER THAN A SIMPLIFICATION.** Leigh's rule in
his own words: *"they don't lose score for bad things they just don't gain points for bad
things."* A losing streak stops earning; it does not erase what was earned before it. Three
things follow from that, and each is why the rule is worth stating rather than assuming:

- **It cannot be gamed by hiding.** A monotonic score is a record of what a country DID, so a
  country that achieved a great deal and then collapsed keeps the achievement — which is
  exactly what makes it usable as an epitaph.
- **It needs no floor, no clamp and no decay.** Every other accumulating number in this
  codebase needed an argument for why it terminates; this one has none to make.
- **It is not a strength rating and must never be read as one.** A score is history and an army
  is now. The moment somebody uses it to decide who is winning, it becomes a second, worse
  answer to a question `victoryProgress()` already answers correctly.

**WHERE IT IS SHOWN, AND WHERE IT IS DELIBERATELY NOT.** Leigh: *"when they are defeated the
score is used as a way of ordering the defeated countries to give them some honor, but should
not affect countries in play as they are ordered on other things and should stay that way."*

So it has exactly one job in the interface. The standings tab already lists the beaten
countries below a separator, and today they are **alphabetical** — a fallback chosen because
nothing else was available, and stated as such in `rankedStandings()`. Score replaces that
ordering and nothing else:

| | ordered by | changed by this |
|---|---|---|
| countries still in play | `victoryProgress().fraction`, then territories, then name | **no** |
| countries that are out | alphabetical | **yes — by score, best career first** |

The separation is the whole point and it is easy to lose. The living ranking answers *who is
about to win*; a country with a magnificent history and two provinces left is not winning, and
sorting the live table by career would say it is.

**What earns points, in the shape the code is already in.** Every candidate below already
passes through exactly one door, which is what makes this affordable — the same property that
made the opinion layer cheap:

| Earned for | Where it is already observable |
|---|---|
| taking a territory | the `CONQUEST` activity entry |
| winning a battle without taking ground | `ATTACK_FAILED` on the other side |
| breaking a siege, or finishing one | the siege entries |
| an agreement REACHED — a ceasefire, a peace, an alliance | `DIPLOMACY_CHANGED`, `via: "agreed"` |
| answering a call to arms | `DIPLOMACY_CHANGED`, `via: "calledIn"` |
| keeping an agreement for a long time | the relation's own `since`, read at the turn boundary |
| holding a continent outright | `continentsHeldOutrightBy()` |

**Two open questions, and neither should be settled by guessing.**

1. **Is a betrayal worth zero, or is it worth what it gained?** "No penalty" is the stated rule,
   but a country that breaks an alliance to take six provinces earns six conquests' worth of
   score for the treachery. Not gaining for the *breach itself* is clearly right; whether the
   conquests it enabled should count is a real design question.
2. **Does the player have a score?** They are a country like any other, so yes by default — but
   the player is the one country whose defeat ends the game, so the only place their score
   could be read is the ending screen. That may be the best argument for having one.

**Where it would live.** A single number per country, monotonic, in a save slice of its own or
riding `aiStrategy` as the opinion store does. It is NOT derived — unlike who is defeated,
which is a fact about the map, a career cannot be reconstructed from the present world, so this
is one of the few things in this codebase that genuinely has to be stored. That makes the
snapshot version question real for the first time in a while: a save taken before it existed
restores no scores, and every country reading zero is a correct and harmless answer.

*Effort: a day for the store and the earning hooks, an afternoon for the standings ordering.
No acceptance run: it reads nothing and decides nothing, so it cannot move a measurement.*

---

## 4. Larger — the ones that change what the game is

Ordered by what they would do for the experience, not by cost.

### L-a — Consolidate 206 countries into ~12 powers and a field of minors

The GDD has named this as §12.1 since it was written and it remains the highest-leverage
structural change available. Twelve to sixteen **powers**, each owning many countries, with the
rest as minors that can be absorbed, courted or left alone.

Four things it buys at once, which is why it is first:

- **Diplomacy becomes possible.** Twelve relationships is a screen. Two hundred and six is not.
- **The world becomes legible.** A player can hold twelve rivals in their head and name them.
  They cannot hold two hundred, which is why the game currently reads as weather rather than as
  opponents.
- **The AI turn becomes cheap**, which buys back the budget for everything else — coordination,
  route planning, a model of what the player is about to do, all of which the GDD lists as still
  absent.
- **It gives every one of the easy wins above something to attach to.** A leader's name matters
  when there are twelve of them.

**What it would cost.** Every measurement in the archived documents was taken against a
207-country world, so the whole acceptance baseline is re-based by this change — the five-goal
table, `tools/ai-sim.mjs`'s columns, the target band in audit §9 Q3, and the
countries-surviving figure that half the register's entries are stated in. It is not a phase to
start casually, and it is probably a phase to start *soon*, because everything else built before
it gets re-measured after it.

*Effort: a phase. **Re-bases every measurement in the project.***

### L-b — A counterweight to growth *(M11, register G7)*

This is the register's own conclusion and it is also the missing arc. Genre precedent is
unanimous about the shape: EU4 charges overextension, Crusader Kings charges vassal opinion,
Hearts of Iron charges supply, Civilization charges war weariness and distance-corruption. Every
one of them exists so that *taking ground has a cost that must then be paid down*, which is what
makes an empire a thing you manage rather than a number you increase.

The cheapest version that would work here: a per-territory **cohesion** that falls with distance
from your nearest core territory and with how recently it was taken, recovers over time, and
scales income and garrison effectiveness. It is a pure function of ownership and distance, so it
belongs in `src/rules/` and runs in Node, and `src/ai/theatre.js` and `muster.js` would read it
for free through the existing frontier walk.

**The reason to be careful**: the archived measurements say the world only *recently* started
consolidating at all, and it took the entry-price and succession work to get there. A growth
penalty is a direct brake on the thing that was just unblocked. Do it with the five-goal table
open beside you, and expect to trade some of the largest-empire figure back.

*Effort: a phase. **Needs the five-goal table at every step.***

### L-c — Naval movement and amphibious operations *(M14)*

Sea zones, transport capacity, and a range on naval units, so that a coastline is a frontier and
an island is a decision. Today `isCoastal` is a die modifier and the map's sea crossings are
hand-listed adjacency exceptions ([manualAdjacencyExceptions.js](../src/data/manualAdjacencyExceptions.js)),
which is why five of them ran one way for years without a signature (**BS**).

This is the change that would make the *map* interesting rather than the numbers on it — a real
world map with real oceans currently plays as a flat graph. It is also the largest of the three,
and it interacts with L-b: a landing far from home is exactly what a cohesion rule should charge
for.

*Effort: a phase, and the biggest of the three.*

### L-d — Research, or any second axis of progression *(M15)*

`devIndex` is dealt at bootstrap and never moves, and it feeds the upgrade ladder, the
construction-materials ceiling and the defence bonus. Making it something a player *raises*
would give a long game a second thing to spend on, and a reason for turn 120 to differ from turn
20 other than scale.

**The balance warning is severe and specific**: `devIndex` is load-bearing in four unrelated
formulas, and the combat phase deliberately applied its rebase at `DICE_ATTACK_ADVANTAGE`
*rather than* to `devIndex`, precisely so that a combat decision could not leak into the economy.
Anything that makes `devIndex` mutable re-opens that. A separate research index feeding fewer
things is very likely the right shape.

*Effort: a phase. Highest balance risk on this document.*

### L-e — A tutorial

A scripted opening: pick a country, here is your income, buy these, attack this, you have taken
a territory. The [Dominapedia](../src/ui/dominapedia/topics.js) is a fine manual and a manual is
not onboarding. Cheap in mechanics and expensive in writing, and it is worth doing *after* the
easy wins rather than before, because a tutorial for a game that cannot show you its own board
would spend its first lesson apologising.

*Effort: a week, mostly writing.*

---

## 5. What this suggests doing next

**Finish the legibility block, §2.** What is left of it is one coherent piece of work —
*make the game show the player what it already knows* — and it shares no code with `src/ai/` or
`src/rules/`, so it needs no acceptance run and cannot regress a measurement. **E1, the military
map view, is delivered** ([the archive](./archived/05-what-is-missing-delivered.md) records what
it decided), which leaves E2 and E6. The board can now be read for FORCE and still cannot be
read for anything else, so the natural successor to E1 is not on this list yet: an economic
view over the same machinery, shading what a territory is worth rather than what holds it.

That block is also the one most likely to change your own answer to "what does this need next",
because at the moment the game is hard to *see*, and several judgements about it are being made
from headless tables rather than from playing it.

**Then one large item, and the argument is for L-a.** Consolidating the world into powers is the
item that makes the other three large ones worth building, and it is the one whose cost grows
the longer it is deferred, because every measurement taken before it has to be taken again
after it.

**M-d, the score, is the cheapest thing on this list and is worth doing whenever.** It reads
nothing and decides nothing — it accumulates, and it orders a list that is currently
alphabetical — so it cannot move a measurement and needs no acceptance run. It is also the only
item here that makes the game say something about a country AFTER it is beaten, which is a
surprisingly large share of what "the world has characters" means over a long game.

**And the diplomacy block is finished**, which is why M-c is no longer on this list. What was
built is much larger than the item asked for: a state per pair of countries, agreements that
can be proposed and refused with a stated reason, alliances with a call to arms and a price for
breaking one, and — in the phase after it — an OPINION, so that what two countries have done to
each other is remembered and decides who will deal with whom. Both are archived, and
[archived/05-what-is-missing-delivered.md](./archived/05-what-is-missing-delivered.md) records
what the item predicted correctly and what it got wrong.

**The register stays separate.** [03-known-issues.md](./03-known-issues.md) is defects and
convergence; this is design and experience. An item does not move between them — **G7** appears
on both because it is genuinely both, and it is the only one.

---

## 6. Cross-references

- What is wrong with the code: [03-known-issues.md](./03-known-issues.md)
- What each mechanic does today: [01-game-design-document.md](./01-game-design-document.md)
  (§11's table is partly stale — see the header note above)
- Why combat and the economy are shaped as they are:
  [archived/05-combat-and-conquest-audit.md](./archived/05-combat-and-conquest-audit.md),
  [archived/05-economy-audit.md](./archived/05-economy-audit.md)
- Why the world consolidates at all:
  [archived/06-force-and-succession.md](./archived/06-force-and-succession.md)
- The findings this document replaces:
  [archived/05-outstanding-improvements.md](./archived/05-outstanding-improvements.md)
- **What has already been delivered off this list**, with the decisions behind each item:
  [archived/05-what-is-missing-delivered.md](./archived/05-what-is-missing-delivered.md). Items
  are cut out of this document when they are finished rather than marked done, so that reading
  it gives outstanding work and nothing else
