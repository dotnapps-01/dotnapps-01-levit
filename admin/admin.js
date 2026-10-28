/* LEVIT admin dashboard. Plain ES module, talks to /api/admin/*.
   Routes: #/overview #/orders #/products #/inventory #/customers #/offers #/content #/activity #/settings
   Phone: bottom tab bar + bottom sheets. Desktop: sidebar + slide-over panels. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const when = (iso, long) => new Date(iso).toLocaleString('en-IN', long ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const ago = (iso) => { const s = Math.max(0, (Date.now() - new Date(iso)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; if (s < 604800) return Math.floor(s / 86400) + ' d ago'; return when(iso); };
const photo = (p) => (!p ? '' : /^(data:|https?:|\/)/.test(p) ? p : '../' + p);
const STATUS = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];
const NEXT = { new: ['packed', 'Mark packed'], packed: ['shipped', 'Mark shipped'], shipped: ['delivered', 'Mark delivered'] };
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const PAY = { upi: 'UPI', card: 'Card', cod: 'Cash on delivery' };
const STATUS_COLOR = { new: '#2c5a8a', packed: '#b7791f', shipped: '#6b3f9a', delivered: '#2f6b4b', cancelled: '#b3372c' };

const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  overview: I('<path d="M4 13h6V4H4zM14 20h6V11h-6zM14 4h6v4h-6zM4 20h6v-4H4z"/>'),
  orders: I('<path d="M5 8h14l-1 12.5H6zM8.5 10V6.5a3.5 3.5 0 0 1 7 0V10"/>'),
  products: I('<path d="M12 5.5v-1a2 2 0 1 1 2 2L12 8 3.5 15.5c-1 .9-.4 2.5 1 2.5h15c1.4 0 2-1.6 1-2.5L12 8z"/>'),
  inventory: I('<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>'),
  customers: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>'),
  offers: I('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1"/>'),
  content: I('<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>'),
  activity: I('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  settings: I('<path d="M20 7H9M5 7H4M20 17h-3M13 17H4"/><circle cx="7" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>'),
  more: I('<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>'),
  check: I('<path d="M5 12l5 5 9-10"/>'),
  phone: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  wa: I('<path d="M4 20l1.3-4A8 8 0 1 1 8.5 19z"/><path d="M9 9.5c.5 2 2 3.5 4.5 4.5l1.2-1.2-1.8-1-.8.7c-.8-.4-1.5-1-1.9-1.9l.7-.8-1-1.8z"/>'),
  mail: I('<path d="M3 6h18v12H3zM3 7l9 7 9-7"/>'),
  print: I('<path d="M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z"/>'),
  eye: I('<path d="M14.5 4.5l5 5-2 2-5-5zM12.5 6.5l-8 8V19h4.5l8-8M4.5 19.5l3-3"/>'),
  up: I('<path d="m6 15 6-6 6 6"/>'), down: I('<path d="m6 9 6 6 6-6"/>'),
  store: I('<path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9a3 3 0 0 0 5.3 1.9A3 3 0 0 0 14.7 11 3 3 0 0 0 20 9M10 20v-5h4v5"/>'),
  out: I('<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'),
};
const ROUTES = [
  { id: 'overview', label: 'Overview', tab: 'Home' }, { id: 'orders', label: 'Orders', tab: 'Orders' }, { id: 'products', label: 'Products', tab: 'Products' },
  { id: 'inventory', label: 'Inventory' }, { id: 'customers', label: 'Customers' }, { id: 'offers', label: 'Offers & coupons' },
  { id: 'content', label: 'Content (CMS)', tab: 'Content' }, { id: 'activity', label: 'Activity' }, { id: 'settings', label: 'Settings' },
];

const els = { auth: $('#auth'), shell: $('#shell'), view: $('#view'), title: $('#title'), actions: $('#actions'), banner: $('#banner'), panel: $('#panel'), scrim: $('#scrim'), toast: $('#toast') };
let session = null, route = 'overview', ordersCache = [], productsCache = null, newCount = 0, lastTotal = null, dirtyGuard = null;
const ymdLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ui = { days: 14, custom: false, from: '', to: '', oFrom: '', oTo: '', orderTab: 'all', orderQ: '', orderPay: 'all', sel: new Set(), selecting: false, prodQ: '', prodCat: 'all', reorder: false, custQ: '', invLow: false, invQ: '' };

/* ---------- api, toast, confirm ---------- */
class ApiError extends Error { constructor(m, status) { super(m); this.status = status; } }
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api/admin/' + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && path !== 'login') { showAuth('Your session ended. Please sign in again.'); throw new ApiError('Signed out', 401); }
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong', res.status);
  return data;
}
let toastT;
function toast(msg, opts = {}) {
  const t = els.toast; t.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<button type="button">${esc(opts.action.label)}</button>` : ''}`;
  t.classList.toggle('err', !!opts.err); t.classList.add('on');
  if (opts.action) $('button', t).onclick = () => { t.classList.remove('on'); opts.action.fn(); };
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), opts.err ? 4800 : opts.action ? 6000 : 2600);
}
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { if (e.status !== 401) toast(e.message, { err: true }); } };
function confirmBox({ title, text = '', yes = 'Confirm', danger = false }) {
  return new Promise((res) => {
    const d = $('#dlg'); $('#dlg-t').textContent = title; $('#dlg-p').textContent = text; $('#dlg-yes').textContent = yes; $('.dlg__box', d).classList.toggle('danger', danger); d.hidden = false;
    const done = (v) => { d.hidden = true; $('#dlg-yes').onclick = $('#dlg-no').onclick = null; d.onclick = null; res(v); };
    $('#dlg-yes').onclick = () => done(true); $('#dlg-no').onclick = () => done(false); d.onclick = (e) => { if (e.target === d) done(false); };
    $('#dlg-no').focus();
  });
}
function beep() {
  try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.5); } catch { /* audio blocked */ }
}
function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((c) => { let s = String(c ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const waLink = (phone, text) => { let d = String(phone).replace(/\D/g, '').replace(/^0+/, ''); if (d.length === 10) d = '91' + d; return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; };

/* ---------- auth + boot ---------- */
function showAuth(msg = '') {
  els.shell.hidden = true; els.auth.hidden = false; closePanel(true); stopPulse();
  $('#auth-err').textContent = msg;
  $('#auth-hint').textContent = session && !session.configured ? 'Admin is locked. Set the ADMIN_PASSWORD environment variable in Vercel, then redeploy.' : 'Sign in to manage orders, products and content.';
  setTimeout(() => $('#pw').focus(), 50);
}
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = $('#login-btn'); btn.disabled = true; $('#auth-err').textContent = '';
  try { await api('login', { method: 'POST', body: { password: $('#pw').value } }); $('#pw').value = ''; await boot(); }
  catch (err) { $('#auth-err').textContent = err.message; }
  btn.disabled = false;
});
const signOut = async () => { try { await api('logout', { method: 'POST', body: {} }); } catch { /* ignore */ } session = { ...session, authed: false }; showAuth(''); };
$('#logout').addEventListener('click', signOut);
$('#refresh').addEventListener('click', () => { $('#refresh').animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 500 }); render(); refreshBadge(); });

async function boot() {
  let res, text = '';
  try { res = await fetch('/api/admin/session', { credentials: 'same-origin' }); text = await res.text(); session = JSON.parse(text); }
  catch {
    els.auth.hidden = false;
    $('#auth-err').textContent = res ? `The API answered with HTTP ${res.status} instead of data: ${text.replace(/\s+/g, ' ').slice(0, 140)}` : 'Cannot reach the API. Locally run "node dev-server.mjs"; on Vercel check the deployment logs.';
    return;
  }
  if (!session.authed) return showAuth('');
  els.auth.hidden = true; els.shell.hidden = false;
  buildNav(); render(); startPulse();
}
function buildNav() {
  $('#nav').innerHTML = ROUTES.map((r) => `<a href="#/${r.id}" data-r="${r.id}">${ICON[r.id]}<span>${r.label}</span>${r.id === 'orders' ? '<em class="badge" id="nav-orders" hidden>0</em>' : ''}</a>`).join('');
  const tabs = ROUTES.filter((r) => r.tab).map((r) => `<a class="tab" href="#/${r.id}" data-r="${r.id}">${ICON[r.id]}<span>${r.tab}</span>${r.id === 'orders' ? '<em class="badge" id="tab-orders" hidden>0</em>' : ''}</a>`).join('');
  $('#tabbar').innerHTML = tabs + `<button class="tab" type="button" id="tab-more" data-r="more">${ICON.more}<span>More</span></button>`;
  $('#tab-more').addEventListener('click', openMore);
}
function setBadge(n) {
  newCount = n;
  for (const id of ['nav-orders', 'tab-orders']) { const b = $('#' + id); if (b) { b.hidden = !n; b.textContent = n; } }
  document.title = (n ? `(${n}) ` : '') + (ROUTES.find((r) => r.id === route)?.label || 'Admin') + ' · LEVIT Admin';
}
async function refreshBadge() { try { const p = await api('pulse'); setBadge(p.new); lastTotal = p.total; } catch { /* ignore */ } }

/* new-order alerts: a light poll while the dashboard is open */
let pulseT;
function startPulse() { stopPulse(); refreshBadge(); pulseT = setInterval(pulse, 40000); document.addEventListener('visibilitychange', onVis); }
function stopPulse() { clearInterval(pulseT); document.removeEventListener('visibilitychange', onVis); }
const onVis = () => { if (!document.hidden && session?.authed) pulse(); };
async function pulse() {
  if (document.hidden) return;
  try {
    const p = await api('pulse'); setBadge(p.new);
    if (lastTotal !== null && p.total > lastTotal && p.latest) {
      beep(); toast(`New order ${p.latest.id} · ${p.latest.name} · ${inr(p.latest.total)}`, { action: { label: 'View', fn: () => { ui.orderTab = 'new'; location.hash = '#/orders'; if (route === 'orders') render(); } } });
      if (['overview', 'orders'].includes(route) && !els.panel.classList.contains('on')) render();
    }
    lastTotal = p.total;
  } catch { /* offline: try again later */ }
}

