# Goals and Victory

**Status: in progress.** This is a breathing document — it records the decisions, the design
and the traps, and it is edited as the work lands. The task breakdown lives beside it in
[06-goals-and-victory-checklist.md](./06-goals-and-victory-checklist.md).

---

## 1. Why this exists

The game does not end. Nothing checks whether the player has conquered the world and nothing
checks whether they have been wiped off it, which is item 1 on the Dominapedia's own list of
what is wrong and the one entry there that is not a balance question — it is the difference
between a simulation and a game.

Half of the answer is already built. `src/ai/victory.js` defines four conditions, measures
every country's progress towards whichever is active, and is already registered as a save
slice. It exists because the AI needed it: a computer country with no notion of what it is
playing FOR can only be turn-local, and the campaign layer in `src/ai/strategy.js` replaces
exactly that. What is missing is the screen on which a player chooses, the AI actually
*pursuing* the choice rather than merely being aware of it, and the moment the game stops and
says who won.

This phase delivers all three.

---

## 2. The five goals

`ELIMINATION` comes off the list of things a player can choose. It was never a goal — it is
the defeat condition, and it now runs underneath every goal rather than being one of them.

| Goal | Scale (default in bold) | Won when |
|---|---|---|
| **World Conquest** | Total — every territory *(only entry)* | No other country holds a territory |
| **Domination** | 40% / **60%** / 80% of world land area | Your land area ÷ world land area ≥ the share |
| **Continental Supremacy** | 2 / **3** / 4 continents | You hold every territory on that many continents |
| **Great Powers** | Any 3 of the five / **all five** | You hold every territory whose `originalOwner` is that power |
| **Timed Game** | Turn **200** / 350 / 500 | At that turn, the largest empire by land area |

### Why these five

**World Conquest** is the severe, honest definition — 359 territories, and the game says so
rather than pretending otherwise. It is modelled as its own kind rather than as Domination with
`landShare: 1.0`, because "no other country holds a territory" is an exact integer test and a
float comparison against 1.0 is fragile at the boundary.

**Domination** counts land AREA rather than territory count, because the map's territories are
wildly unequal and a hundred Caribbean islands should not outweigh Russia.

**Continental Supremacy** is the shorter, sharper game, and it is the condition that gives
continent control a point — which matters because continent bonuses are the next piece of
design work after this one.

**Great Powers** names your enemies. The five strongest countries are already a distinguished
set the player is told about on the country-selection screen and forbidden to play; this gives
that lock a second purpose and turns a percentage into a story. It is the only goal on the list
with an antagonist.

**Timed Game** is the backstop that guarantees a finite game. Its tiers start at 200 rather
than the 100 originally written into `VICTORY_TURN_LIMIT`, because the simulator shows the
largest empire reaching roughly thirty territories after a hundred turns — a game scored at
turn 100 would end before anything decisive had happened.

### Naming

The game is called Domination, so a condition called DOMINATION sitting next to World Conquest
reads oddly in the interface. The player-facing names are the ones in the table above; the
internal enum keys stay as they are, so nothing in the AI has to be renamed.

---

## 3. Four rules that are easy to get wrong

**A country never counts its own homeland.** Under Great Powers, a great power owns its own
homeland on turn 1, so without this rule the goal is broken for exactly the five countries it
is about — one of them would start a five-power game already a fifth of the way to winning. A
great power must therefore break three (or all four) of the OTHERS. The player can never be a
great power, so this only ever affects the AI, which is precisely why it would have gone
unnoticed.

**The five names are frozen into the condition at game start**, not read back from
`greyedOutCountries` later. Three reasons: it keeps `src/ai/victory.js` pure and runnable in
Node, it survives the powers being conquered and vanishing from the map, and it rides into the
save slice that already exists. The condition object grows a `greatPowers: string[]` field.

**"You hold its homeland" routes through third parties, and that is a feature.** If another AI
takes half of the United States before you do, you do not lose the goal — you have to take
those territories from that AI instead. The objective stays achievable and the route to it
becomes a different war. This was initially mistaken for a flaw during the design discussion;
it is the most interesting property the goal has.

**The check runs once per turn, at `endTurn`, before `advanceTurn`.** Not after every conquest:
one place, one ordering, one `worldStandings()` pass covering all 207 countries plus the
player's elimination. Note the consequence for Timed Games — `endTurn: advanceTurn` means the
counter advances afterwards, so the check during turn N sees `currentTurn() === N`, and a game
with a limit of 200 ends at the end of turn 200.

