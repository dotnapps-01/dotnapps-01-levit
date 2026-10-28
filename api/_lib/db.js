/* Storage for the admin dashboard. Pick any one of:
 *   - Neon Postgres (free): a Neon database connected in Vercel sets DATABASE_URL / POSTGRES_URL. It is used over
 *     Neon's HTTP SQL endpoint, so no driver package is needed. Two small tables are created on first use.
 *   - Upstash Redis (free): KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
 * Without those the data lives in memory (and in .data/db.json when running locally), which is fine for trying
 * the dashboard but is NOT persistent on Vercel. `persistent` tells the admin UI which one it is.
 */
import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PG = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || '';
const useRedis = Boolean(URL_ && TOKEN), usePg = !useRedis && /^postgres(ql)?:\/\//.test(PG);
export const persistent = useRedis || usePg;
export const storage = useRedis ? 'redis' : usePg ? 'postgres' : 'memory';

/* ---- Neon Postgres over HTTP ---- */
let ready;
async function sql(query, params = []) {
  const host = new URL(PG.replace(/^postgres(ql)?:/, 'http:')).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  const endpoint = local ? `http://${host}:${new URL(PG.replace(/^postgres(ql)?:/, 'http:')).port}/sql` : `https://${host}/sql`;
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': PG }, body: JSON.stringify({ query, params }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `Database error ${r.status}`);
  return j.rows || [];
}
const pg = async (query, params) => {
  ready ||= (async () => {
    await sql('CREATE TABLE IF NOT EXISTS levit_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    await sql('CREATE TABLE IF NOT EXISTS levit_h (k TEXT NOT NULL, f TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (k, f))');
  })().catch((e) => { ready = null; throw e; });
  await ready;
  return sql(query, params);
};

async function redis(args) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

/* ---- memory (+ local file) adapter ---- */
const FILE = path.join(process.cwd(), '.data', 'db.json');
const mem = (globalThis.__levitDb ||= (() => {
  const base = { kv: {}, h: {} };
  if (!process.env.VERCEL) { try { Object.assign(base, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch { /* first run */ } }
  return base;
})());
function flush() {
  if (process.env.VERCEL || persistent) return;
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(mem)); } catch { /* read-only disk */ }
}

const parse = (s) => { try { return JSON.parse(s); } catch { return s; } };

export const db = {
  async get(key) {
    if (usePg) { const r = await pg('SELECT v FROM levit_kv WHERE k = $1', [key]); return r[0] ? parse(r[0].v) : null; }
    if (persistent) { const v = await redis(['GET', key]); return v == null ? null : parse(v); }
    return mem.kv[key] ?? null;
  },
  async set(key, value) {
    if (usePg) { await pg('INSERT INTO levit_kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v', [key, JSON.stringify(value)]); return; }
    if (persistent) { await redis(['SET', key, JSON.stringify(value)]); return; }
    mem.kv[key] = value; flush();
  },
  /** hash helpers: every value is stored as JSON */
  async hgetall(key) {
    if (usePg) { const out = {}; for (const r of await pg('SELECT f, v FROM levit_h WHERE k = $1', [key])) out[r.f] = parse(r.v); return out; }
    if (persistent) {
      const flat = (await redis(['HGETALL', key])) || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = parse(flat[i + 1]);
      return out;
    }
    return { ...(mem.h[key] || {}) };
  },
  async hget(key, field) {
    if (usePg) { const r = await pg('SELECT v FROM levit_h WHERE k = $1 AND f = $2', [key, field]); return r[0] ? parse(r[0].v) : null; }
    if (persistent) { const v = await redis(['HGET', key, field]); return v == null ? null : parse(v); }
    return mem.h[key]?.[field] ?? null;
  },
  async hset(key, field, value) {
    if (usePg) { await pg('INSERT INTO levit_h (k, f, v) VALUES ($1, $2, $3) ON CONFLICT (k, f) DO UPDATE SET v = EXCLUDED.v', [key, field, JSON.stringify(value)]); return; }
    if (persistent) { await redis(['HSET', key, field, JSON.stringify(value)]); return; }
    (mem.h[key] ||= {})[field] = value; flush();
  },
  async hdel(key, field) {
    if (usePg) { await pg('DELETE FROM levit_h WHERE k = $1 AND f = $2', [key, field]); return; }
    if (persistent) { await redis(['HDEL', key, field]); return; }
    if (mem.h[key]) delete mem.h[key][field]; flush();
  },
  async hincr(key, field, n = 1) {
    if (usePg) {
      const r = await pg('INSERT INTO levit_h (k, f, v) VALUES ($1, $2, $3) ON CONFLICT (k, f) DO UPDATE SET v = CAST(CAST(levit_h.v AS BIGINT) + CAST(EXCLUDED.v AS BIGINT) AS TEXT) RETURNING v', [key, field, String(n)]);
      return Number(r[0]?.v);
    }
    if (persistent) { return Number(await redis(['HINCRBY', key, field, n])); }
    const h = (mem.h[key] ||= {}); h[field] = (Number(h[field]) || 0) + n; flush(); return h[field];
  },
};