/* ---------- router ---------- */
const routes = { overview: viewOverview, orders: viewOrders, products: viewProducts, inventory: viewInventory, customers: viewCustomers, offers: viewOffers, content: viewContent, activity: viewActivity, settings: viewSettings };
async function render() {
  if (dirtyGuard && !(await dirtyGuard())) { history.replaceState(null, '', '#/' + route); return; }
  dirtyGuard = null;
  route = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (!routes[route]) route = 'overview';
  const label = ROUTES.find((r) => r.id === route).label;
  $$('[data-r]').forEach((a) => { if (a.dataset.r === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (!ROUTES.find((r) => r.id === route).tab) $('#tab-more')?.setAttribute('aria-current', 'page'); else $('#tab-more')?.removeAttribute('aria-current');
  if (route !== 'orders') { ui.selecting = false; ui.sel.clear(); }
  els.banner.hidden = true;
  els.title.textContent = label; setBadge(newCount);
  els.actions.innerHTML = ''; els.view.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  closePanel(true); window.scrollTo(0, 0);
  try { await routes[route](); }
  catch (e) { if (e.status === 401) return; els.view.innerHTML = `<div class="card"><p class="empty">${esc(e.message)}<br><br><button class="btn" id="retry" type="button">Try again</button></p></div>`; $('#retry').onclick = render; }
}
addEventListener('hashchange', () => { if (session?.authed) render(); });
const action = (html, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = html; b.className = 'btn btn--sm ' + cls; b.addEventListener('click', fn); els.actions.append(b); return b; };

/* ---------- panel (bottom sheet on phones, slide-over on desktop) ---------- */
let lastFocus = null;
function openPanel(title, body, foot = '') {
  lastFocus = document.activeElement;
  $('#panel-title').textContent = title; $('#panel-body').innerHTML = body; $('#panel-foot').innerHTML = foot;
  els.scrim.hidden = false; els.panel.style.translate = ''; requestAnimationFrame(() => { els.scrim.classList.add('on'); els.panel.classList.add('on'); });
  els.panel.setAttribute('aria-hidden', 'false'); $('#panel-body').scrollTop = 0; setTimeout(() => els.panel.focus({ preventScroll: true }), 80);
}
function closePanel(instant) {
  if (!els.panel.classList.contains('on')) return;
  els.panel.classList.remove('on'); els.scrim.classList.remove('on'); els.panel.setAttribute('aria-hidden', 'true'); els.panel.style.translate = '';
  setTimeout(() => { if (!els.panel.classList.contains('on')) els.scrim.hidden = true; }, instant ? 0 : 320); lastFocus?.focus?.({ preventScroll: true });
}
$('#panel-x').addEventListener('click', () => closePanel());
els.scrim.addEventListener('click', () => closePanel());
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#dlg').hidden) $('#dlg-no').click(); else if (e.key === 'Escape' && els.panel.classList.contains('on')) closePanel(); });
(() => {                                                              // swipe the sheet header down to close (phones)
  const head = $('.panel__head'); let y0 = null, dy = 0;
  head.addEventListener('pointerdown', (e) => { if (matchMedia('(min-width: 900px)').matches || e.target.closest('button')) return; y0 = e.clientY; dy = 0; els.panel.style.transition = 'none'; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); els.panel.style.translate = `0 ${dy}px`; });
  const end = () => { if (y0 === null) return; els.panel.style.transition = ''; const close = dy > 110; y0 = null; if (close) closePanel(); else els.panel.style.translate = ''; };
  head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
})();
function openMore() {
  const items = ROUTES.filter((r) => !r.tab).map((r) => `<a href="#/${r.id}" data-go>${ICON[r.id]}<span>${r.label}</span></a>`).join('');
  openPanel('More', `<nav class="menu">${items}<a href="../" target="_blank" rel="noopener">${ICON.store}<span>View store</span></a><button type="button" id="more-out">${ICON.out}<span>Sign out</span></button></nav>`);
  $$('[data-go]', els.panel).forEach((a) => a.addEventListener('click', () => closePanel(true)));
  $('#more-out').addEventListener('click', () => { closePanel(true); signOut(); });
}

/* ---------- overview ---------- */
const delta = (cur, prev) => { if (!prev) return cur ? '<span class="delta up">new</span>' : ''; const p = Math.round(((cur - prev) / prev) * 100); return `<span class="delta ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '+' : ''}${p}%</span>`; };
async function viewOverview() {
  const q = ui.custom && ui.from && ui.to ? `from=${ui.from}&to=${ui.to}` : `days=${ui.days}`;
  const d = await api('overview?' + q);
  setBadge(d.counts.new);
  const banners = [];
  if (!session.persistent) banners.push('<b>Storage is temporary.</b> Orders and edits reset when the server restarts. Connect Upstash Redis or Neon Postgres in Vercel (Storage) and redeploy to keep your data.');
  if (session.defaultPassword) banners.push('<b>Using the default local password.</b> Set ADMIN_PASSWORD before going live.');
  els.banner.hidden = !banners.length; els.banner.innerHTML = banners.join('<br>');
  const kpi = (l, v, s) => `<div class="card kpi"><small>${l}</small><b class="num">${v}</b><span>${s}</span></div>`;
  const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
  const stack = STATUS.map((s) => (d.counts[s] ? `<i style="width:${(d.counts[s] / total) * 100}%;background:${STATUS_COLOR[s]}"></i>` : '')).join('');
  const legend = STATUS.map((s) => `<span><i style="background:${STATUS_COLOR[s]}"></i>${s} <b class="num">${d.counts[s]}</b></span>`).join('');
  const maxCat = Math.max(1, ...d.byCategory.map((c) => c.revenue)), payTotal = Math.max(1, d.orders);
  const attn = [
    `<a href="#/orders" data-tab="new" class="${d.counts.new ? 'hot' : ''}"><b class="num">${d.counts.new}</b><span>new order${d.counts.new === 1 ? '' : 's'}<br>to pack</span></a>`,
    `<a href="#/orders" data-tab="all"><b class="num">${d.unpaid}</b><span>not marked paid<br>yet</span></a>`,
    `<a href="#/inventory" data-low><b class="num">${d.lowStock.length}</b><span>sizes low or<br>sold out</span></a>`,
    d.paused ? `<a href="#/settings" class="hot"><b>!</b><span>Orders are paused<br>(tap to change)</span></a>` : '',
  ].join('');
  els.view.innerHTML = `
    <div class="tabs" id="range">${[7, 14, 30, 90].map((n) => `<button class="chip" type="button" data-d="${n}" aria-pressed="${!ui.custom && ui.days === n}">${n} days</button>`).join('')}<button class="chip" type="button" data-custom aria-pressed="${ui.custom}">Custom dates</button></div>
    ${ui.custom ? `<form class="daterange" id="drange"><label class="field"><span>From</span><input type="date" name="from" value="${esc(ui.from || d.from)}" max="${ymdLocal()}" required></label><label class="field"><span>To</span><input type="date" name="to" value="${esc(ui.to || d.to)}" max="${ymdLocal()}" required></label><button class="btn btn--ink" type="submit">Show</button></form><p class="hint" style="margin-top:-8px">${esc(new Date(d.from + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))} to ${esc(new Date(d.to + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))} · ${d.days} day${d.days === 1 ? '' : 's'}${d.days > 92 ? ' · chart shows weeks' : ''}</p>` : ''}
    <div class="attn">${attn}</div>
    <div class="grid g4">
      ${kpi('Revenue', inr(d.revenue), `${delta(d.revenue, d.prev.revenue)} vs previous ${d.days} day${d.days === 1 ? '' : 's'}`)}
      ${kpi('Orders', d.orders, `${delta(d.orders, d.prev.orders)} vs previous`)}
      ${kpi('Average order', inr(d.aov), `${inr(d.allTime.revenue)} all time`)}
      ${kpi('New customers', d.newCustomers, `${d.customers} total · ${d.repeatCustomers} repeat`)}
    </div>
    <div class="grid g21">
      <section class="card"><div class="card__h"><h2>Revenue</h2><small class="num">${inr(d.series.reduce((n, x) => n + x.revenue, 0))}</small></div><div class="card__b">${chart(d.series)}</div></section>
      <section class="card"><div class="card__h"><h2>Orders by status</h2><small>all time</small></div><div class="card__b">${total ? `<div class="stack">${stack}</div><div class="legend">${legend}</div>` : '<p class="empty">No orders yet</p>'}
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)"><p class="lbl">Welcome offer <span class="code" style="margin-left:6px">${esc(d.offer.code)}</span></p><p class="hint" style="margin-top:8px">${d.offer.claimed} scratched · ${d.offer.redeemed} used${d.offer.active ? '' : ' · switched off'}</p></div>
      </div></section>
    </div>
    <div class="grid g2">
      <section class="card"><div class="card__h"><h2>Sales by category</h2></div><div class="card__b">${d.byCategory.length ? `<div class="hbars">${d.byCategory.map((c) => `<div class="hbar"><div><span>${esc(c.name)} <small class="hint">${c.units} sold</small></span><b class="num">${inr(c.revenue)}</b></div><div><i style="width:${(c.revenue / maxCat) * 100}%"></i></div></div>`).join('')}</div>` : '<p class="empty">Sales will show here</p>'}</div></section>
      <section class="card"><div class="card__h"><h2>Payment methods</h2></div><div class="card__b">${d.orders ? `<div class="hbars">${Object.entries(d.pay).map(([k, v]) => `<div class="hbar"><div><span>${PAY[k] || k} <small class="hint">${v.orders} order${v.orders === 1 ? '' : 's'}</small></span><b class="num">${inr(v.revenue)}</b></div><div><i style="width:${(v.orders / payTotal) * 100}%"></i></div></div>`).join('')}</div>` : '<p class="empty">No orders in this period</p>'}</div></section>
    </div>
    <div class="grid g2">
      <section class="card"><div class="card__h"><h2>Best sellers</h2></div><div class="card__b">${d.topProducts.length ? `<ul class="list">${d.topProducts.map((t) => `<li><img src="${esc(photo(t.photo))}" alt="" loading="lazy"><div class="grow"><b>${esc(t.name)}</b><small>${t.units} sold</small></div><b class="num">${inr(t.revenue)}</b></li>`).join('')}</ul>` : '<p class="empty">Sales will show here</p>'}</div></section>
      <section class="card"><div class="card__h"><h2>Low stock</h2><small>${d.threshold} or fewer</small></div><div class="card__b">${d.lowStock.length ? `<ul class="list">${d.lowStock.slice(0, 8).map((x) => `<li><div class="grow"><b>${esc(x.name)}</b><small>Size ${x.size}</small></div><span class="pill ${x.qty ? 's-low' : 's-out'}">${x.qty ? x.qty + ' left' : 'sold out'}</span></li>`).join('')}</ul><p style="margin-top:12px"><a class="btn btn--sm" href="#/inventory" data-low>Fix in Inventory</a></p>` : '<p class="empty">Everything is well stocked</p>'}</div></section>
    </div>
    <div class="grid g2">
      <section class="card"><div class="card__h"><h2>Top customers</h2></div><div class="card__b">${d.topCustomers.length ? `<ul class="list">${d.topCustomers.map((c) => `<li><div class="grow"><b>${esc(c.name)}</b><small>${esc(c.city)} · ${c.orders} order${c.orders === 1 ? '' : 's'}</small></div><b class="num">${inr(c.spent)}</b></li>`).join('')}</ul>` : '<p class="empty">Customers appear after the first order</p>'}</div></section>
      <section class="card"><div class="card__h"><h2>Recent orders</h2><a class="btn btn--sm" href="#/orders">View all</a></div>${d.recent.length ? `<div class="card__b"><ul class="list" id="recent">${d.recent.map((o) => `<li data-open="${esc(o.id)}" tabindex="0" role="button" style="cursor:pointer"><div class="grow"><b>${esc(o.customer.name)}</b><small>${esc(o.id)} · ${ago(o.createdAt)}</small></div><span class="pill s-${o.status}">${o.status}</span><b class="num">${inr(o.total)}</b></li>`).join('')}</ul></div>` : '<p class="empty">Orders will appear here as they come in</p>'}</section>
    </div>`;
  $$('#range [data-d]').forEach((b) => b.addEventListener('click', () => { ui.days = +b.dataset.d; ui.custom = false; render(); }));
  $('#range [data-custom]').addEventListener('click', () => { if (!ui.custom) { ui.custom = true; ui.from = ui.from || d.from; ui.to = ui.to || d.to; render(); } });
  $('#drange')?.addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; if (!f.from.value || !f.to.value) return; ui.from = f.from.value; ui.to = f.to.value; render(); });
  $$('.attn a[data-tab]').forEach((a) => a.addEventListener('click', () => { ui.orderTab = a.dataset.tab; }));
  $$('[data-low]').forEach((a) => a.addEventListener('click', () => { ui.invLow = true; }));
  ordersCache = d.recent; bindOrderRows($('#recent'), () => ordersCache);
}

