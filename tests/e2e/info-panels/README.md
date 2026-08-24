# info-panels

The main info panel: Summary / Territories / Military / Wars & Sieges.

| Spec | Covers |
|---|---|
| `tabs.spec.js` | The panel opens and closes; exactly one tab is marked active and the mark follows the selection; the choice survives a redraw; the Territories tab lists one row per owned territory and gains a row on conquest; the Wars & Sieges tab names a siege the player is running |

## The defect this folder was written against

**The active-tab mark never moved.** `active` was added to `summaryButton` once, at game
start, and removed from the other three only by the X button — no tab click touched it.
`.tab-button.active` is what `style.css` highlights, so the Summary tab looked permanently
selected however many times the player switched, and the `mouseout` handler (which asks
`classList.contains("active")`) reset the wrong button's colour. Which tab is selected is one
fact, and `markActiveTab()` is now the one place that writes it. Phase 6.3 turns that into
`InfoTable.update(state)`.

## Notes

- **The tab is called "Military" in the UI and "Army" in the plan.** The page object keeps the
  plan's name (`showArmy()`); the button reads `Military`.
- **This panel is the only route to the buy and upgrade windows** — the Territories tab
  carries the per-territory upgrade button and the Military tab the buy button, which is what
  makes `turn-loop/phase-restrictions.spec.js` meaningful.
- **The panel auto-opens at the start of a turn** when the checkbox is on. That behaviour is
  `turn-loop/start-of-turn-ui.spec.js`, not here, because it is a property of the turn.

## Out of scope here

- `formatting.spec.js` from the plan — `formatNumbersToKMB` is a pure function and belongs in
  the Vitest suite, per §4 of the e2e plan.
- `tooltips.spec.js` — `#tooltip` has no `pointer-events: none` and the page objects park the
  pointer to work around it. Asserting tooltip *position* while it is also eating clicks would
  pin the workaround rather than the behaviour. Phase 6.3 extracts `Tooltip`.
- Column-by-column values in each tab. Those are the model's numbers, already asserted against
  `__game` in `resources-economy/` and `map-interaction/selection.spec.js`.
