import type { VercelRequest, VercelResponse } from "@vercel/node";
import { askClaudeJson } from "../lib/claude.js";
import { methodNotAllowed, readJsonBody } from "../lib/http.js";
import { hitlPrompt } from "../lib/prompts.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, "POST");
  }

  try {
    const body = await readJsonBody<{
      key?: string;
      answer?: string;
      team?: string[];
      prios?: string[];
      done?: string[];
    }>(req);

    if (
      !body.key ||
      body.answer == null ||
      !body.prios?.length ||
      !body.team?.length
    ) {
      return res.status(400).json({ error: "invalid_body" });
    }

    const json = await askClaudeJson(
      hitlPrompt({
        key: body.key,
        answer: String(body.answer),
        team: body.team,
        prios: body.prios,
        done: body.done ?? [],
      }),
    );

    return res.status(200).json(json);
  } catch (err) {
    console.error("POST /api/hitl", err);
    return res.status(500).json({ error: "claude_failed" });
  }
}