function chart(series) {
  const W = 700, H = 220, pl = 8, pr = 8, pt = 14, pb = 30;
  const max = Math.max(1, ...series.map((s) => s.revenue)), n = series.length, bw = (W - pl - pr) / n;
  const step = Math.max(1, Math.ceil(n / 7));
  const nice = Math.ceil(max / 1000) * 1000 || 1000;
  let g = '';
  for (let i = 0; i <= 3; i++) { const y = pt + ((H - pt - pb) * i) / 3; g += `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>`; }
  const bars = series.map((s, i) => {
    const h = Math.max(s.revenue ? 3 : 0, (s.revenue / nice) * (H - pt - pb)), x = pl + i * bw + bw * 0.18, w = bw * 0.64, y = H - pb - h;
    const dt = new Date(s.date + 'T00:00:00');
    const lab = (n - 1 - i) % step === 0 ? `<text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${dt.getDate()} ${dt.toLocaleString('en', { month: 'short' })}</text>` : '';
    return `<rect class="col" x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(4, w / 2)}"><title>${s.span > 1 ? 'Week of ' : ''}${dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${inr(s.revenue)} · ${s.orders} order${s.orders === 1 ? '' : 's'}</title></rect>${lab}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue per day">${g}${bars}</svg>`;
}

/* ---------- orders ---------- */
function orderRow(o, selecting = false) {
  const nx = NEXT[o.status];
  return `<div class="row row--order${ui.sel.has(o.id) ? ' sel' : ''}" data-open="${esc(o.id)}" tabindex="0" role="button">
    ${selecting ? `<span class="chk">${ICON.check}</span>` : ''}
    <span class="id">${esc(o.id)}${o.paid ? ' <span class="pill s-paid">paid</span>' : ''}</span>
    <span class="cust">${esc(o.customer.name)}<span class="sub">${esc(o.address.city)} · ${PAY[o.pay] || o.pay}</span></span>
    <span class="when">${ago(o.createdAt)}</span><span class="items">${o.lines.reduce((n, l) => n + l.qty, 0)} item${o.lines.reduce((n, l) => n + l.qty, 0) === 1 ? '' : 's'}</span>
    <span class="st"><span class="pill s-${o.status}">${o.status}</span></span><span class="total num">${inr(o.total)}</span>
    <span class="next">${nx && !selecting ? `<button class="btn btn--sm btn--ink" type="button" data-next="${esc(o.id)}">${nx[1]}</button>` : ''}</span></div>`;
}
function bindOrderRows(root, getList, { onChange } = {}) {
  if (!root) return;
  root.addEventListener('click', guard(async (e) => {
    const nb = e.target.closest('[data-next]');
    if (nb) {
      e.stopPropagation(); nb.disabled = true;
      const o = getList().find((x) => x.id === nb.dataset.next); const to = NEXT[o.status][0];
      await patchOrder(o.id, { status: to }); toast(`${o.id} marked ${to}`);
      (onChange || render)(); return;
    }
    const row = e.target.closest('[data-open]'); if (!row) return;
    if (ui.selecting) { const id = row.dataset.open; ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); row.classList.toggle('sel'); updateBulk(); return; }
    const o = getList().find((x) => x.id === row.dataset.open); if (o) openOrder(o);
  }));
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-open]')) e.target.click(); });
}
async function patchOrder(id, data) {
  const { order } = await api('orders/' + encodeURIComponent(id), { method: 'PATCH', body: data });
  const i = ordersCache.findIndex((x) => x.id === order.id); if (i > -1) ordersCache[i] = order;
  refreshBadge(); return order;
}

async function viewOrders() {
  const { orders } = await api('orders'); ordersCache = orders; setBadge(orders.filter((o) => o.status === 'new').length);
  action('Select', () => { ui.selecting = !ui.selecting; ui.sel.clear(); paint(); });
  action('Export CSV', exportCsv);
  els.view.innerHTML = `
    <div class="tabs" id="otabs"></div>
    <div class="bar"><input type="search" id="oq" placeholder="Search name, order, phone, city" aria-label="Search orders" value="${esc(ui.orderQ)}">
      <select id="opay" aria-label="Payment filter" style="width:auto;min-width:170px"><option value="all">All payments</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}" ${ui.orderPay === k ? 'selected' : ''}>${v}</option>`).join('')}<option value="unpaid" ${ui.orderPay === 'unpaid' ? 'selected' : ''}>Not marked paid</option></select>
      <div class="daterange daterange--inline"><label class="field"><span>From</span><input type="date" id="ofrom" value="${esc(ui.oFrom)}"></label><label class="field"><span>To</span><input type="date" id="oto" value="${esc(ui.oTo)}"></label>${ui.oFrom || ui.oTo ? '<button class="btn btn--sm" type="button" id="oclr">Clear dates</button>' : ''}</div></div>
    <section class="card rows" id="olist"></section><div id="bulk"></div>`;
  const current = () => {
    const q = ui.orderQ.trim().toLowerCase();
    return ordersCache.filter((o) => (ui.orderTab === 'all' || o.status === ui.orderTab) && (ui.orderPay === 'all' || (ui.orderPay === 'unpaid' ? !o.paid && o.status !== 'cancelled' : o.pay === ui.orderPay))
      && (!ui.oFrom || ymdLocal(new Date(o.createdAt)) >= ui.oFrom) && (!ui.oTo || ymdLocal(new Date(o.createdAt)) <= ui.oTo)
      && (!q || [o.id, o.customer.name, o.customer.phone, o.customer.email, o.address.city].join(' ').toLowerCase().includes(q)));
  };
  function paint() {
    $('#otabs').innerHTML = ['all', ...STATUS].map((s) => `<button class="chip" type="button" aria-pressed="${ui.orderTab === s}" data-t="${s}">${s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}<small class="num">${s === 'all' ? ordersCache.length : ordersCache.filter((o) => o.status === s).length}</small></button>`).join('');
    const list = current(); const box = $('#olist'); box.classList.toggle('selecting', ui.selecting);
    box.innerHTML = list.length ? `<div class="row row--order row--head"><span>Order</span><span>Customer</span><span>Placed</span><span>Items</span><span>Status</span><span class="r" style="text-align:right">Total</span><span></span></div>${list.map((o) => orderRow(o, ui.selecting)).join('')}` : `<p class="empty">${ordersCache.length ? 'No orders match' : 'No orders yet. They will land here the moment a customer checks out.'}</p>`;
    $$('#otabs .chip').forEach((b) => b.addEventListener('click', () => { ui.orderTab = b.dataset.t; paint(); }));
    updateBulk();
  }
  bindOrderRows($('#olist'), current, { onChange: paint });
  $('#oq').addEventListener('input', (e) => { ui.orderQ = e.target.value; paint(); });
  $('#opay').addEventListener('change', (e) => { ui.orderPay = e.target.value; paint(); });
  $('#ofrom').addEventListener('change', (e) => { ui.oFrom = e.target.value; render(); });
  $('#oto').addEventListener('change', (e) => { ui.oTo = e.target.value; render(); });
  $('#oclr')?.addEventListener('click', () => { ui.oFrom = ui.oTo = ''; render(); });
  window.__repaintOrders = paint;
  function updateBulkInner() {
    const bar = $('#bulk'); if (!bar) return;
    if (!ui.selecting) { bar.innerHTML = ''; return; }
    const n = ui.sel.size;
    bar.innerHTML = `<div class="stickybar"><b>${n} selected</b><span style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn--sm" type="button" data-all>${n === current().length && n ? 'Clear' : 'Select all'}</button>
      ${['packed', 'shipped', 'delivered'].map((s) => `<button class="btn btn--sm btn--ok" type="button" data-bulk="${s}" ${n ? '' : 'disabled'}>${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
      <button class="btn btn--sm" type="button" data-bulk="cancelled" ${n ? '' : 'disabled'}>Cancel</button>
      <button class="btn btn--sm" type="button" data-done>Done</button></span></div>`;
    $('[data-all]', bar).onclick = () => { const all = current(); if (n === all.length) ui.sel.clear(); else all.forEach((o) => ui.sel.add(o.id)); paint(); };
    $('[data-done]', bar).onclick = () => { ui.selecting = false; ui.sel.clear(); paint(); };
    $$('[data-bulk]', bar).forEach((b) => b.onclick = guard(async () => {
      const to = b.dataset.bulk, ids = [...ui.sel];
      if (to === 'cancelled' && !(await confirmBox({ title: `Cancel ${ids.length} order${ids.length === 1 ? '' : 's'}?`, text: 'The items go back into stock.', yes: 'Cancel orders', danger: true }))) return;
      b.disabled = true; let done = 0;
      for (const id of ids) { try { await patchOrder(id, { status: to }); done++; } catch (e) { if (e.status === 401) throw e; } }
      toast(`${done} order${done === 1 ? '' : 's'} marked ${to}`); ui.selecting = false; ui.sel.clear(); paint();
    }));
  }
  updateBulk = updateBulkInner;
  paint();
}
let updateBulk = () => {};

