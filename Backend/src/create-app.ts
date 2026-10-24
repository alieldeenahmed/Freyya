import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { corsOrigins, type Config } from "./config.js";
import type { Db } from "./db/client.js";
import { HttpError } from "./errors.js";
import { adminRoutes } from "./routes/admin.js";
import { internalRoutes } from "./routes/internal.js";
import { publicRoutes } from "./routes/public.js";
import { clientIp } from "./services/client-ip.js";
import { simulatedPayments, type PaymentProvider } from "./services/payments.js";

export interface AppContext {
  config: Config;
  db: Db;
  payments: PaymentProvider;
  // Whether requests are counted against limits. Tests that make many orders switch it off.
  rateLimit: boolean;
}

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
    // Every route that was registered, so a test can check that none was left unprotected.
    routeTable: { method: string; url: string }[];
  }
  interface FastifyRequest {
    admin?: { email: string };
  }
}

interface BuildOptions {
  config: Config;
  db: Db;
  payments?: PaymentProvider;
  logger?: boolean;
  // On by default. Tests that create many orders switch it off.
  rateLimit?: boolean;
}

// What a request looks like in the logs. Order lookups carry the customer's email in the
// query string, so only the path is kept.
export function serializeRequest(request: { method?: string; url?: string; ip?: string }) {
  return {
    method: request.method,
    url: request.url?.split("?")[0],
    remoteAddress: request.ip,
  };
}

export async function buildApp(options: BuildOptions): Promise<FastifyInstance> {
  const { config, db } = options;

  const app = Fastify({
    logger: options.logger ? { serializers: { req: serializeRequest } } : false,
    trustProxy: config.TRUST_PROXY,
  });

  app.decorate("ctx", {
    config,
    db,
    payments: options.payments ?? simulatedPayments,
    rateLimit: options.rateLimit !== false,
  });

  const routeTable: { method: string; url: string }[] = [];
  app.decorate("routeTable", routeTable);
  app.addHook("onRoute", (route) => {
    for (const method of [route.method].flat()) {
      if (method !== "HEAD") routeTable.push({ method, url: route.url });
    }
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigins(config),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);
  // A generous ceiling for everything; the sensitive routes set tighter limits of their own.
  if (options.rateLimit !== false) {
    // This one is kept in memory, per instance, as a coarse guard against floods. The limits that
    // matter (sign-in, orders, payment) are counted in the database, shared by every instance.
    await app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: "1 minute",
      keyGenerator: (request) => clientIp(request),
    });
  }

  // Admin data and customers' orders are personal. Nothing should keep a copy of them.
  app.addHook("onSend", async (request, reply) => {
    const path = request.url.split("?")[0] ?? "";
    if (path.startsWith("/admin") || path.startsWith("/orders") || path.startsWith("/internal")) {
      reply.header("cache-control", "no-store");
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      if (error.headers) reply.headers(error.headers);
      return reply.status(error.status).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Some fields are missing or invalid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    // Errors Fastify raises itself, such as a malformed body or a rate limit.
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({
        error: {
          code:
            status === 429
              ? "rate_limited"
              : ((error as { code?: string }).code?.toLowerCase() ?? "bad_request"),
          message: (error as Error).message,
        },
      });
    }

    request.log.error(error);
    return reply
      .status(500)
      .send({ error: { code: "internal_error", message: "Something went wrong." } });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: "not_found", message: "Not found" } });
  });

  await app.register(publicRoutes);
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(internalRoutes, { prefix: "/internal" });

  return app;
}
