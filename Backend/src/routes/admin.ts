import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { corsOrigins } from "../config.js";
import { HttpError } from "../errors.js";
import {
  adjustStockSchema,
  listOrdersQuerySchema,
  loginSchema,
  transitionSchema,
} from "../schemas.js";
import {
  adjustStock,
  getOrderDetail,
  getStats,
  listInventory,
  listMovements,
  listOrders,
  transitionOrder,
} from "../services/admin.js";
import {
  createSession,
  deleteSession,
  findSession,
  hashPassword,
  verifyPassword,
} from "../services/auth.js";

const COOKIE = "freyya_admin";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.ctx;
  const allowedOrigins = corsOrigins(config);
  const secure = config.NODE_ENV === "production";

  // A browser always names its origin on a write. Refuse writes from anywhere we don't know.
  const checkOrigin = (request: FastifyRequest) => {
    const origin = request.headers.origin;
    if (request.method !== "GET" && origin && !allowedOrigins.includes(origin)) {
      throw new HttpError(403, "forbidden_origin", "Request origin not allowed.");
    }
  };

  const requireAdmin = async (request: FastifyRequest) => {
    checkOrigin(request);

    const token = request.cookies[COOKIE];
    const session = token ? await findSession(db, token) : null;
    if (!session) throw new HttpError(401, "unauthorized", "Sign in to continue.");
    request.admin = session;
  };

  // A hash to compare against when the email is wrong, so both failures take equal time.
  const decoyHash = await hashPassword("not-the-password");

  app.post(
    "/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply: FastifyReply) => {
      checkOrigin(request);

      if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD_HASH) {
        throw new HttpError(503, "admin_not_configured", "Admin sign-in is not set up.");
      }

      const { email, password } = loginSchema.parse(request.body);
      const emailMatches = email.trim().toLowerCase() === config.ADMIN_EMAIL.toLowerCase();
      const passwordMatches = await verifyPassword(
        password,
        emailMatches ? config.ADMIN_PASSWORD_HASH : decoyHash
      );

      if (!emailMatches || !passwordMatches) {
        throw new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
      }

      const { token } = await createSession(db, config.ADMIN_EMAIL, config.ADMIN_SESSION_HOURS);
      reply.setCookie(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: config.ADMIN_SESSION_HOURS * 3600,
      });
      return { admin: { email: config.ADMIN_EMAIL } };
    }
  );

  app.post("/logout", async (request, reply) => {
    checkOrigin(request);
    const token = request.cookies[COOKIE];
    if (token) await deleteSession(db, token);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  // Everything below needs a signed-in admin.
  await app.register(async (secured) => {
    secured.addHook("preHandler", requireAdmin);

    secured.get("/me", async (request) => ({ admin: request.admin }));

    secured.get("/stats", async () => getStats(db, config.LOW_STOCK_THRESHOLD));

    secured.get("/orders", async (request) =>
      listOrders(db, listOrdersQuerySchema.parse(request.query))
    );

    secured.get<{ Params: { id: string } }>("/orders/:id", async (request) => ({
      order: await getOrderDetail(db, request.params.id),
    }));

    secured.patch<{ Params: { id: string } }>("/orders/:id/status", async (request) => {
      const { status } = transitionSchema.parse(request.body);
      return { order: await transitionOrder(db, request.params.id, status, request.admin!.email) };
    });

    secured.get("/inventory", async () => ({
      items: await listInventory(db, config.LOW_STOCK_THRESHOLD),
    }));

    secured.get<{ Params: { skuId: string } }>("/inventory/:skuId/movements", async (request) => ({
      movements: await listMovements(db, request.params.skuId),
    }));

    secured.post<{ Params: { skuId: string } }>("/inventory/:skuId/adjust", async (request) => {
      const change = adjustStockSchema.parse(request.body);
      return adjustStock(db, request.params.skuId, change, request.admin!.email);
    });
  });
};
