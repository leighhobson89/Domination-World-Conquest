// Test-only window hooks, active ONLY when the page is loaded with ?e2e=1.
//
// The numeric truth of this game lives in the territory model, not in the DOM.
// Asserting food capacity by reading a KMB-formatted table cell ("1.2M") tests the
// formatter, not the economy. This exposes a read-only view of the model so
// end-to-end tests can assert numbers directly, and behaviour through the DOM.
//
// Everything handed out is a deep copy: a test can never mutate live game state
// through this surface.
//
// See docs/archived/03-refactor-plan.md Phase 1.6 and docs/03-e2e-test-plan.md section 2.3.

const ENABLED =
    typeof window !== "undefined" &&
    typeof window.location !== "undefined" &&
    new URLSearchParams(window.location.search).has("e2e");

let resolveReady;
const ready = new Promise((resolve) => {
    resolveReady = resolve;
});
let isReady = false;

/** Is the ?e2e=1 harness surface active? */
export function testHooksEnabled() {
    return ENABLED;
}

function snapshot(value) {
    if (value === null || value === undefined) {
        return value ?? null;
    }
    // Territory objects carry a `leader` object and otherwise only primitives, so a
    // structured clone is both safe and cheap. Fall back to a shallow copy if the
    // object ever gains something unclonable (a DOM node, a function).
    try {
        return structuredClone(value);
    } catch {
        return Array.isArray(value) ? value.map((v) => ({ ...v })) : { ...value };
    }
}

/**
 * Install window.__game. Called once during bootstrap; a no-op without ?e2e=1.
 *
 * @param {object} accessors  live readers into the game, supplied by the caller so
 *                            this module imports nothing and stays out of the
 *                            existing import cycle.
 */
