# Game Design Document — Domination: World Conquest

**Status:** Reverse-engineered from the code at commit `b7ae0af`. This is a description of
**what the game currently is**, not a wish list. Where the code contradicts an obvious
intent, the intent is recorded under *Not implemented* or *Broken*.

**Legend**

| Mark | Meaning |
|---|---|
| ✅ | Implemented and appears to work |
| ⚠️ | Implemented but known-buggy — see [01-codebase-audit.md](./01-codebase-audit.md) §5 |
| 🚧 | Partially implemented / stubbed |
| ❌ | Designed or implied but not implemented |

---

## 1. Concept

A single-player, turn-based grand-strategy game of world conquest played on a real-world
political map. The player picks one country, then grows it into a world empire by managing a
four-resource economy across individual territories, building infrastructure and forts,
raising four kinds of army, and taking enemy territory by open battle or by siege — while
206 AI-controlled countries, each with a randomly generated leader and personality, do the
same.

It is *Risk-shaped* (territory adjacency, dice-like odds, conquest) but the economic layer,
per-territory resource management and siege mechanics take it much closer to a light 4X.

**Platform:** desktop web browser. **Players:** 1 human vs. up to 206 AI countries.
**Session model:** ~~one continuous session; there is no save~~ — the game autosaves to
`localStorage` every minute and can be saved to and loaded from a copyable code (refactor Phase
7.3), and can be restarted from the menu without reloading the page (7.2). There is still no
end and no victory screen; that is Phase 7.1.

---

## 2. The board

### 2.1 Territories ✅

- **359 territories** drawn as SVG paths in `resources/svgMaster.svg`, grouped into
  **207 countries** (a country owns 1–N territories).
