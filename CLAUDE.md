# CLAUDE.md

Guidance for working in this repository.

## What this is

A browser-based single-player turn-based world-conquest strategy game. Plain ES modules, no
framework, Vite for dev/build. **There is no server-side game logic and no multiplayer**,
despite the repository being named `OnlineRiskGame`.

## Read first

Before any non-trivial change, read the relevant document in [docs/](./docs/). **The living
sequence is five documents and it is gap-free**: a finished plan moves to
[docs/archived/](./docs/archived/README.md) keeping the number it was written under, and the
living documents are renumbered so the sequence never has a hole in it. Where an archived
document contradicts a numbered one, **the numbered one wins**.

- [docs/01-game-design-document.md](./docs/01-game-design-document.md) — what each mechanic
  does, and what is implemented vs. missing.
- [docs/02-e2e-test-plan.md](./docs/02-e2e-test-plan.md) — functional areas and the test
  harness.
- [docs/03-known-issues.md](./docs/03-known-issues.md) — the live defect register, and it
  holds **only what is still open**: defects, design problems, what is missing, and hygiene.
  An entry moves to
  [docs/archived/04-known-issues-closed.md](./docs/archived/04-known-issues-closed.md) **in the
  same change that closes it** — never struck through and left, and never batched up for a
  tidy-up later. Ids are permanent and survive the move, because source comments cite them.
- [docs/04-future-plans.md](./docs/04-future-plans.md) — **what to do next, and why. Nothing
  on it is committed.** It was called *What Is Missing* until diplomacy and opinion closed, and
  it asks a **different question from every document before it**: those asked whether the
  simulation behaves, and it does — the world consolidates, conquest is non-zero at every
  sample, no goal freezes the map. This asks whether a person sitting in front of it
  experiences a game. **Its §2 is the easy wins and they share no code with `src/ai/`,
  `src/rules/` or `balance.js`** — so alone among the work on that list they need no five-goal
  acceptance run, which is the argument for doing them first. What has been delivered off that
  list is cut out of it and recorded in
  [docs/archived/05-what-is-missing-delivered.md](./docs/archived/05-what-is-missing-delivered.md).
  **M-d is Leigh's SCORE item** — every country earns points for good diplomacy and military
  victories, never loses them, and the total orders the DEFEATED countries in the standings
  table and nothing else, because the living ranking answers *who is about to win* and a career
  is not that. The numerical items — the cliff, the target band, the unspent army — stay in the
  register and are deliberately NOT on it.
- [docs/05-diplomatic-acceptance.md](./docs/05-diplomatic-acceptance.md) — **the term-by-term
  account of what decides whether a proposal is accepted**, plus what makes a country want to
  declare war on you. It is the document to read before touching `peaceDiscipline`,
  `allianceDiscipline` or `declarationDiscipline`. Its §7 proposed the opinion layer and has
  been delivered; the four proposals of it that were **overturned** are listed at the top of
  that section.

**THERE IS NO PHASE IN FLIGHT.** The next one is whichever item comes off `04`.

**DIPLOMACY IS DELIVERED AND ARCHIVED** ([design](./docs/archived/06-diplomacy.md),
[checklist](./docs/archived/06-diplomacy-checklist.md)). Peace and war as a STATE PER PAIR of
countries, rather than the permanent undeclared all-out war the map used to be in. Six states —
no contact, neutral, war, ceasefire, peace, alliance — and **first contact is NEUTRAL**, which
is Leigh's decision and the one that ordered the whole phase: `allowsAttack()` permits WAR and
nothing else, so wiring the attack gates before the declaration rules existed would freeze the
entire world, which is known-issue **BA** exactly — nothing throws, every turn completes, and
the map quietly stops changing. Everything landed except **5.2 (passage and stacking)**, which
is BLOCKED on the data model — a territory holds one garrison and there is no field for whose
an army is — and is known-issue **DP1**; the deliverable version of it is REACH rather than
occupation. **Stage 7 (federations) is a back burner** and is deliberately not scheduled.
Q4b, Q8, Q9 and Q10 are still open in its §7. The mechanic is summarised in
[docs/01-game-design-document.md](./docs/01-game-design-document.md) §8.6.

**OPINION IS DELIVERED AND ARCHIVED** ([design](./docs/archived/08-opinion.md),
[checklist](./docs/archived/08-opinion-checklist.md)) — the layer that gives diplomacy a memory.
Its five decisions are the ones to read before touching `opinionDiscipline`. **Its §5.4, the
five-goal 150-turn `ai-sim` table, has NOT been run**: the phase touches the theatre choice as
well as the three acceptance scores, so it moves the consolidation numbers and the diplomatic
ones together, and that measurement is outstanding.

- **Combat and Conquest is DELIVERED and ARCHIVED**
  ([audit](./docs/archived/05-combat-and-conquest-audit.md),
  [checklist](./docs/archived/06-combat-and-conquest-checklist.md)). Read the checklist's closing
  section before touching combat. Three things in it are load-bearing. **Two of the three decisions
  it records were carried out by a different mechanism from the one they name** — "more dice bands"
  became a wider RANGE (five rows still, 2..6 dice instead of 1..5) because more rows cannot flatten
  the cliff at all, and the devIndex/continent rebase was applied at `DICE_ATTACK_ADVANTAGE`
  (1.0 → 1.54) rather than to the two tables, because `devIndex` also feeds the economy. **A wider
  3..7 table was built, measured better on the cliff, and was reverted** for wall-clock reasons —
  the archived diplomacy checklist's stage 5.2 holds both side by side, so going back is one
  balance edit. And **it did not reach its target band**, which is why `04` above exists.

- **The Codebase Audit is ARCHIVED** ([docs/archived/01-codebase-audit.md](./docs/archived/01-codebase-audit.md)).
  Written on 23 August 2026 against commit `b7ae0af`, it is the analysis the register was built
  from and it is cited by id throughout — but every phase it planned has landed and the code it
  describes has been rebuilt underneath it. Read it for **why** something is shaped as it is,
  never as a description of the code today.

The numbered documents are **breathing** — they are edited as work lands and describe the code
as it is today. Finished plans move to [docs/archived/](./docs/archived/README.md) rather than
going stale in the sequence: the eight-phase [refactor plan](./docs/archived/03-refactor-plan.md),
the [battle overhaul](./docs/archived/battle_overhaul.md) and its checklist,
[Goals and Victory](./docs/archived/05-goals-and-victory.md) and its checklist,
[Continent Bonuses](./docs/archived/05-continent-bonuses.md) and its checklist,
[the Economy](./docs/archived/05-economy-audit.md) and its checklist,
[Combat and Conquest](./docs/archived/05-combat-and-conquest-audit.md) and its checklist,
[Outstanding Improvements](./docs/archived/05-outstanding-improvements.md),
[Force and Succession](./docs/archived/06-force-and-succession.md), the codebase audit, and
Diplomacy and Opinion. They record why the code is shaped as it is, but they do not describe
outstanding work.

One thing in the archived Goals and Victory is still live rather than historical: its §5 table
of 150 headless turns per goal is the **acceptance criterion for any change to `src/ai/`**, and
the archived Continent Bonuses §6 is the before/after METHOD that criterion is applied with —
the control run, and the reason a slow economic mechanic cannot be judged by playing.

## Commands

