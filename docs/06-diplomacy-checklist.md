# Diplomacy — Checklist

The task breakdown for [06-diplomacy.md](./06-diplomacy.md). Breathing document: tick items as
they land, and record what was **measured** rather than what was intended.

Eight stages, the last of them a back burner. Work is test-first: write the failing test, watch
it fail, then fix.

**THE STAGE ORDER WAS INVERTED BY LEIGH, DELIBERATELY, AND STAGE 2 DOES NOT END WITH THE GAME
PLAYABLE.** The first draft put declarations before the gates precisely so that the world never
went quiet. Leigh asked for the opposite: *"by the end of stage 2 we should have a situation
where neutral states are actually neutral and are not attacking, then we will reintroduce the
fighting once we have the capability of changing state by communication diplomacy and also
declaring without chatting too."*

So **Stage 2 is the gates and Stage 3 is the declarations**, and at the end of Stage 2 nobody on
the map may attack anybody — the player included. That is the checkpoint, and it is the one
stage of this phase that knowingly suspends the house rule about ending playable. It is worth
the exception because a gate you can watch stop the world is a gate you can trust; the same gate
landing on top of a declaration system proves nothing in particular, since the world would carry
on fighting either way and no measurement could separate *the gates hold* from *the gates leak*.
Every later stage ends playable again.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked or deferred

---

## Stage 0 — the register and the tooltip — **DONE**

No rule reads the register, so the game plays exactly as it did. This is the stage that makes
the state a fact before anything depends on it.

### 0.1 The vocabulary — [src/state/diplomacy.js](../src/state/diplomacy.js)

- [x] Six states: no contact, neutral, war, ceasefire, peace, alliance
- [x] **Imports nothing at all**, the arrangement `phases.js` has — the enum is read by the
      store, the selectors, the mutations, the AI and the UI, so anything it imported would be
      dragged into all five
- [x] `relationKey()` sorts the two names, so one record per unordered pair and the two
      directions cannot disagree. The separator is the ASCII unit separator, written as an
      escape: six territories on this map carry real parentheses in their names, so a
      printable separator is a key collision waiting to happen
- [x] `allowsAttack()` — WAR and nothing else. `allowsDeclaration()` — anything but no contact
      and war itself. `isAgreement()`, `sharesResources()`, `describeState()`
- [x] `FIRST_CONTACT_STATE` is **NEUTRAL**, and it is one line. Asserted in the unit suite so
      that moving it back is a deliberate act rather than a quiet one
- [x] `DEFAULT_DIPLOMATIC_STATE` is NO_CONTACT, and the register is **sparse** — an empty map
      IS "every country at no contact with every other", so the register costs nothing until
      something happens

### 0.2 The store, the reads, the writes

- [x] `store.diplomacy.relations` in [GameState.js](../src/state/GameState.js), cleared **in
      place** on reset rather than replaced
- [x] Selectors: `relationBetween()`, `relationStateBetween()` (never null), `relationsFor()`,
      `allRelations()`, `relationCount()`, and `countriesMayFight()` — the one question every
      gate will ask, so the player's greyed control and the AI's rating cannot diverge
- [x] `setRelationState()` is the only writer. It refuses a state outside the six, refuses to
      return a pair to no contact, and emits nothing on a no-op
- [x] `Events.DIPLOMACY_CHANGED`, carrying the pair in canonical order — a listener interested
      in one country must check both, because a relation names no aggressor
- [x] Save and load. Rows rather than `Map` entries, and **the snapshot version did not move**:
      an old save restores an empty register, which is exactly the pristine starting position

### 0.3 First contact — [contact.js](../src/rules/diplomacy/contact.js) + [diplomacyContacts.js](../src/state/diplomacyContacts.js)

- [x] The pure walk takes its neighbour lookup as an argument, because `src/data/adjacency.js`
      throws in Node
- [x] Contact is the CURRENT owner's (`dataName`), and it is re-derived rather than computed
      once — a conquest is precisely how two countries on opposite sides of the world come to
      share a border
- [x] Coalesced: dirty on `TERRITORY_CHANGED`, walked at most once per turn. A busy turn 1 logs
      fifty-one conquests and the walk is ~1,900 pairings
- [x] It only ever moves a pair OFF no contact. A border that closes up again does not undo a
      relationship

### 0.4 The tooltip — [diplomacyTooltip.js](../src/ui/map/diplomacyTooltip.js)

- [x] Your own territory: everybody you have a relation with, no contact filtered out
- [x] Somebody else's: the state between them and YOU first, **always, even at no contact**
- [x] Spectator mode has no player row, because there is nobody to put first
- [x] War first, then ceasefire, peace, alliance, neutral; alphabetical within a state
- [x] Neutral is drawn muted rather than friendly — a player who could not tell it from peace
      at a glance would think an undeclared neighbour safe
- [x] Capped at six rows plus a count, the way the military view's threat lines are
- [x] The tone is a class, not a colour: `style.css` is the only place allowed to name a
      colour and only as a token
- [x] `tooltipStale` follows `DIPLOMACY_CHANGED` — a declaration changes what the tooltip says
      about a territory without changing anything on it

### 0.5 Verified

- [x] `tests/unit/state-diplomacy.spec.js` — 26 cases, and `tests/unit/ui-diplomacy-tooltip.spec.js` — 17
- [x] Full unit suite green: **1,343 passing**
- [x] ESLint clean on all four new modules and both specs
- [x] **Driven in a real browser**, and it caught the one defect: the tooltip was passing
      `pathOwner()`, which reads `"Player"` on the player's own land, so the player's territory
      took the *somebody else's country* branch and listed the player's own country as a
      foreign power at no contact with itself. The register is keyed by COUNTRY, and the
      country is `dataName`
- [ ] An e2e spec for the tooltip. Deferred to Stage 6 with the rest of the e2e work, because
      the wording is already pinned in Node and no e2e spec in this suite asserts prose

---

## Stage 1 — the control run — **CLOSED, NOT TAKEN**

**Before a single rule changes.** Diplomacy changes who fights whom, which is upstream of every
number in the acceptance table, so there was supposed to be something to compare against.

- [x] **The columns were added and every later run carries them** — pairs at war, agreements
      standing, and countries at war with nobody (`war`, `pacts`, `qui` in `ai-sim`). That was
      the important half: the phase's characteristic failure is *a world too polite to fight*,
      and it is invisible in every column the tool had before, because it looks exactly like a
      peaceful one
- [x] **The five-goal control run itself was NOT taken, and Leigh closed the item.** The gates
      were already in the tree by the time it was wanted, and taking it properly means a second
      checkout on a second port rather than anything the working tree can be asked. What stood
      in for it is the **archived Goals and Victory §5 table**, which is the same five goals at
      the same seed on the tree immediately before this phase — 78–114 countries surviving and
      a largest empire of 51–97 — and every measurement in this document is quoted against it
