import { describe, it, expect } from "vitest";
import {
  resolveViewport,
  type ViewportMeasurement,
} from "../apps/client/src/viewport";
const portrait: ViewportMeasurement = {
  width: 390,
  height: 844,
  visibleHeight: 844,
  editing: false,
  touch: true,
  scale: 1,
};
describe("keyboard viewport sizing", () => {
  it("preserves the canvas for visual-only and content-resizing keyboards, then restores", () => {
    const initial = resolveViewport(undefined, portrait);
    for (const height of [844, 460]) {
      const open = resolveViewport(initial, {
        ...portrait,
        height,
        visibleHeight: 460,
        editing: true,
      });
      expect(open).toMatchObject({
        height: 844,
        visibleHeight: 460,
        keyboard: true,
      });
      const closing = resolveViewport(open, {
        ...portrait,
        height,
        visibleHeight: 460,
        editing: false,
      });
      expect(closing.keyboard).toBe(true);
      expect(closing.height).toBe(844);
      expect(resolveViewport(closing, portrait)).toEqual(initial);
    }
  });
  it("uses the new orientation while the keyboard stays open", () => {
    const initial = resolveViewport(undefined, portrait),
      open = resolveViewport(initial, {
        ...portrait,
        editing: true,
        visibleHeight: 440,
      });
    const rotated = resolveViewport(open, {
      ...portrait,
      width: 844,
      height: 180,
      visibleHeight: 180,
      editing: true,
    });
    expect(rotated).toMatchObject({ width: 844, height: 390, keyboard: true });
    expect(
      resolveViewport(rotated, {
        ...portrait,
        width: 844,
        height: 390,
        visibleHeight: 390,
      }),
    ).toMatchObject({ height: 390, keyboard: false });
  });
  it("allows normal resizes, address-bar changes and desktop editing without locking", () => {
    const initial = resolveViewport(undefined, portrait);
    expect(
      resolveViewport(initial, {
        ...portrait,
        height: 800,
        visibleHeight: 800,
      }),
    ).toMatchObject({ height: 800, keyboard: false });
    expect(
      resolveViewport(initial, {
        ...portrait,
        height: 450,
        visibleHeight: 450,
        editing: false,
      }),
    ).toMatchObject({ height: 450, keyboard: false });
    expect(
      resolveViewport(initial, {
        ...portrait,
        height: 450,
        visibleHeight: 450,
        editing: true,
        touch: false,
      }),
    ).toMatchObject({ height: 450, keyboard: false });
    expect(
      resolveViewport(initial, {
        ...portrait,
        visibleHeight: 400,
        editing: true,
        scale: 2,
      }).keyboard,
    ).toBe(false);
  });
});
