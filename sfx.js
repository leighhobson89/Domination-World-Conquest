export function playSoundClip() {
  const audio = new Audio("resources/sfx/click.wav");
  audio.play().then(r => null);
}