- [x] `node tools/muster-probe.mjs` baseline: **not needed after all.** It was wanted because
      passage rights were expected to touch the muster, and 5.2 turned out to be blocked on the
      data model — nothing in this phase changed how an army moves

---

## Stage 2 — the gates: neutral becomes genuinely neutral

**The world goes quiet, and that is the deliverable.** Every pair on the map is at neutral,
`allowsAttack()` permits WAR alone, so once the gates read the register nobody may attack
anybody — the AI, and the player. See the header for why this is deliberate rather than
known-issue **BA** repeating itself.

### 2.1 One question, four gates

- [x] Every gate goes through `countriesMayFight()` in `state/selectors.js` and **nothing
      re-derives it**. Two gates that answer the same question separately will eventually
      answer it differently — the rule the dice model established for combat
- [x] `rateTarget()` in [targeting.js](../src/ai/targeting.js) refuses a target whose owner is
      not at war, **with a stated reason**, beside the player's grace period. That is the one
      place in the AI a target is declined with a reason the debug window and the plan log read
- [x] The player's attack destinations exclude a country not at war: no hatched highlight and
      no attack arrow reaches it
- [x] The player's INVADE path refuses as well, so the gate does not depend on the highlight
      having been drawn
- [x] A siege may not be **opened** against a country not at war. A siege already standing is
      untouched, the same narrowness `PLAYER_GRACE_TURNS` has — this refuses the OPENING of an
      interaction, not the continuation of one
- [x] **The greyed button says why on hover**, and the sentence is DERIVED rather than matched
      on the label. The move button's `mouseover` picks its tooltip by testing
      `button.innerHTML` against a chain of fixed strings, which cannot work for a label that
      is now one of five relation names — so the sentence comes out of
      `deriveMoveButtonState()` with the rest of the state and `ui.js` only shows it. Reading
      a label back to decide anything is the defect the battle bar records at length
- [x] The wording states the FACT and promises no control: declaring war is Stage 3, so *"click
      to declare war"* would be a lie today and a stale string tomorrow. Peace, ceasefire,
      alliance and no contact each get their own sentence, and none uses a country name as an
      adjective

### 2.2 The harness has to be able to fight

The e2e suite attacks constantly and every attacking spec routes through one method. Without
this the whole `attack` and `battle` areas would need `test.fixme`, which is the wrong answer
to a temporary state of the world.

- [x] `window.__game.declareWar(a, b)` and `window.__game.relations()` — an accessor exists
      because a spec cannot be written without it, which is the rule every other entry on that
      object follows
- [x] `GameDriver.openAttackWindow()` declares war on the target's owner first. One change in
      the harness rather than a change in every spec
- [x] Scenarios can carry relations, so a spec can set up a peace or an alliance directly.
      They are applied BEFORE the sieges in the same scenario, so "these two made peace while
      a siege was standing" can be described at all — which is **Q1** waiting to be answered

### 2.3 Measured — the world stops

`node tools/ai-sim.mjs --turns=60 --seed=goals --every=20 --goal=CONTINENTAL`

| turn | countries | largest | conquests | failed | sieges | pairs at war | at war with nobody | upgrades | army |
|---|---|---|---|---|---|---|---|---|---|
| 20 | 207 | 31 | 0 | 0 | 0 | 0 | 207 | 1320 | 86M |
| 40 | 207 | 31 | 0 | 0 | 0 | 0 | 207 | 1578 | 111M |
| 60 | 207 | 31 | 0 | 0 | 0 | 0 | 207 | 1788 | 131M |

- [x] **Not one conquest, not one failed attack, not one siege, at any sample.** All 207
      countries survive and the largest empire sits at the 31 territories it started with
- [x] **`qui` is 207 at every sample** — every country in the world at war with nobody, which
      is the column that separates *the gates hold* from *the AI ran out of targets*
- [x] **The economy carries on**, and that matters: 1,320 → 1,788 upgrades, 577 → 586 forts,
      675k → 1,795k gold, 86M → 131M army. The world is at peace, not stopped. A frozen turn
      loop would show these flat too, and it is the only way to tell the two apart from here
- [x] Nearest continent stuck at 66% (North America), which is where the map starts
- [x] The Stage 1 control run, for the other end of the comparison. Not taken: the gates were
      already in the tree by then, and taking it properly means a second checkout on a second
      port rather than anything the working tree can be asked- marked completed by Leigh, later we can do it in another stage

### 2.4 Verified

- [x] Full unit suite green: **1,356 passing** (13 new across three specs)
- [x] `tests/unit/ai-diplomatic-gate.spec.js` — the AI half, including that the refusal is
      asked BEFORE the odds and before the player's grace period, so the reason a target
      vanished is the one somebody can act on
- [x] `tests/unit/ui-move-button.spec.js` — the player's half: greyed and visible rather than
      hidden, no attack target armed, VIEW SIEGE still offered on a besieged territory
- [x] **Driven in a browser.** Selecting Germany then France, Poland, Austria and the Czech
      Republic in the Military phase: the button reads `NEUTRAL` and is dead; after
      `declareWar()` the same selection reads `ATTACK`. No console errors
- [x] The hover text, also confirmed in the browser: *"You are not at war with France. Neither
      side has declared, and until one does, neither may attack the other."*
- [x] **E2E: `attack` 17/17, `map-interaction` 61/61, `turn-loop` 23/23.** The first run of
      those three areas was **86/106**, and all twenty failures were the gate refusing an
      attack the spec had not declared — `turn-loop`, which never attacks, was untouched
- [x] **They were fixed by DECLARING, not by `test.fixme`.** The behaviour each one asserts is
      still reachable; it now needs a war first, exactly as the player does. Deferring them
      would have parked twenty red specs until Stage 3, and a suite with twenty known
      failures in it is a suite nobody reads the output of
- [x] **`GameDriver.openAttackWindow()` was not the one door after all.**
      `attack-window.spec.js` and `target-selection.spec.js` each carry their own local
      helper, and `attack-arrows.spec.js` opens no attack window at all — so the harness
      change reached the `battle` and `conquest-lifecycle` specs and none of these. Three
      spec-side declarations, and `declareWarOnReachable()` for the arrows, which need every
      neighbour at war or they would assert a fan against a world where one arrow is legal
- [x] **The gate's own e2e assertion**, which is new behaviour rather than a repair: with no
      declaration a reachable enemy takes the hatched highlight and gets NO arrow, and the
      arrows appear from the same selection the moment war is declared. The hatch means
      *reachable* and still is; an arrow means *you can attack here*

## Stage 3 — declaration, and the fighting returns — **DONE**

Two ways into a war, and Leigh named both: *"changing state by communication diplomacy and also
declaring without chatting too"*. This stage is the second one — a bare declaration, no
negotiation — and Stage 5 is the first.

### 3.1 `src/ai/diplomacy.js` — new

- [x] Unit tests first, watched to fail on the missing module
      (`tests/unit/ai-diplomacy.spec.js`, 24 cases)
