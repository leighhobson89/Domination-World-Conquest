// The five goals a player may choose between, as data.
//
// Built the way `src/ui/dominapedia/topics.js` is built, because the shape is the same and
// it is proven: a catalogue of frozen entries that imports almost nothing and is unit-tested
// in Node, and a component that renders whatever the catalogue says and has no opinion about
// the content. Adding a sixth goal is one entry here, one row in `goalDoctrines`, and no
// change to `GoalSelect.js` at all.
//
// Four things about the shape, each of which is a mistake this file is arranged to prevent.
//
// **A body is BLOCKS, never markup.** `{ kind: "p" | "h" | "ul" }` is the whole vocabulary,
// the same one the Dominapedia uses. Prose written as HTML would put the panel's styling
// decisions inside the content, and every later change to how the chooser looks would then
// be five content edits.
//
// **Every goal has a scale list, and World Conquest's holds exactly one entry** reading
// "Total -- every territory on the map". Hiding the dropdown for that one goal would make the panel change
// shape as the player browses, which reads as a rendering fault on the one screen a player
// cannot skip.
//
// **The default scale is one of the goal's own options.** A `<select>` whose value is not in
// its list renders blank. `defaultScaleFor()` takes its answers from `config/balance.js`
// rather than restating them, so the chooser's default and the game's default cannot drift.
//
// **`conditionFor()` is what knows which FIELD a scale belongs on.** This is the one place a
// mistake would be silent: a Domination game with its share written into `continentsRequired`
// is a perfectly valid condition object that plays as the default game, and nothing anywhere
// would say so. The component passes a value and a kind and never touches a field name.
//
// ELIMINATION is deliberately absent. It was written as a victory condition and never was
// one -- it is what LOSING means, it runs underneath every goal, and `victoryCheck.js` is
// what acts on it.

import {
    CONTINENTAL_TIERS,
    CONTINENTS_REQUIRED_FOR_VICTORY,
    DOMINATION_LAND_SHARE,
    DOMINATION_TIERS,
    GREAT_POWERS_REQUIRED,
    GREAT_POWERS_TIERS,
    TURN_LIMIT_TIERS,
    VICTORY_TURN_LIMIT
} from "../../config/balance.js";
import { VictoryCondition } from "../../ai/victory.js";

/** A paragraph. */
const p = (text) => Object.freeze({ kind: "p", text });
/** A sub-heading inside a description. */
const h = (text) => Object.freeze({ kind: "h", text });
/** A bulleted list. */
const ul = (...items) => Object.freeze({ kind: "ul", items: Object.freeze(items) });

const body = (...blocks) => Object.freeze(blocks);
const scale = (value, label) => Object.freeze({ value, label });

/**
 * Which field on the victory condition a goal's scale is written into.
 *
 * `null` means the goal has no scale to write -- World Conquest, whose single option exists
 * so that the panel keeps its shape rather than because there is anything to choose.
 */
const SCALE_FIELD = Object.freeze({
    [VictoryCondition.CONQUEST]: null,
    [VictoryCondition.CONTINENTAL]: "continentsRequired",
    [VictoryCondition.DOMINATION]: "landShare",
    [VictoryCondition.GREAT_POWERS]: "greatPowersRequired",
    [VictoryCondition.TURN_LIMIT]: "turnLimit"
});

