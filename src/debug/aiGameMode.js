// SPECTATOR MODE: the world plays itself and nobody clicks anything.
//
// "AI Game" on the main menu starts an ordinary game with one thing left out --
// the player. No country is assigned to `Player`, so `updateArrayOfLeadersAndCountries()`
// hands every country on the map to the AI, and the two phases that normally wait
// for a click do not wait. What is left is two hundred-odd countries taking a turn
// each, in order, at a pace this module sets.
//
// It exists because the AI's failures have no textual signature. `tools/ai-sim.mjs`
// answers "did the world consolidate" in aggregate over a hundred headless turns;
// the AI debug panel answers "what did THIS country weigh" for one country you
// already know the name of. Neither answers "watch it happen" -- which is the
// question you ask when the numbers look plausible and the map still feels wrong.
//
// Three decisions are worth stating, because they are what makes this a debug tool
// rather than a game mode.
//
// **The pacing gate is at the country boundary, not the turn boundary.** The brief
// asks for a second per AI, and a turn is 206 of them; pausing between turns would
// mean the whole world moving in one frame and then three minutes of nothing. So
// `awaitCountryPacing()` is awaited by the AI turn loop after each country has
// acted, and it is also where the pause lives.
//
// **Stopping releases every waiter.** `TurnEngine.stop()` only unwinds between
// steps, and the AI step is one step containing the whole loop -- so a stop while
// the mode is running would otherwise sit through however many countries were left
// at five seconds each. `stopAiGameMode()` therefore clears the flag AND resolves
// every outstanding timer, which turns the remainder of the turn into a fast
// no-delay run that finishes in about a second.
//
// **Nothing here touches the DOM or the store.** The mode is a flag, a number and
// two gates; the window that drives it is `src/ui/components/AiGameConsole.js` and
// the report it prints is `src/debug/aiGameReport.js`. That split is what lets the
// pacing be unit-tested with fake timers.

/** Slowest and fastest the slider goes, in seconds per AI country. */
/** Fastest: a hundred countries a second -- a whole turn of 206 in about two seconds. */
export const MIN_SECONDS_PER_COUNTRY = 0.01;
/** Slowest: five seconds on each one. */
export const MAX_SECONDS_PER_COUNTRY = 5;
/** One second a country, and it is the MIDDLE of the slider -- see below. */
export const DEFAULT_SECONDS_PER_COUNTRY = 1;

/** Slider positions. An integer track, so the thumb has somewhere to land. */
export const SPEED_SLIDER_STEPS = 100;

/**
 * Where the slider sits versus how long a country gets.
 *
 * A linear track cannot do what is wanted here. The useful range spans a factor of
 * fifty -- a tenth of a second at one end, five seconds at the other -- and one
 * second, which is the pace anybody actually watches at, sits a fiftieth of the way
 * along it. Linear would bury the whole readable range in the first two pixels.
 *
 * So the track is TWO geometric halves pinned to three anchors: 0.01s at the left,
 * 1s exactly at the middle, 5s at the right. Each half moves by a constant ratio per
 * step, which is what makes dragging feel the same in the slow half as in the fast
 * half even though one covers a hundredfold change and the other a fivefold one.
 *
 * @param {number} position  0..SPEED_SLIDER_STEPS
 * @returns {number} seconds per country
 */
export function secondsForSliderPosition(position) {
    const steps = SPEED_SLIDER_STEPS;
    const clamped = Math.min(steps, Math.max(0, Number(position) || 0));
    const half = steps / 2;

    if (clamped <= half) {
        // 0.01s -> 1s across the lower half.
        const seconds = MIN_SECONDS_PER_COUNTRY *
            Math.pow(DEFAULT_SECONDS_PER_COUNTRY / MIN_SECONDS_PER_COUNTRY, clamped / half);
        // Rounded finer the faster it gets, because the same absolute step means
        // much more down there: a twentieth of a second is a rounding error at 0.8s,
        // the difference between six and ten countries a second at 0.12s, and the
        // whole fast third of the track below 0.1s. All three grids land the
        // anchors exactly, which matters -- the fast end has to actually BE the
        // hundred a second the label claims.
        if (seconds < 0.1) return Math.round(seconds * 1000) / 1000;
        return seconds < 0.5
            ? Math.round(seconds * 100) / 100
            : Math.round(seconds * 20) / 20;
    }
    // 1s -> 5s across the upper half.
    const seconds = DEFAULT_SECONDS_PER_COUNTRY *
        Math.pow(MAX_SECONDS_PER_COUNTRY / DEFAULT_SECONDS_PER_COUNTRY, (clamped - half) / half);
    return Math.round(seconds * 4) / 4;
}

/**
 * The inverse, so the slider can be positioned from the stored speed.
 *
 * The control never holds its own copy of the speed -- it reads back from the change
 * event like the audio panel's volumes do -- so this is what turns that value into a
 * thumb position.
 *
 * @param {number} seconds
 * @returns {number} 0..SPEED_SLIDER_STEPS
 */
export function sliderPositionForSeconds(seconds) {
    const steps = SPEED_SLIDER_STEPS;
    const half = steps / 2;
    const value = Math.min(
        MAX_SECONDS_PER_COUNTRY,
        Math.max(MIN_SECONDS_PER_COUNTRY, Number(seconds) || DEFAULT_SECONDS_PER_COUNTRY)
    );

    if (value <= DEFAULT_SECONDS_PER_COUNTRY) {
        const ratio = Math.log(value / MIN_SECONDS_PER_COUNTRY) /
            Math.log(DEFAULT_SECONDS_PER_COUNTRY / MIN_SECONDS_PER_COUNTRY);
        return Math.round(ratio * half);
    }
    const ratio = Math.log(value / DEFAULT_SECONDS_PER_COUNTRY) /
        Math.log(MAX_SECONDS_PER_COUNTRY / DEFAULT_SECONDS_PER_COUNTRY);
    return Math.round(half + ratio * half);
}

