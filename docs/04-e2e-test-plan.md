# E2E Test Implementation Plan — Domination: World Conquest

**Baseline:** commit `b7ae0af`
**Companion documents:** [01-codebase-audit.md](./01-codebase-audit.md) · [02-game-design-document.md](./02-game-design-document.md) · [03-refactor-plan.md](./03-refactor-plan.md)

---

## 1. Purpose and shape

This suite exists to make the refactor in [03-refactor-plan.md](./03-refactor-plan.md) safe.
It is a **characterisation suite first, a regression suite second**: it pins down what the
game does today so that moving code cannot silently change behaviour.

**Structure:** one folder per functional area under `tests/e2e/`, each holding its specs and a
`README.md` describing what that area covers and what is deliberately out of scope. Adding an
area needs no registry edit — the runner discovers folders.

**Conventions deliberately mirror the `theCave` harness** (same author, same machine): a
`tests/run-e2e.mjs` wrapper, `--headed` / `--slow` / `--list`,
timestamped run folders with a rolling history, and a markdown summary per run. The
differences are the two the brief calls for: **8 workers headless** (theCave uses 4 for
stability — see §3.5) and **`--slow` defaults to 500 ms**.

---

## 2. Prerequisites — do these before writing a single spec

These are not optional. Without them the suite is either impossible or permanently flaky.

### 2.1 Fast initialisation (Refactor Phase 1.1–1.2) ✅ delivered

~~Cold start currently re-parses a 19 MB JSON once per territory. Every spec begins with a game
start; at present that is minutes per test. **No e2e work should begin before this is fixed.**~~
Closed in Phase 1: the adjacency data is loaded and indexed once, and a spec's game start is
now a second or two.

### 2.2 A deterministic RNG hook (Refactor Phase 1.6) ✅ delivered — and the limit is CLOSED (Phase 5.8)

The game calls `Math.random()` in battle resolution, siege hit rolls, random events, leader
generation, starting forts, initial gold and post-conquest lockout length. Without control,
nothing about combat is assertable.

Install a seeded PRNG **before any module evaluates**:

```js
// tests/support/seed.js — injected via page.addInitScript
export function installSeededRandom(seed) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  Math.random = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__seed = seed;
}
```

