// Save and load: the whole game in and out of one string.
//
// Refactor plan Phase 7.3. A save is `state/snapshot.js`'s picture of the store,
// plus whatever `saveSlices.js` has registered, plus a small header. Three things
// consume it and they all go through here:
//
//   * the autosave, which writes to localStorage on a timer and is read back at
//     page load to decide whether "Resume Game" is available;
//   * the export code, which is that same envelope compressed with lz-string into
//     something a player can select, copy and paste somewhere safe;
//   * the import, which is the export read backwards.
//
// Why lz-string and not raw JSON: the envelope is around 460 KB of very repetitive
// text (359 territories with the same forty field names, and a leader object
// repeated per territory), which compresses to roughly 140 KB. Raw JSON is too long
// to paste into anything and would not fit localStorage comfortably alongside a
// second slot.
//
// It is imported from `./vendor/`, not from node_modules, and that is deliberate:
// `index.html` loads the game's entry modules as plain `<script type="module">` tags
// against the source files, so a bare specifier is something only a bundler can
// resolve and the browser refuses it -- which shows up as a page that never reaches
// the main menu. See the header of `vendor/lz-string.js`.
//
// The code is NOT encrypted and is not meant to be -- lz-string is a compressor.
// Anyone who wants to decompress a save and edit their gold can, and in a
// single-player game that is their business. What the format DOES do is fail
// loudly: a code that is not ours, or is truncated by a copy-paste that clipped
// the end, is rejected with a message that says which of the two happened rather
// than throwing a JSON parse error at the player.
//
// This module has no DOM in it and imports no UI. The spinner, the panel and the
// menu wiring are in `src/ui/`; what is here is the data path, so it can be
// unit-tested in Node.

import LZString from "./vendor/lz-string.js";
import { captureState, restoreState, SNAPSHOT_VERSION } from "../state/snapshot.js";
import { captureSlices, restoreSlices } from "./saveSlices.js";

/** Prefix on every exported code. Bumped only if the envelope shape breaks. */
export const SAVE_FORMAT = "DWC1";

/** localStorage key for the rolling autosave. */
export const AUTOSAVE_KEY = "domination.autosave.v1";

/** How often the autosave fires while a game is running. */
export const AUTOSAVE_INTERVAL_MS = 60_000;

// --- the envelope ----------------------------------------------------------

/**
 * Take a complete save of the game as it stands.
 *
 * @param {object} [meta]  extra header fields (`playerCountry`, and anything a
 *                         caller wants to show in a slot list later).
 * @returns {object|null} null when there is nothing to save -- before the
 *          territory model is built there is no game.
 */
export function captureGame(meta = {}) {
    const state = captureState();
    if (!state) {
        return null;
    }
    return {
        format: SAVE_FORMAT,
        version: SNAPSHOT_VERSION,
        savedAt: new Date().toISOString(),
        turn: state.turn,
        phase: state.phase,
        playerCountry: state.players?.playerCountry ?? null,
        ...meta,
        state: state,
        slices: captureSlices()
    };
}

/**
 * Put a captured game back.
 *
 * The store goes first and the slices second, because a slice restore may look
 * territories up by id -- and because if the store restore throws, nothing has
 * been half-applied to the legacy modules.
 *
 * @param {object} save  a `captureGame()` envelope
 * @returns {{turn: number, phase: number, playerCountry: string|null,
 *            missingTerritories: string[], slices: string[]}}
 */
export function applyGame(save) {
    assertEnvelope(save);
    const result = restoreState(save.state);
    const slices = restoreSlices(save.slices);
    return {
        turn: result.turn,
        phase: result.phase,
        playerCountry: save.playerCountry ?? null,
        missingTerritories: result.missingTerritories,
        slices: slices
    };
}

function assertEnvelope(save) {
    if (!save || typeof save !== "object") {
        throw new Error("That is not a saved game.");
    }
    if (save.format !== SAVE_FORMAT) {
        throw new Error(
            "That save is in an unknown format" +
            (save.format ? " (" + save.format + ")" : "") + ".");
    }
    if (save.version !== SNAPSHOT_VERSION) {
        throw new Error(
            "That save is from an incompatible version of the game (save version " +
            save.version + ", this build reads " + SNAPSHOT_VERSION + ").");
    }
    if (!save.state) {
        throw new Error("That save is missing its game state.");
    }
}

// --- the copy-and-paste code ----------------------------------------------

/**
 * Compress an envelope into a pasteable code.
 *
 * The `DWC1:` prefix is outside the compressed payload on purpose: it is what
 * lets `decodeSave` tell "this is not one of our codes" from "this is one of ours
 * and it is damaged", and the two need different messages.
 *
 * @param {object} save
 * @returns {string}
 */
export function encodeSave(save) {
    return SAVE_FORMAT + ":" + LZString.compressToBase64(JSON.stringify(save));
}

/**
 * Read a pasteable code back into an envelope.
 *
 * Tolerant of the things a paste does to a string -- surrounding whitespace, and
 * the line breaks a textarea or an email client inserts -- because none of them
 * are the player's fault and all of them are recoverable. Anything else throws
 * with a message meant to be shown as-is.
 *
 * @param {string} code
 * @returns {object} the envelope
 */
