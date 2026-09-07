# Outstanding Improvements — what the combat and conquest measurements left

Combat and Conquest is delivered and archived
([audit](./archived/05-combat-and-conquest-audit.md),
[checklist](./archived/06-combat-and-conquest-checklist.md)). It closed four defects and two
design problems and it moved the world a long way. It did not reach its own target band, and it
produced a measurement that says why — which is more useful than reaching it would have been.

**This document is the standing list of what to do next.** It is not a phase plan: nothing here
is sequenced or committed. It is the findings, ranked by what the numbers say they are worth, so
that whoever chooses the next phase chooses it from evidence rather than from memory. Each item
says what was measured, what it points at, and what would settle it.

The live defect register is still [04-known-issues.md](./04-known-issues.md) and it stays the one
to read first. This is the analysis behind the entries that combat left open.

---

## STATUS: the headline finding has been acted on, and it worked

**This document was written when the combat phase closed. The first item on it has since been
fixed, and the world moved further than anything in the combat phase managed.** The section
below is kept as written because the reasoning is what produced the fix; what was done about it
is [06-force-and-succession.md](./06-force-and-succession.md).

| | control | combat phase end | **after** | target |
|---|---|---|---|---|
| countries surviving | 126 | 101 | **52** | 50–80 ✓ |
| largest empire | 43 | 65 | **84** | 90–120 |
| top-16 share | 59% | 62% | **85%** | — |
| conquest, late game | zero at 3 of 6 samples | — | **non-zero at every sample** ✓ | non-zero |
| world army at t150 | 126M | — | **117M** | — |

Two things are worth carrying from it. **The entry-price arithmetic was the cause and the
terrain was not** — exactly as the measurement below says, and the mountain theory was tested
and rejected before any code was written. And **the single largest effect came from leader
SUCCESSION**, which was not on this list at all: with a country's character fixed for the whole
game, a stalemate between two comparable neighbours is symmetric and permanent, because everyone
gets richer together and the ratio between them never moves.

What is still open from this document: the cliff (still a cliff), mountains (deliberately not
touched), the over-extension counterweight, C5, the vacuous-spec sweep, and the instrument debt.

---

## The one finding that reframes everything else

**The binding constraint is no longer odds. It is how much force a border can raise.**

Combat stages 1 and 2 were about the AI deciding with the wrong number. That is fixed and the
proof is the funnel, re-measured on the same seed and the same turn as the control:

| | control | after stages 1–4 |
|---|---|---|
| pairings weighed | 1,583 | 1,560 |
| attack verdicts | 187 | **382** |
| siege verdicts | not reported | **91** |
| `needs-more-force` cancellations | 17 | **0** |
| conquests that turn | 3 | **8** |
| sieges laid / won, retained window | 1 standing, none won | **15 laid, 15 won** |

Every odds constant now means what it says and none of them is filtering anything out. So the
executor was traced on one turn to see what it says instead, and the answer is the same sentence
over and over:

> *"the most this territory can spare reaches only **0%** against Bulgaria, under the 48% this
> leader will fight on"*

**56 of 61 sampled executor decisions.** Not "the odds are too long" — *nothing this border can
send reaches the floor at all*. That is a fact about two armies and a mountain. No figure in
`balance.js` can reach it, and it is the reason the world stalls at 98–120 countries against a
target of 50–80.

**It points away from combat entirely**, at three things:

- **`src/ai/muster.js`** — a front-line territory asks the interior for infantry and gets it one
  hop, one turn later. It is the only cross-turn adaptation the AI has. Whether it moves *enough*,
  *fast enough*, and *from far enough back* has never been measured. A country whose interior is
  three hops from its border cannot reinforce that border at all today.
- **`src/ai/theatre.js`** — a country commits to absorbing one neighbour. If the committed front is
  one where no border can spare anything, the commitment is spent on a wall that is never marked as
  a wall, because the wall test is about ground taken and not about force available.
- **The economy.** Force comes from productive population and gold, and buildings are bought
  territory-locally — construction materials are never pooled at all. A country with one rich
  interior province and four poor borders cannot convert the first into force at the last.

**What would settle it:** count the executor's own verdict distribution in `tools/ai-sim.mjs` the
way `--diagnose` already does for `rateTarget()`. The trace above is one turn's console output
through a bounded buffer; a counted distribution over 150 turns would say whether "0% disposable"
is a few countries always or every country sometimes, and those are different problems with
different fixes.

---

## The cliff is still a cliff, and that is not what stage 3 bought

Stage 3 is on the record as addressing **G1** (the step function) and **G2** (the attacker taxes).
Measured honestly against the table that shipped, it bought G2 and very little of G1:

