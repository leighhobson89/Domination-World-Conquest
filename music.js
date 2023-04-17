// create an audio element and add the source of the music file
const audio = new Audio('resources/musicGame.mp3');

// keep track of whether the music is currently playing or not
let isPlaying = true;

// define the currentTime variable
let currentTime = 0;

document.addEventListener("DOMContentLoaded", function() {
    // play the audio when the DOM content is loaded
    audio.play();

    const musicButton = document.getElementById("toggle-music-btn");
    const newGameButton = document.getElementById("new-game-btn");
    if (musicButton) {
        musicButton.addEventListener("click", function() {
            // toggle the playing status
            isPlaying = !isPlaying;

            if (isPlaying) {
                document.getElementById("toggle-music-btn").classList.add("isPlaying");
                // if the music is now playing, set the current time and play the audio
                audio.currentTime = currentTime;
                audio.play();
            } else {
                document.getElementById("toggle-music-btn").classList.remove("isPlaying");
                // if the music is now paused, pause the audio and save the current time
                audio.pause();
                currentTime = audio.currentTime;
            }
        });
    }

    if (newGameButton) {
        newGameButton.addEventListener("click", function() {

            if (isPlaying) {
                // if the music is now playing, set the current time and play the audio
                audio.currentTime = currentTime;
                audio.play();
            }
        });
    }
});