```bash
npm run dev            # Vite dev server, port 3000
npm run build          # production build -> build/
npm run preview        # serve build/ on port 4173
npm run lint           # ESLint (baseline: 76 errors, 270 warnings -- re-measured)
npm run format         # Prettier (legacy root sources are ignored on purpose)
npm run test:unit      # Vitest, 1,666 tests, ~3s
npm run test:e2e       # Playwright, ~426 tests, 4 workers headless, ~7-14 min
node tests/run-e2e.mjs --list            # list the functional areas and their spec counts
node tests/run-e2e.mjs turn-loop         # one area
node tests/run-e2e.mjs attack turn-loop  # several areas, one run
npm run test:e2e:slow  # one visible browser, 500ms between actions
node tools/econ-lab.mjs                  # the economy, measured: income spread and the
                                         # 44.44 gold floor, the quadratic upgrade ladder and
                                         # what a farm pays back, unit value per gold, and the
                                         # cons-mats bottleneck. Takes a section name to narrow
                                         # it: income | upgrades | units | consmats | bonus.
                                         # It IMPORTS the rules it measures -- never re-copy a
                                         # formula into it (see the seeding gotcha below)
node tools/combat-lab.mjs                # the FIGHT, measured against the real map: what the
                                         # terrain defends with before anyone builds, the cliff
                                         # (real take probability against raw force ratio), what
                                         # the AI is TOLD versus what happens, the fort ladder in
                                         # both models, what a besieging army has to be, and what
                                         # each AI odds constant means in real terms. Takes a
                                         # section: terrain | cliff | calibration | forts |
                                         # siege | floors. Like econ-lab it IMPORTS every rule it
                                         # measures -- never re-copy a formula into it
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
- **GOLD INCOME IS A BASE PLUS AN EARNED PART, and the base is large.**
  `TERRITORY_BASE_INCOME` (44.44) is paid to every territory every turn whatever it is, and on
  top of it a territory earns `scaled / earnedDivisor`. The number is not new — it was hidden
  inside `(scaled - normaliseMin) / (normaliseMax - normaliseMin)` with `normaliseMin` at −800,
  which is an **affine shift and not a clamp**, so the −800 was simply a constant added to
  everybody and the word "normalisation" was part of why nobody noticed. `normaliseMax` never
  clamped anything either: China's scaled figure is about 61,400 against a max of 1000. Two
  consequences. **The base is 65% of what a MEDIAN territory earns** (median 68.5 gold), so
  below about a million productive population nothing the player does moves the income at all —
  that is the whole of "why would anyone upgrade", and `node tools/econ-lab.mjs income` is the
  measurement. And **the continent bonus multiplies the WHOLE income, base included**, which is
  a decision and not an accident of where the line sits: applied to the earned part alone it
  roughly halves on Africa and South America — the poorest continents and the likeliest to be
  finished — while barely touching North America, so it would pay least for the hardest
  objective. `node tools/econ-lab.mjs bonus` is that measurement.
- **AN UPGRADE HAS ONE PRICE AND ONE EFFECT, and both live in `src/rules/economy/upgrades.js`.**
  `upgradePriceFor(kind, nth, devIndex)` and `applyUpgrade(territory, kind, count)`, pure, and
  **the player and the AI both go through them** — the same rule the dice model established for
  combat, arrived at the same way. Before the economy phase there were **six copies of the price
  formula and a seventh of the defence formula**, and what they cost is worth remembering
  because none of it threw: `calculateAvailableUpgrades()` priced everything as a FIRST one, so
  the "Can Build" label and the plus button were decided from the wrong number; the AI's
  upgrades **incremented `farmsBuilt` and raised no capacity at all**, so every farm, forest and
  oil well all 206 countries ever bought was a pure cost up a quadratic ladder against a ceiling
  that could not move; its forts **never recomputed `defenseBonus`**, so about six hundred forts
  on the map took a die off nobody; and the fort tooltip's own copy of the defence formula
  disagreed with the game's, promising a fort was worth several times what it is. Three rules
  follow. **The price ladder is QUADRATIC** — `ceil(base · n · (n · 1.05) · devIndex / 4)`, the
  fifth about 26× the first — and `balance.js` called it linear for as long as it existed.
  **`nth` is the number STANDING AFTER the purchase**, which is what every correct copy meant.
  And **the capacity gain is +10% of the ceiling BEFORE the transaction, per unit, never
  compounded** (audit 5.1 A, a catastrophic bug once already).
- **AN UPGRADE'S GAIN HAS TWO TERMS, AND THE FLAT ONE IS THE WHOLE OF ECONOMY STAGE 3.**
  `applyUpgrade()` adds `((ceiling · 0.10) + flat) · bought`, with neither half compounded.
  `upgradeFlatCapacityGain` in `balance.js` is **one number per CEILING** — food 100,000,
  cons-mats 500, oil 200 — because the three are in three different units and one constant
  across them would be three unrelated balance decisions wearing one name. The oil figure is
  the legible one and a unit test pins the identity: `oil × maxOilWells` is exactly
  `oilRequirements.naval`, so **five oil wells fuel one warship anywhere on the map**. Why a
  flat term at all: ten per cent of a ceiling is eighty people on Vatican City and a fortune on
  China, so the same upgrade at the same price paid back in under a turn in one place and in
  **13,202 turns** in another. **The lever is the BENEFIT and never the PRICE**, and that is a
  decision, not an oversight — pricing each upgrade against the territory's own income closes
  the same gap by taxing the large, and Leigh turned it down: *"larger territories should not be
  penalised for their size … but smaller countries get a little nudge so that they are not just
  a total waste of time."* Anyone who reads the payback table without that sentence will propose
  it again. Measured, `node tools/econ-lab.mjs upgrades`: the first farm's payback across the
  map went from `0.8 / 14.1 / 472.5 / 3,780` to `0.1 / 11.9 / 60.6 / 202.5` and **must not go to
  zero** — China's farm is still worth fourteen times Vatican City's in absolute gold.
- **CONSTRUCTION-MATERIALS CAPACITY DECIDES WHO MAY UPGRADE AT ALL, and it is a RULE now.**
  `src/rules/economy/seeding.js` — pure, Node-runnable — holds `initialOilCapacityFor()` and
  `initialConsMatsCapacityFor()`; `resourceCalculations.js` calls them and **`tools/econ-lab.mjs`
  IMPORTS them** rather than carrying the copy it used to, because a measuring instrument holding
  its own copy of the thing it measures will eventually measure the copy. Materials buy upgrades
  and nothing else, and the ceiling was `f(area)` almost entirely: Germany needed **eighty turns**
  of its own regeneration to fill one territory's twenty slots and China needed **one** (audit
  D7). It takes a population term now (`sqrt(pop/1000) · devIndex · CONS_MATS_POPULATION_SCALE`)
  and a floor (`MIN_CONS_MATS_CAPACITY`, 2,500, which replaced a bare inline 500). **The square
  root is what makes it a nudge and not a subsidy** — Germany ×12, China ×1.7 — and every ceiling
  on the map went UP, so nothing was taken from the large to pay the small. `forestWorkAround` in
  `aiCalculations.js` was the plaster over this and is deleted; if it ever has to come back, D7 is
  not fixed. **Oil is deliberately NOT re-based**: oil is a thing the ground has or has not, and
  the small territory's nudge arrives through the oil well instead.
- **THE FOUR UNIT TYPES ARE ECONOMICALLY DIFFERENT, AND THE DIALS ARE PROD-POP AND UPKEEP —
  NEVER GOLD.** Until economy stage 4.1 every type cost exactly 1.00 productive population per
  unit of force and exactly 0.050 gold of upkeep per thousand force, so nothing but the die
  modifiers and the siege score told a rifleman from a battleship and **infantry strictly
  dominated naval in open battle**. It is 1.00 / 1.67 / 2.00 / 2.50 force per person and
  0.050 / 0.080 / 0.100 / 0.150 upkeep per thousand force now: a vehicle is crewed rather than
  manned, and pays for it every turn. **The gold prices were left alone on purpose**, and that is
  what preserves the one economic decision the military layer already had — vehicles 5–6× better
  per gold in a SIEGE and no better than infantry in the OPEN, with oil pricing the split.
  `tests/unit/balance-unit-economics.spec.js` asserts both as RATIOS rather than numbers, so a
  later tuning pass cannot quietly undo them. **`armyProdPopPrices.infantry` is not a dial**: it
  is `INFANTRY_IN_A_TROOP`, and `bolsterArmy()` adds that many soldiers per purchase.
- **THE PLAYER'S TREASURY IS POOLED FOR UNITS AND NOT FOR BUILDINGS**, and the two halves are
  reached by different code. Buying units runs
  `checkForMinusAndTransferMoneyFromRichEnoughTerritories()` and its prod-pop twin, so a
  conquest anywhere funds a war anywhere — deliberate, and audit D5 keeps it. Buying a farm does
  NOT: `addPlayerUpgrades()` debits the territory alone and `calculateAvailableUpgrades()` gates
  the plus button on that territory's own gold. So a per-territory gold figure is half fiction
  and half load-bearing, which is worse than either — the info panel's labels and the
  Dominapedia now say which is which, and that (stage 4.2) is the whole of what D5 left.
  Construction materials are never pooled at all.
- **`upgradeOrderPriceFor()` charges an order at the LAST one in it, and BOTH SIDES CAN NOW
  REACH THAT PRICE.** Five farms in one transaction cost `price(5)`; five bought one a turn cost
  `price(1) + … + price(5)`, about 2.2× more. The discount is deliberate and stays — saving up
  to buy five at once is a real decision and the game has few enough of those — but until E8 was
  closed it was a PLAYER discount, because the AI buys one at a time in a loop that re-scores
  the territory after each purchase and was charged `price(built + 1)` every pass.
  **`nextInOrderPriceFor()` is what fixes that without changing any price**: it returns what
  adding ONE MORE to an order costs, and those marginals telescope to the order price exactly —
  the first is the whole of `price(built + 1)`, because an order of zero costs nothing, and
  every one after it is the difference between two rungs. Both the economy loop and the fort
  loop in `aiCalculations.js` go through it. A unit test walks four kinds × four order sizes and
  asserts the sum equals the order price; if it ever stops doing so, the AI is paying a number
  the price rule quotes to nobody.
- **Fixing a defect can make the game harder, and the economy phase is the case in point.**
  Stage 1 changed no balance number and moved the world a long way: with the AI finally paying
  full price for its infantry and its forts finally defending, the largest empire fell in four
  goals of five (Continental 104 territories to 35) and **no continent is completed in a
  150-turn game any more** — so the continent bonus the previous phase shipped does not arrive.
  Two defects had been flattering the world. `tools/ai-sim.mjs`'s `upg` / `forts` / `gold` /
  `foodCap` columns exist to catch exactly this, and known-issue **BO** is the open item.
  **Stages 3 and 4 then moved it back the other way, further and in one step**: mean surviving
  countries 87 → 58, mean largest empire 52 → 110, and six continents held outright across the
  five runs where none were held in any of them. Both movements are larger than either stage
  predicted, in opposite directions, and neither was a defect — which is the actual lesson. **A
  balance change in this game is not judged by reading the diff.** Same invocation both times:
  `tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND`, five goals, tabled in the
  checklist. If the world now consolidates too much, the dial is `DICE_ATTACK_ADVANTAGE` or
  `ATTACK_ADVANTAGE` and never a third one — see the two-attack-dials note below.
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
- **EACH MAP VIEW IS ITS OWN MODULE, AND `src/ui/map/mapViews.js` IS THE ONLY THING THAT SAYS
  WHICH ARE ON.** `views/physicalView.js` is the relief, `views/continentView.js` the boundary
  bands, `militaryView.js` the force ramp — and **the political map is deliberately not a
  module**, because it is the map and the other three are decorations on it. What that replaced
  was a `continentView` string, a `mapMode` integer exported from `ui.js` and three functions
  that each half-owned the answer, with seventeen sites asking `mapMode === 2` to mean "the
  relief is up" (`isPhysicalMapActive()` now). Three things follow. **The button is not touched
  from there**: `ui.js` subscribes with `onMapViewChanged()` and owns the icon, the title and
  the legend, so one subscription installed from bootstrap replaces a call after every
  transition. **Order inside `applyMapView()` is load-bearing** — the military view decides what
  `repaintMap()` paints, and leaving the relief repaints on its way out, so the military state
  is settled first. And **leaving the military view repaints explicitly**: the old code
  repainted only on the way out of the relief, which was latent because every route the BUTTON
  takes out of the military view passes through the relief — anything calling the view directly
  would have left the map wearing the force ramp.
- **The map-view button walks FOUR views, `continent → normal → military → physical`, and
  `continent` is the default.**
  Swapped as the opening move of the continent-bonus phase: a continent is now a thing a player
  wins something for holding, and a boundary a player has to go looking for is a boundary they
  will not plan around. Three consequences. The default is **applied** at the end of
  `svgMapLoaded()` rather than merely declared — the SVG ships with plain sea-coloured strokes,
  so setting `continentView` alone would put the button in one state and the map in another,
  which is the same species of mistake as anything made correct only as a side effect of a
  click. `resetContinentView()` goes back to `DEFAULT_CONTINENT_VIEW` and **not** to the literal
  `normal`, which are no longer the same view — otherwise the second game of a session opens on
  a different map from the first. And `DEFAULT_CONTINENT_VIEW` is named once because three
  places have to agree about it. **The military view was put between the two political maps and
  the relief** (register item E1): the political map is what it is read against — who owns
  what, and then where the force is.
- **THE MILITARY VIEW SHADES A RATIO, MARKS A BORDER ON REAL ODDS, AND KEEPS ITS DECISION PURE.**
  `src/ui/map/militaryShading.js` decides what the view says and runs in Node;
  `src/ui/map/militaryView.js` turns that into elements in the map document. Six things follow.
  **The shade is `garrison / the strongest enemy that can reach it`, never an absolute army** —
  an absolute scale paints China dark and answers no question a player has, whereas *"which of
  my borders is thin"* is the question, and it is the same maximum
  `strongestEnemyPowerAgainst()` has always sized the AI's reserve with. **A territory nothing
  can reach is SECURE whatever it holds**, which is what makes the frontier draw itself.
  **THE SHADE IS A COMPARISON AND THE MAP HAS TO SAY SO.** It is the one thing about this view
  that cannot be inferred from looking at it, and the question that proved it was Leigh's: the
  United States holding two million came out PALE while France holding the same two million came
  out dark, which is correct — they face different neighbours — and is unreadable unless stated.
  Two places say it now. The legend carries the rule in words (*"shade compares a garrison with
  the strongest army that can reach it — not its size"*), and the TOOLTIP carries the arithmetic
  for the territory under the pointer: `Garrison 2M against 5.1M from Canada — 1 : 2.6`, plus a
  line naming the odds when the border is marked. `militaryTooltipLines()` is that, and
  `territoryTooltipLabel()` in `ui.js` appends it — empty in every other view. The plan keeps
  `faced` and `facedBy` for exactly this: a colour cannot explain a ratio.
  **A THREAT IS A TERRITORY AND NOT A COUNTRY, AND EVERY ONE OF THEM IS MARKED.** The plan
  forecast a single pairing per province -- the strongest enemy beside it -- so a border facing
  two dangerous neighbours was marked on one of them and drawn clean on the other, which says
  *that one is safe* about a border that is not. Leigh found it playing Canada: the United
  States is marked along the 49th parallel and Alaska, no less able to take the place, was left
  bare. `planMilitaryView()` now returns a `threats` ARRAY per territory -- one entry per enemy
  neighbour that clears the warning odds, worst first BY THE ODDS rather than by the army,
  because a smaller neighbour on better ground is the more dangerous one -- and each gets its
  own stretch of border at its own colour. **`THREAT_CANDIDATE_RATIO` (0.6) is what keeps a call
  per PAIRING affordable**: `combat-lab cliff` puts a take probability at raw parity at 24.3%
  and at 0.35:1 at zero, so a neighbour well under the garrison cannot reach the 35% band
  whatever it is made of, and terrain and forts only ever lower it further. The odds are still
  never asked for anybody but the player, and `tests/unit/ui-military-shading.spec.js` counts
  the calls. **The SHADE is still the strongest single enemy** -- that is a ratio and it has one
  answer -- so `faced` / `facedId` and `threats` describe different questions and are not
  interchangeable.
  **THE THREAT IS DRAWN ON THE SHARED STRETCH OF BORDER, NOT AROUND THE TERRITORY.** Colouring
  a whole outline red says *you are encircled*, which is a different and untrue statement about
  a country facing one dangerous neighbour and six harmless ones (Leigh: *"i would want the
  border section only which touches the stronger country to have the red border"*).
  `src/ui/map/borderSegments.js` extracts it: a segment is on the shared border when BOTH its
  endpoints are anchors of the neighbour — stricter than "either end touches", because at a
  tri-point the loose test draws a spur into the middle of the map. **It only works because the
  map is WELDED**: the test is EXACT coordinate equality, which was the empty set almost
  everywhere before `tools/weld-map-borders.mjs` ran, and which is also the safety — a
  near-miss is two coastlines across water, and a tolerance would draw a land border over a
  strait. A neighbour that can reach a territory without touching it (an amphibious one) gets
  the shade and the tooltip and no line, because there is no border to draw one on.
  **THE CAP IS BUTT AND THE SHADOW IS CLIPPED, and both are about which country the mark is
  ABOUT.** A round cap extends half the stroke width past the last shared anchor, along the
  direction the outline was heading — which at the end of a shared stretch is into the border
  with the NEXT neighbour, so a warning about France left a red blob on Belgium's frontier.
  And the mark is centred on the line, so it reads identically from both sides while being a
  statement about only one of them: three widening, fading strokes are laid under it and
  CLIPPED TO THE SUBJECT TERRITORY's own outline, which is what puts the shadow on the player's
  side and stops it dead at the border whatever width it is drawn at. Stacked strokes rather
  than a Gaussian blur because an SVG filter needs a REGION, and a region big enough for a
  border crossing half the map is a raster the size of the map allocated per marked territory.
  **THE OVERLAY IS KEPT LAST IN THE MAP DOCUMENT BY A `MutationObserver`, and that is not
  belt-and-braces.** SVG has no z-index. Clicking a territory re-appends its path to the end of
  the document — that is how the game raises a selection — which painted the clicked
  territory's own fill over the overlay, so **its force figure vanished the moment you clicked
  it**. There are five such re-appends in `ui.js` alone and the next one added would break it
  again, so the invariant is enforced in `militaryView.js` rather than by a call after each of
  them; re-appending fires the observer once more, finds the layer already last, and stops.
  **The red is `takeProbability()` and not the ratio again** — the real dice model with terrain,
  forts and composition in it, because a warning built on raw force fires on every mountain
  fortress in the Alps and is ignored by turn three. The assumption behind it is stated in the
  file: the neighbour commits its whole useable garrison, which is a question about CAPABILITY
  and not a prediction of what the AI will send. **The edges are 15% and 45%, RE-CUT from
  35/60 because amber never fired.** Bisecting 120 real pairings for the ratio at which each
  edge opens, 35/60 gave an amber band **14%** wide in force ratio on open ground (1.10:1 to
  1.26:1) and **6%** wide behind one fort (1.37:1 to 1.46:1) — a neighbour had to land inside a
  few per cent to be marked amber at all, so a border went from unmarked to red with nothing in
  between and Leigh had never seen an amber border in a game. **That is the CLIFF and not a bad
  threshold**: an extra die is an unmatched die and an unmatched die is a free hit, so the real
  odds move in jumps, and widening the band is the only thing available from here. At 15/45
  amber opens at **0.90:1** and red at **1.24:1**, a **37%** window, so amber means *this border
  is roughly even* — which is worth saying, because a defender at parity loses the province
  24.3% of the time. Re-measure with the same sweep if the dice bands or `DICE_ATTACK_ADVANTAGE`
  move. **`takeProbability()` is called DIRECTLY and never through
  `calculateTakeProbabilityPreBattle()`** — that function keeps module-level state, so a map
  refresh landing while the player allocates units in the attack window would overwrite the
  setup of the battle they are about to fight. **The odds are asked for nobody but the
  player, and only about a neighbour strong enough to be a candidate**, which is the bound the
  whole design rests on and which is invisible in the running game, so
  `tests/unit/ui-military-shading.spec.js` counts the calls. And
  **the figures are sized in screen pixels and redrawn on `onZoomChanged()`**, drawn wherever
  the territory is big enough on screen to hold one — so the zoom declutters, and Europe at
  zoom 1 is a dozen numbers and at zoom 4 is all of them. **THE FIGURES ARE THE FRONTIER'S**:
  the player's own land and every enemy territory touching it (`entry.frontier`, folded from
  the same neighbour walk the plan already does), and this has been both ways round. It drew a
  subset first, was widened to the whole map on the argument that a subset is a decision about
  what the player may compare, and was narrowed again by Leigh — 359 figures is a great deal of
  ink for a question about your own border, and the number competes with the shade, which is
  what the view is actually built on. What makes the narrowing safe is that **nothing is
  hidden**: the shade still covers the world and the tooltip still answers for any territory
  under the pointer, and the legend says so in words. With no player at all (spectator mode)
  the whole world is frontier, because there is nobody to draw one around.
- **EVERY OVERLAY DRAWN ON THE MAP LIVES IN ONE GROUP, AND `src/ui/map/overlayLayers.js` OWNS
  BEING LAST.** SVG has no z-index and clicking a territory re-appends its path to the end of
  the map document, so anything drawn over the map has to be put back on top — which the
  military view enforced with a `MutationObserver` of its own. **Two overlays each enforcing
  "I am last" is not two fixes, it is a LOOP**: each re-append fires the other's observer for
  ever. So there is a single parent (`mapOverlayLayer`) kept last by one observer, the overlays
  are ordered groups inside it (`GROUP_ORDER`, flags under the military marks), and the
  `pointer-events: none` that keeps a decoration from swallowing a click is on the parent. An
  e2e spec asserts the PARENT is last and the military group is inside it; asserting the
  military group itself is last is what that spec used to say and is now wrong.
- **THE OWNER FLAGS ARE AN OVERLAY ON EVERY VIEW, NOT A FIFTH VIEW** (`src/ui/map/flagOverlay.js`,
  Leigh's call). A flag chip on each territory showing who holds it NOW — a colour tells you two
  territories share an owner and never which owner, so reading the political map means hovering
  province by province. It composes with the continent bands, the political map, the force ramp
  and the relief rather than replacing one, which is why it is a second button in
  `mapModeContainer` (`flagOverlayButton`, `aria-pressed`) instead of another stop on the view
  cycle. Four things. **A RELATIVE URL CANNOT BE USED FOR THE IMAGE, and it fails only in the
  build**: the map is an `<object>` with its own document, and Vite hashes that document into
  `/assets/svgMaster-<hash>.svg`, so `flags/Spain.png` means `/resources/flags/…` under
  `npm run dev` and `/assets/flags/…` in a build, where nothing is. It is worse than a 404 — the
  preview server answers an unknown path with `index.html` and a 200, so nothing looks like it
  failed and the map fills with broken-image glyphs. The href is resolved against the HOST
  document instead, and the e2e spec asserts the CONTENT TYPE rather than the status, because
  the status is the thing that lies. **It defers to the military view's figures**: while that
  view is up a flag is drawn only where a figure is not (`militaryFrontierIds()`, asked live
  rather than remembered), so the war zone is measured and the rest of the world is named. **The
  chip is a fixed 3:2 plate with the flag fitted inside it** — the artwork is not one aspect
  ratio (Switzerland is square, Nepal a tall pennant, the United States 1.9:1), so `meet` keeps
  every flag undistorted and the dark plate shows where it does not reach, which also stops a
  white flag disappearing into pale terrain. And **it is sized in screen pixels and redrawn on
  `onZoomChanged()`**, the same rule as everything else on this map, with a conquest reaching it
  as a coalesced `TERRITORY_CHANGED`.
- **The military view's ramp is TWO theme tokens, and its weak end may never be blue.**
  `--force-weak` and `--force-strong`; the five bands are mixed between them in JS, because a
  theme should be choosing a feel (olive, sepia, phosphor) rather than balancing five swatches.
  Two rules bind every pair: it must be ONE HUE running pale to deep, so the ramp reads as a
  quantity rather than as five categories, and **the pale end must not be blue** —
  `resources/sea.png` averages `rgb(146, 160, 234)`, so a washed-out blue territory disappears
  into the ocean, which is precisely the territory the view exists to point at.
  `src/ui/components/MapLegend.js` is the key, and it asks `militaryView.js` for those colours
  every time it is shown rather than holding a copy: a legend with its own palette is right
  until somebody switches theme, and is then a key to a map that no longer exists. **It sits
  bottom RIGHT**: the bottom-left corner belongs to the phase bar — the turn, the flag and the
  colour picker — and it clears the autosave indicator by sitting at 88px rather than at the
  40px the bottom table leaves free.
- **THE COUNTRY PALETTE IS ARITHMETIC, AND IT COSTS EXACTLY THREE `Math.random()` DRAWS PER
  COUNTRY.** `src/ui/map/palette.js` is pure and unit-tested: a country's colour is a QUANTISED
  HUE at a fixed saturation and lightness band, where it used to be three independent channels
  in `[50, 200)` — which is why the map carried muddy olives, near-blacks and near-primaries at
  once and looked like a 1990s atlas. **The draw count is the invariant, not the colours.**
  Those draws sit on the game's seeded stream during bootstrap, so adding or removing one moves
  every seeded outcome in the game (the lesson `generateDistinctRGBs()` left behind), and
  keeping it at three in the same order is what let the palette be modernised without
  re-baselining a single exact-outcome spec. `tests/unit/ui-map-colouring.spec.js` counts the
  calls; a future palette may produce any colour it likes and may not draw a fourth time. Two
  bands are chosen against the world rather than by taste: the lightness FLOOR stops a country
  coming out nearly black, and the CEILING keeps land darker than the ocean, which averages
  `rgb(146, 160, 234)`.
- **EVERY LINE ON THE MAP IS MEASURED IN SCREEN PIXELS** (`src/ui/map/strokes.js`), the rule the
  attack arrows established. A 1-unit outline is a hairline at zoom 1 and a five-pixel band at
  zoom 6, which is most of why a zoomed-in map looked heavy. **`HAIRLINE_PX` is 1.8 and it is
  the weight of the whole map** -- the first pass set it to 0.9 on the argument that a border is
  a division between two fills rather than an object in its own right, which is true of a print
  atlas and wrong for a game board, where the border is what a player traces to work out who
  they can reach (Leigh: *"they need to be thicker than they are now"*). Every other stroke is a
  multiple of a pixel figure, so this one constant moves them all. `setPathStrokePx()` remembers the
  intended width per path in a `WeakMap` and one `onZoomChanged()` subscription re-applies them
  all — **remembered rather than read back off the element**, because a territory outline, a
  reachable-destination highlight and a besieged border are three different weights and
  multiplying the current value would compound rounding on every notch. `ui.js`'s
  `setStrokeWidth()` and `battle.js`'s deactivation strokes go through it.
- **The map's line work is THEMED, and `src/ui/map/themeColours.js` is the one copy of the
  lookup.** `--map-ink` (the territory outline, a soft near-black rather than `#000` —
  359 pure-black hairlines is the single most dated thing a map can do), `--map-coast` (the
  plain coast line, defaulting to the colour the SVG has always shipped) and `--sea-tint`
  (blended over `sea.png` with `--sea-blend`, which keeps the texture rather than flattening
  it).
