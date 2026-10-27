import { inr } from '../products.js';
import { $, $$, pad, reduced, scope, looks } from './util.js';

/* the hero headline follows the look on screen */
const HEAD = {
  'ruby-ruffle-dress': ['Dressed in', 'deep red.'],
  'smocked-bow-top': ['Tied up,', 'never tied down.'],
  'black-bell-sleeve-kurta': ['Quiet black,', 'wide sleeves.'],
  'tissue-dupatta-kurta': ['White and gold,', 'with a little drape.'],
  'red-polka-midi': ['Polka dots,', 'all dressed up.'],
  'lace-crochet-top': ['Lace that', 'feels like air.'],
  'navy-zip-jacket': ['Zip up,', 'step out.'],
  'ruby-cape-dress': ['Cape sleeves,', 'main character.'],
};
const HOME = ['Soft structure,', 'every day.'];
const headHTML = ([a, b]) => `<span class="rf__hl"><span>${a}</span></span><span class="rf__hl"><span><em>${b}</em></span></span>`;
const HEART = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 3 1.3-1.9 2.9-3 4.9-3 3.2 0 5.5 3.1 4.3 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z"/></svg>';

/* Hero reel: each look fills the frame and you swipe up for the next. The rest of the page scrolls normally;
   "Skip to shop" and the last panel hand the visitor on. */
export function mount(hero) {
  const set = looks(), S = scope();
  hero.className = 'rf';
  hero.innerHTML = `<div class="rf__bg" aria-hidden="true">${set.map(() => '<i></i>').join('')}</div>
    <div class="rf__side"><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h1 class="rf__t" aria-live="polite">${headHTML(HEAD[set[0].id] || HOME)}</h1><p>Swipe through eight looks from our boutique, save the ones you love, shop in one tap.</p><a class="rf__shop rf__shop--big" href="shop.html">Shop the edit</a></div>
    <div class="rf__col">
      <p class="rf__h rf__t" aria-hidden="true">${headHTML(HEAD[set[0].id] || HOME)}</p>
      <a class="rf__skip" href="shop.html"><span>Skip to shop</span><i aria-hidden="true"></i></a>
      <div class="rf__scroll" id="rf-scroll" tabindex="-1">${set.map((p, k) => `<section class="rf__s" data-i="${k}" aria-label="${p.name}"><img src="${p.photo}" alt="${p.name}" ${k > 0 ? 'fetchpriority="low" ' : 'fetchpriority="high" '}decoding="async" draggable="false">
        <div class="rf__shade"></div>
        <div class="rf__info"><p class="rf__no">${pad(k + 1)} / ${pad(set.length)}</p><h2>${p.name}</h2><div class="rf__row"><span>${inr(p.price)}</span><button class="rf__shop" type="button" data-quick="${p.id}">Shop this look</button></div></div>
        <button class="rf__heart" type="button" data-id="${p.id}" aria-pressed="false" aria-label="Save ${p.name}">${HEART}</button></section>`).join('')}
        <section class="rf__s rf__end"><div><p class="eyebrow"><span class="eyebrow__dot"></span>AW26 · Womenswear</p><h2>Soft structure, <em>every day.</em></h2><a class="rf__shop rf__shop--big" href="shop.html">Shop the edit</a><p class="rf__down">Keep scrolling for the full collection</p></div></section></div>
      <div class="rf__dots" aria-hidden="true">${set.map(() => '<i></i>').join('')}</div>
      <p class="rf__cue" id="rf-cue" aria-hidden="true"><i></i><span>Swipe up</span></p></div>`;
  const sc = $('#rf-scroll', hero), dots = $$('.rf__dots i', hero), cue = $('#rf-cue', hero), bgs = $$('.rf__bg i', hero), col = $('.rf__col', hero);
  // desktop backdrop: two average colours per photo (top and bottom) as a gradient, instead of a live image blur
  if (matchMedia('(min-width: 900px)').matches) set.forEach((p, k) => {
    const im = new Image(); im.src = p.photo;
    im.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = 4; cv.height = 8; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, 4, 8);
        const avg = (y0, y1) => { const d = cx.getImageData(0, y0, 4, y1 - y0).data; let r = 0, g = 0, b = 0, n = d.length / 4; for (let q = 0; q < d.length; q += 4) { r += d[q]; g += d[q + 1]; b += d[q + 2]; } return [r / n * 0.55, g / n * 0.55, b / n * 0.55].map(Math.round).join(','); };
        bgs[k].style.background = `linear-gradient(rgb(${avg(0, 4)}), rgb(${avg(4, 8)}))`;
      } catch { /* canvas blocked: the dark fallback stays */ }
    };
  });
  const heads = $$('.rf__t', hero);
  let shown = -2;
  const setHead = (k) => {
    if (k === shown) return; shown = k;
    const copy = k < 0 ? HOME : HEAD[set[k].id] || HOME, html = headHTML(copy);
    heads.forEach((h) => { h.classList.remove('in'); void h.offsetWidth; h.innerHTML = html; h.classList.add('in'); });
  };
  const mark = (k) => {
    setHead(k); dots.forEach((d, m) => d.classList.toggle('is-on', m === k)); bgs.forEach((b, m) => b.classList.toggle('is-on', m === k)); col.classList.toggle('at-end', k < 0); };
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting || en.intersectionRatio < 0.6) return;
    const k = en.target.dataset.i === undefined ? -1 : +en.target.dataset.i;
    requestAnimationFrame(() => { mark(k); if (k !== 0) cue.classList.add('gone'); });
  }), { root: sc, threshold: [0.6] });
  $$('.rf__s', hero).forEach((s) => io.observe(s)); S.add(() => io.disconnect());
  mark(0);
  S.on(hero, 'click', (e) => {
    const h = e.target.closest('.rf__heart'); if (!h) return;
    const on = h.getAttribute('aria-pressed') !== 'true'; h.setAttribute('aria-pressed', on);
    if (on) document.dispatchEvent(new CustomEvent('levit:wish', { detail: h.dataset.id }));
  });
  // autoplay: the reel moves on by itself, pauses the moment a visitor touches it, and picks up again after a rest
  let cur = 0, idle = 0, timer = 0, visible = true, hover = false;
  const slideH = () => sc.clientHeight;
  const go = (k) => { sc.scrollTo({ top: slideH() * k, behavior: 'smooth' }); };
  const wrap = () => { col.classList.add('is-wrap'); setTimeout(() => { sc.scrollTo({ top: 0, behavior: 'auto' }); col.classList.remove('is-wrap'); }, 260); };
  const step = () => {
    if (reduced || !visible || hover || document.hidden || Date.now() < idle) return;
    const k = Math.round(sc.scrollTop / Math.max(1, slideH()));
    if (k >= set.length - 1) wrap(); else go(k + 1);
  };
  const rest = (ms = 8000) => { idle = Date.now() + ms; };
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((ev) => S.on(sc, ev, () => rest(), { passive: true }));
  S.on(hero, 'pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; }); S.on(hero, 'pointerleave', () => { hover = false; });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.4 }).observe(hero);
  S.add(() => clearInterval(timer));
  timer = setInterval(step, 4600);
  return () => S.clear();
}
