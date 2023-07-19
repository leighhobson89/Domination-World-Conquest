export function playSoundClip(clip) {
  let audio;
  switch (clip) {
    case "click":
      audio = new Audio("resources/sfx/click.wav");
      break;
    case "dice1":
      audio = new Audio("resources/sfx/dice1.wav");
      break;
    case "dice2":
      audio = new Audio("resources/sfx/dice2.wav");
      break;
  }
  audio.play().then(r => null);
}