import { promises as dns } from "node:dns";

const EMAIL_RE =
  /^[^\s@]+@((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24})$/i;

export type EmailCheck =
  | { ok: true }
  | { ok: false; reason: "format" | "domain" };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("dns_timeout")), ms),
    ),
  ]);
}

async function domainAcceptsMail(domain: string): Promise<boolean | null> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 3000);
    if (mx.some((r) => r.exchange && r.exchange !== ".")) return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENODATA" && code !== "ENOTFOUND") return null;
  }
  try {
    const a = await withTimeout(dns.resolve(domain), 3000);
    return a.length > 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "ENODATA" || code === "ENOTFOUND" ? false : null;
  }
}

export async function checkEmail(raw: string): Promise<EmailCheck> {
  const email = raw.trim();
  const match = email.length <= 80 ? EMAIL_RE.exec(email) : null;
  if (!match) return { ok: false, reason: "format" };

  const accepts = await domainAcceptsMail(match[1].toLowerCase());
  return accepts === false ? { ok: false, reason: "domain" } : { ok: true };
}
