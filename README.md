# Domination: World Conquest

A browser-based, single-player, turn-based world-conquest strategy game played on a
359-territory SVG world map. Manage a four-resource economy across individual territories,
raise four kinds of army gated by oil supply, and take enemy ground by open battle or by
siege — against 206 AI countries, each with a randomly generated leader and personality.

> **Status: pre-refactor.** The game runs and is playable, but the codebase is a prototype
> that grew without an architecture and has a number of known gameplay defects. See
> [docs/](./docs/) before making changes.

---

## Requirements

- **Node.js 20.19+ or 22.12+** (developed on 24.x) — required by Vite 8.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Click **New Game**, wait for the loading pass to finish, pick a country that is not greyed
out, choose a colour, and confirm.

Cold start is roughly **0.6 s** to a clickable **New Game** and another **0.2–0.5 s** to a
playable turn 1. (Before refactor Phase 1 the second half took minutes: initialisation
re-fetched and re-parsed a 19 MB adjacency file once per territory.)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 with HMR |
| `npm run build` | Production build into `build/` |
| `npm run preview` | Serve `build/` on port 4173 |
| `npm run lint` | ESLint over the source (see the baseline below) |
| `npm run lint:fix` | ESLint with `--fix` |
| `npm run format` | Prettier over everything not in `.prettierignore` |
| `npm run format:check` | Prettier in check mode |
| `npm test` | Unit tests, then the e2e suite |
| `npm run test:unit` | Vitest only (69 tests, ~1 s) |
| `npm run test:e2e` | Playwright suite, 4 workers headless |
| `npm run test:e2e:categories` | List the coverage areas under `tests/e2e/` |
| `npm run test:e2e:category -- adjacency` | Run one area |
| `npm run test:e2e:headed` | One visible browser |
| `npm run test:e2e:slow` | One visible browser, 500 ms between actions |
| `npm run test:e2e:perf` | The timing-budget specs, pinned to a single worker |
| `npm run build:data` | Regenerate `resources/adjacency.json` and `resources/pathAreas.json` |
| `npm run build:vendor` | Rebuild the committed `dist/` UMD bundles (three, cannon-es, BufferGeometryUtils). Rarely needed — the output is committed |

## Layout

Source files currently live at the repository root. The target structure is in
[docs/03-refactor-plan.md](./docs/03-refactor-plan.md) §1.

| Path | Contents |
|---|---|
| `index.html` | Entry point; loads the vendor bundles then every game module |
| `ui.js` | DOM construction, event wiring, map rendering, battle/siege UI |
| `resourceCalculations.js` | Territory model, per-turn economy, buy/upgrade UI |
| `aiCalculations.js` | AI threat model, goals, personality, AI actions |
| `battle.js` | Combat probability, skirmishes, war outcomes, siege ticks |
| `transferAndAttack.js` | Transfer/attack allocation tables |
| `gameTurnsLoop.js` | Bootstrap and the turn loop |
| `initialData.js` | 208 country records (population, area, army, HDI, resources) |
| `dices.js` | 3D dice — built, currently disabled |
| `src/data/`, `src/state/`, `src/platform/` | New code, written to the target architecture: adjacency, the manual island rules, precomputed areas, O(1) lookup indexes, the `?e2e=1` test hooks |
| `tools/` | Data generators: `build-adjacency.mjs`, `precompute-areas.mjs` (both support `--check`) |
| `tests/unit/`, `tests/e2e/` | Vitest and Playwright suites |
| `resources/` | SVG maps, flags, icons, audio, and the generated `adjacency.json` / `pathAreas.json`. Served verbatim |
| `dist/` | Committed webpack UMD bundles. **Not** the Vite output |
| `build/` | Vite output (gitignored) |
| `docs/` | Audit, design document, refactor plan, test plan |

### A note on `dist/` vs `build/`

`dist/` holds the hand-built UMD bundles that `index.html` loads as classic scripts to set
`CANNON`, `THREE` and `BufferGeometryUtils` as globals. Vite's output goes to `build/`
instead so it cannot clobber them. `vite.config.mjs` copies `resources/` and `dist/` into
`build/` verbatim, because roughly a hundred asset paths are hand-written strings in the game
code that no bundler rewrites.

## Documentation

| Document | What it answers |
|---|---|
| [Codebase Audit](./docs/01-codebase-audit.md) | Architecture, performance, and 20 catalogued defects with line references |
| [Game Design Document](./docs/02-game-design-document.md) | Every mechanic, marked implemented / buggy / partial / missing |
| [Refactor Plan](./docs/03-refactor-plan.md) | Target architecture and an eight-phase sequence |
| [E2E Test Plan](./docs/04-e2e-test-plan.md) | 17 functional areas, ~105 specs, the Playwright harness |

## Generated data

Two files under `resources/` are generated and committed. Regenerate both with
`npm run build:data`, or check they are current with
`npm run build:adjacency:check` / `npm run build:areas:check`.

| File | Size | From | Guard |
|---|---:|---|---|
| `adjacency.json` | 77 KB | `closestPathsData.json` (19 MB) | The build fails if a neighbour names a territory absent from the SVG |
| `pathAreas.json` | 30 KB | `svgMaster.svg` geometry | The runtime rejects it and recomputes if the SVG's byte size, path count or ids no longer match |

**`resources/svgMaster.svg` is the authoritative source of territory names** — it is what the
running game reads. `tests/uniqueIdLookup.json` is a convenience map that has drifted from it
before; both tools now derive names from the SVG.

## Lint baseline

Phase 0 introduced ESLint against an unlinted codebase. The current baseline is recorded so
that progress is measurable and regressions are visible:

```
225 errors, 401 warnings
```

Dominated by `no-shadow` (78), `no-undef` (69) and `prefer-const` (375). Several of these
are the defects catalogued in the audit — `no-undef` flags the `for (country of ...)` bug at
[battle.js:522](./battle.js#L522), and `no-shadow` flags the loop-index shadowing at
[resourceCalculations.js:565](./resourceCalculations.js#L565). They are fixed in refactor
Phase 3, not before.

Prettier is configured but the legacy root sources are in `.prettierignore` on purpose:
reformatting 18,000 lines in one commit would rewrite every line's blame immediately before a
refactor that depends on blame and bisect. Files come off that list as they move into `src/`.

## Licence

GPL-3.0-or-later.