function exportCsv() {
  const rows = [['Order', 'Placed', 'Status', 'Paid', 'Name', 'Email', 'Phone', 'Address', 'City', 'PIN', 'Payment', 'Items', 'Subtotal', 'Discount', 'Code', 'Shipping', 'COD fee', 'Total', 'Courier', 'Tracking']];
  for (const o of ordersCache) rows.push([o.id, o.createdAt, o.status, o.paid ? 'yes' : 'no', o.customer.name, o.customer.email, o.customer.phone, o.address.address, o.address.city, o.address.pin, o.pay, o.lines.map((l) => `${l.name} (${l.size}) x${l.qty}`).join('; '), o.subtotal, o.discount, o.offer || '', o.shipping, o.cod, o.total, o.tracking?.courier || '', o.tracking?.number || '']);
  downloadCsv(`levit-orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function waText(o) {
  const n = o.customer.name.split(' ')[0], trk = o.tracking?.number ? ` Tracking: ${o.tracking.courier ? o.tracking.courier + ' ' : ''}${o.tracking.number}.` : '';
  return ({
    new: `Hi ${n}, thank you for your LEVIT order ${o.id} (${inr(o.total)}). We will pack it shortly.`,
    packed: `Hi ${n}, your LEVIT order ${o.id} is packed and will ship soon.`,
    shipped: `Hi ${n}, your LEVIT order ${o.id} is on its way.${trk}`,
    delivered: `Hi ${n}, your LEVIT order ${o.id} was delivered. We hope you love it! Tag us in your photos.`,
    cancelled: `Hi ${n}, your LEVIT order ${o.id} has been cancelled. Please reply if you have any questions.`,
  })[o.status];
}

function openOrder(o) {
  const body = `
    <div class="steps noprint">${STATUS.map((s) => `<button type="button" class="btn btn--sm ${o.status === s ? 'btn--ink' : s === 'cancelled' ? 'btn--danger' : ''}" data-set="${s}" ${o.status === s ? 'disabled' : ''}>${s === 'cancelled' ? 'Cancel order' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
    <div class="quick noprint">
      <a href="${waLink(o.customer.phone, waText(o))}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a>
      <a href="tel:${esc(o.customer.phone)}">${ICON.phone}Call</a>
      <a href="mailto:${esc(o.customer.email)}?subject=${encodeURIComponent('Your LEVIT order ' + o.id)}">${ICON.mail}Email</a>
    </div>
    <section class="sec"><h3>Customer</h3><dl class="kv"><dt>Name</dt><dd>${esc(o.customer.name)}</dd><dt>Email</dt><dd>${esc(o.customer.email)}</dd><dt>Phone</dt><dd>${esc(o.customer.phone)}</dd><dt>Placed</dt><dd>${when(o.createdAt, true)}</dd></dl></section>
    <section class="sec"><h3>Ship to</h3><p>${esc(o.address.address)}<br>${esc(o.address.city)} ${esc(o.address.pin)}</p></section>
    <section class="sec"><h3>Items</h3><ul class="list">${o.lines.map((l) => `<li><img src="${esc(photo(l.photo))}" alt=""><div class="grow"><b>${esc(l.name)}</b><small>Size ${esc(l.size)} · Qty ${l.qty}</small></div><b class="num">${inr(l.price * l.qty)}</b></li>`).join('')}</ul>
      <div class="totals num"><div><span>Subtotal</span><span>${inr(o.subtotal)}</span></div>${o.discount ? `<div><span>Code ${esc(o.offer)}</span><span>−${inr(o.discount)}</span></div>` : ''}<div><span>Shipping</span><span>${o.shipping ? inr(o.shipping) : 'Free'}</span></div>${o.cod ? `<div><span>Cash on delivery fee</span><span>${inr(o.cod)}</span></div>` : ''}<div class="grand"><span>Total · ${PAY[o.pay] || o.pay}</span><span>${inr(o.total)}</span></div></div></section>
    <section class="sec noprint"><h3>Payment and shipping</h3>
      <label class="switch"><input type="checkbox" id="opaid" ${o.paid ? 'checked' : ''}><i></i><span>Payment received</span></label>
      <div class="row2"><label class="field"><span>Courier</span><input id="otc" value="${esc(o.tracking?.courier || '')}" placeholder="Delhivery, India Post…" maxlength="40"></label><label class="field"><span>Tracking number</span><input id="otn" value="${esc(o.tracking?.number || '')}" maxlength="60" autocapitalize="characters"></label></div>
      <div><button class="btn btn--sm" id="otsave" type="button">Save payment and tracking</button></div></section>
    <section class="sec noprint"><h3>Internal note</h3><textarea id="onote" placeholder="Anything the team should know" maxlength="500">${esc(o.note)}</textarea><div><button class="btn btn--sm" id="osave" type="button">Save note</button></div></section>
    <section class="sec"><h3>History</h3><ul class="timeline">${o.history.map((h) => `<li><span class="pill s-${h.status}">${h.status}</span><small>${when(h.at, true)}</small></li>`).join('')}</ul></section>`;
  openPanel(`Order ${o.id}`, body, `<button class="btn" id="oprint" type="button">${ICON.print} Print slip</button>`);
  const patch = guard(async (data, msg) => {
    const order = await patchOrder(o.id, data); toast(msg || 'Saved');
    if (data.status) { openOrder(order); if (route === 'orders') window.__repaintOrders?.(); else if (route === 'overview') render(); }
    return order;
  });
  $$('[data-set]', els.panel).forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.set === 'cancelled' && !(await confirmBox({ title: `Cancel order ${o.id}?`, text: 'The items go back into stock.', yes: 'Cancel order', danger: true }))) return;
    patch({ status: b.dataset.set }, `Marked ${b.dataset.set}`);
  }));
  $('#opaid').addEventListener('change', (e) => patch({ paid: e.target.checked }, e.target.checked ? 'Marked paid' : 'Marked unpaid'));
  $('#otsave').addEventListener('click', () => patch({ paid: $('#opaid').checked, tracking: { courier: $('#otc').value, number: $('#otn').value } }, 'Saved'));
  $('#osave').addEventListener('click', () => patch({ note: $('#onote').value }, 'Note saved'));
  $('#oprint').addEventListener('click', () => print());
}

