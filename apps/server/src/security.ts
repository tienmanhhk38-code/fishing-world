import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import proxyaddr from "proxy-addr";
import type { Config } from "./config";
import { count } from "./telemetry";
export class RateGate {
  private entries = new Map<string, { until: number; count: number }>();
  constructor(
    private limit: number,
    private windowMs = 60000,
    private maximumKeys = 10000,
  ) {}
  allow(key: string, now = performance.now()) {
    let value = this.entries.get(key);
    if (!value || value.until <= now) {
      if (this.entries.size >= this.maximumKeys)
        for (const [id, item] of this.entries) {
          if (item.until <= now) this.entries.delete(id);
        }
      if (!this.entries.has(key) && this.entries.size >= this.maximumKeys)
        return false;
      value = { until: now + this.windowMs, count: 0 };
      this.entries.set(key, value);
    }
    return ++value.count <= this.limit;
  }
  delete(key: string) {
    this.entries.delete(key);
  }
}
export function permittedOrigin(
  origin: string | undefined,
  config: Config,
  required = false,
) {
  if (!origin) return !required;
  try {
    const url = new URL(origin);
    return origin === url.origin && config.origins.has(url.origin);
  } catch {
    return false;
  }
}
export function clientIp(req: IncomingMessage, config: Config) {
  const trusted =
    typeof config.trustProxy === "number"
      ? (_address: string, hop: number) => hop < (config.trustProxy as number)
      : config.trustProxy
        ? proxyaddr.compile(
            config.trustProxy.split(",").map((value) => value.trim()),
          )
        : () => false;
  return proxyaddr(req, trusted);
}
export function secureHeaders(res: ServerResponse, config: Config) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (config.production) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' blob: ${[...config.origins].map((origin) => origin.replace(/^https:/, "wss:")).join(" ")}; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests`,
    );
  }
}
export function jsonError(res: ServerResponse, status: number, error: string) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ error }));
}
export function bearerMatches(header: string | undefined, token: string) {
  if (!token || !header?.startsWith("Bearer ")) return false;
  const input = Buffer.from(header.slice(7)),
    expected = Buffer.from(token);
  return input.length === expected.length && timingSafeEqual(input, expected);
}
export function readBody(req: IncomingMessage, limit = 4096): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0,
      ended = false;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      if (ended) return;
      size += chunk.length;
      if (size > limit) {
        ended = true;
        reject(new Error("BODY_TOO_LARGE"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!ended) {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch {
          reject(new Error("INVALID_JSON"));
        }
      }
    });
    req.on("error", reject);
    req.on("aborted", () => reject(new Error("ABORTED")));
  });
}
export function rejected(kind: string) {
  count(`rejected_${kind}`);
}
