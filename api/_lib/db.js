/* Storage for the admin dashboard.
 *
 * Production: any Redis with an HTTP (REST) API: Upstash Redis from the Vercel Marketplace sets
 *   KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
 * Without those the data lives in memory (and in .data/db.json when running locally), which is fine for trying
 * the dashboard but is NOT persistent on Vercel. `persistent` tells the admin UI which one it is.
 */
import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const persistent = Boolean(URL_ && TOKEN);

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
    if (persistent) { const v = await redis(['GET', key]); return v == null ? null : parse(v); }
    return mem.kv[key] ?? null;
  },
  async set(key, value) {
    if (persistent) { await redis(['SET', key, JSON.stringify(value)]); return; }
    mem.kv[key] = value; flush();
  },
  /** hash helpers: every value is stored as JSON */
  async hgetall(key) {
    if (persistent) {
      const flat = (await redis(['HGETALL', key])) || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = parse(flat[i + 1]);
      return out;
    }
    return { ...(mem.h[key] || {}) };
  },
  async hget(key, field) {
    if (persistent) { const v = await redis(['HGET', key, field]); return v == null ? null : parse(v); }
    return mem.h[key]?.[field] ?? null;
  },
  async hset(key, field, value) {
    if (persistent) { await redis(['HSET', key, field, JSON.stringify(value)]); return; }
    (mem.h[key] ||= {})[field] = value; flush();
  },
  async hdel(key, field) {
    if (persistent) { await redis(['HDEL', key, field]); return; }
    if (mem.h[key]) delete mem.h[key][field]; flush();
  },
  async hincr(key, field, n = 1) {
    if (persistent) { return Number(await redis(['HINCRBY', key, field, n])); }
    const h = (mem.h[key] ||= {}); h[field] = (Number(h[field]) || 0) + n; flush(); return h[field];
  },
};
