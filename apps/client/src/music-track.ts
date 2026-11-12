/** File assignments are intentionally swapped; the scene keys keep their original lifecycle. */
export const musicTrackUrl = (scene: "lobby" | "game") =>
  `/assets/audio/music/${scene === "lobby" ? "game" : "lobby"}-song.mp3`;
