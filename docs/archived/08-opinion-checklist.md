# Opinion — checklist

The build order for [08-opinion.md](./08-opinion.md). Each stage ends with the game playable,
and the order is chosen so that the mechanism is proved before anything reads it: stage 1 is a
store with no readers, stage 2 fills it, stage 3 lets the AI act on it, stage 4 shows it.

Mark a box only when the code is in the working tree and the named test passes.

---

## Stage 1 — the store and the rules

- [x] **1.1** `opinionDiscipline` in [`src/config/balance.js`](../../src/config/balance.js): the
      range, the resting values per state, the settle rate, the event table, and the five
      weights the readers use. One block, so a change of temperament is a balance edit.
- [x] **1.2** [`src/ai/opinion.js`](../../src/ai/opinion.js) — pure, imports `config/` and
      `state/diplomacy.js` (which imports nothing) and nothing else, so it runs in Node.
      `opinionOf()`, `adjustOpinion()`, `applyOpinionEvent()`, `restingFor()`,
      `settleOpinions()`, `describeOpinion()`, `clearOpinionsFor()`, and the
      capture/restore/reset trio.
- [x] **1.3** It rides the `aiStrategy` save slice, so the snapshot version does not move and
      a save taken before opinion existed restores an empty map — which is correct, because an
      empty map is every pair at its resting point.
- [x] **1.4** `tests/unit/ai-opinion.spec.js`: directionality, the clamp at ±100, decay
      toward the state's resting point from both sides, an absent pair reading as its resting
      point, and capture/restore round-tripping.

## Stage 2 — filling it

- [x] **2.1** [`src/ai/opinionRecorder.js`](../../src/ai/opinionRecorder.js), mirroring
      `activityRecorder.js`: `installOpinionRecorder({ traitsFor })` subscribing to
      `ACTIVITY_LOGGED`, `DIPLOMACY_CHANGED` and `TURN_CHANGED`, returning its own
      uninstaller. **THREE DOORS AND NOT FOUR** — the fighting comes off the activity entry
      rather than off the raw `TERRITORY_CHANGED` / `SIEGE_CHANGED`, because
      `activityRecorder.js` already owns the hard part of reading those (which changes are
      conquests, and which are the bootstrap or a restore) and a second copy of that rule is
      a rule that has already been got wrong once.
- [x] **2.2** The two floods are guarded: first contact (`via: "contact"`, and the
      NO_CONTACT → NEUTRAL transition independently) records nothing, and the conquest hook
      stays a single map write.
- [x] **2.3** `reconquista` scales the conquest event, read at the moment the territory
      changes hands.
- [x] **2.4** The failed-attack event, off the `ATTACK_FAILED` entry that
      `recordFailedAttack()`'s three call sites all produce, so a defeat is felt by both sides
      and no fourth attack route can miss it.
- [x] **2.5** The per-turn settle walks the register's rows — exactly the pairs that have met
      — and moves both directions toward their resting point.
- [x] **2.6** Wired from `gameTurnsLoop.js` beside `installActivityRecorder()` (which is
      where that call actually lives), and reset by New Game in `ui.js`.
- [x] **2.7** `tests/unit/ai-opinion-recorder.spec.js`: a conquest, a declaration, a treaty, a
      refused call-in, a betrayal, and the two floods recording nothing.

## Stage 3 — the AI reads it

- [x] **3.1** `proposalOutcomeFor()` takes `opinion` and scores it as a seventh term, with a
      clause in `reasonFrom()` on both sides of the argument.
- [x] **3.2** `allianceScoreFor()` and `callInOutcomeFor()` take it, weighted heavier.
- [x] **3.3** `planAgreementOffer()` prefers the least-disliked candidate among the wars it
      values least — a tie-break, not a gate.
- [x] **3.4** `answerProposal()` in `aiCalculations.js` gathers it, so the player's offer and
      an AI's offer are answered by the same number.
- [x] **3.5** `rankRivals()` takes an INJECTED `opinionOf` and scores the `grudge` term;
      `planCampaign()` supplies it. `theatre.js` still runs in Node.
- [x] **3.6** Unit coverage in `tests/unit/ai-diplomacy.spec.js` and
      `tests/unit/ai-theatre.spec.js` for both directions of each.

## Stage 4 — the player sees it

- [x] **4.1** [`src/ui/diplomacy/opinionBar.js`](../../src/ui/diplomacy/opinionBar.js) — pure:
      a value becomes a word, a tone, and the geometry of a bar drawn from a centre zero.
      Unit-tested in Node, because no e2e spec asserts prose.
- [x] **4.2** Two rows in the territory tooltip on any territory that is not the player's own:
      how they see you, how you see them.
- [x] **4.3** The stylesheet, using the tones the relation rows already carry — no new colour
      literal, and therefore no new token in six themes.
- [x] **4.4** One more fact in the diplomacy panel's detail column.
- [x] **4.5** The diplomacy panel is wider, so the detail column's sentences stop wrapping
      every few words (Leigh, playing).
- [x] **4.6** `tests/unit/ui-opinion-bar.spec.js` and three cases in
      `tests/unit/ui-diplomacy-panel.spec.js`, plus two specs in
      `tests/e2e/diplomacy/tooltip.spec.js` — the e2e ones exist for the half a unit test
      cannot see, that the GEOMETRY reaches the element as an inline style. A bar that
      computes correctly and is drawn at zero width is a passing unit suite and an invisible
      control.

## Stage 5 — documents and measurement

- [x] **5.1** [08-opinion.md](./08-opinion.md) written as the design of record.
- [x] **5.2** `docs/README.md` gains row 8; `CLAUDE.md` gains the note; the acceptance
      document's §7 is marked as delivered rather than proposed.
- [x] **5.3** **`docs/archived/06-diplomacy.md` §7 IS UNCHANGED, AND THE ACCEPTANCE DOCUMENT WAS
      WRONG ABOUT IT.** Its §7.6 says *"Q8 and Q9 are where this lands"*; they are not. Q8 is
      whether an alliance changes the victory condition and Q9 is whether the player's
      neighbours should start at war — neither is about opinion, and both stay open. The claim
      is corrected in `05-diplomatic-acceptance.md` rather than quietly dropped, because a
      document that says a question was answered is worse than one that says it is open.
      What the mechanic DOES answer is §7.6's own four questions, and those answers are
      §1.1 to §1.5 of [08-opinion.md](./08-opinion.md).
- [ ] **5.4** The five-goal 150-turn `ai-sim` table. **NOT RUN** — it is over an hour with the
      machine saturated, and it is Leigh's to schedule. `node tools/ai-sim.mjs --turns=150
      --seed=goals --every=25 --goal=KIND` for CONQUEST, CONTINENTAL, DOMINATION,
      GREAT_POWERS and TURN_LIMIT. Watch pairs at war (the ratchet), agreements standing, and
      the largest empire (the theatre term is what can move that one).
- [x] **5.5** The `diplomacy/` e2e area: **27 passed**, including the two new opinion-bar
      specs. Also verified in a browser — the two bars draw on a foreign territory's tooltip
      and the panel's detail column no longer wraps every few words.
