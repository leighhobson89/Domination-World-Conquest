# battle

Rounds, and the outcomes the game is supposed to produce.

| Spec | Covers |
|---|---|
| `rounds.spec.js` | A battle opens with both sides listed, shows a probability in 0..100, only ever reduces both sides as rounds advance, never goes negative, and always ends in either a results screen or a continuing battle — never a dead end |
| `known-broken.spec.js` | Four behaviours still `test.fixme`. Three of them — the rout threshold (§5.1 E), the cross-unit-type deadlock (§5.2 K) and two concurrent sieges (§5.1 D) — are **fixed in the code** by refactor Phase 3; what they lack is a way to reach the situation, which is the scenario loader (Phase 4). The fourth, retreat returning survivors, waits on §5.1 AD |

## The rule that shapes this whole folder

**No spec here may assert an exact combat outcome.** Seeding `Math.random` is
necessary but not sufficient: `addSparklesRegularly()` in `ui.js` re-arms a timer
every 0–100 ms and burns **three** draws per tick on the same global stream that
combat draws from, so how many cosmetic draws land between two combat draws
depends on wall-clock timing and two runs with the same seed diverge (audit §5.3
Y, e2e plan §2.2).

So the assertions are invariants — totals only decrease, nothing goes negative,
ownership transfers, the right screen appears. Exact survivor counts become
available when Phase 5.3 takes an injected RNG. **The canary is
`bootstrap/e2e-hook.spec.js`'s "the same seed produces the same world"**: when
that `fixme` starts passing, this folder can be tightened.

## Notes

- **There is one row of quantities, not two.** `armyRowRow1*` are the icons;
  `armyRowRow2Quantity1..8` are the numbers, 1–4 the attacker and 5–8 the
  defender. The defender's cells read `"12 / 30"` during a siege. Phase 6.8 gives
  them semantic ids.
- **Several plan specs are not here yet** — `attacker-wins`, `defender-wins`,
  `massive-assault`, `attacker-routed`, `fight-again`, `results-screen`. All of
  them need a battle to reach a *specific* terminal condition, which is a seed
  lottery on the live map. They arrive with the scenario loader (e2e plan §3.7, a
  Phase 4 deliverable), which is the point at which "defender reduced to 0" can be
  set up in one line instead of hoped for.
