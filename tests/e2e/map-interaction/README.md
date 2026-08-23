# map-interaction

Hover, selection, zoom, map modes and the escape key. Everything that happens on
the map itself, independent of whose turn it is.

| Spec | Covers |
|---|---|
| `hover.spec.js` | Hover lightens the fill by exactly 20 per channel and mouse-out restores it; the tooltip shows the territory's `owner` and hides again |
| `selection.spec.js` | Clicking a territory fills the bottom table -- flag, name, continent, mountain defence, gold, oil, food, cons. mats, population, area -- from `__game` values, and raises the path in z-order |
| `zoom-pan.spec.js` | Wheel zooms in, clamps at six steps and at the original view, and both SVG layers stay in register |
| `map-modes.spec.js` | Political <-> physical recolours and drops fill opacity, keeps the player's own territories visible, reverts on a map click; the continent-stroke toggle is independent |
| `escape-key.spec.js` | Escape opens the menu over a running game and hides the in-game furniture; Escape again restores what was open; it is ignored before a game starts |

## Notes

- **The map is an `<object>`, not an `<iframe>`.** `page.frameLocator("#svg-map")`
  matches nothing. `MapPage.frame()` uses `page.frame({ name: "svg-map" })`, which
  is the only thing that works.
- **The tooltip is populated on `mousemove`, not on `mouseover`.** A single
  `hover()` leaves it empty, so the hover specs move the pointer twice.
- **Mouse-out is wired to the SVG element, not to the path.** Restoring a fill
  means moving the pointer off the map entirely.
- **`zoomMap()` animates and drops wheel events while animating.** The zoom specs
  send one wheel, wait for the viewBox to move, then wait for it to settle. This is
  waiting on a state predicate, not an arbitrary sleep.
- **Zoom is asserted through the `viewBox`, not through `zoomLevel`.** The
  variable is module-private and, more to the point, the viewBox is what the
  player actually sees.

## Out of scope here

- Dragging to pan. It is `mousedown` + `mousemove` on the SVG, gated on
  `zoomLevel > 1`, and Playwright's synthetic mouse does not reproduce the
  browser's drag threshold reliably enough for the assertion to mean anything.
  Revisit when `ui/map/camera.js` exists (refactor Phase 6.7) and the pan offset
  can be read from state.
- Siege markers -- they need a siege, which needs the scenario loader. See
  `siege/` (P2).
