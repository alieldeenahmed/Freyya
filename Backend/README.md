# Freyya API

The backend for the Freyya storefront. It owns the catalog, orders and stock, and provides the data and actions behind the admin dashboard, whose pages live in [`../Frontend`](../Frontend/README.md) under `/admin`.

The storefront doesn't call it directly from the browser. It forwards `/api/*` to this server, so set `CORS_ORIGINS` to the storefront's address.

Node, TypeScript, Fastify, Drizzle and Postgres.

## What it does

- Serves products and shades with live stock.
- Takes orders. Prices, shipping and totals are worked out on the server, never trusted from the client.
- Keeps stock honest. Two people can't buy the last unit, and every change to a count is recorded.
- Holds stock for unpaid orders for a short time, then gives it back.
- Simulates payment, behind an interface a real provider could replace.
- Gives an admin a protected view of orders and inventory.

## Getting started

You need Node.js 22.9 or newer and a Postgres database. The project uses Neon, but any Postgres works.

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and the admin login
npm run db:migrate
npm run db:seed
npm run dev
```

The API runs on [http://localhost:4000](http://localhost:4000).

### Admin login

Sign-in is one admin, set in the environment. Make a password hash and put it in `.env`:

```bash
npm run admin:hash -- "a password of at least 12 characters"
```

Copy the output into `ADMIN_PASSWORD_HASH`, and set `ADMIN_EMAIL`.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required. |
| `PORT` | Port to listen on. Default `4000`. |
| `CORS_ORIGINS` | Origins allowed to call the API from a browser, comma-separated. Default `http://localhost:3000`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | The admin login. Without them, admin sign-in answers `503`. |
| `ADMIN_SESSION_HOURS` | How long an admin session lasts. Default `12`. |
| `RESERVATION_MINUTES` | How long unpaid stock is held. Default `15`. |
| `LOW_STOCK_THRESHOLD` | At or below this, an item is flagged as low. Default `5`. |
| `TRUST_PROXY` | Set to `true` behind a proxy or load balancer, so rate limits see real client addresses. |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with reload |
| `npm run build` / `npm start` | Compile, then run the compiled server |
| `npm run typecheck` | Type-check without building |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Load the launch catalog. Safe to repeat; existing stock is left alone |
| `npm run admin:hash` | Make a password hash for the admin login |
| `npm test` | Run the tests |

## API

Errors come back as `{ "error": { "code", "message", "details"? } }`.

### Storefront

| Method | Path | |
| --- | --- | --- |
| `GET` | `/health` | Checks the database is reachable |
| `GET` | `/config` | Shipping methods, free-shipping threshold, countries |
| `GET` | `/products` | The catalog, with stock |
| `GET` | `/products/:id` | One product |
| `POST` | `/orders` | Place an order. Send an `Idempotency-Key` header so a retry can't create a second one |
| `GET` | `/orders/:id?email=` | Look an order up. Needs the number and the email it was placed with |
| `POST` | `/orders/:id/pay` | Pay for an order (simulated). Body: `{ "email" }` |

An order is placed with the items as SKU ids, matching the cart lines in the storefront: `golden-hour-serum`, or `freyya-balm:bare` for a shade.

```json
{
  "email": "sara@example.com",
  "name": "Sara Nasser",
  "address": { "line1": "12 Nile Corniche", "city": "Cairo", "postalCode": "11511", "country": "Egypt" },
  "shippingId": "standard",
  "items": [{ "skuId": "dawn-cleanse", "quantity": 2 }]
}
```

### Admin

Sign in with `POST /admin/login`. The session is an http-only cookie. Every other admin route needs it.

| Method | Path | |
| --- | --- | --- |
| `POST` | `/admin/login`, `/admin/logout` | Start and end a session |
| `GET` | `/admin/me` | Who is signed in |
| `GET` | `/admin/stats` | Orders by status, revenue, low stock |
| `GET` | `/admin/orders` | List orders. Filter by `status`, search by `search`, page with `page` and `pageSize` |
| `GET` | `/admin/orders/:id` | One order, with the statuses it can move to |
| `PATCH` | `/admin/orders/:id/status` | Move an order along. Body: `{ "status" }` |
| `GET` | `/admin/inventory` | Every item with its stock |
| `POST` | `/admin/inventory/:skuId/adjust` | Add or remove stock. Body: `{ "delta", "reason", "note"? }` |
| `GET` | `/admin/inventory/:skuId/movements` | The history of one item's stock |

## How it works

**Stock can't go negative.** Placing an order locks the rows for the items in it, checks stock, and takes it, all in one transaction. Rows are locked in a fixed order so two overlapping orders can't deadlock. As a last defence the database itself refuses a negative count. Ten people racing for three units get three orders and seven refusals; a test covers it.

**Every change is recorded.** Stock only changes through one function, which writes a row to `inventory_movements`. The history of an item always adds up to its current count.

**Prices come from the database.** The client sends items and quantities, nothing else. Money is whole cents throughout.

**A retry is safe.** With the same `Idempotency-Key`, a repeated checkout returns the original order and takes stock once, even if two copies arrive at the same moment.

**Unpaid orders don't hold stock forever.** An order starts as `pending_payment` and holds its stock for `RESERVATION_MINUTES`. A sweep every minute cancels expired ones and returns the stock. Paying after the hold has run out fails cleanly.

**Order status has rules.** `pending_payment → paid → shipped → delivered`. Cancelling is allowed before shipping and returns the stock. A refund is allowed after shipping and doesn't, because the goods may not be resellable. `cancelled` and `refunded` are final.

**Payments are simulated.** `src/services/payments.ts` defines a small `PaymentProvider` interface and a simulated one that always succeeds. No card details exist anywhere in the API. A real provider would implement the same interface.

**Admin security.**
- The password is stored as a salted scrypt hash. Sessions are random tokens in an http-only cookie, and only a hash of each token is stored.
- A wrong email and a wrong password take the same time and give the same answer.
- Sign-in is limited to five tries a minute.
- Writes from an origin that isn't in `CORS_ORIGINS` are refused.

**Customers can't probe for orders.** Looking one up needs the number and the email, and a wrong number and a wrong email give the same `404`. Lookups are rate limited.

## Tests

`npm test` runs 84 tests: the pricing and status rules, password hashing, and the API against a real database, including concurrent orders, retries, expiry, sign-in and sessions, order transitions and stock adjustments.

The database tests wipe their tables, so they run against a separate database. Put its connection string in `.env.test`:

```
TEST_DATABASE_URL=postgresql://...
```

With Neon, a branch of the project is ideal. The tests refuse to run if `TEST_DATABASE_URL` matches `DATABASE_URL`.

## Project structure

```
src/
  app.ts          Builds the Fastify app: security headers, CORS, rate limits, errors
  server.ts       Starts it, and runs the reservation sweep
  config.ts       Reads and checks environment variables
  schemas.ts      Request validation
  views.ts        The shapes the API returns
  domain/         Pricing, order statuses, order numbers
  services/       Catalog, orders, inventory, payments, admin, auth
  routes/         Storefront and admin endpoints
  db/             Schema, client, migrations runner, seed
drizzle/          Generated SQL migrations
tests/            Unit and integration tests
scripts/          Admin password helper
```

## Deploying

Any host that runs Node works. Set the environment variables above, run `npm run build`, run `npm run db:migrate` against the production database, then `npm start`. Behind a proxy, set `TRUST_PROXY=true`.

## License

MIT. See [LICENSE](../LICENSE).