- [x] **The only module in `src/ai/` allowed to decide a diplomatic action**, the containment
      `doctrine.js` has over victory conditions and `standingsGoalColumns.js` has on the UI side
- [x] **A theatre commitment is a declaration of war.** `theatre.js` already commits a country
      to absorbing one neighbour and keeps the commitment until the rival becomes a wall — that
      is the country's own answer to "who is my enemy", already persistent, already derived
- [x] **AND THE THEATRE DECLARATION IS UNCONDITIONAL, WHICH IS THE FREEZE GUARD.** No posture
      refuses it and `concurrentWarCap` does not apply to it, so every country with a reachable
      neighbour has a war. From this stage onwards a RESIDUAL freeze looks exactly like Stage
      2's intended silence — nothing throws, every turn completes, the map quietly stops
      changing — which is known-issue **BA** wearing this phase's clothes. `postureAllowance`
      has precisely the shape that caused BA (it gives DEVELOP and DEFEND nothing, and most of
      this map is small countries), so it governs the OPPORTUNISTIC declarations and nothing
      else. Three of the first four unit cases are that guard, stated as tests
- [x] Opportunistic declarations: a country in a fighting posture, with a leader above
      `opportunistRiskFloor`, may open ONE more war against a neighbour whose shared border is
      visibly weaker than its own (`opportunistWeakness`, 0.62 — comfortably above the 0.5 that
      is parity), bounded by `concurrentWarCap` and by the wars it has already opened this turn
- [x] **Urgency buys one further war.** `doctrine.js` already computes the strongest rival's
      share of the world's land every turn; above `urgencyForExtra` a country gets an extra
      opportunistic declaration. That is the diplomatic form of the runaway-leader response the
      attack budget already had, and the first instalment of Leigh's stated goal for the phase
- [x] **It never declares out of an AGREEMENT.** Breaking a peace, a ceasefire or an alliance
      is the one act this system calls a breach, and Stage 5.6 is what prices it. An AI that
      walked out of a treaty for free would be teaching the player that a treaty is worthless
- [x] Pure, no store reads, and **it draws no randomness at all** — so nothing here moves a
      seeded outcome, and `?seed=` still reproduces a game
- [x] **It exposes no siege dial**, and a unit test asserts no key in `declarationDiscipline`
      matches `/siege/`

### 3.2 The player declares

- [x] Available from the attack control on a territory of a country not at war, and it takes
      effect **at once** — declare and attack the same turn. `MoveMode.DECLARE` is a mode
      rather than a `target`, because `target` names something the caller ARMS on the map and a
      declaration arms nothing
- [x] **It is not the attack colour.** The next click after this one is ATTACK, in the same
      place, and two identical red buttons a click apart is how somebody invades a country they
      meant only to threaten
- [x] The attack control says **why** before it offers the declaration. `diplomaticHint()`
      states the fact and `declarationOffer()` says what the button does; they are two
      sentences and a unit test asserts the fact comes first. Keeping them apart is what let
      the fact survive this stage unedited when the control it deliberately did not promise
      finally arrived
- [x] `mayDeclare` defaults to **false**, the opposite way round from `mayAttack` — a caller
      that has not been taught about declarations behaves as the game did at the Stage 2
      checkpoint, rather than offering a control that leads nowhere

### 3.3 Wiring and measurement

- [x] `applyAiDeclarations()` runs from `planAiCampaign()` in `aiCalculations.js`, which
      `handleAITurn()` calls AFTER the succession — a leader who has just died is never the one
      declaring the war — and BEFORE the goals are planned, so a war declared this turn is
      fought this turn. It is memoised on the campaign, because `planCampaign()` is itself
      memoised per turn and a second call must not declare a second time
- [x] The DECIDING is in `src/ai/diplomacy.js` and the WRITING is in `aiCalculations.js`, the
      same split every other rule in that directory has. `campaign.declarations` and
      `campaign.declarationsSkipped` carry the result for the plan log and the debug panel
- [x] No new save slice: the register is already in the store and `setRelationState()` is
      already snapshotted
- [x] `?seed=` still reproduces a game — nothing added draws from any rng
- [x] **The game is playable again, and this is the stage that says so.**

### 3.4 Measured — the fighting returns

`node tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND`, five goals, at turn 150:

| goal | countries | largest | top 16 | pairs at war | at war with nobody | continents held |
|---|---|---|---|---|---|---|
| CONQUEST | 51 | 79 | 88% | 692 | **0** | 1 — North America (United States) |
| CONTINENTAL | 50 | 71 | 88% | 720 | **0** | 1 — North America (United States) |
| DOMINATION | 49 | 81 | 90% | 703 | **0** | 1 — North America (United States) |
| GREAT_POWERS | 53 | 66 | 84% | 749 | **0** | 1 — North America (Bermuda) |
| TURN_LIMIT | 39 | 101 | 92% | 735 | **0** | 2 — South America, North America (United States) |

- [x] **`qui` is 0 under every goal**, against 207 at every sample of the Stage 2 silence. That
      is the column that separates *the gates hold* from *the declaration rule is too shy*, and
      it is the single number this stage was measured for
- [x] **Five visibly different worlds, and none of them frozen.** A Timed Game consolidates
      hardest (39 countries, an empire of 101) and Great Powers least (53 countries, an empire
      of 66) — the same ordering the archived Goals and Victory table found, so the doctrine
      layer still does what it claims through the new gates
- [x] **A continent is completed under every goal**, which is known-issue **BO** moving for the
      first time since the economy phase: no continent was completed in a 150-turn Continental
      run when that item was opened
- [x] **THE WORLD CONSOLIDATED A GREAT DEAL MORE THAN IT DID — CLOSED BY 5.1, AND NOTHING WAS
      TUNED TO CLOSE IT.** The diagnosis below turned out to be right, and the answer was not a
      dial: wars could not END, so a country's declared enemies only ever accumulated. Giving
      the world a way to make peace took surviving countries from 39–53 back to 78–93, inside
      the archived pre-diplomacy band of 78–114. The original finding, kept because the
      reasoning is what made the fix obvious:
      Against the archived pre-diplomacy table (78–114 countries surviving, largest empire
      51–97), this is 39–53 surviving and 66–101 largest. The movement is in the same direction
      under all five goals, so it is structural rather than seed noise, and the likely reason is
      an asymmetry rather than a defect: a country now concentrates its whole offensive on one
      to three DECLARED enemies, while `strongestEnemyPowerAgainst()` still sizes every
      garrison against every enemy that can REACH it, declared or not. So attackers concentrate
      and defenders do not. Whether that wants a dial, a diplomacy-aware reserve, or nothing at
      all is a decision to take once Stage 5 gives wars a way to END — until then every
      declaration is permanent, and pairs at war climbing 536 → 749 across a run is the whole
      of why the second half of a game looks like the old undeclared world
- [x] The Stage 1 control run is still not taken, for the reason recorded there

---

## Stage 4 — the player's controls — **DONE**

