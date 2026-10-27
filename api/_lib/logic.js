/* Catalogue, orders and statistics. Prices and totals are always recomputed here, never trusted from the browser. */
import { readFileSync } from 'node:fs';
import { db } from './db.js';

const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
export const STATUSES = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];
export const CATEGORIES = seed.categories;

const DEFAULT_SETTINGS = {
  storeName: 'LEVIT',
  freeShip: 1999, shipFee: 99, codFee: 49,
  offer: { code: 'LEVIT10', pct: 10, active: true, delay: 9 },
};
export async function getSettings() {
  const s = (await db.get('levit:settings')) || {};
  return { ...DEFAULT_SETTINGS, ...s, offer: { ...DEFAULT_SETTINGS.offer, ...(s.offer || {}) } };
}
export async function saveSettings(input) {
  const cur = await getSettings();
  const n = (v, d, lo = 0, hi = 1e6) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const o = input.offer || {};
  const next = {
    ...cur,
    storeName: String(input.storeName ?? cur.storeName).slice(0, 40) || 'LEVIT',
    freeShip: n(input.freeShip, cur.freeShip), shipFee: n(input.shipFee, cur.shipFee), codFee: n(input.codFee, cur.codFee),
    offer: {
      code: String(o.code ?? cur.offer.code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || cur.offer.code,
      pct: n(o.pct, cur.offer.pct, 1, 90), active: o.active === undefined ? cur.offer.active : Boolean(o.active), delay: n(o.delay, cur.offer.delay, 0, 120),
    },
  };
  await db.set('levit:settings', next);
  return next;
}

/* ---------- products ---------- */
export async function allProducts() {
  let h = await db.hgetall('levit:products');
  if (!Object.keys(h).length) {
    for (const p of seed.products) await db.hset('levit:products', p.id, p);
    h = Object.fromEntries(seed.products.map((p) => [p.id, p]));
  }
  return Object.values(h).sort((a, b) => (a.i ?? 0) - (b.i ?? 0));
}

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const money = (v) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 ? x : null; };

