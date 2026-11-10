import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadFile(".env");
loadFile(".env.local");
loadFile(".env.development.local");