Stage 3 gives the player a bare declaration on the attack control. This is the rest of it.

- [x] A confirmation when a declaration breaks an **agreement**, naming what is broken. None
      when it breaks nothing, because nothing was promised — `declarationPromptFor()` returns
      null out of neutral, and that silence is the point: a dialog in front of every
      declaration is a click-through inside three turns, which is worse than no dialog at all
      because it trains the player to dismiss the one that matters
- [x] **It quotes no penalty figure, and a unit test enforces that.** The price of a breach is
      Stage 5.6 and does not exist yet; a confirmation naming a penalty the game does not levy
      is the same class of lie the move button's hint was written to avoid, and the one the
      Dominapedia's War section had to be rewritten wholesale for. What it names instead is
      what is certain today: which agreement ends, how long it has stood, that a breach is the
      one costly way out of an agreement, and that the war begins at once
- [x] **Q6 IS ANSWERED: its own full-screen window, not a sixth info-panel tab.** The reason is
      Stage 5 rather than Stage 4 — a proposal, a counter-offer and a call-in are a
      CONVERSATION, and a conversation does not fit in a column beside four tables of numbers.
      It borrows the Dominapedia's shape: a list on the left, the subject on the right
- [x] Fixed `height` and `overflow: hidden` on the panel, with each column owning its own
      overflow. On this map the list genuinely reaches two hundred rows
- [x] `src/ui/diplomacy/relationsPanelModel.js` DECIDES and `DiplomacyPanel.js` DRAWS, the
      split `militaryShading.js` has from `militaryView.js`. That matters more here than usual:
      nothing in the game agrees a peace, a ceasefire or an alliance until Stage 5, so most of
      what this panel can say describes states a browser cannot be used to check
- [x] The tone lookup moved to `src/ui/diplomacy/relationTone.js` when the panel became its
      second reader. A second copy would be right until somebody decided neutral should read
      differently, and would then be a map and a panel disagreeing about the same relation
- [x] **Every action carries its reason, enabled or not**, which is the standing rule about a
      control that refuses to act — and the whole argument for a panel: the map can grey a
      button, only a panel has room for the sentence that says what would change the answer.
      Disabled is a class and `aria-disabled`, never the `disabled` property
- [x] **Stage 4 offers exactly one action, and that is not an oversight.** Proposing a peace, a
      ceasefire or an alliance is a negotiation, and that is Stage 5. Dead buttons for those
      would advertise a game that does not exist
- [x] `declareWarOnCountry()` in `ui.js` is the ONE door both surfaces go through — the map's
      DECLARE WAR button and the panel's action — the same rule `openUpgradeWindowFor()`
      records. An entry point that did half of it would be a declaration the register recorded
      and the map never repainted
- [x] Every id in [registry.js](../src/ui/core/registry.js); no hand-written selector
- [x] Listeners installed **once**, from bootstrap, with the rows and the action reached by
      ONE delegated listener each rather than one per render. `removeEventListener` cannot take
      off a handler built fresh at each call — the move button's defect, the territory
      tooltip's defect, and the status bars' defect, all the same shape
- [x] The panel re-renders from the store on `DIPLOMACY_CHANGED` and `TURN_CHANGED`, and only
      while it is up — a turn in which the AI declares forty wars must not re-render a hidden
      panel forty times
- [x] The button joins the map's left-hand chrome column and follows `toggleUIButton()`, so it
      is hidden in spectator mode along with the globe and the news — there is no player whose
      diplomacy it would be, and `render()` says so if it is opened anyway

### 4.1 Verified