- **THE OCEAN IS THE SAME IN EVERY THEME, and that is Leigh's call rather than an oversight.**
  `--sea-tint`, `--sea-blend` and `--sea-sparkle` are tokens whose value no theme may change,
  exactly like `--debug-surface` / `--debug-ink`: they are tokens ONLY because `style.css` may
  not carry a colour literal outside `:root` and all three are read from rules that are. Do not
  "harmonise" them with a palette. The history is worth keeping because the idea will occur to
  somebody again: tinting the sea per theme was built, and it produced a Terminal ocean sitting
  at the same lightness as the land inside it; giving each theme its own blend mode fixed that
  and was then overruled outright — *"change the sea to be the color it is in the command theme
  for all themes"*. The ocean is the ground the map stands on rather than chrome, so a theme
  recolouring it changes what the map IS rather than how it is dressed.
- **A SPARKLE IS A GLINT ON WATER, so it is placed on water.** `createSparkle()` rejection-samples
  a point through TWO hit tests -- the host document must answer with the map object (so a
  sparkle is never drawn over the phase bar or an open window, which sit under
  `.sparkles-container`), and the map's own document must not answer with a territory path.
  Eight tries, then it gives the tick up: zoomed into the middle of Asia the right answer is no
  sparkle rather than a speck of dirt on a country. It is an ocean mask by rejection rather
  than a computed one because the visible water is whatever the camera and the open panels
  leave, and that changes on every pan. What it fixed: the sparkle was a 2px triangle drawn in
  `--border-color`, which carries 30% alpha of its own, animating to a peak opacity of 0.4 --
  so it was drawn at about 12% and nobody ever saw one. It is a four-point star at full
  strength in `--sea-sparkle` now, and being confined to open water is what lets it be bright. The ink is applied at BOOTSTRAP by `assignStartingColours()`
  rather than waiting for a repaint — the country-selection screen never repaints, so the map
  wore the file's own black strokes there — and a `THEME_CHANGED` listener re-inks the base
  paths **without a full repaint**, because a repaint takes the attack arrows and the
  destination highlights with it and the player can open Options mid-move.
- **A VIEW THE PLAYER CHOSE IS THEIRS UNTIL THEY CHANGE IT, and two things used to take the
  relief map away from them.** Leigh reported both: a drag of the zoomed-in relief dropped back
  to the political map on release, and so did a plain click. **The drag was a bug and the click
  was a RULE, now deleted** — *"if there is a rule to leave the physical map on click then get
  rid of it, that is not desired behaviour"*. The rule's justification (a territory has to be
  legible to be clicked, and relief fills sit at 1% opacity) is wrong about what the player is
  doing: somebody on the relief is there in order to look at the ground and click on it. What
  is left of `exitPhysicalMap()` is the colour picker and the end of a turn; nothing on the map
  itself calls it. **The drag half is the more transferable lesson: `mouseup` fires BEFORE
  `click`, and `mouseup` is where the drag flag is cleared — so every `if (!isDragging())`
  inside a click handler is always true and always was.** `endedInPan()` in `camera.js` is the
  question that can be asked there: it survives into the click and is set from how far the
  pointer actually travelled (`PAN_SLOP_PX`, 4 — not zero, because a real hand moves a pixel or
  two during a click). `tests/e2e/map-interaction/view-persistence.spec.js` covers both, and
  both were confirmed to fail against the old behaviour before the fix was kept.
- **THE TERRITORY TOOLTIP IS DRIVEN FROM ONE DELEGATED LISTENER, AND IT USED TO BE ONE PER
  HOVER.** `svgMap`'s `mouseover` added a fresh `mousemove` AND a fresh `mouseout` to the
  territory every time the pointer entered it and removed neither — measured, twenty-four
  hovers left twenty-four of each, for the life of the page. Every one of them rebuilt the whole
  tooltip (the continent walk, the leader lookup, the military forecast, the upgrade rows) on
  every pixel of pointer movement, so a session degraded until the tooltip stopped keeping up
  and only a reload cleared it: *"after changing map modes the tooltip stops generating until
  you refresh"*. **This is the move button's defect exactly** and it closes the same way —
  `updateTerritoryTooltip()` is called from ONE `mousemove` listener installed at bootstrap,
  which reads `event.target`. Two things follow. **The label is cached per territory**, because
  a rebuild is expensive and `mousemove` fires dozens of times a second; `TERRITORY_CHANGED`
  and `TURN_CHANGED` mark it stale, so a tooltip held open through an AI turn still updates.
  And **clearing the CONTENT rather than merely hiding** is what makes re-entering the same
  territory rebuild. `hover.spec.js` counts the listeners a hover adds and the answer must be
  zero.
- **EVERY TOOLTIP IS PLACED BY `placeNear()`, AND `#tooltip` IS `position: fixed`.** Leigh,
  playing: *"tooltips near the bottom should move above the mouse pointer because they are
  causing the browser to flicker and resize when they get too near the bottom"*. **Two
  separate faults produced that and only one of them was arithmetic.** The RESIZE was the box
  being `position: absolute`, so one placed near the foot of the window extended the DOCUMENT,
  raised a scrollbar and reflowed the page — and the reflow moved whatever the pointer was
  over, which moved the tooltip, which is the flicker. It is FIXED now, which is also the more
  correct of the two since every caller passes `clientX`/`clientY`. The PLACEMENT was **eight
  copies of the decision** across `ui.js`, `resourceCalculations.js`, `InfoTable.js` and
  `tableDom.js`, lifting the box by 30, by 50, by its height, or by its height plus 25, with
  three of them calling "near the bottom" a fixed 100px — measured in the running game, a
  territory tooltip is **148–216px** tall, so the box was moved up by less than its own height
  and still ran off the end. There is one rule now: below the pointer when the whole box fits,
  otherwise lifted by its OWN height, then clamped into the window on both axes.
  `placementFor()` is the arithmetic, pure and unit-tested for every edge, because that bug
  survived for years precisely because reproducing it meant hovering the right pixel.
  **The size is measured INVISIBLY and cached per change of content**: `offsetHeight` is zero
  while an element is `display: none`, which is why the old callers guessed with a constant —
  and the four that did measure showed the box, read it, hid it, moved it and showed it again,
  two forced reflows and a visible flash in the wrong place on every `mousemove`.
