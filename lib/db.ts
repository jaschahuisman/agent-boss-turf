import "./load-env.js";
import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ontbreekt");
  }
  if (!sql) {
    sql = neon(url);
  }
  return sql;
}

async function ensureSchema() {
  const q = getSql();
  await q`
    CREATE TABLE IF NOT EXISTS scores (
      id BIGSERIAL PRIMARY KEY,
      rid TEXT NOT NULL UNIQUE,
      speler TEXT NOT NULL,
      agent TEXT NOT NULL,
      kleur TEXT,
      email TEXT,
      score INTEGER NOT NULL,
      gasten INTEGER,
      tevredenheid INTEGER,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      email_opgegeven BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;
  await q`
    CREATE INDEX IF NOT EXISTS scores_score_desc_idx ON scores (score DESC)
  `;
  await q`
    ALTER TABLE scores ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE
  `;
}

export async function initDb() {
  if (!schemaReady) {
    schemaReady = ensureSchema();
  }
  await schemaReady;
}

export type ScoreRow = {
  rid: string;
  speler: string;
  agent: string;
  kleur?: string | null;
  email?: string | null;
  score: number;
  gasten?: number | null;
  tevredenheid?: number | null;
  ts?: string;
};

export async function insertScore(row: ScoreRow & { ts: string }) {
  await initDb();
  const q = getSql();
  const email = row.email?.trim() || null;

  await q`
    INSERT INTO scores (
      rid, speler, agent, kleur, email, score, gasten, tevredenheid, ts, email_opgegeven
    ) VALUES (
      ${row.rid},
      ${row.speler.slice(0, 80)},
      ${row.agent.slice(0, 80)},
      ${row.kleur?.slice(0, 32) ?? null},
      ${email ? email.slice(0, 80) : null},
      ${Math.round(row.score)},
      ${row.gasten != null ? Math.round(row.gasten) : null},
      ${row.tevredenheid != null ? Math.round(row.tevredenheid) : null},
      ${row.ts},
      ${!!email}
    )
    ON CONFLICT (rid) DO UPDATE SET
      speler = EXCLUDED.speler,
      agent = EXCLUDED.agent,
      kleur = EXCLUDED.kleur,
      email = EXCLUDED.email,
      score = EXCLUDED.score,
      gasten = EXCLUDED.gasten,
      tevredenheid = EXCLUDED.tevredenheid,
      ts = EXCLUDED.ts,
      email_opgegeven = EXCLUDED.email_opgegeven
  `;
}

export async function fetchScoreboard(limit: number) {
  await initDb();
  const q = getSql();
  const n = Math.min(Math.max(limit, 1), 50);

  const rows = await q`
    SELECT rid, speler, agent, kleur, score, gasten, tevredenheid, ts
    FROM scores
    WHERE NOT hidden
    ORDER BY score DESC, ts ASC
    LIMIT ${n}
  `;

  return rows as Array<{
    rid: string;
    speler: string;
    agent: string;
    kleur: string | null;
    score: number;
    gasten: number | null;
    tevredenheid: number | null;
    ts: string;
  }>;
}

export async function fetchAllScores() {
  await initDb();
  const q = getSql();

  const rows = await q`
    SELECT rid, speler, agent, kleur, email, score, gasten, tevredenheid, ts, hidden
    FROM scores
    ORDER BY score DESC, ts ASC
    LIMIT 500
  `;

  return rows as Array<{
    rid: string;
    speler: string;
    agent: string;
    kleur: string | null;
    email: string | null;
    score: number;
    gasten: number | null;
    tevredenheid: number | null;
    ts: string;
    hidden: boolean;
  }>;
}

export async function setScoreHidden(rid: string, hidden: boolean) {
  await initDb();
  const q = getSql();
  const rows = await q`
    UPDATE scores SET hidden = ${hidden} WHERE rid = ${rid} RETURNING rid
  `;
  return (rows as unknown[]).length > 0;
}

export async function deleteScore(rid: string) {
  await initDb();
  const q = getSql();
  const rows = await q`
    DELETE FROM scores WHERE rid = ${rid} RETURNING rid
  `;
  return (rows as unknown[]).length > 0;
}
