import type { VercelRequest, VercelResponse } from "@vercel/node";
import { askClaudeJson } from "../lib/claude.js";
import { methodNotAllowed, readJsonBody } from "../lib/http.js";
import { agentPrompt } from "../lib/prompts.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, "POST");
  }

  try {
    const body = await readJsonBody<{
      skill?: string;
      prios?: string[];
      team?: string[];
    }>(req);

    if (!body.skill?.trim() || !body.prios?.length || !body.team?.length) {
      return res.status(400).json({ error: "invalid_body" });
    }

    const json = await askClaudeJson(
      agentPrompt({
        skill: body.skill,
        prios: body.prios,
        team: body.team,
      }),
    );

    return res.status(200).json(json);
  } catch (err) {
    console.error("POST /api/agent", err);
    return res.status(500).json({ error: "claude_failed" });
  }
}