---

## 4. Measurement — the rules layer

All of this is pure and runs in Node, importing only `config/` and `state/selectors.js`.

### `src/config/balance.js`

The scale tiers as named constants, replacing the three single values that are there now.
`VICTORY_TURN_LIMIT = 100` becomes a tier list starting at 200, and the reasoning above is
recorded at the site.

### `src/ai/victory.js`

- Two new kinds: `CONQUEST` and `GREAT_POWERS`.
- `hasWon()` completed for `TURN_LIMIT` and both new kinds. It currently returns `false`
  unconditionally for `TURN_LIMIT` and `ELIMINATION`, which is why nothing could ever end.
- `hasWon()` and `victoryProgress()` take the turn as a PARAMETER rather than importing
  `state/phases.js`, so the module stays a pure function of its inputs and the unit tests can
  drive a turn-limit game without a store.
- `victoryProgress()` gains labels for both new kinds — Great Powers reports
  `"Great Powers: 1 of 3 (United States 7/9)"`, which is the one goal where the aggregate
  fraction alone tells the player nothing useful.
- The self-homeland exclusion described above.
- `captureVictoryCondition()` must COPY the `greatPowers` array rather than sharing the
  reference the spread gives it, or a save and the live condition alias one array.

### `src/rules/victoryCheck.js` — new

```
checkForVictory({ turn, playerCountry, condition, standings })
  -> null | { outcome: "VICTORY" | "DEFEAT", winner, reason, condition }
```

- The player holding no territories is a `DEFEAT` under every goal — elimination is universal.
- Any country satisfying `hasWon()` ends the game: `VICTORY` if it is the player, `DEFEAT` if
  it is not. This is the consequence of the goal being a shared race, decided during design:
  every country is playing for the same condition and any of them can get there first.
- At a Timed Game's limit, the largest empire by land area wins. Ties break on territory count
  and then on name, so the result is deterministic and a seeded run reproduces it.
- It returns a result at most once per game; the turn loop stops asking after it fires.

---

## 5. The AI plays for the goal

This is the half that makes the choice mean anything, and today it barely exists.
`chooseObjective()` in `src/ai/strategy.js` is the ONLY place the condition kind is consumed,
and all it does is map the kind to a number of continents to commit to — CONTINENTAL gives its
own figure, DOMINATION gives four, anything else gives two. An AI under Great Powers would
campaign for two arbitrary continents and never look at a great power.

### `src/ai/doctrine.js` — new, pure

One function turning the active condition, the country's progress and the turn into the small
set of dials the existing modules already think in terms of. The point of the seam is that
`strategy.js`, `theatre.js` and `targeting.js` stop switching on the condition kind — they read
a doctrine — so adding a sixth goal later is one entry here and no change to any of them.

```
doctrineFor(condition, { progress, turn, standings, country })
  -> { kind, continentsToCommit, areaHunger, targetCountries, urgency, neverSatisfied }
```

| Goal | continentsToCommit | areaHunger | targetCountries | urgency |
|---|---|---|---|---|
| Continental | the required count | 0.2 | — | strongest rival's progress |
| Domination | 4 | 0.8 | — | strongest rival's progress |
| Conquest | all | 1.0 | — | strongest rival's progress, `neverSatisfied` |
| Great Powers | 2 | 0.3 | the surviving powers, minus itself | strongest rival's progress |
| Timed | 3 | 0.9 | — | `turn / turnLimit` |

Two of those numbers are doing real work.

**`urgency` from the strongest rival's progress** makes the whole world react to a runaway
leader rather than each country grinding along in isolation. It costs nothing —
`worldStandings()` already has every country's holdings in one pass — and it is the mechanism
by which a player who pulls ahead starts getting attacked more, which is the single most
valuable thing an AI can do to a strategy game's difficulty curve.

**`urgency` from `turn / turnLimit`** makes a Timed Game get progressively more reckless as the
deadline nears, which is exactly right: there is nothing to conserve on the last turn.

### Consumers

- `strategy.js` — `chooseObjective()` reads `continentsToCommit`; `deriveBudgets()` scales the
  offence budget by urgency; `choosePosture()` honours `neverSatisfied` so a large empire under
  Conquest does not settle into CONSOLIDATE forever.
