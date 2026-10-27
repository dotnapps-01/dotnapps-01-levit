/* Welcome offer: a little while after arriving, a card asks to be scratched. Scratching it (or tapping
   "Show my offer") unlocks LEVIT10, which the bag and checkout then apply. Shown once per visit. */
const SEEN = 'levit.offer.seen';
const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initOffer({ claimed, code: CODE = 'LEVIT10', pct: PCT = 10, delay = 9, active = true }) {
  const dlg = $('#offer');
  if (!dlg || !active) return;
  const DELAY = delay * 1000;
  $('#offer-code').textContent = CODE; $('.offer__prize b').textContent = `${PCT}% off`; $('#offer-copy').textContent = `Copy code ${CODE}`;
  const cv = $('#offer-cv'), card = $('#offer-card'), ctx = cv.getContext('2d', { willReadFrequently: true });
  let done = false, down = false, lx = 0, ly = 0, n = 0, W = 0, H = 0, tries = 0;

  const paint = () => {
    W = cv.width = Math.round(card.clientWidth); H = cv.height = Math.round(card.clientHeight);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#E8D6BF'); g.addColorStop(.5, '#D8C2AA'); g.addColorStop(1, '#C7AC8E');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .12; for (let k = 0; k < 420; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#6b4a2b'; ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4); } ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(80,55,30,.16)'; ctx.lineWidth = 1; for (let y = 0; y < H; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 3); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#0B0907';
    ctx.font = `900 ${Math.round(W * 0.26)}px "Playfair Display", serif`; ctx.fillText('LEVIT', W / 2, H * 0.4);
    ctx.font = `500 ${Math.round(W * 0.04)}px Jost, sans-serif`; ctx.fillStyle = 'rgba(11,9,7,.65)'; ctx.fillText('W E L C O M E   G I F T', W / 2, H * 0.58);
    ctx.fillStyle = '#A8531E'; ctx.fillText('S C R A T C H   H E R E', W / 2, H * 0.84);
  };
  const cleared = () => { const d = ctx.getImageData(0, 0, W, H).data; let c = 0, t = 0; for (let y = 0; y < H; y += 12) for (let x = 0; x < W; x += 12) { t++; if (d[(y * W + x) * 4 + 3] < 40) c++; } return c / t; };

  const confetti = () => {
    if (reduced) return;
    const colors = ['#A8531E', '#E7CD8B', '#D9D0E8', '#EBC7BB', '#1F2B24'];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('i'); p.className = 'offer__bit';
      p.style.cssText = `left:${50 + (Math.random() - .5) * 20}%;background:${colors[i % colors.length]};--dx:${(Math.random() - .5) * 260}px;--dy:${-60 - Math.random() * 120}px;--r:${Math.random() * 540 - 270}deg;animation-delay:${Math.random() * .12}s`;
      card.append(p); setTimeout(() => p.remove(), 1500);
    }
  };
  const reveal = () => {
    if (done) return; done = true;
    card.classList.add('done'); $('#offer-reveal').hidden = true; $('#offer-actions').hidden = false; $('.offer__later').hidden = true;
    $('#offer-sub').textContent = `Unlocked. ${CODE} is applied to your bag automatically.`;
    confetti();
    document.dispatchEvent(new CustomEvent('levit:offer', { detail: { code: CODE, pct: PCT } }));
  };

  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const scratch = (x, y) => {
    ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(34, W * 0.11);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke(); lx = x; ly = y;
    if (++n % 6 === 0 && cleared() > 0.4) reveal();
  };
  cv.addEventListener('pointerdown', (e) => { if (done) return; down = true; [lx, ly] = pos(e); scratch(lx + 0.1, ly); cv.setPointerCapture?.(e.pointerId); $('#offer-finger').classList.add('gone'); });
  cv.addEventListener('pointermove', (e) => { if (down && !done) { const [x, y] = pos(e); scratch(x, y); } });
  const up = () => { down = false; if (!done && cleared() > 0.4) reveal(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('#offer-reveal').addEventListener('click', () => { ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(0, 0, W, H); reveal(); });

  $('#offer-copy').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(CODE); e.target.textContent = 'Copied ✓'; } catch { e.target.textContent = `Your code: ${CODE}`; }
  });
  $('#offer-shop').addEventListener('click', () => { dlg.close(); if (document.body.dataset.page !== 'shop') location.href = 'shop.html'; });

  // a ghost finger shows the gesture once
  const ghost = () => {
    if (reduced || done || down) return;
    const pts = [[.16, .45], [.5, .52], [.84, .45], [.78, .66], [.3, .72]], f = $('#offer-finger'); let k = 0;
    f.classList.remove('gone'); f.style.left = pts[0][0] * 100 + '%'; f.style.top = pts[0][1] * 100 + '%'; lx = pts[0][0] * W; ly = pts[0][1] * H;
    const next = () => {
      if (down || done || k >= pts.length) { f.classList.add('gone'); return; }
      const [px, py] = pts[k++]; f.style.left = px * 100 + '%'; f.style.top = py * 100 + '%';
      const sx = lx, sy = ly, tx = px * W, ty = py * H; let t = 0;
      const run = () => { if (down || done) return; t += 0.1; scratch(sx + (tx - sx) * Math.min(1, t), sy + (ty - sy) * Math.min(1, t)); t < 1 ? requestAnimationFrame(run) : setTimeout(next, 40); };
      run();
    };
    setTimeout(next, 600);
  };

  const open = () => {
    if (claimed() || sessionStorage.getItem(SEEN)) return;
    if (document.querySelector('dialog[open]')) { if (++tries < 6) setTimeout(open, 4000); return; }       // never on top of another dialog
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* storage unavailable */ }
    dlg.showModal();
    requestAnimationFrame(() => { paint(); setTimeout(ghost, 500); });
  };
  const arm = () => setTimeout(open, DELAY);
  document.documentElement.classList.contains('is-ready') ? arm() : document.documentElement.addEventListener('ready', arm, { once: true });
}
