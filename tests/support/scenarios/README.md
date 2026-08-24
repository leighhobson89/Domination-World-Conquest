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

## Two things a new scenario has to get right

**Patch `armyForCurrentTerritory` as well as the four unit counts.** It is a *stored* total,
not a derived one. Patch the units alone and the probability calculation reads one number
while the bottom table reads another — the setup looks applied, and the battle behaves as
though it were not. Every scenario here patches both.

**A chosen battle outcome is reached by COMPOSITION, not by attrition.** An attacker big
enough to win takes the defender from roughly 13 % of its starting force to zero in one step,
straight past the 5 % rout band, so no amount of grinding lands in it. What does land in it is
the makeup of the defender: a naval unit is worth 20,000 personnel and a rifleman one, and
`chooseDefendingUnitTypeIndex()` engages its own type first — so a fleet sinks the defending
fleet before it touches the infantry, and a defender of 100 ships and 2,000 infantry loses
99 % of its combined force with 2,000 men still standing. That is what
`rout-bound-defender` and `last-push-defender` are built on.

## The nine

| Scenario | Sets up |
|---|---|
| `two-sieges` | Two concurrent AI sieges, both large enough not to be arrested on the first tick — audit §5.1 D |
| `doomed-ai-siege` | An AI siege on the player mounted by a force far too weak to sustain it |
| `weak-defender` | A neighbour reduced to a token garrison, the player given a large one |
| `naval-only-defender` | Two armies sharing no unit type at all — audit §5.2 K |
| `outright-conquest` | A fleet against a token garrison: `ATTACKER_WON` |
| `hopeless-attacker` | A token fleet against a defender it cannot dent: `DEFENDER_WON` |
| `rout-bound-defender` | Mostly-naval defender plus infantry: `DEFENDER_ROUTED` |
| `last-push-defender` | The same shape, tuned to land between the 5 % and 15 % thresholds: `LAST_PUSH` |
| `evenly-matched` | Two identical fleets: `FIGHT_AGAIN`, and the setup every siege spec starts from |
