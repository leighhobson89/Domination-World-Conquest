// The Dominapedia's table of contents, and the walk over it.
//
// Refactor plan Phase 7.6. The Help button has been inert since the menu was
// built; this is the book it opens. The catalogue is DATA -- a list of sections,
// each holding sub-topics, each holding body blocks -- and the panel that renders
// it (`src/ui/components/Dominapedia.js`) knows nothing about what is in here.
// Adding a topic is one entry in this file and no change to the component, which
// is the same arrangement `src/ui/infoTable/columns.js` records for the info
// panel's five tabs and `src/ui/theme/themes.js` for the palettes.
//
// This file touches no DOM, and it imports ONLY `config/balance.js` -- which itself imports
// nothing, so the property that matters is intact. That one import is deliberate and it
// serves the rule below: a page that QUOTES a balance figure reads it rather than remembering
// it, so a tuning pass moves the manual with the game instead of leaving it confidently
// wrong. That has happened twice already.
//
// This file touches no DOM. That is what lets the navigation
// -- the part with the interesting edge cases -- be unit-tested in Node:
// `tests/unit/ui-dominapedia-topics.spec.js` pins the wrap at both ends of the
// book without opening a browser.
//
// Three shapes are worth stating, because content has been poured into them:
//
//   * **A body is BLOCKS, not a string of markup.** `{ kind: "p" | "h" | "ul" |
//     "table" | "planned" | "todo" }` is the whole vocabulary. Prose written as
//     HTML would put the panel's styling decisions inside the content, and every
//     later change to how a Dominapedia page looks would then be a hundred content
//     edits.
//   * **`summary` is one sentence saying what the page answers**, shown under the
//     title on the page itself and used as the link's tooltip, so it is never a
//     restatement of the title.
//   * **Ids are stable identity and are what Previous / Next carry.** They are
//     also what a future "open the Dominapedia at THIS topic" link from a game
//     screen would name, so rename a title freely and an id never.
//
// ---------------------------------------------------------------------------
// WHAT IS TRUE HERE, AND WHAT IS PROPOSED
// ---------------------------------------------------------------------------
//
// The pages are written from the code, and the numbers in them are the numbers in
// `src/config/balance.js` and the rule modules under `src/rules/`. When a number
// moves there, it has to move here too -- that is the cost of a manual that quotes
// figures, and quoting them is worth it, because a help system that says "forts
// help a bit" teaches nothing.
//
// Anything the game does NOT do yet is a `planned` block and never a `p`. That
// distinction is the whole point of the split: this manual doubles as the design
// document the game grew backwards into, so a reader has to be able to tell "this
// is the rule" from "this is the rule we intend". `todo` survives for a page that
// is genuinely unwritten; there are none today, and the helper is kept so that the
// next page added starts honest.
//
// Where a rule is stated that a player would call a bug -- a fortless territory
// having no defensive multiplier at all, a siege with no clock on it -- it is
// stated anyway, plainly, because the player meets it
// whether or not the manual admits to it. `design-notes` is where those are
// collected and named.
//
// THE OTHER HALF OF THAT RULE, learned the expensive way: a manual that is
// confidently wrong is worse than no manual, and nothing here is covered by a test,
// because no test asserts prose. Three pages -- Unit Types, Common Mistakes and
// Design Notes -- said that buying infantry gave one point of force for a thousand
// people and told the player not to bother. It gave a thousand points for a
// thousand people, and had done since 2023; the claim was never checked against
// `armyProdPopPrices`, and the register believed it too (known-issue BR, closed by
// measuring it against the running game). Quote a number here only after reading
// it out of `src/config/balance.js` or `node tools/econ-lab.mjs`.

import {
    allianceShare,
    declarationDiscipline,
    peaceDiscipline,
    PLAYER_GRACE_TURNS
} from "../../config/balance.js";

/** A paragraph. */
const p = (text) => ({ kind: "p", text });
/** A sub-heading inside a page. */
const h = (text) => ({ kind: "h", text });
/** A bulleted list. */
const ul = (...items) => ({ kind: "ul", items });
/**
 * A table of figures.
 *
 * Reference pages are mostly numbers -- unit costs, upgrade costs, the disaster
 * table -- and a bulleted list of "Infantry: 10 gold, 1,000 people, no oil" is a
 * table with the columns hidden. `headers` and each row are plain strings; the
 * component does the markup, so a theme change reaches these like everything else.
 */
const table = (headers, rows) => ({ kind: "table", headers, rows });
/**
 * A rule that is DESIGNED but not in the game yet.
 *
 * Marked rather than written as prose because this manual is also the design
 * document, and a reader deciding what to build next has to be able to see the
 * seam. Everything in a `planned` block is a proposal; nothing in one is enforced
 * by any code today.
 */
const planned = (text) => ({ kind: "planned", text });
/**
 * The standing note that a page is not written yet.
 *
 * It is a block of its own rather than a paragraph so the stylesheet can mark it,
 * and so that "which pages are still placeholders" is a grep for one token rather
 * than a reading of every body in the file. No page uses it today.
 */
// eslint-disable-next-line no-unused-vars
const todo = (text) => ({ kind: "todo", text });

/**
 * The book. Order here IS reading order, and reading order is what the Previous
 * and Next buttons walk.
 */
