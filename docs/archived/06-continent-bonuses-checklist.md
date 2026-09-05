# Continent Bonuses — Checklist

The task breakdown for [05-continent-bonuses.md](./05-continent-bonuses.md). Breathing
document: tick items as they land, and record what was **measured** rather than what was
intended.

Four stages. **Each one ends with the game playable** — that is the house rule, and it is what
keeps a regression bisectable. Work is test-first: write the failing test, watch it fail, then
fix.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked or deferred

---

## Stage 0 — the map (done ahead of the rest)

Not a bonus, but the thing that makes a bonus legible. Asked for by Leigh alongside the plan.

- [x] The continent-view cycle is `continent -> physical -> normal`, swapping the first and
      last stops. A continent is about to be worth something, and a boundary a player has to
      go looking for is a boundary they will not plan around
- [x] `continent` is the DEFAULT view, and it is **applied** at bootstrap rather than merely
      declared. The SVG ships with plain sea-coloured strokes, so setting the variable alone
      would have put the button in one state and the map in another — the same class of
      mistake as anything made correct only as a side effect of a click
- [x] `resetContinentView()` goes back to the DEFAULT rather than to the literal `normal`,
      which are no longer the same view. Otherwise the second game of a session would open on
      a different map from the first
- [x] `DEFAULT_CONTINENT_VIEW` is named once, because three places have to agree: the module's
      initial value, the bootstrap application, and the reset
- [x] `tests/e2e/map-interaction/map-modes.spec.js` rewritten for the new order, including the
      assertion that would catch a declared-but-unapplied default — that the boundaries are on
      the MAP at start, not merely named on the button
- [x] `map-interaction` e2e area green — 30/30

---

## Stage 1 — control, derived

The pure layer. No bonus applied yet, so the game plays exactly as it does today.

### 1.1 `src/state/continents.js` — new

- [x] Unit tests first, in `tests/unit/state-continents.spec.js` — sixteen of them, written
      and watched to fail on the missing module before a line of it existed
- [x] `continentControl(territories)` — one pass, returning per continent the total, the area
      and a map of owner to `{count, area}`. The area half was not in the plan and is there
      because `worldStandings()` needs it: without it the two would have been two shapes and
      therefore two walks, which is the thing 1.2 exists to prevent
- [x] `continentsHeldOutrightBy(owner, control)` and `holdsContinentOutright(owner, continent,
      control)`. The first sorts alphabetically — a list whose order depends on which
      territory happened to be walked first is a list that reorders itself as the world
      changes
- [x] Pure: it imports **nothing at all**, takes its territories as an argument, runs in Node.
      The live, memoised view over the real store is a SEPARATE module,
      `src/state/continentBonus.js`, precisely so this one stays a function of its inputs
- [x] A besieged territory counts towards control; a deactivated one counts too. Both asserted
- [x] Zero-territory and unknown-continent cases answer `false` rather than throwing. A
      continent with no territories on it is the one worth naming: under a naive
      `held === total` it is vacuously held by EVERYBODY, which would hand all 207 countries
      a bonus

### 1.2 One definition, not two

- [x] `worldStandings()` takes its continent half from `src/state/continents.js`. It calls
      the PER-TERRITORY fold, `accumulateContinent()`, rather than `continentControl()` —
      that loop is already walking 359 territories and building two other indexes at the same
      time, so calling the whole walk would have been one definition bought with a second
      pass. A unit test asserts the two build the same map
- [x] It imports from `state/` and not from `rules/`
- [x] `tests/unit/ai-victory.spec.js` still green — thirty-eight tests
- [x] Three tests assert the two answers agree, continent by continent and country by
      country: `complete` on a `continentStandingsFor()` row, `holdsContinentOutright()`, and
      `continentsHeldOutrightBy()` against the same walk

### 1.3 Stage 1 exit

- [x] `npm run test:unit` green
- [x] `ai-turn` measured by the full-suite run at the end of Stage 3 rather than on its own.
      Stage 1 was never left in the working tree by itself, so the seed-determinism
      assertion is taken with Stages 2 and 3 in place, which is the stricter test. Nothing
      added in Stage 1 draws from `Math.random` at all
- [x] Nothing changed for a player: no caller passed a bonus yet, so every derivation
      answered exactly what it had answered before

