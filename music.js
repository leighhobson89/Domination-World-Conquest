import {
    playSoundClip
} from './sfx.js'

// create an audio element and add the source of the music file
const audio = new Audio('resources/music/musicGame.mp3');

let isPlaying;

// define the currentTime variable
let currentTime = 0;

document.addEventListener("DOMContentLoaded", function() {

    const musicButton = document.getElementById("toggle-music-btn");
    const newGameButton = document.getElementById("new-game-btn");
    let firstTime;
    if (musicButton) {
        musicButton.addEventListener("click", function() {
            playSoundClip("click");
            if (isPlaying === undefined) {
                firstTime = true;
                document.getElementById("toggle-music-btn").classList.add("isPlaying");
                isPlaying = true;
                audio.play().then(() => console.log("Music playing from music button"));
            }

            if (!firstTime) {
                isPlaying = !isPlaying;
                if (isPlaying) {
                    document.getElementById("toggle-music-btn").classList.remove("isNotPlaying");
                    document.getElementById("toggle-music-btn").classList.add("isPlaying");
                    // if the music is now playing, set the current time and play the audio
                    audio.currentTime = currentTime;
                    audio.play().then(() => console.log("Resuming music"));
                } else {
                    document.getElementById("toggle-music-btn").classList.remove("isPlaying");
                    document.getElementById("toggle-music-btn").classList.add("isNotPlaying");
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
                document.getElementById("toggle-music-btn").classList.add("isPlaying");
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