//THE MANUAL QUOTES REAL NUMBERS AND MUST READ THEM RATHER THAN REMEMBER THEM. The War
//section had to be rewritten wholesale once because it still described a combat model that
//had been deleted, and three pages told the player infantry were not worth buying when they
//are the joint best value in the game. Importing the dials means a balance change that moves
//one of these figures moves the page with it.
export const DOMINAPEDIA_SECTIONS = Object.freeze(
    [
        {
            id: "getting-started",
            title: "Getting Started",
            topics: [
                {
                    id: "what-is-domination",
                    title: "What Is Domination",
                    summary: "The shape of the game, and what makes it its own thing.",
                    body: [
                        p(
                            "Domination is a turn-based game of world conquest. You take one " +
                                "country, every other country is played by the computer, and the " +
                                "map is the whole of it — there is no board off to one side."
                        ),
                        p(
                            "The world is 359 territories grouped into 207 countries across six " +
                                "continents, drawn from a real political map. A country is simply " +
                                "every territory currently flying one flag, so countries grow, " +
                                "shrink and disappear as territories change hands."
                        ),
                        h("The territory is the unit of play"),
                        p(
                            "This is the thing to understand before anything else. A country is " +
                                "a label; a TERRITORY is where everything actually happens. Each " +
                                "one separately holds its own gold, oil, food, construction " +
                                "materials, population, buildings and army. Nothing is pooled. " +
                                "The top bar shows your country's totals, but those totals are " +
                                "just a sum, and you spend from the territory you are standing in."
                        ),
                        p(
                            "So a rich empire can still have a starving front line, and a " +
                                "territory sitting on an ocean of oil is no help to the one next " +
                                "door that cannot fuel its aircraft."
                        ),
                        h("A turn, in one line"),
                        p(
                            "Income arrives, then you buy and build, then you move and fight, " +
                                "then every AI country does the same. Repeat."
                        ),
                        h("What makes it not Risk"),
                        ul(
                            "There is an economy, and it is per-territory. Four resources, each " +
                                "with its own capacity, regrowth and uses.",
                            "Oil decides how much of your army can actually fight. Vehicles you " +
                                "cannot fuel are still yours, and are still useless this turn.",
                            "An army costs gold every turn just by existing. Building one is a " +
                                "commitment, not a purchase.",
                            "There are two ways to take ground — an open battle decided in one " +
                                "sitting, and a siege that grinds a territory down over many " +
                                "turns — and they want completely different armies.",
                            "Every AI country has a randomly generated leader with a personality " +
                                "that decides how it plays."
                        ),
                    ],
                },
                {
                    id: "how-to-win",
                    title: "Goals and Victory",
                    summary: "The five goals, how each one is won, and how a game ends.",
                    body: [
                        p(
                            "Every game is played for a GOAL, and you choose it before you " +
                                "choose your country. The chooser is the first screen a new " +
                                "game opens on and it cannot be skipped — Escape takes you " +
                                "back to the title screen, not past the question."
                        ),
                        p(
                            "The goal is not a difficulty setting and it is not yours alone. " +
                                "Every one of the 206 computer countries is playing for the " +
                                "same condition you are, adapts how it fights to suit it, and " +
                                "any of them can get there first. Whoever completes it first " +
                                "ends the game."
                        ),
                        h("The five goals"),
                        table(
                            ["Goal", "Won by", "Scales offered"],
                            [
                                [
                                    "Continental Supremacy",
                                    "Every territory on N continents, outright",
                                    "2, 3 or 4"
                                ],
                                [
                                    "Domination",
                                    "A share of the world's land AREA",
                                    "40%, 60% or 80%"
                                ],
                                [
                                    "Great Powers",
                                    "The whole homeland of N of the five powers",
                                    "Any 3, or all 5"
                                ],
                                [
                                    "World Conquest",
                                    "Every territory on the map",
                                    "None"
                                ],
                                [
                                    "Timed Game",
                                    "The largest empire by land area at the deadline",
                                    "200, 350 or 500 turns"
                                ]
                            ]
                        ),
                        p(
                            "The default is Continental Supremacy at three continents, which " +
                                "is the shortest genuinely decisive game this map offers. The " +
                                "chooser describes each goal in full as you browse them, and " +
                                "under Great Powers it names the five countries by name."
                        ),
                        h("Losing"),
                        p(
                            "You lose the moment you hold no territories at all. That rule " +
                                "runs underneath every goal — holding nothing is losing " +
                                "whatever you were playing for — and it is why a " +
                                "one-territory country is a real handicap rather than a slow " +
                                "start."
                        ),
                        h("Three things worth knowing"),
                        ul(
                            "CONTINENTS ARE COUNTED IN TERRITORIES; DOMINATION COUNTS AREA. A " +
                                "Caribbean island finishes a continent as surely as Siberia " +
                                "does, and is worth almost nothing towards a land share. The " +
                                "two goals want different parts of the map taken.",
                            "GREAT POWERS ROUTES THROUGH THIRD PARTIES. If somebody else takes " +
                                "half of a power's homeland before you do, you take those " +
                                "territories from THEM instead. The objective stays reachable " +
                                "and the route to it becomes a different war. A power's own " +
                                "homeland never counts towards its own goal, so no computer " +
                                "country starts a five-power game a fifth of the way home.",
                            "A TIMED GAME CANNOT BE WON EARLY. However far ahead you are it is " +
                                "scored at the end of the final turn — and the computer " +
                                "countries grow steadily more reckless as the deadline nears, " +
                                "because there is nothing left to conserve."
                        ),
                        h("A continent held whole is worth something now"),
                        p(
                            "Holding every territory on a continent raises the gold income of " +
                                "every territory on it by half, and the oil, food and " +
                                "construction-materials capacities of each by a quarter. All " +
                                "or nothing, and measured by exactly the threshold Continental " +
                                "Supremacy is won at. The full rule and the per-continent " +
                                "figures are under \"Income and Upkeep\"."
                        ),
                        p(
                            "That makes Continental Supremacy the one goal whose objective and " +
                                "whose reward are the same thing: a country that finishes its " +
                                "first continent gets better at finishing its second. It is " +
                                "worth taking seriously under the other four goals too — a " +
                                "completed continent is the cheapest permanent economy in the " +
                                "game, whatever you are ultimately playing for."
                        ),
                        h("Where you stand"),
                        p(
                            "The phase bar carries one line of progress towards whatever you " +
                                "chose: \"Continental: 1 of 3 continents\", " +
                                "\"Domination: 24% of 60%\", " +
                                "\"Great Powers: 1 of 3 (France 4/7)\". It is the " +
                                "same measurement every computer country reads about itself, " +
                                "so you and the country trying to beat you are never looking " +
                                "at two different numbers. It is restated at each turn " +
                                "boundary, which is the only point at which territory has " +
                                "changed hands."
                        ),
                        p(
                            "When it ends you get a screen: what you were playing for, whether " +
                                "you won it, and the final standings. Three ways off it — New " +
                                "Game, Main Menu, and View Final Map, which simply takes the " +
                                "panel down so you can look at the board you finished on."
                        ),
                        h("What the AI is trying to do"),
                        p(
                            "The same thing you are, and it reads the goal you chose. Each " +
                                "computer country commits to continents of its own, picks one " +
                                "neighbouring country to absorb, keeps both commitments across " +
                                "turns rather than re-choosing every turn, and weighs every " +
                                "target by whether taking it advances the plan. What the goal " +
                                "changes is how many continents it commits to, how much it " +
                                "values raw land, whether it will ever settle for holding what " +
                                "it has, and — under Great Powers — which countries " +
                                "it goes looking for. See \"How the AI Thinks\"."
                        ),
                        p(
                            "Two consequences for you. A neighbour that has committed to YOUR " +
                                "continent is a permanent problem and will keep coming back " +
                                "for the same few territories; one whose continents are " +
                                "elsewhere will largely leave you alone until you threaten " +
                                "something it holds. And the whole world grows more aggressive " +
                                "as any one country pulls ahead: every country measures the " +
                                "strongest rival's share of the map and spends its attacks " +
                                "harder as that share grows. Take a commanding lead and you " +
                                "will be made to feel it."
                        ),
                        h("What you are optimising for, whichever goal you took"),
                        ul(
                            "LAND AREA is the base of everything. It drives gold, it drives " +
                                "resource capacity, it is what a Domination victory counts and " +
                                "it is what a Timed Game is scored on. Territory count is a " +
                                "poor proxy for it.",
                            "PRODUCTIVE POPULATION is the real currency. Gold is easy to come " +
                                "by; the people to crew what gold buys are not, and running " +
                                "out of them stops your army growing no matter how rich you " +
                                "are.",
                            "OIL decides how much of the army you own is an army you can use. " +
                                "A fleet with no fuel is a line in a table.",
                            "A DEFENSIBLE FRONTIER. Every territory you take is a territory " +
                                "someone can take back, and a conquered one sits out one to " +
                                "three turns before it can do anything at all."
                        ),
                    ],
                },
                {
                    id: "choosing-a-country",
                    title: "Choosing a Country",
                    summary: "What the selection screen is asking, and what is locked.",
                    body: [
                        p(
                            "This is the second question a new game asks. The first is the " +
                                "GOAL — see \"Goals and Victory\" — and it is worth " +
                                "answering them together, because the goal decides what a good " +
                                "starting position even is. A Domination game rewards whoever " +
                                "can reach big, empty, awkward land; Continental Supremacy " +
                                "rewards a country with a continent it can realistically " +
                                "finish; Great Powers puts five named countries on the map " +
                                "that you will have to break, and the chooser names them, so " +
                                "look at who you would be starting next door to."
                        ),
                        p(
                            "Then you pick the country you will play and the colour it is " +
                                "drawn in. Click any territory on the map and you take the " +
                                "whole country that holds it — every territory flying that " +
                                "flag, not just the one you clicked."
                        ),
                        h("The five locked countries"),
                        p(
                            "The five strongest countries on the map cannot be chosen. They are " +
                                "painted in their own colour muted towards grey, so they still " +
                                "read as part of the world rather than as a rendering failure."
                        ),
                        p(
                            "This is deliberate and it is not a difficulty setting. Starting as " +
                                "the largest power on the map is not a hard game or an easy one, " +
                                "it is a different game — the interesting part of Domination is " +
                                "the climb, and starting at the top removes it. The cut is at " +
                                "the top five precisely because that is where the superpowers " +
                                "stop: every genuine mid-sized power is still yours to take."
                        ),
                        p(
                            "Strength here is not army size. It is a single score built from a " +
                                "country's land area, its stockpiled resources, its development " +
                                "index, its population, its continent and its army."
                        ),
                        p(
                            "These same five are the powers a Great Powers game asks you to " +
                                "break. That is not a coincidence and it is not two separate " +
                                "lists: the lock and the goal read one derivation, so the " +
                                "countries you cannot play as under any goal are exactly the " +
                                "countries you are hunting under that one."
                        ),
                        h("How to read a starting position"),
                        p(
                            "Click around before committing — the bottom bar fills in for " +
                                "whatever you hover, and it is telling you most of what you need."
                        ),
                        ul(
                            "HOW MANY TERRITORIES. One-territory countries are a real handicap: " +
                                "there is nowhere to transfer to, nothing to fall back on, and " +
                                "one lost battle is the whole game.",
                            "WHICH CONTINENT. This is the single biggest economic difference " +
                                "between two otherwise identical countries. Europe and North " +
                                "America earn gold at full rate; Africa earns 30% of it. See " +
                                "\"Income and Upkeep\" for the full table.",
                            "DEVELOPMENT INDEX. It multiplies gold income, makes buildings " +
                                "cheaper, strengthens forts, improves your odds when attacking, " +
                                "and reduces deaths in a famine. It is the most quietly " +
                                "important number a territory has, and nothing in the game " +
                                "raises it.",
                            "MOUNTAINS AND COASTLINE. Mountains are free permanent defence. " +
                                "Being landlocked is worth a small defence bonus too, and it " +
                                "keeps enemy naval units from counting for much.",
                            "WHO IS NEXT DOOR. Look at what borders you before you look at what " +
                                "you own."
                        ),
                        h("A reasonable first choice"),
                        p(
                            "A mid-sized European or North American country with three or four " +
                                "territories, a high development index and at least one " +
                                "mountainous or landlocked province to fall back on. Germany, " +
                                "Italy, Japan and the United Kingdom are all deliberately " +
                                "playable and all teach the game well."
                        ),
                        h("The colour"),
                        p(
                            "Pick from the grid of 256 swatches. The map repaints as you click, " +
                                "so try a few — you will be looking at it for a long time, and " +
                                "a colour close to a neighbour's makes the front line hard to " +
                                "read."
                        ),
                    ],
                },
                {
                    id: "reading-the-screen",
                    title: "Reading the Screen",
                    summary: "Every bar, button and panel, and what each one is for.",
                    body: [
                        p("The screen is four things arranged around one map."),
                        h("The top bar — your whole country"),
                        p(
                            "Gold, oil, food, construction materials, productive population, " +
                                "land area and army, summed over every territory you own. It is " +
                                "a scoreboard, not a wallet: you cannot spend from it, because " +
                                "resources live in territories."
                        ),
                        h("The bottom bar — the territory you last clicked"),
                        p(
                            "Flag, name, mountain defence, the four resources, population, area " +
                                "and military. This is the bar you actually make decisions from."
                        ),
                        h("The phase bar — whose turn it is"),
                        p(
                            "Down the left. It carries the phase title, the flag, the colour " +
                                "picker while you are still choosing, and the button that " +
                                "advances the phase — BUY / UPGRADE, then MILITARY, then END " +
                                "TURN. It folds up out of the way if you want the map back, and " +
                                "the advance button stays put when it does."
                        ),
                        h("The chrome round the edges"),
                        ul(
                            "Top left, the hamburger — the main menu, mid-game. Escape does the " +
                                "same thing.",
                            "Top right, the music note — the audio panel: play, pause, next " +
                                "track, and a volume and a mute for each of music and effects.",
                            "Below it, the continent view — switches the map from political " +
                                "colouring to continent colouring.",
                            "Below that, the globe — the information panel. Four tabs of " +
                                "everything you own, and a fifth, Standings, of everyone else: " +
                                "the world in order of how close each country is to winning the " +
                                "goal being played, with you always on it however far down.",
                            "Bottom right, the autosave spinner. It appears when the game saves " +
                                "itself and fades after a couple of seconds."
                        ),
                        h("The windows that float"),
                        p(
                            "Buy Military, Upgrade Territory, the transfer/attack table, the " +
                                "battle screen and the activity feed all open as windows you can " +
                                "drag by the title bar. Whichever you touched last sits on top."
                        ),
                        h("The move button"),
                        p(
                            "The one control that changes what it says depending on what you " +
                                "clicked. It appears near the selected territory during the " +
                                "military phase and reads TRANSFER, ATTACK, VIEW SIEGE or " +
                                "DEACTIVATED. It is telling you what this pair of clicks would " +
                                "do, and if it is greyed out it is telling you why not."
                        ),
                    ],
                },
                {
                    id: "your-first-turn",
                    title: "Your First Turn",
                    summary: "A walkthrough of one turn, start to finish.",
                    body: [
                        p(
                            "Do these in order. The order is not arbitrary — each step spends " +
                                "something the next one needs to know about."
                        ),
                        h("1. Look before you spend"),
                        p(
                            "Open the territory panel with the globe button. The Summary tab " +
                                "shows every territory you own with its income and losses as " +
                                "plus and minus figures. Anything red is a problem you will have " +
                                "again next turn, so it is worth fixing before you buy anything."
                        ),
                        p(
                            "The columns to check first are Food(+/-) — a negative one is a " +
                                "famine in progress — and Oil Demand against Oil, because if " +
                                "demand is higher you are already losing the use of vehicles you " +
                                "own."
                        ),
                        h("2. Build before you buy"),
                        p(
                            "Click a territory, then the upgrade button in the bottom bar. Your " +
                                "first construction anywhere should be a FORT. It is not close: " +
                                "a territory with no forts, no mountains and a coastline has no " +
                                "defensive multiplier at all, and one fort doubles its defence. " +
                                "See \"Terrain and Defence\"."
                        ),
                        p(
                            "After that, a farm if food is tight, an oil well if you intend to " +
                                "own vehicles, a forest if you intend to keep building."
                        ),
                        h("3. Buy units — carefully"),
                        p(
                            "Buy Military opens from the same bottom bar. Read \"Unit Types\" " +
                                "before your first purchase; the four units are not four " +
                                "flavours of the same thing and one of them is very nearly a " +
                                "trap."
                        ),
                        h("4. Advance to MILITARY"),
                        p(
                            "The phase button. You cannot build or buy after this, so do not " +
                                "advance until you have finished."
                        ),
                        h("5. Move and attack"),
                        p(
                            "Click one of your territories and the ones it can reach light up. " +
                                "Click a second territory of your own and the button reads " +
                                "TRANSFER; click a reachable enemy territory and it reads " +
                                "ATTACK. Nothing is committed until you send the army."
                        ),
                        p(
                            "On turn one, do not attack. Look at what your odds would be, note " +
                                "which neighbours you can reach at all, and spend the turn " +
                                "consolidating. An attack launched from an unfortified territory " +
                                "leaves that territory empty and reachable."
                        ),
                        h("6. END TURN"),
                        p(
                            "Then the AI moves. The button will read AI MOVING; when it comes " +
                                "back, open the activity feed and see what the world did while " +
                                "you were not looking."
                        ),
                    ],
                },
            ],
        },
        {
            id: "the-turn",
            title: "The Turn",
            topics: [
                {
                    id: "the-shape-of-a-turn",
                    title: "The Shape of a Turn",
                    summary: "Everything that happens before you are allowed to touch anything.",
                    body: [
                        p(
                            "A turn does not begin when the button becomes clickable. Six " +
                                "things have already happened by then, in this order, and every " +
                                "one of them can change what you were planning to do."
                        ),
                        h("1. Lockouts expire"),
                        p(
                            "Territories conquered one to three turns ago come back to life and " +
                                "can act again."
                        ),
                        h("2. Every siege ticks"),
                        p(
                            "Yours and everyone else's, once each. A siege can end here — the " +
                                "territory falls, or the besieging army is arrested — without " +
                                "you having done anything."
                        ),
                        h("3. Armies in transit come home"),
                        p(
                            "Units that survived a battle and did not garrison the ground are " +
                                "returned to the territories they were sent from, in the same " +
                                "proportions they left in. A clean retreat takes one turn; a " +
                                "scatter takes two."
                        ),
                        h("4. The disaster roll"),
                        p(
                            "One roll for the whole world. If it fires, one of four disasters " +
                                "hits every territory on the map that fails its own coin flip — " +
                                "yours and the AI's alike. See \"Random Events\"."
                        ),
                        h("5. The economy runs"),
                        p(
                            "Every territory earns gold, regrows its stocks towards their " +
                                "capacities, feeds its people and its army, pays its army's " +
                                "upkeep, and grows or starves. A disaster turn suppresses the " +
                                "regrowth, so you get one turn to look at the damage before it " +
                                "starts healing over."
                        ),
                        h("6. Income is already spent"),
                        p(
                            "By the time the BUY / UPGRADE phase opens, the number in the top " +
                                "bar is what is left after upkeep, not what you earned."
                        ),
                        h("The three phases"),
                        ul(
                            "BUY / UPGRADE — the only phase in which anything can be built or " +
                                "bought.",
                            "MILITARY — the only phase in which anything can move or attack.",
                            "AI — every computer country takes its turn. You cannot act."
                        ),
                        p(
                            "The turn counter advances at the END of the AI phase, which is " +
                                "worth knowing when you read the activity feed: everything the " +
                                "AI just did to you is filed under the turn that has only now " +
                                "finished."
                        ),
                    ],
                },
                {
                    id: "buy-upgrade-phase",
                    title: "Buy / Upgrade Phase",
                    summary: "Spending what last turn earned.",
                    body: [
                        p(
                            "A turn opens with your income already paid. This is the phase in " +
                                "which it is spent: military units in one window, territory " +
                                "improvements in the other. Both open from the bottom bar once " +
                                "you have selected a territory you own."
                        ),
                        h("Spending is per-territory, with a fallback"),
                        p(
                            "You spend the selected territory's gold, its construction " +
                                "materials and its productive population. If that territory " +
                                "cannot cover the bill on its own, the shortfall is drawn " +
                                "automatically from your other territories — so a poor frontier " +
                                "province can be developed out of a rich capital's pocket, but " +
                                "only for gold and manpower. Construction materials do not " +
                                "travel."
                        ),
                        h("What both windows tell you"),
                        p(
                            "Every row greys out when you cannot afford it, and the reason is " +
                                "always one of: not enough gold, not enough productive " +
                                "population, not enough construction materials, or the cap has " +
                                "been reached. The step multipliers — ×1, ×10, ×100, ×1k — are " +
                                "for buying units in bulk without a hundred clicks."
                        ),
                        h("What to spend on, roughly in order"),
                        ul(
                            "The first fort in any territory that has no defensive bonus at " +
                                "all. Nothing else in the game doubles a number for one purchase.",
                            "Farms wherever food is negative. A famine kills civilians, and " +
                                "civilians are where productive population comes from.",
                            "Oil wells before, not after, buying vehicles. Buying a fleet you " +
                                "cannot fuel wastes the gold and the manpower both.",
                            "Forests only when you are building steadily — they raise the " +
                                "ceiling on construction materials, which is only worth " +
                                "anything if you are spending them.",
                            "Units last, once you know what the territory can feed, fuel and " +
                                "pay for."
                        ),
                        h("Do not advance early"),
                        p(
                            "There is no way back to this phase within a turn. Once the phase " +
                                "button reads MILITARY, nothing more can be built or bought " +
                                "until next turn."
                        ),
                    ],
                },
                {
                    id: "military-phase",
                    title: "Military Phase",
                    summary: "Moving armies, and starting battles.",
                    body: [
                        p(
                            "Click one of your territories. Everything it can reach is " +
                                "highlighted. What you click second decides what the move button " +
                                "offers."
                        ),
                        h("The five things the button can say"),
                        table(
                            ["Button", "What you clicked", "What it does"],
                            [
                                [
                                    "TRANSFER",
                                    "another territory of yours",
                                    "opens the allocation table; units move and stay",
                                ],
                                [
                                    "ATTACK",
                                    "a reachable enemy territory",
                                    "opens the attack table and the odds",
                                ],
                                [
                                    "VIEW SIEGE (n)",
                                    "a territory already under siege",
                                    "reopens that siege, n turns in",
                                ],
                                [
                                    "DEACTIVATED (n)",
                                    "a territory you took n turns ago",
                                    "nothing — it is serving its lockout",
                                ],
                                ["nothing", "an enemy you cannot reach", "nothing"],
                            ]
                        ),
                        h("Transfer and attack are the same table"),
                        p(
                            "Both open the same allocation window: a row per territory, a " +
                                "column per unit type, and steppers to say how many of each go. " +
                                "The difference is that a transfer can only draw from one " +
                                "territory at a time, while an attack can gather units from " +
                                "every territory of yours that reaches the target, and shows a " +
                                "live probability bar as you add to it."
                        ),
                        h("Reach"),
                        p(
                            "Reach is a fixed property of the map — a precomputed list of which " +
                                "territories can interact with which, hand-patched for the " +
                                "island cases the geometry gets wrong. It is not a movement " +
                                "allowance and it does not change with your units: a naval fleet " +
                                "reaches exactly what an infantryman standing in the same " +
                                "territory reaches."
                        ),
                        planned(
                            "Naval and air units have no movement rules of their own. There is " +
                                "no sea travel, no range, no transport and no amphibious " +
                                "landing; coastal-ness only gates whether naval units count for " +
                                "anything. Real movement rules per unit type are the largest " +
                                "single gap in the military model."
                        ),
                        h("The lockout"),
                        p(
                            "A territory you conquered is deactivated for one to three turns, " +
                                "chosen at random. It cannot attack and it cannot transfer, " +
                                "though it still earns, still builds and can still be attacked. " +
                                "This is what stops a single strong army from chaining across a " +
                                "continent in one turn, and it is the main reason a broad " +
                                "advance beats a deep one."
                        ),
                    ],
                },
                {
                    id: "the-ai-turn",
                    title: "The AI Turn",
                    summary: "What happens while the button says AI MOVING.",
                    body: [
                        p(
                            "Every AI country takes a full turn, one after another, in silence. " +
                                "They earn, they build, they buy, they besiege and they attack, " +
                                "including each other — most of what happens on the map in any " +
                                "given turn has nothing to do with you."
                        ),
                        h("What surfaces to you"),
                        ul(
                            "A battle results screen, if an AI attacked you. It can appear a " +
                                "beat after the turn counter has already moved.",
                            "The AI dialogue box, if an AI wants to buy you out of a siege. " +
                                "See \"Diplomacy\".",
                            "The news panel, which is where everything else went — one item " +
                                "for each thing that happened to you, and a compact list of " +
                                "everything the rest of the world did."
                        ),
                        h("What does not surface, and should"),
                        planned(
                            "There is no notification when a neighbour's border moves, no " +
                                "warning when an army massing next door is larger than the " +
                                "garrison facing it, and no summary screen at the end of the AI " +
                                "phase. The activity feed covers the record; it does not cover " +
                                "the alarm."
                        ),
                        h("A note on speed"),
                        p(
                            "All 206 computer countries run a full plan-and-execute pipeline " +
                                "every turn, which is why the phase takes as long as it does. " +
                                "Consolidating them into a smaller number of real powers is on " +
                                "the list; see \"Design Notes\"."
                        ),
                    ],
                },
                {
                    id: "the-activity-feed",
                    title: "The Activity Feed",
                    summary: "The military log, turn by turn.",
                    body: [
                        p(
                            "The feed records what happened, not what anyone intends: " +
                                "conquests, failed attacks, sieges begun, sieges still running, " +
                                "sieges lifted and sieges that turned into battles. It is " +
                                "grouped by the turn each thing happened in, newest at the top, " +
                                "and it keeps the last fifty turns."
                        ),
                        h("Reading it at a glance"),
                        ul(
                            "GREEN is a conquest — somebody took ground. It is green whoever " +
                                "did it, because somebody won.",
                            "RED is a loss: an attack that failed, or a conquest where the " +
                                "territory was taken from YOU.",
                            "AMBER is anything to do with a siege, in all of its states.",
                            "LARGER TEXT means you were involved, on either side. Size and " +
                                "colour are separate: a defeat of yours is red and large, a " +
                                "distant war between two countries you have never met is small."
                        ),
                        h("What it deliberately does not show"),
                        p(
                            "Economy and construction are not in it. It is a military log, and " +
                                "a feed that also reported every farm built anywhere would " +
                                "report nothing useful."
                        ),
                        p(
                            "Nor does it show what the AI is PLANNING. That would be a cheat. " +
                                "The AI's intentions do exist, at three horizons, but they go to " +
                                "the developer console and never to the screen."
                        ),
                        h("The turn boundary catches people out"),
                        p(
                            "The turn counter advances after the AI has moved, so the AI's " +
                                "actions during turn N are filed under turn N — and when the " +
                                "feed opens on the quiet start of turn N+1, it will show you " +
                                "turn N, because that is where everything worth reading is."
                        ),
                    ],
                },
            ],
        },
        {
            id: "territory",
            title: "Territory",
            topics: [
                {
                    id: "owning-territory",
                    title: "Owning Territory",
                    summary: "What a territory gives you while you hold it.",
                    body: [
                        p(
                            "Every territory is an independent little economy. Holding it gives " +
                                "you all of the following, and losing it takes all of them away " +
                                "at once."
                        ),
                        table(
                            ["What it holds", "What it does"],
                            [
                                ["Area", "drives gold income, resource capacity and land-area score"],
                                ["Population", "grows or starves; is where productive population comes from"],
                                ["Productive population", "the manpower that crews everything you buy"],
                                ["Gold", "earned each turn, spent on everything"],
                                ["Oil, food, construction materials", "stocks that regrow towards a capacity"],
                                ["Development index", "a fixed multiplier on income, building cost, forts and combat"],
                                ["Buildings", "up to five each of farm, forest, oil well and fort"],
                                ["Army", "four unit types, garrisoning that territory and no other"],
                            ]
                        ),
                        h("What changes the moment it changes hands"),
                        ul(
                            "The flag, and therefore which country's totals it counts towards.",
                            "The garrison — whatever survived the battle occupies it, and " +
                                "whatever the defenders had is gone or absorbed.",
                            "It is deactivated for one to three turns and cannot act.",
                            "Its buildings survive. A territory taken after a long siege is " +
                                "worth much less than one stormed quickly, because a siege " +
                                "destroys buildings and permanently reduces food capacity."
                        ),
                        h("What does NOT change"),
                        p(
                            "Its area, its development index, its mountains, its coastline and " +
                                "its name. Its original owner is also remembered forever, which " +
                                "matters because AI leaders have a reconquista trait and will " +
                                "keep coming back for land that used to be theirs."
                        ),
                        h("A besieged territory is cut off"),
                        p(
                            "It earns a QUARTER of its gold, oil and construction materials for " +
                                "as long as the siege lasts, and its army's upkeep is charged in " +
                                "full against that quarter. It also builds nothing at all: no " +
                                "farms, no forests, no oil wells and no forts. Every row in its " +
                                "upgrade window reads \"Under Siege\"."
                        ),
                        p(
                            "The quarter is what makes a siege something you can answer. " +
                                "Earlier versions froze a besieged territory at zero, " +
                                "indefinitely, with no counter-play at all — and nothing ends a " +
                                "siege except an arrest or a conquest, so a player besieged on " +
                                "turn 3 was still frozen on turn 14. On a quarter you are still " +
                                "accumulating, slowly, toward the army that lifts it. Food is " +
                                "not reduced: starvation is what a siege does, and taxing the " +
                                "food as well would be charging for the siege twice."
                        ),
                    ],
                },
                {
                    id: "terrain-and-defence",
                    title: "Terrain and Defence",
                    summary: "Mountains, coasts, forts, and what fortification actually does to an attack.",
                    body: [
                        p(
                            "Fortification is the one defensive investment you can make, and it " +
                                "does TWO different things depending on what is being fought. " +
                                "Knowing which is which is most of knowing when to build a fort."
                        ),
                        h("The fortification bonus"),
                        p(
                            "Every territory has one number: its fort bonus plus its mountain " +
                                "bonus. Everything on this page is a band on that number."
                        ),
                        ul(
                            "FORTS — the fort bonus is forts × (forts + 1) × 10, scaled by the " +
                                "development index. Quadratic, so five forts are worth far more " +
                                "than five times one: 1 fort gives 20 points before scaling, 5 " +
                                "forts give 300.",
                            "MOUNTAINS — the territory's mountain factor times 10. Fixed by the " +
                                "map, free, and permanent. It cannot be destroyed by a siege, " +
                                "which forts can.",
                            "BEING LANDLOCKED — a flat 10 points for any non-coastal territory."
                        ),
                        h("In an open battle, fortification takes DICE off the attacker"),
                        table(
                            ["Fort bonus + mountain bonus", "Effect on an attacker"],
                            [
                                ["under 25", "none"],
                                ["25 to 99", "rolls 1 fewer die, all battle"],
                                ["100 or more", "rolls 2 fewer dice, all battle"],
                            ]
                        ),
                        p(
                            "Dice, not strength — and that is the strongest form the bonus could " +
                                "take. A die the attacker does not roll is a pairing they cannot " +
                                "contest, and no amount of force wins it back. One fort is a " +
                                "nuisance, two is a die, three is a fortress."
                        ),
                        p(
                            "Note what this means for an unfortified territory: it defends with " +
                                "its garrison and nothing else. A large garrison in a flat, " +
                                "coastal, fortless territory is not defenceless — it simply " +
                                "brings no terrain to the fight, and an attacker with comparable " +
                                "force will roll comparable dice."
                        ),
                        h("In a SIEGE, fortification is the whole contest"),
                        p(
                            "A siege compares the besieger's siege score against this same " +
                                "number. Forts are literally what keeps a siege alive: a siege " +
                                "cannot take a territory until its forts are gone, and building " +
                                "one more fort under siege is the only move that directly lowers " +
                                "the besieger's margin."
                        ),
                        h("The multiplier, and where it still applies"),
                        p(
                            "There is an older figure the game still uses in two places: the " +
                                "bonus divided by 15 and rounded UP, applied as a multiplier to " +
                                "the defending army. It appears in the odds bar on the attack " +
                                "screen and in the AI's threat assessment. It does NOT appear in " +
                                "the dice model, so it decides no open battle — which is why the " +
                                "bar and the dice preview can disagree with each other."
                        ),
                        planned(
                            "Two representations of one idea is one too many. The dice model is " +
                                "the one that fights, so the bar should eventually be derived " +
                                "from it rather than from the multiplier — at which point the " +
                                "attack screen would show one number that means one thing."
                        ),
                        h("The area term"),
                        p(
                            "Territory size also enters the defence calculation, and at present " +
                                "it only ever hurts: territories above roughly 350,000 km² " +
                                "defend at LESS than face value, and nothing at all defends at " +
                                "more. The intent was the opposite — small territories are " +
                                "easier to garrison completely and were meant to defend above " +
                                "face value."
                        ),
                        planned(
                            "The small-territory defence bonus is meant to exist and does not. " +
                                "Correcting it changes the odds of every attack on the map, so " +
                                "it belongs to a deliberate balance pass rather than to a quiet " +
                                "fix. It is tracked as known issue AR."
                        ),
                        h("Continent"),
                        p(
                            "The continent you are attacking INTO reduces the attacker's " +
                                "strength. Oceania is the hardest to invade at 0.75, then " +
                                "Africa at 0.81, South America 0.82, Asia 0.87, Europe 0.98 and " +
                                "North America 0.99. The effect is small next to a fort, but it " +
                                "is the tiebreaker between two otherwise equal targets."
                        ),
                    ],
                },
                {
                    id: "upgrading-a-territory",
                    title: "Upgrading a Territory",
                    summary: "Farms, forests, oil wells and forts.",
                    body: [
                        p(
                            "Four buildings, five of each per territory, bought in the Upgrade " +
                                "Territory window during the buy phase."
                        ),
                        table(
                            ["Building", "Base gold", "Base materials", "What it does"],
                            [
                                ["Farm", "200", "500", "food cap. +10% and +100,000"],
                                ["Forest", "200", "500", "materials cap. +10% and +500"],
                                ["Oil Well", "1,100", "200", "oil cap. +10% and +200"],
                                ["Fort", "1,000", "600", "defence bonus, quadratic in the count"],
                            ]
                        ),
                        h("What you actually pay"),
                        p(
                            "The price RISES STEEPLY with the number already standing. It is " +
                                "the base figure multiplied by the count, again by the count, " +
                                "and then by a quarter of the territory's development index — " +
                                "so the ladder is quadratic and the fifth of a kind costs about " +
                                "twenty-six times the first, not five times."
                        ),
                        p(
                            "The development index is the other term, and it scales the price " +
                                "UP: a developed territory pays more for the same building than " +
                                "a poor one. It is a small effect next to the count."
                        ),
                        p(
                            "Buying several at once is cheaper than buying them one a turn. An " +
                                "order is charged at the price of the LAST building in it, so " +
                                "five farms in one transaction cost what a fifth farm costs, " +
                                "where five bought over five turns cost the whole ladder — " +
                                "about 2.2 times as much. The computer countries buy one at a " +
                                "time and pay the full ladder."
                        ),
                        h("Capacity is not stock"),
                        p(
                            "A farm does not give you food. It raises the CEILING that food " +
                                "regrows towards, and the regrowth then closes a fifth of the " +
                                "gap each turn. A farm bought this turn shows up as income over " +
                                "the next several."
                        ),
                        h("The flat half, and why a small territory is worth developing"),
                        p(
                            "Every economic upgrade grants a FLAT amount as well as its ten per " +
                                "cent. On a large territory the percentage swamps it and you " +
                                "will never notice it is there; on a small one the flat part IS " +
                                "the upgrade. A farm on a territory of eight hundred people " +
                                "raises its food ceiling by a hundred thousand and pays for " +
                                "itself in a couple of turns, where ten per cent alone was " +
                                "eighty people and thirteen thousand turns."
                        ),
                        p(
                            "This does not make small territories equal to large ones and is " +
                                "not meant to. China's first farm is still worth three hundred " +
                                "gold a turn against Vatican City's twenty-four. Conquering big " +
                                "rich land is still the fastest way to a big rich economy — the " +
                                "flat term only means that developing what you already hold is " +
                                "a real decision rather than a waste of materials."
                        ),
                        p(
                            "The oil figure is the legible one: five oil wells add exactly the " +
                                "thousand barrels a turn that one naval unit demands. An island " +
                                "with almost no oil under it can fuel a warship if it builds " +
                                "the wells for it."
                        ),
                        h("Which to build"),
                        ul(
                            "FORT first, always, in any territory with no defensive bonus. See " +
                                "\"Terrain and Defence\".",
                            "FARM when food is negative, or when you want the population to " +
                                "grow — population growth is capped by the food surplus.",
                            "OIL WELL before buying vehicles, never after. Oil demand is paid " +
                                "every turn and unpaid demand grounds units.",
                            "FOREST last. It only pays if you are still building; a maxed " +
                                "territory with five forests is storing materials it has nothing " +
                                "to spend on."
                        ),
                        h("The point at which a fort beats another farm"),
                        p(
                            "Immediately, on any frontier territory, and never on an interior " +
                                "one that cannot be reached by an enemy. Forts are the only " +
                                "building a siege destroys on purpose. You cannot build them " +
                                "on a territory that is already besieged in any case — a siege " +
                                "suspends construction entirely — so a fort has to be standing " +
                                "before the siege arrives to be worth anything."
                        ),
                        h("Who pays"),
                        p(
                            "A building is paid for by the territory it stands on, out of that " +
                                "territory's own gold and its own construction materials. This " +
                                "is NOT how buying units works — units are paid for out of the " +
                                "whole country's gold and productive population, wherever in " +
                                "the world it happens to sit. So a rich empire can raise an " +
                                "army anywhere and can only develop a territory that is itself " +
                                "solvent."
                        ),
                    ],
                },
            ],
        },
        {
            id: "economy",
            title: "The Economy",
            topics: [
                {
                    id: "the-four-resources",
                    title: "The Four Resources",
                    summary: "Gold, oil, food and construction materials — and how they differ.",
                    body: [
                        p(
                            "Three of the four work the same way and one does not. That is the " +
                                "distinction to hold on to."
                        ),
                        h("Gold is earned"),
                        p(
                            "Gold is not stored against a capacity. It is income, produced each " +
                                "turn by the productive population, and it is the only resource " +
                                "your army is a drain on. It buys units, buildings and nothing " +
                                "else."
                        ),
                        h("Oil, food and materials are stocked"),
                        p(
                            "Each has a capacity, and each turn the stock moves towards that " +
                                "capacity — quickly when it is below, slowly when it is above. " +
                                "Recovery outpaces spoilage in all three cases, so a territory " +
                                "refills faster than it spills."
                        ),
                        table(
                            ["Resource", "Recovers per turn", "Spoils per turn", "Raised by"],
                            [
                                ["Oil", "30% of the shortfall", "10% of the excess", "oil wells"],
                                ["Food", "20% of the shortfall", "10% of the excess", "farms"],
                                ["Construction materials", "25% of the shortfall", "10% of the excess", "forests"],
                            ]
                        ),
                        h("What each one is for"),
                        ul(
                            "GOLD buys everything and pays the army's upkeep. Running out means " +
                                "you stop growing.",
                            "OIL is demanded every turn by assault, air and naval units. " +
                                "Unmet demand does not cost you anything — it GROUNDS units, " +
                                "which is worse. See \"Income and Upkeep\".",
                            "FOOD feeds civilians and soldiers alike, and is measured in units " +
                                "of ten thousand people fed. Too little is a famine.",
                            "CONSTRUCTION MATERIALS build things, and only build things. " +
                                "Unlike gold, they cannot be drawn from a neighbouring territory " +
                                "— materials are spent where they sit."
                        ),
                        h("Where a materials ceiling comes from"),
                        p(
                            "A territory's construction-materials capacity is set once, at the " +
                                "start of the game, from its LAND AREA, its POPULATION and its " +
                                "development index, with a floor under it so that nowhere is " +
                                "locked out entirely. Because materials buy upgrades and " +
                                "nothing else, this ceiling decides how fast a territory can be " +
                                "developed at all — a quarter of the shortfall regrows each " +
                                "turn, so a low ceiling is a slow one."
                        ),
                        p(
                            "Large land still fills its upgrade slots fastest: China needs one " +
                                "turn of its own regrowth to pay for every building it is " +
                                "allowed, where a small island needs about thirty. The " +
                                "population term is what stops a small DEVELOPED country — " +
                                "Germany, Japan, Singapore — from being ranked with an empty " +
                                "desert of the same size and waiting eighty turns for its first " +
                                "few buildings."
                        ),
                        h("Which runs out first"),
                        p(
                            "Oil, almost always, and usually the same turn you first buy naval " +
                                "units. One naval unit demands 1,000 oil a turn, which is more " +
                                "than three aircraft and ten assault units combined. After that, " +
                                "food, once an army large enough to matter is eating alongside " +
                                "the population."
                        ),
                        h("Nothing is traded, and nothing is transported"),
                        planned(
                            "There is no market, no trade with AI countries, and no way to " +
                                "convert one resource into another. A country drowning in " +
                                "construction materials and starving for oil has no move " +
                                "available to it. A conversion or a trade route is the smallest " +
                                "change that would give the economy a decision in it."
                        ),
                    ],
                },
                {
                    id: "income-and-upkeep",
                    title: "Income and Upkeep",
                    summary: "What arrives each turn, and what is taken out before you see it.",
                    body: [
                        h("Gold income"),
                        p(
                            "A territory's income has two halves. Every territory earns a flat " +
                                "BASE INCOME simply for being yours, and on top of that it earns " +
                                "from its productive population, scaled by its development index, " +
                                "its area and its continent."
                        ),
                        p(
                            "The base is worth knowing about, because it is large. It is about " +
                                "65% of what a middling territory earns in total — so a small " +
                                "territory earns very nearly the same whatever you do to it, " +
                                "while a populous one earns many times the base. Fifty scattered " +
                                "islands are a real income; they are just not an income you can " +
                                "grow. If you want an economy that compounds, you need " +
                                "POPULOUS land, and the food ceiling is what lets population " +
                                "grow into it."
                        ),
                        p(
                            "The earned half is deliberately compressed: it is divided down so " +
                                "the gap between the world's smallest and largest economies " +
                                "stays playable. Without that, the biggest countries would " +
                                "snowball out of reach on turn one."
                        ),
                        p(
                            "The continent multiplier on gold is large enough to be a strategic " +
                                "fact rather than a rounding detail:"
                        ),
                        table(
                            ["Continent", "Gold multiplier", "General multiplier"],
                            [
                                ["Europe", "1.0", "1.0"],
                                ["North America", "1.0", "1.0"],
                                ["Oceania", "0.8", "0.6"],
                                ["Asia", "0.5", "0.7"],
                                ["South America", "0.4", "0.6"],
                                ["Africa", "0.3", "0.5"],
                            ]
                        ),
                        p(
                            "A territory in Africa earns 30% of what an identical territory in " +
                                "Europe earns. If you start in a poor continent, expansion is " +
                                "not optional — it is the only way the economy improves, because " +
                                "nothing raises a development index and nothing changes a " +
                                "continent."
                        ),
                        h("Holding a continent whole"),
                        p(
                            "A country that holds EVERY territory on a continent earns more " +
                                "from every territory on it. It is all or nothing: a continent " +
                                "you hold nine tenths of pays exactly what nine tenths of a " +
                                "continent always paid. The threshold is the same one a " +
                                "Continental Supremacy victory is measured against, so the " +
                                "game only ever counts a continent one way."
                        ),
                        table(
                            ["What", "Multiplier", "Kind"],
                            [
                                ["Gold income", "1.5", "Flow"],
                                ["Oil capacity", "1.25", "Ceiling"],
                                ["Food capacity", "1.25", "Ceiling"],
                                ["Cons. mats. capacity", "1.25", "Ceiling"],
                            ]
                        ),
                        p(
                            "The two numbers differ on purpose. Gold is spent and gone; a raised " +
                                "CAPACITY is a permanent gain that compounds — food capacity is " +
                                "what a population and an army can be fed up to, a larger " +
                                "population is a larger productive population, and productive " +
                                "population is the input to gold income. A capacity bonus " +
                                "therefore arrives in your gold a few turns later, on top of the " +
                                "gold bonus. Equal numbers would not be equal effects."
                        ),
                        p(
                            "It is derived from who owns what, every turn, and never stored. " +
                                "Complete a continent and the bonus is there on the next income " +
                                "pass; lose one territory of it and the bonus is gone on the " +
                                "next. There is no grace period and no ramp."
                        ),
                        p(
                            "The bonus applies to all 206 computer countries exactly as it " +
                                "applies to you. A neighbour that has just finished a continent " +
                                "has become permanently richer, and it will show in what it can " +
                                "field two or three turns later rather than immediately."
                        ),
                        p(
                            "It is an ECONOMIC bonus and deliberately not a combat one. Holding " +
                                "a continent whole never adds a die, a face or a defensive " +
                                "modifier to anything."
                        ),
                        table(
                            ["Continent", "Territories", "Gold mult.", "Held whole"],
                            [
                                ["Asia", "87", "0.5", "0.75"],
                                ["Oceania", "65", "0.8", "1.2"],
                                ["Africa", "59", "0.3", "0.45"],
                                ["Europe", "52", "1.0", "1.5"],
                                ["South America", "49", "0.4", "0.6"],
                                ["North America", "47", "1.0", "1.5"],
                            ]
                        ),
                        p(
                            "OCEANIA IS THE TRAP. It is 65 territories of islands — the second " +
                                "largest continent by count, small in land area, and almost " +
                                "every territory on it needs a naval crossing to reach. It is " +
                                "by a wide margin the hardest continent on the map to complete " +
                                "and it pays no more for being so, because the bonus is a " +
                                "percentage and a percentage rewards the continent that was " +
                                "already earning. If you want a continent bonus early, North " +
                                "America and South America are the two that can be finished."
                        ),
                        p(
                            "Where you can see it: the tooltip on any territory names its " +
                                "continent and how much of it the owner holds, whoever the " +
                                "owner is — so you can read an opponent's progress off the map " +
                                "as easily as your own. The territory panel's Summary tab lists " +
                                "which continents you hold outright, and every capacity figure " +
                                "shown anywhere in the game already includes the bonus."
                        ),
                        h("One treasury, three hundred and fifty-nine labels"),
                        p(
                            "Gold is shown per territory everywhere in the game, and for buying " +
                                "UNITS that display is a bookkeeping convenience rather than a " +
                                "constraint. When you buy an army the cost is charged against " +
                                "the whole country's gold and the whole country's productive " +
                                "population, and whatever the buying territory is short of is " +
                                "moved in from your richest territories automatically — " +
                                "instantly, in any quantity, with no adjacency requirement and " +
                                "no cost. Conquering a rich country on one side of the world " +
                                "genuinely does pay for a war on the other."
                        ),
                        p(
                            "BUILDINGS are the exception and are the one place the per-territory " +
                                "figure is real. A farm, forest, oil well or fort is paid for " +
                                "by the territory it stands on, out of that territory's own " +
                                "gold and its own construction materials. Materials are never " +
                                "pooled for anything: they are spent where they sit."
                        ),
                        h("Army upkeep"),
                        p(
                            "Every unit costs gold every turn simply for existing, charged " +
                                "against the territory it garrisons. Grounded vehicles are not " +
                                "billed — a unit you cannot fuel is not also a unit you pay " +
                                "for. A territory that cannot cover its bill loses the share of " +
                                "its army it could not pay for, so this is a real ceiling on how " +
                                "big an army a territory can hold and not just a drag on income."
                        ),
                        table(
                            ["Unit", "Gold per turn", "Per 100 units", "Per 1,000 force"],
                            [
                                ["Infantry", "0.00005", "0.005", "0.050"],
                                ["Assault", "0.08", "8", "0.080"],
                                ["Air", "0.5", "50", "0.100"],
                                ["Naval", "3", "300", "0.150"],
                            ]
                        ),
                        p(
                            "The last column is the one that matters, and it used to read " +
                                "0.050 for all four — upkeep did not discriminate, so a fleet " +
                                "cost exactly what the infantry it displaced cost to keep. It " +
                                "now rises with the platform, and it is the counterweight to a " +
                                "vehicle needing fewer people: you buy force cheaply in " +
                                "manpower and then pay for it every turn for the rest of the " +
                                "game."
                        ),
                        p(
                            "The infantry rate was deliberately set at a tenth of its original " +
                                "value. At the original rates every major power on the map went " +
                                "bankrupt within forty turns with no way to respond. As it " +
                                "stands, a normal standing army costs roughly what its territory " +
                                "earns — so HOLDING an army is sustainable and GROWING one is " +
                                "what has to be paid for."
                        ),
                        h("The oil gate"),
                        p(
                            "This is the game's most distinctive economic rule and the one " +
                                "least visible on screen. Buying a naval unit is not the same as " +
                                "being able to sail it."
                        ),
                        p(
                            "Each turn a territory's vehicles demand oil: 1,000 per naval unit, " +
                                "300 per aircraft, 100 per assault unit. Infantry demand none. " +
                                "If the territory does not hold enough oil, units are GROUNDED — " +
                                "still owned, still listed, still eating, but absent from the " +
                                "army total a battle is fought with."
                        ),
                        p(
                            "Grounding rotates through naval, air and assault in turn rather " +
                                "than emptying one type at a time, so a shortfall leaves you " +
                                "with an army that still has a shape rather than one with a " +
                                "whole arm missing."
                        ),
                        p(
                            "The territory panel's Army tab shows both figures — what you own " +
                                "and what is useable. If those two numbers disagree, you are " +
                                "paying to feed an army you cannot field."
                        ),
                        h("Why your income looks worse than it is"),
                        p(
                            "A besieged territory contributes a quarter of its gold, oil and " +
                                "construction materials, and pays its army's full upkeep out of " +
                                "that quarter — so a large garrison under siege is a territory " +
                                "that costs you money. If your income dropped sharply and " +
                                "nothing was conquered, check the map for siege markers before " +
                                "you check anything else."
                        ),
                        h("What happens if you cannot pay"),
                        p(
                            "Your army leaves. The share of it that deserts is the share of the " +
                                "upkeep bill you could not cover: miss a tenth of the bill and a " +
                                "tenth of that territory's army goes home, infantry first and " +
                                "vehicle crews last. It is self-correcting rather than a death " +
                                "spiral — next turn the bill is smaller by exactly what left, " +
                                "so a territory settles at the army it can afford. But it " +
                                "settles there whether or not that is the army you needed."
                        ),
                    ],
                },
                {
                    id: "population-and-production",
                    title: "Population and Production",
                    summary: "The number every purchase is really limited by.",
                    body: [
                        p(
                            "Gold is the number on the screen. Productive population is the " +
                                "number that actually stops you."
                        ),
                        h("Where productive population comes from"),
                        p(
                            "45% of a territory's population is of working age, and the " +
                                "development index decides how much of that is actually " +
                                "productive. So a territory of a million people with a " +
                                "development index of 0.9 has about 405,000 productive; the same " +
                                "million at 0.4 has about 180,000."
                        ),
                        h("What spends it"),
                        p(
                            "Buying units. Every unit costs manpower as well as gold, and the " +
                                "manpower is the binding constraint long before the gold is:"
                        ),
                        table(
                            ["Unit", "Gold", "Productive population"],
                            [
                                ["Infantry", "10", "1,000"],
                                ["Assault", "50", "1,000"],
                                ["Air", "100", "5,000"],
                                ["Naval", "200", "20,000"],
                            ]
                        ),
                        h("Growth"),
                        p(
                            "A territory grows by up to 10% of the people it feeds each turn, " +
                                "scaled by its development index — but capped by the food " +
                                "surplus. A territory with no surplus does not grow at all, no " +
                                "matter how developed it is. Farms are therefore a population " +
                                "policy, not just a hunger fix."
                        ),
                        h("Famine"),
                        p(
                            "When the food stock cannot cover the civilians plus the army, " +
                                "people die. The death rate scales with how UNDERdeveloped the " +
                                "territory is: a development index of 0.9 loses about 30 people " +
                                "per thousand of shortage, one of 0.4 loses about 180. Poor " +
                                "territories are catastrophically worse at surviving a famine."
                        ),
                        p(
                            "Deaths come out of the civilian population. But if the army is " +
                                "already larger than the workforce supporting it, the ARMY " +
                                "starves instead — infantry first, then assault, air and naval " +
                                "in that order."
                        ),
                        h("Famine under siege"),
                        p(
                            "A besieged territory has a 30% chance each turn of starving its " +
                                "garrison rather than its civilians, and the garrison's share of " +
                                "the famine is multiplied tenfold, because a besieged army has " +
                                "no supply line. This is how a siege actually kills a defender: " +
                                "not by bombardment, but by cutting the food capacity with " +
                                "collateral damage until the garrison eats itself."
                        ),
                        h("The one thing to remember"),
                        p(
                            "Population is the only resource in the game with no capacity and " +
                                "no regrowth rate — it compounds. A territory left to grow for " +
                                "twenty turns is worth several bought armies, and a territory " +
                                "starved for five is set back permanently."
                        ),
                    ],
                },
            ],
        },
        {
            id: "war",
            title: "War",
            topics: [
                {
                    id: "unit-types",
                    title: "Unit Types",
                    summary: "Infantry, assault, air and naval — what each is worth, and which is a trap.",
                    body: [
                        table(
                            ["Unit", "Gold", "Manpower", "Oil/turn", "Upkeep/turn", "Counts as", "Siege value"],
                            [
                                ["Infantry", "10", "1,000", "0", "0.00005", "1 person", "0.0001"],
                                ["Assault", "50", "600", "100", "0.08", "1,000 people", "3"],
                                ["Air", "100", "2,500", "300", "0.5", "5,000 people", "5"],
                                ["Naval", "200", "8,000", "1,000", "3", "20,000 people", "10"],
                            ]
                        ),
                        h("A vehicle is crewed, not manned"),
                        p(
                            "The manpower and upkeep columns used to be a formality: every one " +
                                "of the four types cost exactly the same population per unit of " +
                                "force and exactly the same upkeep per unit of force, so " +
                                "nothing but the die modifiers and the siege score told a " +
                                "rifleman from a battleship."
                        ),
                        p(
                            "They now pull against each other. Per unit of force, a vehicle " +
                                "costs far fewer PEOPLE than infantry — a warship 2.5 times " +
                                "fewer, an aircraft twice, an assault unit two-thirds — and " +
                                "pays for it in gold, in upkeep, and in oil that infantry never " +
                                "owe at all. So the army you can afford depends on what your " +
                                "country is short of. A populous poor country fields infantry " +
                                "because it has people and no money; a rich thinly-peopled one " +
                                "fields vehicles because it has money and no people."
                        ),
                        p(
                            "The upkeep is the part that bites later. A standing fleet is a " +
                                "permanent bill in a way a standing army is not: naval upkeep " +
                                "is three times an aircraft's per unit of force and sixty times " +
                                "infantry's. Buy the fleet you need for the war you are " +
                                "fighting, not the fleet you can afford on the turn you buy it."
                        ),
                        h("Read the 'counts as' column carefully"),
                        p(
                            "An army's FORCE is the sum of what its units count as, and force " +
                                "is the only thing that decides how many dice you roll. One " +
                                "naval unit is worth twenty thousand infantry in that sum — and " +
                                "costs 200 gold against the 200,000 gold that twenty thousand " +
                                "infantry would cost."
                        ),
                        p(
                            "Infantry are bought in TROOPS OF A THOUSAND. One press of the plus " +
                                "button costs 10 gold and a thousand productive population, and " +
                                "puts a thousand soldiers — a thousand points of force — in the " +
                                "territory. That is 100 points of force per gold, which ties " +
                                "naval for the best in the game, and it comes with no oil bill " +
                                "and the lowest upkeep of the four. Earlier editions of this " +
                                "page said the opposite, and it was wrong."
                        ),
                        p(
                            "So the real trade is not force per gold, it is what the force is " +
                                "FOR. Infantry buy open battle cheaply and sieges terribly: one " +
                                "gold of infantry contributes 0.01 to a siege score against an " +
                                "assault unit's 0.06, six times worse. Vehicles buy their force " +
                                "with far fewer PEOPLE — 1.67 to 2.50 points per head against " +
                                "infantry's 1.00 — which is what a thinly-peopled rich country " +
                                "has to buy an army with at all. Infantry are what a populous " +
                                "poor country fields, and they are not a mistake."
                        ),
                        h("What composition actually does in a battle"),
                        p(
                            "Force decides your DICE COUNT. What your army is MADE OF decides " +
                                "your die MODIFIERS — a flat bonus or penalty added to every " +
                                "die you roll. There are only three composition rules and they " +
                                "are the same for both sides:"
                        ),
                        table(
                            ["Rule", "Who gets it", "Effect"],
                            [
                                ["Air superiority", "has air, they have none — or 3× theirs", "+1 to every die"],
                                ["No armour against armour", "has no assault units, they have some", "−1 to every die"],
                                ["Naval landing", "attacker ≥ ¼ naval, coastal target", "+1 to every die"],
                            ]
                        ),
                        p(
                            "That is the whole of it. There is no per-unit matchup: an air unit " +
                                "does not fight an assault unit at some multiple. Air matters " +
                                "because HAVING air and denying it to the enemy is worth +1 on " +
                                "every die, which is worth about seventeen points on every " +
                                "pairing you contest."
                        ),
                        h("What to build"),
                        ul(
                            "AIR, always some. A single air unit against an enemy with none is " +
                                "+1 on every die you roll, for the rest of the battle. It is the " +
                                "cheapest modifier in the game and the only one you can carry to " +
                                "a target rather than having to find there.",
                            "ASSAULT as the bulk of an army. The cheapest vehicle in gold, in " +
                                "oil and in upkeep, and having ANY of it is what stops the " +
                                "enemy's armour costing you −1 on every die.",
                            "NAVAL for force and for sieges. Twenty thousand points of force per " +
                                "unit is the fastest way to cross a dice band, and it is the best " +
                                "besieger by a distance. Bear the 1,000 oil AND the 3 gold a " +
                                "turn in mind first — a fleet left standing is the largest " +
                                "recurring bill in the game.",
                            "INFANTRY: do not buy. Keep what you inherit and what you capture."
                        ),
                        h("Grounded vehicles do not fight"),
                        p(
                            "Vehicles need oil. A territory short of oil defends with only the " +
                                "units it can still run, and the attack screen already counts it " +
                                "that way. A target whose oil you can see is short is much softer " +
                                "than its army column suggests — and the same is true of you."
                        ),
                    ],
                },
                {
                    id: "declaring-an-attack",
                    title: "Declaring an Attack",
                    summary: "Choosing a target, gathering an army, and what INVADE costs before a die is rolled.",
                    body: [
                        p(
                            "An attack is armed in two steps: click the territory you are " +
                                "attacking from, then the territory you are attacking. The move " +
                                "button reads ATTACK, and an attack marker appears on the target."
                        ),
                        h("Gathering the army"),
                        p(
                            "The attack table lists every territory of yours that can reach the " +
                                "target, with a stepper per unit type. An attack can draw from " +
                                "several territories at once — this is the only thing in the " +
                                "game that concentrates force across a frontier, and it is how a " +
                                "hard target is taken."
                        ),
                        h("The three numbers on the attack screen, and why they differ"),
                        p(
                            "They answer three different questions and they are all honest. " +
                                "Reading one as an answer to another is the commonest way to " +
                                "lose an army."
                        ),
                        table(
                            ["Shown", "What it is", "Good for"],
                            [
                                ["The bar", "a broad strength comparison", "a rough feel, nothing more"],
                                ["The dice preview", "the dice both sides will roll", "the fight itself"],
                                ["The forecast", "the battle played out 500 times", "will I take it?"],
                            ]
                        ),
                        p(
                            "The bar and the dice preview can disagree, and when they do the " +
                                "preview is the one that happens. The bar carries two thumbs on " +
                                "the scale that the dice model does not use: an attacker's " +
                                "multiplier of 1.44, and the defender's fort multiplier. Those " +
                                "belong to the siege calculation, which is a different model — " +
                                "see \"How a Battle Is Fought\". Take the bar as a mood and the " +
                                "preview as a fact."
                        ),
                        h("What goes into the dice preview"),
                        ul(
                            "Your side: the force you have committed, multiplied by the average " +
                                "development index of the territories it came from, multiplied by " +
                                "how hard the defender's continent is to invade.",
                            "Their side: the force of the defender's USEABLE units, adjusted for " +
                                "the territory's area.",
                            "That ratio picks each side's number of dice from a table. Forts, " +
                                "air, armour and a naval landing then appear as named modifiers " +
                                "underneath, because those are the parts you can do something " +
                                "about."
                        ),
                        p(
                            "It is live: it re-itemises on every plus and minus press, from the " +
                                "same functions that will resolve the battle — not a summary of " +
                                "them. If it says four dice against three, that is what will " +
                                "happen."
                        ),
                        p(
                            "Add units until the preview gains a die. That is the moment worth " +
                                "spending for, it is worth far more than the same units spent " +
                                "anywhere inside a band, and it is visible before you commit " +
                                "anything."
                        ),
                        h("What INVADE! costs immediately"),
                        p(
                            "The units you committed leave their home territories the moment you " +
                                "press it. They are gone from the map, gone from those " +
                                "territories' defence, and gone from the top bar. If you retreat " +
                                "before the first round they come back one turn later; if you " +
                                "scatter, two turns later and 30% fewer."
                        ),
                        p(
                            "The consequence is worth stating plainly: an attack launched from " +
                                "your only fortified territory leaves that territory undefended " +
                                "for at least two turns, during the AI phase, while it is holding " +
                                "your border."
                        ),
                        h("The three things worth checking before every attack"),
                        ul(
                            "How many FORTS does the target have? Forts do not make the defender " +
                                "stronger — they take dice off YOU, and a die you do not roll " +
                                "cannot be won back by anything.",
                            "Do they have air, and do I? Air superiority is ±1 on every die of " +
                                "the battle and it is decided before the first roll.",
                            "What am I leaving behind? The units go the moment you press INVADE."
                        ),
                        h("The siege option"),
                        p(
                            "If your odds are 15% or better, the battle screen offers SIEGE " +
                                "instead of an assault — invest the committed army into a " +
                                "standing siege rather than throwing it at the walls. Below 15% " +
                                "the option is greyed out, and so is it for a target you have " +
                                "already besieged once."
                        ),
                        p(
                            "That threshold reads backwards to most players, who expect a siege " +
                                "to be the option for a hopeless assault. It is the opposite: a " +
                                "siege is a commitment, and the game will not let you commit an " +
                                "army to one you cannot win."
                        ),
                        p(
                            "Besiege a FORTRESS. An assault against three forts rolls two fewer " +
                                "dice for the whole battle; a siege attacks the forts themselves " +
                                "and destroys them one at a time. A heavily fortified territory " +
                                "is a bad assault and a good siege, provided you bring naval and " +
                                "air to make the siege margin positive."
                        ),
                    ],
                },
                {
                    id: "resolving-a-battle",
                    title: "How a Battle Is Fought",
                    summary: "The whole dice model in order: force, dice, modifiers, pairings, casualties, and the five ways it ends.",
                    body: [
                        p(
                            "This is the complete rule. Every battle in the game — yours, the " +
                                "AI's, and the ones you are shown a replay of — is resolved by " +
                                "exactly what follows, with no separate model anywhere."
                        ),
                        h("One press of the button is one ROUND"),
                        p(
                            "A round is: both sides roll dice, the dice are paired off, the " +
                                "loser of each pairing takes casualties. Then the state of the " +
                                "two armies is checked. Rounds continue until one side breaks — " +
                                "there is no fixed number of them, and a battle typically runs " +
                                "five to eight."
                        ),
                        h("Step 1 — force becomes a SHARE"),
                        p(
                            "Both armies are weighed in people (see Unit Types). Your total is " +
                                "multiplied by your territories' development and by the " +
                                "defender's continent modifier; theirs is adjusted for the " +
                                "territory's area. Your share is your total over the two totals, " +
                                "and it is what the bar shows."
                        ),
                        h("Step 2 — the share becomes a number of DICE"),
                        p(
                            "This is the heart of the game and it is a table, not a curve. Each " +
                                "side looks up its OWN share:"
                        ),
                        table(
                            ["Your share of the two strengths", "Dice you roll"],
                            [
                                ["70% or more", "5"],
                                ["50% to 70%", "4"],
                                ["35% to 50%", "3"],
                                ["20% to 35%", "2"],
                                ["under 20%", "1"],
                            ]
                        ),
                        p(
                            "Two consequences follow, and between them they are most of the " +
                                "strategy in this game."
                        ),
                        ul(
                            "BANDS MEAN THRESHOLDS. Going from 49% to 51% is worth a whole die. " +
                                "Going from 51% to 68% is worth nothing at all. The dice preview " +
                                "on the attack screen is where you find the edge you are near.",
                            "THE UNDERDOG ALWAYS ROLLS. The bottom band is one die, never zero, " +
                                "so overwhelming force never buys a free round — it buys the " +
                                "maximum of five dice and no more."
                        ),
                        p(
                            "The defender is capped at FOUR dice however strong it is. At even " +
                                "strength both sides sit in the same band and both roll four, so " +
                                "the cap does nothing there; it bites only when the defender is " +
                                "the stronger side, and it is what stops a heavily garrisoned " +
                                "territory being untouchable. You can always attack it. You will " +
                                "just do it very badly."
                        ),
                        h("Step 3 — terrain and composition become MODIFIERS"),
                        p(
                            "A modifier is one of two completely different things, and the " +
                                "battle screen labels which:"
                        ),
                        ul(
                            "A FACE bonus adds to every die that side rolls. It changes who wins " +
                                "the pairings you are contesting.",
                            "A DICE change alters how many dice a side rolls at all. This is " +
                                "strictly stronger, because only a dice change can do anything " +
                                "about the opponent's unmatched dice."
                        ),
                        table(
                            ["Modifier", "Applies to", "Effect"],
                            [
                                ["Their fortifications", "fort + mountain ≥ 25", "attacker rolls 1 fewer DIE"],
                                ["Their fortifications", "fort + mountain ≥ 100", "attacker rolls 2 fewer DICE"],
                                ["Air superiority", "either side", "+1 to every die"],
                                ["No armour against armour", "either side", "−1 to every die"],
                                ["Naval landing", "attacker, coastal, ≥ ¼ naval", "+1 to every die"],
                                ["Dug in", "the round after digging in", "+1 to every die"],
                                ["Siege has worn them down", "assaulting out of a siege", "+1 per 3 turns, max +2"],
                            ]
                        ),
                        p(
                            "Face bonuses are summed and CAPPED AT ±2 either way. Neither side " +
                                "can ever be reduced below one die."
                        ),
                        h("Why forts take dice instead of adding faces"),
                        p(
                            "Because a face bonus cannot answer an unmatched die. A 2-to-1 " +
                                "attacker rolls five dice against the defender's two: three of " +
                                "those five are unanswered and are automatic hits every single " +
                                "round, and +2 on the defender's two dice does not touch them. " +
                                "Fortification as a face bonus was measured and a 2-to-1 attacker " +
                                "took a fortress 100% of the time. Terrain that cannot be " +
                                "answered by terrain is not terrain."
                        ),
                        h("Step 4 — the dice are PAIRED"),
                        p(
                            "This is the part that decides the battle, and it is the part " +
                                "nothing on screen used to explain. It works like this:"
                        ),
                        ul(
                            "Each side adds its face modifier to every one of its dice.",
                            "Each side SORTS its dice from highest to lowest.",
                            "The two highest are paired against each other, then the two second " +
                                "highest, and so on.",
                            "In each pairing the higher value wins. TIES GO TO THE DEFENDER.",
                            "Any die the other side has nothing left to pair against is an " +
                                "AUTOMATIC HIT."
                        ),
                        p(
                            "So if you roll a 6 and they roll a 1, you have won that pairing: " +
                                "their die is destroyed and they take casualties for it. Your 6 " +
                                "does not carry over, does not fight twice, and is not worth more " +
                                "than a 2 would have been. A pairing is won or lost — by how much " +
                                "is irrelevant."
                        ),
                        h("Ties go to the defender, and this is the defender's whole advantage"),
                        p(
                            "There is no separate defence bonus in the dice model. Instead, an " +
                                "even pairing is a defender's pairing. On unmodified dice the " +
                                "attacker wins a contested pairing 15 times in 36 — about 42% — " +
                                "which is why the bar and your chance of winning are not the same " +
                                "number. It is also why +1 to a die is worth so much: it takes a " +
                                "contested pairing from 15 in 36 to 21 in 36."
                        ),
                        h("Unmatched dice: what happens to the extra ones"),
                        p(
                            "They are not discarded, and they are not held over. Each of them is " +
                                "an automatic hit on the other side, every round, with no roll " +
                                "involved. Four dice against three is not a small edge — it is " +
                                "one guaranteed casualty per round plus three contests."
                        ),
                        p(
                            "This is the single most important thing to understand about the " +
                                "model. Bringing enough force to cross a band edge is worth more " +
                                "than any modifier in the game, because it converts a coin flip " +
                                "into a certainty."
                        ),
                        h("Step 5 — casualties"),
                        p(
                            "Each pairing a side LOSES costs it 10% of the force it has at that " +
                                "moment. They compound rather than adding up, so a side losing " +
                                "all five pairings of a round keeps 0.9⁵ — about 59% — of what it " +
                                "had, not half."
                        ),
                        p(
                            "Losses are taken proportionally across all four unit types, so an " +
                                "army that starts combined-arms stays combined-arms and does not " +
                                "lose its air superiority after one bad round. A side that lost a " +
                                "pairing always loses at least one unit."
                        ),
                        h("Step 6 — how the round ends the battle"),
                        p(
                            "Checked after the casualties, against each side's own force at the " +
                                "START of the battle:"
                        ),
                        table(
                            ["Outcome", "Condition", "Result"],
                            [
                                ["Victory", "every defender destroyed", "territory taken, survivors garrison it"],
                                ["Rout", "defender below 20% of its start", "taken, AND half their survivors join you"],
                                ["Last push offered", "defender at 20–30% of its start", "take it now for 20% of your survivors"],
                                ["Defeat", "every attacker destroyed", "the attack fails"],
                                ["Broken", "you below 20% of your start", "the attack fails"],
                            ]
                        ),
                        p(
                            "The ROUT is the outcome worth playing for. Absorbing half of a " +
                                "beaten garrison is the only way in the game to GAIN army without " +
                                "paying gold and manpower for it — and note that it triggers " +
                                "before the defender is wiped out, so pressing on past a rout is " +
                                "not merely unnecessary, it destroys the prize."
                        ),
                        h("Your four buttons, and what each one actually does"),
                        table(
                            ["Button", "Available", "What it does"],
                            [
                                ["NEXT ROUND", "always", "fights one round"],
                                ["DIG IN", "after round 1", "inflict nothing, take half — then +1 next round"],
                                ["RESERVES", "after round 1", "sends more units; they fight in a round's time"],
                                ["LAST PUSH!", "defender at 20–30%", "take it now for 20% of your survivors"],
                                ["RETREAT / SCATTER", "always", "leave — free before round 1, then 30%"],
                            ]
                        ),
                        p(
                            "DIG IN and RESERVES are real controls that change how the next " +
                                "round is fought; they are quieter on the bar than NEXT ROUND " +
                                "because they modify a round rather than ending a battle, not " +
                                "because they are unavailable."
                        ),
                        h("When digging in is worth it"),
                        p(
                            "It costs you a round of offence and buys a round of half casualties " +
                                "plus +1 on every die afterwards. That is a good trade when you " +
                                "are losing pairings and expect the battle to go long, and a bad " +
                                "one when you are ahead — a round in which you inflict nothing is " +
                                "a round the defender spends recovering nothing, so it only pays " +
                                "if the +1 changes who wins pairings."
                        ),
                        h("Retreating, and what it costs"),
                        table(
                            ["Button reads", "When", "Cost", "Army returns"],
                            [
                                ["RETREAT!", "before round 1", "nothing", "next turn"],
                                ["SCATTER!", "once a round has been fought", "30% of the army", "in two turns"],
                                ["DEFEAT!", "the battle is lost", "whatever is left", "—"],
                            ]
                        ),
                        p(
                            "The free window is BEFORE the first round only. Once you have " +
                                "pressed NEXT ROUND once, every way out costs 30%. Look at the " +
                                "dice preview before that first press, because it is the last " +
                                "free decision in the battle."
                        ),
                        p(
                            "A retreating army goes back to the territories it came from, in the " +
                                "proportions it left in, arriving at the start of a turn before " +
                                "you act. The turn or two while it is in transit is the most " +
                                "dangerous window in the game, and nothing on screen tells you it " +
                                "is open."
                        ),
                        planned(
                            "Armies in transit should be visible — a count in the top bar, or a " +
                                "marker on the territories expecting them. At present the only " +
                                "record is internal."
                        ),
                        h("Reading the battle screen"),
                        ul(
                            "THE LEDGER, under the bar: how many dice each side rolls this " +
                                "round and every modifier that made it that number.",
                            "THE DICE: the real roll. The numbers were chosen by the rules " +
                                "before the dice were thrown, so what lands is what counted.",
                            "THE CLASH: after the dice settle, each pairing is shown closing, " +
                                "colliding, and the losing die shattering. An unmatched die is " +
                                "shown against an empty socket. This is the round, drawn.",
                            "THE ROUND LINE, beside the Rounds toggle: the last round in one " +
                                "sentence, which stays up after the animation has gone.",
                            "THE ROUND LOG: every round of this battle, newest first. Click " +
                                "Rounds to open it."
                        ),
                        p(
                            "Clicking anywhere over the battle window settles the dice and " +
                                "finishes the clash immediately. Both are a drawing of a result " +
                                "that has already been decided, so skipping them changes nothing."
                        ),
                    ],
                },
                {
                    id: "sieges",
                    title: "Sieges",
                    summary: "Surrounding a territory instead of storming it.",
                    body: [
                        p(
                            "A siege is the slow half of the war model. An open battle is a " +
                                "handful of rounds resolved in one sitting; a siege is one roll " +
                                "per turn, for as many turns as it takes, and it is won by " +
                                "starving a territory rather than by beating its army."
                        ),
                        h("Sieges are won with hardware, not bodies"),
                        p(
                            "A besieging army's siege score is: naval 10 each, air 5, assault 3, " +
                                "infantry 0.0001. An infantry-only besieger can sit outside a " +
                                "fortified territory forever without ever landing a hit. This is " +
                                "deliberate — a siege is broken by artillery and blockade, not by " +
                                "numbers."
                        ),
                        h("The one number the whole thing turns on"),
                        p(
                            "Take your siege score and subtract the territory's fort bonus plus " +
                                "its mountain bonus. Every probability in a siege turn is a band " +
                                "on that difference. Call it the margin."
                        ),
                        table(
                            ["Margin", "What a siege turn does"],
                            [
                                ["negative", "40% chance per landed hit that YOUR army is arrested"],
                                ["0 to 20", "collateral damage of 1–6% of food capacity, nothing destroyed"],
                                ["20 to 50", "1–12% collateral, 30% chance of destroying a building"],
                                ["50 to 100", "1–18% collateral, one destruction roll at 50%"],
                                ["100 to 200", "1–25% collateral, one destruction roll"],
                                ["200+", "1–25% collateral, TWO destruction rolls"],
                            ]
                        ),
                        h("Landing a hit at all"),
                        p(
                            "Each turn the siege rolls ten times at a chance of 50% plus the " +
                                "margin divided by a thousand, and needs a strict majority. An " +
                                "evenly matched siege therefore lands slightly under half its " +
                                "turns; it takes a margin of a thousand to make a hit certain."
                        ),
                        p(
                            "Rolling ten times and taking the majority rather than rolling once " +
                                "is what stops a siege being a coin flip: a siege that is " +
                                "genuinely winning wins most turns, rather than most turns on " +
                                "average over fifty."
                        ),
                        h("How a siege ends"),
                        ul(
                            "THE TERRITORY FALLS — the defender's army drops below 5% of what it " +
                                "started with AND it has no forts left. The siege becomes an " +
                                "outright rout victory for the besieger. Forts are literally what " +
                                "keep a siege going.",
                            "YOUR ARMY IS ARRESTED — on a negative margin, a landed hit has a " +
                                "40% chance of the besieging force being rounded up. Half of it " +
                                "joins the defender. Do not besiege something you do not outgun.",
                            "YOU ASSAULT — click the besieged territory and VIEW SIEGE, then " +
                                "ASSAULT! and fight it as a normal battle. The defender is worn " +
                                "down, and you carry +1 on every die for each three turns the " +
                                "siege has run, to a maximum of +2.",
                            "YOU LIFT IT — retreat from the siege screen. Your army comes home.",
                            "SOMEBODY PAYS YOU TO LEAVE — see \"Diplomacy\"."
                        ),
                        h("Being besieged"),
                        p(
                            "The territory earns nothing, its food capacity is being destroyed a " +
                                "slice at a time, and its garrison has a 30% chance each turn of " +
                                "starving at ten times the normal rate. Your options are to build " +
                                "more forts there — the margin is measured against them, and a " +
                                "fort is the only thing that lowers it — or to attack the " +
                                "besieging army's home territory and give it something else to " +
                                "worry about."
                        ),
                        h("Sieges dominate, and that is a problem"),
                        p(
                            "The AI besieges far more than it can finish. Measured over a " +
                                "fourteen-turn game, concurrent AI sieges went from 17 to 67: new " +
                                "ones are launched much faster than existing ones resolve, " +
                                "because a siege only ends on an arrest or a conquest and the AI " +
                                "has no notion of committing enough force to finish one."
                        ),
                        planned(
                            "A siege needs a natural end — a turn limit, an attrition on the " +
                                "besieging army, or a supply cost the besieger has to keep " +
                                "paying. Any of the three would stop the map silting up with " +
                                "sieges nobody is winning. This is the change most likely to make " +
                                "the whole game feel different."
                        ),
                    ],
                },
            ],
        },
        {
            id: "diplomacy",
            title: "Diplomacy",
            topics: [
                {
                    id: "the-six-states",
                    title: "Who You May Fight",
                    summary: "Six states, one per pair of countries, and only one of them lets you attack.",
                    body: [
                        p(
                            "Every pair of countries on this map stands in exactly one state, " +
                                "and it is the same state read from either side. There is no " +
                                "such thing as your view of France and France's view of you: " +
                                "there is one fact about the two of you."
                        ),
                        p(
                            "WAR is the only one of the six that lets either side attack the " +
                                "other. Everything else on this list is a reason you cannot."
                        ),
                        table(
                            ["State", "May attack?", "How it begins", "How it ends"],
                            [
                                ["No contact", "No", "The starting state for every pair", "Their borders touch, once"],
                                ["Neutral", "No", "First contact", "Somebody declares, or something is agreed"],
                                ["War", "YES", "Declared", "A ceasefire or a peace is agreed"],
                                ["Ceasefire", "No", "Agreed, with an end date", "It runs out, or firms into a peace"],
                                ["Peace", "No", "Agreed, no end date", "War is declared out of it — a breach"],
                                ["Alliance", "No", "Agreed, out of a peace", "See the alliance page"],
                            ]
                        ),
                        h("Meeting somebody is not fighting them"),
                        p(
                            "When your border first touches another country's you become " +
                                "NEUTRAL with them, not hostile. Neither of you may attack " +
                                "until one of you declares war. That is the single most " +
                                "important rule in this section: a war has a beginning, and " +
                                "somebody chose it."
                        ),
                        p(
                            "You will meet countries you never fight, and countries you fight " +
                                "for a hundred turns. Which is which is a decision, and it is " +
                                "yours as much as theirs."
                        ),
                        h("Where to see it"),
                        p(
                            "Hover any territory and the tooltip names where its owner stands " +
                                "with you. The diplomacy panel — the two-flags button in the " +
                                "left-hand column over the map — lists every country you have " +
                                "met, grouped by state, with everything you can do about each."
                        ),
                    ],
                },
                {
                    id: "declaring-war",
                    title: "Declaring War",
                    summary: "How a war starts, what it costs, and why the attack button is sometimes grey.",
                    body: [
                        p(
                            "Select one of your territories, then a neighbouring territory you " +
                                "are not at war with, and the move button reads DECLARE WAR " +
                                "instead of ATTACK. Hover it and it tells you exactly why you " +
                                "cannot attack yet."
                        ),
                        p(
                            "A declaration takes effect AT ONCE. There is no waiting period " +
                                "anywhere in this system: declare, and the same selection reads " +
                                "ATTACK a moment later. You can declare and invade in the same " +
                                "turn."
                        ),
                        h("What it costs"),
                        p(
                            "Out of NEUTRAL, nothing at all. Nothing was promised, so nothing " +
                                "is broken."
                        ),
                        p(
                            "Out of a peace, a ceasefire or an alliance it is a BREACH — the " +
                                "one act in the whole system that carries a price — and you " +
                                "will be asked to confirm before it happens. The confirmation " +
                                "names which agreement you are breaking and how long it has " +
                                "stood."
                        ),
                        h("The opening grace period"),
                        p(
                            "For the first " + String(PLAYER_GRACE_TURNS) + " turns no AI " +
                                "country will declare war on you, or open an attack or a siege " +
                                "against you. Two hundred and six countries plan their first " +
                                "turn with full information, and without this a player who " +
                                "chose a small country could be gone before they had made a " +
                                "decision that mattered."
                        ),
                        p(
                            "It protects the OPENING of a war and nothing else. You may attack " +
                                "throughout, and from turn " + String(PLAYER_GRACE_TURNS + 1) +
                                " the AI fights exactly as hard as it ever would."
                        ),
                        h("How the AI chooses its wars"),
                        p(
                            "Every country commits to absorbing one neighbour at a time, and " +
                                "that commitment IS its declaration of war — so a country with " +
                                "a reachable neighbour always has a war. On top of that it will " +
                                "open at most one more against a neighbour whose border is " +
                                "visibly weaker than its own, and one more again when some " +
                                "power is running away with the game. It will not fight more " +
                                "than " + String(declarationDiscipline.concurrentWarCap) +
                                " countries by choice."
                        ),
                        p(
                            "A cautious leader will not start an opportunistic war at all. Who " +
                                "is in charge of a country matters, and leaders change."
                        ),
                    ],
                },
                {
                    id: "peace-and-ceasefires",
                    title: "Peace and Ceasefires",
                    summary: "How to stop a war you no longer want, and what makes somebody say yes.",
                    body: [
                        p(
                            "Open the diplomacy panel, pick a country, and you can offer it a " +
                                "ceasefire or a peace. It answers immediately. Refusing costs " +
                                "you nothing, but you cannot ask the same country the same " +
                                "thing again for " + String(peaceDiscipline.proposalCooldown) +
                                " turns — asking every turn until the answer changes is not " +
                                "negotiating."
                        ),
                        h("Which to ask for"),
                        p(
                            "A CEASEFIRE is a pause. It runs for " +
                                String(peaceDiscipline.ceasefireTurns) + " turns and then " +
                                "lapses back to whatever it was signed out of, usually war. It " +
                                "is much easier to get than a peace, because it costs the other " +
                                "side far less to agree to."
                        ),
                        p(
                            "A PEACE has no end date. It is harder to get, and breaking it " +
                                "later is a breach. You can offer one out of a war, out of " +
                                "neutral — which turns an absence into an agreement worth " +
                                "something — or to firm up a ceasefire that is holding, which " +
                                "is the cheapest permanent way out of a war in the game."
                        ),
                        h("What makes them say yes"),
                        p(
                            "Six things, and the panel tells you which ones actually moved the " +
                                "answer: how many other wars they are fighting, whether they " +
                                "are defending or building rather than expanding, how badly " +
                                "you have beaten them, how cautious their leader is, whether " +
                                "some other power is running away with the game, and whether " +
                                "they are simply much larger than you."
                        ),
                        p(
                            "That last one is worth remembering. A country that is beating you " +
                                "has no reason to stop, and asking will usually just spend your " +
                                "cooldown."
                        ),
                        h("The one country that will not listen"),
                        p(
                            "Each country has committed to absorbing ONE particular neighbour. " +
                                "If that is you, it will not agree a peace at any price — the " +
                                "whole of its medium-term plan is taking your land."
                        ),
                        p(
                            "It will take a CEASEFIRE, but only once you have beaten it back " +
                                "at least " + String(peaceDiscipline.theatreCeasefireFailures) +
                                " times. A country that is losing wants a breather, and that is " +
                                "your window. Win two defences and then ask."
                        ),
                        h("A siege stops everything"),
                        p(
                            "While a siege stands between you and another country, neither of " +
                                "you can agree anything with the other. Finish it, or lift it, " +
                                "and then talk. A refusal for this reason does not spend your " +
                                "cooldown, so you can ask the moment it ends."
                        ),
                        h("They will ask you too"),
                        p(
                            "AI countries sue for peace with each other constantly, and they " +
                                "will come to you. An offer arrives at the end of the AI turn " +
                                "as a prompt: accept and it takes effect at once, decline and " +
                                "nothing at all is owed."
                        ),
                    ],
                },
                {
                    id: "alliances",
                    title: "Alliances",
                    summary: "The only agreement that gives you something, and the price of taking it.",
                    body: [
                        p(
                            "Peace and a ceasefire are promises not to do something. An " +
                                "alliance PAYS. It is offered out of a peace and nothing else: " +
                                "a country that will not first agree not to fight you is not " +
                                "going to share its oil."
                        ),
                        h("What it gives"),
                        ul(
                            "A standing share of income. Each ally raises your gold income by " +
                                String(Math.round(allianceShare.gold * 100)) + "%.",
                            "The same on your ceilings for oil, construction materials and " +
                                "food, at " + String(Math.round(allianceShare.capacity * 100)) +
                                "% each.",
                            "Shared intelligence: your ally's frontier appears on the military " +
                                "map with the same force figures and threat marks as your own.",
                            "Both of you get all of it. Nothing is taken from either side."
                        ),
                        p(
                            "Only your first " + String(allianceShare.maxAllies) + " allies " +
                                "count towards the money. Beyond that an alliance is worth " +
                                "having for what it does on the map, not for what it pays."
                        ),
                        h("The price: you will be called"),
                        p(
                            "When an ally goes to war — or is attacked, which counts just as " +
                                "much — you are ASKED to join. Never enrolled. The prompt " +
                                "arrives at the end of the AI turn and it says what refusing " +
                                "will cost before you answer."
                        ),
                        p(
                            "If you JOIN, you are at war with their enemy at once, and you may " +
                                "not make peace with that enemy on your own afterwards. The " +
                                "ally who called you has to agree it — and when they do, you " +
                                "come out of the war with them, on the same terms."
                        ),
                        p(
                            "If you REFUSE, the alliance ends. Neither of you pays a penalty " +
                                "for that: they chose a war you would not fight, you chose not " +
                                "to fight it, and the alliance is simply over. Their cost is " +
                                "exactly what happened — they went to war without you."
                        ),
                        h("The three ways an alliance ends"),
                        p(
                            "Only one of them costs anything, and the rule is one sentence: " +
                                "the penalty is for ending an alliance when both sides do not " +
                                "agree, and for nothing else."
                        ),
                        table(
                            ["Ending", "Penalty?", "Why"],
                            [
                                ["A call to arms is refused", "None, either side", "Both of you decided"],
                                ["Both agree to end it", "None, either side", "Both of you agreed"],
                                ["You walk out, or attack your own ally", "The full breach", "Only one of you decided"],
                            ]
                        ),
                        p(
                            "The panel offers \"Propose ending it\" on any alliance, and it is " +
                                "almost always accepted. That free and honest exit is exactly " +
                                "what makes walking out unilaterally a choice to be treacherous " +
                                "rather than a choice to be free."
                        ),
                        h("When the AI wants one"),
                        p(
                            "Countries start looking for allies when one power is running away " +
                                "with the game, and they prefer a partner already fighting the " +
                                "same enemies. That is the whole point of the system: the world " +
                                "can gang up on whoever is winning — including you."
                        ),
                        p(
                            "A country with several allies already is less interested in " +
                                "another, and a large country will not ally with a very small " +
                                "one: an alliance with somebody who cannot help you is a " +
                                "promise to fight their wars for nothing."
                        ),
                    ],
                },
            ],
        },
        {
            id: "strategy",
            title: "Strategy",
            topics: [
                {
                    id: "opening-moves",
                    title: "Opening Moves",
                    summary: "The first five turns, and why they look boring.",
                    body: [
                        p(
                            "The opening is not about conquest. It is about making sure your " +
                                "territories can survive being attacked, because on turn one " +
                                "several of them cannot survive being attacked at all."
                        ),
                        h("Turn 1: forts"),
                        p(
                            "Your territories start with no forts. The AI's do not — computer " +
                                "countries are seeded with random starting forts at game start " +
                                "specifically so the player does not face an undefended world, " +
                                "and the favour is not returned."
                        ),
                        p(
                            "A coastal, mountain-free territory with no forts has a defence " +
                                "multiplier of zero. Fix that before anything else, everywhere " +
                                "you can afford to."
                        ),
                        h("Turn 2–3: food and oil"),
                        p(
                            "Open the territory panel and look at the Food(+/-) column. " +
                                "Anything negative is a famine that will still be there in five " +
                                "turns, killing the civilians who become your productive " +
                                "population. Farms fix it, slowly — capacity has to regrow."
                        ),
                        p(
                            "Then compare Oil against Oil Demand. If demand is higher you " +
                                "already own vehicles you cannot use, and buying more is " +
                                "throwing gold away."
                        ),
                        h("Turn 3–5: pick one direction"),
                        p(
                            "Look for a neighbour that is: reachable, in a continent that pays " +
                                "well, and weakly fortified. The last matters more than army " +
                                "size, because the defence multiplier is what actually decides " +
                                "your odds — a large garrison behind no forts is a much softer " +
                                "target than a small one behind three."
                        ),
                        p(
                            "Take one territory. Then stop, because it will be deactivated for " +
                                "one to three turns and cannot be the springboard for the next " +
                                "attack."
                        ),
                        h("What not to do in the opening"),
                        ul(
                            "Do not buy infantry. See \"Unit Types\".",
                            "Do not buy naval units before you have oil wells. One naval unit " +
                                "demands 1,000 oil a turn.",
                            "Do not attack from your only fortified territory — the army leaves " +
                                "the moment you press INVADE.",
                            "Do not start a siege you cannot outgun. A negative margin means a " +
                                "40% chance per landed hit of losing the whole besieging army, " +
                                "half of it to the enemy."
                        ),
                    ],
                },
                {
                    id: "how-the-ai-thinks",
                    title: "How the AI Thinks",
                    summary: "The pipeline every computer country runs, and how to exploit it.",
                    body: [
                        h("Every AI has a leader, and the leader has a personality"),
                        p(
                            "Each computer country is given a randomly generated leader — a " +
                                "title, a name and an epithet, like Sultana Amina the Cunning — " +
                                "drawn from one of three archetypes."
                        ),
                        table(
                            ["Archetype", "Economy", "Expansion", "Style of war", "Reconquista"],
                            [
                                ["Aggressive", "0.1–0.5", "0.8–1.0", "0.7–1.0", "0.1–0.4"],
                                ["Balanced", "0.4–0.6", "0.5–0.7", "0.4–0.7", "0.4–0.6"],
                                ["Pacifist", "0.7–1.0", "0.1–0.3", "0.1–0.4", "0.6–1.0"],
                            ]
                        ),
                        p(
                            "STYLE OF WAR: low favours sieges, high favours pressing an attack " +
                                "on unclear odds. RECONQUISTA: how badly the leader wants back " +
                                "territories the country used to own. A territory remembers its " +
                                "original owner forever, so land you take from a high-" +
                                "reconquista leader will be attacked again and again."
                        ),
                        h("Every AI has a campaign, and it lasts several turns"),
                        p(
                            "The leader says HOW a country fights. The campaign says what it is " +
                                "fighting for, and it is DERIVED from the goal you chose rather " +
                                "than invented — which is why the chooser at the start of a " +
                                "game is not a scoring rule bolted onto a fixed AI. Under the " +
                                "default goal that means each country picks THREE CONTINENTS " +
                                "and works towards owning them outright."
                        ),
                        p(
                            "The goal changes four dials, and they are enough to produce five " +
                                "recognisably different worlds. HOW MANY CONTINENTS a country " +
                                "commits to. HOW MUCH IT VALUES RAW LAND, which is what makes a " +
                                "Domination world spread over four fronts where a Continental " +
                                "one tunnels into three. WHETHER IT WILL EVER SETTLE for holding " +
                                "what it has — under World Conquest it never does. And WHICH " +
                                "COUNTRIES IT GOES LOOKING FOR, which only Great Powers uses, " +
                                "and which is what makes that goal feel like a hunt rather than " +
                                "a percentage."
                        ),
                        p(
                            "There is a fifth dial and it is about YOU. Every country measures " +
                                "the strongest rival's share of the world and spends its attack " +
                                "budget harder as that share grows, so a runaway leader is " +
                                "attacked harder by the whole map. In a Timed Game the same " +
                                "dial reads the clock instead — there is nothing to conserve on " +
                                "the last turn. It deliberately never reaches the SIEGE budget: " +
                                "an urgent world that could also lay unlimited sieges is a world " +
                                "that silts up and stops moving."
                        ),
                        p(
                            "Underneath the campaign each country also commits to absorbing ONE " +
                                "neighbouring country at a time. It keeps that commitment while " +
                                "it is taking ground and writes the rival off as a WALL when it " +
                                "stalls, at which point it looks for somebody else. Under Great " +
                                "Powers it prefers a named power when one is reachable. This is " +
                                "the mid-term goal, and it is what makes the world consolidate " +
                                "into larger countries over a long game instead of trading the " +
                                "same border province forever."
                        ),
                        p(
                            "A continent is chosen on five things: how much of it the country " +
                                "already holds, whether it has a foothold there at all, what the " +
                                "continent is worth economically, how few territories it has — a " +
                                "twelve-territory continent is a shorter war than a sixty — and " +
                                "how much of it the strongest rival already owns. The choice is " +
                                "then KEPT. It is reviewed every five turns, and abandoned early " +
                                "only when it has become pointless: the continent is already " +
                                "held outright, or the country has been thrown off it entirely."
                        ),
                        h("Four kinds of turn"),
                        p(
                            "From the campaign and the state of the country, each turn is one of " +
                                "four postures, and the posture decides where the gold goes and " +
                                "how much war is affordable."
                        ),
                        table(
                            ["Posture", "When", "What it does"],
                            [
                                ["DEVELOP", "Barely any buildings, or a very small country",
                                    "Farms, forests and oil wells first; few attacks, almost no sieges"],
                                ["EXPAND", "The ordinary case",
                                    "Full attack and siege budget; gold favours units over forts"],
                                ["CONSOLIDATE", "Three quarters of the focus continent held",
                                    "Finishes that continent; refuses fights elsewhere that are not threats"],
                                ["DEFEND", "A fifth of the country under siege",
                                    "Four fifths of its gold into forts; attacks only on strong odds"]
                            ]
                        ),
                        h("What it does each turn"),
                        p(
                            "Plan the campaign. Score its own territories' defences and every " +
                                "enemy territory it can reach. Rate each of those targets — can " +
                                "it, should it, and which way — and turn the survivors into " +
                                "candidate goals: Economy, Bolster, Attack, Siege. Rank them by " +
                                "the leader's personality AND by what the target is worth to the " +
                                "campaign. Then cut the list to what it can afford, and execute."
                        ),
                        p(
                            "RATING a target is the part that changed the AI most. A target has " +
                                "to clear an odds floor set by the leader's type and its " +
                                "style_of_war — around 25% for an aggressive leader, 45% for a " +
                                "pacifist, higher again while defending — and a siege has a " +
                                "lower floor than an assault, because a siege is what you do to " +
                                "something you cannot storm. It then has to be worth having: a " +
                                "territory on the continent the country is finishing is worth " +
                                "roughly five times one that is nowhere near it, and one that " +
                                "would COMPLETE a continent is worth several times again. Each " +
                                "target gets ONE verdict, so a country can no longer plan to " +
                                "storm and besiege the same place in the same turn."
                        ),
                        p(
                            "BUDGETS are the other half. A country may run a limited number of " +
                                "sieges at once — one, plus one for every fourteen territories " +
                                "it holds, up to six — and the sieges it ALREADY has running " +
                                "count against that. A country at its cap opens none at all and " +
                                "spends the turn reinforcing and building instead. Attacks are " +
                                "budgeted the same way, one plus one per ten territories."
                        ),
                        h("What it still cannot do"),
                        p(
                            "Coordinate. Each country plans alone; it never allies, never " +
                                "trades and never declares anything. It has no model of what YOU " +
                                "are about to do, so it still cannot see an army massing on its " +
                                "border. And it plans at the level of a continent, not a route: " +
                                "it knows Europe is worth taking, not which three territories in " +
                                "sequence would take it."
                        ),
                        h("How to exploit it"),
                        ul(
                            "Find out which three continents your neighbours want. A country " +
                                "whose campaign is elsewhere will largely leave you alone unless " +
                                "you threaten something it holds; one that has committed to your " +
                                "continent will keep coming back for the same few territories " +
                                "however often you throw it off.",
                            "Forts change its mind, not just its odds. A heavily fortified " +
                                "territory is rated as something to besiege rather than storm, " +
                                "and a country with no siege budget left will simply skip it.",
                            "Make yourself expensive rather than strong everywhere. It ranks " +
                                "targets by worth divided by risk, so a cheap, low-value " +
                                "territory of yours is likelier to be taken than a rich one " +
                                "behind walls — which is the opposite of what you would expect " +
                                "and worth using.",
                            "It does not defend against a threat it cannot see this turn. " +
                                "Massing an army in a territory adjacent to its border still " +
                                "provokes no response at all.",
                            "High-reconquista neighbours are permanent enemies and low-" +
                                "expansion ones are nearly harmless. You cannot see a leader's " +
                                "traits in game, but you can infer them from behaviour over a " +
                                "few turns."
                        ),
                        planned(
                            "The 206 independent countries should be consolidated into eight to " +
                                "sixteen POWERS owning many countries each, with the rest as " +
                                "minor or neutral states. That single change makes the AI turn " +
                                "fast, the world legible, and diplomacy possible — none of which " +
                                "is true with 206 unrelated actors."
                        ),
                        planned(
                            "Route planning. A country knows which continent it wants and which " +
                                "territories are worth taking, but it weighs each target on its " +
                                "own — it cannot yet say \"these three in this order, and the " +
                                "second one only once the first is safe\"."
                        ),
                    ],
                },
                {
                    id: "common-mistakes",
                    title: "Common Mistakes",
                    summary: "The things the game does not warn you about.",
                    body: [
                        h("Buying infantry for a siege"),
                        p(
                            "Infantry are the cheapest force in the game per gold and very " +
                                "nearly the worst thing to besiege with: a gold of infantry is " +
                                "worth 0.01 of siege score against an assault unit's 0.06. Buy " +
                                "them to hold ground and to win open battles; buy assault to " +
                                "take a territory that is dug in. See \"Unit Types\"."
                        ),
                        h("Not building the first fort"),
                        p(
                            "Zero fortification means a defence multiplier of zero, which means " +
                                "no defence at all. The most expensive single omission available " +
                                "to you, and it costs 1,000 gold to fix."
                        ),
                        h("Buying vehicles before oil wells"),
                        p(
                            "You will own them, feed them, and be unable to use them. Check Oil " +
                                "against Oil Demand in the territory panel before every vehicle " +
                                "purchase."
                        ),
                        h("Attacking out of your strongest territory"),
                        p(
                            "The army leaves the moment you press INVADE and does not come back " +
                                "for one to two turns. The AI moves in between."
                        ),
                        h("Treating the bar as the answer"),
                        p(
                            "The bar decides how many DICE you roll and nothing else. Because " +
                                "ties go to the defender, an even bar is a battle you will " +
                                "probably lose. The forecast under it is the number that answers " +
                                "\"will I take this\" — and the dice preview is where you find " +
                                "the band edge that is worth another unit."
                        ),
                        h("Ignoring the siege markers"),
                        p(
                            "A besieged territory of yours earns nothing at all — not gold, not " +
                                "oil, not materials — for as long as the siege runs, which can " +
                                "be indefinitely. If your income falls and nothing was " +
                                "conquered, this is why."
                        ),
                        h("Expanding into a poor continent"),
                        p(
                            "An African territory earns 30% of what an equivalent European one " +
                                "earns, and nothing you can build changes that. Area is not " +
                                "value; area in Europe or North America is."
                        ),
                        h("Advancing the phase too early"),
                        p(
                            "There is no way back to BUY / UPGRADE within a turn, and no undo " +
                                "on a purchase."
                        ),
                    ],
                },
            ],
        },
        {
            id: "reference",
            title: "Reference",
            topics: [
                {
                    id: "random-events",
                    title: "Random Events",
                    summary: "The things that happen to you rather than because of you.",
                    body: [
                        p(
                            "Once a turn the world rolls for a disaster. If it fires, one of " +
                                "four is chosen and applied to EVERY territory on the map — " +
                                "yours and every AI's — each of which gets its own 50% coin flip " +
                                "for whether it is hit or escapes."
                        ),
                        table(
                            ["Event", "What it does to a territory it hits"],
                            [
                                ["Food Disaster", "food stock halved"],
                                ["Oil Well Fire", "oil stock divided by 1.5"],
                                ["Warehouse Fire", "construction materials divided by 1.5"],
                                ["Mutiny", "gold reduced by 25%, and NO gold income at all that turn"],
                            ]
                        ),
                        h("How likely"),
                        p(
                            "The chance starts at zero and climbs by one percentage point every " +
                                "quiet turn, resetting to zero whenever an event fires. It is " +
                                "compared against the AVERAGE of five draws rather than a single " +
                                "one, which pulls the result towards the middle: a disaster in " +
                                "the first few turns is very unlikely, and one by turn twenty is " +
                                "close to certain."
                        ),
                        p(
                            "So disasters are not random noise, they are a rising tension. If " +
                                "it has been quiet for fifteen turns, do not leave your stocks " +
                                "at the ceiling."
                        ),
                        h("How you find out"),
                        p(
                            "The news panel tells you. A disaster writes one item there — the " +
                                "worst-hit of your territories, how many were struck, and the " +
                                "fact that nothing will grow anywhere this turn. Before that it " +
                                "reported itself to nobody: a number simply fell, and the halt " +
                                "in growth had no visible cause at all."
                        ),
                        h("The turn it fires"),
                        p(
                            "Regeneration is suppressed everywhere for that turn. That is " +
                                "deliberate — you get one turn to look at the damage and respond " +
                                "before the economy starts healing it over."
                        ),
                        h("What can be done about it"),
                        ul(
                            "Nothing prevents one. There is no insurance, no warning, no " +
                                "mitigation building.",
                            "The damage is proportional, so a territory sitting at full " +
                                "capacity loses the most in absolute terms.",
                            "It hits the AI too, and it hits them harder in aggregate because " +
                                "they hold more of the map. A disaster on turn twenty is " +
                                "quietly in your favour."
                        ),
                        planned(
                            "Events are all negative and all economic. Positive events — a good " +
                                "harvest, an oil strike, a defector bringing an army — and " +
                                "military events would make the roll something to look forward " +
                                "to rather than only to dread."
                        ),
                    ],
                },
                {
                    id: "saving-and-loading",
                    title: "Saving and Loading",
                    summary: "Save codes, the autosave, and starting over.",
                    body: [
                        p(
                            "A whole game compresses to a code you can copy out of the Save / " +
                                "Load panel and paste back in later. The game also saves itself " +
                                "while you play, and the main menu's Resume Game picks that up."
                        ),
                        h("The autosave"),
                        p(
                            "It runs on a one-minute timer, and it is gated as well as timed: a " +
                                "tick is skipped unless the game is waiting for you and no " +
                                "battle, battle-results or transfer window is open. A save taken " +
                                "mid-battle would store a world that cannot be resumed to the " +
                                "screen you were looking at."
                        ),
                        p(
                            "The spinner at the bottom right is the autosave writing. It is at " +
                                "the bottom because the top right is where the map chrome lives."
                        ),
                        p(
                            "There is one autosave slot. Starting a new game overwrites it, " +
                                "which is why New Game asks first."
                        ),
                        h("The save code"),
                        p(
                            "A compressed text blob holding the whole world: every territory, " +
                                "every siege, every war in progress, the activity log, your " +
                                "audio settings and the turn counter. Paste it anywhere you like " +
                                "— it is just text, it contains nothing personal, and it will " +
                                "reload in any browser."
                        ),
                        p(
                            "It is also the only way to keep more than one game, since there is " +
                                "one autosave slot. Copy the code before you start something " +
                                "reckless."
                        ),
                        h("Resume Game means two things"),
                        ul(
                            "With a game already running behind the menu, it simply closes the " +
                                "menu — the other half of Escape.",
                            "On a cold start with an autosave present, it loads that autosave, " +
                                "and the button says which turn it will put you back on."
                        ),
                        h("New Game and Restart are the same thing"),
                        p(
                            "There is no separate Restart button because there does not need to " +
                                "be: the two differ only in whether there is a world to throw " +
                                "away. One consequence worth knowing — two new games in the same " +
                                "browser session share the same randomised starting gold, " +
                                "because the pristine world is captured once at page load. " +
                                "Everything you would notice as a different game — the AI " +
                                "leaders and their personalities, the starting forts, every roll " +
                                "thereafter — is generated afterwards and is re-rolled."
                        ),
                        h("A loaded game resumes inside its turn"),
                        p(
                            "Not at the start of it. The saved turn has already had its income, " +
                                "its siege tick and its disaster roll; running those again would " +
                                "pay you twice."
                        ),
                    ],
                },
                {
                    id: "controls",
                    title: "Controls",
                    summary: "Mouse, keyboard and the map.",
                    body: [
                        h("The map"),
                        ul(
                            "The wheel zooms, anchored on the pointer. It is instant rather " +
                                "than animated, so a fast second scroll is never swallowed.",
                            "Drag to pan while zoomed. The view is clamped to the world bounds, " +
                                "so you cannot scroll off the edge.",
                            "Hover a territory to lighten it and show the owning country in the " +
                                "tooltip.",
                            "Click to select. The territory presses in and is raised above its " +
                                "neighbours.",
                            "The continent-view button switches between political colouring " +
                                "(one colour per country) and continent colouring."
                        ),
                        h("Keyboard"),
                        ul(
                            "ESCAPE opens the main menu during play, and closes whatever is on " +
                                "top of the map — a panel, a window, the audio panel, the colour " +
                                "picker.",
                            "That is the whole keyboard. There are no hotkeys for phases, " +
                                "purchases or map modes."
                        ),
                        planned(
                            "Keyboard shortcuts for the phase advance, the territory panel and " +
                                "the activity feed would remove most of the mouse travel in a " +
                                "turn. There is also no keyboard navigation of the map at all, " +
                                "which is an accessibility gap rather than a convenience one."
                        ),
                        h("Windows"),
                        ul(
                            "Every floating window drags by its title bar.",
                            "Whichever window you touched last comes to the front, and opening " +
                                "one focuses it.",
                            "The phase bar folds up to give the map back; the advance button " +
                                "stays where it is when it does."
                        ),
                        h("Audio"),
                        p(
                            "The music note at the top of the right-hand chrome opens the audio " +
                                "panel: play, pause, next track, and a volume and a mute for " +
                                "each of music and effects. The same two mutes appear in the " +
                                "main menu's Options panel, and they are one setting seen twice " +
                                "— changing either moves the other."
                        ),
                        p(
                            "The playlist is every track in the music folder, shuffled so that " +
                                "nothing repeats until everything has played. Music never starts " +
                                "on its own at load, because a browser will refuse it before you " +
                                "have clicked something."
                        ),
                    ],
                },
                {
                    id: "glossary",
                    title: "Glossary",
                    summary: "The words this game uses for its own things.",
                    body: [
                        h("A note on names"),
                        p(
                            "A TERRITORY is one shape on the map, and it is what everything in " +
                                "the game actually happens to. A COUNTRY is every territory " +
                                "flying one flag, which changes as territories are won and lost. " +
                                "A territory also remembers its ORIGINAL OWNER forever, which is " +
                                "what makes an AI want its old land back."
                        ),
                        h("The rest, alphabetically"),
                        ul(
                            "ARRESTED — a besieging army that failed on a negative margin. It " +
                                "is destroyed and half of it joins the defender.",
                            "COMBINED FORCE — an army expressed as one number: infantry count " +
                                "as 1 each, assault 1,000, air 5,000, naval 20,000. It is what " +
                                "the dice bands and every break threshold are measured against.",
                            "DICE BAND — the table that turns a side's share of the two " +
                                "strengths into a number of dice: 70% or more is five, 50% is " +
                                "four, 35% is three, 20% is two, below that is one. The defender " +
                                "is capped at four.",
                            "DIG IN — forfeiting a round's offence for half casualties that " +
                                "round and +1 on every die the next.",
                            "DEACTIVATED — a territory conquered in the last one to three turns. " +
                                "It cannot attack or transfer.",
                            "DEFENCE MULTIPLIER — forts plus mountains, divided by 15, rounded " +
                                "up. What the defender's army is multiplied by. Zero if there is " +
                                "no fortification at all.",
                            "DEVELOPMENT INDEX — a fixed per-territory number between roughly " +
                                "0.4 and 0.95. Multiplies income, cuts building costs, " +
                                "strengthens forts, helps you attack and reduces famine deaths.",
                            "FACE BONUS — a modifier added to every die a side rolls, capped at " +
                                "±2. It changes who wins a contested pairing; it can do nothing " +
                                "about an unmatched one.",
                            "LAST PUSH — an offer made while the defender sits between 20% and " +
                                "30% of its starting force: take the territory now for a fifth " +
                                "of your survivors, or keep rolling.",
                            "MARGIN — a siege's score minus the territory's forts and mountains. " +
                                "Every probability in a siege turn is a band on it.",
                            "PAIRING — one of your dice against one of theirs, after both sides " +
                                "have sorted highest first. The higher value wins it; a tie goes " +
                                "to the defender. Losing one costs that side a tenth of its " +
                                "remaining force.",
                            "PRODUCTIVE POPULATION — 45% of a territory's population, scaled by " +
                                "the development index. The manpower that crews everything you " +
                                "buy.",
                            "ROUT — an outcome where the defender falls below 20% of its " +
                                "starting force. You take the territory AND absorb half the " +
                                "survivors.",
                            "SCATTER — a retreat taken once any round has been fought. Costs 30% " +
                                "of the committed army and takes two turns to come home.",
                            "SHARE — a side's fraction of the two sides' strengths, 0 to 1. It " +
                                "is what the probability bar shows and it is the input to the " +
                                "dice band. It is NOT your chance of winning.",
                            "SIEGE SCORE — a besieging army weighted for siege work: naval 10, " +
                                "air 5, assault 3, infantry 0.0001.",
                            "UNMATCHED DIE — a die the other side has none left to pair against. " +
                                "It is an automatic hit, every round, with no roll. This is what " +
                                "makes crossing a dice band worth more than any modifier.",
                            "USEABLE — the part of an army a territory has the oil to fuel. Only " +
                                "useable units fight, and only useable units are billed for " +
                                "upkeep."
                        ),
                    ],
                },
                {
                    id: "design-notes",
                    title: "Design Notes",
                    summary: "Where the game is, honestly, and where it could go.",
                    body: [
                        p(
                            "This page is for the reader who wants to know what is finished, " +
                                "what is stubbed and what is simply absent. It is deliberately " +
                                "blunt."
                        ),
                        h("The four things most worth fixing, in order"),
                        p(
                            "1. NO COUNTRY EVER TALKS TO ANOTHER. Two hundred and six computer " +
                                "countries plan in complete isolation: there are no alliances, " +
                                "no non-aggression pacts, no shared wars and no way for you to " +
                                "propose any of those. The one exception is the offer to lift " +
                                "a siege for gold, which the computer makes to you and never " +
                                "to another computer. A world of independent actors is why the " +
                                "map consolidates as slowly as it does."
                        ),
                        p(
                            "2. THE OPENING IS NOT THE SAME GAME AS THE REST. The computer " +
                                "countries get their leaders and their first forts only after " +
                                "turn 1 has already been planned and earned, so the first turn " +
                                "of a game is played over a slightly emptier world than every " +
                                "turn after it. Giving them a fully formed first turn was " +
                                "tried and measured, and it eliminated the player every time, " +
                                "so it is a balance question rather than an oversight."
                        ),
                        p(
                            "3. A SIEGE STILL HAS NO CLOCK. What a siege DOES to a territory is " +
                                "settled — a quarter income, no construction, and starvation — " +
                                "but nothing ENDS one except an arrest or a conquest, so a " +
                                "besieged territory can sit under siege for the rest of the " +
                                "game. A turn limit, or a besieging army that pays upkeep for " +
                                "the privilege, would each give it an ending."
                        ),
                        p(
                            "4. AN UNFORTIFIED TERRITORY HAS NO DEFENCE AT ALL. The multiplier " +
                                "rounds up from zero and so is zero when there is no bonus, " +
                                "which makes any attack on a fresh coastal territory a formality " +
                                "regardless of its garrison. It reads as intended-to-be-1."
                        ),
                        h("Known imprecisions, deliberately left alone"),
                        ul(
                            "The small-territory defence bonus is inverted — nothing gets it, " +
                                "and large territories are penalised instead (issue AR).",
                            "Battle rout thresholds are measured a full round late (issue AP).",
                            "An upgrade order is priced at the last building in it, so five " +
                                "farms bought together cost about 2.2 times less than five " +
                                "bought one a turn. That one is deliberate: it is a reason to " +
                                "save up."
                        ),
                        p(
                            "The first two change the odds across the whole map, so each " +
                                "belongs to a deliberate balance pass rather than to a quiet " +
                                "fix on the way past. AR in particular has been measured twice " +
                                "and both corrections were worse than leaving it: the ratio is " +
                                "unbounded as a territory gets smaller, so the obvious fix " +
                                "hands the smallest place on the map a thousandfold defence."
                        ),
                        h("What is designed and not built"),
                        ul(
                            "Continent control bonuses. Continents exist as modifiers; holding " +
                                "one whole grants nothing.",
                            "Technology or research. The development index is the most " +
                                "important number a territory has and nothing raises it.",
                            "Naval and air movement. There is no sea travel, range or transport " +
                                "— reach is a fixed property of the map.",
                            "Long-term AI goals, and consolidating 206 countries into 8–16 " +
                                "powers.",
                            "Diplomacy beyond the single gold offer.",
                            "Difficulty settings. AI aggression is per-leader random only.",
                            "Any reason to stop expanding — no supply lines, no unrest, no " +
                                "over-extension penalty.",
                            "Multiplayer, despite what the repository is called."
                        ),
                        h("The one design tension worth naming"),
                        planned(
                            "There is currently no pressure against growth. Every territory " +
                                "taken is a straight gain, so the optimal play is always to " +
                                "expand and the game has no shape to its middle. A single " +
                                "cohesion or supply pressure — an empire beyond a certain size " +
                                "paying a penalty per territory, or distant territories earning " +
                                "less — would give the economy something to push against and " +
                                "turn expansion into a decision rather than a habit. It is a " +
                                "small change and it is probably the highest-leverage one on " +
                                "this page after victory conditions."
                        ),
                    ],
                },
            ],
        },
    ].map((section) =>
        Object.freeze({ ...section, topics: Object.freeze(section.topics.map(Object.freeze)) })
    )
);

