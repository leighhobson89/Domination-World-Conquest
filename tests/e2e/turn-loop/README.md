# turn-loop

The spine. Everything else in the suite assumes these transitions are right, so
read a failure here before any other failure.

| Spec | Covers |
|---|---|
| `phase-transitions.spec.js` | `Buy / Upgrade -> Military -> AI -> Buy / Upgrade`; the phase title and button label at each step; the button is disabled for the whole AI phase and re-enabled after; three clean cycles |
| `turn-counter.spec.js` | `__game.turn()` increments once per full cycle, not per phase; turn 1 applies no income and turn 2 does |
| `start-of-turn-ui.spec.js` | The info panel auto-opens at the start of each turn while the checkbox is on, does not when off, and the preference survives turns |
| `phase-restrictions.spec.js` | Buy/upgrade only in Buy/Upgrade; transfer/attack only in Military; nothing clickable during AI |
| `long-run.spec.js` | **Ten consecutive turns with no player action**: no console errors, no `NaN` anywhere, turn counter correct, player keeps their territories, totals stay equal to the sum over them |

## Notes

- **`#popup-confirm` is the phase button.** It is the same element as the
  country-selection confirm — one button doing two jobs, dispatching on
  `selectCountryPlayerState`. Specs go through `GameDriver.endBuyPhase()` /
  `endTurn()` rather than clicking it, so the split in Phase 6.3 is a one-file
  change.
- **`endTurn()` waits on the turn counter, never on a timer.** An AI phase runs
  200+ countries and its duration is not predictable; `page.waitForFunction` on
  `__game.turn()` is the only stable signal.
- **Turn 1 applies no income on purpose.** `newTurnResources()` skips
  `calculateTerritoryResourceIncomesEachTurn()` when `currentTurn === 1`, because
  leaders and forts are created *after* `initialiseGame()` resolves (audit §5.3,
  bootstrap ordering). `turn-counter.spec.js` pins this so the eventual fix to the
  ordering is a deliberate change, not an accident.
- **`long-run.spec.js` asserts invariants, not values.** Seeding `Math.random`
  does not make the game deterministic while `addSparklesRegularly()` shares the
  global stream (audit §5.3 Y), so no exact economy figure is asserted anywhere in
  this folder.

## Out of scope here

- What the AI *does* on its turn — that is `ai-turn/` (P2, needs the scenario
  loader).
- Random events firing during the run; they are allowed to happen and the
  invariants must hold regardless. `random-events/` (P2) tests them directly.