---

## Stage 2 — the bonus

### 2.1 `src/config/balance.js`

- [x] `CONTINENT_BONUS_GOLD = 1.5` and `CONTINENT_BONUS_CAPACITY = 1.25`, each with the
      reason recorded at the site. Both provisional until Stage 4 measures them
- [x] **Two constants, not one.** Capacity compounds into gold — food capacity gates
      population, population gates productive population, productive population is the input
      to gold income — and gold compounds into nothing. Equal numbers would not be equal
      effects, and the measurement in Stage 4 has to be able to move one without the other
- [x] The existing `continentModifiers` / `goldContinentModifiers` are **untouched**. What a
      continent is worth to live on and what it is worth to own outright are two facts

### 2.2 Gold — a flow

- [x] Unit tests first, in `tests/unit/rules-economy.spec.js`. The plan named a file that
      does not exist: the economy specs are one file, not one per module. Nine tests, watched
      to fail
- [x] `EconomyContext` gains `continentBonus` AND `continentCapacityBonus`, both defaulting
      to 1, and `goldChangeFor()` multiplies by the first. **Two fields rather than the one
      the plan named**, for the same reason there are two constants: the capacities are a
      different lever from the gold, and Stage 4 has to be able to move them apart
- [x] The WALK is memoised once per change, in `src/state/continentBonus.js`, rather than the
      CONTEXT being built once per turn. The plan's shape does not survive contact with the
      four `calculate*Change()` functions: each is called per territory and each is also
      called ad hoc to cost a hypothetical purchase, so there is no single point at which one
      context could be built for the whole turn. The cache is dropped on `TERRITORY_CHANGED`
      and `TURN_CHANGED`, so a conquest is reflected on the very next ask and the map is
      walked once per change rather than once per lookup
- [x] `income.js` imports `config/` **and its own sibling `capacity.js`**, which is itself
      pure and imports only `config/`. A deliberate deviation from the letter of this item:
      the alternative was multiplying a stored capacity by hand in three places, which is two
      more definitions of "a territory's effective capacity" than this phase is allowed to
      have. Nothing in `income.js` has learnt about the store, the DOM or `ui.js`, which is
      the property the rule was protecting

### 2.3 Capacity — a ceiling

- [x] Unit tests first, in `tests/unit/rules-economy.spec.js`
- [x] `effectiveCapacityFor(territory, resource, bonus)` in `src/rules/economy/capacity.js`,
      with `CAPACITY_FIELDS` naming the three stored fields once and `bonusMultiplier()`
      holding the guard gold shares: a nonsense bonus degrades to 1, never to NaN
- [x] **DERIVED, never written back onto the territory.** The stored capacities are built at
      world creation and raised by upgrades; writing a bonus into them would need an exact
      inverse write when the continent is lost, the two would disagree the first time a path
      forgot, and a player would keep a bonus for a continent they no longer held — silently,
      because nothing compares a stored capacity against what it should be
- [x] Every reader audited. Routed through it: the three regeneration functions in
      `income.js`; `totalCapacities()`, which takes an injected `bonusFor` and is what the
      top table and the info panel's Country Summary read; both territory tooltips in
      `resourceCalculations.js`; the info panel's per-territory capacity cells, through an
      injected `capacityOf` so `columns.js` still imports nothing from the economy; and the
      AI's four capacity comparisons in `aiCalculations.js` — its farm, forest and oil-well
      scoring, and the oil ceiling it buys vehicles against. **Deliberately left on the
      STORED capacity**: `addPlayerUpgrades()`, which is the write path that raises the
      stored value by 10% a building, and `startingFoodCapacity` on a war record, which is a
      measurement of the territory's own capacity at the moment a siege began
- [x] Nothing about the bonus is in the snapshot, because there is nothing to put there

### 2.4 Why multiplying the regeneration DELTA is wrong

- [x] Recorded in the code where somebody would otherwise try it: oil, food and construction
      materials are stocks moving towards a ceiling, so a multiplier on the change makes a
      territory reach the same ceiling slightly sooner and is worth nothing within a handful
      of turns. The ceiling is the lever

### 2.5 Stage 2 exit

