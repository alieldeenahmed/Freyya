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
import { publicRoutes } from "./routes/public.js";
import { simulatedPayments, type PaymentProvider } from "./services/payments.js";

export interface AppContext {
  config: Config;
  db: Db;
  payments: PaymentProvider;
}

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
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

export async function buildApp(options: BuildOptions): Promise<FastifyInstance> {
  const { config, db } = options;

  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: config.TRUST_PROXY,
  });

  app.decorate("ctx", { config, db, payments: options.payments ?? simulatedPayments });

  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigins(config),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);
  // A generous ceiling for everything; the sensitive routes set tighter limits of their own.
  if (options.rateLimit !== false) {
    await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
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
          code: (error as { code?: string }).code?.toLowerCase() ?? "bad_request",
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

  return app;
}
