// The game's one audio manager: the music playlist, the sound effects, and the
// four settings that govern both.
//
// Everything that makes a noise goes through here. Before this there were two
// unrelated pieces: `music.js`, which owned a single `Audio` element pointed at
// one hard-coded file and a "Toggle Music" button in the main menu, and `sfx.js`,
// which built a fresh `Audio` per click out of a three-case switch over three WAVs.
// Neither had a volume, neither could be muted, and neither was saved -- so a
// loaded game always came back sounding however the browser happened to be rather
// than however the player had left it.
//
// Four things are worth knowing about what is here.
//
// **The playlist is a shuffle bag, not a random pick.** A playthrough is a
// permutation of every mp3 in `resources/music/`; a track cannot play again until
// every other one has. When the bag empties a new permutation is drawn, with one
// rule carried across the boundary: the track that ended the last playthrough may
// not open the next, which is the only way two identical tracks could end up back
// to back.
//
// **Which track plays next is COSMETIC and must never touch `Math.random`.**
// Seeding `Math.random` makes the game deterministic (Phase 5.8, audit 5.3 Y), and
// a draw per track change would put the music on the same stream as combat and the
// economy -- two runs of one seed would then diverge as soon as a track ended.
// `cosmeticRandom()` is a self-contained mulberry32 for exactly this.
//
// **The folder listing is generated.** A browser cannot read a directory and this
// game has no server, so `resources/music/tracks.json` is written by
// `tools/build-music-manifest.mjs` -- and by Vite on every dev-server start and
// build, so dropping an mp3 in and reloading is the whole procedure.
//
// **This module has no DOM and imports no UI.** `Audio` is a browser global, like
// `localStorage` in `storage.js`, and every use of it is guarded so the file
// imports cleanly in Node. The floating panel that drives it is
// `src/ui/components/AudioPanel.js`.

import { cosmeticRandom } from "./cosmeticRng.js";
import { registerSaveSlice } from "./saveSlices.js";

const MUSIC_DIR = "resources/music/";
const MANIFEST_URL = MUSIC_DIR + "tracks.json";
const SFX_DIR = "resources/sfx/";

/** localStorage key for the settings, so they survive a reload with no save. */
const STORAGE_KEY = "domination.audio.v1";

/**
 * The sound-effect vocabulary, and the only place a file name appears.
 *
 * Two clips, deliberately. `switch` is the map's own furniture -- the chrome
 * buttons over the map and the tabs of the territory panel, controls that flip a
 * view rather than commit anything. `button` is every button inside a window and
 * every item in the menus, which is where decisions are made. The three WAVs this
 * replaces (a click and two dice rolls) are gone: the dice sounds fired on a
 * cosmetic coin-flip in the middle of the battle loop and said nothing the dice
 * already tumbling on screen were not saying better.
 */
const SFX_FILES = Object.freeze({
    switch: SFX_DIR + "clickSwitch.mp3",
    button: SFX_DIR + "clickButton.mp3",
});

const DEFAULTS = Object.freeze({
    musicVolume: 0.5,
    sfxVolume: 0.7,
    musicMuted: false,
    sfxMuted: false,
    /** Whether the player has music running at all -- the play/pause state. */
    musicPlaying: false,
});

let settings = { ...DEFAULTS };

/** Every mp3 in the folder, as bare file names. Empty until the manifest lands. */
let tracks = [];
/** What is left of the current playthrough, in the order it will be played. */
let bag = [];
/** The file name loaded now, or null. */
let currentTrack = null;
/** The last track of the playthrough that just ended -- barred from opening the next. */
let lastOfPreviousPlaythrough = null;

let element = null;
let manifestLoaded = null;
const listeners = new Set();

// --- settings ---------------------------------------------------------------

function clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(1, Math.max(0, number));
}

/** A settings object with every field present and in range, whatever came in. */
function normalise(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
        musicVolume:
            source.musicVolume === undefined ? DEFAULTS.musicVolume : clamp01(source.musicVolume),
        sfxVolume: source.sfxVolume === undefined ? DEFAULTS.sfxVolume : clamp01(source.sfxVolume),
        musicMuted: Boolean(source.musicMuted),
        sfxMuted: Boolean(source.sfxMuted),
        musicPlaying: Boolean(source.musicPlaying),
    };
}

/** The settings as they stand. A copy -- callers go through the setters. */
export function audioSettings() {
    return { ...settings };
}