const GOALS = Object.freeze([
    Object.freeze({
        kind: VictoryCondition.CONTINENTAL,
        name: "Continental Supremacy",
        summary: "Hold every territory on a set number of continents.",
        scaleLabel: "Continents",
        scales: Object.freeze(CONTINENTAL_TIERS.map(count =>
            scale(count, count + " continents"))),
        defaultScale: CONTINENTS_REQUIRED_FOR_VICTORY,
        body: body(
            p("The shorter, sharper game, and the one this world was built for. You win " +
                "the moment you hold every territory on the required number of continents " +
                "outright -- not most of them, all of them."),
            h("Why it plays differently"),
            p("A continent is a finite, nameable objective, so the war has a shape: you " +
                "take a foothold, you finish the continent, and then you defend a border " +
                "that is mostly coastline. Two continents is a fast game on a small front. " +
                "Four is most of a world war."),
            ul(
                "Territory COUNT decides it, not land area -- a Caribbean island counts " +
                    "the same as Siberia.",
                "Every computer country is playing for the same thing, and any of them " +
                    "can get there first.",
                "The computer countries commit to the same number of continents you do, " +
                    "so a two-continent game is a world of short, decisive wars."
            )
        )
    }),

    Object.freeze({
        kind: VictoryCondition.DOMINATION,
        name: "Domination",
        summary: "Hold a share of the world's land area, wherever it happens to be.",
        scaleLabel: "Share of the world",
        scales: Object.freeze(DOMINATION_TIERS.map(share =>
            scale(share, Math.round(share * 100) + "% of the world's land"))),
        defaultScale: DOMINATION_LAND_SHARE,
        body: body(
            p("Take enough of the map and it does not matter which part of it you took. " +
                "You win when your land AREA reaches the chosen share of the world's."),
            h("Area, not territories"),
            p("This map's territories are wildly unequal, so a hundred Caribbean islands " +
                "should not outweigh Russia -- and under this goal they do not. The big, " +
                "empty, awkward places are worth taking here in a way they are worth " +
                "taking under no other goal."),
            ul(
                "Nothing has to be finished. Half of three continents wins as readily as " +
                    "all of one.",
                "The computer countries spread over four fronts under this goal rather " +
                    "than tunnelling into one continent.",
                "40% is a long game that is over before the map is; 80% is very nearly " +
                    "World Conquest with the last stubborn islands forgiven."
            )
        )
    }),

    Object.freeze({
        kind: VictoryCondition.GREAT_POWERS,
        name: "Great Powers",
        summary: "Break the strongest countries in the world by taking their homelands.",
        scaleLabel: "Powers to break",
        scales: Object.freeze(GREAT_POWERS_TIERS.map(count =>
            scale(count, count === GREAT_POWERS_REQUIRED
                ? "All " + count + " powers"
                : "Any " + count + " of the five"))),
        defaultScale: GREAT_POWERS_REQUIRED,
        body: body(
            p("The five strongest countries on the map are named at the start of the game " +
                "-- they are the same five the selection screen will not let you play as. " +
                "You win by BREAKING them: holding every territory a power originally " +
                "owned, for the required number of powers."),
            h("The only goal with an antagonist"),
            p("A percentage is a number. A list of five names is a story, and it is the " +
                "reason this goal exists. You will know from the first turn who you are " +
                "coming for."),
            h("It routes through third parties, and that is a feature"),
            p("If another country takes half of a power's homeland before you do, you have " +
                "not lost the goal -- you have to take those territories from THAT country " +
                "instead. The objective stays achievable and the route to it becomes a " +
                "different war."),
            ul(
                "A power's own homeland never counts towards its own goal, so no computer " +
                    "country starts a five-power game already a fifth of the way to winning.",
                "Breaking a power means every one of its original territories, not most.",
                "Any three of the five is the shorter game; all five is the long one."
            )
        )
    }),

    Object.freeze({
        kind: VictoryCondition.CONQUEST,
        name: "World Conquest",
        summary: "Every territory on the map, and nobody else left holding one.",
        scaleLabel: "Scale",
        scales: Object.freeze([scale(1, "Total -- every territory on the map")]),
        defaultScale: 1,
        body: body(
            p("The severe, honest definition. Three hundred and fifty-nine territories, " +
                "and the game will not call it a victory until you hold every one of them."),
            h("Expect a long war"),
            p("This is measured in territories rather than in land area, because the last " +
                "mile of a conquest is a handful of small awkward places and \"84% of the " +
                "land\" beside eleven territories still in enemy hands reads as a bug " +
                "rather than as the finish."),
            ul(
                "There is no resting point. The computer countries under this goal never " +
                    "settle into holding what they have.",
                "Every continent on the map is an objective, so wars start everywhere at " +
                    "once.",
                "If you want an ending you can reach in an evening, choose almost anything " +
                    "else."
            )
        )
    }),

    Object.freeze({
        kind: VictoryCondition.TURN_LIMIT,
        name: "Timed Game",
        summary: "Whoever holds the most land when the clock runs out.",
        scaleLabel: "Turns",
        scales: Object.freeze(TURN_LIMIT_TIERS.map(turns =>
            scale(turns, turns + " turns"))),
        defaultScale: VICTORY_TURN_LIMIT,
        body: body(
            p("A guaranteed ending. At the end of the final turn the largest empire by " +
                "land area wins, and there is no way to win before then however far ahead " +
                "you are."),
            h("Why the shortest option is 200 turns"),
            p("Because a hundred was not a game. The simulator puts the largest empire at " +
                "roughly thirty territories of 359 after a hundred turns, so a game scored " +
                "there would end before anything decisive had happened and would be won by " +
                "whoever happened to start biggest."),
            ul(
                "Land AREA decides it, with territory count as the tie-break.",
                "The computer countries get steadily more reckless as the deadline nears " +
                    "-- there is nothing to conserve on the last turn.",
                "Being eliminated still ends your game immediately, clock or no clock."
            )
        )
    })
]);

/** Every goal, in the order the chooser lists them. */
export function allGoals() {
    return GOALS;
}

/** One goal by its condition kind, or null. */
export function goalFor(kind) {
    return GOALS.find(goal => goal.kind === kind) ?? null;
}

/** The scale options for a goal, or an empty list for one that does not exist. */
export function scalesFor(kind) {
    return goalFor(kind)?.scales ?? [];
}

/** The scale a goal opens on. Always one of `scalesFor(kind)`. */
export function defaultScaleFor(kind) {
    return goalFor(kind)?.defaultScale ?? null;
}