/**
 * How the speed reads to a person.
 *
 * Below a second, "0.15s per country" is the wrong unit: at that pace the countries
 * are what you are counting, not the seconds. So the label flips to a rate, which is
 * also how the fast end was asked for -- a hundred countries a second.
 */
export function describeAiGameSpeed(seconds) {
    const value = Number(seconds) || DEFAULT_SECONDS_PER_COUNTRY;
    if (value < DEFAULT_SECONDS_PER_COUNTRY) {
        const perSecond = 1 / value;
        const rounded = perSecond >= 10 ? Math.round(perSecond) : Math.round(perSecond * 10) / 10;
        return rounded + " countries/s";
    }
    // The upper half moves in quarter-seconds, so two decimals is the widest it ever
    // needs and the trailing zeroes are dropped: "1s", "1.25s", "1.5s", "5s".
    return value.toFixed(2).replace(/\.?0+$/, "") + "s per country";
}

let active = false;
let paused = false;
let secondsPerCountry = DEFAULT_SECONDS_PER_COUNTRY;

/**
 * Every gate currently being awaited, as its own release function.
 *
 * One set for both kinds of wait -- the delay between countries and the pause --
 * because everything in it means the same thing to `stopAiGameMode()`: somebody is
 * blocked and the mode is going away, so let them go.
 *
 * @type {Set<() => void>}
 */
const waiters = new Set();

/** @type {Set<(state: object) => void>} */
const listeners = new Set();

/** Is the world playing itself? */
export function isAiGameActive() {
    return active;
}

export function isAiGamePaused() {
    return active && paused;
}

export function aiGameSecondsPerCountry() {
    return secondsPerCountry;
}

/**
 * A snapshot for whatever is drawing the controls.
 *
 * A plain object rather than three getters because the console repaints from one
 * value: a control that reads three separate accessors can render a half-applied
 * state if one of them changes between the reads.
 */
export function aiGameState() {
    return {
        active: active,
        paused: active && paused,
        secondsPerCountry: secondsPerCountry
    };
}

/** Subscribe to mode changes. Returns the unsubscribe, as everything else here does. */
export function onAiGameChanged(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify() {
    const state = aiGameState();
    for (const listener of listeners) {
        try {
            listener(state);
        } catch (error) {
            //A control that throws while repainting must never take the AI turn with it.
            console.error("AI game listener failed", error);
        }
    }
}

/** Begin spectating. Idempotent. */
export function startAiGameMode() {
    if (active) return;
    active = true;
    paused = false;
    notify();
}

/**
 * Stop spectating, and let go of anything waiting on the pace.
 *
 * Called before the turn engine is reset, never after: the engine's `stop()` waits
 * for the running step to return, and the AI step does not return until the last
 * country has been through the gate below.
 */
export function stopAiGameMode() {
    if (!active) return;
    active = false;
    paused = false;
    releaseAll();
    notify();
}

/**
 * How long to dwell on each country, in seconds. Clamped to the slider's range so
 * a stored or hand-typed value cannot stall the run.
 */
export function setAiGameSecondsPerCountry(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value)) return;
    secondsPerCountry = Math.min(
        MAX_SECONDS_PER_COUNTRY,
        Math.max(MIN_SECONDS_PER_COUNTRY, value)
    );
    notify();
}

export function setAiGamePaused(value) {
    const next = Boolean(value);
    if (paused === next) return;
    paused = next;
    //Resuming is what releases the countries queued behind the pause. Pausing
    //releases nothing -- the current delay runs to its end and the gate below then
    //blocks a second time, which is why the pause takes effect within one country
    //rather than instantly mid-battle.
    if (!paused) releaseAll();
    notify();
}

export function toggleAiGamePaused() {
    setAiGamePaused(!paused);
}

function releaseAll() {
    const pending = [...waiters];
    waiters.clear();
    for (const release of pending) release();
}

/**
 * Block for `ms`, or until the mode is stopped.
 *
 * The timer is cleared by the release function rather than left to fire into a
 * resolved promise, because at five seconds a country a stopped run would otherwise
 * leave a couple of hundred live timers behind it.
 */
function delay(ms) {
    return new Promise((resolve) => {
        let timer = null;
        const release = () => {
            if (timer !== null) clearTimeout(timer);
            waiters.delete(release);
            resolve();
        };
        waiters.add(release);
        timer = setTimeout(release, ms);
    });
}

/** Block until something calls `releaseAll()` -- a resume, or a stop. */
function untilReleased() {
    return new Promise((resolve) => {
        const release = () => {
            waiters.delete(release);
            resolve();
        };
        waiters.add(release);
    });
}

/**
 * The pace. Awaited by the AI turn loop once each country has finished acting.
 *
 * Returns immediately -- and allocates nothing -- when the mode is off, which is
 * the case for every ordinary game, so the hook costs one boolean test per country.
 */
export async function awaitCountryPacing() {
    if (!active) return;
    if (paused) await untilReleased();
    if (!active) return;
    await delay(secondsPerCountry * 1000);
    //Pausing during the delay above is honoured here rather than by interrupting it:
    //a country half-way through its turn is not a place to stop.
    if (active && paused) await untilReleased();
}
