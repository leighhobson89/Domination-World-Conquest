# Scenarios

States the world can be put into that clicking cannot reach: a rout, an all-naval
defender, two concurrent sieges, a territory at zero food.

Each file is applied through `state/mutations.js` — the same path the game writes by — so a
scenario cannot produce a world the game could not have produced itself. See
[../../../src/platform/scenarios.js](../../../src/platform/scenarios.js) and
[docs/04-e2e-test-plan.md](../../../docs/04-e2e-test-plan.md) section 3.7.

Load one from a spec with `await game.loadScenario("two-sieges")`. The JSON is read in Node
and handed to `window.__game.applyScenario()`, because the preview server serves `build/`
rather than the repository and the page cannot fetch these files.

## Shape

```jsonc
{
  "name": "two-sieges",
  "description": "why this scenario exists",
  "territories": [
    { "territory": "Chad", "patch": { "fortsBuilt": 5, "foodForCurrentTerritory": 0 } }
  ],
  "sieges": [
    {
      "side": "ai",                     // or "player"
      "territory": "Chad",              // the besieged territory, by its stable name
      "attackingCountry": "Sudan",
      "attackingTerritory": "Sudan",    // optional
      "attackingArmy": [5000, 0, 0, 0], // infantry, assault, air, naval
      "defendingArmy": [100, 0, 0, 0],  // optional; defaults to the territory's garrison
      "turnsInSiege": 0
    }
  ]
}
```

`applyScenario` returns a report — which territories and sieges it applied, and any names it
could not resolve. Assert on it: a scenario that silently did nothing is worse than a failing
test. `GameDriver.loadScenario` already throws if the report carries errors.

Territory names come from `resources/svgMaster.svg` and six of them contain real parentheses
(`"Grand Bahama (Bahamas)"`). Write them exactly as the SVG has them.