/**
 * The victory condition for a goal at a scale.
 *
 * The ONE place that knows which field a scale belongs on, so nothing that renders a
 * dropdown ever names `landShare` or `turnLimit`. Everything unstated is left off and
 * `setVictoryCondition()` fills in the defaults -- that function already validates and
 * completes a partial condition, which is why it was written as the seam.
 *
 * `greatPowers` is carried ONLY under GREAT_POWERS, and it is copied rather than adopted:
 * the caller reads it out of the store's locked-country set, and a shared array would let a
 * later change to that set rewrite a condition the game had already started under.
 *
 * @param {string} kind
 * @param {number} [scaleValue]
 * @param {{greatPowers?: string[]}} [options]
 */
export function conditionFor(kind, scaleValue, { greatPowers = [] } = {}) {
    const goal = goalFor(kind);
    if (!goal) {
        return { kind: VictoryCondition.CONTINENTAL };
    }

    const value = goal.scales.some(option => option.value === scaleValue)
        ? scaleValue
        : goal.defaultScale;

    const condition = {
        kind: goal.kind,
        greatPowers: goal.kind === VictoryCondition.GREAT_POWERS
            ? [...greatPowers]
            : []
    };
    const field = SCALE_FIELD[goal.kind];
    if (field) {
        condition[field] = value;
    }
    return condition;
}

/**
 * One line naming the goal and the scale it is being played at.
 *
 * Used by the phase bar, by the spectator's top bar and by the chooser's own header, so the
 * three cannot describe the same game in three different ways.
 */
export function goalLabel(kind, scaleValue) {
    const goal = goalFor(kind);
    if (!goal) {
        return "Continental Supremacy";
    }
    if (goal.scales.length <= 1) {
        //World Conquest. "World Conquest -- Total, every territory on the map" says the
        //same thing twice; the name already is the whole of it.
        return goal.name;
    }
    const option = goal.scales.find(row => row.value === scaleValue)
        ?? goal.scales.find(row => row.value === goal.defaultScale);
    return option ? goal.name + " -- " + option.label : goal.name;
}

/**
 * The scale currently in force on a condition, whichever field it lives on.
 *
 * The inverse of `conditionFor()`, and it exists so that a restored save or a randomly
 * chosen goal can be described without the caller knowing any field names either.
 */
export function scaleOf(condition) {
    const field = SCALE_FIELD[condition?.kind];
    return field ? condition?.[field] ?? null : defaultScaleFor(condition?.kind);
}

/**
 * How the country LEADING a game should be described, given the goal.
 *
 * `victoryProgress().label` is written for a country asking "how am I doing", and under four
 * of the five goals that is exactly right for the leader too -- "Conquest: 78 of 359
 * territories" says as much about the front-runner as about anybody else.
 *
 * TURN_LIMIT is the exception, and it is a TAUTOLOGY rather than a rounding problem. Its
 * label is `"Largest empire: N% of the leader"` -- a comparison AGAINST the leader -- so
 * applied to the leader it reads "100% of the leader", every turn, in every game, whoever is
 * winning and however far ahead. It is the one line that can never say anything.
 *
 * So a timed game's leader is described by the two facts that actually decide it: how much it
 * holds, and how much of the clock is left. Neither is available from the progress label,
 * which is why this takes the holdings and the turn rather than just the label.
 *
 * @param {object} condition   the active victory condition
 * @param {{label?: string, territories?: number, turn?: number}} view
 */
export function describeLeaderProgress(condition, { label = "", territories = 0, turn = 0 } = {}) {
    if (condition?.kind !== VictoryCondition.TURN_LIMIT) {
        return label;
    }
    const limit = Number(condition.turnLimit) > 0 ? Number(condition.turnLimit) : 200;
    const held = Math.max(0, Math.round(Number(territories) || 0));
    return held + (held === 1 ? " territory" : " territories") +
        ", turn " + Math.max(0, Math.round(Number(turn) || 0)) + " of " + limit;
}

/**
 * A goal and a scale picked at random. Spectator mode's opening question answers itself.
 *
 * A debug mode fixed to the default condition would only ever exercise the default
 * condition, and the doctrine layer's whole claim is that the five goals produce five
 * different worlds -- so the one mode built for watching the AI should be watching a
 * different one each time.
 *
 * The rng is INJECTED, like everything else in this codebase that draws: the caller decides
 * whether the choice rides on the game's seeded stream (spectator mode does, so `?seed=`
 * reproduces the world INCLUDING what it was played for) or on something else, and this
 * function stays pure and testable.
 *
 * @param {() => number} rng
 * @param {{greatPowers?: string[]}} [options]
 */
export function randomGoalCondition(rng, { greatPowers = [] } = {}) {
    const draw = typeof rng === "function" ? rng : Math.random;
    const goal = GOALS[Math.min(GOALS.length - 1, Math.floor(draw() * GOALS.length))];
    const scale = goal.scales[
        Math.min(goal.scales.length - 1, Math.floor(draw() * goal.scales.length))
    ];
    return conditionFor(goal.kind, scale.value, { greatPowers });
}

/** `goalLabel()` for a whole condition object. */
export function describeCondition(condition) {
    return goalLabel(condition?.kind, scaleOf(condition));
}
