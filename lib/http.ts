import type { VercelRequest, VercelResponse } from "@vercel/node";

export function methodNotAllowed(res: VercelResponse, allowed: string) {
  res.setHeader("Allow", allowed);
  return res.status(405).json({ error: "method_not_allowed" });
}

export async function readJsonBody<T>(req: VercelRequest): Promise<T> {
  if (req.body && typeof req.body === "object") {
    return req.body as T;
  }
  const raw = await new Promise<string>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}
