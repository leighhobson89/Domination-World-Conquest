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

> The first load is slow — game initialisation currently re-parses a 19 MB adjacency file
> once per territory. This is the first thing the refactor fixes
> ([plan Phase 1.1](./docs/03-refactor-plan.md)).

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
| `npm test` | Unit tests (Vitest) — no tests exist yet, lands in refactor Phase 5 |
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
| `resources/` | SVG maps, flags, icons, audio, adjacency data. Served verbatim |
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

## Lint baseline

Phase 0 introduced ESLint against an unlinted codebase. The current baseline is recorded so
that progress is measurable and regressions are visible:

```
226 errors, 405 warnings
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
