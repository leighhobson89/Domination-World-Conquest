# random-events

The four disasters, and the rising chance of one.

| Spec | Covers |
|---|---|
| `disasters.spec.js` | The chance climbs a point per quiet turn and resets to zero when an event fires; only the four shipped disasters can be queued; each of Food Disaster, Oil Well Fire, Warehouse Fire and Mutiny takes its own resource from at least one territory and corrupts nothing |

## Why this folder needed a new hook

A random event is a band on the **mean of five draws**, so no seed puts a chosen disaster on a
chosen turn — and the scenario loader sets up the *world*, not the *turn*. Without a way to
queue one, the four events could only ever be unit-tested as pure functions, and what the game
*does* with one — halving food, suppressing that turn's regeneration, taking a quarter of the
gold — would go untested entirely.

`window.__game.forceRandomEvent(name)` queues a named disaster for the next turn. Like every
other hook in `src/platform/testHooks.js` it exists only under `?e2e=1`, and it rejects any
name that is not one of the four — which is itself the audit §5.2 Q regression test.

## audit §5.2 Q, proven end to end

`selectRandomEvent()` can return `"Warehouse Fire"`, and the construction-materials handler
tested for `"Forest Fire"` — a name nothing ever produced. One of the four disasters did
nothing, and worse than nothing, because `randomEventHappening` still suppressed that turn's
regeneration and population change. It was fixed in Phase 3.14 and the fix has been carried by
unit tests since; `Warehouse Fire takes consMats from at least one territory` is the first
time it has been shown to work **in the running game**.

## Notes

- **The specs start as Japan (Hokkaido), not Germany.** Five territories make "the affected
  ones lose it" a real distinction instead of a single-territory tautology.
- **The arithmetic is not asserted here.** How much a disaster takes is
  `src/rules/events/randomEvents.js` and its unit tests. What this folder owns is that the
  event reaches the world, reaches the *right* resource, and leaves nothing negative or
  non-finite behind.
