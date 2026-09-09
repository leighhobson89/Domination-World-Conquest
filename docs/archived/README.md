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
| [05-economy-audit.md](./05-economy-audit.md) | What the economy is, the five places it reaches the military and the dice, and the split between defects (E1-E7) and design (D1-D8) | Delivered, all four stages, and measured twice - once for the defect half and once for the tuning half. The living description is the Dominapedia and the economy gotchas in `CLAUDE.md`. Its section 5 -- the list of what is RIGHT and had to survive the phase -- still holds. The thing it left open — fixing the defects made the AI pay for its attacks, and the world stopped conquering — became the Combat and Conquest phase below, which is now archived too. |
| [06-economy-checklist.md](./06-economy-checklist.md) | The task breakdown for the above | Every item is ticked. It carries TWO before/after measurements rather than one, because the defect half and the tuning half moved the world in opposite directions and by more than either predicted. |
| [05-combat-and-conquest-audit.md](./05-combat-and-conquest-audit.md) | Why a 150-turn AI-only game ended with 126 countries alive, the largest empire at 43 of 359, zero continents and no conquest after turn 50 — split into defects (C1–C4) and design (G1–G7) | Delivered as stages 1–5, and its four defects are closed. The living description is the combat gotchas in `CLAUDE.md` and the comments in `src/rules/military/`. **Its §7 — the list of what is RIGHT and must survive — still holds and is restated at the end of [05-outstanding-improvements.md](./05-outstanding-improvements.md), which is archived here too.** What it did NOT reach is its own target band, and the reason is measured rather than guessed: the binding constraint moved off combat entirely and onto how much force a border can raise. |
| [06-combat-and-conquest-checklist.md](./06-combat-and-conquest-checklist.md) | The task breakdown for the above | Every item is ticked. Read its closing section before touching combat: **two of the three decisions it records were carried out by a different mechanism from the one they name**, and three documents spent the phase describing a dice table that had been reverted. Its stage 5.2 holds both dice tables side by side, so returning to the wide one is one balance edit rather than a re-derivation. |
| [05-outstanding-improvements.md](./05-outstanding-improvements.md) | The findings the Combat and Conquest phase left, ranked by what the measurements said they were worth — the force-at-the-border finding, the cliff, the missing over-extension counterweight, C5, and the vacuous-spec sweep | Its headline item was acted on and became Force and Succession below, which moved the world further than the whole combat phase had. What it left unclosed is carried forward by [../04-future-plans.md](../04-future-plans.md) §1.4 and §4 — the over-extension counterweight is L-b there — and the register keeps the numerical items. **Its closing section, the restatement of the combat audit's §7 list of what must survive, still holds.** |
| [06-force-and-succession.md](./06-force-and-succession.md) | Why the AI log said *"the most this territory can spare reaches only 0%"*: a country had to field 2.4–3.4x its neighbour's army before it could attack at all, and 85% of countries hold one territory so nothing could route around it | Delivered. Countries surviving 126 → 52, largest empire 43 → 84, conquest non-zero at every sample. **The single largest effect came from leader SUCCESSION, which was not on the list it was working from** — with a character fixed for the whole game a stalemate between comparable neighbours is symmetric and permanent, because everyone gets richer together. Its §7 holds the two map changes (Greenland ↔ Svalbard, and the terrain drop to factor 2) that are still unmeasured. |
| [05-what-is-missing-delivered.md](./05-what-is-missing-delivered.md) | The items from [../04-future-plans.md](../04-future-plans.md) that have been built, each with what was decided along the way and what it deliberately did not do | Like the closed-issues register beside it, this is still WRITTEN TO: an item is moved here in the same change that finishes it, and is **cut out** of the living document rather than marked done or struck through — the living list is meant to read as outstanding work and nothing else. Entries keep their original ids (E3, E4, ...) because the living document, `CLAUDE.md` and the source comments cite them by letter. |
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