- [x] `npm run test:unit` green
- [x] `resources-economy` measured by the full-suite run at the end of Stage 3
- [ ] Verified in a browser: hold a small continent, watch the income and the capacities
      change on the turn it completes and change back on the turn it breaks. **Left for
      Leigh** — completing a continent as the player is not something a click-through
      reaches, and Stage 4 is where the same question is answered at scale

---

## Stage 3 — telling the player

### 3.1 The three places

- [x] The MAP tooltip names the continent and states the holding either way — "Europe: 31 of
      52 held by France" — for every territory and not only the player's, so an opponent's
      progress can be read off the map as easily as your own. It is
      `territoryTooltipLabel()` in `ui.js`, which returns HTML now rather than text. The
      info panel's territory tooltip carries the same line, drawn green when the continent
      is held whole. The WORDS are a pure function in
      `src/ui/continents/continentBonusText.js`, unit-tested in Node, so the phrasing is
      pinned where it is cheap and no e2e spec has to assert prose
- [x] The info panel's Summary tab gains the line, under Country Summary. It says "none"
      rather than disappearing: a line that appears only once a continent has been completed
      is a line that has taught nobody the bonus exists
- [!] **Stretch:** the continent map view — now the default — draws a continent held whole
      differently from one that is not. Marked stretch because the coast-line layer is a second
      SVG document with its own strokes and the tokens do not cascade into it; see
      `src/ui/siegeOverlay.js` for what that costs. **Deferred.** The three places above make
      the rule visible and legible on their own, and this is the only one that has to solve
      the second-document colour problem. It is the right first item for whoever picks the
      phase up next

### 3.2 The manual

- [x] The Dominapedia's "Goals and Victory" and "Income and Upkeep" pages carry the rule and
      the real numbers. **The manual quotes figures, so `topics.js` moves in the same change
      set as `balance.js`** — the whole War section had to be rewritten once because it still
      described a combat model that had been deleted, and none of it was caught by a test,
      because no test asserts prose. "Income and Upkeep" carries the whole rule, both dials,
      why they differ, and a per-continent table of territory counts against the
      whole-held gold multiplier; "Goals and Victory" carries the short form and the note
      that Continental Supremacy is now the one goal whose objective and whose reward are
      the same thing. Table cells are kept short, because everything but the first column
      is `nowrap`
- [x] The Oceania warning is in it: 66 island territories, the hardest continent on the map to
      complete, and worth no more than any other. A manual that lets a player discover that
      forty turns in is a manual that cost them the game

### 3.3 Stage 3 exit

- [x] `npm run test:unit` green — 931 tests across 49 files, up from 903 across 47. Nothing
      new was DRAWN, so the stylesheet and theme specs are untouched: the Summary line is a
      row in a table that already exists, and the two tooltip lines reuse colours those
      tooltips already carry
- [x] `info-panels` measured by the full-suite run
- [ ] Verified in a browser at two themes. **Left for Leigh**

---

## Stage 4 — measurement, which is the acceptance criterion

Unit tests prove the derivation. They cannot prove the game is better, and they cannot see the
failure that matters — a world that quietly stops changing while every turn completes and
nothing throws.

- [x] `tools/ai-sim.mjs --goal=KIND` run for all five goals, 150 turns, `--seed=goals`,
      default scales
- [x] **A CONTROL was run as well, and it was necessary.** The archived §5 table is not a
      usable "before": re-running today's code with both dials at 1.0 reproduces four of its
      five rows exactly and the fifth not at all — Great Powers is already 52/67% with the
      bonus off, against the 69/70% recorded there. Diffing against the recorded number would
      have credited this phase with a 25% reduction in the largest empire that it did not
      cause
- [x] The before/after table written into §6 of the plan, with a paragraph per goal
- [x] **No runaway.** Continental Supremacy's largest empire went 97 to 104, against an alarm
      set at "something like 200", and it PLATEAUS at t100 while the country count keeps
      falling. Countries surviving went 81 to 77
- [x] **Something happened.** Continental Supremacy is visibly a different game — the same
      empire reaches 101 territories by t100 where the control takes until t150 to reach 97, so
      the bonus brings the continental game forward by roughly fifty turns rather than making
      it bigger. Under World Conquest the map is identical and Mexico's ARMY is measurably
      larger from the turn it completes South America, which is the clean demonstration that an
      AI country is paid exactly as the player is
