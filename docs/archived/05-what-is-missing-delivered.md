# What Is Missing — the items that have been delivered

The companion archive to [05-what-is-missing.md](../05-what-is-missing.md). That document is the
standing list of **what is left to do**, and an item leaves it the moment it is finished — cut
out entirely rather than marked done, struck through, or left as a stub, so that reading it top
to bottom gives a list of outstanding work and nothing else.

This is where the reasoning goes instead. Each entry keeps its original id, because the living
document, `CLAUDE.md` and the source comments all cite them by letter, and records what was
built, what was decided along the way, and what the item deliberately did **not** do.

**Where an item was only partly finished, the living document keeps the outstanding half**,
rewritten so it stands on its own. The delivered half is here.

---

## E3 — Tell the player what happened to them *(finding M8)*

**The defect.** A disaster halved a territory's food, divided its oil, burned its construction
materials or emptied a quarter of its treasury — and reported itself to `console.log` and to
nothing else. The player watched a number fall and was given no reason. Worse, the same turn
suppressed population growth **everywhere on the map**, which is a real mechanical effect with no
visible cause at all: the economy simply stopped for a turn.

**What was built.** It took a decision rather than a patch. `ActivityKind` was a closed set with
a documented military-only rule, and the panel was a battle report titled *Military Activity*.
Both were deliberately overturned: the panel is **the player's news** now, titled *The World This
Turn*, and a disaster is a card in it.

> **Harvests fail** — The harvest has failed across 7 of your territories, Saxony worst among
> them. Granaries are half what they were and there will be no growth this season. Nothing will
> grow anywhere this turn while the country takes stock.

**Four decisions worth carrying forward.**

- **One card per disaster per turn, not one per territory.** The roll runs independently against
  every one of the 359 territories, so a large empire would write a hundred entries in a turn,
  flush the bounded log, and read as a spreadsheet with more whitespace.
  `resourceCalculations.js` gathers hits as the income pass runs and calls `recordDisaster()`
  once, at the end, because the count is the point of the entry and is not known until the pass
  is over.
- **"Worst" is the largest PROPORTION lost**, never the largest absolute amount. Every disaster
  divides a stock, so the absolute figure would simply name the richest territory that was hit
  and would say the same thing every game.
- **The card states the suppressed growth.** That was the half of the defect that had no visible
  symptom at all — the resource drop at least showed up as a number.
- **Only the player's disasters are recorded.** A famine in Peru is not something the player has
  any way of knowing about, and recording all 207 countries' would be 207 entries a turn that
  nobody can act on.

**A turn is cards plus a list.** `newsCardFor()` returns a card only for the player's own news
and null for everything else; the panel drops the nulls into a compact *Elsewhere in the world*
list underneath. That list is the terse feed that existed before, kept rather than thrown away,
because "what happened everywhere" is a real thing to want and a card cannot answer it — and
because turn 1 on this map logs **fifty-one** conquests.

**The wording varies by `entry.id`, never by a draw.** The panel re-renders on every logged entry
while it is open, so a card that reworded itself each time would be unreadable; and a
`Math.random` variant would put the newspaper on the game's seeded stream and make two runs of
one seed diverge.

**No country name may be used as an adjective.** There are no demonyms for 207 countries, so "The
France garrison" and "Germany administrators" are what a naive template produces. Every phrasing
avoids the construction and `tests/unit/ui-news-cards.spec.js` fails the build if one comes back
— which is how the gap was found in the first place, along with a phrasing that named the winner
of a conquest and never the loser.

---

## E4 — Name the enemy *(findings M4 and M6)*

**The gap.** Two hundred and six leaders are generated with six traits each, replaced every 15–20
turns by `src/ai/succession.js`, and used to plan every move in the game — and the player could
not learn a single one of their names. The only surfaces were `AiDebugPanel` (numpad `/`) and the
spectator console, both developer tools.

**What was built.** Hovering an enemy territory reads:

> France
> *Queen Audrey the Conqueror, said to be warlike*
> Europe: 2 of 52 held by France

and the news cards name leaders too — *"Baron Kessler II claims the province by right of
conquest."*

**Three decisions worth carrying forward.**

