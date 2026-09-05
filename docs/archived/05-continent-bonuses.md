# Continent Bonuses

**Companion documents:** [01-codebase-audit.md](./01-codebase-audit.md) ·
[02-game-design-document.md](./02-game-design-document.md) ·
[03-e2e-test-plan.md](./03-e2e-test-plan.md) · [04-known-issues.md](./04-known-issues.md) ·
[archived/05-goals-and-victory.md](./archived/05-goals-and-victory.md)

The task breakdown is [06-continent-bonuses-checklist.md](./06-continent-bonuses-checklist.md).

---

## 1. Why this exists

Continents are already everywhere in this game and they have never been worth anything.

Every one of the 359 territories carries a `continent`. The economy reads it twice a turn —
`continentModifiers` scales a territory's general output and `goldContinentModifiers` scales
its gold, so Europe earns at full rate and Africa at 30%. The AI commits to three of them and
plans a whole campaign around finishing one. The default victory condition is *hold every
territory on three continents outright*. The map can draw their boundaries, and since the view
cycle was swapped it does so by default.

And yet **holding one whole grants nothing at all**. That is item 9 on the "Not implemented"
list in [02-game-design-document.md](./02-game-design-document.md#11-not-implemented), where
it has sat since the document was written, and it is the missing half of the goal layer: the
long-term objective is a continent, the mid-term objective is a country, and the short-term
objective is a territory — but only the last of those pays.

The consequence is that a player finishing Africa and a player holding the same number of
territories scattered across four continents have identical economies. There is no reason to
consolidate that is not eventually a reason about defensibility, and defensibility is a thing
the AI is bad at threatening. So the middle game has no shape: expansion is a habit rather
than a decision, which is exactly the tension the Dominapedia's Design Notes names.

**This phase makes a completed continent pay.**

---

## 2. What was decided, and by whom

Four design questions were put to Leigh before a line was written. His answers are the
constraints this document is built on, and none of them is up for re-litigation here.

| Question | Decision |
|---|---|
| What does holding a continent give? | **Economy only.** No combat modifier of any kind. |
| Does a partly-held continent earn anything? | **No. All or nothing.** |
| How large? | **Significant — you replan around it.** Roughly half as much again. |
| Ship the over-extension counterweight with it? | **No.** Bonuses alone, so they can be measured alone. |

### Why economy only, and not a die

The obvious alternative was a combat bonus, and it is the one to stay away from.

`CLAUDE.md` records what happened the last time this game reached for the dice: **as a face
bonus, fortification let a 2:1 attacker take a fortress 100% of the time**, and the fix was to
take dice off the attacker instead. The model is BANDED — `share` picks a die count out of a
table — so a modifier either does nothing at all or moves a whole die, and a whole extra die
is an *unmatched* die, which is an automatic hit every round. There is no small version of it.

A **defensive** bonus would have been worse than useless. The register's most consequential
open item is that *attacking is too hard for the world to consolidate*: measured over two
seeds, about 59% of every reachable (attacker, defender) pairing sits below the 15% win
probability the game applies to everybody, before any AI decision is taken. Handing every
consolidated empire a defensive edge pushes hard in the wrong direction and would show up as
the world freezing — which has no textual signature, so it would be found by nobody.

The economy has none of those properties. It is continuous, it is already scaled per
continent, and a percentage on it is a number that can be tuned by halves without any of it
becoming a step function.

### Why all or nothing

Because it is the only shape that creates a decision.

Under proportional credit a continent stops being an objective and becomes a slope: every
conquest pays a little, nothing ever *happens*, and there is no moment worth planning towards.
Under all-or-nothing the thirteenth territory of a thirteen-territory continent is worth a war
of its own — and the player can see that war coming several turns out, which is the whole
point.

It also matches the CONTINENTAL victory condition exactly. That condition already asks for
every territory on a continent, so a bonus with a different threshold would mean the game
measured "holding a continent" two different ways, and the two would drift. One definition,
one rule.

---

## 3. The rule

> **A country that holds every territory on a continent earns more from every territory on
> that continent.**

It applies to the player and to all 206 AI countries identically. That is not a courtesy: the
principle `CLAUDE.md` records for combat — *the player and the AI fight the same battle* —
holds for the economy too, and an asymmetric bonus would make every measurement taken with
`tools/ai-sim.mjs` a measurement of a different game from the one being played.

### One thing that is NOT obvious, and shapes the whole implementation

"+50% income" means two different things in this game, because the four resources are two
different kinds of thing.

* **Gold is a FLOW.** `goldChangeFor()` earns it fresh each turn from the productive
  population, the area and the development index. A multiplier on it is exactly what a player
  imagines a bonus to be.
* **Oil, food and construction materials are STOCKS with a CEILING.**
  `regenerationTowardsCapacity()` moves the held amount towards `oilCapacity` /`foodCapacity` /
  `consMatsCapacity` — recovering a fraction of the shortfall each turn, faster up than down.
  Multiplying that *delta* would make a territory reach the same ceiling slightly sooner and
  change nothing at all thereafter. **Within a handful of turns it is worth nothing.**

So the bonus is a multiplier on gold INCOME and on the three CAPACITIES. Raising a capacity is
a real, permanent gain: food capacity is what a population and an army can be fed up to, and
oil capacity is what decides how much of an army can actually fight. A continent held whole
should raise the ceiling of what it can sustain, and that is a sentence a player can act on.

### Sizes

Two dials, both in `src/config/balance.js`, both with the reason recorded at the site.

| Dial | Value | Why |
|---|---|---|
| `CONTINENT_BONUS_GOLD` | **1.5** | "Significant — you replan around it". It sits in the same range as the existing `goldContinentModifiers` (0.3 to 1.0), so the two read as one system rather than as a bonus bolted onto a table. |
| `CONTINENT_BONUS_CAPACITY` | **1.25** | Deliberately smaller. Food capacity gates population, population gates productive population, and productive population is the input to gold — so a capacity multiplier compounds into the gold multiplier over a few turns, while a gold multiplier does not compound into anything. Equal numbers would not be equal effects. |

They are separate constants precisely so that the measurement in §6 can move one without the
other. **Both numbers have now been measured and both are RETAINED** — see §6. They produce a
visible change in the goal that is about continents, no change at all in the three goals that
never complete one, and no runaway anywhere. Raising them would amplify only the first of
those, for the reason §6 sets out.

### The edge cases, decided here so they are not decided by accident

* **A besieged territory still counts towards control.** You hold it; a siege is a thing
  happening to it. (It earns nothing itself while besieged, which is a separate existing rule
  and is untouched.)
* **A freshly conquered territory counts immediately**, deactivated or not. The lockout is
  about what a territory can *do*, not about who owns it.
* **The bonus is derived every turn from ownership, never stored.** See §4.
* **Six continents, and they are not equal**: Asia 87 territories, Oceania 66, Africa 59,
  Europe 52, South America 48, North America 47. A *percentage* self-weights — Asia held whole
  is worth far more in absolute gold than North America held whole, because it has more
  territories earning it — so there is no per-continent bonus table and there should not be
  one. **Oceania is the trap worth knowing about**: it is small in area and 66 territories of
  islands, so it is the hardest continent on the map to complete and one of the least
  rewarding. That is a fact about the map, not a bug in the bonus.

---

## 4. Architecture

### The one rule that matters: control is DERIVED

A territory changes hands and a continent's control changes with it. There must be no stored
"who holds this continent" that a conquest has to remember to update.

This codebase has been bitten by stored derivations repeatedly and `CLAUDE.md` records three of
them: the map colour snapshot restored from ~30 call sites, `territoryAboutToBeAttackedOrSieged`
sitting beside the marker it drew, and `underSiege` as a field rather than "a siege names it".
Every one produced the same failure — two representations of one fact, and only one of them
updated on some path.

So: **`continentControl()` walks the territories and returns who holds what.** It is called
once at the top of the income pass, its result is passed down as part of the economy context,
and nothing stores it.

### Where it lives, and why not in the obvious place

`worldStandings()` in `src/ai/victory.js` **already does this walk** — it builds, per
continent, a map of owner to territory count, in one pass, because the AI needs it every turn.
Writing a second walk would mean two definitions of "holds a continent outright" and two passes
over 359 territories a turn.

But it cannot simply be imported. The dependency edge already runs the other way:
`src/rules/victoryCheck.js` imports `src/ai/victory.js`. Adding `ai -> rules` on top of
`rules -> ai` is a package-level cycle, and this codebase has spent whole phases getting out of
one.

**So the derivation moves to `src/state/continents.js`**, which both may import without a
cycle: `src/ai/` and `src/rules/` already both depend on `src/state/selectors.js`, and this is
the same kind of thing — a pure read over the territory store.

```
src/state/continents.js          NEW. Pure. Runs in Node.
    continentControl(territories) -> Map<continent, {total, held: Map<owner, count>}>
    continentsHeldOutrightBy(owner, control) -> string[]
    holdsContinentOutright(owner, continent, control) -> boolean

src/ai/victory.js                worldStandings() takes its continent half from here
                                 instead of rebuilding it, so there is ONE definition
src/rules/economy/income.js      goldChangeFor() reads context.continentBonus
src/rules/economy/capacity.js    effectiveCapacityFor(territory, bonus) — DERIVED,
                                 never written back onto the territory
resourceCalculations.js          computes control once per turn, puts the multiplier
                                 for each territory into the economy context
```

### The trap `effectiveCapacityFor()` exists to avoid

The stored `foodCapacity` / `oilCapacity` / `consMatsCapacity` are built at world creation and
raised by upgrades (+10% per farm, forest or oil well). **The bonus must not be written into
them.** If it were, losing the last territory of a continent would need an exact inverse write,
the two would disagree the first time any path forgot, and a player would keep a bonus for a
continent they no longer held — silently, because nothing anywhere compares the stored capacity
to what it should be.

Derived at the point of use, losing the continent is simply the next turn's answer.

### What the AI needs

Almost nothing, and that is the point of having built the doctrine layer.

`targeting.js` already pays roughly two and a half times for a target on the focus continent
and several times again for one that would COMPLETE a continent, and `strategy.js` already
commits to continents and keeps the commitment across turns. The bonus makes those existing
preferences *correct* rather than merely encouraged. The one thing worth checking is whether
`continentValue` in the target rating should now read the bonus — and the answer is decided by
measurement, not by argument.

---

## 5. What the player is told

A bonus nobody can see is a bonus nobody plays for, and this one has to be visible before it
is fought for rather than after.

* **The territory tooltip** names the continent and says whether it is held whole, because the
  tooltip is what a player reads while deciding where to attack.
* **The info panel's Summary tab** gains a line: which continents you hold outright, and what
  they are worth. It is the one screen that already answers "how am I doing".
* **The continent map view** — now the default, which is why the view cycle was swapped as part
  of this work — is the natural place to show a continent you hold whole differently from one
  you do not. This is the stretch item of the three and the checklist marks it so.
* **The Dominapedia** gets the rule, the numbers and the Oceania warning. The manual quotes
  real figures, so `topics.js` moves in the same change set as `balance.js` — the War section
  had to be rewritten once because it still described a deleted combat model, and no test
  asserts prose.

---

## 6. The measurement

`npm run test:unit` proves the derivation is right and
`tests/e2e/resources-economy/continent-bonus.spec.js` proves it reaches a real territory in a
real game. Neither can prove the game is better, and neither can see the failure that matters
— a world that quietly stops changing while every turn completes and nothing throws.

So the acceptance criterion is `tools/ai-sim.mjs`, run for each of the five goals, 150 turns,
`--seed=goals`, default scales.

### 6.1 The baseline had to be re-measured

The numbers recorded in [archived/05-goals-and-victory.md](./archived/05-goals-and-victory.md)
§5 are not a usable control. They were taken before Goals and Victory Q4 and before two
further commits, and re-running today's code with the two dials set to **1.0** reproduces four
of those five rows exactly and the fifth not at all:

| Goal | Archived §5 | Control, today, dials at 1.0 |
|---|---|---|
| Continental Supremacy (3) | 81 / 97 / 81% | 81 / 97 / 81% ✓ |
| World Conquest | 78 / 78 / 80% | 78 / 78 / 80% ✓ |
| Domination (60%) | 96 / 79 / 76% | 96 / 79 / 76% ✓ |
| Great Powers (all 5) | 107 / **69** / **70%** | 107 / **52** / **67%** ✗ |
| Timed Game (200) | 114 / 51 / 65% | 114 / 51 / 65% ✓ |

*(countries surviving / largest empire / share held by the top sixteen)*

**The Great Powers row moved for reasons that predate this phase**, and the control proves it:
with the bonus switched off it is already 52 and 67%. Had the archived table been used as the
"before", this phase would have been credited with a 25% reduction in the largest empire that
it did not cause. That is the whole reason a control was run rather than a diff taken against a
recorded number, and it is worth remembering the next time a phase is judged this way.

### 6.2 Before and after

Both columns are today's code at seed `goals`; the only difference is the two dials.

| Goal | Countries | Largest empire | Top-16 share | Continents completed |
|---|---|---|---|---|
| Continental Supremacy (3) | 81 → **77** | 97 → **104** | 81% → **83%** | 1 → 1 (North America, United States) |
| World Conquest | 78 → 78 | 78 → 78 | 80% → 80% | 1 → 1 (South America, Mexico) |
| Domination (60%) | 96 → 96 | 79 → 79 | 76% → 76% | 0 → 0 (nearest 94%) |
| Great Powers (all 5) | 107 → 107 | 52 → 52 | 67% → 67% | 0 → 0 (nearest 80%) |
| Timed Game (200) | 114 → 114 | 51 → 51 | 65% → 65% | 0 → 0 (nearest 71%) |

### 6.3 A goal at a time

**Continental Supremacy — the one the bonus is for, and the one it moved.** The two runs are
identical to t50 and then separate:

| | t25 | t50 | t75 | t100 | t125 | t150 |
|---|---:|---:|---:|---:|---:|---:|
| largest empire, dials off | 31 | 45 | 54 | 57 | 76 | 97 |
| largest empire, dials on | 31 | 45 | 60 | **101** | **104** | **104** |

The United States completes North America around t70 in both runs. What the bonus changes is
what happens next: with it, that empire goes from 60 to 101 territories in the following
twenty-five turns, and then **stops** at 104. Without it, the same empire takes until t150 to
reach 97. So the bonus does not raise the ceiling of the continental game — it brings it
forward by roughly fifty turns. That is the intended effect stated exactly: a country that
completes its first continent gets better at completing its second, and the middle game
acquires a shape it did not have.

**World Conquest — the bonus lands, and the map does not care.** Mexico completes South
America at t50 and holds it for the remaining hundred turns, and every territory count in the
two runs is identical at every checkpoint. The difference is in the economy underneath:
Mexico's total army is larger in the bonus run at every sample from t50 on (+327k at t50,
+790k at t75, +796k at t150). Under Conquest the AI is already spending everything it has on
expansion and is bounded by what it can reach rather than by what it can afford, so a richer
Mexico buys a bigger army and takes the same ground. Worth recording because it is the clean
demonstration that **an AI country is paid exactly as the player is** — the same claim
`continent-bonus.spec.js` makes about one turn, made over a hundred.

