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
| 5 | [Combat and Conquest Audit](./05-combat-and-conquest-audit.md) | **The current phase.** Why a 150-turn AI-only game ends with 126 countries alive, the largest empire at 43 of 359, and no conquest at all after turn 50 — the measured arithmetic of a battle, the two attacker taxes, and the fact that the AI decides with a different function from the one that fights |
| 6 | [Combat and Conquest Checklist](./06-combat-and-conquest-checklist.md) | The task breakdown for 5, in stages, each ending with the game playable and each ending with a measurement |

Finished plans live in [archived/](./archived/README.md): the eight-phase refactor plan, the
battle overhaul and its checklist, Goals and Victory and its checklist, Continent Bonuses and
its checklist, and the Economy audit and its checklist. They record why the code is shaped as it is; they do not describe
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

**What was worked on last.** [The Economy](./archived/05-economy-audit.md), delivered in four
stages and archived. Its whole record — the 44.44 gold floor, the AI's upgrades that had never
raised a capacity, the flat term that closed the payback spread from 4.5 orders of magnitude to
3.2, and the four unit types finally being economically different — is in the archive along with
[its checklist](./archived/06-economy-checklist.md), which carries two before/after measurements
rather than one because its defect half and its tuning half moved the world in opposite
directions.

**What is being worked on now.** [Combat and Conquest](./05-combat-and-conquest-audit.md), and it
exists because the economy phase's last stage left one question standing that nobody had measured:
*a spectated AI game never produces a winner.* It does not, and the reason is now measured rather
than guessed. A 150-turn AI-only Continental game on seed `goals` ends with **126 of 207 countries
still alive, the largest empire holding 43 of 359 territories, zero continents held, the nearest
one receding from 64% to 58%, and no conquest at all across three of six samples.** Conquest stops
around turn 50 and never restarts, while the top eight countries' armies go from **44 million men
to 126 million** — India ends with 1.6 million per territory and takes nothing.

Four independent things cause it and only one is a balance number. **A battle is a step function**
— against one median defender the real take probability is 0.0% at 1.5:1 and 94.6% at 3.5:1,
because half a rung of force crosses a band edge and buys an unmatched die. **Two multipliers
scale the attacker down and none scales the defender up**, so a median attacker fights at ×0.63
and must field 1.58× to draw level. **53.5% of the map costs the attacker a die before anybody
builds anything**, from mountains, through bands whose own comment describes forts. And **the AI
decides with a different function from the one that fights** — `winProbability()` knows nothing
about the dice model, and its error against the real thing runs +95 to −77 percentage points and
*changes sign* on fortification, so no constant can tune it out.

The consequence is a funnel measured on one turn: **1,583 pairings weighed → 187 attack verdicts →
48 reach the executor → 5 attacks pressed → 3 conquests.** Forty-three of forty-eight planned
attacks are cancelled at the last step, one of them at 63% for being *"2 points short"* of an aim
that means near-certainty. The world is not short of force. It is saving for an attack priced in a
currency that does not exist.

The new instrument is `node tools/combat-lab.mjs`, which rebuilds the map's defensive geography
from the three files the game seeds from and runs the real rules over it — six sections, twenty
seconds, and it imports every formula it measures rather than copying one.

**Still outstanding after it**, in rough order:

1. **The combat phase itself**, stages 1 to 5 of
   [the checklist](./06-combat-and-conquest-checklist.md). Stages 1 and 2 are defects and are not
   judgement calls; **stage 3 is deliberately blocked on a decision** — whether a battle should be
   a near-certainty or a gamble is a question about how the game feels, and no table answers it.
2. **The other four goals have not been measured since the register sweep.** The audit was written
   on CONTINENTAL alone. Four 150-turn runs, about twelve minutes.
3. **The over-extension counterweight.** A cost for scattered land, paired with the bonus for
   consolidated land. The Dominapedia's Design Notes calls it "the one design tension worth
   naming": there is no pressure against growth, so the optimal play is always to expand. It is
   worth revisiting only once the world consolidates at all — today nothing over-extends.
4. **`ui.js` and `resourceCalculations.js`** are still over four thousand lines each, so the
   refactor's "no file over 400 lines" is not met. Finishing them was Phase 6.9.
5. **Turn 1 still grants no income to anybody**, and the reason it did has gone. Removing the
   guard is a balance change with two `turn-counter.spec.js` specs pinned to it
   ([Known Issues](./04-known-issues.md)).

Three items that stood here for a long time are done and are noted because the list was stale:
the **victory and defeat screen** is built (`GameOver.js` subscribes to `GAME_OVER`, names the
goal, the outcome and the final standings, and offers a quiet third exit onto the final map);
**a besieged territory earns a quarter of its income** rather than nothing, and cannot build;
and **`generateDistinctRGBs()` is deleted and measured** — the four exact-outcome specs its
comment predicted would move did not need re-baselining, but the warning it carried is now a
gotcha in `CLAUDE.md`: anything that adds or removes a `Math.random` draw during bootstrap moves
every seeded outcome in the game.
