# Battle Overhaul — implementation checklist

Working companion to [battle_overhaul.md](./battle_overhaul.md). One line per unit of work;
ticked as it lands. **Every phase must end with the game playable** — that is the constraint
the ordering exists to satisfy, not a nicety.

Legend: `[x]` done. **Every item is ticked** — B.0 through B.10 are complete, and the two
decisions that were Leigh's are settled and recorded where the code lives (see B.2.4 and B.2.6).

---

## B.0 — Dice spike *(throwaway, decides B.6)*

- [x] **B.0.1** Headless cannon-es rig in `tools/dice-spike.mjs` — floor, walls, N dice, throw, step to rest
- [x] **B.0.2** Read the landed face from the body quaternion (face-normal method, not the euler-angle chain in `dices.js`)
- [x] **B.0.3** Measure: how long does simulating 9 dice to rest take?
- [x] **B.0.4** Measure: is the face distribution uniform with the current collision shape?
- [x] **B.0.5** Prove determinism — identical initial conditions give identical faces
- [x] **B.0.6** Prove the relabelling approach: a cube-rotation table mapping any landed face to any target face
- [x] **B.0.7** Write the verdict into `docs/battle_overhaul.md` §4.12

**Verdict: PRE-SOLVE BY SEARCH IS NOT NEEDED — relabel instead.** See §4.12 of the plan, now
rewritten. Full findings in the header of `tools/dice-spike.mjs`.

---

## B.1 — The pure model *(nothing wired; the game is unchanged)*

- [x] **B.1.1** `src/config/balance.js` — new `--- battle: dice ---` section
- [x] **B.1.2** `src/rules/military/dice.js` — `diceCountFor`, `rollDice`, `resolvePairings`
- [x] **B.1.3** `src/rules/military/battleModel.js` — `beginBattle`, `modifiersFor`, `resolveBattleRound`, `applyCasualties`, `classifyBattleState`
- [x] **B.1.4** `tests/unit/rules-dice.spec.js` — bands, pairing, ties, unmatched dice, clamping
- [x] **B.1.5** `tests/unit/rules-battle-model.spec.js` — share, modifiers, casualties, break classification
- [x] **B.1.6** `npm run test:unit` green, and the game still boots unchanged

---

## B.2 — Forecast, ai-sim, and the AR fix

- [x] **B.2.1** `src/rules/military/forecast.js` — `battleForecast()` on a dedicated rng
- [x] **B.2.2** `tests/unit/rules-forecast.spec.js` — stability, and it consumes nothing from the game rng
- [x] **B.2.3** `tools/battle-lab.mjs` — headless matchup table, so the model can be judged without a browser
- [x] **B.2.4** Tune against the §4.6 targets. **Two design changes came out of this, both forced by measurement:**
  - `DICE_ATTACK_ADVANTAGE = 1.0`, separate from `ATTACK_ADVANTAGE`. At 1.44 a raw-even fight was won by the ATTACKER 88.3% of the time, because the dial crosses a dice band and a spare die is a guaranteed casualty. Re-cutting the bands cannot fix it. Reconciled back to one dial at B.5. **Leigh's call to confirm.**
  - Fortification is a **dice penalty on the attacker**, not a face bonus on the defender — a face bonus cannot answer unmatched dice, so a 2:1 attacker took a fortress 100% of the time. It also bands on the raw defence bonus rather than `defenseMultiplierFor()`, whose ceiling made one fort worth a whole die.
- [x] **B.2.5** ~~`tools/ai-sim.mjs --combat=` flag~~ — deferred to B.5 and **closed there without being built**, deliberately. See B.5.2: it existed to compare two models, there is only one now, and a flag to switch back would mean keeping the dead one alive
- [x] **B.2.6** Known-issue **AR** — **MEASURED, DELIBERATELY NOT APPLIED, and CLOSED at B.10.4 as a design decision.** Leigh's call: leave `probability.js` byte-for-byte as it is and correct the register's description instead, which is done. See below for the numbers behind it.

### B.2.6 — what the AR investigation actually found

