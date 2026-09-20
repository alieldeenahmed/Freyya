# Freyya

Your skin, but better.

Freyya is a storefront for a six-product skincare line. It is built with Next.js and designed to feel calm and expensive: quiet type, generous space, and motion that stays out of the way.

The catalog, orders and stock come from a separate API, in [`../Backend`](../Backend/README.md). This folder is the storefront and the admin dashboard.

![Freyya home page](docs/screenshots/home.png)

## What's in it

- **A shade quiz.** Five questions match a visitor to one shade of the lip balm or the glow drops.
- **A shop with filter and sort.** Filter by skincare or color and sort by price or name. The choice is kept in the URL, so it survives a reload and can be shared.
- **Product pages.** Each product has ingredients, skin types, size and usage, live stock, ratings and reviews, and related products.
- **Reviews.** Seeded reviews plus a form for writing your own, saved on the device.
- **A persistent bag.** The cart survives reloads and stays in sync across tabs. Quantities are capped at stock.
- **A real checkout, with simulated payment.** Contact, delivery and shipping details place an order through the API, which checks and reserves the stock. Payment is a simulated step, so nothing is charged and no card data is collected.
- **An admin dashboard** at `/admin`. Sign in to see orders and revenue, move orders from paid to shipped to delivered, cancel them (which returns the stock), and restock or correct inventory with a history of every change.
- **An accessible cart drawer.** It behaves like a real modal dialog: focus moves in, stays in, and returns when it closes.
- **A newsletter field.** In the footer, demo-only: it checks the address and saves nothing.
- **Help pages.** Contact, shipping and returns, privacy and terms. The shipping page reads its prices and countries from the same data as checkout, so the two can't disagree.
- **Search-ready pages.** Per-page metadata, share images, product structured data, a sitemap and `robots.txt`.

|  |  |
| --- | --- |
| ![Shop](docs/screenshots/shop.png) | ![Product page](docs/screenshots/product.png) |

![Shade quiz](docs/screenshots/quiz.png)

## Stack

- Next.js 16 (App Router) and React 19
- TypeScript
- Tailwind CSS 4
- GSAP with ScrollTrigger and Flip for motion
- Lenis for smooth scrolling
- Vitest and Testing Library for unit and component tests
- Playwright and axe-core for end-to-end tests and accessibility scans
- Cormorant Garamond and Manrope through `next/font`

## Getting started

