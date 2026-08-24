# ai-turn

What the AI phase does, and that it does the same thing twice.

| Spec | Covers |
|---|---|
| `ai-turn.spec.js` | The phase completes for every country, leaving no non-object and no non-finite value behind; the AI actually moves the world; two runs of the same seed produce the same world; no territory is besieged twice |

## The spec the whole folder was waiting for

The plan calls it `determinism.spec.js` and describes it as "the guard that makes every other
AI test possible". It was impossible until Phase 5.5. Seeding `Math.random` could not make two
runs agree while `addSparklesRegularly()` burned three draws per timer tick on the same stream
the AI drew from — how many cosmetic draws fell between two AI draws depended on wall-clock
timing (audit §5.3 Y). Cosmetic randomness lives on its own stream now
(`src/platform/cosmeticRng.js`), so the same seed replays the same AI turn, and every other
assertion in this folder rests on that.

## Notes

- **The console-error gate is half of "completes for every country".**
  `tests/support/fixtures.js` fails a spec on any `console.error`, and the turn engine reports
  a thrown step through `onError` as exactly that — so a crash inside the AI turn fails this
  spec rather than silently sticking the phase button on `AI MOVING...`, which is how audit
  §5.1 AA presented for months.
- **audit §5.1 B and C** are what "leaving nothing broken behind" pins: a goal whose territory
  was not found left the sentinel *string* `"no match"`, which the write-back wrote into the
  model, and every later arithmetic on that slot came out `NaN`.
- **The AI besieges far more than it can finish**
  ([docs/05-known-issues.md](../../../docs/05-known-issues.md) §6). "The world is not the same
  after a turn" counts new sieges as movement for exactly that reason: a conquest is not
  guaranteed within two turns, but activity is.

## Out of scope here

- `ai-economy.spec.js` and `ai-attack.spec.js` from the plan — both are measurements over
  several turns of a 206-country AI whose consolidation into 8–16 powers is Phase 7.7. Pinning
  "an economy-focused leader gains buildings" today would pin the behaviour of one of 206
  independent actors, which 7.7 removes.
- `ai-gold-offer.spec.js` — the dialogue needs the AI to want a territory the player is already
  besieging, on the same turn. It arrives with `ai/actions/*`, a Phase 6 deliverable.
- `ai-turn-gains.spec.js` — audit §5.1 G is fixed and unit-tested; the aggregation is
  arithmetic, which §4 of the plan puts in Vitest.
