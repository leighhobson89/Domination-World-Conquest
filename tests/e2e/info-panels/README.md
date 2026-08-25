# info-panels

The main info panel: Summary / Territories / Military / Wars & Sieges.

| Spec | Covers |
|---|---|
| `tabs.spec.js` | The panel opens and closes; exactly one tab is marked active and the mark follows the selection; the choice survives a redraw; the Territories tab lists one row per owned territory and gains a row on conquest; the Wars & Sieges tab names a siege the player is running |
| `wars-tab.spec.js` | A war the attacker WON shows the defender's flag in the Defending Country column, not the flag of whoever owns the territory now (known-issues **AS**) |
| `toggle-button.spec.js` | The globe over the map opens the panel AND closes it again — it used to be hidden the moment the panel opened, leaving the X as the only way out — and it is clickable rather than merely present, which is a statement about the stacking |

## The defect this folder was written against

**The active-tab mark never moved.** `active` was added to `summaryButton` once, at game
start, and removed from the other three only by the X button — no tab click touched it.
`.tab-button.active` is what `style.css` highlights, so the Summary tab looked permanently
selected however many times the player switched, and the `mouseout` handler (which asks
`classList.contains("active")`) reset the wrong button's colour. Which tab is selected is one
fact, and `markActiveTab()` is now the one place that writes it. Phase 6.3 turns that into
`InfoTable.update(state)`.

## The second defect, found later

**`wars-tab.spec.js` exists because of one bug and is shaped by it.** The Defending Country
column was `war.defendingTerritory.dataName`, and `dataName` is the CURRENT owner of a
territory — it changes on conquest. So a war the attacker won showed the attacker's own flag in
the defender's column.

What let it survive is that it was correct everywhere else: an ongoing siege has not changed
hands, and neither has a war the attacker lost. The only rows it was ever wrong on were the
ones where the territory changed hands, which is also the only outcome worth looking back at.
That is why the spec **conquers** rather than besieging or losing — an assertion on any other
outcome would have passed against the bug, which is the failure mode this whole folder exists
to avoid. The war now records `defendingCountry` when it is created; see known-issues **AS**.

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
