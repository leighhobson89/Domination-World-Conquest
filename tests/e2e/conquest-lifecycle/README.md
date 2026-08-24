# conquest-lifecycle

The full arc from taking a territory to using it normally.

| Spec | Covers |
|---|---|
| `ownership-transfer.spec.js` | On conquest `owner`, `dataName`, colour, the map attributes and the player's totals all move together and `originalOwner` is preserved; the territory is locked for its 1–3 turn cool-off with the countdown on the move button; it reactivates exactly once and stays active |

## Why this folder could not exist before

Conquest is not reliably reachable by clicking — winning a battle on the live map is a seed
lottery. It needs two things, and both landed late: the **scenario loader** (Phase 4), which
can set up a defender that will actually fall, and **a repeatable RNG** (audit §5.3 Y, closed
in Phase 5.5), without which the same setup produced a different battle every run.

`outright-conquest` is the scenario: a fleet against a token garrison, so the battle ends in
`WarOutcome.ATTACKER_WON` rather than somewhere interesting.
`GameDriver.launchWholeGarrison()` and `fightToResolution()` drive it.

## Notes

- **`dataName` is the CURRENT owner and changes on conquest.** `territoryName` is the stable
  identity and `originalOwner` is historical. All three are asserted, because mixing them up
  is a recurring source of bugs here.
- **The map attributes are output.** Phase 4 made `owner`, `data-name` and `deactivated`
  render from the store, so the spec asserts state and attribute together and they cannot
  disagree.
- **Reactivation is the audit §5.2 N/O regression test.** `activateAiTerritoriesForNewTurn`
  compared a uniqueId against the *array* rather than `[i][0]`, so a conquered territory was
  never reactivated; and the served entry was never spliced out, so once the counter did
  match, reactivation re-fired every turn forever.
- **The AI can take the territory back.** The reactivation spec stops asserting if ownership
  changes hands again, because that is a legitimate outcome and not the thing under test.

## Out of scope here

- `army-retrieval.spec.js` from the plan — the retrieval array is pinned by
  `battle/known-broken.spec.js`, which is where the INVADE!/retreat pair lives.
- `economy-after-conquest.spec.js` — income over several turns, with the AI acting on the same
  territories, is a measurement rather than an assertion. The per-turn economy is unit-tested
  in `tests/unit/rules-economy.spec.js`.
