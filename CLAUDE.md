# CLAUDE.md

Guidance for working in this repository.

## What this is

A browser-based single-player turn-based world-conquest strategy game. Plain ES modules, no
framework, Vite for dev/build. **There is no server-side game logic and no multiplayer**,
despite the repository being named `OnlineRiskGame`.

## Read first

Before any non-trivial change, read the relevant document in [docs/](./docs/):

- [docs/01-codebase-audit.md](./docs/01-codebase-audit.md) — architecture and the catalogued
  defects with file/line references. **Check here before "fixing" something odd** — it is
  probably already logged, with the reason.
- [docs/02-game-design-document.md](./docs/02-game-design-document.md) — what each mechanic
  does, and what is implemented vs. missing.
- [docs/03-e2e-test-plan.md](./docs/03-e2e-test-plan.md) — functional areas and the test
  harness.
- [docs/04-known-issues.md](./docs/04-known-issues.md) — the live defect register:
  every issue found so far, its status, where it is in the code **today**, and the phase that
  closes it. This is the one that stays current; the audit is the analysis behind it.
- [docs/05-economy-audit.md](./docs/05-economy-audit.md) — **the current phase.** What the
  economy is, which five places it actually reaches the military and the dice, the measured
  numbers behind every claim, and the split between defects (**E1–E7**, the economy not doing
  what the code says) and design (**D1–D8**, the economy doing exactly what it says and
  producing no decision). §5 is the list of what is RIGHT and must survive the phase. Its task
  breakdown is [docs/06-economy-checklist.md](./docs/06-economy-checklist.md).

The numbered documents are **breathing** — they are edited as work lands and describe the code
as it is today. Finished plans move to [docs/archived/](./docs/archived/README.md) rather than
going stale in the sequence: the eight-phase
[refactor plan](./docs/archived/03-refactor-plan.md), the
[battle overhaul](./docs/archived/battle_overhaul.md) and its checklist,
[Goals and Victory](./docs/archived/05-goals-and-victory.md) and its checklist, and
[Continent Bonuses](./docs/archived/05-continent-bonuses.md) and its checklist are there. They
record why the code is shaped as it is, but they do not describe outstanding work — where one
contradicts a numbered document, the numbered document wins. **The numbers are reused when a
plan is archived**, so `05` and `06` are the current phase and the archived pair keep the
numbers they were written under.

One thing in the archived Goals and Victory is still live rather than historical: its §5 table
of 150 headless turns per goal is the **acceptance criterion for any change to `src/ai/`**, and
the archived Continent Bonuses §6 is the before/after METHOD that criterion is applied with —
the control run, and the reason a slow economic mechanic cannot be judged by playing.

## Commands

```bash
npm run dev            # Vite dev server, port 3000
npm run build          # production build -> build/
npm run preview        # serve build/ on port 4173
npm run lint           # ESLint (baseline: 81 errors, 290 warnings)
npm run format         # Prettier (legacy root sources are ignored on purpose)
npm run test:unit      # Vitest, 884 tests, ~1.5s
npm run test:e2e       # Playwright, ~420 tests, 4 workers headless, ~7-14 min
node tests/run-e2e.mjs --list            # list the functional areas and their spec counts
node tests/run-e2e.mjs turn-loop         # one area
node tests/run-e2e.mjs attack turn-loop  # several areas, one run
npm run test:e2e:slow  # one visible browser, 500ms between actions
node tools/econ-lab.mjs                  # the economy, measured: income spread and the
                                         # 44.44 gold floor, the quadratic upgrade ladder and
                                         # what a farm pays back, unit value per gold, and the
                                         # cons-mats bottleneck. Takes a section name to narrow
                                         # it: income | upgrades | units | consmats
npm run build:data     # regenerate adjacency.json + pathAreas.json + music/tracks.json
npm run build:music    # just the music folder listing (Vite also does it on start/build)
```

## House rules

1. **Follow the refactor plan's phase order.** Each phase must end with the game playable.
   No big-bang rewrites.
2. **Leigh handles all git commits and pushes.** Do the work, leave it in the working tree,
   and say what would go in the commit. Staging to help review is fine; committing is not.
3. **Keep bug fixes separate from moves and renames** when describing a change set, so a
   regression stays bisectable.
4. **Work test-first.** Write the failing test, watch it fail, then fix. Known-broken
   behaviour is `test.fixme` with a comment explaining why and what unblocks it — never
   deleted, and never asserted as correct.
5. **Do not run `prettier --write` over the legacy root sources.** They are in
   `.prettierignore` deliberately; reformatting 18,000 lines destroys blame right when it is
   needed most. Files come off that list as they move into `src/`.
6. **Do not "fix" a lint warning in passing.** The baseline is recorded. Fix them as part of
   the phase that owns that file.
7. **Verify in a browser, not just by reading.** This codebase has behaviour that only shows
   up at runtime (see the implicit-global gotcha below). `npm run dev` and click through.

## Gotchas specific to this codebase

- **History was rewritten on 2026-08-23** (refactor Phase 0.7). Every SHA before `184ccbc`
  changed. Any clone or branch taken before that date has an unrelated history and cannot be
  merged — re-clone instead. The pre-rewrite history is preserved in
  `../_backup-OnlineRiskGame-<timestamp>/pre-rewrite-all-refs.bundle`.
- **Cloning on Windows needs `core.longpaths`.** `resources/vecteezy_flat-world-map-…_2065080/`
  produces 123-character paths, which breaches `MAX_PATH` when cloned into a deep directory —
  the clone succeeds but the checkout fails. `git config --system core.longpaths true`, or
  clone somewhere shallow.

- **`dist/` is not the build output.** It holds committed webpack UMD bundles that set `CANNON`,
  `THREE` and `BufferGeometryUtils` as globals. Vite writes to `build/`. Never point a bundler at
  `dist/`. Since B.10.3 they are no longer in `index.html` — `src/platform/vendor/diceRuntime.js`
  injects them on the first dice roll.
- **Asset paths are hand-written strings.** ~100 places do
  `"resources/flags/" + country + ".png"` at runtime. No bundler rewrites those, which is why
  `vite.config.mjs` copies `resources/` into the build verbatim. Moving `resources/` means
  editing every one of those strings.
- **A continent held whole pays, and the payment is DERIVED.** `src/state/continents.js` is
  the pure walk — `continentControl()`, `holdsContinentOutright()`, `continentsHeldOutrightBy()`
  — and it imports nothing at all, so it runs in Node and takes its territories as an argument.
  `src/state/continentBonus.js` is the live half: it memoises that walk over the real store and
  drops the cache on `TERRITORY_CHANGED`, on `TURN_CHANGED`, and whenever the territory COUNT
  changes (which is what covers the bootstrap window, since `seedTerritories()` emits nothing).
  Six things follow. **There is ONE definition of holding a continent**: `worldStandings()` in
  `src/ai/victory.js` folds through `accumulateContinent()` rather than rebuilding the map, so
  the economy's bonus and the CONTINENTAL victory condition cannot drift — and it uses the
  per-territory fold rather than the whole walk because that loop is already walking 359
  territories and building two other indexes. **It lives in `state/` and not in `rules/` or
  `ai/`**: `src/rules/victoryCheck.js` already imports `src/ai/victory.js`, so an `ai → rules`
  edge would close a package-level cycle. **The bonus is NEVER written onto a territory** —
  `effectiveCapacityFor(territory, resource, bonus)` in `src/rules/economy/capacity.js` derives
  it at the point of use, because a stored bonus would need an exact inverse write when the
  continent was lost and a player would keep a bonus for a continent they no longer held,
  silently. **There are TWO dials and that is not a rounding of taste**: `CONTINENT_BONUS_GOLD`
  (1.5) multiplies a FLOW, `CONTINENT_BONUS_CAPACITY` (1.25) multiplies three CEILINGS, and the
  ceilings compound into the gold a few turns later while the gold compounds into nothing —
  never multiply the regeneration DELTA instead, which makes a territory reach the same ceiling
  slightly sooner and is worth nothing within a handful of turns. **The bonus arrives in the
  ECONOMY CONTEXT**, exactly as the random event does, so `income.js` stays a pure function of
  `(territory, context)`; `economyContext()` in `resourceCalculations.js` is where the world is
  asked. And **a continent is the ORIGINAL OWNER's continent, from `initialData.js`** — never
  the `continent=` attribute on the SVG path, which disagrees about Easter Island (Chilean, so
  South American to the game and Oceanian to the map data). The model's counts are Asia 87,
  Oceania 65, Africa 59, Europe 52, South America 49, North America 47; known-issues **BI**.
- **The continent bonus is measured, not eyeballed.** It is derived and stored nowhere, and it
  sits forty turns into a playthrough, so nobody reaches it by clicking. `window.__game`
  therefore has two accessors that exist only for that: `continents()` (who holds what, the
  same walk the rule reads) and `economyFor(territory)` (one territory's derived income and
  EFFECTIVE capacities, with both multipliers stated and the STORED capacities alongside so a
  spec can prove nothing was written back). `tests/e2e/resources-economy/continent-bonus.spec.js`
  is the end-to-end measurement and `tools/ai-sim.mjs` reports `cont` (continents complete) and
  `best` (how far along the nearest one is) on every sampled turn — a run stuck at "0 complete,
  41%" and one stuck at "0 complete, 96%" are different findings.
- **The continent view is the DEFAULT, and the cycle is `continent → physical → normal`.**
  Swapped as the opening move of the continent-bonus phase: a continent is now a thing a player
  wins something for holding, and a boundary a player has to go looking for is a boundary they
  will not plan around. Three consequences. The default is **applied** at the end of
  `svgMapLoaded()` rather than merely declared — the SVG ships with plain sea-coloured strokes,
  so setting `continentView` alone would put the button in one state and the map in another,
  which is the same species of mistake as anything made correct only as a side effect of a
  click. `resetContinentView()` goes back to `DEFAULT_CONTINENT_VIEW` and **not** to the literal
  `normal`, which are no longer the same view — otherwise the second game of a session opens on
  a different map from the first. And `DEFAULT_CONTINENT_VIEW` is named once because three
  places have to agree about it.
