# Adjacency

Which territories can interact with which, once the geometric adjacency has been
corrected by the hand-written island rules. This is the category that guards the
data pipeline: `resources/closestPathsData.json` → `tools/build-adjacency.mjs` →
`resources/adjacency.json` → `src/data/adjacency.js`, combined with
`src/data/manualAdjacencyExceptions.js`.

| Spec | Covers |
| --- | --- |
| `island-exceptions.spec.js` | The exception table is fully populated in the running game; additions apply (Fiji ↔ Vanuatu ↔ New Caledonia, Bermuda ↔ Grand Bahama ↔ United States); denials apply symmetrically (UK ⇎ Luxembourg, Laos ⇎ Hainan Island); no territory reaches itself; no territory is stranded with zero neighbours |

## Why this category exists

The exception table used to be built inside a `setTimeout(..., 1000)` before a
dynamic import. If the territory model was not ready within that second, every id
lookup returned `undefined`, the whole `Map` collapsed into one `undefined` key, and
**every rule silently stopped applying** — non-deterministically, per machine and per
load. These specs assert the rules take effect in the running game, not just that the
table parses.

## Two traps worth knowing

- **`"Grand Bahama (Bahamas)"` and `"Andros Island (Bahamas)"` are the real
  territory names in `svgMaster.svg`**, parentheses and all. They look like typos and
  are not. `tests/uniqueIdLookup.json` disagreed with the SVG on exactly these two
  entries, which is what made them look wrong; the SVG is authoritative and the
  lookup file has been regenerated from it.
- **`"New Caledonia 1"` was a duplicate key** in the legacy `new Map([...])`, so the
  second entry silently overwrote the first and its King Island and Fraser Island
  links vanished. The two entries are merged, and a unit test pins the count.

Fine-grained assertions about the data files themselves live in the Vitest suite
(`tests/unit/adjacency.spec.js`, `manual-adjacency-exceptions.spec.js`,
`interactable-territories.spec.js`); this category only checks the running game.
