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

**Updating an existing database.** Migrations are additive. After pulling changes, run `npm run db:migrate` again. The latest one (`0001`) adds a column to `orders` that remembers what each idempotency key was first used for. Without it, placing an order fails.

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
| `RATE_LIMIT` | On by default. The end-to-end run sets `false`, so its own sign-ins are not throttled. Leave it on elsewhere. |
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
| `npm run sync:data` | Write the storefront's snapshot of the catalog and shop rules (`../Frontend/data`) from this package's own files |
| `npm run sync:data:check` | Fail if that snapshot is out of date. Used in CI |
| `npm test` | Run the tests |
| `npm run db:reset:test` | Clear orders and restore launch stock in the test database (used before the end-to-end run) |

## API

Errors come back as `{ "error": { "code", "message", "details"? } }`. The `code` is stable and is what a client should act on.

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `validation_error` | A field is missing or wrong. `details` lists `{ path, message }` for each |
| 401 | `unauthorized` | No admin session |
| 403 | `forbidden_origin` | A write from an origin that is not allowed |
| 404 | `not_found` | No such product, order or item. Also returned for an id that could not exist |
| 409 | `insufficient_stock` | Not enough stock. `details.items` says how many are available of each |
| 409 | `reservation_expired` | The stock hold on an unpaid order ran out |
| 409 | `order_closed` | The order can no longer be paid |
| 409 | `invalid_transition` | The status change is not allowed. `details.allowed` lists what is |
| 422 | `unknown_item` | An item does not exist or is switched off |
| 422 | `idempotency_key_reused` | The request key was already used for a different order |
| 429 | `rate_limited` | Too many requests. `Retry-After` says how long to wait |
| 500 | `internal_error` | Something failed inside. The message never says what |

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

**A retry is safe, and a mistaken one is refused.** With the same `Idempotency-Key`, a repeated checkout returns the original order and takes stock once, even if ten copies arrive at the same moment. The order the key was first used for is remembered as a fingerprint (a hash of the buyer, address, shipping method and the items, merged and sorted). The same key with a *different* order is refused with `422 idempotency_key_reused`, instead of quietly handing back an unrelated order. A retry after the order was paid returns it as paid, and one after it was cancelled returns it as cancelled, without taking stock again. Keys are 8 to 100 letters, digits or `. _ : -`.

**Limits are checked on the server.** One order holds at most 10 of any item, counting every line it appears on, so splitting an item across two lines does not get round it. Text that Postgres cannot store, and ids that cannot exist, are refused up front rather than reaching the database.

**Unpaid orders don't hold stock forever, and never block a buyer once they have run out.** An order starts as `pending_payment` and holds its stock for `RESERVATION_MINUTES`. A sweep every minute cancels expired ones and returns the stock. Placing an order also releases any hold that has run out before it checks stock, so nobody is turned away because the sweep has not come round yet. Paying after the hold has run out fails cleanly, and a payment and a sweep arriving together release the stock once.

**Order status has rules.** `pending_payment → paid → shipped → delivered`. Cancelling is allowed before shipping and returns the stock. A refund is allowed after shipping and doesn't, because the goods may not be resellable. `cancelled` and `refunded` are final. The rules are one table in `src/domain/order-status.ts`, and a test checks all 36 pairs of statuses against the API. Only the admin can change a status: customers have no route that does, and a status or timestamp sent in a request body is ignored. Every change locks the order's row first, so two admins pressing at once cannot both win.

**Payments are simulated.** `src/services/payments.ts` defines a small `PaymentProvider` interface and a simulated one that always succeeds. No card details exist anywhere in the API. A real provider would implement the same interface.

**Admin security.**
- The password is stored as a salted scrypt hash. Sessions are random tokens in an http-only cookie, and only a hash of each token is stored.
- A wrong email and a wrong password take the same time and give the same answer.
- Sign-in is limited to five tries a minute, and once the limit is hit even the right password waits.
- Writes from an origin that isn't in `CORS_ORIGINS` are refused. The cookie is `SameSite=Lax`, `HttpOnly`, and `Secure` in production.
- A test walks every route the API registers and checks that each one is either on a short list of open routes or answers `401` without a session, before it reads anything else. Adding a route without deciding which list it belongs on fails the test.
- Admin responses and order lookups are sent with `Cache-Control: no-store`.
- Request logs drop the query string, because an order lookup carries the customer's email in it.
- Configuration errors name the setting that is wrong and never repeat its value.
- One weakness is known and left alone: the password hash uses scrypt with Node's default cost. That is fine for one admin behind a rate limit, but a shared or public deployment should raise it.

**Customers can't probe for orders.** Looking one up needs the number and the email, and a wrong number and a wrong email give the same `404`. Lookups are rate limited.

## Tests

`npm test` runs 249 tests in 9 files, against a real database:

| File | What is checked |
| --- | --- |
| `orders`, `catalog`, `pricing`, `auth`, `admin` | Ordering, pricing, stock, expiry, sign-in, sessions, order transitions and stock adjustments |
| `concurrency` | Buyers against buyers, buyers against admin adjustments, orders against the expiry sweep, payments against cancellations, ten identical requests at once, one key with two different orders, and dozens of malformed inputs. After every race, each item's stock must equal the sum of its ledger and never be below zero |
| `order-state-machine` | All 36 status pairs through the API, the effect of each on stock, and every way a customer might try to change a status |
| `security` | Every route is open or protected on purpose, cookie flags, origin checks, sign-in limits, `no-store` on personal data, hostile ids and NUL characters, and nothing from the environment in any response |
| `contract` | The storefront's generated snapshot matches this package's files exactly |

The `contract` tests read the storefront's files and fail if its snapshot of the catalog and shop rules is not exactly what `npm run sync:data` writes from `src/domain/pricing.ts` and `src/db/seed-data.ts`, or if the storefront's own code writes one of those rules by hand. They are skipped when the `Frontend` folder is not next to this one.

The database tests wipe their tables, so they run against a separate database. Put its connection string in `.env.test`:

```
TEST_DATABASE_URL=postgresql://...
```

With Neon, a branch of the project is ideal. The tests refuse to run if `TEST_DATABASE_URL` matches `DATABASE_URL`. The database needs its tables first, so run `npm run db:migrate` against it once (with `DATABASE_URL` pointing at it for that command).

The storefront's end-to-end tests also use this database. See [`../Frontend/README.md`](../Frontend/README.md#tests).

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
