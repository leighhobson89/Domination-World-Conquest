# Documentation — Domination: World Conquest

Planning and reference documents. The audit and the E2E plan were written against commit
`b7ae0af`; the register (5) is kept current. Read them in order — each builds on the one before,
and 5 is the one to check first if you only read one.

| # | Document | What it answers |
|---|---|---|
| 1 | [Codebase Audit](./01-codebase-audit.md) | What is here, how it is put together, and everything that is wrong with it — every catalogued defect with file and line references, and the analysis behind each one |
| 2 | [Game Design Document](./02-game-design-document.md) | What the game actually is, mechanic by mechanic, with every feature marked implemented / buggy / partial / missing |
| 3 | [Refactor Plan](./03-refactor-plan.md) | Target architecture and an eight-phase sequence to get there without ever breaking the build |
| 4 | [E2E Test Plan](./04-e2e-test-plan.md) | 17 functional areas and the Playwright harness that runs them. P0, P1 and P2 are delivered: **275 specs in 49 files**, plus 294 unit tests |
| 5 | [Known Issues](./05-known-issues.md) | The live register — every defect found so far, its status, where it is in the code today, and the phase that closes it |

---

## The short version

**The game.** A single-player turn-based world-conquest strategy game on a 359-territory SVG
world map, with a four-resource per-territory economy, four unit types gated by oil supply,
open battle and siege warfare, and 206 AI countries each with a randomly generated leader
personality. It runs entirely in the browser; there is no server logic and no multiplayer,
despite the repository name.

**The state of the code.** It began as a prototype that grew without an architecture: source
files at the repo root, ~18,000 lines, circular imports worked around with 1-second `setTimeout`
hacks, a 2,300-line `DOMContentLoaded` block building the entire UI, and territory state
duplicated across three representations reconciled by hand. Phases 0–5 have dealt with all of
that except the last item on the list. There is **one** territory state
(`src/state/GameState.js`), every game rule runs in Node (`src/rules/`, `src/ai/`,
`src/engine/`), the timers are gone, and the SVG renders the model rather than being it. What
is left is `ui.js`, which Phase 6 decomposes.

**The three things that were blocking all progress** — all three are fixed:

1. **Cold start parses a 19 MB JSON once per territory** — about 6.8 GB of redundant parsing
   before the first turn. Nothing can be iterated on or tested until this is fixed.
   ([Audit §4.1](./01-codebase-audit.md), [Refactor 1.1](./03-refactor-plan.md))
2. **Circular imports resolved by racing timers** — behaviour differs between machines and
   silently disables the island adjacency rules.
   ([Audit §3.1](./01-codebase-audit.md), [Refactor 1.7](./03-refactor-plan.md))
3. **No single source of truth for territory state** — every feature had to sync three copies,
   and each sync was a place to get it wrong. Closed by Phase 4: `mainGameArray` is gone.
   ([Audit §3.2](./01-codebase-audit.md), [Refactor Phase 4](./03-refactor-plan.md))

**The three defects most likely behind "it doesn't play very well"** — all three fixed in
Phase 3; see [Known Issues](./05-known-issues.md) for the live status of everything:

- Territory upgrade capacity bonuses **compounded catastrophically** — a 5th farm applied +50 %,
  not +10 %, on top of an already-inflated figure ([Audit §5.1 A](./01-codebase-audit.md)).
- Battle rout thresholds compared the defender's remaining force against **the attacker's**
  starting force, so battles resolved at the wrong moments
  ([Audit §5.1 E](./01-codebase-audit.md)).
- The AI wrote the literal string `"no match"` into the game state when a goal's territory
  lookup failed, poisoning every later calculation with `NaN`
  ([Audit §5.1 B/C](./01-codebase-audit.md)).

**The plan.** Eight phases, roughly 4–6 focused weeks. Phases 0–3 (~1.5 weeks) make the game
fast, correct and testable — that is where nearly all of the felt improvement lands. Phases
4–6 make it extensible. Phase 7 adds what the game is missing to actually be a game:
win conditions, save/load, restart, and a way for the player to see what the AI did.

**Phases 0–5 are complete.** The game loads in under a second, survives a 20-turn playthrough
with no console errors and no `NaN` anywhere, every critical and high-severity defect in the
register is closed, there is one territory state, and every game rule runs in Node.

Phase 5.8 closed the last item that was holding the test suite back: **cosmetic randomness used
to share the game's RNG stream**, so seeding could not make two runs agree and no spec anywhere
was allowed to assert an exact combat or economy outcome (audit §5.3 Y). It has its own stream
now. That single change let five whole functional areas be written — `siege/`, `ai-turn/`,
`conquest-lifecycle/`, `info-panels/`, `random-events/` — and writing them found seven further
defects, including a battle debiting its source territory **twice** and an empty battle-results
screen appearing at the start of almost every turn ([Known Issues §8](./05-known-issues.md)).

**One defect is open in the whole register**: audit §5.2 AE, the attack marker surviving a
cancel, which Phase 6.7 removes structurally. It is also the only `test.fixme` left in the
suite.

What Phase 3 started — sieges, famine, AI conquest actually running — surfaced two *design*
problems that are now the most player-visible things left: the AI besieges far more than it can
finish, and a besieged territory earns nothing indefinitely. Both are Phase 7 work
([Known Issues §6](./05-known-issues.md)), and Phase 5.8 added a third to the same list: giving
the AI a fully-formed first turn eliminates a single-territory player within ten turns, which
is why the bootstrap-ordering fix was measured, reverted and re-sequenced there.

**Immediate next three actions** — Phase 6, decomposing the UI
([Refactor §2](./03-refactor-plan.md)):

1. **6.1** — `ui/core/registry.js`: every element id and selector as a named constant, imported
   by both the app and the e2e page objects, so selector drift is a build error rather than a
   flaky test.
2. **6.2** — `ui/core/dom.js`: `el()`, `mount()`, `on()`. The `createElement` plus fifteen
   property assignments pattern occurs 294 times.
3. **6.3** — extract components easiest-first, starting with `Tooltip` — which is also what
   fixes the pointer-events bug the page objects still work around.
