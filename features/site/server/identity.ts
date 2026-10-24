// who is asking: an anonymous id in an httpOnly cookie, mapped to a users row.
// the row is created on first join (with a nickname); before that the visitor is a guest
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getDb, type DbUser } from "@/shared/db";

const COOKIE = "ks_anon";
const YEAR = 365 * 24 * 60 * 60 * 1000;

export interface Viewer {
  anonId: string;
  user: DbUser | null;
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** the visitor behind a request; sets the cookie on first visit */
export async function viewerOf(req: Request, res: Response): Promise<Viewer> {
  let anonId = readCookie(req, COOKIE);
  if (!anonId || !/^[0-9a-f-]{36}$/.test(anonId)) {
    anonId = randomUUID();
    res.cookie(COOKIE, anonId, { httpOnly: true, sameSite: "lax", maxAge: YEAR, secure: req.secure });
  }
  const user = await getDb().users.getByAnonId(anonId);
  return { anonId, user };
}

/** the viewer's user row, created now if needed. a nickname is set on first join */
export async function ensureUser(viewer: Viewer, nickname?: string): Promise<DbUser> {
  const db = getDb();
  if (viewer.user) {
    if (nickname && nickname !== viewer.user.nickname) {
      await db.users.setNickname(viewer.user.id, nickname);
      viewer.user = { ...viewer.user, nickname };
    }
    return viewer.user;
  }
  viewer.user = await db.users.create(viewer.anonId, nickname ?? null);
  return viewer.user;
}

export const displayName = (u: Pick<DbUser, "nickname"> | null | undefined) => u?.nickname?.trim() || "Fan";
