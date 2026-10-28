# LEVIT — womenswear storefront

Static e-commerce front end for the LEVIT womenswear brand.
No build step: open `index.html` through any static server.

```bash
cd levit && python3 -m http.server 8080
```

## Design system (taken from the logo)
- **Sand** `#D8C2AA` ground and **ink** `#0B0907` wordmark come from the logo; Playfair Display (a high-contrast serif close to the logo) + Jost for UI text
- Supporting accents so the page is not all beige: sage, lilac (from the poster flowers), blush, butter, forest green and wine (from the window dress); the hero background follows the chosen colourway
- **Rust** `#A8531E` from the knit, **gold** `#E7CD8B` from the boutique sign glow
- Arch frames echo the alcoves in the lookbook photography

## What's inside
- **Hero: swipe-up reel.** Only the hero is a reel; the rest of the page is the normal shop. The headline changes with each look ("Dressed in deep red.", "Tied up, never tied down." ...; the lines are in the `HEAD` map in `js/heroes/reel.js`) and returns to "Soft structure, every day." on the last panel. Each of eight real looks fills the frame and you swipe up (or scroll) for the next, with the price and Shop this look under your thumb, a heart that saves to the wishlist, a progress rail, a Swipe up cue, and a Skip to shop pill. The last panel hands the visitor on to the collection. On desktop the reel is a phone-width column with the headline beside it over a blurred copy of the current photo. Code: `js/heroes/reel.js` (looks listed in `LOOK_IDS` in `js/heroes/util.js`), styles in `css/heroes.css`. The other hero styles tried are in git history.
- `js/products.js` — the catalogue (INR), every product with a real photo; `js/garments.js` holds the small hanger drawing used only on the empty-bag and order-confirmed screens
- `js/app.js` — filters, quick view, bag drawer, simulated checkout, search, wishlist (bag and wishlist persist in `localStorage`)
- `fonts/` — self-hosted WOFF2

`js/products.js` is the built-in starting catalogue. With the API running, the live catalogue from the admin dashboard replaces it (prices, stock, hidden pieces, shipping and offer settings); without the API the store still works from the built-in data and checkout stays a demo.


## Shop design and ease of use
- **The shop is a clean gallery.** Plain rectangular photos with soft corners, then the name on the left and the price on the right (sale prices in rust with the old price struck through), and a tiny New/Bestseller label on the photo. On desktop the heart and a row of size buttons slide in on hover for one-click adds; on phones you just tap the photo (a small heart stays on the corner). 2 per row on phones, 3 or 4 on larger screens, and a 1 per row view.
- **Sticky filter bar** with category chips that centre the active one, a sort control (a native picker on phones) and a clear "Showing 6 pieces in Dresses · Clear" line.
- **Phone dock**: a small floating glass pill (icons only; the current section opens into a labelled pill, with live counts on Saved and Bag) replaces the header icons on small screens. It turns dark glass over the hero and slides away while you scroll down, returning when you scroll up. The header floats transparently over the hero photo, so the reel uses the full screen, and turns solid after the hero; a back-to-top button appears after the hero.
- **Quick view is a bottom sheet on phones**: big tap targets, a sticky "Select a size" / "Add to bag" button that shakes the size row if you forget, your last size remembered and preselected, a PIN-code delivery check, and short return/COD/shipping promises. The colour dots were removed because they did not change the photo; it now says which colour is shown and which others exist.
- **Bag**: removing an item offers Undo (the toast now sits above open drawers).
- **Search** opens with recent and popular searches and trending pieces.

## Deploying to Vercel
The storefront is static (no build step) and the `api/` folder is one Vercel serverless function for the dashboard. Import this repository into Vercel as a new project: Framework Preset **Other**, leave Build Command and Output Directory empty, Root Directory stays `./`. `vercel.json` adds clean URLs, security headers and caching (fonts are immutable, images cache for a day, HTML/CSS/JS always revalidate).

## Run locally
`python3 -m http.server 8080` in this folder, then open http://localhost:8080.

## Pages and offers
- `index.html` is the home page (reel hero, collections, a short edit of 8 pieces with a "Shop all" button, story, boutique, newsletter). `shop.html` is the dedicated shop page: breadcrumb, category chips, sort, layout toggle, every piece, and `?cat=dresses` style links (the footer, the collections list and the menu use them).
- **Hero reel** advances by itself every 4.6 seconds, pauses the moment a visitor touches or hovers it and resumes after a rest, and loops. The **Skip to shop** pill pulses, shimmers and nudges its arrow, and goes straight to the shop page.
- **Preloader**: a hanger swings once over the LEVIT wordmark with a hairline progress, then lifts away. Once per visit.
- **Welcome offer** (code, percentage, delay and on/off are set in the admin dashboard): about 9 seconds after arriving (once per visit, never on top of another dialog) a card asks to be scratched. Revealing it (or tapping "Show my offer") unlocks `LEVIT10`, 10% off, which the bag and checkout apply automatically. See `js/offer.js`.


