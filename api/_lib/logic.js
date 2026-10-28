/* Catalogue, orders, coupons and statistics. Prices and totals are always recomputed here, never trusted from the browser. */
import { db } from './db.js';
import seed from './seed.js';
import { getContent } from './content.js';

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
export const STATUSES = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];
export const CATEGORIES = seed.categories;

const DEFAULT_SETTINGS = {
  storeName: 'LEVIT',
  freeShip: 1999, shipFee: 99, codFee: 49, lowStock: 2,
  paused: false, pauseMessage: 'We are taking a short break from orders. Please check back soon.',
  offer: { code: 'LEVIT10', pct: 10, active: true, delay: 9 },
  coupons: [],
};
export async function getSettings() {
  const s = (await db.get('levit:settings')) || {};
  return { ...DEFAULT_SETTINGS, ...s, offer: { ...DEFAULT_SETTINGS.offer, ...(s.offer || {}) }, coupons: Array.isArray(s.coupons) ? s.coupons : [] };
}

const int = (v, d, lo = 0, hi = 1e7) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const codeOf = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

function cleanCoupons(list, welcome) {
  const seen = new Set([welcome]), out = [];
  for (const c of Array.isArray(list) ? list.slice(0, 40) : []) {
    const code = codeOf(c.code);
    if (code.length < 3 || seen.has(code)) continue;
    seen.add(code);
    const type = c.type === 'flat' ? 'flat' : 'pct';
    out.push({
      code, type, value: type === 'pct' ? int(c.value, 10, 1, 90) : int(c.value, 100, 1, 100000),
      min: int(c.min, 0), limit: int(c.limit, 0), active: c.active !== false,
      expires: /^\d{4}-\d{2}-\d{2}$/.test(c.expires || '') ? c.expires : '', note: String(c.note || '').slice(0, 60),
    });
  }
  return out;
}

export async function saveSettings(input) {
  const cur = await getSettings();
  const o = input.offer || {};
  const offer = {
    code: codeOf(o.code ?? cur.offer.code) || cur.offer.code,
    pct: int(o.pct, cur.offer.pct, 1, 90), active: o.active === undefined ? cur.offer.active : Boolean(o.active), delay: int(o.delay, cur.offer.delay, 0, 120),
  };
  const next = {
    ...cur,
    storeName: String(input.storeName ?? cur.storeName).slice(0, 40) || 'LEVIT',
    freeShip: int(input.freeShip, cur.freeShip), shipFee: int(input.shipFee, cur.shipFee), codFee: int(input.codFee, cur.codFee),
    lowStock: int(input.lowStock, cur.lowStock, 0, 50),
    paused: input.paused === undefined ? cur.paused : Boolean(input.paused),
    pauseMessage: String(input.pauseMessage ?? cur.pauseMessage).slice(0, 200) || DEFAULT_SETTINGS.pauseMessage,
    offer,
    coupons: cleanCoupons(input.coupons === undefined ? cur.coupons : input.coupons, offer.code),
  };
  await db.set('levit:settings', next);
  return next;
}

