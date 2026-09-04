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

- [ ] Unit tests first, in `tests/unit/ai-doctrine.spec.js`
- [ ] `doctrineFor(condition, { progress, turn, standings, country })` returning
      `{ kind, continentsToCommit, areaHunger, targetCountries, urgency, neverSatisfied }`
- [ ] One row per goal, per the table in the plan
- [ ] `urgency` from the strongest rival's progress (the runaway-leader response)
- [ ] `urgency` from `turn / turnLimit` for Timed Games
- [ ] Under Great Powers, `targetCountries` excludes the country itself

### Q2.2 Consumers stop switching on the condition kind

- [ ] `strategy.js chooseObjective()` reads `continentsToCommit`
- [ ] `strategy.js deriveBudgets()` scales the **attack** budget by urgency — and the siege
      budget **not at all**, or the 17→67 concurrent sieges problem returns
- [ ] `strategy.js choosePosture()` honours `neverSatisfied`
- [ ] `theatre.js` biases the mid-term rival choice towards `targetCountries`
- [ ] `targeting.js` rates a target power's homeland higher, and weights area by `areaHunger`
- [ ] No module outside `doctrine.js` reads `VictoryCondition` kinds any more

### Q2.3 Measurement — the acceptance criterion

- [ ] `tools/ai-sim.mjs` gains `--goal=KIND[:scale]`
- [ ] 150-turn headless run recorded for each of the five goals
- [ ] Each goal produces a visibly DIFFERENT world
- [ ] **No goal freezes one** — the AI's failures have no textual signature, so this is checked
      by reading the numbers, not by the suite passing
- [ ] Numbers written back into §5 of the plan document

### Q2.4 Q2 exit

- [ ] `npm run test:unit` green
- [ ] `ai-turn` e2e area green
- [ ] Verified in a browser

---

## Q3 — The chooser

### Q3.1 `src/ui/goals/goalCatalogue.js` — new

- [ ] Unit tests first, in `tests/unit/ui-goal-catalogue.spec.js`
- [ ] Five goals: names, scale options, summaries, description bodies as frozen
      `{ kind: "p" | "h" | "ul" }` blocks — never markup
- [ ] Imports nothing; runs in Node
- [ ] World Conquest's scale list holds exactly one entry

### Q3.2 `src/ui/components/GoalSelect.js` — new

- [ ] Ids in `src/ui/core/registry.js` — never hand-written selectors
- [ ] Built with `el()` / `mount()` / `on()`; `destroy()` undoes itself
- [ ] Shares `.options-scrim` / `.options-button` with Options, Save/Load and the Dominapedia
- [ ] Goal dropdown + scale dropdown left, description pane right, Confirm in the footer
- [ ] The scale dropdown repopulates when the goal changes and always shows a valid default
- [ ] **The choice is forced** — no Cancel, no scrim dismissal; Escape goes back to the main
      menu rather than skipping the screen
- [ ] No colour literal outside `:root` in `style.css`; anything new becomes a token in
      `tokens.js`, the `:root` default, **and all five non-default themes**
- [ ] `tests/unit/ui-theme.spec.js` and `ui-stylesheet.spec.js` still green

### Q3.3 Wire it into the flow

- [ ] Opens from `startNewGame()` in `ui.js` — one insertion point serves both the cold start
      and the mid-game restart
- [ ] Confirm calls `setVictoryCondition()` and drops through to country selection
- [ ] **Ordering trap**: the five great-power names must be available BEFORE the chooser
      freezes them, and must not be answered from a fill colour or an empty store
- [ ] Spectator mode is unaffected — it keeps the default condition

### Q3.4 The progress line

- [ ] `victoryProgress().label` on the phase bar, refreshed on turn change
- [ ] The advance button does not move
- [ ] Reset by New Game; correct after a load (not made correct as a side effect of the
      country-selection screen, which a load never sees)
- [ ] Hidden in spectator mode

### Q3.5 Q3 exit

- [ ] `npm run test:unit` green
- [ ] Verified in a browser at more than one theme and window size

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
