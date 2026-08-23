# Bootstrap

Page load through to a playable turn 1: how fast it happens, that it happens once,
and that the `?e2e=1` harness surface exists for every other category to build on.

| Spec | Covers |
| --- | --- |
| `cold-start.spec.js` | Time from navigation to a clickable **New Game**, and from **New Game** to turn 1; that the adjacency data is fetched exactly once and the 19 MB source file never at all; that territory areas come from the precomputed file rather than being sampled; that the player receives their country's territories and the map is actually coloured |
| `e2e-hook.spec.js` | `window.__game` present only with `?e2e=1`, its exact API surface, readiness signalling, territory/totals/siege/war accessors, snapshot isolation, and the seeded `Math.random` installed by `?seed=` |

## Why the timings are asserted here and only here

Two specs assert wall-clock budgets. They are meaningful only with the machine to
ourselves, so they `test.skip` unless the run is single-worker, and the runner pins
this category to one worker:

    npm run test:e2e:perf

Under the default four workers the same page takes roughly four times as long —
that is contention between four Chromium instances building a 359-territory model
against one preview server, not a regression.

## Known gaps

`the same seed produces the same world` is `test.fixme`. Seeding `Math.random`
globally cannot make this game deterministic: `addSparklesRegularly()` in `ui.js`
re-arms a timer every 0–100 ms and burns three `Math.random()` calls per tick on the
same stream the economy and combat draw from. The fix is an injected RNG for game
logic in refactor Phase 5. **Until it passes, no spec anywhere may assert an exact
combat or economy outcome across runs.**
