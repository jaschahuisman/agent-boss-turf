import type { VercelRequest, VercelResponse } from "@vercel/node";
import { insertScore } from "../lib/db.js";
import { methodNotAllowed, readJsonBody } from "../lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, "POST");
  }

  try {
    const body = await readJsonBody<{
      rid?: string;
      speler?: string;
      agent?: string;
      kleur?: string;
      email?: string;
      score?: number;
      gasten?: number;
      tevredenheid?: number;
      ts?: string;
    }>(req);

    if (
      !body.rid?.trim() ||
      !body.speler?.trim() ||
      !body.agent?.trim() ||
      typeof body.score !== "number"
    ) {
      return res.status(400).json({ error: "invalid_body" });
    }

    await insertScore({
      rid: body.rid.trim(),
      speler: body.speler.trim(),
      agent: body.agent.trim(),
      kleur: body.kleur,
      email: body.email,
      score: body.score,
      gasten: body.gasten,
      tevredenheid: body.tevredenheid,
      ts: body.ts ?? new Date().toISOString(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("POST /api/score", err);
    return res.status(500).json({ error: "db_failed" });
  }
}