**Domination, Great Powers and Timed Game — unchanged, because no continent is ever
completed.** All three finish with zero. The nearest any of them gets is South America at 94%
under Domination, 80% under Great Powers and Oceania at 71% under a Timed Game. The runs are
byte-identical to their controls in every sampled field.

That is a finding rather than a disappointment, and it is the reason the two dials are NOT
being raised. The bonus pays only on completion, so its size has no effect at all on a world
that never completes one — raising `CONTINENT_BONUS_GOLD` would amplify Continental Supremacy
alone and would do nothing whatever to the other three. What holds those three back is the
register's oldest open item: attacking is too hard for the world to consolidate, with ~59% of
every reachable pairing below the 15% floor. **The last five territories of a continent are
the hardest five on the map to take**, because they are whatever is left after the easy ones
have gone. If those goals should be reaching a continent, the lever is the odds, not this
bonus.

### 6.4 Against the three things §6 said to look for

1. **A runaway — no.** The alarm was "the largest empire under Continental Supremacy goes from
   97 to something like 200 while the country count collapses". It went to 104, it plateaued at
   t100, and the country count fell from 81 to 77. Nothing in the other four goals moved at all.
2. **Nothing happening — no.** Continental Supremacy is visibly a different game, and World
   Conquest shows the bonus arriving in an AI economy even where the map does not change.