`05-known-issues.md` records AR as a `min`/`max` slip in `areaBonusFor()`, implying a
one-character fix. It is not. The ratio `MAX_AREA_THRESHOLD / area` is **unbounded as area
approaches zero**, and there is no cap anywhere:

| | area | today | after a naive `min` → `max` |
|---|---|---|---|
| smallest territory | 167 km² | 1.00 | **1,047× defence** |
| median territory | 28,594 km² | 1.00 | 6.6× |
| p75 | 178,189 km² | 1.00 | 1.5× |

296 of 359 territories sit below the threshold, **248 would defend at more than 2× and 161 at
more than 10×**. The "fix" would make most of the map untakeable. The documented intent needs a
CAP that was never written, and choosing it is a design decision, not a correction.

Measured anyway, so the decision has numbers behind it. `tools/ai-sim.mjs --turns=60
--seed=ar-baseline`, with the correction capped at 2× before dampening (so at most a 1.5×
defence bonus — the most conservative form of the fix):

| | countries surviving | largest empire | top-16 share |
|---|---|---|---|
| today, AR bug present | 118 | **80** | 65% |
| capped AR fix | 148 | **33** | 52% |

Even the most conservative correction roughly **halves the largest empire** over sixty turns and
leaves thirty more countries alive. It is a major balance change, not a bug fix. Raw series in
`test-reports/ai-sim/ar-baseline.json` and `ar-capped.json`.

**The source is unchanged.** `probability.js` is byte-for-byte what it was; the trial was
applied, measured and reverted. Raw series in `test-reports/ai-sim/ar-baseline.json` and
`ar-capped.json`.

**DECIDED at B.10.4.** Leigh chose to leave the code and correct the documentation, which is what
`05-known-issues.md` now says: AR is recorded there as a design decision rather than a defect, with
the measurement attached, and CLAUDE.md carries a "do not fix it" note. What remains open is a
design question for a balance pass — whether a small-territory defence bonus is wanted at all and
what caps it — and it is no longer part of this overhaul.

---

## B.3 — Battle state into the store *(a move, no behaviour)*

- [x] **B.3.1** `src/state/battleState.js` + `registerSaveSlice("battleInProgress", …)`
- [x] **B.3.2** `setupBattle()` opens the battle in the store; `attackingArmyRemaining` / `defendingArmyRemaining` point at its arrays
- [x] **B.3.3** `closeBattle()` wired at the three endings — accept victory, retreat, convert to siege
- [x] **B.3.4** `tests/unit/state-battle-state.spec.js` — 15 tests, mostly about array identity
- [x] **B.3.5** Old resolver still ran against it; suite green at this point

**The one thing to know:** the army arrays are **fresh per battle, stable within one**.
`addRemoveWarSiegeObject()` puts them straight onto the siege object, so a siege aliases them —
one reused pair for the life of the page would mean the next battle silently rewrote the armies
of every siege still standing. `openBattle()` therefore **adopts** the arrays it is given rather
than copying, because resuming a battle from a siege deliberately passes the siege's own array.

---

## B.4 — Swap the player's resolver

- [x] **B.4.1** `processRound()` is `resolveBattleRound()` over the battle in the store
- [x] **B.4.2** Unbounded rounds — `BATTLE_ROUNDS`, `skirmishesPerRound`, `totalSkirmishes` and `skirmishesPerType` are gone
- [x] **B.4.3** Break thresholds replace the six outcomes; `legacySituationFor()` translates to the numbers `handleWarEndingsAndOptions()` still switches on
- [x] **B.4.4** `firstSetOfRounds` deleted — the one-way latch
- [x] **B.4.5** No army array is ever five long again (**two** sites, not one — see below)
- [x] **B.4.6** Retreat writes go through `state/mutations.js`, via a new `setTerritoryArmy()`
- [x] **B.4.7** The last push is an **offer** (advance-button state 4, "Last Push!"), not an automatic outcome
- [x] **B.4.8** Re-baseline `tests/e2e/battle/` — **DONE.** The area is 33/33 green as of B.10. The table below is the state it was in at the end of B.4, kept because it is the record of which assertions were about the OLD model and why each had to move; every one of them was re-tuned rather than relaxed:

  | spec | expected | got | why |
  |---|---|---|---|
  | attacker wins | `"Victory!"` | `"Massive Assault"` | the defender crossed the last-push band before being wiped, so the push was OFFERED. The snapshot reads "Germany **Conquers** France" — the attack succeeded |
  | defender wins | attackers `[0,0,0,0]` | `[0,0,0,1]` | the attacker was BROKEN at 20%, holding one ship, rather than annihilated |
  | last push | breaks below 15% | — | the band is `BREAK_THRESHOLD × LAST_PUSH_BAND` = 20–30% now |
  | evenly matched | "five rounds settle nothing" | — | there are no sets of five rounds |
  | rout | defender below 5% | — | one symmetric break threshold at 20% replaces the 5/15/10 trio |

  `rounds.spec.js` passes 5/5 and `known-broken.spec.js` 4/4. Since a `console.error` fails every
  e2e spec, that is positive evidence the new resolver runs clean — these are assertions about
  WHICH ending is reached, which is exactly what the overhaul changed. Each needs its scenario
  re-tuned so the intended terminal condition is the one reached, and the assertions rewritten
  against `BattleState` rather than the old six outcomes.