/**
 * Every sub-topic in the book, in reading order, each carrying the section it
 * belongs to.
 *
 * Built once at module load. The catalogue is frozen and cannot grow at runtime,
 * so rebuilding this per call would only be work.
 */
const FLAT = Object.freeze(
    DOMINAPEDIA_SECTIONS.flatMap((section) =>
        section.topics.map((topic) =>
            Object.freeze({ ...topic, sectionId: section.id, sectionTitle: section.title })
        )
    )
);

/** @returns {ReadonlyArray<object>} every sub-topic, in reading order. */
export function allTopics() {
    return FLAT;
}

export function topicCount() {
    return FLAT.length;
}

/** The 0-based position of a sub-topic in the whole book, or -1. */
export function topicIndex(id) {
    return FLAT.findIndex((topic) => topic.id === id);
}

/** The sub-topic with this id, or `null`. */
export function topicById(id) {
    return FLAT.find((topic) => topic.id === id) ?? null;
}

/** The section holding this sub-topic, or `null`. */
export function sectionForTopic(id) {
    return DOMINAPEDIA_SECTIONS.find((section) => section.topics.some((t) => t.id === id)) ?? null;
}

/** What the panel opens on. */
export function firstTopicId() {
    return FLAT[0].id;
}

/**
 * The next sub-topic, wrapping from the end of the book back to the start.
 *
 * An id that is not in the catalogue is treated as sitting just before the first
 * topic rather than as an error: the panel asks for `next` from whatever it is
 * currently showing, and a topic renamed out of the book must not leave the two
 * buttons dead.
 */
export function nextTopicId(id) {
    const index = topicIndex(id);
    if (index === -1) return FLAT[0].id;
    return FLAT[(index + 1) % FLAT.length].id;
}

/** The previous sub-topic, wrapping from the start of the book round to the end. */
export function previousTopicId(id) {
    const index = topicIndex(id);
    if (index === -1) return FLAT[FLAT.length - 1].id;
    return FLAT[(index - 1 + FLAT.length) % FLAT.length].id;
}
