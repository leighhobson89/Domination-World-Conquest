# Battle Overhaul — the Dice Round

Status: **COMPLETE. B.0 – B.10 are done and every checklist item is ticked.** Written 2026-09-04
from a full audit of the battle UI and the battle system, and from thirteen design decisions taken
with Leigh (recorded verbatim in §3).

This document is the spec and the phase order that replaced open battle. It supersedes
[02-game-design-document.md](./02-game-design-document.md) §7.1–7.3 and §7.7, which now describe
the dice model. The live tracker, with what each phase deliberately left out and why, is
[battle_overhaul_checklist.md](./battle_overhaul_checklist.md).

**Two decisions were Leigh's and both are settled** (B.10.4). Known-issue **AR** stays as it is
and its description was corrected instead — see §6 and the register. The two attack dials stay
two — see the note on `DICE_ATTACK_ADVANTAGE` in `src/config/balance.js`.

---

## 1. What exists today

### 1.1 There are two combat systems, not one

| Path | Resolver | Model |
|---|---|---|
| Player attacks | [battle.js:687](../battle.js#L687) `processRound` → [src/rules/military/battle.js:120](../src/rules/military/battle.js#L120) `resolveRound` | 5 rounds, per-unit skirmishes, `UNIT_MATCHUP_EFFECTIVENESS`, six outcomes |
| AI attacks (including on the player) | [aiCalculations.js:1475](../aiCalculations.js#L1475) `doAttack` | a `while` loop fighting to the death on combined force, one flat probability, chunked 1000/100/10/1 |

The AI's version has no rounds, no unit types, no matchup matrix, no rout, no last push, no
war weariness and no per-exchange odds cap. The only thing the two share is
[probability.js:81](../src/rules/military/probability.js#L81) `winProbability`.

**This is the largest structural finding in the audit.** The odds the player is shown are
produced by a model the AI does not use, so what the number means when *you* attack and what
it means when the AI attacks *you* are two different things. Everything downstream — the AI's
odds floors, `tools/ai-sim.mjs`, the balance measurements recorded in GDD §7.0 — is measuring
one of the two systems at a time.

### 1.2 The skirmish count is the felt problem

`totalSkirmishes = min(attackerUnits, defenderUnits)`, split over `BATTLE_ROUNDS = 5`
([battle.js:377](../battle.js#L377)). Garrisons run 10^5–10^6 personnel; the test scenarios
use 800,000 infantry for Germany. So:

- one press of Advance resolves up to ~200,000 individual RNG coin flips, each killing
  exactly one unit;
- five presses therefore annihilate the smaller army outright, and the six "outcomes" are
  mostly flavour on a foregone conclusion;
- nothing on screen explains any of it. The player watches six-figure numbers move.

The pairing count is in **units**, not personnel, and that asymmetry is severe. One hundred
naval units are 2,000,000 personnel but produce `min(100, 1000000) = 100` skirmishes in the
whole battle — twenty a round. The same force as infantry produces a million.

### 1.3 The dice are built and disconnected

[dices.js](../dices.js) is a complete Three.js + cannon-es physics roller: two dice, coloured
against the enemy's colour, the result read off the resting quaternion in
[dices.js:375](../dices.js#L375). Its one call site is commented out at
[battle.js:688](../battle.js#L688). `toggleDiceCanvas(true)` still fires on *Begin War!*
([ui.js:1484](../ui.js#L1484)) and shows an empty 800×600 container. The `dist/` UMD bundles
(~1 MB of THREE and CANNON) load on every page view to support it.

Three facts about it decide how it can be used:

- **`throwDice()` draws from `Math.random`** ([dices.js:440](../dices.js#L440)) — on the
  game's stream. As written, wiring it up would break every seeded outcome in the suite.
- **The physics decides the number.** It cannot be seeded reliably (float accumulation across
  `fixedStep`), so it can never be the source of truth for a deterministic battle.
- `document.querySelector(sel.canvas)` runs at module load and resolves to `null`
  ([dices.js:12](../dices.js#L12)); the real element is created later in `createCanvas()`.

### 1.4 What the player sees

[BattleUI.js](../src/ui/components/BattleUI.js) — five rows: flags and title, the probability
bar, eight army figures (four attacker, four defender), a defender stat strip (productive
population, food, fort defence, mountain defence), and three buttons.

The button state machine is ~180 lines inside `ui.js`'s `DOMContentLoaded`
([ui.js:1477](../ui.js#L1477)), switching on a module-level `advanceButtonState` of 0–3 and,
in two places, on the button's own **label** (`if (advanceButton.innerHTML === "Start Attack!")`).
Row 4's four stats are the only account of the odds the player is given, and nothing connects
them to the number in the bar.

### 1.5 Defects found in this pass, not already logged

| | |
|---|---|
| **`firstSetOfRounds` is a one-way latch** | Set `false` at [battle.js:793](../battle.js#L793) and never set back to `true` anywhere in the codebase. After the first battle in a session reaches a second set of rounds, every later battle takes the "End Round" branch at [ui.js:1517](../ui.js#L1517) for the rest of the session. |
| **An army array that is sometimes five long** | [battle.js:463](../battle.js#L463) and [battle.js:557](../battle.js#L557) do `defendingArmyRemaining.push(0)` / `.push(1)` to record a *defeat type*, read back as `defendingArmyRemaining[4]` in the retreat handler ([ui.js:1439](../ui.js#L1439)). A unit-count array carrying a discriminant in slot 4. |
| **Retreat writes territory state directly** | Three near-identical blocks from [ui.js:1399](../ui.js#L1399) set `infantryForCurrentTerritory` … and recompute `armyForCurrentTerritory` by hand, bypassing `state/mutations.js`. Every retreat is a state-guard violation, and the personnel formula is duplicated four times in the one handler. |
| **`battle.js` exports ~25 module-level `let`s of per-battle scratch** | `updatedProbability`, `defendingTerritory`, `skirmishesPerRound`, `attackingArmyRemaining` … all live bindings other modules read. Already noted in known-issues as a Phase 5.3 leftover; it is now a blocker, because a battle that can be watched, saved and replayed needs to be *state*. |

### 1.6 Already logged and directly relevant

- **AP** — the rout / last-push thresholds compare each side against its force as it stood at
  the **start** of the round, a full round of lag ([battle.js:766](../battle.js#L766)).
- **AR** — `areaBonusFor()` has a `min`/`max` slip
  ([probability.js:44](../src/rules/military/probability.js#L44)), so small territories get
  **no** defensive bonus and large ones are penalised — the reverse of the intent.
- `SKIRMISH_ODDS_CAP = 0.65` means a 10:1 attacker still loses a third of its exchanges
  (GDD §12.2).
- `dices.js` wired-but-uncalled, and `dist/` loading for it, is logged for Phase 7.9 as
  *"decide: wire it or delete it"*. **This document is that decision.**

---

## 2. What is wrong with it as a design

Stated plainly, so the new system can be judged against it:

1. **The player has no lever.** Committing more force changes a percentage. There is no
   readable relationship between what you send and what happens.
2. **The mechanic is invisible.** Two hundred thousand coin flips have no texture. Nothing
   distinguishes a round you won from a round you lost except the numbers being smaller.
3. **The modifiers are hidden.** Forts, mountains, development, continent, area and the unit
   matchup matrix are all real and all folded into one number with no breakdown.
4. **The dice are unused**, and the one thing in the game that would make randomness *feel*
   like randomness is sitting in a file with its call site commented out.
5. **Composition barely matters.** Unit types pair off, but the pairing count is in units, so
   army composition affects the battle mostly by accident of the unit/personnel ratio.
6. **There is nothing to decide mid-battle** except whether to stop.
7. **The AI plays a different game**, so none of the above is even consistent.

---

## 3. Decisions taken

Thirteen questions, thirteen answers. These are settled; the spec in §4 implements them.

| # | Question | Decision |
|---|---|---|
| 1 | What does one click resolve? | **One round of dice** |
| 2 | How long is a battle? | **5–8 rounds, roughly 15% of a force per round** |
| 3 | What does a die represent? | **A slice of the engaged force** (percentage, scale-free) |
| 4 | Force → dice? | **Capped ratio, 1–5 dice**; the underdog always keeps at least one |
| 5 | Ties? | **Defender wins ties — it *is* the terrain** |
| 6 | Unit types? | **Composition becomes named die bonuses**, one pooled roll per side |
| 7 | Dice presentation? | **3D roll, numbers pre-determined by the rules, skippable** |
| 8 | The AI's resolver? | **One resolver for the whole game, run headless for the AI** |
| 9 | Mid-battle decisions? | **Retreat, plus commit reserves** (and dig in) |
| 10 | How does a battle end? | **Break thresholds, no round limit** |
| 11 | Sieges? | **Stay attrition, but share the dice vocabulary** |
| 12 | Defending? | **You watch it play out, no input** |
| 13 | Pre-battle screen? | **The dice you will roll, itemised** |

---

## 4. The system

### 4.1 The shape of it

> One click is one round. A round is a dice comparison, not an attrition simulation. Force
> ratio decides **how many dice** you roll; terrain and composition decide **what each die is
> worth**; the dice decide **who wins each pairing**; each lost pairing costs a **slice of
> force**. Rounds continue until one side breaks.

### 4.2 Share — the one number the dice counts come from

```
strengthAttack  = combinedForce(attackers)
                × ATTACK_ADVANTAGE
                × avg(attacker devIndex)
                × continentCombatModifier

strengthDefend  = combinedForce(defenderUseableUnits)
                × areaBonus

share           = strengthAttack / (strengthAttack + strengthDefend)      // 0..1
```

`combinedForce` is unchanged: personnel-weighted (infantry 1, assault 1,000, air 5,000,
naval 20,000). This is deliberately the *same expression* as today's `winProbability` **minus
the fortification multiplier** — forts and mountains move out of the strength calculation and
become an explicit die modifier in §4.4, so nothing is counted twice.

**Measured at B.2, and the dial had to be split.** The plan originally said `ATTACK_ADVANTAGE`
reaches the battle by moving `share`. It does — but at 1.44 it moves it from 0.500 to 0.590,
which crosses a dice band, so a raw-even fight came out **4 dice against 3** and the attacker
took the territory **88.3%** of the time. A spare die is not a small edge: it is an *unmatched*
die, and unmatched dice are automatic hits (§4.5). A continuous probability absorbs a 44%
multiplier smoothly; a banded one amplifies it into a guaranteed casualty every round.

Re-cutting the bands cannot fix it. For raw-even to come out 4v4 one band must contain both
0.590 and 0.410 — and a raw 1:2 attacker sits at 0.419, inside that same band, so it would get
equal dice with a half-sized army. The band that fixes 1:1 breaks 1:2.

So the dice model runs on its own dial, `DICE_ATTACK_ADVANTAGE = 1.0`. It needs no thumb on the
scale, because in this model the defender's advantage is **ties**, worth about seventeen points
a pairing — far stronger than anything the old model gave a defender. `ATTACK_ADVANTAGE` is untouched at 1.44 and runs sieges and the pre-battle odds figure.

**They were NOT reconciled, and at B.10 that was made permanent.** B.5 measured the AI swap as
balance-neutral, which removed the pressure to retune and left the question standing on its own
merits — at which point the answer is that these are not two settings of one thing. A dial
multiplying a CONTINUOUS share moves the outcome smoothly; a dial multiplying a BANDED one moves
it in whole dice, and a whole die is an unmatched die, which is a guaranteed casualty. Both ways
of forcing them together are worse for the player: 1.44 everywhere returns open battle to an 88.3%
attacker win on an even fight, deleting the defender's tie advantage and the reason to fortify;
1.0 everywhere makes every siege band harder with no measurement behind it, removing the strategic
alternative rather than balancing it. So there are two dials, each owning one model, each
documented at its own constant. A third is not allowed, and neither may reach into the other's
model.

### 4.3 Dice counts

One band table, applied to each side's own share (`share` for the attacker, `1 − share` for
the defender), with the defender capped at 4:

| own share | dice |
|---|---|
| < 0.20 | 1 |
| 0.20 – 0.35 | 2 |
| 0.35 – 0.50 | 3 |
| 0.50 – 0.70 | 4 |
| ≥ 0.70 | 5 (defender: 4) |

Consequences worth stating:

- At even strength both sides roll **4**, and the defender wins ties — so an even-strength
  attack is a losing proposition, which is correct.
- The underdog **always keeps at least one die**. Overwhelming force guarantees maximum dice;
  it never guarantees a round.
- The bands, not a continuous curve, are what make *"forty thousand more infantry gets me a
  fourth die"* a real and visible threshold in the attack window.

### 4.4 Die modifiers — the itemised, actionable half

A modifier adds to **every die on that side**, and pairings are compared on modified values.
Each side's total is clamped to **±2**, because +1 is worth roughly seventeen percentage
points on a pairing and the list has to stay legible.

**Two kinds of modifier, and they are not interchangeable.** A *face* modifier adds to every
die on that side and improves the pairings you contest. A *dice* modifier changes how many dice
you roll, and it is the only kind that can answer an opponent's **unmatched** dice — which are
automatic hits and are untouched by any face bonus. That distinction was found by measurement,
not designed: with fortification as a face bonus, a 2:1 attacker took a fortress **100%** of the
time, because four dice against two is two guaranteed casualties a round and +2 on the
defender's two dice cannot touch them. Terrain that cannot be answered by terrain is not
terrain. As a dice penalty the same attack measures **84%**, over 5–8 rounds.

| Modifier | Side | Effect | Source |
|---|---|---|---|
| Fortification | attacker pays | **−1 die** at bonus ≥ 25, **−2** at ≥ 100 | raw `defenseBonus + mountainDefenseBonus` |
| Air superiority | either | +1 face | that side holds air and the other holds none, or ≥ 3:1 in air personnel |
| No armour against armour | either | −1 face | the opponent fields assault units and this side fields none |
| Coastal assault | attacker | +1 face | the target `isCoastal` **and** naval is ≥ 25% of the committed force |
| Dug in | either | +1 face | that side spent the previous round consolidating (§4.8) |
| Siege grinding | attacker | +1 face per 3 turns besieged, cap +2 | assaulting out of a siege (§4.10) |

Fortification deliberately does **not** go through `defenseMultiplierFor()`. That function takes
the ceiling of the bonus over 15, which CLAUDE.md records as load-bearing but odd: it makes a
single fort double a territory's defence outright. Fort defence is
`forts × (forts + 1) × 10 × devIndex`, so one fort is 20 and already "doubles" and two forts is
60 and already "triples" — reusing that ceiling charged an attacker a die for one fort and two
dice for two, and measured an even attack on a **single-fort** territory at a 1.1% take
probability. Banding on the raw number instead makes the progression follow the forts: one fort
is a nuisance, two is a die, three is a fortress.

`UNIT_MATCHUP_EFFECTIVENESS` is retired as a per-skirmish multiplier, and its intent — air
beats armour, armour beats infantry, infantry is poor against everything mechanised — is
re-expressed as the three composition rows above. The matrix survives in `balance.js` as the
data those rows are derived from, so the reasoning recorded on it is not lost.

**The split is the point.** Diffuse, always-on multipliers (development, continent, area,
`ATTACK_ADVANTAGE`) shape `share` and stay out of the list. Only things the player can *act
on* become named modifiers, because the attack window shows the list and every line has to
suggest something to do about it.

### 4.5 Resolving a round

```
attackerFaces = sort(roll(aDice)) descending, each + aMod
defenderFaces = sort(roll(dDice)) descending, each + dMod

contested = min(aDice, dDice)
for i in 0..contested-1:
    attackerFaces[i] >  defenderFaces[i]  ->  defender loses a pairing
    attackerFaces[i] <= defenderFaces[i]  ->  attacker loses a pairing   // ties to the defender

// dice the other side could not match are automatic hits
if aDice > dDice: defender loses (aDice - dDice) further pairings
if dDice > aDice: attacker loses (dDice - aDice) further pairings
```

The unmatched-dice rule is what makes scale bite. Without it a 5-versus-1 fight is one
pairing a round, and an overwhelming attack takes twenty rounds to land.

### 4.6 Casualties

Each lost pairing costs **`PAIRING_CASUALTY_SHARE` of that side's current force**, default
**0.10**, applied across the four unit types in proportion so composition is preserved, with a
floor of one unit of the largest surviving type so a force can always actually die.

**Measured** with `tools/battle-lab.mjs` at B.2 — 1,000 played-out battles per row, on
featureless ground unless the row says otherwise. This replaces the modelled table this section
originally carried, which was written before the dial and the fortification rule were corrected.

| matchup | dice | mods | takes it | rounds (p10–p90) |
|---|---|---|---|---|
| hopeless 1:4 | 2 v 4 | — | 0.0% | 4–5 |
| outmatched 1:2 | 2 v 4 | — | 0.0% | 4–5 |
| **even 1:1** | 4 v 4 | — | **24.1%** | 4–6 |
| favoured 1.5:1 | 4 v 3 | — | 88.1% | 4–7 |
| strong 2:1 | 4 v 2 | — | 100% | 4–5 |
| overwhelming 5:1 | 5 v 1 | — | 100% | 4–4 |
| even, one fort | 4 v 4 | — | 26.1% | 4–6 |
| even, fortress | 3 v 4 | — | 1.6% | 4–5 |
| **2:1 vs fortress** | 3 v 2 | — | **84.1%** | 5–8 |
| combined arms | 4 v 3 | +1/−1 | 99.7% | 4–5 |
| attacker has no armour | 4 v 4 | −1/0 | 4.5% | 4–5 |
| naval landing on a coast | 4 v 4 | +1/0 | 65.7% | 4–6 |

What to read out of it:

- **An even attack fails three times in four.** That is the design of §4.3 working: at equal
  force, with no terrain and no composition edge, the defender's tie advantage decides it.
- **A fortress is a real obstacle.** An even attack on one is 1.6%; it takes 2:1 to reach 84%,
  and that is the longest fight on the table at 5–8 rounds.
- **Composition is worth about as much as force.** Combined arms against a bare infantry
  garrison is a near-certainty at only 1.25:1 in personnel.
- **Round length is a median of 5 with a tail to 7**, against the 5–8 asked for in §3. Close
  enough to leave alone: pushing the median to 6 means lowering `PAIRING_CASUALTY_SHARE`, which
  lengthens every battle including the lopsided ones that should be over quickly.
- **The stalemate rate is zero everywhere**, which is the property `MAX_BATTLE_ROUNDS` exists to
  check. A non-zero rate here would mean a round that killed nobody.

### 4.7 How a battle ends

`BREAK_THRESHOLD = 0.20` of that side's force **at the start of the battle**, checked after
each round's casualties are applied — no lag, which closes known-issue **AP** by construction.

| Condition | Outcome |
|---|---|
| Defender wiped out | Attacker takes the territory, survivors garrison it |
| Attacker wiped out | Attack fails |
| Defender below `BREAK_THRESHOLD` | **Routed** — territory taken, `routCaptureShare` (½) of the defender's survivors absorbed |
| Attacker below `BREAK_THRESHOLD` | **Broken** — attack fails, survivors return through `retrievalArray` at a penalty |
| Defender at ≤ 1.5 × threshold and the attacker still strong | **Last push offered** — one all-in round takes the territory at `lastPushSurvivorShare` (−20%) |
| `MAX_BATTLE_ROUNDS` (30) reached | Stalemate; the attacker withdraws without penalty |

`WarOutcome.FIGHT_AGAIN` and `applyWarWeariness()` are **deleted**. Continuous attrition *is*
the war weariness, and a stalemate is no longer free because every round costs both sides.

The `MAX_BATTLE_ROUNDS` valve exists only to guard a pathological zero-casualty loop. If it
ever fires in `ai-sim`, that is a bug in the casualty floor, not a balance question.

### 4.8 Mid-battle decisions

The bottom bar carries between two and four controls depending on where the battle is:

```
Retreat | Dig In | Reserves | Next Round | (Last Push!)
```

- **Next Round** — advance a round. The default.
- **Dig In** — forfeit this round's OFFENCE, take `DIG_IN_CASUALTY_SHARE` (0.5) of normal
  casualties, and gain +1 next round. It is *armed* by a click and spent by the round it applies
  to, because a choice only means anything applied to a round. **It does not forfeit the dice.**
  Zeroing the dice count was tried and is strictly worse than not digging in at all: with nothing
  to answer the enemy's dice, every one of them becomes an unmatched automatic hit, and halving
  the casualties does not make up for taking four of them. The side still rolls and still defends;
  the pairings it *wins* inflict nothing.
- **Reserves** — commit whatever the attack's **original source territories** still hold. Debited
  immediately, the same rule INVADE! follows (audit 5.1 **AD**), and joins the fight at the start
  of the next round.
- **Retreat** — free at a round boundary; the scatter penalty applies only to a withdrawal taken
  after a round has been resolved.

**Reserves come from the front that launched the attack**, not from anywhere on the map. That is
what makes it one button rather than a second trip through the attack window mid-battle, and it
is defensible on its own terms: this is the reserve behind *this* offensive. The arrival delay is
the whole point — a reserve that arrived instantly would be a free top-up rather than a decision.

**The last push goes on the third button, never on Advance.** Putting it on Advance was the first
attempt and made it compulsory: Advance was the only way forward, so "offering" a push meant
taking one. That matters more than it sounds, because the last-push band sits directly **above**
the break threshold and is therefore crossed on the way to almost every rout — a mandatory push
would have deleted the rout ending from the game. Declining is the interesting half of the
decision: pay a fifth now, or roll on and maybe absorb half their surviving garrison instead.

### 4.9 What the attack window shows before you commit

Live, updating as units are allocated:

```
YOU                              THEM
 ⚀⚀⚀⚀   4 dice                    ⚀⚀⚀   3 dice

 force 2.1 : 1          +1        fortifications ×3   +1
 air superiority        +1        mountainous         +1
 no armour              −1        ties go to them

 +40,000 infantry  →  5 dice

 68% to take it · 4–6 rounds · ~230k survivors expected
```

The forecast line comes from `battleForecast()` (§5.1): five hundred headless simulations of
the whole battle on a **dedicated forecast RNG**, never the game stream, seeded from a stable
hash of the setup so the figure does not flicker as the player allocates.

### 4.10 Sieges

Sieges stay what they are — a slow per-turn squeeze, won with hardware, whose real win
condition is starving the garrison out. That is what makes them the right answer to a target
you cannot take, and turning them into slow battles would delete a strategic option.

What changes is the **vocabulary**, so the two halves of the war model read as one game:

- The siege screen rolls **visible dice** each turn: the siege train's dice against the
  fortress's, both derived from the existing `scoreDifferenceFor()` bands rather than from
  §4.2. The hit / destroy / collateral maths in
  [src/rules/military/siege.js](../src/rules/military/siege.js) is unchanged underneath; the
  dice are the *presentation* of `siegeHitProbability()` and `rollBuildingDestruction()`.
- **Siege grinding carries into the assault** as the attacker die modifier in §4.4 — the
  reward for patience, and the reason to lay a siege you intend to finish yourself.

### 4.11 Defending

When the AI attacks a player territory, the same battle window opens with the sides reversed
and **auto-advances** through its rounds, skippable at any point. No input: the AI moves in
its own phase, and a phase that waits on the player would stall the turn loop. The player sees
their garrison hold or break, and sees *why* — the same itemised modifiers.

This replaces the current behaviour, where the battle resolves invisibly inside `doAttack` and
the player is handed a results screen on top of the phase button.

### 4.12 The dice on screen

The rules pick the faces. The physics animates them. In that order, always.

**Settled by the B.0 spike (`tools/dice-spike.mjs`), and it is simpler than this document
originally proposed.** The plan asked for a pre-solved throw — searching for an impulse that
lands on the required faces. That search is unnecessary. A cube is invariant under the 24
rotations of its own symmetry group, so the physics never has to be steered:

1. Throw the dice however you like, drawing from `cosmeticRandom()` — off the game's stream.
2. Step the world to rest **headlessly** and read which faces landed up.
3. For each die, apply the cube rotation carrying its landed face onto the face the **rules**
   chose — to the **mesh only**, as a fixed offset from the body's quaternion.
4. Replay the identical throw with rendering on. The mesh offset shows the required faces, and
   the physics is bit-for-bit the throw already simulated, because nothing about the body
   changed.

No search, no rejection sampling, no visible swap, and the roll stays a real tumble rather than
an animation. Measured cost: **~6 ms for nine dice**, once per round.

**Two defects in `dices.js` that the spike found and that this makes load-bearing:**

- **The shipped dice are badly biased.** `createDice()` gives every die
  `new CANNON.Box(new CANNON.Vec3(.3, .3, .5))` — a 0.6 × 0.6 × 1.0 **cuboid** under a
  1 × 1 × 1 cube mesh. A square prism rests on one of its four long sides, so the two faces on
  the short axis come up a third as often as they should:

  | shape | 1 | 2 | 3 | 4 | 5 | 6 | χ² |
  |---|---|---|---|---|---|---|---|
  | shipped `Box(.3,.3,.5)` | 23.0% | 22.1% | **6.2%** | **5.9%** | 22.8% | 19.9% | **738.5** |
  | cube `Box(.5,.5,.5)` | 17.8% | 15.8% | 16.6% | 16.8% | 17.5% | 15.7% | **7.9** |

  (400 throws of 9 dice; 5 d.f., 11.07 is the p = 0.05 critical value.) The shape **must**
  become a cube — which is also what unlocks step 3, because a cuboid has only 8 rotational
  symmetries and cannot carry an arbitrary face onto an arbitrary target. A cube has all 24
  and can.

- **`world.fixedStep()` cannot be used outside a render loop.** It derives elapsed time from
  `performance.now()`, so in a tight headless loop it runs zero substeps and the world never
  advances. The first run of the spike reported a confidently wrong answer this way. The
  headless pre-run in step 2 must call `world.step(1/60)`.

Non-negotiables for the implementation:

- The tumbling draws from **`cosmeticRandom()`**, never `Math.random` — CLAUDE.md's rule, and
  the reason the seeded suite works at all.
- A click during the roll **skips to the result**; a preference remembers "always skip".
- Up to **nine dice** on screen (5 + 4), coloured per side, not the hard-coded two. Note that
  `throwDice()` starts each die at `(6, index * 1.5, 0)` — y is **up**, so nine dice would be a
  nine-high column dropped from twelve units. They have to be spread across the tray.
- Face values are fixed by the pips carved in `createBoxGeometry()`: **+Y = 1, +X = 2, +Z = 3,
  −Z = 4, −X = 5, −Y = 6.**
- Read the resting face by **rotating each face normal and taking the largest +Y component**,
  not by the euler-angle ladder in `addDiceEvents()` — that tests six angle windows on a 0.5
  radian tolerance and gives up when none matches ("landed on edge"). A dot product always has
  an answer, which matters because dice do come to rest leaning on each other.

**Fallback**, if the mesh-offset reveal ever looks wrong in motion: 2D SVG dice, ~300 ms, drawn
from theme tokens — which would also let the `dist/` bundles come off the page load entirely.

---

## 5. Architecture

### 5.1 New modules

| Module | Contents |
|---|---|
| `src/rules/military/dice.js` | Pure. `diceCountFor(share)`, `rollDice(n, rng)`, `resolvePairings(a, d, aMod, dMod)`. No game concepts at all. |
| `src/rules/military/battleModel.js` | Pure, rng injected. `beginBattle()`, `resolveBattleRound()`, `classifyBattleState()`, `applyCasualties()`, `modifiersFor()`. Returns new state; writes nothing. |
| `src/rules/military/forecast.js` | `battleForecast(setup)` — five hundred headless runs on a dedicated rng. |
| `src/state/battleState.js` | The live battle as store state, with a save slice. Replaces the ~25 module-level `let`s in `battle.js`. |
| `src/ui/battle/BattleWindow.js` | The bottom bar's controls (B.6.2/B.6.6): installs its five listeners ONCE and applies a spec. `BattleUI.js` still builds the window's elements; what moved here is everything that decided what the buttons say, whether they respond, how wide they are and what colour they go. |
| `src/ui/battle/buttonState.js` | Pure, unit-tested. `deriveBattleButtons(state)` and `battleBarWidths(spec)`. **One state, and the labels are derived from it** — there used to be two independent 0..n vocabularies for the same buttons, one deciding behaviour and one deciding the label, agreeing only by convention. |
| `src/ui/battle/AttackPreview.js` | The itemised dice preview in the ATTACK window (B.6.7, §4.9). Live as units are allocated, with the forecast under it. |
| `src/platform/vendor/diceRuntime.js` | Loads the three UMD bundles on the first dice roll (B.10.3), so `dist/` is off the critical path. |
| `src/ui/battle/ForceLedger.js` | The itemised dice-and-modifier panel of §4.9. A pure render of a `modifiersFor()` result. |
| `src/ui/battle/RoundLog.js` | The record of rounds fought, newest first (B.6.4). A pure render of `battle.records`. Collapsed by default and pinned as an overlay, so it costs one line of height and can never push the bottom bar off a window whose height is fixed. |
| `src/state/battlePlayback.js` | The queue of battles the player DEFENDED, waiting to be replayed (B.8). |
| `src/ui/battle/DefenderPlayback.js` | Replays one, sides reversed, on a timer. |
| `src/ui/battle/DiceStage.js` | Wraps `dices.js`. Takes **decided faces**, owns the skip. The roll does **not** block the round: the numbers update at once and the dice tumble over the top, because gating every click on a render loop would put a second and a half between a press and its result. |

### 5.2 Modules changed

- `src/config/balance.js` — a new `--- battle: dice ---` section: `DICE_SHARE_BANDS`,
  `DEFENDER_DICE_CAP`, `DIE_MODIFIERS`, `MODIFIER_CLAMP`, `PAIRING_CASUALTY_SHARE`,
  `BREAK_THRESHOLD`, `LAST_PUSH_BAND`, `DIG_IN_CASUALTY_SHARE`, `MAX_BATTLE_ROUNDS`,
  `RESERVE_ARRIVAL_DELAY`.
- `dices.js` — `Math.random` → `cosmeticRandom()`; the module-load `querySelector` fixed;
  `numberOfDice` becomes a parameter; faces become settable.
- `battle.js` — `processRound` becomes a thin adapter over `battleModel.js` in B.4 and is
  deleted in B.10. `handleWarEndingsAndOptions`'s five-branch switch collapses to the table in
  §4.7.
- `aiCalculations.js` — `doAttack` deleted; the AI calls the shared resolver.
- `ui.js` — the ~180-line button state machine moves into `BattleWindow.js`; the retreat
  handler's direct territory writes route through `state/mutations.js`.
- `src/ui/core/registry.js` — ids for the new window.
- ~~`tools/ai-sim.mjs` — a `--combat=` flag so old and new can be measured side by side.~~
  **Deliberately not built** (B.5.2). It existed to compare two models; there is only one now, and
  a flag to switch back would mean keeping the dead one alive — which is the drift the whole plan
  exists to end.
- `index.html` — the three `dist/` script tags come OUT (B.10.3). See `diceRuntime.js` above.

### 5.3 Deleted — **done at B.10.1**

**The whole of `src/rules/military/battle.js` is gone**, which is every function this section
named: `resolveRound`, `classifyOutcome`, `countPossibleSkirmishes`, `likeForLikeSkirmishes`,
`skirmishOdds`, `applyWarWeariness`, `chooseDefendingUnitTypeIndex`, `occupyingArmyFor` and
`WarOutcome` including `FIGHT_AGAIN`. Nothing imported it but its own spec. With it went the three
`balance.js` constants that served only it — `SKIRMISH_ODDS_CAP`, `BATTLE_ROUNDS` and
`battleOutcomeThresholds` — and the section of `tests/unit/rules-military.spec.js` that asserted
the old arithmetic. Nothing was relaxed on the way: those assertions described the old model, so
keeping them would have meant keeping it alive to satisfy them.

`firstSetOfRounds`, the `defendingArmyRemaining[4]` defeat-type discriminant and the four
hand-written copies of the `armyForCurrentTerritory` personnel formula went at B.4, as recorded
there. `UNIT_MATCHUP_EFFECTIVENESS` deliberately SURVIVES in `balance.js` as the data the three
composition rows in §4.4 are derived from, so the reasoning recorded on it is not lost.

**One correction to this section as it was written.** It listed `doAttack` as deleted. What was
deleted is the fight-to-the-death LOOP inside it — the second combat model. The function name
remains in `aiCalculations.js` and is now a thin adapter: debit the source, call `resolveBattle()`
headlessly, queue the record if the player was defending, and collapse the result to the pair its
callers expect. Renaming it would have been cosmetic churn across three call sites for no gain.

### 5.4 Constraints that hold throughout

- **Every rule runs in Node.** `src/rules/`, `src/ai/` and `src/engine/` import only from
  `src/config/` and `src/state/selectors.js`. `battleModel.js` takes its rng as a parameter.
- **No colour literal outside `:root` in `style.css`.** The dice, the ledger and the round log
  are theme tokens; new colours become tokens in `tokens.js`, the `:root` default, and all five
  non-default themes, in that order.
- **No bare-specifier imports.** THREE and CANNON stay globals set by `dist/` classic scripts.
- **Ids come from `registry.js`.** Never hand-written, and `tests/support/selectors.js` stays a
  derived view of it.
- **A `console.error` fails every e2e spec.** The 49 `console.log` calls in `battle.js` come
  out with the file in B.10, not in a sweep of their own.

---

## 6. Balance, and how it is judged

The AI's failures have no textual signature — nothing throws, every turn completes, and the
map quietly stops changing. So:

> **No constant in §4 ships on judgement. Every one is measured with `tools/ai-sim.mjs` on a
> fixed seed, before and after, and the result is recorded in GDD §7.0 beside the existing
> 1.0 → 1.2 `ATTACK_ADVANTAGE` measurement.**

**The B.5 measurement, and how it contradicted this section.** Swapping the AI onto the shared
model was predicted here to be an earthquake. It was not: over 60 turns on one seed, countries
surviving went 118 → 115, the largest empire 80 → 83, and the top-sixteen share 65% → 67%. No
retune was needed. The reason is worth keeping: the AI rates targets against odds floors and
mostly attacks where it is already strongly favoured, and the two models agree almost exactly on
a lopsided fight — they diverge only near parity, which is the region the AI avoids.

The measurements that matter: countries surviving, largest empire, share held by the top
sixteen, conquests per turn, failed attacks, sieges laid versus decided.

Two things to expect and not to panic about:

- **B.5 is a balance earthquake.** Replacing `doAttack` changes every AI conquest number in the
  game. The dice model is harsher on even fights than `doAttack` is — which fights to the death
  and so nearly always resolves — so the first measurement will very likely show fewer
  conquests and more failed attacks. `ATTACK_ADVANTAGE` and `PAIRING_CASUALTY_SHARE` are the
  two dials for it.
- ~~**Known-issue AR should be fixed here.**~~ **It was measured at B.2.6 and deliberately NOT
  applied; Leigh closed it as a design decision at B.10.4.** The premise of this bullet was wrong:
  AR is not a `min`/`max` slip that can be corrected in passing. The ratio is unbounded as area
  approaches zero and there is no cap anywhere, so the naive correction gives the smallest
  territory on the map a 1,047× defence bonus and would make most of the map untakeable. Even the
  most conservative capped form is a major balance change — over sixty turns on one seed the
  largest empire goes 80 → 33 and thirty more countries survive. `probability.js` is byte-for-byte
  unchanged; the register's description of AR was corrected instead, which is where the numbers
  now live.

---

## 7. Phases

> **Status: B.0 – B.10 are done, and every item in
> [battle_overhaul_checklist.md](./battle_overhaul_checklist.md) is ticked.** The four things that
> were outstanding at the previous checkpoint all landed at the end: the battle-window rewrite and
> its state-machine extraction (B.6.2 / B.6.6), the round log and the attack-window dice preview
> (B.6.4 / B.6.7), and an e2e for defender playback (B.8.4) — which turned out to be reachable
> after all, by queueing the RECORD rather than waiting for an AI country to attack a chosen
> territory on a chosen turn. Writing it found a real defect: B.8's Skip control was drawn but
> never wired. Both of Leigh's decisions are settled and recorded above.


House rules apply: **each phase ends with the game playable**, bug fixes stay separate from
moves and renames, and work is test-first.

### B.0 — Dice spike *(throwaway)*
Prove the pre-solved 3D roll of §4.12. Time-boxed. The output is a yes/no that decides B.6,
and a measurement of how long pre-solving nine dice takes. Nothing merges.

### B.1 — The pure model
`dice.js`, `battleModel.js`, the `balance.js` section. Unit tests only. **Nothing is wired.**
The game is unchanged and the old battle still runs.

### B.2 — Forecast, ai-sim, and the AR fix
`forecast.js`, and `tools/ai-sim.mjs --combat=dice` so the new model can be run over a hundred
headless turns against the old before any of it ships. Balance the constants here. Fix
known-issue AR as its own commit. Record the numbers.

### B.3 — Battle state into the store *(a move, no behaviour)*
`src/state/battleState.js` plus a save slice; the ~25 module-level `let`s in `battle.js` become
store reads. The **old** resolver still runs against it. This phase is deliberately
behaviour-free so a regression stays bisectable.

### B.4 — Swap the player's resolver
`processRound` becomes an adapter over `battleModel.js`. The existing window, the new maths,
unbounded rounds, break thresholds. Three fixes land with it because they are the same code:
`firstSetOfRounds`, the `[4]` defeat-type discriminant, and routing the retreat handler's
territory writes through `mutations.js`.

### B.5 — Swap the AI's resolver
Delete `doAttack`. The AI consumes the same `resolveBattle()` headlessly. Re-measure. Retune.
**One combat model in the game from here on.**

### B.6 — The new battle window
`BattleWindow`, `ForceLedger`, `RoundLog`, `DiceStage` (3D or 2D per B.0). Registry ids, theme
tokens, the button state machine out of `ui.js`. The attack window gains the itemised dice
preview of §4.9.

### B.7 — Reserves and dig in
The mid-battle decisions of §4.8, including the reserve debit and return path.

### B.8 — Defender playback
AI attacks on player territory open the window and auto-advance, skippable (§4.11).

### B.9 — Siege dice vocabulary
Visible dice on the siege screen; the siege-grinding modifier carried into the assault (§4.10).

### B.10 — Cleanup *(done)*
§5.3 deleted, and it was a whole file rather than a list of functions. Every `console.log` and
every colour literal is out of `battle.js` — the logs because what they narrated is now on screen
in the ledger and the round log, the literals because "inert" became a class. `dist/` came off the
critical path: ~785 KB of physics and rendering runtime is fetched on the first dice roll of a
session instead of on every page view. GDD §7, `05-known-issues.md` and `04-e2e-test-plan.md`
updated.

**Four things B.10 found that were not on its list**, all of them consequences of removing a
workaround rather than of the cleanup itself:

- **B.8's Skip control was never wired.** The label was written straight onto the advance button
  and the press fell into the battle state machine, doing whatever the last real battle had left
  behind. Found by writing B.8.4, which is the argument for writing it.
- **Two colour ladders in `ui.js` had no `else` branch.** A territory above 75% of its starting
  food or population left the field undefined, and `style.color = undefined` leaves whatever the
  last siege painted. It looked right only because `addRemoveWarSiegeObject()` seeded the field
  with a green literal on the way past — deleting that literal is what made the gap visible.
- **Six mouseover / mouseout listeners were fighting the stylesheet**, guarding on the `disabled`
  property while the buttons are made inert with a class. `:hover:not(.is-disabled)` in `style.css`
  already did the job; all six are deleted.
- **The harness read `.disabled` to decide an attack had been destroyed.** A question about the
  battle answered by reading a DOM property — the same shape as the label check the state machine
  removed. It reads `aria-disabled` now.

---

## 8. Testing

### 8.1 Unit — where nearly all the load should sit

`dice.js` and `battleModel.js` are pure with an injected rng, so exact outcomes are assertable
from the first phase:

- the share bands, including both boundaries of each band, and the defender cap;
- pairing resolution: ties to the defender, sorted-descending pairing, unmatched dice as
  automatic hits, modifier clamping at ±2;
- casualties: proportional across four unit types, the one-unit floor, and a force that
  reaches zero;
- break classification against each side's **own** starting force, with no round lag (AP);
- `battleForecast()` stability — the same setup returns the same figure, and consumes nothing
  from the game rng;
- `modifiersFor()` itemisation — every row in §4.4, present and absent.

### 8.2 e2e

`tests/e2e/battle/rounds.spec.js` currently asserts only invariants, with a comment explaining
that seeding was necessary but not sufficient. That is no longer true: with an injected rng and
`?seed=`, these specs **can** assert exact outcomes, and should.

New coverage: reserve commitment changes the dice mid-battle; dig in halves casualties; the
skip control; defender playback opens and auto-advances; the ledger's rows match the model.

New scenarios in `tests/support/scenarios/`: `overwhelming-attack`, `even-fight`, `fortress`,
`air-superiority`, `reserves-turn-the-battle`. Remember that a scenario must patch
`armyForCurrentTerritory` as well as the four unit counts.

The existing `test.fixme`s in `tests/e2e/battle/known-broken.spec.js` are reviewed at B.4 —
each is either unblocked or its comment updated to say what still blocks it. None is deleted.

### 8.3 Running them

Per the standing rule: single areas freely, up to three; four or more, or the full suite, only
after asking. `npm run test:unit` carries the load here by design — the model is pure, so
almost every assertion in §8.1 costs a second.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **B.5 changes every AI balance number in the game** | Measured before and after with `ai-sim` on a fixed seed; B.2 exists precisely so the model is tuned *before* it is wired to the AI |
| **The 3D pre-solve may not be fast enough for nine dice** | B.0 is a time-boxed spike whose only output is that answer; two documented fallbacks |
| **Saves holding an in-flight battle** | The autosave is already gated against firing during a battle, so only sieges carry war state across a save. Bump the snapshot version at B.3 and migrate siege records; a battle in progress cannot exist in a save file |
| **The dice re-introduce randomness onto the game stream** | `cosmeticRandom()` for the tumbling, a dedicated forecast rng, and `battleModel.js` taking its rng as a parameter. `bootstrap/e2e-hook.spec.js`'s "the same seed produces the same world" is the canary |
| **`dist/` stays at 1 MB on every page view** | Only if 3D wins the spike. Either way, B.10 evaluates deferring those classic script tags |
| **Scope creep into the economy** | Army maintenance (GDD §3.4) and supply/cohesion (§12.4) are *not* in this plan. They are the answer to "there is no reason to stop expanding", which is a different problem |

---

## 10. Cross-references

- Current behaviour: [02-game-design-document.md](./02-game-design-document.md) §7
- Defect register: [05-known-issues.md](./05-known-issues.md) — **AP**, **AR**, and the
  `dices.js` row under §6
- Harness and scenarios: [04-e2e-test-plan.md](./04-e2e-test-plan.md) §3.7
- The one dial: `ATTACK_ADVANTAGE` in [src/config/balance.js](../src/config/balance.js), and
  the measurement recorded in GDD §7.0