The game already ships `xfnv1a` + `mulberry32` in
[aiCalculations.js:74](../aiCalculations.js#L74) — reuse them rather than duplicating.

> ~~**This used to be necessary but NOT sufficient — and that is now closed.** Measured during
> Phase 1: `addSparklesRegularly()` re-armed a timer every 0–100 ms and burned **three**
> `Math.random()` calls per tick on the same global stream the economy and combat drew from.
> How many cosmetic draws landed between two game-logic draws depended on wall-clock timing,
> so two runs with the same seed diverged. That is audit §5.3 **Y**, and **Phase 5.8 closed
> it**: cosmetic randomness moved to `src/platform/cosmeticRng.js`, a self-contained
> mulberry32 that never touches `Math.random`.~~
>
> **Consequence for this plan:** the restriction is lifted. **A spec MAY assert an exact
> combat or economy outcome across runs.** ~~`the same seed produces the same world` in
> `bootstrap/e2e-hook.spec.js` was the canary and it is green; `battle/rout.spec.js`,
> `battle/outcomes.spec.js` and `ai-turn/ai-turn.spec.js` all assert exact outcomes now.~~
>
> The invariant style is still right wherever the invariant is the more useful statement —
> "totals only decrease", "ownership transfers", "the right screen appears". It is a choice
> now, not a limit.
>
> **Cosmetic randomness is deliberately not reproducible.** Seeding it from the harness would
> only put the sparkle timer back on a stream game logic reads, which is the defect.

### 2.3 A test-only state accessor (Refactor Phase 1.6) ✅ delivered, and extended since

Behind `?e2e=1`, expose a read-only window handle:

```js
window.__game = {
  ready: Promise<void>,        // resolves when initialisation finishes
  phase: () => number,
  turn:  () => number,
  territory: (nameOrId) => ({ ...snapshot }),   // deep copy, never the live object
  territoriesOwnedBy: (owner) => [...],
  totals: () => ({ gold, oil, food, consMats, prodPop, area, army }),
  sieges: () => ({ player: [...], ai: [...] }),
  wars:   () => [...],
  retrievals: () => [{ warId, sourceTerritoryIds, turnQueued, turnsUntilReturn }],
  stateGuardViolations: () => [{ territory, field }],  // Phase 4; empty without ?stateGuard=1
  applyScenario: (scenario) => ({ territories, sieges, errors }),  // see 3.7

  // added in Phase 5.8, each because a spec could not otherwise be written
  countryStrengths: () => [[countryName, normalisedStrength], ...],
  greyedOutCountries: () => [...],          // the selection lock, as STATE not as a fill
  siegeAt: (territoryName) => ({ side, warId, attackingCountry, turnsInSiege,
                                 attackingArmyRemaining, defendingArmyRemaining }) | null,
  battle: () => ({ attackers, defenders, round, warId, probability }) | null,
  randomEventProbability: () => number,
  forceRandomEvent: (name) => name,         // queue one of the four for the next turn

  // added in Phase 7.3, installed once a game is running (see below)
  saveNow: () => boolean,                   // the autosave tick, minus the sixty-second wait
  saveCode: () => string | null,            // the Save panel's field, without the panel
  loadCode: (code) => Promise<void>,        // its Load button, without the panel
  hasStoredSave: () => boolean,
  clearStoredSave: () => void,
};
```

**Why the Phase 7.3 additions exist.** `saveNow()` is the whole reason: the autosave interval
is sixty seconds, and a spec cannot wait sixty seconds. Shortening the interval when `?e2e=1`
is set would mean the suite exercising a timing the game never uses, so the hook takes the same
save through the same code path and raises the same spinner instead. `saveCode()` and
`loadCode()` are the panel's two buttons without the panel, for the specs that are about the
round trip rather than about a textarea and the clipboard. All five are installed by
`beginAutosaving()`, so they exist from the moment a game starts and not before — which is also
when there is anything for them to do.

~~**Why each of the Phase 5.8 additions exists** — none of them is convenience:

- `greyedOutCountries()` — the country-selection lock was enforced by comparing a path's
  **fill** against a grey constant, which is exactly why it was bypassable. A spec that
  asserted the same fill would have pinned the bug. It reads the store.
- `siegeAt()` — `sieges()` answers *which* territories are besieged; this answers *what is
  happening to this one*. `turnsInSiege` and the two armies are not reachable any other way.
- `battle()` — the battle UI's own cells are formatted (`"1.9k"`), so an outcome defined
  arithmetically ("half the surviving defenders join the attacker") cannot be asserted from
  them. This is the unrounded truth, deep-copied like everything else here.
- `forceRandomEvent()` — a random event is a band on the **mean of five draws**, so no seed
  puts a chosen disaster on a chosen turn, and the scenario loader sets up the *world* rather
  than the *turn*. Without it the four events could only ever be unit-tested.~~

Rationale: the numeric truth of this game lives in the territory model, not in the DOM.
Asserting food capacity by reading a KMB-formatted table cell (`"1.2M"`) tests the formatter,
not the economy. **Assert numbers through `__game`, assert behaviour and visibility through
the DOM.**

Since refactor Phase 4 the model is `src/state/GameState.js`, and `__game` reads it through
`state/selectors.js`. Two consequences for specs:

- **The SVG path attributes are output.** `owner`, `data-name`, `deactivated`, `underSiege`,
  `greyedOut` and `attackableTerritory` are rendered from state by
  `src/ui/mapAttributeSync.js`. Asserting on them is still fine and several specs do — it is
  how `bootstrap/state-layer.spec.js` proves the map and the model agree — but they are no
  longer where the game keeps the fact.
- **`?stateGuard=1` logs every territory write that bypasses `state/mutations.js`**, and
  `?stateGuard=strict` throws on one. It is still in warn mode: ~~Phase 5 made the economy and
  combat rules pure, but~~ the AI's action executors and `ui.js` still hold territories and
  assign to them, so each report is a **Phase 6** to-do. A spec that turns the guard on must
  not assert the list is empty.

### 2.4 Stable selectors

Today's ids are positional (`battleUIRow4Col2A`…`H`, `aiDialogueBoxBottomSummaryRowCol1`…`8`)
and table cells are read by index. Add `data-testid` attributes as components are extracted in
Refactor Phase 6, and keep the canonical list in `ui/core/registry.js`, **imported by both the
app and the page objects** so drift is a build error, not a flaky test.

Until Phase 6, page objects use current ids — that is exactly what makes them page objects.
The full current id inventory is in §7.

### 2.5 Console-error gate

Add a global fixture that fails any test whose page logged an uncaught error or an
unhandled rejection. Given the audit found several `ReferenceError`-class bugs
(§5.1 H), this alone will catch real defects.

---

## 3. The harness

### 3.1 Layout

```
tests/
  e2e/
    <functional-area>/
      README.md
      <topic>.spec.js
  support/
    fixtures.js          custom test fixture: seeded page, console gate, __game handle
    seed.js              deterministic Math.random (§2.2)
    game.js              high-level actions: startGame, endPhase, playTurns, attack…
    pages/               one page object per panel
      menu.js  countrySelect.js  map.js  phaseBar.js  moveButton.js
      buyWindow.js  upgradeWindow.js  transferAttack.js  battle.js
      battleResults.js  infoTable.js  aiDialogue.js  topTable.js  bottomTable.js
    selectors.js         re-exports ui/core/registry.js + test-only helpers
    territories.js       loads tests/uniqueIdLookup.json → name ⇄ uniqueId
  run-e2e.mjs            the wrapper described below
playwright.config.js
test-reports/
  history.md
  runs/<timestamp>/{summary.md,results.json,html/,artifacts/}
```

### 3.2 `playwright.config.js`

```js
const path = require("path");
const { defineConfig } = require("@playwright/test");

const REPORT_DIR = process.env.DWC_REPORT_DIR
  || path.join(__dirname, "test-reports", "runs", "adhoc");

const HEADED  = process.env.DWC_HEADED === "1";
const SLOW_MO = Number(process.env.DWC_SLOWMO) || 0;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,                 // a turn with 200 AI countries is not fast
  expect: { timeout: 15_000 },

  // Headed always means ONE browser to watch. Headless defaults to 8, per brief.
  workers: HEADED ? 1 : (Number(process.env.DWC_WORKERS) || 8),

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  outputDir: path.join(REPORT_DIR, "artifacts"),
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(REPORT_DIR, "results.json") }],
    ["html",  { outputFolder: path.join(REPORT_DIR, "html"), open: "never" }],
  ],

  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: !HEADED,
    launchOptions: SLOW_MO ? { slowMo: SLOW_MO } : {},
    viewport: { width: 1600, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },

  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

### 3.3 `tests/run-e2e.mjs` — responsibilities

**A bare word is a folder under `tests/e2e/`, and every extra word is another folder added to
the same run** — `node tests/run-e2e.mjs attack turn-loop` runs both. A word that is not a
folder there is forwarded to Playwright as a path or regex if it can only be one (it contains
a slash, a dot or a colon) and is otherwise **rejected with the area list**, so a typo cannot
quietly run nothing and report a pass.

Beyond the positional areas it consumes three flags itself and forwards everything else to
`playwright test` verbatim:

| Flag | Behaviour |
|---|---|
| `--slow` / `--slow=<ms>` | Sets `DWC_SLOWMO`. **Default 500 ms.** Pauses between every Playwright action. |
| `--category <name>` / `--category=<name>` | The older spelling of a bare word, kept working. Same resolution and the same errors. |
| `--list` (`--list-categories`) | Prints every folder under `tests/e2e/` with its spec count, non-empty first. |

Areas resolve to forward-slash paths (`tests/e2e/attack`), because backslashes break
Playwright's positional regex on Windows, and the argv-to-arguments translation is unit-tested
in `tests/unit/run-e2e-args.spec.js` — a mistake there runs the wrong specs, or none, and
Playwright reports that as a pass.

It also:

- Detects `--headed` (flag or `DWC_HEADED`) and sets the env var, so the config forces
  `workers: 1` — Playwright's own `--headed` cannot reach the `workers` expression, which
  would otherwise leave 8 visible browsers racing.
- Creates `test-reports/runs/<ISO-stamp>/`, points `DWC_REPORT_DIR` at it.
- Spawns Playwright's CLI **under `process.execPath`**, not `npx` — on Windows, Node refuses
  to spawn `.cmd` shims without a shell.
- After the run, flattens `results.json` into `summary.md`: verdict, totals, wall clock, a
  by-category table, a by-suite table, and a Failures section linking the screenshot, video
  and `npx playwright show-trace` command for each failure.
- Prunes to the newest `DWC_HISTORY_LIMIT` (default 10) run folders and regenerates
  `test-reports/history.md`.

### 3.4 `package.json` scripts

```json
{
  "test":                  "npm run test:unit && npm run test:e2e",
  "test:unit":             "vitest run",
  "test:e2e":              "node tests/run-e2e.mjs",
  "test:e2e:category":     "node tests/run-e2e.mjs",
  "test:e2e:categories":   "node tests/run-e2e.mjs --list",
  "test:e2e:headed":       "node tests/run-e2e.mjs --headed",
  "test:e2e:slow":         "node tests/run-e2e.mjs --headed --slow",
  "test:e2e:ui":           "playwright test --ui",
  "test:e2e:debug":        "playwright test --debug",
  "test:report":           "playwright show-report test-reports/runs/adhoc/html"
}
```

**Usage**

```bash
npm run test:e2e                              # everything, headless, 8 workers
npm run test:e2e:categories                   # list functional areas + spec counts
npm run test:e2e:category -- siege            # one folder
npm run test:e2e:headed                       # 1 visible browser, full speed
npm run test:e2e:slow                         # 1 visible browser, 500ms per action
node tests/run-e2e.mjs attack                 # one folder
node tests/run-e2e.mjs attack turn-loop siege # three folders, one run
node tests/run-e2e.mjs --slow=1000 battle
node tests/run-e2e.mjs --headed --slow tests/e2e/attack/multi-territory.spec.js:42
DWC_WORKERS=4 npm run test:e2e                # back off if the box struggles
```

### 3.5 A note on workers — measured

The brief specifies up to 8. **Measured on this machine, 8 is not stable for this suite** and
the default is therefore **4**, exactly as `theCave` settled on:

| Workers | Result |
|---:|---|
| 1 | 27/28 pass |
| 4 | 27/28 pass (~30 s) |
| 6 | 24/28 pass |
| 8 | 15/28 pass |

The failures at 8 are pages not finishing the territory-model build before assertions run, not
assertion faults — every one of them passes at `DWC_WORKERS=1`. Raise it deliberately if the
hardware changes: `DWC_WORKERS=8 npm run test:e2e`.

**Wall-clock budgets are asserted only on a single-worker run.** Under four parallel browsers
the same page takes ~2000 ms instead of ~550 ms; that is contention, not regression. The
`bootstrap` category is pinned to one worker by the runner, and `npm run test:e2e:perf` is the
way to check timings.

### 3.6 Fixtures

```js
// tests/support/fixtures.js
const base = require("@playwright/test");

exports.test = base.test.extend({
  // Every page: seeded RNG installed pre-navigation, ?e2e=1, console gate armed.
  page: async ({ page }, use, testInfo) => {
    const seed = testInfo.title;                       // stable per test, distinct across tests
    await page.addInitScript(installSeededRandomSource, seed);

    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

    await use(page);

    base.expect(consoleErrors, "page logged errors").toEqual([]);
  },

  // A game already started as a named country, sitting in Buy/Upgrade of turn 1.
  game: async ({ page }, use) => {
    const game = new GameDriver(page);
    await use(game);
  },
});
```

`GameDriver` (`tests/support/game.js`) is the one place that knows the click sequence for
starting a game, advancing a phase, or running N turns. Specs never click the phase button
directly.

```js
await game.start({ country: "Germany", colour: "#ff0000" });
await game.endPhase();                       // Buy/Upgrade → Military
await game.endTurn();                        // Military → AI → next turn's Buy/Upgrade
await game.playTurns(5);
await game.select("Bavaria");
const t = await game.territory("Bavaria");   // snapshot object
```

### 3.7 Test-data seeding — ✅ **DONE** (refactor Phase 4)

Several areas (battle outcomes, siege ticks, starvation, economy over many turns) are
impractical to reach by clicking. Behind `?e2e=1` only, a **scenario loader** puts the world
into a named state:

```js
await game.loadScenario("two-sieges");
```

Scenarios live in `tests/support/scenarios/*.json` and are applied through
`state/mutations.js` — the same path the game writes by, so a scenario cannot produce a world
the game could not have produced itself. Set a territory's army, resources or forts, or open a
siege. See [`tests/support/scenarios/README.md`](../tests/support/scenarios/README.md) for the
shape and [`src/platform/scenarios.js`](../src/platform/scenarios.js) for the loader.

**One deviation from the original design.** It specified `?e2e=1&scenario=besieged-fort`, with
the page fetching the JSON. The preview server serves `build/`, not the repository, so the page
cannot reach those files. The primitive is `window.__game.applyScenario(scenarioObject)`, and
`GameDriver.loadScenario(name)` reads the JSON in Node and passes it in. The scenarios live
where the plan put them and the specs read the same.

`applyScenario` returns a report — the territories and sieges it applied, and any name it could
not resolve — and `loadScenario` throws on a non-empty error list. A scenario that silently did
nothing turns every spec built on it into a spec that asserts nothing, so the loader has its own
coverage in `bootstrap/scenario-loader.spec.js`.

**What it unblocked:** three of the four `battle/known-broken` specs immediately — the
naval-only defender (audit §5.2 K), two concurrent sieges (§5.1 D), and the
INVADE!-debit/retreat-return round trip (§5.1 AD). The fourth, the rout threshold (§5.1 E),
had to wait for Phase 5.8 to close §5.3 Y, because a rout is a random outcome given the setup
and a seed could not force one while the sparkle timer shared the stream. It is
`battle/rout.spec.js` now.

**Nine scenarios today**, and they divide into two kinds. `two-sieges`, `weak-defender` and
`doomed-ai-siege` set up a *situation*. `naval-only-defender`, `outright-conquest`,
`hopeless-attacker`, `last-push-defender`, `evenly-matched` and `rout-bound-defender` set up
an *outcome* — each is composed so that a specific `WarOutcome` is what the battle reaches.

**One trap worth writing down.** `armyForCurrentTerritory` is a **stored total**, not a derived
one. A scenario that patches the four unit counts without patching it leaves the two
disagreeing, and the probability calculation reads the units while the bottom table reads the
total — so the setup looks applied and the battle behaves as though it were not. Every scenario
here patches both.

---

## 4. What is tested where

**E2E owns:** flows, phase transitions, UI state machines, what is visible/enabled, what a
click does, and end-to-end numeric outcomes at a coarse grain.

**Unit tests (Vitest) own:** the arithmetic — income formulas, capacity regeneration,
starvation, probability, skirmish resolution, siege damage, AI threat scoring. Landed in
Refactor Phase 5 when `rules/` became importable; **294 tests in 15 files**, and they are where
fine-grained numeric coverage belongs.

Do not duplicate. If an assertion is about a formula, it is a unit test.

---

## 5. Functional areas

Priority: **P0** must exist before any refactor begins · **P1** before Phase 3 defect fixes ·
**P2** before Phase 4–6 · **P3** as features land.

| # | Folder | Priority | Depends on | Status |
|---|---|---|---|---|
| 1 | `bootstrap/` | P0 | §2.1 | ✅ 52 |
| 2 | `country-selection/` | P0 | §2.1 | ✅ 30 |
| 3 | `turn-loop/` | P0 | §2.3 | ✅ 28 |
| 4 | `map-interaction/` | P0 | — | ✅ 24 |
| — | `adjacency/` | P0 | — | ✅ 9 — not in the original list; guards the data pipeline and audit §3.1 |
| 5 | `resources-economy/` | P1 | §2.2, §2.3 | ✅ 11 |
| 6 | `buy-military/` | P1 | §2.3 | ✅ 17 |
| 7 | `upgrade-territory/` | P1 | §2.3 | ✅ 28 |
| 8 | `transfer/` | P1 | §2.3 | ✅ 13 |
| 9 | `attack/` | P1 | §2.2, §2.3 | ✅ 15 |
| 10 | `battle/` | P1 | §2.2, §2.3 | ✅ 17 |
| 11 | `siege/` | P2 | §2.2, §3.7 | ✅ 11 — Phase 5.8 |
| 12 | `ai-turn/` | P2 | §2.2, §3.7 | ✅ 4 — Phase 5.8 |
| 13 | `info-panels/` | P2 | §2.3 | ✅ 5 — Phase 5.8 |
| 14 | `random-events/` | P2 | §2.2, §3.7 | ✅ 7 — Phase 5.8 |
| 15 | `conquest-lifecycle/` | P2 | §3.7 | ✅ 4 — Phase 5.8 |
| — | `options/` | P2 | — | ✅ 21 — Phase 7.10; not in the original list, added with the theme system and grown with the audio work |
| — | `ui-layout/` | P2 | — | ✅ 42 — Phase 7.11 and 7.4. Not in the original list: it exists because two of its faults have no textual signature at all, so no unit test can hold them — a window that clips its own last row, and a focus order that never reorders anything |
| — | `activity-feed/` | P2 | Refactor 7.4 | ✅ 25 — Phase 7.4 |
| — | `dominapedia/` | P2 | Refactor 7.6 | ✅ 11 — Phase 7.6. Not in the original list: the manual is the first screen in the game that is a document rather than a control surface, and its catalogue is pure so the unit suite owns the content and the page order. What is here is the window — opening and three ways of closing, the collapsible contents, Previous / Next wrapping at both ends of the book, and the panel that must never scroll |
| 16 | `save-load/` | P3 | Refactor 7.2/7.3 | ✅ 16 — Phase 7.2/7.3. This is row 16, `persistence/`, delivered under the name of the feature rather than of the mechanism |
| 17 | `victory-conditions/` | P3 | Refactor 7.1 | — |

**408 tests in 62 files.** P0, P1 and P2 are complete; P3 arrives with the features it tests.
Each folder's README records which rows of the tables below it delivers and which it defers,
with the reason — a spec that is missing is missing on purpose and says so.

---

### 5.1 `bootstrap/` — P0

Page load through to a playable state.

| Spec | Covers |
|---|---|
| `page-load.spec.js` | `index.html` loads; both SVG objects resolve; 359 paths present with the expected attribute set; no console errors; main menu visible; **New Game disabled until the territory model is built, then enabled** |
| `initialisation-performance.spec.js` | Cold start to "New Game enabled" completes within a budget (**assert < 5 s**, log the actual). This is the regression guard for audit §4.1 — it is the one perf assertion worth having in e2e |
| `initial-model.spec.js` | Via `__game`: 359 territories; every territory has non-zero area, population and a `devIndex` in 0.4–0.95; total area ≈ 136,067,649 km² ±1 %; every `data-name` resolves to a country in `initialData.js` |
| `asset-integrity.spec.js` | Every flag referenced by `setFlag` exists (207 countries × `resources/flags/*.png`); every icon in the top/bottom tables and UI table headers returns 200 |

> `asset-integrity` is cheap and catches a whole class of silent breakage — `setFlag` has no
> fallback and a missing flag renders as a broken image with no error.

---

### 5.2 `country-selection/` — P0

| Spec | Covers |
|---|---|
| `new-game.spec.js` | New Game hides the menu, shows the country-selection popup, greys out countries above the 40,000 strength threshold, and shows the colour picker |
| `greyed-out.spec.js` | A greyed country is not selectable and shows no confirm button; a selectable one populates `#popup-body` with its name and enables confirm |
| `colour-picker.spec.js` | Changing colour repaints every path of the pending country; after game start it repaints every player-owned territory and persists across a phase change |
| `confirm-and-initialise.spec.js` | Confirming sets `playerCountry`, sets the player flag in the top table, runs initialisation, ungreys the map, and lands in Buy/Upgrade of turn 1 with the phase button reading `MILITARY` |
| `multi-territory-country.spec.js` | Picking a country with several territories (e.g. *United States*) gives the player **all** of them; picking a single-territory country gives exactly one |

---

### 5.3 `turn-loop/` — P0

The spine. Everything else depends on these being right.

| Spec | Covers |
|---|---|
| `phase-transitions.spec.js` | `Buy / Upgrade → Military → AI → Buy / Upgrade`; the phase title and button label at each step (`MILITARY`, `END TURN`, `AI MOVING...`); the button is disabled for the whole AI phase and re-enabled after |
| `turn-counter.spec.js` | `__game.turn()` increments once per full cycle; turn 1 applies **no** income (the code skips `calculateTerritoryResourceIncomesEachTurn` on turn 1) but turn 2 does |
| `start-of-turn-ui.spec.js` | The UI info table auto-opens at the start of each turn when the checkbox is on, and does not when off; the preference survives turns |
| `phase-restrictions.spec.js` | Transfer/attack is unavailable in Buy/Upgrade; buy/upgrade windows are unavailable in Military; nothing is clickable during AI |
| `long-run.spec.js` | **10 consecutive turns with no player action**: no console errors, no `NaN` in any territory field, turn counter correct, player still owns their starting territories. This is the single highest-value spec in the suite — it is what proves a refactor did not corrupt the loop |

---

### 5.4 `map-interaction/` — P0

| Spec | Covers |
|---|---|
| `hover.spec.js` | Hover lightens the path and shows the owner tooltip; mouse-out restores fill and hides the tooltip; greyed-out paths do not respond |
| `selection.spec.js` | Clicking a territory populates the bottom table (flag, name, mountain defence, gold, oil, food, cons. mats, population, area, military) from `__game` values; the path is raised in z-order and gets the selected stroke |
| `zoom-pan.spec.js` | Wheel zooms up to 6×, clamps there and at 1×; dragging pans only while zoomed; both SVG layers (map + coast lines) stay in register |
| `map-modes.spec.js` | Political ↔ physical toggle recolours by continent and switches strokes black ↔ white; the continent-stroke toggle is independent; clicking the map while in physical mode reverts to political |
| `escape-key.spec.js` | Escape closes the topmost open panel and restores map interactivity; Escape during initialisation is ignored |
| `siege-markers.spec.js` | A besieged territory shows the siege overlay, a dashed stroke, and a tooltip naming the besieger; AI-besieged markers are the smaller semi-transparent variant |

---

### 5.5 `resources-economy/` — P1

Coarse-grained only; formulas belong in unit tests (§4).

| Spec | Covers |
|---|---|
| `per-turn-income.spec.js` | Over a turn with no player action, gold rises, and oil/food/cons. mats move **toward** their capacity (+30 % / +20 % / +25 % of the gap) and **decay at 10 %** when above it |
| `top-table-totals.spec.js` | Top-table figures equal the sum over `__game.territoriesOwnedBy("Player")` for every resource, and update after a purchase without a phase change |
| `oil-demand-gating.spec.js` | Buying naval units past the territory's oil supply leaves them owned but **not useable**; the Army tab shows `owned (useable)` correctly; useable counts are what feed defence strength |
| `population.spec.js` | Population grows when food supports it; falls when it does not; productive population = `(pop × 0.45) × devIndex − army` |
| `starvation.spec.js` | A territory driven below its food need loses population at a rate scaled by `(1 − devIndex)`; ~~**marked `fixme` with a link to audit §5.1 F** until the army-starvation branch is fixed~~ — **F is closed** (Phase 3) and the spec asserts it |
| `resource-borrowing.spec.js` | A purchase a territory cannot fund alone draws gold/manpower from the player's other territories, and fails cleanly when the player as a whole cannot afford it |

---

### 5.6 `buy-military/` — P1

| Spec | Covers |
|---|---|
| `open-close.spec.js` | Buy window opens for an owned territory in Buy/Upgrade only; the X and Cancel both close it without spending |
| `quantity-steppers.spec.js` | ×1 / ×10 / ×100 / ×1k cycling; plus/minus clamp at 0 and at the affordable maximum; the running gold and manpower totals track the rows |
| `affordability.spec.js` | Rows grey out when gold **or** productive population is insufficient; the confirm button disables when all rows are 0 and enables when at least one is ≥ 1 |
| `purchase.spec.js` | Confirming deducts exactly `qty × price` in gold and manpower, adds exactly `qty` units of each type, and updates the top table, bottom table and Army tab |
| `oil-demand-on-purchase.spec.js` | Buying assault/air/naval raises the territory's oil demand by 100/300/1,000 per unit and re-evaluates useability immediately |

---

### 5.7 `upgrade-territory/` — P1

| Spec | Covers |
|---|---|
| `open-close.spec.js` | Upgrade window opens for an owned territory in Buy/Upgrade only; X and Cancel close without spending |
| `costs.spec.js` | Cost = `base × modifier × (devIndex / 4)` for each building; a high-`devIndex` territory pays less than a low one for the same building |
| `caps.spec.js` | Each building caps at 5; at the cap the row reads `Max <Building>s Reached` and cannot be incremented |
| `capacity-effects.spec.js` | ✅ **The audit §5.1 A regression test.** Buying exactly one farm raises `foodCapacity` by exactly 10 % of its pre-purchase value — not by `farmsBuilt × 10 %`, and not compounding. Same for forest → cons. mats and oil well → oil. Buying a *fort* must leave all three capacities untouched. ~~Marked `fixme` until Phase 3.1~~ — green since Phase 3.1 |
| `fort-defence.spec.js` | Defence bonus = `ceil(forts × (forts + 1) × 10) × devIndex + landlockedBonus`; a landlocked territory gets +10; the bottom table's defence figure matches |
| `insufficient-resources.spec.js` | Rows grey with `Not enough gold` / `Not enough Cons. Mats.` and the reason matches which resource is short |

---

### 5.8 `transfer/` — P1

| Spec | Covers |
|---|---|
| `valid-destinations.spec.js` | Selecting an owned territory highlights exactly its reachable territories; a territory with no reachable friendly neighbour disables the TRANSFER button with the "no other territories" tooltip |
| `transfer-window.spec.js` | The window lists every valid destination with a per-unit-type allocation row; multipliers work; the button becomes CONFIRM once any quantity is non-zero |
| `execute-transfer.spec.js` | Confirming moves exactly the chosen units; source loses them, destination gains them, both totals are conserved, and the units are usable **the same turn** |
| `deactivated-source.spec.js` | A territory conquered within its lockout shows `DEACTIVATED (n)`, is disabled, and the countdown decreases each turn until it reactivates |
| `island-exceptions.spec.js` | The hand-curated adjacency rules hold: Fiji ↔ Vanuatu ↔ New Caledonia are reachable, and denied pairs are not. **This is the regression test for audit §3.1** — the exception table's 1-second race |

---

### 5.9 `attack/` — P1

| Spec | Covers |
|---|---|
| `target-selection.spec.js` | Clicking a reachable enemy territory switches the move button to ATTACK (red), shows the target banner with both flags, and marks the target on the map |
| `unreachable-target.spec.js` | An enemy territory not in range shows no button; a territory already under siege shows `VIEW SIEGE (n)` instead of ATTACK |
| `attack-table.spec.js` | The table lists **every** player territory able to reach the target, each with its own allocation row; totals aggregate across rows; a territory can be included with 0 units and contributes nothing |
| `probability.spec.js` | The probability bar matches `__game`'s computed value; it updates live as units are added; it accounts for the defender's fort + mountain bonus and the defender's **useable** (not owned) units |
| `invade.spec.js` | INVADE! removes the allocated units from their source territories immediately, opens the battle UI, and closes the attack window |
| `siege-offer.spec.js` | ⚠️ **This row was written backwards, and the code is right.** The Siege button is enabled at or above `PROBABILITY_THRESHOLD_FOR_SIEGE` (15 %) and disabled below it — and so is the AI's rule: `ai/goals.js` pushes a Siege goal on `probabilityOfWin >= PROBABILITY_THRESHOLD_FOR_SIEGE`. A siege commits an army for many turns, so it is offered when there is a real chance of finishing it. Delivered as `siege/start-siege.spec.js` |
| `cancel.spec.js` | Cancel at any stage restores the map colours, clears the attackable flags and returns no units |

---

### 5.10 `battle/` — P1

Requires the seeded RNG (§2.2) — every assertion here is otherwise non-deterministic.

| Spec | Covers |
|---|---|
| `rounds.spec.js` | Advance runs one round of the 5; losses appear on both sides; the round counter and probability bar update; totals only ever decrease |
| `attacker-wins.spec.js` | Defenders reduced to 0 → territory changes owner, survivors garrison it, the path repaints to the player colour, and the results screen offers "Accept Victory!" |
| `defender-wins.spec.js` | Attackers reduced to 0 → ownership unchanged, results offer "Accept Defeat!", the source territories do **not** get their units back |
| `rout.spec.js` | ✅ Defender combined force < 5 % of its **starting** force → territory captured **and half the surviving defenders join the attacker**, asserted exactly. Delivered in Phase 5.8. Reaching the band takes composition, not attrition: a defender made mostly of naval units (20,000 personnel each) loses almost all of its combined force when the ships go down while its infantry are still standing |
| `massive-assault.spec.js` | Defender < 15 % → the final-push option appears and costs 20 % of the attacking survivors |
| `attacker-routed.spec.js` | Attacker < 10 % of starting force → attack fails, survivors lost |
| `fight-again.spec.js` | No terminal condition after 5 rounds → another 5 rounds begin with the attacker 5 % smaller (desertion) |
| `retreat.spec.js` | Retreating mid-battle returns survivors to their source territories in the sent proportions, via the retrieval array, after the expected delay |
| `mismatched-unit-types.spec.js` | ✅ An all-infantry attack against an all-naval defender resolves rather than stalling. audit §5.2 K, fixed in Phase 3.15 with the matchup matrix; asserted in `battle/known-broken.spec.js` |
| `results-screen.spec.js` | Kills, losses, captured, survived, rounds and siege stats on the results screen match `__game`; accepting closes it and restores the map |

---

### 5.11 `siege/` — P2

Needs the scenario loader (§3.7) for anything beyond a single tick.

| Spec | Covers |
|---|---|
| `start-siege.spec.js` | Choosing Siege converts the attack into a standing siege: the siege object exists, the marker and dashed stroke appear, and the besieging army leaves its source |
| `siege-tick.spec.js` | One turn advances `turnsInSiege`, applies collateral damage to the defender's `foodCapacity`, and may destroy a building |
| `siege-score.spec.js` | Siege score = `Σ(units × siegeValue)` (naval 10, air 5, assault 3, infantry 0.0001); a naval-heavy siege scores far above an infantry-heavy one of equal headcount |
| `multiple-sieges.spec.js` | ✅ Two concurrent sieges: **both** tick every turn. audit §5.1 D, asserted in `battle/known-broken.spec.js` against the `two-sieges` scenario |
| `arrest.spec.js` | A besieging force far weaker than the defences is arrested; the siege ends, the marker clears and the army is lost |
| `defender-starvation.spec.js` | Sustained siege drives the defender's food below need, starves the garrison, and can flip into a rout victory for the besieger |
| `view-siege.spec.js` | `VIEW SIEGE (n)` opens the battle UI in siege mode with the correct turn count, siege score and probability, and offers the assault option |
| `lift-siege.spec.js` | Withdrawing ends the siege, clears the marker and `underSiege` state, and returns the army |
| `ai-siege.spec.js` | An AI siege on a player territory renders with the AI marker variant and ticks against the player each turn |
| `siege-marker-reconciliation.spec.js` | ✅ Delivered as `siege/markers.spec.js`, and it grew two assertions the plan did not anticipate: there is exactly **one** marker per siege (there were two, sharing an id), and the marker does not **swallow the click** on the territory it marks. `normalizeSiegeState()` is gone — the marker is rendered from `siegeChanged` |

---

### 5.12 `ai-turn/` — P2

| Spec | Covers |
|---|---|
| `ai-turn-completes.spec.js` | ✅ The AI phase completes for all countries with no console errors and no territory left holding a non-object or non-finite value. audit §5.1 B/C. Delivered as `ai-turn/ai-turn.spec.js` |
| `determinism.spec.js` | ✅ Two runs with the same seed produce identical world state. **This was impossible until Phase 5.8 closed audit §5.3 Y** — it is the guard that makes every other AI test possible, and it is green |
| `ai-economy.spec.js` | An economy-focused (pacifist) leader's territories gain buildings over 5 turns; an aggressive leader's gain army instead |
| `ai-attack.spec.js` | Given a scenario with a weak player territory adjacent to an aggressive AI, the AI attacks and can take it; the player's territory count drops and the map repaints |
| `ai-gold-offer.spec.js` | When the AI wants to besiege a territory the player is already besieging, the dialogue appears with the leader's flag, name and offer; **accepting** transfers the gold, lifts the player's siege and returns their army; **declining** leaves both unchanged |
| `ai-turn-gains.spec.js` | Each AI country's per-turn resource gains aggregate across **all** its territories. ✅ Regression test for audit §5.1 G — ~~marked `fixme` until Phase 3.6~~ green since Phase 3.6 |
| `ai-respects-sieges.spec.js` | The AI does not attack or siege a territory that is already under siege, and does not act from a territory that is itself besieged (the behaviour added in commits `a3a3e3c` / `ef689fb`) |

---

### 5.13 `info-panels/` — P2

| Spec | Covers |
|---|---|
| `tabs.spec.js` | Summary / Territories / Army / Wars & Sieges switch correctly, only one is `active`, and the choice persists while the panel is open |
| `summary-tab.spec.js` | The gains row shows **last turn's** deltas with the right sign colouring; oil demand and food consumption are colour-inverted (more is worse) |
| `territories-tab.spec.js` | One row per owned territory; every column matches `__game`; rows appear on conquest and disappear on loss |
| `army-tab.spec.js` | Per-territory unit counts, with owned vs useable shown separately |
| `wars-tab.spec.js` | Active sieges and concluded wars listed with the right victory/defeat icon and turn counts |
| `tooltips.spec.js` | Every header icon, every disabled button and every table row has its tooltip, positioned inside the viewport near the bottom edge |
| `formatting.spec.js` | `formatNumbersToKMB` boundaries: 999 → `999`, 1,000 → `1K`, 1,500,000 → `1.5M`, 0 → `0`, negatives keep their sign |

---

### 5.15 `options/` — P2

Added with the theme system (refactor 7.10) and grown since with the audio work. The
catalogues themselves are unit tests (`tests/unit/ui-theme.spec.js`,
`tests/unit/platform-audio.spec.js`); what needs a browser is everything below, and the
theme paths in particular are one bug away from each other — a preview that persisted
would leave Cancel closing the panel and changing nothing, with no error anywhere.

| Spec | Covers |
|---|---|
| `theme-picker.spec.js` | Opens from the menu; closes on Done, on Escape and on a click outside; lists every theme with the default selected; changing the dropdown repaints immediately; the description follows the selection; Done survives a reload; Cancel restores the theme in force when the panel opened; the theme survives starting a game |
| `audio-panel.spec.js` | The music-note button is up from the country-selection screen onward and sits above the continent-view button; the in-game menu takes it down and gives it back; the button opens and closes the floating panel; Escape closes it; it is NOT a modal, so the map stays live behind it; the sliders and mutes move the real settings; a save carries them; the main menu no longer has a music item |
| `sound-toggles.spec.js` | The Options panel's two sound switches work before any game exists; unchecking mutes and Done keeps it muted; Cancel and Escape both restore the mutes in force at open; the switches and the audio panel over the map are one setting seen twice, asserted in both directions |

Assertions go through `data-theme` on `<html>` and one computed background colour. Pinning a
specific hex value is deliberately avoided — it would break every time a theme was tuned.
The one geometric assertion in the folder is a RELATIONSHIP, not a position: the music
button's top is above the continent-view button's, which is the fact that was changed and
would otherwise be guarded by nothing.

---

### 5.14 `random-events/` — P2

Needs the seeded RNG and a scenario that forces an event.

| Spec | Covers |
|---|---|
| `event-probability.spec.js` | Probability starts at 0 %, rises 1 % per quiet turn and resets to 0 when an event fires |
| `food-disaster.spec.js` | Affected territories lose half their food; unaffected ones are untouched; population change is suppressed that turn |
| `oil-well-fire.spec.js` | Affected territories lose oil; regeneration resumes next turn |
| `mutiny.spec.js` | Affected territories lose 25 % of their gold |
| `warehouse-fire.spec.js` | ✅ Reduces construction materials. audit §5.1 Q, fixed in Phase 3.14 and shown working **in the running game** for the first time in Phase 5.8 — the four disasters need `__game.forceRandomEvent()`, because an event is a band on the mean of five draws and no seed reaches a chosen one on a chosen turn |

---

### 5.15 `conquest-lifecycle/` — P2

The full arc from taking a territory to using it normally.

| Spec | Covers |
|---|---|
| `ownership-transfer.spec.js` | On conquest: `owner`, `data-name`, colour, top-table totals, Territories tab row and player territory count all update together, and `originalOwner` is preserved |
| `deactivation.spec.js` | The conquered territory is locked for 1–3 turns, shows the dashed red border and the countdown, and cannot transfer or attack |
| `reactivation.spec.js` | ✅ It reactivates exactly once, and stays active. audit §5.2 N/O. Delivered in `conquest-lifecycle/ownership-transfer.spec.js` |
| `army-retrieval.spec.js` | Surviving attackers not garrisoning the new territory return to their sources in the sent proportions after the expected number of turns |
| `economy-after-conquest.spec.js` | The conquered territory contributes to player income from the next turn, keeps its buildings and forts, and its resources are added to the player totals |

---

### 5.16 `save-load/` — P3 — ✅ delivered (Refactor 7.2/7.3)

Planned as `persistence/`; delivered as `save-load/`, because what it covers is two menu
features rather than a storage mechanism — reaching the menu mid-game and restarting belong
with saving and loading, and all four are the same set of state transitions.

| Spec | Covers |
|---|---|
| `menu-access.spec.js` | The hamburger appears with the game and disappears with the menu; it and Escape make the same two transitions; Resume is greyed out until there is something to resume; New Game asks before destroying a game in progress and does not ask when there is none; confirming really resets the world; the restarted game is playable |
| `save-load.spec.js` | The panel offers a code as soon as it opens; a code taken before a turn restores the game to before that turn; a loaded game is wired up rather than merely restored; a foreign code and a damaged one give different messages; the autosave writes to `localStorage` and raises the spinner; a stored save offers Resume on the next visit |

The division of labour with the unit suite is the point of this folder, and it is written up in
`tests/e2e/save-load/README.md`. `tests/unit/state-snapshot.spec.js` (24 tests) owns the data
path — what a snapshot contains and what a restore puts back. What only a browser can catch is
whether a loaded game is **wired up**: the phase button is invisible until something writes
`opacity: 1` over it, the top table is written rather than derived so nothing repaints it on a
state change, and the turn engine has to be stopped and started again. Each of those failures
passes every unit test and hands the player a dead screen.

Two hooks were added to `window.__game` for it — `saveNow()`, because the autosave interval is
sixty seconds and shortening it for the harness would mean testing a timing the game never
uses, and `saveCode()` / `loadCode()`, which are the panel's two buttons without the panel.

### 5.17 `victory-conditions/` — P3 *(after Refactor 7.1)*

Total conquest triggers victory; losing the last territory triggers defeat; the configured objective (N territories / a continent / turn limit) is evaluated at the right point in the turn; the end screen offers a new game that actually restarts.

---

### 5.18 `ui-layout/` — ✅ delivered (Refactor 7.11, extended in 7.4)

Not in the original plan. It exists because the two faults it is built around leave no trace
in the source, so no unit test can hold them:

- **a window that clips its own content.** Upgrade Territory shipped for months as
  `height: 500px` over a `366px` content window over a `300px` table — three ordinary CSS
  declarations that had to agree and did not, so the fourth of four rows was drawn underneath
  the bottom bar. Only a measurement finds that.
- **a focus order that never reorders anything.** The first version of `bringToFront()`
  compared a window's z-index against the counter's high-water mark, which was true for every
  window while they all sat at the base — so nothing could be raised and nothing threw.

| Spec | Covers |
|---|---|
| `drawn-controls.spec.js` | The steppers and the two territory-row action buttons are `<button>`s with inline SVG, not `<img>`s; disabled is `aria-disabled`, not a file path; a greyed stepper still receives its click and ignores it; the artwork PNGs the brief kept are still there; moving a token repaints all of it |
| `window-chrome.spec.js` | No window clips its own rows or hides them under its bottom bar; both fit on screen; the tab strip carries its selection in one class and is not styled inline; the confirm button arms and disarms; every panel paints an opaque themed surface |
| `draggable-windows.spec.js` | Each window moves by the distance the pointer moved and keeps its centring transform; a control inside a title bar still does its own job; a window cannot be dragged off screen; touching a window raises it, including deep inside; opening one focuses it; the stack never reaches the modal band |
| `phase-bar.spec.js` | The advance button sits at the bottom with no spare row; folding the bar does not move it by a pixel; it expands to exactly what it was; the flag is shown whenever the bar is open; the bar is below every window; the colour picker still sits directly above it |

`tests/unit/ui-stylesheet.spec.js` (28 tests) owns the other half — that no colour literal
survives outside `:root`, that no retired control PNG is referenced, that the two resource
windows are declared together, and that every class the JS writes is styled.

### 5.19 `activity-feed/` — ✅ delivered (Refactor 7.4)

The military activity panel. The division with the unit suite is sharper here than anywhere
else: `describeActivity()` is pure, so `tests/unit/ui-activity-feed.spec.js` owns every
sentence and every colour rule, and **no spec in this folder matches on the text of an
entry** — doing so would test the phrasing twice and the behaviour not at all.

| Spec | Covers |
|---|---|
| `panel.spec.js` | The button appears with the in-game chrome and not before; open, close and the X; per-turn sections group, collapse and expand, and a shut one is out of the layout; the panel raises itself at the start of a turn with exactly one section open and scrolled to the top, and the toggle switches the raising off without making it stale; it opens over the territory panel and can be pushed back under it |
| `recording.spec.js` | A conquest is derived from the ownership change and names the country it was taken *from*; the ownership pass that starts a game is not a conquest; a siege is recorded when it starts; an economic entry is refused outright and a buy/upgrade turn records nothing; the player-involvement flags are set on the right side and make the row larger; the log survives a save/load round trip and a pre-7.4 save still loads |

Two hooks were added to `window.__game`: `activity()` reads the log as data, and
`recordActivity()` writes one entry — because the feed's harder cases (an AI conquering an AI
on the far side of the map, a siege in its fourth turn) are unreachable by clicking in any
reasonable time. What it does not bypass is the panel: the entry goes through
`recordActivity()` and the panel re-renders from the event.

## 6. Delivery sequence

| Step | Work | Output | Status |
|---|---|---|---|
| E0 | Refactor 1.1–1.2 (fast init), 1.6 (`?e2e=1`, seeded RNG) | Prerequisites met | ✅ |
| E1 | Harness: `playwright.config.js`, `tests/run-e2e.mjs`, fixtures, `GameDriver`, page objects for menu / map / phase bar / bottom table | `npm run test:e2e` runs, 0 specs | ✅ |
| E2 | `bootstrap/`, `country-selection/` | ~14 specs | ✅ |
| E3 | `turn-loop/`, `map-interaction/` | ~11 specs · **P0 complete** | ✅ |
| E4 | `resources-economy/`, `buy-military/`, `upgrade-territory/` | ~17 specs | ✅ |
| E5 | `transfer/`, `attack/`, `battle/` | ~22 specs · **P1 complete — refactor Phase 3 can start** | ✅ |
| E6 | Scenario loader (Refactor 3.7) + `siege/`, `ai-turn/`, `conquest-lifecycle/` | 19 specs | ✅ Phase 5.8 |
| E7 | `info-panels/`, `random-events/` | 12 specs · **P2 complete** | ✅ Phase 5.8 |
| E8 | `persistence/`, `victory-conditions/` alongside Refactor Phase 7 | ~8 specs | |

### Where the suite stands at the end of Phase 6

**281 tests in 49 spec files across 15 areas, and 306 Vitest unit tests in 16 files.**
**There is no `test.fixme` left anywhere in the suite** — the last one was `attack-window`'s
marker assertion for audit §5.2 **AE**, which Phase 6.7 closed and which is now two specs, one
per cancel route.

~~**215 tests in 36 spec files across 11 areas** — 190 passing, 0 failing, 24 `test.fixme`,
plus the one wall-clock budget spec that skips outside a single-worker run — and 82 Vitest
unit tests. Full headless suite at four workers: **2 m 30 s**.~~ Each folder's `README.md`
carries its own spec table and its own out-of-scope note; the phase write-up is in
[03-refactor-plan.md](./03-refactor-plan.md#phase-2--land-the-safety-net-23-days--complete).

**Phase 6 added and changed these:**

- `map-interaction/zoom-pan.spec.js` was rewritten. Zoom is instant and cursor-anchored now
  (see [03-refactor-plan.md](./03-refactor-plan.md) §6.7), so the helper that polled for the
  500 ms animation to settle is gone, and three specs are new: every wheel event is applied,
  the zoom anchors on the pointer, and nothing outside the world is ever shown.
- `attack/attack-window.spec.js` gained the two **AE** specs.
- `map-interaction/hover.spec.js` gained the two tooltip specs for the siege wording.
- `tests/unit/ui-move-button.spec.js` is new: twelve specs stating the whole table of
  move-button outcomes, which used to be reachable only by clicking a live map.

**Two numbers in this document are wrong**, and the specs follow the code instead:

- **§5.1** quotes a `devIndex` range of 0.4–0.95. The shipped data is **0.326** (Somalia) to
  **0.962** (Switzerland); `bootstrap/initial-model.spec.js` derives the bound from
  `initialData.js`.
- **§5.7** describes upgrade cost as `base × modifier × (devIndex / 4)` and says a
  high-`devIndex` territory pays *less*. The shipped formula is **quadratic in the running
  total** — `ceil(base × n × (n × mult) × devIndex/4)`, where `n` is already-built plus
  selected — and the whole thing is *proportional* to `devIndex`, so a developed territory
  pays **more**. The second farm costs four times the first. Both are settled properly at
  refactor Phase 5.1, when the numbers move into `config/balance.js`.

~~**Six specs listed here were deferred to E6**~~ — all delivered in Phase 5.8 — because their setup is not reachable by
clicking and hoping the live map produces the right condition is a seed lottery rather than a
test: `starvation`, `resource-borrowing`, `deactivated-source`, `siege-offer`, and the battle
terminal conditions (`attacker-wins`, `defender-wins`, `rout`, `massive-assault`,
`fight-again`, `results-screen`). They all want the scenario loader in §3.7.

~~**Multi-turn coverage is blocked**, not missing. Audit §5.1 AA — found by
`turn-loop/long-run.spec.js` — freezes the game permanently from the second or third AI
phase, so every spec needing more than one full turn is `test.fixme` against it. That
includes the ten-turn `long-run` spec §5.3 calls the single highest-value spec in the suite.
Refactor Phase 3.1a is the unblock, and the `fixme`s are the checklist.~~ **Closed in Phase 3.**
The ten-turn `long-run` runs clean, and it is what found audit §5.1 **AF**–**AJ**.

~~**Roughly 105 specs across 17 areas.**~~ **281 specs across 15 areas as of Phase 6.** Target
wall clock for the full headless suite at 8 workers: **under 6 minutes**. It does not meet
that at four workers — it runs in eight to fourteen minutes — and the cause is almost always
game initialisation, so measure before parallelising further.

---

## 7. Selector inventory ~~(current state)~~ — superseded

~~Recorded here so the page objects can be written before Refactor Phase 6 renames anything.
Replace with `data-testid` progressively; keep this table as the migration checklist.~~

**This table is history, not the source of truth.** Refactor Phase 6.1 put every element id,
class and selector in [src/ui/core/registry.js](../src/ui/core/registry.js), which both the app
and `tests/support/selectors.js` import — the page objects hold no literal selector at all.
**Never add a selector here or hand-write one in a spec: add it to the registry.**

Two entries below are already out of date, which is the point:

- `xButton` was one id on two elements. Phase 6.8 split it into `xButtonInfoPanel` and
  `xButtonUpgrade`.
- `battleUIRow4Col2A…H` are `battleStatsProdPopIcon` / `Value`, `battleStatsFoodIcon` /
  `Value`, `battleStatsDefenseIcon` / `Value` and `battleStatsMountainIcon` / `Value`.

**No `data-testid` was introduced.** The registry already is the one name the app and the
harness share, and a parallel attribute would be a second thing to keep in step.

**Containers:** `menu-container` · `popup-with-confirm-container` · `top-table-container` ·
`bottom-table-container` · `main-ui-container` · `upgrade-container` · `buy-container` ·
`transfer-attack-window-container` · `battleContainer` · `battleResultsContainer` ·
`ai-dialogue-container` · `attack-destination-containers` · `move-phase-buttons-container` ·
`UIButtonContainer` · `mapModeContainer` · `threeCanvasForDice` · `tooltip`

**Menu & start:** `new-game-btn` · `popup-title` · `popup-body` · `popup-confirm` ·
`popup-color` · `player-color-picker` (an off-screen `<input type="color">` -- the VALUE,
written by the swatch grid) · `colour-picker-panel` · `colour-picker-grid`

**Audio:** `audio-button` · `audio-panel` · `audio-play-pause-btn` · `audio-skip-btn` ·
`audio-track-name` · `audio-music-slider` · `audio-music-mute-btn` · `audio-sfx-slider` ·
`audio-sfx-mute-btn`

**Map:** `svg-map` (object → `contentDocument`) · `svg-coast-lines` · `continentViewButton`
(read its `data-view`: `normal` / `physical` / `continent`) · `UIToggleButton`
Territory paths: `path[uniqueid]`, `path[territory-name]`, `path[data-name]`, `path[owner]`,
`path[underSiege]`, `path[deactivated]`, `path[greyedOut]`, `path[attackableTerritory]`

**Tables:** `top-table` · `bottom-table` · `uiTable` · `buy-table` · `upgrade-table` ·
`transferTable` · `transferTableContainer`

**Phase / move:** `move-phase-button` · `attack-destination-container` ·
`attack-destination-text` · `checkBox-appear-start-of-turn`

**Buy / upgrade:** `bottom-bar-buy-window` · `bottom-bar-buy-confirm-button` ·
`bottom-bar-upgrade-window` · `bottom-bar-confirm-button` · `subtitle-buy-window` ·
`subtitle-upgrade-window` · `prices-buy-info-column0…4` · `prices-info-column0…4` ·
`xButton` · `xButtonBuy` · `xButtonTransferAttack` · `multipleTextBox` · `quantityTextBox` ·
`plusButton` · `minusButton` · `multipleIncrementCycler`

**Battle:** `battleUIRow1…5` · `battleUIRow4Col2A…H` · `battleUITitleFlagCol1/2` ·
`advanceButton` · `retreatButton` · `siegeButton` · `siegeBottomBarButton` ·
`percentageAttack` · `probabilityColumnBox` · `colorBarAttackOverlayGreen` ·
`colorBarAttackUnderlayRed` · `leftBattleImage` · `rightBattleImage` ·
`armyRowRow1Icon1…8` · `armyRowRow2Quantity1…8`

**Battle results:** `battleResultsRow1…4` · `battleResultsRow2Row2Quantity1…8` ·
`battleResultsRow2Row3Kills` · `battleResultsRow2Row3Losses` ·
`battleResultsRow3Row2Captured` · `battleResultsRow3Row2Survived` ·
`battleResultsRow3Row3RoundsCount` · `battleResultsRow3Row3SiegeStats`

**Info table tabs:** `tab-buttons` · `summaryButton` · `territoryButton` · `armyButton` ·
`warsSiegesButton`

**AI dialogue:** `aiDialogueTitleText` · `aiDialogueBodySubHeading` ·
`aiDialogueBodyBottomContentLeftRow1…4` · `aiDialogueBodyBottomContentRightRow1…4` ·
`aiButtonLeft` · `aiButtonRight` · `aiDialogueBoxBottomSummaryRowCol1…8`

**Useful classes:** `.transfer-table-row-hoverable` · `.transfer-table-outer-column` ·
`.ui-table-row-hoverable` · `.ui-table-row-siege` · `.ui-table-row-war` · `.buy-row` ·
`.upgrade-row` · `.tab-button.active` · `.move-phase-button-{red,green,blue,grey,brown}-background` ·
`.selectedRow` · `.sizingIcons`

**Territory name ⇄ uniqueId:** `tests/uniqueIdLookup.json` (already in the repo). Load it in
`tests/support/territories.js` so specs address territories by name.

---

## 8. Conventions

1. **One folder per functional area, `README.md` in each**, with a spec table (`| Spec | Covers |`)
   and an explicit "known gaps / out of scope" note. The runner's `--list-categories` reads the
   folders; the README explains them.
2. **Specs never click raw selectors for setup.** Setup goes through `GameDriver`; only the
   thing under test is driven directly.
3. **Numbers come from `__game`, behaviour from the DOM.** Never assert economy values by
   parsing `"1.2M"` out of a table cell.
4. **One behaviour per test**, titled as a sentence describing the behaviour, not the mechanic:
   *"buying one farm raises food capacity by exactly ten percent"*, not *"farm test"*.
5. **Known-broken behaviour is `test.fixme` with a link to the audit item**, never asserted as
   correct. ~~Phase 3 flips these green~~; a `fixme` that starts passing is a signal, not noise.
   **There are none left as of Phase 6** — the last, `attack-window`'s marker assertion for
   audit §5.2 **AE**, went green in 6.7. A new one is written the moment a defect is found that
   a phase other than the current one owns.
6. **No arbitrary waits.** Wait on `__game.ready`, on state predicates via `page.waitForFunction`,
   or on Playwright's auto-waiting. `--slow` exists for watching, never for stabilising.
7. **Seeds are derived from the test title** so they are stable per test and distinct between
   tests — a spec that only passes at one seed is a spec that is testing the seed.
8. **Every spec must pass at `DWC_WORKERS=1` and at 8.** If it only passes at 1, it shares
   state it should not.
