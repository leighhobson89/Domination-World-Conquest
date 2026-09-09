# Known Issues — Domination: World Conquest

**This document holds ONLY what is still open.** Every closed defect, with the analysis behind
it and the record of how it was fixed, is in
[archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md).

An entry moves to the archive **in the same change that closes it** — it is not struck through
and left here, and closures are not batched up for a later tidy-up. That is what keeps this
document able to answer the one question it exists for: *what is wrong with the game right now?*

The analysis behind most of these is [01-codebase-audit.md](./archived/01-codebase-audit.md), written
against commit `b7ae0af`. Where the audit and this document disagree about where something is in
the code today, this document is right.

---

## Defects

Things that are wrong: the code does not do what it is meant to do.

| Id | Issue | Owner |
|---|---|---|
| **C5** | **The player's own territories are given random starting forts.** `addRandomFortsToAllNonPlayerTerritories()` deals 0-3 forts to every territory and skips the player's by testing `playerOwnedTerritories` — an array of PATHS that is filled by `getPlayerTerritories()`, which does not run until the first turn's resource pass, **after** `worldSetup?.()` has already dealt the forts. So the array is empty at the moment it is read and the name of the function is false: the player starts with as many forts as the seeded stream happens to hand them. Found by `tests/e2e/upgrade-territory/costs-and-caps.spec.js`, which quoted a first fort at 2,226 gold instead of 248 — `price(3)`, because Germany had two. **A SECOND spec fails on it**: `upgrade-territory/fort-defence.spec.js` › *"grows quadratically, not linearly, with the number of forts"* asserts `fortsBuilt === 1` after buying one and gets 4, because Germany started with three. Measured 3/3 on the working tree and 2/2 at HEAD with the tree stashed, so it is this and not whatever change is in flight — worth knowing, because it is the kind of failure that gets attributed to the last thing anybody touched. **Not fixed here**: giving the player zero starting forts changes their opening defensive position and, because it removes ~1 `Math.random` draw per player territory during bootstrap, moves every seeded outcome in the game (see the `generateDistinctRGBs()` gotcha in `CLAUDE.md`). It wants its own measurement | unassigned |
| **C6** | **`ui-layout/status-bar-flags.spec.js` › *"fit every theme's face without either bar scrolling"* fails against the BUILD.** It reads the theme catalogue with a dynamic `import("/src/ui/theme/themes.js")`, which is a SOURCE path: `npm run dev` serves it and the preview server does not, so the spec fails with *"Failed to fetch dynamically imported module"* and then again on the `console.error` that produces. Measured 1/1 on the working tree and 1/1 at HEAD with the tree stashed, so it is not whatever change is in flight. The fix is for the spec to reach the catalogue the way the app does — the ids are already in `registry.js` — rather than for the build to start shipping source | unassigned |
| **C7** | **`activity-feed/recording.spec.js` › *"and shows up as a larger row than a distant war"* renders no player row.** It records two conquests into `turn - 1` and expects the panel to draw both, one marked as the player's; the player's row is not in `visibleEntries()`. Measured 1/1 on the working tree and 1/1 at HEAD with the tree stashed. The other eight cases in that file pass, including the one immediately above it that asserts the same entry is recorded with `playerDefending: true` — so the LOG is right and the question is what the panel draws. **DIAGNOSED during the diplomacy phase's stage 6 and not fixed**: the spec predates the news CARDS. `visibleEntries()` counts `.activity-entry` rows inside an open section, and a conquest the player is a party to no longer draws one — `newsCardFor()` returns a card for it, and the compact rows are now only for *everything else in the world*. So the panel is doing exactly what it was changed to do and the assertion is describing the feed as it was before the cards. It is left failing rather than quietly retargeted, because the rule it was written to protect — that the player's own news is made to stand out — is still worth a spec, and rewriting it to assert the CARD is a decision about what that area covers rather than a fix | unassigned |

All four defects the combat audit found — **C1**, **C2**, **C3** and **C4** — were closed in combat stages 1
and 2, and a fifth was found by the e2e suite afterwards. The analysis, the measurements and the record of how each was fixed are
in [05-combat-and-conquest-audit.md](./archived/05-combat-and-conquest-audit.md) §6 and
[06-combat-and-conquest-checklist.md](./archived/06-combat-and-conquest-checklist.md).

Three of them are worth carrying forward as habits rather than as history.

