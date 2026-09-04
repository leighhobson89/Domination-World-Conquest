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

## What survived them

The parts of these documents that still constrain new work were lifted into `CLAUDE.md` as
gotchas, which is where to look first — the two attack dials being permanent, the face-offset
search direction, the tray and spawn geometry, the derived battle bar, and the rule that the
player and the AI must fight the same battle.