- `theatre.js` — the mid-term rival choice is biased towards `targetCountries`, so a country
  under Great Powers actually commits to absorbing a great power when it borders one.
- `targeting.js` — a rating bonus for a territory whose `originalOwner` is a target power, and
  an area-weighted bonus scaled by `areaHunger`.

### Two traps, both already paid for once

**`urgency` must scale the ATTACK budget and never the SIEGE budget.** Budgets counting the
sieges already running is what ended the seventeen-to-sixty-seven concurrent sieges problem; a
multiplier applied to the siege cap would walk straight back into it.

**A posture must never guarantee its own preconditions.** `choosePosture()` once sent any
country under four territories to DEVELOP, which on a map of 207 mostly one-territory countries
disqualified 93% of the world from expanding and froze the world at 163 countries. Anything
`doctrine.js` feeds into posture selection is capable of the same class of mistake, and it has
no textual signature — nothing throws, every turn completes, the unit suite passes and the map
quietly stops changing.

### How it is judged

`tools/ai-sim.mjs` gains `--goal=KIND[:scale]`. Every doctrine change is measured by running
each of the five goals headless for 150 turns and reading countries surviving, largest empire,
top-sixteen share, conquests, failed attacks and sieges. The acceptance criterion is not "it
compiles" — it is that each goal produces a visibly DIFFERENT world, and that no goal freezes
one. Those numbers get recorded in this document as they are taken.

### What was measured

Five runs, `--turns=150 --seed=goals --every=25`, one per goal at its default scale, taken
after `doctrine.js` landed. Every run played all 150 turns, and every run reported **zero**
page errors and zero failed turns.

| Goal | Countries left | Largest empire | Top-16 share | Open sieges |
|---|---|---|---|---|
| Continental Supremacy (3) | 81 | 97 | 81% | 1 |
| World Conquest | 78 | 78 | 80% | 0 |
| Domination (60%) | 96 | 79 | 76% | 1 |
| Great Powers (all 5) | 107 | 69 | 70% | 0 |
| Timed Game (200) | 114 | 51 | 65% | 1 |

Countries surviving / largest empire, sampled every 25 turns:

```
continental   t25 147/31   t50 139/45   t75 123/54   t100 109/57   t125  95/76   t150  81/97
domination    t25 147/36   t50 132/45   t75 120/56   t100 113/62   t125 110/62   t150  96/79
great_powers  t25 146/32   t50 124/47   t75 115/69   t100 111/69   t125 111/69   t150 107/69
conquest      t25 146/36   t50 115/60   t75  93/76   t100  87/78   t125  80/78   t150  78/78
turn_limit    t25 153/36   t50 142/38   t75 136/38   t100 133/47   t125 124/47   t150 114/51
```

**Each goal produces a different world, and the differences are the ones the doctrine
predicts.** The spread is wide — 78 to 114 countries surviving, a largest empire of 51 to 97,
and a top-sixteen share from 65% to 81%. Set against the pre-theatre baseline recorded at the
top of `src/ai/theatre.js` (163 countries surviving and a largest empire of **30** at turn
100), every one of the five consolidates the world far harder than the AI did before any of
this existed.

Reading the individual rows:

* **World Conquest consolidates fastest and earliest.** It is the only goal that commits to
  every continent on the map, so wars start everywhere at once: 115 countries by turn 50,
  against 139 for Continental. This is `neverSatisfied` doing its job — no country under this
  goal ever settles into CONSOLIDATE.
* **Continental Supremacy produces the single largest empire (97).** It is the goal that
  concentrates rather than spreads: three named continents, and `campaignWeightForTarget()`
  pays two and a half times for a target on the focus continent.
* **A Timed Game is the most fragmented (114 countries, largest 51).** Expected, and it is the
  `turn / turnLimit` urgency curve: at turn 150 of a 200-turn limit these countries are at
  0.75 urgency and have only recently started spending it. The trajectory is still rising.
* **Great Powers survives the most countries (107) and its leader stops growing at 69 from
  turn 75.** This is the signature of the sort tier in `rankRivals()`: countries commit to a
  named power rather than to the convenient small neighbour beside them, so the small states
  on the margins are left alone and the leader spends its attacks on the hardest targets on
  the map. It is the intended behaviour of the goal, not a stall — countries are still
  falling over the same span (115 → 107), so the world has not frozen.

