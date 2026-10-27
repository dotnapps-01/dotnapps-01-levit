/* Admin sign-in: one password from the ADMIN_PASSWORD environment variable, a signed HttpOnly cookie.
 * On Vercel there is no default password, so the dashboard stays locked until ADMIN_PASSWORD is set.
 * Locally (no VERCEL variable) the password is "levit-admin" so the dashboard can be tried straight away. */
import crypto from 'node:crypto';

const DEV = !process.env.VERCEL;
const PASSWORD = process.env.ADMIN_PASSWORD || (DEV ? 'levit-admin' : '');
const SECRET = process.env.ADMIN_SECRET || `levit:${PASSWORD}`;
const COOKIE = 'levit_admin';
const DAYS = 7;

export const configured = Boolean(PASSWORD);
export const usingDefaultPassword = DEV && !process.env.ADMIN_PASSWORD;

const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const same = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };

export const checkPassword = (p) => configured && same(p || '', PASSWORD);

export function sessionCookie() {
  const exp = String(Date.now() + DAYS * 864e5);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DAYS * 86400}${DEV ? '' : '; Secure'}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${DEV ? '' : '; Secure'}`;

export function isAdmin(req) {
  if (!configured) return false;
  const m = /(?:^|;\s*)levit_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try { return same(sig, sign(exp)); } catch { return false; }
}

/* best-effort brute-force brake (per server instance) */
const tries = (globalThis.__levitTries ||= new Map());
export function throttled(ip) {
  const now = Date.now(), list = (tries.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  tries.set(ip, list);
  return list.length >= 8;
}
export const noteFailure = (ip) => { const l = tries.get(ip) || []; l.push(Date.now()); tries.set(ip, l); };
