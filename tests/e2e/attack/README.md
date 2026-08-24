# attack

Aiming at an enemy territory and launching an invasion. Everything up to the
moment the battle UI opens; what happens inside it is `../battle/`.

| Spec | Covers |
|---|---|
| `target-selection.spec.js` | A reachable enemy turns the move button red and reads ATTACK, names the target in the banner, and marks it on the map; an unreachable one offers no button; re-selecting an owned territory reverts to TRANSFER |
| `attack-window.spec.js` | The window lists every player territory able to reach the target; CANCEL becomes INVADE! once units are allocated; a probability is shown and moves with the commitment; cancelling returns everything; INVADE! opens the battle |

## Notes

- **INVADE! debits the source territory immediately** (Phase 4.7, audit §5.1 AD), and a
  no-penalty retreat returns the army through `retrievalArray` a turn later. Phase 5.8 found
  the other half of that fix missing: the ORIGINAL debit, in the advance button's `Begin War!`
  branch, had never been removed, so a fresh battle charged its sources **twice** and a player
  committing a whole garrison was left holding a negative army.
  `battle/outcomes.spec.js` pins it at once.
- **🔴 The attack marker survives a cancel** by either route — the window's X or
  the move button's CANCEL. It is the marker half of the map-state desync in audit
  §5.3. Phase 6.7 removes the class of bug by making markers a function of state.
- **`__game.wars()` reads `historicWars`, which is only written when a war ENDS.**
  An in-progress battle is not in it, so "who is fighting whom" is asserted through
  the battle UI's own title.
- **Exact outcomes ARE assertable now** — audit §5.3 Y is closed. See `../battle/README.md`.

## Out of scope here

- The siege offer — delivered next door in `../siege/start-siege.spec.js`, because the button
  lives in the battle UI rather than in the attack window. Note that the e2e plan states the
  rule backwards: the Siege button is enabled **at or above** the 15 % threshold, not below it,
  and the AI's rule in `ai/goals.js` agrees with the code.
