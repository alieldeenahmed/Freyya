import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import {
  COUNTRIES,
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_METHODS,
} from "../domain/pricing.js";
import { notFound } from "../errors.js";
import {
  idempotencyKeySchema,
  orderInputSchema,
  orderLookupSchema,
  payInputSchema,
  safeId,
} from "../schemas.js";
import { getProduct, listProducts } from "../services/catalog.js";
import { createOrder, getOrderForCustomer, payOrder } from "../services/orders.js";
import { limitByAddress } from "../services/rate-limit.js";
import { releaseBeforeRead } from "../services/reservations.js";

export const publicRoutes: FastifyPluginAsync = async (app) => {
  const { db, config, payments } = app.ctx;
  const limits = app.ctx.rateLimit;

  app.get("/health", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: "ok" };
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  // Everything the storefront needs to show shipping choices, from one source of truth.
  app.get("/config", async () => ({
    currency: "USD",
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD_CENTS / 100,
    shippingMethods: SHIPPING_METHODS.map((method) => ({
      id: method.id,
      label: method.label,
      eta: method.eta,
      price: method.priceCents / 100,
      ...(method.freeOverCents !== undefined && { freeOver: method.freeOverCents / 100 }),
    })),
    countries: COUNTRIES,
    reservationMinutes: config.RESERVATION_MINUTES,
    demo: config.DEMO_MODE,
  }));

  // Stock is read here, so a hold that has just run out is given back first.
  app.get("/products", async () => {
    await releaseBeforeRead(db);
    return { products: await listProducts(db) };
  });

  app.get<{ Params: { id: string } }>("/products/:id", async (request) => {
    await releaseBeforeRead(db);
    const product = await getProduct(db, safeId(request.params.id));
    if (!product) throw notFound("Product not found");
    return { product };
  });

  app.post(
    "/orders",
    {
      preHandler: [
        limitByAddress(db, limits, { name: "orders", max: 10, windowSeconds: 60 }),
        // The public demo also caps how many orders one address can place in an hour.
        ...(config.DEMO_MODE
          ? [
              limitByAddress(db, limits, {
                name: "demo-orders",
                max: config.DEMO_ORDERS_PER_IP_PER_HOUR,
                windowSeconds: 3600,
              }),
            ]
          : []),
      ],
    },
    async (request, reply) => {
      const input = orderInputSchema.parse(request.body);
      const header = request.headers["idempotency-key"];
      const key = header === undefined ? undefined : idempotencyKeySchema.parse(header);

      const { order, created } = await createOrder(db, config, input, key);
      return reply.status(created ? 201 : 200).send({ order });
    }
  );

  // Looking an order up needs its number and the email it was placed with.
  app.get<{ Params: { id: string }; Querystring: { email?: string } }>(
    "/orders/:id",
    { preHandler: limitByAddress(db, limits, { name: "order-lookup", max: 30, windowSeconds: 60 }) },
    async (request) => {
      const { email } = orderLookupSchema.parse({ email: request.query.email });
      return { order: await getOrderForCustomer(db, safeId(request.params.id), email) };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/orders/:id/pay",
    { preHandler: limitByAddress(db, limits, { name: "order-pay", max: 10, windowSeconds: 60 }) },
    async (request) => {
      const { email } = payInputSchema.parse(request.body);
      return { order: await payOrder(db, payments, safeId(request.params.id), email) };
    }
  );
};
