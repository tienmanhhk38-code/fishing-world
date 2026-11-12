// Media-element fallback for browser ports without Web Audio (e.g. Windows WebKit).
// Spatial audio uses the Web Audio path whenever that API exists.
import { useSettings } from "./settings";
type Pos = { x: number; y: number; z: number };
const tracks = new Map<string, HTMLAudioElement>(),
  voices = new Set<HTMLAudioElement>(),
  pool = new Map<string, HTMLAudioElement[]>();
const voiceScale = new WeakMap<HTMLAudioElement, number>();
let enabled = false,
  scene: "lobby" | "game" = "lobby",
  focused = false,
  reel: HTMLAudioElement | null = null,
  ambience: HTMLAudioElement | null = null,
  fade = 0;
let musicStarted = false;
function volume() {
  const s = useSettings.getState();
  return s.soundMuted ? 0 : s.musicVolume * 0.48 * (focused ? 0.35 : 1);
}
function sync() {
  if (!enabled) return;
  const current = tracks.get(scene);
  if (current) current.volume = volume();
  if (ambience) {
    const s = useSettings.getState();
    ambience.volume = s.soundMuted ? 0 : s.ambienceVolume * 0.12;
  }
  const s = useSettings.getState();
  for (const a of voices)
    a.volume = s.soundMuted
      ? 0
      : Math.min(1, s.volume * (voiceScale.get(a) ?? 0.9));
}
function music(restart = false) {
  if (!enabled || document.hidden) return;
  let next = tracks.get(scene);
  if (!next) {
    next = new Audio(`/assets/audio/music/${scene}-song.mp3`);
    next.preload = "auto";
    next.loop = true;
    next.volume = 0;
    tracks.set(scene, next);
  }
  if (!restart && !next.paused) return;
  if (restart) next.currentTime = 0;
  const duration = musicStarted ? 1200 : 80;
  void next
    .play()
    .then(() => {
      musicStarted = true;
    })
    .catch(() => {});
  cancelAnimationFrame(fade);
  const started = performance.now(),
    initial = new Map([...tracks].map(([key, a]) => [key, a.volume]));
  const tick = (now: number) => {
    const t = Math.min(1, (now - started) / duration);
    for (const [key, a] of tracks) {
      a.volume = Math.max(
        0,
        Math.min(
          1,
          (initial.get(key) ?? 0) * (1 - t) +
            (key === scene ? volume() : 0) * t,
        ),
      );
      if (t === 1 && key !== scene) {
        a.pause();
        a.currentTime = 0;
      }
    }
    if (t < 1) fade = requestAnimationFrame(tick);
  };
  fade = requestAnimationFrame(tick);
}
export const mediaAudio = {
  get enabled() {
    return enabled;
  },
  enable() {
    if (!enabled) {
      enabled = true;
      for (const name of [
        "cast",
        "nibble",
        "bite",
        "hook",
        "reel",
        "catch",
        "miss",
        "line-break",
        "click",
      ]) {
        const entries = Array.from({ length: 2 }, () => {
          const a = new Audio(
            `/assets/audio/${name === "reel" ? "reel-machine-v3" : name}.wav`,
          );
          a.preload = "auto";
          a.volume = 0;
          void a
            .play()
            .then(() => {
              if (!voices.has(a)) {
                a.pause();
                a.currentTime = 0;
              }
            })
            .catch(() => {});
          return a;
        });
        pool.set(name, entries);
      }
      useSettings.subscribe(sync);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          for (const a of [...tracks.values(), ...voices]) a.pause();
          for (const a of voices) if (a !== reel) voices.delete(a);
          ambience?.pause();
        } else {
          music();
          if (reel) void reel.play().catch(() => {});
          if (ambience) void ambience.play().catch(() => {});
        }
      });
      ambience = new Audio("/assets/audio/tropical-shore.wav");
      ambience.loop = true;
      sync();
      void ambience.play().catch(() => {});
    }
    music();
  },
  scene(value: "lobby" | "game") {
    if (scene === value) return;
    scene = value;
    this.stopReel();
    music(true);
  },
  focus(value: boolean) {
    focused = value;
    sync();
  },
  stopReel() {
    if (reel) {
      reel.pause();
      voices.delete(reel);
      reel = null;
    }
  },
  sound(name: string, pos: Pos, remote: boolean, listener: Pos) {
    const s = useSettings.getState();
    if (!enabled || document.hidden || s.soundMuted || !s.volume) return;
    const distance = Math.hypot(pos.x - listener.x, pos.z - listener.z);
    if (remote && (distance > 28 || voices.size >= 5)) return;
    if (voices.size >= 8 && !["bite", "line-break"].includes(name)) return;
    if (name === "reel" && !remote) this.stopReel();
    const a =
      pool.get(name)?.find((a) => !voices.has(a)) ??
      (!remote && ["bite", "line-break"].includes(name)
        ? pool.get(name)?.[0]
        : undefined);
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    a.volume = Math.min(
      1,
      s.volume * 0.9 * (remote ? 0.45 / (1 + distance / 8) : 1),
    );
    voiceScale.set(a, 0.9 * (remote ? 0.45 / (1 + distance / 8) : 1));
    a.loop = name === "reel" && !remote;
    voices.add(a);
    if (a.loop) reel = a;
    const clear = () => {
      voices.delete(a);
      if (reel === a) reel = null;
    };
    a.addEventListener("ended", clear, { once: true });
    a.addEventListener("error", clear, { once: true });
    void a.play().catch(clear);
  },
};
