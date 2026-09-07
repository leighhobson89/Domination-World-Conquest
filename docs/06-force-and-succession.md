# Force and Succession — why the world froze, and what unfroze it

The phase that followed Combat and Conquest. It began with one question the combat phase could
not answer: **the AI log says *"the most this territory can spare reaches only 0%"* over and over
— why?**

Combat and Conquest had made the AI decide with the function that fights, re-denominated every
odds constant, rebased the attacker's multipliers and made sieges survivable. All four defects
closed. The world still stalled around turn 100 with 98–120 countries alive against a target of
50–80, and the executor's own answer was a number that no constant in `balance.js` could reach.

**This phase found the cause, and it was arithmetic rather than combat.** The result:

| | control | combat phase end | **this phase** | target |
|---|---|---|---|---|
| countries surviving | 126 | 101 | **52** | 50–80 ✓ |
| largest empire | 43 of 359 | 65 | **84** | 90–120 |
| top-16 share | 59% | 62% | **85%** | — |
| continents held outright | 0 | 1 | 1 | ≥1 ✓ |
| conquest, late game | zero at 3 of 6 samples | — | **non-zero at every sample** ✓ | non-zero |
| world army at turn 150 | 126M | — | **117M** | — |
| a goal completed by 150 | no | no | **no** ✓ | no, deliberately |

---

## 1. What was actually wrong

### 1.1 The entry price

A border territory keeps `defenceKeepRatio` (0.5) × the strongest enemy that can reach it, and
marches out with `appetite` (~0.7) of what is left. Against a comparable neighbour that is an
attack at **0.35:1**. Measured, on the real model:

| send ratio | flat, no forts | mountain 3 | mountain 5 | mtn 3 + 2 forts |
|---|---|---|---|---|
| 0.35:1 *(what it can send)* | **0.0%** | 0.0% | 0.0% | 0.0% |
| 1.00:1 | 6.7% | 0.7% | 0.7% | 1.0% |
| 1.50:1 | 77.0% | 20.7% | 21.7% | 18.3% |

**At the ratio a territory can actually send, the chance is 0.0% on flat ground with no forts.**
Inverted, `army needed = E × (ratio / appetite + keep)`:

| to attack at | send ratio | army needed, flat | army needed, mountain 3 |
|---|---|---|---|
| 25% | 1.08:1 / 1.64:1 | 2.04× | 2.85× |
| 45% | 1.08:1 / 2.00:1 | 2.04× | 3.36× |
| 65% | 1.30:1 / 2.00:1 | 2.36× | 3.36× |

A country had to field **two to three and a half times its neighbour's army** before it could
attack it at all. Between neighbours with similar economies that never happens.

### 1.2 Why nothing could route around it

- **85% of countries hold exactly one territory** — 176 of 207. So `muster.js` has no interior to
  draw from, and combined attacks are impossible.
- **89.3% of adjacent enemy pairings have exactly one attacking territory available**, so a
  combined attack is worth a mean of only ×1.20 across the map.
- **The keep is a MAXIMUM over every reachable enemy**, so one powerful neighbour sized the
  garrison on *every* border a country had, freezing it against neighbours a fraction of its
  strength.
- **A territory could attack only once per turn** — `doAiActions()` carried a bare
  `//only one attack from any territory per turn`, a rule the player has never been subject to —
  so a breakthrough could not be exploited in the turn it was made.

### 1.3 The theory that was tested and rejected

**Weakening the mountains was the obvious candidate and it is not the cause.** 53.5% of the map
costs the attacker a die before anybody builds anything, so it is a reasonable first guess — but
at 0.35:1 the take probability is already 0.0% on flat ground with no forts, and no reduction in
terrain moves a number that is already zero. Mountains are worth about **+40% on the entry price**
(2.36× → 3.36×) and they matter a great deal in the 1.0–1.6:1 band, which is where an unfrozen AI
now operates. They were deliberately left untouched by this phase so that their effect could be
judged separately.

### 1.4 The one that was invisible until the rest was fixed