| | control | **shipped (2..6 dice)** | reverted (3..7 dice) |
|---|---|---|---|
| 10%-to-90% span | 1.92× | **1.94×** | 2.51× |
| biggest single jump | 45 pts | **40 pts** | 34 pts |
| battle length | 4–6 rounds | **4–6 rounds** | 4–7 rounds |

**The step moved rather than flattened.** What genuinely changed is *where* it sits: the median
attacker fights at ×1.00 instead of ×0.63, so the ratio that clears the step is one a real border
can reach. That is worth having, and it is not what G1 asked for.

Three levers remain, in descending order of how much is known about them:

1. **The wide 3..7 table.** Built, measured, shipped, reverted. It reaches the target band —
   80–107 countries, largest empire 53–70, **a continent held in all five goals** — and it makes a
   battle longer to watch. **Leigh has chosen to keep the narrow table** and to judge the trade by
   playing rather than by table, so this is settled unless playing changes it. Worth knowing: the
   wall-clock objection that got it reverted rested partly on e2e budgets that were themselves
   wrong and have since been corrected, so the case against it is weaker than the revert looks.
2. **Make an unmatched die a contested roll rather than an automatic hit.** This is the true cause
   of the step and it is held in reserve deliberately — the battle overhaul measured the world
   without the automatic hit once already, and a 2:1 attacker took a fortress 100% of the time. It
   touches `resolvePairings()` and would need the fortification model re-checked in the same change.
3. **Raise the base count further.** Capped by the dice STAGE, not by the model: every die from
   both sides lands on one tray, `MAX_ROLL_MS` is 2,200 ms, and more dice settle more slowly.
   `tests/e2e/battle/dice-stage.spec.js` is the check, and a widening should not be attempted
   without it.

**Do not attempt this by re-cutting band edges.** The gap between the two sides' counts is
`f(share) − f(1 − share)`, so it grows by two every band-width: re-cutting moves where the gap
appears and cannot make one extra die matter less. Only the base count helps. This was measured
three times, and it is the single most likely thing for a future reader to try again.

---

## The army still accumulates, and nothing pushes back against growth

**G7**, and the register calls it the likeliest remaining cause of the shortfall. The control ran
the top eight countries' armies from 44M to 126M while conquests fell to zero; stage 1 alone
halved that at turn 25. `tools/ai-sim.mjs` prints world army at every sample now, so it is
watchable rather than inferred — but whether the AI spends *enough* is open, and an empire that
stops at 65 territories while solvent is either short of force or short of reasons.

Underneath it sits the design item the Dominapedia's own Design Notes calls *"the one design
tension worth naming"*: **there is no pressure against growth**, so the optimal play is always to
expand. A cost for scattered land, paired against the existing bonus for consolidated land, is the
counterweight. It has been deferred for a long time on the correct grounds that nothing
over-extends — but the world consolidates now, in every goal, which is exactly the precondition
that was missing. **This is the first phase in which the counterweight would have something to act
on.**

---

## Known-issue BO: a continent falls, and Continental asks for three

The control completed no continent in any of the five goals, with the nearest *receding* from 64%
to 58%. The shipped table completes one in three goals of five; the wide table completed one in
all five. Continental victory needs three.

BO has now moved six times and **has never once been a defect in the continent rule itself**. It
is a proxy for whether the world consolidates, and it closes when **G6** does. Do not chase it
directly.

---

## C5 — the player is dealt random starting forts

`addRandomFortsToAllNonPlayerTerritories()` skips the player by testing `playerOwnedTerritories`,
an array of paths filled by `getPlayerTerritories()` — which does not run until the first turn's
resource pass, *after* `worldSetup?.()` has already dealt the forts. The array is empty at the
moment it is read, so the name of the function is false.

Found by `tests/e2e/upgrade-territory/costs-and-caps.spec.js`, which quoted a first fort at 2,226
gold instead of 248 — `price(3)`, because Germany had two.

**Deliberately left open, and it wants its own measurement rather than a fix in passing.** Giving
the player zero starting forts changes their opening defensive position, and because it removes
about one `Math.random` draw per player territory during bootstrap it **moves every seeded outcome
in the game**. Whatever phase takes it should expect to re-baseline the exact-outcome specs and to
re-run the five-goal table afterwards.

---

## A class of defect worth one deliberate sweep: the spec that asserts nothing

Three instances were found during this phase, none of them by reading:

1. **The siege gate spec** compared the attack window's bar against a threshold the gate no longer
   read. Its sibling was passing by luck.
2. **`attack/attack-window.spec.js`** had two tests reading the *battle UI's* probability element
   while the attack window was open. That element is empty there, so the text was `""`,
   `Number("")` was `0`, and both assertions — "is it finite and within 0..100" and "did it not go
   down" — are true of a constant zero. They had been green for as long as they had existed.
