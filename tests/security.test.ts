import { describe, it, expect, vi, afterEach } from "vitest";
import {
  clientIp,
  RateGate,
  permittedOrigin,
  bearerMatches,
} from "../apps/server/src/security";
import { loadConfig } from "../apps/server/src/config";
import { proxy } from "../api/[...path]";
afterEach(() => vi.unstubAllGlobals());
describe("release security boundaries", () => {
  it("parses Render proxy hops and extracts the nearest forwarded client", () => {
    const config = loadConfig({ TRUST_PROXY: "1" });
    expect(config.trustProxy).toBe(1);
    expect(
      clientIp(
        {
          socket: { remoteAddress: "10.0.0.2" },
          headers: { "x-forwarded-for": "203.0.113.9" },
        } as any,
        config,
      ),
    ).toBe("203.0.113.9");
    expect(loadConfig({}).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: "uniquelocal" }).trustProxy).toBe(
      "uniquelocal",
    );
  });
  it("limits by key/window and rejects fresh keys when bounded storage is full", () => {
    const gate = new RateGate(2, 1000, 2);
    expect(gate.allow("a", 0)).toBe(true);
    expect(gate.allow("a", 1)).toBe(true);
    expect(gate.allow("a", 2)).toBe(false);
    expect(gate.allow("b", 2)).toBe(true);
    expect(gate.allow("c", 3)).toBe(false);
    expect(gate.allow("c", 1001)).toBe(true);
  });
  it("requires exact HTTPS production origins and secret-bearing metrics access", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow();
    const config = loadConfig({
      NODE_ENV: "production",
      APP_ORIGINS: "https://game.example",
      METRICS_TOKEN: "x".repeat(32),
    });
    expect(permittedOrigin("https://game.example", config, true)).toBe(true);
    for (const origin of [
      undefined,
      "null",
      "https://game.example.evil",
      "http://game.example",
      "https://game.example/path",
    ])
      expect(permittedOrigin(origin, config, true)).toBe(false);
    expect(bearerMatches("Bearer " + "x".repeat(32), "x".repeat(32))).toBe(
      true,
    );
    expect(bearerMatches("Bearer x", "x".repeat(32))).toBe(false);
  });
  it("Vercel proxy blocks unknown routes, missing backend and cross-origin mutations", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await proxy(
          new Request("https://front.example/api/internal"),
          "https://backend.example",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await proxy(
          new Request("https://front.example/api/guest"),
          "http://localhost:2567",
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await proxy(
          new Request("https://front.example/api/economy", {
            method: "POST",
            body: "{}",
            headers: { Origin: "https://evil.example" },
          }),
          "https://backend.example",
        )
      ).status,
    ).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("Vercel proxy preserves secure cookies and forwards only allowlisted HTTP routes", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        headers: {
          "Set-Cookie":
            "__Host-fishing_session=abc; Secure; HttpOnly; SameSite=Lax; Path=/",
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await proxy(
      new Request("https://front.example/api/guest", {
        headers: { Cookie: "old=value" },
      }),
      "https://backend.example",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()[0]).toContain("HttpOnly");
    expect(fetch.mock.calls[0][0].toString()).toBe(
      "https://backend.example/api/guest",
    );
    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      Origin: "https://front.example",
      Cookie: "old=value",
    });
  });
  it("Vercel proxy stops reading an oversized mutation before contacting the backend", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await proxy(
      new Request("https://front.example/api/economy", {
        method: "POST",
        headers: { Origin: "https://front.example" },
        body: "x".repeat(4097),
      }),
      "https://backend.example",
    );
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
});