/* ---------- products ---------- */
async function viewProducts() {
  const data = await api('products'); productsCache = data;
  action('+ Add piece', () => openProduct(), 'btn--ink');
  action(ui.reorder ? 'Done' : 'Reorder', () => { ui.reorder = !ui.reorder; render(); });
  els.view.innerHTML = `<div class="bar" style="justify-content:flex-start"><button class="btn btn--sm" type="button" id="mcat">Manage categories</button><button class="btn btn--sm" type="button" id="mlab">Manage labels</button></div><div class="tabs" id="ptabs"></div><div class="bar"><input type="search" id="pq" placeholder="Search pieces" aria-label="Search pieces" value="${esc(ui.prodQ)}">${ui.reorder ? '<p class="hint">Use the arrows to change the order shown in the store.</p>' : ''}</div><section class="card rows" id="plist"></section>`;
  const paint = () => {
    const cats = [{ id: 'all', name: 'All' }, ...data.categories.filter((c) => c.id !== 'all')];
    $('#ptabs').innerHTML = cats.map((c) => `<button class="chip" type="button" aria-pressed="${ui.prodCat === c.id}" data-c="${c.id}">${esc(c.name)}</button>`).join('');
    const q = ui.prodQ.trim().toLowerCase(), canMove = ui.reorder && ui.prodCat === 'all' && !q;
    const list = data.products.filter((p) => (ui.prodCat === 'all' || p.cat === ui.prodCat) && (!q || p.name.toLowerCase().includes(q)));
    $('#plist').innerHTML = list.length ? list.map((p, i) => {
      const total = SIZES.reduce((n, s) => n + (p.stock?.[s] || 0), 0), low = SIZES.some((s) => (p.stock?.[s] || 0) <= 2);
      return `<div class="row row--prod" data-open="${esc(p.id)}" tabindex="0" role="button"><img class="thumb" src="${esc(photo(p.photo))}" alt="" loading="lazy">
        <div class="meta"><b>${esc(p.name)}</b><span class="sub">${esc(data.categories.find((c) => c.id === p.cat)?.name || p.cat)}${p.tag ? ' · ' + esc(p.tag) : ''}</span>
          <span class="sub"><span class="num">${total}</span> in stock ${total === 0 ? '<span class="pill s-out">sold out</span>' : low ? '<span class="pill s-low">low</span>' : ''}</span></div>
        <div class="side-r"><b class="num">${inr(p.price)}</b>${p.was ? `<span class="sub" style="text-decoration:line-through">${inr(p.was)}</span>` : ''}
          ${canMove ? `<span class="arrows"><button type="button" data-mv="-1" data-id="${esc(p.id)}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button type="button" data-mv="1" data-id="${esc(p.id)}" aria-label="Move down" ${i === list.length - 1 ? 'disabled' : ''}>${ICON.down}</button></span>`
            : `<label class="switch" data-stop title="Visible in the store"><input type="checkbox" data-vis="${esc(p.id)}" ${p.active === false ? '' : 'checked'}><i></i></label>`}</div></div>`;
    }).join('') : '<p class="empty">No pieces match</p>';
    $$('#ptabs .chip').forEach((b) => b.addEventListener('click', () => { ui.prodCat = b.dataset.c; paint(); }));
  };
  $('#plist').addEventListener('click', guard(async (e) => {
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      e.stopPropagation();
      const arr = data.products, i = arr.findIndex((p) => p.id === mv.dataset.id), j = i + Number(mv.dataset.mv);
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]]; paint();
      await api('products/reorder', { method: 'POST', body: { ids: arr.map((p) => p.id) } }); return;
    }
    if (e.target.closest('[data-stop]')) {
      const inp = e.target.closest('[data-stop]').querySelector('input'); if (e.target !== inp) return;
      const p = data.products.find((x) => x.id === inp.dataset.vis);
      try { await api('products/' + encodeURIComponent(p.id), { method: 'PUT', body: { active: inp.checked } }); p.active = inp.checked; toast(inp.checked ? `${p.name} is visible` : `${p.name} is hidden`); }
      catch (err) { inp.checked = !inp.checked; throw err; }
      return;
    }
    const row = e.target.closest('[data-open]'); if (row && !ui.reorder) openProduct(data.products.find((p) => p.id === row.dataset.open));
  }));
  $('#plist').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-open]')) e.target.click(); });
  $('#pq').addEventListener('input', (e) => { ui.prodQ = e.target.value; paint(); });
  $('#mcat').addEventListener('click', openCategories);
  $('#mlab').addEventListener('click', openLabels);
  paint();
}

const colorRow = (c = { name: '', hex: '#cdb494' }) => `<div class="c"><input type="color" value="${esc(c.hex)}" aria-label="Colour"><input type="text" value="${esc(c.name)}" placeholder="Colour name" maxlength="24" aria-label="Colour name"><button type="button" class="x" data-eye aria-label="Pick this colour from the photo" title="Pick from the photo">${ICON.eye}</button><button type="button" class="x" data-rm aria-label="Remove colour">✕</button></div>`;

/* ---- colours from the photo: tap the dress, or let the dashboard suggest the main colours ---- */
const NAMES = { Black: '#111111', Charcoal: '#3a3a3c', Grey: '#8a8a8a', Silver: '#c4c4c4', White: '#fafafa', Ivory: '#f4efe2', Cream: '#efe3c8', Sand: '#d8c2aa', Beige: '#cdb494', Camel: '#b98a55', Tan: '#a8764a', Brown: '#6b4a2f', Mocha: '#5a3d2e', Rust: '#a8531e', Orange: '#e07a2b', Mustard: '#d1a02c', Yellow: '#eed15a', Lime: '#b5c94a', Olive: '#6f7442', Sage: '#9caf88', Green: '#3f7d4f', Forest: '#1f2b24', Teal: '#2f7f80', 'Sky blue': '#8ec1e0', Blue: '#2f5fa8', Navy: '#1f2a4a', Lilac: '#c4b4de', Purple: '#6b3f9a', Pink: '#e88aa5', Blush: '#ebc7bb', Peach: '#f3c3a1', Red: '#c0262d', Maroon: '#6e1f2a', Wine: '#7a2a3d' };
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const nameColor = (hex) => { const a = rgbOf(hex); let best = 'Colour', d = 1e9; for (const [n, h] of Object.entries(NAMES)) { const b = rgbOf(h), dd = 2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2; if (dd < d) { d = dd; best = n; } } return best; };
function loadPixels(src, max = 700) {
  return new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, c.width, c.height); res({ c, x }); };
    im.onerror = () => rej(new Error('Add a photo first, then pick its colours.')); im.src = src;
  });
}
/** Main colours of the photo, centre-weighted so the garment counts more than the background. */
async function suggestColors(src) {
  const { c, x } = await loadPixels(src, 96), d = x.getImageData(0, 0, c.width, c.height).data, buckets = new Map();
  for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
    const i = (py * c.width + px) * 4; if (d[i + 3] < 200) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const dx = (px / c.width - 0.5) / 0.32, dy = (py / c.height - 0.52) / 0.4, w = Math.exp(-(dx * dx + dy * dy) / 2) * (0.35 + (mx - mn) / 255);
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4), e = buckets.get(k) || { w: 0, r: 0, g: 0, b: 0 };
    e.w += w; e.r += r * w; e.g += g * w; e.b += b * w; buckets.set(k, e);
  }
  const out = [];
  for (const e of [...buckets.values()].sort((a, b) => b.w - a.w)) {
    const col = [e.r / e.w, e.g / e.w, e.b / e.w];
    if (out.every((o) => (o[0] - col[0]) ** 2 + (o[1] - col[1]) ** 2 + (o[2] - col[2]) ** 2 > 3600)) out.push(col);
    if (out.length === 5) break;
  }
  return out.map((v) => hexOf(...v));
}
/** Show the photo big; the person taps a spot and we average a small patch around it. */
function pickFromPhoto(src) {
  return new Promise(async (res, rej) => {
    let px; try { px = await loadPixels(src, 900); } catch (e) { return rej(e); }
    const d = document.createElement('div'); d.className = 'dlg'; d.innerHTML = `<div class="dlg__box pickbox" role="dialog" aria-modal="true" aria-label="Pick a colour"><h2>Tap the colour you want</h2>
      <div class="pickwrap"><canvas></canvas><i class="pickdot" hidden></i></div>
      <div class="pickread"><span class="pickchip"></span><b class="num">Tap the photo</b></div>
      <div class="dlg__btns"><button class="btn" type="button" data-x>Cancel</button><button class="btn btn--ink" type="button" data-ok disabled>Use this colour</button></div></div>`;
    document.body.append(d);
    const cv = $('canvas', d), ctx = cv.getContext('2d'); cv.width = px.c.width; cv.height = px.c.height; ctx.drawImage(px.c, 0, 0);
    { const k = Math.min(Math.min(420, innerWidth - 80) / cv.width, innerHeight * 0.52 / cv.height); cv.style.width = Math.round(cv.width * k) + 'px'; cv.style.height = Math.round(cv.height * k) + 'px'; }
    const dot = $('.pickdot', d), chip = $('.pickchip', d), lab = $('.pickread b', d), ok = $('[data-ok]', d); let hex = '';
    const at = (e) => {
      const r = cv.getBoundingClientRect(), ex = Math.min(r.width, Math.max(0, e.clientX - r.left)), ey = Math.min(r.height, Math.max(0, e.clientY - r.top));
      const sx = Math.round((ex / r.width) * cv.width), sy = Math.round((ey / r.height) * cv.height), n = 3, w = Math.min(n, sx, cv.width - sx - 1, sy, cv.height - sy - 1) || 0;
      const a = px.x.getImageData(Math.max(0, sx - w), Math.max(0, sy - w), 2 * w + 1, 2 * w + 1).data; let R = 0, G = 0, B = 0, N = 0;
      for (let i = 0; i < a.length; i += 4) { R += a[i]; G += a[i + 1]; B += a[i + 2]; N++; }
      hex = hexOf(R / N, G / N, B / N); dot.hidden = false; dot.style.left = ex + 'px'; dot.style.top = ey + 'px'; dot.style.background = hex;
      chip.style.background = hex; lab.textContent = `${hex.toUpperCase()} · ${nameColor(hex)}`; ok.disabled = false;
    };
    let down = false; cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); at(e); }); cv.addEventListener('pointermove', (e) => { if (down) at(e); }); cv.addEventListener('pointerup', () => { down = false; });
    const close = (v) => { d.remove(); v ? res(v) : res(null); };
    $('[data-x]', d).onclick = () => close(null); ok.onclick = () => close(hex); d.addEventListener('click', (e) => { if (e.target === d) close(null); });
  });
}

/* ---------- categories and labels ---------- */
async function openCategories() {
  const data = productsCache, count = (id) => data.products.filter((p) => p.cat === id).length;
  const list = data.categories.filter((c) => c.id !== 'all').map((c) => ({ ...c }));
  const paint = () => {
    $('#catlist').innerHTML = list.map((c, i) => `<div class="catrow" data-i="${i}"><div class="catrow__f"><input data-f="name" value="${esc(c.name)}" maxlength="28" placeholder="Category name" aria-label="Category name"><input data-f="blurb" value="${esc(c.blurb || '')}" maxlength="120" placeholder="Short description (optional)" aria-label="Description"></div>
      <div class="catrow__a"><span class="hint num">${c.id ? count(c.id) : 0} piece${c.id && count(c.id) === 1 ? '' : 's'}</span><span class="arrows"><button type="button" data-mv="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button type="button" data-mv="1" aria-label="Move down" ${i === list.length - 1 ? 'disabled' : ''}>${ICON.down}</button><button type="button" data-del aria-label="Delete category" ${c.id && count(c.id) ? 'disabled title="Move or delete its pieces first"' : ''}>✕</button></span></div></div>`).join('');
  };
  openPanel('Categories', `<p class="hint">Categories group your pieces in the store (shop filters, the collections list and the footer). Empty categories are hidden from customers.</p><div id="catlist" class="catlist"></div><div><button class="btn btn--sm" id="catadd" type="button">+ Add category</button></div><p class="auth__err" id="caterr" role="alert"></p>`, `<button class="btn btn--ink" id="catsave" type="button">Save categories</button>`);
  paint();
  $('#panel-body').onclick = (e) => {
    const row = e.target.closest('.catrow'); if (!row) return; const i = +row.dataset.i;
    const mv = e.target.closest('[data-mv]'); if (mv) { const j = i + Number(mv.dataset.mv); [list[i], list[j]] = [list[j], list[i]]; paint(); }
    if (e.target.closest('[data-del]')) { list.splice(i, 1); paint(); }
  };
  $('#panel-body').oninput = (e) => { const row = e.target.closest('.catrow'); if (row && e.target.dataset.f) list[+row.dataset.i][e.target.dataset.f] = e.target.value; };
  $('#catadd').onclick = () => { list.push({ name: '', blurb: '' }); paint(); $$('.catrow input[data-f=name]').at(-1).focus(); };
  $('#catsave').onclick = guard(async () => {
    $('#caterr').textContent = '';
    try { const r = await api('categories', { method: 'PUT', body: { categories: list.filter((c) => c.name.trim()) } }); data.categories = r.categories; toast('Categories saved'); closePanel(); render(); }
    catch (err) { if (err.status === 401) throw err; $('#caterr').textContent = err.message; }
  });
}
async function openLabels() {
  const data = productsCache, count = (n) => data.products.filter((p) => p.tag === n).length;
  const list = (data.labels || []).map((l) => ({ ...l }));
  const paint = () => {
    $('#lablist').innerHTML = list.map((l, i) => `<div class="labrow" data-i="${i}"><input data-f="name" value="${esc(l.name)}" maxlength="18" placeholder="Label name" aria-label="Label name">
      <label class="switch" title="Give this label a colour"><input type="checkbox" data-f="use" ${l.color ? 'checked' : ''}><i></i></label><input type="color" data-f="color" value="${esc(l.color || '#a8531e')}" ${l.color ? '' : 'disabled'} aria-label="Label colour">
      <span class="hint num">${count(l.name)}</span><button type="button" class="x" data-del aria-label="Delete label">✕</button></div>`).join('') || '<p class="empty">No labels yet</p>';
  };
  openPanel('Labels', `<p class="hint">Labels are the small tags on a piece's photo, like New or Bestseller. Colour them to make them stand out.</p><div id="lablist" class="catlist"></div><div><button class="btn btn--sm" id="labadd" type="button">+ Add label</button></div><p class="auth__err" id="laberr" role="alert"></p>`, `<button class="btn btn--ink" id="labsave" type="button">Save labels</button>`);
  paint();
  $('#panel-body').onclick = (e) => { const row = e.target.closest('.labrow'); if (row && e.target.closest('[data-del]')) { list.splice(+row.dataset.i, 1); paint(); } };
  $('#panel-body').oninput = (e) => {
    const row = e.target.closest('.labrow'); if (!row) return; const l = list[+row.dataset.i], f = e.target.dataset.f;
    if (f === 'name') l.name = e.target.value; else if (f === 'color') l.color = e.target.value; else if (f === 'use') { l.color = e.target.checked ? ($('[data-f=color]', row).value || '#a8531e') : ''; $('[data-f=color]', row).disabled = !e.target.checked; }
  };
  $('#labadd').onclick = () => { list.push({ name: '', color: '' }); paint(); $$('.labrow input[data-f=name]').at(-1).focus(); };
  $('#labsave').onclick = guard(async () => {
    try { const { settings } = await api('settings', { method: 'PUT', body: { labels: list.filter((l) => l.name.trim()) } }); data.labels = settings.labels; toast('Labels saved'); closePanel(); render(); }
    catch (err) { if (err.status === 401) throw err; $('#laberr').textContent = err.message; }
  });
}

function openProduct(p, preset = {}) {
  const isNew = !p || preset.copy;
  const base = p || { name: '', cat: productsCache.categories.find((c) => c.id !== 'all')?.id, price: '', was: '', tag: null, blurb: '', details: [], colors: [{ name: 'Sand', hex: '#d8c2aa' }], stock: Object.fromEntries(SIZES.map((s) => [s, 5])), photo: '', active: true };
  const prod = { ...base, ...preset };
  const photos = [...new Set(productsCache.products.map((x) => x.photo).filter((x) => x && !x.startsWith('data:')))];
  let chosen = prod.photo || '';
  const catOpts = productsCache.categories.filter((c) => c.id !== 'all').map((c) => `<option value="${esc(c.id)}" ${prod.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('') + '<option value="__new">＋ New category…</option>';
  const labs = productsCache.labels || [];
  const labOpts = '<option value="">None</option>' + [...labs.map((l) => l.name), ...(prod.tag && !labs.some((l) => l.name === prod.tag) ? [prod.tag] : [])].map((n) => `<option ${prod.tag === n ? 'selected' : ''}>${esc(n)}</option>`).join('') + '<option value="__new">＋ New label…</option>';
  const body = `
    <form id="pform" style="display:grid;gap:16px" novalidate>
      <section class="sec"><h3>Photo</h3><div class="photo"><img id="pprev" src="${esc(photo(chosen))}" alt="" ${chosen ? '' : 'hidden'}><div style="display:grid;gap:10px;min-width:0">
        <label class="btn btn--sm" style="width:fit-content">Upload photo<input type="file" id="pfile" accept="image/*" hidden></label><p class="hint">Portrait photos work best. Large images are resized for you.</p>
        <div class="picker" id="ppick" role="group" aria-label="Pick an existing photo">${photos.map((ph) => `<button type="button" aria-pressed="${ph === chosen}" data-ph="${esc(ph)}"><img src="${esc(photo(ph))}" alt="" loading="lazy"></button>`).join('')}</div></div></div></section>
      <section class="sec"><h3>Details</h3>
        <label class="field"><span>Name</span><input name="name" value="${esc(prod.name)}" maxlength="80" required></label>
        <div class="row2"><label class="field"><span>Category</span><select name="cat">${catOpts}</select></label><label class="field"><span>Label</span><select name="tag">${labOpts}</select></label></div>
        <div class="row2"><label class="field" id="newcat-f" hidden><span>New category name</span><input id="newcat" maxlength="28" placeholder="e.g. Co-ord sets"></label><label class="field" id="newlab-f" hidden><span>New label name</span><input id="newlab" maxlength="18" placeholder="e.g. Limited"></label></div>
        <div class="row2"><label class="field"><span>Price (₹)</span><input name="price" type="number" inputmode="numeric" min="1" value="${esc(prod.price)}" required></label><label class="field"><span>Compare-at (₹)</span><input name="was" type="number" inputmode="numeric" min="1" value="${esc(prod.was ?? '')}" placeholder="Optional"></label></div>
        <label class="field"><span>Description</span><textarea name="blurb" maxlength="600">${esc(prod.blurb)}</textarea></label>
        <label class="field"><span>Details, one per line</span><textarea name="details" maxlength="800">${esc((prod.details || []).join('\n'))}</textarea></label></section>
      <section class="sec"><h3>Stock by size</h3><div class="row5">${SIZES.map((s) => `<label class="field"><span>${s}</span><input name="stock-${s}" type="number" inputmode="numeric" min="0" max="9999" value="${prod.stock?.[s] ?? 0}"></label>`).join('')}</div></section>
      <section class="sec"><h3>Colours</h3><div class="colors" id="pcolors">${(prod.colors || []).map(colorRow).join('')}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn--sm" id="padd-color">+ Add colour</button><button type="button" class="btn btn--sm" id="psuggest">${ICON.eye} Suggest from photo</button></div><div class="sugs" id="psugs" hidden></div><p class="hint">Tap the ${'eyedropper'} on a colour, then tap the dress in the photo to copy its exact colour.</p></section>
      <section class="sec"><label class="switch"><input type="checkbox" name="active" ${prod.active === false ? '' : 'checked'}><i></i><span>Visible in the store</span></label></section>
      <p class="auth__err" id="perr" role="alert"></p>
    </form>`;
  openPanel(isNew ? (preset.copy ? 'Duplicate piece' : 'New piece') : prod.name, body, `${isNew ? '' : '<button class="btn btn--danger" id="pdel" type="button" style="margin-right:auto;flex:0 0 auto">Delete</button><button class="btn" id="pdup" type="button">Duplicate</button>'}<button class="btn btn--ink" id="psave" type="button">${isNew ? 'Add piece' : 'Save changes'}</button>`);
  const setPhoto = (src) => { chosen = src; const im = $('#pprev'); im.src = photo(src); im.hidden = !src; $$('#ppick button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ph === src))); };
  $$('#ppick button').forEach((b) => b.addEventListener('click', () => setPhoto(b.dataset.ph)));
  $('#pfile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; const btn = e.target.closest('label'); btn?.classList.add('is-busy'); try { setPhoto(await uploadImage(f)); toast('Photo added'); } catch (err) { toast(err.message, { err: true }); } btn?.classList.remove('is-busy'); });
  $('#padd-color').addEventListener('click', () => $('#pcolors').insertAdjacentHTML('beforeend', colorRow()));
  $('#pcolors').addEventListener('click', guard(async (e) => {
    if (e.target.closest('[data-rm]')) { e.target.closest('.c').remove(); return; }
    const eye = e.target.closest('[data-eye]'); if (!eye) return;
    if (!chosen) { toast('Add a photo first', { err: true }); return; }
    const hex = await pickFromPhoto(photo(chosen)); if (!hex) return;
    const row = eye.closest('.c'), nm = $('input[type=text]', row); $('input[type=color]', row).value = hex; if (!nm.value.trim()) nm.value = nameColor(hex);
  }));
  $('#psuggest').addEventListener('click', guard(async () => {
    if (!chosen) { toast('Add a photo first', { err: true }); return; }
    const hexes = await suggestColors(photo(chosen)), box = $('#psugs');
    box.hidden = false; box.innerHTML = hexes.map((h) => `<button type="button" data-h="${h}" style="background:${h}" title="${nameColor(h)} ${h}" aria-label="Add ${nameColor(h)}"></button>`).join('') + '<span class="hint">Tap a colour to add it</span>';
  }));
  $('#psugs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    $('#pcolors').insertAdjacentHTML('beforeend', colorRow({ name: nameColor(b.dataset.h), hex: b.dataset.h })); b.remove();
  });
  const toggleNew = () => { $('#newcat-f').hidden = $('[name=cat]').value !== '__new'; $('#newlab-f').hidden = $('[name=tag]').value !== '__new'; };
  $('[name=cat]').addEventListener('change', () => { toggleNew(); if (!$('#newcat-f').hidden) $('#newcat').focus(); });
  $('[name=tag]').addEventListener('change', () => { toggleNew(); if (!$('#newlab-f').hidden) $('#newlab').focus(); });
  $('#psave').addEventListener('click', guard(async () => {
    const f = $('#pform'), fd = new FormData(f), v = (k) => fd.get(k);
    $('#perr').textContent = '';
    let cat = v('cat'), tag = v('tag') || '';
    try {
      if (cat === '__new') {                                         // make the new category first
        const nm = $('#newcat').value.trim(); if (!nm) throw new Error('Type a name for the new category.');
        const r = await api('categories', { method: 'PUT', body: { categories: [...productsCache.categories.filter((c) => c.id !== 'all'), { name: nm, blurb: '' }] } });
        productsCache.categories = r.categories; cat = r.categories.at(-1).id;
      }
      if (tag === '__new') {
        const nm = $('#newlab').value.trim(); if (!nm) throw new Error('Type a name for the new label.');
        const { settings } = await api('settings', { method: 'PUT', body: { labels: [...(productsCache.labels || []), { name: nm, color: '' }] } });
        productsCache.labels = settings.labels; tag = settings.labels.find((l) => l.name.toLowerCase() === nm.toLowerCase())?.name || nm;
      }
    } catch (err) { $('#perr').textContent = err.message; if (err.status === 401) throw err; return; }
    const payload = {
      name: v('name'), cat, tag, price: v('price'), was: v('was'), blurb: v('blurb'), photo: chosen,
      details: String(v('details')).split('\n'), active: f.active.checked,
      stock: Object.fromEntries(SIZES.map((s) => [s, v('stock-' + s)])),
      colors: $$('#pcolors .c').map((r) => ({ hex: $('input[type=color]', r).value, name: $('input[type=text]', r).value.trim() })),
    };
    const btn = $('#psave'); btn.disabled = true;
    try {
      await api(isNew ? 'products' : 'products/' + encodeURIComponent(p.id), { method: isNew ? 'POST' : 'PUT', body: payload });
      toast(isNew ? 'Piece added' : 'Saved'); closePanel(); if (route === 'products') render();
    } catch (err) { $('#perr').textContent = err.message; if (err.status === 401) return; throw err; }
    finally { btn.disabled = false; }
  }));
  $('#pdup')?.addEventListener('click', () => { closePanel(true); setTimeout(() => openProduct(null, { ...prod, name: prod.name + ' copy', active: false, copy: true, tag: null }), 50); });
  $('#pdel')?.addEventListener('click', guard(async () => {
    if (!(await confirmBox({ title: `Delete "${prod.name}"?`, text: 'This cannot be undone. To just take it off the store, switch off "Visible in the store" instead.', yes: 'Delete', danger: true }))) return;
    await api('products/' + encodeURIComponent(p.id), { method: 'DELETE', body: {} }); toast('Deleted'); closePanel(); render();
  }));
}

function shrink(file, max = 1400) {
  return new Promise((res, rej) => {
    if (!file.type.startsWith('image/')) return rej(new Error('Choose an image file'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      for (const q of [0.84, 0.74, 0.62, 0.5, 0.4]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 850000) return res(d); }
      rej(new Error('That photo is too detailed. Try a smaller one.'));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image')); };
    im.src = url;
  });
}
/** Resize in the browser, store it on the server and get back a short /api/img/… link. */
async function uploadImage(file) { const { url } = await api('image', { method: 'POST', body: { data: await shrink(file) } }); return url; }

/* ---------- inventory (every size at a glance, edit in place) ---------- */
async function viewInventory() {
  const [data, { settings: st }] = await Promise.all([api('products'), api('settings')]); productsCache = data; session.threshold = st.lowStock;
  const edits = new Map();                                                // id -> { size: value }
  const orig = (p, s) => p.stock?.[s] ?? 0;
  els.view.innerHTML = `<div class="bar"><div class="tabs"><button class="chip" type="button" id="invlow" aria-pressed="${ui.invLow}">Low or sold out only</button></div><input type="search" id="invq" placeholder="Search pieces" aria-label="Search pieces" value="${esc(ui.invQ)}"></div>
    <section class="card inv" id="invlist"></section><div id="invbar"></div>`;
  const dirtyCount = () => edits.size;
  const paintBar = () => {
    const n = dirtyCount();
    $('#invbar').innerHTML = n ? `<div class="savebar"><b>${n} piece${n === 1 ? '' : 's'} changed</b><span style="display:flex;gap:8px"><button class="btn" type="button" id="invdisc" style="background:transparent;color:#fff;border-color:#fff">Discard</button><button class="btn" type="button" id="invsave">Save stock</button></span></div>` : '';
    $('#invdisc')?.addEventListener('click', () => { edits.clear(); paint(); });
    $('#invsave')?.addEventListener('click', guard(async () => {
      const updates = [...edits].map(([id, stock]) => ({ id, stock }));
      await api('stock', { method: 'POST', body: { updates } });
      for (const u of updates) { const p = data.products.find((x) => x.id === u.id); Object.assign(p.stock, u.stock); }
      edits.clear(); toast('Stock saved'); paint();
    }));
  };
  dirtyGuard = async () => (!edits.size || confirmBox({ title: 'Leave without saving?', text: 'Your stock changes have not been saved.', yes: 'Leave', danger: true }));
  const paint = () => {
    const q = ui.invQ.trim().toLowerCase();
    const list = data.products.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!ui.invLow || SIZES.some((s) => orig(p, s) <= (session.threshold ?? 2))));
    $('#invlow').setAttribute('aria-pressed', ui.invLow);
    $('#invlist').innerHTML = list.length ? list.map((p) => `<div class="inv__row"><div class="meta"><img class="thumb" src="${esc(photo(p.photo))}" alt="" loading="lazy"><div style="min-width:0"><b>${esc(p.name)}</b><span class="sub">${p.active === false ? 'Hidden · ' : ''}${inr(p.price)}</span></div></div>
      <div class="inv__sizes">${SIZES.map((s) => { const v = edits.get(p.id)?.[s] ?? orig(p, s); return `<label>${s}<input type="number" inputmode="numeric" min="0" max="9999" value="${v}" data-id="${esc(p.id)}" data-s="${s}" class="${edits.get(p.id)?.[s] !== undefined ? 'dirty' : v === 0 ? 'out' : v <= 2 ? 'low' : ''}" aria-label="${esc(p.name)} size ${s}"></label>`; }).join('')}</div></div>`).join('') : '<p class="empty">Nothing to show</p>';
    paintBar();
  };
  $('#invlist').addEventListener('input', (e) => {
    const i = e.target.closest('input[data-id]'); if (!i) return;
    const p = data.products.find((x) => x.id === i.dataset.id), v = Math.max(0, Math.min(9999, Math.round(Number(i.value) || 0)));
    const cur = edits.get(p.id) || {};
    if (v === orig(p, i.dataset.s)) delete cur[i.dataset.s]; else cur[i.dataset.s] = v;
    Object.keys(cur).length ? edits.set(p.id, cur) : edits.delete(p.id);
    i.className = cur[i.dataset.s] !== undefined ? 'dirty' : v === 0 ? 'out' : v <= 2 ? 'low' : ''; paintBar();
  });
  $('#invlist').addEventListener('focusin', (e) => { if (e.target.matches('input[type=number]')) e.target.select(); });
  $('#invlow').addEventListener('click', () => { ui.invLow = !ui.invLow; paint(); });
  $('#invq').addEventListener('input', (e) => { ui.invQ = e.target.value; paint(); });
  paint();
}

/* ---------- customers ---------- */
async function viewCustomers() {
  const { customers } = await api('customers');
  action('Export CSV', () => downloadCsv('levit-customers.csv', [['Name', 'Email', 'Phone', 'City', 'Orders', 'Spent', 'First order', 'Last order'], ...customers.map((c) => [c.name, c.email, c.phone, c.city, c.orders, c.spent, c.first, c.last])]));
  els.view.innerHTML = `<div class="bar"><p class="hint">${customers.length} customer${customers.length === 1 ? '' : 's'}, grouped by email</p><input type="search" id="cq" placeholder="Search customers" aria-label="Search customers" value="${esc(ui.custQ)}"></div><section class="card rows" id="clist"></section>`;
  const paint = () => {
    const q = ui.custQ.trim().toLowerCase(), list = customers.filter((c) => !q || [c.name, c.email, c.phone, c.city].join(' ').toLowerCase().includes(q));
    $('#clist').innerHTML = list.length ? list.map((c) => `<div class="row row--cust" style="cursor:default"><div class="meta"><b>${esc(c.name)}</b>${c.orders > 1 ? ' <span class="pill s-delivered">repeat</span>' : ''}<span class="sub">${esc(c.city)} · ${c.orders} order${c.orders === 1 ? '' : 's'} · ${inr(c.spent)} · last ${ago(c.last)}</span><span class="sub">${esc(c.email)} · ${esc(c.phone)}</span></div>
      <div style="display:flex;gap:6px"><a class="icon" href="${waLink(c.phone, `Hi ${c.name.split(' ')[0]}, thank you for shopping with LEVIT!`)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICON.wa}</a><a class="icon" href="tel:${esc(c.phone)}" aria-label="Call">${ICON.phone}</a><a class="icon" href="mailto:${esc(c.email)}" aria-label="Email">${ICON.mail}</a></div></div>`).join('') : `<p class="empty">${customers.length ? 'No one matches' : 'Customers appear after their first order'}</p>`;
  };
  $('#cq').addEventListener('input', (e) => { ui.custQ = e.target.value; paint(); });
  paint();
}

/* ---------- offers and coupons ---------- */
let settingsCache = null;
async function saveSettingsPatch(patch) { const { settings } = await api('settings', { method: 'PUT', body: patch }); settingsCache = settings; session.threshold = settings.lowStock; return settings; }
async function viewOffers() {
  const [{ settings: s }, ov] = await Promise.all([api('settings'), api('overview?days=30')]);
  settingsCache = s;
  action('+ New coupon', () => openCoupon(), 'btn--ink');
  const uses = Object.fromEntries(ov.coupons.map((c) => [c.code, c.used]));
  const cdesc = (c) => `${c.type === 'pct' ? c.value + '% off' : inr(c.value) + ' off'}${c.min ? ` over ${inr(c.min)}` : ''}${c.expires ? ` · until ${new Date(c.expires).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`;
  els.view.innerHTML = `
    <section class="card"><div class="card__h"><h2>Welcome offer</h2><span class="code">${esc(s.offer.code)}</span></div><form class="card__b" id="wform" style="display:grid;gap:14px" novalidate>
      <p class="hint">Shown to new visitors as a scratch card a few seconds after they arrive. The discount is applied automatically.</p>
      <label class="switch"><input type="checkbox" name="active" ${s.offer.active ? 'checked' : ''}><i></i><span>Offer is on</span></label>
      <div class="row2"><label class="field"><span>Code</span><input name="code" value="${esc(s.offer.code)}" maxlength="16" style="text-transform:uppercase" autocapitalize="characters"></label><label class="field"><span>Discount (%)</span><input name="pct" type="number" inputmode="numeric" min="1" max="90" value="${s.offer.pct}"></label></div>
      <label class="field"><span>Show popup after (seconds)</span><input name="delay" type="number" inputmode="numeric" min="0" max="120" value="${s.offer.delay}"></label>
      <p class="hint num"><b>${ov.offer.claimed}</b> scratched · <b>${ov.offer.redeemed}</b> used at checkout</p>
      <div><button class="btn btn--ink" type="submit">Save welcome offer</button></div></form></section>
    <section class="card"><div class="card__h"><h2>Coupons</h2><small>${s.coupons.length} code${s.coupons.length === 1 ? '' : 's'}</small></div>
      ${s.coupons.length ? `<div class="rows">${s.coupons.map((c) => `<div class="row row--coupon" data-code="${esc(c.code)}" tabindex="0" role="button"><div class="meta"><span class="code">${esc(c.code)}</span> <span class="pill ${c.active ? 's-live' : 's-draft'}">${c.active ? 'active' : 'off'}</span><span class="sub" style="margin-top:6px">${esc(cdesc(c))}</span><span class="sub num">${uses[c.code] || 0} used${c.limit ? ` of ${c.limit}` : ''}${c.note ? ' · ' + esc(c.note) : ''}</span></div><span>${ICON.down.replace('m6 9 6 6 6-6', 'm9 6 6 6-6 6')}</span></div>`).join('')}</div>` : '<p class="empty">No coupons yet. Make one for a festival, an influencer or a loyal customer.</p>'}
      <div class="card__b"><p class="hint">Customers type a coupon in the bag. Percent or fixed amount, an optional minimum order, a usage limit and an expiry date.</p></div></section>`;
  $('#wform').addEventListener('submit', guard(async (e) => {
    e.preventDefault(); const f = e.target;
    await saveSettingsPatch({ offer: { code: f.code.value, pct: f.pct.value, delay: f.delay.value, active: f.active.checked } }); toast('Welcome offer saved'); render();
  }));
  const open = (el) => openCoupon(s.coupons.find((c) => c.code === el.dataset.code));
  $$('.row--coupon').forEach((r) => { r.addEventListener('click', () => open(r)); r.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(r); }); });
}
function openCoupon(c) {
  const isNew = !c; c = c || { code: '', type: 'pct', value: 10, min: 0, limit: 0, active: true, expires: '', note: '' };
  let type = c.type;
  openPanel(isNew ? 'New coupon' : c.code, `<form id="cform" style="display:grid;gap:16px" novalidate>
    <section class="sec"><label class="field"><span>Code</span><input name="code" value="${esc(c.code)}" maxlength="16" style="text-transform:uppercase;letter-spacing:.1em" autocapitalize="characters" autocomplete="off" placeholder="FESTIVE20" ${isNew ? '' : 'readonly'}></label>
      <div class="field"><span>Type</span><div class="seg" id="ctype"><button type="button" data-t="pct" aria-pressed="${type === 'pct'}">Percent off</button><button type="button" data-t="flat" aria-pressed="${type === 'flat'}">Fixed ₹ off</button></div></div>
      <div class="row2"><label class="field"><span id="cvl">${type === 'pct' ? 'Percent' : 'Amount (₹)'}</span><input name="value" type="number" inputmode="numeric" min="1" value="${c.value}"></label><label class="field"><span>Minimum order (₹)</span><input name="min" type="number" inputmode="numeric" min="0" value="${c.min}"></label></div>
      <div class="row2"><label class="field"><span>Usage limit</span><input name="limit" type="number" inputmode="numeric" min="0" value="${c.limit}"><small>0 means unlimited</small></label><label class="field"><span>Expires</span><input name="expires" type="date" value="${esc(c.expires)}"><small>Leave empty for no expiry</small></label></div>
      <label class="field"><span>Note (private)</span><input name="note" value="${esc(c.note)}" maxlength="60" placeholder="Who is this for?"></label>
      <label class="switch"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}><i></i><span>Active</span></label></section><p class="auth__err" id="cerr" role="alert"></p></form>`,
  `${isNew ? '' : '<button class="btn btn--danger" id="cdel" type="button" style="margin-right:auto;flex:0 0 auto">Delete</button>'}<button class="btn btn--ink" id="csave" type="button">${isNew ? 'Create coupon' : 'Save'}</button>`);
  $('#ctype').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; type = b.dataset.t; $$('#ctype button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#cvl').textContent = type === 'pct' ? 'Percent' : 'Amount (₹)'; });
  const save = (list) => saveSettingsPatch({ coupons: list });
  $('#csave').addEventListener('click', guard(async () => {
    const f = $('#cform'); const code = f.code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 3) { $('#cerr').textContent = 'Use at least 3 letters or numbers for the code.'; return; }
    if (isNew && (settingsCache.coupons.some((x) => x.code === code) || code === settingsCache.offer.code)) { $('#cerr').textContent = 'That code already exists.'; return; }
    const next = { code, type, value: f.value.value, min: f.min.value, limit: f.limit.value, expires: f.expires.value, note: f.note.value, active: f.active.checked };
    await save(isNew ? [...settingsCache.coupons, next] : settingsCache.coupons.map((x) => (x.code === c.code ? next : x)));
    toast(isNew ? `${code} created` : 'Saved'); closePanel(); render();
  }));
  $('#cdel')?.addEventListener('click', guard(async () => {
    if (!(await confirmBox({ title: `Delete ${c.code}?`, text: 'Customers will no longer be able to use it.', yes: 'Delete', danger: true }))) return;
    await save(settingsCache.coupons.filter((x) => x.code !== c.code)); toast('Deleted'); closePanel(); render();
  }));
}

/* ---------- content (CMS) ---------- */
async function viewContent() {
  const { schema, groups, values } = await api('content');
  const eff = (f) => values[f.key] ?? f.def;                                  // what the store shows right now
  const orig = Object.fromEntries(schema.map((f) => [f.key, eff(f)]));
  const cur = { ...orig };
  const hints = { title: 'New line = line break. Put *stars* around words to make them italic.', head: 'Two lines. The second line is shown in italics.', lines: 'One message per line.', long: '', text: '', url: 'Paste the full link.', phone: 'Digits with country code, e.g. +91 98765 43210.' };
  action('Preview store ↗', () => window.open('../', '_blank', 'noopener'));
  els.view.innerHTML = `<div id="cmsroot" style="display:grid;gap:18px"><p class="hint">Edit the words on your store. Changes go live as soon as you save. Clear a box or tap Reset to bring the original text back.</p>
    ${groups.map((g, gi) => `<details class="grp" data-g="${g.id}" ${gi === 0 ? 'open' : ''}><summary><div><b>${esc(g.name)}</b><small>${esc(g.hint)}</small></div><span class="dot" hidden></span></summary><div class="grp__b">
      ${schema.filter((f) => f.group === g.id).map((f) => {
        if (f.kind === 'image') return `<div class="field" data-k="${esc(f.key)}"><div class="fhead"><span class="lbl">${esc(f.label)}</span><button type="button" data-reset="${esc(f.key)}">Reset</button></div>
          <div class="imgf"><img data-prev="${esc(f.key)}" src="${esc(photo(cur[f.key]))}" alt=""><div class="imgf__btns"><label class="btn btn--sm">Upload photo<input type="file" accept="image/*" hidden data-up="${esc(f.key)}"></label><button class="btn btn--sm" type="button" data-pick="${esc(f.key)}">Choose from library</button></div></div></div>`;
        const big = ['long', 'lines', 'title', 'head'].includes(f.kind), rows = f.kind === 'long' ? 3 : f.kind === 'lines' ? 4 : 2;
        return `<div class="field" data-k="${esc(f.key)}"><div class="fhead"><span class="lbl">${esc(f.label)}</span><button type="button" data-reset="${esc(f.key)}">Reset</button></div>
          ${big ? `<textarea data-key="${esc(f.key)}" rows="${rows}" style="min-height:0" placeholder="${esc(f.def || '(empty)')}">${esc(cur[f.key])}</textarea>` : `<input data-key="${esc(f.key)}" value="${esc(cur[f.key])}" placeholder="${esc(f.def || '(empty)')}" ${f.kind === 'url' ? 'inputmode="url"' : f.kind === 'phone' ? 'inputmode="tel"' : ''}>`}
          ${hints[f.kind] ? `<small>${hints[f.kind]}</small>` : ''}</div>`;
      }).join('')}</div></details>`).join('')}
    <div id="cmsbar"></div></div>`;
  const root = $('#cmsroot');
  const changed = () => schema.filter((f) => (cur[f.key] ?? '').trim() !== (orig[f.key] ?? '').trim());
  const mark = () => {
    const ch = new Set(changed().map((f) => f.group));
    $$('.grp').forEach((d) => { $('.dot', d).hidden = !ch.has(d.dataset.g); });
    const n = changed().length;
    $('#cmsbar').innerHTML = n ? `<div class="savebar"><b>${n} change${n === 1 ? '' : 's'}</b><span style="display:flex;gap:8px"><button class="btn" type="button" id="cmsdisc" style="background:transparent;color:#fff;border-color:#fff">Discard</button><button class="btn" type="button" id="cmssave">Publish changes</button></span></div>` : '';
    $('#cmsdisc')?.addEventListener('click', () => render());
    $('#cmssave')?.addEventListener('click', guard(async () => {
      const body = Object.fromEntries(changed().map((f) => [f.key, cur[f.key]]));
      const b = $('#cmssave'); b.disabled = true;
      try { await api('content', { method: 'PUT', body }); toast('Published. Your store is updated.'); dirtyGuard = null; render(); } finally { b.disabled = false; }
    }));
  };
  dirtyGuard = async () => (!changed().length || confirmBox({ title: 'Leave without publishing?', text: 'Your content changes have not been saved.', yes: 'Leave', danger: true }));
  root.addEventListener('input', (e) => { const k = e.target.dataset.key; if (!k) return; cur[k] = e.target.value; mark(); });
  root.addEventListener('click', (e) => {
    const r = e.target.closest('[data-reset]'); if (!r) return;
    const f = schema.find((x) => x.key === r.dataset.reset); cur[f.key] = f.def;
    if (f.kind === 'image') $(`[data-prev="${CSS.escape(f.key)}"]`).src = photo(f.def); else $(`[data-key="${CSS.escape(f.key)}"]`).value = f.def;
    mark();
  });
  const setImg = (key, url) => { cur[key] = url; $(`[data-prev="${CSS.escape(key)}"]`).src = photo(url); mark(); };
  root.addEventListener('change', guard(async (e) => {
    const inp = e.target.closest('[data-up]'); if (!inp || !inp.files[0]) return;
    const lab = inp.closest('label'); lab.classList.add('is-busy');
    try { setImg(inp.dataset.up, await uploadImage(inp.files[0])); toast('Photo added. Press Publish to show it.'); } finally { lab.classList.remove('is-busy'); inp.value = ''; }
  }));
  root.addEventListener('click', guard(async (e) => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const key = b.dataset.pick;
    const [{ products }, { images }] = await Promise.all([api('products'), api('image')]);
    const site = [...new Set([...products.map((x) => x.photo), 'img/boutique.webp', 'img/model-noir.webp', 'img/knit-rust.webp', ...schema.filter((x) => x.kind === 'image').map((x) => x.def)])].filter((x) => x && !x.startsWith('data:'));
    const up = images.map((i) => i.url);
    const grid = (list) => `<div class="lib">${list.map((u) => `<button type="button" data-u="${esc(u)}" aria-label="Use this photo"><img src="${esc(photo(u))}" alt="" loading="lazy"></button>`).join('')}</div>`;
    openPanel('Choose a photo', `${up.length ? `<section class="sec"><h3>Uploaded by you</h3>${grid(up)}</section>` : ''}<section class="sec"><h3>Site photos</h3>${grid(site)}</section>`);
    $('#panel-body').onclick = (ev) => { const u = ev.target.closest('[data-u]'); if (!u) return; setImg(key, u.dataset.u); closePanel(); };
  }));
  mark();
}

/* ---------- activity ---------- */
async function viewActivity() {
  const { activity } = await api('activity');
  els.view.innerHTML = `<section class="card rows">${activity.length ? activity.map((a) => `<div class="row row--log"><span>${esc(a.text)}</span><time title="${esc(when(a.at, true))}">${ago(a.at)}</time></div>`).join('') : '<p class="empty">Changes made in the dashboard and new orders are listed here.</p>'}</section>`;
}

/* ---------- settings ---------- */
async function viewSettings() {
  const { settings: s } = await api('settings'); settingsCache = s;
  els.view.innerHTML = `
    <form id="sform" class="grid g2" novalidate>
      <section class="card"><div class="card__h"><h2>Shipping and fees</h2></div><div class="card__b" style="display:grid;gap:14px">
        <label class="field"><span>Free shipping above (₹)</span><input name="freeShip" type="number" inputmode="numeric" min="0" value="${s.freeShip}"></label>
        <label class="field"><span>Shipping fee (₹)</span><input name="shipFee" type="number" inputmode="numeric" min="0" value="${s.shipFee}"></label>
        <label class="field"><span>Cash on delivery fee (₹)</span><input name="codFee" type="number" inputmode="numeric" min="0" value="${s.codFee}"></label>
        <label class="field"><span>Low stock alert at (units per size)</span><input name="lowStock" type="number" inputmode="numeric" min="0" max="50" value="${s.lowStock}"></label>
      </div></section>
      <section class="card"><div class="card__h"><h2>Pause orders</h2></div><div class="card__b" style="display:grid;gap:14px">
        <p class="hint">Going on holiday or out of stock everywhere? Pausing shows a bar on the store and stops checkout until you switch it back on.</p>
        <label class="switch"><input type="checkbox" name="paused" ${s.paused ? 'checked' : ''}><i></i><span>Orders are paused</span></label>
        <label class="field"><span>Message shown to customers</span><textarea name="pauseMessage" maxlength="200" rows="3" style="min-height:0">${esc(s.pauseMessage)}</textarea></label>
      </div></section>
      <div style="grid-column:1/-1"><button class="btn btn--ink btn--lg" type="submit" id="ssave">Save settings</button></div>
    </form>
    <div class="grid g2">
      <section class="card"><div class="card__h"><h2>Backup</h2></div><div class="card__b" style="display:grid;gap:12px"><p class="hint">Download everything (products, orders, settings, content) as one file. Do this before big changes.</p><div><button class="btn" type="button" id="bk">Download backup</button></div></div></section>
      <section class="card"><div class="card__h"><h2>This dashboard</h2></div><div class="card__b" style="display:grid;gap:8px">
        <p class="hint num">Storage: <b>${session.persistent ? `permanent (${esc(session.storage || 'database')})` : 'temporary (resets on restart)'}</b></p>
        <p class="hint">Password: set by the <code>ADMIN_PASSWORD</code> variable in Vercel. Change it there and redeploy.</p>
        <p class="hint">Tip: on your phone, use Share → Add to Home Screen to open the dashboard like an app.</p>
        <div><button class="btn btn--sm" type="button" id="so">Sign out</button></div></div></section>
    </div>`;
  $('#sform').addEventListener('submit', guard(async (e) => {
    e.preventDefault(); const f = e.target, btn = $('#ssave'); btn.disabled = true;
    try { await saveSettingsPatch({ freeShip: f.freeShip.value, shipFee: f.shipFee.value, codFee: f.codFee.value, lowStock: f.lowStock.value, paused: f.paused.checked, pauseMessage: f.pauseMessage.value }); toast('Settings saved'); render(); }
    finally { btn.disabled = false; }
  }));
  $('#bk').addEventListener('click', guard(async () => {
    const d = await api('backup'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' })); a.download = `levit-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Backup downloaded');
  }));
  $('#so').addEventListener('click', signOut);
}

boot();
