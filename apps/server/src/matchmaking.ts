import { Server, matchMaker } from "@colyseus/core";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { Config } from "./config";
import {
  secureHeaders,
  permittedOrigin,
  RateGate,
  clientIp,
  readBody,
  jsonError,
  rejected,
} from "./security";
export type Ticket = {
  guestId: string;
  expires: number;
  reserved?: boolean;
  roomId?: string;
  sessionId?: string;
};
export function protectedServer(
  config: Config,
  tickets: Map<string, Ticket>,
  capacity: () => boolean,
) {
  const gate = new RateGate(120);
  return class ProtectedServer extends Server {
    protected async handleMatchMakeRequest(
      req: IncomingMessage,
      res: ServerResponse,
    ) {
      secureHeaders(res, config);
      res.setHeader("Cache-Control", "no-store");
      if (!permittedOrigin(req.headers.origin, config, config.production)) {
        rejected("origin");
        jsonError(res, 403, "Nguồn kết nối không hợp lệ.");
        return;
      }
      if (req.headers.origin) {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        );
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (!gate.allow(clientIp(req, config))) {
        rejected("matchmaking_rate");
        jsonError(res, 429, "Quá nhiều yêu cầu vào phòng.");
        return;
      }
      const path = req.url?.match(
        /^\/matchmake\/(create|joinOrCreate|joinById|reconnect)\/([a-zA-Z0-9_-]{1,64})$/,
      );
      if (!path || req.method !== "POST") {
        jsonError(res, 404, "Không tìm thấy thao tác.");
        return;
      }
      let ticket: Ticket | undefined;
      try {
        const body = await readBody(req),
          method = path[1],
          target = path[2];
        if (method === "reconnect") {
          if (
            !z
              .object({ reconnectionToken: z.string().min(1).max(128) })
              .strict()
              .safeParse(body).success
          )
            throw new Error("INVALID_OPTIONS");
        } else {
          const parsed = z
            .object({ ticket: z.string().regex(/^[a-f0-9]{64}$/) })
            .strict()
            .safeParse(body);
          if (!parsed.success) throw new Error("INVALID_OPTIONS");
          ticket = tickets.get(parsed.data.ticket);
          if (!ticket || ticket.expires < Date.now() || ticket.reserved) {
            jsonError(res, 401, "Phiên vào phòng đã hết hạn.");
            return;
          }
          if (
            (method === "create" || method === "joinOrCreate") &&
            (!capacity() || target !== "beach")
          ) {
            jsonError(res, 503, "Bến đang đầy. Hãy thử lại sau.");
            return;
          }
          ticket.reserved = true;
        }
        const response = await matchMaker.controller.invokeMethod(
          method,
          target,
          body,
          { headers: req.headers, ip: clientIp(req, config), req },
        );
        if (ticket) {
          ticket.roomId = response.room.roomId;
          ticket.sessionId = response.sessionId;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (error) {
        if (ticket) ticket.reserved = false;
        if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
          rejected("payload");
          jsonError(res, 413, "Yêu cầu quá lớn.");
        } else if (
          error instanceof Error &&
          ["INVALID_OPTIONS", "INVALID_JSON"].includes(error.message)
        )
          jsonError(res, 400, "Yêu cầu vào phòng không hợp lệ.");
        else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              code: (error as { code?: number }).code ?? 4216,
              error:
                error instanceof Error ? error.message : "Không thể vào phòng.",
            }),
          );
        }
      }
    }
  };
}