**C1 was a whole class of defect, not one site.** `winProbability()`'s docstring promised "the
attacker's chance of taking the territory" and delivered a ratio of two strengths that knew
nothing about the dice model — error **+95 to −77 points, changing sign on fortification**. The
fix was not to correct the arithmetic but to stop asking that function the question: the AI reads
`takeProbability()` now, which plays the real model. **The shape to watch for is a function whose
name and comment describe a quantity it does not compute**, because every caller then inherits
the claim rather than the behaviour.

**C2 and the two specs that asserted it as correct.** `defenseMultiplierFor()` returned 0 where
its own comment promised 1, and *two* existing unit tests asserted the zero — one of them with a
comment explaining why an undefended territory should give 100% odds. A defect written down
confidently enough becomes a specification. Both specs now assert the documented intent.

**C4 was a right idea in the wrong units.** Recording a `below-floor` cancellation as a defeat is
defensible — `commitment.js` deliberately separates "a fact about this turn" from "a fact about
the two armies". What made it a defect is that the floors were denominated in C1's currency, so
it fired on most borders in the world for arithmetic reasons and charged 12 compounding points
each time.

### Previously closed

**BS — five straits in the south Pacific ran in one direction**, closed by the reachability pass
and archived with its analysis. `manualAdjacencyExceptions.js` listed five of its additions on
one side only — the same typo both ways, `"Fiji 1"` written where `"Fiji 2"` was meant — so Fiji
1 could be attacked from both Vanuatu territories and attack neither back. The geometry
underneath is perfectly symmetric (zero one-way edges across all 359 territories), so every
asymmetry on the map came from those five lines, and a one-way border also makes the territory
on the receiving end under-garrison against the only enemy that can reach it. Two specs now
assert symmetry, in two places, because the hand table and the generator fail differently.

The five that stood here -- **AN**, **BI**, **BJ**, **BR** and the
transfer table's row-selection handler -- were closed together in one sweep, along with a sixth
found underneath **BJ**: every AI attack was free, because `doAttack()` debited the store and the
goal loop then wrote a pre-attack copy back over it. The analysis, the five sites the trap named,
the before/after measurement of the free-attack fix and the two entries that turned out not to be
defects at all are in
[archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md) under *Closed in the
register sweep*.

Two of them are worth carrying forward as habits rather than as history. **BR had never been
true** -- it described a thousandfold player/AI asymmetry that was not in the code and had not
been for three years, and it was closed by reproducing it against the running game rather than by
reading the file. And **BJ's stated cause was wrong**: the entry proposed army maintenance or
casualties charged twice, and a proxy trap over 30 headless turns named five sites, none of them
either.

## Design problems

The code does what it says; what it says does not produce the game it should.

