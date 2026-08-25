// The sound-effect entry point the game calls.
//
// This used to be the whole of the sound system: a three-case switch that built a
// fresh `Audio` over `click.wav`, `dice1.wav` or `dice2.wav`, at whatever volume
// the browser felt like, with no way to turn it down. It is now a one-line
// forward to `src/platform/audio.js`, which owns the volumes, the mutes and the
// music as one thing -- there is no longer a sound in the game that the audio
// panel cannot reach.
//
// The vocabulary is two clips and they are named for what the control MEANS
// rather than for a file:
//
//   * "switch" -- the map's own furniture. The chrome buttons floating over the
//     map and the tabs of the territory panel: controls that flip a view.
//   * "button" -- every button inside a window, and every item in the menus.
//     Controls that commit something.
//
// The three WAVs are gone. The two dice clips fired on a cosmetic coin-flip in
// the middle of the battle loop and said nothing the dice tumbling on screen were
// not already saying, and `click.wav` is replaced by the two mp3s above.

import { playSfx } from "./src/platform/audio.js";

/**
 * @param {"switch"|"button"} clip
 */
export function playSoundClip(clip) {
    playSfx(clip);
}
