# options

The two settings surfaces: the Options panel opened from the main menu (the theme and the
two sound switches), and the floating audio panel opened from the map (the same two mutes,
plus volumes and transport). They are in one folder because they are the same kind of thing
-- preferences about this browser rather than facts about the world -- even though the
player reaches them from opposite ends of the game.

The two mutes appear in both, deliberately, and that is why `sound-toggles.spec.js` spends
most of its length on one question: whether the two views can be made to disagree.

| Spec | Covers |
|---|---|
| `audio-panel.spec.js` | The music-note button is up from the country-selection screen onward and sits above the continent-view button; the in-game menu takes it down and gives it back; it opens and closes the floating panel; the panel closes on Escape and is NOT a modal (the map stays live behind it); its sliders and mutes move the real settings, and a save carries them |
| `sound-toggles.spec.js` | The Options panel's two sound switches are reachable before any game exists; unchecking one mutes and Done keeps it muted; Cancel and Escape both restore the mutes in force when the panel opened; and the switches and the audio panel over the map are one setting seen twice, in both directions |
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
- The sound switches are real `<input type="checkbox">` elements, so `check()`, `uncheck()`
  and `toBeChecked()` work on them with nothing simulated. The stylesheet lays each input
  transparently OVER the track it appears to be, rather than shrinking it to a pixel and
  hiding it: a 1px input is still on screen as far as the browser is concerned, so a click
  aimed at it lands on the track and Playwright reports "the track intercepts pointer
  events".
- Their sense is inverted against what is stored. Checked means AUDIBLE; `audio.js` holds
  `musicMuted` / `sfxMuted`. Reading a spec here, `not.toBeChecked()` is the muted case.
- Assertions go through `data-theme` on `<html>` and through one computed background colour.
  The rest of the suite asserts only `display`, `opacity` and `pointer-events`, and that is
  still the rule — a spec that pinned a specific hex value would break every time a theme was
  tuned, which is the opposite of what this folder is for.
