/* One serverless function for the whole API (keeps well inside Vercel's function limits). vercel.json rewrites every /api/* request to it.
 *
 *   public   GET  /api/catalog          products + prices + offer settings for the storefront
 *            POST /api/orders           place an order (prices and stock are checked here)
 *            POST /api/offer-claim      count a scratched welcome card
 *   admin    POST /api/admin/login | logout     GET /api/admin/session
 *            GET  /api/admin/overview            GET /api/admin/customers
 *            GET  /api/admin/orders              PATCH /api/admin/orders/:id
 *            GET/POST /api/admin/products        PUT/DELETE /api/admin/products/:id
 *            GET/PUT /api/admin/settings         GET/PUT /api/admin/content (CMS)
 *            POST /api/admin/stock               POST /api/admin/products/reorder
 *            GET  /api/admin/activity            GET /api/admin/backup
 *   public   GET  /api/coupon?code=&sub=         check a promo code
 */
import { db, persistent, storage } from './_lib/db.js';
import { checkPassword, sessionCookie, clearCookie, isAdmin, configured, usingDefaultPassword, throttled, noteFailure } from './_lib/auth.js';
import {
  publicCatalog, createOrder, allOrders, updateOrder, allProducts, createProduct, updateProduct, deleteProduct, reorderProducts, setStock,
  getSettings, saveSettings, overview, customersFrom, checkCoupon, activity, backup, logAct, CATEGORIES, STATUSES, SIZES,
} from './_lib/logic.js';
import { SCHEMA, GROUPS, getContent, saveContent } from './_lib/content.js';

const send = (res, status, body, headers = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 3_000_000) throw Object.assign(new Error('Body too large'), { status: 413 }); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    // vercel.json rewrites /api/* to this function with the original path in ?__p=
    const raw = url.searchParams.has('__p') ? url.searchParams.get('__p') : url.pathname.replace(/^\/api\/?/, '');
    url.searchParams.delete('__p');
    const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    const method = req.method;
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

    /* ---------------- public ---------------- */
    if (parts[0] === 'catalog' && method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=60');
      return send(res, 200, await publicCatalog(), { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' });
    }
    if (parts[0] === 'orders' && method === 'POST') {
      const body = await readJson(req);
      const r = await createOrder(body);
      if (r.error) return send(res, r.status, { error: r.error });
      return send(res, 201, { ok: true, id: r.order.id, total: r.order.total });
    }
    if (parts[0] === 'coupon' && method === 'GET') {
      const r = await checkCoupon(url.searchParams.get('code'), url.searchParams.get('sub'));
      return send(res, 200, r);
    }
    if (parts[0] === 'offer-claim' && method === 'POST') {
      await db.hincr('levit:stats', 'offerClaimed', 1);
      return send(res, 200, { ok: true });
    }

    /* ---------------- admin ---------------- */
    if (parts[0] !== 'admin') return send(res, 404, { error: 'Not found' });
    const route = parts[1];

    if (route === 'login' && method === 'POST') {
      if (!configured) return send(res, 503, { error: 'Admin is locked: set the ADMIN_PASSWORD environment variable in Vercel and redeploy.' });
      if (throttled(ip)) return send(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
      const { password } = await readJson(req);
      await new Promise((r) => setTimeout(r, 350));
      if (!checkPassword(password)) { noteFailure(ip); return send(res, 401, { error: 'Wrong password' }); }
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie() });
    }
    if (route === 'logout' && method === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
    if (route === 'session' && method === 'GET') {
      return send(res, 200, { authed: isAdmin(req), configured, persistent, storage, defaultPassword: usingDefaultPassword });
    }

    if (!isAdmin(req)) return send(res, 401, { error: 'Sign in required' });
    if (method !== 'GET' && !String(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, { error: 'JSON only' });

    if (route === 'pulse' && method === 'GET') {            // light poll for new-order alerts
      const o = await allOrders();
      return send(res, 200, { new: o.filter((x) => x.status === 'new').length, total: o.length, latest: o[0] ? { id: o[0].id, name: o[0].customer.name, total: o[0].total, at: o[0].createdAt } : null });
    }
    if (route === 'activity' && method === 'GET') return send(res, 200, { activity: await activity(60) });
    if (route === 'backup' && method === 'GET') return send(res, 200, await backup(), { 'Content-Disposition': `attachment; filename="levit-backup-${new Date().toISOString().slice(0, 10)}.json"` });
    if (route === 'content') {
      if (method === 'GET') return send(res, 200, { schema: SCHEMA, groups: GROUPS, values: await getContent() });
      if (method === 'PUT') { const values = await saveContent(await readJson(req)); await logAct('Edited site content'); return send(res, 200, { values }); }
    }
    if (route === 'stock' && method === 'POST') return send(res, 200, { updated: await setStock((await readJson(req)).updates) });
    if (route === 'overview' && method === 'GET') return send(res, 200, { ...(await overview(Number(url.searchParams.get('days')) || 14)), persistent });
    if (route === 'customers' && method === 'GET') return send(res, 200, { customers: customersFrom(await allOrders()) });

    if (route === 'orders') {
      if (method === 'GET') return send(res, 200, { orders: await allOrders(), statuses: STATUSES });
      if (method === 'PATCH' && parts[2]) {
        const r = await updateOrder(parts[2], await readJson(req));
        if (r.notFound) return send(res, 404, { error: 'Order not found' });
        if (r.error) return send(res, 422, { error: r.error });
        return send(res, 200, { order: r.order });
      }
    }

    if (route === 'products') {
      if (method === 'GET') return send(res, 200, { products: await allProducts(), categories: CATEGORIES, sizes: SIZES });
      if (method === 'POST' && parts[2] === 'reorder') { await reorderProducts((await readJson(req)).ids); return send(res, 200, { ok: true }); }
      if (method === 'POST') {
        const r = await createProduct(await readJson(req));
        if (r.errs) return send(res, 422, { error: r.errs.join('. ') });
        return send(res, 201, { product: r.product });
      }
      if (method === 'PUT' && parts[2]) {
        const r = await updateProduct(parts[2], await readJson(req));
        if (r.notFound) return send(res, 404, { error: 'Product not found' });
        if (r.errs) return send(res, 422, { error: r.errs.join('. ') });
        return send(res, 200, { product: r.product });
      }
      if (method === 'DELETE' && parts[2]) { await deleteProduct(parts[2]); return send(res, 200, { ok: true }); }
    }

    if (route === 'settings') {
      if (method === 'GET') return send(res, 200, { settings: await getSettings(), persistent });
      if (method === 'PUT') { const settings = await saveSettings(await readJson(req)); await logAct('Changed settings'); return send(res, 200, { settings }); }
    }

    return send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return send(res, err.status || 500, { error: err.status ? err.message : 'Something went wrong' });
  }
}
