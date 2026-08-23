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
`scripts/run-tests.cjs` wrapper, `--headed` / `--slow` / `--category` / `--list-categories`,
timestamped run folders with a rolling history, and a markdown summary per run. The
differences are the two the brief calls for: **8 workers headless** (theCave uses 4 for
stability — see §3.5) and **`--slow` defaults to 500 ms**.

---

## 2. Prerequisites — do these before writing a single spec

These are not optional. Without them the suite is either impossible or permanently flaky.

### 2.1 Fast initialisation (Refactor Phase 1.1–1.2) 🔴 blocking

Cold start currently re-parses a 19 MB JSON once per territory. Every spec begins with a game
start; at present that is minutes per test. **No e2e work should begin before this is fixed.**

### 2.2 A deterministic RNG hook (Refactor Phase 1.6) 🔴 blocking

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

### 2.3 A test-only state accessor (Refactor Phase 1.6) 🔴 blocking

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
  lastError: () => Error | null,
};
```

Rationale: the numeric truth of this game lives in `mainGameArray`, not in the DOM. Asserting
food capacity by reading a KMB-formatted table cell (`"1.2M"`) tests the formatter, not the
economy. **Assert numbers through `__game`, assert behaviour and visibility through the DOM.**

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
scripts/
  run-tests.cjs          the wrapper described below
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

### 3.3 `scripts/run-tests.cjs` — responsibilities

Consumes three flags itself and forwards everything else to `playwright test` verbatim:

| Flag | Behaviour |
|---|---|
| `--slow` / `--slow=<ms>` | Sets `DWC_SLOWMO`. **Default 500 ms.** Pauses between every Playwright action. |
| `--category <name>` / `--category=<name>` | Resolves `tests/e2e/<name>` and forwards it as a forward-slash path (backslashes break Playwright's positional regex on Windows). Errors with the category list if the name is wrong or the folder has no specs. |
| `--list-categories` | Prints every folder under `tests/e2e/` with its spec count, non-empty first. |

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
  "test:e2e":              "node scripts/run-tests.cjs",
  "test:e2e:category":     "node scripts/run-tests.cjs --category",
  "test:e2e:categories":   "node scripts/run-tests.cjs --list-categories",
  "test:e2e:headed":       "node scripts/run-tests.cjs --headed",
  "test:e2e:slow":         "node scripts/run-tests.cjs --headed --slow",
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
node scripts/run-tests.cjs --slow=1000 --category battle
node scripts/run-tests.cjs --headed --slow tests/e2e/attack/multi-territory.spec.js:42
DWC_WORKERS=4 npm run test:e2e                # back off if the box struggles
```

### 3.5 A note on 8 workers

The brief specifies up to 8. `theCave` deliberately caps at 4 because 8 destabilised that
suite on this machine (browser targets crashing, workers exiting with heap-corruption codes).
This game is heavier per-page than `theCave` — a large SVG, a multi-MB adjacency map and a
200-country AI turn. **Ship the default at 8 as specified, but if failures appear that do not
reproduce at `DWC_WORKERS=1`, suspect worker pressure before suspecting the assertion**, and
lower the default with a comment explaining why.

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

### 3.7 Test-data seeding

Several areas (battle outcomes, siege ticks, starvation, economy over many turns) are
impractical to reach by clicking. Add, behind `?e2e=1` only, a **scenario loader**:

```
?e2e=1&scenario=besieged-fort
```

Scenarios live in `tests/support/scenarios/*.json` and are applied via `mutations.js` after
initialisation — set a territory's owner, army, resources, forts, or open a siege. This keeps
specs short and makes edge cases (defender with only naval units, territory at 0 food,
5 forts) reachable in one line. **This is a Refactor Phase 4 deliverable** — it needs the
single state layer to be safe.

Until then, the P0/P1 areas that can be reached by clicking are covered first (§5).

---

## 4. What is tested where

**E2E owns:** flows, phase transitions, UI state machines, what is visible/enabled, what a
click does, and end-to-end numeric outcomes at a coarse grain.

