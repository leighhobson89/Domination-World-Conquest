# options

The Options panel, opened from the main menu, and the theme it picks.

| Spec | Covers |
|---|---|
| `theme-picker.spec.js` | The panel opens from the menu and closes on Done, on Escape and on a click outside it; the dropdown lists every theme with the default selected; changing it repaints immediately; the description follows the selection; Done survives a reload; Cancel restores the theme that was in force when the panel opened; the choice survives starting a game |

## Why these are e2e and not unit tests

`tests/unit/ui-theme.spec.js` already covers the catalogue — that every theme defines every
token, and what an unknown id resolves to. Neither of those needs a browser.

What does need one is the part the player experiences, and it is three separate code paths
that are one bug away from each other:

- **preview** applies a theme without persisting it,
- **Done** persists what is on screen,
- **Cancel** puts back what was in force when the panel opened.

Make the preview persist and Cancel becomes meaningless while still appearing to work — the
panel closes, the theme stays, and nothing throws. That failure is invisible to a unit test of
`applyTheme()`, because `applyTheme()` is behaving exactly as asked; the defect is in who calls
it with `persist: false`. So the Cancel spec deliberately commits a theme FIRST, so that the
restore has something other than the default to land on. Without that step it would pass for
the wrong reason.

## Notes

- The panel creates its own container rather than mounting into a `<div>` in `index.html`. It
  is the first component to do so, and the reason is `destroy()`: a component that owns its
  element can be removed completely, which is what Phase 7.2's New Game needs.
- Assertions go through `data-theme` on `<html>` and through one computed background colour.
  The rest of the suite asserts only `display`, `opacity` and `pointer-events`, and that is
  still the rule — a spec that pinned a specific hex value would break every time a theme was
  tuned, which is the opposite of what this folder is for.
