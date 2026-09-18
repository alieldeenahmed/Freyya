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
} from "../schemas.js";
import { getProduct, listProducts } from "../services/catalog.js";
import { createOrder, getOrderForCustomer, payOrder } from "../services/orders.js";

export const publicRoutes: FastifyPluginAsync = async (app) => {
  const { db, config, payments } = app.ctx;

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
  }));

  app.get("/products", async () => ({ products: await listProducts(db) }));

  app.get<{ Params: { id: string } }>("/products/:id", async (request) => {
    const product = await getProduct(db, request.params.id);
    if (!product) throw notFound("Product not found");
    return { product };
  });

  app.post(
    "/orders",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
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
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const { email } = orderLookupSchema.parse({ email: request.query.email });
      return { order: await getOrderForCustomer(db, request.params.id, email) };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/orders/:id/pay",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const { email } = payInputSchema.parse(request.body);
      return { order: await payOrder(db, payments, request.params.id, email) };
    }
  );
};
