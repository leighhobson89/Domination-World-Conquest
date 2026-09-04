# Goals and Victory — Checklist

The task breakdown for [05-goals-and-victory.md](./05-goals-and-victory.md). Breathing
document: tick items as they land, and record what was measured rather than what was intended.

Four quarters. **Each one ends with the game playable** — that is the house rule, and it is
what keeps a regression bisectable. Work is test-first: write the failing test, watch it fail,
then fix.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked or deferred

---

## Q1 — Measurement and the trigger

The rules layer and the working end-game trigger. No UI, no AI change. The default condition is
unchanged, so the game plays exactly as it does today except that it can now end.

### Q1.1 Balance constants

- [x] `src/config/balance.js` — scale tiers for all five goals as named constants
- [x] `VICTORY_TURN_LIMIT` becomes a tier list starting at **200**, with the reason recorded at
      the site (the simulator shows the largest empire at ~30 territories after 100 turns)
- [x] Existing single-value constants kept as the DEFAULT entry of their tier list, so nothing
      that reads them today changes behaviour

### Q1.2 `src/ai/victory.js` — the two new kinds

- [x] Unit tests first, in `tests/unit/ai-victory.spec.js`
- [x] `CONQUEST` — won when no other country holds a territory (exact integer test, never a
      float comparison against 1.0)
- [x] `GREAT_POWERS` — won when the country holds every territory whose `originalOwner` is each
      of N target powers
- [x] **A country never counts its own homeland** — the rule that stops a great power starting
      a five-power game a fifth of the way to winning
- [x] `greatPowers: string[]` added to the condition object, frozen at game start
- [x] `hasWon()` completed for `TURN_LIMIT` — currently returns `false` unconditionally, which
      is why nothing could ever end
- [x] `turn` passed as a PARAMETER, not imported from `state/phases.js`, so the module stays a
      pure function of its inputs
- [x] `victoryProgress()` labels for both new kinds, including the Great Powers form that names
      the power being worked on
- [x] `captureVictoryCondition()` COPIES `greatPowers` rather than sharing the spread's
      reference

### Q1.3 `src/rules/victoryCheck.js` — new

- [x] Unit tests first, in `tests/unit/rules-victory-check.spec.js`
- [x] `checkForVictory({ turn, playerCountry, condition, standings })`
- [x] Player holds no territories → `DEFEAT` under every goal (elimination is universal)
- [x] Any country satisfying `hasWon()` ends the game — `VICTORY` for the player, `DEFEAT`
      otherwise (the shared-race decision)
- [x] Timed Game at its limit → largest empire by area, ties broken on territory count then
      name so a seeded run reproduces the result
- [x] Pure: imports `config/` and `state/selectors.js` only, and is verified to run in Node

### Q1.4 Wire the trigger

- [x] `GAME_OVER` on `src/state/events.js`
- [x] One call in `gameTurnsLoop.js` `endTurn`, **before** `advanceTurn`
- [x] Fires at most once per game; the loop stops asking afterwards
- [x] `console.log` as the first LISTENER, not the mechanism — never `console.error`, which
      fails every e2e spec
- [x] Reset on New Game and on load

### Q1.5 Q1 exit

- [x] `npm run test:unit` green
- [x] Game verified in a browser, not just by reading — `npm run dev` and play a turn
- [x] No lint regressions against the recorded baseline

---

## Q2 — The AI plays for the goal

The half that makes the choice mean anything. Today `chooseObjective()` is the only place the
condition kind is consumed and all it does is pick a continent count.

### Q2.1 `src/ai/doctrine.js` — new, pure

- [x] Unit tests first, in `tests/unit/ai-doctrine.spec.js`
- [x] `doctrineFor(condition, { progress, turn, standings, country })` returning
      `{ kind, continentsToCommit, areaHunger, targetCountries, urgency, neverSatisfied }`
- [x] One row per goal, per the table in the plan — the rows are `goalDoctrines` in
      `config/balance.js`, so a goal's character is a balance edit and not a code edit
