import "../lib/load-env.js";
import { createHash, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteScore, fetchAllScores, setScoreHidden } from "../lib/db.js";
import { methodNotAllowed, readJsonBody } from "../lib/http.js";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function authorize(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) {
    res.status(503).json({ error: "admin_disabled" });
    return false;
  }
  const header = req.headers.authorization ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!given || !timingSafeEqual(digest(given), digest(expected))) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!authorize(req, res)) return;

  try {
    if (req.method === "GET") {
      return res.status(200).json({ rows: await fetchAllScores() });
    }

    if (req.method === "POST") {
      const body = await readJsonBody<{ rid?: string; action?: string }>(req);
      const rid = body.rid?.trim();
      if (!rid) {
        return res.status(400).json({ error: "invalid_body" });
      }

      let found: boolean;
      if (body.action === "hide") found = await setScoreHidden(rid, true);
      else if (body.action === "unhide") found = await setScoreHidden(rid, false);
      else if (body.action === "delete") found = await deleteScore(rid);
      else return res.status(400).json({ error: "invalid_action" });

      return found
        ? res.status(200).json({ ok: true })
        : res.status(404).json({ error: "not_found" });
    }

    return methodNotAllowed(res, "GET, POST");
  } catch (err) {
    console.error(`${req.method} /api/admin`, err);
    return res.status(500).json({ error: "db_failed" });
  }
}
