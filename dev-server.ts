import "./lib/load-env.js";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import agentHandler from "./api/agent.js";
import hitlHandler from "./api/hitl.js";
import scoreHandler from "./api/score.js";
import scoreboardHandler from "./api/scoreboard.js";
import adminHandler from "./api/admin.js";
import checkEmailHandler from "./api/check-email.js";

const PORT = Number(process.env.PORT) || 3000;

const routes: Record<string, (req: VercelRequest, res: VercelResponse) => unknown> = {
  "/api/agent": agentHandler,
  "/api/hitl": hitlHandler,
  "/api/score": scoreHandler,
  "/api/scoreboard": scoreboardHandler,
  "/api/admin": adminHandler,
  "/api/check-email": checkEmailHandler,
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const handler = routes[url.pathname];

  if (handler) {
    const vreq = req as unknown as VercelRequest;
    vreq.query = Object.fromEntries(url.searchParams);

    const vres = res as unknown as VercelResponse;
    vres.status = (code: number) => {
      res.statusCode = code;
      return vres;
    };
    vres.json = (body: unknown) => {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
      return vres;
    };

    await handler(vreq, vres);
    return;
  }

  try {
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const contents = readFileSync("." + path);
    res.setHeader("content-type", MIME[extname(path)] ?? "application/octet-stream");
    res.end(contents);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Agent Boss running at http://localhost:${PORT}`);
});
