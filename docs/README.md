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
| 3 | [E2E Test Plan](./03-e2e-test-plan.md) | The functional areas and the Playwright harness that runs them — ~475 specs, plus 980 unit tests, and **no `test.fixme` left** |
| 4 | [Known Issues](./04-known-issues.md) | The live register — every defect found so far, its status, where it is in the code today, and the phase that closes it |
| 5 | [What Is Missing](./05-what-is-missing.md) | **What to do next, and why — the standing list.** Not "does the simulation behave?" (it does) but "does a person experience a game?" Fifteen verified findings grouped under four diagnoses — the board carries no state, the world has no characters, nothing acknowledges what the player does, and there is no arc — then seven easy wins that need no acceptance run, three medium items, and five larger ones drawn from the genre. **A finished item is cut out of it entirely** and moves to [archived/05-what-is-missing-delivered.md](./archived/05-what-is-missing-delivered.md), so the document always reads as outstanding work and nothing else |

Finished plans live in [archived/](./archived/README.md): the eight-phase refactor plan, the
battle overhaul and its checklist, Goals and Victory and its checklist, Continent Bonuses and its
checklist, the Economy audit and its checklist, Combat and Conquest and its checklist, and now
Outstanding Improvements and Force and Succession — the two documents that between them carried
the simulation to the point where the remaining question stopped being a numerical one.
They record why the code is shaped as it is; they do not describe outstanding work. **The numbers
are reused when a plan is archived**, so `05` is the standing list of what to do next and `06` is
free for whichever item is taken up as the next phase. **There is no phase in flight.**

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

**What was worked on last.** [The Economy](./archived/05-economy-audit.md), delivered in four
stages and archived. Its whole record — the 44.44 gold floor, the AI's upgrades that had never
raised a capacity, the flat term that closed the payback spread from 4.5 orders of magnitude to
3.2, and the four unit types finally being economically different — is in the archive along with
[its checklist](./archived/06-economy-checklist.md), which carries two before/after measurements
rather than one because its defect half and its tuning half moved the world in opposite
directions.

**What was worked on last.** [Combat and Conquest](./archived/05-combat-and-conquest-audit.md),
delivered in five stages and archived. It existed because the economy phase left one question
standing that nobody had measured: *a spectated AI game never produces a winner.* It did not, and
the reason turned out to be four independent things of which only one was a balance number — a
battle that is a **step function** on force ratio; **two multipliers scaling the attacker down and
none scaling the defender up**, so a median attacker fought at ×0.63; **53.5% of the map costing
the attacker a die** before anybody built anything; and **the AI deciding with a different function
from the one that fights**, with an error of +95 to −77 points that changed sign on fortification.

All four defects are closed and the world fights again:

| | control | delivered |
|---|---|---|
| countries surviving | 104–126 | **98–120** |
| largest empire | 36–52 of 359 | **47–66** |
| continents held outright | **0 in every goal** | **1 in three goals of five** |
| conquest, late game | zero at three of six samples | non-zero throughout |
| AI calibration error | +95 to −77 points | **2.2 points** |

What each stage did, in a line. **Stage 1** gave the AI `takeProbability()`, which plays the real
dice model and memoises it. **Stage 2** re-denominated every odds constant into the new currency
and mostly did not have to change them — `decisiveOdds` of 65 had meant a raw 3.91:1 and a 94%
chance, and now means 65%. **Stage 3** rebased the attacker's multipliers so the median attacker
fights at parity, and widened the dice range so a one-die gap is one in five rather than one in
four. **Stage 4** found sieges were being laid all over the map and destroyed within two turns,
because *"cannot match the defences"* and *"is being destroyed"* were the same state. **Stage 5**
measured the whole game and re-measured the funnel.

**It did not reach its own target band** — 50–80 countries, largest empire 90–120 — and the
closing measurement says why, which is the most useful thing it produced. Every odds constant now
means what it says and none of them filters anything: `needs-more-force` cancellations went 17 →
**0** and attack verdicts 187 → **382** on the same seed and turn. What the executor says instead
is *"the most this territory can spare reaches only 0%"*, in **56 of 61** sampled decisions. That
is a fact about how much force a border can raise, not about any figure in `balance.js`. **The
binding constraint has moved off combat entirely**, onto `muster.js`, `theatre.js` and the economy.

**Four findings from it are worth carrying**, because each was a plausible plan that measurement
overturned. Stage 2 was going to RAISE the odds floors; stage 1's measurement showed that would
have suppressed the few attacks left. Stage 4 was going to reprice infantry's siege value; that
broke a protected invariant and the arithmetic caps the fix well short of useful. **`battle-lab.mjs`
had been measuring an attacker that cannot exist** — devIndex 1, when the best country on the map
is 0.95 — which is how "raising `DICE_ATTACK_ADVANTAGE` gives the attacker 88% of even fights"
became a recorded reason never to raise it. And the phase's own lesson caught the phase itself:
**a dice table was shipped, measured, reverted — and three documents plus two source comments went
on describing it as though it had shipped**, including the register's own G1 entry. A revert is a
documentation change as much as a code change.

**What that phase left was [05-outstanding-improvements.md](./archived/05-outstanding-improvements.md)**,
now archived along with the phase that answered its headline item. What it named: the force-at-the-border
finding above, the cliff that is still a cliff, the missing over-extension counterweight now that
the world finally consolidates enough for one to matter, known-issue C5, and a class of test defect
worth one deliberate sweep — the assertion whose failure mode is also its default, of which this
phase found three.

Three items that stood here for a long time are done and are noted because the list was stale:
the **victory and defeat screen** is built (`GameOver.js` subscribes to `GAME_OVER`, names the
goal, the outcome and the final standings, and offers a quiet third exit onto the final map);
**a besieged territory earns a quarter of its income** rather than nothing, and cannot build;
and **`generateDistinctRGBs()` is deleted and measured** — the four exact-outcome specs its
comment predicted would move did not need re-baselining, but the warning it carried is now a
gotcha in `CLAUDE.md`: anything that adds or removes a `Math.random` draw during bootstrap moves
every seeded outcome in the game.