- [x] **No stall.** Read across t25/t50/t75/t100/t125/t150 rather than the last row: the leader
      flattens at 104 from t100 while the world goes on consolidating (104 countries at t100, 85
      at t125, 77 at t150). A plateau, not a freeze
- [x] **Continental Supremacy watched hardest** — it is the only goal the bonus moved, which is
      what §3 predicted and is the point of having built the doctrine layer
- [!] **Three goals were not affected at all, and the dials are NOT being raised because of
      it.** Domination, Great Powers and Timed Game finish with zero continents completed —
      nearest 94%, 80% and 71% — so they are byte-identical to their controls. The bonus pays
      only on completion, so its SIZE cannot change a world that never completes one; raising
      it would amplify Continental Supremacy alone. What holds those three back is the
      register's oldest open item, that attacking is too hard for the world to consolidate,
      and the last five territories of a continent are the hardest five on the map to take
- [x] `CONTINENT_BONUS_GOLD` stays at **1.5** and `CONTINENT_BONUS_CAPACITY` at **1.25**. §3
      now says they are measured and retained rather than a defensible guess
- [x] `docs/02-game-design-document.md` §11 item 9 closed, and §3.6 written where the mechanic
      belongs — the two dials, why there are two, why it is derived, why it is not a die, the
      per-continent table and the Oceania warning
- [x] `docs/04-known-issues.md` updated with the two things the measurement turned up: **BI**,
      three sources disagreeing about which continent a territory is on (Easter Island), and
      **BJ**, a large empire's army total going hugely negative — the second found only because
      a control was run, and demonstrably not caused by this phase

### 4b. What was built to make the measurement possible

Leigh's instruction, and the reason none of the above is a browser check: *"we need to devise
specs that can measure if these are working, as i wont check these in a playthrough test as
they are too far in."*

- [x] `window.__game.continents()` — who holds what, the same walk the rule reads — and
      `window.__game.economyFor(territory)` — one territory's derived income and EFFECTIVE
      capacities, with both multipliers stated and the STORED capacities alongside so a spec
      can prove nothing was written back. Neither could be answered from any existing hook,
      because the bonus is derived and stored nowhere
- [x] `tests/e2e/resources-economy/continent-bonus.spec.js` — nine specs, area green at 20/20.
      The bonus is withheld while one territory is missing; both multipliers land exactly on
      the turn a continent completes; the stored capacity is never written to; the bonus is
      withdrawn the moment a territory is lost; an AI country is paid identically; a save/load
      round trip preserves it; and the model's six continents sum to 359 with nobody holding
      one outright at the start of a game
- [x] `tools/ai-sim.mjs` reports `cont` and `best` on every sampled turn. Both are needed: a
      run stuck at "0 complete, 41%" and one stuck at "0 complete, 96%" are different findings
      and every other column shows them the same

---

## Stage 5 exit

- [x] `npm run test:unit` green
- [x] The FULL suite was run once at the end of Stage 3, at Leigh's instruction: 457 tests,
      452 passed, 4 failed, 1 skipped. All four failures were the map-tooltip specs asserting
      the exact string Stage 3.1 deliberately changed; they now address the owner line and the
      continent line separately, which is why `territoryTooltipLabel()` renders each fact in
      its own `<div>` rather than joining them with a `<br />` that contributes nothing to
      `textContent`
- [x] Three e2e areas green afterwards — `resources-economy` (20/20, including the nine new
      continent-bonus specs), plus `map-interaction` and `ai-turn`
- [x] Verified by MEASUREMENT rather than in a browser, which is Leigh's call and the right
      one: completing a continent is forty turns of play away. §4b above is what replaced it
- [x] Change set described for Leigh to commit, with moves and renames kept separate from
      behaviour changes

---

## What comes after this

**The over-extension counterweight.** Leigh's call was to keep it out of this phase so that
each can be measured on its own, but the two are one idea: a bonus for CONSOLIDATED land and a
cost for SCATTERED land is what turns expansion from a habit into a decision. The Dominapedia's
Design Notes already names it as "the one design tension worth naming", and the dials chosen
here were chosen knowing it is coming.
