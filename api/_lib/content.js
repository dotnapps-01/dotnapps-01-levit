/* The editable site copy (the CMS). Every field has a default that matches the text already in the HTML, so the
 * storefront renders correctly with no content saved. Only the fields an editor changes are stored, and clearing a
 * field in the dashboard brings the default back.
 *
 * kinds: text (one line) · title (lines; *word* becomes italic) · long (paragraph) · lines (one item per line) ·
 *        head (two lines: the second is italic) · url (link) · phone (digits for WhatsApp / tel links) ·
 *        image (a site photo path like img/p/x.webp, or an uploaded one at /api/img/<id>)                    */
import { db } from './db.js';

export const GROUPS = [
  { id: 'announce', name: 'Announcement bar', hint: 'The sliding strip at the very top of every page.' },
  { id: 'hero', name: 'Home hero', hint: 'The swipe-up reel at the top of the home page.' },
  { id: 'sections', name: 'Section headings', hint: 'Titles above the collections, shop and dress edit.' },
  { id: 'story', name: 'Our story', hint: 'The editorial block under the shop.' },
  { id: 'craft', name: 'Made to be lived in', hint: 'The green block with the three pillars.' },
  { id: 'boutique', name: 'Boutique', hint: 'Fill in the address, hours and phone to show them on the home page.' },
  { id: 'join', name: 'Newsletter', hint: 'The sign-up block above the footer.' },
  { id: 'footer', name: 'Footer and contact', hint: 'Footer text and your contact links. Empty contact fields stay hidden.' },
];

const T = (group, key, label, kind, def, extra = {}) => ({ group, key, label, kind, def, ...extra });

