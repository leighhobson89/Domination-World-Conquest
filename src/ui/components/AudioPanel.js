// The music-note button over the map, and the small floating panel it opens.
//
// This is the whole audio UI. What it replaces is one item in the main menu --
// "Toggle Music" -- which could only be reached by leaving the game, only started
// or stopped one hard-coded file, had no volume, no mute, no idea what was
// playing, and was not saved. Every one of those is a control on this panel.
//
// The button sits directly under the continent-view button at the top right, on
// the same 44px grid as the rest of the map chrome and wearing the same
// `.chrome-button` box, because it is the same kind of thing: a control that
// belongs to the map rather than to any window.
//
// The panel is NOT a modal. There is no scrim, the map stays live behind it and
// Escape closes it, because changing the volume is something a player does WHILE
// looking at the game -- putting it behind a scrim would make it the same kind of
// interruption the menu item was.
//
// Every control here is a view onto `src/platform/audio.js` and writes nothing of
// its own: the component subscribes to `onAudioChanged` and repaints, so the
// panel is right whether the change came from a click here, from a save being
// loaded, or from the track ending on its own.

import { ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";
import {
    audioSettings,
    currentTrackName,
    isMusicPlaying,
    onAudioChanged,
    pauseMusic,
    playMusic,
    setMusicMuted,
    setMusicVolume,
    setSfxMuted,
    setSfxVolume,
    skipTrack,
    trackList,
} from "../../platform/audio.js";
import {
    musicNoteIcon,
    pauseIcon,
    playIcon,
    skipIcon,
    speakerIcon,
    speakerMutedIcon,
} from "../icons.js";

let buttonRoot = null;
let panelRoot = null;
let playPauseButton = null;
let skipButton = null;
let trackLabel = null;
let musicSlider = null;
let musicMuteButton = null;
let sfxSlider = null;
let sfxMuteButton = null;
let removers = [];
let unsubscribe = null;
let onSound = null;

/** Drop whatever icon a button is wearing and put this one on instead. */
function setIcon(button, icon) {
    if (!button) return;
    button.replaceChildren(icon);
}

/**
 * A file name as something worth reading.
 *
 * `musicGame.mp3` becomes "Music Game": strip the extension, split the camel case
 * and the separators, capitalise. A track dropped into the folder therefore gets a
 * presentable name with no metadata and no manifest field -- which matters,
 * because the whole promise of the folder is that dropping a file in is enough.
 */
export function trackTitle(fileName) {
    if (!fileName) return "Nothing playing";
    return fileName
        .replace(/\.mp3$/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Repaint every control from the settings and the transport state. */
export function update() {
    const settings = audioSettings();

    if (playPauseButton) {
        const playing = isMusicPlaying();
        setIcon(playPauseButton, playing ? pauseIcon() : playIcon());
        playPauseButton.setAttribute("aria-label", playing ? "Pause music" : "Play music");
        playPauseButton.setAttribute("title", playing ? "Pause" : "Play");
    }

    if (trackLabel) {
        const total = trackList().length;
        trackLabel.textContent =
            total === 0 ? "No music found" : trackTitle(currentTrackName());
        trackLabel.setAttribute("title", currentTrackName() ?? "");
    }

    if (skipButton) {
        // Nothing to skip to when the folder is empty; one track is still a valid
        // playthrough, and skipping it restarts it, which is what a player expects.
        skipButton.disabled = trackList().length === 0;
    }

    if (musicSlider) musicSlider.value = String(Math.round(settings.musicVolume * 100));
    if (sfxSlider) sfxSlider.value = String(Math.round(settings.sfxVolume * 100));

    if (musicMuteButton) {
        setIcon(musicMuteButton, settings.musicMuted ? speakerMutedIcon() : speakerIcon());
        musicMuteButton.classList.toggle("is-muted", settings.musicMuted);
        musicMuteButton.setAttribute("aria-pressed", settings.musicMuted ? "true" : "false");
        musicMuteButton.setAttribute("title", settings.musicMuted ? "Unmute music" : "Mute music");
    }

    if (sfxMuteButton) {
        setIcon(sfxMuteButton, settings.sfxMuted ? speakerMutedIcon() : speakerIcon());
        sfxMuteButton.classList.toggle("is-muted", settings.sfxMuted);
        sfxMuteButton.setAttribute("aria-pressed", settings.sfxMuted ? "true" : "false");
        sfxMuteButton.setAttribute("title", settings.sfxMuted ? "Unmute effects" : "Mute effects");
    }
}

/**
 * One labelled row: a mute toggle, a slider and the name of what it governs.
 *
 * Music and sfx are the same control twice, so they are built once. Which one a
 * row is is entirely in the two callbacks and the id.
 */
function volumeRow({ label, sliderId, muteId, onVolume, onMute }) {
    const slider = el("input", {
        id: sliderId,
        type: "range",
        class: "audio-slider",
        attrs: { min: "0", max: "100", step: "1", "aria-label": label + " volume" },
    });
    // `input`, not `change`: the volume must follow the thumb, not wait for it to
    // be let go. That is the same reason the colour grid repaints the map on click.
    removers.push(on(slider, "input", () => onVolume(Number(slider.value) / 100)));

    const mute = el("button", {
        id: muteId,
        class: "audio-icon-button audio-mute",
        attrs: { type: "button" },
        on: { click: onMute },
    });

    const row = el("div", { class: "audio-row" }, [
        el("span", { class: "audio-row-label", text: label }),
        el("div", { class: "audio-row-controls" }, [mute, slider]),
    ]);

    return { row, slider, mute };
}

/**
 * @param {object} options
 * @param {() => void} [options.onSound] the click sound, played by the caller's rules
 */
export function create({ onSound: soundHandler } = {}) {
    if (buttonRoot) return buttonRoot;
    onSound = soundHandler ?? null;

    const music = volumeRow({
        label: "Music",
        sliderId: ids.audioMusicSlider,
        muteId: ids.audioMusicMuteBtn,
        onVolume: setMusicVolume,
        onMute() {
            onSound?.();
            setMusicMuted(!audioSettings().musicMuted);
        },
    });
    musicSlider = music.slider;
    musicMuteButton = music.mute;

    const sfx = volumeRow({
        label: "Effects",
        sliderId: ids.audioSfxSlider,
        muteId: ids.audioSfxMuteBtn,
        onVolume: setSfxVolume,
        onMute() {
            onSound?.();
            setSfxMuted(!audioSettings().sfxMuted);
        },
    });
    sfxSlider = sfx.slider;
    sfxMuteButton = sfx.mute;

    playPauseButton = el("button", {
        id: ids.audioPlayPauseBtn,
        class: "audio-icon-button audio-transport",
        attrs: { type: "button" },
        on: {
            async click() {
                onSound?.();
                // Asked of the ELEMENT rather than of the saved flag: the flag says
                // what the player wants, and a browser that refused autoplay can
                // leave the two disagreeing until the first gesture -- which this is.
                if (isMusicPlaying()) pauseMusic();
                else await playMusic();
                update();
            },
        },
    });

    skipButton = el(
        "button",
        {
            id: ids.audioSkipBtn,
            class: "audio-icon-button audio-transport",
            attrs: { type: "button", "aria-label": "Next track", title: "Next track" },
            on: {
                async click() {
                    onSound?.();
                    await skipTrack();
                    update();
                },
            },
        },
        //Unlike play/pause this icon never changes, so it is set once here rather
        //than written again on every `update()`.
        skipIcon()
    );

    trackLabel = el("div", { id: ids.audioTrackName, class: "audio-track-name" });

    const panel = el("div", { id: ids.audioPanel, class: "audio-panel" }, [
        el("div", { class: "audio-panel-header" }, [
            el("span", { class: "audio-panel-title", text: "Audio" }),
            el("button", {
                id: ids.audioCloseBtn,
                class: "audio-panel-close",
                text: "×",
                attrs: { type: "button", "aria-label": "Close" },
                on: {
                    click() {
                        onSound?.();
                        close();
                    },
                },
            }),
        ]),
        el("div", { class: "audio-transport-row" }, [playPauseButton, skipButton, trackLabel]),
        music.row,
        sfx.row,
    ]);

    panelRoot = el("div", { id: ids.audioPanelContainer, class: "audio-panel-container" }, panel);
    panelRoot.style.display = "none";
    mount(document.body, panelRoot);

    const button = el(
        "button",
        {
            id: ids.audioButton,
            class: "chrome-button audio-button",
            attrs: { type: "button", "aria-label": "Audio", title: "Music and sound" },
            on: {
                click() {
                    onSound?.();
                    toggle();
                },
            },
        },
        musicNoteIcon()
    );

    buttonRoot = el("div", { id: ids.audioButtonContainer, class: "audio-button-container" }, button);
    buttonRoot.style.display = "none";
    mount(document.body, buttonRoot);

    unsubscribe = onAudioChanged(update);
    update();
    return buttonRoot;
}

/** Escape closes the panel, as it does for every other floating thing. */
function onKeyDown(event) {
    if (event.key === "Escape" && isOpen()) {
        event.stopPropagation();
        close();
    }
}

export function open() {
    if (!panelRoot) return;
    update();
    panelRoot.style.display = "block";
    document.addEventListener("keydown", onKeyDown, true);
}

export function close() {
    if (!panelRoot) return;
    panelRoot.style.display = "none";
    document.removeEventListener("keydown", onKeyDown, true);
}

export function toggle() {
    if (isOpen()) close();
    else open();
}

export function isOpen() {
    return Boolean(panelRoot) && panelRoot.style.display !== "none";
}

/**
 * Show or hide the music-note button.
 *
 * It follows the rest of the map chrome: visible while the player is looking at
 * the map, hidden behind a window or the menu. Hiding the button also closes the
 * panel, because a panel with nothing to anchor it to is a floating box in the
 * middle of a battle screen.
 */
export function setButtonVisible(visible) {
    if (buttonRoot) buttonRoot.style.display = visible ? "block" : "none";
    if (!visible) close();
}

export function isButtonVisible() {
    return Boolean(buttonRoot) && buttonRoot.style.display !== "none";
}

export function destroy() {
    document.removeEventListener("keydown", onKeyDown, true);
    unsubscribe?.();
    unsubscribe = null;
    for (const remove of removers) remove();
    removers = [];
    panelRoot?.remove();
    buttonRoot?.remove();
    panelRoot = null;
    buttonRoot = null;
    playPauseButton = null;
    skipButton = null;
    trackLabel = null;
    musicSlider = null;
    musicMuteButton = null;
    sfxSlider = null;
    sfxMuteButton = null;
    onSound = null;
}

export const audioPanel = {
    create,
    open,
    close,
    toggle,
    isOpen,
    update,
    setButtonVisible,
    isButtonVisible,
    trackTitle,
    destroy,
};