- [x] `urgency` from the strongest rival's progress (the runaway-leader response). Measured
      from land SHARE rather than from `victoryProgress()` per rival, which would be 207×207
      map walks a turn; the two largest shares are found in one pass and memoised on the
      standings object, so the whole world's urgency costs one loop
- [x] `urgency` from `turn / turnLimit` for Timed Games
- [x] Under Great Powers, `targetCountries` excludes the country itself — and drops a power
      whose homeland this country already holds outright
- [x] The returned object is FROZEN and carries no siege dial at all, so urgency cannot reach
      the siege budget even by accident. A unit test asserts no key matches `/siege/`

### Q2.2 Consumers stop switching on the condition kind

- [x] `strategy.js chooseObjective()` reads `continentsToCommit`; `Infinity` (Conquest) is
      clamped to how many continents the map actually has, with a floor of one
- [x] `strategy.js deriveBudgets()` scales the **attack** budget by urgency — and the siege
      budget **not at all**, or the 17→67 concurrent sieges problem returns. Pinned by a test
      asserting `siegeBudget` and `concurrentSiegeCap` are identical at urgency 0 and 1
- [x] `strategy.js choosePosture()` honours `neverSatisfied` — the banked-and-no-focus branch
      is the one that had no way out, so that is the one it skips
- [x] `theatre.js` biases the mid-term rival choice towards `targetCountries`.
      **This landed as a sort TIER, not a score term**, and the first attempt proved why: a
      great power is by definition one of the strongest countries on the map, so it scores
      near zero on `weakness` — the heaviest term in the ranking — and a multiplier small
      enough to be a bias never lifted it above a convenient small neighbour, while one large
      enough to lift it would also lift a rival the goal never named. Walls still sort last,
      so a country that throws itself at a power and fails still goes elsewhere
- [x] `targeting.js` rates a target power's homeland higher (by `originalOwner`, so the goal
      survives a third party taking it first), and weights area by `areaHunger`
- [x] No module outside `doctrine.js` reads `VictoryCondition` kinds any more — `strategy.js`
      no longer imports the enum at all

### Q2.3 Measurement — the acceptance criterion

- [x] `tools/ai-sim.mjs` gains `--goal=KIND[:scale]`, and the goal goes in the default output
      filename so five runs of one seed do not overwrite one another
- [x] `window.__game.setGoal(kind, scale)` / `victoryCondition()` / `victoryProgressFor()` —
      the hooks the flag needs. `setGoal` takes a kind and a scale, never a condition object,
      so nothing outside `goalCatalogue.js` knows which field a scale belongs on
- [x] 150-turn headless run recorded for each of the five goals (`--seed=goals`, default
      scales). All five played every turn with zero page errors
- [x] Each goal produces a visibly DIFFERENT world: 78–114 countries surviving, a largest
      empire of 51–97, a top-sixteen share of 65–81%. Against the pre-theatre baseline of
      163 countries and a largest empire of 30 at turn 100, all five consolidate far harder
- [x] **No goal freezes one** — checked by reading the trajectories rather than by the suite
      passing. The country count falls in all five between t125 and t150, and the largest
      empire rises or holds in all five
- [x] Numbers written back into §5 of the plan document, with a paragraph per goal saying
      what its shape means

### Q2.4 Q2 exit

- [x] `npm run test:unit` green
- [x] `ai-turn` e2e area green — including "two runs of the same seed produce the same world",
      which is what says nothing added here draws off the seeded stream
- [x] Verified in a browser

---

## Q3 — The chooser

### Q3.1 `src/ui/goals/goalCatalogue.js` — new

- [x] Unit tests first, in `tests/unit/ui-goal-catalogue.spec.js`
- [x] Five goals: names, scale options, summaries, description bodies as frozen
      `{ kind: "p" | "h" | "ul" }` blocks — never markup
- [x] Imports nothing but `config/balance.js` and the `VictoryCondition` enum; runs in Node
- [x] World Conquest's scale list holds exactly one entry
- [x] `conditionFor(kind, scale)` is the ONE place that knows which field a scale belongs on,
      so nothing that renders a dropdown ever names `landShare` or `turnLimit`. That is the
      one mistake here that would be silent — a Domination game with its share written into
      `continentsRequired` is a valid condition object that plays as the default game