- **The reputation is public; the traits are not.** The three personality ids become a phrase.
  The six trait VALUES stay hidden, because a trait is the number the AI plans with —
  `risk_taking` decides how thin a border a country will hold in order to attack — so putting one
  on a tooltip is the enemy's plan drawn on the map. That is the same line the feed draws when it
  reports what HAPPENED and sends the AI's intentions to the console. An e2e spec asserts no
  trait name and no bare decimal ever reaches the tooltip.
- **A leader's name on a card is RECORDED at the event, never looked up when the card is drawn.**
  Leaders die, so a card drawn on turn 40 that asked the world who ruled Germany would credit a
  turn-12 conquest to whoever is in charge now. That is known-issue **AS** in new clothes — the
  Wars & Sieges tab drew the defending flag from the territory's CURRENT owner and so showed the
  attacker's flag on both sides of any war the attacker had won. The lookup is **injected** into
  `activityRecorder.js` from `gameTurnsLoop.js` rather than imported, so that module still
  imports only from `state/` and still loads in Node.
- **The tooltip has two sources and asks them in a fixed order.** A leader is stamped onto every
  territory at `createCpuPlayerObjectAndAddToMainArray()` and is **not** re-stamped on conquest,
  so a territory that changed hands still carries the leader of the country that LOST it — which
  would name the wrong ruler on exactly the territories a player is most likely to hover over.
  `getArrayOfLeadersAndCountries()` is rebuilt from the world every turn and is asked first; the
  territory's own copy is the fallback and is trusted only while `dataName` still matches the
  country it was stamped for.

**What E4 deliberately did not do**, and why the rest of **M4** stays on the living list: the
names are surfaced and nothing else is. There is still no country panel, no way to see who a
rival is campaigning against, and no history of who ruled when.

---

## E5 — A world standings tab *(finding M3)*

**The gap.** `worldStandings()` had existed since the Goals and Victory phase and was called in
exactly two places: the ending snapshot, and the phase bar's one-line goal label. So under
Continental Supremacy a player learned that somebody else had been winning **at the moment the
game ended**, and not before.

**What was built.** A fifth tab on the info panel, last in the row because the first four are
the player's own empire and this one is the rest of the world.

| # | Country | Territories | Army | Continents | Closest |
|---|---|---|---|---|---|
| 1 | Canada | 29 | 498.9k | 0 of 3 · 21% | North America 62% |
| 2 | Indonesia | 30 | 2.0M | 0 of 3 · 15% | Oceania 46% |
| … | | | | | |
| 84 | **Germany (you)** | 1 | 791.1k | 0 of 3 · 1% | Europe 2% |

**Four decisions, all Leigh's, taken before any of it was written.**

- **Rank is progress toward the goal in force, not size.** `CLAUDE.md` already drew this
  distinction for the AI — `leadingCountry()` is the largest empire, `closestToVictory()` is who
  is winning — and under Great Powers they are routinely different countries. **Territories are
  the tie-break**, and that does real work rather than tidying: on turn 4 of a Continental game
  every country is at the same progress, so without it the order is `Map` insertion order and
  the table reshuffles itself between renders for no reason a player can see.
- **Top sixteen, with the player always pinned.** Sixteen because `tools/ai-sim.mjs` already
  reports "top-sixteen share" as its consolidation measure, so it is the number this project
  thinks in. If the player misses the cut they are appended below a gap carrying their TRUE
  rank — a standings table that can stop answering *where am I* stops being read at exactly the
  point, losing, where the answer matters most.
- **One goal column plus a detail column.** Four fixed columns in every game; the goal supplies
  a headline and the fact that makes it legible. "1 of 3" is the same sentence whether the next
  great power is a province away or untouched, which is why `victoryProgress().detail` exists at
  all and why the second column carries it.
- **`standingsGoalColumns.js` is the only place the table switches on a goal**, the same
  containment `src/ai/doctrine.js` has on the AI side.