You need Node.js 20 or newer, and the API running. Start it first: see [`../Backend/README.md`](../Backend/README.md). By default it listens on port 4000.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin is at [/admin](http://localhost:3000/admin).

If the API is down, the site still opens, using a snapshot of the catalog. Ordering and the admin won't work until it is back, and the checkout page says so.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the unit and component tests |
| `npm run test:e2e` | Run the end-to-end tests (needs the API's `.env.test`, see below) |
| `npm run perf` | After a build: each page's JavaScript against its budget |
| `npm run check:bundle` | After a build: check no server-only value reached a file the browser downloads |

### Environment

| Variable | Purpose |
| --- | --- |
| `API_URL` | Where the API runs. Default `http://localhost:4000`. Read when the app builds and starts, so set it before `npm run build` on a host. |
| `NEXT_PUBLIC_SITE_URL` | The public address, for example `https://freyya.example`. Used for the sitemap and share links. Falls back to the Vercel production URL, then to `http://localhost:3000`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional. When set, the contact page also shows this address as a mail link. |

## How it works

### The shade quiz

The first answer picks the product, Freyya Balm or Dew Drops. The next three answers are undertone clues: wrist veins, jewelry metal and sun response. Each answer votes for cool, warm or neutral, and the majority wins. A three-way tie goes to cool.

The last answer sets intensity, subtle or bold. The result is the shade with the winning undertone and the chosen intensity. If that combination doesn't exist, for example there is no bold cool Dew Drops shade, it falls back to the other shade in the same undertone.

The logic lives in `lib/quiz.ts`, and every possible combination of answers is tested to land on a real shade.

### Talking to the API

The browser never calls the API directly. It calls `/api/*` on the storefront's own address, and Next forwards those requests to `API_URL` (see `next.config.ts`). That keeps everything same-origin, so the admin session cookie is a plain first-party cookie and the API doesn't need to be exposed to arbitrary sites.

Every call the browser makes has a 15 second timeout, and every way it can fail becomes one `ApiError` with a stable code, including the plain error page a proxy returns when the API is down. Pages read the catalog on the server, from the API, with a four second timeout and a fallback to the generated snapshot, and refresh it every 30 seconds. The layout hands that list to the browser, so the bag, the quiz result and the product pages all see the same catalog. A shopper can briefly see a stale stock count, which is why checkout never relies on it: the server checks stock again when the order is placed.

### The bag

The cart is stored in `localStorage` and read through `useSyncExternalStore`, so it updates in other tabs through the `storage` event.

A saved cart is never trusted. Whenever it is read, each line's name, price, image and stock are re-derived from the current catalog. Item ids are rebuilt from the catalog rather than trusted, lines for the same item are merged, unknown products and shades are dropped, and quantities are clamped between one and the smaller of the available stock and 10, the most one order can hold (the API refuses more, and the number comes from the API's own rules). When the shop changes a saved bag, the shopper is told in words what changed and why ("Veil SPF has sold out, so it was taken out of your bag"), on the bag and on the checkout page, rather than the bag quietly shrinking. If storage is blocked, the bag keeps working in memory for the session.

### Checkout

Placing an order sends the API what to buy and where to send it, and nothing about price. The server works out the totals. Each attempt carries an `Idempotency-Key`, so if the connection drops and the shopper tries again, they get the same order back instead of a second one. Changing anything in the form starts a fresh attempt.

Every request has a timeout, and every failure has its own message and keeps the bag: the store unreachable, timing out, unavailable (a proxy's error page), rate limited, an order closed before payment, and a request key that was reused. A timeout and a dropped connection are safe to retry because the retry carries the same key. Nothing on the checkout page can be typed past what the API accepts, and when the copy of the site has no API, the page says orders cannot be placed here. If the server refuses, the shopper is told why in plain words. When stock ran short, the message says how many are left and the bag is corrected to match. Validation errors from the server are shown on the fields they belong to.

### The admin

`/admin` is a set of server-rendered pages that call the admin API with the visitor's session cookie. Without a session, they send you to the sign-in page and render nothing. Actions such as changing an order's status or adjusting stock call the API from the browser and then refresh the page. The admin has none of the storefront's header, footer or bag, and is kept out of search results.

### Motion

- Every animation checks `prefers-reduced-motion` first. Visitors who opt out get a static site.
- The shop-to-product transition uses GSAP Flip to move the photo from the card into place.
- The product photo stays in view with CSS `position: sticky`, not a scroll pin. Pinning made route changes fragile, and sticky needs no JavaScript.
- Lenis runs in native-scroll mode. It re-measures when the page height changes, and it is paused while the cart drawer is open.

### Accessibility

- A skip link and a visible focus ring on every interactive element: 2 pixels of the deep gold, about 5:1 against the cream. Everything pressed on a phone is at least 40 pixels each way.
- The cart drawer is a `role="dialog"` with `aria-modal`. While it is open the rest of the page is `inert`, Tab wraps inside it, Escape closes it, and focus goes back to the bag button.
- Form fields have labels, and errors are announced and linked to their field.
- Text meets WCAG AA contrast. Small gold text uses a deeper gold (`--color-accent-deep`) because the brand gold is too pale on the cream background. The brighter gold is kept for lines and fills.

### Performance

Images are visible in the server-rendered HTML, so they can paint before any script runs. An image that is still downloading when the page hydrates fades in over a skeleton instead. Above-the-fold photos are preloaded.

`npm run perf` reads the production build and fails if a page's JavaScript grows past its budget (about 202 KB gzipped on the home page, of which 128 KB is React and the router). `npm run check:bundle` fails if a server-only setting reached a file the browser downloads. [`../docs/performance.md`](../docs/performance.md) has the baseline and the reasoning.

Lighthouse, run locally against a production build with the default mobile settings (simulated slow 4G and a 4x CPU slowdown):

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home | 92 | 100 | 100 | 100 |
| Shop | 92 | 100 | 100 | 100 |
| Product | 95 | 100 | 100 | 100 |
| Quiz | 95 | 100 | 100 | 100 |

Home scores 98 on desktop. Performance moves by several points between runs, so read these as ranges, not exact figures. The checkout is deliberately excluded from search, which is why it scores lower on SEO.

### Tests

`npm test` runs 243 tests in 18 files. Logic tests run in Node and component tests run in jsdom with Testing Library, with `fetch` mocked. They cover:

- quiz scoring, and the quiz component from the first question to the result
- shop filtering, sorting and how the choice is read from and written to the URL
- cart stock limits, persistence, and recovery from a tampered, outdated or corrupted saved cart
- the bag: the limit of ten per order, merged duplicates, ids rebuilt from the catalog, absurd quantities, and the plain-language explanation of what the shop changed
- the bag drawer as a modal: focus trap, Escape, inert background, quantities
- checkout requests, how each kind of server error is turned into a message and a fix, the form itself against a mocked API, and every way the store can be slow, down or unreachable
- the API client: timeouts, dropped connections, and answers that are not JSON
- the product page (shades, stock lines, accordion), the review form, and the custom dropdown's keyboard behaviour
- what a screen reader depends on: names and landmarks, live-region announcements, and where focus lands after an action (`screen-readers.test.tsx`)
- shipping and order totals, including the free-shipping threshold
- review averages and ordering
- catalog integrity, such as unique ids and valid related products

`npm run test:e2e` runs 111 Playwright tests on desktop Chrome and a 375 pixel phone. It builds the storefront, starts the API on port 4010 and the storefront on port 3010, and resets a throwaway database first. That database comes from `TEST_DATABASE_URL` in `../Backend/.env.test`, and it must not be the one in `DATABASE_URL`. The suite covers browsing, a real purchase, the admin, phone layout, axe scans of every page and the main interactive states (WCAG 2.0 to 2.2 A and AA, plus best practice), and `screen-reader.spec.ts`, which checks names, states and focus in the browser's accessibility tree. `journeys.spec.ts` follows a shopper from the home page to a confirmed order, through stock running out, and through the store failing in four ways. `seo.spec.ts` checks titles, canonical addresses, share previews, the sitemap, structured data and every internal link. `responsive.spec.ts` checks five widths from 320 to 1920 pixels.

These read what a screen reader is built from. They are not a substitute for using one. See [`../docs/accessibility-testing.md`](../docs/accessibility-testing.md) for the manual checklist.

## Project structure

```
app/            Routes, metadata, share images, sitemap and robots
app/admin/      The admin dashboard
assets/         Fonts used to draw the share images and icons
components/     UI components
components/admin/  Admin UI
data/           Seeded reviews, and the generated snapshot of the API's catalog and shop rules (do not edit: run `npm run sync:data` from the repository root)
lib/            Catalog, cart, checkout, orders, quiz, reviews and shared helpers
tests/          Unit and component tests
e2e/            End-to-end, accessibility, SEO and layout tests
scripts/        Bundle size report, and the scan for server-only values in browser files
docs/           Screenshots used in this README
public/         Photography
```

## Limits

Freyya is a demonstration store.

- Payment is simulated. Nothing is charged, and no card details exist anywhere.
- Orders are real records with real stock effects, but nobody ships them and no emails are sent.
- Reviews are still saved in the visitor's browser only, and the contact form and newsletter field discard what you type.
- There is one admin, set in the API's environment. There are no customer accounts.

## Deploying

The storefront lives in the `Frontend` folder of the repository. It builds and runs **with no API at all**, which is how the public deployment works: pages come from the generated snapshot, and the checkout page says that orders cannot be placed.

1. On Vercel, set **Root Directory** to `Frontend`. That is enough for a working, browsable store. Set `NEXT_PUBLIC_SITE_URL` once you have a domain.
2. To attach an API, deploy it (see [`../Backend/README.md`](../Backend/README.md)) and set `API_URL` to its address before building. It is read at build time, because it is baked into the `/api/*` rewrite.
3. On the API, set `CORS_ORIGINS` to the storefront's address, and `TRUST_PROXY=true` if it sits behind a proxy.

Only `NEXT_PUBLIC_*` values are placed in browser files, and CI proves it by building with fake secrets and searching every file the browser downloads.

## License

MIT. See [LICENSE](../LICENSE).