- **The map is three modules under `src/ui/map/`** (Phase 6.7). `camera.js` owns zoom and pan:
  zoom is **instant** (no animation, so no latch that drops a fast second wheel event),
  anchored on the pointer in user coordinates, and clamped to the world bounds so nothing off
  the edge of the map can be shown. `colouring.js` owns the bootstrap palette and the
  locked-country muting. `MapView.js` renders the map from the store — `repaintMap()`,
  `repaintCountrySelection()`, `paintLockedCountries()`. **`currentMapColorAndStrokeArray` and
  the `saveMapColorState()` / `restoreMapColorState()` pair are gone**: colour is derived, so
  restoring the map is the same call as painting it. Never reintroduce a colour snapshot.
- **The attack marker and its target are one fact**, in `src/ui/map/markers.js` (Phase 6.7,
  closes audit §5.2 AE). `setAttackTarget(path)` draws the marker, `clearAttackTarget()`
  removes it, and there is no way to do one without the other. `territoryAboutToBeAttackedOrSieged`
  is gone; read it with `attackTargetPath()`. Cancelling an attack un-arms it completely — the
  target, the marker, the highlight and the button all go.
- **The move button's label is derived, not written.** `deriveMoveButtonState(selection)` in
  `src/ui/moveButton/` is pure and unit-tested; `applyMoveButtonState()` is the only thing that
  touches the element. Its click, mouseover and mouseout listeners are installed **once**, from
  bootstrap — they used to be re-attached on every territory selection, and
  `removeEventListener` could not remove the previous one because each call built a new
  function object, so a click fired once per selection made. That is what `eventHandlerExecuted`
  and the four `setTimeout(…, 200)` calls were hiding, and all of it is gone.
- **`generateDistinctRGBs()` in `src/ui/map/colouring.js` is dead code that is still called on
  purpose.** Its `Math.random` draws at module load are on the game's stream, so deleting it
  shifts every seeded outcome — measured: four exact-outcome specs change. Removing it and
  re-baselining those specs is one Phase 7 change. The same warning applies to anything else
  that adds or removes a `Math.random` draw during bootstrap.
- **Themes are data, and the stylesheet never learns their names.** `src/ui/theme/` holds the
  token vocabulary (`tokens.js`), the catalogue (`themes.js`) and the applier (`theme.js`).
  Applying a theme writes its tokens onto the root element as inline CSS custom properties,
  so `style.css` only ever reads `var(--surface-panel)` and adding a theme is one entry in
  `themes.js` and **no CSS at all**. Three rules follow from that: the `:root` block in
  `style.css` IS the default theme, which is why `command` is deliberately given no tokens —
  never write a second copy of those values in JS; every OTHER theme must define every token,
  because a half-filled palette inherits the previous theme's colours and produces things
  like white text on a cream panel (`tests/unit/ui-theme.spec.js` fails the build if one is
  incomplete); and a token is not only a colour — `--radius`, `--border-width`,
  `--font-display`, `--display-tracking` and `--display-transform` are what stop five themes
  looking like one design in five hues. `data-theme` on `<html>` is for e2e assertions and
  for the rare rule a token cannot express; never read it to decide a colour.
- **The main menu's classes are semantic, not positional.** `.option-3` / `.option-4` /
  `.option-5` are gone — they were named for where they sat, so adding Options as a sixth item
  meant renaming rules. It is `.menu-panel` / `.menu-brand` / `.menu-title` / `.menu-button`
  now, `#menu-container` centres with flex (so `mainMenu.show()` sets `display: flex`, not
  `block`), and the title and subtitle are an `<h1>` and a `<p>` rather than two `<td>`
  elements outside any table. `isPlaying` / `isNotPlaying` on `#toggle-music-btn` are
  untouched: `music.js` owns the audio element and writes them itself.
- **Every element id and selector lives in `src/ui/core/registry.js`** (Phase 6.1), and both
  the app and the e2e page objects import it — `tests/support/selectors.js` is a derived view
  of it and holds no literal selector. Never hand-write an id or a `#selector`: add it there.
  Element construction goes through `src/ui/core/dom.js` — `el()`, `mount()`, `on()` — whose
  `on()` returns its own remover, which is what lets a component undo itself in `destroy()`.
- **The UI is components now** (Phase 6.3): the files under `src/ui/components/`, each
  `create()` + `destroy()` and, where it follows store state, `update()`. The
  `DOMContentLoaded` block in `ui.js` is the list of `create()` calls plus the handlers that
  belong to the turn loop. `PhaseBar` is the one that subscribes to `state/events.js` today
  (`PHASE_CHANGED` drives its title and button label, so `setPhase()` is the only call a
  phase transition makes); the others carry a note saying what has to become state first.
  `BuyWindow` and `UpgradeWindow` are two specs over one `ResourceWindow` builder.
- **The Dominapedia is the manual, and its catalogue is data** (Phase 7.6). The main menu's
  Help button is gone: it is `dominapediaBtn` now, and it opens a full-screen window built by
  `src/ui/components/Dominapedia.js` from `src/ui/dominapedia/topics.js` — seven main topics,
  twenty-nine sub-topics, all frozen, importing nothing and touching no DOM. Writing a page
  is one entry in `topics.js` and no change to the component. **The manual quotes real numbers,
  so a balance change is a `topics.js` change**: the whole War section was rewritten after the
  dice model shipped because it still described the deleted five-round skirmish model — a 65%
  per-skirmish cap, a matchup matrix that nothing reads any more, rout at 5%, and a free retreat
  "between rounds" that has not existed since the round limit went. A manual that is confidently
  wrong is worse than no manual, and none of it was caught by a test, because no test asserts
  prose. **Table cells are `white-space: nowrap` except the first column**, so a cell carrying a
  sentence forces the whole table into a horizontal scroller — keep them short and put the
  explanation in a paragraph. **A body is BLOCKS**
  (`{ kind: "p" | "h" | "ul" | "todo" }`), never markup — content that carried HTML would carry
  the panel's styling decisions with it. **Previous / Next walk sub-topics and WRAP**, so
  neither is ever disabled; the walk is pure and `tests/unit/ui-dominapedia-topics.spec.js`
  owns it, which is why nothing in `tests/e2e/dominapedia/` asserts what a page says or what
  order the pages are in. **The panel itself must never scroll** — it is a fixed height with
  `overflow: hidden` and the two columns each own their overflow, which is what keeps the
  title bar and the two navigation buttons on screen; an e2e spec fails if that changes.

- **The bare-identifier gotcha is closed.** `tooltip` and `uiTable` used to resolve to
  `window.tooltip` / `window.uiTable` because elements with those ids existed. `tooltip` is
  now an imported handle from `src/ui/components/Tooltip.js` (which creates the element —
  it is no longer in index.html), and `uiTable` is reached through the registry. Do not
  reintroduce the pattern; ESLint flagged every one of those sites as `no-undef`.
- **The module graph is still circular**, but the three `setTimeout(..., 1000)` races that
  used to paper over it are gone (Phase 1.7). Static imports work because the symbols involved
  are hoisted function declarations. Do not add more module coupling, and never reintroduce a
  timer to "wait for" an import.
- **The AI has a plan now, and it comes from the victory condition.** `src/ai/victory.js`
  defines the four conditions the Dominapedia's "Goals and Victory" page designs and
  measures every country's progress towards the active one; the default is CONTINENTAL at
  three continents. `src/ai/strategy.js` turns that into a per-country CAMPAIGN each turn —
  three committed continents, a focus continent, a posture (DEVELOP / EXPAND / CONSOLIDATE
  / DEFEND) and two budgets — and `src/ai/targeting.js` rates each candidate target and
  returns ONE verdict. Four consequences. **Commitments are sticky**: reviewed every
  `CAMPAIGN_REVIEW_INTERVAL` turns and abandoned early only when pointless, because a plan
  re-chosen every turn is not a plan. **Budgets count the sieges already running**, which
  is what ended the 17-to-67-concurrent-sieges problem — a country at its cap opens none.
  **The two coin flips in `getPossibleTurnGoals()` are gone**; a pairing produces a Siege
  or an Attack or neither, never both. And **the campaign carries per-turn scratch**
  (`ratings`, `decisions`) rather than the goal rows carrying it, because the rows are
  positional arrays that get rebuilt and spread twice during refinement. Changing the
  victory condition is `setVictoryCondition()` and nothing else — the AI adapts for free,
  which is the whole reason the objective is derived rather than hard-coded.
- **`src/ai/doctrine.js` is the ONLY module in `src/ai/` allowed to switch on a victory
  condition kind** (Goals and Victory, Q2). It turns the active condition into the small set
  of dials the other modules already think in — `continentsToCommit`, `areaHunger`,
  `targetCountries`, `urgency`, `neverSatisfied` — whose rows live in `goalDoctrines` in
  `balance.js`, so a goal's character is a balance edit rather than a code edit. Before it,
  `chooseObjective()` was the only place the condition was read and all it did was map the
  kind to a continent count, so a Great Powers AI campaigned for two arbitrary continents and
  never looked at a great power in its life. Four things follow. **`urgency` scales the
  ATTACK budget and nothing else**, and the module deliberately exposes no siege dial so that
  it cannot reach the other one — the siege budget subtracting the sieges already running is
  what ended the 17-to-67 problem, and a multiplier over that cap walks straight back into
  it; a unit test asserts no key here matches `/siege/`. **Urgency is the strongest RIVAL's
  share of the world's land**, found from the two largest shares in one pass over standings
  that already exist and memoised on the standings object — asking `victoryProgress()` for
  every rival of every country would be 207×207 map walks a turn. It is what makes a player
  who pulls ahead get attacked harder by the whole world. **A Timed Game takes its urgency
  from the clock instead**, because there is nothing to conserve on the last turn. And
  **`theatre.js`'s preference for a named rival is a sort TIER, not a term in the score**: a
  great power is by definition one of the strongest countries on the map, so it scores near
  zero on `weakness` — the heaviest term in `rankRivals()` — and no bias small enough to be a
  bias ever lifted it above a convenient small neighbour, while one large enough to lift it
  would also lift a hopeless rival the goal never named. Walls still sort last, which is the
  escape that makes the top tier safe to have.
