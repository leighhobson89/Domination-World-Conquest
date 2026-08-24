# country-selection

New Game through to a running game: greying out unplayable countries, the colour
picker, and what confirming a country actually does.

| Spec | Covers |
|---|---|
| `new-game.spec.js` | New Game hides the menu, shows the selection popup, greys out countries over the strength threshold, and offers the colour picker |
| `greyed-out.spec.js` | A greyed country shows no confirm button; a playable one names itself in `#popup-body` and turns the confirm button green |
| `colour-picker.spec.js` | Changing colour repaints every path of the pending country, every player-owned territory once started, and survives a phase change |
| `confirm-and-initialise.spec.js` | Confirming sets the player flag, ungreys the map, marks ownership in both state and SVG, and lands in Buy/Upgrade of turn 1 with the button reading `MILITARY` |
| `multi-territory-country.spec.js` | Clicking any one path of Japan gives the player all five; a single-territory country gives exactly one |

## Notes

- **The confirm button is hidden by `opacity: 0`, not by `display`.** Playwright's
  `toBeHidden()` does not see an opacity-hidden element, so `new-game.spec.js`
  asserts computed opacity instead. Refactor Phase 6.3 gives `CountrySelect` a real
  hidden state and these become ordinary visibility assertions.
- **`greyedOut` and the grey fill are two independent facts.** `selectCountry()`
  decides whether to offer the confirm button by reading the *fill*, not the
  attribute, so `new-game.spec.js` asserts the two agree. They would diverge
  silently otherwise.
- **`data-name` is the current owner and changes on conquest.** These specs run at
  turn 1 where it still equals the starting country, which is the only point at
  which addressing a country by `data-name` is safe.

## Out of scope here

- Whether the strength threshold is *correctly balanced* — that is a design
  question, not a behaviour one.
- The starting resource and army values a country is seeded with; those are
  `bootstrap/initial-model.spec.js`.
