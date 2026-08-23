# buy-military

The Buy Military window, reached from the info panel's **Army** tab, per
territory, in the Buy/Upgrade phase only.

| Spec | Covers |
|---|---|
| `open-close.spec.js` | Opens for an owned territory in Buy/Upgrade only; lists infantry / assault / air / naval in that order; the X and Cancel both close it without spending; totals reset on reopen |
| `purchase.spec.js` | Multiplier cycling x1 → x10 → x100 → x1k and wrap; steppers clamp at zero; running totals track the rows; confirming adds exactly the units bought, buys infantry in troops of 1,000, and raises oil demand by 100 / 300 / 1,000 per vehicle |

## Notes

- **🔴 Every purchase is charged twice** — audit §5.1 AC. `addPlayerPurchases`
  deducts the cost and then both `checkForMinusAndTransfer…` helpers deduct it
  again, outside the `if (short)` branch they exist for. The intended behaviour is
  `test.fixme`; the doubling is characterised in a spec beside it so the suite is
  not silent about it. Phase 3.0 flips them.
- **Quantities are driven only by the plus and minus buttons.** The text field has
  no change handler, so typing into it is ignored by the game — `BuyWindowPage`
  never types.
- **The tooltip intercepts clicks.** `#tooltip` follows the pointer with no
  `pointer-events: none`, so the tooltip raised by hovering one row sits on top of
  the next row's plus button. `BuyWindowPage.dismissTooltip()` parks the pointer on
  the window subtitle first. Phase 6.8 moves the inline styling into CSS.
- **The window is opened via the Army tab, not directly.** That is the only route
  a player has, and it is what makes `turn-loop/phase-restrictions.spec.js`
  meaningful.

## Out of scope here

- Whether the prices are *balanced*. Phase 5.1 gives them names in
  `config/balance.js`; balance is a design question, not a behavioural one.
- Affordability greying under many combinations — the row-greying rules interact
  with the top-table figures in ways that are only worth pinning once a
  `deriveBuyRowState` function exists (Phase 6.3).
