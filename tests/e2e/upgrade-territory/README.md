# upgrade-territory

The Upgrade Territory window, reached from the info panel's **Territories** tab,
per territory, in the Buy/Upgrade phase only.

| Spec | Covers |
|---|---|
| `open-close.spec.js` | Opens for an owned territory in Buy/Upgrade only; lists Farm / Forest / Oil Well / Fort in that order; X and Cancel close without spending; totals reset on reopen |
| `costs-and-caps.spec.js` | Cost is **quadratic** in the running total, scales with `devIndex`, counts what is already built, and is charged exactly as quoted; steppers clamp at zero and at five |
| `capacity-effects.spec.js` | 🔴 The audit §5.1 A regression test — one farm should raise food capacity by exactly 10 % |
| `fort-defence.spec.js` | `defenseBonus = ceil(forts x (forts + 1) x 10 x devIndex + landlockedBonus)`; the bonus grows super-linearly; a landlocked territory carries a standing bonus |
| `insufficient-resources.spec.js` | The row greys rather than allowing an overdraft; the reason names a resource; nothing is spent while the button still reads Cancel |

## Notes

- **The cost is quadratic, not linear.** `cost(n) = ceil(base x n x (n x mult) x
  devIndex/4)`, where `n` is *already built + selected*. The second farm costs four
  times the first. The e2e plan's `base x modifier x (devIndex / 4)` describes only
  the `n = 1` case, and its claim that a high-`devIndex` territory pays *less* is
  the opposite of the shipped formula — the code is the reference until Phase 5.1
  settles the design question.
- **The stepper usually stops on affordability, not on the cap.** Because the cost
  is quadratic, most territories cannot fund five of anything in one transaction.
  The cap itself is only observable on a rich, multi-territory country, which is
  why one spec starts as the United States.
- **Upgrades are charged once; military purchases are charged twice** (audit
  §5.1 AC). The asymmetry is exactly why both are pinned.
- **`defenseBonus` is rounded two different ways** — the ceil is inside the
  `x devIndex` at construction and outside it after a purchase. The difference is
  under 1, which is why nobody has noticed; reconcile it in Phase 5.1.

## Out of scope here

- The capacity arithmetic beyond the +10 % rule — it belongs in `rules/economy/`
  unit tests at Phase 5.6.
