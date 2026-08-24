import {
    ids
} from './src/ui/core/registry.js';
import {
    playSoundClip
} from './sfx.js'

// create an audio element and add the source of the music file
const audio = new Audio('resources/music/musicGame.mp3');

let isPlaying;

// define the currentTime variable
let currentTime = 0;

document.addEventListener("DOMContentLoaded", function() {

    const musicButton = document.getElementById(ids.toggleMusicBtn);
    const newGameButton = document.getElementById(ids.newGameBtn);
    let firstTime;
    if (musicButton) {
        musicButton.addEventListener("click", function() {
            playSoundClip("click");
            if (isPlaying === undefined) {
                firstTime = true;
                document.getElementById(ids.toggleMusicBtn).classList.add("isPlaying");
                isPlaying = true;
                audio.play().then(() => console.log("Music playing from music button"));
            }

            if (!firstTime) {
                isPlaying = !isPlaying;
                if (isPlaying) {
                    document.getElementById(ids.toggleMusicBtn).classList.remove("isNotPlaying");
                    document.getElementById(ids.toggleMusicBtn).classList.add("isPlaying");
                    // if the music is now playing, set the current time and play the audio
                    audio.currentTime = currentTime;
                    audio.play().then(() => console.log("Resuming music"));
                } else {
                    document.getElementById(ids.toggleMusicBtn).classList.remove("isPlaying");
                    document.getElementById(ids.toggleMusicBtn).classList.add("isNotPlaying");
                    // if the music is now paused, pause the audio and save the current time
                    audio.pause();
                    currentTime = audio.currentTime;
                }
            }
            firstTime = false;

        });
    }

    if (newGameButton) {
        newGameButton.addEventListener("click", function() {
            if (isPlaying === undefined) {
                document.getElementById(ids.toggleMusicBtn).classList.add("isPlaying");
                isPlaying = true;
                audio.play().then(() => console.log("Music playing from New Game button"));
            }
        });
    }

    audio.addEventListener("ended", function() {
        // Set the current time to 0 and play the audio to loop it
        audio.currentTime = 0;
        audio.play().then(() => null);
    });
});