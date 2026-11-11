export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const port = Number(env.PORT ?? 2567);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT không hợp lệ.");
  const origins = (
    env.APP_ORIGINS ??
    (production
      ? ""
      : `http://127.0.0.1:${port},http://localhost:${port},http://127.0.0.1:5173,http://localhost:5173`)
  )
    .split(",")
    .filter(Boolean)
    .map((value) => new URL(value.trim()).origin);
  if (
    !origins.length ||
    (production && origins.some((origin) => !origin.startsWith("https://")))
  )
    throw new Error("Production cần APP_ORIGINS là URL HTTPS.");
  const metricsToken = env.METRICS_TOKEN ?? "";
  if (metricsToken && metricsToken.length < 32)
    throw new Error("METRICS_TOKEN cần ít nhất 32 ký tự.");
  return {
    production,
    port,
    origins: new Set(origins),
    host: env.HOST ?? "0.0.0.0",
    trustProxy: /^\d+$/.test(env.TRUST_PROXY ?? "")
      ? Number(env.TRUST_PROXY)
      : env.TRUST_PROXY || (false as const),
    metricsToken,
    maxRooms: Number(env.MAX_ROOMS ?? 20),
    cookieName: production ? "__Host-fishing_session" : "fishing_session",
  };
}
export type Config = ReturnType<typeof loadConfig>;
