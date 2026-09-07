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

1. **The largest empire is 84 against a target of 90–120.** The leader holds North America
   outright and must cross water or the Mexico border to grow, so the remaining gap may be
   reachability rather than combat at all. Worth measuring before anything is tuned.
2. **Mountains are untouched, deliberately.** Weakening them would push the largest empire up and
   surviving countries *below* 50, which is past target in the other direction — so it is a
   judgement about how the game feels, not a number to be optimised. Leigh's call is to play what
   is here first.
3. **Continental still completes one continent, not three** (known-issue **BO**). The world
   consolidates now, but the largest empire spreads rather than completing continents.
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
