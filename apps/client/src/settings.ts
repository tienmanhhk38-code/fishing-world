import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  quality: "low" | "high";
  fps: 30 | 60;
  volume: number;
  ambienceVolume: number;
  musicVolume: number;
  soundMuted: boolean;
  sensitivity: number;
  invertY: boolean;
  reducedMotion: boolean;
  showOtherCatches: boolean;
}

export const defaults: Settings = {
  quality: "high",
  fps: 30,
  volume: 0.7,
  ambienceVolume: 0.45,
  musicVolume: 0.25,
  soundMuted: false,
  sensitivity: 1,
  invertY: false,
  showOtherCatches: true,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
};

function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export const useSettings = create<
  Settings & { update: (patch: Partial<Settings>) => void; reset: () => void }
>()(
  persist(
    (set) => ({
      ...defaults,
      update: (patch) => set(patch),
      reset: () => set(defaults),
    }),
    {
      name: "fishing-player-settings",
      version: 1,
      partialize: ({
        quality,
        fps,
        volume,
        ambienceVolume,
        musicVolume,
        soundMuted,
        sensitivity,
        invertY,
        reducedMotion,
        showOtherCatches,
      }) => ({
        quality,
        fps,
        volume,
        ambienceVolume,
        musicVolume,
        soundMuted,
        sensitivity,
        invertY,
        reducedMotion,
        showOtherCatches,
      }),
      merge: (stored, current) => {
        const value = (stored ?? {}) as Partial<Settings>;
        return {
          ...current,
          quality: value.quality === "low" ? "low" : defaults.quality,
          fps: value.fps === 60 ? 60 : 30,
          volume: bounded(value.volume, defaults.volume, 0, 1),
          ambienceVolume: bounded(
            value.ambienceVolume,
            defaults.ambienceVolume,
            0,
            1,
          ),
          musicVolume: bounded(value.musicVolume, defaults.musicVolume, 0, 1),
          soundMuted: value.soundMuted === true,
          sensitivity: bounded(value.sensitivity, defaults.sensitivity, 0.3, 2),
          invertY: value.invertY === true,
          showOtherCatches: value.showOtherCatches !== false,
          reducedMotion:
            typeof value.reducedMotion === "boolean"
              ? value.reducedMotion
              : defaults.reducedMotion,
        };
      },
    },
  ),
);
