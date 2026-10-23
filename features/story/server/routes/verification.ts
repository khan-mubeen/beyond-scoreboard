import type { RequestHandler } from "express";
import { getVerification } from "../index";

/** GET /api/content/:id/verification -> 200 VerificationReport */
export const getVerificationReport: RequestHandler<{ id: string }> = async (req, res) => {
  const report = await getVerification(req.params.id);
  if (!report) {
    res.status(404).json({ error: "unknown content id" });
    return;
  }
  res.json(report);
};