export function decodeSave(code) {
    if (typeof code !== "string" || code.trim() === "") {
        throw new Error("Paste a save code first.");
    }
    // Base64 has no whitespace in it, so stripping every whitespace character is
    // safe and undoes the wrapping that a copy through a chat window adds.
    const cleaned = code.trim().replace(/\s+/g, "");
    const separator = cleaned.indexOf(":");
    if (separator === -1) {
        throw new Error("That does not look like a save code.");
    }
    const prefix = cleaned.slice(0, separator);
    if (prefix !== SAVE_FORMAT) {
        throw new Error("That is a \"" + prefix + "\" code; this game reads \"" +
            SAVE_FORMAT + "\" codes.");
    }

    let json;
    try {
        json = LZString.decompressFromBase64(cleaned.slice(separator + 1));
    } catch {
        json = null;
    }
    if (!json) {
        throw new Error("That save code is damaged -- it looks like part of it is missing.");
    }

    let save;
    try {
        save = JSON.parse(json);
    } catch {
        throw new Error("That save code is damaged and could not be read.");
    }
    assertEnvelope(save);
    return save;
}

// --- the autosave slot -----------------------------------------------------

function storage() {
    try {
        // Private-mode Safari and a locked-down browser profile both make this throw
        // rather than return null, which is why it is not just `window.localStorage`.
        return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
        return null;
    }
}

/** Is there an autosave to resume from? */
export function hasAutosave() {
    try {
        return Boolean(storage()?.getItem(AUTOSAVE_KEY));
    } catch {
        return false;
    }
}

/**
 * The stored autosave, or null.
 *
 * A slot that cannot be decoded is DELETED rather than left in place: it can only
 * come from an older build or a truncated write, it will never decode, and
 * leaving it would offer the player a Resume that fails every time they click it.
 */
export function readAutosave() {
    const store = storage();
    if (!store) {
        return null;
    }
    let code;
    try {
        code = store.getItem(AUTOSAVE_KEY);
    } catch {
        return null;
    }
    if (!code) {
        return null;
    }
    try {
        return decodeSave(code);
    } catch (error) {
        console.warn("readAutosave: the stored autosave could not be read; discarding it.",
            error);
        clearAutosave();
        return null;
    }
}

/**
 * Write an envelope to the autosave slot.
 *
 * @returns {boolean} whether it was actually stored. A full quota is the realistic
 *          failure and it is not fatal -- the player keeps playing, and the caller
 *          decides whether to say anything.
 */
export function writeAutosave(save) {
    const store = storage();
    if (!store) {
        return false;
    }
    try {
        store.setItem(AUTOSAVE_KEY, encodeSave(save));
        return true;
    } catch (error) {
        console.warn("writeAutosave: could not store the autosave.", error);
        return false;
    }
}

export function clearAutosave() {
    try {
        storage()?.removeItem(AUTOSAVE_KEY);
    } catch {
        // Nothing to do; the slot is either gone or unreachable.
    }
}

/** Header fields of the stored autosave without decompressing the whole thing. */
export function autosaveSummary() {
    const save = readAutosave();
    return save
        ? {
            turn: save.turn,
            phase: save.phase,
            playerCountry: save.playerCountry ?? null,
            savedAt: save.savedAt ?? null
        }
        : null;
}

// --- the new-game baseline -------------------------------------------------
//
// Phase 7.2. "New Game" from inside a running game has to put the world back to
// the way it was before anybody played it, and until now nothing could: the
// territory model is built once, at page load, by a pipeline that measures 359 SVG
// path areas and then randomises the starting gold. Re-running it would take
// seconds and would need the whole bootstrap Promise chain re-entered.
//
// So the pristine world is captured once, the moment it is built, using the same
// machinery a save uses -- and Restart is a load. What that costs is one property:
// two new games in the same browser session get the same randomised starting gold,
// because the roll happened before the capture. Everything the player would
// actually notice as "a different game" -- the AI leaders and their personalities,
// the starting forts, every roll thereafter -- is generated AFTER the game starts
// and is therefore re-rolled each time. Reloading the page re-rolls the gold too.

let baseline = null;

/** Take the pristine snapshot. Called once, from the bootstrap, and never again. */
export function captureNewGameBaseline() {
    baseline = captureGame({ baseline: true });
    return baseline;
}

/** The pristine snapshot, or null if the bootstrap has not finished. */
export function newGameBaseline() {
    return baseline;
}

// --- the timer -------------------------------------------------------------

let timer = null;

/**
 * Start writing an autosave on a timer.
 *
 * @param {object} options
 * @param {() => boolean} [options.shouldSave]
 *        Asked before every tick. This is what keeps the autosave off the middle
 *        of an AI turn or a battle: a save taken there restores to a world that is
 *        mid-resolution, and the turn engine has no way to re-enter a half-run
 *        step. The caller supplies the rule; this module only obeys it.
 * @param {(save: object, stored: boolean) => void} [options.onSaved]
 * @param {() => object} [options.capture]  defaults to `captureGame`
 * @param {number} [options.intervalMs]
 */
export function startAutosave(options = {}) {
    const {
        shouldSave = () => true,
        onSaved = null,
        capture = captureGame,
        intervalMs = AUTOSAVE_INTERVAL_MS
    } = options;

    stopAutosave();
    timer = setInterval(() => {
        try {
            if (!shouldSave()) {
                return;
            }
            const save = capture();
            if (!save) {
                return;
            }
            const stored = writeAutosave(save);
            if (onSaved) {
                onSaved(save, stored);
            }
        } catch (error) {
            // An autosave that throws must never take the game down with it.
            console.error("autosave: tick threw", error);
        }
    }, intervalMs);
    return timer;
}

export function stopAutosave() {
    if (timer !== null) {
        clearInterval(timer);
        timer = null;
    }
}

export function autosaveRunning() {
    return timer !== null;
}
