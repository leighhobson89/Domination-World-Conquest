# battle

Rounds, and the outcomes the game is supposed to produce.

| Spec | Covers |
|---|---|
| `rounds.spec.js` | A battle opens with both sides listed, shows a probability in 0..100, only ever reduces both sides as rounds advance, never goes negative, and always ends in either a results screen or a continuing battle — never a dead end |
| `known-broken.spec.js` | The three behaviours that needed a *situation* rather than a fix: the cross-unit-type deadlock (§5.2 K), two concurrent sieges (§5.1 D), and the INVADE!-debit / retreat-return round trip (§5.1 AD). **Nothing in the file is `fixme` any more** |
| `rout.spec.js` | A rout captures the territory **and takes half the surviving defenders with it**, asserted exactly — and does it identically twice from the same seed |
| `outcomes.spec.js` | The other four terminal conditions: attacker wins, defender wins, last push (and its 20 % cost), and an even fight that settles nothing. Plus the regression test for a battle debiting its source territory twice |
| `mid-battle-decisions.spec.js` | Dig In and Reserves (overhaul B.7): hidden until a round has been fought, armed by a class, spent by the round they apply to, debited at once and arriving a round later |
| `ledger-and-log.spec.js` | The three panels that make the mechanic visible (B.6.3 / B.6.4 / B.6.7) — the attack window's dice preview, the force ledger, and the round log |
| `defender-playback.spec.js` | Watching a battle you DEFENDED (B.8) — including that the sides are REVERSED on screen, which is the assertion the whole feature stands on |

## The rule that used to shape this whole folder, and no longer does

**No spec here could assert an exact combat outcome.** Seeding `Math.random` was necessary but
not sufficient: `addSparklesRegularly()` re-armed a timer every 0–100 ms and burned **three**
draws per tick on the same global stream combat drew from, so how many cosmetic draws landed
between two combat draws depended on wall-clock timing and two runs of the same seed diverged
(audit §5.3 Y).

**Phase 5.8 closed it.** Cosmetic randomness lives in `src/platform/cosmeticRng.js` and never
touches `Math.random`. The canary — `bootstrap/e2e-hook.spec.js`'s "the same seed produces the
same world" — is green, and `rout.spec.js` and `outcomes.spec.js` assert exact outcomes.

`rounds.spec.js` and `known-broken.spec.js` still assert invariants, because for what they
cover the invariant is the more useful statement: totals only decrease, nothing goes negative,
the battle always reaches a screen rather than a dead end. That is now a choice.

## Reaching a chosen outcome is composition, not attrition

Worth knowing before writing another scenario here. An attacker big enough to win takes the
defender from about 13 % of its starting force to zero **in one step**, straight past the 5 %
rout band — so no amount of grinding lands in it. What does land in it is the *makeup* of the
defender: a naval unit is worth 20,000 personnel and a rifleman one, and
`chooseDefendingUnitTypeIndex()` engages its own type first, so a fleet sinks the defending
fleet before it touches the infantry. A defender of 100 ships and 2,000 infantry loses 99 % of
its combined force when the ships go down and still has 2,000 men standing. Every scenario in
`outcomes.spec.js` is built that way.

## Two things about the bottom bar that will bite a new spec

**"Inert" is `aria-disabled` plus an `is-disabled` class, never the `disabled` property.** The
battle container installs a CAPTURE listener that has to see every click over the window in order
to settle the dice, and a truly disabled control swallows the event. Two consequences here, and
both were regressions once:

- Playwright treats `aria-disabled="true"` as not actionable, so `BattlePage` presses these with
  `force: true` — the same thing the four stepper page objects do.
- `GameDriver.fightToResolution()` decides an attack has been destroyed by reading `aria-disabled`.
  It used to read `.disabled`, which is a question about the battle answered by a DOM property —
  the exact shape the B.6.6 state machine removed — and which stopped being true the moment the
  state moved off the element.

**Defender playback does not need a seed lottery.** `window.__game.queueDefence(record)` is the
same call `doAttack()` makes once it has fought the battle to its conclusion, and the record is the
whole input to the playback, so it bypasses the AI turn and nothing else. The fixture sets
`battlePlayback.alwaysSkip` for every spec — replaying an animation at the end of every AI phase
would add seconds to every spec that ends a turn — so a spec that wants to watch one calls
`window.__game.setAlwaysSkipPlayback(false)` first. That is the player's own setting, not a
harness-only path.

## Notes

- **There is one row of quantities, not two.** `armyRowRow1*` are the icons;
  `armyRowRow2Quantity1..8` are the numbers, 1–4 the attacker and 5–8 the
  defender. The defender's cells read `"12 / 30"` during a siege. Phase 6.8 gives
  them semantic ids.
- **`GameDriver.launchWholeGarrison()` and `fightToResolution()`** drive these specs. The
  allocation multiplier starts on **"All"**, so one press of the plus button commits the whole
  garrison — the next multipliers are x1, x10, x100 and x1k, which is not a practical way to
  field a fleet. The advance button walks `Begin War!` → `Next Round`, one round of dice per
  press, until a side falls below `BREAK_THRESHOLD`. **The first press starts the battle and does
  not fight a round** — easy to miss, and worth a failing spec when it was.
- **`#percentageAttack` is the ATTACK WINDOW's probability, not the battle's.**
  `setAttackProbabilityOnUI(probability, situation)` writes one or the other, and the attack
  window's element keeps whatever it last showed after the window closes — so reading it during
  a battle reported a stale 0 and any assertion on it was vacuous. The battle's is
  `#battleUIRow4Col1TextProbabilityTurnsSiege`; `BattlePage.probability()` reads that and
  `attackProbability()` reads the other.
- **`__game.battle()`** is the two armies as they stand, unrounded. The UI's own cells are
  formatted (`"1.9k"`), so an outcome defined arithmetically cannot be asserted from them.
