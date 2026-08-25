# activity-feed

The military activity panel (Phase 7.4) — the button under the info-panel globe,
the window it opens, and what gets written into it.

| Spec | Covers |
|---|---|
| `panel.spec.js` | The button appears with the rest of the in-game chrome; open, close, and the X; per-turn sections collapse and expand; the panel raises itself at the start of a turn and the toggle switches that off; it opens over the territory panel and can be pushed back under it |
| `recording.spec.js` | A conquest is derived from the ownership change and names the country it was taken **from**; a failed attack is recorded even though nothing in the store changed; a siege is recorded when it starts; economic events never appear; the log survives a save/load round trip and is cleared by a new game |

## What is asserted here, and what is not

**Not the wording.** `describeActivity()` is pure and
`tests/unit/ui-activity-feed.spec.js` owns every sentence and every colour rule.
A spec here that matched on "Balearic Islands (Spain) conquered by Libya" would
test the phrasing twice and the behaviour not at all, and would break on a comma.

What is left once the wording is someone else's problem is the part that only
exists in a browser:

- **that anything is recorded at all.** Most entries are *derived* from
  `state/events.js` rather than written at the site of the event — a conquest is
  "a territory's `dataName` changed". That is deliberate (there are eight places
  that take a territory, and a list of eight loggers is one new attack route away
  from being wrong) but it means the recorder is wired up through two modules and
  an event bus, and nothing throws if it is not.
- **which turn an entry lands in.** `endTurn: advanceTurn` means the AI moves
  during turn *N* and the counter reaches *N+1* afterwards, so everything the
  player is shown at the start of a turn is filed under the turn that just ended.
  Get that wrong and the panel opens on an empty section.
- **the player-involvement flags**, which decide both the colour of a conquest and
  the size of every row, and which cannot be recovered from the DOM text.

## Notes

- **`window.__game.recordActivity()` writes one entry directly.** The feed's
  harder cases — an AI conquering an AI on the far side of the map, a siege in its
  fourth turn — are unreachable by clicking in any reasonable time. What it does
  not bypass is the panel: the entry goes through `recordActivity()` and the panel
  re-renders from the event, so what the spec reads back is the real rendering
  path.
- **The panel does not raise itself on turn 1**, the same rule the info panel
  applies: nothing has happened yet.
- **Which sections are open is view state and is never saved.** A restored game
  opens on its own current turn, not on whatever was expanded when the save was
  taken.
