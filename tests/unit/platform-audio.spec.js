// The audio manager's two testable promises: the shuffle bag, and the settings.
//
// The playlist rule is the part that is easy to get subtly wrong and impossible to
// see by playing -- "no repeat until every other track has played" holds over a
// whole playthrough, and "the last track of one playthrough cannot open the next"
// only shows itself at a boundary. Both are asserted here over several complete
// playthroughs rather than by eye.
//
// `src/platform/audio.js` has no DOM in it, but it does reach for two browser
// globals: `fetch`, for the generated folder listing, and `Audio`. Both are stubbed
// below. `Audio` is deliberately a stub that RESOLVES `play()` -- a real browser
// rejects it until the page has been interacted with, and the module treats that as
// "not playing", which would make every assertion here vacuous.

import { beforeEach, describe, expect, it, vi } from "vitest";

const TRACKS = ["alpha.mp3", "bravo.mp3", "charlie.mp3", "delta.mp3", "echo.mp3"];

/** A minimal `Audio` whose `play()` succeeds and whose `ended` can be fired. */
class FakeAudio {
    constructor() {
        this.paused = true;
        this.volume = 1;
        this.src = "";
        this.listeners = new Map();
        FakeAudio.instances.push(this);
    }
    addEventListener(type, handler) {
        this.listeners.set(type, handler);
    }
    async play() {
        this.paused = false;
    }
    pause() {
        this.paused = true;
    }
    /** What a track finishing does. */
    end() {
        return this.listeners.get("ended")?.();
    }
}
FakeAudio.instances = [];

function installGlobals(tracks = TRACKS) {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ tracks }) })),
    );
    // `localStorage` is optional to the module -- every access is wrapped -- so it
    // is left absent on purpose, which also proves the guards work.
    vi.stubGlobal("window", {});
}

/** A fresh copy of the module, since it keeps the bag in module scope. */
async function freshAudio(tracks = TRACKS) {
    installGlobals(tracks);
    vi.resetModules();
    const audio = await import("../../src/platform/audio.js");
    audio.__resetAudioForTests();
    await audio.loadManifest();
    return audio;
}

/**
 * Play `count` tracks and report them in order.
 *
 * Every track is taken through `skipTrack()` rather than by firing `ended`,
 * because the two go through the same `advance()` and skipping is the one a test
 * can drive without reaching into the element.
 */
async function playSequence(audio, count) {
    const played = [];
    for (let i = 0; i < count; i++) {
        await audio.skipTrack();
        played.push(audio.currentTrackName());
    }
    return played;
}

describe("audio playlist", () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it("reads the generated folder listing", async () => {
        const audio = await freshAudio();
        expect(audio.trackList()).toEqual(TRACKS);
    });

    it("plays every track once before any track plays twice", async () => {
        const audio = await freshAudio();
        const played = await playSequence(audio, TRACKS.length);
        expect(new Set(played).size).toBe(TRACKS.length);
        expect([...played].sort()).toEqual([...TRACKS].sort());
    });

    it("holds that promise over several playthroughs", async () => {
        const audio = await freshAudio();
        const played = await playSequence(audio, TRACKS.length * 4);

        for (let start = 0; start < played.length; start += TRACKS.length) {
            const playthrough = played.slice(start, start + TRACKS.length);
            expect(
                new Set(playthrough).size,
                `playthrough starting at ${start} repeated a track: ${playthrough.join(", ")}`,
            ).toBe(TRACKS.length);
        }
    });

    it("never opens a playthrough with the track that closed the last one", async () => {
        // Several runs, because the rule is enforced by a swap on a random draw:
        // one run that happens not to draw the barred track proves nothing.
        for (let run = 0; run < 12; run++) {
            const audio = await freshAudio();
            const played = await playSequence(audio, TRACKS.length * 3);
            for (let boundary = TRACKS.length; boundary < played.length; boundary += TRACKS.length) {
                expect(
                    played[boundary],
                    `run ${run}: ${played[boundary]} closed one playthrough and opened the next`,
                ).not.toBe(played[boundary - 1]);
            }
        }
    });

    it("survives a folder with one track in it", async () => {
        const audio = await freshAudio(["only.mp3"]);
        const played = await playSequence(audio, 3);
        // The rule cannot be satisfied with one file, and the alternative -- refusing
        // to play it a second time -- is silence. It repeats, and that is correct.
        expect(played).toEqual(["only.mp3", "only.mp3", "only.mp3"]);
    });

    it("survives an empty folder", async () => {
        const audio = await freshAudio([]);
        await audio.skipTrack();
        await audio.playMusic();
        expect(audio.currentTrackName()).toBeNull();
        expect(audio.isMusicPlaying()).toBe(false);
    });

    it("a finished track hands over to the next one", async () => {
        const audio = await freshAudio();
        await audio.playMusic();
        const first = audio.currentTrackName();
        expect(first).not.toBeNull();

        await FakeAudio.instances[0].end();
        expect(audio.currentTrackName()).not.toBe(first);
    });
});

describe("audio settings", () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it("clamps a volume into range and coerces a mute to a boolean", async () => {
        const audio = await freshAudio();
        audio.setMusicVolume(4);
        audio.setSfxVolume(-1);
        audio.setMusicMuted(1);
        expect(audio.audioSettings()).toMatchObject({
            musicVolume: 1,
            sfxVolume: 0,
            musicMuted: true,
        });
    });

    it("a muted channel is silent without losing the volume behind it", async () => {
        const audio = await freshAudio();
        audio.setMusicVolume(0.4);
        await audio.playMusic();
        audio.setMusicMuted(true);
        expect(FakeAudio.instances[0].volume).toBe(0);
        // Unmuting must not have to guess what the volume was.
        audio.setMusicMuted(false);
        expect(FakeAudio.instances[0].volume).toBeCloseTo(0.4);
        expect(audio.audioSettings().musicVolume).toBeCloseTo(0.4);
    });

    it("restoring a save applies the settings it carried", async () => {
        const audio = await freshAudio();
        audio.applyAudioSettings({ musicVolume: 0.25, sfxVolume: 0.9, sfxMuted: true });
        expect(audio.audioSettings()).toMatchObject({
            musicVolume: 0.25,
            sfxVolume: 0.9,
            sfxMuted: true,
            musicMuted: false,
        });
    });

    it("a save taken with the music off comes back with the music off", async () => {
        const audio = await freshAudio();
        await audio.playMusic();
        expect(audio.isMusicPlaying()).toBe(true);

        audio.applyAudioSettings({ musicPlaying: false });
        expect(audio.isMusicPlaying()).toBe(false);
    });

    it("nonsense in the stored settings falls back to the defaults", async () => {
        const audio = await freshAudio();
        audio.applyAudioSettings({ musicVolume: "loud", sfxVolume: null });
        const settings = audio.audioSettings();
        expect(Number.isFinite(settings.musicVolume)).toBe(true);
        expect(Number.isFinite(settings.sfxVolume)).toBe(true);
    });
});
