/* LEVIT admin dashboard. Plain ES module, talks to /api/admin/*. Hash routes: #/overview #/orders #/products #/customers #/settings */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const when = (iso, long) => new Date(iso).toLocaleString('en-IN', long ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const photo = (p) => (!p ? '' : p.startsWith('data:') || p.startsWith('http') ? p : '../' + p);
const STATUS = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const PAY = { upi: 'UPI', card: 'Card', cod: 'Cash on delivery' };
const STATUS_COLOR = { new: '#2c5a8a', packed: '#b7791f', shipped: '#6b3f9a', delivered: '#2f6b4b', cancelled: '#b3372c' };

const els = { auth: $('#auth'), shell: $('#shell'), view: $('#view'), title: $('#title'), actions: $('#actions'), banner: $('#banner'), panel: $('#panel'), scrim: $('#scrim'), toast: $('#toast') };
let session = null, route = 'overview', ordersCache = [], productsCache = null;
const ui = { orderTab: 'all', orderQ: '', prodQ: '', prodCat: 'all', custQ: '' };

/* ---------- api ---------- */
class ApiError extends Error { constructor(m, status) { super(m); this.status = status; } }
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api/admin/' + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && path !== 'login') { showAuth('Your session ended. Please sign in again.'); throw new ApiError('Signed out', 401); }
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong', res.status);
  return data;
}
let toastT;
function toast(msg, err) { const t = els.toast; t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), err ? 4500 : 2600); }
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { if (e.status !== 401) toast(e.message, true); } };

/* ---------- auth ---------- */
function showAuth(msg = '') {
  els.shell.hidden = true; els.auth.hidden = false; closePanel(true);
  $('#auth-err').textContent = msg;
  $('#auth-hint').textContent = session && !session.configured ? 'Admin is locked. Set the ADMIN_PASSWORD environment variable in Vercel, then redeploy.' : 'Sign in to manage orders, products and offers.';
  setTimeout(() => $('#pw').focus(), 50);
}
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = $('#login-btn'); btn.disabled = true; $('#auth-err').textContent = '';
  try { await api('login', { method: 'POST', body: { password: $('#pw').value } }); $('#pw').value = ''; await boot(); }
  catch (err) { $('#auth-err').textContent = err.message; }
  btn.disabled = false;
});
$('#logout').addEventListener('click', async () => { try { await api('logout', { method: 'POST', body: {} }); } catch { /* ignore */ } session = { ...session, authed: false }; showAuth(''); });

async function boot() {
  try { session = await (await fetch('/api/admin/session', { credentials: 'same-origin' })).json(); }
  catch { els.auth.hidden = false; $('#auth-err').textContent = 'Cannot reach the API. Run with "node dev-server.mjs" locally, or deploy to Vercel.'; return; }
  if (!session.authed) return showAuth('');
  els.auth.hidden = true; els.shell.hidden = false;
  const notes = [];
  if (!session.persistent) notes.push('<b>Storage is temporary.</b> Orders and edits reset when the server restarts. Add an Upstash Redis database in Vercel (Storage → Marketplace) and redeploy to keep your data.');
  if (session.defaultPassword) notes.push('<b>Using the default local password.</b> Set ADMIN_PASSWORD before going live.');
  els.banner.hidden = !notes.length; els.banner.innerHTML = notes.join('<br>');
  refreshBadge(); render();
}
async function refreshBadge() {
  try { const { counts } = await api('overview?days=7'); const n = counts.new || 0; const b = $('#nav-orders'); b.hidden = !n; b.textContent = n; } catch { /* ignore */ }
}

