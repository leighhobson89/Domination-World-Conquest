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

## Stage 1 — the control run

**Before a single rule changes.** Diplomacy changes who fights whom, which is upstream of every
number in the acceptance table, so there has to be something to compare against.

- [ ] `tools/ai-sim.mjs --turns=150 --seed=goals --every=25 --goal=KIND` for all five goals on
      the current tree. Tabled here, in full
- [ ] New columns added to `ai-sim` FIRST, so the control run carries them: **wars declared**,
      **agreements standing**, **alliances**, **countries at war with nobody**. Without these
      the phase's characteristic failure — a world too polite to fight — is invisible, because
      it looks exactly like a peaceful one in every existing column
- [ ] `node tools/muster-probe.mjs` baseline, since Stage 5's passage rights touch the muster

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

## Stage 3 — declaration, and the fighting returns

Two ways into a war, and Leigh named both: *"changing state by communication diplomacy and also
declaring without chatting too"*. This stage is the second one — a bare declaration, no
negotiation — and Stage 5 is the first.

### 3.1 `src/ai/diplomacy.js` — new

- [ ] Unit tests first, watched to fail on the missing module
- [ ] **The only module in `src/ai/` allowed to decide a diplomatic action**, the containment
      `doctrine.js` has over victory conditions and `standingsGoalColumns.js` has on the UI side
- [ ] **A theatre commitment is a declaration of war.** `theatre.js` already commits a country
      to absorbing one neighbour and keeps the commitment until the rival becomes a wall — that
      is the country's own answer to "who is my enemy", already persistent, already derived
- [ ] Opportunistic declarations: a country that rates a target worth taking may declare on its
      owner, bounded by a per-turn budget so a country does not declare on six neighbours at once
- [ ] Pure, injected rng, no store reads — the rule every module in `src/ai/` follows
- [ ] **It exposes no siege dial.** `doctrine.js` refuses one because the siege budget's
      subtraction of running sieges is what ended the 17-to-67-concurrent problem; a unit test
      asserts no key here matches `/siege/`

### 3.2 The player declares

- [ ] Available from the attack control on a territory of a country not at war, and it takes
      effect **at once** — declare and attack the same turn
- [ ] The attack control says **why** a territory cannot be attacked before it offers the
      declaration. A greyed control with no reason is a bug report waiting to be filed

### 3.3 Wiring and measurement

- [ ] Runs from the same place `planCampaign()` does, after `succession.js` — a leader who has
      just died must not be the one declaring the war
- [ ] The campaign table is already a save slice registered from `aiCalculations.js`; anything
      diplomatic that is not in the store rides inside it rather than registering its own
- [ ] `?seed=` still reproduces a game. **Every `Math.random` draw added during bootstrap moves
      every seeded outcome**, so any randomness here goes on the AI's injected rng
- [ ] `ai-sim` five goals, 150 turns, against BOTH the Stage 1 control and the Stage 2 silence.
      The number to watch is **countries at war with nobody**: the gates are known to hold, so
      anything still frozen here is the declaration rule being too shy
- [ ] The game is playable again, and this is the stage that says so

---

## Stage 4 — the player's controls

Stage 3 gives the player a bare declaration on the attack control. This is the rest of it.

- [ ] A confirmation when a declaration breaks an **agreement**, naming the penalty. None when
      it breaks nothing, because nothing was promised
- [ ] The diplomacy panel — **Q6** decides whether it is a sixth info-panel tab or its own
      window. Whichever: fixed height, the inner column owns the overflow, no control ellipsised
- [ ] The panel is where a proposal is made, answered, and where a call-in is accepted or
      declined
- [ ] Every id in [registry.js](../src/ui/core/registry.js); no hand-written selector
- [ ] Listeners installed **once**, from bootstrap. `removeEventListener` cannot take off a
      handler built fresh at each call — the move button's defect, the territory tooltip's
      defect, and the status bars' defect, all the same shape

---

## Stage 5 — negotiation, alliance and betrayal

The largest stage. Split it if it will not end playable.

### 5.1 Peace and ceasefire

- [ ] Proposals both ways: the player offers and the AI answers; the AI offers and the player
      answers
- [ ] A ceasefire carries `until` and expires. **Q2** decides what it reverts to, and the
      proposal is that the agreement remembers in a `revertsTo` field rather than the rule
      guessing at expiry
