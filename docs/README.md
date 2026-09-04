# Documentation — Domination: World Conquest

Planning and reference documents. **These are breathing documents** — they are edited as work
lands, and they describe the code as it is today. Finished plans move to
[archived/](./archived/README.md) rather than being left in the sequence to go stale.

The audit (1) was written against commit `b7ae0af` and is the analysis behind the register;
the register (4) is the one to check first if you only read one.

| # | Document | What it answers |
|---|---|---|
| 1 | [Codebase Audit](./01-codebase-audit.md) | What is here, how it is put together, and everything that is wrong with it — every catalogued defect with file and line references, and the analysis behind each one |
| 2 | [Game Design Document](./02-game-design-document.md) | What the game actually is, mechanic by mechanic, with every feature marked implemented / buggy / partial / missing |
| 3 | [E2E Test Plan](./03-e2e-test-plan.md) | The functional areas and the Playwright harness that runs them — 397 specs, plus 767 unit tests, and **no `test.fixme` left** |
| 4 | [Known Issues](./04-known-issues.md) | The live register — every defect found so far, its status, where it is in the code today, and the phase that closes it |
| 5 | [Goals and Victory](./05-goals-and-victory.md) | **Current work.** What winning means, the five goals a player chooses between, how the AI pursues each one, and the end-game trigger |
| 6 | [Goals and Victory Checklist](./06-goals-and-victory-checklist.md) | The task breakdown for 5, in four quarters, each ending with the game playable |

Finished plans live in [archived/](./archived/README.md): the eight-phase refactor plan, and the
battle overhaul and its checklist. They record why the code is shaped as it is; they do not
describe outstanding work.

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
`src/engine/`), the timers are gone, and the SVG renders the model rather than being it.
Phase 6 decomposed the UI into nineteen modules under `src/ui/`, and the map now renders
purely from state — but **`ui.js` still exists at 4,290 lines** and `resourceCalculations.js`
at 4,057, so Phase 6's "no file over 400 lines" is not met. A **Phase 6.9** finishing those two
is the honest next step; see [Refactor §2](./archived/03-refactor-plan.md).

**The three things that were blocking all progress** — all three are fixed:

1. **Cold start parses a 19 MB JSON once per territory** — about 6.8 GB of redundant parsing
   before the first turn. Nothing can be iterated on or tested until this is fixed.
   ([Audit §4.1](./01-codebase-audit.md), [Refactor 1.1](./archived/03-refactor-plan.md))
2. **Circular imports resolved by racing timers** — behaviour differs between machines and
   silently disables the island adjacency rules.
   ([Audit §3.1](./01-codebase-audit.md), [Refactor 1.7](./archived/03-refactor-plan.md))
3. **No single source of truth for territory state** — every feature had to sync three copies,
   and each sync was a place to get it wrong. Closed by Phase 4: `mainGameArray` is gone.
   ([Audit §3.2](./01-codebase-audit.md), [Refactor Phase 4](./archived/03-refactor-plan.md))

**The three defects most likely behind "it doesn't play very well"** — all three fixed in
Phase 3; see [Known Issues](./04-known-issues.md) for the live status of everything:

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

**Phases 0–6 are complete**, with the caveat above about Phase 6's exit criteria. The game loads in under a second, survives a 20-turn playthrough
with no console errors and no `NaN` anywhere, every critical and high-severity defect in the
register is closed, there is one territory state, and every game rule runs in Node.

Phase 5.8 closed the last item that was holding the test suite back: **cosmetic randomness used
to share the game's RNG stream**, so seeding could not make two runs agree and no spec anywhere
was allowed to assert an exact combat or economy outcome (audit §5.3 Y). It has its own stream
now. That single change let five whole functional areas be written — `siege/`, `ai-turn/`,
`conquest-lifecycle/`, `info-panels/`, `random-events/` — and writing them found seven further
defects, including a battle debiting its source territory **twice** and an empty battle-results
screen appearing at the start of almost every turn ([Known Issues §8](./04-known-issues.md)).

**There is no 🔴 left in the register.** Phase 6.7 closed the last one — audit §5.2 AE, the
attack marker surviving a cancel — by making the marker and the target it draws one fact, and
with it went the last `test.fixme` in the suite. Phase 6 also deleted the colour snapshot the
map had been restored from at ~30 call sites, so map colour is now derived from the store, and
removed the accumulating click listener on the move button that `eventHandlerExecuted` and four
`setTimeout(…, 200)` calls had been suppressing ([Known Issues §9](./04-known-issues.md)).

**What is outstanding is now one list**, at the top of
[Known Issues](./04-known-issues.md#currently-open) — one line per open issue, deleted when it
closes. Everything on it is Phase 7 or Phase 6.9.

What Phase 3 started — sieges, famine, AI conquest actually running — surfaced two *design*
problems that are now the most player-visible things left: the AI besieges far more than it can
finish, and a besieged territory earns nothing indefinitely. Both are Phase 7 work
([Known Issues §6](./04-known-issues.md)), and Phase 5.8 added a third to the same list: giving
the AI a fully-formed first turn eliminates a single-territory player within ten turns, which
is why the bootstrap-ordering fix was measured, reverted and re-sequenced there.

**What is being worked on now.** [Goals and Victory](./05-goals-and-victory.md) — the largest
open question the game has, and the one entry on the Dominapedia's own list of faults that is
not a balance question. The game does not end; nothing checks whether the player has conquered
the world or been wiped off it. Half of the answer already exists, because the AI needed
something to play for, so what this phase adds is the screen on which a player chooses between
five goals, the AI actually *pursuing* that choice rather than merely being aware of it, and
the moment the game stops and says who won. The breakdown is in
[the checklist](./06-goals-and-victory-checklist.md).

**Still outstanding after it**, in rough order:

1. **Continent bonuses**, the mid-game goal layer. It interacts with Continental Supremacy —
   neither blocks the other, but they should be balanced together.
2. **`ui.js` and `resourceCalculations.js`** are still over four thousand lines each, so the
   refactor's "no file over 400 lines" is not met. Finishing them was Phase 6.9.
3. **The two design problems Phase 3 surfaced** — the AI besieges far more than it can finish,
   and a besieged territory earns nothing indefinitely
   ([Known Issues §6](./04-known-issues.md)).

One measurement is still owed and should be taken before anything touches map colour:
`generateDistinctRGBs()` in `src/ui/map/colouring.js` is dead code held in place only by the
`Math.random` draws it makes on the game's stream. Deleting it moves four exact-outcome specs,
so it and the re-baseline are one change.
