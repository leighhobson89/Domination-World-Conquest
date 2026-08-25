# ui-layout

The Phase 7.11 pass that brought the last five windows onto the design tokens and
replaced the twelve PNG controls with drawn ones.

| Spec | Covers |
|---|---|
| `drawn-controls.spec.js` | The steppers and the two territory-row action buttons are `<button>`s with inline SVG, not `<img>`s; disabled is `aria-disabled` and not a file path; the theme reaches all of them |
| `window-chrome.spec.js` | No window clips its own content; the tab strip carries its selection in one class; the confirm button arms and disarms; the panels take their surface from a token |

## Why these are e2e and not unit

`tests/unit/ui-stylesheet.spec.js` already asserts what the SOURCE says — that no
literal colour survives outside `:root`, that every retired PNG is gone, that the
two resource windows are declared together. None of that can tell you whether the
result is usable.

The two faults this area exists to catch are both invisible to a text search:

- **A window that clips its last row.** Upgrade Territory shipped for months with
  `height: 500px` over a `366px` content window over a `300px` table — three fixed
  numbers that had to agree and did not, so the fourth of four rows was drawn
  underneath the bottom bar. Every one of those numbers is a perfectly ordinary
  CSS declaration. Only a layout measurement finds it.
- **A control whose disabled state is a lie.** The greying passes in
  `resourceCalculations.js` reach the plus button through
  `.buyColumn5C .stepper-button` and mark it with a class. If a selector goes
  stale the call silently does nothing, the button keeps working, and the player
  overdraws. Nothing throws.

## Notes

- **`aria-disabled`, not `disabled`.** The steppers are deliberately not given the
  `disabled` property: the greyed PNGs they replace still received clicks, and
  several handlers do other work on the way past (the buy window raises its row
  tooltip from the same gesture). See the note at the top of
  `src/ui/controls/steppers.js`.
- **The action buttons are always present.** Before Phase 7.11 the `.upgrade-button`
  class was added only when the button worked, so "does this row contain that
  class" was how enabled was asked. The class says what the control *is*; the
  attribute says what it is *doing*.
