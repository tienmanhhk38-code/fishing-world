import { describe, it, expect } from "vitest";
import {
  cleanChat,
  validName,
  APPEARANCES,
  EMOTES,
} from "../packages/shared/src/index";
describe("social text boundaries", () => {
  it("normalizes whitespace and removes invisible control characters", () => {
    expect(cleanChat("  Chào\n\tbiển\u202Exanh  ")).toBe("Chào biển xanh");
    expect(cleanChat("Ｎａｍ")).toBe("Nam");
    expect(cleanChat("😊 Cá đẹp!")).toBe("😊 Cá đẹp!");
  });
  it("keeps chat as text and validates display-name length", () => {
    expect(cleanChat("<img src=x onerror=alert(1)>")).toBe(
      "<img src=x onerror=alert(1)>",
    );
    expect(validName(" A ")).toBeNull();
    expect(validName("a".repeat(21))).toBeNull();
    expect(validName("  Nắng   Hè  ")).toBe("Nắng Hè");
    expect(Object.keys(APPEARANCES)).toHaveLength(4);
    expect(Object.keys(EMOTES)).toHaveLength(4);
  });
});