- [x] `randomGoalCondition(rng)` — spectator mode's opening question, answered from the
      seeded stream so `?seed=` reproduces a world including what it was played for

### Q3.2 `src/ui/components/GoalSelect.js` — new

- [x] Ids in `src/ui/core/registry.js` — never hand-written selectors
- [x] Built with `el()` / `mount()` / `on()`; `destroy()` undoes itself
- [x] Shares `.options-scrim` / `.options-button` with Options, Save/Load and the Dominapedia
- [x] Goal dropdown + scale dropdown left, description pane right, Confirm in the footer
- [x] The scale dropdown repopulates when the goal changes and always shows a valid default.
      Its options carry INDEXES, not values: the DOM stringifies an option's value, so
      Domination's `0.6` came back as the string `"0.6"`, matched nothing in the tier list,
      and would have handed every game the default scale in silence
- [x] **The choice is forced** — no Cancel, no scrim dismissal; Escape goes back to the main
      menu rather than skipping the screen
- [x] **The panel is a FIXED height and never scrolls itself** (`height`, not `max-height`),
      with the description column owning the overflow. A box that resizes as the player
      browses the five goals reads as a rendering fault, and it moves the Begin button while
      somebody is reaching for it — the same rule the Dominapedia records
- [x] **No dropdown is truncated or overflows its column.** Two separate faults: a flex item
      will not shrink below its own content unless told it may, so a `<select>`'s longest
      option pushed the control out through the divider; and the column was then too narrow
      to show "Continental Supremacy" without an ellipsis. The panel is wider, the labels sit
      above their controls, and the column is sized from the longest label in the catalogue.
      Measured in the browser: the tightest option has 165px of slack
- [x] Under Great Powers the panel NAMES the five powers. The description spends two
      paragraphs on this being the goal with antagonists, so it had better say who they are
- [x] No colour literal outside `:root` in `style.css`; nothing new needed a token
- [x] `tests/unit/ui-theme.spec.js` and `ui-stylesheet.spec.js` still green

### Q3.3 Wire it into the flow

- [x] Opens from `startNewGame()` in `ui.js` — one insertion point serves both the cold start
      and the mid-game restart
- [x] Confirm calls `setVictoryCondition()` and drops through to country selection
- [x] **Ordering trap** closed: `greyOutTerritoriesForUnselectableCountries()` runs BEFORE the
      chooser opens, and the names are read from the store through `greyedOutCountryNames()`
      — never from a fill colour and never from an empty store. `strongestCountries()` in
      `ui.js` is the one function both the lock and the condition read, which is where
      `COUNTRY_GREYOUT_RANK` and `GREAT_POWERS_REQUIRED` are reconciled
- [!] Spectator mode is NO LONGER unaffected — **Leigh's call, taken mid-phase**: it draws a
      RANDOM goal at start and shows it in the strip a played game gives to the top table. A
      debug mode pinned to the default condition would only ever exercise the default
      condition, which is exactly the claim the doctrine layer makes about the other four.
      See `src/ui/components/AiGameGoalBar.js`

### Q3.4 The progress line

- [x] `victoryProgress().label` on the phase bar, refreshed on `TURN_CHANGED`
- [x] The advance button does not move — the line is inside the collapsible section, and the
      bar is bottom-anchored with a content height, so anything added there grows upwards
- [x] Reset by New Game (`phaseBar.setMode(SELECTING)` clears it); correct after a load,
      written by an addressed `refreshGoalLine()` in BOTH `initialiseGame()` and
      `resumeSavedGame()` rather than as a side effect of either. A save taken on turn 1 and
      restored over a fresh game at turn 1 changes no turn and so emits no event
- [x] Hidden in spectator mode, where there is no player whose progress it could describe

### Q3.5 Q3 exit

- [x] `npm run test:unit` green
- [x] Verified in a browser at three themes (including the light one, where a half-filled
      palette shows as unreadable text) and two window sizes, with zero `console.error`

---

## Interleaved: the spectator's view of the goal (Leigh's request, mid-phase)

