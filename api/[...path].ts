// Vercel's stateless HTTP bridge keeps the guest cookie on the frontend origin.
// Colyseus matchmaking and WebSocket traffic go directly to VITE_GAME_SERVER_URL.
const routes: Record<string, string[]> = {
  guest: ["GET"],
  profile: ["GET"],
  rooms: ["GET"],
  catalog: ["GET"],
  "sale-quote": ["POST"],
  economy: ["POST"],
  character: ["POST"],
  "quests/claim": ["POST"],
};
export async function proxy(
  request: Request,
  backend = process.env.GAME_SERVER_URL,
) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const fail = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers });
  const current = new URL(request.url),
    match = current.pathname.match(/^\/api\/(quests\/claim|[a-z-]+)$/);
  if (!match || !routes[match[1]]?.includes(request.method))
    return fail(404, "Không tìm thấy.");
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== current.origin
  )
    return fail(403, "Nguồn yêu cầu không hợp lệ.");
  let target: URL;
  try {
    target = new URL(backend ?? "");
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash
    )
      throw new Error();
  } catch {
    return fail(503, "Máy chủ game chưa được cấu hình.");
  }
  let body: string | undefined;
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length")) > 4096)
      return fail(413, "Yêu cầu quá lớn.");
    const reader = request.body?.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return fail(413, "Yêu cầu quá lớn.");
        }
        chunks.push(value);
      }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = new TextDecoder().decode(bytes);
  }
  target.pathname = current.pathname;
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        Origin: current.origin,
        "Content-Type": "application/json",
        ...(request.headers.get("cookie")
          ? { Cookie: request.headers.get("cookie")! }
          : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    for (const cookie of upstream.headers.getSetCookie())
      headers.append("Set-Cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return fail(503, "Chưa kết nối được máy chủ game. Hãy thử lại sau.");
  }
}
export const GET = (request: Request) => proxy(request);
export const POST = (request: Request) => proxy(request);
