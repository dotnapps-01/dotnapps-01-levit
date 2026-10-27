/* Builds api/_lib/seed.json from js/products.js: the starting catalogue the admin dashboard manages.
 *   node scripts/gen-seed.mjs
 * Stock numbers are placeholders, set the real ones in the dashboard. */
import { writeFileSync } from 'node:fs';
import { PRODUCTS, CATEGORIES } from '../js/products.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const stockFor = (i) => Object.fromEntries(SIZES.map((s, k) => [s, 4 + ((i * 3 + k * 5) % 9)]));

const products = PRODUCTS.map((p, i) => ({
  id: p.id, name: p.name, cat: p.cat, price: p.price, was: p.was ?? null, tag: p.tag ?? null, kind: p.kind,
  colors: p.colors, bg: p.bg, photo: p.photo, blurb: p.blurb, details: p.details,
  stock: stockFor(i), active: true, i,
}));
writeFileSync(new URL('../api/_lib/seed.json', import.meta.url), JSON.stringify({ categories: CATEGORIES, products }, null, 1));
console.log(`seed.json: ${products.length} products, ${CATEGORIES.length} categories`);