Not in the original breakdown. Asked for while Q2 was landing, on the grounds that a
spectated game is where the doctrine layer is actually watched.

- [x] The AI's LONG-term goal in the spectator log: a `Playing for` line carrying
      `victoryProgress().label`, that country's urgency, and — under Great Powers — the
      powers it is hunting
- [x] The MID-term goal printed even when there is none. A silent line and a country that was
      never asked look identical in a log of two hundred countries a turn, and "nothing
      reachable to campaign against" is itself the answer to why an island does nothing for
      fifty turns
- [x] `goalHorizons.js` carries the doctrine on the long term, so the AI debug panel and the
      spectator console read one fact rather than two
- [x] The goal bar across the top of a spectated game (`AiGameGoalBar.js`), in the space
      `applySpectatorChrome()` leaves empty when it takes the player's top table down. It
      names the goal and the country currently leading it, and follows `TURN_CHANGED`
- [x] **The leader is the country closest to the ACTIVE GOAL, not the largest empire.**
      `closestToVictory()` in `victory.js`. `leadingCountry()` answers "largest by land",
      which is the TURN_LIMIT win condition and nothing else — under Great Powers the
      biggest empire on the map need not be the one nearest to breaking three of them
- [x] **A timed game's leader is not described by its own progress label.** Leigh spotted it
      on screen: `victoryProgress()` under TURN_LIMIT reads "Largest empire: N% of the
      leader" — a comparison AGAINST the leader — so applied to the leader it says "100% of
      the leader" every turn, in every game, whoever is winning and however far ahead. It is
      the one line that can never say anything. `describeLeaderProgress()` in
      `goalCatalogue.js` says how much the leader holds and how much clock is left instead
- [x] **Bug found by watching a spectated game, which is what the mode is for.**
      `window.__game.setGoal()` read the great powers from the store's LOCKED-country set,
      and the lock is a fact about the country-selection screen: spectator mode clears it
      explicitly and a played game leaves it behind once a country is chosen. So a
      GREAT_POWERS game set through that hook named no powers, `greatPowerStandingsFor()`
      correctly reduced the requirement to nought, and the bar read "Great Powers: 0 of 0"
      — a goal that could never be met. It reads `strongestCountries()` now, the same
      derivation the lock itself uses

---

## Q4 — Integration and truth

### Q4.1 Harness

- [ ] `GameDriver.newGame()` gains the goal-confirm step — one method, not seventeen files
- [ ] `GameDriver.start({ goal })` optional argument for specs that need a named goal
- [ ] `tests/support/selectors.js` derives the new selectors from `registry.js`

### Q4.2 E2E

- [ ] New `tests/e2e/goal-selection/` area with a README
- [ ] The chooser cannot be skipped; each goal shows its own description; the scale list changes
      per goal; Confirm reaches country selection
- [ ] A scenario-driven spec that a met condition fires `GAME_OVER` once
- [ ] Run `goal-selection`, `country-selection`, `turn-loop` — three areas, within the standing
      limit. **The full suite is Leigh's to schedule.**

### Q4.3 Save and load

- [ ] A save taken mid-game restores the chosen goal, its scale and its `greatPowers` list
- [ ] A loaded game's progress line is correct on the first frame
- [ ] `save-load` e2e area green

### Q4.4 Documents

- [ ] Dominapedia "Goals and Victory" page rewritten — it currently states there is no chooser
      and that nothing ends when a condition is met, both of which become false. The manual
      quotes real numbers, and no test asserts prose.
- [ ] Dominapedia "Choosing a Country" page mentions the goal chosen before it
- [ ] `docs/04-known-issues.md` item 1 closed
- [ ] `docs/02-game-design-document.md` victory section updated from "missing" to implemented
- [ ] Plan document §5 carries the measured AI numbers and §10's open questions are resolved or
      restated

### Q4.5 Q4 exit

- [ ] `npm run test:unit` green
- [ ] Three e2e areas green
- [ ] Verified in a browser: start a game under each of the five goals and reach turn 2
- [ ] Change set described for Leigh to commit, with moves and renames kept separate from
      behaviour changes