function readStored() {
    try {
        const text = window.localStorage.getItem(STORAGE_KEY);
        return text ? JSON.parse(text) : null;
    } catch {
        // Blocked site data, or a value an older build left behind. The defaults
        // are a perfectly good answer and there is nothing useful to say about it.
        return null;
    }
}

function writeStored() {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // A player who cannot persist the choice still gets it for this session.
    }
}

/** Tell the panel -- and anything else watching -- that something changed. */
function notify() {
    for (const listener of listeners) {
        try {
            listener(audioSettings());
        } catch (error) {
            console.error("audio: listener threw", error);
        }
    }
}

/**
 * Subscribe to settings and playback changes.
 *
 * @param {(settings: object) => void} listener
 * @returns {() => void} the unsubscribe
 */
export function onAudioChanged(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function applyToElement() {
    if (!element) return;
    element.volume = settings.musicMuted ? 0 : settings.musicVolume;
}

function commit({ persist = true } = {}) {
    applyToElement();
    if (persist) writeStored();
    notify();
}

export function setMusicVolume(value) {
    settings.musicVolume = clamp01(value);
    commit();
}

export function setSfxVolume(value) {
    settings.sfxVolume = clamp01(value);
    commit();
}

export function setMusicMuted(muted) {
    settings.musicMuted = Boolean(muted);
    commit();
}

export function setSfxMuted(muted) {
    settings.sfxMuted = Boolean(muted);
    commit();
}

// --- the playlist -----------------------------------------------------------

/** A Fisher-Yates shuffle on the COSMETIC stream. See the header. */
function shuffled(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(cosmeticRandom() * (i + 1));
        const swap = out[i];
        out[i] = out[j];
        out[j] = swap;
    }
    return out;
}

/**
 * Refill the bag with a fresh permutation of every track.
 *
 * The one rule that crosses a playthrough boundary: whatever played last must not
 * play first. With two or more tracks that is always satisfiable, so the fix is a
 * swap rather than a re-roll -- a reject-and-redraw loop could in principle spin
 * forever, and on a one-track folder it certainly would.
 */
function refillBag() {
    bag = shuffled(tracks);
    if (bag.length > 1 && lastOfPreviousPlaythrough && bag[0] === lastOfPreviousPlaythrough) {
        const swap = bag[0];
        bag[0] = bag[1];
        bag[1] = swap;
    }
}

/** The next track in the playthrough, refilling the bag when it runs out. */
function takeNextTrack() {
    if (tracks.length === 0) return null;
    if (bag.length === 0) {
        lastOfPreviousPlaythrough = currentTrack;
        refillBag();
    }
    return bag.shift() ?? null;
}

/** The file name playing now, or null. */
export function currentTrackName() {
    return currentTrack;
}

/** How many tracks are left before this playthrough restarts. Diagnostics. */
export function remainingInPlaythrough() {
    return bag.length;
}

/** Every track the manifest listed. */
export function trackList() {
    return [...tracks];
}

export function isMusicPlaying() {
    return Boolean(element) && !element.paused && Boolean(currentTrack);
}

function audioElement() {
    if (element || typeof Audio === "undefined") return element;
    element = new Audio();
    element.preload = "auto";
    // A playthrough never stops, so the end of one track is the cue for the next.
    // `loop` is deliberately off -- looping one file is what the old music.js did.
    element.addEventListener("ended", () => {
        void advance();
    });
    element.addEventListener("error", () => {
        // A missing or unplayable file must not end the playthrough: skip past it.
        console.warn("audio: could not play", currentTrack);
        if (settings.musicPlaying && tracks.length > 1) void advance();
    });
    applyToElement();
    return element;
}

/** Load `track` and start it. Resolves whether or not playback was allowed. */
async function playTrack(track) {
    const node = audioElement();
    if (!node || !track) return;
    currentTrack = track;
    node.src = MUSIC_DIR + encodeURIComponent(track);
    applyToElement();
    try {
        await node.play();
        settings.musicPlaying = true;
    } catch {
        // Autoplay refused until the page has been interacted with. Not an error,
        // and not something to tell the player about -- the next click starts it.
        settings.musicPlaying = false;
    }
    commit();
}

/** Move to the next track in the playthrough. */
async function advance() {
    const next = takeNextTrack();
    if (!next) return;
    await playTrack(next);
}

/** The forward-arrow button: whatever is playing, play the next one. */
export async function skipTrack() {
    await loadManifest();
    if (tracks.length === 0) return;
    await advance();
}

/** Start, or resume, the playthrough. */
export async function playMusic() {
    await loadManifest();
    if (tracks.length === 0) return;
    const node = audioElement();
    if (!node) return;
    if (!currentTrack) {
        await advance();
        return;
    }
    try {
        await node.play();
        settings.musicPlaying = true;
    } catch {
        settings.musicPlaying = false;
    }
    commit();
}