With the entry price lowered, the world moved to 87 countries — and then froze again, in a new
place: the largest empire reached **71 territories at turn 50 and was still on 71 at turn 150**,
while the world's army tripled from 67M to 192M and its gold multiplied by five.

**Everyone gets richer together, so the ratio between neighbours never moves.** A stalemate
between two comparable countries is symmetric, and absolute growth buys nothing because only the
ratio decides a battle. A country's character was drawn once at the start of the game and fixed
for the rest of it, so nothing in the game could ever break one.

---

## 2. What was done

### 2.1 A `risk_taking` trait

Aggressive 0.6–1.0, balanced 0.3–0.7, pacifist 0.0–0.4. It moves the keep-back either way around
`defenceKeepRatio` through `riskKeepSwing` (0.5), so a bold leader holds a thin border and reaches
a ratio a cautious one cannot.

**It is a trait rather than a lower constant for everybody**, and that is the point: the world
contains leaders who can break a deadlock and leaders who cannot. `minimumHomeShare` (0.1) stops
any combination of traits emptying a province, because a border held by nobody is a territory
given away. Every reader defaults it to 0.5, so a save predating it still loads.

### 2.2 The keep excludes the attack's target

Holding a reserve against the territory you are about to assault is paying for that fight twice,
and because the figure is a maximum it froze a country against every neighbour it had. The reserve
against every *other* neighbour is still kept in full — attacking one front does not make the
others safe, which is why this excludes one territory rather than lowering the figure for
everybody.

### 2.3 More than one attack per territory per turn

`attacksPerTerritoryFor(leaderType, traits)` gives 1–3 from `risk_taking` and
`territory_expansion`.

**It is a cap, not a ration.** Each attack is sized against what the territory has left *after*
the previous one, because `mainArrayFriendlyTerritoryCopy` is the goal's working set and
`doAttack()` debits it — so the odds floor is what actually stops the second and third.

**The force is never divided in advance, and that is not a simplification.** The battle is a step
function, so two attacks at 0.175:1 are 0% and 0% where one at 1.5:1 is 77%. Concentration beats
dispersion; going again with the survivors gets the extra attacks without paying for them.

Two knock-ons. `attackLaunchedToArray` had been **written and never read** — dead, because the
one-attack rule made a repeat impossible — and lifting that rule makes it load-bearing, since a
won attack hands you the territory and a second attack on it would hit your own province. And
`attackDiscipline.basePerTurn` went 1 → 2, because with 176 one-territory countries
`territoriesPerExtraAttack` never fires for them and the per-territory cap would have been dead
for most of the world.

### 2.4 Leaders die

`src/ai/succession.js`. Every 30–40 turns a country's leader is replaced, a fresh personality is
drawn from the same generator, and `clearPlansFor()` wipes that country's commitments, setbacks,
posture, theatre and **walls**.

The walls in particular have to go: *"Croatia is not worth attacking"* is a judgement reached by
somebody no longer in charge, and keeping it would give a country a new personality with none of
the change of mind that is the point.

**The schedule is derived, not stored.** The term comes from an FNV-1a hash of the country name.
Four things fall out of that: it costs **no `Math.random` draw** (which would move every seeded
outcome in the game, once per country per succession); it needs **no save slice**; it survives
save and load for free; and it **staggers** 207 successions instead of pulsing them. It also runs
before the leader is read and before `planAiCampaign()`, which is why `clearPlansFor()` also drops
any campaign already derived for this turn.

The player is never succeeded — `leaderType === "human"` is skipped.

---

## 3. What each change was worth

Measured separately, `--turns=150 --seed=goals --every=25 --goal=CONTINENTAL`:

| | control | combat end | **+ entry price** | **+ succession** |
|---|---|---|---|---|
| countries surviving | 126 | 101 | 87 | **52** |
| largest empire | 43 | 65 | 71 | **84** |
| top-16 share | 59% | 62% | 73% | **85%** |
| continent held from | never | t75 | t50 | t75 |
| world army at t150 | 126M | — | 192M | **117M** |
| largest empire by turn | — | — | 71/71/72/71/71 | **48/68/80/87/84** |

