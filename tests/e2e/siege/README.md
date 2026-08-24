# siege

Laying a siege, what a turn does to it, and the marker that says it is there.

| Spec | Covers |
|---|---|
| `start-siege.spec.js` | The Siege option is offered at or above `PROBABILITY_THRESHOLD_FOR_SIEGE` and withheld below it; choosing it converts the attack into a standing siege — the siege is in the store, `underSiege` follows, the marker appears, and the besieging army has already left its source |
| `siege-turns.spec.js` | `turnsInSiege` advances by exactly one per turn; the defender's food capacity is worn down, never below zero and never non-finite; nothing in the besieged territory goes non-finite or negative over several turns; the income suspension is characterised |
| `markers.spec.js` | Exactly one marker per besieged territory; it does not swallow the click on the territory it marks; the AI variant is the smaller faded one; nothing is orphaned when a siege ends |

## Three defects this folder was written against

- **The marker was drawn twice.** Phase 4.5 moved marker rendering to
  `src/ui/siegeOverlay.js`, driven by the store's `siegeChanged` event, and left the old
  imperative `addImageToPath(..., "siege.png", 1)` behind in the siege button handler — and
  the same again on the AI side in `aiCalculations.js`. Laying a siege produced **two
  `<image>` elements carrying the same `siegeImage_<name>` id**, of which only one was ever
  removed. Both call sites are gone; the marker is rendered from state.
- **The marker swallowed the click underneath it.** It had no `pointer-events: none`, so a
  hit test at the centre of a besieged territory returned the image rather than the path.
  Clicking the territory is the player's only route to `VIEW SIEGE`, so a besieged territory
  could not be opened at all. Same class of bug as `#tooltip`, which the page objects still
  work around.
- **The plan's siege-offer rule is inverted.** [docs/04-e2e-test-plan.md](../../../docs/04-e2e-test-plan.md)
  §5.9 says "when probability < 15 % the Siege button is enabled; at or above it is
  disabled". The shipped rule is the opposite, and so is the AI's — `ai/goals.js` pushes a
  Siege goal on `probabilityOfWin >= PROBABILITY_THRESHOLD_FOR_SIEGE`. A siege commits an
  army for many turns, so it is offered when there is a real chance of finishing it. The
  code and the AI agree with each other; the plan row is the one that is wrong, and
  `start-siege.spec.js` states the shipped rule.

## Notes

- **A siege is laid from inside the battle UI**, not from the attack window: INVADE! opens
  the battle, and `#siegeButton` ("Siege Territory") converts it. The button is disabled once
  the first round has been fought, so the choice is offered once.
- **The siege was laid during the Military phase**, so the game is already past Buy/Upgrade.
  `endTurn()` alone is one turn from there; `playTurn()` is two, because its `endBuyPhase()`
  advances a phase that has already been advanced. `siege-turns.spec.js` depends on the
  difference.
- **`__game.siegeAt(name)`** is the accessor for a live siege — whose it is, how long it has
  run, and both armies. `__game.sieges()` only answers *which* territories are besieged.
- **Do not assert that a besieged territory earns nothing** as though it were correct. It is
  a placeholder, logged for Phase 7 in
  [docs/05-known-issues.md](../../../docs/05-known-issues.md) §6, and the spec that pins it
  says so.

## Out of scope here, and why

- **`defender-starvation.spec.js`** from the plan — driving a besieged garrison to starve and
  flip into a rout takes many turns of a siege that the AI is simultaneously interfering with.
  The starvation arithmetic is a unit test (`tests/unit/rules-economy.spec.js`), which is
  where §4 of the plan puts formulas.
- **`arrest.spec.js`** — an arrest is a band on one number (the siege score minus the
  territory's forts and mountains) and a scenario that lands in it reliably needs the score
  arithmetic, which is `tests/unit/rules-siege.spec.js`. The *consequences* of an arrest are
  covered where they are visible: `turn-loop/start-of-turn-ui.spec.js` pins that an arrest the
  player is not party to raises no results screen.
- **`lift-siege.spec.js`** — pulling out is reachable now that the marker no longer eats the
  click, but it shares the retrieval-array path already pinned by
  `battle/known-broken.spec.js`.
