# Archived documents

These are finished. They are kept because they record *why* the code is shaped the way it is —
several of the decisions in them are load-bearing and are referenced from source comments and
from `CLAUDE.md` — but they are no longer edited, and they no longer describe outstanding work.

Nothing here should be treated as current. Where one of these contradicts a document in
[../](../), the numbered document wins.

| Document | What it was | Why it is here |
|---|---|---|
| [03-refactor-plan.md](./03-refactor-plan.md) | The eight-phase plan from prototype to architecture, and the record of what actually landed in each phase | Phases 0–7 are complete. The plan's own "immediate next actions" are spent, and current work is planned in the numbered set instead. |
| [battle_overhaul.md](./battle_overhaul.md) | The design of the dice combat model that replaced the five-round skirmish model | Delivered as B.1–B.10.4. The living description of how combat works is the Dominapedia's War section and the comments in `src/rules/military/battleModel.js`. |
| [battle_overhaul_checklist.md](./battle_overhaul_checklist.md) | The task breakdown for the above | Every item is ticked. |
| [05-goals-and-victory.md](./05-goals-and-victory.md) | The five goals, the doctrine layer that makes an AI country play for the one that was chosen, the forced chooser, and the end-game trigger | Delivered as Q1–Q4. The game ends. The living description is the Dominapedia's "Goals and Victory" page, `docs/02` §6.6, and the gotchas in `CLAUDE.md`. **One thing it planned is deliberately not built: the victory/defeat screen**, which is one new subscriber to `GAME_OVER` and is listed in the register's open items. |
| [06-goals-and-victory-checklist.md](./06-goals-and-victory-checklist.md) | The task breakdown for the above | Every item is ticked, and each records what was measured rather than what was intended. |

## What survived them

The parts of these documents that still constrain new work were lifted into `CLAUDE.md` as
gotchas, which is where to look first — the two attack dials being permanent, the face-offset
search direction, the tray and spawn geometry, the derived battle bar, the rule that the player
and the AI must fight the same battle, and from Goals and Victory: `doctrine.js` being the only
module allowed to switch on a victory condition kind, urgency never reaching the siege budget,
and the ordering trap that makes the five locked countries and the five great powers one list.

One measurement in `05-goals-and-victory.md` §5 is still live rather than historical: the
150-turn table per goal is the **acceptance criterion for any change to `src/ai/`**, and it is
what a continent bonus has to be measured against. It is cited from
[../05-continent-bonuses.md](../05-continent-bonuses.md) §6 for that reason.
