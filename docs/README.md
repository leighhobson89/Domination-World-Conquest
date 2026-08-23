# Documentation — Domination: World Conquest

Planning and reference documents for the codebase at commit `b7ae0af`.
Read them in order; each builds on the one before.

| # | Document | What it answers |
|---|---|---|
| 1 | [Codebase Audit](./01-codebase-audit.md) | What is here, how it is put together, and everything that is wrong with it — 20 catalogued defects with file and line references |
| 2 | [Game Design Document](./02-game-design-document.md) | What the game actually is, mechanic by mechanic, with every feature marked implemented / buggy / partial / missing |
| 3 | [Refactor Plan](./03-refactor-plan.md) | Target architecture and an eight-phase sequence to get there without ever breaking the build |
| 4 | [E2E Test Plan](./04-e2e-test-plan.md) | 17 functional areas, ~105 specs, and the Playwright harness that runs them |

---

## The short version

**The game.** A single-player turn-based world-conquest strategy game on a 359-territory SVG
world map, with a four-resource per-territory economy, four unit types gated by oil supply,
open battle and siege warfare, and 206 AI countries each with a randomly generated leader
personality. It runs entirely in the browser; there is no server logic and no multiplayer,
despite the repository name.

**The state of the code.** A prototype that grew without an architecture. 13 source files at
the repo root, ~18,000 lines, fully circular imports worked around with 1-second `setTimeout`
hacks, a 2,300-line `DOMContentLoaded` block that builds the entire UI, and territory state
duplicated across three representations that must be reconciled by hand.

**The three things blocking all progress:**

1. **Cold start parses a 19 MB JSON once per territory** — about 6.8 GB of redundant parsing
   before the first turn. Nothing can be iterated on or tested until this is fixed.
   ([Audit §4.1](./01-codebase-audit.md), [Refactor 1.1](./03-refactor-plan.md))
2. **Circular imports resolved by racing timers** — behaviour differs between machines and
   silently disables the island adjacency rules.
   ([Audit §3.1](./01-codebase-audit.md), [Refactor 1.7](./03-refactor-plan.md))
3. **No single source of truth for territory state** — every feature has to sync three copies,
   and each sync is a place to get it wrong. ([Audit §3.2](./01-codebase-audit.md),
   [Refactor Phase 4](./03-refactor-plan.md))

**The three defects most likely behind "it doesn't play very well":**

- Territory upgrade capacity bonuses **compound catastrophically** — a 5th farm applies +50 %,
  not +10 %, on top of an already-inflated figure ([Audit §5.1 A](./01-codebase-audit.md)).
- Battle rout thresholds compare the defender's remaining force against **the attacker's**
  starting force, so battles resolve at the wrong moments
  ([Audit §5.1 E](./01-codebase-audit.md)).
- The AI writes the literal string `"no match"` into the game state when a goal's territory
  lookup fails, poisoning every later calculation with `NaN`
  ([Audit §5.1 B/C](./01-codebase-audit.md)).

**The plan.** Eight phases, roughly 4–6 focused weeks. Phases 0–3 (~1.5 weeks) make the game
fast, correct and testable — that is where nearly all of the felt improvement lands. Phases
4–6 make it extensible. Phase 7 adds what the game is missing to actually be a game:
win conditions, save/load, restart, and a way for the player to see what the AI did.

**Immediate next three actions** ([Refactor §5](./03-refactor-plan.md)):

1. Load the adjacency data once into a `Map` instead of per territory.
2. Add the `?e2e=1` state hook and seeded RNG.
3. Stand up the Playwright harness and the four P0 test areas.
