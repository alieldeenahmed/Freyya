# Freyya

Your skin, but better.

Freyya is a storefront for a six-product skincare line. It is built with Next.js and designed to feel calm and expensive: quiet type, generous space, and motion that stays out of the way.

![Freyya home page](docs/screenshots/home.png)

## What's in it

- **A shade quiz.** Five questions match a visitor to one shade of the lip balm or the glow drops.
- **A shop with filter and sort.** Filter by skincare or color and sort by price or name. The choice is kept in the URL, so it survives a reload and can be shared.
- **Product pages.** Each product has ingredients, skin types, size and usage, live stock, ratings and reviews, and related products.
- **Reviews.** Seeded reviews plus a form for writing your own, saved on the device.
- **A persistent bag.** The cart survives reloads and stays in sync across tabs. Quantities are capped at stock.
- **A demo checkout.** Contact, delivery, shipping method and an order confirmation page. No payment is taken and no card data is collected.
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
- Vitest for tests
- Cormorant Garamond and Manrope through `next/font`

## Getting started

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the unit tests |

### Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The public address, for example `https://freyya.example`. Used for the sitemap and share links. Falls back to the Vercel production URL, then to `http://localhost:3000`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional. When set, the contact page also shows this address as a mail link. |

## How it works

### The shade quiz

The first answer picks the product, Freyya Balm or Dew Drops. The next three answers are undertone clues: wrist veins, jewelry metal and sun response. Each answer votes for cool, warm or neutral, and the majority wins. A three-way tie goes to cool.

The last answer sets intensity, subtle or bold. The result is the shade with the winning undertone and the chosen intensity. If that combination doesn't exist, for example there is no bold cool Dew Drops shade, it falls back to the other shade in the same undertone.

The logic lives in `lib/quiz.ts`, and every possible combination of answers is tested to land on a real shade.

### The bag

The cart is stored in `localStorage` and read through `useSyncExternalStore`, so it updates in other tabs through the `storage` event.

A saved cart is never trusted. When it is read, each line's name, price, image and stock are re-derived from the catalog. Unknown products and shades are dropped, and quantities are clamped between one and the available stock. If storage is blocked, the bag keeps working in memory for the session.

### Motion

- Every animation checks `prefers-reduced-motion` first. Visitors who opt out get a static site.
- The shop-to-product transition uses GSAP Flip to move the photo from the card into place.
- The product photo stays in view with CSS `position: sticky`, not a scroll pin. Pinning made route changes fragile, and sticky needs no JavaScript.
- Lenis runs in native-scroll mode. It re-measures when the page height changes, and it is paused while the cart drawer is open.

### Accessibility

- A skip link and a visible gold focus ring on every interactive element.
- The cart drawer is a `role="dialog"` with `aria-modal`. While it is open the rest of the page is `inert`, Tab wraps inside it, Escape closes it, and focus goes back to the bag button.
- Form fields have labels, and errors are announced and linked to their field.
- Text meets WCAG AA contrast. Small gold text uses a deeper gold (`--color-accent-deep`) because the brand gold is too pale on the cream background. The brighter gold is kept for lines and fills.

### Performance

Images are visible in the server-rendered HTML, so they can paint before any script runs. An image that is still downloading when the page hydrates fades in over a skeleton instead. Above-the-fold photos are preloaded.

Lighthouse, run locally against a production build with the default mobile settings (simulated slow 4G and a 4x CPU slowdown):

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home | 92 | 100 | 100 | 100 |
| Shop | 92 | 100 | 100 | 100 |
| Product | 95 | 100 | 100 | 100 |
| Quiz | 95 | 100 | 100 | 100 |

Home scores 98 on desktop. Performance moves by several points between runs, so read these as ranges, not exact figures. The checkout is deliberately excluded from search, which is why it scores lower on SEO.

### Tests

`npm test` runs 64 tests covering:

- quiz scoring
- shop filtering, sorting and how the choice is read from and written to the URL
- cart stock limits, persistence and recovery from a tampered or corrupted saved cart
- shipping and order totals, including the free-shipping threshold
- review averages and ordering
- catalog integrity, such as unique ids and valid related products

## Project structure

```
app/            Routes, metadata, share images, sitemap and robots
assets/         Fonts used to draw the share images and icons
components/     UI components
data/           Products and seeded reviews
lib/            Cart, orders, quiz, reviews and shared helpers
tests/          Unit tests
docs/           Screenshots used in this README
public/         Photography
```

## Limits

Freyya is a front end with a static catalog. There is no backend.

- Reviews, the bag and the last order are saved in the visitor's browser only.
- Checkout is a demonstration. Nothing is charged, shipped or emailed.
- Stock levels are fixed in `data/products.ts`. Orders do not reduce them.

Connecting a real store would start with replacing `data/products.ts` and the order handling in `lib/orders.ts` with API calls.

## Deploying

The app lives in the `Frontend` folder of the repository. On Vercel, set **Root Directory** to `Frontend`, and set `NEXT_PUBLIC_SITE_URL` once you have a domain.

## License

MIT. See [LICENSE](LICENSE).
