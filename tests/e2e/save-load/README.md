# save-load

Reaching the menu mid-game, starting over, and getting a game in and out of a string.
Refactor plan Phase 7.2 and 7.3.

| Spec | Covers |
|---|---|
| `menu-access.spec.js` | The hamburger appears with the game and disappears with the menu; it and Escape make the same two transitions; Resume is greyed out until there is something to resume; New Game asks before destroying a game in progress and does not ask when there is none; confirming really resets the world; the restarted game is playable |
| `goal-survives-a-load.spec.js` | The chosen goal and its scale survive a code; a Great Powers game restores the five names it froze; the progress line is right on the first frame of a loaded game; Resume from a stored save comes back to the same goal |
| `save-load.spec.js` | The panel offers a code as soon as it opens; a code taken before a turn restores the game to before that turn; a loaded game is wired up rather than merely restored; a foreign code and a damaged one give different messages; the autosave writes to `localStorage` and raises the spinner; a stored save offers Resume on the next visit |

## Why these are e2e and not unit tests

`tests/unit/state-snapshot.spec.js` already covers the data path — what a snapshot contains,
what a restore puts back, and the four ways a round trip can lose something while appearing to
work (the live `defendingTerritory` getter, the aliased collections, the `Set`s, a merge
instead of a replace). None of that needs a browser and none of it is repeated here.

What needs a browser is everything the snapshot cannot see: whether a loaded game is **wired
up**. A restore can put every number back correctly and still hand the player a dead screen —

- the phase button is invisible until something writes `opacity: 1` over it, and the thing that
  used to do that was the country-selection screen, which a loaded game never sees;
- the top table is *written*, not derived, so nothing repaints it on a state change and a load
  that forgets it shows the abandoned game's gold beside the restored game's map;
- the turn engine has to be stopped and started again, and a `reset()` that did not take leaves
  the phase button clicking into nothing.

Each of those passes every unit test. `"a loaded game is wired up, not just restored"` is the
spec that catches them, and it asserts on the screen and on the engine rather than on the store.

## Notes

- **`window.__game.saveNow()` exists because the autosave interval is sixty seconds.**
  Shortening the interval for the harness would mean the suite exercising a timing the game
  never uses. The hook takes the same save through the same code path and raises the same
  spinner. `saveCode()` / `loadCode()` are the panel's two buttons without the panel, for the
  specs that are about the round trip rather than about the textarea.
- **Restart is New Game.** There is no separate button, and these specs assert that: from the
  title screen New Game shows the country-selection screen with no prompt, and from inside a
  running game it asks first and then does the same thing over a reset world.
- **The pristine world is captured once, at bootstrap, and Restart loads it** — see
  `src/platform/storage.js`. One consequence is worth knowing when reading a failure: two new
  games in the same browser session get the same randomised starting gold, because the roll
  happens before the capture. The AI leaders and the starting forts are re-rolled, because they
  are generated after the game starts.
- **The chosen goal is durable state OUTSIDE the store**, so it rides in the `aiStrategy`
  save slice registered from `aiCalculations.js` rather than in the snapshot. A load that put
  every territory back and quietly resumed the DEFAULT goal would pass every assertion in
  `save-load.spec.js` — hence `goal-survives-a-load.spec.js`, which starts a second game under
  a different goal before loading, so a load that did nothing at all cannot pass by accident.
- **`clearStoredSave()` matters between specs.** Playwright gives each test a fresh context, so
  `localStorage` does not leak — but a spec that reloads the page inside itself is sharing one,
  which is exactly what the Resume specs rely on.
