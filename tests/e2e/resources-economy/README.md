# resources-economy

Coarse-grained economy behaviour. The formulas themselves are **not** tested here
— they become Vitest unit tests when `rules/economy/` is extracted in refactor
Phase 5.2. What this folder owns is that the numbers the player sees are the
numbers the model holds, and that they move in the right direction.

| Spec | Covers |
|---|---|
| `top-table-totals.spec.js` | The top table equals the sum over `__game.territoriesOwnedBy("Player")` for every resource, for a one-territory and an eleven-territory country, and updates after a purchase or an upgrade without a phase change |
| `oil-demand-gating.spec.js` | Buying vehicles past a territory's oil supply leaves them **owned but not useable**; demand rises by 100 / 300 / 1,000 per assault / air / naval unit; naval units are grounded first; infantry is never affected |

## Notes

- **Numbers come from `__game`, behaviour from the DOM.** Asserting food capacity
  by parsing `"1.2M"` out of a table cell tests `formatNumbersToKMB`, not the
  economy.
- **Totals are compared relatively, not with `toBeCloseTo`.** These are sums of
  tens of thousands, where "3 decimal places" is stricter than double-precision
  addition of the same terms in a different order. A tenth of a percent is loose
  enough for float noise and far tighter than a real desync.
- **Useable ≠ owned.** It is the *useable* count that feeds defence strength and
  the attack probability. `oil-demand-gating.spec.js` is the spec that pins the
  difference.

## Out of scope here, and why

- **Per-turn income over several turns.** The AI turn crashes from the second or
  third turn (audit §5.1 AA), so nothing can run long enough to characterise the
  economy's trajectory. `turn-loop/turn-counter.spec.js` covers the single-turn
  case; the rest waits for Phase 3.1a.
- **Starvation** (`starvation.spec.js` in the plan). It needs a territory driven
  below its food need, which is not reachable by clicking — it wants the scenario
  loader (e2e plan §3.7, a Phase 4 deliverable). The defect it would pin is audit
  §5.1 F.
- **Resource borrowing** across the player's territories. Reachable in principle
  by bankrupting one territory of a multi-territory country, but the borrowing
  helper is also the site of audit §5.1 AC (every purchase charged twice), so a
  borrowing spec written today would be pinning arithmetic that is about to
  change. Write it with Phase 3.0.