/** Pause where we are. The position is kept, so play resumes rather than restarts. */
export function pauseMusic() {
    element?.pause();
    settings.musicPlaying = false;
    commit();
}

/** The play/pause button. Returns whether music is running afterwards. */
export async function toggleMusic() {
    if (isMusicPlaying()) {
        pauseMusic();
        return false;
    }
    await playMusic();
    return isMusicPlaying();
}

// --- sound effects ----------------------------------------------------------

/**
 * Play one of the two clips.
 *
 * A fresh `Audio` per call, on purpose: clicks overlap, and a single shared
 * element would cut the previous one off mid-clip. They are small mp3s and the
 * browser serves them from cache after the first play.
 *
 * @param {"switch"|"button"} clip
 */
export function playSfx(clip) {
    if (settings.sfxMuted || settings.sfxVolume === 0) return;
    const file = SFX_FILES[clip];
    if (!file || typeof Audio === "undefined") return;
    try {
        const sound = new Audio(file);
        sound.volume = settings.sfxVolume;
        void sound.play().catch(() => null);
    } catch {
        // Same story as music autoplay: nothing to report.
    }
}

// --- the manifest -----------------------------------------------------------

/**
 * Read `resources/music/tracks.json` once.
 *
 * A failure here is not fatal: the music panel still opens, its sliders still
 * work, and there is simply nothing to play. That is the right outcome for a
 * folder someone emptied, and it is why this warns rather than throwing --
 * a `console.error` fails every e2e spec (tests/support/fixtures.js).
 */
export function loadManifest() {
    if (manifestLoaded) return manifestLoaded;
    manifestLoaded = (async () => {
        try {
            const response = await fetch(MANIFEST_URL, { cache: "no-cache" });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            tracks = Array.isArray(data?.tracks)
                ? data.tracks.filter((name) => typeof name === "string")
                : [];
        } catch (error) {
            console.warn("audio: no music manifest;", error?.message ?? error);
            tracks = [];
        }
        bag = [];
        lastOfPreviousPlaythrough = null;
        return tracks;
    })();
    return manifestLoaded;
}

// --- bootstrap and persistence ---------------------------------------------

/**
 * Read the remembered settings and fetch the folder listing.
 *
 * Music is NOT started here even when the player left it playing: a browser
 * refuses `play()` until the page has been interacted with, and a rejected
 * promise at load would only turn `musicPlaying` off again. `resumePendingMusic()`
 * is what the first click calls.
 */
export function initAudio() {
    settings = normalise(readStored());
    void loadManifest();
    notify();
    return audioSettings();
}

let resumeAttempted = false;

/**
 * Start the music if the player had it playing when they last closed the game.
 *
 * Called from the first user gesture, which is the earliest moment a browser will
 * allow it. Idempotent -- after the first attempt this does nothing, so it is safe
 * to hang off every click.
 */
export async function resumePendingMusic() {
    if (resumeAttempted) return;
    resumeAttempted = true;
    if (!settings.musicPlaying) return;
    await playMusic();
}

/**
 * Apply a settings object, as a save restores one.
 *
 * `musicPlaying` is honoured in both directions: a save taken with the music on
 * turns it on, and one taken with it off pauses it. That is the whole point of
 * saving it -- a loaded game should sound the way the saved game did.
 */
export function applyAudioSettings(raw, { persist = true } = {}) {
    settings = normalise(raw);
    applyToElement();
    if (persist) writeStored();
    if (settings.musicPlaying) {
        resumeAttempted = true;
        void playMusic();
    } else {
        element?.pause();
    }
    notify();
    return audioSettings();
}

// The music and sfx settings ride along with the save, so a loaded game sounds
// like the game that was saved. This is durable state that lives outside the
// store, which is exactly what a slice is for -- and registering it here rather
// than teaching `storage.js` about audio keeps the save path free of the
// dependency, the same arrangement `battle.js` and `gameTurnsLoop.js` are under.
registerSaveSlice("audio", {
    capture: () => audioSettings(),
    restore: (data) => applyAudioSettings(data),
});

/** Test seam: forget the manifest, the bag and the settings. */
export function __resetAudioForTests() {
    tracks = [];
    bag = [];
    currentTrack = null;
    lastOfPreviousPlaythrough = null;
    manifestLoaded = null;
    resumeAttempted = false;
    settings = { ...DEFAULTS };
}