/* ---------- router ---------- */
const routes = { overview: viewOverview, orders: viewOrders, products: viewProducts, customers: viewCustomers, settings: viewSettings };
const titles = { overview: 'Overview', orders: 'Orders', products: 'Products', customers: 'Customers', settings: 'Offers & settings' };
function render() {
  route = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (!routes[route]) route = 'overview';
  document.body.classList.remove('nav-open');
  $$('#nav a').forEach((a) => { if (a.dataset.r === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  els.title.textContent = titles[route]; document.title = titles[route] + ' · LEVIT Admin';
  els.actions.innerHTML = ''; els.view.innerHTML = '<p class="empty">Loading…</p>';
  guard(routes[route])();
}
addEventListener('hashchange', () => { if (session?.authed) render(); });
$('#menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('#side') && !e.target.closest('#menu-btn')) document.body.classList.remove('nav-open'); });
const action = (html, fn) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = html; b.className = 'btn btn--sm'; b.addEventListener('click', fn); els.actions.append(b); return b; };

/* ---------- panel ---------- */
let lastFocus = null;
function openPanel(title, body, foot = '') {
  lastFocus = document.activeElement;
  $('#panel-title').textContent = title; $('#panel-body').innerHTML = body; $('#panel-foot').innerHTML = foot;
  els.scrim.hidden = false; requestAnimationFrame(() => { els.scrim.classList.add('on'); els.panel.classList.add('on'); });
  els.panel.setAttribute('aria-hidden', 'false'); $('#panel-body').scrollTop = 0; setTimeout(() => els.panel.focus(), 60);
}
function closePanel(instant) {
  els.panel.classList.remove('on'); els.scrim.classList.remove('on'); els.panel.setAttribute('aria-hidden', 'true');
  setTimeout(() => { els.scrim.hidden = true; }, instant ? 0 : 320); lastFocus?.focus?.();
}
$('#panel-x').addEventListener('click', () => closePanel());
els.scrim.addEventListener('click', () => closePanel());
addEventListener('keydown', (e) => { if (e.key === 'Escape' && els.panel.classList.contains('on')) closePanel(); });

/* ---------- overview ---------- */
async function viewOverview() {
  const d = await api('overview?days=14');
  const kpi = (l, v, s) => `<div class="card kpi"><small>${l}</small><b class="num">${v}</b><span>${s}</span></div>`;
  const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
  const stack = STATUS.map((s) => (d.counts[s] ? `<i style="width:${(d.counts[s] / total) * 100}%;background:${STATUS_COLOR[s]}"></i>` : '')).join('');
  const legend = STATUS.map((s) => `<span><i style="background:${STATUS_COLOR[s]}"></i>${s} <b class="num">${d.counts[s]}</b></span>`).join('');
  els.view.innerHTML = `
    <div class="grid g4">
      ${kpi('Revenue', inr(d.revenue), 'excluding cancelled')}
      ${kpi('Orders', d.liveOrders, d.counts.new ? `${d.counts.new} waiting to be packed` : 'all handled')}
      ${kpi('Average order', inr(d.aov), 'per order')}
      ${kpi('Customers', d.customers, `${d.products.active} of ${d.products.total} pieces live`)}
    </div>
    <div class="grid g21">
      <section class="card"><div class="card__h"><h2>Revenue, last 14 days</h2><small class="num">${inr(d.series.reduce((n, x) => n + x.revenue, 0))}</small></div><div class="card__b">${chart(d.series)}</div></section>
      <section class="card"><div class="card__h"><h2>Orders by status</h2></div><div class="card__b">${total ? `<div class="stack">${stack}</div><div class="legend">${legend}</div>` : '<p class="empty">No orders yet</p>'}
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)"><p class="lbl">Welcome offer <span class="code" style="margin-left:6px">${esc(d.offer.code)}</span></p><p class="hint" style="margin-top:8px">${d.offer.claimed} scratched · ${d.offer.redeemed} used at checkout${d.offer.active ? '' : ' · currently switched off'}</p></div>
      </div></section>
    </div>
    <div class="grid g2">
      <section class="card"><div class="card__h"><h2>Best sellers</h2></div><div class="card__b">${d.topProducts.length ? `<ul class="list">${d.topProducts.map((t) => `<li><img src="${esc(photo(t.photo))}" alt="" loading="lazy"><div class="grow"><b>${esc(t.name)}</b><small>${t.units} sold</small></div><b class="num">${inr(t.revenue)}</b></li>`).join('')}</ul>` : '<p class="empty">Sales will show here</p>'}</div></section>
      <section class="card"><div class="card__h"><h2>Low stock</h2><small>2 or fewer</small></div><div class="card__b">${d.lowStock.length ? `<ul class="list">${d.lowStock.map((x) => `<li><div class="grow"><b>${esc(x.name)}</b><small>Size ${x.size}</small></div><span class="pill ${x.qty ? 's-low' : 's-out'}">${x.qty ? x.qty + ' left' : 'sold out'}</span></li>`).join('')}</ul>` : '<p class="empty">Everything is well stocked</p>'}</div></section>
    </div>
    <section class="card"><div class="card__h"><h2>Recent orders</h2><a class="btn btn--sm" href="#/orders">View all</a></div>
      ${d.recent.length ? `<div class="table-wrap">${ordersTable(d.recent)}</div>` : '<p class="empty">Orders will appear here as they come in</p>'}</section>`;
  bindOrderRows(els.view, d.recent);
}

function chart(series) {
  const W = 700, H = 220, pl = 8, pr = 8, pt = 14, pb = 30;
  const max = Math.max(1, ...series.map((s) => s.revenue)), n = series.length, bw = (W - pl - pr) / n;
  const nice = Math.ceil(max / 1000) * 1000 || 1000;
  let g = '';
  for (let i = 0; i <= 3; i++) { const y = pt + ((H - pt - pb) * i) / 3; g += `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>`; }
  const bars = series.map((s, i) => {
    const h = Math.max(s.revenue ? 3 : 0, (s.revenue / nice) * (H - pt - pb)), x = pl + i * bw + bw * 0.18, w = bw * 0.64, y = H - pb - h;
    const dt = new Date(s.date + 'T00:00:00');
    const lab = i % 2 === n % 2 || n <= 7 ? `<text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${dt.getDate()} ${dt.toLocaleString('en', { month: 'short' })}</text>` : '';
    return `<rect class="col" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"><title>${dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${inr(s.revenue)} · ${s.orders} order${s.orders === 1 ? '' : 's'}</title></rect>${lab}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue per day">${g}${bars}</svg>`;
}

/* ---------- orders ---------- */
function ordersTable(list) {
  return `<table class="resp orders"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Items</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>${list.map((o) => `
    <tr data-open="${esc(o.id)}" tabindex="0"><td>${esc(o.id)}</td><td class="span">${esc(o.customer.name)}<span class="sub">${esc(o.address.city)} · ${PAY[o.pay] || o.pay}</span></td><td class="span">${when(o.createdAt)}</td>
    <td>${o.lines.reduce((n, l) => n + l.qty, 0)}</td><td><span class="pill s-${o.status}">${o.status}</span></td><td class="r num">${inr(o.total)}</td></tr>`).join('')}</tbody></table>`;
}
function bindOrderRows(root, list) {
  const open = (el) => { const o = list.find((x) => x.id === el.dataset.open); if (o) openOrder(o); };
  $$('[data-open]', root).forEach((tr) => { tr.addEventListener('click', () => open(tr)); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(tr); }); });
}

async function viewOrders() {
  const { orders } = await api('orders'); ordersCache = orders;
  action('Export CSV', exportCsv);
  els.view.innerHTML = `
    <div class="bar"><div class="tabs" id="otabs"></div><input type="search" id="oq" placeholder="Search name, order, phone, city" aria-label="Search orders" value="${esc(ui.orderQ)}"></div>
    <section class="card" id="olist"></section>`;
  const paint = () => {
    $('#otabs').innerHTML = ['all', ...STATUS].map((s) => `<button class="tab" type="button" aria-pressed="${ui.orderTab === s}" data-t="${s}">${s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}<small class="num">${s === 'all' ? ordersCache.length : ordersCache.filter((o) => o.status === s).length}</small></button>`).join('');
    const q = ui.orderQ.trim().toLowerCase();
    const list = ordersCache.filter((o) => (ui.orderTab === 'all' || o.status === ui.orderTab) && (!q || [o.id, o.customer.name, o.customer.phone, o.customer.email, o.address.city].join(' ').toLowerCase().includes(q)));
    $('#olist').innerHTML = list.length ? `<div class="table-wrap">${ordersTable(list)}</div>` : `<p class="empty">${ordersCache.length ? 'No orders match' : 'No orders yet. They will land here the moment a customer checks out.'}</p>`;
    bindOrderRows($('#olist'), list);
    $$('#otabs .tab').forEach((b) => b.addEventListener('click', () => { ui.orderTab = b.dataset.t; paint(); }));
  };
  $('#oq').addEventListener('input', (e) => { ui.orderQ = e.target.value; paint(); $('#oq').focus(); });
  paint();
  window.__repaintOrders = paint;
}

function exportCsv() {
  const rows = [['Order', 'Placed', 'Status', 'Name', 'Email', 'Phone', 'Address', 'City', 'PIN', 'Payment', 'Items', 'Subtotal', 'Discount', 'Shipping', 'COD fee', 'Total']];
  for (const o of ordersCache) rows.push([o.id, o.createdAt, o.status, o.customer.name, o.customer.email, o.customer.phone, o.address.address, o.address.city, o.address.pin, o.pay, o.lines.map((l) => `${l.name} (${l.size}) x${l.qty}`).join('; '), o.subtotal, o.discount, o.shipping, o.cod, o.total]);
  const csv = rows.map((r) => r.map((c) => { let s = String(c ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `levit-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function openOrder(o) {
  const body = `
    <div class="steps noprint">${STATUS.map((s) => `<button type="button" class="btn btn--sm ${o.status === s ? 'btn--ink' : s === 'cancelled' ? 'btn--danger' : ''}" data-set="${s}" ${o.status === s ? 'disabled' : ''}>${s === 'cancelled' ? 'Cancel order' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
    <section class="sec"><h3>Customer</h3><dl class="kv"><dt>Name</dt><dd>${esc(o.customer.name)}</dd><dt>Email</dt><dd><a href="mailto:${esc(o.customer.email)}" style="text-decoration:underline">${esc(o.customer.email)}</a></dd><dt>Phone</dt><dd><a href="tel:${esc(o.customer.phone)}" style="text-decoration:underline">${esc(o.customer.phone)}</a></dd></dl></section>
    <section class="sec"><h3>Ship to</h3><p>${esc(o.address.address)}<br>${esc(o.address.city)} ${esc(o.address.pin)}</p></section>
    <section class="sec"><h3>Items</h3><ul class="list">${o.lines.map((l) => `<li><img src="${esc(photo(l.photo))}" alt=""><div class="grow"><b>${esc(l.name)}</b><small>Size ${esc(l.size)} · Qty ${l.qty}</small></div><b class="num">${inr(l.price * l.qty)}</b></li>`).join('')}</ul>
      <div class="totals num"><div><span>Subtotal</span><span>${inr(o.subtotal)}</span></div>${o.discount ? `<div><span>Offer ${esc(o.offer)}</span><span>−${inr(o.discount)}</span></div>` : ''}<div><span>Shipping</span><span>${o.shipping ? inr(o.shipping) : 'Free'}</span></div>${o.cod ? `<div><span>Cash on delivery fee</span><span>${inr(o.cod)}</span></div>` : ''}<div class="grand"><span>Total · ${PAY[o.pay] || o.pay}</span><span>${inr(o.total)}</span></div></div></section>
    <section class="sec noprint"><h3>Internal note</h3><textarea id="onote" placeholder="Courier, tracking number, anything the team should know" maxlength="500">${esc(o.note)}</textarea><div><button class="btn btn--sm" id="osave" type="button">Save note</button></div></section>
    <section class="sec"><h3>History</h3><ul class="timeline">${o.history.map((h) => `<li><span class="pill s-${h.status}">${h.status}</span><small>${when(h.at, true)}</small></li>`).join('')}</ul></section>`;
  openPanel(`Order ${o.id}`, body, `<button class="btn btn--sm" id="oprint" type="button">Print slip</button>`);
  const patch = guard(async (data) => {
    const { order } = await api('orders/' + encodeURIComponent(o.id), { method: 'PATCH', body: data });
    const i = ordersCache.findIndex((x) => x.id === order.id); if (i > -1) ordersCache[i] = order;
    toast(data.status ? `Marked ${order.status}` : 'Note saved'); refreshBadge();
    if (data.status) { openOrder(order); if (route === 'orders') window.__repaintOrders?.(); else if (route === 'overview') render(); }
  });
  $$('[data-set]', els.panel).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.set === 'cancelled' && !confirm(`Cancel order ${o.id}? The items go back into stock.`)) return;
    patch({ status: b.dataset.set });
  }));
  $('#osave').addEventListener('click', () => patch({ note: $('#onote').value }));
  $('#oprint').addEventListener('click', () => print());
}

/* ---------- products ---------- */
async function viewProducts() {
  const data = await api('products'); productsCache = data;
  action('+ Add piece', () => openProduct());
  els.view.innerHTML = `<div class="bar"><div class="tabs" id="ptabs"></div><input type="search" id="pq" placeholder="Search pieces" aria-label="Search pieces" value="${esc(ui.prodQ)}"></div><section class="card" id="plist"></section>`;
  const paint = () => {
    const cats = [{ id: 'all', name: 'All' }, ...data.categories.filter((c) => c.id !== 'all')];
    $('#ptabs').innerHTML = cats.map((c) => `<button class="tab" type="button" aria-pressed="${ui.prodCat === c.id}" data-c="${c.id}">${esc(c.name)}</button>`).join('');
    const q = ui.prodQ.trim().toLowerCase();
    const list = data.products.filter((p) => (ui.prodCat === 'all' || p.cat === ui.prodCat) && (!q || p.name.toLowerCase().includes(q)));
    $('#plist').innerHTML = list.length ? `<div class="table-wrap"><table class="resp"><thead><tr><th>Piece</th><th>Category</th><th>Stock</th><th>Status</th><th class="r">Price</th></tr></thead><tbody>${list.map((p) => {
      const total = SIZES.reduce((n, s) => n + (p.stock?.[s] || 0), 0), low = SIZES.some((s) => (p.stock?.[s] || 0) <= 2);
      return `<tr data-open="${esc(p.id)}" tabindex="0"><td class="span"><div style="display:flex;gap:12px;align-items:center"><img class="thumb" src="${esc(photo(p.photo))}" alt="" loading="lazy"><div><b style="font-weight:500">${esc(p.name)}</b>${p.tag ? `<span class="sub">${esc(p.tag)}</span>` : ''}</div></div></td>
        <td>${esc(data.categories.find((c) => c.id === p.cat)?.name || p.cat)}</td><td><span class="num">${total}</span> ${total === 0 ? '<span class="pill s-out">sold out</span>' : low ? '<span class="pill s-low">low</span>' : ''}</td>
        <td><span class="pill ${p.active === false ? 's-draft' : 's-live'}">${p.active === false ? 'hidden' : 'live'}</span></td><td class="r num">${inr(p.price)}${p.was ? `<span class="sub" style="text-decoration:line-through">${inr(p.was)}</span>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="empty">No pieces match</p>';
    $$('#plist [data-open]').forEach((tr) => { const go = () => openProduct(data.products.find((p) => p.id === tr.dataset.open)); tr.addEventListener('click', go); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); });
    $$('#ptabs .tab').forEach((b) => b.addEventListener('click', () => { ui.prodCat = b.dataset.c; paint(); }));
  };
  $('#pq').addEventListener('input', (e) => { ui.prodQ = e.target.value; paint(); $('#pq').focus(); });
  paint();
  window.__repaintProducts = paint;
}

const colorRow = (c = { name: '', hex: '#cdb494' }) => `<div class="c"><input type="color" value="${esc(c.hex)}" aria-label="Colour"><input type="text" value="${esc(c.name)}" placeholder="Colour name" maxlength="24" aria-label="Colour name"><button type="button" class="x" data-rm aria-label="Remove colour">✕</button></div>`;

function openProduct(p) {
  const isNew = !p;
  p = p || { name: '', cat: productsCache.categories.find((c) => c.id !== 'all')?.id, price: '', was: '', tag: null, blurb: '', details: [], colors: [{ name: 'Sand', hex: '#d8c2aa' }], stock: Object.fromEntries(SIZES.map((s) => [s, 5])), photo: '', active: true };
  const photos = [...new Set(productsCache.products.map((x) => x.photo).filter((x) => x && !x.startsWith('data:')))];
  let chosen = p.photo || '';
  const catOpts = productsCache.categories.filter((c) => c.id !== 'all').map((c) => `<option value="${c.id}" ${p.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const body = `
    <form id="pform" class="panel__body" style="padding:0;overflow:visible" novalidate>
      <section class="sec"><h3>Photo</h3><div class="photo"><img id="pprev" src="${esc(photo(chosen))}" alt="" ${chosen ? '' : 'hidden'}><div style="display:grid;gap:10px;min-width:0">
        <label class="btn btn--sm" style="width:fit-content">Upload photo<input type="file" id="pfile" accept="image/*" hidden></label><p class="hint">Portrait photos work best. Large images are resized for you.</p>
        <div class="picker" id="ppick" role="group" aria-label="Pick an existing photo">${photos.map((ph) => `<button type="button" aria-pressed="${ph === chosen}" data-ph="${esc(ph)}"><img src="${esc(photo(ph))}" alt="" loading="lazy"></button>`).join('')}</div></div></div></section>
      <section class="sec"><h3>Details</h3>
        <label class="field"><span>Name</span><input name="name" value="${esc(p.name)}" maxlength="80" required></label>
        <div class="row2"><label class="field"><span>Category</span><select name="cat">${catOpts}</select></label><label class="field"><span>Label</span><select name="tag"><option value="">None</option><option ${p.tag === 'New' ? 'selected' : ''}>New</option><option ${p.tag === 'Bestseller' ? 'selected' : ''}>Bestseller</option></select></label></div>
        <div class="row2"><label class="field"><span>Price (₹)</span><input name="price" type="number" inputmode="numeric" min="1" value="${esc(p.price)}" required></label><label class="field"><span>Compare-at (₹)</span><input name="was" type="number" inputmode="numeric" min="1" value="${esc(p.was ?? '')}" placeholder="Optional"></label></div>
        <label class="field"><span>Description</span><textarea name="blurb" maxlength="600">${esc(p.blurb)}</textarea></label>
        <label class="field"><span>Details, one per line</span><textarea name="details" maxlength="800">${esc((p.details || []).join('\n'))}</textarea></label></section>
      <section class="sec"><h3>Stock by size</h3><div class="row5">${SIZES.map((s) => `<label class="field"><span>${s}</span><input name="stock-${s}" type="number" inputmode="numeric" min="0" max="9999" value="${p.stock?.[s] ?? 0}"></label>`).join('')}</div></section>
      <section class="sec"><h3>Colours</h3><div class="colors" id="pcolors">${(p.colors || []).map(colorRow).join('')}</div><div><button type="button" class="btn btn--sm" id="padd-color">+ Add colour</button></div></section>
      <section class="sec"><label class="switch"><input type="checkbox" name="active" ${p.active === false ? '' : 'checked'}><i></i><span>Visible in the store</span></label></section>
      <p class="auth__err" id="perr" role="alert"></p>
    </form>`;
  openPanel(isNew ? 'New piece' : p.name, body, `${isNew ? '' : '<button class="btn btn--danger" id="pdel" type="button" style="margin-right:auto">Delete</button>'}<button class="btn" id="pcancel" type="button">Cancel</button><button class="btn btn--ink" id="psave" type="button">${isNew ? 'Add piece' : 'Save changes'}</button>`);

  const setPhoto = (src) => { chosen = src; const im = $('#pprev'); im.src = photo(src); im.hidden = !src; $$('#ppick button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ph === src))); };
  $$('#ppick button').forEach((b) => b.addEventListener('click', () => setPhoto(b.dataset.ph)));
  $('#pfile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { setPhoto(await shrink(f)); } catch (err) { toast(err.message, true); } });
  $('#padd-color').addEventListener('click', () => { $('#pcolors').insertAdjacentHTML('beforeend', colorRow()); });
  $('#pcolors').addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) e.target.closest('.c').remove(); });
  $('#pcancel').addEventListener('click', () => closePanel());

  $('#psave').addEventListener('click', guard(async () => {
    const f = $('#pform'), fd = new FormData(f), v = (k) => fd.get(k);
    const payload = {
      name: v('name'), cat: v('cat'), tag: v('tag') || '', price: v('price'), was: v('was'), blurb: v('blurb'), photo: chosen,
      details: String(v('details')).split('\n'), active: f.active.checked,
      stock: Object.fromEntries(SIZES.map((s) => [s, v('stock-' + s)])),
      colors: $$('#pcolors .c').map((r) => ({ hex: $('input[type=color]', r).value, name: $('input[type=text]', r).value.trim() })),
    };
    $('#perr').textContent = '';
    const btn = $('#psave'); btn.disabled = true;
    try {
      await api(isNew ? 'products' : 'products/' + encodeURIComponent(p.id), { method: isNew ? 'POST' : 'PUT', body: payload });
      toast(isNew ? 'Piece added' : 'Saved'); closePanel(); if (route === 'products') render();
    } catch (err) { $('#perr').textContent = err.message; if (err.status === 401) return; throw err; }
    finally { btn.disabled = false; }
  }));
  $('#pdel')?.addEventListener('click', guard(async () => {
    if (!confirm(`Delete "${p.name}" for good? To just take it off the store, switch off "Visible in the store" instead.`)) return;
    await api('products/' + encodeURIComponent(p.id), { method: 'DELETE', body: {} }); toast('Deleted'); closePanel(); render();
  }));
}

function shrink(file) {
  return new Promise((res, rej) => {
    if (!file.type.startsWith('image/')) return rej(new Error('Choose an image file'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      for (const q of [0.82, 0.7, 0.58, 0.46]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 390000) return res(d); }
      rej(new Error('That photo is too detailed. Try a smaller one.'));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image')); };
    im.src = url;
  });
}

/* ---------- customers ---------- */
async function viewCustomers() {
  const { customers } = await api('customers');
  els.view.innerHTML = `<div class="bar"><p class="hint">${customers.length} customer${customers.length === 1 ? '' : 's'}, grouped by email</p><input type="search" id="cq" placeholder="Search customers" aria-label="Search customers" value="${esc(ui.custQ)}"></div><section class="card" id="clist"></section>`;
  const paint = () => {
    const q = ui.custQ.trim().toLowerCase(), list = customers.filter((c) => !q || [c.name, c.email, c.phone, c.city].join(' ').toLowerCase().includes(q));
    $('#clist').innerHTML = list.length ? `<div class="table-wrap"><table class="resp"><thead><tr><th>Customer</th><th>Contact</th><th>City</th><th>Orders</th><th>Last order</th><th class="r">Spent</th></tr></thead><tbody>${list.map((c) => `
      <tr><td class="span"><b style="font-weight:500">${esc(c.name)}</b></td><td class="span"><a href="mailto:${esc(c.email)}" style="text-decoration:underline">${esc(c.email)}</a><span class="sub"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></span></td><td>${esc(c.city)}</td><td class="num">${c.orders}</td><td>${when(c.last)}</td><td class="r num">${inr(c.spent)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="empty">${customers.length ? 'No one matches' : 'Customers appear after their first order'}</p>`;
  };
  $('#cq').addEventListener('input', (e) => { ui.custQ = e.target.value; paint(); $('#cq').focus(); });
  paint();
}

/* ---------- settings ---------- */
async function viewSettings() {
  const [{ settings: s }, ov] = await Promise.all([api('settings'), api('overview?days=7')]);
  els.view.innerHTML = `
    <form id="sform" class="grid g2" novalidate>
      <section class="card"><div class="card__h"><h2>Welcome offer</h2><span class="code">${esc(s.offer.code)}</span></div><div class="card__b" style="display:grid;gap:14px">
        <p class="hint">Shown to new visitors a few seconds after they arrive, as a scratch card. The discount is applied automatically at checkout.</p>
        <label class="switch"><input type="checkbox" name="active" ${s.offer.active ? 'checked' : ''}><i></i><span>Offer is on</span></label>
        <div class="row2"><label class="field"><span>Code</span><input name="code" value="${esc(s.offer.code)}" maxlength="16" style="text-transform:uppercase" autocapitalize="characters"></label><label class="field"><span>Discount (%)</span><input name="pct" type="number" min="1" max="90" value="${s.offer.pct}"></label></div>
        <label class="field"><span>Show popup after (seconds)</span><input name="delay" type="number" min="0" max="120" value="${s.offer.delay}"></label>
        <p class="hint num"><b>${ov.offer.claimed}</b> scratched · <b>${ov.offer.redeemed}</b> used at checkout</p>
      </div></section>
      <section class="card"><div class="card__h"><h2>Shipping and fees</h2></div><div class="card__b" style="display:grid;gap:14px">
        <label class="field"><span>Free shipping above (₹)</span><input name="freeShip" type="number" min="0" value="${s.freeShip}"></label>
        <label class="field"><span>Shipping fee (₹)</span><input name="shipFee" type="number" min="0" value="${s.shipFee}"></label>
        <label class="field"><span>Cash on delivery fee (₹)</span><input name="codFee" type="number" min="0" value="${s.codFee}"></label>
        <p class="hint">The store reads these values every time a customer checks out, so changes apply right away.</p>
      </div></section>
      <div style="grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn btn--ink" type="submit" id="ssave">Save settings</button><span class="hint">Storage: ${session.persistent ? 'permanent (Redis)' : 'temporary (resets on restart)'}</span></div>
    </form>`;
  $('#sform').addEventListener('submit', guard(async (e) => {
    e.preventDefault(); const f = e.target, btn = $('#ssave'); btn.disabled = true;
    try {
      await api('settings', { method: 'PUT', body: { freeShip: f.freeShip.value, shipFee: f.shipFee.value, codFee: f.codFee.value, offer: { code: f.code.value, pct: f.pct.value, delay: f.delay.value, active: f.active.checked } } });
      toast('Settings saved'); render();
    } finally { btn.disabled = false; }
  }));
}

boot();