**The succession was worth more than the arithmetic**, and it was not on the list of candidates
the combat phase left behind. The two bottom rows are the finding: with the entry price alone the
largest empire is *flat* from turn 50 and the army *accumulates*; with succession it grows through
the whole game and the army is spent. World army falling 192M → 117M is **G7 moving for the first
time**.

---

## 3b. The five-goal table — the acceptance criterion

`--turns=150 --seed=goals --every=25 --goal=KIND`, which is what `CLAUDE.md` names for any change
to `src/ai/`.

| goal | countries: control → combat end → **now** | largest empire | top-16 | continents |
|---|---|---|---|---|
| CONTINENTAL | 126 → 101 → **52** | 43 → 65 → **84** | **85%** | 1 |
| CONQUEST | 122 → 98 → **66** | 52 → 66 → **72** | **82%** | 1 |
| DOMINATION | 115 → 120 → **76** | 46 → 50 → **61** | **77%** | 1 |
| GREAT_POWERS | 104 → 102 → **70** | 48 → 59 → **70** | **81%** | 1 |
| TURN_LIMIT | 113 → 103 → **64** | 36 → 47 → **80** | **83%** | 1 |

**All five goals are inside the 50–80 target band**, against a control where every one of them sat
at 104–126 and the combat phase left them at 98–120. **GREAT_POWERS and TURN_LIMIT are the result
worth noting**: the combat phase flagged them as the two that moved least under everything it
tried — 104 → 102 and 113 → 103 — because their doctrines point at named rivals or at the clock
rather than at contiguous ground. They are 70 and 64 now.

The goals still produce visibly different worlds (52 to 76 surviving, largest 61 to 84), which is
the archived Goals and Victory acceptance criterion, and **no goal completes by turn 150**, which
is the audit §9 Q3 target.

**Every goal completes exactly one continent, and it is always North America.** That is the shape
of the remaining shortfall on largest empire rather than a separate finding: whoever takes North
America holds it outright and then stops, which is what §5.1 means by the gap possibly being
reachability rather than combat.

---

## 4. What this cost to get right