**One thing was found by looking at it, and it is worth carrying forward.** Continental is the
one goal whose progress is **not** the count beside it: `victoryProgress()` sums the shares of
the best `required` continents rather than counting completed ones, deliberately, so that a
country two territories from owning Europe outranks one that has just landed on it. Shown as a
bare count, nearly every row read "0 of 3" for the first fifty turns while the table was visibly
ordered by something it never displayed — measured on a real game, **Norway sat above the United
Kingdom with a lower figure in the Closest column**, which reads as a sorting bug and is not one.
The percentage beside the count is the ranking basis made visible.

**AND IT EXPOSED A LIVE LAYOUT DEFECT THAT HAD AFFECTED EVERY TAB.** `.blur-background` is
`display: block`, so `.content-window`'s `flex-grow: 1` had no flex parent to grow into and the
table sat at its `445px` base height inside an `800px` window — about **350px of dead space
under every tab of the info panel**, for as long as the panel has existed. The Standings tab is
simply the first with enough rows to make it visible, and it presented as the table being
clipped at ten rows when it was in fact scrolling correctly inside a box far shorter than the
window holding it. The fix is scoped to `#main-ui-container > .blur-background`, because that
class is shared by six windows and is absolutely positioned in all of them.

---

## E7 — A turn-start briefing *(finding M8's other half)*

**The gap.** The news panel is a LOG: it says what happened, one event at a time. What it could
not say is where any of it left you, so a player who had lost two provinces and gained one had
three cards and no answer to *am I doing well*.

**What was built.** One card, leading each turn's section:

> **The state of the nation** — The treasury took 4,180 gold this turn. You hold 24 territories
> and lie 4th of 188 in the race for Continental Supremacy, 27% of the way there. Alsace and
> Baden are held by fewer troops than the enemy facing them. 2 other borders stand the same way.
> You are besieging 1 territory, and under siege in 1 territory.

Leigh chose all four of the things it covers: income, standing, weakened borders, sieges.

**Five things worth carrying forward.**

- **The border warning is new information, not a restatement.** The game had never warned about
  a massing army. The AI has had the measurement from the beginning —
  `strongestEnemyPowerAgainst()` is how a country sizes the reserve it keeps on each border —
  and the player had no equivalent at all, which is an asymmetry rather than a difficulty
  setting. It is a RAW comparison of the two army figures with no terrain, forts or dice model
  in it: the same shape the AI's own reserve calculation uses, and a real defender's advantage
  is large enough that a properly-modelled warning would fire almost never. It orders by MARGIN
  and not by ratio, because an undefended province is infinite against any attacker and every
  one of them would otherwise tie.
- **It is filed under the turn that has just ENDED, and that is not an off-by-one.**
  `endTurn: advanceTurn`, so the panel hides the turn that has just begun and opens the one
  behind it, where the news is. A briefing filed under the turn it was computed in would sit in
  the hidden section and reach the player a whole turn late. The card names no turn number, so
  nothing reads as inconsistent.
- **The income is read from `turnGainsArrayLastTurn`, not `turnGainsArrayPlayer`.** The income
  pass fills the latter and `newTurnResources()` then rolls it into the former and zeroes it, so
  by the time the briefing runs "last turn's" array holds the money that has just arrived. The
  info panel's own (+/−) columns read the same field for the same reason.
- **Any paragraph may be absent, and a briefing with nothing to say is dropped.** Printing "no
  borders are threatened" every turn is how you train a player to stop reading the one time it
  says otherwise.
- **It is not counted as an action.** The section header reads "N actions, M involving you", and
  a briefing is written every turn whether or not anything happened — counting it made every
  quiet turn report that something had happened to the player when nothing had.

**It shares its ranking with the Standings tab**, through `rankedWorldStandings()`, so the card
and the table cannot tell the player two different things about where they stand.

---

## What the panel had already, and what only looked new

Worth recording because it cost a round trip to establish. The request that produced E3 was for
"an event log that the player actually sees, with its own button and a toggle for appearing each
turn". **All three already existed** — `src/ui/components/ActivityPanel.js`, a button in the left
map chrome whose icon was already a sheet of paper with three ruled lines, and a repeat switch
sharing the info panel's control and class. What was genuinely missing was the *cards*, the
*disasters* and the *leaders*.

The decision taken was to rebuild that panel rather than add a second one beside it, and the
file's own header had already argued the case: *two panels that both offer "show me this every
turn" and offer it differently is how a settings screen starts.*
