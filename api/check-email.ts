import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkEmail } from "../lib/email.js";
import { methodNotAllowed } from "../lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, "GET");
  }

  const raw = req.query.e;
  const email = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : "";
  return res.status(200).json(await checkEmail(email));
}
