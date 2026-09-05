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
| 3 | [E2E Test Plan](./03-e2e-test-plan.md) | The functional areas and the Playwright harness that runs them — ~420 specs, plus 884 unit tests, and **no `test.fixme` left** |
| 4 | [Known Issues](./04-known-issues.md) | The live register — every defect found so far, its status, where it is in the code today, and the phase that closes it |
| 5 | [Economy Audit](./05-economy-audit.md) | **Current work.** What the economy is, what of it reaches the military and the dice, the measured numbers, and the defects and design gaps in each |
| 6 | [Economy Checklist](./06-economy-checklist.md) | The task breakdown for 5, in stages, each ending with the game playable |

Finished plans live in [archived/](./archived/README.md): the eight-phase refactor plan, the
battle overhaul and its checklist, Goals and Victory and its checklist, and Continent Bonuses
and its checklist. They record why the code is shaped as it is; they do not describe
outstanding work. **The numbers are reused when a plan is archived**, so `05` and `06` are
always the current phase.

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

**The game can now be finished.** [Goals and Victory](./archived/05-goals-and-victory.md) is
delivered and archived: a player chooses one of five goals before their country on a screen that
cannot be skipped, every one of the 206 AI countries plays for the same condition and adapts how
it fights to suit it, the player's progress is on the phase bar, and the game is decided at the
end of every turn — before the counter moves, and announced exactly once. Elimination runs
underneath every goal. What is left of that item is the victory/defeat **screen**: `GAME_OVER`
carries the outcome, the winner, the reason and the turn, and its only subscriber today is a
`console.log`.

**What is being worked on now.** [The Economy](./05-economy-audit.md). Continent Bonuses is
delivered and archived, and the question it left behind is the one underneath it: does the
economy give a player any reason to spend gold on anything but an army? The audit says mostly
not, and it says so with numbers. **Every territory on the map earns 44.44 gold a turn for
existing**, which is 65% of what a median territory earns in total — so on most of the 359
territories, nothing the player does moves the income at all. The same farm pays for itself in
under one turn in China and in 13,202 turns in Vatican City, at the same price, because the
price is a function of the development index alone and the benefit is a function of population
and area. And **the AI's economy upgrades have never worked**: `farmsBuilt` is incremented and
the gold is taken, but no capacity is ever raised and no fort ever changes a defence bonus, so
all 206 computer countries have been paying a quadratic price ladder for nothing. That last one
is a defect and is measured first, on its own, because it changes what every AI country can
afford and nothing else in the phase can be measured over the top of it.

The six design questions the audit raised are answered and recorded in its §7. The one that
shaped the plan most: **being large must stay good.** The obvious fix for an upgrade that pays
back in one turn in China and 13,202 in Vatican City is to price it against the territory's own
income — and that was turned down, because conquering a big rich territory is supposed to be
visibly better than conquering a small one. The lever moves to the benefit side instead: small
territories get a nudge so that developing them is a real but hard decision, and the large are
not taxed to pay for it.

**Still outstanding after it**, in rough order:

1. **The victory and defeat screen.** The game decides itself correctly; it just tells the
   console rather than the player. One new subscriber to `GAME_OVER`.
2. **The over-extension counterweight.** A cost for scattered land, paired with the bonus for
   consolidated land. The Dominapedia's Design Notes calls it "the one design tension worth
   naming": there is no pressure against growth, so the optimal play is always to expand.
3. **`ui.js` and `resourceCalculations.js`** are still over four thousand lines each, so the
   refactor's "no file over 400 lines" is not met. Finishing them was Phase 6.9.
4. **The two design problems Phase 3 surfaced** — the AI besieges far more than it can finish,
   and a besieged territory earns nothing indefinitely
   ([Known Issues §6](./04-known-issues.md)).

One measurement is still owed and should be taken before anything touches map colour:
`generateDistinctRGBs()` in `src/ui/map/colouring.js` is dead code held in place only by the
`Math.random` draws it makes on the game's stream. Deleting it moves four exact-outcome specs,
so it and the re-baseline are one change.