Notes worth keeping:

- `processRound()` now takes **no arguments**. The four it took were all module state or
  derivable from it, and the attack array was passed only so its first element could name the
  target — which is why ui.js had to build a synthetic one out of the siege record, twice.
- **B.4.5 was two bugs, not one.** The battle's defeat type (`push(0)` / `push(1)`, read back as
  `defendingArmyRemaining[4]`) is now `defeatType()` on the battle state. The second was worse:
  `siege.defendingArmyRemaining.push(1)` marked a siege as arrested, on a live array that
  outlives the turn and is read by the siege panel. It is `siege.arrested` now.
- `setTerritoryArmy()` computes `armyForCurrentTerritory` from the four counts it writes. The
  retreat handler had that personnel formula written out by hand **four times**, which is exactly
  how a territory ends up with a total that disagrees with its own units.

---

## B.5 — Swap the AI's resolver

- [x] **B.5.1** `doAttack()`'s fight-to-the-death loop deleted; the AI calls `resolveBattle()` headlessly with its own seeded rng
- [x] **B.5.2** ~~`tools/ai-sim.mjs --combat=` flag~~ — **not needed, and deliberately not built.** It existed to compare two models. There is only one now; a flag to switch back would mean keeping the dead one alive, which is the drift the whole phase exists to end.
- [x] **B.5.3** Measured with `tools/ai-sim.mjs --turns=60 --seed=ar-baseline`

**There is one combat model in the game from here on.**

| 60 turns, seed `ar-baseline` | countries surviving | largest empire | top-16 share |
|---|---|---|---|
| old `doAttack` loop | 118 | 80 | 65% |
| shared dice model | 115 | 83 | 67% |

**Essentially neutral, which was not what the plan predicted.** Section 6 warned that B.5 would
be a balance earthquake and that the dice model, being harsher on even fights, would show fewer
conquests. It does not, and the reason is worth recording: the AI rates targets against odds
floors and mostly attacks where it is already strongly favoured. The two models agree almost
exactly on a lopsided fight — both hand it to the attacker — and only diverge near parity, which
is the region the AI deliberately avoids. So no retune was needed.

`doAttack` returned a pair in which exactly one side was above zero, and
`recombineRemainingArmyAfterBattle()` reads `battleResult[0] > 0` as "the attacker won". The new
model can end with both armies alive (a rout or a break leaves survivors), so the result is
collapsed to that contract at the boundary rather than changing every caller. That collapse
discards the attacker's survivors on a failed attack — which is what the old loop did too, since
it ran until the attacking force hit zero.

---

## B.6 — The new battle window

