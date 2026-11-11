import { createHash } from "node:crypto";
import { db } from "./db";
export const validSession = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const sessionHash = (token: string) =>
  `sha256:${createHash("sha256").update(token).digest("hex")}`;
export async function sessionGuest(token: unknown) {
  if (!validSession(token)) return null;
  const hash = sessionHash(token);
  const guest = await db.guest.findFirst({
    where: { token: { in: [hash, token] } },
  });
  if (guest?.token === token)
    return db.guest.update({ where: { id: guest.id }, data: { token: hash } });
  return guest;
}