- Per-territory static attributes baked into the SVG: `continent`, `isCoastal`,
  `mountainDefenseFactor` (0–N, drives mountain defence bonus), `originalOwner`
  (used by the AI's *reconquista* trait), `territory-name` (stable identity),
  `data-name` (current owning country — changes on conquest).
- **Area** is computed at load by sampling 80 points along each SVG path and scaling the
  total to 136,067,649 km². Territory area then drives resource yields and the defender's
  *area bonus* in battle.
- **6 continents**: Europe, North America, Asia, Oceania, South America, Africa.

### 2.2 Country data ✅

`initialData.js` gives each of 208 countries real-world figures: `startingPop`, `area`,
`startingArmy`, `continent`, `dev_index` (HDI, 0.4–0.95), and starting stock of
`res_gold`, `res_oil`, `res_food`, `res_cons_mats`. These are divided among a country's
territories in proportion to each territory's share of the country's total area.

### 2.3 Adjacency / reachability ✅⚠️

- `resources/closestPathsData.json` (19 MB) precomputes, for every territory, the list of
  territories reachable from it and the closest point-pair between them.
- `manualExceptionsForInteractions.js` hand-patches this with island add/deny rules
  (Fiji ↔ Vanuatu ↔ New Caledonia, Solomon Islands, etc.).
- ⚠️ The exceptions table is built behind a 1-second `setTimeout` race and silently
  collapses to nothing if the territory model is not ready in time.

---

## 3. Resources and economy

Every **territory** independently holds its own stock of each resource. Country totals are
just sums over owned territories, and spending is scoped to the territory you are spending in
(with a "borrow from your richer territories" fallback).

### 3.1 The four resources ✅

| Resource | Produced by | Consumed by | Capacity mechanic |
|---|---|---|---|
| **Gold** | Productive population × development index × continent modifier | Buying units, building upgrades | No cap |
| **Oil** | Territory area + starting reserves | *Demand* from assault/air/naval units | `oilCapacity`, raised 10 % per Oil Well |
| **Food** | Territory | Population + army (`foodConsumption`) | `foodCapacity`, raised 10 % per Farm |
| **Construction materials** | Territory area | Building upgrades | `consMatsCapacity`, raised 10 % per Forest |

**Regeneration toward capacity** (per turn, on the gap between stock and capacity):
oil **+30 %**, construction materials **+25 %**, food **+20 %**.
**Decay above capacity**: all three at **−10 %** per turn.

### 3.2 Population ✅⚠️

- `territoryPopulation` — total civilians.
- `productiveTerritoryPop` = `(territoryPopulation × 0.45) × devIndex` − army. This is the
  pool that generates gold *and* is spent as manpower when buying units.
- **Growth**: if food supports more than the current population + army, grow by
  `devIndex × currentPopulation × 0.1`, capped by the food headroom.
- **Starvation**: if food supports fewer, people die at a rate scaled by
  `(1 − devIndex) × 3` per 1,000 of shortfall — i.e. **less-developed territories starve
  harder**.
- ⚠️ The intended "starve the army rather than the civilians when the army is oversized"
  branch is disabled by a sign error (audit §5.1 F).

### 3.3 Oil demand gates your army ✅

Each assault/air/naval unit has a standing **oil demand** (assault 100, air 300, naval 1,000).
If a territory's oil stock cannot cover total demand, units become **not useable** — they
still exist and still count as population, but they cannot attack, defend or contribute to
combat strength. This is the game's most distinctive economic constraint.

### 3.4 Army maintenance 🚧

`calculateArmyMaintenanceCostPerTurn` exists (infantry 0.0005, assault 0.5, air 2.5, naval 10
gold per unit per turn) and is used **only** during initial army sizing at game start. The
per-turn call site is commented out at [resourceCalculations.js:583](../resourceCalculations.js#L583),
so **standing armies are currently free to maintain**. This removes the main brake on
military snowballing.

### 3.5 Continent modifiers ✅

Applied to gold income and, separately, to combat:

| Continent | Gold modifier | Combat modifier (attacker) |
|---|---:|---:|
| Europe | 1.0 | 0.98 |
| North America | 1.0 | 0.99 |
| Oceania | 0.8 | 0.75 |
| Asia | 0.5 | 0.87 |
| South America | 0.4 | 0.82 |
| Africa | 0.3 | 0.81 |

⚠️ Territory area is intended to factor into gold income but a misplaced parenthesis
(`Math.max(territory.area / 10000000), 1)`) makes that term evaluate to a constant `1`.

---

## 4. Units

### 4.1 The four unit types ✅

| Unit | Gold cost | Manpower cost | Oil demand | Counts as N people | Siege value |
|---|---:|---:|---:|---:|---:|
| Infantry | 10 | 1,000 | 0 | 1 | 0.0001 |
| Assault | 50 | 1,000 | 100 | 1,000 | 3 |
| Air | 100 | 5,000 | 300 | 5,000 | 5 |
| Naval | 200 | 20,000 | 1,000 | 20,000 | 10 |

`INFANTRY_IN_A_TROOP = 1000` — infantry are bought in troops of 1,000.

**Combined force** (used for battle strength and rout thresholds) is
`infantry + assault×1,000 + air×5,000 + naval×20,000`.

### 4.2 Buying units ✅

Via the **Buy** window on a selected owned territory during the Buy/Upgrade phase.
Quantity steppers with ×1 / ×10 / ×100 / ×1k multipliers, live affordability greying-out
against both gold and productive population, and running cost totals. If the territory alone
cannot pay, gold and manpower are drawn from the player's other territories
(`checkForMinusAndTransferMoneyFromRichEnoughTerritories`).

### 4.3 Initial army distribution ✅

At game start each territory's `startingArmy` is split across the four unit types by
`calculateInitialAssaultAirNavalForTerritory`, constrained by the territory's oil, and then
reduced if the resulting maintenance would leave the territory unable to earn a minimum of
10 gold per turn.

---

## 5. Territory upgrades

### 5.1 The four buildings ✅⚠️

| Building | Base gold | Base cons. mats | Effect | Max |
|---|---:|---:|---|---:|
| Farm | 200 | 500 | Food capacity +10 % | 5 |
| Forest | 200 | 500 | Cons. mats capacity +10 % | 5 |
| Oil Well | 1,100 | 200 | Oil capacity +10 % | 5 |
| Fort | 1,000 | 600 | Defence bonus | 5 |

Actual cost is `base × 1.05–1.1 × (devIndex / 4)`, so **more-developed territories build more
cheaply**. Cost does **not** scale with the number already built.

**Fort defence bonus:** `ceil(forts × (forts + 1) × 10) × devIndex + landlockedBonus`, i.e.
quadratic in fort count. `landlockedBonus` is +10 for non-coastal territories.

**Mountain defence bonus:** `mountainDefenseFactor × 10`, fixed per territory from the SVG.

⚠️ Capacity bonuses compound catastrophically on purchase (audit §5.1 A). This is the most
visible economic bug in the game.

### 5.2 Random starting forts ✅

`addRandomFortsToAllNonPlayerTerritories()` seeds AI territories with forts at game start so
the player does not face an undefended world.

---

## 6. Turn structure

### 6.1 The loop ✅⚠️

```
initialiseGame()
  └─ gameLoop()                       ← recurses forever, one level deeper per turn
       ├─ start-of-turn processing
       │    ├─ reactivate conquered territories whose lockout expired
       │    ├─ resolve one siege tick for every active player + AI siege
       │    ├─ increment siege turn counters, reconcile siege markers
       │    ├─ return armies from concluded wars (retrieval array)
       │    ├─ roll for a random event
       │    └─ apply per-turn economy to every territory
       ├─ Phase 0 — Buy / Upgrade     ← waits for click on #popup-confirm ("MILITARY")
       ├─ Phase 1 — Military          ← waits for click on #popup-confirm ("END TURN")
       ├─ Phase 2 — AI                ← every AI country takes its turn
       └─ currentTurn++ → gameLoop()
```

### 6.2 Phase 0 — Buy / Upgrade ✅

Click any owned territory → **Buy** and **Upgrade** windows become available. Purchase units,
build farms/forests/oil wells/forts. The **UI info table** (see §9) opens automatically at the
start of each turn if the player has left that option checked.

### 6.3 Phase 1 — Military ✅

Click an owned territory to see its reachable territories highlighted.

- Click **another owned territory** → the move-phase button reads **TRANSFER**.
- Click a **reachable enemy territory** → **ATTACK**.
- Click a territory **already under siege** → **VIEW SIEGE (n)**.
- A territory conquered in the last 1–3 turns is **DEACTIVATED** and cannot act.

### 6.4 Phase 2 — AI ✅⚠️

Runs headlessly for every AI country in sequence. Only the AI's **siege offers** surface to
the player, via the AI dialogue box (§8.4).

### 6.5 Turn-phase state ⚠️

Tracked twice — `ui.js:turnPhase` and `gameTurnsLoop.js:currentTurnPhase` — and reconciled by
hand. A frequent source of the UI being in a phase the game logic is not.

---

## 7. Combat

### 7.0 The attacker's advantage — **two dials, one per model** ✅

**There are two, and the split is permanent.** It used to be one, and the battle overhaul is what
made that impossible; the decision was taken at B.10.4 and the reasoning is recorded at both
constants in [src/config/balance.js](../src/config/balance.js).

| Dial | Value | Owns |
|---|---|---|
| `ATTACK_ADVANTAGE` | **1.44** | Sieges (`scoreDifferenceFor()`), and the pre-battle odds figure the attack window shows and the AI rates targets on |
| `DICE_ATTACK_ADVANTAGE` | **1.0** | Open battle — the `share` that picks the dice counts in §7.1 |

**Why they cannot be one number.** A dial multiplying a CONTINUOUS share moves the outcome
smoothly and proportionally. A dial multiplying a BANDED one moves it in whole dice — and a whole
extra die is an *unmatched* die, which is an automatic hit every round. At 1.44 a raw-even fight
came out four dice against three and the attacker took the territory **88.3%** of the time, which
is the opposite of what §7.2's tie rule is for. Re-cutting the bands cannot fix it: for a raw-even
fight to come out 4v4 one band must contain both 0.590 and 0.410, and a raw 1:2 attacker sits at
0.419 inside that same band, so it would get equal dice with a half-sized army. The band that
fixes 1:1 breaks 1:2.

Forcing them together the other way is no better: 1.0 everywhere strips 44% off every siege band
at once, making the slow option harder with no measurement behind it and removing a strategic
alternative rather than balancing it.

**So: if open battle needs to get easier or harder, `DICE_ATTACK_ADVANTAGE` is the number. If
sieges do, `ATTACK_ADVANTAGE` is.** A third dial is not allowed, and neither may reach into the
other's model.

The rest of this section is the history of `ATTACK_ADVANTAGE`, which is still worth reading
because it is the reason 1.44 is 1.44.

`ATTACK_ADVANTAGE` is a flat multiplier on **attacking** strength, currently **1.44**. It exists
because the world was not changing hands: forty headless turns of `tools/ai-sim.mjs` left 156 of 207 countries alive with about
two conquests a turn on a 359-territory map.

It has been raised twice, twenty per cent each time, **compounded rather than added** —
1.0 → 1.2 → 1.44. That is the arithmetic a multiplier implies: another twenty per cent on
top of an attack that was already twenty per cent better. It is why the number is 1.44 and
not 1.4.

The cause is structural rather than timidity on the AI's part. `defenseMultiplierFor()` takes
the **ceiling** of `(defenceBonus + mountainBonus) / 15`, so a single fort — or a mountain, or
the land-locked bonus — doubles a territory's defending strength outright. Most territories
have at least one of those, so most attacks are fought at two-to-one before a unit is counted.
The ceiling is load-bearing (it is what makes the *first* fort worth building), so rather than
unpick it the attacker is given a multiplier at the one point the two sides are compared.

**What "20 % easier" means here.** The multiplier improves the attack-to-defence **ratio** by
its own amount at every point on the scale. It is *not* a fixed number of points added to the
win probability. Because the probability is a share, `attack / (attack + defence)`:

| At 1.0 | at 1.2 | at 1.44 | |
|---|---|---|---|
| 25 % | 28.6 % | 32.4 % | a losing attack stays losing |
| 50 % | 54.5 % | 59.0 % | an even fight tilts |
| 75 % | 78.3 % | 81.2 % | a winning attack cannot run away with it |

That is the well-behaved form: it can never push a probability past 100, it cannot make a
hopeless attack look winnable, and raising the dial again is another proportional step rather
than another fixed number of points. Multiplying the *probability* would do all three of
those things wrong.

**Where it is read.** Exactly two places, one per form of attack:

| Form of attack | Function | File |
|---|---|---|
| Open battle | `winProbability()` — multiplies `attackingStrength` | [src/rules/military/probability.js](../src/rules/military/probability.js) |
| Siege | `scoreDifferenceFor()` — multiplies the besieging `siegeScore` before the defences come off it | [src/rules/military/siege.js](../src/rules/military/siege.js) |

Everything else follows from those two. `skirmishOdds()` is a function of the probability, so
every round of every battle moves. Every siege band — the hit roll, the destroy scale, the
collateral damage, the arrest — is a function of `scoreDifference`, so one multiplication
moves all four. The **AI needs no change at all**: it rates targets with the real probability
function and the real siege score, so its odds floors, budgets and posture thresholds
re-derive on their own.

**What it deliberately does not touch**, because these are not attack-versus-defence
comparisons and moving them would double-count:

- `siegeScore()` itself — that figure is shown to the player on the siege screen and is a
  fact about the army, not about the contest.

Two entries that used to stand here are **deleted**. `SKIRMISH_ODDS_CAP` (0.65) and
`battleOutcomeThresholds` belonged to the five-round skirmish model, which no longer exists (see
§7.1); they went with it at battle overhaul B.10.1. There is no per-exchange cap to reach for any
more — the dice bands are what stops a lopsided fight being a formality — and `BREAK_THRESHOLD` is
what measures an army against its own starting size.

**Measured.** `node tools/ai-sim.mjs --turns=40 --seed=baseline`, the same seed throughout:

| | 1.0 | 1.2 | **1.44 (now)** |
|---|---|---|---|
| Countries surviving after 40 turns | 156 | 153 | **145** |
| Largest empire | 50 | 49 | **52** |
| Conquests | 175 | 201 | **284** |
| Failed attacks | 128 | 154 | **179** |
| Sieges laid / won | 13 / 10 | 18 / 15 | **22 / 18** |
| Attack win rate | 58 % | 57 % | **61 %** |
| Idle player survives 40 turns | yes | yes | **eliminated on turn 21** |

The first step to 1.2 bought 15 % more conquests at a flat win rate — the AI's odds floors
let more marginal attacks through, so the extra conquests arrived with extra failures. The
second step to 1.44 is where the shape changes: conquests are up **62 %** on the original
and the win rate finally moves, because enough attacks have crossed from "below the floor"
to "worth making" that the average attack is a better one.

The last row is the cost and is worth watching. `ai-sim`'s player does *nothing at all* — it
never buys a unit, never reinforces, never defends — so being eliminated in 21 idle turns is
not the same as a real player being overrun, and `tests/e2e/turn-loop/long-run.spec.js` (ten
turns) still passes. But it is the first sign that the dial is being felt, and it is the
measurement to look at before any third step.

**Re-run this comparison after any change to this number.** The unit suite pins the rule but
cannot see the world failing to consolidate.

### 7.1 The dice model ✅

**Rewritten by the battle overhaul.** See [battle_overhaul.md](./battle_overhaul.md) for the
reasoning and the measurements; this is what the game does.

One press of the advance button is one **round**. A round is a dice comparison, not an attrition
simulation.

```
strengthAttack = Σ(units × personnelWorth) × DICE_ATTACK_ADVANTAGE
               × avg(attacker devIndex) × continentCombatModifier
strengthDefend = Σ(useable units × personnelWorth) × areaBonus
share          = strengthAttack / (strengthAttack + strengthDefend)
```

`share` picks the DICE COUNTS and nothing else. Fortifications are deliberately absent from it —
they are a die modifier instead, so nothing is counted twice.

| own share | dice |
|---|---|
| < 0.20 | 1 |
| 0.20 – 0.35 | 2 |
| 0.35 – 0.50 | 3 |
| 0.50 – 0.70 | 4 |
| ≥ 0.70 | 5 (defender capped at 4) |

**Modifiers**, all shown by name in the ledger. A *face* bonus adds to every die; a *dice* change
alters how many you roll, and only a dice change can answer an opponent's unmatched dice.

| Modifier | Side | Effect |
|---|---|---|
| Fortification (raw `defenceBonus + mountainBonus` ≥ 25 / ≥ 100) | attacker pays | −1 / −2 dice |
| Air superiority (holds air against none, or ≥ 3:1) | either | +1 face |
| No armour against armour | either | −1 face |
| Naval landing (coastal target, ≥ 25% naval) | attacker | +1 face |
| Dug in (consolidated last round) | either | +1 face |
| Siege grinding (per 3 turns besieged, cap +2) | attacker | +1 face |

Totals clamp at ±2.

### 7.2 Resolving a round ✅

Both sides roll, add their face modifier, sort descending and pair high against high. **Ties go
to the defender** — that is the defender's whole built-in advantage, worth roughly 17 points a
pairing, and it is why an even-strength attack fails about three times in four. Dice the other
side cannot match are **automatic hits**, which is what makes bringing more force matter once the
counts diverge.

Every lost pairing costs `PAIRING_CASUALTY_SHARE` (10%) of that side's **current** force,
compounded within the round and applied proportionally across the four unit types, with a floor
of one unit so no round can be free.

**Outcomes**, checked after each round's casualties against each side's own force at the start:

| Outcome | Condition | Result |
|---|---|---|
| Defender wiped | nothing left | Territory captured, survivors garrison it |
| Defender routed | below `BREAK_THRESHOLD` (20%) | Captured, **and half the surviving defenders join you** |
| Attacker wiped / broken | same test, other side | Attack fails |
| Last push **offered** | defender within 1.5× the threshold | One decisive round for 20% of the survivors — a choice, on its own button |
| Stalemate | `MAX_BATTLE_ROUNDS` (30) | Safety valve; should never fire |

There is **no round limit** and no "fight again" — continuous attrition is the war weariness.
A contested battle runs a median of 5 rounds.

Because the break test runs before annihilation can matter, **a garrison of any size is routed
long before it is wiped out**; wipeout is reachable only for a handful of units.

### 7.2a Mid-battle decisions ✅

The bottom bar carries `Retreat | Dig In | Reserves | Next Round | (Last Push!)`, sharing its
width between whichever are visible.

- **Dig In** forfeits the round's *offence* (not its dice — the side still defends), halves its
  casualties, and gives +1 next round.
- **Reserves** commits whatever the attack's original source territories still hold. Debited at
  once, arrives at the start of the next round.
- **Last Push** appears only while the offer stands, and can be declined — declining is how a rout
  is reached at all, since the band sits above the break threshold.

### 7.3 The dice on screen ✅

The rules roll the faces on the game's seeded stream. The physics then throws real dice from the
*cosmetic* stream, and each die's **mesh** is rotated by one of the 24 rotations of a cube so the
face landing upwards is the one the rules chose. The collision shape and trajectory are untouched:
a genuine tumble, decided in advance. A click settles them immediately.

The roll does **not** block the round: the numbers update the moment it resolves and the dice
tumble over the top of them, because gating a click on a render loop would put a second and a half
between a press and its result.

### 7.3a What the player is shown, and where ✅

Three panels, and all three are pure renders of what the model already computed — so the
explanation and the battle cannot disagree.

| Panel | Where | Shows |
|---|---|---|
| **Attack preview** | the ATTACK window, before INVADE! | The dice each side would roll, itemised by modifier, live as units are allocated — plus a forecast: the chance of taking it, the likely rounds, and the survivors if you win |
| **Force ledger** | the battle window, under the odds bar | The same itemisation for the round about to be fought, with the faces once it has been rolled |
| **Round log** | the battle window, collapsed | Every round fought, newest first: dice counts, faces, pairings won and lost, and what it cost both sides |

**Two numbers are shown and they are allowed to differ.** The bar is `winProbability()` — the
attacker's share of the two strengths, which decides how many DICE each side rolls. The forecast
line is `battleForecast()`, which answers the player's actual question by playing the whole battle
out five hundred times on a stream of its own. A 59% bar over a 24% fight is the honest picture;
showing only one of them, as the old window did, was not.

The forecast's rng is seeded from a stable hash of the SETUP rather than from the clock, so the
figure does not flicker while the plus button is held — and it never touches the game's stream, so
recomputing it on every keypress cannot change the battle that follows.

The bands are also what make the preview a lever rather than a readout: *"forty thousand more
infantry gets me a fourth die"* is a threshold the player can see coming. A continuous curve is
not.


### 7.4 Sieges ✅⚠️

A siege is a persistent object in `playerSiegeWarsList` / `aiSiegeWarsList`, keyed by
territory name, that ticks once per turn.

**Per-turn tick:**

1. `siegeScore = Σ(besieging units × siegeValue)` — naval 10, air 5, assault 3, infantry 0.0001.
   Sieges are therefore won with **hardware, not bodies**.
2. `difference = (siegeScore × ATTACK_ADVANTAGE) − (defenceBonus + mountainBonus)` — the one
   number the whole turn is scored on, and the only place a siege reads the dial in §7.0.
   `siegeScore` as *displayed* on the siege screen is the raw figure, without the multiplier.
3. `hitChance = 0.5 + difference / 1000`, clamped to [0, 1]. Rolled **10 times**; a majority
   of hits means the siege lands this turn.
4. On a hit, `difference` selects a destruction probability on a
   sliding scale (0 at ≤0, 0.3 at 20, 0.5 at 70, 0.7 at 130, 0.9 at 200, 1.0 at 280) and
   destroys 0–2 random buildings (fort / farm / forest / oil well).
5. **Collateral damage** always reduces the defender's `foodCapacity` by 1–25 % depending on
   `difference` — starving the defenders out is the real win condition of a siege.
6. If `difference` is negative and a 40 % roll fails, the besieging force is **arrested** —
   the siege collapses and the attackers are lost.

**Defender's escape:** if starvation would force the defender to starve their own army, the
game checks `checkIfWouldBeARoutAndPossiblyLeaveSiege` and can flip the siege into an
immediate rout victory for the besieger.

Sieges are shown on the map with a shield-and-keep marker and a dashed stroke. The marker is
drawn (`SIEGE_SHIELD_PATH` in `src/ui/icons.js`) rather than shipped as an image, and takes
its colour from the theme; an AI siege gets the same marker smaller and faded.

⚠️ A single siege that misses its hit roll aborts processing of every other siege that turn
(audit §5.1 D).

### 7.5 Post-conquest lockout ✅⚠️

A newly conquered territory is **deactivated for 1–3 random turns** (dashed red border,
button reads `DEACTIVATED (n)`) and cannot attack or transfer. ⚠️ AI territories are never
reactivated and the counters never clear (audit §5.1 N, O).

### 7.6 Army retrieval ✅

Units that survive a war but do not garrison the captured territory are returned to their
home territories after a delay, in the same proportions they were sent
(`retrievalArray`, processed at the top of each turn).

### 7.7 3D dice ✅

**Wired, and they mean something.** The long-standing "`dices.js` is fully implemented but its
call site is commented out" entry is closed — see §7.3 for how the physics and the rules are
reconciled. Two defects were fixed on the way: the collision shape was a 0.6 × 0.6 × 1.0 cuboid
under a cube mesh (faces 3 and 4 came up 6% each against 17%, χ² 738 over 3,600 rolls), and the
throw drew from `Math.random`, which is the game's stream.

**And they are no longer on the critical path.** The three committed UMD bundles that set `CANNON`,
`THREE` and the buffer utilities as globals — about 785 KB — used to load from `index.html` on
every page view, blocking the parser, for a canvas that stays empty until a battle opens.
`src/platform/vendor/diceRuntime.js` injects them on the FIRST dice roll of a session instead.
They stay classic scripts setting globals rather than becoming imports, because `index.html` loads
the game's entry modules against the SOURCE files and a bare-specifier import is something only a
bundler can resolve.

---


## 8. AI

### 8.1 Leaders and personalities ✅

Every AI country gets a randomly generated leader — title + name + suffix
(e.g. *Sultana Amina the Cunning*) — drawn from one of three archetypes:

| Archetype | Fortification | Economy | Territory expansion | Style of war | Reconquista |
|---|---|---|---|---|---|
| **Aggressive** | 0.0–1.0 | 0.1–0.5 | 0.8–1.0 | 0.7–1.0 | 0.1–0.4 |
| **Balanced** | 0.0–1.0 | 0.4–0.6 | 0.5–0.7 | 0.4–0.7 | 0.4–0.6 |
| **Pacifist** | 0.0–1.0 | 0.7–1.0 | 0.1–0.3 | 0.1–0.4 | 0.6–1.0 |

*style_of_war*: low favours sieges, high favours pressing an attack on unclear odds.
*reconquista*: how strongly the leader wants back territories it used to own
(`originalOwner`). The human player is given flat 0.5 traits.

### 8.2 Per-turn AI pipeline ✅⚠️

For each AI country, in order:

1. Seed a deterministic RNG from `(turn, countryName)` — `setAiRngContext`.
2. Build the list of territories in range, then the subset that is attackable.
3. Score every owned territory's defence (`retrieveArmyPowerOfTerritory`, oil-gated,
   defence-bonus-weighted).
4. For every enemy territory in range, compute a **threat score** against each owned
   territory: `enemyArmyPower − friendlyDefence`, then adjust by `reconquista` and
   `territory_expansion`. Non-adjacent pairs get a sentinel of `-9999999999`.
5. Turn threats into candidate goals — **Economy**, **Bolster**, **Attack**, **Siege** —
   then refine (deduplicate, merge similar, cap) and re-prioritise by personality.
6. Execute goals in order, at most one attack and one siege per originating territory per
   turn, capped at `MAX_AI_UPGRADES_PER_TURN = 5`.

### 8.3 AI actions ✅⚠️

- **Economy** — allocate gold and construction materials to upgrades, reserving a share for
  later goals in the same turn.
- **Bolster** — build forts, then buy units with the remainder.
- **Attack** — resolve the whole battle in one shot with a simplified model (no 5-round UI),
  then write survivors back and take the territory on a win.
- **Siege** — set up a standing siege object; if the target is already besieged by the player,
  open the dialogue in §8.4.

⚠️ Two loop-counter bugs (audit §5.1 B, C) mean Attack/Siege goals frequently resolve with
one of the two territories left as the string `"no match"`, which is then written back into
the game state.

### 8.4 AI dialogue — the gold offer ✅

The one place the AI talks to the player. When an AI wants to besiege a territory the
**player** is already besieging, it offers the player gold to lift their siege and withdraw.
The player accepts or declines in the AI dialogue box; on acceptance the gold transfers, the
player's siege is removed and the besieging army returns home.

This is the only diplomacy in the game and is a good seed for more.

### 8.5 Long-term AI goals ❌

`gameTurnsLoop.js` carries explicit TODOs for long-term goals ("destroy country X", "hold N
territories", "take continent Y") and for assessing whether a turn goal was achieved. Not
implemented — the AI is purely turn-local.

---

## 9. User interface

### 9.1 Screens and panels ✅

| Element | Purpose |
|---|---|
| **Main menu** | Resume Game, New Game, Save / Load, Options, Help ❌ (Help does nothing). Reachable during play by Escape or by the hamburger button at the top of the map |
| **Confirm dialog** | One reusable yes/no modal. New Game and a load over a running game both ask through it, because both destroy a game with no undo |
| **Save / Load panel** | The whole game as a copyable code, and a box to paste one back into |
| **Autosave indicator** | A spinner at the bottom right while the autosave writes; holds ~2 s, then fades. It is at the bottom because the top right is where the map chrome lives |
| **Country selection** | Countries above a strength threshold (40,000) are greyed out and unpickable; player picks a colour from a grid of 256 themed swatches, and the map repaints as each one is clicked |
| **Audio panel** | A music-note button at the top of the right-hand map chrome, above the continent-view button, opens it: play / pause, next track, and a volume slider and a mute for each of music and sound effects. It is on screen from the country-selection screen onward rather than from the first turn. Settings are saved with the game and remembered between sessions |
| **Options: sound** | The same two mutes, as on/off switches in the main menu's Options panel — the audio panel needs a map behind it, and the title screen has none. One setting seen twice: changing either moves the other |
| **Top table** | Player-wide totals: gold, oil, food, cons. mats, productive population, land area, army |
| **Bottom table** | Selected territory: flag, name, mountain defence, gold, oil, food, cons. mats, population, area, military |
| **Popup / confirm bar** | Phase title and the phase-advance button |
| **Move-phase button** | Context-sensitive: TRANSFER / ATTACK / VIEW SIEGE / DEACTIVATED / CANCEL / CONFIRM / INVADE! |
| **Buy window** | Unit purchase table with multipliers and live affordability |
| **Upgrade window** | Building table with caps and live affordability |
| **Transfer / attack window** | Per-territory army allocation table with multipliers; attack shows a live probability bar |
| **Battle UI** | Flags, per-type army counts for both sides, probability bar, Retreat / Advance / Siege |
| **Battle results** | Kills, losses, captured, survived, rounds, siege stats, Accept Victory / Defeat |
| **AI dialogue box** | Leader flag, name, offer text, accept/decline |
| **UI info table** | Four tabs — **Summary**, **Territories**, **Army**, **Wars & Sieges** |
| **Tooltips** | Extensive; explain every icon, row and disabled button |

### 9.2 Map modes ✅

- **Political** (default) — one colour per country, black strokes.
- **Physical** — continent colouring with white strokes; toggled by the map-mode button
  and auto-reverted on click.
- **Continent stroke highlight** — separate toggle.
- **Zoom** (mouse wheel, up to 6×) and **pan** (drag while zoomed), animated.

### 9.3 Feedback ✅

- Hover: territory lightens, tooltip shows the owning country.
- Click: the path "presses" (2 px shift + fill change) and is raised in z-order.
- Under-siege territories show a siege icon and a dashed stroke; besieged-by-AI icons are
  smaller and semi-transparent.
- Sparkle particles on the menu background; background music with toggle; click SFX.

---

## 10. Random events ✅⚠️

Each turn a rising probability counter (starts 0 %, +1 % per quiet turn, resets on fire) is
tested against the average of five `Math.random()` draws. When it fires, one of four events is
chosen:

| Event | Effect (50 % per territory) | Status |
|---|---|---|
| Food Disaster | Territory loses half its food | ✅ |
| Oil Well Fire | Territory loses 1/1.5 of its oil | ✅ |
| Mutiny | Territory loses 25 % of its gold | ✅ |
| Warehouse Fire | *(intended: construction materials)* | ⚠️ **Does nothing** — the handler checks for the string `"Forest Fire"`, which `selectRandomEvent()` never returns |

Population change is suppressed on an event turn so the player has a turn to react.

---

## 11. Not implemented

Things the game needs but does not have. Ordered roughly by how badly they are missed.

| # | Feature | Notes |
|---|---|---|
| ❌ 1 | **Win / lose conditions** | Nothing checks total conquest or player elimination. The game literally cannot end. |
| ✅ 2 | ~~**Save / load**~~ | **Done, refactor Phase 7.3.** Autosave to `localStorage` on a one-minute timer, restored through Resume Game on the next visit, plus an lz-string-compressed code the player can copy out and paste back. `src/state/snapshot.js`, `src/platform/storage.js`. Still a single slot — named slots are a bigger UI than this game needs, and the code is the escape hatch. |
| ✅ 3 | ~~**New game / restart**~~ | **Done, refactor Phase 7.2.** `TurnEngine.reset()` (Phase 5.7) made the teardown possible; the world is put back by loading a pristine snapshot captured at bootstrap. Restart is New Game, and New Game asks first when there is a game to lose. |
| ❌ 4 | **Per-turn army maintenance** | Implemented but the call site is commented out (§3.4). Removing the main economic brake on militarisation. |
| ❌ 5 | **Multiplayer / online** | Despite the repo name. No sockets, no server logic. |
| ❌ 6 | **Long-term AI goals** | TODOs only (§8.5). |
| ❌ 7 | **AI diplomacy beyond the siege gold offer** | No alliances, no trade, no non-aggression, no war declarations. |
| ❌ 8 | **Player-visible AI activity** | AI conquests happen silently; the player learns about them from the console. No news feed, no notifications. |
| ❌ 9 | **Continent control bonuses** | Continents exist as modifiers but holding one grants nothing. |
| ❌ 10 | **Technology / research** | `dev_index` is static; nothing raises it. |
| ❌ 11 | **Naval / air movement rules** | Naval and air are combat stats only; there is no sea movement, no range, no transport. Coastal-ness only gates whether naval counts. |
| ❌ 12 | **Help / tutorial / onboarding** | Help button is inert. No explanation of oil demand, sieges or useable units anywhere in-game. |
| ❌ 13 | **Difficulty settings** | AI aggression is per-leader random only. |
| ❌ 14 | **Sound for game events** | Only click SFX and background music. |
| ❌ 15 | **3D dice in battle** | Fully built, disabled (§7.7). |
| ❌ 16 | **Turn / battle history or statistics** | `historicWars` exists internally but is only surfaced in the Wars & Sieges tab. |
| ❌ 17 | **Mobile / responsive layout** | Fixed-pixel desktop layout throughout. |
| ❌ 18 | **Accessibility** | No keyboard navigation beyond Escape, no ARIA, no colour-blind mode (the player picks an arbitrary colour). |

---

## 12. Design tensions worth resolving before building out

These are judgement calls the current code makes implicitly, and they are worth making
explicitly before the refactor bakes them in.

1. **206 AI countries is a lot.** Every AI country runs a full threat/goal/action pipeline
   every turn. Consider consolidating into a smaller number of *powers* (8–16) that own many
   countries, with the rest as minor/neutral states. This would make the AI turn fast, the
   world legible, and diplomacy meaningful.
2. ~~**The 65 % skirmish cap**~~ — **resolved by the battle overhaul.** Skirmishes, the cap and
   like-vs-like pairing are all gone; a round is a dice comparison and the ledger shows the player
   exactly what each side rolls and why.
3. **Sieges dominate.** With no per-turn army maintenance and siege score driven by hardware,
   parking naval units on a siege is close to free and close to unstoppable. Restoring
   maintenance (§3.4) largely fixes this.
4. **There is no reason to stop expanding.** No supply lines, no unrest, no over-extension
   penalty, no continent bonus to aim for. Adding a single "cohesion" or "supply" pressure
   would give the economy something to push against.
5. **The player never sees the world change.** Largely addressed: the activity feed (Phase 7.4)
   reports what happened, and battle overhaul B.8 replays any battle the AI fought against a
   player territory before the player's turn begins.

---

## 13. Cross-references

- Defect detail and line numbers: [01-codebase-audit.md](./01-codebase-audit.md)
- Sequencing for fixes and restructuring: [03-refactor-plan.md](./03-refactor-plan.md)
- Functional areas and their test coverage: [04-e2e-test-plan.md](./04-e2e-test-plan.md)