export function installTestHooks(accessors) {
    if (!ENABLED) {
        return;
    }

    window.__game = {
        /** Resolves once the territory model is built and turn 1 has begun. */
        ready,
        isReady: () => isReady,
        seed: () => window.__seed ?? null,

        turn: () => accessors.turn(),
        phase: () => accessors.phase(),

        territory: (nameOrId) => snapshot(accessors.territory(nameOrId)),
        territoriesOwnedBy: (owner) => snapshot(accessors.territoriesOwnedBy(owner)),
        totals: () => snapshot(accessors.totals()),

        pathAreaComputations: () => accessors.pathAreaComputations(),
        sieges: () => snapshot(accessors.sieges()),
        wars: () => snapshot(accessors.wars()),

        // Armies in transit: committed to an attack, retreated from it, and due back at
        // their source territory on a later turn. [warId, sourceTerritoryIds, turnQueued,
        // turnsUntilReturn]. This is the credit half of audit 5.1 AD; without it a spec
        // has to play two more turns to find out whether a retreat destroyed the army.
        retrievals: () => snapshot(accessors.retrievals()),

        // [countryName, normalisedStrength], strongest first. What the country
        // selection screen greys out is a prefix of this list -- see audit 5.2 Z --
        // so a spec can name the gate rather than hard-coding which countries are
        // above it.
        countryStrengths: () => snapshot(accessors.countryStrengths()),

        // The countries the selection screen has LOCKED, read from the store rather
        // than from the grey fill. The two were allowed to disagree until Phase 5.8:
        // the confirm button was gated on `fill === GREY_OUT_COLOR`, so repainting a
        // locked country through the colour picker unlocked it. A spec must be able to
        // assert the rule, not its rendering.
        greyedOutCountries: () => snapshot(accessors.greyedOutCountries()),

        // Direct writes to territory state that bypassed state/mutations.js, recorded
        // only when the page is loaded with ?stateGuard=1. Always empty otherwise.
        stateGuardViolations: () => snapshot(accessors.stateGuardViolations?.() ?? []),

        // The running chance of a disaster, which climbs a point every quiet turn and resets
        // to zero when one fires.
        randomEventProbability: () => accessors.randomEventProbability(),

        // Queue a named disaster for the NEXT turn, or `null` to cancel. A random event is a
        // band on the mean of five draws, so no seed reaches a chosen event on a chosen turn
        // -- and the scenario loader sets up the WORLD, not the turn. This is how the four
        // disasters become testable through the game rather than only as pure functions.
        forceRandomEvent: (name) => accessors.forceRandomEvent(name),

        // One ACTIVE siege, by the name of the territory it besieges, or null. `sieges()`
        // above answers "which territories are besieged"; this answers "what is happening to
        // this one" -- whose siege it is, how long it has run, and the two armies. The siege
        // holds a live reference to the territory (Phase 4.7), so only the fields a spec can
        // legitimately assert on are copied out.
        siegeAt: (territoryName) => {
            const found = accessors.siegeAt(territoryName);
            if (!found) {
                return null;
            }
            const { siege, side } = found;
            return snapshot({
                side: side,
                warId: siege.warId,
                attackingCountry: siege.attackingCountry,
                attackingTerritory: siege.attackingTerritory,
                turnsInSiege: siege.turnsInSiege,
                attackingArmyRemaining: [...(siege.attackingArmyRemaining ?? [])],
                defendingArmyRemaining: [...(siege.defendingArmyRemaining ?? [])],
                defendingTerritory: siege.defendingTerritory?.territoryName ?? null
            });
        },

        // The battle currently on screen: the two armies as they stand, the round, and the
        // war id. `null` when no battle is open.
        //
        // The battle UI's own cells are formatted ("1.9k"), so they cannot be used to assert
        // an outcome that is defined arithmetically -- "half the surviving defenders join the
        // attacker" needs the surviving defenders, not a rounded label. This is the same
        // read-only, deep-copied surface as every other accessor here.
        battle: () => snapshot(accessors.battle()),

        // The faces the 3D dice are actually SHOWING, in roll order. Not what the rules rolled --
        // `battle()` and the round log both carry that -- but what a player looking at the table
        // would read off it. The two are supposed to be the same list, and for as long as the dice
        // have existed they were not; see `facesShowing()` in dices.js.
        diceFaces: () => snapshot(accessors.diceFaces?.() ?? []),

        // The active victory condition, and a way to set one.
        //
        // `setGoal()` takes a kind and a SCALE rather than a condition object, so nothing
        // outside `goalCatalogue.js` has to know that a land share goes on `landShare` and
        // a turn count on `turnLimit` -- the same reason the chooser itself does not.
        // `tools/ai-sim.mjs --goal=KIND:scale` is the caller that matters: the acceptance
        // criterion for the doctrine layer is that the five goals produce five visibly
        // different worlds over 150 headless turns, and that cannot be measured without a
        // way to start a run under a named goal.
        //
        // `victoryProgressFor()` is how a spec asks the question the phase bar answers,
        // without reading a formatted string off the DOM.
        victoryCondition: () => snapshot(accessors.victoryCondition()),
        setGoal: (kind, scale) => snapshot(accessors.setGoal(kind, scale)),
        victoryProgressFor: (country) => snapshot(accessors.victoryProgressFor(country)),

        // Every GAME_OVER this game has emitted, oldest first.
        //
        // A LIST rather than a flag, because the assertion that matters is "once". The
        // ending latches -- the condition stays met after it has been met, and without the
        // latch a decided game would announce itself again at the end of every subsequent
        // turn -- and that failure is invisible to anything reporting only the most recent
        // result. A spec plays two more turns past the ending and asserts the length is
        // still one. Cleared by New Game and by a load, alongside the latch itself.
        gameOverEvents: () => snapshot(accessors.gameOverEvents?.() ?? []),

        // The continent bonus, which is DERIVED every turn and stored nowhere. There is
        // therefore no field a spec can read to find out whether a continent held whole is
        // paying, and the mechanic sits far enough into a playthrough that nobody is going
        // to reach it by clicking -- so the measurement is these two.
        //
        // `continents()` is who holds what: one row per continent, its size, whoever holds
        // it outright (or null) and the four largest holders. `economyFor()` is one
        // territory's derived income and its EFFECTIVE capacities, with the two multipliers
        // in force stated alongside, plus the stored capacities so a spec can prove the
        // bonus was never written back onto the territory.
        continents: () => snapshot(accessors.continents?.() ?? []),
        economyFor: (nameOrId) => snapshot(accessors.economyFor?.(nameOrId) ?? null),

        // Put the world into a state clicking cannot reach -- a rout, an all-naval
        // defender, two concurrent sieges. Writes through state/mutations.js like the
        // game does. See src/platform/scenarios.js and docs/03-e2e-test-plan.md 3.7.
        applyScenario: (scenario) => snapshot(accessors.applyScenario(scenario)),

        // The military activity feed (Phase 7.4), as DATA rather than as rendered
        // rows. The panel stores facts and derives its wording and its colours when it
        // draws, so a spec that read the text back off the DOM would be asserting the
        // phrasing and nothing else -- and the interesting properties are the ones the
        // phrasing hides: that a conquest names the country it was taken FROM, that a
        // failed attack is recorded at all, that the player's involvement is marked on
        // both sides.
        activity: () => snapshot(accessors.activity()),

        // What the AI countries most recently decided and WHY -- the same bounded ring
        // the Numpad-/ debug panel renders (src/ai/planRecord.js). A hundred-turn run
        // that stops conquering anything is the AI's most important failure mode and it
        // has no textual signature: every turn completes, nothing throws, and the map
        // simply stops changing. The skip reasons are the only place that says why.
        aiPlans: (limit) => snapshot(accessors.aiPlans(limit)),

        // Write one entry directly. The feed's harder cases are unreachable by
        // clicking in any reasonable time -- an AI conquering an AI on the far side of
        // the map, a siege running four turns -- and the alternative is a spec that
        // plays twenty turns and hopes. What this does NOT bypass is the panel: the
        // entry goes through `recordActivity()` and the panel re-renders from the
        // event, so what the spec then reads is the real rendering path.
        recordActivity: (entry) => snapshot(accessors.recordActivity(entry)),

        // Battle overhaul B.8.4. Queue a battle the player DEFENDED and play it back.
        //
        // The alternative was a seed lottery. Playback needs an AI country to attack a
        // PARTICULAR player territory on a PARTICULAR turn, which no scenario can arrange and
        // which is the reason B.8 shipped without an end-to-end test at all. What can be
        // arranged is the record: `recordDefence()` is exactly what `doAttack()` calls, and the
        // record is the whole input to the playback -- nothing is read back off the world when
        // it draws, deliberately, because by then the territory may have changed hands.
        //
        // So this bypasses the AI turn and NOTHING else. The queue, the reversed sides, the
        // ledger, the timer, the Skip control and the window's restoration afterwards are all
        // the real path, which is the half that had never been exercised.
        queueDefence: (record) => accessors.queueDefence(record),
        pendingDefences: () => accessors.pendingDefences(),
        playQueuedDefences: () => accessors.playQueuedDefences(),
        setAlwaysSkipPlayback: (value) => accessors.setAlwaysSkipPlayback(value),
    };
}

