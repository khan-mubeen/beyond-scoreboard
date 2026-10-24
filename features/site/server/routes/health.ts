// GET /healthz: the host's health check (render) and the tunnel script's "is the server up".
// 200 while the process serves; says whether this server runs the live engine
import type { RequestHandler } from "express";
import { leaderInfo } from "@/features/live/server";
import { getDb } from "@/shared/db";

export const healthz: RequestHandler = (_req, res) => {
  const { role, instance } = leaderInfo();
  res
    .set("cache-control", "no-store")
    .json({ ok: true, role, instance, db: getDb().mode, uptimeSec: Math.round(process.uptime()) });
};