- [x] **B.6.1** Registry ids — `battleLedger`, `battleLedgerAttacker`, `battleLedgerDefender`, `digInButton`, `reservesButton`
- [x] **B.6.2** `src/ui/battle/BattleWindow.js` + the pure `buttonState.js` under it — the bottom bar's controls, with the five listeners installed once. `BattleUI.js` still BUILDS the window's elements, which is the right split: this owns what they say and whether they respond
- [x] **B.6.3** `src/ui/battle/ForceLedger.js` — the itemised dice-and-modifier row
- [x] **B.6.4** `src/ui/battle/RoundLog.js` — a pure render of `battle.records`, newest first, collapsed by default
- [x] **B.6.5** `src/ui/battle/DiceStage.js` + a full `dices.js` rework
- [x] **B.6.6** The button state machine out of `ui.js` — and it was two machines, not one; see below
- [x] **B.6.7** Itemised dice preview in the ATTACK window (`src/ui/battle/AttackPreview.js`), live as units are allocated, with `battleForecast()` under it
- [x] **B.6.8** Theme tokens throughout; `ui-stylesheet` and `ui-theme` specs green

**What `dices.js` became.** The rules roll the faces on the game's seeded stream; the physics
throws real dice from the COSMETIC stream; each die's **mesh** is then rotated by one of the 24
rotations of a cube so the face landing upwards is the one the rules chose. The collision shape,
the trajectory and the resting pose are untouched — the player watches a genuine tumble whose
result was decided before it started. Three defects fixed on the way: the collision shape was a
0.6 × 0.6 × 1.0 **cuboid** (faces 3 and 4 came up 6% each against 17%, χ² 738), the throw drew
from `Math.random` (the game's stream), and the resting face was read by a ladder of euler-angle
windows that gives up when dice lean on each other. The stage is now built **once** — a fresh
`WebGLRenderer` per round would exhaust the browser's ~16 GL contexts inside two battles.

**What B.6.2 / B.6.6 turned out to be.** They were deferred out of the model swap so a
regression would stay bisectable, and doing them separately was right for a second reason: the
"~180-line state machine" was actually TWO machines over the same five buttons.
`advanceButtonState` held 0..3 and decided what a click DID; `setAdvanceButtonText(situation, …)`
took a different 0..7 and decided what the button SAID. Nothing tied them together — every call
site set one of each by hand, and they agreed only by convention:

```js
setAdvanceButtonState(2); setAdvanceButtonText(4, advanceButton);   // "accept", "Rout"
setAdvanceButtonState(2); setAdvanceButtonText(3, advanceButton);   // "accept", "Massive"
```

Two things fell out of that coupling and both are now gone. Case 5 of the label switch ("End
Round") was left in place after B.4 made it unreachable, with a comment saying it was kept
*because deleting it would shift the numbering of the cases either side* — a dead branch alive
purely by positional coupling. And the advance handler asked
`if (advanceButton.innerHTML === "Start Attack!")`: a question about the state of the battle,
answered by parsing the DOM, and one that could never be true because nothing ever wrote that
string.

There is ONE state now, in `src/ui/battle/buttonState.js`, which is pure and has 27 unit tests;
`BattleWindow.js` is the only thing that turns it into elements and the only thing that installs
the listeners. The handlers stayed in `ui.js` — opening a battle, resolving a round, garrisoning a
conquest are turn-loop work — but they branch on the state rather than on a label.

**B.6.7's preview shows two numbers and says which is which.** The bar is `winProbability()`, the
attacker's share of the two strengths, which decides how many DICE each side rolls. The forecast
line is `battleForecast()`, which plays the whole battle out five hundred times on a stream of its
own. They are allowed to differ — a 59% bar over a 24% fight is the honest picture, and showing
only one of them is what the old window did.

---

## B.7 — Reserves and dig in

- [x] **B.7.1** Reserve commitment, immediate debit, and arrival one round later
- [x] **B.7.2** Dig in — armed by a class, spent by the round it applies to
- [x] **B.7.3** `tests/e2e/battle/mid-battle-decisions.spec.js`, plus 9 unit tests on the state

Two things the implementation settled that the plan had left open:

- **Dig in does not forfeit the dice, only the offence.** Zeroing the dice count is strictly worse
  than not digging in: with nothing to answer the enemy's dice, every one of them becomes an
  unmatched automatic hit, and halving the casualties does not cover taking four of them.
- **The last push had to move off the Advance button.** On Advance it was compulsory — Advance was
  the only way forward — and because the last-push band sits directly above the break threshold,
  a compulsory push deletes the rout ending from the game entirely. It is the bottom bar's third
  button now, alongside Retreat and Next Round.

---

## B.8 — Defender playback

- [x] **B.8.1** AI attacks on player territory are recorded and replayed at the end of the AI phase
- [x] **B.8.2** Skip control, and an "always skip" preference in `localStorage`
- [x] **B.8.3** `tests/unit/state-battle-playback.spec.js` — the queue
- [x] **B.8.4** `tests/e2e/battle/defender-playback.spec.js` — 5 specs. **The premise that blocked this was wrong and it is worth saying how.** It does need an AI attack on a specific player territory on a specific turn, which is indeed a seed lottery — but nothing about the PLAYBACK needs the AI turn. `recordDefence()` is exactly what `doAttack()` calls once the battle is already fought, and the record is the whole input, because nothing is read back off the world when it draws (deliberately: by then the territory may have changed hands). So `window.__game.queueDefence()` bypasses the AI turn and nothing else, and the queue, the reversed sides, the ledger, the timer, the Skip control and the window's restoration afterwards are all exercised for real.

  **Writing it found a defect, which is the argument for writing it.** B.8.2's Skip control was drawn but never WIRED: the label was written straight onto the advance button and the press fell into the battle state machine, where it did whatever the last real battle had left behind. Skip is a mode of the bar's own machine now (B.6.6), so the press reaches the playback — and a real battle opened after a replay gets its whole bar back, rather than inheriting four hidden buttons.

**How it works, and why it is a queue.** `doAttack()` fights the battle to its conclusion and
applies it exactly as before; if the defender was the player, the RECORD is pushed onto
`src/state/battlePlayback.js`. `handleAITurn()` awaits `showQueuedDefences()` just before handing
the turn back. So the wait is on a TIMER, never on a click — a step that waited for input would
stall the turn engine, whose only sanctioned pause is `waitsForPlayer`.

**The sides are reversed on screen.** In the record the "attacker" is the AI; the player is
looking at their own garrison, so the ledger's YOU column is the record's defender. Getting this
backwards would be worse than not building it.

**The preference is the same one the player has.** `tests/support/fixtures.js` sets
`battlePlayback.alwaysSkip` for every spec, because replaying an animation at the end of every AI
phase would add seconds to every spec that ends a turn. That is the player's own setting rather
than a harness-only path.

---

## B.9 — Siege dice vocabulary

- [x] **B.9.1** The siege screen draws the same ledger, in the same dice vocabulary
- [x] **B.9.2** Siege grinding carried into the assault as a die bonus

**Presentation, not a second model.** `siegeHitProbability()` is the number a siege turn is
already scored on, and it is fed straight through the SAME band table open battle uses — so "four
dice against two" means the same thing on both screens. `src/rules/military/siege.js` is
untouched: a siege stays a slow per-turn squeeze, which is what makes it a different strategic
option rather than a slow attack.

B.9.2 needed one line that had been missed: `modifiersFor()` has supported a siege-grinding bonus
since B.1, but nothing passed `siegeTurns` into the battle, so it never fired. Resuming a battle
out of a siege now carries the besieger's turns of grinding with it (+1 per three, capped at +2).

---

## B.10 — Cleanup

- [x] **B.10.1** Delete plan §5.3 — and it was a whole FILE, not a list of functions
- [x] **B.10.2** The `console.log`s and the colour literals in `battle.js`
- [x] **B.10.3** `dist/` decided: it comes OFF the critical path
- [x] **B.10.4** GDD §7, `05-known-issues.md`, `04-e2e-test-plan.md`, CLAUDE.md and this document

**B.10.1 — the deletion was larger than the list.** Every function §5.3 named lived in one file,
`src/rules/military/battle.js`, and nothing imported it but its own spec — so the five-round
skirmish model went as a unit, along with the three `balance.js` constants that served only it
(`SKIRMISH_ODDS_CAP`, `BATTLE_ROUNDS`, `battleOutcomeThresholds`) and the section of
`rules-military.spec.js` that asserted the old arithmetic. **Nothing was relaxed on the way:**
those assertions described the old model, so keeping them would have meant keeping it alive to
satisfy them. `UNIT_MATCHUP_EFFECTIVENESS` deliberately survives as the data the composition
modifiers are derived from.

One correction to §5.3 as written: it listed `doAttack` as deleted. What was deleted is the
fight-to-the-death LOOP inside it. The name remains in `aiCalculations.js` as a thin adapter —
debit the source, call `resolveBattle()` headlessly, queue the record if the player was defending,
collapse the result to the pair its callers expect. Renaming it would be churn across three call
sites for no gain, and §5.3 now says so.

**B.10.2 — where the logs went, and why the literals were a bug.** Thirty-two `console.log` calls
came out. Nine of them fired PER ROUND, narrating the two armies unit by unit, the dice counts and
the pairings lost — all of which is now ON SCREEN, in the ledger and the round log. A battle
narrated only to the console is a battle the player cannot read, which is complaint two in §2 of
the plan. Four calls that report an anomalous state rather than narrating a normal one were kept
and promoted to `console.warn`; they are not `console.error`, because that fails every e2e spec and
these are conditions the game recovers from.

The colour literals were two separate defects wearing one coat:

- **Eleven `"rgb(128, 128, 128)"` writes meant "inert"** — a control's STATE recorded as a colour,
  which no theme could reach and nothing could read back. Six mouseover / mouseout listeners were
  fighting them, writing four more literals to do what `.retreatButton:hover:not(.is-disabled)`
  already does, and doing it wrong because each guarded on the `disabled` property while the
  buttons are made inert with a class. All of it is gone; `is-disabled` is the state and
  `style.css` owns the colours.
- **Six `"rgb(0,255,0)"` fields on the siege and war records were never read.** The siege panel
  writes the colour onto the TERRITORY and reads it back from there. Deleting them exposed a real
  latent bug: two of the ladders in `ui.js` that write those territory fields had no `else` branch,
  so a territory above 75% of its starting food or population left the field undefined and
  `style.color = undefined` leaves whatever the last siege painted. It looked right only because
  the deleted literal was seeding the field on the way past. Both ladders are total now.

**B.10.3 — the decision, and it is yes.** `index.html` loaded three UMD bundles (~785 KB of
CANNON, THREE and the buffer utilities) as blocking classic scripts on every page view, for a
canvas that is empty until a battle opens. `src/platform/vendor/diceRuntime.js` injects them on the
FIRST dice roll of a session instead; `rollDiceOnScreen()` awaits it, and the round has already
been decided by then, so the wait delays an animation and nothing else. `defer` was considered and
rejected: it fixes the parser blocking but the bytes still travel and still evaluate on the way to
the main menu, and the point of the item is that the cost is avoidable rather than mistimeable.
They stay committed classic scripts setting globals — CLAUDE.md's bare-specifier rule is why, and
that reasoning is recorded in the file.

---

## What B.10 found that was not on its list

All four are the same shape: a workaround being removed exposed the thing it was hiding.

| | |
|---|---|
| **The Skip control was never wired** | B.8 drew it by writing the label straight onto the advance button; the press fell into the battle state machine. Found by writing B.8.4 |
| **Two colour ladders had no `else`** | Above 75%, `style.color = undefined`. Hidden by the green literal B.10.2 deleted |
| **Six hover listeners fought the stylesheet** | Guarding on `disabled` while the buttons use a class. `:hover:not(.is-disabled)` already did the job |
| **The harness read `.disabled` to decide an attack was destroyed** | A question about the battle answered by a DOM property — the same shape as the label check B.6.6 removed. It reads `aria-disabled` now |
| **The Siege offer was decided BEFORE the bar was reset** | Caught by the full suite, and the most instructive of the four — see below |

**The ordering defect, because it is the shape to watch for when anything becomes derived.** The
INVADE! handler decided whether Siege Territory was offered, and *then* called `setupBattleUI()`.
That was correct for as long as `enableDisableSiegeButton()` wrote a colour straight onto the
element and nothing else ever touched it. Against a bar that is DERIVED from one state it is a
write the next line silently discards, because `setupBattleUI()` now resets the bar to the state a
fresh attack opens in — which includes no siege offer. The symptom was total: Siege Territory
inert on every attack, so a siege could not be laid at all, which took out eight specs in `siege/`
and one in `info-panels/`.

Worth stating plainly: **making state derived converts "two writers that happen not to collide"
into "last writer wins", and every existing call site is a candidate.** The unit tests could not
see it (the derivation is correct in isolation) and neither could the `battle/` area (it never
lays a siege). Only the full suite did.

---

## Verification

| | |
|---|---|
| Unit | **766 passed** (42 files) — +329 over the pre-overhaul baseline of 437. The count went DOWN by one file's worth at B.10.1 (28 tests of the deleted skirmish model) and up again by 27 for `ui-battle-buttons.spec.js`, the new pure state machine |
| Full e2e | **415/426**, 19m 40s, 1 skipped. All 10 failures were ONE production regression plus one inventory list: the Siege-offer ordering defect below (8 in `siege/`, 1 in `info-panels/`) and `bootstrap/e2e-hook`, which asserts the exact set of `window.__game` keys and had four new playback hooks to learn |
| After the fix | `siege` + `bootstrap` + `info-panels` re-run **73/73**; then `battle` + `attack` + `conquest-lifecycle`, which are the other areas driving the INVADE! path the fix moved, **53/53** |
| `battle/` area | **33/33** — 17 specs at the B.9 checkpoint, 33 now: `ledger-and-log.spec.js` (7) and `defender-playback.spec.js` (5) are new, and the rest were re-run after the bar was rewritten |
| Lint | **79 errors / 279 warnings**, against a recorded baseline of 81 / 290. Both DOWN: the dead locals the cleanup exposed were removed rather than left, since they were created by these edits rather than inherited |
| Build | clean |

**One real defect the full run caught**, and it is the kind only an end-to-end run finds: the
last push was charged **twice** — `resolveLastPush()` took `lastPushSurvivorShare` off the
attackers, and then `handleWarEndingsAndOptions()` case 3 took it off again when it garrisoned
the territory (600 survivors became 384 instead of 480). Situation 3 is reached from
`takeLastPush()` and nowhere else, so the fix was to let the model own the arithmetic and have
the legacy branch garrison what survived.

**A process note worth keeping.** One earlier run of the battle area reported nine failures that
were entirely an artefact: a previous run had timed out leaving its preview server on 4173, and
Playwright's `reuseExistingServer` meant the next run tested that stale build — which happened to
contain a bootstrap crash. `rounds.spec.js` regressing was the tell, since it had passed minutes
before. **Free 4173 before trusting any e2e result taken after an edit.**

## Progress

| Phase | State |
|---|---|
| B.0 | **done** |
| B.1 | **done** |
| B.2 | **done**, including B.2.5 (closed at B.5 without being built) and B.2.6 (measured, decided, not applied) |
| B.3 | **done** |
| B.4 | **done**, including B.4.8 |
| B.5 | **done** |
| B.6 | **done**, including B.6.2 / B.6.4 / B.6.6 / B.6.7 |
| B.7 | **done** |
| B.8 | **done**, including B.8.4 |
| B.9 | **done** |
| B.10 | **done** |

**Eleven phases of eleven. The overhaul is complete and every item above is ticked.**

What that means in the game, stated plainly, because the checklist is a poor summary of it:

- **There is ONE combat model**, and the player and the AI fight the same battle. The two systems
  §1.1 of the plan opens with are one system; the five-round skirmish model is deleted, not merely
  unreached.
- **One press is one round**, and the round is legible. Force picks the dice, terrain and
  composition are named modifiers, ties go to the defender, and every one of those is on screen by
  name — before you commit, during the round, and afterwards in the log.
- **There is something to decide mid-battle** other than whether to stop: dig in, commit reserves,
  or take the last push. All three are decisions with a cost rather than free options.
- **The dice are wired and they mean something.** They show the numbers the RULES chose, on a
  genuine tumble, and they no longer cost 785 KB on every page view.
- **Defending is something you watch** rather than a results screen handed to you.

Two things this deliberately did NOT do, both recorded so they are not mistaken for oversights:
army maintenance and supply/cohesion (GDD §3.4, §12.4) are the answer to "there is no reason to
stop expanding", which is a different problem; and known-issue AR stays as it is, because
correcting it is a balance change rather than a bug fix.