3. **The same trap caught their replacement.** A new spec asserting that the bar and the gate agree
   passed *before* the fix that made it true, because with a single infantryman committed both
   quantities are zero.

**The shape is always the same: an assertion whose failure mode is also its default.** A test that
reads an empty element, a probability at zero, an empty list, or any value it never wrote will
pass whatever the code does. The cheap defence is a guard assertion — *this number must not be
zero, or nothing below is being tested* — and the new spec carries one.

Worth a deliberate pass over the suite for `expect(x).toBeGreaterThanOrEqual(0)`, `toBeTruthy()`
on a parsed number, and any comparison between two values that are both defaults in the failure
case.

---

## Instrument debt

- **`tools/ai-sim.mjs`'s `conqLog` / `laid` / `sgWon` columns are a WINDOW, not a total.** They are
  derived from `window.__game.activity()`, which is a bounded ring, so the figures rise and then
  *fall* as early turns are evicted — measured on one 150-turn run the conquest figure read 288 at
  turn 25, 455 at turn 50 and **134 at turn 150**. The columns are named so a row cannot be read as
  a total and the limitation is written at the site. **A true cumulative count needs `--every=1` or
  a counter kept by the game rather than derived from the feed.** Worth doing; not done.
- **Relative links in `docs/archived/` are broken, and it is the same defect this phase's archive
  move nearly reproduced.** Files archived in earlier phases kept links written from `docs/`, so
  their `../ui.js` now resolves to `docs/ui.js` and their `./04-known-issues.md` to
  `docs/archived/04-known-issues.md`. About forty links across six files. Combat and Conquest's
  own two were corrected as it was moved; the rest were left alone as out of scope. **Whatever
  archives the next plan should fix the whole directory once**, and it is a mechanical change —
  a code link gains one `../`, a sibling-document link loses one.
- **`tools/combat-lab.mjs` prints no span figure.** The cliff's 10%-to-90% span is the number the
  stage 3 gate is *stated in*, and it has been computed by hand in a scratch script every time —
  which is how the checklist came to carry a stale one (2.05×, the reverted table's figure) for the
  life of the phase. It should be a section in the lab, for the same reason the lab imports every
  rule it measures.

---

## Two e2e spec races, both in the harness

Written down rather than left as folklore. Neither is a game defect.

- `tests/e2e/battle/defender-playback.spec.js:201` clicks a Skip button the playback has already
  removed.
- `known-broken:59` (two concurrent sieges) still runs on `tests/support/game.js`'s own 120s
  `waitForFunction` rather than the spec's own budget.

The `battle/` area went 9 failures → 5 → 2 across three re-runs with the failing *set* changing
every time. That is load-sensitivity, not a fault.

---

## Older items this phase did not touch

Carried forward so the list is complete.

- **Turn 1 still grants no income to anybody.** `newTurnResources()` skips the income pass on turn
  1. The guard existed only to hide a world with no leaders and no forts in it, and that world no
  longer exists — both are created inside `initialiseGame()` now. Removing it grants every
  territory an extra turn of income, which is a balance change, and two `turn-counter.spec.js`
  specs are pinned to it.
- **`ui.js` is 4,579 lines and `resourceCalculations.js` 3,418**, so the refactor's "no behavioural
  module over 400 lines" is not met. Phase 6.9 owns them.
- **75 `console.log` calls remain in the turn and battle hot path**, mostly in
  `aiCalculations.js`. They come out with the files rather than in a sweep of their own.

---

## What must survive whatever is done next

Restated from the archived audit's §7, because it is the list a future change is most likely to
break by accident.

1. **One combat model. The player and the AI fight the same battle.** Never a second resolver.
2. **Bands, not a curve.**
3. **Ties go to the defender** — that is the defender's advantage in place of a multiplier.
4. **Fortification is a dice change, not a face bonus.**
5. **Two attack dials, permanently.** `DICE_ATTACK_ADVANTAGE` (1.54) owns open battle,
   `ATTACK_ADVANTAGE` (1.44) owns sieges, and neither reaches into the other's model. **Never a
   third.**
6. **`areaBonusFor()` stays byte-for-byte as it is** (known-issue AR, closed as a decision).
7. **The rules run in Node** with an injected rng and no UI imports.
8. **The siege budget subtracts the sieges already running.**
9. **An AI attack costs the attacker its army.**
10. **The player's grace period stays**, and stays out of the battle model.

And one added by this phase: **`takeProbability()` is not an approximation and must never become
one.** It memoises the real `battleForecast()`. The moment it becomes an estimate, the AI is back
to deciding with a different function from the one that fights — the defect that cost the most to
find.