| Id | Issue | Owner |
|---|---|---|
| **BO** | **A continent now falls in every goal measured, but Continental needs THREE and gets one.** The control completed none, in any of the five goals, with the nearest RECEDING from 64% to 58%. After combat stages 1-4: **North America falls to the United States on turn 75 under CONTINENTAL and is held to the end**, DOMINATION completes one by turn 50, and CONQUEST completes one -- the nearest continent reaches 100% in all three. So the mechanic the continent-bonus phase built is reachable again and the item has moved further than at any point in its history, but the goal asks for three. **This item has now moved six times and has never once been a defect in the continent rule itself**; it is a proxy for whether the world consolidates, and it closes when **G6** does. **The reachability pass added the structural half, and corrected this entry's own description of it.** This used to say the largest empire *spreads rather than completing continents*; measured over 150 turns, the North American power does the opposite — it holds North America 47/47 and pushes 18–21 territories into South America, and the country that spreads is a different one. What stopped it at two continents was the map: **Europe and Asia were each reachable from North America through exactly ONE territory** (Greenland ↔ Iceland, and Alaskan Islands 4 ↔ Russia), against eleven crossings into South America — and Greenland and Iceland both carried `mountainDefenseFactor` 5, two of the eleven such territories on the map. So under CONTINENTAL, which asks for three, a North American power could not win from where it started. That is a fact about the MAP and not about `src/ai/`. **Two map changes have since shipped against it** (Leigh's call, [06](./archived/06-force-and-succession.md) §7.6): a SECOND Atlantic door, Greenland ↔ Svalbard — 122.7 SVG units, shorter than the Brazil ↔ Sierra Leone crossing the map already carried — and Greenland and Iceland dropped to `mountainDefenseFactor` **2**, which is the only terrain step that does anything because the dice bands are ≥25 and ≥100 (§7.5: 5, 4 and 3 are all one die). **Neither is a fix for G6 and neither has been measured yet**: they want the five-goal 150-turn table, and the question they were taken to answer is whether a North American power now reaches a second and third continent | combat stage 5 |
| **DP1** | **An alliance gives no PASSAGE and no STACKING, and it cannot until a garrison knows whose it is.** Diplomacy checklist 5.2, blocked rather than skipped. A territory holds ONE garrison — seven figures on the territory object, written by `writeGarrison()` and read by the battle model, the income pass, upkeep, desertion, the muster, the threat array and both status bars — and there is no field for whose an army is. *"Your army may sit in your ally's province"* is a territory holding two armies under two flags, which is a rewrite of every one of those readers rather than a stage. And without stacking, passage has nowhere to put an army: movement is one hop into an adjacent territory, so an army that moves onto allied soil either merges into the ally's garrison (a gift, not passage) or needs the second stack that does not exist. **The deliverable version when it is taken up is REACH and not occupation** — an enemy territory adjacent to an ALLY's becomes attackable from your own nearest province, so an alliance opens fronts you could not otherwise reach and no second army ever exists. It needs its own five-goal run, because it widens what every allied AI can attack. What must NOT be done is widening `getInteractableFrom()`: that function is pure geometry and knows nothing about owners, and teaching it about the register would change first contact, the muster's field, the threat array and the AI's whole target list at once | diplomacy 5.2, blocked |
| — | **Turn 1 still grants no income to anybody, and the reason it did has gone.** `newTurnResources()` skips `calculateTerritoryResourceIncomesEachTurn()` when `currentTurn() === 1`, and that guard existed to hide turn 1 being planned and earned over a world with no CPU leaders and no forts on it. The world is finished before the engine starts now, so the guard is scaffolding for a problem that no longer exists — but removing it grants every territory on the map an extra turn of income, which is a balance change and wants its own measurement. `tests/e2e/turn-loop/turn-counter.spec.js` asserts the current behaviour in two specs ("applies no income on turn 1", "applies income from turn 2 onward"), so whoever takes it re-baselines those in the same change | 7.x balance |
| **G1** | **A battle is a step function — ADDRESSED, and the remaining sharpness is now a stated number rather than an unknown.** Combat stage 3 raised the dice range from 1–5 to **2–6** (base 5 at parity), so a one-die gap is one in five rather than one in four, and rebased the attacker's multipliers so the transition sits at REACHABLE force ratios. Measured on a single median defender, the 10%-to-90% span went **1.92× → 1.94×**, from a 1.26:1 attacker to a 2.45:1 one, with the biggest single jump still **40 points**, at the 0.50 band edge. It is still a step, and it is barely flatter than it was — what moved is WHERE it sits, which is G2's half of the same problem. **A wider 3–7 table was built, measured better (span 2.05×, biggest jump 34) and was REVERTED**: more dice per round means fewer rounds' worth of pairings, and battles took longer to WATCH, which the `battle/` e2e area found by timing out. Going back to it is a live option and it is a judgement about pacing, not about the cliff — see the checklist's stage 5.2 table. **Re-cutting bands cannot flatten it further** — the gap grows by two every band-width, so only a higher BASE count helps, and the dice stage caps that at 13 dice on one tray (7 + 6, against the shipped 6 + 5). The lever held in reserve is making an unmatched die a contested roll rather than an automatic hit, which is the true cause and touches `resolvePairings()` | combat stage 3, remainder open |
| **G2** | **Two multipliers weakened an attack and none strengthened a defence — CLOSED as a rebase.** `devIndex` × `combatContinentModifier` has a median of **0.648** over all 1,888 real adjacent enemy pairings, so every attacker in the world fought at ×0.63 and needed 1.58× just to draw level. `DICE_ATTACK_ADVANTAGE` is **1.54**, which puts the median attacker at exactly ×1.00 while preserving the spread ratio-for-ratio. It is applied at the dial rather than to the two tables because `devIndex` also feeds `defenseBonusFor()`, the upgrade price ladder and the construction-materials ceiling. `areaBonusFor()` is untouched (AR) | closed, combat stage 3 |
| **G6** | **Nothing ever ends — MOVED A LONG WAY, not closed.** Control: 104–126 countries, largest empire 36–52 of 359, **zero continents in any of the five goals**, the nearest RECEDING 64% → 58%, and no conquest at all across three of six samples. After combat stages 1–4: **98–120 countries, largest 47–66, and a continent held outright in three goals of five** (the wider dice table trialled at stage 3 held one in ALL five, at 80–107 countries and a largest of 53–70 — see the checklist's stage 5.2 table for the trade). Conquest is non-zero throughout. Against the target band in audit §9 Q3 — 50–80 countries, largest 90–120 — **the world now consolidates and no single power runs away with it**, but the shipped table does not reach the band. **Combat stage 5 re-measured the §0.3 funnel and found where this now lives, which is the useful half of leaving it open**: the odds constants no longer bind at all — `needs-more-force` cancellations are 17 → **0** and attack verdicts 187 → **382** on the same seed and turn — and the executor instead answers *"the most this territory can spare reaches only 0%"* in **56 of 61** sampled decisions. That is a fact about how much force a border can raise, not about any figure in `balance.js`, so what would move this next is `muster.js`, `theatre.js` and the economy rather than anything in the combat model | open, and no longer a combat item |
| **G7** | **The world accumulates an army it cannot spend — LARGELY DRAINED, and the likeliest remaining cause of G6's shortfall.** Top-eight army ran 44M → 126M across the control while conquests fell to zero; after stage 1 alone it was 22M at t25 against 44M. `tools/ai-sim.mjs` prints world army every sample now, so this is watchable rather than inferred. Whether the AI spends ENOUGH is the open half: an empire that stops at 65 territories while solvent is either short of force or short of reasons, and the missing over-extension counterweight — there is still no pressure against growth — is the other candidate | combat stage 5 / open |

## Missing

**Nothing that is tracked here.** What the game still lacks in order to feel like a game rather
than a working prototype is [04-future-plans.md](./04-future-plans.md), which is a design
document and not a defect register — the two are kept apart because a defect is fixed and a
design gap is chosen. **G7** appears on both, because it is genuinely both.

The last item that stood here was the ending screen, and it is built. `GAME_OVER` has a second subscriber, the panel names the goal, the outcome and the final standings, and it offers New
Game, Main Menu and View Final Map. The analysis is in
[archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md) under *Closed in the
second design pass*.

## Hygiene

Not defects. Sequenced per file, as each moves into `src/` — house rule 6 says a lint warning is
not fixed in passing.

| Issue | Owner |
|---|---|
| **`ui.js` is 4,579 lines and `resourceCalculations.js` 3,418**, so Phase 6's "no behavioural module over 400 lines" is not met. (Both figures were stated as 5,752 and 3,919 here for some time after they stopped being true — measured again, `wc -l`, during the register sweep) | 6.9 Part A / Part B |
| **75 `console.log` calls in the turn and battle hot path** — `aiCalculations.js` 49, `gameTurnsLoop.js` 16, `resourceCalculations.js` 5, `ui.js` 5. `battle.js` is down to zero. They come out with the files rather than in a sweep of their own. (Counted again during the register sweep; this line had said 108 across a different distribution) | per file |
| **Inline `.style.` writes that set a literal colour from JS do not follow the theme**, so a themed page has a handful of elements still painted in the old steel blue. `ui.js` is the bulk of it | 6.9.7 |
| Mixed tabs and spaces, inconsistent brace style, commented-out blocks in the legacy root sources | per file |
| Four names for one structure: the `mainArrayOfTerritoriesAndResources` / `mainArray` parameter names survive in `battle.js` and `transferAndAttack.js` | per file |
| `dataName` / `territoryName` / `originalOwner` are named correctly in the selectors but keep their old names in the model | per file |
| `battle.js` still exports ~25 `let`s of per-battle scratch | per file |
| **The bare `td` rule still sets `font-family: Arial, Helvetica, sans-serif`**, so the info panel's four tabs remain the one part of the UI a theme cannot reach. **The two status BARS are done** — `#top-table td` and `#bottom-table td` read `var(--font-body)` now. The stated reason for keeping Arial was that the bars are a fixed 30px and a monospace face would reflow them, and that turned out to be answerable rather than true: `white-space: nowrap` on cells whose figures are already abbreviated by `formatNumbersToKMB()` settles it, and `tests/e2e/ui-layout/status-bar-flags.spec.js` walks all six themes and fails if either bar can scroll. **The info table is the harder half and is what is left here**: its cells carry territory names and war outcomes rather than abbreviated numbers, so `nowrap` there is a horizontal scroller and not a fix | 7.x |
| **Two named e2e spec races, both in the harness rather than the game** (found by combat stage 5's full run). `tests/e2e/battle/defender-playback.spec.js:201` clicks a Skip button the playback has already removed. `known-broken:59` and `:95` (both on the two-concurrent-sieges scenario) still run on `game.js`'s own 120s `waitForFunction` rather than the spec's budget -- the whole file passes in **18 seconds** at `--workers=1` and times out under four workers, which is the measurement that settles it as load and not behaviour. **CORRECTED: the observation was right and the conclusion covered too much.** This entry said the `battle/` area went 9 failures → 5 → 2 across three re-runs with the failing set changing each time, and concluded the whole thing was load. Run at `--workers=1` the area failed **8 specs deterministically**, in three files, for a reason that has nothing to do with load: `rounds.spec.js`, `known-broken.spec.js` and `mid-battle-decisions.spec.js` each open the attack window with a helper written before the diplomacy gate and never declare war, so the move button never reads ATTACK. Fixed — see **DF4** in the closed archive. Both causes were real and only one of them had been written down, which is why a flaky-looking area is worth one deterministic run before it is filed as flaky | per file |
| Lint baseline: **346 problems (76 errors, 270 warnings)** across the repository. (Counted again with `npx eslint .` during the diplomacy phase's stage 6; the error figure had said 73 for some time after it stopped being true, which matters because the baseline is what a change is judged against) | per file |

---

## Left unverified

| What | Why |
|---|---|
| **`tests/e2e/diplomacy/declaration-notice.spec.js` has not been run since its last fix.** Three specs in it failed on `page.waitForFunction` timing out, and the failure artefact settles the cause beyond reasonable doubt: the page snapshot shows the phase button still offering **END TURN**, so the turn had not completed. The specs called `GameDriver.endTurn()`, which presses the phase button ONCE and then waits for the turn counter — pressed from Buy/Upgrade that only reaches the Military phase, so the counter never moves. `playTurn()` is the complete cycle and is what they call now. **The behaviour itself is verified** — driven in a browser, three countries declared on a one-territory player on turn 7 and each raised a one-button notice, and the turn loop ran fifteen turns without blocking — so what is outstanding is the SPEC and not the feature | include `diplomacy` in the next run |

**A finding worth keeping from the same session, because it cost three false failures.**
`playwright.config.js` sets `reuseExistingServer: !process.env.CI`, so the first e2e run of a
session builds and serves `build/` and **every run after it reuses that server against the build
as it was at the first run**. Three specs — both of `diplomacy/defeated.spec.js` and
`gates.spec.js` — failed in a seven-area run and passed on the next run with nothing changed
except that the previous server had exited. `CLAUDE.md` has carried this as a gotcha for a long
time; what this adds is the symptom, which is a spec failing for a fix that is already in the
tree. **Check `netstat -ano | grep :4173` for a LISTENING socket before trusting any e2e result
taken after an edit.**

## How this register is kept

- **One entry per open issue, and the entry leaves when the issue closes** — moved to
  [archived/04-known-issues-closed.md](./archived/04-known-issues-closed.md) in the same change,
  with its id intact so existing citations still resolve.
- **An id is permanent.** `AN`, `BI`, `BJ`, `BO`, `BP` and the rest keep their letters wherever
  they live, because source comments and `CLAUDE.md` refer to them.
- **An entry is closed by reproducing it, not by reading it.** `BR` described a thousandfold
  player/AI asymmetry in the price of infantry that had not been in the code since 2023, and it
  was believed twice — once here and once in the Dominapedia. `BJ` named a cause that was not
  one of the five real ones. Both cost more to disprove than they would have cost to check when
  they were written.
- **Severity is not tracked any more.** The old scoreboard counted 🔴/🟡/⚪ and every 🔴 is long
  closed; what is left is a short list that can simply be read. The historical scoreboard is in
  the archive.
- **Say where it is in the code TODAY.** The audit is the analysis; this is the current location.
- **A design problem is not a defect.** They are separated above because they are decided
  differently: a defect is fixed, a design problem is measured and chosen.
- **Record what was measured, not what was intended.** Several entries here exist only because a
  measurement contradicted a plausible theory — **BJ** is not caused by **BM**, and that was
  checked rather than assumed.