**No goal freezes one.** Every row is still moving at turn 150: the country count falls in
every one of the five between t125 and t150, and the largest empire rises or holds in all
five. The failure this measurement exists to catch — a world that quietly stops changing while
every turn completes and nothing throws — does not appear under any goal.

One thing the numbers do NOT settle: the open-siege count is 0 or 1 at turn 150 under every
goal, which is the concurrent-siege discipline holding, but it is low enough that it is worth
watching whether sieges are being under-used now rather than over-used. That is a balance
question for a later pass and not a doctrine one — urgency is deliberately kept away from the
siege budget, so nothing here changed it.

---

## 6. The chooser

Built the way the Dominapedia is built, because the shape is the same and it is proven: a
catalogue of frozen data that imports nothing and is unit-tested in Node, and a component that
renders whatever the catalogue says and has no opinion about the content.

### `src/ui/goals/goalCatalogue.js` — new

Names, scale options, one-line summaries and description bodies as frozen blocks
(`{ kind: "p" | "h" | "ul" }`, never markup — content carrying HTML would carry the panel's
styling decisions with it). Adding a goal is one entry here.

### `src/ui/components/GoalSelect.js` — new

A full-screen window on the shared `.options-scrim` / `.options-button` family, for the same
reason `SaveLoadPanel` and `Dominapedia` share them: screens that open from one menu should not
be three designs. Goal dropdown and scale dropdown down the left, the selected goal's
description in the pane on the right, Confirm in the footer.

Decisions:

- **The choice is forced.** There is no Cancel and no scrim-click dismissal. Escape goes BACK
  to the main menu rather than skipping the screen — a player must be able to change their mind
  about starting a game, but not to start one with no goal.
- **The scale dropdown is always present.** For World Conquest it holds one entry reading
  "Total — every territory on the map". The alternative, hiding it, makes the panel change
  shape as the player browses, which reads as a rendering fault.
- **Confirm calls `setVictoryCondition()` and nothing else** before dropping through to country
  selection. That function already validates and fills in defaults, which is why it was written
  as the seam.

### Where it sits in the flow

`startNewGame()` in `ui.js`. There is ONE New Game button and it serves both the cold start and
the mid-game restart — the confirm dialog only appears when a game is already running — so
gating it is a single insertion point, and that is why gating the restart separately was never
needed.

**Ordering trap.** Under Great Powers the chooser has to freeze the five strongest countries
into the condition, and `greyOutTerritoriesForUnselectableCountries()` — which is what puts
them into the store — currently runs AFTER the point the chooser opens. Either the chooser
reads the same sorted `countryStrengthsArray` the lock reads, or the lock is computed before
the chooser opens. Whichever, it must not be answered from a fill colour or from an empty
store; that is the shape of mistake that made the country lock bypassable in three clicks.

### The progress line

`victoryProgress(playerCountryName()).label` on the phase bar, refreshed on turn change. The
label is already exactly this string, which is why the AI's sense of progress and the player's
cannot disagree.

Three things to get right. It must not move the advance button — the phase bar is
bottom-anchored with a content height, so added content grows upwards and the button stays put.
It must be reset by New Game and set correctly by a load, because anything made correct as a
side effect of the country-selection screen breaks a loaded game. And it is hidden in spectator
mode, where there is no player whose progress it could describe.

---

## 7. The ending

For this phase the outcome is a `GAME_OVER` event on `state/events.js` and a `console.log`
line. The console line is the first LISTENER, not the mechanism — the victory and defeat
screens are the next phase, and they are a second subscriber rather than a change to any of
this.

`console.log`, deliberately, not `console.error`: a `console.error` fails every e2e spec.

---

## 8. Testing

The unit suite carries almost all of it, which is the point of keeping every piece of this
pure: `victory.js` across five kinds and every scale tier, the self-homeland exclusion,
`victoryCheck.js` including elimination and the turn-limit tie-break, `doctrine.js` per goal,
and the catalogue's shape and scale-per-goal walk.

E2E: a new `tests/e2e/goal-selection/` area, **18 specs in three files** — the chooser's
flow, what it does with the five goals, and the ending. Plus four in
`tests/e2e/save-load/goal-survives-a-load.spec.js`, because the goal is durable state outside
the store and a load that quietly resumed the DEFAULT goal would pass every assertion in
`save-load.spec.js`.