- [x] Full unit suite green: **1,424 passing** (68 new across `ai-diplomacy.spec.js`,
      `ui-diplomacy-panel.spec.js` and the move button's new block)
- [x] ESLint clean on all five new modules and both new specs
- [x] **Driven in a real browser**, and it caught the one defect — see below. Playing Germany:
      selecting Germany then Luxembourg in the Military phase gives a blue `DECLARE WAR`;
      clicking it writes `Germany / Luxembourg → war` and the same selection reads `ATTACK`
      immediately, with the arrow drawn. The panel opens on *"At war with 1 country, no
      agreements, 19 countries met"*, nineteen rows grouped AT WAR / NEUTRAL, and Luxembourg's
      detail shows the standing, who else it is fighting, and the Declare war action refused
      with *"You are already at war with Luxembourg."* No console errors
- [x] **THE DEFECT WAS IN THE STYLESHEET AND HAD NO TEST TO CATCH IT.** The new block was
      inserted immediately before `#activity-panel-container, #ai-debug-panel-container,
      #ai-game-console-container { z-index: 9100; }` — which is the TAIL of a longer selector
      list beginning `#main-ui-container`. Splitting the list handed the info panel, the two
      resource windows and the transfer window the diplomacy BUTTON's rule
      (`position: fixed; top: 192px; left: 10px`), so the info panel drew off the top of the
      screen and every headless run stopped on turn 2 unable to click an X that was at
      `y = -47`. Nothing threw and the unit suite stayed green. **Anchor a stylesheet
      insertion on a whole rule, never on part of a selector list.**

---

## Stage 5 — negotiation, alliance and betrayal — **DONE except 5.2**

The largest stage. Split it if it will not end playable.

### 5.1 Peace and ceasefire — **DONE**

**This is the half of the phase that can end a war**, and Stage 3 measured why it had to come
next: pairs at war climbed **536 → 749** across a 150-turn run under every one of the five
goals, because a declaration was permanent. A declaration rule with no matching peace rule is
a ratchet. Everything below is the pawl coming off it.

- [x] Proposals from the player: **Propose a ceasefire**, **Propose a peace** and **Declare
      war**, all three in the diplomacy panel, each with the sentence saying why it is offered
      or refused. The two agreements come first because they are the ones a player has to go
      looking for — war is one click away on the map itself — and the declaration is last
      because it is the irreversible one
- [x] **Only the declaration is red.** In this game that colour means *this is the
      irreversible one*; a peace offer dressed the same way would be saying the wrong thing
      about the safest control on the panel
- [x] Proposals between AI countries: `planPeaceOffer()` gives each country **one** offer per
      turn, and `applyAiPeaceOffer()` in `aiCalculations.js` asks and applies it. One is a cap
      rather than a performance decision — two hundred countries asking three neighbours each
      is six hundred negotiations a turn, most refused and every refusal setting a cooldown,
      and the world would exhaust its own diplomacy in three turns and then go quiet for eight
- [x] **A ceasefire first, always.** The design's own words: it is the cheap version and the
      AI should reach for it first. A peace is offered only to somebody already under a
      ceasefire — the classic move, and the one case where the two have already stopped
      shooting. `ceasefireAllowance` is that difference stated as a number
- [x] **One door for both directions.** `answerProposal()` in `aiCalculations.js` gathers the
      world and calls `proposalOutcomeFor()`, and the player's offer and an AI's offer to
      another AI both go through it — the rule `countriesMayFight()` established for the
      attack gates. Two paths answering the same question separately would eventually answer
      it differently, and here that is a player told no by a calculation the world never made
- [x] **The answer arrives at once**, like everything else in this system, and is shown under
      the button that asked for it rather than in a dialog. A modal in front of a player doing
      the one thing this panel is for would be worse than no answer
- [x] **The reason names only the terms that argued the way the answer went.** Found by
      driving it: Hungary accepted and explained itself with *"its leader is aggressive, it is
      much the larger of the two"* — the two reasons it should have said no. Heaviest first,
      three clauses at most
- [x] **The answer is scrolled into view.** Also found by driving it: it is the last thing in
      a column that owns its own overflow, so against a country with a long list of wars the
      one thing the player just asked for was the one thing they could not see
- [x] A refusal sets a **cooldown** per pair per kind (`proposalCooldown`, 8 turns). A player
      who can ask every turn until the dice fall their way is not negotiating, they are
      rerolling — and the answer is a pure function of a world that barely moves between turns
- [x] **The theatre rival is the one country a peace cannot be bought from**, or the mid-term
      goal is a suggestion. The deliberate escape: a rival that has lost
      `theatreCeasefireFailures` attacks will take a CEASEFIRE, because a country being beaten
      wants a breather and that is exactly when the other side most wants to buy one —
      without it, the country a player most needs to talk to is the one that never listens

### 5.1a The two questions this stage had to answer

- [x] **Q1 — a standing siege when a war ends. ANSWERED: a siege BLOCKS an agreement, and it
      blocks it symmetrically.** Peace agreed while an army is three turns from starving a
      province out is a contradiction, and both alternatives are worse than refusing. LIFTING
      the siege means moving an army back out of a siege object from two unrelated code paths,
      the player's and the AI's, and a write that creates or destroys army is the single
      largest class of defect this project has had — known-issue **BJ**, and the free-attack
      bug before it. LETTING IT RUN under a peace makes the register say something untrue
      about the map. So the agreement waits: finish the siege, or lift it, then talk.
      **The cost is real and is accepted**: a player besieged by the AI cannot lift that siege
      and therefore cannot buy peace while it stands, which is exactly when they most want to.
      What makes it bearable is that `siegeReview.js` already lifts a stalled siege, that
      sieges are rare — nought to five standing across the whole world at every sample ever
      taken — and that the refusal says why. **A refusal a player can act on does not spend
      the cooldown**, so lifting the siege and asking again works
- [x] **Q2 — what a ceasefire reverts to. ANSWERED: the agreement remembers, in `revertsTo`.**
      Set at signing, read by `src/rules/diplomacy/expiry.js` when the clock runs out. A rule
      that guessed at expiry cannot work: with NEUTRAL as the first-contact state, "back to
      war" and "back to neutral" are genuinely different outcomes and the register keeps no
      history to reconstruct the right one from. **The fallback when a record does not say is
      NEUTRAL** — a save taken before ceasefires existed restores rows without the field, and
      putting two countries into a war neither of them declared, on the strength of an absent
      field, is the worse of the two mistakes
- [x] Expiry runs at the turn boundary, **from one place**: `diplomacyExpiry.js` on
      `TURN_CHANGED`, so every reader of the register on turn N sees the same world and a
      ceasefire does not lapse at a different moment for a player who opened the panel than
      for one who did not. It is reached by a **side-effect import in `ui.js`** and nothing
      else imports it, so deleting that line means a ceasefire never ends
- [x] **The AI offering to the PLAYER — BUILT IN 5.5, at Leigh's direction.** It was left open
      here because it needs a prompt with a real consequence for declining, which is the same
      shape as the call-in; building the two together meant writing that machinery once rather
      than twice. `diplomacyInbox.js` carries both

### 5.1b Verified

- [x] `tests/unit/ai-negotiation.spec.js` — 34 cases, and
      `tests/unit/rules-diplomacy-expiry.spec.js` — 11
- [x] Full unit suite green: **1,477 passing**
- [x] ESLint clean on both new modules and both new specs
- [x] **`Number(null)` is 0 and `Number.isFinite(0)` is true, and that caught this phase THREE
      times** — the "Since" fact, the confirmation's "agreed this turn", and a ceasefire with
      no expiry turn reading as having run out on turn zero. Every guard on an optional
      numeric field here is an explicit null-and-undefined check, and the last one was found
      by a test rather than by a player
- [x] **Driven in a real browser**, and it found both wording defects above. Playing Germany
      at turn 15: the panel offers all three actions with their reasons; a ceasefire with
      Hungary is accepted and the register records `until: 30, revertsTo: "war"`; firming it
      into a peace gives `until: null, revertsTo: null`; the CEASEFIRES group and the "Runs
      out turn 30" line both appear, and the summary moves to "At war with 3 countries, 1
      agreement". No console errors

### 5.1c Measured — a war can end now

`node tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND`, five goals, at turn
150, against the Stage 3 table above:

| goal | countries | largest | top 16 | pairs at war | at war with nobody | agreements | continents |
|---|---|---|---|---|---|---|---|
| CONQUEST | 88 *(51)* | 54 *(79)* | 72% *(88%)* | **207** *(692)* | 8 *(0)* | 505 | 1 |
| CONTINENTAL | 84 *(50)* | 65 *(71)* | 73% *(88%)* | **207** *(720)* | 17 *(0)* | 479 | 1 |
| DOMINATION | 79 *(49)* | 70 *(81)* | 75% *(90%)* | **216** *(703)* | 12 *(0)* | 527 | 1 |
| GREAT_POWERS | 93 *(53)* | 38 *(66)* | 67% *(84%)* | **195** *(749)* | 17 *(0)* | 533 | 0 |
| TURN_LIMIT | 78 *(39)* | 46 *(101)* | 74% *(92%)* | **235** *(735)* | 4 *(0)* | 482 | 0 |

*(Stage 3's figures in brackets.)*

- [x] **THE RATCHET IS OFF, AND THAT IS THE ONE NUMBER THIS STAGE WAS BUILT FOR.** At Stage 3
      pairs at war rose 536 → 749 across a run and never fell, because a declaration was
      permanent. They now *settle* around 200 with roughly five hundred agreements standing.
      Sampled across a Continental run the shape is visible turn by turn: 265 → 217 → 204
- [x] **The over-consolidation Stage 3 left open has corrected itself.** 78–93 countries
      surviving against Stage 3's 39–53, which is back inside the archived pre-diplomacy band
      of 78–114, and the largest empire is 38–70 against 66–101. Nothing was tuned to achieve
      that: the asymmetry Stage 3 diagnosed — attackers concentrating on declared enemies
      while defenders garrison against everyone who can reach them — is answered by wars
      being able to end
- [x] **The world is settled, not stopped**, and that distinction is the one this phase has to
      keep proving. `qui` is 4–17, not 207: a handful of countries are genuinely at peace with
      everybody, and the rest are still fighting. Upgrades reach 2,295–2,684, forts 658–669
      and world army 148M–213M, all still climbing at turn 150
- [x] **Five visibly different worlds still.** Great Powers stays the least consolidated (93
      countries, an empire of 38) and Domination among the most (79, an empire of 70) — the
      same ordering the archived Goals and Victory table found, so the doctrine layer still
      works through two more layers of gating
- [~] **CONQUEST IS VERY LOW LATE IN A RUN. A FINDING RATHER THAN A TASK**, recorded so that a
      later tuning pass starts from a measurement rather than an impression. One conquest and nought to
      three sieges at the turn-150 sample under four of five goals, where Stage 3 had five to
      fourteen. A settled world is the goal and a frozen one is known-issue **BA** in new
      clothes; the economy columns say this is the former, and every one of these runs still
      completes a continent or comes within 4% of one. But peace may now be a little too easy
      to get in the late game, and if it is, **`acceptThreshold` in `peaceDiscipline` is the
      dial** — it is one number and nothing else reads it
- [~] **GREAT POWERS AND TURN_LIMIT HOLD NO CONTINENT**, where both reached one at Stage 3. Also
      a finding rather than a task.
      Both are goals scored in something other than territories, so more peace costs them
      most; Great Powers' nearest continent falls from 100% to 46%, which is the largest
      single movement in the table and the one to look at first if this wants tuning

### 5.2 Alliance — passage and stacking — **BLOCKED, and the reason is the data model**

**STACKING CANNOT BE BUILT WITHOUT A PER-OWNER GARRISON, and that is a rewrite rather than a
stage.** A territory holds ONE garrison: seven figures on the territory object, written by
`writeGarrison()` and read by the battle model, the income pass, upkeep, desertion, the
muster, the threat array and the two status bars. "Your army may sit in your ally's province"
means a territory holding two armies under two flags, and there is no field for whose an army
is. Every one of those readers would need to learn the question.

**AND WITHOUT STACKING, PASSAGE HAS NOWHERE TO PUT AN ARMY.** Movement in this game is one hop
into an adjacent territory. An army that moves onto allied soil either merges into the ally's
garrison — which is not passage, it is a gift — or needs the second stack that does not exist.
There is no third option at one hop.

- [ ] `getInteractableFrom()` widening to allied territory. **Deliberately NOT done**, and it
      would have been the wrong fix even if stacking existed: that function is pure geometry
      and knows nothing about owners. Teaching it about the register would change first
      contact (allies would stop "touching" anybody), the muster's field, the threat array and
      the AI's whole target list at once — the long tail this item warned about, arriving all
      in one commit and with every balance number moving underneath it
- [ ] The deliverable version, when it is taken up, is **reach and not occupation**: an enemy
      territory adjacent to an ALLY's becomes attackable from your own nearest province, so an
      alliance opens fronts you could not otherwise reach and no second army ever exists. It
      needs its own five-goal run, because it widens what every allied AI can attack
- [x] Any army moved between allies goes through `writeGarrison()` and nowhere else —
      **vacuously true and worth stating**: nothing moves army between allies, so nothing
      writes a garrison it did not write before. That is the half of this item that must stay
      true whatever is built here, because a garrison write that leaves `useable*` alone hands
      somebody vehicles they do not have (known-issue **BJ**, five sites, one of which took
      India to minus six and a half billion)
- [x] The vehicle oil-corridor rule still holds, for the same reason: only useable vehicles
      march, the oil demand travels with them, and no new route was opened for either

**What shipped instead** is the rest of what an alliance gives — the standing share (5.3),
shared intelligence (5.4) and the call-in with its three endings (5.5) — so an alliance is
worth signing and worth the risk today. The manual's Alliances page lists exactly what it
gives and does not mention passage.

### 5.3 Alliance — the standing share — **DONE**

- [x] Two constants in `balance.js`, not four: `allianceShare.gold` (a FLOW) and
      `allianceShare.capacity` (three CEILINGS — oil, construction materials and food). The
      split is the one the continent bonus already has, and it is there for the reason the
      economy phase established: a ceiling compounds into gold a few turns later while gold
      compounds into nothing. Four dials for four resources would have been three unrelated
      decisions wearing one name, which is the mistake `upgradeFlatCapacityGain` records
- [x] **It arrives in the ECONOMY CONTEXT**, exactly as the continent bonus and the random
      event do, so `income.js` stays a pure function of `(territory, context)`.
      `capacityBonusOf(context)` multiplies the two ceiling bonuses in one place rather than
      threading a second argument through three call sites
- [x] **Never written onto a territory**, and the browser check is the proof: the multiplier
      goes to 1 the instant the alliance ends, with nothing to unwind
- [x] **IT IS A MUTUAL DIVIDEND AND NOT A TRANSFER, WHICH IS A DECISION AND NOT A
      SIMPLIFICATION.** A share taken out of one treasury and put into another has to be
      WRITTEN onto a territory, and a stored transfer needs an exact inverse write the moment
      the alliance ends — the silent bug `continentBonus.js` exists to prevent, and the class
      of defect that has cost this project the most (known-issue **BJ**; the free-attack bug,
      where a write-back restored the garrison and attacking created army). So both allies
      simply earn more while it stands
- [x] **Q5 ANSWERED: symmetric.** A percentage of a flow is worth more in absolute gold to the
      larger ally — Leigh's standing rule that being large stays an advantage — while the
      smaller ally takes the larger proportional lift, which is the nudge. A rule making the
      strong subsidise the weak is the "price each upgrade against the territory's own income"
      idea that was proposed for the economy and turned down
- [x] Capped at `maxAllies` (3). Without a cap an alliance web is a runaway: every signature
      raises the income of everybody in it, which pays for the army that wins the game, and a
      coalition against a runaway leader becomes an economic fact rather than a military one
- [x] `tests/unit/rules-alliance-share.spec.js` — 10 cases, including that the two bonuses
      MULTIPLY rather than add, and that a context which has never heard of alliances plays
      exactly the game it played before
- [ ] `node tools/econ-lab.mjs` does not measure it yet. The rule is pure and importable
      (`src/rules/economy/allianceShare.js` imports only `config/`), so the tool can IMPORT it
      when a section is written — which is the standing rule, because a measuring instrument
      holding its own copy of the thing it measures will eventually measure the copy

### 5.4 Alliance — shared intelligence — **DONE**

- [x] The military view's figures and threat marks extend over an ally's frontier. It is a
      widening of one predicate and not a new derivation: `planMilitaryView()` already walks
      the whole map, so `isAlliedOwned` costs nothing and defaults to "nobody" — a caller that
      predates alliances gets exactly the view it had
- [x] **AN ALLY IS NOT AN ENEMY, AND THE SHADE HAS TO KNOW IT.** `enemyNeighboursOf()` means
      "under another flag", which an ally's territory also is — so without a friendly filter,
      the moment two countries signed, each would start shading its own border with the other
      dark and marking it as a threat. An alliance that made the map say you were about to be
      invaded by your ally. The filter applies only to a WATCHED territory, because "friendly"
      is a fact about the player's coalition: to a country on the far side of the world the
      player and their allies are enemies like anybody else
- [x] `tests/unit/ui-military-shading.spec.js` still counts the `takeProbability()` calls, and
      the bound is widened by exactly one country: the odds are asked for the player, now
      their allies, and for nobody else
- [x] The plan is rebuilt on `DIPLOMACY_CHANGED`. Nothing else would: a new alliance changes
      what the view shows without changing anything on the map — no territory changed hands
      and no turn passed

### 5.5 The call-in, and the three ways an alliance ends — **DONE**

Leigh's revision, and the whole of it is that **nothing is automatic**.

- [x] A party to an alliance that declares war has its ally **asked to join** — never
      enrolled. `resolveCallIns()` walks the two belligerents' ally lists ONCE and stops
- [x] **NOTHING CASCADES, AND THAT IS WHAT MAKES Q3'S ANSWER SAFE.** A joiner's own allies are
      never asked. Without that one signature would put the whole map at war in three hops,
      which is exactly the transitive closure the first draft had to forbid by rule and this
      one cannot produce
- [x] The ally joins: they enter the war, and `bindJoiner()` records whose war it is
- [x] The ally refuses: **the alliance ends, and NEITHER side pays a penalty.** Back to
      NEUTRAL rather than to peace — the two have not agreed anything, they have stopped
      having an agreement
- [x] **Mutual dissolution**, offered on any alliance in the panel and almost always accepted.
      That it is almost always accepted is the design rather than a shortcut: an AI that
      haggled over being let go would turn the honest route into a gamble, and the moment it
      is a gamble the breach becomes the reliable option — which is the incentive stage 5.6's
      penalty exists to remove. It is refused in exactly one case, and that case is the rule
      below
- [x] **The breach is exactly one act** — walking out unilaterally, or declaring war on your
      own ally — and it is the only thing that will cost. §5.6 prices it; nothing prices it yet
- [x] **The player's side is a prompt, and it is not dismissible into a default.** It states
      what refusing costs BEFORE it is answered, which is how "must not be dismissible into a
      default" is met: the default is an answer the player has been warned about, rather than
      a modal they cannot leave. The prompts are shown one at a time and awaited, because
      `confirmDialog.open()` resolves a previous dialog as a CANCEL when a second is raised
      over it — two at once would refuse a call to arms on the player's behalf
- [x] **The AI offering to the PLAYER is built** (moved here from 5.1 at Leigh's direction, so
      the prompt machinery is written once rather than twice). An AI's offer of a ceasefire, a
      peace or an alliance joins the same queue as a call-in and is put to the player at the
      end of the AI turn

#### Q3, answered by Leigh, and both halves are built

- [x] **An ally IS called in on DEFENCE as well as on aggression** (*"yes they are"*). Both
      sides' allies are asked, and the defensive case carries more weight than the aggressive
      one — coming to the aid of somebody who has been attacked is what an alliance is
      understood to be for, and being dragged into a war your partner started is not
- [x] **When the call must be answered: by the start of your next turn.** `diplomacyInbox.js`
      queues during the AI phase and `showQueuedDiplomacy()` empties it at the end, beside
      `showQueuedDefences()` and after it — a call answered over a battle-results screen would
      be answered *through* it
- [x] **A joiner may not settle out of the war it was called into** (*"the peace must be asked
      either by the ally under attack or by the adversary, and agreed, where it then applies
      peace to the ally aiding the attacked ally as well"*). `isBoundJoiner()` refuses the
      joiner's own proposals to that adversary, and `acceptProposal()` releases every joiner
      on the same terms the moment the principal settles. Without the first half a call-in is
      a free favour — an ally turns up, is thanked, and buys its own way out next turn
- [x] The binding **prunes itself**: a principal that is CONQUERED never settles anything, and
      the joiner would otherwise be barred from peace with that adversary for the rest of the
      game. `pruneCallIns()` asks "does this war still exist" once a turn, which cannot miss a
      route the way hooking the moment a country loses its last territory would

### 5.5b The harness had to learn about a blocking prompt — **DONE**

The prompt is the first thing in this game that stops the turn and waits for a person, and
that broke four e2e areas at once.

- [x] **The turn does not proceed until a diplomatic question is answered, and that is correct.**
      It is what *"must not be dismissible into a default"* means. What was wrong is that no
      driver could see it: a headless run sat on `AI MOVING...` for the full two minutes and
      reported a phase button that would not click, which reads exactly like a game defect
- [x] `confirmDialog.open()` takes a `kind`, written to `data-kind` on the container. It has
      ONE reader — the e2e driver — and it exists so that a question the AI asked can be told
      from a confirmation the player opened themselves by pressing New Game. Without it a
      driver that dismissed every dialog would answer both, and a spec that opens a confirm on
      purpose could never assert anything about it
- [x] `GameDriver.answeringDiplomacy()` DECLINES them while an action runs, which is the safer
      of the two defaults: refusing an offered ceasefire or peace costs nothing and changes no
      relation, so a spec about something else is not quietly handed a world at peace
- [x] **IT WRAPS `withBlockersCleared()` AND NOT JUST `endTurn()`**, which is what the first
      version got wrong and what the fix is really about. The AI phase is entered by whichever
      click happens to be next, and in a spec that lays a siege during the Military phase that
      click is `endBuyPhase()`'s — so a poller attached to `endTurn()` alone left that path
      hanging. **Found by bisecting against a stashed tree**: `siege/siege-turns.spec.js`
      passes 5/5 before the change and 4/5 after it, which is the only way to tell a defect
      introduced from one that was already there
- [x] **Full suite: 473/483, from 469/483 before the fix.** `siege` 14/14 alone,
      `country-selection` + `map-interaction` + `resources-economy` **126/126** alone
- [x] **Every one of the nine remaining failures was accounted for, none of them diplomatic.**
      Three fail on a STASHED TREE as well and are registered — **C5** (the player is dealt
      random starting forts), **C6** (a spec dynamically imports a source path the preview
      server does not serve) and **C7** (the activity feed draws no player row). The other six
      pass when their areas are run without four workers competing for the machine, which is
      the same load sensitivity the `battle` area is already known for

---

### 5.5a The alliance was NOT measured, and the reason is worth recording

- [ ] **The five-goal run for stages 5.2–5.6 was started and is VOID.** Four of the five goals
      stopped between turns 22 and 60 with `Cannot read properties of undefined (reading
      'turn')` — which is not a game defect and is documented in `CLAUDE.md` as the one thing
      that must not be done: **source files were edited while the run was in flight**, Vite
      pushed an HMR update, the page reloaded and `window.__game` went with it. The Dominapedia
      edit did it, and a transient half-applied state of that file supplied the page error in
      the log. Leigh's direction afterwards was to stop measuring and finish the stage, so it
      has not been retaken
- [ ] **What that leaves unknown is specific and worth naming**: whether alliances form often
      enough to matter, whether the alliance income share moves consolidation, and whether the
      call-in spreads wars faster than peace ends them. The 5.1 table is the last trustworthy
      one. `node tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND` for the five
      goals is the run, and **nothing may be edited while it is going**

---

### 5.6 Betrayal — **DONE**

Leigh asked for *"a very large penalty indeed if broken"*, and §3.4 then narrowed what
"broken" means to exactly one act. The whole rule is one sentence:

> **The penalty is for ENDING AN ALLIANCE WHEN BOTH SIDES DO NOT AGREE, and for nothing else.**

- [x] Breaking an agreement drops the betrayer's **other** agreements to neutral, and marks
      them treacherous. `recordBreach()` decides and writes nothing — the drops come back as a
      list for `applyBreach()` in `aiCalculations.js` to put through `setRelationState()`,
      which is what keeps the policy testable in Node
- [x] The mark **decays**, the way `theatreCommitment.wallMemoryTurns` does and for the same
      reason: *"they tore up a treaty on turn 12"* stops being the most useful thing to know
      about a country forty turns later, and a permanent exclusion would make one betrayal an
      unrecoverable game state. `treacheryOf()` returns a FRACTION rather than a flag, because
      a boolean cannot decay
- [x] **An alliance broken costs more than a peace broken, which costs more than a ceasefire;
      leaving neutral costs nothing at all.** That last is not a leniency — it is what the word
      neutral means, and it is why this rule almost never fires: the overwhelming majority of
      declarations are made out of neutral and are free
- [x] **While the mark stands, no AI will agree ANYTHING with them.** That is the whole penalty
      on the diplomatic side and it is what makes an alliance's benefits a hostage. It is
      checked before the proposal cooldown so the reason a player is refused is the one they
      can act on, and it does not SET a cooldown — being refused for treachery is a fact about
      the mark rather than about the offer, and punishing twice for one act is not the rule
- [x] **The penalty attaches ONLY to the breach**, and each of the three endings is asserted
      separately, because *"the alliance ended"* is now three different events with three
      different prices and a test that checked only that it ended would pass for all three
      while the game charged the wrong one
- [x] **A succession does not void an agreement.** The agreements live in the store and
      `clearPlansFor()` cannot reach them; what the new cases pin is that the memory in
      `src/ai/diplomacy.js` is not reached either — a call-in binding and a treachery mark both
      survive, because they are facts about the COUNTRY. If a change of leader wiped the mark,
      betraying an ally and then waiting for a succession would be the cheapest move in the game
- [x] **One door, both sides.** `applyBreach()` is called from the AI's declaration path and
      from the player's, for the reason `countriesMayFight()` established: a penalty the game
      applies to one side of itself is not a rule. It must be called BEFORE the declaration is
      written, because the state it charges for is the one about to be replaced — that ordering
      is the only thing this function is fragile about, and it is commented at both call sites
- [x] The confirmation the player sees **now names the price**, because there is one: every
      other agreement torn up, and nobody willing to agree anything until it is forgotten. It
      still quotes no turn count, because the number differs by what was broken and a wrong
      figure is worse than none
- [x] `tests/unit/ai-betrayal.spec.js` — 23 cases

#### Q4, answered: the penalty is REPUTATIONAL ONLY

- [x] **There is no fine, and that is a decision rather than an omission.** A gold penalty is a
      number nobody can calibrate — what is a treaty worth in gold? — and it would fall hardest
      on the countries least able to absorb it, which is backwards
- [x] **The material cost is DERIVED from the reputational one and is therefore
      self-calibrating.** A breach drops every other agreement, and an alliance pays a standing
      share of income (5.3), so tearing up one treaty is paid for in the dividends of all the
      rest. A country with one peace loses little; a country at the centre of an alliance web
      loses the web and the income that came with it. That proportionality is what a flat fine
      could never have
- [x] **How long: 25 turns for an alliance, 15 for a peace, 10 for a ceasefire**, in
      `betrayalPenalty.treacheryTurns` — the same ordering as how hard each was to get
- [x] **`dropsOtherAgreements` is a dial rather than a fact**, because it is the single most
      consequential line here: it is the difference between a betrayal being a setback and
      being a catastrophe, and it is the one a measurement might argue with

---

## Stage 6 — the news, the manual and the measurement

- [ ] New `ActivityKind` entries: declaration, treaty, alliance, betrayal. The set is **closed**
      and `recordActivity()` rejects anything else, because the card writer switches on it
- [ ] **A card only for the player's own diplomacy**; everything else joins "elsewhere in the
      world". 207 countries negotiating will produce far more events than 207 countries fighting
- [ ] **No country name used as an adjective** — there are no demonyms for 207 countries, and a
      unit test fails the build if one reappears
- [ ] The AI's diplomatic *intentions* go to the console, never to the feed. The feed reports
      what happened; a panel showing who is about to declare war is a cheat
- [x] **A Dominapedia section — DONE.** Diplomacy is a top-level section now, not a page in
      Reference: *Who You May Fight*, *Declaring War*, *Peace and Ceasefires* and *Alliances*.
      The old Reference page has been narrowed to *The Siege Offer*, which is the one thing on
      it that was still true — everything else it said (*"there are no alliances, no
      non-aggression pacts, no war declarations"*) had become confidently wrong, which is the
      exact failure this rule exists to catch
- [x] **The figures are IMPORTED rather than remembered.** `topics.js` now imports
      `config/balance.js` — which itself imports nothing, so the property that mattered is
      intact — and every number on those pages comes off a dial. A tuning pass moves the manual
      with the game instead of leaving it wrong, which is the stronger form of *quote a number
      only after reading it out of `balance.js`*
- [ ] E2E: a new functional area under `tests/e2e/diplomacy/`, the tooltip spec deferred from
      Stage 0, and the register surfaced on `window.__game` — a relation is exactly the kind of
      thing a spec cannot reach by clicking
- [ ] **The five-goal 150-turn acceptance table**, against the Stage 1 control, with a paragraph
      per goal. This is the criterion for any change to `src/ai/` and this phase is nothing but
      changes to `src/ai/`
- [ ] `docs/02-game-design-document.md` gains the mechanic; `docs/04-known-issues.md` gains
      whatever this opened and loses whatever it closed, **in the same change**

---

## Stage 7 — federations (BACK BURNER)

**Not scheduled, and recorded so the register is not painted into a corner.** Leigh: an alliance
may later be *"opened into a federation by asking other states to join it"*.

- [ ] A federation is a **bloc with a membership list, not a seventh relation state.** A
      relation is a fact about a PAIR and a federation is a fact about a SET, so it is a second
      structure whose members happen to be pairwise allied. Modelled as a state it would need
      every member's relation to every other member kept in step by hand, which is the
      two-rows-per-relation mistake at a larger scale
- [ ] Everything else is **Q10**: who may invite, whether a federation votes, whether it shares
      more than an alliance does, and whether it wins together