3. **A stall — no.** Read across the trajectories rather than the last row: the largest empire
   flattens at 104 from t100 while the country count keeps falling (104 at t100, 85 at t125, 77
   at t150), so the world is still consolidating after the leader has stopped growing. That is a
   plateau, not a freeze.

### 6.5 One thing seen in passing, and it is not this phase's

Large empires accumulate a hugely **negative** `armyForCurrentTerritory`: India finishes a
Continental run at −6.5 billion, the United States at −520 million. It is present identically
in the control runs, so it predates this phase and this phase did not cause it — but it is new
information, it appears only in the goals where an empire grows very large, and it is logged as
**BJ** in [04-known-issues.md](./04-known-issues.md) §13.

### 6.6 How to reproduce any of this

```bash
npm run dev                       # in another terminal; the sim drives the real game
node tools/ai-sim.mjs --goal=CONTINENTAL --turns=150 --seed=goals --every=25 \
    --out=test-reports/ai-sim/after-CONTINENTAL.json
```

For the control, set both dials in `src/config/balance.js` to `1.0` first, and put them back
afterwards. Every sampled turn now reports `cont` (continents held outright) and `best` (how
far along the nearest one is), because a run stuck at "0 complete, 41%" and one stuck at
"0 complete, 96%" are different findings and every other column shows them the same.