**Unit tests (Vitest) own:** the arithmetic — income formulas, capacity regeneration,
starvation, probability, skirmish resolution, siege damage, AI threat scoring. These land in
Refactor Phase 5 when `rules/` becomes importable, and they are where fine-grained numeric
coverage belongs.

Do not duplicate. If an assertion is about a formula, it is a unit test.

---

## 5. Functional areas

Priority: **P0** must exist before any refactor begins · **P1** before Phase 3 defect fixes ·
**P2** before Phase 4–6 · **P3** as features land.

| # | Folder | Priority | Depends on |
|---|---|---|---|
| 1 | `bootstrap/` | P0 | §2.1 |
| 2 | `country-selection/` | P0 | §2.1 |
| 3 | `turn-loop/` | P0 | §2.3 |
| 4 | `map-interaction/` | P0 | — |
| 5 | `resources-economy/` | P1 | §2.2, §2.3 |
| 6 | `buy-military/` | P1 | §2.3 |
| 7 | `upgrade-territory/` | P1 | §2.3 |
| 8 | `transfer/` | P1 | §2.3 |
| 9 | `attack/` | P1 | §2.2, §2.3 |
| 10 | `battle/` | P1 | §2.2, §2.3 |
| 11 | `siege/` | P2 | §2.2, §3.7 |
| 12 | `ai-turn/` | P2 | §2.2, §3.7 |
| 13 | `info-panels/` | P2 | §2.3 |
| 14 | `random-events/` | P2 | §2.2, §3.7 |
| 15 | `conquest-lifecycle/` | P2 | §3.7 |
| 16 | `persistence/` | P3 | Refactor 7.3 |
| 17 | `victory-conditions/` | P3 | Refactor 7.1 |

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
| `starvation.spec.js` | A territory driven below its food need loses population at a rate scaled by `(1 − devIndex)`; **marked `fixme` with a link to audit §5.1 F** until the army-starvation branch is fixed |
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
| `capacity-effects.spec.js` | 🔴 **The audit §5.1 A regression test.** Buying exactly one farm raises `foodCapacity` by exactly 10 % of its pre-purchase value — not by `farmsBuilt × 10 %`, and not compounding. Same for forest → cons. mats and oil well → oil. Buying a *fort* must leave all three capacities untouched. Marked `fixme` until Phase 3.1 |
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
| `siege-offer.spec.js` | When probability < 15 % the Siege button is enabled; at or above it is disabled |
| `cancel.spec.js` | Cancel at any stage restores the map colours, clears the attackable flags and returns no units |

---

### 5.10 `battle/` — P1

Requires the seeded RNG (§2.2) — every assertion here is otherwise non-deterministic.

| Spec | Covers |
|---|---|
| `rounds.spec.js` | Advance runs one round of the 5; losses appear on both sides; the round counter and probability bar update; totals only ever decrease |
| `attacker-wins.spec.js` | Defenders reduced to 0 → territory changes owner, survivors garrison it, the path repaints to the player colour, and the results screen offers "Accept Victory!" |
| `defender-wins.spec.js` | Attackers reduced to 0 → ownership unchanged, results offer "Accept Defeat!", the source territories do **not** get their units back |
| `rout.spec.js` | Defender combined force < 5 % of its **starting** force → territory captured **and half the surviving defenders join the attacker**. 🔴 Regression test for audit §5.1 E — marked `fixme` until Phase 3.3 |
| `massive-assault.spec.js` | Defender < 15 % → the final-push option appears and costs 20 % of the attacking survivors |
| `attacker-routed.spec.js` | Attacker < 10 % of starting force → attack fails, survivors lost |
| `fight-again.spec.js` | No terminal condition after 5 rounds → another 5 rounds begin with the attacker 5 % smaller (desertion) |
| `retreat.spec.js` | Retreating mid-battle returns survivors to their source territories in the sent proportions, via the retrieval array, after the expected delay |
| `mismatched-unit-types.spec.js` | 🔴 An all-infantry attack against an all-naval defender. Documents audit §5.2 K — currently a stalled battle. Marked `fixme` until Phase 3.15 decides the design |
| `results-screen.spec.js` | Kills, losses, captured, survived, rounds and siege stats on the results screen match `__game`; accepting closes it and restores the map |

