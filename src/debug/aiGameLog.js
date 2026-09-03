// The spectator log: a flat, bounded, continuous record of what each AI country did.
//
// Deliberately NOT the activity feed. That panel groups by turn into sections that
// expand and collapse, which is right for a player who wants to know what happened
// to them last turn and wrong for watching -- a list whose rows move as you read
// them cannot be read. So this is one stream, oldest at the top, newest arriving at
// the bottom, and nothing in it ever changes shape after it is written.
//
// A BLOCK is one country's turn: a header and a handful of labelled lines. Blocks
// are stored as FACTS with a tone, never as markup and never as a pre-formatted
// string, for the same reason `state/activityLog.js` stores facts -- the wording
// and the colour are the console's business, and baking them in here would mean a
// change to either meant re-deriving history that no longer exists.
//
// The ring is bounded because a spectated game is meant to run for hours. Two
// thousand blocks is roughly ten turns of a full map, which is more scrollback than
// anyone reads, and it holds the memory flat.

/** The tone vocabulary. Closed, and each one is a class `style.css` colours. */
export const AiGameTone = Object.freeze({
    /** Ordinary reporting. */
    NEUTRAL: "neutral",
    /** Context and reasoning -- what the country was thinking. */
    THOUGHT: "thought",
    /** What it intends to do. */
    PLAN: "plan",
    /** Money, food, buildings, recruitment. */
    ECONOMY: "economy",
    /** It gained ground. */
    VICTORY: "victory",
    /** It lost ground, or an attack failed. */
    LOSS: "loss",
    /** Anything to do with a siege. */
    SIEGE: "siege"
});

const TONES = new Set(Object.values(AiGameTone));

/**
 * How many blocks to keep.
 *
 * A full map is a little over two hundred countries a turn, so this is about ten
 * turns of scrollback. Past that the oldest go, because the window is for watching
 * what is happening and not for auditing what happened.
 */
export const MAX_BLOCKS_KEPT = 2000;

/** @type {Array<object>} oldest first -- this is a log, and a log reads downwards. */
const blocks = [];

/** @type {Set<(block: object|null) => void>} */
const listeners = new Set();

let nextId = 1;

/** The turn the last block was filed under, so the console can rule a line between turns. */
let lastTurnSeen = null;

/**
 * Append one country's report.
 *
 * @param {object} block
 * @param {number} block.turn
 * @param {string} block.country
 * @param {string} [block.leaderName]
 * @param {string} [block.leaderType]
 * @param {string} [block.posture]
 * @param {Array<{label?: string, text: string, tone?: string}>} [block.lines]
 * @returns {object} the stored block
 */
export function recordAiGameBlock(block) {
    const turn = Number.isFinite(block?.turn) ? block.turn : 0;
    const startsTurn = lastTurnSeen === null || turn !== lastTurnSeen;
    lastTurnSeen = turn;

    const stored = Object.freeze({
        id: nextId++,
        turn: turn,
        country: block?.country ?? "unknown",
        leaderName: block?.leaderName ?? "",
        leaderType: block?.leaderType ?? "",
        posture: block?.posture ?? "",
        //True on the first block of each turn, which is what the console draws its
        //turn rule from. Derived here rather than in the console because the console
        //re-renders from the ring and a block dropped off the front must not change
        //where the rules fall.
        startsTurn: startsTurn,
        lines: Object.freeze(
            (block?.lines ?? [])
                .filter((line) => line && typeof line.text === "string" && line.text !== "")
                .map((line) =>
                    Object.freeze({
                        label: line.label ?? "",
                        text: line.text,
                        tone: TONES.has(line.tone) ? line.tone : AiGameTone.NEUTRAL
                    })
                )
        )
    });

    blocks.push(stored);
    while (blocks.length > MAX_BLOCKS_KEPT) {
        blocks.shift();
    }
    notify(stored);
    return stored;
}

/** Everything held, oldest first. */
export function aiGameBlocks() {
    return [...blocks];
}

/** How many blocks are held. Diagnostics and specs. */
export function aiGameBlockCount() {
    return blocks.length;
}

/** Throw it all away. Starting a spectated game calls this. */
export function clearAiGameLog() {
    blocks.length = 0;
    nextId = 1;
    lastTurnSeen = null;
    notify(null);
}

/** Subscribe to appends and clears. Returns the unsubscribe. */
export function onAiGameBlock(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify(block) {
    for (const listener of listeners) {
        try {
            listener(block);
        } catch (error) {
            console.error("AI game log listener failed", error);
        }
    }
}