## Admin dashboard (`/admin`)
A private back office for orders, products, customers and offers. Sign in at `https://your-site/admin/`.

- **Overview**: pick 7, 14, 30 or 90 days. Revenue, orders, average order and new customers with the change against the previous period, a "needs attention" strip (orders to pack, unpaid, low stock, paused store), revenue chart, orders by status, sales by category, payment methods, best sellers, low stock, top customers and recent orders.
- **Orders**: status tabs, search, payment filter, one-tap "Mark packed / shipped / delivered" on each order, **bulk select** to update many at once, an order sheet with payment-received toggle, courier and tracking number, internal note, WhatsApp / call / email buttons (WhatsApp message is pre-written for the order's stage), print slip and CSV export. Cancelling puts the items back in stock.
- **Products**: add, edit, duplicate, hide (switch on each row), delete and **reorder** pieces; price, compare-at price, label, description, colours, per-size stock and photo (pick an existing one or upload, resized in the browser).
- **Categories and labels**: "Manage categories" and "Manage labels" in Products let you add, rename, reorder and delete them (a category that still has pieces can not be deleted). Labels can have a colour. Both can also be created on the spot from the product editor with "＋ New category…" / "＋ New label…".
- **Colours from the photo**: in the product editor, tap the eyedropper on a colour, then tap the dress in the photo to copy its exact colour (it also suggests a name), or press "Suggest from photo" to get the garment's main colours in one tap.
- **Inventory**: every piece and size in one screen with editable numbers, a "low or sold out only" filter and one Save.
- **Customers**: grouped by email with order count, spend, repeat badge, WhatsApp / call / email and CSV export.
- **Offers & coupons**: the welcome scratch-card offer (code, percent, delay, on/off, scratched and used counts) plus unlimited **coupon codes** (percent or fixed amount, minimum order, usage limit, expiry, on/off). Customers type coupons in the bag.
- **Content (CMS)**: edit the words on the store without code: announcement bar, hero headlines for each look, section titles, story, "made to be lived in" block, boutique address / hours / phone, newsletter text, footer lines and contact links (WhatsApp, Instagram, email). Every field shows its original text and has a Reset. `*word*` makes a word italic and a new line is a line break. Photos can be changed too (the hero look photos, the story, round craft and boutique pictures): upload from your phone or choose from the library. Uploaded photos are stored in the database and served from `/api/img/<id>`. Defaults live in `api/_lib/content.js`; the storefront reads `data-cms` attributes.
- **Settings**: shipping fee, free-shipping threshold, COD fee, low-stock alert level, **pause orders** (shows a bar on the store and blocks checkout), JSON **backup** download.
- **Activity**: a log of new orders and every change made in the dashboard.
- **Alerts**: while the dashboard is open it checks for new orders every 40 seconds, shows a badge, plays a short sound and offers a View button.
- **On a phone**: bottom tab bar, bottom sheets you can swipe down to close, big tap targets, full-width action buttons, and it can be added to the home screen like an app.

Prices, stock, offer discount, shipping and COD fee are always recalculated on the server, so the browser can not set its own price.

### Set it up on Vercel
1. **Storage** (free): in the Vercel project open Storage and connect **Neon Postgres** (it sets `DATABASE_URL` / `POSTGRES_URL`) or **Upstash Redis** from the Marketplace (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`). Neon is used over its HTTP SQL endpoint and two small tables are created automatically on first use. Without either, the data is kept in memory and is lost on restarts. Do not pick the paid "Redis" plans.
2. **Password**: Settings → Environment Variables → add `ADMIN_PASSWORD` (a long one). Optionally add `ADMIN_SECRET` (any random string) to sign sessions. Without `ADMIN_PASSWORD` the admin stays locked on Vercel.
3. Redeploy. The first visit to the dashboard seeds the catalogue from `api/_lib/seed.js` (regenerate it from `js/products.js` with `node scripts/gen-seed.mjs`; the stock numbers there are placeholders, set the real ones in Products).

Sessions are an HTTP-only cookie signed with the password, valid for 7 days, and sign-in attempts are throttled. `/admin` and `/api` are marked `noindex` and are disallowed in `robots.txt`.

### Run locally with the API
`node dev-server.mjs` (port 8080, or `PORT=8090 node dev-server.mjs`) serves the site and the API together. Admin password locally is `levit-admin` unless `ADMIN_PASSWORD` is set; data is saved in `.data/db.json`.