---

### 5.11 `siege/` — P2

Needs the scenario loader (§3.7) for anything beyond a single tick.

| Spec | Covers |
|---|---|
| `start-siege.spec.js` | Choosing Siege converts the attack into a standing siege: the siege object exists, the marker and dashed stroke appear, and the besieging army leaves its source |
| `siege-tick.spec.js` | One turn advances `turnsInSiege`, applies collateral damage to the defender's `foodCapacity`, and may destroy a building |
| `siege-score.spec.js` | Siege score = `Σ(units × siegeValue)` (naval 10, air 5, assault 3, infantry 0.0001); a naval-heavy siege scores far above an infantry-heavy one of equal headcount |
| `multiple-sieges.spec.js` | 🔴 Two concurrent player sieges: **both** tick every turn. Regression test for audit §5.1 D — marked `fixme` until Phase 3.4 |
| `arrest.spec.js` | A besieging force far weaker than the defences is arrested; the siege ends, the marker clears and the army is lost |
| `defender-starvation.spec.js` | Sustained siege drives the defender's food below need, starves the garrison, and can flip into a rout victory for the besieger |
| `view-siege.spec.js` | `VIEW SIEGE (n)` opens the battle UI in siege mode with the correct turn count, siege score and probability, and offers the assault option |
| `lift-siege.spec.js` | Withdrawing ends the siege, clears the marker and `underSiege` state, and returns the army |
| `ai-siege.spec.js` | An AI siege on a player territory renders with the AI marker variant and ticks against the player each turn |
| `siege-marker-reconciliation.spec.js` | After a siege ends by any route, no orphan marker remains and `underSiege` is false everywhere. This is what `normalizeSiegeState()` currently papers over |

---

### 5.12 `ai-turn/` — P2

| Spec | Covers |
|---|---|
| `ai-turn-completes.spec.js` | The AI phase completes for all countries with no console errors and no territory left holding a non-object value. 🔴 Regression test for audit §5.1 B/C — marked `fixme` until Phase 3.2 |
| `determinism.spec.js` | Two runs with the same seed produce identical world state after 5 turns. This is the guard that makes every other AI test possible |
| `ai-economy.spec.js` | An economy-focused (pacifist) leader's territories gain buildings over 5 turns; an aggressive leader's gain army instead |
| `ai-attack.spec.js` | Given a scenario with a weak player territory adjacent to an aggressive AI, the AI attacks and can take it; the player's territory count drops and the map repaints |
| `ai-gold-offer.spec.js` | When the AI wants to besiege a territory the player is already besieging, the dialogue appears with the leader's flag, name and offer; **accepting** transfers the gold, lifts the player's siege and returns their army; **declining** leaves both unchanged |
| `ai-turn-gains.spec.js` | Each AI country's per-turn resource gains aggregate across **all** its territories. 🔴 Regression test for audit §5.1 G — marked `fixme` until Phase 3.6 |
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

### 5.14 `random-events/` — P2

Needs the seeded RNG and a scenario that forces an event.

| Spec | Covers |
|---|---|
| `event-probability.spec.js` | Probability starts at 0 %, rises 1 % per quiet turn and resets to 0 when an event fires |
| `food-disaster.spec.js` | Affected territories lose half their food; unaffected ones are untouched; population change is suppressed that turn |
| `oil-well-fire.spec.js` | Affected territories lose oil; regeneration resumes next turn |
| `mutiny.spec.js` | Affected territories lose 25 % of their gold |
| `warehouse-fire.spec.js` | 🔴 Should reduce construction materials. Currently does nothing — the handler tests for `"Forest Fire"`, which is never generated. Regression test for audit §5.1 Q, marked `fixme` until Phase 3.14 |

---

### 5.15 `conquest-lifecycle/` — P2

The full arc from taking a territory to using it normally.