export const SCHEMA = [
  T('announce', 'announce', 'Messages (one per line)', 'lines', 'Free shipping over ₹1,999\n7-day easy returns\nCash on delivery available\nAW26 has landed', { max: 6 }),

  T('hero', 'hero.eyebrow', 'Small line above the headline', 'text', 'AW26 · Womenswear'),
  T('hero', 'hero.intro', 'Intro text (desktop)', 'long', 'Swipe through eight looks from our boutique, save the ones you love, shop in one tap.'),
  T('hero', 'hero.home', 'Closing headline', 'head', 'Soft structure,\nevery day.'),
  T('hero', 'head.ruby-ruffle-dress', 'Look 1 · Ruby Ruffle Dress', 'head', 'Dressed in\ndeep red.'),
  T('hero', 'hero.img.ruby-ruffle-dress', 'Look 1 photo', 'image', 'img/p/ruby-ruffle-dress.webp'),
  T('hero', 'head.smocked-bow-top', 'Look 2 · Smocked Bow Top', 'head', 'Tied up,\nnever tied down.'),
  T('hero', 'hero.img.smocked-bow-top', 'Look 2 photo', 'image', 'img/p/smocked-bow-top.webp'),
  T('hero', 'head.black-bell-sleeve-kurta', 'Look 3 · Black Bell-Sleeve Kurta', 'head', 'Quiet black,\nwide sleeves.'),
  T('hero', 'hero.img.black-bell-sleeve-kurta', 'Look 3 photo', 'image', 'img/p/black-bell-sleeve-kurta.webp'),
  T('hero', 'head.tissue-dupatta-kurta', 'Look 4 · Tissue Dupatta Kurta', 'head', 'White and gold,\nwith a little drape.'),
  T('hero', 'hero.img.tissue-dupatta-kurta', 'Look 4 photo', 'image', 'img/p/tissue-dupatta-kurta.webp'),
  T('hero', 'head.red-polka-midi', 'Look 5 · Red Polka Midi', 'head', 'Polka dots,\nall dressed up.'),
  T('hero', 'hero.img.red-polka-midi', 'Look 5 photo', 'image', 'img/p/red-polka-midi.webp'),
  T('hero', 'head.lace-crochet-top', 'Look 6 · Lace Crochet Top', 'head', 'Lace that\nfeels like air.'),
  T('hero', 'hero.img.lace-crochet-top', 'Look 6 photo', 'image', 'img/p/lace-crochet-top.webp'),
  T('hero', 'head.navy-zip-jacket', 'Look 7 · Navy Zip Jacket', 'head', 'Zip up,\nstep out.'),
  T('hero', 'hero.img.navy-zip-jacket', 'Look 7 photo', 'image', 'img/p/navy-zip-jacket.webp'),
  T('hero', 'head.ruby-cape-dress', 'Look 8 · Ruby Cape Dress', 'head', 'Cape sleeves,\nmain character.'),
  T('hero', 'hero.img.ruby-cape-dress', 'Look 8 photo', 'image', 'img/p/ruby-cape-dress.webp'),

  T('sections', 'collections.eyebrow', 'Collections · small line', 'text', 'Shop by category'),
  T('sections', 'collections.title', 'Collections · title', 'title', 'Five ways to\n*wear light.*'),
  T('sections', 'shop.eyebrow', 'Shop · small line', 'text', 'The edit'),
  T('sections', 'shop.title', 'Shop · title', 'title', 'Off the *rail*'),
  T('sections', 'dresses.eyebrow', 'Dress edit · small line', 'text', 'The dress edit'),
  T('sections', 'dresses.title', 'Dress edit · title', 'title', 'Dressed for *the moment*'),
  T('sections', 'dresses.sub', 'Dress edit · sub line', 'text', 'Ruffles, polka dots, capes and embroidery'),

  T('story', 'story.image', 'Photo', 'image', 'img/model-noir.webp'),
  T('story', 'story.eyebrow', 'Small line', 'text', 'The idea'),
  T('story', 'story.title', 'Title', 'title', 'Quietly bold.\n*Never loud.*'),
  T('story', 'story.lead', 'Opening paragraph', 'long', 'LEVIT began with a simple question: why does getting dressed feel so heavy? We make clothes that sit lightly — in the fabric, in the fit, and on your day.'),
  T('story', 'story.body', 'Second paragraph', 'long', 'Texture over noise. Warm neutrals that go with everything you already own. Cuts that flatter without fussing. Every piece is designed in-house and tested on real women, in real light, on real stairs.'),
  T('story', 'story.quote', 'Quote', 'long', "Dress like you've nothing to prove, and everything to enjoy."),

  T('craft', 'craft.image', 'Round photo', 'image', 'img/p/ruby-ruffle-dress.webp'),
  T('craft', 'craft.eyebrow', 'Small line', 'text', 'Made to be lived in'),
  T('craft', 'craft.title', 'Title', 'title', 'Soft by nature.\n*Structured by design.*'),
  T('craft', 'craft.p1.title', 'Pillar 1 · title', 'text', 'Feel'),
  T('craft', 'craft.p1.text', 'Pillar 1 · text', 'long', 'Breathable viscose knits, cotton voile and crepe with real hand-feel. Nothing scratchy, nothing stiff.'),
  T('craft', 'craft.p2.title', 'Pillar 2 · title', 'text', 'Fit'),
  T('craft', 'craft.p2.text', 'Pillar 2 · text', 'long', 'Cut for XS–XL with a little give where you need it. Not the right size? Swap it within 7 days.'),
  T('craft', 'craft.p3.title', 'Pillar 3 · title', 'text', 'Finish'),
  T('craft', 'craft.p3.text', 'Pillar 3 · text', 'long', "Elasticated hems that hold their shape, brass-tone hardware, and seams you'll never think about."),
  T('craft', 'perk.1', 'Promise 1', 'text', 'Free shipping over ₹1,999'),
  T('craft', 'perk.2', 'Promise 2', 'text', '7-day easy exchange'),
  T('craft', 'perk.3', 'Promise 3', 'text', 'Cash on delivery'),

  T('boutique', 'boutique.image', 'Photo', 'image', 'img/boutique.webp'),
  T('boutique', 'boutique.eyebrow', 'Small line', 'text', 'In person'),
  T('boutique', 'boutique.title', 'Title', 'title', 'Come say\n*hello.*'),
  T('boutique', 'boutique.lead', 'Text', 'long', "Our boutique is the quietest way to meet the collection: racks you can touch, fabrics you can feel, and a stylist who won't hover."),
  T('boutique', 'boutique.address', 'Address', 'long', ''),
  T('boutique', 'boutique.hours', 'Opening hours', 'text', ''),
  T('boutique', 'boutique.phone', 'Boutique phone', 'phone', ''),
  T('boutique', 'boutique.cta', 'Main button text', 'text', 'Book a styling visit'),

  T('join', 'join.title', 'Title', 'title', 'Join the *list.*'),
  T('join', 'join.text', 'Text', 'text', 'First look at new drops, quiet sales, and 10% off your first order.'),

  T('footer', 'footer.tagline', 'Tagline', 'text', 'Womenswear made to feel light.'),
  T('footer', 'footer.pay', 'Payments line', 'text', 'UPI · Cards · Net banking · Cash on delivery'),
  T('footer', 'footer.legal', 'Small print', 'text', 'Demo storefront — checkout is simulated and no payment is taken.'),
  T('footer', 'contact.whatsapp', 'WhatsApp number (with country code, digits only)', 'phone', ''),
  T('footer', 'contact.instagram', 'Instagram link', 'url', ''),
  T('footer', 'contact.email', 'Contact email', 'text', ''),
];

const BY_KEY = Object.fromEntries(SCHEMA.map((f) => [f.key, f]));
const KEY = 'levit:content';

export async function getContent() { return (await db.get(KEY)) || {}; }

function clean(f, raw) {
  let v = String(raw ?? '').replace(/\r/g, '').trim();
  if (f.kind === 'text' || f.kind === 'phone' || f.kind === 'url') v = v.replace(/\n+/g, ' ');
  if (f.kind === 'phone') v = v.replace(/[^0-9+]/g, '');
  if (f.kind === 'image') return /^(img\/[A-Za-z0-9_\-./]+|\/api\/img\/[a-f0-9]{12})$/.test(v) && !v.includes('..') ? v : '';
  if (f.kind === 'url' && v && !/^https?:\/\//i.test(v)) v = /^[\w.-]+\.[a-z]{2,}/i.test(v) ? 'https://' + v : '';
  if (f.kind === 'lines') v = v.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, f.max || 6).join('\n');
  if (f.kind === 'head' || f.kind === 'title') v = v.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3).join('\n');
  return v.slice(0, f.kind === 'long' ? 700 : 240);
}

/** input: { key: value }. A value equal to the default (or empty) removes the override. */
export async function saveContent(input) {
  const cur = await getContent();
  for (const [k, raw] of Object.entries(input || {})) {
    const f = BY_KEY[k]; if (!f) continue;
    const v = clean(f, raw);
    if (!v || v === f.def) delete cur[k]; else cur[k] = v;
  }
  await db.set(KEY, cur);
  return cur;
}
