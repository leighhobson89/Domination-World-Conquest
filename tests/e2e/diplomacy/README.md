# diplomacy

Who may fight whom, and what happens when two countries talk instead. The register
(`src/state/diplomacy.js`), the attack gates, the panel, the tooltip rows and the
news the feed makes of it all — diplomacy stages 0 to 6.

| Spec | Covers |
|---|---|
| `register.spec.js` | The register is sparse; a pair is ONE record and answers the same either way round; a pair cannot be returned to no contact; a ceasefire is written with its expiry and what it reverts to; the whole register survives a save |
| `gates.spec.js` | A neutral country cannot be attacked — the move button offers no `ATTACK` — and the same pairing offers one the moment war is declared; a declaration is written both ways round |
| `panel.spec.js` | The button is up with the map chrome; the list is the register and never the player themselves; which of the five actions are offered out of which state; a proposal is answered on the spot and the register agrees with the answer; a refusal sets a cooldown |
| `tooltip.spec.js` | The relation rows reach the map (deferred here from stage 0); the player's own standing comes first on somebody else's territory; the player's own land never lists the player as a foreign power; the rows follow the register |
| `news.spec.js` | First contact writes nothing; a declaration, a treaty, an alliance and a betrayal each reach the activity feed as their own kind; the player's own diplomacy becomes a card; entries survive a save |

## What is asserted here, and what is not

**Not the wording, anywhere.** Four pure modules own every sentence this phase
produces, and each has its own unit spec:

| Module | Spec |
|---|---|
| `src/ai/diplomacy.js` — whether an offer is accepted, and why | `tests/unit/ai-negotiation.spec.js` |
| `src/ui/diplomacy/relationsPanelModel.js` — the panel's rows and reasons | `tests/unit/ui-diplomacy-panel.spec.js` |
| `src/ui/map/diplomacyTooltip.js` — the tooltip rows and their order | `tests/unit/ui-diplomacy-tooltip.spec.js` |
| `src/ui/activityFeed/describeActivity.js` — the news | `tests/unit/ui-diplomacy-news.spec.js` |

What is left once the prose is somebody else's problem is the part that only exists
in a browser:

- **that the rule is wired to the control.** `countriesMayFight()` being correct and
  the game actually refusing the attack are two different claims, and only the
  second one is what a player experiences. `gates.spec.js` asserts the move
  button's label for exactly that reason.
- **that the register reaches the feed at all.** The path runs from
  `setRelationState()` through the event bus into `activityRecorder.js`, and nothing
  throws if a link of it is missing.
- **that the panel and the store cannot disagree.** An "accepted" that did not write,
  or a refusal that did, is invisible to a pure test of either half.

## Notes

- **`window.__game.setRelation()` writes the other five states**, because nothing in
  the game agrees a peace, a ceasefire or an alliance except by asking an AI country
  that may say no. It goes through `state/mutations.js` like every other write and it
  sets a ceasefire's `until` and `revertsTo` properly — a spec that wrote a ceasefire
  with no expiry would be testing an agreement the game cannot produce.
- **`GameDriver.declareWarOn()` is called from `openAttackWindow()`**, so almost every
  other area in the suite declares war implicitly. A spec that wants to prove the GATE
  holds must drive the map without it, which is what `gates.spec.js` does.
- **A diplomatic prompt blocks the turn**, deliberately — that is what *"must not be
  dismissible into a default"* means. `GameDriver.answeringDiplomacy()` declines them
  while another action runs, which is the safer default: refusing an offered ceasefire
  costs nothing and changes no relation.
- **Several specs `test.skip` when Germany reaches no enemy.** The seed is derived from
  the test title, so a pairing is stable per test but is not guaranteed to exist; a
  spec that assumed one would be a seed lottery dressed as an assertion.
