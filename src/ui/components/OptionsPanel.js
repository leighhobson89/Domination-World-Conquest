// The Options panel: a modal over the main menu, holding the theme picker and the
// two sound switches.
//
// It is the first component that creates its OWN container rather than mounting
// into a <div> declared in index.html. That is deliberate and is the pattern the
// rest should move to -- a component that owns its element can be destroyed
// completely, which is what Phase 7.2's New Game needs.
//
// Theme selection previews live. Changing the dropdown applies the theme
// immediately without persisting, so the player judges it against the real UI
// rather than two swatches; Close commits the visible choice, Cancel restores
// whatever was in force when the panel opened. Anything else means choosing a
// theme by reading its name.
//
// The sound switches behave the same way, and for the same reason: they apply
// live, so the player hears the answer, and Cancel puts back what was in force
// when the panel opened. They are a VIEW onto `src/platform/audio.js` and hold no
// state of their own -- the audio panel over the map has the same two mutes, plus
// volumes and transport, and the two must never disagree. That is why the switches
// are repainted from `onAudioChanged` rather than from whatever was last clicked
// here: muting the music from the map and then opening Options shows it muted.
//
// Why duplicate them at all: the audio panel hangs off a button over the map, and
// the map is not on screen at the title. "Turn the music off" is the first thing
// some players do, and until now the only place to do it was inside a game.
//
// There is no `update(state)`. The panel holds settings, which are facts about
// this browser rather than about the world, so it has nothing in the store to
// follow -- the same reason `Tooltip` and `MainMenu` have none.

import { ids } from "../core/registry.js";
import { el, mount, on } from "../core/dom.js";
import { applyTheme, availableThemes, currentThemeId } from "../theme/theme.js";
import { themeById } from "../theme/themes.js";
import {
    audioSettings,
    onAudioChanged,
    setMusicMuted,
    setSfxMuted,
} from "../../platform/audio.js";

let root = null;
let select = null;
let description = null;
let preview = null;
let musicToggle = null;
let sfxToggle = null;
let removers = [];
let unsubscribeAudio = null;
/** The theme in force when the panel was opened, for Cancel to restore. */
let themeOnOpen = null;
/** The two mutes as they stood when the panel opened, for Cancel to restore. */
let audioOnOpen = null;
/** The click sound, so the switches sound like every other control in the menu. */
let onSound = null;

/** Two swatch chips plus the theme's one-line description. */
function renderPreview(id) {
    const theme = themeById(id);
    if (!theme) return;
    if (description) description.textContent = theme.description;
    if (!preview) return;
    preview.replaceChildren(
        ...theme.swatch.map((colour) =>
            el("span", { class: "theme-swatch", style: { background: colour } }),
        ),
    );
}

/**
 * One labelled on/off switch.
 *
 * The checkbox is the control and the two spans beside it are only paint, so the
 * keyboard, the accessibility tree and the e2e suite all get a real checkbox --
 * `page.check()` works and there is nothing to simulate. The stylesheet lays the
 * input transparently OVER its track for that last part; see `.options-toggle-input`.
 *
 * The sense is deliberately inverted against the setting it writes: the switch
 * says whether the sound is ON, because "Music [x]" is what a player reads, while
 * `audio.js` stores `musicMuted`. A switch labelled Mute would sit the wrong way
 * up next to every other control in the panel.
 */
function soundToggle({ id, label, onChange }) {
    const input = el("input", {
        id,
        type: "checkbox",
        class: "options-toggle-input",
        attrs: { "aria-label": label },
    });
    removers.push(
        on(input, "change", () => {
            onSound?.();
            // `checked` means audible; the setting is "muted", so it is negated here
            // and nowhere else.
            onChange(!input.checked);
        }),
    );

    const row = el("label", { class: "options-toggle" }, [
        input,
        el("span", { class: "options-toggle-track", attrs: { "aria-hidden": "true" } }),
        el("span", { class: "options-toggle-label", text: label }),
    ]);

    return { row, input };
}

/** Put the switches where `audio.js` says they are, whoever moved them. */
function renderSound() {
    const settings = audioSettings();
    if (musicToggle) musicToggle.checked = !settings.musicMuted;
    if (sfxToggle) sfxToggle.checked = !settings.sfxMuted;
}

function onSelectChanged(event) {
    // persist: false -- the choice is not committed until Close.
    applyTheme(event.target.value, { persist: false });
    renderPreview(event.target.value);
}