/* ---------- activity log ---------- */
export async function logAct(text) {
  const now = Date.now();
  await db.hset('levit:log', `${now}-${Math.floor(Math.random() * 1e4)}`, { at: new Date(now).toISOString(), text: String(text).slice(0, 160) });
  if (Math.random() < 0.04) {                                                  // keep the log short
    const all = Object.keys(await db.hgetall('levit:log')).sort();
    for (const k of all.slice(0, Math.max(0, all.length - 150))) await db.hdel('levit:log', k);
  }
}
export async function activity(limit = 40) {
  return Object.values(await db.hgetall('levit:log')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
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
  const was = input.was === '' || input.was == null ? (input.was === undefined ? prev.was ?? null : null) : money(input.was);
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
  await logAct(`Added product ${product.name}`);
  return { product };
}
export async function updateProduct(id, input) {
  const prev = await db.hget('levit:products', id);
  if (!prev) return { notFound: true };
  const { errs, product } = cleanProduct(input, prev);
  if (errs.length) return { errs };
  product.id = id;
  await db.hset('levit:products', id, product);
  await logAct(`Edited product ${product.name}`);
  return { product };
}
export async function deleteProduct(id) {
  const p = await db.hget('levit:products', id);
  await db.hdel('levit:products', id);
  if (p) await logAct(`Deleted product ${p.name}`);
}
export async function reorderProducts(ids) {
  const list = await allProducts(), order = new Map((Array.isArray(ids) ? ids : []).map((id, k) => [id, k]));
  let n = order.size;
  for (const p of list) { const i = order.has(p.id) ? order.get(p.id) : n++; if (p.i !== i) { p.i = i; await db.hset('levit:products', p.id, p); } }
}
/** updates: [{ id, stock: { S: 3, M: 0 } }] */
export async function setStock(updates) {
  let n = 0;
  for (const u of Array.isArray(updates) ? updates.slice(0, 200) : []) {
    const p = await db.hget('levit:products', u.id); if (!p) continue;
    for (const s of SIZES) if (u.stock && u.stock[s] !== undefined) p.stock[s] = Math.max(0, Math.min(9999, Math.round(Number(u.stock[s]) || 0)));
    await db.hset('levit:products', p.id, p); n++;
  }
  if (n) await logAct(`Updated stock for ${n} product${n === 1 ? '' : 's'}`);
  return n;
}

export async function publicCatalog() {
  const [products, settings, content] = await Promise.all([allProducts(), getSettings(), getContent()]);
  return {
    products: products.filter((p) => p.active !== false),
    categories: CATEGORIES,
    settings: { freeShip: settings.freeShip, shipFee: settings.shipFee, codFee: settings.codFee, offer: settings.offer, paused: settings.paused, pauseMessage: settings.pauseMessage },
    content,
  };
}

/* ---------- discounts ---------- */
/** The welcome offer or a coupon. Returns { ok, code, pct | flat, min, discount } or { ok: false, error }. */
export async function findDiscount(codeIn, subtotal, settings, stats) {
  const code = codeOf(codeIn);
  if (!code) return { ok: false, error: 'Enter a code' };
  if (code === settings.offer.code) {
    if (!settings.offer.active) return { ok: false, error: 'That offer has ended.' };
    return { ok: true, code, kind: 'welcome', pct: settings.offer.pct, min: 0, discount: Math.round((subtotal * settings.offer.pct) / 100) };
  }
  const c = settings.coupons.find((x) => x.code === code);
  if (!c || !c.active) return { ok: false, error: 'That code is not valid.' };
  if (c.expires && Date.now() > Date.parse(c.expires + 'T23:59:59')) return { ok: false, error: 'That code has expired.' };
  if (c.limit && (Number(stats['c:' + code]) || 0) >= c.limit) return { ok: false, error: 'That code has been fully used.' };
  if (subtotal < c.min) return { ok: false, error: `Spend ₹${c.min.toLocaleString('en-IN')} or more to use ${code}.`, min: c.min };
  const discount = c.type === 'pct' ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
  return { ok: true, code, kind: 'coupon', ...(c.type === 'pct' ? { pct: c.value } : { flat: c.value }), min: c.min, discount };
}
export async function checkCoupon(code, subtotal) {
  return findDiscount(code, Math.max(0, Number(subtotal) || 0), await getSettings(), await db.hgetall('levit:stats'));
}

/* ---------- orders ---------- */
const RX = { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, phone: /^[0-9+\- ]{10,15}$/, pin: /^[1-9][0-9]{5}$/ };

export async function createOrder(body) {
  const settings = await getSettings();
  if (settings.paused) return { status: 503, error: settings.pauseMessage };
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

  const [products, stats] = await Promise.all([allProducts(), db.hgetall('levit:stats')]);
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
  let discount = 0, offerCode = null, kind = null;
  if (body.offerCode) {
    const d = await findDiscount(body.offerCode, subtotal, settings, stats);
    if (!d.ok) return { status: 409, error: d.error };
    discount = d.discount; offerCode = d.code; kind = d.kind;
  }
  const shipping = subtotal >= settings.freeShip ? 0 : settings.shipFee;
  const cod = pay === 'cod' ? settings.codFee : 0;
  const total = subtotal - discount + shipping + cod;

  const existing = await db.hgetall('levit:orders');
  let id; do { id = 'LV-' + Math.floor(100000 + Math.random() * 900000); } while (existing[id]);
  const now = new Date().toISOString();
  const order = {
    id, createdAt: now, status: 'new', history: [{ status: 'new', at: now }], note: '', paid: false, tracking: { courier: '', number: '' },
    customer: { name, email, phone }, address: { address, city, pin }, pay, lines,
    subtotal, discount, offer: offerCode, shipping, cod, total,
  };
  for (const { p, size, qty } of want.values()) { p.stock[size] -= qty; await db.hset('levit:products', p.id, p); }
  await db.hset('levit:orders', id, order);
  if (kind === 'welcome') await db.hincr('levit:stats', 'offerRedeemed', 1);
  if (kind === 'coupon') await db.hincr('levit:stats', 'c:' + offerCode, 1);
  await logAct(`New order ${id} from ${name} (₹${total.toLocaleString('en-IN')})`);
  return { order };
}

export async function allOrders() {
  return Object.values(await db.hgetall('levit:orders')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateOrder(id, input) {
  const o = await db.hget('levit:orders', id);
  if (!o) return { notFound: true };
  const notes = [];
  if (input.status && input.status !== o.status) {
    if (!STATUSES.includes(input.status)) return { error: 'Unknown status' };
    if (input.status === 'cancelled' && o.status !== 'cancelled') {              // put the stock back
      for (const l of o.lines) { const p = await db.hget('levit:products', l.id); if (p) { p.stock[l.size] = (p.stock[l.size] || 0) + l.qty; await db.hset('levit:products', p.id, p); } }
    }
    if (o.status === 'cancelled' && input.status !== 'cancelled') {              // re-opened: take it out again if there is stock
      for (const l of o.lines) { const p = await db.hget('levit:products', l.id); if (p) { p.stock[l.size] = Math.max(0, (p.stock[l.size] || 0) - l.qty); await db.hset('levit:products', p.id, p); } }
    }
    o.status = input.status; o.history.push({ status: input.status, at: new Date().toISOString() });
    notes.push(`marked ${input.status}`);
  }
  if (input.note !== undefined) o.note = String(input.note).slice(0, 500);
  if (input.paid !== undefined && Boolean(input.paid) !== Boolean(o.paid)) { o.paid = Boolean(input.paid); notes.push(o.paid ? 'marked paid' : 'marked unpaid'); }
  if (input.tracking) {
    o.tracking = { courier: String(input.tracking.courier || '').slice(0, 40), number: String(input.tracking.number || '').slice(0, 60) };
    notes.push('tracking updated');
  }
  await db.hset('levit:orders', id, o);
  if (notes.length) await logAct(`Order ${id} ${notes.join(', ')}`);
  return { order: o };
}

/* ---------- customers + statistics ---------- */
export function customersFrom(orders) {
  const map = new Map();
  for (const o of orders) {
    const key = (o.customer.email || o.customer.phone).toLowerCase();
    const c = map.get(key) || { key, name: o.customer.name, email: o.customer.email, phone: o.customer.phone, city: o.address.city, orders: 0, spent: 0, last: o.createdAt, first: o.createdAt };
    c.orders += 1; if (o.status !== 'cancelled') c.spent += o.total;
    if (o.createdAt > c.last) { c.last = o.createdAt; c.name = o.customer.name; c.city = o.address.city; }
    if (o.createdAt < c.first) c.first = o.createdAt;
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}

export async function overview(days = 14) {
  days = [7, 14, 30, 90].includes(days) ? days : 14;
  const [orders, products, stats, settings] = await Promise.all([allOrders(), allProducts(), db.hgetall('levit:stats'), getSettings()]);
  const live = orders.filter((o) => o.status !== 'cancelled');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const since = new Date(today); since.setDate(since.getDate() - (days - 1));
  const prevSince = new Date(since); prevSince.setDate(prevSince.getDate() - days);
  const inWin = live.filter((o) => new Date(o.createdAt) >= since);
  const inPrev = live.filter((o) => { const d = new Date(o.createdAt); return d >= prevSince && d < since; });
  const sum = (l) => l.reduce((n, o) => n + o.total, 0);
  const revenue = sum(inWin);

  const byDay = {};
  const series = Array.from({ length: days }, (_, k) => { const d = new Date(today); d.setDate(d.getDate() - (days - 1 - k)); const key = d.toISOString().slice(0, 10); byDay[key] = { date: key, revenue: 0, orders: 0 }; return byDay[key]; });
  for (const o of inWin) { const d = byDay[new Date(o.createdAt).toISOString().slice(0, 10)]; if (d) { d.revenue += o.total; d.orders += 1; } }

  const catOf = Object.fromEntries(products.map((p) => [p.id, p.cat]));
  const top = {}, cats = {};
  for (const o of inWin) for (const l of o.lines) {
    const t = (top[l.id] ||= { id: l.id, name: l.name, photo: l.photo, units: 0, revenue: 0 }); t.units += l.qty; t.revenue += l.qty * l.price;
    const cid = catOf[l.id] || 'other'; const ct = (cats[cid] ||= { id: cid, name: CATEGORIES.find((c) => c.id === cid)?.name || 'Other', units: 0, revenue: 0 }); ct.units += l.qty; ct.revenue += l.qty * l.price;
  }
  const pay = { upi: { orders: 0, revenue: 0 }, card: { orders: 0, revenue: 0 }, cod: { orders: 0, revenue: 0 } };
  for (const o of inWin) { const p = pay[o.pay] || (pay[o.pay] = { orders: 0, revenue: 0 }); p.orders++; p.revenue += o.total; }

  const threshold = settings.lowStock;
  const low = []; let outOfStock = 0;
  for (const p of products) {
    if (p.active === false) continue;
    if (SIZES.every((s) => (p.stock?.[s] ?? 0) === 0)) outOfStock++;
    for (const s of SIZES) { const q = p.stock?.[s] ?? 0; if (q <= threshold) low.push({ id: p.id, name: p.name, size: s, qty: q }); }
  }
  const customers = customersFrom(orders);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
  return {
    days, revenue, orders: inWin.length, aov: inWin.length ? Math.round(revenue / inWin.length) : 0,
    prev: { revenue: sum(inPrev), orders: inPrev.length },
    newCustomers: customers.filter((c) => new Date(c.first) >= since).length, customers: customers.length,
    repeatCustomers: customers.filter((c) => c.orders > 1).length,
    allTime: { revenue: sum(live), orders: live.length },
    unpaid: live.filter((o) => !o.paid && o.status !== 'delivered').length,
    series, counts, pay, threshold,
    topProducts: Object.values(top).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    byCategory: Object.values(cats).sort((a, b) => b.revenue - a.revenue),
    topCustomers: customers.slice(0, 5),
    lowStock: low.sort((a, b) => a.qty - b.qty).slice(0, 15), outOfStock,
    offer: { code: settings.offer.code, active: settings.offer.active, claimed: Number(stats.offerClaimed) || 0, redeemed: Number(stats.offerRedeemed) || 0 },
    coupons: settings.coupons.map((c) => ({ code: c.code, used: Number(stats['c:' + c.code]) || 0 })),
    products: { total: products.length, active: products.filter((p) => p.active !== false).length },
    paused: settings.paused,
    recent: orders.slice(0, 6),
  };
}

export async function backup() {
  const [products, orders, settings, content] = await Promise.all([allProducts(), allOrders(), getSettings(), getContent()]);
  return { app: 'levit', exportedAt: new Date().toISOString(), settings, content, products, orders };
}