/**
 * Extra hooks that only make sense once the adjacency data is loaded. Kept
 * separate so window.__game exists from the very first paint.
 */
export function installAdjacencyTestHooks(accessors) {
    if (!ENABLED || !window.__game) {
        return;
    }
    Object.assign(window.__game, {
        interactableFrom: (territoryName) => accessors.interactableFrom(territoryName),
        adjacencyExceptions: () => snapshot(accessors.adjacencyExceptions()),
        strandedTerritories: () => accessors.strandedTerritories(),
    });
}

/**
 * Save/load hooks (Phase 7.3).
 *
 * `saveNow()` exists because the autosave interval is sixty seconds and a spec
 * cannot wait sixty seconds -- and shortening the interval for the harness would
 * mean the suite testing a timing the game never uses. It takes the same save the
 * timer takes, through the same code path, and returns whether it was stored.
 *
 * `saveCode()` and `loadCode()` are the panel's two buttons without the panel, so a
 * spec can assert that a round trip preserves the world without driving a textarea
 * and the clipboard.
 */
export function installSaveTestHooks(accessors) {
    if (!ENABLED || !window.__game) {
        return;
    }
    Object.assign(window.__game, {
        saveNow: () => accessors.saveNow(),
        saveCode: () => accessors.saveCode(),
        loadCode: (code) => accessors.loadCode(code),
        hasStoredSave: () => accessors.hasStoredSave(),
        clearStoredSave: () => accessors.clearStoredSave(),
    });
}

/**
 * Audio hooks.
 *
 * A spec cannot hear anything, so what it needs is the settings and the transport
 * state as numbers -- did the slider actually move the volume, did a restored save
 * bring back the mute. The panel's own controls are driven through the DOM like any
 * other UI; this is the readout that says whether they landed.
 *
 * `setAudio()` is here for the one thing the DOM cannot do: put the settings into a
 * known state that is NOT the one the save under test carries, so that a load can be
 * shown to have changed them rather than merely to have left them alone.
 *
 * Reaching into the module directly with a dynamic `import()` was the obvious
 * alternative and does not work: `index.html` loads the entry modules as plain
 * `<script type="module">` tags against the SOURCE files, and a Vite BUILD rewrites
 * those to hashed bundles -- so `/src/platform/audio.js` exists under `npm run dev`
 * and does not exist under `npm run preview`, which is what the e2e suite runs
 * against.
 */
export function installAudioTestHooks(accessors) {
    if (!ENABLED || !window.__game) {
        return;
    }
    Object.assign(window.__game, {
        audio: () => snapshot(accessors.audio()),
        setAudio: (settings) => snapshot(accessors.setAudio(settings)),
        audioTracks: () => accessors.audioTracks(),
        currentTrack: () => accessors.currentTrack(),
        musicPlaying: () => accessors.musicPlaying(),
    });
}

/** Signal that initialisation has finished. */
export function signalReady() {
    if (!ENABLED) {
        return;
    }
    isReady = true;
    resolveReady();
}
