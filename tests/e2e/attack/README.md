# attack

Aiming at an enemy territory and launching an invasion. Everything up to the
moment the battle UI opens; what happens inside it is `../battle/`.

| Spec | Covers |
|---|---|
| `target-selection.spec.js` | A reachable enemy turns the move button red and reads ATTACK, names the target in the banner, and marks it on the map; an unreachable one offers no button; re-selecting an owned territory reverts to TRANSFER |
| `attack-window.spec.js` | The window lists every player territory able to reach the target; CANCEL becomes INVADE! once units are allocated; a probability is shown and moves with the commitment; cancelling returns everything; INVADE! opens the battle |

## Notes

- **🔴 INVADE! does not debit the source territory.** The plan (§5.9) says the
  committed units leave immediately; measured, the source's infantry and army are
  completely unchanged while the battle runs. The battle works on its own copies of
  both armies (audit §3.2 — state in three places at once) and the source is only
  reconciled when the war resolves. The intended behaviour is `test.fixme`; today's
  is characterised beside it. Settle it in Phase 4.7.
- **🔴 The attack marker survives a cancel** by either route — the window's X or
  the move button's CANCEL. It is the marker half of the map-state desync in audit
  §5.3. Phase 6.7 removes the class of bug by making markers a function of state.
- **`__game.wars()` reads `historicWars`, which is only written when a war ENDS.**
  An in-progress battle is not in it, so "who is fighting whom" is asserted through
  the battle UI's own title.
- **No exact outcome is asserted anywhere.** See `../battle/README.md`.

## Out of scope here

- The siege offer (probability under 15 %) and `siege-offer.spec.js` — reaching a
  sub-15 % attack by clicking means finding a hopeless matchup on the live map,
  which is a seed lottery. It wants the scenario loader (e2e plan §3.7).
