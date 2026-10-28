/* Photos uploaded from the dashboard. They are stored in the database (not in the catalogue or content, which keeps
 * /api/catalog small) and served from /api/img/<id> with a long cache. Only JPG, PNG and WebP are accepted. */
import crypto from 'node:crypto';
import { db } from './db.js';

export async function saveImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'Use a JPG, PNG or WebP image.' };
  if (m[2].length > 900000) return { error: 'That image is too large. Try a smaller one.' };
  const id = crypto.randomBytes(6).toString('hex');
  await db.hset('levit:imgdata', id, { t: m[1], d: m[2] });
  await db.hset('levit:imgindex', id, { at: new Date().toISOString(), t: m[1], kb: Math.round((m[2].length * 0.75) / 1024) });
  return { id, url: `/api/img/${id}` };
}
export async function getImage(id) { return /^[a-f0-9]{12}$/.test(id) ? db.hget('levit:imgdata', id) : null; }
export async function listImages() {
  const h = await db.hgetall('levit:imgindex');
  return Object.entries(h).map(([id, v]) => ({ id, url: `/api/img/${id}`, ...v })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
}