/**
 * @param {object} [options]
 * @param {() => void} [options.onSound] the click sound, played by the caller's rules
 */
export function create({ onSound: soundHandler } = {}) {
    if (root) return root;
    onSound = soundHandler ?? null;

    select = el(
        "select",
        { id: ids.themeSelect, class: "options-select" },
        availableThemes().map((theme) =>
            el("option", { value: theme.id, text: theme.name }),
        ),
    );

    preview = el("div", { id: ids.themePreview, class: "theme-preview" });
    description = el("p", { id: ids.themeDescription, class: "options-description" });

    const music = soundToggle({
        id: ids.optionsMusicToggle,
        label: "Music",
        onChange: setMusicMuted,
    });
    musicToggle = music.input;

    const sfx = soundToggle({
        id: ids.optionsSfxToggle,
        label: "Effects",
        onChange: setSfxMuted,
    });
    sfxToggle = sfx.input;

    const panel = el("div", { id: ids.optionsPanel, class: "options-panel" }, [
        el("h2", { class: "options-title", text: "Options" }),

        el("div", { class: "options-row" }, [
            el("label", {
                class: "options-label",
                text: "Theme",
                attrs: { for: ids.themeSelect },
            }),
            el("div", { class: "options-control" }, [select, preview]),
        ]),
        description,

        el("div", { class: "options-row" }, [
            el("span", { class: "options-label", text: "Sound" }),
            el("div", { class: "options-control options-toggles" }, [music.row, sfx.row]),
        ]),

        el("div", { class: "options-actions" }, [
            el("button", {
                id: ids.optionsCancelBtn,
                class: ["options-button", "options-button-ghost"],
                text: "Cancel",
                on: { click: cancel },
            }),
            el("button", {
                id: ids.optionsCloseBtn,
                class: ["options-button", "options-button-primary"],
                text: "Done",
                on: { click: () => close(true) },
            }),
        ]),
    ]);

    root = el("div", { id: ids.optionsContainer, class: "options-scrim" }, panel);
    // Clicking the scrim -- but not the panel -- cancels, which is what every
    // modal does and what the Escape key below does too.
    removers.push(
        on(root, "click", (event) => {
            if (event.target === root) cancel();
        }),
    );
    removers.push(on(select, "change", onSelectChanged));
    // Not merely at open: the audio panel over the map writes the same two settings,
    // and so does a save being loaded.
    unsubscribeAudio = onAudioChanged(renderSound);

    root.style.display = "none";
    mount(document.body, root);
    renderSound();
    return root;
}

/** Escape closes the panel without committing. Installed only while it is open. */
function onKeyDown(event) {
    if (event.key === "Escape") {
        event.stopPropagation();
        cancel();
    }
}

export function open() {
    if (!root) create();
    themeOnOpen = currentThemeId();
    const { musicMuted, sfxMuted } = audioSettings();
    audioOnOpen = { musicMuted, sfxMuted };
    select.value = themeOnOpen;
    renderPreview(themeOnOpen);
    renderSound();
    root.style.display = "flex";
    // Captured, so the panel gets Escape before the map's own handler does.
    document.addEventListener("keydown", onKeyDown, true);
}

/** @param {boolean} commit `true` to persist the previewed theme. */
export function close(commit) {
    if (!root) return;
    if (commit) applyTheme(select.value);
    root.style.display = "none";
    document.removeEventListener("keydown", onKeyDown, true);
}

/** Close, putting back the theme and the mutes in force when the panel opened. */
export function cancel() {
    if (themeOnOpen !== null) applyTheme(themeOnOpen);
    if (audioOnOpen !== null) {
        setMusicMuted(audioOnOpen.musicMuted);
        setSfxMuted(audioOnOpen.sfxMuted);
    }
    close(false);
}

export function isOpen() {
    return Boolean(root) && root.style.display !== "none";
}

export function destroy() {
    document.removeEventListener("keydown", onKeyDown, true);
    unsubscribeAudio?.();
    unsubscribeAudio = null;
    for (const remove of removers) remove();
    removers = [];
    root?.remove();
    root = null;
    select = null;
    preview = null;
    description = null;
    musicToggle = null;
    sfxToggle = null;
    themeOnOpen = null;
    audioOnOpen = null;
    onSound = null;
}

export const optionsPanel = { create, open, close, cancel, isOpen, destroy };