**The harness cost was one method, as predicted.** `GameDriver.newGame()` answers the chooser
for the whole suite and takes an optional `{ goal, scale }`; `confirmGoal()` is the same step
for the handful of specs that click New Game themselves. `scale` is an option LABEL, because
the `<select>`'s values are indexes.

**One new `window.__game` accessor**, and it exists because the spec could not be written
without it: `gameOverEvents()`, the list of every `GAME_OVER` this game has emitted. A flag
could not answer the question that matters, which is "once" — the failure the latch prevents
is a decided game re-announcing itself at the end of every subsequent turn, and only a count
over turns played PAST the ending can see it.

Per the standing rule on Playwright runs, single areas only during development, and the full
suite is Leigh's to schedule.

---

## 9. Documents this invalidated — all now rewritten (Q4.4)

~~The Dominapedia's "Goals and Victory" page states that there is no screen on which to choose
a condition and that nothing ends when one is met.~~ Both became false, and the manual quotes
real numbers, so this was a `topics.js` change in the same change set. The whole War section
had to be rewritten once already because it still described a combat model that had been
deleted, and none of it was caught by a test, because no test asserts prose.

Four pages moved:

* **"Goals and Victory"** is rewritten from the ground up. It was two thirds `planned` blocks
  and an opening paragraph saying the game does not end. It now describes the five goals in a
  table, says what losing is, explains the three things about the goals that are easy to get
  wrong, and quotes the progress line. One `planned` block survives, and it is the honest one:
  the victory/defeat SCREEN.
* **"Choosing a Country"** opens by saying this is the SECOND question a new game asks, and
  that the goal decides what a good starting position even is. It also states that the five
  locked countries and the five great powers are one list read from one derivation, because
  a player who noticed the coincidence would otherwise be guessing.
* **"How the AI Thinks"** said the campaign is derived from the condition "so when the
  start-of-game chooser lands, every computer country adapts to your choice" — future tense
  about a screen that now exists. It names the four doctrine dials, the urgency response to a
  runaway leader, and the mid-term theatre.
* **"Design Notes"** led with "THE GAME CANNOT END", which was the top of its list for the
  life of the project.

`docs/04-known-issues.md` item 1 — "No win or lose condition" — is closed, and the register's
**Currently open** list carries the one thing this phase deliberately leaves behind: the
ending has no screen.

`docs/02-game-design-document.md` §1, §6.1, §6.5, §8.5 and §11 items 1 and 6 are updated, and
§6.6 "The end of a game" is new.

---

## 10. Open questions — resolved

**Should a Timed Game show a countdown once it is within, say, twenty turns of the limit?**
Yes, and it is sequenced with the victory screen rather than taken here. The reason it is not
a one-line change is that `victoryProgress()` is deliberately the SAME string for the player
and for the AI reading its own progress, and a clock belongs to the player's copy alone —
`describeLeaderProgress()` in `goalCatalogue.js` already exists for exactly this asymmetry
under this exact goal, and it is where the countdown goes. Until then the turn counter is on
screen and the limit is on the chooser, so the information is available and merely not
subtracted for the player.

**Under Great Powers, should the progress line name WHICH power is next?** Resolved: it does.
`victoryProgress()` finds the nearest power still standing and appends it — "Great Powers:
1 of 3 (France 4/7)". The aggregate alone said nothing useful: "1 of 3" is the same sentence
whether the next power is a province away or untouched, and this is the goal whose whole value
is that it has antagonists.

**Continent bonuses interact with Continental Supremacy.** Restated, not resolved, because it
is the next design piece rather than part of this one. Nothing here blocks it: continents
already exist as economic modifiers and holding one outright already wins a game, so a bonus
is a change to what a continent is WORTH and not to what it is. They should be balanced
together — a continent bonus large enough to matter makes the default goal easier by exactly
as much, which is a change to the length of the standard game.

### What Q4 left open

One thing, and it is deliberate: **the ending has no screen.** `GAME_OVER` fires once, with
the outcome, the winner, the reason and the turn, and the only subscriber is a `console.log`.
That was the plan from §7 onwards — the console line is the first LISTENER and not the
mechanism, so the screens are a second subscriber rather than a change to any of the rules
above. It is the next piece of work.