- **Measured, per goal, over 150 headless turns** (`tools/ai-sim.mjs --goal=KIND[:scale]`).
  The five goals produce visibly different worlds — 78 to 114 countries surviving, a largest
  empire of 51 to 97, a top-sixteen share of 65% to 81% — and none of them freezes one. The
  full table and a paragraph per goal are in
  [docs/archived/05-goals-and-victory.md](./docs/archived/05-goals-and-victory.md) §5. That measurement is the
  acceptance criterion for any change to `src/ai/`, because the failure it catches has no
  textual signature: nothing throws, every turn completes, and the map quietly stops changing.
- **`leadingCountry()` and `closestToVictory()` answer different questions and are not
  interchangeable.** The first is the largest empire by land, which is the TURN_LIMIT win
  condition and nothing else; the second is the country closest to whatever condition is
  actually in force, and it is what "who is winning" means under the other four. Under Great
  Powers the biggest empire on the map need not be the one nearest to breaking three of them.
- **A country's own progress label is not always a sentence about a LEADER.** Under
  TURN_LIMIT, `victoryProgress()` reads "Largest empire: N% of the leader" — a comparison
  against the leader — so applied to the leader it says "100% of the leader" every turn of
  every game, whoever is winning and however far ahead. `describeLeaderProgress()` in
  `src/ui/goals/goalCatalogue.js` is the one place that knows this, and it substitutes the
  two facts that actually decide a timed game: what the leader holds and how much clock is
  left. Anything else that describes a front-runner has to go through it.
- **The AI's MID-TERM goal is a theatre, and it is what makes the world consolidate**
  (Phase 7.8). `src/ai/theatre.js` commits each country to absorbing ONE neighbouring
  country, keeps the commitment while it takes ground, and writes the rival off as a WALL
  when it stalls — at which point a different neighbour is chosen. Walls decay. Three things
  follow. **A posture must never guarantee its own preconditions**: `choosePosture()` used to
  send any country under four territories to DEVELOP, which on a map of 207 mostly
  one-territory countries disqualified 93% of the world from expanding and thereby kept it
  small — the world froze at 163 countries with the largest empire never growing past 30
  (known-issues **BA**). Being small is a reason to expand now, and DEVELOP is time-boxed.
  **A fighting posture always gets at least one attack**: the budget rounded to zero for most
  of the world, so the budget rather than the odds was deciding that nothing happened. And
  **the executor must send what the planner planned with** — `src/ai/commitment.js` sizes the
  force by asking the real probability function about the force being SENT, against a
  garrison derived from the strongest enemy that can reach the territory. Never reason about
  what a territory can spare from a threat SCORE: that is a difference between two armies
  inflated by personality, it sits near zero between comparable neighbours, and using it
  produced 208 sieges decided and none laid.
- **A front-line territory that is short of force ASKS, and the interior answers next turn.**
  `src/ai/muster.js` — infantry only (vehicles are gated by the oil capacity of wherever they
  stand), one hop between neighbours, and never out of a border that needs it. It is the only
  thing in the AI that adapts across turns rather than within one, and it is what lets a
  country attack with more than whatever one border province could raise alone. A cancelled
  attack is therefore not always a failure: `reasonCode` distinguishes `no-force` (a fact
  about this turn — never remembered) from `below-floor` (a fact about the two armies —
  remembered as a setback) from `needs-more-force` (a requisition). Recording the first kind
  as a defeat was measured and took the world's conquests to **zero** within ten turns.
- **`tools/ai-sim.mjs` is how any change to `src/ai/` is judged.** A hundred headless turns in
  about two minutes: countries surviving, the largest empire, the share held by the top
  sixteen, conquests, failed attacks, sieges — and with `--diagnose`, every country's posture,
  budgets, verdicts and the commonest reasons a target was skipped. The AI's failures have no
  textual signature: nothing throws, every turn completes, the unit suite passes, and the map
  quietly stops changing. Do NOT edit source files while a run is in flight — Vite's HMR
  reloads the page, `window.__game` goes with it, and the run dies looking exactly like a game
  defect.
- **The campaign table and the victory condition are a save slice**, registered from
  `aiCalculations.js` and NOT from `src/ai/`, so those modules keep importing only
  `config/` and `state/` and keep running in Node. The theatres and the reinforcement
  demands ride inside that same slice rather than registering their own.
- **Numpad `/` opens the AI debug window** (`src/ui/components/AiDebugPanel.js`): one
  collapsible section per country showing its objective, progress, posture, budgets, odds
  floors, ranked plan, and every target it weighed with the REASON it acted or did not.
  `src/ai/planRecord.js` is the bounded ring behind it, filled by `planLog.js`. It has no
  button anywhere on purpose — map chrome that opens a debug view is map chrome a player
  will click — and it renders only while open, so an AI turn does not pay for it.
- **A new game opens on the GOAL CHOOSER, and the choice is forced** (Goals and Victory, Q3).
  `src/ui/components/GoalSelect.js` renders `src/ui/goals/goalCatalogue.js`, which is frozen
  data that imports almost nothing and is unit-tested in Node — the same arrangement the
  Dominapedia has with `topics.js`, so adding a sixth goal is one entry there, one row in
  `goalDoctrines`, and no change to the component. Six things follow. **There is no Cancel
  and no scrim dismissal**; Escape goes BACK to the main menu rather than skipping the
  screen, because a player must be able to change their mind about starting a game but not
  to start one with no goal. **`conditionFor()` is the one place that knows which FIELD a
  scale belongs on** — nothing that renders a dropdown ever names `landShare` or
  `turnLimit`, because that mistake is silent: a Domination game with its share written into
  `continentsRequired` is a valid condition object that plays as the default game. **The
  scale options carry INDEXES, not values**, because the DOM stringifies an option's value
  and Domination's `0.6` came back as `"0.6"`, matched nothing in the tier list, and would
  have handed every game the default scale without a word. **The panel is a fixed `height`
  and never scrolls itself**, with the description column owning the overflow — a box that
  resizes as the player browses reads as a rendering fault and moves the Begin button while
  somebody is reaching for it. **No dropdown may be truncated**: a flex item will not shrink
  below its own content unless told it may, so `min-width: 0` is what keeps a `<select>`
  inside its column, and the column is then sized from the longest label in the catalogue —
  measured, not guessed. And **the ORDERING TRAP**:
  `greyOutTerritoriesForUnselectableCountries()` must run before the chooser opens, because
  a GREAT_POWERS condition freezes the five locked countries into itself. `strongestCountries()`
  in `ui.js` is the one derivation both the lock and the condition read, which is where
  `COUNTRY_GREYOUT_RANK` and `GREAT_POWERS_REQUIRED` are reconciled — never read those names
  back from a fill colour, and never from the locked SET, which is cleared once a game
  begins (that is what made a Great Powers game read "0 of 0" and be unwinnable).
- **The phase bar carries the victory-progress line**, `victoryProgress().label` verbatim, so
  the player and the country trying to beat them cannot be looking at two different numbers.
  It lives INSIDE the collapsible section, which is what keeps the promise that the advance
  button never moves — the bar is bottom-anchored with a content height, so anything added
  grows it upwards. `refreshGoalLine()` is called from `TURN_CHANGED` and, as an ADDRESSED
  write, from both `initialiseGame()` and `resumeSavedGame()`: a save taken on turn 1 and
  restored over a fresh game at turn 1 changes no turn and emits no event, and a loaded game
  never sees the country-selection screen that would otherwise have made it right.
- **"AI Game" on the main menu is SPECTATOR MODE, and the whole of it is `src/debug/`.**
  A game with no player in it: `initialiseGame({ spectator: true })` skips the one loop
  that assigns territories to `Player`, and because `updateArrayOfLeadersAndCountries()`
  collects every country whose territories are not the player's, that alone hands all 207
  to the AI. Four things follow. **The two player phases stop waiting because
  `waitsForPlayer` is a GETTER** on those steps in `gameTurnsLoop.js` — the engine reads
  the property each time it reaches the step, so asking `isAiGameActive()` there is what
  makes the loop run by itself; do not "fix" it by having a timer click the phase button,
  which is a race between a timer and a phase. **The CPU leaders and the starting forts
  are created BEFORE the engine starts**, which is the opposite of a played game and is
  deliberate: nothing blocks, so the AI phase is reached in the same tick and a country
  without a leader would throw. That makes spectator turn 1 a slightly stronger opening
  than a played turn 1, so **this mode is not a way to measure balance** —
  `tools/ai-sim.mjs` is. **`stopAiGameMode()` must be called before
  `getTurnEngine().reset()`**, never after: `stop()` waits for the running step to return
  and the AI step is blocked in the pacing gate, so stopping the mode is what releases it.
  **The speed slider is a track of POSITIONS, not seconds**, in two geometric halves
  pinned to three anchors — five hundred countries a second at the left, one second dead
  centre, five seconds at the right. A linear track in seconds would bury the whole
  readable range in its first pixel, because the span is a factor of two and a half thousand and the
  pace anybody watches at sits a five-hundredth of the way along it.
  And **the console is a flat append-only log, not the activity feed** — the feed's
  collapsible per-turn sections are the wrong shape for watching, so a turn is a rule
  ACROSS the log, the DOM is trimmed from the front to the same bound the ring uses, and
  the country filter hides rows in place (`src/debug/aiGameFilter.js`: three characters
  minimum, substring, case-insensitive) rather than re-rendering. **Clicking a territory
  filters the log to whoever owns it**, read through `pathCountry()` so it is the CURRENT
  owner: the map is the index into a log where a country's block appears once a turn among
  two hundred others.
