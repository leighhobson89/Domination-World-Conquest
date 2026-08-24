# battle

Rounds, and the outcomes the game is supposed to produce.

| Spec | Covers |
|---|---|
| `rounds.spec.js` | A battle opens with both sides listed, shows a probability in 0..100, only ever reduces both sides as rounds advance, never goes negative, and always ends in either a results screen or a continuing battle — never a dead end |
| `known-broken.spec.js` | The three behaviours that needed a *situation* rather than a fix: the cross-unit-type deadlock (§5.2 K), two concurrent sieges (§5.1 D), and the INVADE!-debit / retreat-return round trip (§5.1 AD). **Nothing in the file is `fixme` any more** |
| `rout.spec.js` | A rout captures the territory **and takes half the surviving defenders with it**, asserted exactly — and does it identically twice from the same seed |
| `outcomes.spec.js` | The other four terminal conditions: attacker wins, defender wins, last push (and its 20 % cost), and an even fight that settles nothing. Plus the regression test for a battle debiting its source territory twice |

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

## Notes

- **There is one row of quantities, not two.** `armyRowRow1*` are the icons;
  `armyRowRow2Quantity1..8` are the numbers, 1–4 the attacker and 5–8 the
  defender. The defender's cells read `"12 / 30"` during a siege. Phase 6.8 gives
  them semantic ids.
- **`GameDriver.launchWholeGarrison()` and `fightToResolution()`** drive these specs. The
  allocation multiplier starts on **"All"**, so one press of the plus button commits the whole
  garrison — the next multipliers are x1, x10, x100 and x1k, which is not a practical way to
  field a fleet. The advance button walks `Begin War!` → `Next Skirmish` ×5 → `End Round` →
  `Start Attack!`, so a round of five costs about seven clicks.
- **`#percentageAttack` is the ATTACK WINDOW's probability, not the battle's.**
  `setAttackProbabilityOnUI(probability, situation)` writes one or the other, and the attack
  window's element keeps whatever it last showed after the window closes — so reading it during
  a battle reported a stale 0 and any assertion on it was vacuous. The battle's is
  `#battleUIRow4Col1TextProbabilityTurnsSiege`; `BattlePage.probability()` reads that and
  `attackProbability()` reads the other.
- **`__game.battle()`** is the two armies as they stand, unrounded. The UI's own cells are
  formatted (`"1.9k"`), so an outcome defined arithmetically cannot be asserted from them.
