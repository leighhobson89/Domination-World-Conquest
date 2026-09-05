# goal-selection

The screen every new game now opens on, and the ending it makes possible. Goals and Victory,
Q4.2 — see
[docs/archived/05-goals-and-victory.md](../../../docs/archived/05-goals-and-victory.md).

| Spec | Covers |
|---|---|
| `chooser.spec.js` | The chooser opens on New Game before country selection; the scrim does not dismiss it; there is one button in the panel and it is Begin; Escape goes back to the main menu rather than past the screen; Confirm reaches country selection; a mid-game restart asks the question again |
| `goals.spec.js` | The dropdown offers exactly five goals; each shows its own summary and a rendered description; the scale list and its label change with the goal; World Conquest keeps a disabled one-entry dropdown; Great Powers names the five locked countries; the goal and scale confirmed are the condition the game runs under, including the frozen list of powers; the phase bar's progress line describes the chosen goal |
| `game-over.spec.js` | Nothing is decided while a game is being played; losing the last territory ends it once, at the turn that was being played; a decided game does not announce itself again every turn; New Game clears the previous game's ending |

## Why these are e2e and not unit tests

Almost all of this phase is unit-tested, deliberately, because almost all of it is pure:
`tests/unit/ai-victory.spec.js` measures every condition, `rules-victory-check.spec.js`
decides every outcome on a seven-territory world with no store, `ai-doctrine.spec.js` covers
one row per goal, and `ui-goal-catalogue.spec.js` pins the catalogue's shape and every scale
tier. **None of that is repeated here, and no spec in this folder asserts prose** — the same
arrangement `tests/e2e/dominapedia/` has with `topics.js`, and for the same reason: a spec
that matched on wording would be testing the phrasing twice and the behaviour not at all.

What needs a browser is what the pure layers cannot see:

- **that the choice is forced.** A modal with no Cancel is a claim about listeners, focus and
  a scrim, not about data;
- **that Confirm builds the right CONDITION.** This is the one mistake in the area that
  would be silent: a Domination game with its share written into `continentsRequired` is a
  perfectly valid condition object that plays as the default game, and nothing anywhere
  would say so. `conditionFor()` is the only place that mapping lives, and
  `"the goal and scale confirmed are the condition the game is played under"` is what says
  it is still the only place;
- **that the ending is WIRED** — one call in the turn engine's `endTurn` hook, before
  `advanceTurn`, latched.

## Notes

- **The ending is asserted as a COUNT, not as a flag.** The failure the latch exists to
  prevent is a decided game announcing itself again at the end of every subsequent turn, and
  no hook that reports only the most recent result can see it. `window.__game.gameOverEvents()`
  is the list of every `GAME_OVER` this game has emitted; `resetVictoryLatch()` clears it
  alongside the latch, which is why New Game starts empty.
- **Elimination is the ending these specs use, because it is the only one a scenario can
  reach.** The other four ask for whole continents, for 60% of the world's land area, or for
  two hundred turns. It is not a special case: `checkForVictory()` puts elimination first on
  purpose, because holding nothing is losing whatever you were playing for. The scenario is
  `tests/support/scenarios/player-eliminated.json`, and it works because **Germany is a
  single-territory country** — one `dataName` patch is the player's whole empire.
- **The scale `<select>` carries INDEXES, not values.** The DOM stringifies an option's
  value, so Domination's `0.6` came back as the string `"0.6"` and matched nothing in the
  tier list. A spec that wants a particular scale selects it by its LABEL, which is what
  `GameDriver.newGame({ goal, scale })` takes.
- **`GameDriver.newGame()` answers the chooser for the whole suite.** Every spec in every
  area starts a game, and none of them would reach the map otherwise; `confirmGoal()` is the
  same step for the handful of specs that click New Game themselves because the menu is what
  they are testing.

## Out of scope here

- What any page SAYS, and the order of the goals — `tests/unit/ui-goal-catalogue.spec.js`.
- Whether the five goals produce five different worlds. That is a hundred and fifty headless
  turns per goal and is `tools/ai-sim.mjs --goal=KIND`; the numbers are recorded in
  [docs/archived/05-goals-and-victory.md](../../../docs/archived/05-goals-and-victory.md) §5.
- The goal surviving a save — that is `tests/e2e/save-load/goal-survives-a-load.spec.js`,
  with the rest of the save/load wiring.
