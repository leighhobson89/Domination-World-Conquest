# transfer

Moving units between two territories the same player owns, in the Military phase.

| Spec | Covers |
|---|---|
| `valid-destinations.spec.js` | Selecting an owned territory highlights exactly its reachable set; TRANSFER is greyed for a player who owns one territory; nothing is offered in Buy/Upgrade |
| `execute-transfer.spec.js` | The window lists reachable destinations labelled coastal/landlocked, a row must be selected before its steppers respond, the button becomes CONFIRM once a quantity is non-zero, and confirming conserves the total and leaves the units usable the same turn |

## Notes

- **Japan is the smallest world where a transfer is possible.** Germany
  owns one territory, so its TRANSFER button is correctly dead — that case is a
  spec of its own, not a limitation.
- **The row click handler is on the NAME column**, not the row
  (`.transfer-table-outer-column:first-child`), so clicking a row anywhere else
  does nothing. `TransferAttackPage.select()` knows this. Phase 6.5 moves the
  handler onto the row.
- **Attack mode of the same renderer needs no row selection** — every listed
  territory can commit units at once. Only transfer mode has a `.selectedRow`.
- **Island adjacency** is covered next door in `../adjacency/`, which is the
  regression test for the hand-curated exception table (audit §3.1).

## Out of scope here

- `deactivated-source.spec.js` from the plan — a territory is only deactivated
  after a conquest, and conquest is not reliably reachable by clicking. It moves to
  `conquest-lifecycle/` with the scenario loader (e2e plan §3.7).
