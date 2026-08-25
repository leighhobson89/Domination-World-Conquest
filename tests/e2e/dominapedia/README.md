# dominapedia

The manual, opened from the main menu (Phase 7.6). It is the last of the menu's buttons to be
wired — it was an inert "Help" until now — and it is the first screen in the game that is a
document rather than a control surface: a title bar, a collapsible contents column down the
left, a content pane on the right, and Previous / Next walking every sub-topic in the book.

| Spec | Covers |
|---|---|
| `dominapedia.spec.js` | The menu button opens a full-screen window; the X, Escape and a click on the scrim all close it; it opens on a page with that page's section expanded and its link marked; a main topic collapses and expands; clicking a sub-topic changes the page; Previous and Next move the page and the mark in the contents together and are inverse; both wrap at the ends of the book; neither is ever disabled; both columns scroll while the panel itself does not; changing the page returns the reading pane to its top; and reopening comes back to the page that was being read |

## What is deliberately NOT here

The catalogue and the walk over it are pure — `src/ui/dominapedia/topics.js` imports nothing
and touches no DOM — so `tests/unit/ui-dominapedia-topics.spec.js` owns them, including the
wrap at both ends of the book. That is the case nobody exercises by hand, and it is exactly
the kind of thing that should not need a browser and four hundred milliseconds to answer.

So no spec in this folder asserts what a page SAYS, what order the pages are in, or how many
there are. A spec that named a topic would fail the day the content is written, which is the
next thing to happen to this feature. Where a spec needs a page it reads one out of the panel
(`data-topic`, `aria-current="page"`, the "N of M" counter) and asks whether the controls move
through it correctly.

## Notes

- **Which page is showing is `aria-current="page"` on its link**, not the `.is-current` class.
  The class is paint; the attribute is the fact, and it is on a real `<button>` so the
  contents column works from the keyboard.
- **`data-section` is on both the group and its header** — the group so a spec can ask whether
  a section is open, the header so it can click it. `selectors.js` therefore has
  `sectionFor()` (the header) and `sectionGroupFor()` (the group); a bare `[data-section=…]`
  matches two elements and Playwright refuses it.
- **The panel does not scroll and that is asserted.** It is a fixed height with
  `overflow: hidden` and the two columns each own their overflow, which is what keeps the
  title bar and the two navigation buttons on screen while a long page is read. If the panel
  itself ever starts scrolling, the footer leaves the viewport and the feature is broken in a
  way no assertion about content would catch.
- The window shares `.options-scrim`, `.options-button` and its two modifiers with the Options
  and Save / Load panels, so the class-ambiguity warning in `CLAUDE.md` applies here too:
  address these buttons by id, never by class.