- [ ] Expiry runs at the turn boundary, from one place

### 5.2 Alliance — passage and stacking

- [ ] `getInteractableFrom()` widens to allied territory. **The long tail is here**: the
      muster's `pullField()` walks OWNED territories only, `route.js`'s corridor, the transfer
      window's destinations, and the attack-arrow walk all read that graph
- [ ] Any army moved between allies goes through `writeGarrison()` and nowhere else. A garrison
      write that leaves `useable*` alone hands somebody vehicles they do not have — known-issue
      **BJ**, five sites, one of which took India to minus six and a half billion
- [ ] The vehicle oil-corridor rule still holds: only useable vehicles march, and the oil demand
      travels with them

### 5.3 Alliance — the standing share

- [ ] One constant per resource in `balance.js`: gold, oil, construction materials, food
- [ ] **It arrives in the economy context**, exactly as the continent bonus and the random
      event do, so `income.js` stays a pure function of `(territory, context)`
- [ ] **Never written onto a territory.** A stored transfer needs an exact inverse write when
      the alliance ends, and an ally who kept the income afterwards is the silent bug
      `continentBonus.js` exists to prevent
- [ ] Measured with `node tools/econ-lab.mjs`, and the tool **imports** the rule rather than
      carrying a copy of it — a measuring instrument holding its own copy of the thing it
      measures will eventually measure the copy
- [ ] **Q5**: symmetric, or the stronger supporting the weaker

### 5.4 Alliance — shared intelligence

- [ ] The military view's figures and threat marks extend over an ally's frontier. This is a
      widening of `entry.frontier`, not a new derivation — `militaryShading.js` already plans
      the whole map
- [ ] `tests/unit/ui-military-shading.spec.js` still counts the `takeProbability()` calls. The
      odds are asked for the player and now their allies, and for nobody else

### 5.5 The call-in, and the three ways an alliance ends

Leigh's revision, and the whole of it is that **nothing is automatic**. See plan §3.4.

- [ ] When a party to an alliance **declares war**, its ally is **asked to join** — never
      enrolled. **Nothing cascades**, so there is no transitive closure to forbid; a war spreads
      one country at a time and only because somebody said yes
- [ ] The ally joins: they enter the war
- [ ] The ally refuses: **the alliance ends, and NEITHER side pays a penalty.** Not the refuser,
      and not the aggressor — the aggressor's cost is precisely that they have gone to war
      without an ally they were relying on, which is a consequence rather than a fine
- [ ] **Mutual dissolution.** Either side may propose ending the alliance; if the other accepts
      it ends free for both. This is what makes an alliance a thing a country can plan its way
      out of rather than only betray its way out of
- [ ] **The breach is now exactly one act** — walking out unilaterally, or declaring war on your
      own ally — and it is the only thing that costs. §5.6
- [ ] The player's side of a call-in is a prompt, and it must not be dismissible into a default:
      declining has a real consequence and a click-through would apply it silently
- [ ] **Q3** is what is still open here: whether an ally is called in on DEFENCE as well as on
      aggression, when the call must be answered, and what happens to a country that called an
      ally in when that ally later makes peace

### 5.6 Betrayal

- [ ] Breaking an agreement drops the betrayer's **other** agreements to neutral, and marks
      them treacherous for N turns. The mark decays, the way `theatre.js`'s walls do (**Q4**)
- [ ] An alliance broken costs more than a peace broken; leaving neutral costs nothing
- [ ] The penalty attaches ONLY to the breach in 5.5 — a refused call-in and a mutual
      dissolution are free, and a test asserts each of the three endings separately, because
      "the alliance ended" is now three different events with three different prices
- [ ] **A succession does not void an agreement.** `clearPlansFor()` wipes judgements reached by
      a dead leader but deliberately keeps the committed continents, because the conquest of a
      continent is the COUNTRY's plan. A treaty is the same kind of thing, and an heir who
      forgot every alliance would make a fifty-turn coalition end because somebody died

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
- [ ] A Dominapedia section. **Quote a number only after reading it out of `balance.js` or a
      lab tool** — the War section had to be rewritten wholesale once because it still described
      a deleted combat model, and three pages told the player infantry were not worth buying
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