export function cleanProduct(input, prev = {}) {
  const errs = [];
  const name = String(input.name ?? prev.name ?? '').trim().slice(0, 80);
  if (!name) errs.push('Name is required');
  const price = money(input.price ?? prev.price);
  if (price === null || price < 1) errs.push('Price must be a number above 0');
  const was = input.was === '' || input.was == null ? null : money(input.was);
  if (was !== null && price !== null && was <= price) errs.push('Compare-at price must be higher than the price');
  const cat = CATEGORIES.some((c) => c.id === input.cat) ? input.cat : prev.cat;
  if (!cat) errs.push('Pick a category');
  const photo = String(input.photo ?? prev.photo ?? '');
  if (!photo || !(photo.startsWith('img/') || photo.startsWith('data:image/'))) errs.push('Add a photo');
  if (photo.length > 400000) errs.push('Photo is too large');
  const stock = Object.fromEntries(SIZES.map((s) => [s, Math.max(0, Math.min(9999, Math.round(Number((input.stock || prev.stock || {})[s]) || 0)))]));
  const colors = (Array.isArray(input.colors) ? input.colors : prev.colors || [{ name: 'Default', hex: '#cdb494' }])
    .map((c) => ({ name: String(c.name || '').slice(0, 24), hex: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#cdb494' })).filter((c) => c.name).slice(0, 8);
  if (!colors.length) colors.push({ name: 'Default', hex: '#cdb494' });
  const out = {
    ...prev, name, price, was, cat, photo, stock, colors,
    tag: ['New', 'Bestseller'].includes(input.tag) ? input.tag : input.tag === '' || input.tag === null ? null : prev.tag ?? null,
    blurb: String(input.blurb ?? prev.blurb ?? '').slice(0, 600),
    details: (Array.isArray(input.details) ? input.details : prev.details || []).map((d) => String(d).trim().slice(0, 120)).filter(Boolean).slice(0, 8),
    bg: /^#[0-9a-f]{6}$/i.test(input.bg) ? input.bg : prev.bg || '#F1D2B6',
    kind: prev.kind || 'tee',
    active: input.active === undefined ? prev.active ?? true : Boolean(input.active),
  };
  return { errs, product: out };
}

export async function createProduct(input) {
  const list = await allProducts();
  const { errs, product } = cleanProduct(input);
  if (errs.length) return { errs };
  let id = slug(product.name) || 'piece', n = 2;
  while (list.some((p) => p.id === id)) id = `${slug(product.name)}-${n++}`;
  product.id = id; product.i = (list.at(-1)?.i ?? -1) + 1;
  await db.hset('levit:products', id, product);
  return { product };
}
export async function updateProduct(id, input) {
  const prev = await db.hget('levit:products', id);
  if (!prev) return { notFound: true };
  const { errs, product } = cleanProduct(input, prev);
  if (errs.length) return { errs };
  product.id = id;
  await db.hset('levit:products', id, product);
  return { product };
}
export async function deleteProduct(id) { await db.hdel('levit:products', id); }

export async function publicCatalog() {
  const [products, settings] = await Promise.all([allProducts(), getSettings()]);
  return {
    products: products.filter((p) => p.active !== false),
    categories: CATEGORIES,
    settings: { freeShip: settings.freeShip, shipFee: settings.shipFee, codFee: settings.codFee, offer: settings.offer },
  };
}

/* ---------- orders ---------- */
const RX = { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, phone: /^[0-9+\- ]{10,15}$/, pin: /^[1-9][0-9]{5}$/ };

export async function createOrder(body) {
  const e = [];
  const c = body.customer || {}, a = body.address || {};
  const name = String(c.name || '').trim().slice(0, 80), email = String(c.email || '').trim().slice(0, 120), phone = String(c.phone || '').trim();
  const address = String(a.address || '').trim().slice(0, 200), city = String(a.city || '').trim().slice(0, 60), pin = String(a.pin || '').trim();
  if (!name) e.push('name'); if (!RX.email.test(email)) e.push('email'); if (!RX.phone.test(phone)) e.push('phone');
  if (!address) e.push('address'); if (!city) e.push('city'); if (!RX.pin.test(pin)) e.push('pin');
  const pay = ['upi', 'card', 'cod'].includes(body.pay) ? body.pay : 'upi';
  const reqLines = Array.isArray(body.lines) ? body.lines.slice(0, 30) : [];
  if (!reqLines.length) e.push('lines');
  if (e.length) return { status: 422, error: 'Please check: ' + e.join(', ') };

  const [products, settings] = await Promise.all([allProducts(), getSettings()]);
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const want = new Map();
  for (const l of reqLines) {
    const p = byId[l.id], qty = Math.round(Number(l.qty));
    if (!p || p.active === false) return { status: 409, error: 'One of the pieces is no longer available.' };
    if (!SIZES.includes(l.size) || !(qty >= 1 && qty <= 9)) return { status: 422, error: 'Invalid item in your bag.' };
    const k = `${p.id}|${l.size}`; want.set(k, { p, size: l.size, qty: (want.get(k)?.qty || 0) + qty });
  }
  const lines = [];
  for (const { p, size, qty } of want.values()) {
    if ((p.stock?.[size] ?? 0) < qty) return { status: 409, error: `${p.name} in size ${size} has only ${p.stock?.[size] ?? 0} left.` };
    lines.push({ id: p.id, name: p.name, photo: p.photo, size, qty, price: p.price });
  }
  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const code = String(body.offerCode || '').toUpperCase();
  const offerOn = settings.offer.active && code && code === settings.offer.code;
  const discount = offerOn ? Math.round((subtotal * settings.offer.pct) / 100) : 0;
  const shipping = subtotal >= settings.freeShip ? 0 : settings.shipFee;
  const cod = pay === 'cod' ? settings.codFee : 0;
  const total = subtotal - discount + shipping + cod;

  const existing = await db.hgetall('levit:orders');
  let id; do { id = 'LV-' + Math.floor(100000 + Math.random() * 900000); } while (existing[id]);
  const now = new Date().toISOString();
  const order = {
    id, createdAt: now, status: 'new', history: [{ status: 'new', at: now }], note: '',
    customer: { name, email, phone }, address: { address, city, pin }, pay, lines,
    subtotal, discount, offer: offerOn ? settings.offer.code : null, shipping, cod, total,
  };
  for (const { p, size, qty } of want.values()) { p.stock[size] -= qty; await db.hset('levit:products', p.id, p); }
  await db.hset('levit:orders', id, order);
  if (offerOn) await db.hincr('levit:stats', 'offerRedeemed', 1);
  return { order };
}

export async function allOrders() {
  return Object.values(await db.hgetall('levit:orders')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateOrder(id, input) {
  const o = await db.hget('levit:orders', id);
  if (!o) return { notFound: true };
  if (input.status && input.status !== o.status) {
    if (!STATUSES.includes(input.status)) return { error: 'Unknown status' };
    if (input.status === 'cancelled' && o.status !== 'cancelled') {              // put the stock back
      for (const l of o.lines) { const p = await db.hget('levit:products', l.id); if (p) { p.stock[l.size] = (p.stock[l.size] || 0) + l.qty; await db.hset('levit:products', p.id, p); } }
    }
    if (o.status === 'cancelled' && input.status !== 'cancelled') {              // re-opened: take it out again if there is stock
      for (const l of o.lines) { const p = await db.hget('levit:products', l.id); if (p) { p.stock[l.size] = Math.max(0, (p.stock[l.size] || 0) - l.qty); await db.hset('levit:products', p.id, p); } }
    }
    o.status = input.status; o.history.push({ status: input.status, at: new Date().toISOString() });
  }
  if (input.note !== undefined) o.note = String(input.note).slice(0, 500);
  await db.hset('levit:orders', id, o);
  return { order: o };
}

/* ---------- customers + statistics ---------- */
export function customersFrom(orders) {
  const map = new Map();
  for (const o of orders) {
    const key = (o.customer.email || o.customer.phone).toLowerCase();
    const c = map.get(key) || { key, name: o.customer.name, email: o.customer.email, phone: o.customer.phone, city: o.address.city, orders: 0, spent: 0, last: o.createdAt };
    c.orders += 1; if (o.status !== 'cancelled') c.spent += o.total;
    if (o.createdAt > c.last) { c.last = o.createdAt; c.name = o.customer.name; c.city = o.address.city; }
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}

export async function overview(days = 14) {
  const [orders, products, stats, settings] = await Promise.all([allOrders(), allProducts(), db.hgetall('levit:stats'), getSettings()]);
  const live = orders.filter((o) => o.status !== 'cancelled');
  const revenue = live.reduce((n, o) => n + o.total, 0);
  const byDay = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const series = Array.from({ length: days }, (_, k) => { const d = new Date(today); d.setDate(d.getDate() - (days - 1 - k)); const key = d.toISOString().slice(0, 10); byDay[key] = { date: key, revenue: 0, orders: 0 }; return byDay[key]; });
  for (const o of live) { const d = byDay[new Date(o.createdAt).toISOString().slice(0, 10)]; if (d) { d.revenue += o.total; d.orders += 1; } }
  const top = {};
  for (const o of live) for (const l of o.lines) { const t = (top[l.id] ||= { id: l.id, name: l.name, photo: l.photo, units: 0, revenue: 0 }); t.units += l.qty; t.revenue += l.qty * l.price; }
  const low = [];
  for (const p of products) for (const s of SIZES) { const q = p.stock?.[s] ?? 0; if (q <= 2 && p.active !== false) low.push({ id: p.id, name: p.name, size: s, qty: q }); }
  const counts = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
  return {
    revenue, orders: orders.length, liveOrders: live.length, aov: live.length ? Math.round(revenue / live.length) : 0,
    customers: customersFrom(orders).length, series, counts,
    topProducts: Object.values(top).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    lowStock: low.sort((a, b) => a.qty - b.qty).slice(0, 12),
    offer: { code: settings.offer.code, active: settings.offer.active, claimed: Number(stats.offerClaimed) || 0, redeemed: Number(stats.offerRedeemed) || 0 },
    products: { total: products.length, active: products.filter((p) => p.active !== false).length },
    recent: orders.slice(0, 6),
  };
}