| Spec | Covers |
|---|---|
| `ownership-transfer.spec.js` | On conquest: `owner`, `data-name`, colour, top-table totals, Territories tab row and player territory count all update together, and `originalOwner` is preserved |
| `deactivation.spec.js` | The conquered territory is locked for 1–3 turns, shows the dashed red border and the countdown, and cannot transfer or attack |
| `reactivation.spec.js` | 🔴 It reactivates exactly once, and stays active. Regression test for audit §5.2 N/O — marked `fixme` until Phase 3.10 |
| `army-retrieval.spec.js` | Surviving attackers not garrisoning the new territory return to their sources in the sent proportions after the expected number of turns |
| `economy-after-conquest.spec.js` | The conquered territory contributes to player income from the next turn, keeps its buildings and forts, and its resources are added to the player totals |

---

### 5.16 `persistence/` — P3 *(after Refactor 7.3)*

Save on every turn; load restores territories, wars, sieges, turn and phase exactly; export/import round-trips; a corrupt save is rejected with a message rather than a crash.

### 5.17 `victory-conditions/` — P3 *(after Refactor 7.1)*

Total conquest triggers victory; losing the last territory triggers defeat; the configured objective (N territories / a continent / turn limit) is evaluated at the right point in the turn; the end screen offers a new game that actually restarts.

---

## 6. Delivery sequence

| Step | Work | Output |
|---|---|---|
| E0 | Refactor 1.1–1.2 (fast init), 1.6 (`?e2e=1`, seeded RNG) | Prerequisites met |
| E1 | Harness: `playwright.config.js`, `scripts/run-tests.cjs`, fixtures, `GameDriver`, page objects for menu / map / phase bar / bottom table | `npm run test:e2e` runs, 0 specs |
| E2 | `bootstrap/`, `country-selection/` | ~14 specs |
| E3 | `turn-loop/`, `map-interaction/` | ~11 specs · **P0 complete** |
| E4 | `resources-economy/`, `buy-military/`, `upgrade-territory/` | ~17 specs |
| E5 | `transfer/`, `attack/`, `battle/` | ~22 specs · **P1 complete — refactor Phase 3 can start** |
| E6 | Scenario loader (Refactor 3.7) + `siege/`, `ai-turn/`, `conquest-lifecycle/` | ~22 specs |
| E7 | `info-panels/`, `random-events/` | ~12 specs · **P2 complete** |
| E8 | `persistence/`, `victory-conditions/` alongside Refactor Phase 7 | ~8 specs |

**Roughly 105 specs across 17 areas.** Target wall clock for the full headless suite at 8
workers: **under 6 minutes**. If it exceeds that, the cause is almost always game
initialisation — measure before parallelising further.

---

## 7. Selector inventory (current state)

Recorded here so the page objects can be written before Refactor Phase 6 renames anything.
Replace with `data-testid` progressively; keep this table as the migration checklist.

**Containers:** `menu-container` · `popup-with-confirm-container` · `top-table-container` ·
`bottom-table-container` · `main-ui-container` · `upgrade-container` · `buy-container` ·
`transfer-attack-window-container` · `battleContainer` · `battleResultsContainer` ·
`ai-dialogue-container` · `attack-destination-containers` · `move-phase-buttons-container` ·
`UIButtonContainer` · `mapModeContainer` · `threeCanvasForDice` · `tooltip`

**Menu & start:** `new-game-btn` · `toggle-music-btn` · `popup-title` · `popup-body` ·
`popup-confirm` · `popup-color` · `player-color-picker`

**Map:** `svg-map` (object → `contentDocument`) · `svg-coast-lines` · `mapModeButton` ·
`strokeHighlightButton` · `UIToggleButton`
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
   correct. Phase 3 flips these green; a `fixme` that starts passing is a signal, not noise.
6. **No arbitrary waits.** Wait on `__game.ready`, on state predicates via `page.waitForFunction`,
   or on Playwright's auto-waiting. `--slow` exists for watching, never for stabilising.
7. **Seeds are derived from the test title** so they are stable per test and distinct between
   tests — a spec that only passes at one seed is a spec that is testing the seed.
8. **Every spec must pass at `DWC_WORKERS=1` and at 8.** If it only passes at 1, it shares
   state it should not.