---

## 7. What this phase deliberately does not do

* **No over-extension counterweight.** Leigh's call, and the right one: a cost for scattered
  land is a second large balance change, and two of them landing together means neither can be
  measured. It is the next phase, and the numbers here were chosen knowing it is coming.
* **No combat modifier**, for the reasons in §2.
* **No per-continent bonus table.** A percentage self-weights; see §3.
* **No change to the existing `continentModifiers` / `goldContinentModifiers`.** They are what
  a continent is worth to live on. This is what it is worth to own outright. Two different
  facts, two different tables, and merging them would make the balance pass that eventually
  retunes one of them retune both.

---

## 8. Open questions

- Should the bonus decay or ramp — a continent freshly completed paying less than one held for
  ten turns? It would blunt the snowball and reward defending rather than taking. It is not in
  this phase because it doubles the state involved, and because a bonus you cannot predict is a
  bonus you cannot plan around.
- Does `targeting.js` need to read the bonus explicitly, or is the existing completion weight
  already enough? Decided by the §6 measurement rather than in advance.
- Oceania is 66 island territories and by far the hardest continent to complete for a reward no
  larger than anyone else's. Leave it as a fact about the map, or is it worth a look in the
  balance pass that follows?
- **Africa and Europe are nearly the same boundary colour.** `CONTINENT_COLOR_ARRAY` gives
  Africa `rgb(233, 234, 20)` and Europe `rgb(186, 218, 85)` — a yellow and a yellow-green — and
  the two meet at the Mediterranean, which is the one place on the map where telling them apart
  matters most. That was tolerable while the boundaries were the third stop of a cycle nobody
  reached. It is worth another look now that they are what the game opens on. Deliberately not
  changed here: it is a taste call and it is Leigh's.
