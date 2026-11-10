import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchScoreboard } from "../lib/db.js";
import { methodNotAllowed } from "../lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, "GET");
  }

  try {
    const raw = req.query.n;
    const n =
      typeof raw === "string"
        ? parseInt(raw, 10)
        : Array.isArray(raw)
          ? parseInt(raw[0] ?? "10", 10)
          : 10;

    const rows = await fetchScoreboard(Number.isFinite(n) ? n : 10);
    return res.status(200).json({ rows });
  } catch (err) {
    console.error("GET /api/scoreboard", err);
    return res.status(500).json({ error: "db_failed" });
  }
}