- **`clearPlansFor()` shipped with a missing import**, so every call threw a `ReferenceError` —
  and **1,083 unit tests passed**, because not one of them called it. The headless sim found it on
  turn 20 as the AI stage throwing and the turn loop stalling. It now has three specs, the first
  of which is simply *"can it be called at all"*.

  That is the **third** instance in two phases of the same shape: an assertion or a function whose
  failure mode is indistinguishable from its success. The other two were a pair of `attack/` specs
  reading an empty element (`Number("")` is 0, so "is it finite and 0..100" and "did it not go
  down" were both true of a constant zero) and a siege-gate spec comparing two different
  quantities. **A deliberate sweep for this is the highest-value test work available**, and it is
  logged in [05-outstanding-improvements.md](./05-outstanding-improvements.md).

- **Adding a trait adds a `Math.random` draw per country during bootstrap**, which moves every
  seeded outcome in the game. The aggregate shape is still the right comparison — and is what the
  target band is stated in — but a per-territory diff against an older run is meaningless.

---

## 5. What is still open

1. **The largest empire is 84 against a target of 90–120, and it was MEASURED rather than
   tuned. The reachability theory in this line was half right, and the wrong half is the
   interesting one.** See §7 below: South America is wide open and the North American power is
   already 18–21 territories deep into it, while Europe and Asia are reachable from North
   America through **one territory each**.
2. **Mountains are untouched, deliberately.** Weakening them would push the largest empire up and
   surviving countries *below* 50, which is past target in the other direction — so it is a
   judgement about how the game feels, not a number to be optimised. Leigh's call is to play what
   is here first.
3. **Continental still completes one continent, not three** (known-issue **BO**). The world
   consolidates now. The line that used to stand here — *"the largest empire spreads rather
   than completing continents"* — **is wrong of the country that completes one**, and §7
   replaces it: the North American power does the opposite of spreading, and the country that
   spreads is a different one.
4. **The cliff is still a cliff** — combat stage 3 bought G2 rather than G1, 1.92× → 1.94×.
5. **The over-extension counterweight** is now genuinely actionable for the first time: it was
   always deferred because nothing over-extended, and things do now.

---

## 6. What must not be broken

Everything in the archived combat audit's §7 still holds. This phase adds three:

1. **The entry price is the thing to reason about, not the terrain.** `army needed =
   E × (ratio / appetite + keep)`. Anyone proposing a terrain change to make the AI attack more
   should check that number first — at the ratio a cautious territory can send, flat ground with
   no forts is already 0.0%.
2. **Never divide a garrison between several attacks in advance.** The battle is a step function
   and dispersion is strictly worse than concentration. Sequential attacks sized against what is
   left are how a territory attacks twice.
3. **The succession schedule must stay derived rather than drawn.** A `Math.random` draw there
   would move every seeded outcome in the game once per country per succession, which would make
   every measurement in this document unreproducible.

---

## 7. Reachability, measured

\S5.1 above guessed that the shortfall on largest empire might be reachability. It was worth
asking and it is now answered, in both directions, by the map data and by a 150-turn
`CONTINENTAL` run on `--seed=goals` sampled at turns 75, 110 and 150. **Half the guess was
wrong and the other half is worse than it looked.**

### 7.1 South America is not blocked, and the leader is already through it

The North America / South America border is **eleven distinct crossings over twelve gateway
territories**, all of it low ground:

| crossing | terrain |
|---|---|
| Mexico ↔ Guatemala / Belize / Honduras / El Salvador / Cayman Islands / Cuba | mtn 2 against mtn 1–3 |
| United States ↔ Cuba | mtn 3 against mtn 2 |
| Andros Island (Bahamas) ↔ Cuba / Turks And Caicos 1 / Turks And Caicos 2 | mtn 1 against mtn 1–2 |
| Grand Bahama (Bahamas) ↔ Cuba | mtn 2 against mtn 2 |

And the AI uses it. Measured, the United States holds **North America 47 of 47 plus South
America 21 / 21 / 18 of 49** at turns 75 / 110 / 150, with a live theatre reading *"taking
ground from Argentina — 15 territory(ies) so far"*. It crossed the Mexico border before turn
75 and has been fighting in the Caribbean and Central America ever since.

**So the fix here is to stop looking**: not blocked, not by terrain, not by the plan, and not
by the AI. Its South American frontier is 28–31 of its 30–33 pairings.

### 7.2 Europe and Asia are each ONE territory wide, and that is the real finding

| continent pair | gateway territories | distinct crossings |
|---|---|---|
| North America ↔ South America | 12 | **11** |
| Asia ↔ Oceania | 22 | 31 |
| Africa ↔ Europe | 20 | 26 |
| Asia ↔ Europe | 22 | 26 |
| Africa ↔ Asia | 17 | 25 |
| Africa ↔ South America | 4 | 3 |
| **Europe ↔ North America** | **2** → 3 | **1** → **2** — Greenland ↔ Iceland, and now Greenland ↔ Svalbard (§7.6) |
| **Asia ↔ North America** | **2** | **1** — Alaskan Islands 4 ↔ Russia |

**Greenland ↔ Iceland is the only door between Europe and North America on the map, and both
ends carry `mountainDefenseFactor` 5** — two of only **eleven** such territories in the world
(the distribution is 42 / 144 / 126 / 36 / **11** across factors 1–5). Greenland has exactly
two neighbours in the entire game: Ellesmere Island and Iceland.

Measured, that door is shut and stays shut. The United States' European frontier is **1
pairing of 30–33, at every sample**, and its plan skips it every turn. Iceland's garrison ran
27,770 → 27,770 → 85,664 while Greenland sat on ~30,000 behind four forts. The Asian door is
the same shape: 1 pairing, Alaskan Islands 4 against Russia, which China holds with 180,000
rising to 1,324,000 behind five forts.

**So North America was a cul-de-sac.** Whoever took it could reach a second continent freely
and a third only by forcing a single maximum-terrain strait held by another superpower. Under
`CONTINENTAL`, which asks for three, that country could not win from where it started — which
is the structural half of known-issue **BO**, and it is a fact about the MAP rather than about
`src/ai/`. **§7.6 is what was done about it**, and §7.5 is the measurement that decided which
lever to pull.

### 7.3 The plan DOES update when a continent is banked

The other half of the question, and the answer is yes. Measured on the United States at all
three samples:

```
objective  { continents: ["North America", "South America", "Europe"],
             banked: ["North America"] }
focus      South America
posture    EXPAND
theatre    Argentina -- taking ground, 15 territories so far
```

North America is banked the turn it is completed, the focus moves to South America, and the
goal list fills with attacks into the Caribbean. Nothing is stuck.

**One gap is real and one apparent gap is not.** The real one: `rankContinentsByAmbition()` in
`src/ai/strategy.js` has a `foothold` term whose own comment says *"you cannot campaign for
Antarctica from Peru"*, but it counts only territories **held** — so a continent the country
BORDERS scores exactly the same as one on the other side of the world, and nothing anywhere in
the objective consults adjacency. The apparent one: `commitmentIsPointless()` returns true
every turn for a country whose only foothold continent is complete (every row is then
`complete || held === 0`), so the objective is re-picked every turn instead of every
`CAMPAIGN_REVIEW_INTERVAL`. Both are worth knowing and **neither is worth fixing on this map**,
which is why they are recorded here rather than acted on: the United States' reachable
continents are South America, Europe and Asia, so a reachability term would swap Europe for
Asia — another one-territory door — and the re-pick is stable because the ranking is
deterministic enough that it returns the same three every time. Fixing them is a change that
would measure as noise.

### 7.4 What the world is actually stopped by

Across all three of the top countries at all three samples, the dominant skip reason is the
same one, and it is neither reachability nor the plan:

| country, turn 150 | pairings weighed | commonest verdict |
|---|---|---|
| China (84 territories, 141-pairing frontier) | 24 | 24 × *"below the 8% floor the game applies to everybody"* |
| United States (65) | 24 | 20 × the same, 3 attacks |
| Indonesia (49) | 24 | 24 × the same |

That is `PROBABILITY_THRESHOLD_FOR_SIEGE`, the global hard floor — reached with the source
territory's **whole** garrison. China's frontier is 141 pairings across five continents and it
still cannot reach 8% on most of them. **This is known-issue G6 exactly as combat stage 5 left
it**: a fact about how much force a border can raise, not about any figure in `balance.js`,
and not about the map.

One thing seen while measuring it is worth logging on its own. `planMusters()` sends **every**
qualifying neighbour's spare infantry to a single destination with no cap, and the spearhead is
`territories.find(...)` — the first owned territory that touches the theatre rival, in
`territoriesOwnedByCountry()` order, which is `defenseBonus` order and therefore arbitrary. On
turn 76 China marched infantry from **seventeen** territories into Kamchatkan Islands 3,
376,749 of them from Kamchatkan Islands 2 alone, while its war was being fought elsewhere. That
is force removed from the war by the mechanism meant to deliver it, and it belongs to **G7**
rather than to anything here.

### 7.5 What terrain is actually worth here — the measurement that chose the lever

The obvious move is to weaken the mountains on the two territories, and **measured, it is very
nearly a no-op**. It is written down because it is the proposal anybody looks at first.

**Terrain is QUANTISED, so 5 → 4 → 3 changes nothing at all.** The dice model does not read
`mountainDefenseFactor` as a scale: `battleModel.js` reads `defenseBonus + mountainDefenseBonus`
against two bands — **≥25 costs the attacker one die, ≥100 costs two**. The mountain term is
factor × `MOUNTAIN_DEFENSE_SCALE` (10), so 30, 40 and 50 are all **one die**. Only 5 → 2 drops
under 25 and hands the die back. Everything between moves `defenseMultiplierFor()`, which is the
bar the player is *shown* and the siege score — not the fight.

**And one fort cancels the whole benefit.** Dice taken off an attacker of Iceland:

| forts on Iceland | mtn 5 | mtn 4 | mtn 3 | mtn 2 | mtn 1 |
|---|---|---|---|---|---|
| 0 | −1 | −1 | −1 | **0** | **0** |
| 1 | −1 | −1 | −1 | −1 | −1 |
| 2 | −2 | −1 | −1 | −1 | −1 |
| 3 or 4 | −2 | −2 | −2 | −2 | −2 |

**At the armies the run actually had, even flattening it to sea level does not open the door.**
Greenland attacking Iceland with its whole garrison, which is more than the AI would ever send:

| turn | Greenland | Iceland | ratio | mtn 5 | mtn 3 | mtn 2 | mtn 1 |
|---|---|---|---|---|---|---|---|
| 75 | 35,465 | 27,770 | 1.28:1 | 0.0% | 0.0% | **8.0%** | 5.0% |
| 110 | 29,647 | 27,770 | 1.07:1 | 0.0% | 0.0% | 2.0% | 1.5% |
| 150 | 33,842 | 85,664 | 0.40:1 | 0.0% | 0.0% | 0.0% | 0.0% |

The best case is **8%** — exactly `PROBABILITY_THRESHOLD_FOR_SIEGE`, the floor below which
nothing is offered to anybody, and far under the 14–61% the leaders in that run demanded. The
siege route is shut too: making progress rather than sitting in the arrest band needs **350,000
infantry at mtn 5 and 140,000 at mtn 2**, against a Greenland holding thirty thousand.

**The strait was already one-way, in EUROPE's favour, and terrain was not what did it.**
Iceland attacking Greenland is **100% at 1:1 raw force**, and still 78% with four forts on
Greenland. The cause is `areaBonusFor()` and `devIndex`, neither of which is terrain:

| | area | `areaBonusFor` | `devIndex` | share at 1:1 |
|---|---|---|---|---|
| Greenland | 6,147,133 | **0.528** | **0.452** | 0.406 attacking Iceland |
| Iceland | 213,818 | 1.000 | 0.959 | **0.735** attacking Greenland |

Greenland is a huge, undeveloped territory, which makes it a poor attacker *and* a soft
defender. So the door is held shut by two different things on the two sides, and terrain is
neither of them:

* **North America → Europe: the plan says yes, the odds say no.** Europe IS in the North
  American power's committed three, so Iceland is weighted `committedContinent` (1.6) rather
  than `offContinent` (0.5). It simply cannot reach 8%.
* **Europe → North America: the odds say 100%, the plan says no.** Greenland is North America,
  so to a European power it is off-objective — weight 0.5, and skipped outright under a
  CONSOLIDATE posture. Nobody ever weighed a free conquest.

### 7.6 What was done — a second door, and the terrain drop as well

Leigh's call, taking both. The standard to judge a new crossing against is the one the map
already sets: the ocean crossings this table *already* accepts, as closest approach between the
two paths in SVG user units (the map is about 2,700 wide).

| crossing | units | status |
|---|---|---|
| Djibouti ↔ Yemen | 1.5 | linked |
| Italy ↔ Tunisia | 8.0 | linked |
| Greenland ↔ Iceland | 15.3 | linked — was the ONLY Europe ↔ North America door |
| Maldives 2 ↔ India | 39.2 | linked |
| Bermuda ↔ United States | 63.4 | linked |
| Iceland ↔ Ireland | 65.9 | linked |
| Arctic Islands 1 ↔ Svalbard | 95.7 | linked — Asia ↔ Europe |
| Australia ↔ New Zealand South Island | 104.8 | linked |
| Brazil ↔ Sierra Leone | 147.8 | linked — the Atlantic |
| Russia ↔ Alaskan Islands 4 | 1,116.4 | linked — across the date line, so the figure is an artefact of the projection |
| **Greenland ↔ Svalbard** | **122.7** | **LINKED NOW — the second door** |
| Greenland ↔ Norway | 147.9 | not linked |
| Newfoundland ↔ Iceland | 189.9 | not linked |
| Newfoundland ↔ Ireland | 232.6 | not linked |

**Greenland ↔ Svalbard was the candidate and it has shipped.** At 122.7 units it is shorter
than a crossing the map already had (Brazil ↔ Sierra Leone, 147.8) and comparable to two more
(Australia ↔ New Zealand, Arctic Islands 1 ↔ Svalbard), so it is inside the standard the map
already sets rather than a new one. Svalbard is Norwegian and therefore European, so North
America now reaches Europe through **two** territories instead of one, the second on
`mountainDefenseFactor` 4 and away from the Iceland bottleneck. Greenland had **two neighbours
in the whole game** and has three.

**And Greenland and Iceland both went from `mountainDefenseFactor` 5 to 2**, taken with it
rather than instead of it. §7.5 is clear that on its own this is nearly a no-op — it was taken
knowing that. What it buys, against an UNFORTIFIED Iceland, is the whole of the 25-bonus band:
the attacker gets its die back (**−1 → 0**), 1.5:1 goes **9.5% → 46%** and 2:1 goes **15% →
77%**, and the siege stops sitting in the arrest band (`scoreDifference` **−28 → +2**, with the
infantry needed for a siege to progress falling **350,000 → 140,000**). What it does not buy is
anything at all once the defender builds: one fort restores the die at any terrain, three
restore both.

Two knock-ons of the terrain change, both deliberate and both worth watching in the acceptance
run. It **widens the already-open direction too** — Iceland → Greenland was 100% at 1:1 before
and the change lifts its displayed bar 49% → 66% — so if anything it invites Europe into North
America sooner than the reverse. And the map now has **9 mountain-5 territories rather than 11,
and 146 at mountain 2 rather than 144**, which moves the world's terrain distribution from
167/192 territories at 0/1 dice to **169/190**.

**Neither change is a fix for G6.** §7.4 is what stops the world, and a second door into a
continent nobody can raise 8% against does not change that. Both move every seeded outcome, so
they want the five-goal 150-turn table `CLAUDE.md` names as the acceptance criterion, plus the
one question these were taken to answer: **does a North American power now reach a second and
third continent, and does Europe come the other way?**

Worth recording alongside them, and NOT done: **Greenland ↔ Baffin Island is 32.1 units and
Greenland ↔ Devon Island 40.8, and neither is linked** — both shorter than Bermuda ↔ United
States and Iceland ↔ Ireland, which are. They are North America on both sides, so they open no
door; what they would change is how easily the gateway itself is reached across the Canadian
arctic, which today is through Ellesmere Island alone.

---

## 8. The three horizons, separated

Leigh's decision, and the first change to `src/ai/` since the phase shipped. It came out of §7:
the plan layer was working, but the horizon meant to be the most stable was the one that
churned, and the horizon meant to be derived was the one that came out of a static table.

### 8.1 What changed

**Leader terms are 15–20 turns, halved from 30–40.** Over 150 turns a country now changes its
mind eight or nine times rather than four.

**A succession keeps the LONG term and clears the rest.** `clearPlansFor()` no longer deletes
`commitments`. The theatre, the walls, the setbacks, the posture and any campaign already
derived this turn still go. An heir inherits the war and re-decides only how to fight it —
which is what makes the shorter term cheap rather than destabilising. Wiping the objective too
made a succession a country *forgetting what it was for*: a fifty-turn war could end because
somebody died.

**A committed continent is permanent, and the list grows one at a time.**
`CAMPAIGN_REVIEW_INTERVAL` and `commitmentIsPointless()` are deleted. The old code re-picked
the long term every five turns, and again whenever the commitment "became pointless" — which
for a country whose only foothold continent was complete was **every single turn** (§7.3).

**`reach` is the term that makes the choice derived.** `foothold` counts only territories
already HELD, so a continent across a shared border scored the same as one on the far side of
the planet, and a country with no foothold abroad had its score collapse to the static
`continentModifiers`. Weight 2, saturating at `continentReachSaturation` (6) adjacent enemy
territories, folded from the frontier `theatre.js` was already building — hoisted in
`planCampaign()` so the border is walked once per country per turn rather than twice.

### 8.2 Why the objective is committed INCREMENTALLY

The two requirements are in tension and the tension is measurable. "Never change it once set"
and "choose it dynamically" cannot both hold if the whole objective is fixed on turn 1, because
on turn 1 a country holds one or two territories and borders almost nothing — `reach` is near
zero for every foreign continent and the score falls back to the static table. **Measured, with
all three committed on turn 1, almost every country in the world came out with `["its own
continent", "Europe", "South America"]`:**

```
Australia -> ["Oceania","Europe","South America"]      Canada -> ["North America","Europe","South America"]
China     -> ["Asia","Europe","South America"]         Nigeria -> ["Africa","Europe","South America"]
United States -> ["North America","Europe","South America"]
```

That is the fixed objective moved down one slot, not removed. Committing the next continent
only once the current ones are complete means each choice is made from a world the country can
actually see, and nothing already chosen is ever revisited. After the change, at turn 3:

```
Australia -> ["Oceania"]   Canada -> ["North America"]   China -> ["Asia"]   Brazil -> ["South America"]
```

And it produces the right second choice for the case §7 was written about. At turn 150 the
United States reads:

```
objective { continents: ["North America", "South America"], banked: ["North America"] }
focus     South America
theatre   Argentina
```

**South America, derived** — 24–28 frontier pairings against 3–8 into Europe — rather than
Europe because a table says Europe is worth 1.0.

### 8.3 Measured, and it is not an improvement on largest empire

`--turns=150 --seed=goals --goal=CONTINENTAL`, sampled at 75 / 110 / 150.

| | before | after | target |
|---|---|---|---|
| countries surviving @150 | 52 | **58** | 50–80 ✓ both |
| largest empire @150 | 84 | **77** | 90–120 |
| top-ten share @150 | 79% | 78% | — |
| continents held outright | 1 | 1 | ≥1 ✓ |
| largest by sample | 68 / 91 / 84 | 63 / 65 / 77 | — |

**Surviving countries stay in the target band and the largest empire moves the wrong way,
84 → 77.** The shape also changed: before, China ran away to 91 by turn 110 and fell back to
84; now the United States climbs steadily 63 → 65 → 77 and China never runs away at all
(48 → 34 → 46).

**A CONFOUND, AND IT IS NOT SMALL.** This run also contains §7.6's two map changes — the
Greenland ↔ Svalbard door and Greenland and Iceland at terrain 2 — so the 84 → 77 cannot be
attributed to the plan-horizon changes alone. Separating them is two more runs.

Two candidate causes for the drop, both testable and neither tested:

1. **A narrower committed set weights fewer targets.** China's frontier is 213 pairings across
   four continents; it used to have three of them committed at `committedContinent` (1.6) and
   now has one, so most of its border fell to `offContinent` (0.5).
2. **Twice as many successions means twice as much theatre churn.** The medium term is still
   wiped by a succession, and at 15–20 turns that now happens twice as often.

### 8.4 What the second Atlantic door did, measured

Worth recording separately because it is the one thing here with an unambiguous reading. The
United States' European frontier went from **1 pairing at every sample** to **8 distinct targets
at turn 76** (Norway, Finland, Sweden, Denmark, Germany, Netherlands), and it **held 2–3
European territories** at turns 76 and 111 where it held none at any sample of the run before.
So the door is open and it is used. It did not become a campaign, because Europe is no longer a
committed continent for a power whose reachable ground is South America — which is the objective
layer working as designed rather than against it.
