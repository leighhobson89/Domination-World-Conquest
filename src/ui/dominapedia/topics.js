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
// Three shapes are worth stating, because content will be poured into them:
//
//   * **A body is BLOCKS, not a string of markup.** `{ kind: "p" | "h" | "ul" |
//     "todo" }` is the whole vocabulary today. Prose written as HTML would put the
//     panel's styling decisions inside the content, and every later change to how
//     a Dominapedia page looks would then be a hundred content edits.
//   * **`summary` is one sentence saying what the page answers**, shown under the
//     title on the page itself and used as the link's tooltip, so it is never a
//     restatement of the title.
//   * **Ids are stable identity and are what Previous / Next carry.** They are
//     also what a future "open the Dominapedia at THIS topic" link from a game
//     screen would name, so rename a title freely and an id never.
//
// The bodies below are PLACEHOLDERS. Each says what the finished page will cover
// rather than pretending to be it -- a page of lorem ipsum in a help system reads
// as a bug, and a page that half-explains a rule is worse than one that says the
// explanation is coming.

/** A paragraph. */
const p = (text) => ({ kind: "p", text });
/** A sub-heading inside a page. */
const h = (text) => ({ kind: "h", text });
/** A bulleted list. */
const ul = (...items) => ({ kind: "ul", items });
/**
 * The standing note that a page is not written yet.
 *
 * It is a block of its own rather than a paragraph so the stylesheet can mark it,
 * and so that "which pages are still placeholders" is a grep for one token rather
 * than a reading of every body in the file.
 */
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
                    summary: "The shape of the game, and how a game is won.",
                    body: [
                        p(
                            "Domination is a turn-based game of world conquest. You take one " +
                                "country, every other country is played by the computer, and the " +
                                "map is the whole of it — there is no board off to one side."
                        ),
                        todo(
                            "To be written: the victory condition, the length of a typical game, " +
                                "and what the player is actually optimising for."
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
                                "colour it is drawn in. Click any territory on the map to choose " +
                                "the country that holds it."
                        ),
                        todo(
                            "To be written: why the five strongest countries are greyed out and " +
                                "cannot be chosen, and how to read a starting position."
                        ),
                    ],
                },
                {
                    id: "reading-the-screen",
                    title: "Reading the Screen",
                    summary: "Every bar, button and panel, and what each one is for.",
                    body: [
                        p("The screen is four things arranged around one map."),
                        ul(
                            "The top bar: everything your country owns, totalled.",
                            "The bottom bar: the territory you last clicked.",
                            "The phase bar: whose turn it is, and the button that ends yours.",
                            "The chrome down the sides: the menu, the territory panel, the " +
                                "activity feed, the continent view and the music."
                        ),
                        todo("To be written: a labelled picture of the whole screen."),
                    ],
                },
                {
                    id: "your-first-turn",
                    title: "Your First Turn",
                    summary: "A walkthrough of one turn, start to finish.",
                    body: [
                        todo(
                            "To be written: buy, upgrade, move, attack, end turn — in that order, " +
                                "with the reason each step comes where it does."
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
                    id: "buy-upgrade-phase",
                    title: "Buy / Upgrade Phase",
                    summary: "Spending what last turn earned.",
                    body: [
                        p(
                            "A turn opens with your income already paid. This is the phase in " +
                                "which it is spent: military units in one window, territory " +
                                "improvements in the other."
                        ),
                        todo("To be written: what is worth buying first, and why."),
                    ],
                },
                {
                    id: "military-phase",
                    title: "Military Phase",
                    summary: "Moving armies, and starting battles.",
                    body: [
                        todo(
                            "To be written: the difference between a transfer and an attack, and " +
                                "what the move button's colour is telling you."
                        ),
                    ],
                },
                {
                    id: "the-ai-turn",
                    title: "The AI Turn",
                    summary: "What happens while the button says AI MOVING.",
                    body: [
                        todo(
                            "To be written: what the other countries do with their turn, and " +
                                "where to read what they did to you."
                        ),
                    ],
                },
                {
                    id: "the-activity-feed",
                    title: "The Activity Feed",
                    summary: "The military log, turn by turn.",
                    body: [
                        p(
                            "The feed records what happened, not what anyone intends: conquests, " +
                                "failed attacks, sieges begun and sieges ended, grouped by the " +
                                "turn they happened in."
                        ),
                        todo("To be written: the colour coding, and which entries are yours."),
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
                        todo(
                            "To be written: population, area, resources, and what changes the " +
                                "moment a territory changes hands."
                        ),
                    ],
                },
                {
                    id: "terrain-and-defence",
                    title: "Terrain and Defence",
                    summary: "Mountains, coasts, and the defence bonus.",
                    body: [
                        todo(
                            "To be written: how the mountain defence factor and the defence bonus " +
                                "enter a battle, and which territories are worth holding for the " +
                                "ground rather than for the income."
                        ),
                    ],
                },
                {
                    id: "upgrading-a-territory",
                    title: "Upgrading a Territory",
                    summary: "Farms, forests, oil wells and forts.",
                    body: [
                        todo(
                            "To be written: what each improvement produces, what it costs, and " +
                                "the point at which a fort is worth more than another farm."
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
                    summary: "Gold, oil, food and construction materials.",
                    body: [
                        ul(
                            "Gold buys almost everything.",
                            "Oil is what mechanised and air units run on.",
                            "Food feeds population and army alike.",
                            "Construction materials build what is built on the ground."
                        ),
                        todo(
                            "To be written: where each one comes from, and which runs out first."
                        ),
                    ],
                },
                {
                    id: "income-and-upkeep",
                    title: "Income and Upkeep",
                    summary: "What arrives each turn, and what it is spent on before you see it.",
                    body: [
                        todo(
                            "To be written: how income is calculated from the territories you " +
                                "hold, and why a besieged territory pays nothing."
                        ),
                    ],
                },
                {
                    id: "population-and-production",
                    title: "Population and Production",
                    summary: "The number every purchase is really limited by.",
                    body: [
                        todo(
                            "To be written: production population, how it grows, and what spends " +
                                "it."
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
                    summary: "Infantry, assault, air and naval.",
                    body: [
                        todo(
                            "To be written: what each unit is good against, what it costs to buy " +
                                "and to run, and which units can reach which territories."
                        ),
                    ],
                },
                {
                    id: "declaring-an-attack",
                    title: "Declaring an Attack",
                    summary: "Choosing a target and committing an army to it.",
                    body: [
                        p(
                            "An attack is armed in two steps: pick the territory you are " +
                                "attacking from, then the territory you are attacking. Nothing is " +
                                "committed until the army is sent."
                        ),
                        todo(
                            "To be written: how the probability bar is calculated, and what is " +
                                "deducted the moment INVADE is pressed."
                        ),
                    ],
                },
                {
                    id: "resolving-a-battle",
                    title: "Resolving a Battle",
                    summary: "Rounds, losses, and the choice at the end of each one.",
                    body: [
                        todo(
                            "To be written: how a round is fought, and when to advance, retreat " +
                                "or dig in."
                        ),
                    ],
                },
                {
                    id: "sieges",
                    title: "Sieges",
                    summary: "Surrounding a territory instead of storming it.",
                    body: [
                        p(
                            "A siege is what happens when an attack does not finish: the " +
                                "attacking army stays put, the defending territory earns nothing, " +
                                "and the two sides grind against each other a turn at a time."
                        ),
                        todo(
                            "To be written: the siege score, how a siege ends, and how to break " +
                                "one that is being run against you."
                        ),
                    ],
                },
                {
                    id: "retreating",
                    title: "Retreating",
                    summary: "Getting an army back, and what it costs.",
                    body: [
                        todo(
                            "To be written: where a retreating army goes, how long it takes to " +
                                "arrive, and when a retreat is free."
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
                        todo(
                            "To be written: the event table, roughly how likely each one is, and " +
                                "what can be done about it."
                        ),
                    ],
                },
                {
                    id: "saving-and-loading",
                    title: "Saving and Loading",
                    summary: "Save codes, and the autosave.",
                    body: [
                        p(
                            "A whole game compresses to a code you can copy out of the Save / " +
                                "Load panel and paste back in later. The game also saves itself " +
                                "while you play, and the main menu's Resume picks that up."
                        ),
                        todo(
                            "To be written: what a save code contains, and where it is safe to " +
                                "keep one."
                        ),
                    ],
                },
                {
                    id: "controls",
                    title: "Controls",
                    summary: "Mouse, keyboard and the map.",
                    body: [
                        ul(
                            "Escape opens the menu, and closes whatever is on top of the map.",
                            "The wheel zooms the map on the pointer; drag to pan.",
                            "Every floating window can be dragged by its title bar."
                        ),
                        todo("To be written: the full list, once there is one."),
                    ],
                },
                {
                    id: "glossary",
                    title: "Glossary",
                    summary: "The words this game uses for its own things.",
                    body: [
                        h("A note on names"),
                        p(
                            "A territory is one shape on the map. A country is every territory " +
                                "flying one flag, which changes as territories are won and lost."
                        ),
                        todo("To be written: the rest of the terms, alphabetically."),
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
