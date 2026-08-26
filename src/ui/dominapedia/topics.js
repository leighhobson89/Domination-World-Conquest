// The Dominapedia's table of contents, and the walk over it.
//
// Refactor plan Phase 7.6. The Help button has been inert since the menu was
// built; this is the book it opens. The catalogue is DATA -- a list of sections,
// each holding sub-topics, each holding body blocks -- and the panel that renders
// it (`src/ui/components/Dominapedia.js`) knows nothing about what is in here.
// Adding a topic is one entry in this file and no change to the component, which
// is the same arrangement `src/ui/infoTable/columns.js` records for the info
// panel's four tabs and `src/ui/theme/themes.js` for the palettes.
//
// This file imports nothing and touches no DOM. That is what lets the navigation
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
// having no defensive multiplier at all, infantry costing a thousand people to
// field one soldier -- it is stated anyway, plainly, because the player meets it
// whether or not the manual admits to it. `design-notes` is where those are
// collected and named.

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
                    summary: "What you are trying to achieve, and what would end a game.",
                    body: [
                        h("The honest position first"),
                        p(
                            "As the game stands, it does not end. Nothing checks whether you " +
                                "have conquered the world and nothing checks whether you have " +
                                "been wiped off it. You can play until you are bored, and the " +
                                "autosave will still be there when you come back."
                        ),
                        p(
                            "Everything below this line is the design for what victory SHOULD " +
                                "be. It is written here rather than in a planning document " +
                                "because this is the page a player would look for it on, and " +
                                "because deciding it is the single largest open question the " +
                                "game has."
                        ),
                        h("The four victory conditions"),
                        p(
                            "These four are DEFINED, and the game measures every country's " +
                                "progress towards whichever one is active — but nothing ends " +
                                "when one is met, and there is no screen on which to choose " +
                                "between them yet. What they already do is give the computer " +
                                "players something to play for; see \"How the AI Thinks\"."
                        ),
                        ul(
                            "CONTINENTAL — hold every territory on any three continents " +
                                "outright. A shorter, sharper game for a player who does not " +
                                "want to click through the whole map, and the condition that " +
                                "gives continent control a point. This is the DEFAULT, and it " +
                                "is what every computer country is currently campaigning towards.",
                            "DOMINATION — hold 60% of the world's land area. Area rather than " +
                                "territory count, because the map's territories are wildly " +
                                "unequal in size and a hundred Caribbean islands should not " +
                                "outweigh Russia.",
                            "ELIMINATION — you lose when you hold no territories at all. The " +
                                "defeat condition; it needs no configuration.",
                            "SCORE AT THE TURN LIMIT — at turn 100, the largest empire by land " +
                                "area wins. A backstop, so that a stalemate has an ending."
                        ),
                        planned(
                            "Choosing between them when the game is started, alongside the " +
                                "country and the colour. The AI already adapts to whichever is " +
                                "active — a country playing for DOMINATION spreads across four " +
                                "continents where one playing for CONTINENTAL tunnels into " +
                                "three — so what is missing is the screen and nothing else."
                        ),
                        planned(
                            "The moment the game STOPS and says so, and a permanent line " +
                                "showing where you are: \"Domination: 12% of 60%\" would turn " +
                                "every turn into progress towards something. The number behind " +
                                "that line is already worked out for every country every turn."
                        ),
                        h("What you are optimising for in the meantime"),
                        p(
                            "Without a victory condition there is still a right way to play, " +
                                "and it is worth naming because the four things that matter are " +
                                "not the four things a new player watches."
                        ),
                        ul(
                            "LAND AREA is the base of everything. It drives gold, it drives " +
                                "resource capacity, and it is what a domination victory would " +
                                "count. Territory count is a poor proxy for it.",
                            "PRODUCTIVE POPULATION is the real currency. Gold is easy to come " +
                                "by; the people to crew what gold buys are not, and running out " +
                                "of them stops your army growing no matter how rich you are.",
                            "OIL decides how much of the army you own is an army you can use. " +
                                "A fleet with no fuel is a line in a table.",
                            "A DEFENSIBLE FRONTIER. Every territory you take is a territory " +
                                "someone can take back, and a conquered one sits out one to " +
                                "three turns before it can do anything at all."
                        ),
                        h("What the AI is trying to do"),
                        p(
                            "The same thing you are. Every computer country commits to three " +
                                "continents of its own — the ones it has a foothold on, that " +
                                "are worth holding, and that nobody stronger is already sitting " +
                                "on — and works towards owning them outright. It keeps that " +
                                "commitment across turns rather than re-choosing every turn, it " +
                                "weighs a target by whether taking it advances the plan, and it " +
                                "will decline a fight it does not rate. See \"How the AI " +
                                "Thinks\"."
                        ),
                        p(
                            "Two consequences for you. A neighbour that has committed to YOUR " +
                                "continent is a permanent problem and will keep coming back for " +
                                "the same few territories; one whose three continents are " +
                                "elsewhere will largely leave you alone until you threaten " +
                                "something it holds. And every computer country is racing you " +
                                "to the same condition, so the map has a clock on it even " +
                                "though nothing yet declares a winner."
                        ),
                    ],
                },
                {
                    id: "choosing-a-country",
                    title: "Choosing a Country",
                    summary: "What the selection screen is asking, and what is locked.",
                    body: [
                        p(
                            "Before the first turn you pick the country you will play and the " +
                                "colour it is drawn in. Click any territory on the map and you " +
                                "take the whole country that holds it — every territory flying " +
                                "that flag, not just the one you clicked."
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
                            "Below that, the globe — the territory information panel, four tabs " +
                                "of everything you own.",
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
                            "The activity feed, which is where everything else went."
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
                        h("Besieged territories earn nothing"),
                        p(
                            "A territory under siege produces no gold, no oil and no " +
                                "construction materials, for as long as the siege lasts — and a " +
                                "siege can last indefinitely. This is the harshest rule in the " +
                                "game and it is currently uncapped."
                        ),
                        planned(
                            "A siege should have a decaying yield rather than a total blackout, " +
                                "or a hard turn limit after which it resolves one way or the " +
                                "other. Being frozen at zero income for eleven turns with no " +
                                "counter-play is not a design decision, it is an unfinished one."
                        ),
                    ],
                },
                {
                    id: "terrain-and-defence",
                    title: "Terrain and Defence",
                    summary: "Mountains, coasts, forts, and the multiplier that decides battles.",
                    body: [
                        p(
                            "A defender's army is multiplied before a battle is scored. This is " +
                                "the most important number on this page and the least visible " +
                                "one in the game."
                        ),
                        h("The defence multiplier"),
                        p(
                            "Add the territory's fort bonus to its mountain bonus, divide by " +
                                "15, and round UP. That is what the defender's army is " +
                                "multiplied by."
                        ),
                        table(
                            ["Total bonus", "Defender's army is multiplied by"],
                            [
                                ["0", "0 — no defence at all"],
                                ["1 to 15", "2×"],
                                ["16 to 30", "3×"],
                                ["31 to 45", "4×"],
                                ["and so on", "one more per 15 points"],
                            ]
                        ),
                        p(
                            "Read the first row again. A coastal territory with no forts and no " +
                                "mountains has a total bonus of zero, and therefore defends at " +
                                "zero — any attack on it succeeds outright regardless of how " +
                                "large its garrison is. Your territories start with no forts."
                        ),
                        p(
                            "So: the first fort in a territory is not an incremental " +
                                "improvement. It is the difference between a garrison that " +
                                "fights and a garrison that does not. Build one everywhere " +
                                "before you build anything else anywhere."
                        ),
                        h("Where the bonus comes from"),
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
                                ["Farm", "200", "500", "+10% food capacity per farm"],
                                ["Forest", "200", "500", "+10% construction-materials capacity per forest"],
                                ["Oil Well", "1,100", "200", "+10% oil capacity per well"],
                                ["Fort", "1,000", "600", "defence bonus, quadratic in the count"],
                            ]
                        ),
                        h("What you actually pay"),
                        p(
                            "The real price is the base figure multiplied by about 1.05 and " +
                                "then by a quarter of the territory's development index. A " +
                                "developed territory therefore builds much more cheaply than a " +
                                "poor one — which is the reverse of what most players expect, " +
                                "and it means the correct place to build is where you are " +
                                "already strong."
                        ),
                        p(
                            "The price does NOT rise with the number already built. The fifth " +
                                "fort costs what the first did and is worth several times more."
                        ),
                        h("Capacity is not stock"),
                        p(
                            "A farm does not give you food. It raises the CEILING that food " +
                                "regrows towards, and the regrowth then closes a fifth of the " +
                                "gap each turn. A farm bought this turn shows up as income over " +
                                "the next several."
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
                                "building a siege destroys on purpose, so on a territory that is " +
                                "already besieged, building more of them is throwing materials " +
                                "into a fire."
                        ),
                        h("A warning about capacity"),
                        p(
                            "Capacity increases from purchases are known to compound more than " +
                                "intended, so a heavily-upgraded territory's ceilings can climb " +
                                "faster than the table above suggests. It is the most visible " +
                                "economic oddity in the game and it is logged."
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
                            "Each territory earns from its productive population, scaled by its " +
                                "development index, its area and its continent, and then " +
                                "normalised so that the gap between the world's smallest and " +
                                "largest economies stays playable. Without that normalisation " +
                                "the biggest countries would snowball out of reach on turn one."
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
                        h("Army upkeep"),
                        p(
                            "Every unit costs gold every turn simply for existing, charged " +
                                "against the territory it garrisons. Grounded vehicles are not " +
                                "billed — a unit you cannot fuel is not also a unit you pay for."
                        ),
                        table(
                            ["Unit", "Gold per turn", "Per 100 units"],
                            [
                                ["Infantry", "0.00005", "0.005"],
                                ["Assault", "0.05", "5"],
                                ["Air", "0.25", "25"],
                                ["Naval", "1", "100"],
                            ]
                        ),
                        p(
                            "These rates were deliberately set at a tenth of their original " +
                                "values. At the original rates every major power on the map went " +
                                "bankrupt within forty turns with no way to respond. As they " +
                                "stand, a normal standing army costs roughly what its territory " +
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
                            "A besieged territory contributes no gold, no oil and no " +
                                "construction materials at all. If your income dropped sharply " +
                                "and nothing was conquered, check the map for siege markers " +
                                "before you check anything else."
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
                    summary: "Infantry, assault, air and naval — and which is a trap.",
                    body: [
                        table(
                            ["Unit", "Gold", "Manpower", "Oil/turn", "Counts as", "Siege value"],
                            [
                                ["Infantry", "10", "1,000", "0", "1 person", "0.0001"],
                                ["Assault", "50", "1,000", "100", "1,000 people", "3"],
                                ["Air", "100", "5,000", "300", "5,000 people", "5"],
                                ["Naval", "200", "20,000", "1,000", "20,000 people", "10"],
                            ]
                        ),
                        h("Read the 'counts as' column carefully"),
                        p(
                            "An army's strength in battle is the sum of what its units count " +
                                "as. One naval unit is worth twenty thousand infantry in that " +
                                "sum — and costs twenty naval units' worth of gold to buy, which " +
                                "is to say 200 gold against the 200,000 gold that twenty " +
                                "thousand infantry would cost."
                        ),
                        p(
                            "Infantry are therefore very nearly worthless to buy. One infantry " +
                                "unit costs a thousand productive population and adds one point " +
                                "of strength, while one assault unit costs the same thousand " +
                                "people and adds a thousand points. The infantry you have are " +
                                "the infantry you started with and the infantry you capture."
                        ),
                        planned(
                            "The intent was clearly that infantry are bought in troops of a " +
                                "thousand — the manpower price is literally named for it — and " +
                                "the strength conversion counts them as one. Fixing the mismatch " +
                                "changes the value of every army on the map, so it belongs to a " +
                                "deliberate balance pass. Until then, treat infantry as a " +
                                "garrison you inherit rather than a unit you buy."
                        ),
                        h("The matchup matrix"),
                        p(
                            "Any unit type can fight any other. How well it does is scaled by " +
                                "this table — the row is the attacking type, the column the " +
                                "defending one. 1.0 is neutral, and same against same is always " +
                                "1.0."
                        ),
                        table(
                            ["Attacker \\ Defender", "vs Infantry", "vs Assault", "vs Air", "vs Naval"],
                            [
                                ["Infantry", "1.0", "0.6", "0.4", "0.5"],
                                ["Assault", "1.4", "1.0", "0.5", "0.7"],
                                ["Air", "1.5", "1.6", "1.0", "1.4"],
                                ["Naval", "0.8", "0.7", "0.5", "1.0"],
                            ]
                        ),
                        p(
                            "Air is the best attacker in the game against everything and the " +
                                "hardest thing to attack: nothing scores better than 0.5 against " +
                                "it. Naval is the weakest attacker per unit but by far the " +
                                "strongest thing to have in a sum, and the best besieger."
                        ),
                        h("What to build"),
                        ul(
                            "AIR if you intend to attack. Best matchups in the game, and the " +
                                "best value per point of manpower after naval.",
                            "NAVAL if you intend to besiege, or to hold a lot of strength in " +
                                "one place. Bear the 1,000 oil a turn in mind before you buy the " +
                                "first one.",
                            "ASSAULT as the general-purpose unit. Cheap in manpower, cheap in " +
                                "oil, good against infantry, and the AI's armies are mostly " +
                                "infantry.",
                            "INFANTRY: do not buy. Keep what you inherit."
                        ),
                    ],
                },
                {
                    id: "declaring-an-attack",
                    title: "Declaring an Attack",
                    summary: "Choosing a target, reading the odds, and what INVADE costs.",
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
                        h("The probability bar"),
                        p("It updates as you add units. What it is computing:"),
                        ul(
                            "Your side: the total strength of the units you have committed, " +
                                "multiplied by the average development index of the territories " +
                                "they came from, multiplied by how hard the defender's continent " +
                                "is to invade.",
                            "Their side: the total strength of the defender's USEABLE units " +
                                "— grounded vehicles do not defend — multiplied by the " +
                                "territory's defence multiplier, and adjusted for its area.",
                            "The bar is your share of the total."
                        ),
                        p(
                            "Note the asymmetry: your development index helps you, and theirs " +
                                "does not help them directly. And note that the defender's " +
                                "grounded units do not fight — a target whose oil you can see is " +
                                "short is much softer than its army column suggests."
                        ),
                        h("What INVADE! costs immediately"),
                        p(
                            "The units you committed leave their home territories the moment " +
                                "you press it. They are gone from the map, gone from those " +
                                "territories' defence, and gone from the top bar. If you retreat " +
                                "cleanly they come back one turn later; if you scatter, two " +
                                "turns later and 30% fewer."
                        ),
                        p(
                            "The consequence is worth stating plainly: an attack launched from " +
                                "your only fortified territory leaves that territory undefended " +
                                "for at least two turns, during the AI phase, while it is " +
                                "holding your border."
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
                    ],
                },
                {
                    id: "resolving-a-battle",
                    title: "Resolving a Battle",
                    summary: "Rounds, skirmishes, and the six ways a battle can end.",
                    body: [
                        h("The structure"),
                        p(
                            "A battle is five rounds. The total number of skirmishes is the " +
                                "smaller of the two armies' unit counts, divided evenly across " +
                                "the five rounds."
                        ),
                        p(
                            "Each skirmish is one unit against one unit, and exactly one of " +
                                "them dies — there are no partial casualties. Your chance of " +
                                "winning a skirmish is the probability bar, multiplied by the " +
                                "matchup between the two unit types, capped at 65%."
                        ),
                        p(
                            "That cap is the reason a battle is never a formality. A ten-to-one " +
                                "attacker still loses roughly a third of its exchanges, and will " +
                                "take real casualties taking an undefended-looking territory."
                        ),
                        h("Within a round"),
                        p(
                            "Your unit types engage in a RANDOM order, and each type fights " +
                                "until it is spent or the round's skirmish budget runs out. If " +
                                "the first type drawn has nothing left, the round stops there. " +
                                "So a round in which your empty unit type is drawn first is a " +
                                "quiet round — this is a real source of variance and it is " +
                                "deliberate."
                        ),
                        p(
                            "Between rounds the probability is recalculated from the survivors, " +
                                "so a battle going badly gets worse."
                        ),
                        h("The six outcomes"),
                        table(
                            ["Outcome", "Condition", "Result"],
                            [
                                ["You win", "every defender dead", "territory taken, survivors garrison it"],
                                ["You lose", "every attacker dead", "attack fails"],
                                [
                                    "Defender routed",
                                    "defender below 5% of its starting strength",
                                    "territory taken AND half the surviving defenders join you",
                                ],
                                [
                                    "Last push",
                                    "defender below 15% of its starting strength",
                                    "you may take it at the cost of 20% of your survivors",
                                ],
                                [
                                    "You are routed",
                                    "you are below 10% of your starting strength",
                                    "attack fails",
                                ],
                                [
                                    "Fight again",
                                    "none of the above",
                                    "another five rounds, and you lose 5% to desertion",
                                ],
                            ]
                        ),
                        p(
                            "The rout is the outcome worth playing for. Absorbing half of a " +
                                "beaten garrison is the only way in the game to GAIN army " +
                                "without paying gold and manpower for it."
                        ),
                        h("Your buttons"),
                        ul(
                            "ADVANCE — fight the next round.",
                            "RETREAT — leave. Free between rounds, costly mid-round. See " +
                                "\"Retreating\".",
                            "SIEGE — convert the attack into a standing siege, if your odds " +
                                "were 15% or better and you have not besieged this target before."
                        ),
                        h("A known imprecision"),
                        p(
                            "The rout and last-push thresholds are measured against the armies " +
                                "as they stood at the START of the round, not after that round's " +
                                "casualties — a full round of lag. It is logged as known issue " +
                                "AP; correcting it moves every threshold by one round, which is " +
                                "a balance change."
                        ),
                    ],
                },
                {
                    id: "sieges",
                    title: "Sieges",
                    summary: "Surrounding a territory instead of storming it.",
                    body: [
                        p(
                            "A siege is the slow half of the war model. An open battle is five " +
                                "rounds resolved in one sitting; a siege is one roll per turn, " +
                                "for as many turns as it takes, and it is won by starving a " +
                                "territory rather than by beating its army."
                        ),
                        h("Sieges are won with hardware, not bodies"),
                        p(
                            "A besieging army's siege score is: naval 10 each, air 5, assault " +
                                "3, infantry 0.0001. An infantry-only besieger can sit outside a " +
                                "fortified territory forever without ever landing a hit. This is " +
                                "deliberate — a siege is broken by artillery and blockade, not " +
                                "by numbers."
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
                            "THE TERRITORY FALLS — the defender's army drops below 5% of what " +
                                "it started with AND it has no forts left. The siege becomes an " +
                                "outright rout victory for the besieger. Forts are literally " +
                                "what keep a siege going.",
                            "YOUR ARMY IS ARRESTED — on a negative margin, a landed hit has a " +
                                "40% chance of the besieging force being rounded up. Half of it " +
                                "joins the defender. Do not besiege something you do not outgun.",
                            "YOU ASSAULT — click the besieged territory and VIEW SIEGE, then " +
                                "fight it as a normal battle. The defender is already worn down.",
                            "YOU LIFT IT — retreat from the siege screen. Your army comes home.",
                            "SOMEBODY PAYS YOU TO LEAVE — see \"Diplomacy\"."
                        ),
                        h("Being besieged"),
                        p(
                            "The territory earns nothing, its food capacity is being destroyed " +
                                "a slice at a time, and its garrison has a 30% chance each turn " +
                                "of starving at ten times the normal rate. Your options are to " +
                                "build more forts there — the margin is measured against them, " +
                                "and a fort is the only thing that lowers it — or to attack the " +
                                "besieging army's home territory and give it something else to " +
                                "worry about."
                        ),
                        h("Sieges dominate, and that is a problem"),
                        p(
                            "The AI besieges far more than it can finish. Measured over a " +
                                "fourteen-turn game, concurrent AI sieges went from 17 to 67: " +
                                "new ones are launched much faster than existing ones resolve, " +
                                "because a siege only ends on an arrest or a conquest and the AI " +
                                "has no notion of committing enough force to finish one."
                        ),
                        planned(
                            "A siege needs a natural end — a turn limit, an attrition on the " +
                                "besieging army, or a supply cost the besieger has to keep " +
                                "paying. Any of the three would stop the map silting up with " +
                                "sieges nobody is winning. This is the change most likely to " +
                                "make the whole game feel different."
                        ),
                    ],
                },
                {
                    id: "retreating",
                    title: "Retreating",
                    summary: "Getting an army back, and what it costs.",
                    body: [
                        p(
                            "Committed units are gone from their home territories until they " +
                                "are returned. Retreating is how they are returned, and when you " +
                                "press it decides what it costs."
                        ),
                        table(
                            ["Button reads", "When", "Cost", "Army returns"],
                            [
                                ["RETREAT!", "before the battle, or between rounds of five", "nothing", "next turn"],
                                ["SCATTER!", "part-way through a round of five", "30% of the committed army", "in two turns"],
                                ["DEFEAT!", "after the battle is lost", "whatever is left", "—"],
                            ]
                        ),
                        h("The round boundary is the whole trick"),
                        p(
                            "A free retreat is available before the first round and between " +
                                "rounds. Once a round is under way the only way out is a " +
                                "scatter. So the decision to keep going is made five times per " +
                                "battle, and each of those five moments is free — take them " +
                                "seriously rather than clicking through."
                        ),
                        h("Where an army goes"),
                        p(
                            "Back to the territories it came from, in the proportions it left " +
                                "in. An attack gathered from four territories is returned to " +
                                "those four. It arrives at the start of the turn, before you get " +
                                "to act, so a retreat on turn 7 means those units defend turn 8."
                        ),
                        h("Lifting a siege"),
                        p(
                            "Retreating from a siege is the same operation: the siege object is " +
                                "removed, the marker comes off the map and the army is queued " +
                                "for return. There is no penalty for lifting a siege you started."
                        ),
                        h("The gap between the two halves"),
                        p(
                            "The turn or two while an army is in transit is the most dangerous " +
                                "window in the game and there is nothing on screen that tells " +
                                "you it is open. If you retreat from a failed attack and the AI " +
                                "moves before your units land, the territories they came from " +
                                "are defended by whatever you left behind."
                        ),
                        planned(
                            "Armies in transit should be visible — a count in the top bar, or " +
                                "a marker on the territories expecting them. At present the only " +
                                "record is internal."
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
                    id: "reading-the-odds",
                    title: "Reading the Odds",
                    summary: "What the probability bar is not telling you.",
                    body: [
                        p(
                            "The bar is honest about what it computes. It is what it leaves out " +
                                "that costs battles."
                        ),
                        h("70% does not mean 70%"),
                        p(
                            "The bar is your chance of winning ONE skirmish, and it is capped " +
                                "at 65% no matter how favourable it gets. A battle is dozens of " +
                                "skirmishes across five rounds, with the probability " +
                                "recalculated between rounds. A 70% bar is a comfortable battle; " +
                                "it is not a safe one, and you will take real casualties."
                        ),
                        h("Composition is not in the bar"),
                        p(
                            "The bar weighs both armies by head count and multipliers. It does " +
                                "not account for the matchup matrix, which is applied per " +
                                "skirmish. An air-heavy attack against an assault-heavy defender " +
                                "fights at 1.6× the bar; a naval attack against an air defender " +
                                "fights at 0.5×."
                        ),
                        p(
                            "So two attacks showing the same 55% can be a comfortable win and a " +
                                "disaster. Check what they have before you check the bar."
                        ),
                        h("Their grounded units are already gone"),
                        p(
                            "The defender's strength uses their USEABLE units. A territory " +
                                "short of oil is defending with a fraction of what its army " +
                                "column shows — and the bar already knows, which is why an " +
                                "apparently strong target sometimes shows favourable odds. " +
                                "Believe the bar in that direction."
                        ),
                        h("The three things worth checking before every attack"),
                        ul(
                            "How many FORTS does the target have? The defence multiplier is " +
                                "the biggest single term in the calculation and it steps in " +
                                "whole numbers.",
                            "What is my army made of, and what is theirs? Matchups swing a " +
                                "battle further than ten points on the bar.",
                            "What am I leaving behind? The units go the moment you press INVADE."
                        ),
                        h("When to besiege instead"),
                        p(
                            "Against forts. An assault fights the defence multiplier at full " +
                                "strength; a siege attacks the forts themselves, destroying them " +
                                "one at a time and lowering the multiplier as it goes. A heavily " +
                                "fortified territory is a bad assault and a good siege, provided " +
                                "you bring naval and air units to make the margin positive."
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
                                "fighting for, and it is derived from the active victory " +
                                "condition rather than invented — so when the start-of-game " +
                                "chooser lands, every computer country adapts to your choice " +
                                "with no further change. Under the default condition, that means " +
                                "each of them picks THREE CONTINENTS and works towards owning " +
                                "them outright."
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
                        h("Buying infantry"),
                        p(
                            "A thousand productive population for one point of army strength. " +
                                "The same thousand buys an assault unit worth a thousand points. " +
                                "See \"Unit Types\"."
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
                            "Skirmish odds are capped at 65%. Composition matters more than the " +
                                "last ten points on the bar."
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
                    id: "diplomacy",
                    title: "Diplomacy",
                    summary: "The one conversation the AI will have with you.",
                    body: [
                        p(
                            "There is exactly one piece of diplomacy in the game, and it only " +
                                "happens in one situation."
                        ),
                        h("The gold offer"),
                        p(
                            "When an AI country wants to besiege a territory YOU are already " +
                                "besieging, it opens the dialogue box and offers you gold to " +
                                "lift your siege and withdraw. Accept and the gold transfers, " +
                                "your siege is removed and your army is queued for return. " +
                                "Refuse and nothing happens."
                        ),
                        p(
                            "How much they offer is a function of how much gold that country " +
                                "holds, how large the territory is relative to their empire, and " +
                                "how expansionist their leader is — and it DOUBLES if the " +
                                "territory originally belonged to them. A high-reconquista " +
                                "leader trying to buy back its own land will pay well over the " +
                                "odds."
                        ),
                        h("Whether to take it"),
                        p(
                            "Usually yes, if the siege was going badly. You get paid, your army " +
                                "comes home intact, and the AI takes on the cost of a siege you " +
                                "had already decided you could not finish. Refuse when your " +
                                "margin is strongly positive and the territory is worth more " +
                                "than the offer — you are close to a rout victory that also " +
                                "absorbs half the garrison."
                        ),
                        h("Everything else that does not exist"),
                        planned(
                            "There are no alliances, no non-aggression pacts, no trade " +
                                "agreements, no war declarations, no reputation and no shared " +
                                "war. The AI countries do not talk to each other either. The " +
                                "gold offer works and is a good seed: it is a concrete " +
                                "negotiation over a concrete thing, with a price derived from " +
                                "the world state and a personality. Everything else could be " +
                                "built in that shape."
                        ),
                        planned(
                            "Diplomacy is hard to make meaningful with 206 actors — you would " +
                                "need a treaty screen the size of the map. It becomes a real " +
                                "feature only after the AI is consolidated into eight to sixteen " +
                                "powers, which is why the two are sequenced together."
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
                                "as 1 each, assault 1,000, air 5,000, naval 20,000. Every rout " +
                                "threshold is measured against it.",
                            "DEACTIVATED — a territory conquered in the last one to three turns. " +
                                "It cannot attack or transfer.",
                            "DEFENCE MULTIPLIER — forts plus mountains, divided by 15, rounded " +
                                "up. What the defender's army is multiplied by. Zero if there is " +
                                "no fortification at all.",
                            "DEVELOPMENT INDEX — a fixed per-territory number between roughly " +
                                "0.4 and 0.95. Multiplies income, cuts building costs, " +
                                "strengthens forts, helps you attack and reduces famine deaths.",
                            "LAST PUSH — an outcome where the defender is nearly broken and you " +
                                "may take the territory at the cost of a fifth of your survivors.",
                            "MARGIN — a siege's score minus the territory's forts and mountains. " +
                                "Every probability in a siege turn is a band on it.",
                            "PRODUCTIVE POPULATION — 45% of a territory's population, scaled by " +
                                "the development index. The manpower that crews everything you " +
                                "buy.",
                            "ROUT — an outcome where the defender collapses below 5% of its " +
                                "starting strength. You take the territory AND absorb half the " +
                                "survivors.",
                            "SCATTER — a retreat taken part-way through a round. Costs 30% of " +
                                "the committed army and takes two turns to come home.",
                            "SIEGE SCORE — a besieging army weighted for siege work: naval 10, " +
                                "air 5, assault 3, infantry 0.0001.",
                            "SKIRMISH — one unit against one unit; exactly one of them dies.",
                            "USEABLE — the part of an army a territory has the oil to fuel. Only " +
                                "useable units fight, and only useable units are billed for " +
                                "upkeep.",
                            "WAR WEARINESS — the 5% of the attacking army lost when a battle " +
                                "goes to a second set of five rounds."
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
                            "1. THE GAME CANNOT END. No victory condition, no defeat condition, " +
                                "no score. See \"Goals and Victory\" for the proposal. " +
                                "Everything else on this list is a balance question; this one is " +
                                "the difference between a simulation and a game."
                        ),
                        p(
                            "2. SIEGES SILT UP THE MAP. The AI starts far more than it can " +
                                "finish, a besieged territory earns nothing indefinitely, and " +
                                "nothing ends a siege except an arrest or a conquest. A turn " +
                                "limit, a decaying yield, or an upkeep on the besieging army " +
                                "would each fix it."
                        ),
                        p(
                            "3. INFANTRY DO NOT WORK. A thousand people to field one point of " +
                                "strength, against a thousand people for a thousand points as " +
                                "assault. The manpower price is named for troops of a thousand " +
                                "and the strength conversion counts them as one; the two halves " +
                                "disagree."
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
                            "A famine whose losses exactly equal the infantry count destroys " +
                                "the entire mechanised army as well (issue AN).",
                            "Capacity bonuses from upgrades compound more than intended."
                        ),
                        p(
                            "Each of those changes the odds or the economy across the whole " +
                                "map, so each belongs to a deliberate balance pass rather than " +
                                "to a quiet fix on the way past."
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