- **A spectated game has to do the two things a played game does at CONFIRM.** Both were
  found by watching one. `pushColorsToMainArray()` copies the map's fills into each
  territory's `countryColor`, and until it runs `setColorOnMap()` refuses to paint —
  correctly, since it used to paint the word "undefined" and render the territory black —
  so every conquest logged a warning and **the map never changed colour again**. And the
  selection lock has to be repainted away as well as cleared, or the five strongest
  countries spend the run in the muted form of their own colour. Both calls are in
  `startAiGame()`. The same question applies to anything else the confirm handler does:
  a spectated game reaches none of it.
- **A spectated game draws its goal at RANDOM and says so across the top.** Leigh's call: a
  debug mode pinned to the default condition would only ever exercise the default condition,
  which is precisely the claim the doctrine layer makes about the other four. The draw is
  `Math.random` and not `cosmeticRandom()` — the goal is a rule of the game and not a
  decoration, so it belongs on the seeded stream and `?seed=` reproduces a world including
  what it was played for. `src/ui/components/AiGameGoalBar.js` fills the strip
  `applySpectatorChrome()` leaves empty when it takes the player's top table down; it wears
  `--debug-surface` / `--debug-ink` like the rest of the debug chrome, and it follows
  `TURN_CHANGED` only, because the leader can change no more often than that.
- **The spectator log states all three horizons, and the middle one even when it is empty.**
  `buildCountryReport()` prints a `Playing for` line (the goal, this country's progress, its
  urgency, and under Great Powers the powers it is hunting) above the `Objective` and
  `Absorbing` lines. `Absorbing` is printed even when there is no theatre, because in a log
  of two hundred countries a turn a silent line and a country that was never asked look
  identical — and "nothing reachable to campaign against" is itself the answer to why an
  island does nothing for fifty turns.
- **The faded, shrunken AI siege marker exists to make the PLAYER's sieges stand out, so
  it is switched off when there is no player.** `src/ui/siegeOverlay.js` asks
  `isAiGameActive()`. Applied in spectator mode it faded every marker on the map to 40% at
  60% size, which read as no markers at all while the console said sieges were being laid.
  A marker also has a floor (`MIN_MARKER_SIZE`): the size is a fraction of the territory's
  bounding box, which is right for Sweden and gives an island a shield one screen pixel
  across.
- **`--debug-surface` and `--debug-ink` are the one token pair every theme repeats
  verbatim.** They are what makes the AI Game button yellow-on-black in all six themes.
  They are tokens only because `style.css` may not carry a colour literal outside `:root`;
  do not "harmonise" them with a palette, because a debug control that matches the theme
  is a debug control somebody ships.
- **Combat is the DICE MODEL now** (battle overhaul B.1–B.9; see
  [docs/archived/battle_overhaul.md](./docs/archived/battle_overhaul.md) and its checklist). One press of the
  advance button is one ROUND: `share` (force only) picks how many dice each side rolls from a
  band table, terrain and composition become named modifiers, sorted dice pair high against high,
  **ties go to the defender**, dice the other side cannot match are automatic hits, and each lost
  pairing costs 10% of that side's current force. Rounds run until a side falls below
  `BREAK_THRESHOLD`. `src/rules/military/battleModel.js` is the whole of it and it is pure with an
  injected rng; `src/rules/military/dice.js` under it knows nothing about this game.
  **`src/rules/military/battle.js` — the five-round skirmish model — is DELETED** (B.10.1),
  along with the three `balance.js` constants that served only it: `SKIRMISH_ODDS_CAP`,
  `BATTLE_ROUNDS` and `battleOutcomeThresholds`. `UNIT_MATCHUP_EFFECTIVENESS` deliberately
  survives as the data the composition modifiers are derived from.
- **THE PLAYER AND THE AI FIGHT THE SAME BATTLE.** `doAttack()` in `aiCalculations.js` used to be
  a second, unrelated model (a `while` loop grinding two combined forces at one flat probability,
  in chunks of 1000/100/10/1). It is gone: the AI calls the same `resolveBattle()` headlessly.
  Never reintroduce a separate resolver "for speed" — that divergence is what made every
  measurement of the game measure one of two systems at a time.
- **There are TWO attack dials and that is PERMANENT** (settled at B.10.4, one of two
  decisions Leigh took). `ATTACK_ADVANTAGE` (1.44) owns sieges through `scoreDifferenceFor()`
  and the pre-battle odds figure; `DICE_ATTACK_ADVANTAGE` (1.0) owns open battle. They are not
  two settings of one thing: a dial multiplying a CONTINUOUS share moves the outcome smoothly,
  and one multiplying a BANDED share moves it in whole dice — and a whole extra die is an
  *unmatched* die, which is an automatic hit every round. At 1.44 a raw-even fight came out four
  dice against three and the attacker won 88.3% of the time; re-cutting the bands cannot fix it,
  because the band that fixes 1:1 breaks 1:2. Collapsing the other way (1.0 everywhere) strips
  44% off every siege band with no measurement behind it. **If open battle needs to be easier or
  harder, `DICE_ATTACK_ADVANTAGE` is the number; if sieges do, `ATTACK_ADVANTAGE` is.** A third
  dial is not allowed, and neither may reach into the other's model.
