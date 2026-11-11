import { useSettings } from "./settings";
import { ISLAND_OUTLINE } from "@fishing/shared";
import { mediaAudio } from "./media-audio";
export type Sound =
  | "cast"
  | "nibble"
  | "bite"
  | "hook"
  | "reel"
  | "catch"
  | "miss"
  | "click";
type Position = { x: number; y: number; z: number };
let context: AudioContext | null = null,
  effects: GainNode,
  ambience: GainNode,
  music: GainNode;
let focused = false,
  scene: "lobby" | "game" = "lobby",
  reel: AudioBufferSourceNode | null = null,
  shore: PannerNode | null = null;
let angler: Position = { x: 0, y: 1, z: 2 },
  float: Position = { x: 0, y: 0, z: -3 },
  lastShore = 0;
const buffers = new Map<string, Promise<AudioBuffer>>(),
  voices = new Set<AudioBufferSourceNode>();
const tracks = new Map<
  string,
  {
    element: HTMLAudioElement;
    gain: GainNode;
    stop?: ReturnType<typeof setTimeout>;
  }
>();
let reelGeneration = 0;
function load(name: string) {
  if (!buffers.has(name))
    buffers.set(
      name,
      fetch(`/assets/audio/${name}.wav`)
        .then((r) => {
          if (!r.ok) throw Error("Audio unavailable");
          return r.arrayBuffer();
        })
        .then((b) => context!.decodeAudioData(b)),
    );
  return buffers.get(name)!;
}
function sync() {
  if (!context) return;
  const s = useSettings.getState(),
    enabled = s.soundMuted ? 0 : 1,
    t = context.currentTime;
  effects.gain.setTargetAtTime(s.volume * enabled * 0.9, t, 0.04);
  ambience.gain.setTargetAtTime(
    s.ambienceVolume * enabled * 0.35 * (focused ? 0.7 : 1),
    t,
    0.15,
  );
  music.gain.setTargetAtTime(
    s.musicVolume * enabled * 0.48 * (focused ? 0.35 : 1),
    t,
    0.12,
  );
}
function track(name: string) {
  let current = tracks.get(name);
  if (current) return current;
  const element = new Audio(`/assets/audio/music/${name}-song.mp3`);
  element.loop = true;
  element.preload = "none";
  const gain = context!.createGain();
  gain.gain.value = 0;
  context!.createMediaElementSource(element).connect(gain).connect(music);
  current = { element, gain };
  tracks.set(name, current);
  return current;
}
function playMusic(restart: boolean) {
  if (!context || document.hidden) return;
  const name = scene === "game" ? "game" : "lobby",
    next = track(name);
  if (!restart && !next.element.paused) return;
  if (next.stop) clearTimeout(next.stop);
  if (restart) next.element.currentTime = 0;
  void next.element
    .play()
    .then(() => {
      if (!context || scene !== name) return;
      const t = context.currentTime;
      next.gain.gain.cancelScheduledValues(t);
      next.gain.gain.setValueAtTime(next.gain.gain.value, t);
      next.gain.gain.linearRampToValueAtTime(1, t + 1.2);
      for (const [key, old] of tracks)
        if (key !== name) {
          old.gain.gain.cancelScheduledValues(t);
          old.gain.gain.setValueAtTime(old.gain.gain.value, t);
          old.gain.gain.linearRampToValueAtTime(0, t + 1.2);
          old.stop = setTimeout(() => {
            old.element.pause();
            old.element.currentTime = 0;
          }, 1250);
        }
    })
    .catch(() => {});
}
export function setAudioScene(value: "lobby" | "game") {
  if (scene === value) return;
  scene = value;
  mediaAudio.scene(value);
  stopReelSound();
  if (context) playMusic(true);
}
function panner(p: Position, remote = false) {
  const node = context!.createPanner();
  node.panningModel = "HRTF";
  node.distanceModel = "inverse";
  node.refDistance = remote ? 4 : 12;
  node.maxDistance = remote ? 28 : 70;
  node.rolloffFactor = remote ? 1.6 : 1.1;
  if (node.positionX) {
    node.positionX.value = p.x;
    node.positionY.value = p.y;
    node.positionZ.value = p.z;
  } else node.setPosition(p.x, p.y, p.z);
  return node;
}
export function enableAudio() {
  if (typeof AudioContext === "undefined") {
    mediaAudio.enable();
    return;
  }
  if (!context) {
    try {
      context = new AudioContext();
      effects = context.createGain();
      ambience = context.createGain();
      music = context.createGain();
      for (const bus of [effects, ambience, music])
        bus.connect(context.destination);
      sync();
      void load("tropical-shore")
        .then((buffer) => {
          if (!context) return;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          shore = panner({ x: 0, y: 0, z: -10 });
          source.connect(shore).connect(ambience);
          source.start();
        })
        .catch(() => {});
      for (const name of [
        "cast",
        "nibble",
        "bite",
        "hook",
        "reel",
        "catch",
        "miss",
        "click",
      ])
        void load(name).catch(() => {});
      useSettings.subscribe(sync);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          for (const t of tracks.values()) t.element.pause();
          void context?.suspend();
        } else {
          void context?.resume();
          playMusic(false);
        }
      });
    } catch {
      return;
    }
  }
  if (!document.hidden) {
    void context.resume().catch(() => {});
    playMusic(false);
  }
}
export function focusAudio(value: boolean) {
  focused = value;
  mediaAudio.focus(value);
  sync();
}
export function stopReelSound() {
  mediaAudio.stopReel();
  reelGeneration++;
  if (reel) {
    try {
      reel.stop();
    } catch {}
    reel.disconnect();
    voices.delete(reel);
    reel = null;
  }
}
export function updateAudioPose(
  listener: Position,
  forward: Position,
  player?: Position,
  bobber?: Position,
) {
  if (player) angler = player;
  if (bobber) float = bobber;
  if (!context) return;
  const l = context.listener,
    t = context.currentTime;
  if (l.positionX && l.forwardX)
    for (const [param, v] of [
      [l.positionX, listener.x],
      [l.positionY, listener.y],
      [l.positionZ, listener.z],
      [l.forwardX, forward.x],
      [l.forwardY, forward.y],
      [l.forwardZ, forward.z],
      [l.upX, 0],
      [l.upY, 1],
      [l.upZ, 0],
    ] as [AudioParam, number][])
      param.setTargetAtTime(v, t, 0.025);
  else {
    l.setPosition(listener.x, listener.y, listener.z);
    l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
  }
  if (shore && performance.now() - lastShore > 500 && player) {
    lastShore = performance.now();
    let nearest = ISLAND_OUTLINE[0],
      d = Infinity;
    for (const p of ISLAND_OUTLINE) {
      const distance = Math.hypot(p.x - player.x, p.z - player.z);
      if (distance < d) {
        d = distance;
        nearest = p;
      }
    }
    if (shore.positionX) {
      shore.positionX.setTargetAtTime(nearest.x, t, 0.4);
      shore.positionZ.setTargetAtTime(nearest.z, t, 0.4);
    } else shore.setPosition(nearest.x, 0, nearest.z);
  }
}
export function playSound(name: Sound, position?: Position, remote = false) {
  if (mediaAudio.enabled) {
    mediaAudio.sound(
      name,
      position ?? (["nibble", "bite", "miss"].includes(name) ? float : angler),
      remote,
      angler,
    );
    return;
  }
  if (
    !context ||
    context.state !== "running" ||
    useSettings.getState().soundMuted ||
    !useSettings.getState().volume
  )
    return;
  if (
    remote &&
    (!position ||
      Math.hypot(position.x - angler.x, position.z - angler.z) > 28 ||
      voices.size >= 5)
  )
    return;
  if (name === "reel" && !remote) stopReelSound();
  const generation = reelGeneration;
  const requested = performance.now();
  void load(name)
    .then((buffer) => {
      if (name === "reel" && !remote && generation !== reelGeneration) return;
      if (
        !context ||
        context.state !== "running" ||
        performance.now() - requested > (name === "bite" ? 200 : 600)
      )
        return;
      if (voices.size >= 8 && name !== "bite") return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = name === "reel" && !remote;
      const gain = context.createGain();
      gain.gain.value = remote ? 0.45 : name === "reel" ? 0.65 : 1;
      const pos =
        position ??
        (["nibble", "bite", "miss"].includes(name) ? float : angler);
      let spatial: PannerNode | undefined;
      if (name === "click") source.connect(gain).connect(effects);
      else {
        spatial = panner(pos, remote);
        source.connect(gain).connect(spatial).connect(effects);
      }
      voices.add(source);
      source.start();
      if (source.loop) reel = source;
      source.onended = () => {
        voices.delete(source);
        source.disconnect();
        gain.disconnect();
        spatial?.disconnect();
        if (reel === source) reel = null;
      };
    })
    .catch(() => {});
}
