# Bootstrap

Page load through to a playable turn 1: how fast it happens, that it happens once,
and that the `?e2e=1` harness surface exists for every other category to build on.

| Spec | Covers |
| --- | --- |
| `cold-start.spec.js` | Time from navigation to a clickable **New Game**, and from **New Game** to turn 1; that the adjacency data is fetched exactly once and the 19 MB source file never at all; that territory areas come from the precomputed file rather than being sampled; that the player receives their country's territories and the map is actually coloured |
| `e2e-hook.spec.js` | `window.__game` present only with `?e2e=1`, its exact API surface, readiness signalling, territory/totals/siege/war accessors, snapshot isolation, and the seeded `Math.random` installed by `?seed=` |
| `page-load.spec.js` | **New Game disabled until the territory model is built**, then enabled; both SVG layers resolve; all 359 paths carry `uniqueid` / `territory-name` / `data-name` / `territory-id` and the ids are unique; nothing starts greyed, besieged or deactivated; the in-game panels stay hidden on the menu |
| `initial-model.spec.js` | Via `__game`: one entry per territory, every one owned by `"Player"` or by its country, non-zero area / population / army, `devIndex` inside the range `initialData.js` actually ships, areas summing to the land area of the Earth (±1 %), and **no `NaN` anywhere** |
| `asset-integrity.spec.js` | A flag exists for every country on the map, every image the UI references at load time returns 200, and the generated data files are served |

`asset-integrity` is cheap and catches a whole class of silent breakage: `setFlag`
builds `./resources/flags/${name}.png` by string concatenation and has no fallback,
so a missing flag renders as a broken image with no error anywhere. It also proves
`vite.config.mjs` really did copy `resources/` into the build — asset paths are
hand-written strings in ~100 places and no bundler rewrites them.

## Why the timings are asserted here and only here

Two specs assert wall-clock budgets. They are meaningful only with the machine to
ourselves, so they `test.skip` unless the run is single-worker, and the runner pins
this category to one worker:

    npm run test:e2e:perf

Under the default four workers the same page takes roughly four times as long —
that is contention between four Chromium instances building a 359-territory model
against one preview server, not a regression.

## The gap that used to be here

`the same seed produces the same world` was `test.fixme`, and it was the canary for the whole
suite. Seeding `Math.random` globally could not make this game deterministic:
`addSparklesRegularly()` re-armed a timer every 0–100 ms and burned three `Math.random()` calls
per tick on the same stream the economy and combat drew from (audit §5.3 Y).

**Phase 5.8 closed it** — cosmetic randomness moved to `src/platform/cosmeticRng.js`, which
never touches `Math.random`. The spec is green, and the rule it enforced ("no spec anywhere may
assert an exact combat or economy outcome across runs") is lifted.

Keep it that way: **nothing decorative may draw from `Math.random`**. A new sparkle, a sound
choice or an animation delay goes through `cosmeticRandom()`, or this spec starts failing and
takes `battle/rout.spec.js` and `ai-turn/` with it.
