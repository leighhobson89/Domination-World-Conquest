# Archived documents

These are finished. They are kept because they record *why* the code is shaped the way it is —
several of the decisions in them are load-bearing and are referenced from source comments and
from `CLAUDE.md` — but they are no longer edited, and they no longer describe outstanding work.

Nothing here should be treated as current. The one file that is still added to is
[04-known-issues-closed.md](./04-known-issues-closed.md), which receives each defect as it
closes; it is a record of finished work like the rest, not a to-do list. Where one of these contradicts a document in
[../](../), the numbered document wins.

| Document | What it was | Why it is here |
|---|---|---|
| [03-refactor-plan.md](./03-refactor-plan.md) | The eight-phase plan from prototype to architecture, and the record of what actually landed in each phase | Phases 0–7 are complete. The plan's own "immediate next actions" are spent, and current work is planned in the numbered set instead. |
| [battle_overhaul.md](./battle_overhaul.md) | The design of the dice combat model that replaced the five-round skirmish model | Delivered as B.1–B.10.4. The living description of how combat works is the Dominapedia's War section and the comments in `src/rules/military/battleModel.js`. |
| [battle_overhaul_checklist.md](./battle_overhaul_checklist.md) | The task breakdown for the above | Every item is ticked. |
| [05-goals-and-victory.md](./05-goals-and-victory.md) | The five goals, the doctrine layer that makes an AI country play for the one that was chosen, the forced chooser, and the end-game trigger | Delivered as Q1–Q4. The game ends. The living description is the Dominapedia's "Goals and Victory" page, `docs/02` §6.6, and the gotchas in `CLAUDE.md`. **One thing it planned is deliberately not built: the victory/defeat screen**, which is one new subscriber to `GAME_OVER` and is listed in the register's open items. |
| [06-goals-and-victory-checklist.md](./06-goals-and-victory-checklist.md) | The task breakdown for the above | Every item is ticked, and each records what was measured rather than what was intended. |
| [05-continent-bonuses.md](./05-continent-bonuses.md) | What holding a whole continent is worth: an economic bonus paid through two dials, derived at the point of use and never written onto a territory | Delivered and measured over 150 headless turns per goal. The living description is the Dominapedia's "Continents" page, `docs/02` §3.6, and the continent-bonus gotcha in `CLAUDE.md`. |
| [06-continent-bonuses-checklist.md](./06-continent-bonuses-checklist.md) | The task breakdown for the above | Every item is ticked. §4b records what had to be BUILT before the phase could be judged — `window.__game.continents()`, `economyFor()`, the nine e2e specs and the `cont`/`best` columns in `tools/ai-sim.mjs` — because the bonus is derived, stored nowhere, and forty turns into a playthrough. |
| [04-known-issues-closed.md](./04-known-issues-closed.md) | Every defect that has been closed, with the analysis that found it and the record of how it was fixed | Split out of the live register, which had grown to ~870 lines of which the great majority described things that no longer existed. **Entries keep their original ids** — source comments and `CLAUDE.md` cite them by letter to explain why a piece of code is shaped oddly. The register's historical scoreboard is here too. Unlike everything else in this directory it is still WRITTEN TO: a closing issue is moved here in the same change that closes it. |

## What survived them

The parts of these documents that still constrain new work were lifted into `CLAUDE.md` as
gotchas, which is where to look first — the two attack dials being permanent, the face-offset
search direction, the tray and spawn geometry, the derived battle bar, the rule that the player
and the AI must fight the same battle, and from Goals and Victory: `doctrine.js` being the only
module allowed to switch on a victory condition kind, urgency never reaching the siege budget,
and the ordering trap that makes the five locked countries and the five great powers one list.

From Continent Bonuses: there is ONE definition of holding a continent and `worldStandings()`
folds through it, the bonus is DERIVED at the point of use and never written onto a territory,
the two dials multiply a FLOW and three CEILINGS respectively and are not a rounding of taste,
and a continent is the ORIGINAL OWNER's continent from `initialData.js` rather than the SVG's
`continent=` attribute.

Two measurements in these documents are still live rather than historical. The 150-turn table
per goal in `05-goals-and-victory.md` §5 is the **acceptance criterion for any change to
`src/ai/`**. And `05-continent-bonuses.md` §6 is the before/after method that criterion is
applied WITH — the control run, the two columns added to `tools/ai-sim.mjs`, and the reason a
continent bonus cannot be judged by playing.