- **Known-issue AR is closed as a DESIGN DECISION, not a bug** (B.10.4, Leigh's call).
  `areaBonusFor()`'s `min`/`max` slip is real but is not a one-character fix: the ratio is
  unbounded as area approaches zero, so the naive correction gives the smallest territory on the
  map a 1,047× defence bonus, and even the most conservative capped form halves the largest empire
  over sixty turns. `probability.js` is byte-for-byte unchanged and stays that way; the register's
  description was corrected instead. Do not "fix" it.
- **The battle window's bottom bar is DERIVED, and its state is one object.** `buttonState.js`
  under `src/ui/battle/` is pure and unit-tested — `deriveBattleButtons()` and
  `battleBarWidths()` — and `BattleWindow.js` is the only thing that turns a spec into elements
  and the only thing that installs the five listeners, once, from bootstrap. What it replaced is
  worth knowing so it is not reintroduced: there were TWO independent 0..n vocabularies for the
  same buttons, `advanceButtonState` deciding what a click DID and `setAdvanceButtonText()`
  deciding what the button SAID, set together by hand at every call site and agreeing only by
  convention. That is why a dead label case had to be kept alive (deleting it would shift the
  numbering of the cases either side) and why the advance handler asked
  `if (advanceButton.innerHTML === "Start Attack!")` — a question about the battle answered by
  parsing the DOM, and one that could never be true because nothing wrote that string. **Never
  read a label back to decide anything, and never write a label, a width or a colour onto one of
  these buttons from outside `BattleWindow.js`.**
- **The battle bar is derived, so ORDER matters at every call site.** `setupBattleUI()` resets the
  whole bar to the state a fresh attack opens in, which includes no siege offer — so anything that
  decides a button's state must run AFTER it, not before. The INVADE! handler decided the Siege
  offer first, which was correct while `enableDisableSiegeButton()` wrote a colour straight onto
  the element and nothing else touched it, and became a write the next line discarded the moment
  the bar became derived. Siege Territory was inert on every attack and a siege could not be laid
  at all. Neither the unit suite (the derivation is correct in isolation) nor the `battle/` area
  (it never lays a siege) could see it; the full suite did. **Making state derived turns "two
  writers that happen not to collide" into "last writer wins", and every existing call site is a
  candidate.**
- **On the battle bar, "inert" is a class and `aria-disabled`, never the `disabled` property.**
  Eleven sites across `battle.js` and `ui.js` wrote `style.backgroundColor = "rgb(128, 128, 128)"`
  to mean it, fought by six mouseover/mouseout listeners writing four more literals; all of it is
  gone and `style.css` owns the colours as tokens. The property is deliberately not used, for the
  same reason as the steppers: the battle container has a CAPTURE listener that must see every
  click over the window in order to settle the dice. The consequence is that Playwright refuses to
  click these, so `BattlePage` passes `force: true`, and `fightToResolution()` reads
  `aria-disabled` rather than `.disabled`.
- **The player is shown three panels and all three are pure renders of the model.** The ATTACK
  window's preview (`AttackPreview.js`, B.6.7) itemises the dice you would roll, live as units are
  allocated; the ledger (`ForceLedger.js`) does the same for the round about to be fought; the
  round log (`RoundLog.js`) keeps every round fought, newest first. **Two numbers are shown and
  they are allowed to differ**: the bar is `winProbability()`, the attacker's share of the two
  strengths, which decides how many DICE each side rolls; the forecast line is `battleForecast()`,
  which plays the battle out five hundred times on its own rng to answer "will I take it". The
  forecast is seeded from a stable hash of the SETUP so it does not flicker while the plus button
  is held, and it never touches the game's stream — recomputing it on every keypress must not
  change the battle that follows. The round log is `position: absolute` deliberately: the battle
  window's rows are percentages summing to 100, and a log that took layout height would shorten
  the bottom bar every time a round was fought.
- **`dist/` is not loaded by `index.html` any more** (B.10.3). The three UMD bundles — ~785 KB of
  THREE, CANNON and the buffer utilities — are injected by `src/platform/vendor/diceRuntime.js`
  on the FIRST dice roll of a session, not on every page view. They stay committed classic scripts
  setting globals rather than becoming imports, for the bare-specifier reason below. It is still
  true that `dist/` is not the build output: Vite writes to `build/`.
- **A face bonus and a dice change are different things.** A face bonus adds to every die; a dice
  change alters how many you roll. Only a dice change can answer an opponent's UNMATCHED dice,
  which are automatic hits. That is why fortification takes dice off the ATTACKER rather than
  adding faces to the defender: as a face bonus, a 2:1 attacker took a fortress 100% of the time.
- **The 3D dice show numbers the RULES chose.** The rules roll on the game's seeded stream; the
  physics throws from `cosmeticRandom()`; each die's MESH is then rotated by one of a cube's 24
  symmetries so the face landing up is the chosen one. The collision shape **must stay a cube** —
  as a cuboid it both biased the roll badly (faces 3 and 4 at 6% against 17%) and had too few
  symmetries to relabel an arbitrary face. And `world.fixedStep()` reads the wall clock, so the
  headless pre-run must call `world.step(1/60)` or the world never advances.
- **`applyFaceOffsets()` searches for its rotation in the direction that carries the WANTED face
  onto the LANDED one** — `permutation[to - 1] === from`, never the reverse. It was the reverse
  for as long as the dice have existed, and the consequence is the one thing the whole
  arrangement exists to prevent: **the dice showed numbers the battle was not fought with.** The
  mesh sits inside the pivot, so a local normal is drawn at `Q_body * R * n`; the physics has put
  `n_landed` upwards, so for the player to SEE `wanted` the mesh rotation must send `n_wanted` to
  where `n_landed` is. The inverted search showed `permutation⁻¹(landed)`, which is right only
  when the first rotation the search finds is its own inverse for that pair — measured over four
  rounds, one matched. It survived because it has no textual signature at all: nothing throws,
  the battle window's numbers are right, every outcome is correct and reproducible under `?seed=`,
  and the only witness is a person looking at the table. `window.__game.diceFaces()` reports what
  is actually drawn and `tests/e2e/battle/clash.spec.js` asserts it against the round's pairings;
  that is the only place the invariant can be checked, because it is a question about a physics
  pose composed with a mesh rotation inside a canvas.
- **The faces are re-derived at REST as well as from the pre-run.** The pre-run makes the right
  face show from the first frame; the correction in `waitForRest()` is what makes it true even
  when the visible replay diverges from it — a frame long enough for `fixedStep()` to drop
  physics, or a skip. **`skipRoll()` steps the world to rest and only then forces sleep**: it used
  to zero the velocities and `sleep()` where the dice stood, which on an early skip is in mid-air,
  showing a face nobody chose. Forcing sleep after stepping is also what guarantees the roll's
  promise resolves at all — a die wedged against a wall never satisfies the sleep test, and
  everything chained to the settle (the fade, the clash panel's reveal) then never happens.
- **Every dice spawn gap must exceed a die's width.** The collision shape is a unit cube, so two
  dice overlap unless they are more than 1.0 apart on at least one axis — and an overlap at spawn
  is two solid bodies interpenetrating, which the solver resolves by firing them apart at whatever
  speed separates them in one step. Dice leaving the tray and rolls that never came to rest were
  both this. The `TRAY` bounds in `dices.js` are likewise not a matter of taste: they are the
  floor area the camera can actually see, so anything that changes the camera's position, pitch,
  field of view or the canvas aspect changes them too.
- **THE DICE STAGE IS PERMANENT, AND NOTHING OUTSIDE `dices.js` MAY TOUCH ITS CANVAS.**
  `ensureStage()` builds the `WebGLRenderer` once for the life of the page — a fresh one per
  roll leaks a GL context and browsers cap those at about sixteen, so two battles would exhaust
  them — which means it returns immediately once the renderer exists and **never rebuilds the
  canvas**. `ui.js` called `removeCanvasIfExist()` on `AdvanceMode.BEGIN`, which was harmless
  the first time (no canvas yet) and from the SECOND battle of a session onwards tore the canvas
  out of the document, leaving the renderer drawing into a detached element: the rules rolled,
  the battle window's numbers were right, the round log was right, and the clash panel filled
  itself in with the correct faces — because every one of those reads the RECORD. **The only
  witness was a person looking at an empty stage during their second war.** The call is gone,
  `ensureStage()` re-attaches a detached canvas rather than rebuilding it, and
  `tests/e2e/battle/dice-stage.spec.js` asserts `isConnected` on the first battle and the
  second. A rendering fault that every reader of the model reports as fine is the shape to
  watch for here.
- **`GameDriver.openAttackWindow()` CLICKS the phase button.** `advancePhase: false` is what a
  spec passes for a SECOND attack in the same turn; without it the second call ends the turn,
  and the symptom is a move-phase button that reads `ATTACK` and refuses to be clicked --
  correctly, because the game is back in Buy/Upgrade. `launchWholeGarrison()` also means it:
  one press of the plus button commits the whole stack, so a second attack from the same
  territory needs the garrison put back with a scenario.
- **A REPLAYED BATTLE IS PACED LIKE A PLAYED ONE.** `src/ui/battle/DefenderPlayback.js` ran its
  rounds on a 900 ms `setInterval`, which is faster than a throw takes to settle — so round
  two's dice were thrown over round one's, and it never called `clashPanel` at all: the one
  battle the player has no control over was the one battle with no account of what the dice
  meant. A round is a CHAIN now — throw, settle, reveal the clash, hold for `ROUND_READ_MS` plus
  one `PAIR_STEP_MS` per pairing, next — so a round with five pairings takes longer than a round
  with one, which is a thing a fixed interval cannot say. **The clash panel is deliberately NOT
  reversed there**, alone among everything in that file: the ledger's columns are YOU and THEM
  and must be swapped, but the panel NAMES both sides, and mirroring it would make it state the
  rules wrongly — "tie — defender holds" is the defender's structural advantage, and in a replay
  the defender is the player. The chain is cancelled by a GENERATION counter rather than by
  clearing a timer, because a settle promise in flight cannot be cancelled.
- **`STAGE_WIDTH` / `STAGE_HEIGHT` in `dices.js` must match `#threeCanvasForDice` in
  `style.css`, and `renderer.setSize()` must be called.** `WebGLRenderer` infers NOTHING from
  the canvas element: with no `setSize()` the drawing buffer stays at the WebGL default of
  300×150 while the stylesheet stretches the canvas to its declared size, and the browser
  upscales. That is what "the dice are blurred, like low-res and scaled up" was, for as long as
  the dice have existed, and `setPixelRatio` could not help because it multiplies a size that was
  never set. The camera's aspect must be the CANVAS's too — it read `window.innerWidth /
  innerHeight`, so every die was also the wrong SHAPE, by a different amount on each machine.
- **The dice are thrown ACROSS the tray, not dropped into it, and the tray is a real box.** The
  old throw started them above the tray and applied an impulse of `(-force, +force, 0)` against a
  gravity of 65: the die rose half a unit and fell eight, which reads as a drop however much spin
  is on it. It is a flat delivery down the −x axis now, with `velocity` and `angularVelocity` SET
  rather than an off-centre impulse (so `restoreThrow()` reproduces the measured throw by
  assignment rather than by accumulating into a cleared state), and friction on the default
  contact material is what converts forward speed into tumbling — without it a spinning die
  slides. Three numbers are coupled and were chosen together, not by eye: gravity 42, friction
  0.38 and a delivery of 12–15 put the pile in the middle of the tray every time. **The walls
  must stay tall.** They were 2 units high on a floor at −7, which was enough for a die dropped
  inside them and is not enough for one thrown across; a die that leaves the world never sleeps,
  and a roll that never settles never resolves its promise.
- **The clash panel is the pairing rules, drawn** (`src/ui/battle/ClashPanel.js`). After the dice
  settle it shows each pairing closing, colliding, and the losing die shattering, with an
  unmatched die drawn against an empty socket. Four things about it. **It is not inside the battle
  window and it cannot be**: `#battleContainer` carries a `transform`, which creates a stacking
  context, so no descendant can paint over `#threeCanvasForDice` — hence its own container after
  the canvas in `index.html`, and hence that showing and hiding it is explicit rather than
  inherited (`toggleDiceCanvas(false)` is the one place that covers every ending). **It carries
  `pointer-events: none`**, the same rule the siege markers and `#tooltip` follow: it sits over
  the middle of the screen for several seconds and the click it would otherwise swallow is the one
  that closes the results screen underneath it. **It is transient, so the durable account of a
  round is the one-line summary beside the Rounds toggle** — a player who looked away or clicked
  through is otherwise back to two totals that changed and no reason. And **both sentences are
  pure functions over the round's record** (`summaryFor()`, `describeRound()`), unit-tested in
  `tests/unit/ui-battle-round-account.spec.js`, so the wording is pinned where it is cheap and no
  e2e spec has to assert prose.
- **The DICE sit above the clash panel and then fade; the panel outlives them.** `#threeCanvasForDice`
  is z-index 9700 against the panel's 9600, because the roll is the event and the panel is the
  commentary — commentary must not cover the event. Two seconds after the dice come to REST
  (`SETTLED_LINGER_MS` in `DiceStage.js`) the canvas takes `.is-settled` and fades to transparent,
  so the panel underneath becomes the thing in focus. Three things hold that sequence together and
  all three were arrived at by measuring it, not by eye. **The roll is CAPPED** at `MAX_ROLL_MS`:
  the physics runs in real time off `fixedStep()`, and five dice settling against one another ran
  to three and a half seconds, which pushed the fade past the point where the panel was still up —
  the dice got out of the way just as the thing they were getting out of the way of disappeared.
  Past the cap they are settled by `skipRoll()`, the same path a player's click takes. **The
  panel's `LINGER_MS` must stay well clear of the dice fade**, or the last step of the sequence is
  a fifth of a second long. And **the two are NOT synchronised on purpose**: the dice are never
  awaited, so tying the panel's lifetime to the settle promise would make it depend on a render
  loop — and on a machine where WebGL fails outright, on a promise that resolves instantly.
- **No army array is ever five long.** Two sites used to push a discriminant into slot 4 of a
  four-slot array — the battle's defeat type and a siege's arrest flag. They are `defeatType()` on
  the battle state and `siege.arrested` now. Do not reintroduce the pattern.
- **`src/state/battleState.js` owns the battle in progress**, and its army arrays are FRESH PER
  BATTLE but stable within one: `addRemoveWarSiegeObject()` puts them onto the siege object, so a
  siege aliases them and one reused pair would let the next battle rewrite every standing siege.
  `openBattle()` ADOPTS the arrays it is given rather than copying, because resuming out of a
  siege deliberately passes the siege's own array.
- **`setTerritoryArmy()` in `mutations.js` is how a garrison is written.** It computes
  `armyForCurrentTerritory` from the four counts it writes. The retreat handler had that personnel
  formula written out by hand four times, which is exactly how a total ends up disagreeing with
  its own units.

- **Every game rule runs in Node** (Phase 5). `src/rules/`, `src/ai/` and `src/engine/`
  import from `src/config/`, `src/state/selectors.js` and (since Phase 7.8, and only
  `src/ai/theatre.js`) `src/data/adjacency.js` — no DOM, no `ui.js`. The adjacency module
  THROWS when its data has not been loaded, which is the case in Node, so every call is
  behind `isAdjacencyLoaded()` and the neighbour lookup is injectable for the unit tests. That is the property the unit suite depends on, so before adding an import to any
  of them, check it does not drag the UI in. Two dependencies are INJECTED for exactly this
  reason: the AI's seeded rng, and `calculateProbabilityPreBattle` (which lives in `battle.js`,
  which imports `ui.js`). Rules take an `rng` parameter rather than calling `Math.random`.
- **Territory state lives in `src/state/GameState.js` and nowhere else** (Phase 4). Read it
  through `state/selectors.js`, write it through `state/mutations.js`, and subscribe to
  `state/events.js`. `mainGameArray` is gone: the replacement for "all territories" is
  `allTerritories()`, and for a lookup `getTerritory(uniqueId)` / `getTerritoryByName(name)`.
- **The SVG path attributes are output, not state.** `owner`, `data-name`, `deactivated`,
  `underSiege`, `greyedOut` and `attackableTerritory` are written **only** by
  `src/ui/mapAttributeSync.js`, from store events. Never write one directly and never read one
  back — `src/state/pathState.js` answers the same question from the store when you only have
  a path element. `uniqueid`, `territory-name`, `isCoastal` and `mountainDefenseFactor` are
  identity and geometry; reading those is fine.
- **There is a bootstrap window in which the SVG *is* the truth** — between `svgMapLoaded()`
  (window `load`, which populates `paths`) and `seedTerritories()` (the end of the initial-data
  Promise). The store has no territories in it, and the attributes are what the model is about
  to be built from. `pathState.js` handles this: it reads the attribute while
  `territoriesReady()` is false and the store afterwards. **Anything new that reads territory
  state during bootstrap has to do the same.** Getting it wrong is not subtle and is not caught
  by most of the suite: `colorCountriesRandomly()` groups paths by `data-name`, and answering it
  from the empty store put the entire 359-territory map into one flat colour, with every
  `countryColor` wrong for the rest of the game. `bootstrap/state-layer.spec.js` guards it now.
- **`underSiege` is derived, not stored.** A territory is under siege exactly when a siege
  names it, so `addSiege()` / `removeSiege()` is the whole operation. This is why
  `normalizeSiegeState()` no longer exists.
- **A siege holds a territory id, not a copy.** `siege.defendingTerritory` is a live getter
  onto the real territory (`src/state/sieges.js`), so writing through it writes the world.
  Do not reintroduce a copy, and do not add a sync-back.
- **A siege's SIDE is derived from the list it is in, never carried in a variable.** The
  starve-out that ends a siege is in `calculatePopulationChange()`
  ([resourceCalculations.js](./resourceCalculations.js)), and its `ai` flag decides which siege
  list is closed, whether `routeSiegeUIProcesses()` raises the rout screen, and which branch of
  `handleWarEndingsAndOptions()` awards the territory. It used to come from a bare `let ai;`
  declared above the income loops and assigned only by the unrelated historic-war reset beside
  them, so it was usually still `undefined` — falsy, meaning "the player" — and **every
  AI-versus-AI siege that starved out handed the conquered territory to a player who was no
  party to the war**, raised a rout popup over it, and then failed to remove the siege because
  it looked for it in the player's list (known-issues **AZ**). Look the territory up in
  `playerSiegeWarsList` and take `siegeIsAi = !playerSiege`. And the besieger on a siege object
  is `attackingCountry`: `dataName` is a *territory's* field and a siege has none, so reading it
  set the owner to `undefined`.
- **`allTerritories()` is ordered by `defenseBonus`**, not by `uniqueId`. Never index it
  positionally, and treat it as read-only.
- **There is a write guard.** Load the page with `?stateGuard=1` to log every territory write
  that bypasses `mutations.js`, or `?stateGuard=strict` to throw on one;
  `window.__game.stateGuardViolations()` reports what it caught. It is off by default and
  will report plenty until Phase 5 makes the rules pure — each report is a Phase 5 to-do,
  not a regression.
- **`dataName` is the *current* owner and changes on conquest**; `territoryName` is the stable
  identity; `originalOwner` is historical. Mixing them up is a recurring source of bugs, and
  the most recent one shows the shape to watch for: the Wars & Sieges tab drew the *Defending
  Country* flag from `war.defendingTerritory.dataName`, so a war the attacker WON showed the
  attacker's own flag on both sides (known-issues **AS**). It looked right on every row where
  the territory had not changed hands — every ongoing siege, every war the attacker lost — and
  wrong only on the outcome anybody would look back at. **If a record describes something that
  happened, record who it happened to; do not read it back off the world later.** A war now
  carries `defendingCountry`, set at construction in `battle.js`.
- **`resources/svgMaster.svg` is the authoritative source of territory names.**
  `tests/uniqueIdLookup.json` is a convenience map and has drifted before: it says
  `"Grand Bahama"` / `"Andros Island"` where the SVG says `"Grand Bahama (Bahamas)"` /
  `"Andros Island (Bahamas)"`. Those parentheses are real, not typos. Derive names from the
  SVG in any tool or test.
- **`resources/adjacency.json`, `resources/pathAreas.json` and `resources/music/tracks.json`
  are generated** by `tools/`. Edit the generator, never the JSON. `npm run build:data`
  regenerates all three; the `:check` variants verify they are current.
- **Seeding `Math.random` DOES make the game deterministic** — since Phase 5.8, and it did not
  before. `addSparklesRegularly()` burned three draws per timer tick on the same global stream
  as combat and the economy, so two runs of the same seed diverged (audit 5.3 Y). Cosmetic
  randomness now lives in `src/platform/cosmeticRng.js`, a self-contained mulberry32 that never
  touches `Math.random`. **Nothing decorative may draw from `Math.random`** — a new sparkle, a
  sound choice, an animation delay all go through `cosmeticRandom()`, or the whole suite's
  exact-outcome assertions start flaking. Cosmetics are deliberately not reproducible; seeding
  them from the harness would put the timer straight back on the game's stream.
- **Bootstrap has two halves that finish out of order.** The `DOMContentLoaded` handler builds
  the UI and sets `pageLoaded`; `svgMapLoaded()` runs later on window `load` and is what
  populates `paths`. Anything needing territory geometry must await `whenPageLoaded()`, which
  waits for both.
- **Playwright reuses a preview server it did not build.** `playwright.config.js` sets
  `reuseExistingServer: !process.env.CI`, and its `webServer.command` is
  `npm run build && npm run preview`. So the FIRST e2e run of a session builds and serves
  `build/`, and every run after it reuses that server — against the build as it was at the
  first run. Edit a source file, re-run a spec, and you are testing the old code with no
  warning. It shows up as a spec that passes when it should fail, or fails when the fix is
  already in. Kill whatever is listening on 4173 (`netstat -ano | grep :4173`, and check
  both the IPv4 and the IPv6 listener) before trusting an e2e result taken after an edit.
  `npm run dev` is unaffected — Vite serves from source.
- **The map is an `<object>`, not an `<iframe>`.** `page.frameLocator("#svg-map")` does not
  work in Playwright; use `page.frame({ name: "svg-map" })`.
- **One phase counter, and it is an enum.** `Phase` in `src/state/phases.js`, read with
  `currentPhase()` and written with `setPhase()`. The old `currentTurnPhase` / `turnPhase`
  pair and `modifyCurrentTurnPhase()` are gone. Same for the turn: `currentTurn()` /
  `advanceTurn()`.
- **The AI turn used to crash and freeze the game** (audit §5.1 AA) — fixed in Phase 3, along
  with the four further crashes hiding behind it (§5.1 AF–AJ). A 20-turn playthrough now
  completes clean.
- **The turn loop is `src/engine/TurnEngine.js`** (Phase 5.7), not a recursive `gameLoop()`.
  It is a sequencer that knows nothing about this game: `beginTurn`, each step in order,
  `endTurn`, repeat. `gameTurnsLoop.js` supplies the hooks. Three consequences worth knowing:
  **a step that throws no longer kills the game** — it is reported through `onError` and the
  turn continues without it, so a crash now shows up as a `console.error` (and therefore a
  failing e2e spec) instead of the phase button silently sticking on `AI MOVING...`; **there
  is exactly one `#popup-confirm` listener**, installed once, calling `engine.advancePhase()`,
  rather than three transient ones added and removed per phase; and **`stop()` / `reset()`
  exist**, which is what makes New Game possible in Phase 7. Do not reintroduce a phase that
  waits by attaching its own listener — add a step with `waitsForPlayer`.
- **No bare-specifier imports. Ever.** `index.html` loads the game's entry modules as plain
  `<script type="module" src="ui.js">` tags against the SOURCE files, so every import in the
  codebase is a relative path and the browser resolves them itself. `import x from "some-pkg"`
  is something only a bundler can resolve; outside Vite the browser rejects it with
  *"Failed to resolve module specifier"*, at module-evaluation time inside the bootstrap chain
  — so the symptom is a page that never reaches the main menu, not "that one feature is
  broken". Vite hides it completely, which is what makes it dangerous. A runtime library goes
  in `src/platform/vendor/` (lz-string is there, byte-for-byte from upstream with the UMD tail
  swapped for an `export`), the same decision `dist/` records for three.js and cannon-es.
- **Save/load is three files and none of them imports the UI.** `src/state/snapshot.js` turns
  the store into JSON and back, `src/platform/saveSlices.js` is a register that modules holding
  durable state *outside* the store write themselves into, and `src/platform/storage.js` is the
  envelope, the compression, the `localStorage` slot and the timer. Three rules follow.
  **A restore refills the aliased collections in place and never replaces them** — `battle.js`
  does `export const playerSiegeWarsList = playerSieges()` at module load, a reference held for
  the life of the page by ~60 read sites, and the same goes for `wars.historic`; territories
  are patched in place for the same reason. **A siege's `defendingTerritory` getter must not be
  serialised** — it is enumerable so a snapshot can see it, but storing it would put a whole
  territory inside every siege and restore it as a dead copy; `captureState` drops it and keeps
  `defendingTerritoryId`. And **new durable state outside the store needs a slice**: add
  `registerSaveSlice()` in the module that owns it rather than importing that module from
  `platform/`, which would drag `ui.js` in through the back door.
- **A loaded game resumes INSIDE the saved turn**, via `TurnEngine.start({ resumeAt })` — the
  only caller. The saved turn has already had its income, its siege tick and its disaster roll,
  so running `beginTurn` over it would do all three a second time. `resumeSavedGame()` in
  `gameTurnsLoop.js` is the load-side counterpart of `initialiseGame()` and deliberately does
  NOT assign ownership from `playerCountryName()`, create CPU leaders or add starting forts:
  the save already says who owns what, and the other two draw from `Math.random`. Anything new
  that `initialiseGame()` grows has to be classified as map-derived (belongs in both) or
  world-generating (belongs only in the new-game path).
- **"New Game" from inside a running game is a LOAD.** The pristine world is captured once at
  bootstrap (`captureNewGameBaseline()`, called from the block in `resourceCalculations.js`
  that seeds the model) and Restart restores it, because re-running the real pipeline means
  re-measuring 359 SVG path areas. The one cost: two new games in a session share the same
  randomised starting gold. Do not "fix" that by moving the capture earlier — there is nothing
  earlier; the roll is part of building the model.
- **Anything made correct as a side effect of the country-selection screen breaks a loaded
  game**, because a load never sees that screen. Three were found this way and all three are
  now addressed writes: the phase button ships at `opacity: 0` and `selectCountry()` used to be
  what revealed it (`phaseBar.setMode(PLAYING)` does it now), `setFlag()` paints the player's
  flag behind the phase-bar subtitle only while selecting (`phaseBar.setBrandFlag()`), and the
  top table is *written* rather than derived so nothing repaints it on a state change
  (`resumeSavedGame()` calls `addUpAllTerritoryResourcesForCountryAndWriteToTopTable(true)`,
  which is a pure sum and grants no income). Restart surfaced the mirror image, which is why
  `phaseBar.setMode(SELECTING)` and `bottomTable.reset()` exist.
- **The autosave is gated, not merely timed.** A tick is skipped unless the engine is awaiting
  the player and no battle, battle-results or transfer window is open — a save taken mid-battle
  stores a world that cannot be resumed to the screen the player is looking at, because
  `battle.js` holds the resolution in module-level variables. The interval is 60s, so specs use
  `window.__game.saveNow()`; do not shorten the interval for the harness.
- **`.options-button`, `.options-button-ghost` and `.options-scrim` are shared** by the Options
  panel, the confirm dialog and the save/load panel — deliberately, because three modals that
  open from the same menu should not be three designs. The consequence is that a bare
  `.options-button-ghost` selector is ambiguous, which is exactly how the theme spec broke when
  the second modal landed. Address these buttons by id from `registry.js`, never by class.
- **`window.__game` has grown, and each accessor exists because a spec could not be written
  without it.** Beyond the readers: `greyedOutCountries()` (the selection lock as state, not as
  a fill), `siegeAt(name)` (one live siege — `sieges()` only says *which* territories are
  besieged), `battle()` (the two armies unrounded; the battle UI's cells are formatted `"1.9k"`),
  `randomEventProbability()` and `forceRandomEvent(name)` (an event is a band on the mean of
  five draws, so no seed reaches a chosen one on a chosen turn), and `applyScenario()`.
- **A scenario must patch `armyForCurrentTerritory` as well as the four unit counts.** It is a
  stored total, not a derived one. Patch the units alone and the probability calculation reads
  one number while the bottom table reads another — the scenario looks applied and the battle
  behaves as though it were not.
- **A `console.error` fails every e2e spec.** `tests/support/fixtures.js` collects them
  alongside `pageerror`. That is deliberate and it is how known-issue AM was finally caught,
  so do not silence the engine's `onError` to make a run go green — find what threw.
- **Scenarios beat clicking** for anything the UI cannot reach — a rout, an all-naval
  defender, two concurrent sieges. `await game.loadScenario("two-sieges")` in a spec;
  the JSON lives in `tests/support/scenarios/` and is applied through `state/mutations.js`.
  See [docs/03-e2e-test-plan.md](./docs/03-e2e-test-plan.md) §3.7.
- **Since Phase 3 the AI actually conquers — and attacks the player.** A turn can end with a
  battle results screen sitting on top of the phase button, and it can appear a beat AFTER the
  turn counter advances. `GameDriver.dismissBlockingPanels()` and `withBlockersCleared()` handle
  it in the harness; anything new that drives the turn loop has to as well.
- **A besieged territory earns no gold, oil or construction materials**, and the AI besieges far
  more than it can finish (17 → 67 concurrent sieges over 14 turns). Both are design problems
  logged for Phase 7 in [docs/04-known-issues.md](./docs/04-known-issues.md) §6 — do not "fix"
  either as a bug.
- **Do not move the CPU-leader and starting-fort setup earlier in bootstrap.** It looks wrong —
  `initialiseGame()` starts turn 1 before either exists, which is why `newTurnResources()` skips
  the income pass on turn 1 — and moving it inside `initialiseGame()` was tried and **measured**
  in Phase 5.8: the ten-turn `long-run` went from 6/6 green to 0/6, the player eliminated every
  time. Giving the AI a fully-formed first turn is a balance change, and it belongs to the Phase
  7 balance pass. The measurement is recorded at the site in `gameTurnsLoop.js`.
- **All sound goes through `src/platform/audio.js`.** `music.js` is deleted and `sfx.js` is a
  one-line forward. The vocabulary is two clips, named for what the control means rather
  than for a file: `playSoundClip("switch")` for map chrome and the territory panel's tabs,
  `playSoundClip("button")` for buttons inside a window and items in the menus. **There are
  no dice sounds and no WAVs** — the two dice clips fired on a cosmetic coin flip in the
  battle loop and are gone along with the draw that chose between them.
- **The music playlist is every mp3 in `resources/music/`, and that list is GENERATED.**
  A browser cannot read a directory, so `resources/music/tracks.json` is written by
  `tools/build-music-manifest.mjs` — and by Vite on every dev-server start and build, so
  dropping a track in and reloading is the whole procedure. `npm run build:music` does it
  without Vite. A playthrough is a permutation of the whole folder; nothing repeats until
  everything has played, and the track that closed one playthrough cannot open the next.
  **The shuffle draws from `cosmeticRandom()`, never `Math.random`** — a draw per track
  change would put the music on the game's stream and two runs of one seed would diverge as
  soon as a track ended.
- **Audio settings are saved with the game.** `registerSaveSlice("audio", ...)` in
  `audio.js`, plus a `localStorage` copy so a reload with no save still remembers. A save
  taken with the music playing comes back playing. Music is never started at load — a
  browser refuses `play()` before a user gesture — so `resumePendingMusic()` hangs off the
  first `pointerdown` and is idempotent.
- **The two mutes have two controls, and neither owns the setting.** The audio panel over
  the map has them alongside the volumes and transport; the main menu's Options panel has
  them as a pair of switches, because the audio panel hangs off a button over the map and
  the title screen has no map. Both subscribe to `onAudioChanged` and repaint from
  `audioSettings()`, so muting in one shows in the other — a control that remembered its
  own last position instead would be right until the player used the other one. The
  switches read as AUDIBLE while `audio.js` stores `musicMuted`; the inversion is in
  `OptionsPanel.js` and nowhere else. Options applies live and Cancel restores what was in
  force at open, the same contract the theme picker has.
- **The music button is the ONE piece of map chrome that does not wait for a country to be
  chosen.** It is the top of the right-hand column, above the continent-view button, and it
  is up from the country-selection screen onward. `toggleMapModeButton()` still drives it
  for every other transition — menu, battle, transfer window — through `toggleAudioButton()`,
  which is why the exception costs exactly three explicit calls in `ui.js`: `resetGameState()`,
  `resetChromeForCountrySelection()` and the tail of `closeInGameMenu()`. Miss the third and
  the button never comes back after Escape on the selection screen.
- **The autosave indicator is bottom right**, clear of the 30px bottom table. It was top
  right, which is the corner the map chrome fills from 36px down, so an autosave flashed a
  box over the music and continent-view buttons.
- **The player's colour is a grid of 256 swatches, not the OS dialog**
  (`src/ui/components/ColourPicker.js`). The `<input type="color">` still exists and is
  still `#player-color-picker`: it is off screen and it is the VALUE, so every existing
  reader and every spec that sets it still works. Clicking a swatch writes it and dispatches
  `change` by hand, which is what repaints the map. The phase bar's colour label deliberately
  has **no `for` attribute** — pointing it at the input is what made the operating system's
  dialog open on top of the grid — and it is deliberately NOT repainted in the player's
  colour. Three writes in `ui.js` used to set `style.color = playerColour()` on it, with a
  `::before` chip taking the same colour, so the words "Select Player Color" became the
  preview: unreadable on anything near the panel background, and the one element in the
  phase bar that ignored the theme. The grid marks the chosen swatch and previews it in its
  own header, which is preview enough. `colourLabelElement()` is gone — it existed only to
  be repainted.
- **The territory panel's globe button stays visible while the panel is open**, so the button
  that opens it also closes it (`toggleUIMenu()` no longer hides it). `#UIButtonContainer` is
  at z-index 9000, above the panel, which is what makes it clickable rather than merely present.
- **The five strongest countries are LOCKED on the selection screen and that is deliberate**
  (`COUNTRY_GREYOUT_RANK`, audit 5.2 Z). They are painted in their own colour muted toward grey,
  not flat grey, because flat grey read as "failed to render". The lock is enforced from the
  store — never from a fill colour, which is how it used to be bypassable in three clicks.
- **A marker is decoration and must never intercept a click.** Siege overlays and the attack
  image carry `pointer-events: none`. Without it the marker sits over the middle of the
  territory it marks and swallows the click, and clicking a besieged territory is the only route
  to VIEW SIEGE. `#tooltip` was the same class of bug and is fixed (Phase 6.3).
- **Siege markers are rendered from state**, by `src/ui/siegeOverlay.js` on the `siegeChanged`
  event. Do not also draw one imperatively where a siege is created — that produced two
  marker elements sharing one id, of which only one was ever removed. The marker is a
  **drawn** `<g data-siege="player|ai">` holding the shield-and-keep path from
  `src/ui/icons.js`, not an `<image>`; `siege.png` / `siegeai.png` are gone. Because the map
  is an `<object>` with its own document, the tokens do NOT cascade into it: the colour is
  resolved from the host root with `getComputedStyle` and written on as a literal fill, and
  `repaintSiegeOverlays()` redoes that on `THEME_CHANGED`. Anything else drawn into the map
  document has to do the same.
- **INVADE! debits the source territory immediately** (Phase 4.7, audit §5.1 AD), and a
  no-penalty retreat returns the army through `retrievalArray` a turn later. The two halves
  balance; changing one without the other creates or destroys army.
- **Territory names are not selector-safe.** Six carry real parentheses, so
  `querySelector("#siegeImage_" + name)` throws rather than returning null (audit §5.2 AI). Use
  `getElementById` for anything keyed by a territory name.
- **`xButton` is gone** — Phase 6.8 split it into `xButtonInfoPanel` and `xButtonUpgrade`, so
  all three close buttons (with `xButtonBuy`) are unique. The battle UI's stat strip was
  renamed at the same time: `battleUIRow4Col2A`…`H` are now
  `battleStats{ProdPop,Food,Defense,Mountain}{Icon,Value}`. The id, the CSS class and the entry
  in `BattleUI.js` are one string, so a rename is `registry.js` plus `style.css`.
- **`#tooltip` follows the pointer and now carries `pointer-events: none`** (Phase 6.3). It
  used to sit on top of whatever you were about to click and eat the click. It is still the
  only thing that clears `clickActionsDone`, the latch that gates the bottom table updating,
  so the page objects still park the pointer — that is belt-and-braces now rather than a
  workaround. Push content into it with `tooltip.setContent()` / `show()` / `clear()`, never
  by reaching for the element.
- **The transfer table's row click handler is on the row's NAME column**, not on the row.
  The attack mode of the same renderer has no row selection at all. Both live in
  `src/ui/transferAttack/` since Phase 6.5 — `TransferTable.js`, `AttackTable.js` and the
  shared `ArmyAllocationRow.js`, with the step multiplier as one table in `multiples.js`
  rather than six `if` chains.
- **A disabled control is a class, not a picture** (Phase 7.11). The plus, minus and
  step-multiplier buttons and the two territory-row action buttons are drawn
  (`src/ui/controls/steppers.js`, `actionButtons.js`) from icons in `src/ui/icons.js`.
  They were twelve PNGs whose greyed twin was the ONLY record that a control was
  disabled, which is why eleven sites asked `button.src.includes("Grey.png")` — a
  question about game rules answered by reading a file path, and one that fails
  silently. Use `isStepperEnabled()` / `setStepperEnabled()` / `setCellEnabled()`.
  **They deliberately do NOT take the `disabled` property**: the greyed PNGs still
  received clicks and several handlers do other work on the way past, so `aria-disabled`
  plus `is-disabled` is the state. The consequence is that Playwright refuses to click
  them, which is why the four page objects that drive a stepper pass `force: true`.
  **The ARTWORK stays** — resources, unit types, and the farm/forest/oil-well/fort
  plates are illustrations and still swap to `Grey.png`; `tests/unit/ui-stylesheet.spec.js`
  asserts both halves.
- **No colour literal may appear outside the `:root` block in `style.css`**, and a unit
  test fails the build if one does. The only exceptions are the colour picker's
  `#fff`/`#000` selection rings, which mark a swatch that can itself be any colour. If a
  new colour is genuinely needed it becomes a token — that means `tokens.js`, the
  `:root` default, and all five non-default themes, in that order.
- **The two resource windows are declared TOGETHER in the stylesheet.** `ResourceWindow.js`
  has built Upgrade Territory and Buy Military from one spec since Phase 6.3, but the CSS
  described them twice and they drifted to different row heights. Every shared rule names
  both class families, and a unit test fails if one is styled without the other. Where they
  genuinely differ (the buy row has a step multiplier, so its fifth column is wider) the
  difference is stated once and says why.
- **A window's height is its content; only the container carries a number.** Upgrade
  Territory shipped for months as `height: 500px` over a `366px` content window over a
  `300px` table — three fixed numbers that had to agree and did not, so the fourth of four
  rows was drawn under the bottom bar. The container's height must stay a number, because
  `.blur-background` is absolutely positioned and `height: auto` collapses it to nothing.
- **The five floating windows are draggable and focus-ordered** (Phase 7.4,
  `src/ui/core/draggable.js`). Three rules. The drag shifts the COMPUTED `left`/`top` and
  never touches the `transform` — `.title-transfer-attack-window` and
  `.content-transfer-header-row` are `position: fixed` inside the transfer window and
  resolve against its transform, so "simplifying" the drag by removing it flings that
  window's header into the corner. Stacking is a counter in the 9100–9400 band, not a set
  of constants: `bringToFront()` is what "whichever window was touched last" means, and it
  renormalises rather than climbing into the modal band at 10000+. And **opening a window
  focuses it** — that is why Upgrade Territory appears above the panel whose button opened
  it, and why the activity feed opens over the territory panel without needing a higher
  fixed z-index.
- **The phase bar folds, and the advance button must never move.** It is bottom-anchored
  with a content height, so collapsing shortens it UPWARDS. Its z-index is 9050 —
  deliberately below every window — because it is furniture the player reads through; at
  9999 nothing could ever sit over it. The flag row is `height: 13.2vh` and **must not be a
  percentage**: a percentage against an `auto` parent resolves to `auto` and the flag
  becomes a four-pixel stripe. The colour picker measures the bar's rectangle on open
  (`--phase-bar-top`) rather than naming its height in CSS, which is no longer a constant.
- **The activity feed stores facts, never sentences** (Phase 7.4).
  `src/state/activityLog.js` holds `{kind, territory, defender, attacker, playerAttacking,
  playerDefending}`; `src/ui/activityFeed/describeActivity.js` derives the wording and the
  tone when a row is drawn. Storing the sentence would bake today's phrasing into every
  save file. `ActivityKind` is a CLOSED set and `recordActivity()` rejects anything else,
  which is what keeps economy and planning out of a feed that is supposed to be military.
- **Most feed entries are DERIVED from `state/events.js`, not written at the event.** A
  conquest is "a territory's `dataName` changed" and a siege start is "a siege was added",
  both from `mutations.js`, which every path must go through — there are eight places that
  take a territory and a list of eight loggers is one new attack route away from being
  wrong. `updateTerritory()` reports a `previous` field for this: by the time the listener
  runs the store only knows who holds the territory NOW, and the line is about who it was
  taken from. Only what the store cannot answer afterwards is reported explicitly: a failed
  attack (nothing changed) and a siege ENDING (one change, three meanings).
- **The turn boundary is not where it looks.** `endTurn: advanceTurn`, so the AI moves
  during turn N and the counter reaches N+1 afterwards — everything the player is shown
  when the feed raises itself is filed under the turn that just ENDED. `onTurnStarted()`
  opens exactly one section (the new turn) and scrolls the list to the top; the safety net
  is in `render()`, which will not draw a panel with every section shut and falls back to
  the newest turn that has anything in it — which on a quiet N+1 is N, where the conquests
  are. A spec that records into an arbitrary turn number and expects it to be open is
  testing nothing.
- **The AI's plans go to the console and must never reach the panel.** `src/ai/goalHorizons.js`
  derives short, medium and long-term intent (the last from the world — lost territories,
  nearest continent, principal rival — not from any stored plan) and `planLog.js` prints
  one collapsed group per country. The feed reports what HAPPENED; a panel showing the AI's
  intentions would be a cheat.
- **The info panel's four tabs are column definitions, not code.** `src/ui/infoTable/columns.js`
  and `warColumns.js` say what each tab shows; `tableDom.js` builds a header row and a data
  row; `renderInfoTable.js` is four small functions and a dispatcher (Phase 6.4). Adding a
  column is one entry in a list. The numbers are INJECTED by `resourceCalculations.js`, so
  `src/ui/infoTable/` imports nothing from the economy.

## Conventions

- ES modules, `"type": "module"`. Node-side CommonJS files use `.cjs` (the webpack configs).
- Config files use `.mjs`.
- 4-space indent for game source, 2 for JSON/Markdown/config (`.editorconfig`,
  `.prettierrc.json`).
- Reference code as clickable links: `[ui.js:440](ui.js#L440)`.