- **THE TOOLTIP SAYS WHAT A TERRITORY HAS BUILT** (`src/ui/map/upgradeTooltip.js`, register item
  M1's second half). Farms, forests, oil wells and forts, each with the game's own artwork
  beside the count — the same picture the Upgrade Territory window draws. Before it, the only
  way to learn a province's development was to select it and open that window, one territory at
  a time, so *"is this worth taking, or merely takeable"* had no answer on the board. **A row is
  only drawn for something that EXISTS**: four zero rows would be the same tooltip on nine
  tenths of the map, and a tooltip that says the same thing everywhere is one a player stops
  reading. The rows are a pure function of the territory and unit-tested in Node; `ui.js` turns
  them into markup, and the `<img>` is resolved against the HOST document, which is where the
  tooltip lives — anything drawn INSIDE the map document has the base-url problem
  `flagOverlay.js` records.
- **THERE IS WEATHER OVER THE WORLD, AND IT IS TWO PICTURES CROSS-FADED BY THE ZOOM**
  (`src/ui/map/cloudOverlay.js` + `cloudTexture.js`). Leigh's brief: *"half like puffy white
  clouds if zoomed in and half like satellite image cloud blankets if zoomed out ... cartoony
  single clouds drifting all in one direction, but that direction can change per minute or so"*.
  Below zoom 2.4 the sky is thirteen storm systems that barely move and slowly change shape;
  above 3.4 it is two hundred cartoon clouds with shadows on the ground; between the two both
  are on at part strength, which is what stops the change of scale reading as a rendering fault.
  Six things. **THE CLOUDS ARE THE ONE THING ON THIS MAP MEASURED IN USER UNITS**, and every
  other overlay is in screen pixels — a label is chrome and must not magnify, a cloud is an
  object over the world and must, or zooming in flies you toward the ground while the sky stays
  put. **The per-frame work is CSS and the shared state is JavaScript** (Leigh: *"css is a good
  option for the clouds and anims too"*): the cycles — a mass swelling, a puff bobbing — are
  `@keyframes` injected into the map document, and only the DRIFT is JS, because it wraps around
  the world, is shared by every cloud and eases to a new heading every minute or so. They never
  fight over one attribute: **JS owns the outer group's `transform`, CSS owns the inner
  element's**, which is why every cloud is a group inside a group. **A `<style>` in the map
  document is allowed here and `attackArrows.js` refused one for a reason that does not apply** —
  a band's travel is a per-arrow distance so it could never have been one keyframes rule; clouds
  are a handful of cycles shared by every cloud, which is what a keyframes rule is for. **The
  artwork is BAKED, not filtered**: `feTurbulence` on a moving layer means the browser
  regenerating fractal noise every frame, so the blanket is value noise rendered once into a
  canvas and used as a data URI, and a puff is flat ellipses with a soft-gradient halo pass
  under a solid pass — one shape with one rim, because gradient-filled lobes show each other's
  rims through the overlaps and a cloud comes out looking like a stack of discs. And **the
  button has THREE settings** — full, half, off — so `data-clouds` rather than `aria-pressed`,
  which can only say two; OFF removes the group and stops the loop rather than making it
  transparent, and the puff band is `display: none` whenever it is invisible, which is what
  makes the zoomed-out map pay nothing for two hundred clouds it is not showing.
- **The map is three modules under `src/ui/map/`** (Phase 6.7). `camera.js` owns zoom and pan:
  zoom is **instant** (no animation, so no latch that drops a fast second wheel event),
  anchored on the pointer in user coordinates, and clamped to the world bounds so nothing off
  the edge of the map can be shown. `colouring.js` owns the bootstrap palette and the
  locked-country muting. `MapView.js` renders the map from the store — `repaintMap()`,
  `repaintCountrySelection()`, `paintLockedCountries()`. **`currentMapColorAndStrokeArray` and
  the `saveMapColorState()` / `restoreMapColorState()` pair are gone**: colour is derived, so
  restoring the map is the same call as painting it. Never reintroduce a colour snapshot.
- **THE ATTACK ARROWS ARE SIZED IN SCREEN PIXELS, WHICH IS WHY A ZOOM REDRAWS THEM.**
  Selecting one of your own territories in the Military phase draws one curved, animated
  arrow to each ENEMY territory it may attack — the hatched destination highlight says
  "reachable" and never said *where from*, and it also covers the player's own neighbours,
  which are a transfer and not an attack. `src/ui/map/arrowGeometry.js` is the pure half
  (planning, unit-tested in Node) and `src/ui/map/attackArrows.js` is the only thing that
  turns a plan into elements. Five things follow. **Every constant is a screen pixel
  multiplied by `userUnitsPerPixel()`**: an arrow drawn in map user units is magnified with
  the land, so one set of numbers cannot be right at zoom 1 and at zoom 6 — that is what
  `onZoomChanged()` on the camera exists for, and it has no other subscriber. **The head
  never moves**; when an arrow is too short to see it is the TAIL that is pulled back, and
  that pull-back is capped at HALF THE CHORD because the extension runs along the reverse
  bearing — Germany has eleven attackable neighbours and a generous cap drew eleven tails
  crossing in its middle, a star rather than a fan, hiding the territory just clicked.
  **Arrows on near-identical bearings are separated by BOW and not by moving anything**,
  clustered by angle with the wrap past due east closed by hand. **The animation is SMIL**
  — one `<animate>` on a `stroke-dasharray: band, total` shaft, whose period is longer than
  the path so exactly one band is ever travelling — rather than a `<style>` injected into
  the map's own document, and the timing comes from `getTotalLength()`, so it is set after
  the shaft is in the document. And **the colour is read off the HOST root and written on
  as a literal**, with a dark casing under the bright core, for the reason
  `src/ui/siegeOverlay.js` records: `#svg-map` is an `<object>` with its own document, the
  theme's tokens do not cascade into it, and one flat colour over a hatched destination
  came out as red hairlines. `repaintMap()` is the ONE place they are taken off.
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
- **`generateDistinctRGBs()` is GONE, and what it was protecting still applies.** It was dead
  code kept alive because its `Math.random` draws at module load sat on the game's stream, so
  deleting it shifted every seeded outcome. It has now been deleted and measured: on one seed the
  United Kingdom's starting gold moves 23,555 → 23,131 and West Papua 3's 246 → 472, while
  starting ARMY is unchanged everywhere (army is derived from area and population, not from the
  stream at that point). The four exact-outcome specs its comment predicted would move did not
  need re-baselining — that prediction was several balance passes old. **The warning it carried
  is the durable part: anything that adds or removes a `Math.random` draw during bootstrap moves
  every seeded outcome in the game**, and the cheap way to see how far is to diff the starting
  gold of a few named territories on one seed before and after.
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
  prose. **It happened again and it went the other way**: three pages told the player that
  buying infantry gave ONE point of force for a thousand people and that infantry were
  therefore not worth buying. A purchase gives a thousand points for a thousand people and has
  since 2023 — 100 force per gold, tying naval for the best in the game, with no oil bill and
  the lowest upkeep. The register believed it too (known-issue BR), and it was closed by
  buying three troops in the running game and counting them. **Quote a number in `topics.js`
  only after reading it out of `src/config/balance.js` or `node tools/econ-lab.mjs`.** **Table cells are `white-space: nowrap` except the first column**, so a cell carrying a
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
  its committed continents, a focus continent, a posture (DEVELOP / EXPAND / CONSOLIDATE
  / DEFEND) and two budgets — and `src/ai/targeting.js` rates each candidate target and
  returns ONE verdict. Four consequences. **A COMMITTED CONTINENT IS PERMANENT, AND THE LIST
  GROWS ONE AT A TIME** (Leigh's call): nothing already committed is ever re-ranked,
  re-ordered or dropped — not on a timer, not when the plan looks hopeless, not when the
  leader dies — and the NEXT continent is chosen only once the ones it holds are complete.
  `CAMPAIGN_REVIEW_INTERVAL` and `commitmentIsPointless()` are **deleted**; the old code
  re-picked every five turns and again whenever the commitment "became pointless", which for
  a country whose only foothold continent was complete was every single turn. **Budgets count the sieges already running**, which
  is what ended the 17-to-67-concurrent-sieges problem — a country at its cap opens none.
  **The two coin flips in `getPossibleTurnGoals()` are gone**; a pairing produces a Siege
  or an Attack or neither, never both. And **the campaign carries per-turn scratch**
  (`ratings`, `decisions`) rather than the goal rows carrying it, because the rows are
  positional arrays that get rebuilt and spread twice during refinement. Changing the
  victory condition is `setVictoryCondition()` and nothing else — the AI adapts for free,
  which is the whole reason the objective is derived rather than hard-coded.
- **THE OBJECTIVE IS CHOSEN FROM THE WORLD, AND `reach` IS WHAT MAKES THAT TRUE.**
  `continentAmbitionWeights.foothold` counts only territories already HELD, so a continent
  across a shared border scored exactly the same as one on the far side of the planet — and a
  country with no foothold outside its own continent had its score collapse to
  `continentModifiers`, a static table. That is a FIXED objective wearing the clothes of a
  derived one, and it is measurable: with the whole objective fixed on turn 1, almost every
  country in the world came out with `["its own continent", "Europe", "South America"]`.
  `reach` (weight 2, saturating at `continentReachSaturation` = 6 adjacent enemy territories)
  is folded from the same frontier `theatre.js` was already building — hoisted in
  `planCampaign()` so the border is walked ONCE per country per turn, not twice. **Committing
  one continent at a time is the other half of the same fix**: on turn 1 a country holds one
  or two territories and `reach` is near zero everywhere, so a choice made then is not a
  derived choice at all. Deciding the next only when the current ones are TAKEN means each
  decision is made from a world the country can see.
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
- **THE ENTRY PRICE TO AN ATTACK IS AN ARMY MULTIPLE, AND IT IS WHY THE WORLD USED TO FREEZE.**
  A border territory keeps `defenceKeepRatio` x the strongest enemy that can reach it and marches
  out with `appetite` of the rest, so against a comparable neighbour it attacked at **0.35:1** --
  and 0.35:1 is a **0.0% chance of taking the territory on FLAT GROUND WITH NO FORTS**. Inverted,
  `army needed = E x (ratio / appetite + keep)`: **2.36x** the neighbour's army on flat ground and
  **3.36x** on mountain, to attack at 65%. Between neighbours with similar economies that never
  happens, which is the whole of the executor's *"the most this territory can spare reaches only
  0%"* on 56 of 61 sampled decisions. **It was never the terrain** -- weakening mountains does not
  move a number that is already zero, and that theory was tested and rejected by measurement.
  Three things now lower it, and none of them is a combat dial. **`risk_taking` is a leader trait**
  (aggressive 0.6-1.0, balanced 0.3-0.7, pacifist 0.0-0.4) that moves the keep-back either way
  around `defenceKeepRatio` through `riskKeepSwing`, so the world contains leaders who can break a
  deadlock and leaders who cannot -- which is the point, and is why it is a trait rather than a
  lower constant for everybody. `minimumHomeShare` (0.1) stops any combination of traits emptying
  a province, because a border held by nobody is a territory given away. And **the keep EXCLUDES
  the attack's target**: it is a MAXIMUM over reachable enemies, so before that exclusion one
  powerful neighbour sized the garrison on every border a country had and froze it against
  everybody, including neighbours a fraction of its strength.
- **A TERRITORY MAY ATTACK MORE THAN ONCE A TURN, AND THE FORCE IS NEVER SPLIT IN ADVANCE.**
  `doAiActions()` carried a bare `//only one attack from any territory per turn` -- a rule the
  PLAYER has never been subject to -- so a province bordering three weak enemies took one of them
  a turn however much army it had left, and a breakthrough could not be exploited in the turn it
  was made. `attacksPerTerritoryFor()` gives 1..3 from `risk_taking` and `territory_expansion`.
  **It is a CAP, not a ration**: each attack is sized against what is left AFTER the previous one,
  because `mainArrayFriendlyTerritoryCopy` is the goal's working set and `doAttack()` debits it,
  so the ODDS FLOOR is what stops the second and third. Never divide the garrison up front -- the
  battle is a step function, so two attacks at 0.175:1 are 0% and 0% where one at 1.5:1 is 77%.
  Two knock-ons. `attackLaunchedToArray` was **written and never read** until this landed; the
  one-attack rule had made a repeat impossible, and lifting it makes that array load-bearing,
  because a won attack hands you the territory and a second attack on it would hit your own
  province. And `attackDiscipline.basePerTurn` went 1 -> 2, because **85% of the countries on this
  map hold exactly one territory** (176 of 207) so `territoriesPerExtraAttack` never fires for
  them -- at 1 the per-territory cap would have been dead for the great majority of the world.
- **LEADERS DIE, AND THE SCHEDULE IS DERIVED RATHER THAN STORED** (`src/ai/succession.js`). A
  country's character used to be drawn once and fixed for the whole game, so a stalemate between
  two comparable neighbours could never break: **everyone gets richer together, so the ratio
  between them never moves.** Measured with the entry price already lowered, the largest empire
  reached 71 territories at turn 50 and was still on 71 at turn 150 while the world's army tripled
  from 67M to 192M and its gold multiplied by five. Every **15-20** turns a leader is replaced
  (halved from 30-40), a fresh personality is drawn, and `clearPlansFor()` wipes that country's
  setbacks, posture, theatre and **walls** -- a wall is a judgement reached by somebody no longer
  in charge, and keeping it would give a country a new personality with none of the change of
  mind that is the point. **IT NO LONGER WIPES THE COMMITTED CONTINENTS**, and that reversal is
  what makes the shorter term cheap: the conquest of a continent is the COUNTRY's plan and
  outlives whoever is running it, so an heir inherits the war and re-decides only HOW to fight
  it. Wiping the objective too made a succession a country forgetting what it was for -- a
  fifty-turn war could end because somebody died. The term comes from an **FNV-1a hash of the country name**, not a tenure clock: that
  costs no `Math.random` draw (which would move every seeded outcome in the game, once per country
  per succession), needs no save slice, survives save/load for free, and staggers 207 successions
  instead of pulsing them. The player is never succeeded (`leaderType === "human"`). **It must run
  before the leader is read and before `planAiCampaign()`**, which is why `clearPlansFor()` also
  drops any campaign already derived for this turn.
- **THE PLAYER HAS AN OPENING GRACE PERIOD, and it lives in `rateTarget()`.**
  `PLAYER_GRACE_TURNS` (5) is the number of turns before the AI will OPEN an attack or a siege
  against the player. It exists because 206 countries plan their first turn with full
  information, so a player who chose a one-territory country is reachable by several at once on
  turn 1 and could be eliminated inside ten turns without ever taking a decision that mattered.
  It sits in `rateTarget()`, before the odds are looked at, because that is the one place a
  target is declined with a STATED REASON — the AI debug window and the plan log both read
  `reason`, so a target that vanishes for five turns says why. Three things it deliberately is
  not: not a difficulty setting (the AI fights exactly as hard from turn 6), not a shield (the
  player may attack throughout, and a siege already standing is untouched, because this refuses
  the OPENING of an interaction), and not a bonus to anybody's odds — nothing in the battle
  model knows it exists. Measured: the idle player in a 150-turn Continental run is still on the
  map at turn 100, where it was gone by turn 75 in every run before it.
- **THE ENDING HAS A SCREEN, AND IT IS A SUBSCRIBER RATHER THAN A BRANCH.**
  `src/ui/components/GameOver.js` listens to `GAME_OVER`; `checkForVictory()` and `endTurn()` are
  untouched, which is the whole point of the ending being an event. The wording is
  `src/ui/gameOver/describeEnding.js` — pure, unit-tested in Node, because an ending is the state
  hardest to reach by clicking and a spec that had to play a whole game to see one would be the
  slowest test in the suite. Four things follow. **The standings are a SNAPSHOT taken at the
  ending**, not read when the panel draws: the panel outlives the store it describes, because New
  Game restores a pristine world underneath it. **Nothing is dismissed before it is raised** —
  `.options-scrim` is z-index 10000, above the floating windows and the battle UI, so the ending
  covers a battle-results screen that went up in the same tick rather than racing it. **It has a
  quiet third exit, View Final Map**, because a finished game is the one board a player most
  wants to look at and New Game and Main Menu both throw it away. And **the harness had to learn
  about it**: the idle player in a headless run is usually eliminated inside a hundred turns, so
  `tools/ai-sim.mjs` stopped dead at turn 114 the first time this shipped, reporting a click that
  "intercepts pointer events" — which reads exactly like a game defect.
  `GameDriver.dismissEndingScreen()` is called FIRST in `dismissBlockingPanels()`, ahead of the
  battle results and the start-of-turn panel, because it is the only one of the three in the
  modal band and it covers the other two.
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
- **A front-line territory that is short of force ASKS, AND THE PULL IS A FIELD RATHER THAN A
  NEIGHBOUR CHECK.** `src/ai/muster.js` is the only thing in the AI that adapts across turns
  rather than within one, and it is what lets a country attack with more than whatever one
  border province could raise alone. `pullField()` is one breadth-first search outwards from
  the territories that asked, over OWNED territories only, recording each province's distance
  from the nearest war and the SINGLE neighbour one hop closer to it; every territory at
  distance ≥ 1 marches its surplus to that neighbour, so an army walks to the front over
  several turns instead of teleporting. It is the same "strictly closer, re-derived every
  turn" idiom `src/ai/route.js` uses for an injected plan's corridor, and for the same reason:
  a stored path goes stale the moment somebody else's conquest cuts it, while a field simply
  becomes a different field. **What it replaced looked like the same thing**: a source used to
  qualify only if it was a DIRECT NEIGHBOUR of a demand, so the pull reached exactly one hop —
  a province two back was never a source, because it bordered no demand, and never became a
  destination either, because it had no enemy to fail an attack against. The unit fixture is
  literally `Interior — Rear — Front` and the only move that rule could produce there was
  `Rear → Front`. It survived because it is invisible on most of this map — 85% of countries
  hold one territory and the surviving empires are mostly frontier, so one hop IS the depth —
  and showed up only on the empire meant to fight a war at a distance: measured at 100 headless
  turns (`node tools/muster-probe.mjs`), the United States held 68 territories with 17 on the
  front line and **a fifth of its infantry two or more hops back**, army that could not move
  under any circumstance for the rest of the game. Fixing it took that same seed's United
  States to **100 territories**, which is a large balance movement and wants the five-goal
  table before it is trusted.
- **VEHICLES MARCH ALONG A FUELLED CORRIDOR, and "infantry only" was a half-truth.** The muster
  moved foot soldiers alone on the reasoning that vehicles are gated by the oil of wherever
  they stand, so marching tanks into a province with no oil turns them into scenery. The
  reasoning is right and the conclusion was too strong: it is not that vehicles cannot move,
  it is that they may only move somewhere that can fuel them. `spareGarrison()` spends one
  surplus budget in FORCE, **vehicles before infantry** — infantry is priced at a
  ten-thousandth of a siege point, so an assault gun at the front is what makes an AI siege
  survivable at all. Three rules follow. The destination's oil headroom is a **budget
  decremented as the turn is planned**, because three provinces reinforcing one front would
  otherwise each be told the same barrel was free and their vehicles would be grounded on
  landing. **Only USEABLE vehicles march**: a grounded one stays, because its territory's oil
  regenerates towards its capacity every turn and marching it off on one bad turn strips a
  garrison of armour it was about to get back. And **the oil bill travels with the tanks** —
  `oilDemand` is a STORED field maintained incrementally, so a column that left its demand
  behind would ground the vehicles still at the source AND arrive somewhere that believed it
  had oil spare; `garrisonMoveFor()` in `aiCalculations.js` recomputes it from the new counts
  and re-applies `useableUnitsFor()`, which is the only per-turn `useable*` rebuild the AI
  gets (known-issue BJ).
- **A REINFORCEMENT DEMAND DIES WHEN THE ATTACK LAUNCHES, NOT WHEN THE FIRST TROOPS ARRIVE.**
  `musterAiArmies()` used to clear it on delivery, which was defensible while the pull reached
  one hop — there was nothing behind the neighbour that answered, so the request had got
  everything it was ever going to get. With a relay behind it that cuts the corridor off after
  a single turn: a border sixty points short receives one neighbour's surplus, stops asking,
  and the three provinces marching up behind it are told the war is over. It is cleared in the
  `decision.commit` branch of the attack sizing instead. A cancelled
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
- **A PLAN CAN BE INJECTED INTO A COUNTRY, AND `src/ai/debugPlans.js` IS THE ONLY PLACE ONE
  IS ASSERTED RATHER THAN DERIVED.** Every other horizon comes out of the world — the
  objective from the victory condition, the theatre from the frontier, this turn's goals
  from `rateTarget()`. That is right for the game and useless for debugging it, because
  "what happens if Russia goes all-out at Finland" is a pairing the derivation will never
  produce on a 207-country map. The "D" button in spectator mode opens
  `src/ui/components/DebugPlanPanel.js`: pick a country, point it at a COUNTRY or a
  TERRITORY, choose one of four strengths, confirm. Six things follow. **The campaign is the
  ONE entry point** — `applyDebugPlan()` in `strategy.js` folds the plan onto the campaign
  and `targeting.js`, `goals.js` and `aiCalculations.js` all read `campaign.debugPlan`
  rather than looking it up again, because a plan in force in three of four places produces
  a country that ranks its target first and then declines to attack it, which reads as the
  tool being broken. **A priority is a ROW of dials, not a multiplier**: the ranking weight,
  both odds floors, both budgets, the appetite, the reserve kept at home and the sizing all
  move together, because turning one up while the others stay put changes nothing. **The top
  tier deliberately breaks rules the others respect** — the setback memory, the posture
  refusals, the 8% floor the game applies to everybody, and the smallest-force-that-clears
  sizing — and the one invariant it may NOT break is `minimumHomeShare`, so no plan at any
  strength can empty a province. **A plan SURVIVES a succession**, alone among everything a
  country holds: `clearPlansFor()` wipes judgements reached by a dead leader, and an
  injected plan is the operator's instruction. It goes when it is replaced, cancelled, when
  spectator mode is left, or when it **comes true** — `retireRealisedDebugPlans()` runs once
  per TURN from `planCampaign()`'s cache-miss branch (not once per country: the predicate
  walks the territory list). **The player's opening grace period still stands at every
  tier.** And **the dials are in that module and not in `balance.js`**, because no ordinary
  game and no `tools/ai-sim.mjs` run reaches them.
- **AN INJECTED PLAN IS ROUTED, AND WITHOUT `src/ai/route.js` IT WAS A WISH.** `rateTarget()`
  is only ever called on pairings that ALREADY exist — an enemy territory adjacent to one of
  ours — so a plan naming something on another continent was consulted exactly never: the
  United States pointed at the Falkland Islands carried on choosing its own targets while the
  panel cheerfully reported a plan in force, and would have taken the credit if it ever
  conquered its way there by itself. `route.js` is one breadth-first search per plan-bearing
  country per turn, seeded at the OBJECTIVE and run outwards over `getInteractableFrom` —
  which is the graph the game will actually let an army cross, sea crossings included, so a
  distance of `Infinity` means genuinely UNREACHABLE and is reported as such. Four things
  follow. **The corridor is a comparison, not a stored path**: an enemy territory is on the
  route exactly when `distance < ourBest`, re-derived every turn, so a corridor blocked by
  somebody else's conquest simply becomes a different corridor rather than a stale plan.
  **Strictly closer** — a territory the same distance away as ground we already hold is a
  sideways move and gets nothing. **The corridor gets the SAME dispensations as the
  objective** (weight decayed by `CORRIDOR_DECAY`, but the same floors, setback amnesty and
  posture overrides), because a country that will ignore its posture for the Falklands and
  for nothing on the way there gets as far as Panama and stops. And **`staging` overrides the
  theatre's spearhead in `muster.js`**, which is the half that makes a distant objective
  reachable at all: without somewhere to mass, the country arrives at the front of a
  fifteen-hop route with one province's garrison. Measured in a spectated game: the United
  States walked Mexico → Costa Rica → Colombia → Brazil → Peru → Chile → Tierra del Fuego →
  Falkland Islands over nineteen turns, and the plan retired itself on arrival. **`nextSteps`
  is filtered to territories ADJACENT to us** — on distance alone it offered "Niger, Algeria,
  Western Sahara", all genuinely six hops from the objective and all across an ocean.
- **The AI console's X closes the window; FINISH ends the session, and FINISH is on the GOAL
  BAR.** It used to be that closing WAS stopping, and the reasoning was sound while it held: a
  spectated game with its console shut is a page that looks idle while two hundred countries
  fight behind it, and nothing would have brought the window back. `aiGameOpenBtn` — a
  joystick, because that window is the game CONTROLS — is what changed that, so the console
  can now be pushed off screen to watch the map. **FINISH therefore had to leave it**: a
  window that can be closed is the wrong home for the one action that cannot be taken back.
  It is a CHILD of `.ai-game-goal-bar` rather than a sibling positioned beside it, because the
  bar is centred with `translateX(-50%)` and its width follows the length of the goal text —
  anything placed "to the right of it" would need re-measuring every time the leader changed
  name. The joystick and the "D" button live in `aiGameButtonsContainer`, their OWN container:
  the left-hand column belongs to a played game and `toggleUIButton(false)` hides both of its
  buttons in this mode, so a debug control sharing that container would be shown and hidden by
  the wrong switch.
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
  and the pre-battle odds figure; `DICE_ATTACK_ADVANTAGE` (**1.54** since combat stage 3, where it
  carried the median-attacker rebase — see below) owns open battle. They are not
  two settings of one thing: a dial multiplying a CONTINUOUS share moves the outcome smoothly,
  and one multiplying a BANDED share moves it in whole dice — and a whole extra die is an
  *unmatched* die, which is an automatic hit every round. At 1.44 a raw-even fight came out four
  dice against three and the attacker won 88.3% of the time; re-cutting the bands cannot fix it,
  because the band that fixes 1:1 breaks 1:2. Collapsing the other way (1.0 everywhere) strips
  44% off every siege band with no measurement behind it. **If open battle needs to be easier or
  harder, `DICE_ATTACK_ADVANTAGE` is the number; if sieges do, `ATTACK_ADVANTAGE` is.** A third
  dial is not allowed, and neither may reach into the other's model.
- **THE AI DECIDES ON `takeProbability()`, WHICH PLAYS THE REAL BATTLE — NEVER ON
  `winProbability()` AGAIN.** `src/rules/military/takeProbability.js` (combat stage 1, closing
  known-issue C1) memoises `battleForecast()`, so the number every odds floor, the commitment
  sizing and both siege gates read is produced by the model that will fight. It is **not an
  approximation and must never become one** — that is the same rule that deleted `doAttack()`'s
  separate resolver. What it replaced: `winProbability()` is a ratio of two strengths over
  `defenseMultiplierFor()`, a multiplier the dice model does not use, and its error against the
  real outcome ran **+95 to −77 points and CHANGED SIGN on fortification** — over-rating an attack
  on unfortified mountain and under-rating one on a fortress, so no constant could tune it out.
  It is now **2.2 points**. Three things follow. **The cache key is (share bucket, fortification
  dice change, both face modifiers, and the exact counts of any unit type below 10)**, and that
  last term is not optional: the battle is scale-free above `MIN_CACHEABLE_FORCE`, but a side
  holding ONE air unit loses it to the integer casualty floor in round one and its air
  superiority with it, which measured **41.6 points** apart from the same army at a thousand
  times the scale. **`MIN_CACHEABLE_FORCE` must be re-measured whenever `PAIRING_CASUALTY_SHARE`
  moves** — it went 2,000 → 20,000 when that dial went 0.10 → 0.07, because a smaller share means
  more rounds and so more chances for the floor to bite. And **the player's attack window BAR is
  still `winProbability()`**, deliberately: the Siege button's gate was moved to the real odds so
  `PROBABILITY_THRESHOLD_FOR_SIEGE` means one thing everywhere, but what the player is SHOWN is
  an open question (checklist 1.9), not an oversight.
- **AN ODDS CONSTANT IN THIS GAME IS A REAL TAKE PROBABILITY, AND IT DID NOT USED TO BE.**
  `node tools/combat-lab.mjs floors` prints what each one means and what it USED to mean, and the
  second table is worth reading once: `decisiveOdds` of 65 meant a raw **3.91:1 and a 94.1%
  chance**, so an attack was sized to a target it could not reach on most borders, cancelled as
  `needs-more-force`, and the country filed a requisition instead — **43 of 48 planned attacks
  cancelled on one measured turn, one of them refused at 63% for being "2 points short"**. The
  same 65 now means 65%, needing 2.21:1, and those cancellations went to zero. Most of the
  constants did not move; their CURRENCY did. Two that did move, both on evidence:
  `PROBABILITY_THRESHOLD_FOR_SIEGE` 15 → 8 and `siegeDiscipline.minimumOdds` 22 → 12, because 84%
  of all weighed pairings were dying at a gate that sits ABOVE the siege decision — and a siege
  is the answer to a target that cannot be stormed.
- **THE MEDIAN ATTACKER FIGHTS AT PARITY, AND `DICE_ATTACK_ADVANTAGE` IS 1.54 TO MAKE IT SO.**
  `devIndex` (median 0.745) and `combatContinentModifier` (0.75–0.99) scale the ATTACKER and
  there is no matching defender term — `areaBonusFor()` is min 0.507 / median 1.000 / max 1.000
  over the real map, so it only ever penalises a large defender. Their product over all 1,888
  real adjacent enemy pairings has a median of **0.648**, so before combat stage 3 every attacker
  in the world fought at ×0.63 and needed 1.58× just to draw level. The dial is the REBASE Leigh
  chose — arithmetically identical to rebasing the two tables, since a global multiplier preserves
  every relative difference, but applied here because `devIndex` also feeds `defenseBonusFor()`,
  the upgrade price ladder and the construction-materials ceiling, and a combat decision must not
  leak into the economy. **This reverses the note that used to say 1.44 gave an 88.3% attacker win
  on an even fight**, and the reason is that the measurement was taken in `battle-lab`'s neutral
  context — devIndex 1, continent 1 — which describes no country on the map. The best real
  attacker is 0.95. Both `battle-lab.mjs` and `rules-forecast.spec.js` use the median real
  attacker now, and `node tools/combat-lab.mjs terrain` is the check that 1.54 is still right if
  either table is ever edited. **There is still no third dial**: `ATTACK_ADVANTAGE` stays 1.44 and
  owns sieges.
- **ROUND COUNT IS WHAT A PLAYER WAITS FOR, AND IT IS WHAT CAPS THE DICE BANDS.** Each round of a
  battle costs a dice throw capped at `MAX_ROLL_MS` (2,200 ms) plus a clash panel that lingers
  `LINGER_MS` (7,200 ms), and **both are paid once per ROUND whatever the pairing count** — so a
  battle of six short rounds is slower to watch than one of five long ones. `PAIRING_CASUALTY_SHARE`
  is therefore set against ROUNDS and not against attrition, and it has to move whenever the bands
  do: widening the range adds pairings per round and shortens the battle, narrowing it does the
  reverse. Combat stage 3 shipped a 3–7 dice table first, measured the best cliff of any candidate,
  and **reverted it** — the `battle/` e2e area started timing out, and that was not brittle specs,
  it was a battle genuinely taking longer to play out. The shipped table is 2–6 dice at 0.09, which
  puts battles back at 4–6 rounds, exactly where they were before the phase. **If the bands are
  ever changed again, re-measure the ROUND COUNT and expect the e2e `battle/` area to be the thing
  that catches you.**
- **MORE DICE BANDS CANNOT FLATTEN THE CLIFF; A HIGHER BASE COUNT CAN.** The gap between the two
  sides' dice is `f(share) − f(1 − share)`, so it grows by TWO every band-width — re-cutting edges
  at the same 1..5 range moves where the gap appears and cannot make one extra die matter less,
  and an extra die is an UNMATCHED die, a free hit every round. The bands are **2..6 dice with a
  base of 5 at parity** now, so a one-die gap is one in five rather than one in four -- a wider
  3..7 table measured better on the cliff and was reverted for the wall-clock reason above. Two things
  are coupled to that and were both found by tests. **`PAIRING_CASUALTY_SHARE` is 0.09, not 0.10**
  — the band change alters pairings per round and therefore battle length, and that constant's own
  comment says it and the band edges are jointly what set it. And **the DICE STAGE is the ceiling on any further widening**: every die
  from both sides lands on one tray, so the table's maximum sets the count at 6 + 5 = 11, up from
  5 + 4 = 9. The spawn geometry takes it, but `MAX_ROLL_MS` is 2,200 ms and more dice settle more
  slowly — `tests/e2e/battle/dice-stage.spec.js` is the check, and a further widening should not
  be attempted without it.
- **A SIEGE CAN NOW INVEST WITHOUT BEING DESTROYED, AND THAT IS WHAT MADE SIEGES POSSIBLE AT ALL.**
  `SIEGE_ARREST_MARGIN` (50) splits two states the model used to treat as one: "cannot match the
  defences" and "is being destroyed". Any negative score difference was the arrest band — 60% a
  turn of losing the army with half of it joining the defender. Two correct decisions made that
  fatal: infantry is priced at a ten-thousandth of a siege point (*"a siege is broken by artillery
  and blockade, not by numbers"*) and `muster.js` moves infantry ONLY (vehicles are gated by the
  oil of wherever they stand). So an infantry besieger scored ~10 against a bare mountain's 30 and
  lived under two turns — traced, sieges were being laid all over Europe while the world held 0 or
  1 standing. **Repricing infantry is NOT the fix and was tried**:
  `tests/unit/balance-unit-economics.spec.js` pins vehicles at 5–6× better per gold in a siege,
  0.0004 drops that to 1.5, and the invariant caps the value at 0.00012 — which is nowhere near
  enough to leave the band. Do not propose it again.
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
- **THE AI WRITES A GARRISON THROUGH `src/rules/military/garrison.js` AND NOWHERE ELSE**
  (known-issue BJ). `garrisonOf()` reads the seven figures off a territory, `garrisonFields()`
  computes the eight a garrison IS, `writeGarrison()` applies them in place, `garrisonPatch()`
  returns them as a patch for `mutations.js`. Pure, imports only `config/`, runs in Node. It
  enforces two invariants: **no count may go negative** — a garrison the world cannot field is
  not a debt to be repaid — and **`useable*` may never exceed the count it gates**. The second
  is the one that is easy to miss: `useable*` is the oil gate, the player's half is rebuilt
  every turn by `setPlayerUseableNotUseableWeaponsDueToOilDemand()`, and **the AI has no
  equivalent** — it maintains those three numbers incrementally, so anything that writes AI
  units and leaves `useable*` alone is handing the AI vehicles it does not have.
  `calculateArmyMakeupOfAttack()` allocates an attack from `useable*`, which is how a stale
  count becomes an over-large `armyArray` and then a negative garrison. Four hand-written
  writes had it wrong four different ways and India ended a 150-turn run at minus six and a
  half billion; the five sites are named in the archived register and each has an assertion in
  `tests/unit/rules-garrison.spec.js`.
- **A GOAL'S WORKING SET IS THE COPY, AND `patchTerritory()` IS WHAT COMMITS IT.**
  `doAiActions()` takes `mainArrayFriendlyTerritoryCopy = {...territory}` at the top of each
  goal, the goal handlers mutate the copy, and the loop ends by writing every field of it back
  over the store. So **anything that reaches past the copy into `allTerritories()` has its
  write discarded a few lines later**, silently and unconditionally. `doAttack()` did exactly
  that, and the consequence is the largest single balance defect found so far: **every AI
  attack was free** — the force was debited from the store, the copy still held it, and the
  write-back restored the garrison win or lose. A won attack then garrisoned the conquered
  territory with the survivors on top, so attacking CREATED army. Measured: the United States
  sent 131,388 infantry and 36 vehicles, the store went 5,817,692 → 5,374,304 → 5,817,692
  inside one turn. **It had no textual signature at all** — nothing threw, the battle was
  resolved correctly against the force actually sent, the odds and the round log were right,
  and the only witness was a source garrison that did not go down. `setSiege()` had always had
  it right (it debits the copy). Fixing it moved Continental at 150 turns from 89 surviving
  countries to 109 and the largest empire from 71 to 60 — see the archived register for the
  full before/after.
- **THE MAP'S BORDERS ARE WELDED, and `tools/weld-map-borders.mjs` is how they got that way.**
  Every land border was drawn TWICE, once per territory, and the two copies were digitised
  independently: of 9,508 anchor points across the 359 paths, exactly **15** coincided with a
  point on another path. The rest were a quarter of a unit to a unit apart, which is under a
  pixel at zoom 1 and several at zoom 6 — so the map grew slivers of sea between countries the
  further you zoomed in, and no stroke work hides that, because the fills genuinely did not
  meet. The tool welds near-coincident anchors onto their centroid and then STITCHES: a vertex
  on one side of a border with nothing to weld to is inserted into the other side's segment
  (de Casteljau for a cubic, so a curved coast keeps its shape). Measured over the whole map,
  the median gap along a shared border went **0.137 → 0.000 units** and the share of border
  within 0.05 units went **19% → 88%**. Four things to know before running it again.
  **It runs in two passes and the second one is the safe half, not the risky one**: the first
  is deliberately timid at 0.75 units because it cannot tell a mistyped corner from two
  countries facing each other across a strait, and the second widens to 1.6 but only between
  pairs the first pass PROVED share a border by leaving them an exact common point — so it can
  finish a seam and cannot invent a land bridge. It reads that proof from the geometry rather
  than from `adjacency.json`, deliberately, because that file carries hand-added sea crossings
  which are precisely the pairs that must not be pulled together. **No point may move further
  than a tenth of its own territory's bounding diagonal**: an absolute tolerance is right for
  Canada and a disaster for Singapore, whose area moved 35% before that cap existed and 10%
  after. **The neighbour graph cannot change** — `adjacency.json` comes from
  `closestPathsData.json` and uses the SVG only for names; the regenerated file was
  byte-identical. And **areas do change**, median 0.05% and up to 13% on a microstate, so a
  seeded run taken before the weld does not reproduce exactly after it.
- **`resources/pathAreas.json` guards itself on the SVG's BYTE LENGTH, so touching
  `svgMaster.svg` at all means `npm run build:data`.** `precomputedAreasFor()` returns null on
  a mismatch, which is not an error — the caller then measures all 359 paths itself. So a
  stale cache is invisible except as a slower bootstrap, and the repo carried one: `svgBytes`
  said 352162 against a file of 351798, and `tests/unit/path-areas.spec.js` had been red at
  HEAD for long enough that nobody read it as new. The `:check` variants exist for this.
- **A territory's continent is the ORIGINAL OWNER's, and three files now have to agree about
  it** (known-issue BI, closed). `initialData.js` is the model and is authoritative;
  `svgMaster.svg`'s `continent=` attribute is a second copy that **nothing reads**, which is
  precisely why it drifted unnoticed (Easter Island is Chilean, and the SVG called it
  Oceanian, so the SVG counted Oceania 66 and South America 48 against the model's 65 and 49);
  `SVG_coastLines.svg`'s `shadow=` is a third, on paths with no territory identity at all, and
  is only what the continent view colours boundaries from. `tests/unit/data-continents.spec.js`
  reconciles all three in about a millisecond. **Do not "simplify" it by deleting the SVG
  attribute** without checking the map tooling, and do not read a territory's continent from
  it. **A coastline path is one continuous LANDMASS, so a landmass that spans two continents
  has to be cut by hand.** The Americas are one outline from Alaska to Tierra del Fuego, and
  the model puts Mexico in North America while every other country south of it — Guatemala,
  Belize, the whole of Central America and the Caribbean — is South American. That ring was
  therefore drawn pink through Mexico. It is now two paths cut along Mexico's Guatemalan and
  Belizean border, the join taken from Mexico's OWN outline in `svgMaster.svg` rather than
  chorded straight across, so the two continent colours meet on the real border. The same
  question applies to any future change of a country's continent: the outline does not follow
  it.

- **Every game rule runs in Node** (Phase 5). `src/rules/`, `src/ai/` and `src/engine/`
  import from `src/config/`, `src/state/selectors.js` and (since Phase 7.8 — only
  `src/ai/theatre.js`, and `src/ai/strategy.js` for the injected-plan corridor)
  `src/data/adjacency.js` — no DOM, no `ui.js`. The adjacency module
  THROWS when its data has not been loaded, which is the case in Node, so every call is
  behind `isAdjacencyLoaded()` and the neighbour lookup is injectable for the unit tests. That is the property the unit suite depends on, so before adding an import to any
  of them, check it does not drag the UI in. Two dependencies are INJECTED for exactly this
  reason: the AI's seeded rng, and `calculateProbabilityPreBattle` (which lives in `battle.js`,
  which imports `ui.js`). Rules take an `rng` parameter rather than calling `Math.random`.
- **Territory state lives in `src/state/GameState.js` and nowhere else** (Phase 4). Read it
  through `state/selectors.js`, write it through `state/mutations.js`, and subscribe to
  `state/events.js`. `mainGameArray` is gone: the replacement for "all territories" is
  `allTerritories()`, and for a lookup `getTerritory(uniqueId)` / `getTerritoryByName(name)`.
- **WHO MAY FIGHT WHOM IS A STATE PER PAIR OF COUNTRIES NOW, AND THE REGISTER IS SPARSE.**
  `src/state/diplomacy.js` is the vocabulary — six states, and it **imports nothing at all**,
  the arrangement `phases.js` has, because the enum is read by the store, the selectors, the
  mutations, the AI and the UI. Five things follow. **A relation is ONE record per UNORDERED
  pair**, keyed by `relationKey()`, which sorts the two names: there is no "France's relation to
  Spain" and "Spain's relation to France" to drift apart, which is known-issue **BS** — five
  straits listed on one side only for the life of the project — designed out rather than
  asserted after the fact. **The register is SPARSE and an empty one is the whole starting
  position**: 207 countries make 21,321 pairs, a pair with no record is at NO_CONTACT, and a
  record existing is also the permanent proof the two have met, so there is no second "have they
  ever touched" set to keep in step. That is also why **the snapshot version did not move** — a
  save taken before diplomacy existed restores an empty register, which is correct. **The
  country is `dataName` and never `owner`**: `pathOwner()` reads "Player" on the player's own
  land, and passing it to the tooltip made the player's own territory list the player's own
  country as a foreign power at no contact with itself — found by hovering the running game,
  not by reading it. **Contact is RE-DERIVED, coalesced, and only ever one-way**: a conquest is
  precisely how two countries on opposite sides of the world come to share a border, so
  `diplomacyContacts.js` walks on a dirty flag rather than at seeding (a busy turn 1 logs
  fifty-one conquests against a ~1,900-pairing walk), and a border that closes up again never
  undoes a relationship. And **`FIRST_CONTACT_STATE` is NEUTRAL, which is the line the whole
  phase is ordered around**: `allowsAttack()` permits WAR and nothing else, so pointing the
  attack gates at it before the declaration rules existed would have frozen the world exactly
  as known-issue **BA** did — which is why the gates are stage 2 and the declarations are
  stage 3, and why the quiet world in between was a deliberate checkpoint. See
  [docs/archived/06-diplomacy.md](./docs/archived/06-diplomacy.md).
- **`src/ai/diplomacy.js` IS THE ONLY MODULE IN `src/ai/` ALLOWED TO DECIDE A DIPLOMATIC
  ACTION**, the containment `doctrine.js` has over victory conditions. It declares wars and it
  ends them, it is pure, and it draws no randomness at all — so nothing in it moves a seeded
  outcome. Four things about it are load-bearing. **A THEATRE COMMITMENT IS A DECLARATION OF
  WAR AND IS UNCONDITIONAL**, which is the freeze guard: no posture refuses it and no war cap
  applies to it, so every country with a reachable neighbour has a war. `postureAllowance` in
  `declarationDiscipline` gives DEVELOP and DEFEND nothing and most of this map is small
  countries, so it has precisely the shape that caused **BA** — it therefore governs the
  OPPORTUNISTIC declarations and nothing else. **A DECLARATION WITH NO MATCHING PEACE RULE IS
  A RATCHET**, and it was measured as one: at stage 3 pairs at war climbed 536 → 749 across a
  150-turn run under every goal, which is the map walking back to the permanent undeclared war
  the phase exists to replace. Stage 5.1's `proposalOutcomeFor()` and `planPeaceOffer()` are
  the pawl coming off it, and the same measurement now FALLS. **THE THEATRE RIVAL IS THE ONE
  COUNTRY A PEACE CANNOT BE BOUGHT FROM** — otherwise the mid-term goal is a suggestion — with
  one deliberate escape: a rival that has lost `theatreCeasefireFailures` attacks will take a
  CEASEFIRE, because a country being beaten wants a breather and that is exactly when the
  other side wants to buy one. And **the refusal reason names only the terms that argued the
  way the answer went**: an accepted offer explained by *"its leader is aggressive, it is much
  the larger of the two"* is printing the reasons it should have said no, and the panel did
  exactly that until it was driven in a browser.
- **HOW A COUNTRY FEELS ABOUT YOU SPECIFICALLY IS `src/ai/opinion.js`, AND IT IS A TERM AND
  NEVER A GATE.** A directional -100..+100 number per ORDERED pair -- the register is one
  record per UNORDERED pair on purpose, so it cannot say *"you wronged me"*, which is most of
  the point. See [docs/archived/08-opinion.md](./docs/archived/08-opinion.md). Six things. **IT DECAYS TOWARD A
  RESTING POINT THE STANDING STATE IMPLIES** -- war -40, neutral 0, ceasefire +10, peace +25,
  alliance +50 -- and never toward zero: that is what gives *"a maintained peace warms a
  relationship"* with no hook at all, what stops a fifty-turn war and a fifty-turn peace
  arriving at the same number, and what answers the RATCHET warning structurally, since the
  pawl is the shape of the mechanism rather than a rule. **AN ABSENT PAIR READS AS ITS RESTING
  POINT, NOT AS ZERO**, which is what makes the sparse map correct rather than merely small --
  and `settleOpinions()` is therefore driven from the REGISTER'S rows rather than from the
  stored opinions, or a pair at war with no recorded incident would never drift. **"ARRIVED"
  IS A DISTANCE DERIVED FROM THE SETTLE RATE**, never an equality: a geometric approach
  rounded to one decimal place has a genuine FIXED POINT at `half the last digit / rate`, so
  an entry within about eight tenths of its target rounds back to where it started and sits
  there for the rest of the game, stored and saved and never equal to the value it is
  supposedly at (a unit test walks five hundred turns for this). **IT IS A TERM IN FOUR PLACES
  AND A GATE IN NONE** -- `proposalOutcomeFor()` (+/-1.4 against a threshold of 1.0),
  `allianceScoreFor()` (+/-1.8 against 1.6), `callInOutcomeFor()` (+/-1.6 against 1.0) and
  `rankRivals()` in `theatre.js` (+/-1.0 against weakness 2.2, SUBTRACTED so a country stops
  choosing its own ally to absorb) -- because a rule that can refuse is a rule that can freeze
  the world, which is known-issue **BA** exactly. Leigh's brief asked for acceptance to become
  *"70% opinion"*; that is SEQUENCED rather than refused, because a literal normalised blend
  would make seventy per cent of every negotiation in the first fifty turns a CONSTANT (every
  pair starts at its resting point) while re-basing every threshold in the file at the same
  time as introducing the mechanic. **A BETRAYAL HAS TO CLEAR THE RESTING POINT IT FALLS
  FROM**: it is by definition committed out of an AGREEMENT, and an alliance rests at +50, so
  the -60 the design first proposed left the victim on -10 -- MILDER than being declared on
  out of neutral. It is -85. And **the three military events are derived from
  `ACTIVITY_LOGGED` rather than from `TERRITORY_CHANGED`**, because `activityRecorder.js`
  already owns the hard part of reading that event (which changes are conquests, and which are
  the bootstrap or a restore) and a second copy of that rule is a rule already got wrong once.
  A pair arriving at WAR is charged only on `via: "declared"` or `"calledIn"` -- a ceasefire
  LAPSING puts two countries back to war with nobody to blame. **The player holds opinions too,
  by the same rules, and in this phase nothing reads them** -- they are shown as two bars on
  the territory tooltip (which overturns `07`'s §7.5: a trait is fixed and secret, an opinion
  is a consequence of the player's own actions, and a relation the player cannot see is a rule
  they cannot play against) and as a fact in the diplomacy panel.
- **A CEASEFIRE REMEMBERS WHAT IT WAS SIGNED OUT OF, AND THAT IS Q2's ANSWER.** `revertsTo` on
  the relation record is set at signing and read by `src/rules/diplomacy/expiry.js` when the
  clock runs out. A rule that guessed at expiry cannot work: with NEUTRAL as first contact,
  "back to war" and "back to neutral" are genuinely different outcomes and the register keeps
  no history to reconstruct the right one from. The fallback when a record does not say is
  NEUTRAL — a save taken before ceasefires existed restores rows without the field, and
  putting two countries into a war neither declared, on the strength of an absent field, is
  the worse of the two mistakes. Expiry runs from ONE place, `diplomacyExpiry.js` on
  `TURN_CHANGED`, so every reader of the register on turn N sees the same world; it is reached
  by a **side-effect import in `ui.js`** and nothing else imports it, so deleting that line
  means a ceasefire never ends.
- **AN ALLIANCE IS A MUTUAL DIVIDEND AND NEVER A TRANSFER** (`src/rules/economy/allianceShare.js`,
  Q5's answer). Both allies simply earn more while it stands — `allianceShare.gold` on the
  income FLOW and `allianceShare.capacity` on the three CEILINGS, the same two-dial split the
  continent bonus has and for the same reason. It arrives in the ECONOMY CONTEXT and is
  written onto nothing, so the multiplier is 1 again the instant the alliance ends with
  nothing to unwind. **A share moved between treasuries would need an exact inverse write**,
  which is the silent bug `continentBonus.js` exists to prevent and the class of defect
  (known-issue **BJ**; the free-attack bug) that has cost this project the most. Symmetric,
  because a percentage of a flow is worth more in absolute gold to the larger ally — Leigh's
  standing rule that being large stays an advantage — while the smaller takes the larger
  proportional lift. Capped at `maxAllies`, or an alliance web is a runaway that pays for the
  army that wins the game.
- **AN ALLY IS ASKED, NEVER ENROLLED, AND A JOINER IS BOUND TO THE WAR IT ANSWERED.** Leigh's
  §3.4, and his answer to Q3: an ally is called in **on defence as well as on aggression**,
  which reopens the cascade the first draft designed out — so the guard is that **nothing
  cascades**: `resolveCallIns()` walks the two belligerents' ally lists ONCE and a joiner's own
  allies are never asked, so a war spreads exactly one country per yes. **A joiner may not
  settle out of the war alone** (*"the peace must be asked either by the ally under attack or
  by the adversary, and agreed, where it then applies peace to the ally aiding the attacked
  ally as well"*): `isBoundJoiner()` refuses its proposals to that adversary and
  `acceptProposal()` releases every joiner on the same terms when the principal settles.
  Without the first half a call-in is a free favour. The binding **prunes itself** once a turn,
  because a principal that is CONQUERED never settles and would bar its joiner from peace for
  the rest of the game. **Three endings, one price**: refusing a call and mutual dissolution
  are free for both, and only walking out or turning on your own ally is a breach — which is
  what makes the free, honest exit the thing that keeps the breach meaningful.
- **THE AI ASKS THE PLAYER THROUGH A QUEUE, NOT A MODAL MID-TURN** (`src/state/diplomacyInbox.js`).
  A call to arms and an unsolicited offer both reach the player the same way, because they
  share one problem: an AI country decides during a phase the player is not present for. A
  modal raised inside a two-hundred-country loop stops the turn dead; a decision taken on the
  player's behalf is what the design forbids outright. So the AI turn queues and
  `showQueuedDiplomacy()` empties it at the end, AFTER `showQueuedDefences()` — a call answered
  over a battle-results screen would be answered through it. **The prompts are awaited one at a
  time**: `confirmDialog.open()` resolves a previous dialog as a CANCEL when a second is raised
  over it, so asking two at once would refuse a call to arms on the player's behalf and end an
  alliance they never heard about.
- **A SIEGE BLOCKS AN AGREEMENT, WHICH IS Q1's ANSWER, AND THE COST IS ACCEPTED.** Peace
  agreed while an army is three turns from starving a province out is a contradiction, and
  both alternatives are worse: LIFTING the siege means moving an army out of a siege object
  from two unrelated code paths, and a write that creates or destroys army is the single
  largest class of defect this project has had (known-issue **BJ**, and the free-attack bug
  before it); LETTING IT RUN makes the register say something untrue about the map. The
  predicate is about the PAIR, so it cannot be dodged by asking from the other side. The cost
  is that a player besieged by the AI cannot lift that siege and so cannot buy peace while it
  stands — bearable only because `siegeReview.js` already lifts a stalled siege, sieges are
  rare (nought to five standing worldwide at every sample ever taken), and the refusal says
  why. **A refusal a player can act on does not spend the proposal cooldown.**
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
- **ADJACENCY IS SYMMETRIC, AND FIVE STRAITS RAN ONE WAY UNTIL IT WAS ASSERTED** (known-issue
  **BS**). The geometry in `adjacency.json` has always been symmetric — zero one-way edges
  across all 359 territories — but `src/data/manualAdjacencyExceptions.js` is hand-written, and
  five of its ninety-five additions were listed on ONE SIDE ONLY: the same typo in both
  directions, `"Fiji 1"` written where `"Fiji 2"` was meant. Fiji 1 could be attacked from both
  Vanuatu territories and attack neither back. **A one-way border has no signature at all** —
  nothing throws, both countries plan normally, and it also makes the territory on the receiving
  end under-garrison, because `strongestEnemyPowerAgainst()` sizes a reserve from what can
  REACH a territory. The table has always asserted `DENY` pairs are reciprocal and never
  asserted it of `ADD`, which is the whole reason it survived; both flags are asserted now, and
  `adjacency.spec.js` separately asserts zero one-way edges in the raw geometry AND in
  `getInteractableFrom()`, because the hand table and the generator fail differently.
- **NORTH AMERICA WAS A CUL-DE-SAC, and that is the structural half of known-issue BO.** Europe
  and Asia were each reachable from North America through **exactly one territory** —
  Greenland ↔ Iceland, both `mountainDefenseFactor` 5, and Alaskan Islands 4 ↔ Russia — against
  **eleven** crossings into South America. Measured over 150 turns, the North American power
  holds North America 47/47 and pushes 18–21 territories into South America, and its European
  frontier was 1 pairing of 30–33 at every sample, skipped every turn. **Do not read that as an
  AI defect** — the plan updates correctly when a continent is banked (focus moves to South
  America, posture EXPAND, theatre commits to a South American rival) and the dominant skip
  reason at the top of the world is the global 8% floor, which is G6. **Two map changes shipped
  against it and NEITHER IS MEASURED YET**: Greenland ↔ Svalbard is a second Atlantic door, and
  Greenland and Iceland are `mountainDefenseFactor` **2**. Both move every seeded outcome and
  both want the five-goal 150-turn table. See
  [docs/archived/06-force-and-succession.md](./docs/archived/06-force-and-succession.md) §7.
- **TERRAIN IS QUANTISED, so lowering a `mountainDefenseFactor` from 5 to 4 or 3 is a NO-OP in
  battle.** The dice model reads `defenseBonus + mountainDefenseBonus` against two bands —
  **≥25 costs the attacker one die, ≥100 costs two** — and the mountain term is factor ×
  `MOUNTAIN_DEFENSE_SCALE` (10), so 30, 40 and 50 are all one die. Only a drop to **2** crosses
  a band. What the in-between values DO move is `defenseMultiplierFor()`, which is the bar the
  player is SHOWN and the siege score, not the fight — so a terrain edit can look effective in
  the UI and change no outcome. **One fort cancels the whole benefit** (one fort restores the
  die at any terrain, three restore both), and a large defender is separately soft because
  `areaBonusFor()` only ever penalises size: Greenland is 0.528 against Iceland's 1.000, which
  is why Iceland → Greenland is 100% at 1:1 while Greenland → Iceland was 0%. `node
  tools/combat-lab.mjs terrain` is the check, and archived docs/06 §7.5 is the worked measurement.
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
  See [docs/02-e2e-test-plan.md](./docs/02-e2e-test-plan.md) §3.7.
- **Since Phase 3 the AI actually conquers — and attacks the player.** A turn can end with a
  battle results screen sitting on top of the phase button, and it can appear a beat AFTER the
  turn counter advances. `GameDriver.dismissBlockingPanels()` and `withBlockersCleared()` handle
  it in the harness; anything new that drives the turn loop has to as well.
- **A SIEGE IS A TERRITORY CUT OFF, and both halves of that are now decided rather than
  inherited.** `SIEGE_INCOME_SHARE` (0.25) is what a besieged territory still earns of its gold,
  oil and construction materials — it earned NOTHING before, and that was never a rule, it was
  three lines missing from the siege branch of the income pass. A quarter is the difference
  between a bleed and a freeze: on a quarter a besieged player is still accumulating toward
  whatever might break the siege, and on zero there is no decision available to them at all.
  **Food is deliberately not scaled by it** — starvation is the siege's mechanism, and taxing
  the food again would charge for the siege twice. `SIEGE_SUSPENDS_CONSTRUCTION` (true) is
  known-issue BQ: a besieged territory could not earn and could still BUILD, and a farm put up
  under siege outran the siege grinding it down. The player's gate is in
  `calculateAvailableUpgrades()`, because **`condition` is the CONTROL and not a caption** —
  every plus button in that window is enabled on `condition === "Can Build"` and nothing else.
  The AI's gate is the `isUnderSiege()` guard at the top of `doAiActions()`, which used to ask
  the AI's siege list alone: a territory besieged by the PLAYER went on upgrading, fortifying
  and attacking out of the siege. Fixing that is what finally completed a continent in a
  150-turn Continental run (known-issue BO), which none of the balance constants managed.
- **UNPAID UPKEEP COSTS AN ARMY, and the rule is self-limiting on purpose.** `ARMY_DESERTION_RATE`
  is 1.0 and multiplies the share of the BILL that went unpaid: miss a tenth of your upkeep,
  lose a tenth of your army, and next turn the bill is a tenth smaller — so a territory
  converges on the army it can afford instead of collapsing, and the rule needs no separate
  argument for why it terminates. That is why it is a multiplier on the unpaid share and not a
  flat rate. Before it, upkeep was charged and then discarded by
  `goldForCurrentTerritory = Math.max(0, gold + change)`, so gold was a drag on income and never
  a ceiling on army size. `upkeepShortfall()` recovers the number the clamp throws away.
  **`applyDesertion()` writes the OWNED counts as well as `useable*`; `applyArmyStarvation()`
  still writes only `useable*`**, so a famine's dead vehicles come back when the player's oil
  gate is next rebuilt from the owned counts. The two differing is recorded in the register
  rather than harmonised — famine is a balance change of its own.
- **The CPU leaders and the starting forts are created INSIDE `initialiseGame()` now, before
  the turn engine starts** — and the two-attempt history is why the site carries a long comment.
  They used to be created in `ui.js` after `await initialiseGame()` resolved, which is after
  `turnEngine.start()` had run turn 1, so turn 1 was planned and earned over a world with no
  leaders and no forts. Moving them was tried and **measured** in Phase 5.8 and REVERTED: the
  ten-turn `long-run` went from 6/6 green to 0/6, the player eliminated every time. It works now
  because `PLAYER_GRACE_TURNS` exists — `long-run` is 7/7 — so the grace period was the
  obstacle all along. They are passed in as a `worldSetup` CALLBACK rather than imported, because
  both live in `ui.js` and `gameTurnsLoop.js` deliberately does not import it, and they have to
  run after the loop that assigns the player's ownership because both read it. **What is left is
  the scaffolding**: `newTurnResources()` still skips the income pass on turn 1, which existed
  only to hide the empty world. Removing that guard grants every territory an extra turn of
  income and is a balance change with two `turn-counter.spec.js` specs pinned to it — it is a
  live register item, not a tidy-up.
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
- **THE TWO STATUS BARS' FLAG CELLS ARE CONTROLS, AND `openUpgradeWindowFor()` IS THE ONE DOOR
  THEY GO THROUGH.** The bottom bar's flag opens Upgrade Territory for the territory the bar is
  describing; the top bar's flag opens the info panel, the same view the globe button opens.
  Four things follow. **The FLAG and not the bar** — a thirty-pixel strip of figures a player is
  reading should not swallow a click near the edge of the screen, so the target is one small cell
  that already stands for "this territory". **The listener is installed ONCE, from bootstrap**
  (`bottomTable.installActivation()`), never from `create()`: `create()` runs on every selection,
  and `removeEventListener` cannot take off a handler built fresh at each call — which is the
  move button's old defect exactly, and it presented as a click firing once per selection made.
  The `<td>` survives because `update()` writes its `innerHTML`, replacing the cell's children
  and never the cell. **The bottom flag is GATED and the top one is not**: the bar is written for
  enemy territories and outside the Buy/Upgrade phase, so `refreshBottomBarActionable()` toggles
  `is-actionable` from the selection and from `PHASE_CHANGED`, because a control that looks
  clickable and is not is worse than one that never looked it. And **`openUpgradeWindowFor()` in
  `resourceCalculations.js` is the one place that window is opened from**, with two entry points
  now — the info panel's per-row button and the flag. Its four statements are not independent:
  `currentlySelectedTerritoryForUpgrades` is what every plus button in the window then charges,
  so an entry point that populated the table and forgot to set it would show one territory's
  prices and spend another's gold. Route any third entry point through it.
- **The two status bars set in `var(--font-body)`, and the reason they did not is closed.**
  `#top-table td` and `#bottom-table td` were the last hard-coded `Arial, Helvetica, sans-serif`
  in the stylesheet, so the two strips framing the screen were the one part of the game a theme
  could not reach. The register kept them that way because the bars are a FIXED 30px and a
  monospace face sets wider — which was answerable rather than true: the figures are already
  abbreviated by `formatNumbersToKMB()`, so the cells have no reason to wrap and
  `white-space: nowrap` guarantees they do not. `tests/e2e/ui-layout/status-bar-flags.spec.js`
  walks all six themes and fails if either bar can scroll — that is the check, and it is the
  only one, because the failure is a row growing taller than a container with `overflow: auto`
  and therefore has no textual signature. **The bare `td` rule is still Arial on purpose**: it
  styles the info table, whose cells carry territory names and war outcomes rather than
  abbreviated numbers, so `nowrap` there is a horizontal scroller and not a fix.
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
- **THE ACTIVITY FEED IS THE PLAYER'S NEWS NOW, AND "MILITARY ONLY" WAS DELIBERATELY
  OVERTURNED.** `ActivityKind` used to be attacks, conquests and sieges on the stated ground
  that economy did not belong in a military feed; the panel is *The World This Turn* and a
  famine is exactly what a player needs told (register item E3 — it went to `console.log`, so
  the player watched a number fall and separately lost that turn's growth everywhere with
  nothing on screen to say why). What did NOT change is that the kind list is CLOSED and
  `recordActivity()` rejects anything else, because the card writer switches on it. Four things
  follow. **A TURN IS CARDS PLUS A LIST**: `newsCardFor()` returns a card only for the player's
  own news and null for everything else, and the panel drops the nulls into a compact
  "Elsewhere in the world" list — which is the terse feed that existed before, kept rather than
  thrown away, because a busy turn 1 logs **fifty-one** conquests and fifty-one cards is a
  spreadsheet with more whitespace. **A DISASTER IS ONE ENTRY PER TURN, NOT ONE PER TERRITORY**:
  the roll runs independently against all 359, so per-territory recording would write a hundred
  entries a turn and flush the bounded ring; `resourceCalculations.js` gathers hits as the
  income pass runs and calls `recordDisaster()` once, and "worst" is the largest PROPORTION lost
  rather than the largest amount, because every disaster divides a stock and the absolute figure
  would just name the richest territory hit. **THE WORDING VARIES BY `entry.id`, NEVER BY A
  DRAW**: the panel re-renders on every logged entry while it is open, so a card that reworded
  itself each time would be unreadable — and a `Math.random` variant would put the newspaper on
  the game's seeded stream. And **no country name may be used as an adjective**: there are no
  demonyms for 207 countries, so "The France garrison" and "Germany administrators" are what a
  naive template produces; every phrasing is built to avoid the construction and a unit test
  fails the build if one reintroduces it.
- **A LEADER'S NAME IS RECORDED AT THE EVENT AND LOOKED UP FROM TWO SOURCES ON THE MAP**
  (register item E4). Leaders die: `src/ai/succession.js` replaces one every 15-20 turns, so a
  news card drawn on turn 40 that asked the world who ruled Germany would credit a turn-12
  conquest to whoever is in charge now — known-issue **AS** in new clothes. `activityRecorder.js`
  stores `attackerLeader` / `defenderLeader` on the entry, and the lookup is **injected** from
  `gameTurnsLoop.js` rather than imported, because that module imports only from `state/` and so
  still loads in Node. The TOOLTIP has a separate problem with two sources: a leader is stamped
  onto every territory at `createCpuPlayerObjectAndAddToMainArray()` and is **not** re-stamped on
  conquest, so a territory that changed hands still carries the leader of the country that LOST
  it. `getArrayOfLeadersAndCountries()` is rebuilt from the world every turn and is asked first;
  the territory's own `leader` is the fallback and is trusted only while `dataName` still matches
  the country it was stamped for. **The three personalities are shown and the six TRAIT VALUES
  are not**, and that is a rule rather than an omission: a trait is the number the AI plans with
  — `risk_taking` decides how thin a border a country will hold in order to attack — so putting
  one on a tooltip is the enemy's plan drawn on the map, which is the same line the feed draws
  when it reports what HAPPENED and sends the AI's intentions to the console.
- **Most feed entries are DERIVED from `state/events.js`, not written at the event.** A
  conquest is "a territory's `dataName` changed" and a siege start is "a siege was added",
  both from `mutations.js`, which every path must go through — there are eight places that
  take a territory and a list of eight loggers is one new attack route away from being
  wrong. `updateTerritory()` reports a `previous` field for this: by the time the listener
  runs the store only knows who holds the territory NOW, and the line is about who it was
  taken from. Only what the store cannot answer afterwards is reported explicitly: a failed
  attack (nothing changed) and a siege ENDING (one change, three meanings).
- **DIPLOMATIC NEWS IS DERIVED FROM ONE EVENT AND ANNOTATED AT THE CALL SITES, AND WHO ACTED
  IS STORED NOWHERE.** `setRelationState()` is the one way the register is written, so no
  declaration and no treaty can be missed — but a pair arriving at WAR looks identical
  whether somebody declared, an ally answered a call to arms, or a ceasefire lapsed, so `by`,
  `via` and `onBehalfOf` ride on the emitted event and are NOT fields on the relation record:
  they are facts about a transition, and storing them would grow the save by two strings on
  every one of up to 21,321 pairs. Four things follow. **A BETRAYAL is the one kind derived
  rather than annotated** — going to war out of an AGREEMENT is exactly the transition
  `applyBreach()` is charged on, so the feed asks the register the same question the penalty
  asks. **FIRST CONTACT IS NOT NEWS AND IS GUARDED TWICE**, on `via: "contact"` and on the
  NO_CONTACT → NEUTRAL transition, independently: a busy turn 1 walks ~1,900 pairings and
  recording them would flush every real entry out of the bounded ring. **The four kinds are
  DECLARATION, TREATY, ALLIANCE and BETRAYAL, and `via` is what separates the cases inside
  them** — a ceasefire and a peace are one kind, and the three ways an alliance ends
  (`declinedCall`, `dissolved`, `dropped`) are one kind, because the card writer already reads
  `via`. And **`playerAttacking` means "the player is the one who ACTED"** on these entries:
  they speak the war vocabulary deliberately, because `involvesPlayer()` and the panel decide
  what gets a card from those two flags.
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
- **THE STANDINGS TAB RANKS BY PROGRESS TOWARD THE GOAL, NOT BY SIZE** (register E5). The
  info panel has FIVE tabs now, and the fifth is the rest of the world rather than the
  player's own empire. `rankedStandings()` in `src/ui/goals/standingsTable.js` is the pure
  derivation and `standingsGoalColumns.js` is **the only place in the table allowed to switch
  on a victory condition**, the same containment `src/ai/doctrine.js` has on the AI side. Five
  things follow. **Rank is `victoryProgress().fraction`**, which is `closestToVictory()`'s
  question and not `leadingCountry()`'s — under Great Powers the largest empire on the map
  need not be the country nearest to winning. **Territories are the TIE-BREAK and they do real
  work**: on turn 4 of a Continental game every country has the same progress, so without one
  the order is `Map` insertion order and the table reshuffles between renders for no visible
  reason. **The player is always on the table** — top sixteen, and outside it they are pinned
  below a gap carrying their TRUE rank; `playerStanding()` is what finds the row wherever it
  ended up, and a caller that only checked `playerRow` would silently stop naming the player's
  rank as soon as they did well enough to make the cut. **The snapshot is taken ONCE and
  shared**: `victoryProgress()` takes `standings` as a parameter precisely so it does not walk
  359 territories per call, and `rankedWorldStandings()` in `resourceCalculations.js` is the
  one place both the tab and the turn briefing get it from, so the two cannot tell the player
  different things. And **it is built only for the tab that shows it** — up to 207 progress
  calls plus a walk for the army column, against four other tabs that are drawn far more
  often, one of them at the start of every turn.
- **CONTINENTAL IS THE ONE GOAL WHOSE PROGRESS IS NOT THE COUNT BESIDE IT**, which is why the
  standings cell reads `0 of 3 · 19%`. `victoryProgress()` sums the shares of the best
  `required` continents rather than counting completed ones — deliberately, so a country two
  territories from owning Europe outranks one that has just landed on it. Shown as a bare
  count, nearly every row reads "0 of 3" for the first fifty turns while the table is visibly
  ordered by something it never displays: measured on a real game, Norway sat above the United
  Kingdom with a LOWER figure in the Closest column, which reads as a sorting bug and is not
  one. The percentage is the ranking basis made visible; do not remove it.
- **THE INFO PANEL'S BLUR LAYER IS A FLEX COLUMN, AND EVERY TAB HAD BEEN WASTING 350px WITHOUT
  IT.** `.blur-background` is `display: block` and `.content-window` carries `flex-grow: 1`, so
  the growth had no flex parent to happen in and the table sat at its `445px` base height
  inside an `800px` window — for as long as the panel has existed. The Standings tab is simply
  the first with enough rows to make it visible, and it presented as the table being CLIPPED at
  ten rows when it was in fact scrolling correctly inside a box far shorter than the window
  holding it. The fix is scoped to `#main-ui-container > .blur-background` because that class
  is shared by six windows and is absolutely positioned in all of them, and `min-height: 0` on
  the content window is what lets the inner `overflow: auto` engage at all.
- **THE TURN BRIEFING IS FILED UNDER THE TURN THAT HAS JUST ENDED, AND ITS INCOME COMES FROM
  `turnGainsArrayLastTurn`** (register E7). Both look like mistakes. `endTurn: advanceTurn`, so
  the panel hides the turn that has just begun and opens the one behind it — a briefing filed
  under the turn it was computed in would sit in the hidden section and reach the player a turn
  late; the card names no turn number, so nothing reads as inconsistent. And the income pass
  fills `turnGainsArrayPlayer`, which `newTurnResources()` then rolls into
  `turnGainsArrayLastTurn` and zeroes — so by the time the briefing runs, "last turn's" array
  holds the money that has just arrived, which is the same field the info panel's (+/−) columns
  read. Three more things. **The panel puts it FIRST in its section** rather than the log
  ordering it, because it is written after the income pass while the siege lines are written
  before it, and a summary leads where an event follows. **It is not counted as an action** —
  `summariseTurn()` excludes it, or every quiet turn reads "1 action, 1 involving you" and tells
  the player something happened to them when nothing did. And **a briefing with nothing to say
  is dropped entirely**, because printing "no borders are threatened" every turn is how you
  train somebody to stop reading the one time it says otherwise.
- **THE BORDER WARNING IS A RAW ARMY COMPARISON ON PURPOSE.** `weakBordersFor()` in
  `src/state/briefing.js` compares two `armyForCurrentTerritory` figures with no terrain, forts
  or dice model in it. Three reasons, and none of them is laziness: it is the same shape the
  AI's own `strongestEnemyPowerAgainst()` reserve calculation uses, so both sides read the world
  the same way; a properly-modelled warning would fire almost never, because a real defender's
  advantage is large; and the player has the exact odds on the attack screen the moment they
  care — this is the nudge to go and look. It orders by MARGIN and never by ratio, because an
  undefended province is infinite against any attacker and all of them would otherwise tie. The
  module imports NOTHING, because the adjacency graph throws in Node and a module that reached
  for it could not be unit-tested at all.
- **The info panel's five tabs are column definitions, not code.** `src/ui/infoTable/columns.js`
  and `warColumns.js` say what each tab shows; `tableDom.js` builds a header row and a data
  row; `renderInfoTable.js` is a small function per tab and a dispatcher (Phase 6.4). Adding a
  column is one entry in a list. The numbers are INJECTED by `resourceCalculations.js`, so
  `src/ui/infoTable/` imports nothing from the economy.

## Conventions

- ES modules, `"type": "module"`. Node-side CommonJS files use `.cjs` (the webpack configs).
- Config files use `.mjs`.
- 4-space indent for game source, 2 for JSON/Markdown/config (`.editorconfig`,
  `.prettierrc.json`).
- Reference code as clickable links: `[ui.js:440](ui.js#L440)`.
